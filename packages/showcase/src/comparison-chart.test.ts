import { describe, expect, it } from "vitest";
import { parseScene } from "@dojo-video-engine/schema";
import { expandMacroNodes } from "@dojo-video-engine/presets/macros";
import {
  compileDisplayList,
  layoutScene,
  evaluateScene,
  type DisplayGroup,
} from "@dojo-video-engine/core";
const base = {
  macro: "comparisonChart",
  id: "chart",
  kind: "bar",
  domain: { min: -20, max: 60 },
  unit: "points",
  categories: ["First", "Second", "Third"],
  series: [
    { name: "North", values: [-10, 0, 40] },
    { name: "South", values: [20, -20, 60] },
  ],
  from: 12,
  duration: 60,
};
function scene(overrides = {}, width = 960, height = 540) {
  const ctx = { width, height, fps: 24, duration: 100 };
  const r = expandMacroNodes([{ ...base, ...overrides }], ctx);
  if (!r.ok) throw Error(r.errors.join("\n"));
  return parseScene({ schemaVersion: 1, ...ctx, assets: {}, nodes: r.nodes });
}
function at(s: ReturnType<typeof scene>, frame: number) {
  const m = new Map<string, DisplayGroup>();
  const visit = (g: DisplayGroup) => {
    m.set(g.nodeId, g);
    g.children.forEach(visit);
  };
  compileDisplayList(layoutScene(evaluateScene(s, frame))).groups.forEach(
    visit,
  );
  return (id: string) => m.get("chart-" + id)!;
}
describe("comparisonChart", () => {
  it("keeps signed bars on one zero line throughout the entrance and aligns categories with their values", () => {
    const s = scene();
    expect(at(s, 11)("marks")).toBeUndefined();
    expect(at(s, 72)("marks")).toBeUndefined();
    for (const frame of [12, 20, 42, 71]) {
      const group = at(s, frame),
        zero = group("zero").box.y;
      const neg = group("series-1-mark-1").box,
        pos = group("series-2-mark-1").box;
      expect(neg.y).toBeCloseTo(zero, 8);
      expect(pos.y + pos.height).toBeCloseTo(zero, 8);
      expect(pos.height).toBeCloseTo(neg.height * 2, 8);
      expect(neg.x + neg.width).toBeLessThan(pos.x);
      expect(group("series-1-mark-2").box.height).toBe(0);
      const cat = group("category-1").box;
      expect(cat.x + cat.width / 2).toBeCloseTo(
        (neg.x + pos.x + pos.width) / 2,
      );
      expect(group("series-2-value-3").node.text).toBe("60");
    }
    expect(at(s, 12)("series-1-mark-1").box.height).toBe(0);
    expect(at(s, 71)("series-1-mark-1").box.height).toBeGreaterThan(0);
  });
  it.each([
    [960, 540],
    [720, 1280],
  ])(
    "keeps every line marker on the path under a common reveal in %i × %i",
    (w, h) => {
      const s = scene({ kind: "line", decorativeHint: "unused" }, w, h),
        final = at(s, 71);
      for (const i of [1, 2]) {
        const line = final("series-" + i + "-line");
        expect(line.node.shape?.kind).toBe("polyline");
        if (line.node.shape?.kind !== "polyline")
          throw Error("missing polyline");
        for (const [j, p] of line.node.shape.points.entries()) {
          const mark = final("series-" + i + "-mark-" + (j + 1));
          expect(mark.box.x + mark.box.width / 2).toBeCloseTo(
            line.box.x + p.x * line.box.width,
          );
          expect(mark.box.y + mark.box.height / 2).toBeCloseTo(
            line.box.y + p.y * line.box.height,
          );
          expect(at(s, 20)(mark.nodeId.slice(6)).box).toEqual(mark.box);
          expect(mark.node.shape?.kind).toBe(
            final("series-" + i + "-key").node.shape?.kind,
          );
        }
      }
      expect(at(s, 20)("marks").box.width).toBeLessThan(
        final("marks").box.width,
      );
    },
  );
  it("supports four flat overlapping series, exact zeros and a one-frame chart", () => {
    const s = scene({
      kind: "line",
      duration: 1,
      series: ["一", "二", "三", "四"].map((name) => ({
        name,
        values: [0, 0, 0],
      })),
    });
    const g = at(s, 12);
    const marks = [1, 2, 3, 4].map((i) => g("series-" + i + "-mark-1"));
    expect(new Set(marks.map((m) => m.node.style.fill)).size).toBe(4);
    for (const m of marks)
      expect(m.box.y + m.box.height / 2).toBeCloseTo(g("zero").box.y);
    expect(g("series-4-value-2").node.text).toBe("0");
  });
  it("permits a positive-only line domain but rejects one for grouped bars", () => {
    const extra = {
      domain: { min: 2, max: 5 },
      series: [
        { name: "A", values: [2, 4, 3] },
        { name: "B", values: [5, 3, 2] },
      ],
    };
    expect(() => scene(extra)).toThrow(/zero/);
    expect(at(scene({ ...extra, kind: "line" }), 60)("zero")).toBeUndefined();
  });
  it("holds the complete CJK and long labels across a portrait layout", () => {
    const g = at(
      scene(
        {
          kind: "line",
          categories: ["First quarter", "Second quarter", "第四季度"],
          series: [
            { name: "工作日", values: [5, 10, 15] },
            { name: "Weekend trips", values: [18, 13, 22] },
          ],
        },
        720,
        1280,
      ),
      71,
    );
    for (const [id, copy] of [
      ["category-2", "Second quarter"],
      ["category-3", "第四季度"],
      ["series-2-name", "Weekend trips"],
    ]) {
      const t = g(id!).content;
      if (t?.kind !== "text") throw Error("missing text");
      expect(
        t.lines
          .map((line) => line.text)
          .join("")
          .replace(/\s/g, ""),
      ).toBe(copy!.replace(/\s/g, ""));
    }
  });
  it.each([
    { series: [] },
    { categories: ["a", "a", "b"] },
    {
      series: [
        { name: "A", values: [0, 0, 0] },
        { name: "A", values: [1, 2, 3] },
      ],
    },
    { domain: { min: 5, max: 5 } },
    { domain: { min: -1e308, max: 1e308 } },
    {
      series: [
        { name: "A", values: [0, 2] },
        { name: "B", values: [1, 2, 3] },
      ],
    },
    {
      series: [
        { name: "A", values: [0, 2, 61] },
        { name: "B", values: [1, 2, 3] },
      ],
    },
  ])("rejects ambiguous or unplottable data", (extra) =>
    expect(() => scene(extra)).toThrow(),
  );
});
