import {
  exportVideo,
  exportVideoToStream,
  mixSceneAudioData,
  mixSceneAudioDataFromRuntime,
  renderFrameSequenceFromRuntime,
  type MixedAudioData,
} from "@motionforge/export";
import {
  createAgentWorkflowToolRegistry,
  createCanvas2DEvidenceRenderer,
  createMemoryEvidenceArtifactStore,
  createWorkflowEvidenceAdapter,
  renderContactSheet,
  renderSceneStill,
} from "@motionforge/agent-tools";
import type { TextMetricsProvider } from "@motionforge/core";
import {
  column,
  compileLayout,
  grid,
  item,
  overlay,
  segmentLayoutTextGraphemes,
  type LayoutCompileResult,
  type LayoutPlan,
} from "@motionforge/layout";
import { createPlayerFromRuntime } from "@motionforge/player";
import { goldenExtensionRegistry } from "./extensions.js";
import {
  Canvas2DStaticDisplayCache,
  compileCanvas2DDisplayList,
  disposeAssetsAsync,
  disposeAssets,
  executeCanvas2DDisplayList,
  prepareFrame,
  renderStill,
  resolveAssets,
  ScratchSurfacePool,
  type Canvas2DStaticDisplayCacheStats,
  type ScratchSurfacePoolStats,
} from "@motionforge/renderer-canvas2d";
import { createCanvas2DSceneRuntime } from "@motionforge/renderer-canvas2d/runtime";
import { validateScene, type Scene, type SceneNode } from "@motionforge/schema";
import {
  ALL_FORMATS,
  AudioBufferSink,
  BlobSource,
  CanvasSink,
  Input,
  type StreamTargetChunk,
} from "mediabunny";
import {
  negotiateRendererCapabilities,
  rendererConformanceFixtures,
  runRendererConformanceSuite,
  traceRendererDisplayList,
  type RendererConformanceBackendAdapter,
  type RendererConformanceFixture,
  type RendererConformancePixels,
} from "./renderer-conformance.js";

export type RenderedFrame = {
  width: number;
  height: number;
  rgba: number[];
};

export type ExportedVideo = {
  size: number;
  mimeType: string;
  codec: string;
  totalFrames: number;
  /** First 12 bytes of the file; bytes 4-8 spell "ftyp" for valid MP4. */
  header: number[];
  streamSize: number;
  streamHeader: number[];
};

export type VideoCheck = {
  label: string;
  pass: boolean;
  detail: string;
};

export type ExportedVideoFile = {
  base64: string;
  size: number;
  codec: string;
  audioCodec: string | null;
  totalFrames: number;
};

declare global {
  interface Window {
    renderGoldenFrame: (scene: Scene, frame: number) => Promise<RenderedFrame>;
    renderGoldenExport: (scene: Scene) => Promise<ExportedVideo>;
    renderGoldenExportFile: (scene: Scene) => Promise<ExportedVideoFile>;
    renderGoldenFramePng: (scene: Scene, frame: number) => Promise<string>;
    renderGoldenDiffPng: (
      expected: RenderedFrame,
      received: RenderedFrame,
    ) => Promise<string>;
    runGoldenBenchmark: (options: {
      width: number;
      height: number;
      fps: number;
      seconds: number;
    }) => Promise<BenchmarkResult>;
    runGoldenCompositingBenchmark: (
      options: CompositingBenchmarkOptions,
    ) => Promise<CompositingBenchmarkResult>;
    runGoldenVideoChecks: () => Promise<VideoCheck[]>;
    runGoldenAudioChecks: () => Promise<VideoCheck[]>;
    runGoldenRuntimeParityChecks: () => Promise<VideoCheck[]>;
    runGoldenAgentToolChecks: () => Promise<VideoCheck[]>;
    runGoldenLayoutV2Checks: () => Promise<VideoCheck[]>;
    runGoldenRendererConformanceChecks: () => Promise<VideoCheck[]>;
  }
}

type CaptureContext = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
};

function createCaptureContext(width: number, height: number): CaptureContext {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context)
    throw new Error("Canvas2D is unavailable in the golden harness.");
  return { canvas, context };
}

function captureRgba(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): RenderedFrame {
  return {
    width,
    height,
    rgba: Array.from(context.getImageData(0, 0, width, height).data),
  };
}

function frameDifference(
  expected: RenderedFrame,
  received: RenderedFrame,
): string | null {
  if (
    expected.width !== received.width ||
    expected.height !== received.height
  ) {
    return `dimensions ${received.width}x${received.height}, expected ${expected.width}x${expected.height}`;
  }
  if (expected.rgba.length !== received.rgba.length) {
    return `RGBA length ${received.rgba.length}, expected ${expected.rgba.length}`;
  }
  for (let index = 0; index < expected.rgba.length; index += 1) {
    if (expected.rgba[index] !== received.rgba[index]) {
      const pixel = Math.floor(index / 4);
      const channel = ["r", "g", "b", "a"][index % 4];
      return `pixel ${pixel} ${channel}: ${received.rgba[index]}, expected ${expected.rgba[index]}`;
    }
  }
  return null;
}

function sequenceDifference(
  expected: RenderedFrame[],
  received: RenderedFrame[],
): string | null {
  if (expected.length !== received.length) {
    return `${received.length} frames, expected ${expected.length}`;
  }
  for (let index = 0; index < expected.length; index += 1) {
    const difference = frameDifference(expected[index]!, received[index]!);
    if (difference) return `frame ${index}: ${difference}`;
  }
  return null;
}

function mixedAudioDifference(
  expected: MixedAudioData | null,
  received: MixedAudioData | null,
): string | null {
  if (!expected || !received) {
    return expected === received
      ? null
      : `received ${received ? "PCM" : "silence"}, expected ${expected ? "PCM" : "silence"}`;
  }
  if (expected.sampleRate !== received.sampleRate) {
    return `sample rate ${received.sampleRate}, expected ${expected.sampleRate}`;
  }
  if (expected.channels.length !== received.channels.length) {
    return `${received.channels.length} channels, expected ${expected.channels.length}`;
  }
  for (let channel = 0; channel < expected.channels.length; channel += 1) {
    const expectedSamples = expected.channels[channel]!;
    const receivedSamples = received.channels[channel]!;
    if (expectedSamples.length !== receivedSamples.length) {
      return `channel ${channel} has ${receivedSamples.length} samples, expected ${expectedSamples.length}`;
    }
    const expectedBits = new Uint32Array(
      expectedSamples.buffer,
      expectedSamples.byteOffset,
      expectedSamples.length,
    );
    const receivedBits = new Uint32Array(
      receivedSamples.buffer,
      receivedSamples.byteOffset,
      receivedSamples.length,
    );
    for (let sample = 0; sample < expectedBits.length; sample += 1) {
      if (expectedBits[sample] !== receivedBits[sample]) {
        return `channel ${channel} sample ${sample}: bits 0x${receivedBits[sample]!.toString(16)}, expected 0x${expectedBits[sample]!.toString(16)}`;
      }
    }
  }
  return null;
}

window.runGoldenAgentToolChecks = async (): Promise<VideoCheck[]> => {
  const scene: Scene = {
    schemaVersion: 1,
    width: 160,
    height: 90,
    fps: 30,
    duration: 30,
    assets: {},
    nodes: [
      {
        id: "card",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #22d3ee, #7c3aed)",
        },
      },
    ],
  };
  const still = await renderSceneStill({ scene, frame: 0 });
  const sheet = await renderContactSheet({
    scene,
    frames: [0, 10, 20],
    columns: 2,
    cellWidth: 80,
  });
  const stillContext = still.getContext("2d");
  const alpha = stillContext?.getImageData(80, 45, 1, 1).data[3] ?? 0;
  return [
    {
      label: "still renderer returns painted pixels",
      pass: still.width === 160 && still.height === 90 && alpha === 255,
      detail: `${still.width}x${still.height}, alpha ${alpha}`,
    },
    {
      label: "contact sheet lays out requested frames",
      pass: sheet.width === 160 && sheet.height === 90,
      detail: `${sheet.width}x${sheet.height}`,
    },
    ...(await runGoldenWorkflowEvidenceChecks()),
  ];
};

