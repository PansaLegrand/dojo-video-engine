import {
  compileDisplayList,
  evaluateScene,
  layoutScene,
  type DisplayCapabilityRequirement,
  type DisplayContentOperation,
  type DisplayExtensionCompilationInput,
  type DisplayGroup,
  type DisplayList,
  type DisplayListCompileOptions,
  type TextMetricsProvider,
} from "@motionforge/core";
import type { Scene } from "@motionforge/schema";

/**
 * Reuse from another DisplayList v1 backend:
 *
 * 1. Advertise the backend's exact `{ id, version }` capabilities.
 * 2. Implement `RendererConformanceBackendCallback` over the parsed list.
 * 3. Return every missing requirement on rejection; otherwise return the
 *    backend traversal trace and RGBA for pixel-capable fixtures.
 * 4. Run `runRendererConformanceSuite()` in a pinned deterministic host with
 *    a canonical `renderReference` callback.
 *
 * Fixtures are engine/compiler inputs, while the callback is the only
 * renderer-specific boundary. No Scene object is the executable oracle.
 */

/** Exact capability identity advertised by a DisplayList v1 backend. */
export type RendererConformanceCapability = Readonly<{
  id: string;
  version: string;
}>;

export type RendererConformancePixels = Readonly<{
  width: number;
  height: number;
  rgba: readonly number[];
}>;

export type RendererConformanceFixture = Readonly<{
  id: string;
  description: string;
  scene: Scene;
  frame: number;
  /** Pixel fixtures must be executed and compared to the reference callback. */
  pixelCapable: boolean;
}>;

export type RendererConformanceBackendFixture = Readonly<
  Pick<RendererConformanceFixture, "id" | "description" | "pixelCapable">
>;

export type RendererConformanceBackendRequest = Readonly<{
  /** Metadata only: a backend is never handed the canonical Scene oracle. */
  fixture: RendererConformanceBackendFixture;
  /** A JSON-parsed copy, never the compiler's original object graph. */
  displayList: DisplayList;
}>;

export type RendererConformanceBackendDecision =
  | Readonly<{
      status: "accepted";
      /** Backend-observed deterministic execution trace. */
      trace: readonly string[];
      pixels?: RendererConformancePixels;
    }>
  | Readonly<{
      status: "rejected";
      /** Every unsupported exact id@version requirement, in list order. */
      missing: readonly DisplayCapabilityRequirement[];
    }>;

/**
 * Adapter callback implemented by a future renderer harness. It must perform
 * exact id+version negotiation before executing the parsed DisplayList.
 */
export type RendererConformanceBackendCallback = (
  request: RendererConformanceBackendRequest,
) =>
  | RendererConformanceBackendDecision
  | Promise<RendererConformanceBackendDecision>;

export type RendererConformanceBackendAdapter = Readonly<{
  backendId: string;
  displayListVersion: 1;
  capabilities: readonly RendererConformanceCapability[];
  execute: RendererConformanceBackendCallback;
}>;

export type RendererConformanceRunOptions = Readonly<{
  /** Canonical renderer oracle used only for accepted pixel fixtures. */
  renderReference: (
    fixture: RendererConformanceFixture,
  ) => RendererConformancePixels | Promise<RendererConformancePixels>;
}>;

export type RendererConformanceCaseResult = Readonly<{
  fixtureId: string;
  pass: boolean;
  detail: string;
  failures: readonly string[];
}>;

export type RendererConformanceResult = Readonly<{
  backendId: string;
  displayListVersion: 1;
  cases: readonly RendererConformanceCaseResult[];
}>;

type FixtureDefinition = RendererConformanceFixture &
  Readonly<{
    extensionCompilations?: Readonly<
      Record<string, DisplayExtensionCompilationInput>
    >;
    expected: Readonly<{
      groupNodeIds: readonly string[];
      groupEngineIds: readonly string[];
      operations: readonly string[];
      requirements: readonly DisplayCapabilityRequirement[];
    }>;
    inspect?: (displayList: DisplayList) => readonly string[];
  }>;

