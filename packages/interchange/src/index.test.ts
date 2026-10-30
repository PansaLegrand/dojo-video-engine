import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { validateScene, type Scene } from "@dojo-video-engine/schema";
import {
  createRemotionFramePayload,
  createRemotionHostDescriptor,
  exportTimelineV1,
  importStaticHtmlSnapshot,
  importTimelineV1,
  remotionBridgeCapabilities,
  remotionFramePayloadJsonSchema,
  remotionFramePayloadSchema,
  remotionFrameResultJsonSchema,
  remotionHostDescriptorJsonSchema,
  remotionHostDescriptorSchema,
  remotionHostResultJsonSchema,
  staticHtmlSnapshotV1JsonSchema,
  staticHtmlSnapshotV1Schema,
  timelineExportResultJsonSchema,
  timelineImportResultJsonSchema,
  timelineInterchangeV1JsonSchema,
  timelineInterchangeV1Schema,
  type StaticHtmlSnapshotV1,
  type TimelineInterchangeV1,
} from "./index.js";

const ntscTimeline: TimelineInterchangeV1 = {
  interchangeVersion: 1,
  width: 1920,
  height: 1080,
  timebase: { numerator: 30_000, denominator: 1_001 },
  durationTicks: 300,
  assets: [
    {
      id: "camera",
      kind: "video",
      uri: "https://cdn.example/camera.mp4",
      durationTicks: 600,
      width: 1920,
      height: 1080,
    },
    {
      id: "music",
      kind: "audio",
      uri: "https://cdn.example/music.wav",
      durationTicks: 600,
    },
    {
      id: "logo",
      kind: "image",
      uri: "https://cdn.example/logo.png",
      width: 400,
      height: 200,
    },
  ],
  tracks: [
    {
      id: "pictures",
      kind: "video",
      clips: [
        {
          id: "shot",
          kind: "video",
          assetId: "camera",
          startTick: 0,
          durationTicks: 150,
          sourceStartTicks: 30,
          box: { x: 0, y: 0, width: 1920, height: 1080 },
          fit: "cover",
          volume: 0.8,
          pan: -0.1,
        },
      ],
    },
    {
      id: "sound",
      kind: "audio",
      clips: [
        {
          id: "score",
          kind: "audio",
          assetId: "music",
          startTick: 0,
          durationTicks: 300,
          sourceStartTicks: 15,
          volume: 0.5,
          pan: 0.2,
        },
      ],
    },
    {
      id: "graphics",
      kind: "overlay",
      clips: [
        {
          id: "brand",
          kind: "image",
          assetId: "logo",
          startTick: 0,
          durationTicks: 300,
          box: { x: 1460, y: 60, width: 400, height: 200 },
          opacity: 0.9,
          fit: "contain",
        },
        {
          id: "caption",
          kind: "text",
          text: "Hello 世界 👋 مرحبا",
          startTick: 60,
          durationTicks: 90,
          box: { x: 240, y: 820, width: 1440, height: 180 },
          textStyle: {
            color: "#ffffff",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            fontFamily: "Inter, sans-serif",
            fontSize: 64,
            fontWeight: 700,
            textAlign: "center",
            direction: "rtl",
          },
        },
      ],
    },
  ],
  markers: [
    { id: "Intro", tick: 0, label: "Opening" },
    { id: "Beat.drop", tick: 150 },
  ],
};

const scene: Scene = {
  schemaVersion: 1,
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 300,
  assets: {
    camera: {
      id: "camera",
      type: "video",
      src: "https://cdn.example/camera.mp4",
      metadata: {
        duration: 20,
        width: 1920,
        height: 1080,
        hasAudio: true,
      },
    },
    music: {
      id: "music",
      type: "audio",
      src: "https://cdn.example/music.wav",
      metadata: { duration: 30 },
    },
    logo: {
      id: "logo",
      type: "image",
      src: "https://cdn.example/logo.png",
      metadata: { width: 400, height: 200 },
    },
  },
  nodes: [
    {
      id: "shot",
      type: "video",
      assetId: "camera",
      from: 0,
      duration: 150,
      videoStartTime: 1.001,
      volume: 0.8,
      pan: -0.1,
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        objectFit: "cover",
      },
    },
    {
      id: "score",
      type: "audio",
      assetId: "music",
      from: 0,
      duration: 300,
      audioStartTime: 0.5005,
      volume: 0.5,
      pan: 0.2,
    },
    {
      id: "brand",
      type: "img",
      assetId: "logo",
      from: 0,
      duration: 300,
      style: {
        position: "absolute",
        left: 1460,
        top: 60,
        width: 400,
        height: 200,
        opacity: 0.9,
        objectFit: "contain",
      },
    },
    {
      id: "caption",
      type: "text",
      text: "Hello 世界 👋 مرحبا",
      from: 60,
      duration: 90,
      style: {
        position: "absolute",
        left: 240,
        top: 820,
        width: 1440,
        height: 180,
        color: "#ffffff",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        fontFamily: "Inter, sans-serif",
        fontSize: 64,
        fontWeight: 700,
        textAlign: "center",
        direction: "rtl",
      },
    },
  ],
  markers: { Intro: 0, "Beat.drop": 150 },
};

