/** NIGHT LEAGUE — an original, fictional sports broadcast package. */
import { timeline, fadeUp } from "../../packages/presets/dist/index.js";

const W = 1280,
  H = 720,
  FPS = 30,
  CHAPTER = 120;
const C = {
  ink: "#081014",
  lime: "#D2FF35",
  blue: "#2457FF",
  white: "#F4F6EE",
  muted: "#9BAAB0",
};
const motion = (property, points) => ({
  kind: "keyframes",
  property,
  frames: points.map(([frame, value, easing]) => ({
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
const text = (id, copy, x, y, width, size, color, extra = {}) => ({
  id,
  type: "text",
  text: copy,
  style: {
    position: "absolute",
    left: x,
    top: y,
    width,
    height: size * 1.25,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontWeight: 900,
    fontSize: size,
    lineHeight: 1,
    letterSpacing: -size * 0.04,
    color,
    maxLines: 1,
    ...extra,
  },
});
const label = (id, copy, x, y, width, color, extra = {}) =>
  text(id, copy, x, y, width, 14, color, {
    letterSpacing: 2,
    fontWeight: 700,
    ...extra,
  });
const group = (id, children, style = {}, animations = []) => ({
  id,
  type: "div",
  style: { position: "absolute", inset: 0, ...style },
  children,
  animations,
});
const path = (
  id,
  d,
  fill,
  stroke = undefined,
  strokeWidth = 1,
  extra = {},
) => ({
  id,
  type: "shape",
  shape: { kind: "path", d, viewBox: { x: 0, y: 0, width: W, height: H } },
  style: {
    position: "absolute",
    inset: 0,
    fill,
    ...(stroke === undefined
      ? {}
      : {
          stroke,
          strokeWidth,
          strokeLineCap: "round",
          strokeLineJoin: "round",
        }),
    ...extra,
  },
});
const chapter = (id, from, children) => ({
  ...group(id, children, { overflow: "hidden" }),
  from,
  duration: CHAPTER,
});
function enter(node, at = 0, duration = 18) {
  node.animations = timeline()
    .add(node.id, fadeUp({ durationInFrames: duration, distance: 38 }), { at })
    .compile()[node.id];
  return node;
}
function frame(prefix, color, edition) {
  return [
    label(`${prefix}-brand`, "NIGHT / LEAGUE", 48, 32, 330, color),
    label(`${prefix}-edition`, edition, 840, 32, 392, color, {
      textAlign: "right",
    }),
    box(`${prefix}-header-rule`, 48, 65, 1184, 1, color, { opacity: 0.3 }),
    box(`${prefix}-footer-rule`, 48, 653, 1184, 1, color, { opacity: 0.3 }),
    label(
      `${prefix}-disclosure`,
      "FICTIONAL TEAMS / BROADCAST DESIGN STUDY",
      48,
      679,
      860,
      color,
      { fontSize: 10, letterSpacing: 1.8, height: 16 },
    ),
    label(`${prefix}-dojo`, "DOJO / SPORT", 980, 679, 252, color, {
      fontSize: 10,
      letterSpacing: 1.8,
      height: 16,
      textAlign: "right",
    }),
  ];
}
function speedField(prefix, color, opacity = 0.4) {
  return Array.from({ length: 22 }, (_, i) => {
    const y = 90 + ((i * 37) % 530),
      x = -300 + ((i * 173) % 1700);
    return {
      ...box(
        `${prefix}-speed-${i}`,
        x,
        y,
        72 + (i % 5) * 36,
        i % 4 === 0 ? 5 : 2,
        color,
        { opacity, transform: "rotate(-18deg)" },
      ),
      animations: [
        motion("transform", [
          [0, "translate(0px, 0px) rotate(-18deg)"],
          [119, `translate(${320 + (i % 4) * 70}px, -70px) rotate(-18deg)`],
        ]),
      ],
    };
  });
}
// A perspective pitch and elliptical seating rings give the opener depth without
// external footage. Floodlights, lines and typography have separate editable nodes.
const stadium = [];
for (let i = 0; i < 9; i++) {
  const spread = i * 18;
  stadium.push(
    path(
      `stadium-bowl-${i}`,
      `M ${215 - spread} 515 C ${20 - spread} 305 ${260 - spread} ${125 - spread * 0.35} 640 ${125 - spread * 0.35} C ${1020 + spread} ${125 - spread * 0.35} ${1260 + spread} 305 ${1065 + spread} 515 C ${925 + spread} ${640 + spread * 0.5} ${355 - spread} ${640 + spread * 0.5} ${215 - spread} 515 Z`,
      "transparent",
      i % 3 ? "#233545" : "#44626D",
      i % 3 ? 1 : 3,
    ),
  );
}
for (let i = 0; i < 52; i++) {
  const a = (i / 52) * Math.PI * 2;
  stadium.push(
    box(
      `stadium-light-${i}`,
      640 + Math.cos(a) * 477,
      345 + Math.sin(a) * 215,
      5,
      3,
      i % 3 === 0 ? C.lime : "#7E9CA9",
      { opacity: 0.8 },
    ),
  );
}
stadium.push(
  path("pitch-shadow", "M 365 280 L 915 280 L 1110 570 L 170 570 Z", "#03080C"),
  path(
    "pitch-base",
    "M 365 260 L 915 260 L 1110 550 L 170 550 Z",
    "#123C34",
    C.lime,
    2,
  ),
);
for (let i = 0; i < 8; i++) {
  const y1 = 260 + i * 36.25,
    y2 = y1 + 36.25;
  const edge = (y) => 365 - ((y - 260) * 195) / 290;
  const l1 = edge(y1),
    l2 = edge(y2),
    r1 = 1280 - l1,
    r2 = 1280 - l2;
  if (i % 2 === 0)
    stadium.push(
      path(
        `pitch-stripe-${i}`,
        `M ${l1} ${y1} L ${r1} ${y1} L ${r2} ${y2} L ${l2} ${y2} Z`,
        "#1A493C",
      ),
    );
}
stadium.push(
  path(
    "pitch-boundary",
    "M 378 273 L 902 273 L 1082 534 L 198 534 Z",
    "transparent",
    "#91C894",
    2,
  ),
  path(
    "pitch-center",
    "M 288 403 L 992 403 M 565 403 C 565 373 715 373 715 403 C 715 433 565 433 565 403 Z",
    "transparent",
    "#91C894",
    2,
  ),
  path(
    "pitch-boxes",
    "M 473 273 L 454 329 L 826 329 L 807 273 M 381 534 L 409 461 L 871 461 L 899 534",
    "transparent",
    "#91C894",
    2,
  ),
  path(
    "pitch-goals",
    "M 564 260 L 564 237 L 716 237 L 716 260 M 535 550 L 535 574 L 745 574 L 745 550",
    "transparent",
    C.white,
    3,
  ),
);
const opener = chapter("sports-stadium", 0, [
  {
    ...box("opener-backdrop", 0, 0, W, H, C.ink),
    style: {
      position: "absolute",
      inset: 0,
      background:
        "linear-gradient(135deg, #071316 0%, #111C30 65%, #172C58 100%)",
    },
  },
  group("stadium-world", stadium, {}, [
    motion("transform", [
      [0, "translate(0px, 40px) scale(0.88) rotate(-6deg)"],
      [119, "translate(0px, 0px) scale(1.1) rotate(0deg)"],
    ]),
  ]),
  {
    ...path(
      "left-light-beam",
      "M 118 130 L 830 620 L 230 625 Z",
      "linear-gradient(0deg, rgba(209,255,53,0) 0%, rgba(209,255,53,0.13) 100%)",
    ),
    animations: [
      motion("transform", [
        [0, "rotate(-8deg)"],
        [119, "rotate(12deg)"],
      ]),
    ],
  },
  {
    ...path(
      "right-light-beam",
      "M 1172 130 L 920 625 L 290 625 Z",
      "linear-gradient(0deg, rgba(36,87,255,0) 0%, rgba(73,119,255,0.24) 100%)",
    ),
    animations: [
      motion("transform", [
        [0, "rotate(8deg)"],
        [119, "rotate(-12deg)"],
      ]),
    ],
  },
  ...speedField("opener", C.lime, 0.14),
  enter(
    label("opener-kicker", "THE CITY COMES ALIVE", 200, 177, 880, C.lime, {
      textAlign: "center",
      letterSpacing: 5,
      fontSize: 16,
    }),
    0,
  ),
  enter(
    text("opener-headline", "MATCHDAY", 28, 245, 1224, 181, C.white, {
      textAlign: "center",
      letterSpacing: -10,
      textShadow: "0px 6px 14px rgba(0,0,0,0.6)",
    }),
    5,
    22,
  ),
  enter(
    group("opener-live-bug", [
      box("opener-bug-background", 478, 477, 324, 43, C.lime),
      box("opener-live-dot", 496, 494, 8, 8, C.ink, { borderRadius: 4 }),
      label("opener-time", "SAT / 20:00 / NIGHT LEAGUE", 519, 490, 280, C.ink, {
        fontSize: 12,
        letterSpacing: 1,
        height: 20,
      }),
    ]),
    12,
    20,
  ),
  ...frame("opener", C.white, "ROUND 05 / UNDER THE LIGHTS"),
]);

const matchup = chapter("sports-matchup", 120, [
  box("matchup-base", 0, 0, W, H, C.ink),
  {
    ...path("matchup-north-panel", "M 0 0 L 758 0 L 534 720 L 0 720 Z", C.lime),
    animations: [
      motion("transform", [
        [0, "translate(-950px, 0px)"],
        [17, "translate(0px, 0px)", "easeOut"],
      ]),
    ],
  },
  {
    ...path(
      "matchup-south-panel",
      "M 815 0 L 1280 0 L 1280 720 L 590 720 Z",
      C.blue,
    ),
    animations: [
      motion("transform", [
        [0, "translate(950px, 0px)"],
        [17, "translate(0px, 0px)", "easeOut"],
      ]),
    ],
  },
  group("matchup-north-speed", speedField("north", C.ink, 0.09)),
  group("matchup-south-speed", speedField("south", C.white, 0.07)),
  // Original vector crests, drawn on a compact normalized path viewBox.
  {
    id: "north-crest",
    type: "shape",
    shape: {
      kind: "path",
      d: "M 70 0 L 138 30 L 126 110 L 70 158 L 14 110 L 2 30 Z M 34 102 L 70 40 L 106 102 L 90 102 L 70 69 L 50 102 Z",
      viewBox: { x: 0, y: 0, width: 140, height: 160 },
      fillRule: "evenodd",
    },
    style: {
      position: "absolute",
      left: 215,
      top: 150,
      width: 140,
      height: 160,
      fill: C.ink,
    },
    animations: timeline()
      .add("north-crest", fadeUp({ durationInFrames: 23 }), { at: 12 })
      .compile()["north-crest"],
  },
  {
    id: "south-crest",
    type: "shape",
    shape: {
      kind: "path",
      d: "M 70 0 L 138 30 L 126 110 L 70 158 L 14 110 L 2 30 Z M 89 40 L 42 82 L 70 82 L 51 119 L 104 67 L 77 67 Z",
      viewBox: { x: 0, y: 0, width: 140, height: 160 },
      fillRule: "evenodd",
    },
    style: {
      position: "absolute",
      left: 921,
      top: 150,
      width: 140,
      height: 160,
      fill: C.white,
    },
    animations: timeline()
      .add("south-crest", fadeUp({ durationInFrames: 23 }), { at: 18 })
      .compile()["south-crest"],
  },
  enter(
    text("north-name", "NORTH", 58, 332, 510, 109, C.ink, {
      textAlign: "center",
      letterSpacing: -6,
    }),
    16,
  ),
  enter(
    text("south-name", "SOUTH", 714, 332, 510, 109, C.white, {
      textAlign: "center",
      letterSpacing: -6,
    }),
    22,
  ),
  enter(
    label("north-caption", "ATHLETIC CLUB", 90, 470, 450, C.ink, {
      textAlign: "center",
      letterSpacing: 4,
    }),
    22,
  ),
  enter(
    label("south-caption", "SPORTING CLUB", 740, 470, 450, C.white, {
      textAlign: "center",
      letterSpacing: 4,
    }),
    28,
  ),
  {
    ...box("versus-background", 572, 311, 136, 112, C.ink, {
      transform: "rotate(-9deg)",
    }),
    animations: [
      motion("transform", [
        [0, "scale(0.2) rotate(-9deg)"],
        [20, "scale(1) rotate(-9deg)", "easeOut"],
      ]),
    ],
  },
  enter(
    text("versus", "VS", 573, 327, 135, 57, C.white, {
      textAlign: "center",
      letterSpacing: -3,
    }),
    22,
  ),
  label("matchup-top-left", "NIGHT / LEAGUE", 48, 32, 340, C.ink),
  label("matchup-top-right", "ROUND 05 / THE FIXTURE", 800, 32, 432, C.white, {
    textAlign: "right",
  }),
  box("matchup-rule", 48, 65, 1184, 1, C.ink, { opacity: 0.28 }),
  box("matchup-tagline-backing", 340, 568, 600, 56, C.ink),
  label("matchup-tagline", "TWO SIDES. ONE NIGHT.", 70, 584, 1140, C.white, {
    fontSize: 18,
    letterSpacing: 4,
    textAlign: "center",
  }),
  box("matchup-footer-rule", 48, 653, 1184, 1, C.ink, { opacity: 0.3 }),
  label(
    "matchup-disclosure",
    "FICTIONAL TEAMS / BROADCAST DESIGN STUDY",
    48,
    679,
    850,
    C.ink,
    { fontSize: 10, letterSpacing: 1.8, height: 16 },
  ),
  label("matchup-dojo", "DOJO / SPORT", 980, 679, 252, C.white, {
    fontSize: 10,
    letterSpacing: 1.8,
    height: 16,
    textAlign: "right",
  }),
]);

const finale = chapter("sports-score", 240, [
  {
    ...box("score-background", 0, 0, W, H, C.ink),
    style: {
      position: "absolute",
      inset: 0,
      background:
        "linear-gradient(135deg, #081014 0%, #142421 50%, #0A172E 100%)",
    },
  },
  path(
    "score-lime-ribbon",
    "M -300 330 L 180 -20 L 330 -20 L -150 330 Z",
    C.lime,
  ),
  path(
    "score-blue-ribbon",
    "M 975 740 L 1410 270 L 1505 360 L 1100 740 Z",
    C.blue,
  ),
  ...speedField("score", C.white, 0.09),
  group("score-field-lines", [
    path(
      "score-field-grid",
      "M 0 584 L 1280 584 M 0 618 L 1280 618 M 100 653 L 420 507 M 390 653 L 530 507 M 640 653 L 640 507 M 890 653 L 750 507 M 1180 653 L 860 507",
      "transparent",
      "#28433E",
      1,
    ),
    path(
      "score-field-circle",
      "M 515 585 C 515 560 765 560 765 585 C 765 610 515 610 515 585 Z",
      "transparent",
      "#28433E",
      1,
    ),
  ]),
  enter(
    group("full-time-pill", [
      box("full-time-pill-bg", 520, 119, 240, 39, C.lime),
      label("full-time-pill-copy", "90:00 / FULL TIME", 525, 130, 230, C.ink, {
        textAlign: "center",
        letterSpacing: 2,
        fontSize: 13,
        height: 20,
      }),
    ]),
    0,
  ),
  enter(
    label("score-north", "NORTH", 180, 197, 375, C.lime, {
      textAlign: "center",
      fontSize: 24,
      letterSpacing: 5,
    }),
    5,
  ),
  enter(
    label("score-south", "SOUTH", 725, 197, 375, C.white, {
      textAlign: "center",
      fontSize: 24,
      letterSpacing: 5,
    }),
    10,
  ),
  enter(
    text("score-two", "02", 150, 238, 430, 236, C.lime, {
      textAlign: "center",
      letterSpacing: -17,
    }),
    8,
    21,
  ),
  enter(
    text("score-one", "01", 700, 238, 430, 236, C.white, {
      textAlign: "center",
      letterSpacing: -17,
    }),
    13,
    21,
  ),
  {
    ...box("score-divider", 604, 355, 72, 8, C.blue),
    animations: [
      motion("transform", [
        [0, "scale(0, 1)"],
        [28, "scale(1, 1)", "easeOut"],
      ]),
    ],
  },
  enter(
    text("score-tagline", "EVERY SECOND COUNTS.", 100, 531, 1080, 39, C.white, {
      textAlign: "center",
      letterSpacing: -1.3,
    }),
    25,
  ),
  box("score-header-backing", 0, 0, W, 78, C.ink),
  ...frame("score", C.white, "THE FINAL WHISTLE / ROUND 05"),
]);

export const scene = {
  schemaVersion: 1,
  width: W,
  height: H,
  fps: FPS,
  duration: CHAPTER * 3,
  assets: {},
  nodes: [opener, matchup, finale],
};
export const metadata = {
  title: "Night League",
  description:
    "A fictional sports broadcast opener with a stadium reveal, team matchup and full-time score.",
  posterFrame: 200,
  frames: [0, 35, 75, 115, 155, 200, 240, 285, 330, 359],
};
export default scene;