const exactTextMetrics: TextMetricsProvider = {
  measureLine(input) {
    return {
      width: Array.from(input.text).length * input.fontSize * 0.5,
      ascent: input.fontSize * 0.75,
      descent: input.fontSize * 0.25,
      measurement: "exact",
      reason: "renderer conformance metric",
    };
  },
};

const baseScene = (
  nodes: Scene["nodes"],
  options: Partial<Pick<Scene, "width" | "height" | "assets">> = {},
): Scene => ({
  schemaVersion: 1,
  width: options.width ?? 180,
  height: options.height ?? 120,
  fps: 30,
  duration: 30,
  assets: options.assets ?? {},
  nodes,
});

const fixtureDefinitions: readonly FixtureDefinition[] = [
  {
    id: "group-phase-z-order",
    description:
      "stable sibling z-order and background/content/border/child phases",
    frame: 0,
    pixelCapable: true,
    scene: baseScene([
      {
        id: "top",
        type: "div",
        style: {
          position: "absolute",
          left: 118,
          top: 14,
          width: 44,
          height: 34,
          zIndex: 2,
          backgroundColor: "#fbbf24",
        },
      },
      {
        id: "phase-root",
        type: "shape",
        shape: { kind: "rect", radius: 8 },
        style: {
          position: "absolute",
          left: 12,
          top: 10,
          width: 112,
          height: 92,
          zIndex: -1,
          backgroundColor: "#1e3a8a",
          fill: "#0ea5e9",
          border: "3px solid #ffffff",
          borderRadius: 8,
        },
        children: [
          {
            id: "phase-front",
            type: "div",
            style: {
              position: "absolute",
              left: 48,
              top: 35,
              width: 48,
              height: 34,
              zIndex: 1,
              backgroundColor: "#fb7185",
            },
          },
          {
            id: "phase-back",
            type: "div",
            style: {
              position: "absolute",
              left: 22,
              top: 24,
              width: 50,
              height: 36,
              zIndex: -1,
              backgroundColor: "#22c55e",
            },
          },
        ],
      },
      {
        id: "middle",
        type: "div",
        style: {
          position: "absolute",
          left: 96,
          top: 68,
          width: 62,
          height: 34,
          backgroundColor: "#a855f7",
        },
      },
    ]),
    expected: {
      groupNodeIds: [
        "phase-root",
        "phase-back",
        "phase-front",
        "middle",
        "top",
      ],
      groupEngineIds: [
        "mf:node:10:phase-root",
        "mf:node:10:phase-back",
        "mf:node:11:phase-front",
        "mf:node:6:middle",
        "mf:node:3:top",
      ],
      operations: [
        "0:phase-root:background:mf:node:10:phase-root/background",
        "1:phase-root:shape:mf:node:10:phase-root/shape",
        "2:phase-root:border:mf:node:10:phase-root/border",
        "3:phase-back:background:mf:node:10:phase-back/background",
        "4:phase-front:background:mf:node:11:phase-front/background",
        "5:middle:background:mf:node:6:middle/background",
        "6:top:background:mf:node:3:top/background",
      ],
      requirements: [],
    },
  },
  {
    id: "affine-clip-mask-composite",
    description:
      "affine transform, clip, soft inverted mask, isolation, blend and filter",
    frame: 0,
    pixelCapable: true,
    scene: baseScene([
      {
        id: "affine-card",
        type: "shape",
        shape: { kind: "ellipse" },
        clip: { kind: "rect", radius: 7 },
        mask: {
          shape: { kind: "ellipse" },
          inverted: true,
          opacity: 0.82,
          feather: 2,
        },
        style: {
          position: "absolute",
          left: 34,
          top: 24,
          width: 108,
          height: 70,
          transform: "translate(4px, -2px) rotate(7deg) scale(0.96)",
          transformOrigin: "50% 50%",
          opacity: 0.9,
          blendMode: "screen",
          isolation: true,
          filter: "saturate(1.08) contrast(1.03)",
          overflow: "hidden",
          borderRadius: 9,
          background: "linear-gradient(135deg, #0f172a, #2563eb)",
          fill: "#f97316",
          border: "2px solid #f8fafc",
        },
      },
    ]),
    expected: {
      groupNodeIds: ["affine-card"],
      groupEngineIds: ["mf:node:11:affine-card"],
      operations: [
        "0:affine-card:background:mf:node:11:affine-card/background",
        "1:affine-card:shape:mf:node:11:affine-card/shape",
        "2:affine-card:border:mf:node:11:affine-card/border",
      ],
      requirements: [
        {
          id: "motionforge.filter",
          version: "1",
          nodeIds: ["affine-card"],
        },
        {
          id: "motionforge.mask.soft",
          version: "1",
          nodeIds: ["affine-card"],
        },
      ],
    },
    inspect(displayList) {
      const group = displayList.groups[0];
      const failures: string[] = [];
      if (!group) return ["missing affine group"];
      if (group.transform.a === 1 && group.transform.b === 0) {
        failures.push("affine transform remained identity");
      }
      if (group.clip?.kind !== "rounded-rect") {
        failures.push(`clip kind was ${group.clip?.kind ?? "null"}`);
      }
      if (group.mask?.strategy !== "soft-raster" || !group.mask.inverted) {
        failures.push("mask was not an inverted soft-raster mask");
      }
      if (
        group.composite.strategy !== "isolated" ||
        group.composite.blendMode !== "screen" ||
        group.composite.filter !== "saturate(1.08) contrast(1.03)"
      ) {
        failures.push("composite intent did not survive compilation");
      }
      return failures;
    },
  },
  {
    id: "compiled-text-lines-runs",
    description:
      "metric-resolved multiline text and stable rich-run identities",
    frame: 0,
    pixelCapable: false,
    scene: baseScene([
      {
        id: "rich-copy",
        type: "text",
        runs: [
          { text: "AI ", style: { color: "#ef4444" } },
          {
            text: "video\n",
            style: { color: "#38bdf8", opacity: 0.8 },
          },
          {
            text: "agent",
            style: {
              color: "#a3e635",
              textBackgroundColor: "#172554",
            },
          },
        ],
        style: {
          position: "absolute",
          left: 12,
          top: 14,
          width: 150,
          height: 84,
          fontSize: 20,
          lineHeight: 26,
          color: "#ffffff",
          textAlign: "left",
          textBackgroundColor: "#111827",
          textBackgroundPaddingX: 3,
          textBackgroundPaddingY: 2,
          textBackgroundRadius: 4,
        },
      },
    ]),
    expected: {
      groupNodeIds: ["rich-copy"],
      groupEngineIds: ["mf:node:9:rich-copy"],
      operations: ["0:rich-copy:text:mf:node:9:rich-copy/text"],
      requirements: [],
    },
    inspect(displayList) {
      const content = displayList.groups[0]?.content;
      if (content?.kind !== "text") return ["compiled content was not text"];
      const failures: string[] = [];
      if (
        content.lines.map((line) => line.text).join("|") !== "AI video|agent"
      ) {
        failures.push(
          `compiled lines were ${content.lines.map((line) => line.text).join("|")}`,
        );
      }
      const lineIds = content.lines.map((line) => line.engineId);
      if (
        JSON.stringify(lineIds) !==
        JSON.stringify([
          "mf:node:9:rich-copy/text/line:0",
          "mf:node:9:rich-copy/text/line:1",
        ])
      ) {
        failures.push(`unstable text line ids ${JSON.stringify(lineIds)}`);
      }
      const runTrace = content.lines.flatMap((line) =>
        line.runs.map((run) => `${run.engineId}:${run.text}`),
      );
      if (
        JSON.stringify(runTrace) !==
        JSON.stringify([
          "mf:node:9:rich-copy/text/line:0/run:0:AI ",
          "mf:node:9:rich-copy/text/line:0/run:1:video",
          "mf:node:9:rich-copy/text/line:1/run:0:agent",
        ])
      ) {
        failures.push(`unstable text runs ${JSON.stringify(runTrace)}`);
      }
      if (
        content.lines.some(
          (line) =>
            line.metrics.measurement !== "exact" ||
            line.metrics.reason !== "renderer conformance metric",
        )
      ) {
        failures.push("text metric provenance was not exact and stable");
      }
      return failures;
    },
  },
  {
    id: "image-reference-fitted-rect",
    description: "structural image reference, declared metrics and fitted rect",
    frame: 0,
    pixelCapable: false,
    scene: baseScene(
      [
        {
          id: "poster-node",
          type: "img",
          assetId: "poster",
          style: {
            position: "absolute",
            left: 20,
            top: 10,
            width: 100,
            height: 100,
            objectFit: "contain",
            objectPosition: "center",
            borderRadius: 6,
          },
        },
      ],
      {
        assets: {
          poster: {
            id: "poster",
            type: "image",
            src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'/%3E",
            metadata: { width: 400, height: 200 },
          },
        },
      },
    ),
    expected: {
      groupNodeIds: ["poster-node"],
      groupEngineIds: ["mf:node:11:poster-node"],
      operations: ["0:poster-node:media:mf:node:11:poster-node/media"],
      requirements: [],
    },
    inspect(displayList) {
      const content = displayList.groups[0]?.content;
      if (content?.kind !== "media") return ["compiled content was not media"];
      const failures: string[] = [];
      if (
        content.resource.kind !== "image" ||
        content.resource.assetId !== "poster"
      ) {
        failures.push("image resource reference changed");
      }
      if (
        JSON.stringify(content.intrinsic) !==
        JSON.stringify({
          width: 400,
          height: 200,
          measurement: "declared",
          reason: "Scene asset metadata",
        })
      ) {
        failures.push(
          `unexpected intrinsic metrics ${JSON.stringify(content.intrinsic)}`,
        );
      }
      if (
        JSON.stringify(content.fittedBox) !==
        JSON.stringify({ x: 20, y: 35, width: 100, height: 50 })
      ) {
        failures.push(
          `unexpected fitted rect ${JSON.stringify(content.fittedBox)}`,
        );
      }
      return failures;
    },
  },
  {
    id: "shape-geometry-paint",
    description: "closed polygon geometry, conic fill and explicit stroke",
    frame: 0,
    pixelCapable: true,
    scene: baseScene([
      {
        id: "badge-shape",
        type: "shape",
        shape: {
          kind: "polygon",
          points: [
            { x: 0.5, y: 0 },
            { x: 1, y: 0.38 },
            { x: 0.8, y: 1 },
            { x: 0.2, y: 1 },
            { x: 0, y: 0.38 },
          ],
        },
        style: {
          position: "absolute",
          left: 42,
          top: 18,
          width: 96,
          height: 86,
          fill: "conic-gradient(from 30deg at 50% 50%, #22d3ee, #a855f7, #f97316)",
          stroke: "#ffffff",
          strokeWidth: 4,
          strokeLineJoin: "round",
          strokeDash: [8, 4],
        },
      },
    ]),
    expected: {
      groupNodeIds: ["badge-shape"],
      groupEngineIds: ["mf:node:11:badge-shape"],
      operations: ["0:badge-shape:shape:mf:node:11:badge-shape/shape"],
      requirements: [
        {
          id: "motionforge.paint.conic",
          version: "1",
          nodeIds: ["badge-shape"],
        },
      ],
    },
    inspect(displayList) {
      const content = displayList.groups[0]?.content;
      if (content?.kind !== "shape") return ["compiled content was not shape"];
      const failures: string[] = [];
      if (content.geometry.kind !== "polyline" || !content.geometry.closed) {
        failures.push("polygon did not compile as a closed polyline");
      }
      if (content.fill?.kind !== "conic-gradient") {
        failures.push(`shape fill was ${content.fill?.kind ?? "null"}`);
      }
      if (
        content.stroke?.lineJoin !== "round" ||
        JSON.stringify(content.stroke.dash) !== JSON.stringify([8, 4])
      ) {
        failures.push("shape stroke semantics changed");
      }
      return failures;
    },
  },
  {
    id: "semantic-effect-requirement",
    description: "semantic effect payload and exact effect capability",
    frame: 7,
    pixelCapable: true,
    scene: baseScene([
      {
        id: "semantic-fx",
        type: "effect",
        effect: "confettiBurst",
        params: {
          seed: 37,
          intensity: "low",
          colors: ["#22d3ee", "#f97316", "#a855f7"],
        },
        style: { position: "absolute", inset: 0 },
      },
    ]),
    expected: {
      groupNodeIds: ["semantic-fx"],
      groupEngineIds: ["mf:node:11:semantic-fx"],
      operations: ["0:semantic-fx:effect:mf:node:11:semantic-fx/effect"],
      requirements: [
        {
          id: "motionforge.effect",
          version: "1",
          nodeIds: ["semantic-fx"],
        },
      ],
    },
    inspect(displayList) {
      const content = displayList.groups[0]?.content;
      if (content?.kind !== "effect")
        return ["compiled content was not effect"];
      return content.effect === "confettiBurst" &&
        content.localFrame === 7 &&
        content.capability.id === "motionforge.effect"
        ? []
        : ["semantic effect payload changed"];
    },
  },
  extensionFixture("extension-standard", "standard", {
    kind: "standard",
    version: "1",
    operations: [
      { kind: "fill", color: "#22d3ee" },
      { kind: "label", text: "portable" },
    ],
  }),
  extensionFixture("extension-opaque", "opaque", {
    kind: "opaque",
    capability: { id: "dev.motionforge.special-painter", version: "2" },
    payload: { phase: 3, palette: ["#0ea5e9", "#f97316"] },
  }),
  extensionFixture("extension-legacy", "legacy"),
] as const;