const snapshot: StaticHtmlSnapshotV1 = {
  snapshotVersion: 1,
  sanitized: true,
  width: 1080,
  height: 1080,
  fps: 30,
  durationFrames: 90,
  elements: [
    {
      id: "card",
      tag: "div",
      box: { x: 40, y: 40, width: 1000, height: 1000 },
      style: { backgroundColor: "#101820", borderRadius: 32 },
    },
    {
      id: "headline",
      tag: "p",
      text: "مرحبا 世界 👋",
      box: { x: 120, y: 120, width: 840, height: 240 },
      style: {
        color: "#ffffff",
        fontFamily: "Inter, sans-serif",
        fontSize: 72,
        fontWeight: "bold",
        textAlign: "right",
        direction: "rtl",
      },
    },
    {
      id: "photo",
      tag: "img",
      src: "https://cdn.example/photo.webp",
      alt: "decorative",
      box: { x: 120, y: 420, width: 840, height: 500 },
      style: { objectFit: "cover", borderRadius: 24 },
    },
  ],
};

function ajvValidate(schemaValue: Record<string, unknown>, value: unknown) {
  const ajv = new Ajv({ strict: false, allErrors: true });
  return ajv.compile(schemaValue)(value);
}

describe("flat timeline interchange v1", () => {
  it("imports multi-asset NTSC video/audio/image/text and reports losses", () => {
    const before = structuredClone(ntscTimeline);
    const result = importTimelineV1(ntscTimeline, { sceneFps: 30 });

    expect(result.ok).toBe(true);
    expect(ntscTimeline).toEqual(before);
    if (!result.ok) return;
    expect(validateScene(result.scene).ok).toBe(true);
    expect(result.scene.duration).toBe(300);
    expect(Object.keys(result.scene.assets)).toEqual([
      "camera",
      "music",
      "logo",
    ]);
    expect(result.scene.nodes.map((node) => node.type)).toEqual([
      "video",
      "audio",
      "img",
      "text",
    ]);
    expect(result.scene.nodes[0]?.videoStartTime).toBeCloseTo(1.001);
    expect(result.scene.nodes[1]?.audioStartTime).toBeCloseTo(0.5005);
    expect(result.scene.nodes[3]?.text).toBe("Hello 世界 👋 مرحبا");
    expect(result.diagnostics.map((item) => item.code)).toContain(
      "timebase_quantized",
    );
    expect(result.diagnostics.map((item) => item.code)).toContain(
      "marker_label_dropped",
    );
  });

  it("exports and reimports rational timing without mutating Scene", () => {
    const before = structuredClone(scene);
    const exported = exportTimelineV1(scene, {
      timebase: { numerator: 30_000, denominator: 1_001 },
    });

    expect(exported.ok).toBe(true);
    expect(scene).toEqual(before);
    if (!exported.ok) return;
    expect(exported.timeline.timebase).toEqual({
      numerator: 30_000,
      denominator: 1_001,
    });
    expect(exported.timeline.assets.map((asset) => asset.kind)).toEqual([
      "video",
      "audio",
      "image",
    ]);
    expect(
      exported.timeline.tracks.flatMap((track) => track.clips),
    ).toHaveLength(4);
    expect(exported.diagnostics.map((item) => item.code)).toContain(
      "asset_metadata_reduced",
    );

    const imported = importTimelineV1(exported.timeline, { sceneFps: 30 });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.scene.duration).toBe(300);
    expect(
      imported.scene.nodes.find((node) => node.id === "caption")?.text,
    ).toBe("Hello 世界 👋 مرحبا");
  });

  it("flattens nested timing with the unclipped origin and explicit loss codes", () => {
    const lossy: Scene = {
      schemaVersion: 1,
      width: 1000,
      height: 1000,
      fps: 25,
      duration: 100,
      assets: {
        font: { id: "font", type: "font", src: "https://cdn/font.woff2" },
        music: { id: "music", type: "audio", src: "https://cdn/music.mp3" },
      },
      nodes: [
        {
          id: "container",
          type: "div",
          from: -10,
          duration: 80,
          style: { left: 100, top: 50, display: "flex" },
          children: [
            {
              id: "nested",
              type: "text",
              text: "Nested",
              from: 20,
              duration: 30,
              style: { left: 20, top: 10, width: 300, height: 100 },
            },
          ],
        },
        {
          id: "score",
          type: "audio",
          assetId: "music",
          from: 0,
          duration: 100,
          loop: true,
        },
      ],
    };
    const result = exportTimelineV1(lossy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const nested = result.timeline.tracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.id === "nested");
    expect(nested?.startTick).toBe(10);
    expect(nested?.kind).toBe("text");
    if (nested?.kind === "text") {
      expect(nested.box).toEqual({ x: 120, y: 60, width: 300, height: 100 });
    }
    const codes = result.diagnostics.map((item) => item.code);
    expect(codes).toContain("unsupported_asset_dropped");
    expect(codes).toContain("unsupported_node_dropped");
    expect(codes).toContain("hierarchy_flattened");
    expect(codes).toContain("playback_reduced");
  });

  it("enforces semantics, hard budgets, and nonthrowing hostile input", () => {
    const wrongAsset = structuredClone(ntscTimeline);
    const clip = wrongAsset.tracks[0]?.clips[0];
    if (clip?.kind === "video") clip.assetId = "music";
    const wrong = importTimelineV1(wrongAsset);
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.errors[0]?.code).toBe("invalid_input");

    const bounded = importTimelineV1(ntscTimeline, {
      budgets: { maxClips: 1 },
    });
    expect(bounded.ok).toBe(false);
    if (!bounded.ok) expect(bounded.errors[0]?.code).toBe("budget_exceeded");

    const cannotRaiseHardLimit = importTimelineV1(ntscTimeline, {
      budgets: { maxAssets: 999 },
    });
    expect(cannotRaiseHardLimit.ok).toBe(false);

    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("hostile getter");
        },
      },
    );
    expect(() => importTimelineV1(hostile)).not.toThrow();
    expect(importTimelineV1(hostile).ok).toBe(false);
  });

  it("publishes detached draft-07 schemas with Zod/Ajv parity", () => {
    const schemaValue = timelineInterchangeV1JsonSchema();
    expect(schemaValue.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(timelineInterchangeV1Schema.safeParse(ntscTimeline).success).toBe(
      true,
    );
    expect(ajvValidate(schemaValue, ntscTimeline)).toBe(true);

    const extra = { ...ntscTimeline, executable: "no" };
    expect(timelineInterchangeV1Schema.safeParse(extra).success).toBe(false);
    expect(ajvValidate(schemaValue, extra)).toBe(false);

    const illegalClip = structuredClone(ntscTimeline);
    Object.assign(illegalClip.tracks[1]!.clips[0]!, {
      box: { x: 0, y: 0, width: 10, height: 10 },
    });
    expect(timelineInterchangeV1Schema.safeParse(illegalClip).success).toBe(
      false,
    );
    expect(ajvValidate(schemaValue, illegalClip)).toBe(false);

    const executableUri = structuredClone(ntscTimeline);
    executableUri.assets[0]!.uri = "javascript:alert(1)";
    expect(timelineInterchangeV1Schema.safeParse(executableUri).success).toBe(
      false,
    );
    expect(ajvValidate(schemaValue, executableUri)).toBe(false);

    const first = timelineInterchangeV1JsonSchema();
    first.title = "mutated";
    expect(timelineInterchangeV1JsonSchema().title).not.toBe("mutated");
    expect(
      ajvValidate(
        timelineImportResultJsonSchema(),
        importTimelineV1(ntscTimeline),
      ),
    ).toBe(true);
    expect(
      ajvValidate(timelineExportResultJsonSchema(), exportTimelineV1(scene)),
    ).toBe(true);
  });
});