async function runGoldenWorkflowEvidenceChecks(): Promise<VideoCheck[]> {
  const renderer = createCanvas2DEvidenceRenderer({
    contactSheetCellWidth: 160,
    contactSheetCellHeight: 90,
  });
  const store = createMemoryEvidenceArtifactStore({
    storeId: "golden-workflow",
    maxBytes: 16 * 1024 * 1024,
  });
  const evidence = createWorkflowEvidenceAdapter({
    renderer,
    sinkForRequest: (request) => store.sinkForRequest(request),
    onDisposeHandle: store.workflowCleanup.onDisposeHandle,
    onDisposeSession: async (context) => {
      await store.workflowCleanup.onDisposeSession(context);
      await renderer.dispose();
    },
  });
  const registry = createAgentWorkflowToolRegistry({
    sessionOptions: { sessionId: "GoldenWorkflow", evidence },
  });
  const checks: VideoCheck[] = [];
  let artifactCount = 0;
  let handle = "";
  try {
    const loaded = await registry.call("motionforge.workflow.load", {
      scene: {
        schemaVersion: 1,
        width: 160,
        height: 90,
        fps: 30,
        duration: 30,
        assets: {},
        nodes: [
          {
            id: "background",
            type: "div",
            style: {
              width: "100%",
              height: "100%",
              backgroundColor: "#0f172a",
            },
          },
          {
            id: "title",
            type: "text",
            text: "BEFORE",
            style: {
              width: "100%",
              height: "100%",
              fontSize: 28,
              fontWeight: 800,
              color: "#f8fafc",
              textAlign: "center",
              direction: "ltr",
            },
          },
        ],
      },
    });
    if (!loaded.ok || !loaded.handle) {
      throw new Error(
        loaded.ok ? "workflow load returned no handle" : loaded.error.message,
      );
    }
    handle = loaded.handle;
    const applied = await registry.call("motionforge.workflow.commands", {
      handle,
      expectedRevision: 0,
      commands: [
        {
          kind: "style.set",
          id: "background",
          style: { backgroundColor: "#ef4444" },
        },
      ],
    });
    if (!applied.ok || applied.revision !== 1) {
      throw new Error(
        applied.ok
          ? `workflow command revision ${String(applied.revision)}`
          : applied.error.message,
      );
    }
    const rendered = await registry.call("motionforge.workflow.evidence", {
      handle,
      expectedRevision: 1,
      operation: "proof.comparison.render",
      params: {
        explicitFrames: [0],
        title: "Golden before / after",
        includeVisualDiff: true,
      },
    });
    if (!rendered.ok) throw new Error(rendered.error.message);
    const result = objectValue(rendered.data).result;
    const proof = objectValue(result);
    if (proof.ok !== true) {
      throw new Error(`workflow proof failed: ${JSON.stringify(proof)}`);
    }
    const materialized = objectValue(proof.artifacts);
    const refs = Array.isArray(materialized.artifacts)
      ? materialized.artifacts.map(objectValue)
      : [];
    artifactCount = refs.length;
    const contact = refs.find((ref) => ref.kind === "contact-sheet");
    const diff = refs.find((ref) => ref.kind === "visual-diff");
    const before = refs.find(
      (ref) => ref.kind === "still" && String(ref.id).includes("before"),
    );
    const after = refs.find(
      (ref) => ref.kind === "still" && String(ref.id).includes("after"),
    );
    if (!contact || !diff || !before || !after) {
      throw new Error(
        "workflow proof omitted before/after/contact-sheet/diff refs",
      );
    }
    const contactBytes = store.read(String(contact.uri));
    const diffBytes = store.read(String(diff.uri));
    const beforeBytes = store.read(String(before.uri));
    const afterBytes = store.read(String(after.uri));
    if (!contactBytes || !diffBytes || !beforeBytes || !afterBytes) {
      throw new Error("workflow proof refs were not committed to the sink");
    }
    const contactPixels = await decodedArtifactPixels(
      contactBytes,
      String(contact.mimeType),
    );
    const diffPixels = await decodedArtifactPixels(
      diffBytes,
      String(diff.mimeType),
    );
    const beforePixels = await decodedArtifactPixels(
      beforeBytes,
      String(before.mimeType),
    );
    const afterPixels = await decodedArtifactPixels(
      afterBytes,
      String(after.mimeType),
    );
    const portable = JSON.stringify(rendered);
    checks.push(
      {
        label:
          "handle workflow performs command-check-proof without Scene replacement",
        pass:
          rendered.revision === 1 &&
          !portable.includes('"schemaVersion"') &&
          !portable.includes('"beforeScene"') &&
          !portable.includes('"afterScene"'),
        detail: `revision ${String(rendered.revision)}, ${portable.length} JSON chars`,
      },
      {
        label:
          "prepared runtime evidence commits still/visual-diff/contact artifacts",
        pass:
          refs.length >= 4 &&
          contactBytes[0] === 0x89 &&
          contactBytes[1] === 0x50 &&
          diffPixels.nonTransparent > 0 &&
          diffPixels.nonBlack > 0 &&
          contactPixels.nonTransparent > 0,
        detail: `${refs.length} refs, contact ${contactPixels.width}x${contactPixels.height}, visual diff ${diffPixels.nonBlack} changed pixels, before/after rgb ${beforePixels.rgbSum}/${afterPixels.rgbSum}`,
      },
    );
  } finally {
    await registry.dispose();
    const rendererStats = renderer.stats();
    const storeStats = store.stats();
    checks.push({
      label: "workflow proof disposal releases runtimes and scoped bytes",
      pass:
        handle.length > 0 &&
        artifactCount > 0 &&
        rendererStats.disposed &&
        rendererStats.runtimesCreated === rendererStats.runtimesDisposed &&
        storeStats.entries === 0 &&
        storeStats.bytes === 0 &&
        storeStats.openTransactions === 0,
      detail: `${rendererStats.runtimesDisposed}/${rendererStats.runtimesCreated} runtimes, ${storeStats.entries} refs, ${storeStats.bytes} bytes`,
    });
    await store.dispose();
  }
  return checks;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a portable object from workflow evidence.");
  }
  return value as Record<string, unknown>;
}

async function decodedArtifactPixels(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{
  width: number;
  height: number;
  nonTransparent: number;
  nonBlack: number;
  rgbSum: number;
}> {
  const copy = new Uint8Array(bytes);
  const bitmap = await createImageBitmap(new Blob([copy], { type: mimeType }));
  try {
    const capture = createCaptureContext(bitmap.width, bitmap.height);
    capture.context.drawImage(bitmap, 0, 0);
    const rgba = capture.context.getImageData(
      0,
      0,
      bitmap.width,
      bitmap.height,
    ).data;
    let nonTransparent = 0;
    let nonBlack = 0;
    let rgbSum = 0;
    for (let index = 0; index < rgba.length; index += 4) {
      if (rgba[index + 3]! > 0) nonTransparent += 1;
      const rgb = rgba[index]! + rgba[index + 1]! + rgba[index + 2]!;
      rgbSum += rgb;
      if (rgb > 0) {
        nonBlack += 1;
      }
    }
    capture.canvas.width = 1;
    capture.canvas.height = 1;
    return {
      width: bitmap.width,
      height: bitmap.height,
      nonTransparent,
      nonBlack,
      rgbSum,
    };
  } finally {
    bitmap.close();
  }
}

const goldenLayoutFontFamily = "GoldenLayoutInter";
const goldenLayoutTextMetrics: TextMetricsProvider = {
  measureLine({ text, fontSize }) {
    const graphemeCount = segmentLayoutTextGraphemes(text).length;
    return {
      width: graphemeCount * fontSize * 0.56,
      ascent: fontSize * 0.76,
      descent: fontSize * 0.24,
      measurement: "exact",
      reason: "MF7 pinned grapheme metrics v1",
    };
  },
};

const goldenLayoutRootPlan = overlay({
  items: [
    item("layout-background", { width: "fill", height: "fill" }),
    item("stack-panel", {
      width: "88%",
      height: "38%",
      anchor: "top-center",
      offsetY: "3%",
    }),
    item("grid-panel", {
      width: "88%",
      height: "45%",
      anchor: "bottom-center",
    }),
    item("overlay-badge", {
      width: "32%",
      height: "hug",
      anchor: "center-right",
      offsetX: "-4%",
    }),
  ],
});

const goldenLayoutStackPlan = column({
  containerId: "stack-panel",
  padding: { x: "5%", y: "6%" },
  gap: "5%",
  align: "stretch",
  items: [
    item("latin-copy", { width: "fill", height: "hug" }),
    item("rtl-copy", { width: "fill", height: "hug" }),
  ],
});

const goldenLayoutGridPlan = grid({
  containerId: "grid-panel",
  columns: [{ size: "fill" }, { size: "fill" }],
  rows: [{ size: "fill" }, { size: "fill" }],
  padding: { x: "4%", y: "5%" },
  gap: "4%",
  justifyItems: "stretch",
  alignItems: "center",
  items: [
    item("cjk-copy", { width: "fill", height: "hug" }),
    item("emoji-copy", { width: "fill", height: "hug" }),
    item("grid-swatch-a", { width: "fill", height: "fill" }),
    item("grid-swatch-b", { width: "fill", height: "fill" }),
  ],
});

const goldenLayoutPlans: readonly LayoutPlan[] = [
  goldenLayoutRootPlan,
  goldenLayoutStackPlan,
  goldenLayoutGridPlan,
];

const goldenLayoutTargets = [
  { label: "portrait", width: 360, height: 640 },
  { label: "square", width: 480, height: 480 },
  { label: "landscape", width: 640, height: 360 },
] as const;

/**
 * MF7 browser gate: one coordinate-free semantic source and plan suite is
 * compiled for all target shapes, then painted through the real Canvas path.
 */
window.runGoldenLayoutV2Checks = async (): Promise<VideoCheck[]> => {
  const checks: VideoCheck[] = [];
  const legacyScene = goldenLegacyLayoutOracleScene();
  const legacySnapshot = JSON.stringify(legacyScene);
  const legacyBefore = await renderLayoutEvidenceFrame(legacyScene);
  let primitiveKinds = "";

  for (const target of goldenLayoutTargets) {
    const source = goldenSemanticLayoutScene(target.width, target.height);
    const sourceSnapshot = JSON.stringify(source);
    const results: LayoutCompileResult[] = [];
    let compiled = source;

    for (const plan of goldenLayoutPlans) {
      const result = compileLayout(compiled, plan, {
        textMetrics: goldenLayoutTextMetrics,
      });
      results.push(result);
      compiled = result.scene;
    }

    primitiveKinds = results.map((result) => result.plan.layout.kind).join(",");
    const validation = validateScene(compiled);
    const geometry = checkLayoutEvidenceGeometry(results);
    const text = checkLayoutEvidenceText(results);
    const frame = await renderLayoutEvidenceFrame(compiled);
    const pixels = checkLayoutEvidencePixels(frame);

    checks.push(
      {
        label: `${target.label} semantic Scene v1 is valid and bounded`,
        pass:
          validation.ok &&
          geometry.pass &&
          sourceSnapshot === JSON.stringify(source),
        detail: validation.ok
          ? `${geometry.detail}; source unchanged`
          : validation.errors.join(" | "),
      },
      {
        label: `${target.label} multilingual text has prepared fit evidence`,
        pass: text.pass,
        detail: text.detail,
      },
      {
        label: `${target.label} semantic output paints real pixels`,
        pass: pixels.pass,
        detail: pixels.detail,
      },
    );
  }

  checks.push({
    label: "one source plan covers overlay plus nested stack and grid",
    pass:
      primitiveKinds === "overlay,stack,grid" &&
      semanticSourceHasNoChildPixelGeometry(
        goldenSemanticLayoutScene(360, 640).nodes,
      ),
    detail: `${primitiveKinds}; source children use semantic sizes only`,
  });

  const legacyAfter = await renderLayoutEvidenceFrame(legacyScene);
  const legacyDifference = frameDifference(legacyBefore, legacyAfter);
  checks.push({
    label: "legacy Scene v1 pixels remain byte-exact after Layout v2 use",
    pass:
      legacyDifference === null &&
      legacySnapshot === JSON.stringify(legacyScene),
    detail:
      legacyDifference ??
      `${legacyBefore.width}x${legacyBefore.height} exact RGBA and source JSON`,
  });

  return checks;
};

function goldenSemanticLayoutScene(width: number, height: number): Scene {
  const textStyle = {
    fontFamily: goldenLayoutFontFamily,
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.2,
    color: "#f8fafc",
    overflow: "hidden" as const,
    textFit: "shrink" as const,
    minFontSize: 10,
    maxLines: 4,
    textOverflow: "ellipsis" as const,
  };
  return {
    schemaVersion: 1,
    width,
    height,
    fps: 30,
    duration: 30,
    assets: {
      [goldenLayoutFontFamily]: {
        id: goldenLayoutFontFamily,
        type: "font",
        src: "/fonts/inter-700-latin.woff2",
      },
    },
    nodes: [
      {
        id: "layout-background",
        type: "div",
        style: {
          background: "linear-gradient(145deg, #08111f, #172554 55%, #312e81)",
        },
      },
      {
        id: "stack-panel",
        type: "div",
        style: {
          backgroundColor: "rgba(15,23,42,0.86)",
          border: "2px solid rgba(103,232,249,0.62)",
          borderRadius: 18,
          overflow: "hidden",
          zIndex: 2,
        },
        children: [
          {
            id: "latin-copy",
            type: "text",
            text: "Deterministic semantic layout keeps a long Latin headline bounded while the same source adapts from portrait to square and landscape video.",
            style: {
              ...textStyle,
              backgroundColor: "rgba(14,116,144,0.32)",
            },
          },
          {
            id: "rtl-copy",
            type: "text",
            text: "مرحبا بالعالم هذا اختبار طويل للتخطيط الحتمي للنص العربي داخل مساحة فيديو آمنة",
            style: {
              ...textStyle,
              direction: "rtl",
              textAlign: "right",
              color: "#fde68a",
            },
          },
        ],
      },
      {
        id: "grid-panel",
        type: "div",
        style: {
          backgroundColor: "rgba(30,41,59,0.88)",
          borderRadius: 18,
          overflow: "hidden",
          zIndex: 2,
        },
        children: [
          {
            id: "cjk-copy",
            type: "text",
            text: "这是一个用于验证纵向、方形和横向视频布局的长中文文本示例。",
            style: {
              ...textStyle,
              backgroundColor: "rgba(124,58,237,0.34)",
            },
          },
          {
            id: "emoji-copy",
            type: "text",
            text: "👩🏽‍💻 🚀 🎬 ✨ 🌍 👨‍👩‍👧‍👦 🧭 🎨 📐 ✅",
            style: {
              ...textStyle,
              textAlign: "center",
              backgroundColor: "rgba(190,24,93,0.3)",
            },
          },
          {
            id: "grid-swatch-a",
            type: "div",
            style: {
              background:
                "linear-gradient(135deg, #06b6d4, #2563eb 55%, #7c3aed)",
              borderRadius: 12,
            },
          },
          {
            id: "grid-swatch-b",
            type: "div",
            style: {
              background:
                "radial-gradient(circle at 35% 30%, #fde68a, #f97316 55%, #be123c)",
              borderRadius: 12,
            },
          },
        ],
      },
      {
        id: "overlay-badge",
        type: "text",
        text: "LAYOUT V2",
        style: {
          ...textStyle,
          maxLines: 1,
          textAlign: "center",
          color: "#111827",
          backgroundColor: "#fbbf24",
          borderRadius: 999,
          zIndex: 8,
        },
      },
    ],
  };
}

function goldenLegacyLayoutOracleScene(): Scene {
  return {
    schemaVersion: 1,
    width: 192,
    height: 108,
    fps: 30,
    duration: 1,
    assets: {},
    nodes: [
      {
        id: "legacy-background",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background: "linear-gradient(90deg, #0f172a, #1d4ed8)",
        },
      },
      {
        id: "legacy-card",
        type: "div",
        style: {
          position: "absolute",
          left: 34,
          top: 20,
          width: 124,
          height: 68,
          backgroundColor: "#f59e0b",
          borderRadius: 14,
          boxShadow: "0px 8px 22px rgba(0,0,0,0.34)",
        },
      },
    ],
  };
}

