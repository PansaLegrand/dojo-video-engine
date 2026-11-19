import { describe, expect, it } from "vitest";
import { parseScene, type SceneNode } from "@dojo-video-engine/schema";
import {
  evaluateScene,
  layoutScene,
  compileDisplayList,
  type DisplayGroup,
} from "@dojo-video-engine/core";
import { expandMacroNodes } from "@dojo-video-engine/presets/macros";

const ctx = { width: 960, height: 540, fps: 24, duration: 120 };
const input = {
  macro: "kineticSplit",
  id: "hero",
  text: "Keep every\nword",
  from: 12,
  duration: 72,
  staggerFrames: 4,
  holdFrames: 24,
};
function scene(options = {}, width = ctx.width, height = ctx.height) {
  const result = expandMacroNodes([{ ...input, ...options }], {
    ...ctx,
    width,
    height,
  });
  if (!result.ok) throw Error(result.errors.join("\n"));
  return parseScene({
    schemaVersion: 1,
    ...ctx,
    width,
    height,
    assets: {},
    nodes: result.nodes,
  });
}
const flatten = (groups: DisplayGroup[]): DisplayGroup[] =>
  groups.flatMap((g) => [g, ...flatten(g.children)]);
const units = (s: ReturnType<typeof scene>, f: number) =>
  flatten(compileDisplayList(layoutScene(evaluateScene(s, f))).groups).filter(
    (g) => g.nodeType === "text",
  );
describe("editable kineticSplit lockups", () => {
  it.each(["elasticRise", "trackingExpand", "maskSlide", "cascadePop"])(
    "settles every %s unit before the hold, including at a nonzero parent start",
    (preset) => {
      const s = scene({ preset, unknownDecoration: "unused" });
      expect(units(s, 11)).toEqual([]);
      const initial = units(s, 12),
        middle = units(s, 17),
        held = units(s, 60),
        last = units(s, 83);
      expect(initial.map((g) => g.composite.opacity)).toEqual([0, 0, 0]);
      expect(middle[0]!.composite.opacity).toBeGreaterThan(
        middle[1]!.composite.opacity,
      );
      expect(middle[2]!.composite.opacity).toBe(0);
      expect(last.map((g) => g.node.text)).toEqual(["Keep", "every", "word"]);
      expect(last.map((g) => g.composite.opacity)).toEqual([1, 1, 1]);
      expect(last.map((g) => g.transformedBounds)).toEqual(
        held.map((g) => g.transformedBounds),
      );
      expect(units(s, 84)).toEqual([]);
      const row = s.nodes[0]!.children![0]!;
      if (preset === "maskSlide") expect(row.style?.overflow).toBe("hidden");
      if (preset === "trackingExpand")
        expect(
          row.animations?.some(
            (a) => a.kind === "keyframes" && a.property === "gap",
          ),
        ).toBe(true);
    },
  );
  it("keeps graphemes, spaces and authored line breaks on a portrait canvas", () => {
    const s = scene({ text: "听 见\ne\u0301👩🏽‍🎤", splitBy: "char" }, 540, 960);
    expect(units(s, 83).map((g) => g.node.text)).toEqual([
      "听",
      "见",
      "e\u0301",
      "👩🏽‍🎤",
    ]);
    expect(
      s.nodes[0]!.children![0]!.children!.some((n) => n.type === "div"),
    ).toBe(true);
    for (const { transformedBounds: b } of units(s, 83)) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(540);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(960);
    }
  });
  it("supports one stable text node per authored line and avoids silent loss or impossible timing", () => {
    expect(
      units(
        scene({ splitBy: "line", text: "أهلاً بكم\nWelcome here" }),
        83,
      ).map((g) => g.node.text),
    ).toEqual(["أهلاً بكم", "Welcome here"]);
    expect(() => scene({ splitBy: "char", text: "a".repeat(65) })).toThrow(
      /64/,
    );
    expect(() =>
      scene({ duration: 12, holdFrames: 10, staggerFrames: 4 }),
    ).toThrow(/hold/);
    expect(() =>
      scene({ duration: 2, holdFrames: 1, staggerFrames: undefined }),
    ).toThrow(/hold/);
  });
  it("keeps generated child IDs distinct from existing identities", () => {
    const result = expandMacroNodes([input], {
      ...ctx,
      existingIds: ["hero-unit-1", "hero-row-1"],
    });
    if (!result.ok) throw Error(result.errors.join());
    const ids = (nodes: SceneNode[]): string[] =>
      nodes.flatMap((n) => [n.id, ...ids(n.children ?? [])]);
    const names = ids(result.nodes as SceneNode[]);
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain("hero-unit-1");
    expect(names).not.toContain("hero-row-1");
  });
});