function extensionFixture(
  id: string,
  mode: "standard" | "opaque" | "legacy",
  compilation?: DisplayExtensionCompilationInput,
): FixtureDefinition {
  const nodeId = `${mode}-extension`;
  const engineId = `mf:node:${nodeId.length}:${nodeId}`;
  const requirement: DisplayCapabilityRequirement[] =
    mode === "opaque"
      ? [
          {
            id: "dev.motionforge.special-painter",
            version: "2",
            nodeIds: [nodeId],
          },
        ]
      : mode === "legacy"
        ? [
            {
              id: "motionforge.legacy.renderer-adapter",
              version: "1.0.0",
              nodeIds: [nodeId],
            },
          ]
        : [];
  return {
    id,
    description: `${mode} extension display decision and exact capability contract`,
    frame: 0,
    pixelCapable: false,
    scene: baseScene([
      {
        id: nodeId,
        type: "extension",
        extension: {
          name: `dev.motionforge.${mode}`,
          version: "1.0.0",
          params: { fixture: mode, stable: true },
        },
        style: {
          position: "absolute",
          left: 20,
          top: 20,
          width: 100,
          height: 70,
        },
      },
    ]),
    ...(compilation
      ? { extensionCompilations: { [nodeId]: compilation } }
      : {}),
    expected: {
      groupNodeIds: [nodeId],
      groupEngineIds: [engineId],
      operations: [`0:${nodeId}:extension:${engineId}/extension:${mode}`],
      requirements: requirement,
    },
    inspect(displayList) {
      const content = displayList.groups[0]?.content;
      if (content?.kind !== "extension") {
        return ["compiled content was not extension"];
      }
      if (content.mode !== (mode === "legacy" ? "legacy-opaque" : mode)) {
        return [`extension mode was ${content.mode}`];
      }
      if (mode === "standard") {
        return content.mode === "standard" &&
          content.displayVersion === "1" &&
          content.operations.length === 2
          ? []
          : ["standard extension payload changed"];
      }
      if (mode === "opaque") {
        return content.mode === "opaque" &&
          content.capability.id === "dev.motionforge.special-painter" &&
          content.capability.version === "2"
          ? []
          : ["opaque extension capability changed"];
      }
      return content.mode === "legacy-opaque" &&
        content.capability.id === "motionforge.legacy.renderer-adapter"
        ? []
        : ["legacy extension capability changed"];
    },
  };
}

