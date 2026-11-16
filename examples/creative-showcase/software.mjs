/** FLOW — a fictional software concept, drawn entirely with editable graphics. */
import { timeline, fadeUp } from "../../packages/presets/dist/index.js";

const W = 1280,
  H = 720,
  CHAPTER = 120;
const C = {
  ink: "#182E2A",
  paper: "#F4F3EC",
  mint: "#C2F4D5",
  leaf: "#287653",
  line: "#DCE5DF",
  lilac: "#D9D1F3",
  muted: "#76867E",
  white: "#FFFFFF",
  peach: "#FFD7B8",
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
const text = (id, value, x, y, width, size, color = C.ink, extra = {}) => ({
  id,
  type: "text",
  text: value,
  style: {
    position: "absolute",
    left: x,
    top: y,
    width,
    height: size * 1.4,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: size,
    fontWeight: 600,
    color,
    lineHeight: 1.1,
    letterSpacing: -size * 0.025,
    maxLines: 1,
    textFit: "shrink",
    minFontSize: size - 1,
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
const path = (id, d, x, y, w, h, fill, stroke = "transparent", sw = 0) => ({
  id,
  type: "shape",
  shape: { kind: "path", d, viewBox: { x: 0, y: 0, width: w, height: h } },
  style: {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    fill,
    stroke,
    strokeWidth: sw,
    strokeLineJoin: "round",
    strokeLineCap: "round",
  },
});
const fade = (id, node, at = 0, duration = 20) => {
  node.animations = timeline()
    .add(id, fadeUp({ durationInFrames: duration, distance: 16 }), { at })
    .compile()[id];
  return node;
};
const pill = (id, label, x, y, w, bg, fg = C.ink) =>
  group(id, [
    rect(`${id}-bg`, x, y, w, 26, bg, { borderRadius: 13 }),
    text(`${id}-text`, label, x + 10, y + 6, w - 20, 11, fg, {
      letterSpacing: 0.3,
      textAlign: "center",
    }),
  ]);
const avatar = (id, letter, x, y, color, size = 26) =>
  group(id, [
    rect(`${id}-circle`, x, y, size, size, color, {
      borderRadius: size / 2,
      border: `2px solid ${C.white}`,
    }),
    text(`${id}-letter`, letter, x, y + size * 0.23, size, size * 0.4, C.ink, {
      textAlign: "center",
      fontWeight: 700,
    }),
  ]);
const check = (id, x, y, size, color) =>
  path(
    id,
    `M ${size * 0.18} ${size * 0.5} L ${size * 0.4} ${size * 0.71} L ${size * 0.82} ${size * 0.24}`,
    x,
    y,
    size,
    size,
    "transparent",
    color,
    size * 0.1,
  );

function chrome(prefix, title, subtitle, bg = C.paper) {
  return [
    rect(`${prefix}-paper`, 0, 0, W, H, bg),
    rect(`${prefix}-brandmark-a`, 54, 38, 14, 14, C.ink, { borderRadius: 4 }),
    rect(`${prefix}-brandmark-b`, 72, 38, 14, 14, C.leaf, { borderRadius: 4 }),
    rect(`${prefix}-brandmark-c`, 54, 56, 14, 14, C.leaf, { borderRadius: 4 }),
    text(`${prefix}-brand`, "flow", 97, 34, 200, 32, C.ink, {
      fontWeight: 700,
      letterSpacing: -1.8,
    }),
    text(`${prefix}-concept`, "CONCEPT INTERFACE", 925, 45, 300, 11, C.muted, {
      textAlign: "right",
      letterSpacing: 2,
    }),
    text(`${prefix}-title`, title, 54, 94, 880, 37, C.ink, {
      fontWeight: 700,
      letterSpacing: -1.2,
    }),
    text(`${prefix}-subtitle`, subtitle, 843, 109, 382, 13, C.muted, {
      textAlign: "right",
      letterSpacing: 0,
    }),
    text(
      `${prefix}-footer`,
      "LESS FRICTION. MORE FLOW.",
      54,
      684,
      600,
      11,
      C.muted,
      { letterSpacing: 2 },
    ),
    text(`${prefix}-page`, `${prefix.at(-1)} / 3`, 1135, 684, 90, 11, C.muted, {
      textAlign: "right",
      letterSpacing: 2,
    }),
  ];
}
function shell(prefix) {
  return [
    rect(`${prefix}-window`, 78, 164, 1124, 490, C.white, {
      borderRadius: 20,
      boxShadow: "0px 14px 30px rgba(24,46,42,0.12)",
      border: `1px solid ${C.line}`,
    }),
    rect(`${prefix}-sidebar`, 79, 165, 205, 488, "#F7F9F6", {
      borderTopLeftRadius: 20,
      borderBottomLeftRadius: 20,
    }),
    rect(`${prefix}-divider`, 284, 165, 1, 488, C.line),
    rect(`${prefix}-toolbar-line`, 285, 218, 916, 1, C.line),
    ...["#E9B9A7", "#E9D5A7", "#A9D2BB"].map((color, i) =>
      rect(`${prefix}-dot-${i}`, 100 + i * 17, 185, 8, 8, color, {
        borderRadius: 4,
      }),
    ),
    text(`${prefix}-workspace`, "Studio workspace", 105, 229, 150, 14, C.ink, {
      fontWeight: 700,
      letterSpacing: -0.2,
    }),
    rect(`${prefix}-selected`, 95, 269, 174, 38, C.mint, { borderRadius: 9 }),
    rect(`${prefix}-sidebar-icon`, 109, 282, 12, 12, C.leaf, {
      borderRadius: 3,
    }),
    text(
      `${prefix}-sidebar-current`,
      "Launch board",
      132,
      281,
      127,
      13,
      C.ink,
      { fontWeight: 700 },
    ),
    ...["My tasks", "Calendar", "Files"].flatMap((label, i) => [
      rect(
        `${prefix}-nav-icon-${i}`,
        109,
        328 + i * 44,
        12,
        12,
        "transparent",
        { border: `1.5px solid ${C.muted}`, borderRadius: i === 1 ? 3 : 6 },
      ),
      text(`${prefix}-nav-${i}`, label, 132, 325 + i * 44, 130, 13, C.muted, {
        fontWeight: 400,
      }),
    ]),
    text(`${prefix}-team-label`, "YOUR TEAM", 109, 488, 140, 10, C.muted, {
      letterSpacing: 1.8,
    }),
    avatar(`${prefix}-team-m`, "M", 107, 514, C.lilac),
    avatar(`${prefix}-team-a`, "A", 130, 514, C.mint),
    avatar(`${prefix}-team-j`, "J", 153, 514, C.peach),
    text(
      `${prefix}-team-note`,
      "Better, together.",
      107,
      557,
      150,
      12,
      C.muted,
      { fontWeight: 400 },
    ),
    text(
      `${prefix}-breadcrumb`,
      "Projects  /  Spring launch",
      313,
      185,
      600,
      13,
      C.muted,
      { fontWeight: 400 },
    ),
    avatar(`${prefix}-profile`, "M", 1150, 177, C.lilac, 27),
    text(`${prefix}-board-title`, "Spring launch", 315, 239, 500, 25, C.ink, {
      fontWeight: 700,
    }),
  ];
}
function column(prefix, label, x, color, count) {
  return group(prefix, [
    rect(`${prefix}-area`, x, 292, 254, 330, "#F3F7F3", { borderRadius: 12 }),
    rect(`${prefix}-state`, x + 14, 308, 7, 7, color, { borderRadius: 4 }),
    text(`${prefix}-label`, label, x + 29, 303, 160, 13, C.ink, {
      fontWeight: 700,
    }),
    text(`${prefix}-count`, String(count), x + 213, 304, 25, 12, C.muted, {
      textAlign: "right",
      letterSpacing: 0,
    }),
  ]);
}
function card(id, title, tag, x, y, accent = C.lilac, initial) {
  const node = {
    id,
    type: "div",
    style: {
      position: "absolute",
      left: x,
      top: y,
      width: 232,
      height: 112,
      borderRadius: 12,
      backgroundColor: C.white,
      border: `1px solid ${C.line}`,
      boxShadow: "0px 5px 10px rgba(24,46,42,0.05)",
    },
    children: [
      rect(`${id}-tag`, 14, 13, 52, 5, accent, { borderRadius: 3 }),
      text(`${id}-title`, title, 14, 30, 204, 18, C.ink, {
        fontWeight: 700,
        letterSpacing: -0.5,
      }),
      text(`${id}-tagline`, tag, 14, 61, 180, 11, C.muted, {
        fontWeight: 400,
        letterSpacing: 0,
      }),
      avatar(`${id}-avatar`, id.endsWith("1") ? "M" : "A", 14, 83, accent, 18),
      rect(`${id}-line`, 43, 89, 55, 4, "#E8EDE8", { borderRadius: 2 }),
      rect(`${id}-check-box`, 199, 85, 15, 15, "transparent", {
        border: `1px solid ${C.line}`,
        borderRadius: 4,
      }),
    ],
  };
  if (initial)
    node.animations = [
      motion("transform", [
        [
          0,
          `translate(${initial[0] - x}px, ${initial[1] - y}px) rotate(${initial[2]}deg)`,
        ],
        [
          42,
          `translate(${initial[0] - x}px, ${initial[1] - y}px) rotate(${initial[2]}deg)`,
        ],
        [
          83,
          "translate(0px, 0px) rotate(0deg)",
          "cubic-bezier(0.18, 0.85, 0.25, 1)",
        ],
      ]),
    ];
  return node;
}
function cursor(id, points, label = "Mia", color = C.lilac) {
  return {
    id,
    type: "div",
    style: { position: "absolute", left: 0, top: 0, width: 100, height: 60 },
    children: [
      path(
        `${id}-pointer`,
        "M1 1 L1 30 L8 23 L14 35 L19 32 L13 21 L27 21 Z",
        0,
        0,
        30,
        38,
        C.ink,
        C.white,
        1.5,
      ),
      rect(`${id}-tag`, 22, 31, 57, 24, color, { borderRadius: 6 }),
      text(`${id}-name`, label, 28, 36, 45, 11, C.ink, {
        fontWeight: 700,
        letterSpacing: 0,
      }),
    ],
    animations: [
      motion(
        "transform",
        points.map(([f, x, y, e]) => [f, `translate(${x}px, ${y}px)`, e]),
      ),
    ],
  };
}
function clickPulse(id, x, y, from) {
  return {
    ...rect(id, x - 12, y - 12, 24, 24, "transparent", {
      border: `2px solid ${C.leaf}`,
      borderRadius: 12,
    }),
    from,
    duration: 18,
    animations: [
      motion("transform", [
        [0, "scale(0.4)"],
        [17, "scale(2)", "easeOut"],
      ]),
      motion("opacity", [
        [0, 1],
        [17, 0],
      ]),
    ],
  };
}
const organizeButton = group("organize-button", [
  rect("organize-button-bg", 1004, 235, 166, 35, C.ink, { borderRadius: 9 }),
  text("organize-button-label", "Organize board", 1016, 245, 142, 12, C.white, {
    textAlign: "center",
    letterSpacing: 0.1,
    fontWeight: 600,
  }),
]);
organizeButton.animations = [
  motion("transform", [
    [0, "scale(1)"],
    [35, "scale(1)"],
    [40, "scale(0.985)"],
    [46, "scale(1)"],
  ]),
];
const boardGrid = group("organized-columns", [
  column("todo-column", "Ideas", 313, C.lilac, 2),
  column("doing-column", "In progress", 584, "#DCA975", 2),
  column("done-column", "Ready to share", 855, C.leaf, 1),
]);
boardGrid.animations = [
  motion("opacity", [
    [0, 0.18],
    [41, 0.18],
    [69, 1, "easeOut"],
  ]),
];
const chapterOne = group(
  "flow-collect",
  [
    ...chrome("flow1", "Bring good ideas into focus.", "01  /  ORGANIZE"),
    ...shell("collect"),
    boardGrid,
    organizeButton,
    card(
      "collect-card-1",
      "Customer notes",
      "Gather the little insights",
      324,
      337,
      C.lilac,
      [385, 350, -6],
    ),
    card(
      "collect-card-2",
      "Brand direction",
      "A starting point for the team",
      324,
      462,
      C.peach,
      [650, 438, 5],
    ),
    card(
      "collect-card-3",
      "Launch page",
      "Shape the first impression",
      595,
      337,
      C.mint,
      [545, 330, 4],
    ),
    card(
      "collect-card-4",
      "Story & copy",
      "Find the words that fit",
      595,
      462,
      C.lilac,
      [880, 424, -7],
    ),
    card(
      "collect-card-5",
      "Team checklist",
      "Make the next step clear",
      866,
      337,
      C.peach,
      [806, 302, 6],
    ),
    cursor("collect-cursor", [
      [0, 1140, 578],
      [20, 1140, 578],
      [35, 1100, 252, "easeInOut"],
      [48, 1100, 252],
      [94, 1127, 599, "easeInOut"],
    ]),
    clickPulse("organize-click", 1100, 252, 38),
  ],
  { from: 0, duration: CHAPTER },
);

const approvalDialog = group("review-dialog", [
  rect("review-dialog-body", 542, 259, 578, 321, C.white, {
    borderRadius: 17,
    border: `1px solid ${C.line}`,
    boxShadow: "0px 16px 40px rgba(24,46,42,0.18)",
  }),
  pill("review-dialog-tag", "REVIEW", 567, 280, 72, C.lilac),
  text("review-dialog-title", "Launch page", 567, 321, 500, 30, C.ink, {
    fontWeight: 700,
    letterSpacing: -0.8,
  }),
  text(
    "review-dialog-description",
    "The details are ready. Bring the team in.",
    567,
    366,
    500,
    15,
    C.muted,
    { fontWeight: 400, letterSpacing: -0.1 },
  ),
  rect("review-comment-bg", 567, 409, 526, 61, "#F4F7F3", { borderRadius: 11 }),
  avatar("review-comment-avatar", "A", 580, 422, C.mint, 30),
  text("review-comment-author", "Alex", 622, 420, 180, 12, C.ink, {
    fontWeight: 700,
  }),
  text(
    "review-comment-message",
    "Love the direction. Ready to share.",
    622,
    440,
    450,
    13,
    C.muted,
    { fontWeight: 400, letterSpacing: -0.1 },
  ),
  text("review-approval-label", "Final check", 567, 515, 210, 12, C.muted, {
    fontWeight: 400,
    letterSpacing: 0,
  }),
  avatar("review-approver-m", "M", 646, 505, C.lilac, 27),
  avatar("review-approver-a", "A", 669, 505, C.mint, 27),
  rect("approve-button", 931, 500, 162, 42, C.ink, { borderRadius: 11 }),
  text("approve-button-label", "Approve & share", 941, 514, 142, 12, C.white, {
    textAlign: "center",
    letterSpacing: 0,
  }),
]);
approvalDialog.animations = timeline()
  .add("review-dialog", fadeUp({ durationInFrames: 18, distance: 22 }), {
    at: 6,
  })
  .compile()["review-dialog"];
const approved = group(
  "approval-success",
  [
    rect("approval-success-bg", 542, 259, 578, 321, C.white, {
      borderRadius: 17,
      border: `1px solid ${C.line}`,
      boxShadow: "0px 16px 40px rgba(24,46,42,0.18)",
    }),
    rect("approval-success-icon", 784, 304, 90, 90, C.mint, {
      borderRadius: 45,
    }),
    check("approval-success-check", 808, 328, 42, C.leaf),
    text(
      "approval-success-title",
      "Everyone is on the same page.",
      568,
      421,
      525,
      24,
      C.ink,
      { textAlign: "center", fontWeight: 700, letterSpacing: -0.7 },
    ),
    text(
      "approval-success-note",
      "Launch page approved and ready to share.",
      568,
      462,
      525,
      14,
      C.muted,
      { textAlign: "center", fontWeight: 400, letterSpacing: 0 },
    ),
    pill("approval-success-status", "APPROVED", 766, 514, 127, C.mint, C.leaf),
  ],
  {
    from: 76,
    duration: 44,
    animations: [
      motion("opacity", [
        [0, 0],
        [10, 1, "easeOut"],
      ]),
      motion("transform", [
        [0, "scale(0.97)"],
        [14, "scale(1)", "easeOut"],
      ]),
    ],
  },
);
const chapterTwo = group(
  "flow-collaborate",
  [
    ...chrome("flow2", "Move forward, together.", "02  /  COLLABORATE"),
    ...shell("review"),
    column("review-background-ideas", "Ideas", 313, C.lilac, 2),
    column("review-background-doing", "In progress", 584, "#DCA975", 1),
    column("review-background-ready", "Ready to share", 855, C.leaf, 2),
    card(
      "review-background-card-1",
      "Customer notes",
      "Gather the little insights",
      324,
      337,
      C.lilac,
    ),
    card(
      "review-background-card-2",
      "Brand direction",
      "A starting point for the team",
      324,
      462,
      C.peach,
    ),
    rect("review-dim", 285, 219, 916, 434, "rgba(24,46,42,0.10)", {
      borderBottomRightRadius: 20,
    }),
    { ...approvalDialog, duration: 76 },
    approved,
    cursor("review-cursor", [
      [0, 1100, 597],
      [30, 1100, 597],
      [60, 1022, 518, "easeInOut"],
      [82, 1022, 518],
      [105, 1154, 598, "easeInOut"],
    ]),
    clickPulse("approval-click", 1022, 518, 67),
  ],
  { from: 120, duration: CHAPTER },
);

const steps = ["Ideas", "In progress", "Approved", "Shipped"];
const finalPipeline = group("ship-pipeline", [
  rect("ship-pipeline-line", 306, 534, 670, 2, "#8ABDA1"),
  ...steps.flatMap((label, i) => [
    rect(
      `ship-pipeline-dot-${i}`,
      293 + i * 223,
      522,
      26,
      26,
      i === 3 ? C.ink : C.leaf,
      { borderRadius: 13 },
    ),
    check(`ship-pipeline-check-${i}`, 298 + i * 223, 527, 16, C.white),
    text(
      `ship-pipeline-label-${i}`,
      label,
      230 + i * 223,
      564,
      150,
      14,
      C.ink,
      {
        textAlign: "center",
        fontWeight: i === 3 ? 700 : 400,
        letterSpacing: 0,
      },
    ),
  ]),
]);
finalPipeline.animations = timeline()
  .add("ship-pipeline", fadeUp({ durationInFrames: 22, distance: 14 }), {
    at: 24,
  })
  .compile()["ship-pipeline"];
const scatter = [];
for (let i = 0; i < 12; i++) {
  const a = (i * Math.PI) / 6,
    r = 200 + (i % 3) * 35;
  const x = 640 + Math.cos(a) * r,
    y = 288 + Math.sin(a) * r * 0.6;
  const node = rect(
    `ship-confetti-${i}`,
    x,
    y,
    7 + (i % 3) * 3,
    7 + (i % 2) * 11,
    [C.leaf, C.lilac, C.white][i % 3],
    { borderRadius: i % 2 ? 2 : 6 },
  );
  node.animations = [
    motion("transform", [
      [
        0,
        `translate(${(-Math.cos(a) * 110).toFixed(3)}px, ${(-Math.sin(a) * 80).toFixed(3)}px) rotate(0deg)`,
      ],
      [42, "translate(0px, 0px) rotate(65deg)", "easeOut"],
      [
        119,
        `translate(${(Math.cos(a) * 18).toFixed(3)}px, ${(Math.sin(a) * 25).toFixed(3)}px) rotate(110deg)`,
      ],
    ]),
    motion("opacity", [
      [0, 0],
      [20, 0],
      [32, 0.9],
      [95, 0.9],
      [119, 0],
    ]),
  ];
  scatter.push(node);
}
const chapterThree = group(
  "flow-ship",
  [
    ...chrome("flow3", "", "03  /  SHIP", C.mint),
    ...scatter,
    fade(
      "ship-hero",
      group("ship-hero", [
        rect("ship-icon-shadow", 558, 186, 164, 164, "rgba(40,118,83,0.10)", {
          borderRadius: 45,
          transform: "rotate(-9deg)",
        }),
        rect("ship-icon", 558, 174, 164, 164, C.white, {
          borderRadius: 42,
          boxShadow: "0px 16px 28px rgba(40,118,83,0.12)",
        }),
        check("ship-check", 602, 220, 76, C.leaf),
      ]),
      0,
      26,
    ),
    fade(
      "ship-title",
      text(
        "ship-title",
        "Good work. Out in the world.",
        80,
        384,
        1120,
        57,
        C.ink,
        { fontWeight: 700, textAlign: "center", letterSpacing: -2.5 },
      ),
      12,
      24,
    ),
    fade(
      "ship-note",
      text(
        "ship-note",
        "From the first idea to a shared finish.",
        200,
        460,
        880,
        19,
        C.leaf,
        { textAlign: "center", fontWeight: 400, letterSpacing: -0.3 },
      ),
      20,
      20,
    ),
    finalPipeline,
    pill(
      "ship-badge",
      "MADE POSSIBLE TOGETHER",
      486,
      615,
      308,
      C.white,
      C.leaf,
    ),
  ],
  { from: 240, duration: CHAPTER },
);

export const scene = {
  schemaVersion: 1,
  width: W,
  height: H,
  fps: 30,
  duration: 360,
  assets: {},
  nodes: [chapterOne, chapterTwo, chapterThree],
};
export const metadata = {
  title: "Flow",
  description:
    "A concept software workflow: organize ideas, approve together, and ship.",
  posterFrame: 80,
  frames: [0, 30, 65, 95, 150, 184, 218, 275, 320, 359],
};
export default scene;