describe("Remotion host data bridge", () => {
  it("exports canonical Scene/frame data without React execution", () => {
    const before = structuredClone(scene);
    const created = createRemotionHostDescriptor(scene, {
      compositionId: "Demo_01",
    });
    expect(created.ok).toBe(true);
    expect(scene).toEqual(before);
    if (!created.ok) return;
    expect(created.descriptor.composition).toMatchObject({
      id: "Demo_01",
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 300,
    });
    expect(created.descriptor.hostContract).toEqual({
      frameSource: "host",
      renderEntry: "dojo-video-engine-canvas2d",
      reactExecution: false,
      arbitraryCompositionImport: false,
    });
    expect(remotionBridgeCapabilities.importsArbitraryCompositions).toBe(false);
    expect(JSON.parse(JSON.stringify(created.descriptor))).toEqual(
      created.descriptor,
    );

    const frame = createRemotionFramePayload(created.descriptor, 42);
    expect(frame.ok).toBe(true);
    if (frame.ok) {
      expect(frame.payload.frame).toBe(42);
      expect(frame.payload.compositionId).toBe("Demo_01");
      expect("react" in frame.payload).toBe(false);
    }
    expect(createRemotionFramePayload(created.descriptor, 300).ok).toBe(false);
    expect(
      createRemotionFramePayload(created.descriptor, 0, {
        budgets: { maxClips: 2 },
      }).ok,
    ).toBe(false);

    const mismatched = structuredClone(created.descriptor);
    mismatched.composition.width = 1280;
    expect(createRemotionFramePayload(mismatched, 0).ok).toBe(false);
  });

  it("exposes strict draft-07 descriptor and frame schemas", () => {
    const created = createRemotionHostDescriptor(scene);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const payload = createRemotionFramePayload(created.descriptor, 0);
    expect(payload.ok).toBe(true);
    if (!payload.ok) return;
    expect(
      remotionHostDescriptorSchema.safeParse(created.descriptor).success,
    ).toBe(true);
    expect(
      ajvValidate(remotionHostDescriptorJsonSchema(), created.descriptor),
    ).toBe(true);
    expect(remotionFramePayloadSchema.safeParse(payload.payload).success).toBe(
      true,
    );
    expect(ajvValidate(remotionFramePayloadJsonSchema(), payload.payload)).toBe(
      true,
    );
    expect(ajvValidate(remotionHostResultJsonSchema(), created)).toBe(true);
    expect(ajvValidate(remotionFrameResultJsonSchema(), payload)).toBe(true);
    const executable = { ...created.descriptor, component: () => null };
    expect(remotionHostDescriptorSchema.safeParse(executable).success).toBe(
      false,
    );
    expect(ajvValidate(remotionHostDescriptorJsonSchema(), executable)).toBe(
      false,
    );
  });
});