/** Read-only fixtures that another backend can enumerate in its own harness. */
export const rendererConformanceFixtures: readonly RendererConformanceFixture[] =
  fixtureDefinitions;

/** Exact id+version negotiation oracle shared by all conformance harnesses. */
export function negotiateRendererCapabilities(
  displayList: DisplayList,
  capabilities: readonly RendererConformanceCapability[],
): DisplayCapabilityRequirement[] {
  const advertised = normalizeCapabilities(capabilities);
  return displayList.requirements
    .filter(
      (requirement) =>
        !advertised.has(capabilityKey(requirement.id, requirement.version)),
    )
    .map(cloneRequirement);
}

/**
 * Deterministic reference trace. Backends should emit the same trace from
 * their parsed-list traversal; it deliberately records group begin/end plus
 * the background → content → border → children phase boundary.
 */
export function traceRendererDisplayList(displayList: DisplayList): string[] {
  const trace: string[] = [];
  const visit = (group: DisplayGroup): void => {
    trace.push(
      `group:${group.paintOrder}:${group.nodeId}:${group.engineId}:begin`,
    );
    for (const operation of groupOperations(group)) {
      trace.push(operationTrace(operation));
    }
    group.children.forEach(visit);
    trace.push(
      `group:${group.paintOrder}:${group.nodeId}:${group.engineId}:end`,
    );
  };
  displayList.groups.forEach(visit);
  return trace;
}

