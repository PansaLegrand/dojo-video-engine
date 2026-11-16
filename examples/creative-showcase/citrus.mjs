/** SQUEEZE — an original, fictional citrus-drink motion advertisement.
 * Cut fruit, glass, liquid and packaging are editable native vector geometry.
 * No photographs, generated imagery, external assets or nutrition claims.
 */
import { timeline, popIn, fadeUp } from "../../packages/presets/dist/index.js";

const W = 1280,
  H = 720,
  CHAPTER = 120;
const C = {
  cream: "#FFF3D8",
  orange: "#FA6C24",
  deep: "#EB4B15",
  yellow: "#FFCE58",
  leaf: "#1E583A",
  mint: "#C9E689",
  lime: "#A8CF49",
};
const key = (property, points) => ({
  kind: "keyframes",
  property,
  frames: points.map(([frame, value, easing]) => ({
    frame,
    value,
    ...(easing ? { easing } : {}),
  })),
});
const group = (id, children, style = {}, animations = []) => ({
  id,
  type: "div",
  style: {
    position: "absolute",
    left: 0,
    top: 0,
    width: W,
    height: H,
    ...style,
  },
  children,
  animations,
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
const ellipse = (id, x, y, width, height, fill, extra = {}) => ({
  id,
  type: "shape",
  shape: { kind: "ellipse" },
  style: {
    position: "absolute",
    left: x,
    top: y,
    width,
    height,
    fill,
    ...extra,
  },
});
const path = (
  id,
  d,
  fill,
  x = 0,
  y = 0,
  width = W,
  height = H,
  extra = {},
  viewBox = { x: 0, y: 0, width: W, height: H },
) => ({
  id,
  type: "shape",
  shape: { kind: "path", d, viewBox },
  style: {
    position: "absolute",
    left: x,
    top: y,
    width,
    height,
    fill,
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
    height: size * 1.25,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: size,
    fontWeight: 800,
    lineHeight: 1,
    color,
    letterSpacing: -size * 0.035,
    ...extra,
  },
});
const fixed = (n) => Number(n.toFixed(3));
const point = (r, angle) => [
  fixed(100 + Math.cos(angle) * r),
  fixed(100 + Math.sin(angle) * r),
];

function slice(id, x, y, diameter, lime = false, rotation = 0) {
  const flesh = lime ? ["#E3ED9A", "#9FC846"] : ["#FFD36C", "#F78A25"];
  const segments = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 + 0.045,
      b = ((i + 1) * Math.PI) / 5 - 0.045;
    const [ax, ay] = point(82, a),
      [bx, by] = point(82, b);
    const [ix, iy] = point(10, (a + b) / 2);
    const d = `M ${ix} ${iy} L ${ax} ${ay} A 82 82 0 0 1 ${bx} ${by} Z`;
    const middle = (a + b) / 2;
    const [tx, ty] = point(31, middle),
      [ex, ey] = point(72, middle);
    return [
      path(
        `${id}-segment-${i}`,
        d,
        `linear-gradient(${i * 36}deg, ${flesh[0]} 0%, ${flesh[1]} 100%)`,
        0,
        0,
        200,
        200,
        { stroke: C.cream, strokeWidth: 2 },
        { x: 0, y: 0, width: 200, height: 200 },
      ),
      path(
        `${id}-fiber-${i}`,
        `M ${tx} ${ty} L ${ex} ${ey}`,
        "transparent",
        0,
        0,
        200,
        200,
        {
          stroke: lime ? "#F1F6CE" : "#FFE4A1",
          strokeWidth: 1.4,
          opacity: 0.7,
        },
        { x: 0, y: 0, width: 200, height: 200 },
      ),
    ];
  }).flat();
  return group(
    id,
    [
      ellipse(`${id}-rind`, 0, 0, 200, 200, lime ? "#719D33" : "#F17A22"),
      ellipse(`${id}-skin`, 5, 5, 190, 190, lime ? "#C9DD73" : "#FFB94B"),
      ellipse(`${id}-pith`, 11, 11, 178, 178, C.cream),
      ...segments,
      ellipse(`${id}-core`, 94, 94, 12, 12, C.cream),
    ],
    {
      left: x,
      top: y,
      width: 200,
      height: 200,
      transformOrigin: "center center",
      transform: `rotate(${rotation}deg) scale(${diameter / 200})`,
    },
  );
}