function checkLayoutEvidenceGeometry(
  results: LayoutCompileResult[],
): VideoCheck {
  let count = 0;
  for (const result of results) {
    for (const measurement of result.measurements) {
      count += 1;
      const rect = measurement.resolved;
      const finite = [rect.x, rect.y, rect.width, rect.height].every(
        Number.isFinite,
      );
      const bounded =
        rect.x >= result.container.x - 1e-6 &&
        rect.y >= result.container.y - 1e-6 &&
        rect.x + rect.width <=
          result.container.x + result.container.width + 1e-6 &&
        rect.y + rect.height <=
          result.container.y + result.container.height + 1e-6;
      if (!finite || !bounded) {
        return {
          label: "geometry",
          pass: false,
          detail: `${measurement.id} ${JSON.stringify(rect)} outside ${JSON.stringify(result.container)}`,
        };
      }
    }
  }
  return {
    label: "geometry",
    pass: count >= 10,
    detail: `${count} bounded boxes`,
  };
}

function checkLayoutEvidenceText(results: LayoutCompileResult[]): VideoCheck {
  const measurements = results
    .flatMap((result) => result.measurements)
    .filter((measurement) => measurement.textPlan);
  const ids = new Set(measurements.map((measurement) => measurement.id));
  const expected = [
    "overlay-badge",
    "latin-copy",
    "rtl-copy",
    "cjk-copy",
    "emoji-copy",
  ];
  const fit = measurements.every(
    (measurement) =>
      measurement.textPlan?.fit.status !== "impossible" &&
      (measurement.textPlan?.lines.length ?? 0) > 0 &&
      measurement.font?.assetId === goldenLayoutFontFamily,
  );
  const rtl = measurements.find((measurement) => measurement.id === "rtl-copy")
    ?.textPlan?.baseDirection;
  return {
    label: "text",
    pass: fit && expected.every((id) => ids.has(id)) && rtl === "rtl",
    detail: `${measurements.length} planned tracks, RTL ${rtl ?? "missing"}`,
  };
}

function checkLayoutEvidencePixels(frame: RenderedFrame): VideoCheck {
  let opaque = 0;
  let bright = 0;
  const colors = new Set<string>();
  for (let index = 0; index < frame.rgba.length; index += 4) {
    const red = frame.rgba[index]!;
    const green = frame.rgba[index + 1]!;
    const blue = frame.rgba[index + 2]!;
    const alpha = frame.rgba[index + 3]!;
    if (alpha > 0) opaque += 1;
    if (alpha > 0 && red + green + blue > 570) bright += 1;
    if (index % 64 === 0 && alpha > 0) {
      colors.add(`${red >> 4}:${green >> 4}:${blue >> 4}`);
    }
  }
  const pixels = frame.width * frame.height;
  const pass = opaque > pixels * 0.95 && bright > 24 && colors.size >= 8;
  return {
    label: "pixels",
    pass,
    detail: `${opaque}/${pixels} opaque, ${bright} bright, ${colors.size} sampled colors`,
  };
}

function semanticSourceHasNoChildPixelGeometry(nodes: SceneNode[]): boolean {
  const geometryKeys: Array<keyof NonNullable<SceneNode["style"]>> = [
    "position",
    "left",
    "right",
    "top",
    "bottom",
    "inset",
    "width",
    "height",
  ];
  const pending = [...nodes];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (geometryKeys.some((key) => node.style?.[key] !== undefined)) {
      return false;
    }
    pending.push(...(node.children ?? []));
  }
  return true;
}

async function renderLayoutEvidenceFrame(scene: Scene): Promise<RenderedFrame> {
  const capture = createCaptureContext(scene.width, scene.height);
  let assets: Awaited<ReturnType<typeof resolveAssets>> | undefined;
  try {
    assets = await resolveAssets(scene, {
      extensions: goldenExtensionRegistry,
    });
    await prepareFrame(scene, 0, assets);
    renderStill(capture.context, scene, 0, { assets });
    return captureRgba(capture.context, scene.width, scene.height);
  } finally {
    if (assets) await disposeAssetsAsync(assets);
    capture.canvas.width = 1;
    capture.canvas.height = 1;
  }
}

const canvasDisplayListCapabilities = [
  { id: "motionforge.effect", version: "1" },
  { id: "motionforge.filter", version: "1" },
  { id: "motionforge.mask.soft", version: "1" },
  { id: "motionforge.paint.conic", version: "1" },
] as const;

const canvasDisplayListConformanceAdapter: RendererConformanceBackendAdapter = {
  backendId: "canvas2d-pinned-chromium",
  displayListVersion: 1,
  capabilities: canvasDisplayListCapabilities,
  async execute({ fixture, displayList }) {
    const missing = negotiateRendererCapabilities(
      displayList,
      canvasDisplayListCapabilities,
    );
    if (missing.length > 0) return { status: "rejected", missing };

    const trace = traceRendererDisplayList(displayList);
    if (!fixture.pixelCapable) return { status: "accepted", trace };

    const sourceFixture = rendererConformanceFixtures.find(
      (candidate) => candidate.id === fixture.id,
    );
    if (!sourceFixture) {
      throw new Error(`Unknown renderer conformance fixture ${fixture.id}.`);
    }

    const capture = createCaptureContext(
      sourceFixture.scene.width,
      sourceFixture.scene.height,
    );
    try {
      // Exercise both Canvas adapter boundaries. Pixel fixtures deliberately
      // avoid prepared media/extensions so the neutral core compilation and
      // Canvas-host compilation must be byte-for-byte identical.
      const canvasCompiled = compileCanvas2DDisplayList(
        capture.context,
        sourceFixture.scene,
        sourceFixture.frame,
      );
      if (JSON.stringify(canvasCompiled) !== JSON.stringify(displayList)) {
        throw new Error(
          `Canvas compiler diverged from the neutral DisplayList for ${fixture.id}.`,
        );
      }
      executeCanvas2DDisplayList(capture.context, displayList, {
        scene: sourceFixture.scene,
      });
      return {
        status: "accepted",
        trace,
        pixels: captureRgba(
          capture.context,
          sourceFixture.scene.width,
          sourceFixture.scene.height,
        ),
      };
    } finally {
      capture.canvas.width = 1;
      capture.canvas.height = 1;
    }
  },
};

window.runGoldenRendererConformanceChecks = async (): Promise<VideoCheck[]> => {
  const suite = await runRendererConformanceSuite(
    canvasDisplayListConformanceAdapter,
    {
      renderReference: renderRendererConformanceReference,
    },
  );
  return suite.cases.map((result) => ({
    label: `${suite.backendId}: ${result.fixtureId}`,
    pass: result.pass,
    detail: result.detail,
  }));
};

function renderRendererConformanceReference(
  fixture: RendererConformanceFixture,
): RendererConformancePixels {
  const capture = createCaptureContext(
    fixture.scene.width,
    fixture.scene.height,
  );
  try {
    renderStill(capture.context, fixture.scene, fixture.frame);
    return captureRgba(
      capture.context,
      fixture.scene.width,
      fixture.scene.height,
    );
  } finally {
    capture.canvas.width = 1;
    capture.canvas.height = 1;
  }
}

window.renderGoldenFrame = async (
  scene: Scene,
  frame: number,
): Promise<RenderedFrame> => {
  const canvas = document.createElement("canvas");
  canvas.width = scene.width;
  canvas.height = scene.height;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas2D is unavailable in the golden harness.");
  }

  const assets = await resolveAssets(scene, {
    extensions: goldenExtensionRegistry,
  });
  await prepareFrame(scene, frame, assets);
  renderStill(context, scene, frame, { assets });

  const image = context.getImageData(0, 0, scene.width, scene.height);

  return {
    width: scene.width,
    height: scene.height,
    rgba: Array.from(image.data),
  };
};

/**
 * End-to-end video-clip check, fully in-browser:
 * 1. Synthesize a source clip with exportVideo (red for 1s, blue for 1s).
 * 2. Composite it through video nodes with trim/playbackRate and verify the
 *    previewed pixels show the right source frames.
 * 3. Export the composite scene to MP4, decode it back, and verify the
 *    exported pixels match the preview.
 * Colors are checked with tolerance because both encodes are lossy.
 */