/**
 * Run this from a pinned browser (or another deterministic host) with one
 * backend callback and one canonical pixel oracle. A future renderer only
 * needs to advertise exact capabilities, consume the parsed DisplayList, and
 * return its observed trace/pixels or the complete missing-requirement list.
 */
export async function runRendererConformanceSuite(
  adapter: RendererConformanceBackendAdapter,
  options: RendererConformanceRunOptions,
): Promise<RendererConformanceResult> {
  assertAdapter(adapter);
  if (!options || typeof options.renderReference !== "function") {
    throw new TypeError(
      "Renderer conformance needs a renderReference(fixture) callback.",
    );
  }

  const cases: RendererConformanceCaseResult[] = [];
  for (const fixture of fixtureDefinitions) {
    const failures: string[] = [];
    try {
      const first = compileFixture(fixture);
      const second = compileFixture(fixture);
      const firstJson = JSON.stringify(first);
      const secondJson = JSON.stringify(second);
      if (firstJson !== secondJson) {
        failures.push("two identical compilations produced different JSON");
      }

      const roundTripped = JSON.parse(firstJson) as DisplayList;
      if (JSON.stringify(roundTripped) !== firstJson) {
        failures.push("DisplayList changed during a JSON round-trip");
      }
      validateFixtureContract(fixture, first, failures);
      const stableTrace = traceRendererDisplayList(first);
      if (
        JSON.stringify(stableTrace) !==
          JSON.stringify(traceRendererDisplayList(second)) ||
        JSON.stringify(stableTrace) !==
          JSON.stringify(traceRendererDisplayList(roundTripped))
      ) {
        failures.push("reference traversal trace was not stable");
      }

      const expectedMissing = negotiateRendererCapabilities(
        roundTripped,
        adapter.capabilities,
      );
      const decision = await adapter.execute({
        fixture: {
          id: fixture.id,
          description: fixture.description,
          pixelCapable: fixture.pixelCapable,
        },
        displayList: roundTripped,
      });
      if (expectedMissing.length > 0) {
        if (decision.status !== "rejected") {
          failures.push(
            `backend accepted unsupported requirements ${formatRequirements(expectedMissing)}`,
          );
        } else if (
          JSON.stringify(decision.missing) !== JSON.stringify(expectedMissing)
        ) {
          failures.push(
            `backend rejected with ${formatRequirements(decision.missing)}, expected ${formatRequirements(expectedMissing)}`,
          );
        }
      } else if (decision.status !== "accepted") {
        failures.push(
          `backend rejected a supported list with ${formatRequirements(decision.missing)}`,
        );
      } else {
        if (JSON.stringify(decision.trace) !== JSON.stringify(stableTrace)) {
          failures.push("backend trace/order/engine ids differ from v1 intent");
        }
        if (fixture.pixelCapable) {
          if (!decision.pixels) {
            failures.push("pixel-capable fixture returned no backend pixels");
          } else {
            const reference = await options.renderReference(fixture);
            const difference = pixelDifference(reference, decision.pixels);
            if (difference) failures.push(difference);
          }
        }
      }
    } catch (error) {
      failures.push(
        `suite threw ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
      );
    }

    cases.push({
      fixtureId: fixture.id,
      pass: failures.length === 0,
      detail:
        failures.length === 0
          ? `${fixture.description}; ${fixture.pixelCapable ? "RGBA exact" : "structural"}`
          : failures.join("; "),
      failures,
    });
  }

  return {
    backendId: adapter.backendId,
    displayListVersion: 1,
    cases,
  };
}

function compileFixture(fixture: FixtureDefinition): DisplayList {
  const resolved = evaluateScene(fixture.scene, fixture.frame);
  const layout = layoutScene(resolved, { textMetrics: exactTextMetrics });
  const options: DisplayListCompileOptions = {
    textMetrics: exactTextMetrics,
    ...(fixture.extensionCompilations
      ? { extensionCompilations: fixture.extensionCompilations }
      : {}),
  };
  return compileDisplayList(layout, options);
}

function validateFixtureContract(
  fixture: FixtureDefinition,
  displayList: DisplayList,
  failures: string[],
): void {
  if (
    displayList.kind !== "motionforge.display-list" ||
    displayList.version !== 1 ||
    displayList.ephemeral !== true
  ) {
    failures.push("compiler did not emit an ephemeral DisplayList v1");
  }
  const groups = flattenGroups(displayList.groups);
  const groupNodeIds = groups.map((group) => group.nodeId);
  const groupEngineIds = groups.map((group) => group.engineId);
  const operations = groups.flatMap((group) =>
    groupOperations(group).map(operationFixtureTrace),
  );
  if (
    JSON.stringify(groupNodeIds) !==
    JSON.stringify(fixture.expected.groupNodeIds)
  ) {
    failures.push(
      `group order ${JSON.stringify(groupNodeIds)}, expected ${JSON.stringify(fixture.expected.groupNodeIds)}`,
    );
  }
  if (
    JSON.stringify(groupEngineIds) !==
    JSON.stringify(fixture.expected.groupEngineIds)
  ) {
    failures.push(
      `group engine ids ${JSON.stringify(groupEngineIds)}, expected ${JSON.stringify(fixture.expected.groupEngineIds)}`,
    );
  }
  if (
    JSON.stringify(groups.map((group) => group.paintOrder)) !==
    JSON.stringify(groups.map((_, index) => index))
  ) {
    failures.push("group paintOrder was not contiguous depth-first order");
  }
  if (
    JSON.stringify(operations) !== JSON.stringify(fixture.expected.operations)
  ) {
    failures.push(
      `operation trace ${JSON.stringify(operations)}, expected ${JSON.stringify(fixture.expected.operations)}`,
    );
  }
  if (
    JSON.stringify(displayList.requirements) !==
    JSON.stringify(fixture.expected.requirements)
  ) {
    failures.push(
      `requirements ${formatRequirements(displayList.requirements)}, expected ${formatRequirements(fixture.expected.requirements)}`,
    );
  }
  if (displayList.requirements.length > 0) {
    const exactCapabilities = displayList.requirements.map(
      ({ id, version }) => ({ id, version }),
    );
    if (
      negotiateRendererCapabilities(displayList, exactCapabilities).length !== 0
    ) {
      failures.push("exact id@version capability set did not negotiate");
    }
    const wrongVersions = exactCapabilities.map(({ id, version }) => ({
      id,
      version: `${version}-mismatch`,
    }));
    if (
      negotiateRendererCapabilities(displayList, wrongVersions).length !==
      displayList.requirements.length
    ) {
      failures.push(
        "same-id wrong-version capability was incorrectly accepted",
      );
    }
  }
  failures.push(...(fixture.inspect?.(displayList) ?? []));
}

function flattenGroups(groups: readonly DisplayGroup[]): DisplayGroup[] {
  return groups.flatMap((group) => [group, ...flattenGroups(group.children)]);
}

type DisplayOperation = NonNullable<
  DisplayGroup["background"] | DisplayContentOperation | DisplayGroup["border"]
>;

function groupOperations(group: DisplayGroup): DisplayOperation[] {
  return [group.background, group.content, group.border].filter(
    (operation): operation is DisplayOperation => operation !== null,
  );
}

function operationKind(operation: DisplayOperation): string {
  if (operation.kind !== "extension") return operation.kind;
  const mode = operation.mode === "legacy-opaque" ? "legacy" : operation.mode;
  return `extension:${mode}`;
}

function operationFixtureTrace(operation: DisplayOperation): string {
  return `${operation.paintOrder}:${operation.nodeId}:${operation.kind}:${operation.engineId}${operation.kind === "extension" ? `:${operationKind(operation).slice("extension:".length)}` : ""}`;
}

function operationTrace(operation: DisplayOperation): string {
  return `operation:${operation.paintOrder}:${operation.nodeId}:${operation.engineId}:${operationKind(operation)}`;
}

function normalizeCapabilities(
  capabilities: readonly RendererConformanceCapability[],
): ReadonlySet<string> {
  if (!Array.isArray(capabilities)) {
    throw new TypeError("Renderer conformance capabilities must be an array.");
  }
  const exact = new Set<string>();
  for (const capability of capabilities) {
    if (
      !capability ||
      typeof capability.id !== "string" ||
      capability.id.trim() === "" ||
      typeof capability.version !== "string" ||
      capability.version.trim() === ""
    ) {
      throw new TypeError(
        "Renderer conformance capabilities need non-empty id and version strings.",
      );
    }
    const key = capabilityKey(capability.id, capability.version);
    if (exact.has(key)) {
      throw new TypeError(`Duplicate renderer capability ${key}.`);
    }
    exact.add(key);
  }
  return exact;
}

function assertAdapter(adapter: RendererConformanceBackendAdapter): void {
  if (
    !adapter ||
    typeof adapter.backendId !== "string" ||
    adapter.backendId.trim() === "" ||
    adapter.displayListVersion !== 1 ||
    typeof adapter.execute !== "function"
  ) {
    throw new TypeError(
      "Renderer conformance adapters need backendId, displayListVersion: 1, capabilities, and execute().",
    );
  }
  normalizeCapabilities(adapter.capabilities);
}

function capabilityKey(id: string, version: string): string {
  return `${id}@${version}`;
}

function cloneRequirement(
  requirement: DisplayCapabilityRequirement,
): DisplayCapabilityRequirement {
  return {
    id: requirement.id,
    version: requirement.version,
    nodeIds: [...requirement.nodeIds],
  };
}

function formatRequirements(
  requirements: readonly DisplayCapabilityRequirement[],
): string {
  return requirements.length === 0
    ? "[]"
    : requirements
        .map(
          (requirement) =>
            `${requirement.id}@${requirement.version}[${requirement.nodeIds.join(",")}]`,
        )
        .join(", ");
}

function pixelDifference(
  expected: RendererConformancePixels,
  received: RendererConformancePixels,
): string | null {
  if (
    expected.width !== received.width ||
    expected.height !== received.height
  ) {
    return `backend pixels were ${received.width}x${received.height}, expected ${expected.width}x${expected.height}`;
  }
  if (expected.rgba.length !== received.rgba.length) {
    return `backend RGBA length was ${received.rgba.length}, expected ${expected.rgba.length}`;
  }
  for (let index = 0; index < expected.rgba.length; index += 1) {
    if (expected.rgba[index] !== received.rgba[index]) {
      return `backend RGBA first differed at byte ${index}: ${received.rgba[index]}, expected ${expected.rgba[index]}`;
    }
  }
  return null;
}
