import {
  compileDisplayList,
  evaluateScene,
  getLayoutContentRect,
  layoutScene,
  type LayoutBox,
  type MeasureTextLine,
} from "@dojo-video-engine/core";
import { textOverlay } from "@dojo-video-engine/presets";
import { expandMacroNodes } from "@dojo-video-engine/presets/macros";
import {
  parseScene,
  type Scene,
  type SceneNode,
} from "@dojo-video-engine/schema";

export type TitleCardLayoutCheck = {
  label: string;
  pass: boolean;
  detail: string;
};
type Slot = "title" | "subtitle" | "kicker";
type Copy = Record<Slot, string>;
type Size = { width: number; height: number };
type Rect = { x: number; y: number; width: number; height: number };
const sizes: Size[] = [
  { width: 640, height: 360 },
  { width: 1920, height: 1080 },
  { width: 360, height: 640 },
  { width: 1080, height: 1920 },
  { width: 360, height: 360 },
  { width: 1080, height: 1080 },
];
const looks = ["editorial", "bold", "minimal"] as const;
const slots: Slot[][] = [
  ["title"],
  ["title", "subtitle"],
  ["kicker", "title"],
  ["kicker", "title", "subtitle"],
];
const copies: Array<{ name: string; value: Copy }> = [
  {
    name: "outro",
    value: {
      title: "Made by DojoClip.com",
      subtitle: "Your story, precisely edited.",
      kicker: "CREATED WITH",
    },
  },
  {
    name: "long-latin",
    value: {
      title: "A stronger editing foundation for every ambitious new project",
      subtitle: "Reusable captions, clear motion, and precise timing.",
      kicker: "PRODUCT UPDATE",
    },
  },
  {
    name: "cjk",
    value: {
      title: "让每段视频都拥有清晰字幕与令人难忘的精彩视觉表达",
      subtitle: "共享可靠编辑能力，让创意在每种屏幕上自然呈现并保持清晰易读",
      kicker: "创作新体验",
    },
  },
  {
    name: "explicit-lines",
    value: {
      title: "MADE BY\nDojoClip.com",
      subtitle: "Clear captions.\nPrecise motion.",
      kicker: "YOUR\nSTORY",
    },
  },
];
const from = 360,
  duration = 120,
  frame = 390;