function leaf(id, x, y, width, angle = 0, light = false) {
  return group(
    id,
    [
      path(
        `${id}-blade`,
        "M 8 61 C 43 0 125 -7 194 7 C 186 75 92 113 8 61 Z",
        light
          ? "linear-gradient(100deg, #82AC49 0%, #245B3C 100%)"
          : "linear-gradient(100deg, #387F4F 0%, #17452E 100%)",
        0,
        0,
        200,
        100,
        {},
        { x: 0, y: 0, width: 200, height: 100 },
      ),
      path(
        `${id}-vein`,
        "M 8 61 Q 94 53 181 18 M 64 55 L 67 25 M 100 45 L 112 14 M 139 32 L 149 12 M 62 57 L 88 83 M 104 45 L 133 65",
        "transparent",
        0,
        0,
        200,
        100,
        {
          stroke: "#B6D887",
          strokeWidth: 1.8,
          opacity: 0.6,
          strokeLineCap: "round",
        },
        { x: 0, y: 0, width: 200, height: 100 },
      ),
    ],
    {
      left: x,
      top: y,
      width: 200,
      height: 100,
      transform: `rotate(${angle}deg) scale(${width / 200})`,
      transformOrigin: "center center",
    },
  );
}

function can(id, x, y) {
  const droplets = Array.from({ length: 18 }, (_, i) =>
    ellipse(
      `${id}-drop-${i}`,
      20 + ((i * 73) % 186),
      55 + ((i * 97) % 290),
      i % 4 === 0 ? 5 : 3,
      i % 4 === 0 ? 7 : 4,
      "rgba(255,255,255,0.5)",
    ),
  );
  return group(
    id,
    [
      rect(`${id}-body`, 0, 24, 230, 369, C.orange, {
        borderRadius: 28,
        background:
          "linear-gradient(90deg, #EF6520 0%, #FFAA40 15%, #FFD273 43%, #FFA43C 75%, #E95C1E 100%)",
      }),
      path(
        `${id}-label-wave`,
        "M 0 126 C 60 111 97 147 144 126 C 191 105 211 94 230 106 L 230 328 C 178 352 98 301 0 336 Z",
        C.cream,
        0,
        0,
        230,
        410,
        {},
        { x: 0, y: 0, width: 230, height: 410 },
      ),
      path(
        `${id}-lower-wave`,
        "M 0 338 C 75 303 155 381 230 337 L 230 390 Q 130 407 0 390 Z",
        "linear-gradient(90deg, #103B28 0%, #43835B 45%, #143E2C 100%)",
        0,
        0,
        230,
        410,
        {},
        { x: 0, y: 0, width: 230, height: 410 },
      ),
      rect(`${id}-side-light`, 20, 47, 10, 330, "rgba(255,255,255,0.18)", {
        borderRadius: 7,
      }),
      ellipse(`${id}-base`, 4, 379, 222, 29, "#B7B8A0"),
      ellipse(`${id}-base-inner`, 13, 381, 204, 18, "#DEE0C8"),
      ellipse(`${id}-rim`, 0, 8, 230, 46, "#A6AA9B"),
      ellipse(
        `${id}-lid`,
        7,
        11,
        216,
        36,
        "linear-gradient(90deg, #D5DACA 0%, #F2F1DE 48%, #B4BCAA 100%)",
      ),
      ellipse(`${id}-lid-line`, 22, 15, 186, 27, "transparent", {
        stroke: "#929E8B",
        strokeWidth: 1.5,
      }),
      ellipse(`${id}-opening`, 76, 23, 45, 13, "#2D473A"),
      rect(`${id}-pull-tab`, 106, 21, 44, 14, "#A2AD9B", {
        borderRadius: 7,
        border: "2px solid #E8EBD8",
      }),
      leaf(`${id}-logo-leaf`, 15, 50, 66, -20),
      text(`${id}-brand`, "SQUEEZE", 12, 159, 206, 42, C.leaf, {
        textAlign: "center",
        letterSpacing: -2,
      }),
      text(`${id}-flavor`, "ORANGE + LIME", 22, 220, 186, 12, C.leaf, {
        textAlign: "center",
        letterSpacing: 1.3,
        fontWeight: 700,
      }),
      rect(`${id}-brand-rule`, 77, 249, 76, 2, C.orange),
      text(`${id}-motto`, "A BRIGHT LITTLE BREAK", 20, 269, 190, 9, C.leaf, {
        textAlign: "center",
        letterSpacing: 1.1,
        fontWeight: 700,
      }),
      ...droplets,
    ],
    {
      left: x,
      top: y,
      width: 230,
      height: 410,
      transformOrigin: "center center",
    },
    [
      key("transform", [
        [0, "translate(0px, 20px) rotate(-6deg)"],
        [25, "translate(0px, 0px) rotate(-6deg)", "easeOut"],
        [72, "translate(0px, -7px) rotate(-4deg)", "easeInOut"],
        [119, "translate(0px, 0px) rotate(-6deg)", "easeInOut"],
      ]),
    ],
  );
}