window.runGoldenVideoChecks = async (): Promise<VideoCheck[]> => {
  const checks: VideoCheck[] = [];
  const fps = 30;

  const sourceScene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps,
    duration: 60,
    assets: {},
    nodes: [
      {
        id: "red",
        type: "div",
        from: 0,
        duration: 30,
        style: { width: "100%", height: "100%", backgroundColor: "#ff0000" },
        children: [],
      },
      {
        id: "blue",
        type: "div",
        from: 30,
        duration: 30,
        style: { width: "100%", height: "100%", backgroundColor: "#0000ff" },
        children: [],
      },
    ],
  };

  const clipStart = performance.now();
  const { blob: clipBlob } = await exportVideo({ scene: sourceScene });
  const clipMs = performance.now() - clipStart;
  const clipUrl = URL.createObjectURL(clipBlob);

  const compositeScene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps,
    duration: 30,
    assets: {
      clip: { id: "clip", type: "video", src: clipUrl },
    },
    nodes: [
      {
        id: "background",
        type: "div",
        from: 0,
        duration: 30,
        style: { width: "100%", height: "100%", backgroundColor: "#101820" },
        children: [],
      },
      {
        id: "trimmed",
        type: "video",
        assetId: "clip",
        videoStartTime: 1.5,
        from: 0,
        duration: 30,
        style: {
          position: "absolute",
          left: 10,
          top: 40,
          width: 140,
          height: 100,
          objectFit: "fill",
        },
        children: [],
      },
      {
        id: "rated",
        type: "video",
        assetId: "clip",
        videoStartTime: 0.5,
        playbackRate: 2,
        from: 0,
        duration: 30,
        style: {
          position: "absolute",
          left: 170,
          top: 40,
          width: 140,
          height: 100,
          objectFit: "fill",
        },
        children: [],
      },
    ],
  };

  const assets = await resolveAssets(compositeScene);

  const readCenter = (
    pixels: Uint8ClampedArray | number[],
    width: number,
    x: number,
    y: number,
  ): [number, number, number] => {
    const offset = (y * width + x) * 4;
    return [
      Number(pixels[offset]),
      Number(pixels[offset + 1]),
      Number(pixels[offset + 2]),
    ];
  };

  const isRed = ([r, g, b]: [number, number, number]): boolean =>
    r > 180 && g < 80 && b < 80;
  const isBlue = ([r, g, b]: [number, number, number]): boolean =>
    b > 180 && r < 80 && g < 80;

  const renderComposite = async (frame: number): Promise<Uint8ClampedArray> => {
    const canvas = document.createElement("canvas");
    canvas.width = compositeScene.width;
    canvas.height = compositeScene.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("Canvas2D unavailable");
    }

    await prepareFrame(compositeScene, frame, assets);
    renderStill(context, compositeScene, frame, { assets });
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  };

  // Scene frame 0: trimmed node shows source t=1.5s (blue half);
  // rated node shows 0.5 + 0*2 = 0.5s (red half).
  const frame0 = await renderComposite(0);
  const trimmedAt0 = readCenter(frame0, 320, 80, 90);
  const ratedAt0 = readCenter(frame0, 320, 240, 90);
  checks.push({
    label: "trim: videoStartTime 1.5s shows the blue source half at frame 0",
    pass: isBlue(trimmedAt0),
    detail: `rgb(${trimmedAt0.join(", ")})`,
  });
  checks.push({
    label: "rate: 0.5s + 0x2 shows the red source half at frame 0",
    pass: isRed(ratedAt0),
    detail: `rgb(${ratedAt0.join(", ")})`,
  });

  // Scene frame 15 (0.5s): rated node shows 0.5 + 0.5*2 = 1.5s (blue half).
  const frame15 = await renderComposite(15);
  const ratedAt15 = readCenter(frame15, 320, 240, 90);
  checks.push({
    label: "rate: playbackRate 2 reaches the blue source half by frame 15",
    pass: isBlue(ratedAt15),
    detail: `rgb(${ratedAt15.join(", ")})`,
  });

  // Export the composite and decode frame 0 back from the file.
  const exportStart = performance.now();
  const { blob: compositeBlob } = await exportVideo({
    scene: compositeScene,
    assets,
  });
  const exportMs = performance.now() - exportStart;

  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(compositeBlob),
  });
  const track = await input.getPrimaryVideoTrack();

  if (!track) {
    throw new Error("exported composite has no video track");
  }

  const sink = new CanvasSink(track);
  const wrapped = await sink.getCanvas(0);

  if (!wrapped) {
    throw new Error("exported composite has no frame at t=0");
  }

  const decodeCanvas = document.createElement("canvas");
  decodeCanvas.width = wrapped.canvas.width;
  decodeCanvas.height = wrapped.canvas.height;
  const decodeContext = decodeCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!decodeContext) {
    throw new Error("Canvas2D unavailable for decode");
  }

  decodeContext.drawImage(wrapped.canvas, 0, 0);
  const exported = decodeContext.getImageData(
    0,
    0,
    decodeCanvas.width,
    decodeCanvas.height,
  ).data;
  const exportedTrimmed = readCenter(exported, decodeCanvas.width, 80, 90);
  const exportedRated = readCenter(exported, decodeCanvas.width, 240, 90);

  checks.push({
    label: "export round-trip: exported frame 0 matches preview (trimmed node)",
    pass: isBlue(exportedTrimmed),
    detail: `rgb(${exportedTrimmed.join(", ")})`,
  });
  checks.push({
    label: "export round-trip: exported frame 0 matches preview (rated node)",
    pass: isRed(exportedRated),
    detail: `rgb(${exportedRated.join(", ")})`,
  });
  checks.push({
    label: "timing baseline",
    pass: true,
    detail: `source clip (60f): ${clipMs.toFixed(0)}ms, composite export (30f, 2 video nodes): ${exportMs.toFixed(0)}ms`,
  });

  const behaviorScene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps,
    duration: 30,
    assets: { clip: { id: "clip", type: "video", src: clipUrl } },
    nodes: [
      {
        id: "loop",
        type: "video",
        assetId: "clip",
        videoStartTime: 1.5,
        videoEndBehavior: "loop",
        volume: 0,
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          width: 160,
          height: 180,
        },
      },
      {
        id: "reverse",
        type: "video",
        assetId: "clip",
        videoStartTime: 1.5,
        playbackRate: -1,
        volume: 0,
        style: {
          position: "absolute",
          left: 160,
          top: 0,
          width: 160,
          height: 180,
        },
      },
    ],
  };
  const behaviorAssets = await resolveAssets(behaviorScene);
  const behaviorCanvas = document.createElement("canvas");
  behaviorCanvas.width = 320;
  behaviorCanvas.height = 180;
  const behaviorContext = behaviorCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!behaviorContext) throw new Error("Canvas2D unavailable");
  await prepareFrame(behaviorScene, 0, behaviorAssets);
  renderStill(behaviorContext, behaviorScene, 0, { assets: behaviorAssets });
  const behaviorAt0 = behaviorContext.getImageData(0, 0, 320, 180).data;
  await prepareFrame(behaviorScene, 20, behaviorAssets);
  renderStill(behaviorContext, behaviorScene, 20, { assets: behaviorAssets });
  const behaviorAt20 = behaviorContext.getImageData(0, 0, 320, 180).data;
  checks.push({
    label: "edge behavior: loop wraps and reverse walks backward",
    pass:
      isBlue(readCenter(behaviorAt0, 320, 80, 90)) &&
      isBlue(readCenter(behaviorAt0, 320, 240, 90)) &&
      isRed(readCenter(behaviorAt20, 320, 80, 90)) &&
      isRed(readCenter(behaviorAt20, 320, 240, 90)),
    detail: "loop/reverse colors match source-time mapping",
  });
  disposeAssets(behaviorAssets);

  input.dispose();
  disposeAssets(assets);
  URL.revokeObjectURL(clipUrl);

  return checks;
};

window.renderGoldenExport = async (scene: Scene): Promise<ExportedVideo> => {
  const { blob, codec, totalFrames } = await exportVideo({ scene });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let streamed = new Uint8Array(0);
  const writable = new WritableStream<StreamTargetChunk>({
    write(chunk) {
      const needed = chunk.position + chunk.data.length;
      if (needed > streamed.length) {
        const grown = new Uint8Array(needed);
        grown.set(streamed);
        streamed = grown;
      }
      streamed.set(chunk.data, chunk.position);
    },
  });
  await exportVideoToStream({ scene }, writable, {
    chunked: true,
    chunkSize: 64 * 1024,
  });

  return {
    size: bytes.length,
    mimeType: blob.type,
    codec,
    totalFrames,
    header: Array.from(bytes.slice(0, 12)),
    streamSize: streamed.length,
    streamHeader: Array.from(streamed.slice(0, 12)),
  };
};

/** Builds a mono 16-bit PCM WAV containing a sine tone. */
function buildToneWav(
  seconds: number,
  frequency: number,
  sampleRate = 48_000,
  amplitude = 0.5,
): Blob {
  const samples = Math.round(seconds * sampleRate);
  const view = new DataView(new ArrayBuffer(44 + samples * 2));
  const writeAscii = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, samples * 2, true);

  for (let index = 0; index < samples; index += 1) {
    const value =
      Math.sin((2 * Math.PI * frequency * index) / sampleRate) * amplitude;
    view.setInt16(44 + index * 2, Math.round(value * 32767), true);
  }

  return new Blob([view.buffer], { type: "audio/wav" });
}

/**
 * Pinned-Chromium equivalence gate for the MF5 prepared runtime. The legacy
 * renderer is the compatibility oracle: runtime, player, and export paths
 * must return every RGBA byte unchanged. PCM is compared by Float32 bit
 * pattern rather than tolerance so signed zero and NaN payloads cannot hide.
 */
