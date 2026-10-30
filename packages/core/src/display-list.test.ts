import { describe, expect, it } from "vitest";
import type { Scene } from "@dojo-video-engine/schema";
import {
  compileDisplayList,
  evaluateScene,
  layoutScene,
  type DisplayGroup,
  type DisplayListCompileOptions,
  type LayoutScene,
} from "./index.js";

const exactText: NonNullable<DisplayListCompileOptions["textMetrics"]> = {
  measureLine(input) {
    return {
      width: Array.from(input.text).length * input.fontSize * 0.5,
      ascent: input.fontSize * 0.75,
      descent: input.fontSize * 0.25,
      measurement: "exact",
      reason: "test font",
    };
  },
};

function scene(nodes: Scene["nodes"]): Scene {
  return {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 60,
    assets: {
      poster: {
        id: "poster",
        type: "image",
        src: "poster.png",
        metadata: { width: 400, height: 200 },
      },
      clip: {
        id: "clip",
        type: "video",
        src: "clip.mp4",
        metadata: { width: 1920, height: 1080, duration: 2 },
      },
      song: { id: "song", type: "audio", src: "song.wav" },
      sticker: {
        id: "sticker",
        type: "lottie",
        src: "sticker.json",
        metadata: { width: 512, height: 512 },
      },
    },
    nodes,
  };
}

function compile(
  input: Scene,
  options: DisplayListCompileOptions = {},
): ReturnType<typeof compileDisplayList> {
  const resolved = evaluateScene(input, 5);
  const layout = layoutScene(resolved, { textMetrics: exactText });
  return compileDisplayList(layout, { textMetrics: exactText, ...options });
}

function flatten(groups: DisplayGroup[]): DisplayGroup[] {
  return groups.flatMap((group) => [group, ...flatten(group.children)]);
}