const editorial = (id, color) => [
  text(`${id}-series`, "DOJO / PRODUCT STORIES", 48, 31, 440, 12, color, {
    letterSpacing: 2.2,
    fontWeight: 700,
  }),
  text(
    `${id}-concept`,
    "FICTIONAL PRODUCT · DESIGN STUDY",
    750,
    31,
    482,
    10,
    color,
    { letterSpacing: 1.6, textAlign: "right", fontWeight: 700 },
  ),
  rect(`${id}-rule`, 48, 665, 1184, 1, color, { opacity: 0.25 }),
];
const bubbleField = (id, color, count, xMin, xMax) =>
  Array.from({ length: count }, (_, i) => {
    const size = 4 + (i % 4) * 3;
    const x = xMin + ((i * 83) % (xMax - xMin)),
      y = 160 + ((i * 71) % 410);
    return {
      ...ellipse(
        `${id}-${i}`,
        x,
        y,
        size,
        size,
        i % 3 ? "transparent" : color,
        { stroke: color, strokeWidth: 1.8, opacity: 0.5 },
      ),
      animations: [
        key("transform", [
          [0, "translate(0px, 25px)"],
          [119, `translate(${i % 2 ? 8 : -8}px, -55px)`],
        ]),
      ],
    };
  });

const openingFruits = [
  slice("burst-orange-left", 105, 306, 306, false, -18),
  slice("burst-lime-right", 964, 137, 240, true, 24),
  slice("burst-orange-crop", -91, -77, 292, false, 14),
  slice("burst-lime-bottom", 922, 575, 186, true, -15),
  leaf("burst-leaf-one", 831, 438, 225, -28, true),
  leaf("burst-leaf-two", 158, 195, 168, -46),
];
const entrance = timeline()
  .stagger(
    openingFruits.map((n) => n.id),
    popIn({ durationInFrames: 26 }),
    { every: 5 },
  )
  .compile();
// Entrance is applied to a containing group, preserving the fruit's own scale.
const burstChildren = openingFruits.map((n) =>
  group(`${n.id}-arrival`, [n], {}, entrance[n.id]),
);
const opening = {
  ...group("citrus-burst", [
    rect("burst-paper", 0, 0, W, H, C.cream),
    path(
      "burst-swoosh",
      "M -90 570 C 140 532 193 650 408 626 C 659 596 745 489 954 495 C 1121 501 1212 553 1370 486 L 1370 760 L -90 760 Z",
      "#F8D28E",
    ),
    ...bubbleField("burst-bubbles", "#E6A746", 22, 160, 1120),
    ...burstChildren,
    text("burst-word-one", "SQUEEZE", 285, 228, 710, 111, C.leaf, {
      textAlign: "center",
      letterSpacing: -6,
    }),
    text("burst-word-two", "THE DAY.", 285, 342, 710, 111, C.orange, {
      textAlign: "center",
      letterSpacing: -6,
    }),
    text("burst-note", "A BRIGHT LITTLE BREAK.", 350, 491, 580, 15, C.leaf, {
      textAlign: "center",
      letterSpacing: 3,
      fontWeight: 700,
    }),
    ...editorial("burst", C.leaf),
  ]),
  from: 0,
  duration: CHAPTER,
};
const copyMotion = timeline()
  .stagger(
    ["burst-word-one", "burst-word-two", "burst-note"],
    fadeUp({ durationInFrames: 20 }),
    { every: 9, at: 8 },
  )
  .compile();
for (const node of opening.children)
  if (copyMotion[node.id]) node.animations = copyMotion[node.id];