const epsilon = 1e-6;
const normalized = (value: string) => value.replace(/\s/gu, "");
const positive = (rect: Rect) =>
  [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
  rect.width > 0 &&
  rect.height > 0;
const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - epsilon &&
  inner.y >= outer.y - epsilon &&
  inner.x + inner.width <= outer.x + outer.width + epsilon &&
  inner.y + inner.height <= outer.y + outer.height + epsilon;
const flatten = (boxes: LayoutBox[]): LayoutBox[] =>
  boxes.flatMap((box) => [box, ...flatten(box.children)]);
type Group = ReturnType<typeof compileDisplayList>["groups"][number];
const groups = (input: Group[]): Group[] =>
  input.flatMap((group) => [group, ...groups(group.children)]);

function scene(
  size: Size,
  copy: Copy,
  activeSlots: Slot[],
  look?: (typeof looks)[number],
): Scene {
  const text = Object.fromEntries(
    activeSlots.map((slot) => [slot, copy[slot]]),
  );
  let nodes: unknown[];
  if (look) {
    const expanded = expandMacroNodes(
      [
        {
          macro: "titleCard",
          id: "matrix-card",
          ...text,
          palette: "berry",
          look,
          tempo: "energetic",
          from,
          duration,
        },
      ],
      { ...size, fps: 30, duration: 480 },
    );
    if (!expanded.ok) throw new Error(expanded.errors.join("; "));
    nodes = expanded.nodes;
  } else
    nodes = [
      textOverlay({
        template: "titleCard",
        id: "matrix-card",
        title: copy.title,
        ...text,
        composition: size,
        from,
        duration,
        enter: false,
      }),
    ];
  return parseScene({
    schemaVersion: 1,
    ...size,
    fps: 30,
    duration: 480,
    assets: {},
    nodes,
  });
}

function textNodes(nodes: SceneNode[]): SceneNode[] {
  return nodes.flatMap((node) => [
    ...(node.type === "text" ? [node] : []),
    ...textNodes(node.children ?? []),
  ]);
}

/** Real canvas metrics must be shared with paint; this is layout/display-list proof, not a pixel oracle. */
export function verifyTitleCardLayoutMatrix(
  measureTextLine: MeasureTextLine,
): TitleCardLayoutCheck[] {
  const checks: TitleCardLayoutCheck[] = [];
  const verify = (
    size: Size,
    copy: Copy,
    activeSlots: Slot[],
    name: string,
    look?: (typeof looks)[number],
  ) => {
    const label = `titleCard layout ${size.width}x${size.height} ${look ?? "direct"} ${name} ${activeSlots.join("+")}`;
    try {
      const source = scene(size, copy, activeSlots, look);
      const root = source.nodes[0];
      if (!root) throw new Error("Missing editable root");
      const issues: string[] = [];
      if (
        root.id !== "matrix-card" ||
        root.type !== "div" ||
        root.from !== from ||
        root.duration !== duration
      )
        issues.push("root identity/timing changed");
      if (
        JSON.stringify(source) !==
        JSON.stringify(scene(size, copy, activeSlots, look))
      )
        issues.push("nondeterministic expansion");
      const texts = textNodes(source.nodes);
      if (texts.length !== activeSlots.length)
        issues.push(
          `expected ${activeSlots.length} editable text slots, got ${texts.length}`,
        );
      const layout = layoutScene(evaluateScene(source, frame), {
        measureTextLine,
      });
      const panel = layout.boxes[0];
      if (!panel) throw new Error("Missing settled layout panel");
      const usable = getLayoutContentRect(panel);
      if (
        !positive(panel) ||
        !positive(usable) ||
        !contains({ x: 0, y: 0, ...size }, panel)
      )
        issues.push("panel or usable content is zero/invalid/outside canvas");
      const boxes = new Map(flatten(layout.boxes).map((box) => [box.id, box]));
      const display = compileDisplayList(layout, { measureTextLine });
      const operations = new Map(
        groups(display.groups).map((group) => [group.nodeId, group.content]),
      );
      const summary: string[] = [];
      for (const slot of activeSlots) {
        const id = `matrix-card-${slot}`;
        const node = texts.find((item) => item.id === id);
        const box = boxes.get(id),
          operation = operations.get(id);
        if (
          !node ||
          node.text !== copy[slot] ||
          !box ||
          operation?.kind !== "text"
        ) {
          issues.push(`${slot}: missing/changed editable text`);
          continue;
        }
        const content = getLayoutContentRect(box);
        if (!positive(box) || !positive(content) || !contains(usable, box))
          issues.push(`${slot}: unusable box or outside panel content`);
        if (
          !Number.isFinite(operation.font.size) ||
          operation.font.size < (slot === "title" ? 14 : 12)
        )
          issues.push(`${slot}: unreadable fitted font ${operation.font.size}`);
        if (
          !operation.lines.length ||
          normalized(operation.lines.map((line) => line.text).join("")) !==
            normalized(copy[slot])
        )
          issues.push(`${slot}: incomplete/truncated rendered copy`);
        for (const line of operation.lines) {
          const band = {
            x: content.x,
            y: line.y - operation.lineHeight / 2,
            width: line.metrics.width,
            height: operation.lineHeight,
          };
          if (
            !positive(band) ||
            line.metrics.width > content.width + epsilon ||
            !contains(content, band)
          )
            issues.push(`${slot}: line exceeds usable content`);
        }
        summary.push(
          `${slot} ${operation.font.size.toFixed(1)}px ${operation.lines.length} lines ${content.width.toFixed(1)}x${content.height.toFixed(1)}`,
        );
      }
      checks.push({
        label,
        pass: issues.length === 0,
        detail: issues.length ? issues.join("; ") : summary.join("; "),
      });
    } catch (cause) {
      checks.push({
        label,
        pass: false,
        detail:
          cause instanceof Error ? cause.message : "Layout verification failed",
      });
    }
  };
  for (const size of sizes) {
    for (const copy of copies)
      for (const activeSlots of slots) {
        for (const look of looks)
          verify(size, copy.value, activeSlots, copy.name, look);
        verify(size, copy.value, activeSlots, copy.name);
      }
    for (const look of [...looks, undefined]) {
      const label = `titleCard blank optional slots ${size.width}x${size.height} ${look ?? "direct"}`;
      try {
        const copy = copies[0]!.value;
        const baseline = scene(size, copy, ["title"], look);
        const blank = scene(
          size,
          { ...copy, subtitle: " \t ", kicker: " \n " },
          ["kicker", "title", "subtitle"],
          look,
        );
        checks.push({
          label,
          pass: JSON.stringify(baseline) === JSON.stringify(blank),
          detail: "Whitespace optional text must compile like absent slots.",
        });
      } catch (cause) {
        checks.push({
          label,
          pass: false,
          detail:
            cause instanceof Error
              ? cause.message
              : "Blank-slot verification failed",
        });
      }
    }
  }
  return checks;
}
