import { describe, expect, it } from "vitest";
import {
  createAgentToolRegistry,
  diffScenes,
  discoverCapabilities,
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
      "motionforge.diff",
      "motionforge.export",
      "motionforge.export.estimate",
      "motionforge.export.preflight",
      "motionforge.inspect",
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
  });
});