const glassGeometry = {
  kind: "path",
  d: "M 14 18 L 236 18 L 210 325 Q 125 344 40 325 Z",
  viewBox: { x: 0, y: 0, width: 250, height: 350 },
};
const juice = group(
  "glass-liquid",
  [
    rect("glass-juice", 0, 55, 250, 300, "#FA962B", {
      background:
        "linear-gradient(180deg, #FFD262 0%, #FA982B 58%, #F57A24 100%)",
    }),
    ellipse("glass-liquid-surface", -5, 46, 260, 27, "#FFD96A"),
    ...Array.from({ length: 23 }, (_, i) =>
      ellipse(
        `glass-fizz-${i}`,
        37 + ((i * 37) % 174),
        77 + ((i * 61) % 228),
        3 + (i % 4),
        3 + (i % 4),
        "#FFE8A3",
        { opacity: 0.65 },
      ),
    ),
  ],
  { width: 250, height: 350, transformOrigin: "center bottom" },
  [
    key("transform", [
      [0, "scale(1, 0.04)"],
      [20, "scale(1, 0.04)"],
      [89, "scale(1, 1)", "easeOut"],
      [119, "scale(1, 1)"],
    ]),
  ],
);
const glass = group(
  "pour-glass",
  [
    {
      ...group("glass-interior", [juice], { width: 250, height: 350 }),
      clip: glassGeometry,
    },
    {
      id: "glass-outline",
      type: "shape",
      shape: structuredClone(glassGeometry),
      style: {
        position: "absolute",
        inset: 0,
        fill: "rgba(255,255,255,0.08)",
        stroke: "rgba(255,255,255,0.86)",
        strokeWidth: 4,
      },
    },
    ellipse("glass-rim", 10, 2, 230, 31, "rgba(255,255,255,0.13)", {
      stroke: "#FFFCED",
      strokeWidth: 4,
    }),
    path(
      "glass-shine",
      "M 43 54 L 61 297",
      "transparent",
      0,
      0,
      250,
      350,
      {
        stroke: "rgba(255,255,255,0.65)",
        strokeWidth: 8,
        strokeLineCap: "round",
      },
      { x: 0, y: 0, width: 250, height: 350 },
    ),
  ],
  { left: 514, top: 261, width: 250, height: 350 },
);
const stream = path(
  "pour-ribbon",
  "M 562 -30 C 760 39 726 103 665 145 C 595 195 639 243 639 606",
  "transparent",
  0,
  0,
  W,
  H,
  {
    stroke: "#FAB235",
    strokeWidth: 28,
    strokeLineCap: "round",
    transformOrigin: "640px 0px",
  },
);
stream.animations = [
  key("transform", [
    [0, "scale(1, 0.02)"],
    [15, "scale(1, 0.02)"],
    [41, "scale(1, 1)", "easeOut"],
    [98, "scale(1, 1)"],
    [111, "scale(1, 1)"],
  ]),
  key("opacity", [
    [0, 0],
    [14, 0],
    [20, 1],
    [97, 1],
    [111, 0],
    [119, 0],
  ]),
];
const pour = {
  ...group("citrus-pour", [
    rect("pour-ground", 0, 0, W, H, "#F6AE65"),
    ellipse("pour-disc", 340, 80, 600, 600, "#F8C18A"),
    ellipse("pour-shadow", 481, 595, 325, 36, "rgba(122,65,25,0.16)"),
    ...bubbleField("pour-bubbles", C.cream, 25, 140, 1130),
    stream,
    glass,
    slice("glass-garnish", 676, 237, 128, true, -20),
    leaf("pour-leaf", 382, 280, 141, -38),
    slice("pour-orange", 890, 428, 242, false, 15),
    leaf("pour-right-leaf", 982, 311, 202, -53, true),
    text("pour-word-one", "POUR", 70, 257, 360, 82, C.leaf),
    text("pour-word-two", "SOME JOY.", 70, 350, 410, 58, C.leaf),
    text("pour-note", "A MOMENT TO SAVOR.", 74, 456, 350, 13, C.leaf, {
      letterSpacing: 2.5,
      fontWeight: 700,
    }),
    ...editorial("pour", C.leaf),
  ]),
  from: CHAPTER,
  duration: CHAPTER,
};

const hero = {
  ...group("citrus-hero", [
    rect("hero-ground", 0, 0, W, H, C.leaf),
    ellipse("hero-disc", 354, 78, 570, 570, "#2A6C46"),
    text("hero-word", "SQUEEZE", 48, 234, 1184, 192, C.cream, {
      textAlign: "center",
      letterSpacing: -12,
    }),
    ...bubbleField("hero-bubbles", "#DDE9B9", 21, 110, 1160),
    leaf("hero-leaf-left", 340, 244, 220, -40, true),
    leaf("hero-leaf-right", 775, 247, 238, 10, true),
    ellipse("hero-shadow", 432, 571, 420, 62, "rgba(0,0,0,0.16)"),
    slice("hero-orange-back", 348, 390, 255, false, -15),
    slice("hero-lime-back", 765, 406, 221, true, 22),
    can("squeeze-can", 526, 170),
    slice("hero-orange-front", 388, 439, 150, false, -12),
    leaf("hero-front-leaf", 713, 496, 168, -7, true),
    text(
      "hero-tagline",
      "MAKE ROOM FOR A BRIGHTER BREAK.",
      250,
      624,
      780,
      16,
      C.cream,
      { textAlign: "center", letterSpacing: 2.4, fontWeight: 700 },
    ),
    ...editorial("hero", C.cream),
  ]),
  from: CHAPTER * 2,
  duration: CHAPTER,
};

export const scene = {
  schemaVersion: 1,
  width: W,
  height: H,
  fps: 30,
  duration: 360,
  assets: {},
  nodes: [opening, pour, hero],
};
export const metadata = {
  title: "Squeeze",
  description:
    "A playful citrus-drink advertisement with cut fruit, a pouring glass and a branded can.",
  posterFrame: 300,
  frames: [0, 35, 80, 145, 185, 225, 265, 300, 340, 359],
};
export default scene;