window.runGoldenRuntimeParityChecks = async (): Promise<VideoCheck[]> => {
  const checks: VideoCheck[] = [];
  const scene: Scene = {
    schemaVersion: 1,
    width: 64,
    height: 40,
    fps: 30,
    duration: 2,
    assets: {},
    nodes: [
      {
        id: "opaque-first-frame",
        type: "div",
        from: 0,
        duration: 1,
        style: {
          width: "100%",
          height: "100%",
          backgroundColor: "#3578e5",
        },
      },
    ],
  };

  const legacyCapture = createCaptureContext(scene.width, scene.height);
  const legacyFrames: RenderedFrame[] = [];
  for (let frame = 0; frame < scene.duration; frame += 1) {
    renderStill(legacyCapture.context, scene, frame);
    legacyFrames.push(
      captureRgba(legacyCapture.context, scene.width, scene.height),
    );
  }

  const opaque = legacyFrames[0]!.rgba.every(
    (value, index) => index % 4 !== 3 || value === 255,
  );
  const transparent = legacyFrames[1]!.rgba.every((value) => value === 0);
  checks.push({
    label: "legacy oracle is opaque then fully transparent",
    pass: opaque && transparent,
    detail:
      opaque && transparent ? "2 exact RGBA frames" : "oracle invariant failed",
  });

  const runtime = await createCanvas2DSceneRuntime({
    scene,
    resolve: { extensions: goldenExtensionRegistry },
  });

  try {
    const preparedCapture = createCaptureContext(scene.width, scene.height);
    const poison = {
      a: 0.75,
      b: 0.2,
      c: -0.1,
      d: 1.25,
      e: 7,
      f: -3,
      alpha: 0.17,
      composite: "destination-out" as GlobalCompositeOperation,
      filter: "blur(2px)",
    };
    preparedCapture.context.setTransform(
      poison.a,
      poison.b,
      poison.c,
      poison.d,
      poison.e,
      poison.f,
    );
    preparedCapture.context.globalAlpha = poison.alpha;
    preparedCapture.context.globalCompositeOperation = poison.composite;
    preparedCapture.context.filter = poison.filter;
    preparedCapture.context.shadowBlur = 9;
    preparedCapture.context.shadowColor = "#ff00ff";
    preparedCapture.context.shadowOffsetX = 13;
    preparedCapture.context.shadowOffsetY = -11;
    const poisonedTransform = preparedCapture.context.getTransform();
    const poisonedState = {
      alpha: preparedCapture.context.globalAlpha,
      composite: preparedCapture.context.globalCompositeOperation,
      filter: preparedCapture.context.filter,
      shadowBlur: preparedCapture.context.shadowBlur,
      shadowColor: preparedCapture.context.shadowColor,
      shadowOffsetX: preparedCapture.context.shadowOffsetX,
      shadowOffsetY: preparedCapture.context.shadowOffsetY,
    };

    const preparedFrames: RenderedFrame[] = [];
    for (let frame = 0; frame < scene.duration; frame += 1) {
      const token = await runtime.prepareFrame(frame);
      await runtime.renderPrepared(token, preparedCapture.context);
      preparedFrames.push(
        captureRgba(preparedCapture.context, scene.width, scene.height),
      );
    }

    const preparedDifference = sequenceDifference(legacyFrames, preparedFrames);
    checks.push({
      label: "prepared runtime matches legacy RGBA under poisoned caller state",
      pass: preparedDifference === null,
      detail:
        preparedDifference ??
        `${preparedFrames[0]!.rgba.length * 2} bytes exact`,
    });

    const restoredTransform = preparedCapture.context.getTransform();
    const poisonRestored =
      restoredTransform.a === poisonedTransform.a &&
      restoredTransform.b === poisonedTransform.b &&
      restoredTransform.c === poisonedTransform.c &&
      restoredTransform.d === poisonedTransform.d &&
      restoredTransform.e === poisonedTransform.e &&
      restoredTransform.f === poisonedTransform.f &&
      preparedCapture.context.globalAlpha === poisonedState.alpha &&
      preparedCapture.context.globalCompositeOperation ===
        poisonedState.composite &&
      preparedCapture.context.filter === poisonedState.filter &&
      preparedCapture.context.shadowBlur === poisonedState.shadowBlur &&
      preparedCapture.context.shadowColor === poisonedState.shadowColor &&
      preparedCapture.context.shadowOffsetX === poisonedState.shadowOffsetX &&
      preparedCapture.context.shadowOffsetY === poisonedState.shadowOffsetY;
    checks.push({
      label: "prepared runtime preserves the caller draw state",
      pass: poisonRestored,
      detail: poisonRestored
        ? "transform, alpha, composite, filter, and shadow restored"
        : "one or more poisoned properties leaked",
    });

    const playerCapture = createCaptureContext(scene.width, scene.height);
    const player = await createPlayerFromRuntime(runtime, {
      context: playerCapture.context,
      audio: false,
    });
    const playerFrames: RenderedFrame[] = [];
    try {
      playerFrames.push(
        captureRgba(playerCapture.context, scene.width, scene.height),
      );
      await player.seek(1);
      playerFrames.push(
        captureRgba(playerCapture.context, scene.width, scene.height),
      );
    } finally {
      await player.disposeAsync();
    }
    const playerDifference = sequenceDifference(legacyFrames, playerFrames);
    checks.push({
      label: "player-from-runtime matches legacy RGBA",
      pass: playerDifference === null,
      detail:
        playerDifference ?? `${playerFrames[0]!.rgba.length * 2} bytes exact`,
    });

    const exportCapture = createCaptureContext(scene.width, scene.height);
    const exportFrames: RenderedFrame[] = [];
    await renderFrameSequenceFromRuntime(runtime, {
      context: exportCapture.context,
      startFrame: 0,
      endFrame: 1,
      onFrame: () => {
        exportFrames.push(
          captureRgba(exportCapture.context, scene.width, scene.height),
        );
      },
    });
    const exportDifference = sequenceDifference(legacyFrames, exportFrames);
    checks.push({
      label: "export frame-sequence-from-runtime matches legacy RGBA",
      pass: exportDifference === null,
      detail:
        exportDifference ?? `${exportFrames[0]!.rgba.length * 2} bytes exact`,
    });
  } finally {
    await runtime.disposeAsync();
  }

  const toneUrl = URL.createObjectURL(buildToneWav(0.25, 523.25));
  const audioScene: Scene = {
    schemaVersion: 1,
    width: 64,
    height: 40,
    fps: 30,
    duration: 6,
    assets: {
      tone: { id: "tone", type: "audio", src: toneUrl },
    },
    nodes: [
      {
        id: "timed-tone",
        type: "audio",
        assetId: "tone",
        from: 1,
        duration: 4,
        audioStartTime: 0.02,
        volume: 0.625,
      },
    ],
  };
  let directAssets: Awaited<ReturnType<typeof resolveAssets>> | undefined;
  let audioRuntime:
    | Awaited<ReturnType<typeof createCanvas2DSceneRuntime>>
    | undefined;
  try {
    directAssets = await resolveAssets(audioScene);
    const direct = await mixSceneAudioData(audioScene, directAssets, 0, 5);
    audioRuntime = await createCanvas2DSceneRuntime({ scene: audioScene });
    const borrowed = await mixSceneAudioDataFromRuntime(audioRuntime, 0, 5);
    const difference = mixedAudioDifference(direct, borrowed);
    const sampleCount =
      direct?.channels.reduce((sum, channel) => sum + channel.length, 0) ?? 0;
    checks.push({
      label: "runtime-borrowed audio matches direct Float32 PCM",
      pass: difference === null,
      detail: difference ?? `${sampleCount} Float32 samples bit-exact`,
    });
  } finally {
    await audioRuntime?.disposeAsync();
    if (directAssets) await disposeAssetsAsync(directAssets);
    URL.revokeObjectURL(toneUrl);
  }

  return checks;
};

async function rmsOver(
  sink: AudioBufferSink,
  start: number,
  end: number,
  channel = 0,
): Promise<number> {
  let sumSquares = 0;
  let count = 0;

  for await (const wrapped of sink.buffers(start, end)) {
    const data = wrapped.buffer.getChannelData(
      Math.min(channel, wrapped.buffer.numberOfChannels - 1),
    );

    for (let index = 0; index < data.length; index += 1) {
      const at = wrapped.timestamp + index / wrapped.buffer.sampleRate;

      if (at >= start && at < end) {
        sumSquares += (data[index] ?? 0) ** 2;
        count += 1;
      }
    }
  }

  return count === 0 ? 0 : Math.sqrt(sumSquares / count);
}

/**
 * End-to-end audio check: a 1s sine WAV placed at scene frame 15 (0.5s) with
 * volume 0.8 exports into the MP4's audio track — silent before 0.5s, tone
 * after, verified by decoding the exported file and measuring RMS windows.
 */
