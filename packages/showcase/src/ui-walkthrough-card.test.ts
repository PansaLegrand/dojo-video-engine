import { describe, it, expect } from "vitest";
import { parseScene } from "@dojo-video-engine/schema";
import {
  compileDisplayList,
  evaluateScene,
  parseColor,
  layoutScene,
  type DisplayGroup,
} from "@dojo-video-engine/core";
import { expandMacroNodes } from "@dojo-video-engine/presets/macros";

const base = {
  id: "flow",
  macro: "uiWalkthroughCard",
  windowTitle: "Studio",
  badge: "Preview",
  steps: [
    { label: "Capture", detail: "Import clips." },
    { label: "Organize", detail: "Order the selects." },
    { label: "Share", detail: "Send the cut." },
  ],
  from: 9,
  duration: 72,
};
function make(extra = {}, width = 960, height = 540) {
  const ctx = { width, height, fps: 24, duration: 100 };
  const result = expandMacroNodes([{ ...base, ...extra }], ctx);
  if (!result.ok) throw Error(result.errors.join("\n"));
  return parseScene({
    schemaVersion: 1,
    ...ctx,
    assets: {},
    nodes: result.nodes,
  });
}
const isActive = (g: DisplayGroup) =>
  JSON.stringify(parseColor(g.node.style.backgroundColor ?? "")) ===
  JSON.stringify(parseColor("#c5ef95"));
function at(scene: ReturnType<typeof make>, frame: number) {
  const groups = compileDisplayList(
    layoutScene(evaluateScene(scene, frame)),
  ).groups;
  const map = new Map<string, DisplayGroup>();
  const walk = (g: DisplayGroup) => {
    map.set(g.nodeId, g);
    g.children.forEach(walk);
  };
  groups.forEach(walk);
  return map;
}
describe("editable UI walkthrough", () => {
  it("cycles exactly at local beat boundaries, holds the final selection and keeps one copy of each label", () => {
    const scene = make();
    expect(at(scene, 8).size).toBe(0);
    expect(at(scene, 81).size).toBe(0);
    for (const [f, active] of [
      [9, 1],
      [32, 1],
      [33, 2],
      [56, 2],
      [57, 3],
      [80, 3],
    ] as const) {
      const groups = at(scene, f);
      expect(
        [...groups.values()].filter(isActive).map((g) => g.nodeId),
      ).toEqual(["flow-step-" + active]);
      for (let i = 1; i <= 3; i++)
        expect(groups.get("flow-step-" + i + "-check")!.composite.opacity).toBe(
          i < active ? 1 : 0,
        );
      expect(
        [...groups.values()].filter((g) => g.node.text === "Organize"),
      ).toHaveLength(1);
    }
  });
  it("moves the pointer before a state change and shows a focus ring at arrival", () => {
    const s = make();
    const y = (f: number) => at(s, f).get("flow-cursor")!.box.y;
    expect(y(30)).toBeGreaterThan(y(20));
    expect(y(30)).toBeLessThan(y(33));
    expect(y(39)).toBeCloseTo(y(33));
    expect(at(s, 33).get("flow-focus")!.composite.opacity).toBe(1);
    expect(at(s, 44).get("flow-focus")!.composite.opacity).toBe(0);
  });
  it("pins a zero-based step while pointing at a different target", () => {
    const s = make({
        activeStepIndex: 0,
        cursorTargetStep: 2,
        palette: "paper",
      }),
      g = at(s, 80);
    expect(g.get("flow-step-1")!.node.style.backgroundColor).toBe("#704a80");
    const row = g.get("flow-step-3")!.box;
    expect(g.get("flow-cursor")!.box.y).toBeCloseTo(row.y + row.height / 2);
  });
  it("honors authored status, skips finished steps and supports an all-done card", () => {
    const s = make({
      steps: [
        { label: "One", status: "done" },
        { label: "Two", status: "active" },
        { label: "Three", status: "idle" },
      ],
    });
    expect(at(s, 80).get("flow-step-2")!.node.style.backgroundColor).toBe(
      "#c5ef95",
    );
    const done = make({
      steps: [{ label: "One", status: "done" }],
      duration: 1,
    });
    expect(at(done, 9).has("flow-cursor")).toBe(false);
    expect(at(done, 9).get("flow-step-1-check")!.composite.opacity).toBe(1);
    const skip = make({
      steps: [
        { label: "One" },
        { label: "Two", status: "done" },
        { label: "Three" },
      ],
    });
    expect(at(skip, 45).get("flow-step-3")!.node.style.backgroundColor).toBe(
      "#c5ef95",
    );
  });
  it.each([
    [720, 1280],
    [1280, 720],
  ])("fits editable CJK copy and a long detail on %i×%i", (w, h) => {
    const s = make(
      {
        windowTitle: "编辑流程",
        steps: [
          { label: "导入素材", detail: "选择照片与视频素材。" },
          {
            label: "编排片段",
            detail: "Arrange the selects before sharing the first review cut.",
          },
          { label: "分享剪辑" },
        ],
        extraHint: true,
      },
      w,
      h,
    );
    const g = at(s, 45);
    for (const node of g.values()) {
      const b = node.transformedBounds;
      expect(b.x).toBeGreaterThanOrEqual(-0.01);
      expect(b.y).toBeGreaterThanOrEqual(-0.01);
      expect(b.x + b.width).toBeLessThanOrEqual(w + 0.01);
      expect(b.y + b.height).toBeLessThanOrEqual(h + 0.01);
      if (node.content?.kind === "text")
        expect(
          node.content.lines
            .map((l) => l.text)
            .join("")
            .replace(/\s/g, ""),
        ).toBe(node.node.text!.replace(/\s/g, ""));
    }
  });
  it("gives six compact rows a separate detail column and preserves the wording", () => {
    const steps = Array.from({ length: 6 }, (_, i) => ({
      label: "Stage " + (i + 1),
      detail: "Check the edit before sending the cut for review.",
    }));
    const g = at(make({ steps }, 960, 540), 55);
    const label = g.get("flow-step-3-label")!,
      detail = g.get("flow-step-3-detail")!;
    expect(detail.box.x).toBeGreaterThan(label.box.x + label.box.width);
    expect(
      detail.content?.kind === "text" &&
        detail.content.lines
          .map((l) => l.text)
          .join("")
          .replace(/\s/g, ""),
    ).toBe(steps[2]!.detail.replace(/\s/g, ""));
  });

  it("allows a one-frame beat for each step with unique ascending keys", () => {
    const s = make({ duration: 3 });
    for (let i = 0; i < 3; i++)
      expect(isActive(at(s, 9 + i).get("flow-step-" + (i + 1))!)).toBe(true);
  });
  it.each([
    { windowTitle: "A\nB" },
    { steps: [{ label: "A", detail: "one\ntwo\nthree" }] },
    { activeStepIndex: 3 },
    { cursorTargetStep: -1 },
    { duration: 2 },
    { steps: [] },
    {
      steps: [
        { label: "A", status: "active" },
        { label: "B", status: "active" },
      ],
    },
    { steps: [{ label: "A", status: "done" }], activeStepIndex: 0 },
  ])("rejects conflicting or unplayable instructions", (bad) =>
    expect(() => make(bad)).toThrow(),
  );
});
