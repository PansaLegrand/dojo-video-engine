import { z } from "zod/v3";
import { styleSchema } from "@dojo-video-engine/schema";
import type {
  SceneAnimation,
  SceneNode,
  SceneStyle,
} from "@dojo-video-engine/schema";
import type { MacroDefinition } from "./macros.js";

const copy = (max: number) => z.string().trim().min(1).max(max);
const singleLine = (max: number) =>
  copy(max).regex(/^[^\r\n\u2028\u2029]*$/, "Use one line for this field.");
const params = z
  .object({
    id: copy(120).optional(),
    windowTitle: singleLine(80),
    badge: singleLine(24).optional(),
    steps: z
      .array(
        z.object({
          label: singleLine(80),
          detail: copy(160)
            .refine(
              (s) => s.split(/\r\n|[\r\n\u2028\u2029]/u).length <= 2,
              "Use at most two lines of detail.",
            )
            .optional(),
          status: z.enum(["idle", "active", "done"]).optional(),
        }),
      )
      .min(1)
      .max(6),
    activeStepIndex: z.number().int().nonnegative().optional(),
    cursorTargetStep: z.number().int().nonnegative().optional(),
    fontFamily: styleSchema.shape.fontFamily,
    palette: z.enum(["midnight", "paper"]).default("midnight"),
    left: z.number().finite().optional(),
    top: z.number().finite().optional(),
    width: z.number().positive().finite().optional(),
    height: z.number().positive().finite().optional(),
    from: z.number().int().nonnegative().default(0),
    duration: z.number().int().positive().optional(),
  })
  .strip();

const themes = {
  midnight: {
    window: "#1d263b",
    chrome: "#28324a",
    heading: "#eef2fc",
    idle: "#313c54",
    ink: "#f3f3fe",
    muted: "#bec9de",
    active: "#c5ef95",
    onActive: "#192c26",
    done: "#29423e",
    onDone: "#cff0da",
    cursor: "#ff9771",
  },
  paper: {
    window: "#f7efdf",
    chrome: "#e6dac8",
    heading: "#322d3c",
    idle: "#ede4d5",
    ink: "#322d3c",
    muted: "#584e5c",
    active: "#704a80",
    onActive: "#fff3ec",
    done: "#e0e7d8",
    onDone: "#344e43",
    cursor: "#ffb154",
  },
} as const;
type Frames = Extract<SceneAnimation, { kind: "keyframes" }>["frames"];
const keys = (
  property: SceneAnimation["property"],
  frames: Frames,
): SceneAnimation => ({ kind: "keyframes", property, frames });
const box = (
  left: number,
  top: number,
  width: number,
  height: number,
): SceneStyle => ({ position: "absolute", left, top, width, height });

// Replace coincident keys so even a one-frame beat has a defined pose.
function add(frames: Frames, key: Frames[number]) {
  if (frames.at(-1)?.frame === key.frame) frames.pop();
  frames.push(key);
}

type Status = "active" | "idle" | "done";
type State = { frame: number; status: Status };

function paint(
  states: State[],
  property: SceneAnimation["property"],
  values: Record<Status, string | number>,
): SceneAnimation[] {
  const frames: Frames = [];
  let previous: string | number | undefined;
  for (const state of states) {
    const value = values[state.status];
    if (value === previous) continue;
    if (previous !== undefined)
      add(frames, { frame: state.frame - 1, value: previous });
    add(frames, { frame: state.frame, value });
    previous = value;
  }
  return frames.length > 1 ? [keys(property, frames)] : [];
}

