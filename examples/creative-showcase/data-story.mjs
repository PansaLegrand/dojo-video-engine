/** FIELD NOTES — an original editorial data story, using illustrative data. */
import { timeline, fadeUp } from "../../packages/presets/dist/index.js";

const W = 1280,
  H = 720,
  FPS = 30,
  CHAPTER = 120;
const C = {
  paper: "#F3EEDC",
  forest: "#163E35",
  orange: "#ED7859",
  lime: "#D6E787",
  muted: "#A5B6A0",
};
const track = (property, values) => ({
  kind: "keyframes",
  property,
  frames: values.map(([frame, value, easing]) => ({
    frame,
    value,
    ...(easing ? { easing } : {}),
  })),
});
const box = (id, x, y, width, height, color, extra = {}) => ({
  id,
  type: "div",
  style: {
    position: "absolute",
    left: x,
    top: y,
    width,
    height,
    backgroundColor: color,
    ...extra,
  },
});
const text = (id, value, x, y, width, size, color, extra = {}) => ({
  id,
  type: "text",
  text: value,
  style: {
    position: "absolute",
    left: x,
    top: y,
    width,
    height: size * 1.3,
    color,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: size,
    fontWeight: 700,
    lineHeight: 1.05,
    letterSpacing: -size * 0.04,
    ...extra,
  },
});
const group = (id, children, extra = {}) => ({
  id,
  type: "div",
  style: { position: "absolute", inset: 0 },
  children,
  ...extra,
});
const path = (id, d, color, width, extra = {}) => ({
  id,
  type: "shape",
  shape: { kind: "path", d, viewBox: { x: 0, y: 0, width: W, height: H } },
  style: {
    position: "absolute",
    inset: 0,
    fill: "transparent",
    stroke: color,
    strokeWidth: width,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    ...extra,
  },
});
const reveal = (id, node, at, duration = 24) => {
  node.animations = timeline()
    .add(id, fadeUp({ durationInFrames: duration }), { at })
    .compile()[id];
  return node;
};
function frame(number, bg, fg) {
  const prefix = `data-${number}`;
  return [
    box(`${prefix}-paper`, 0, 0, W, H, bg),
    text(`${prefix}-masthead`, "FIELD NOTES", 64, 36, 480, 22, fg, {
      letterSpacing: 3.5,
    }),
    text(`${prefix}-edition`, "ANNUAL REVIEW / 2026", 820, 41, 396, 13, fg, {
      letterSpacing: 2.6,
      textAlign: "right",
    }),
    box(`${prefix}-header-rule`, 64, 84, 1152, 1, fg, { opacity: 0.25 }),
    box(`${prefix}-footer-rule`, 64, 644, 1152, 1, fg, { opacity: 0.25 }),
    text(
      `${prefix}-disclaimer`,
      "ILLUSTRATIVE DATA · DESIGN EXAMPLE",
      64,
      670,
      720,
      12,
      fg,
      { letterSpacing: 2, fontWeight: 400 },
    ),
    text(`${prefix}-folio`, `0${number} / 03`, 1050, 670, 166, 12, fg, {
      letterSpacing: 2,
      textAlign: "right",
    }),
  ];
}
// Fixed, supplied values. The monthly total is exactly 128.
const monthly = [4, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17];
const months = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const bars = monthly.map((n, i) => {
  const h = n * 16;
  return box(
    `monthly-bar-${i}`,
    85 + i * 94,
    552 - h,
    67,
    h,
    i > 8 ? C.orange : C.forest,
    {
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      transformOrigin: "center bottom",
    },
  );
});
const barMotion = timeline()
  .stagger(
    bars.map((n) => n.id),
    [
      track("transform", [
        [0, "scale(1, 0.001)"],
        [34, "scale(1, 1)", "cubic-bezier(0.2, 0.8, 0.2, 1)"],
      ]),
    ],
    { at: 12, every: 3 },
  )
  .compile();
bars.forEach((n) => {
  n.animations = barMotion[n.id];
});
const chapterOne = group(
  "data-chapter-1",
  [
    ...frame(1, C.paper, C.forest),
    reveal(
      "data-heading-1",
      text("data-heading-1", "A year in motion.", 64, 115, 850, 76, C.forest),
      0,
    ),
    reveal(
      "data-deck-1",
      text(
        "data-deck-1",
        "Small beginnings. Growing possibilities.",
        68,
        210,
        700,
        21,
        C.forest,
        { fontWeight: 400, letterSpacing: -0.2 },
      ),
      8,
    ),
    ...[4, 8, 12, 16].map((n) =>
      group(`data-grid-${n}`, [
        box(`data-grid-line-${n}`, 78, 552 - n * 16, 1135, 1, C.forest, {
          opacity: 0.12,
        }),
        text(
          `data-grid-value-${n}`,
          String(n),
          48,
          544 - n * 16,
          26,
          11,
          C.forest,
          { fontWeight: 400, textAlign: "right", letterSpacing: 0 },
        ),
      ]),
    ),
    ...bars,
    box("data-baseline-1", 78, 552, 1135, 2, C.forest),
    ...months.map((month, i) =>
      text(`data-month-${i}`, month, 80 + i * 94, 576, 80, 12, C.forest, {
        textAlign: "center",
        letterSpacing: 1.5,
      }),
    ),
    ...Array.from({ length: 17 }, (_, i) => ({
      ...text(`data-total-${i}`, String(i * 8), 930, 112, 286, 91, C.forest, {
        textAlign: "right",
        letterSpacing: -5,
      }),
      from: i * 3,
      duration: i === 16 ? CHAPTER - 48 : 3,
    })),
    text(
      "data-total-label",
      "IDEAS SET IN MOTION",
      910,
      214,
      302,
      12,
      C.forest,
      { textAlign: "right", letterSpacing: 1.7 },
    ),
  ],
  { from: 0, duration: CHAPTER },
);