describe("sanitized static HTML/CSS snapshot import", () => {
  it("imports only explicit boxes, text, and image data", () => {
    const before = structuredClone(snapshot);
    const result = importStaticHtmlSnapshot(snapshot);
    expect(result.ok).toBe(true);
    expect(snapshot).toEqual(before);
    if (!result.ok) return;
    expect(validateScene(result.scene).ok).toBe(true);
    expect(result.scene.nodes.map((node) => node.type)).toEqual([
      "div",
      "text",
      "img",
    ]);
    expect(result.scene.nodes[1]?.text).toBe("مرحبا 世界 👋");
    expect(result.scene.assets["snapshot.photo"]?.src).toBe(
      "https://cdn.example/photo.webp",
    );
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      "snapshot_flattened",
    ]);
  });

  it("rejects scripts, event handlers, dynamic layout/CSS, and unsafe URLs", () => {
    const rawHtml = { ...snapshot, html: "<script>alert(1)</script>" };
    const scriptTag = structuredClone(snapshot) as unknown as Record<
      string,
      unknown
    >;
    (scriptTag.elements as Array<Record<string, unknown>>)[0]!.tag = "script";
    const eventHandler = structuredClone(snapshot) as unknown as Record<
      string,
      unknown
    >;
    (eventHandler.elements as Array<Record<string, unknown>>)[0]!.onclick =
      "run()";
    const dynamicLayout = structuredClone(snapshot) as unknown as Record<
      string,
      unknown
    >;
    (dynamicLayout.elements as Array<Record<string, unknown>>)[0]!.style = {
      display: "grid",
    };
    const dynamicCss = structuredClone(snapshot) as unknown as Record<
      string,
      unknown
    >;
    (dynamicCss.elements as Array<Record<string, unknown>>)[0]!.style = {
      backgroundColor: "var(--brand)",
    };
    const unsafeUrl = structuredClone(snapshot) as unknown as Record<
      string,
      unknown
    >;
    (unsafeUrl.elements as Array<Record<string, unknown>>)[2]!.src =
      "javascript:alert(1)";

    for (const value of [
      rawHtml,
      scriptTag,
      eventHandler,
      dynamicLayout,
      dynamicCss,
      unsafeUrl,
    ]) {
      expect(staticHtmlSnapshotV1Schema.safeParse(value).success).toBe(false);
      expect(importStaticHtmlSnapshot(value).ok).toBe(false);
      expect(ajvValidate(staticHtmlSnapshotV1JsonSchema(), value)).toBe(false);
    }
  });

  it("enforces element/image/text budgets and schema parity", () => {
    const elementBound = importStaticHtmlSnapshot(snapshot, {
      budgets: { maxClips: 2 },
    });
    expect(elementBound.ok).toBe(false);
    if (!elementBound.ok)
      expect(elementBound.errors[0]?.code).toBe("budget_exceeded");

    const textBound = importStaticHtmlSnapshot(snapshot, {
      budgets: { maxTextCharacters: 2 },
    });
    expect(textBound.ok).toBe(false);
    const schemaValue = staticHtmlSnapshotV1JsonSchema();
    expect(staticHtmlSnapshotV1Schema.safeParse(snapshot).success).toBe(true);
    expect(ajvValidate(schemaValue, snapshot)).toBe(true);
  });
});