export const uiWalkthroughCardMacro: MacroDefinition<z.infer<typeof params>> = {
  name: "uiWalkthroughCard",
  description:
    "Editable app window with 1–6 labeled steps, optional details, badge, moving cursor and click focus. By default advance through unfinished steps in order and hold the last. activeStepIndex or one active status pins the selection. cursorTargetStep aims the pointer independently. Indices are zero-based.",
  usage:
    '{"macro":"uiWalkthroughCard","windowTitle":"Review flow","steps":[{"label":"Capture"},{"label":"Organize"},{"label":"Share"}],"duration":144}',
  params,
  expand(p, runtime) {
    const { width: canvasW, height: canvasH, fps } = runtime.ctx,
      n = p.steps.length;
    const duration = p.duration ?? runtime.ctx.duration - p.from;
    const marked = p.steps.flatMap((s, i) =>
      s.status === "active" ? [i] : [],
    );
    for (const target of [p.activeStepIndex, p.cursorTargetStep])
      if (target !== undefined && target >= n)
        throw Error("Step indices must refer to an existing zero-based step.");
    if (
      marked.length > 1 ||
      (marked.length &&
        p.activeStepIndex !== undefined &&
        marked[0] !== p.activeStepIndex)
    )
      throw Error(
        "Choose one active step and keep its index and status consistent.",
      );
    const pinned = p.activeStepIndex ?? marked[0];
    if (pinned !== undefined && p.steps[pinned]!.status === "done")
      throw Error("A completed step cannot also be the active step.");
    const sequence =
      pinned === undefined
        ? p.steps.flatMap((s, i) => (s.status === "done" ? [] : [i]))
        : [pinned];
    if (duration < Math.max(1, sequence.length))
      throw Error(
        "Extend the walkthrough duration so each active step has a frame.",
      );
    const beats = sequence.map((index, i) => ({
      index,
      frame: Math.floor((i * duration) / sequence.length),
    }));
    const theme = themes[p.palette];
    const w = p.width ?? canvasW * 0.86,
      h = p.height ?? Math.min(canvasH * 0.84, w * (0.26 + 0.26 * n));
    const u = Math.min(w / 550, h / (64 + n * 80));
    const floor = Math.max(8, Math.min(16, Math.min(canvasW, canvasH) / 18));
    if (26 * u < floor || w < floor * 10)
      throw Error("Enlarge the walkthrough window or use fewer steps.");
    const pad = 18 * u,
      head = 55 * u,
      gap = 9 * u,
      rowH = (h - head - 2 * pad - gap * (n - 1)) / n,
      rowW = w - 2 * pad;
    const rowTop = (i: number) => head + pad + i * (rowH + gap);
    const id = runtime.uniqueId(p.id ?? "walkthrough");
    const panel = (key: string, style: SceneStyle): SceneNode => ({
      id: id + "-" + key,
      type: "div",
      style,
    });
    const text = (
      key: string,
      value: string,
      style: SceneStyle,
      size: number,
      lines = 1,
    ): SceneNode => ({
      id: id + "-" + key,
      type: "text",
      text: value,
      style: {
        fontWeight: 600,
        color: theme.ink,
        textFit: "shrink",
        minFontSize: floor,
        maxLines: lines,
        lineHeight: 1.12,
        ...style,
        fontFamily: p.fontFamily ?? style.fontFamily ?? "Space Grotesk",
        fontSize: Math.max(floor, size),
      },
    });
    const badgeW = p.badge
      ? Math.min(
          w * 0.36,
          Math.max(88 * u, Array.from(p.badge).length * floor * 0.72 + 26 * u),
        )
      : 0;
    const titleX = 76 * u;
    const children: SceneNode[] = [
      panel("chrome", { ...box(0, 0, w, head), backgroundColor: theme.chrome }),
    ];
    for (let i = 0; i < 3; i++)
      children.push(
        panel("dot-" + i, {
          ...box(pad + i * 13 * u, (head - 7 * u) / 2, 7 * u, 7 * u),
          backgroundColor: theme.heading,
          opacity: 0.35 + i * 0.17,
          borderRadius: 9 * u,
        }),
      );
    children.push(
      text(
        "window-title",
        p.windowTitle,
        {
          ...box(
            titleX,
            0,
            w - titleX - pad - badgeW - (badgeW ? pad : 0),
            head,
          ),
          color: theme.heading,
        },
        22 * u,
      ),
    );
    if (p.badge)
      children.push({
        ...panel("badge", {
          ...box(w - pad - badgeW, head * 0.18, badgeW, head * 0.64),
          border: `1px solid ${theme.muted}`,
          borderRadius: head / 2,
        }),
        children: [
          text(
            "badge-text",
            p.badge,
            {
              ...box(7 * u, 0, badgeW - 14 * u, head * 0.64),
              color: theme.heading,
              textAlign: "center",
              fontFamily: "IBM Plex Mono",
            },
            16 * u,
          ),
        ],
      });

    for (const [i, step] of p.steps.entries()) {
      const prefix = "step-" + (i + 1);
      const states: State[] = (
        beats.length ? beats : [{ index: -1, frame: 0 }]
      ).map((b) => ({
        frame: b.frame,
        status:
          b.index === i
            ? "active"
            : step.status === "done" ||
                (i < b.index &&
                  (pinned === undefined || step.status !== "idle"))
              ? "done"
              : "idle",
      }));
      const bg = { active: theme.active, done: theme.done, idle: theme.idle },
        fg = { active: theme.onActive, done: theme.onDone, idle: theme.ink };
      const secondary = { ...fg, idle: theme.muted };
      const first = states[0]!.status;
      const left = 68 * u,
        actionX = rowW - 38 * u,
        textW = actionX - left - 28 * u;
      // Dense windows can use two columns, preserving two lines of detail without reducing type.
      const columns = !!step.detail && rowH < 4 * floor && textW > 24 * floor;
      const labelW = columns ? textW * 0.41 : textW;
      const detailX = columns ? left + labelW + gap : left;
      const stacked = !!step.detail && !columns;
      const main = text(
        prefix + "-label",
        step.label,
        {
          ...box(
            left,
            stacked ? rowH * 0.12 : 0,
            labelW,
            stacked ? rowH * 0.37 : rowH,
          ),
          color: fg[first],
        },
        30 * u,
      );
      main.animations = paint(states, "color", fg);
      const number = text(
        prefix + "-number",
        String(i + 1).padStart(2, "0"),
        {
          ...box(13 * u, 0, 42 * u, rowH),
          fontFamily: "IBM Plex Mono",
          color: secondary[first],
          textAlign: "center",
        },
        17 * u,
      );
      number.animations = paint(states, "color", secondary);
      const row: SceneNode = {
        ...panel(prefix, {
          ...box(pad, rowTop(i), rowW, rowH),
          borderRadius: 10 * u,
          backgroundColor: bg[first],
        }),
        animations: paint(states, "backgroundColor", bg),
        children: [number, main],
      };
      if (step.detail) {
        const detail = text(
          prefix + "-detail",
          step.detail,
          {
            ...box(
              detailX,
              stacked ? rowH * 0.49 : 0,
              textW - (detailX - left),
              stacked ? rowH * 0.46 : rowH,
            ),
            fontFamily: "Inter",
            fontWeight: 400,
            color: secondary[first],
          },
          18 * u,
          2,
        );
        detail.animations = paint(states, "color", secondary);
        row.children!.push(detail);
      }
      const size = 24 * u;
      row.children!.push({
        ...panel(prefix + "-socket", {
          ...box(actionX - size / 2, (rowH - size) / 2, size, size),
          borderRadius: size,
          backgroundColor: fg[first],
        }),
        animations: paint(states, "backgroundColor", fg),
      });
      row.children!.push({
        id: id + "-" + prefix + "-check",
        type: "shape",
        shape: {
          kind: "polyline",
          points: [
            { x: 0, y: 0.5 },
            { x: 0.35, y: 0.86 },
            { x: 1, y: 0.12 },
          ],
        },
        style: {
          ...box(
            actionX - size * 0.29,
            rowH / 2 - size * 0.28,
            size * 0.58,
            size * 0.56,
          ),
          stroke: theme.done,
          strokeWidth: 2.5 * u,
          fill: "transparent",
          opacity: first === "done" ? 1 : 0,
        },
        animations: paint(states, "opacity", { done: 1, active: 0, idle: 0 }),
      });
      children.push(row);
    }

    const targets =
      p.cursorTargetStep !== undefined
        ? [{ index: p.cursorTargetStep, frame: 0 }]
        : beats;
    if (targets.length) {
      const x = w - pad - 38 * u,
        size = 28 * u,
        ys: Frames = [],
        xs: Frames = [],
        ripples: Frames = [];
      let priorY = rowTop(targets[0]!.index) + rowH / 2 + 18 * u,
        priorX = x + 22 * u;
      for (const [j, t] of targets.entries()) {
        const next = targets[j + 1]?.frame ?? duration;
        const arrival =
          j === 0
            ? Math.min(Math.round(fps * 0.36), Math.floor((next - 1) / 3))
            : t.frame;
        const previous = targets[j - 1]?.frame ?? 0;
        const start =
          j === 0
            ? 0
            : arrival -
              Math.min(
                Math.round(fps * 0.32),
                Math.floor((arrival - previous) / 2),
              );
        const y = rowTop(t.index) + rowH / 2;
        add(ys, { frame: start, value: priorY });
        add(xs, { frame: start, value: priorX });
        add(ys, { frame: arrival, value: y, easing: "easeInOut" });
        add(xs, { frame: arrival, value: x, easing: "easeInOut" });
        priorY = y;
        priorX = x;
        if (arrival > 0) add(ripples, { frame: arrival - 1, value: 0 });
        add(ripples, { frame: arrival, value: 1 });
        const fade = Math.min(
          next - 1,
          arrival + Math.max(1, Math.round(fps * 0.35)),
        );
        if (fade > arrival)
          add(ripples, { frame: fade, value: 0, easing: "easeOut" });
      }
      children.push({
        ...panel("focus", {
          ...box(x - size * 0.65, priorY - size * 0.65, size * 1.3, size * 1.3),
          border: `${Math.max(1, 2 * u)}px solid ${theme.cursor}`,
          borderRadius: size,
          opacity: 0,
        }),
        animations: [
          keys(
            "top",
            ys.map((f) => ({ ...f, value: Number(f.value) - size * 0.65 })),
          ),
          keys(
            "left",
            xs.map((f) => ({ ...f, value: Number(f.value) - size * 0.65 })),
          ),
          keys("opacity", ripples),
        ],
      });
      children.push({
        id: id + "-cursor",
        type: "shape",
        shape: {
          kind: "path",
          viewBox: { x: 0, y: 0, width: 24, height: 30 },
          d: "M1 1 L22 15 L13 16 L17 26 L12 29 L8 18 L2 24 Z",
        },
        style: {
          ...box(x, priorY, size, size * 1.25),
          fill: theme.cursor,
          stroke: theme.window,
          strokeWidth: 1.5 * u,
        },
        animations: [keys("left", xs), keys("top", ys)],
      });
    }
    return {
      id,
      type: "div",
      from: p.from,
      duration,
      style: {
        ...box(p.left ?? (canvasW - w) / 2, p.top ?? (canvasH - h) / 2, w, h),
        borderRadius: 15 * u,
        overflow: "hidden",
        backgroundColor: theme.window,
        zIndex: 40,
      },
      children,
    };
  },
};