window.runGoldenAudioChecks = async (): Promise<VideoCheck[]> => {
  const checks: VideoCheck[] = [];
  const toneUrl = URL.createObjectURL(buildToneWav(1.0, 440));

  const scene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 45,
    assets: {
      tone: { id: "tone", type: "audio", src: toneUrl },
    },
    nodes: [
      {
        id: "background",
        type: "div",
        from: 0,
        duration: 45,
        style: { width: "100%", height: "100%", backgroundColor: "#101820" },
        children: [],
      },
      {
        id: "track",
        type: "audio",
        assetId: "tone",
        from: 15,
        duration: 30,
        volume: 0.8,
      },
    ],
  };

  const assets = await resolveAssets(scene, {
    extensions: goldenExtensionRegistry,
  });
  const exportStart = performance.now();
  // 0.4s chunks force the chunked mix path (4 windows over 1.5s, with the
  // tone start crossing a chunk boundary); the RMS/alignment checks below
  // then validate chunk concatenation, not just the mix math.
  const { blob, audioCodec } = await exportVideo({
    scene,
    assets,
    audioChunkSeconds: 0.4,
  });
  const exportMs = performance.now() - exportStart;

  checks.push({
    label: "audio: export negotiates an MP4 audio codec",
    pass: audioCodec !== null,
    detail: String(audioCodec),
  });

  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(blob),
  });
  const track = await input.getPrimaryAudioTrack();

  checks.push({
    label: "audio: exported MP4 contains an audio track",
    pass: track !== null,
    detail: track
      ? `${track.numberOfChannels}ch @ ${track.sampleRate}Hz`
      : "no track",
  });

  if (track) {
    const duration = await input.computeDuration([track]);
    checks.push({
      label: "audio: track covers the scene duration (1.5s)",
      pass: Math.abs(duration - 1.5) < 0.15,
      detail: `${duration.toFixed(3)}s`,
    });

    const sink = new AudioBufferSink(track);

    // Margins around the 0.5s boundary absorb encoder priming/padding.
    const silentRms = await rmsOver(sink, 0.05, 0.4);
    const toneRms = await rmsOver(sink, 0.6, 1.4);

    checks.push({
      label: "audio: silent before the node starts at frame 15",
      pass: silentRms < 0.02,
      detail: `rms ${silentRms.toFixed(4)}`,
    });
    checks.push({
      label: "audio: tone plays after frame 15 (0.5 amp x 0.8 volume)",
      // Expected RMS of a 0.4-amplitude sine is ~0.283.
      pass: toneRms > 0.15 && toneRms < 0.4,
      detail: `rms ${toneRms.toFixed(4)}`,
    });
  }

  checks.push({
    label: "audio: timing baseline",
    pass: true,
    detail: `45-frame export with mixed audio: ${exportMs.toFixed(0)}ms`,
  });

  input.dispose();
  disposeAssets(assets);

  // --- video nodes contribute their own clip audio ------------------------
  // Synthesize a 1s source MP4 whose soundtrack is the tone, place it as a
  // *video* node at frame 15 with volume 0.8, and verify the composite's
  // audio: silent head, tone in the clip's window. The video node is the
  // only audio source in the composite scene.
  const sourceScene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 30,
    assets: { tone: { id: "tone", type: "audio", src: toneUrl } },
    nodes: [
      {
        id: "bg",
        type: "div",
        from: 0,
        duration: 30,
        style: { width: "100%", height: "100%", backgroundColor: "#aa2200" },
        children: [],
      },
      { id: "sound", type: "audio", assetId: "tone", from: 0, duration: 30 },
    ],
  };

  const sourceAssets = await resolveAssets(sourceScene);
  const { blob: clipBlob } = await exportVideo({
    scene: sourceScene,
    assets: sourceAssets,
  });
  disposeAssets(sourceAssets);
  const clipUrl = URL.createObjectURL(clipBlob);

  const compositeScene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 45,
    assets: { clip: { id: "clip", type: "video", src: clipUrl } },
    nodes: [
      {
        id: "bg",
        type: "div",
        from: 0,
        duration: 45,
        style: { width: "100%", height: "100%", backgroundColor: "#101820" },
        children: [],
      },
      {
        id: "shot",
        type: "video",
        assetId: "clip",
        from: 15,
        duration: 30,
        volume: 0.8,
        style: { width: "100%", height: "100%" },
        children: [],
      },
    ],
  };

  const compositeAssets = await resolveAssets(compositeScene);
  const { blob: compositeBlob, audioCodec: compositeAudioCodec } =
    await exportVideo({ scene: compositeScene, assets: compositeAssets });

  checks.push({
    label: "audio: video node's clip soundtrack reaches the export",
    pass: compositeAudioCodec !== null,
    detail: String(compositeAudioCodec),
  });

  const compositeInput = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(compositeBlob),
  });
  const compositeTrack = await compositeInput.getPrimaryAudioTrack();

  if (compositeTrack) {
    const sink = new AudioBufferSink(compositeTrack);

    const headRms = await rmsOver(sink, 0.05, 0.4);
    const clipRms = await rmsOver(sink, 0.6, 1.4);

    checks.push({
      label: "audio: silent before the video node starts",
      pass: headRms < 0.02,
      detail: `rms ${headRms.toFixed(4)}`,
    });
    checks.push({
      label:
        "audio: video clip audio plays in its window (0.5 amp x 0.8 volume)",
      // Source tone (0.5 amp) x volume 0.8 ≈ rms 0.283 through two AAC passes.
      pass: clipRms > 0.15 && clipRms < 0.4,
      detail: `rms ${clipRms.toFixed(4)}`,
    });
  } else {
    checks.push({
      label: "audio: silent before the video node starts",
      pass: false,
      detail: "no audio track in composite export",
    });
  }

  compositeInput.dispose();
  disposeAssets(compositeAssets);
  URL.revokeObjectURL(clipUrl);

  // --- audio automation and looped beds -----------------------------------
  // Keep the three tones separated so decoded RMS windows can prove static
  // volume, envelope gain, and source wrapping independently.
  const automationScene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 120,
    assets: { tone: { id: "tone", type: "audio", src: toneUrl } },
    nodes: [
      {
        id: "bg",
        type: "div",
        from: 0,
        duration: 120,
        style: { width: "100%", height: "100%", backgroundColor: "#101820" },
        children: [],
      },
      {
        id: "static",
        type: "audio",
        assetId: "tone",
        from: 0,
        duration: 24,
        volume: 0.8,
      },
      {
        id: "fade",
        type: "audio",
        assetId: "tone",
        from: 36,
        duration: 30,
        volume: 0.8,
        volumeEnvelope: [
          { frame: 0, value: 0 },
          { frame: 30, value: 1, easing: "linear" },
        ],
      },
      {
        id: "loop",
        type: "audio",
        assetId: "tone",
        from: 78,
        duration: 42,
        volume: 0.8,
        loop: true,
      },
    ],
  };

  const automationAssets = await resolveAssets(automationScene);
  const { blob: automationBlob, audioCodec: automationAudioCodec } =
    await exportVideo({
      scene: automationScene,
      assets: automationAssets,
      audioChunkSeconds: 0.35,
    });

  checks.push({
    label: "audio: automation/loop scene exports an audio codec",
    pass: automationAudioCodec !== null,
    detail: String(automationAudioCodec),
  });

  const automationInput = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(automationBlob),
  });
  const automationTrack = await automationInput.getPrimaryAudioTrack();

  if (automationTrack) {
    const sink = new AudioBufferSink(automationTrack);
    const staticRms = await rmsOver(sink, 0.12, 0.65);
    const fadeEarlyRms = await rmsOver(sink, 1.28, 1.45);
    const fadeLateRms = await rmsOver(sink, 1.85, 2.12);
    const loopWrappedRms = await rmsOver(sink, 3.75, 3.95);

    checks.push({
      label: "audio: static volume remains audible",
      pass: staticRms > 0.15 && staticRms < 0.4,
      detail: `rms ${staticRms.toFixed(4)}`,
    });
    checks.push({
      label: "audio: volumeEnvelope starts quieter than the static bed",
      pass: fadeEarlyRms > 0.015 && fadeEarlyRms < staticRms * 0.6,
      detail: `rms ${fadeEarlyRms.toFixed(4)} vs static ${staticRms.toFixed(4)}`,
    });
    checks.push({
      label: "audio: volumeEnvelope reaches full audible level",
      pass: fadeLateRms > staticRms * 0.6 && fadeLateRms < staticRms * 1.25,
      detail: `rms ${fadeLateRms.toFixed(4)} vs static ${staticRms.toFixed(4)}`,
    });
    checks.push({
      label: "audio: looped source continues after the 1s WAV wraps",
      pass: loopWrappedRms > 0.15 && loopWrappedRms < 0.4,
      detail: `rms ${loopWrappedRms.toFixed(4)}`,
    });
  } else {
    checks.push({
      label: "audio: static volume remains audible",
      pass: false,
      detail: "no audio track in automation export",
    });
  }

  automationInput.dispose();
  disposeAssets(automationAssets);

  const voiceUrl = URL.createObjectURL(buildToneWav(1.0, 660));
  const busScene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 90,
    audioBuses: {
      music: { gain: 0.8 },
      voice: { gain: 0.9 },
      master: { limiter: true, limiterCeiling: 0.9 },
    },
    assets: {
      tone: { id: "tone", type: "audio", src: toneUrl },
      voice: { id: "voice", type: "audio", src: voiceUrl },
    },
    nodes: [
      {
        id: "music",
        type: "audio",
        assetId: "tone",
        duration: 90,
        loop: true,
        volume: 0.8,
        audioBus: "music",
        pan: -1,
      },
      {
        id: "voice",
        type: "audio",
        assetId: "voice",
        from: 30,
        duration: 30,
        volume: 0.8,
        audioBus: "voice",
        pan: 1,
        ducks: {
          bus: "music",
          gain: 0.25,
          attackFrames: 3,
          releaseFrames: 6,
        },
      },
    ],
  };
  const busAssets = await resolveAssets(busScene);
  const { blob: busBlob } = await exportVideo({
    scene: busScene,
    assets: busAssets,
    audioChunkSeconds: 0.4,
  });
  const busInput = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(busBlob),
  });
  const busTrack = await busInput.getPrimaryAudioTrack();
  if (busTrack) {
    const sink = new AudioBufferSink(busTrack);
    const leftBefore = await rmsOver(sink, 0.2, 0.7, 0);
    const rightBefore = await rmsOver(sink, 0.2, 0.7, 1);
    const leftDuring = await rmsOver(sink, 1.2, 1.7, 0);
    const rightDuring = await rmsOver(sink, 1.2, 1.7, 1);
    checks.push({
      label: "audio: bus panning separates music and voice channels",
      pass: leftBefore > rightBefore * 4 && rightDuring > leftDuring * 2,
      detail: `before L/R ${leftBefore.toFixed(3)}/${rightBefore.toFixed(3)}, during ${leftDuring.toFixed(3)}/${rightDuring.toFixed(3)}`,
    });
    checks.push({
      label: "audio: voice activity ducks the music bus",
      pass: leftDuring < leftBefore * 0.55,
      detail: `music rms ${leftBefore.toFixed(3)} -> ${leftDuring.toFixed(3)}`,
    });
  } else {
    checks.push({
      label: "audio: bus panning and ducking",
      pass: false,
      detail: "no audio track in bus export",
    });
  }
  busInput.dispose();
  disposeAssets(busAssets);
  URL.revokeObjectURL(voiceUrl);
  URL.revokeObjectURL(toneUrl);

  return checks;
};

