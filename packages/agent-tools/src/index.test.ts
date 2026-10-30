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
  sceneCommandJsonSchema,
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
      "dojo-video-engine.capabilities",
      "dojo-video-engine.check",
      "dojo-video-engine.commands.apply",
      "dojo-video-engine.diff",
      "dojo-video-engine.export",
      "dojo-video-engine.export.estimate",
      "dojo-video-engine.export.preflight",
      "dojo-video-engine.hitTest",
      "dojo-video-engine.inspect",
      "dojo-video-engine.inspect.layout",
      "dojo-video-engine.inspect.timeline",
      "dojo-video-engine.inspect.tree",
      "dojo-video-engine.lint",
      "dojo-video-engine.migrate",
      "dojo-video-engine.patch",
      "dojo-video-engine.render.contactSheet",
      "dojo-video-engine.render.still",
      "dojo-video-engine.validate",
    ]);
    expect(registry.list()[0]?.inputSchema).toMatchObject({ type: "object" });
    await expect(
      registry.call("dojo-video-engine.inspect", { scene }),
    ).resolves.toMatchObject({ width: 320, nodes: { total: 2 } });
    await expect(
      registry.call("dojo-video-engine.patch", {
        scene,
        patch: [{ op: "setText", id: "a", text: "Updated" }],
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      registry.call("dojo-video-engine.commands.apply", {
        scene,
        commands: [{ kind: "text.set", id: "a", text: "By command" }],
      }),
    ).resolves.toMatchObject({
      ok: true,
      scene: {
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: "a", text: "By command" }),
        ]),
      },
      affectedIds: ["a"],
    });

    await expect(
      registry.call("dojo-video-engine.inspect.tree", {
        scene,
        semanticRoles: { a: "subtitle" },
      }),
    ).resolves.toMatchObject({
      kind: "dojo-video-engine.tree",
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: "a", semanticRole: "subtitle" }),
      ]),
    });
    await expect(
      registry.call("dojo-video-engine.inspect.timeline", { scene }),
    ).resolves.toMatchObject({
      kind: "dojo-video-engine.timeline",
      durationFrames: 30,
    });
    await expect(
      registry.call("dojo-video-engine.inspect.layout", {
        scene,
        frame: 0,
        allowedOverlaps: [["a", "b"]],
      }),
    ).resolves.toMatchObject({
      kind: "dojo-video-engine.layout",
      frame: 0,
      nodes: expect.arrayContaining([expect.objectContaining({ id: "a" })]),
    });
    await expect(
      registry.call("dojo-video-engine.hitTest", {
        scene,
        frame: 0,
        point: { x: 10, y: 10 },
      }),
    ).resolves.toMatchObject({
      kind: "dojo-video-engine.hit-test",
      hits: expect.arrayContaining([expect.objectContaining({ nodeId: "b" })]),
    });
    await expect(
      registry.call("dojo-video-engine.check", {
        scene,
        frames: [0, 15, 29],
      }),
    ).resolves.toMatchObject({
      kind: "dojo-video-engine.check",
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
      "dojo-video-engine.inspect.tree",
      "dojo-video-engine.inspect.timeline",
      "dojo-video-engine.inspect.layout",
      "dojo-video-engine.hitTest",
      "dojo-video-engine.check",
    ]) {
      expect(descriptors.get(name)?.inputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: expect.arrayContaining(["scene"]),
      });
    }
    expect(
      (
        descriptors.get("dojo-video-engine.inspect.tree")?.inputSchema.properties as
          | Record<string, Record<string, unknown>>
          | undefined
      )?.semanticRoles,
    ).toMatchObject({ maxProperties: 100 });
    expect(descriptors.get("dojo-video-engine.check")?.inputSchema).toMatchObject({
      allOf: [{ not: { required: ["frames", "sampleCount"] } }],
    });
    expect(
      descriptors.get("dojo-video-engine.commands.apply")?.inputSchema,
    ).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["scene", "commands"],
    });
    const commandDocument = sceneCommandJsonSchema();
    expect(
      (
        descriptors.get("dojo-video-engine.commands.apply")?.inputSchema
          .properties as Record<string, unknown>
      ).commands,
    ).toEqual(
      (commandDocument.definitions as Record<string, Record<string, unknown>>)
        .DojoVideoEngineSceneCommands,
    );
    await expect(
      registry.call("dojo-video-engine.inspect.layout", { scene, frame: -1 }),
    ).rejects.toThrow();
    await expect(
      registry.call("dojo-video-engine.check", { scene, sampleCount: 101 }),
    ).rejects.toThrow();
    await expect(
      registry.call("dojo-video-engine.check", {
        scene,
        frames: [0],
        sampleCount: 1,
      }),
    ).rejects.toThrow(/either frames or sampleCount/);
    await expect(registry.call("dojo-video-engine.inspect.tree", {})).rejects.toThrow(
      /scene is required/,
    );
    await expect(
      registry.call("dojo-video-engine.check", {
        scene,
        frames: Array.from({ length: 101 }, (_, index) => index),
      }),
    ).rejects.toThrow();
    await expect(
      registry.call("dojo-video-engine.check", { scene, frames: [30] }),
    ).rejects.toThrow(/outside Scene duration/);
    await expect(
      registry.call("dojo-video-engine.inspect.tree", {
        scene,
        unknownOption: true,
      }),
    ).rejects.toThrow();
    await expect(
      registry.call("dojo-video-engine.check", {
        scene: { schemaVersion: 1, width: 0 },
        frames: [0],
      }),
    ).resolves.toMatchObject({
      kind: "dojo-video-engine.check",
      ok: false,
      validation: { ok: false, errors: expect.any(Array) },
      tree: null,
      composition: null,
    });
  });

  it("re-exports direct renderer-neutral inspection functions", () => {
    expect(inspectTree(scene).kind).toBe("dojo-video-engine.tree");
    expect(inspectTimeline(scene).kind).toBe("dojo-video-engine.timeline");
    expect(inspectLayout(scene, 0).kind).toBe("dojo-video-engine.layout");
    expect(hitTest(scene, 0, { x: 1, y: 1 }).kind).toBe("dojo-video-engine.hit-test");
    expect(analyzeComposition(scene, { frames: [0] }).sampledFrames).toEqual([
      0,
    ]);
    expect(checkScene(scene, { frames: [0] }).kind).toBe("dojo-video-engine.check");
  });
});