describe("renderer-neutral display list", () => {
  it("compiles every current node/content category into a JSON-safe tree", () => {
    const result = compile(
      scene([
        {
          id: "container",
          type: "div",
          style: {
            width: "100%",
            height: "100%",
            background: "linear-gradient(90deg, #000000, #ffffff)",
          },
          children: [
            {
              id: "title",
              type: "text",
              runs: [
                { text: "Hello ", style: { color: "#ff0000" } },
                {
                  text: "world",
                  style: {
                    opacity: 0.5,
                    textBackgroundColor: "#0000ff",
                  },
                },
              ],
              style: {
                position: "absolute",
                width: 120,
                height: 40,
                fontSize: 20,
                textBackgroundColor: "#222222",
              },
            },
            {
              id: "poster-node",
              type: "img",
              assetId: "poster",
              style: { width: 80, height: 80, objectFit: "contain" },
            },
            {
              id: "video-node",
              type: "video",
              assetId: "clip",
              style: { width: 80, height: 80, objectFit: "cover" },
            },
            { id: "audio-node", type: "audio", assetId: "song" },
            {
              id: "lottie-node",
              type: "lottie",
              assetId: "sticker",
              style: { width: 40, height: 40 },
            },
            {
              id: "shape-node",
              type: "shape",
              shape: {
                kind: "polygon",
                points: [
                  { x: 0, y: 1 },
                  { x: 0.5, y: 0 },
                  { x: 1, y: 1 },
                ],
              },
              style: { width: 50, height: 50, fill: "#00ff00" },
            },
            {
              id: "effect-node",
              type: "effect",
              effect: "confettiBurst",
              params: { seed: 7 },
              style: { width: 80, height: 80 },
            },
            {
              id: "extension-node",
              type: "extension",
              extension: {
                name: "dev.example.checker",
                version: "1.0.0",
                params: { cells: 8 },
              },
              style: { width: 80, height: 80 },
            },
          ],
        },
      ]),
    );

    const groups = flatten(result.groups);
    expect(groups.map((group) => group.nodeType).sort()).toEqual([
      "audio",
      "div",
      "effect",
      "extension",
      "img",
      "lottie",
      "shape",
      "text",
      "video",
    ]);
    expect(
      groups.find((group) => group.nodeId === "audio-node")?.content,
    ).toBeNull();
    expect(
      groups.find((group) => group.nodeId === "title")?.content,
    ).toMatchObject({
      kind: "text",
      lines: [{ text: "Hello world" }],
    });
    expect(
      groups.find((group) => group.nodeId === "poster-node")?.content,
    ).toMatchObject({
      kind: "media",
      resource: { kind: "image", assetId: "poster" },
      intrinsic: { width: 400, height: 200, measurement: "declared" },
    });
    expect(
      groups.find((group) => group.nodeId === "video-node")?.content,
    ).toMatchObject({
      resource: { kind: "prepared-video", sceneFrame: 5 },
    });
    expect(
      groups.find((group) => group.nodeId === "lottie-node")?.content,
    ).toMatchObject({
      resource: { kind: "prepared-lottie", sceneFrame: 5 },
    });
    expect(
      groups.find((group) => group.nodeId === "shape-node")?.content,
    ).toMatchObject({
      kind: "shape",
      geometry: { kind: "polyline", closed: true },
    });
    expect(
      groups.find((group) => group.nodeId === "effect-node")?.content,
    ).toMatchObject({
      kind: "effect",
      capability: { id: "dojo-video-engine.effect", version: "1" },
    });
    expect(
      groups.find((group) => group.nodeId === "extension-node")?.content,
    ).toMatchObject({
      kind: "extension",
      mode: "legacy-opaque",
    });
    expect(result.requirements).toEqual([
      {
        id: "dojo-video-engine.effect",
        version: "1",
        nodeIds: ["effect-node"],
      },
      {
        id: "dojo-video-engine.legacy.renderer-adapter",
        version: "1.0.0",
        nodeIds: ["extension-node"],
      },
    ]);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("preserves Scene v1 group geometry, composite, clip/mask, and paint phases", () => {
    const result = compile(
      scene([
        {
          id: "visual",
          type: "shape",
          shape: { kind: "ellipse" },
          clip: { kind: "rect", radius: 4 },
          mask: {
            shape: { kind: "ellipse" },
            opacity: 0.7,
            feather: 3,
          },
          style: {
            position: "absolute",
            left: 20,
            top: 15,
            width: 100,
            height: 60,
            transform: "translate(5px, 2px) rotate(10deg)",
            opacity: 0.8,
            blendMode: "screen",
            isolation: true,
            filter: "blur(2px)",
            overflow: "hidden",
            borderRadius: 12,
            background: "radial-gradient(circle at 25% 75%, red, blue)",
            boxShadow: "1px 2px 3px #000000, -1px 0px 2px #ffffff",
            border: "4px solid #ff00ff",
            fill: "conic-gradient(from 30deg at 50% 50%, red, blue)",
          },
        },
      ]),
    );
    const group = result.groups[0]!;
    expect(group.box).toEqual({ x: 20, y: 15, width: 100, height: 60 });
    expect(group.transform).not.toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    expect(group.composite).toEqual({
      opacity: 0.8,
      blendMode: "screen",
      filter: "blur(2px)",
      isolation: true,
      strategy: "isolated",
    });
    expect(group.clip?.kind).toBe("rounded-rect");
    expect(group.overflowClip?.kind).toBe("rounded-rect");
    expect(group.mask).toMatchObject({
      strategy: "soft-raster",
      opacity: 0.7,
      feather: 3,
    });
    expect(group.background).toMatchObject({
      kind: "background",
      paint: { kind: "radial-gradient" },
      shadowStrategy: "layers-then-fill",
    });
    expect(group.content).toMatchObject({
      kind: "shape",
      fill: { kind: "conic-gradient" },
    });
    expect(group.border).toMatchObject({ kind: "border", width: 4 });
    expect(
      [group.background, group.content, group.border].map(
        (operation) => operation?.paintOrder,
      ),
    ).toEqual([0, 1, 2]);
    expect(result.requirements.map((entry) => entry.id)).toEqual([
      "dojo-video-engine.filter",
      "dojo-video-engine.mask.soft",
      "dojo-video-engine.paint.conic",
    ]);
  });

  it("uses stable z/document order, engine ids, and defensive snapshots", () => {
    const input = scene([
      { id: "front", type: "div", style: { zIndex: 2 } },
      {
        id: "back",
        type: "div",
        style: { zIndex: -1 },
        children: [
          { id: "tie-a", type: "div", style: { zIndex: 1 } },
          { id: "tie-b", type: "div", style: { zIndex: 1 } },
        ],
      },
      { id: "middle", type: "div" },
    ]);
    const layout = layoutScene(evaluateScene(input, 0));
    const before = JSON.stringify(layout);
    const first = compileDisplayList(layout);
    const second = compileDisplayList(layout);

    expect(first.groups.map((group) => group.nodeId)).toEqual([
      "back",
      "middle",
      "front",
    ]);
    expect(first.groups[0]?.children.map((group) => group.nodeId)).toEqual([
      "tie-a",
      "tie-b",
    ]);
    expect(flatten(first.groups).map((group) => group.paintOrder)).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(flatten(first.groups).map((group) => group.engineId)).toEqual([
      "mf:node:4:back",
      "mf:node:5:tie-a",
      "mf:node:5:tie-b",
      "mf:node:6:middle",
      "mf:node:5:front",
    ]);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    first.groups[0]!.node.style.opacity = 0.1;
    expect(JSON.stringify(layout)).toBe(before);
  });

  it("rejects duplicate ids and enforces structural/text/operation budgets", () => {
    const input = scene([
      {
        id: "root",
        type: "div",
        style: { backgroundColor: "#000000" },
        children: [
          {
            id: "child",
            type: "text",
            text: "bounded",
            style: { backgroundColor: "#ffffff" },
            children: [{ id: "grandchild", type: "div" }],
          },
        ],
      },
    ]);
    expect(() => compile(input, { budgets: { maxNodes: 2 } })).toThrow(
      /node budget 2/,
    );
    expect(() => compile(input, { budgets: { maxDepth: 1 } })).toThrow(
      /depth budget 1/,
    );
    expect(() => compile(input, { budgets: { maxTextCharacters: 3 } })).toThrow(
      /text budget 3/,
    );
    expect(() => compile(input, { budgets: { maxOperations: 1 } })).toThrow(
      /operation budget 1/,
    );

    const layout = layoutScene(evaluateScene(input, 0));
    const child = layout.boxes[0]?.children[0];
    if (!child) throw new Error("missing child fixture");
    child.id = "root";
    child.node.id = "root";
    expect(() => compileDisplayList(layout)).toThrow(
      'Duplicate display-list node id "root"',
    );
  });

  it("makes extension standard/opaque decisions explicit and bounded", () => {
    const input = scene([
      {
        id: "custom",
        type: "extension",
        extension: {
          name: "dev.example.custom",
          version: "1.0.0",
          params: { order: { z: 1, a: 2 } },
        },
      },
    ]);
    const standard = compile(input, {
      extensionCompilations: {
        custom: {
          kind: "standard",
          version: "1",
          operations: [{ z: 1, a: 2 }],
        },
      },
    });
    expect(standard.groups[0]?.content).toMatchObject({
      mode: "standard",
      operations: [{ a: 2, z: 1 }],
    });
    expect(standard.requirements).toEqual([]);

    const opaque = compile(input, {
      extensionCompilations: {
        custom: {
          kind: "opaque",
          capability: { id: "dev.example.renderer", version: "2" },
          payload: { phase: 3 },
        },
      },
    });
    expect(opaque.groups[0]?.content).toMatchObject({
      mode: "opaque",
      payload: { phase: 3 },
    });
    expect(opaque.requirements).toEqual([
      {
        id: "dev.example.renderer",
        version: "2",
        nodeIds: ["custom"],
      },
    ]);
    expect(() =>
      compile(input, {
        extensionCompilations: {
          custom: {
            kind: "opaque",
            capability: { id: "dev.example.renderer", version: "2" },
            payload: "0123456789",
          },
        },
        budgets: { maxOpaqueBytes: 5 },
      }),
    ).toThrow(/opaque payload budget 5 bytes/);
    expect(() =>
      compile(input, {
        extensionCompilations: {
          absent: { kind: "standard", version: "1", operations: [] },
        },
      }),
    ).toThrow(/unknown or inactive node "absent"/);
  });

  it("rejects non-JSON extension payloads without mutating compiler inputs", () => {
    const input = scene([
      {
        id: "custom",
        type: "extension",
        extension: {
          name: "dev.example.custom",
          version: "1.0.0",
          params: {},
        },
      },
    ]);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() =>
      compile(input, {
        extensionCompilations: {
          custom: {
            kind: "opaque",
            capability: { id: "dev.example.renderer", version: "1" },
            payload: cyclic as never,
          },
        },
      }),
    ).toThrow(/cycle/);
    expect(() =>
      compile(input, {
        extensionCompilations: {
          custom: {
            kind: "standard",
            version: "1",
            operations: [{ invalid: Number.NaN }] as never,
          },
        },
      }),
    ).toThrow(/non-finite number/);

    const compileOpaque = (payload: unknown) =>
      compile(input, {
        extensionCompilations: {
          custom: {
            kind: "opaque",
            capability: { id: "dev.example.renderer", version: "1" },
            payload: payload as never,
          },
        },
      });
    const sparse: unknown[] = [];
    sparse.length = 1;
    expect(() => compileOpaque(sparse)).toThrow(/sparse array/);
    const inheritedHole: unknown[] = [];
    inheritedHole.length = 1;
    Object.setPrototypeOf(inheritedHole, { 0: "inherited" });
    expect(() => compileOpaque(inheritedHole)).toThrow(/sparse array/);
    const symbolProperty = { safe: true } as Record<PropertyKey, unknown>;
    symbolProperty[Symbol("hidden")] = true;
    expect(() => compileOpaque(symbolProperty)).toThrow(/symbol key/);
    const nonEnumerable = { safe: true };
    Object.defineProperty(nonEnumerable, "hidden", { value: true });
    expect(() => compileOpaque(nonEnumerable)).toThrow(/non-enumerable/);
    const accessor = {};
    Object.defineProperty(accessor, "value", {
      enumerable: true,
      get: () => true,
    });
    expect(() => compileOpaque(accessor)).toThrow(/accessor property/);
    expect(() => compileOpaque({ omitted: undefined })).toThrow(
      /non-JSON value/,
    );
    expect(() =>
      compile(input, {
        extensionCompilations: {
          custom: {
            kind: "standard",
            version: "1",
            operations: [{ omitted: undefined }] as never,
          },
        },
      }),
    ).toThrow(/non-JSON value/);
  });

  it("rejects malformed LayoutScene headers before compiling", () => {
    const layout = layoutScene(evaluateScene(scene([]), 0));
    expect(() =>
      compileDisplayList({ ...layout, width: Number.NaN } as LayoutScene),
    ).toThrow(/width must be finite/);
    expect(() =>
      compileDisplayList({ ...layout, frame: layout.duration } as LayoutScene),
    ).toThrow(/frame must be inside/);
    expect(() =>
      compileDisplayList(layout, { budgets: { maxNodes: 0 } }),
    ).toThrow(/maxNodes must be a positive safe integer/);
  });

  it("preserves finite in-range fractional evaluation frames", () => {
    const layout = layoutScene(evaluateScene(scene([]), 1.25));
    expect(compileDisplayList(layout).composition.frame).toBe(1.25);
  });

  it("keeps deep hierarchy snapshots shallow and display-list size linear", () => {
    const nested = (depth: number): Scene["nodes"][number] => {
      let current: Scene["nodes"][number] = {
        id: `node-${depth - 1}`,
        type: "div",
      };
      for (let index = depth - 2; index >= 0; index -= 1) {
        current = {
          id: `node-${index}`,
          type: "div",
          children: [current],
        };
      }
      return current;
    };
    const shallow = compile(scene([nested(16)]));
    const deep = compile(scene([nested(32)]));
    expect(flatten(deep.groups)).toHaveLength(32);
    expect(
      flatten(deep.groups).every((group) => group.node.children.length === 0),
    ).toBe(true);
    expect(
      JSON.stringify(deep).length / JSON.stringify(shallow).length,
    ).toBeLessThan(2.5);
  });
});