const cells = Array.from({ length: 100 }, (_, i) =>
  box(
    `participation-dot-${i}`,
    72 + (i % 20) * 57.3,
    377 + Math.floor(i / 20) * 41,
    43,
    28,
    i < 84 ? C.lime : "#31564B",
    { borderRadius: 5, transformOrigin: "center center" },
  ),
);
const cellMotion = timeline()
  .stagger(
    cells.map((n) => n.id),
    [
      track("opacity", [
        [0, 0.08],
        [10, 1, "easeOut"],
      ]),
      track("transform", [
        [0, "scale(0.55)"],
        [10, "scale(1)", "easeOut"],
      ]),
    ],
    { at: 13, every: 0.5 },
  )
  .compile();
// timeline positions and all emitted Scene frames are integers.
cells.forEach((n) => {
  n.animations = cellMotion[n.id].map((a) => ({
    ...a,
    frames: a.frames.map((f) => ({ ...f, frame: Math.round(f.frame) })),
  }));
});
const chapterTwo = group(
  "data-chapter-2",
  [
    ...frame(2, C.forest, C.paper),
    text("data-section-2", "PARTICIPATION", 64, 120, 1152, 14, C.lime, {
      textAlign: "center",
      letterSpacing: 4,
    }),
    ...Array.from({ length: 22 }, (_, i) => ({
      ...text(`data-percent-${i}`, `${i * 4}%`, 200, 146, 880, 160, C.paper, {
        textAlign: "center",
        letterSpacing: -9,
      }),
      from: i * 2,
      duration: i === 21 ? CHAPTER - 42 : 2,
    })),
    reveal(
      "data-deck-2",
      text(
        "data-deck-2",
        "of the team found a shared rhythm.",
        160,
        323,
        960,
        24,
        C.paper,
        { textAlign: "center", fontWeight: 400, letterSpacing: -0.2 },
      ),
      10,
    ),
    ...cells,
    box("data-legend-key-2", 480, 605, 10, 10, C.lime, { borderRadius: 2 }),
    text("data-legend-2", "84 OF 100 PEOPLE", 505, 602, 440, 12, C.paper, {
      letterSpacing: 2,
      fontWeight: 400,
    }),
  ],
  { from: CHAPTER, duration: CHAPTER },
);

const flowPaths = [
  ["M174 386 C320 386 400 414 643 414", C.paper, 17],
  ["M174 420 C320 420 400 432 643 432", C.forest, 25],
  ["M174 454 C320 454 400 450 643 450", C.paper, 17],
  ["M174 488 C320 488 400 468 643 468", C.forest, 25],
  ["M174 522 C320 522 400 486 643 486", C.paper, 17],
  ["M643 432 C835 432 860 439 1110 439", C.forest, 30],
  ["M643 468 C835 468 860 463 1110 463", C.paper, 30],
].map(([d, color, width], i) => path(`data-river-${i}`, d, color, width));
const riverMotion = timeline()
  .stagger(
    flowPaths.map((n) => n.id),
    [
      track("opacity", [
        [0, 0],
        [18, 1, "easeOut"],
      ]),
    ],
    { at: 15, every: 5 },
  )
  .compile();
flowPaths.forEach((n) => {
  n.animations = riverMotion[n.id];
});
const chapterThree = group(
  "data-chapter-3",
  [
    ...frame(3, C.orange, C.forest),
    reveal(
      "data-heading-3",
      text(
        "data-heading-3",
        "Ideas become impact.",
        64,
        115,
        1152,
        76,
        C.forest,
      ),
      0,
    ),
    reveal(
      "data-deck-3",
      text(
        "data-deck-3",
        "Explore widely. Build carefully. Share what works.",
        68,
        213,
        1100,
        23,
        C.forest,
        { fontWeight: 400, letterSpacing: -0.3 },
      ),
      8,
    ),
    ...flowPaths,
    ...[
      [128, "IDEAS", "Explore", 64],
      [24, "PILOTS", "Build", 533],
      [12, "LAUNCHES", "Share", 1000],
    ].flatMap(([value, label, verb, x], i) => [
      reveal(
        `data-flow-count-${i}`,
        text(`data-flow-count-${i}`, String(value), x, 274, 220, 72, C.forest, {
          textAlign: "center",
        }),
        6 + i * 10,
      ),
      text(`data-flow-label-${i}`, label, x, 353, 220, 12, C.forest, {
        textAlign: "center",
        letterSpacing: 2.5,
      }),
      box(
        `data-flow-gate-${i}`,
        x + 97,
        [370, 398, 412][i],
        26,
        [170, 98, 70][i],
        C.forest,
        { borderRadius: 13 },
      ),
      text(`data-flow-verb-${i}`, verb, x, 566, 220, 26, C.forest, {
        textAlign: "center",
        letterSpacing: -0.5,
      }),
    ]),
  ],
  { from: CHAPTER * 2, duration: CHAPTER },
);

export const scene = {
  schemaVersion: 1,
  width: W,
  height: H,
  fps: FPS,
  duration: CHAPTER * 3,
  assets: {},
  nodes: [chapterOne, chapterTwo, chapterThree],
  markers: { momentum: 0, participation: 120, impact: 240 },
};
export const metadata = {
  title: "Field Notes",
  description:
    "An editorial annual review with growing bars, a participation mosaic and flowing ideas-to-impact diagram. All data is illustrative.",
  posterFrame: 80,
  frames: [0, 30, 80, 145, 200, 275, 330, 359],
};
export default scene;
