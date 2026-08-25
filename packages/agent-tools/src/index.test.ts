import { describe, expect, it } from "vitest";
import {
  analyzeComposition,
  checkScene,
  createAgentToolRegistry,
  diffScenes,
  discoverCapabilities,
  hitTest,
  inspectLayout,
  inspectTimeline,
  inspectTree,
} from "./index.js";

const scene = {
  schemaVersion: 1,
  width: 320,
  height: 180,
  fps: 30,
  duration: 30,
  assets: {},
  nodes: [
    { id: "a", type: "text", text: "A" },
    { id: "b", type: "div" },
  ],
};

describe("scene diff", () => {
  it("addresses id-based node changes and reports order separately", () => {
    const diff = diffScenes(scene, {
      ...scene,
      nodes: [
        { id: "b", type: "div" },
        { id: "a", type: "text", text: "Changed" },
        { id: "c", type: "shape", shape: { kind: "ellipse" } },
      ],
    });
    expect(diff.summary).toEqual({ added: 1, removed: 0, changed: 2 });
    expect(diff.changes).toContainEqual({
      kind: "change",
      path: ["nodes", "$order"],
      before: ["a", "b"],
      after: ["b", "a", "c"],
    });
    expect(diff.changes).toContainEqual({
      kind: "change",
      path: ["nodes", "a", "text"],
      before: "A",
      after: "Changed",
    });
  });
});

describe("capability discovery", () => {
  it("derives agent catalogs from runtime registries", () => {
    const catalog = discoverCapabilities({ globalObject: {} });
    expect(catalog.scene.nodeTypes).toContain("shape");
    expect(catalog.motionPresets).toHaveLength(38);
    expect(catalog.macros.names.length).toBeGreaterThan(5);
    expect(catalog.extensions).toEqual([]);
    expect(catalog.export.videoEncoder).toBe(false);
  });
});

describe("agent tool registry", () => {
  it("publishes JSON-schema descriptors and executes stable data tools", async () => {
    const registry = createAgentToolRegistry({ globalObject: {} });
    const names = registry.list().map((tool) => tool.name);
    expect(names).toEqual([
      "motionforge.capabilities",
      "motionforge.check",
      "motionforge.diff",
      "motionforge.export",
      "motionforge.export.estimate",
      "motionforge.export.preflight",
      "motionforge.hitTest",
      "motionforge.inspect",
      "motionforge.inspect.layout",
      "motionforge.inspect.timeline",
      "motionforge.inspect.tree",
      "motionforge.lint",
      "motionforge.migrate",
      "motionforge.patch",
      "motionforge.render.contactSheet",
      "motionforge.render.still",
      "motionforge.validate",
    ]);
    expect(registry.list()[0]?.inputSchema).toMatchObject({ type: "object" });
    await expect(
      registry.call("motionforge.inspect", { scene }),
    ).resolves.toMatchObject({ width: 320, nodes: { total: 2 } });
    await expect(
      registry.call("motionforge.patch", {
        scene,
        patch: [{ op: "setText", id: "a", text: "Updated" }],
      }),
    ).resolves.toMatchObject({ ok: true });

    await expect(
      registry.call("motionforge.inspect.tree", {
        scene,
        semanticRoles: { a: "subtitle" },
      }),
    ).resolves.toMatchObject({
      kind: "motionforge.tree",
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: "a", semanticRole: "subtitle" }),
      ]),
    });
    await expect(
      registry.call("motionforge.inspect.timeline", { scene }),
    ).resolves.toMatchObject({
      kind: "motionforge.timeline",
      durationFrames: 30,
    });
    await expect(
      registry.call("motionforge.inspect.layout", {
        scene,
        frame: 0,
        allowedOverlaps: [["a", "b"]],
      }),
    ).resolves.toMatchObject({
      kind: "motionforge.layout",
      frame: 0,
      nodes: expect.arrayContaining([expect.objectContaining({ id: "a" })]),
    });
    await expect(
      registry.call("motionforge.hitTest", {
        scene,
        frame: 0,
        point: { x: 10, y: 10 },
      }),
    ).resolves.toMatchObject({
      kind: "motionforge.hit-test",
      hits: expect.arrayContaining([expect.objectContaining({ nodeId: "b" })]),
    });
    await expect(
      registry.call("motionforge.check", {
        scene,
        frames: [0, 15, 29],
      }),
    ).resolves.toMatchObject({
      kind: "motionforge.check",
      validation: { ok: true },
      composition: { sampledFrames: [0, 15, 29] },
    });
  });

  it("publishes strict bounded inspection descriptors", async () => {
    const registry = createAgentToolRegistry({ globalObject: {} });
    const descriptors = new Map(
      registry.list().map((descriptor) => [descriptor.name, descriptor]),
    );
    for (const name of [
      "motionforge.inspect.tree",
      "motionforge.inspect.timeline",
      "motionforge.inspect.layout",
      "motionforge.hitTest",
      "motionforge.check",
    ]) {
      expect(descriptors.get(name)?.inputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: expect.arrayContaining(["scene"]),
      });
    }
    expect(
      (
        descriptors.get("motionforge.inspect.tree")?.inputSchema.properties as
          | Record<string, Record<string, unknown>>
          | undefined
      )?.semanticRoles,
    ).toMatchObject({ maxProperties: 100 });
    expect(descriptors.get("motionforge.check")?.inputSchema).toMatchObject({
      allOf: [{ not: { required: ["frames", "sampleCount"] } }],
    });
    await expect(
      registry.call("motionforge.inspect.layout", { scene, frame: -1 }),
    ).rejects.toThrow();
    await expect(
      registry.call("motionforge.check", { scene, sampleCount: 101 }),
    ).rejects.toThrow();
    await expect(
      registry.call("motionforge.check", {
        scene,
        frames: [0],
        sampleCount: 1,
      }),
    ).rejects.toThrow(/either frames or sampleCount/);
    await expect(registry.call("motionforge.inspect.tree", {})).rejects.toThrow(
      /scene is required/,
    );
    await expect(
      registry.call("motionforge.check", {
        scene,
        frames: Array.from({ length: 101 }, (_, index) => index),
      }),
    ).rejects.toThrow();
    await expect(
      registry.call("motionforge.check", { scene, frames: [30] }),
    ).rejects.toThrow(/outside Scene duration/);
    await expect(
      registry.call("motionforge.inspect.tree", {
        scene,
        unknownOption: true,
      }),
    ).rejects.toThrow();
    await expect(
      registry.call("motionforge.check", {
        scene: { schemaVersion: 1, width: 0 },
        frames: [0],
      }),
    ).resolves.toMatchObject({
      kind: "motionforge.check",
      ok: false,
      validation: { ok: false, errors: expect.any(Array) },
      tree: null,
      composition: null,
    });
  });

  it("re-exports direct renderer-neutral inspection functions", () => {
    expect(inspectTree(scene).kind).toBe("motionforge.tree");
    expect(inspectTimeline(scene).kind).toBe("motionforge.timeline");
    expect(inspectLayout(scene, 0).kind).toBe("motionforge.layout");
    expect(hitTest(scene, 0, { x: 1, y: 1 }).kind).toBe("motionforge.hit-test");
    expect(analyzeComposition(scene, { frames: [0] }).sampledFrames).toEqual([
      0,
    ]);
    expect(checkScene(scene, { frames: [0] }).kind).toBe("motionforge.check");
  });
});