/** Exports a scene to MP4 and returns the file as base64 (for saving to disk). */
window.renderGoldenExportFile = async (scene: Scene) => {
  const assets = await resolveAssets(scene, {
    extensions: goldenExtensionRegistry,
  });
  const { blob, codec, audioCodec, totalFrames } = await exportVideo({
    scene,
    assets,
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  disposeAssets(assets);

  return {
    base64: btoa(binary),
    size: bytes.length,
    codec,
    audioCodec,
    totalFrames,
  };
};

/** Renders one frame and returns it as a base64 PNG (for saving to disk). */
window.renderGoldenFramePng = async (
  scene: Scene,
  frame: number,
): Promise<string> => {
  const canvas = document.createElement("canvas");
  canvas.width = scene.width;
  canvas.height = scene.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas2D unavailable");
  }

  const assets = await resolveAssets(scene, {
    extensions: goldenExtensionRegistry,
  });
  await prepareFrame(scene, frame, assets);
  renderStill(context, scene, frame, { assets });
  disposeAssets(assets);
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
};

window.renderGoldenDiffPng = async (
  expected: RenderedFrame,
  received: RenderedFrame,
): Promise<string> => {
  if (
    expected.width !== received.width ||
    expected.height !== received.height
  ) {
    throw new Error(
      `Cannot diff frames with different sizes: expected ${expected.width}x${expected.height}, received ${received.width}x${received.height}`,
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = received.width;
  canvas.height = received.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas2D unavailable for diff artifact");
  }

  const image = context.createImageData(received.width, received.height);

  for (let index = 0; index < received.rgba.length; index += 4) {
    const dr = Math.abs(
      (expected.rgba[index] ?? 0) - (received.rgba[index] ?? 0),
    );
    const dg = Math.abs(
      (expected.rgba[index + 1] ?? 0) - (received.rgba[index + 1] ?? 0),
    );
    const db = Math.abs(
      (expected.rgba[index + 2] ?? 0) - (received.rgba[index + 2] ?? 0),
    );
    const da = Math.abs(
      (expected.rgba[index + 3] ?? 0) - (received.rgba[index + 3] ?? 0),
    );
    const changed = dr + dg + db + da > 0;

    if (changed) {
      image.data[index] = 255;
      image.data[index + 1] = 64;
      image.data[index + 2] = 64;
      image.data[index + 3] = 255;
    } else {
      image.data[index] = Math.round((received.rgba[index] ?? 0) * 0.25);
      image.data[index + 1] = Math.round(
        (received.rgba[index + 1] ?? 0) * 0.25,
      );
      image.data[index + 2] = Math.round(
        (received.rgba[index + 2] ?? 0) * 0.25,
      );
      image.data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
};

export type BenchmarkStage = {
  label: string;
  frames: number;
  totalMs: number;
  msPerFrame: number;
  outputKiB: number;
};

export type BenchmarkResult = {
  stages: BenchmarkStage[];
  /** Chromium-only JS heap snapshots in MiB, taken after each stage. */
  heapMiB: Array<{ label: string; usedMiB: number | null }>;
};

export type CompositingBenchmarkOptions = {
  width: number;
  height: number;
  frames: number;
  warmupFrames: number;
  maxPoolBytes: number;
  maxPoolSurfaces: number;
  maxStaticCacheBytes: number;
  maxStaticCacheEntries: number;
  maxStaticCacheKeyBytes: number;
};

export type CompositingBenchmarkResult = {
  width: number;
  height: number;
  frames: number;
  warmupFrames: number;
  totalMs: number;
  msPerFrame: number;
  pixelChecksum: number;
  configuredPoolBytes: number;
  configuredStaticCacheBytes: number;
  poolAfterWarmup: ScratchSurfacePoolStats;
  poolAfterMeasuredFrames: ScratchSurfacePoolStats;
  poolAfterCacheDisabledOracleWarmup: ScratchSurfacePoolStats;
  poolAfterCacheDisabledOracle: ScratchSurfacePoolStats;
  poolAfterDispose: ScratchSurfacePoolStats;
  oraclePoolAfterRender: ScratchSurfacePoolStats;
  oraclePoolAfterDispose: ScratchSurfacePoolStats;
  staticCacheAfterWarmup: Canvas2DStaticDisplayCacheStats;
  staticCacheAfterMeasuredFrames: Canvas2DStaticDisplayCacheStats;
  staticCacheAfterDispose: Canvas2DStaticDisplayCacheStats;
  cacheDisabledOracleExact: boolean;
  cacheDisabledOracleDifference: string | null;
  replenishedPoolOracleExact: boolean;
  replenishedPoolOracleDifference: string | null;
  hostSurfaceCount: number;
  shrunkHostSurfaceCount: number;
  oracleHostSurfaceCount: number;
  shrunkOracleHostSurfaceCount: number;
};

/**
 * Canvas-only compositing workload. It deliberately avoids asset resolution,
 * media decoding, and WebCodecs so 4K scratch-memory regressions remain
 * observable even on hosts without hardware codecs.
 */
window.runGoldenCompositingBenchmark = async (
  options,
): Promise<CompositingBenchmarkResult> => {
  assertCompositingBenchmarkOptions(options);
  const { width, height, frames, warmupFrames } = options;
  const capture = createCaptureContext(width, height);
  const scene = createCompositingBenchmarkScene(
    width,
    height,
    frames + warmupFrames,
  );
  const hostSurfaces: HTMLCanvasElement[] = [];
  const oracleHostSurfaces: HTMLCanvasElement[] = [];
  const pool = new ScratchSurfacePool({
    createCanvas(surfaceWidth, surfaceHeight) {
      const surface = document.createElement("canvas");
      surface.width = surfaceWidth;
      surface.height = surfaceHeight;
      hostSurfaces.push(surface);
      return surface;
    },
    maxBytes: options.maxPoolBytes,
    maxSurfaces: options.maxPoolSurfaces,
    maxDimension: Math.max(width, height) * 2,
  });
  const oraclePool = new ScratchSurfacePool({
    createCanvas(surfaceWidth, surfaceHeight) {
      const surface = document.createElement("canvas");
      surface.width = surfaceWidth;
      surface.height = surfaceHeight;
      oracleHostSurfaces.push(surface);
      return surface;
    },
    maxBytes: options.maxPoolBytes,
    maxSurfaces: options.maxPoolSurfaces,
    maxDimension: Math.max(width, height) * 2,
  });
  const staticDisplayCache = new Canvas2DStaticDisplayCache({
    maxBytes: options.maxStaticCacheBytes,
    maxEntries: options.maxStaticCacheEntries,
    maxKeyBytes: options.maxStaticCacheKeyBytes,
    maxDimension: Math.max(width, height) * 2,
  });

  let poolAfterWarmup: ScratchSurfacePoolStats | undefined;
  let poolAfterMeasuredFrames: ScratchSurfacePoolStats | undefined;
  let poolAfterCacheDisabledOracleWarmup: ScratchSurfacePoolStats | undefined;
  let poolAfterCacheDisabledOracle: ScratchSurfacePoolStats | undefined;
  let staticCacheAfterWarmup: Canvas2DStaticDisplayCacheStats | undefined;
  let staticCacheAfterMeasuredFrames:
    | Canvas2DStaticDisplayCacheStats
    | undefined;
  let oraclePoolAfterRender: ScratchSurfacePoolStats | undefined;
  let totalMs = 0;
  let pixelChecksum = 0;
  let cacheDisabledOracleDifference: string | null =
    "cache-disabled oracle did not run";
  let replenishedPoolOracleDifference: string | null =
    "replenished-pool oracle did not run";

  try {
    // Render both temporal endpoints before measuring. The scene is spatially
    // stable, while this also protects future animated variants from allocating
    // a larger bucket halfway through the measured interval.
    for (let index = 0; index < warmupFrames; index += 1) {
      const frame =
        index % 2 === 0
          ? 0
          : Math.max(0, scene.duration - 1 - Math.floor(index / 2));
      renderStill(capture.context, scene, Math.floor(frame), {
        scratchSurfacePool: pool,
        staticDisplayCache,
      });
    }
    poolAfterWarmup = pool.stats();
    staticCacheAfterWarmup = staticDisplayCache.stats();

    const startedAt = performance.now();
    for (let frame = 0; frame < frames; frame += 1) {
      renderStill(capture.context, scene, frame % scene.duration, {
        scratchSurfacePool: pool,
        staticDisplayCache,
      });
    }
    totalMs = performance.now() - startedAt;
    poolAfterMeasuredFrames = pool.stats();
    staticCacheAfterMeasuredFrames = staticDisplayCache.stats();

    // A few fixed probes prove that the browser painted the scene without
    // adding a full-frame readback to the measured interval.
    for (const [x, y] of [
      [Math.floor(width * 0.08), Math.floor(height * 0.08)],
      [Math.floor(width * 0.31), Math.floor(height * 0.33)],
      [Math.floor(width * 0.52), Math.floor(height * 0.51)],
      [Math.floor(width * 0.76), Math.floor(height * 0.69)],
      [Math.floor(width * 0.91), Math.floor(height * 0.88)],
    ] as const) {
      const pixel = capture.context.getImageData(x, y, 1, 1).data;
      pixelChecksum = pixel.reduce(
        (checksum, value, channel) =>
          (Math.imul(checksum, 16777619) ^ (value + channel)) >>> 0,
        pixelChecksum || 2166136261,
      );
    }

    // Render one identical frame without the static cache through a fresh,
    // identically configured pool. Ownership transfer intentionally changes
    // the main pool's later bucket topology, which is a separate lifecycle
    // concern from cache pixel equivalence. Strip-wise comparison avoids two
    // whole-frame ImageData allocations at 4K while remaining byte-exact.
    const oracle = createCaptureContext(width, height);
    try {
      renderStill(oracle.context, scene, 0, {
        scratchSurfacePool: oraclePool,
      });
      cacheDisabledOracleDifference = firstCanvasRgbaDifference(
        capture.context,
        oracle.context,
        width,
        height,
      );
      oraclePoolAfterRender = oraclePool.stats();
    } finally {
      oracle.canvas.width = 1;
      oracle.canvas.height = 1;
    }

    // Replenish the ownership-transferred main pool once, then prove the next
    // full uncached frame is allocation-free and reuses the retained buckets.
    const scratchProbe = createCaptureContext(width, height);
    try {
      renderStill(scratchProbe.context, scene, 0, {
        scratchSurfacePool: pool,
      });
      replenishedPoolOracleDifference = firstCanvasRgbaDifference(
        capture.context,
        scratchProbe.context,
        width,
        height,
      );
      poolAfterCacheDisabledOracleWarmup = pool.stats();
      renderStill(scratchProbe.context, scene, 0, {
        scratchSurfacePool: pool,
      });
      replenishedPoolOracleDifference ??= firstCanvasRgbaDifference(
        capture.context,
        scratchProbe.context,
        width,
        height,
      );
      poolAfterCacheDisabledOracle = pool.stats();
    } finally {
      scratchProbe.canvas.width = 1;
      scratchProbe.canvas.height = 1;
    }
  } finally {
    staticDisplayCache.dispose();
    oraclePool.dispose();
    pool.dispose();
    // The output surface is host-owned rather than pooled; release its 4K
    // backing store as part of the same deterministic teardown.
    capture.canvas.width = 1;
    capture.canvas.height = 1;
  }

  if (
    !poolAfterWarmup ||
    !poolAfterMeasuredFrames ||
    !poolAfterCacheDisabledOracleWarmup ||
    !poolAfterCacheDisabledOracle ||
    !oraclePoolAfterRender ||
    !staticCacheAfterWarmup ||
    !staticCacheAfterMeasuredFrames
  ) {
    throw new Error("Compositing benchmark did not complete its measured run.");
  }
  const poolAfterDispose = pool.stats();
  const oraclePoolAfterDispose = oraclePool.stats();
  const staticCacheAfterDispose = staticDisplayCache.stats();
  const shrunkHostSurfaceCount = hostSurfaces.filter(
    (surface) => surface.width === 1 && surface.height === 1,
  ).length;
  const shrunkOracleHostSurfaceCount = oracleHostSurfaces.filter(
    (surface) => surface.width === 1 && surface.height === 1,
  ).length;
  return {
    width,
    height,
    frames,
    warmupFrames,
    totalMs: Number(totalMs.toFixed(2)),
    msPerFrame: Number((totalMs / frames).toFixed(2)),
    pixelChecksum,
    configuredPoolBytes: options.maxPoolBytes,
    configuredStaticCacheBytes: options.maxStaticCacheBytes,
    poolAfterWarmup,
    poolAfterMeasuredFrames,
    poolAfterCacheDisabledOracleWarmup,
    poolAfterCacheDisabledOracle,
    poolAfterDispose,
    oraclePoolAfterRender,
    oraclePoolAfterDispose,
    staticCacheAfterWarmup,
    staticCacheAfterMeasuredFrames,
    staticCacheAfterDispose,
    cacheDisabledOracleExact: cacheDisabledOracleDifference === null,
    cacheDisabledOracleDifference,
    replenishedPoolOracleExact: replenishedPoolOracleDifference === null,
    replenishedPoolOracleDifference,
    hostSurfaceCount: hostSurfaces.length,
    shrunkHostSurfaceCount,
    oracleHostSurfaceCount: oracleHostSurfaces.length,
    shrunkOracleHostSurfaceCount,
  };
};

function firstCanvasRgbaDifference(
  cached: CanvasRenderingContext2D,
  uncached: CanvasRenderingContext2D,
  width: number,
  height: number,
): string | null {
  const stripRows = 32;
  for (let y = 0; y < height; y += stripRows) {
    const rows = Math.min(stripRows, height - y);
    const cachedBytes = cached.getImageData(0, y, width, rows).data;
    const uncachedBytes = uncached.getImageData(0, y, width, rows).data;
    for (let index = 0; index < cachedBytes.length; index += 1) {
      if (cachedBytes[index] !== uncachedBytes[index]) {
        const pixel = Math.floor(index / 4);
        const x = pixel % width;
        const row = Math.floor(pixel / width);
        const channel = ["r", "g", "b", "a"][index % 4];
        return `pixel (${x}, ${y + row}) ${channel}: cached ${cachedBytes[index]}, uncached ${uncachedBytes[index]}`;
      }
    }
  }
  return null;
}

function assertCompositingBenchmarkOptions(
  options: CompositingBenchmarkOptions,
): void {
  for (const [name, value] of Object.entries(options)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(
        `Compositing benchmark ${name} must be a positive safe integer.`,
      );
    }
  }
}

function createCompositingBenchmarkScene(
  width: number,
  height: number,
  duration: number,
): Scene {
  const px = (at1080: number) =>
    Math.max(1, Math.round((at1080 * height) / 1080));
  const outerFeather = px(3);
  const innerFeather = px(2);

  return {
    schemaVersion: 1,
    width,
    height,
    fps: 30,
    duration,
    assets: {},
    nodes: [
      {
        id: "composite-backdrop",
        type: "div",
        style: {
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, #07111f 0%, #172554 52%, #0f766e 100%)",
        },
      },
      {
        id: "outer-isolation",
        type: "div",
        style: {
          position: "absolute",
          left: "5%",
          top: "7%",
          width: "90%",
          height: "86%",
          isolation: true,
          opacity: 0.97,
          transform: "rotate(0.8deg) scale(0.985)",
          transformOrigin: "50% 50%",
          background:
            "linear-gradient(145deg, #1d4ed8 0%, #7c3aed 48%, #be123c 100%)",
          borderRadius: "7%",
          boxShadow: `${px(14)}px ${px(18)}px ${px(34)}px rgba(0,0,0,0.42), -${px(9)}px ${px(8)}px ${px(22)}px rgba(34,211,238,0.25), 0px -${px(7)}px ${px(18)}px rgba(244,114,182,0.22)`,
          filter: "saturate(1.08) contrast(1.04)",
          overflow: "hidden",
        },
        mask: {
          shape: { kind: "rect", radius: "8%" },
          opacity: 0.96,
          feather: outerFeather,
        },
        children: [
          {
            id: "transformed-ribbon",
            type: "div",
            style: {
              position: "absolute",
              left: "-8%",
              top: "12%",
              width: "62%",
              height: "13%",
              transform: "rotate(-11deg) translate(4%, 3%)",
              background:
                "linear-gradient(90deg, rgba(34,211,238,0.92), rgba(250,204,21,0.88))",
              borderRadius: "18%",
              filter: `blur(${px(1)}px) saturate(1.12)`,
              boxShadow: `${px(5)}px ${px(8)}px ${px(14)}px rgba(2,6,23,0.35), -${px(4)}px ${px(3)}px ${px(10)}px rgba(255,255,255,0.2)`,
            },
          },
          {
            id: "nested-inverted-isolation",
            type: "div",
            style: {
              position: "absolute",
              left: "9%",
              top: "23%",
              width: "54%",
              height: "62%",
              isolation: true,
              transform: "rotate(-2.4deg) translate(1.5%, -1%)",
              transformOrigin: "50% 50%",
              background:
                "radial-gradient(circle at 35% 30%, #fde68a 0%, #fb7185 42%, #7e22ce 100%)",
              borderRadius: "11%",
              boxShadow: `${px(11)}px ${px(15)}px ${px(28)}px rgba(2,6,23,0.48), -${px(7)}px ${px(5)}px ${px(20)}px rgba(125,211,252,0.3)`,
              filter: "contrast(1.06) saturate(1.1)",
            },
            mask: {
              shape: { kind: "ellipse" },
              inverted: true,
              opacity: 0.9,
              feather: innerFeather,
            },
            children: [
              {
                id: "inner-core-isolation",
                type: "div",
                style: {
                  position: "absolute",
                  left: "17%",
                  top: "18%",
                  width: "66%",
                  height: "64%",
                  isolation: true,
                  transform: "rotate(5deg) scale(0.94)",
                  transformOrigin: "50% 50%",
                  background:
                    "linear-gradient(120deg, rgba(15,23,42,0.92), rgba(30,64,175,0.82))",
                  borderRadius: "16%",
                  boxShadow: `${px(8)}px ${px(12)}px ${px(22)}px rgba(0,0,0,0.5), -${px(5)}px -${px(4)}px ${px(16)}px rgba(196,181,253,0.34)`,
                  filter: "brightness(1.04) saturate(1.15)",
                },
                children: [
                  {
                    id: "core-diamond",
                    type: "shape",
                    shape: {
                      kind: "polygon",
                      points: [
                        { x: 0.5, y: 0 },
                        { x: 1, y: 0.5 },
                        { x: 0.5, y: 1 },
                        { x: 0, y: 0.5 },
                      ],
                    },
                    style: {
                      position: "absolute",
                      left: "24%",
                      top: "18%",
                      width: "52%",
                      height: "64%",
                      transform: "rotate(13deg) scale(0.9)",
                      fill: "linear-gradient(135deg, #67e8f9, #f0abfc)",
                      stroke: "rgba(255,255,255,0.72)",
                      strokeWidth: px(4),
                      filter: `blur(${px(1)}px) saturate(1.12) contrast(1.04)`,
                    },
                  },
                ],
              },
            ],
          },
          {
            id: "right-soft-panel",
            type: "div",
            style: {
              position: "absolute",
              left: "66%",
              top: "18%",
              width: "27%",
              height: "65%",
              isolation: true,
              transform: "rotate(3.2deg) translate(-2%, 1%)",
              transformOrigin: "50% 50%",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.88), rgba(165,243,252,0.66))",
              borderRadius: "14%",
              boxShadow: `${px(9)}px ${px(13)}px ${px(24)}px rgba(15,23,42,0.4), -${px(6)}px ${px(4)}px ${px(16)}px rgba(253,224,71,0.28)`,
              filter: "saturate(1.05) contrast(1.03)",
            },
            mask: {
              shape: { kind: "rect", radius: "18%" },
              opacity: 0.93,
              feather: innerFeather,
            },
            children: [
              {
                id: "panel-accent",
                type: "shape",
                shape: { kind: "ellipse" },
                style: {
                  position: "absolute",
                  left: "15%",
                  top: "24%",
                  width: "70%",
                  height: "52%",
                  transform: "rotate(-9deg) scale(0.92)",
                  fill: "radial-gradient(#facc15 0%, #f43f5e 70%)",
                  filter: `blur(${px(1)}px) saturate(1.16)`,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Production-size performance benchmark: synthesizes footage at the target
 * resolution with exportVideo (stage 1 — pure render+encode), then exports
 * composites that decode it back through video nodes (stages 2 and 3 —
 * decode + composite + encode, the real workload).
 */
window.runGoldenBenchmark = async ({ width, height, fps, seconds }) => {
  const frames = Math.round(seconds * fps);
  const stages: BenchmarkStage[] = [];
  const heapMiB: BenchmarkResult["heapMiB"] = [];

  const heap = (label: string) => {
    const memory = (
      performance as unknown as { memory?: { usedJSHeapSize: number } }
    ).memory;
    heapMiB.push({
      label,
      usedMiB: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
    });
  };

  const measure = async (label: string, scene: Scene): Promise<Blob> => {
    const assets = await resolveAssets(scene);
    const start = performance.now();
    const { blob } = await exportVideo({ scene, assets });
    const totalMs = performance.now() - start;
    disposeAssets(assets);
    stages.push({
      label,
      frames: scene.duration,
      totalMs: Math.round(totalMs),
      msPerFrame: Number((totalMs / scene.duration).toFixed(2)),
      outputKiB: Math.round(blob.size / 1024),
    });
    heap(label);
    return blob;
  };

  // Stage 1 — synthesize "footage": full-frame animated gradient + a moving
  // box + text, so the encoder sees real per-frame change at every pixel row.
  const sourceScene: Scene = {
    schemaVersion: 1,
    width,
    height,
    fps,
    duration: frames,
    assets: {},
    nodes: [
      {
        id: "bg",
        type: "div",
        from: 0,
        duration: frames,
        style: {
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #16222e 0%, #66f5d7 100%)",
        },
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [
              { frame: 0, value: 0.6 },
              { frame: Math.max(1, frames - 1), value: 1 },
            ],
          },
        ],
        children: [],
      },
      {
        id: "mover",
        type: "div",
        from: 0,
        duration: frames,
        style: {
          position: "absolute",
          left: 0,
          top: Math.round(height * 0.4),
          width: Math.round(width * 0.2),
          height: Math.round(height * 0.2),
          backgroundColor: "#ef476f",
          borderRadius: 24,
        },
        animations: [
          {
            kind: "keyframes",
            property: "transform",
            frames: [
              { frame: 0, value: "translate(0px, 0px)" },
              {
                frame: Math.max(1, frames - 1),
                value: `translate(${Math.round(width * 0.8)}px, 0px)`,
              },
            ],
          },
        ],
        children: [],
      },
    ],
  };

  const sourceBlob = await measure(
    `render+encode ${width}x${height} (no decode)`,
    sourceScene,
  );
  const sourceUrl = URL.createObjectURL(sourceBlob);

  // Stage 2 — one full-frame video node + caption (decode + composite + encode).
  const oneVideo: Scene = {
    schemaVersion: 1,
    width,
    height,
    fps,
    duration: frames,
    assets: { clip: { id: "clip", type: "video", src: sourceUrl } },
    nodes: [
      {
        id: "shot",
        type: "video",
        assetId: "clip",
        from: 0,
        duration: frames,
        style: { width: "100%", height: "100%" },
        children: [],
      },
      {
        id: "caption",
        type: "text",
        text: "BENCHMARK CAPTION",
        from: 0,
        duration: frames,
        style: {
          position: "absolute",
          left: 0,
          width: "100%",
          top: Math.round(height * 0.82),
          height: Math.round(height * 0.08),
          fontSize: Math.round(height * 0.05),
          fontWeight: 800,
          color: "#ffffff",
          textAlign: "center",
          textStroke: "6px #000000",
        },
        children: [],
      },
    ],
  };

  await measure("1 video node + caption", oneVideo);

  // Stage 3 — two simultaneous decoders: full-frame + picture-in-picture at 2x rate.
  const twoVideos: Scene = {
    ...oneVideo,
    assets: {
      clip: { id: "clip", type: "video", src: sourceUrl },
      pip: { id: "pip", type: "video", src: sourceUrl },
    },
    nodes: [
      ...oneVideo.nodes,
      {
        id: "pip-shot",
        type: "video",
        assetId: "pip",
        playbackRate: 2,
        from: 0,
        duration: frames,
        style: {
          position: "absolute",
          left: Math.round(width * 0.65),
          top: Math.round(height * 0.06),
          width: Math.round(width * 0.3),
          height: Math.round(height * 0.3),
          borderRadius: 18,
          objectFit: "cover",
        },
        children: [],
      },
    ],
  };

  await measure("2 video nodes (full + PiP @2x)", twoVideos);

  URL.revokeObjectURL(sourceUrl);
  return { stages, heapMiB };
};
