/**
 * LETTER / FORM — native editable typography as the moving image.
 * Font size, tracking and per-letter transforms are ordinary Scene keyframes.
 * The system fonts have fixed outlines: this is not a variable-font demo.
 */
import { timeline, fadeUp } from "../../packages/presets/dist/index.js";

const W = 1280,
  H = 720,
  FPS = 30,
  CHAPTER = 120;
const C = {
  blue: "#234BFA",
  paper: "#F4EFE4",
  ink: "#171B28",
  wine: "#5B1836",
  acid: "#DCFF76",
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
const rect = (id, x, y, width, height, color, extra = {}) => ({
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
    height: size * 1.35,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: size,
    fontWeight: 700,
    color,
    lineHeight: 1,
    textAlign: "center",
    letterSpacing: -size * 0.035,
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
const label = (id, value, x, y, width, color, align = "left") =>
  text(id, value, x, y, width, 13, color, {
    height: 24,
    letterSpacing: 2.5,
    fontWeight: 700,
    textAlign: align,
  });
function frame(id, number, color) {
  return [
    label(`${id}-wordmark`, "LETTER / FORM", 48, 32, 500, color),
    label(`${id}-number`, `${number} / 03`, 1060, 32, 172, color, "right"),
    rect(`${id}-top-rule`, 48, 75, 1184, 1, color, { opacity: 0.22 }),
    rect(`${id}-bottom-rule`, 48, 646, 1184, 1, color, { opacity: 0.22 }),
    label(
      `${id}-bottom-label`,
      "DOJO / TYPOGRAPHIC STUDIES",
      48,
      668,
      700,
      color,
    ),
    label(
      `${id}-bottom-mark`,
      "TYPE HAS A PULSE",
      870,
      668,
      362,
      color,
      "right",
    ),
  ];
}
const chapter = (id, from, color, children) => ({
  ...group(id, [rect(`${id}-background`, 0, 0, W, H, color), ...children], {
    from,
    duration: CHAPTER,
  }),
  style: { position: "absolute", inset: 0, overflow: "hidden" },
});

const letterIds = [..."LETTER"].map((_, i) => `elastic-letter-${i}`);
const elasticMotion = timeline()
  .stagger(
    letterIds,
    [
      track("opacity", [
        [0, 0],
        [8, 1],
      ]),
      track("fontSize", [
        [0, 146],
        [19, 232, "easeOut"],
        [40, 208, "easeInOut"],
        [70, 216, "easeInOut"],
      ]),
      track("transform", [
        [0, "translate(0px, 80px) scale(0.45, 1.4)"],
        [
          22,
          "translate(0px, -8px) scale(1.12, 0.92)",
          "cubic-bezier(0.18, 0.8, 0.2, 1)",
        ],
        [42, "translate(0px, 0px) scale(1, 1)", "easeInOut"],
        [70, "translate(0px, -8px) scale(0.95, 1.04)", "easeInOut"],
      ]),
    ],
    { at: 8, every: 6 },
  )
  .compile();
const elastic = chapter("type-elastic", 0, C.blue, [
  ...frame("elastic", 1, C.paper),
  label(
    "elastic-intro",
    "01 — STRETCH THE POSSIBILITIES",
    48,
    122,
    1000,
    C.acid,
  ),
  ...Array.from({ length: 7 }, (_, i) =>
    rect(`elastic-grid-${i}`, 76 + i * 188, 208, 1, 320, C.paper, {
      opacity: 0.14,
    }),
  ),
  rect("elastic-baseline", 76, 518, 1128, 2, C.acid, { opacity: 0.8 }),
  ...[..."LETTER"].map((char, i) => ({
    ...text(
      `elastic-echo-${i}`,
      char,
      76 + i * 188,
      222,
      188,
      216,
      "transparent",
      {
        height: 290,
        fontWeight: 900,
        letterSpacing: -8,
        textStroke: "1px rgba(244,239,228,0.24)",
      },
    ),
  })),
  ...[..."LETTER"].map((char, i) => ({
    ...text(letterIds[i], char, 76 + i * 188, 222, 188, 216, C.paper, {
      height: 290,
      fontWeight: 900,
      letterSpacing: -8,
      transformOrigin: "center bottom",
    }),
    animations: elasticMotion[letterIds[i]],
  })),
  ...Array.from({ length: 6 }, (_, i) =>
    rect(`elastic-tick-${i}`, 165 + i * 188, 526, 10, 3, C.acid),
  ),
  text(
    "elastic-caption",
    "A little tension. A lot of character.",
    120,
    568,
    1040,
    24,
    C.paper,
    { letterSpacing: 0, fontWeight: 400 },
  ),
]);

const trackingWord = text("tracking-word", "FORM", 48, 248, 1184, 224, C.wine, {
  height: 244,
  fontWeight: 900,
  letterSpacing: 0,
});
trackingWord.animations = [
  track("letterSpacing", [
    [0, -14],
    [38, 58, "easeInOut"],
    [70, 6, "easeInOut"],
    [103, 32, "easeInOut"],
    [119, 32],
  ]),
  track("fontSize", [
    [0, 178],
    [38, 220, "easeOut"],
    [70, 236, "easeInOut"],
    [103, 218, "easeInOut"],
    [119, 218],
  ]),
];
const tracking = chapter("type-tracking", 120, C.paper, [
  ...frame("tracking", 2, C.ink),
  label(
    "tracking-intro",
    "02 — GIVE IDEAS ROOM TO BREATHE",
    48,
    122,
    1000,
    C.wine,
  ),
  text("tracking-echo-top", "FORM", 48, 139, 1184, 175, "transparent", {
    height: 190,
    fontWeight: 900,
    letterSpacing: 28,
    textStroke: "1px rgba(91,24,54,0.2)",
  }),
  text("tracking-echo-bottom", "FORM", 48, 401, 1184, 175, "transparent", {
    height: 190,
    fontWeight: 900,
    letterSpacing: 28,
    textStroke: "1px rgba(91,24,54,0.2)",
  }),
  rect("tracking-center-line", 48, 367, 1184, 1, C.wine, { opacity: 0.14 }),
  trackingWord,
  ...[48, 1218].map((x, i) =>
    rect(`tracking-bracket-${i}`, x, 282, 14, 178, C.wine),
  ),
  rect("tracking-accent", 603, 577, 74, 4, C.blue),
  text(
    "tracking-caption",
    "Space changes everything.",
    120,
    596,
    1040,
    20,
    C.ink,
    { height: 28, fontWeight: 400, letterSpacing: 0 },
  ),
]);

const expressionTitle = text(
  "expression-title",
  "Say it",
  70,
  142,
  1140,
  108,
  C.paper,
  {
    fontFamily: "Georgia, Times New Roman, serif",
    fontStyle: "italic",
    fontWeight: 400,
    height: 140,
    letterSpacing: -4,
  },
);
const expressionMain = text(
  "expression-main",
  "with feeling.",
  62,
  300,
  1156,
  132,
  C.paper,
  {
    fontWeight: 900,
    height: 185,
    letterSpacing: -7,
    transformOrigin: "center center",
  },
);
expressionTitle.animations = [
  track("fontSize", [
    [0, 72],
    [28, 112, "easeOut"],
    [100, 112],
  ]),
  track("opacity", [
    [0, 0],
    [16, 1],
  ]),
];
expressionMain.animations = [
  track("letterSpacing", [
    [0, 15],
    [35, -7, "easeOut"],
    [80, -3, "easeInOut"],
    [119, -3],
  ]),
  track("transform", [
    [0, "translate(0px, 55px) scale(0.9, 0.8)"],
    [35, "translate(0px, 0px) scale(1, 1)", "cubic-bezier(0.2, 0.8, 0.2, 1)"],
    [80, "translate(0px, 0px) scale(1.015, 1.03)", "easeInOut"],
    [119, "translate(0px, 0px) scale(1.015, 1.03)"],
  ]),
  track("opacity", [
    [0, 0],
    [12, 0],
    [28, 1],
  ]),
];
const expressionCaption = text(
  "expression-caption",
  "STRETCH.  SPACE.  EXPRESS.",
  140,
  564,
  1000,
  18,
  C.acid,
  { letterSpacing: 3, fontWeight: 700, height: 30 },
);
expressionCaption.animations = timeline()
  .add("expression-caption", fadeUp({ durationInFrames: 24 }), { at: 54 })
  .compile()["expression-caption"];
const expression = chapter("type-expression", 240, C.wine, [
  ...frame("expression", 3, C.paper),
  ...Array.from({ length: 5 }, (_, i) =>
    rect(`expression-grid-${i}`, 160 + i * 240, 116, 1, 495, C.paper, {
      opacity: 0.06,
    }),
  ),
  expressionTitle,
  expressionMain,
  {
    ...rect("expression-underline", 124, 502, 1032, 5, C.acid, {
      transformOrigin: "left center",
    }),
    animations: [
      track("transform", [
        [0, "scale(0.001, 1)"],
        [45, "scale(0.001, 1)"],
        [72, "scale(1, 1)", "easeOut"],
      ]),
    ],
  },
  expressionCaption,
]);

export const scene = {
  schemaVersion: 1,
  width: W,
  height: H,
  fps: FPS,
  duration: 360,
  assets: {},
  nodes: [elastic, tracking, expression],
};
export const metadata = {
  title: "Letter / Form",
  description:
    "Elastic letters, animated tracking and mixed-type expression using editable native text.",
  posterFrame: 61,
  frames: [0, 30, 61, 95, 145, 178, 215, 275, 310, 350, 359],
  typography:
    "System-font outlines; native fontSize, letterSpacing and transform animation. No variable-font axes.",
};
export default scene;
