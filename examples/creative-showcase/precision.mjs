/** PRECISION / P–01: an original fictional timepiece, built as editable parts. */
const W = 1280,
  H = 720,
  D = 360;
const ink = "#111719",
  ivory = "#E9E6DD",
  muted = "#8C9C9E",
  amber = "#E9AB55";
const k = (property, points) => ({
  kind: "keyframes",
  property,
  frames: points.map(([frame, value, easing]) => ({
    frame,
    value,
    ...(easing ? { easing } : {}),
  })),
});
const text = (id, value, x, y, w, size, color = ivory, extra = {}) => ({
  id,
  type: "text",
  text: value,
  style: {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: size * 1.4,
    fontFamily: "Arial",
    fontSize: size,
    fontWeight: 400,
    color,
    letterSpacing: 1.5,
    ...extra,
  },
});
const rect = (id, x, y, w, h, color) => ({
  id,
  type: "div",
  style: {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    backgroundColor: color,
  },
});
const group = (id, children, extra = {}) => ({
  id,
  type: "div",
  from: 0,
  duration: D,
  style: { position: "absolute", inset: 0 },
  children,
  ...extra,
});
const smooth = (from, to, start, end) =>
  Array.from({ length: 9 }, (_, i) => ({
    time: start + ((end - start) * i) / 8,
    value: from + ((to - from) * (1 - Math.cos((Math.PI * i) / 8))) / 2,
  }));
const separate = (home, away, delay = 0) => [
  { time: 0, value: home },
  { time: 2.4 + delay, value: home },
  ...smooth(home, away, 2.5 + delay, 4.4 + delay),
  { time: 8.1, value: away },
  ...smooth(away, home, 8.2, 10.35),
  { time: 12, value: home },
];
const objects = {
  instrument: {
    kind: "group",
    keyframes: {
      "rotation.y": [
        { time: 0, value: -28 },
        { time: 4.8, value: 4 },
        { time: 8, value: 4 },
        { time: 12, value: 42 },
      ],
      "scale.x": [
        { time: 0, value: 1.15 },
        { time: 2.5, value: 1.15 },
        { time: 4.5, value: 0.95 },
        { time: 8, value: 0.95 },
        { time: 10.5, value: 1.15 },
        { time: 12, value: 1.15 },
      ],
      "scale.y": [
        { time: 0, value: 1.15 },
        { time: 2.5, value: 1.15 },
        { time: 4.5, value: 0.95 },
        { time: 8, value: 0.95 },
        { time: 10.5, value: 1.15 },
        { time: 12, value: 1.15 },
      ],
      "scale.z": [
        { time: 0, value: 1.15 },
        { time: 2.5, value: 1.15 },
        { time: 4.5, value: 0.95 },
        { time: 8, value: 0.95 },
        { time: 10.5, value: 1.15 },
        { time: 12, value: 1.15 },
      ],
    },
  },
  caseLayer: {
    kind: "group",
    parentId: "instrument",
    keyframes: { "position.y": separate(-0.27, -1.65, 0) },
  },
  mechanism: {
    kind: "group",
    parentId: "instrument",
    keyframes: { "position.y": separate(-0.06, -0.35, 0.1) },
  },
  dial: {
    kind: "group",
    parentId: "instrument",
    keyframes: { "position.y": separate(0.12, 0.92, 0.2) },
  },
  bezel: {
    kind: "group",
    parentId: "instrument",
    keyframes: { "position.y": separate(0.22, 1.92, 0.35) },
  },
};
function mesh(
  id,
  parentId,
  geometry,
  materialId,
  position = { x: 0, y: 0, z: 0 },
  extra = {},
) {
  objects[id] = {
    kind: "mesh",
    parentId,
    geometry,
    materialId,
    position,
    ...extra,
  };
}
const cylinder = (radius, height) => ({
  kind: "cylinder",
  radiusTop: radius,
  radiusBottom: radius,
  height,
});
const box = (width, height, depth) => ({ kind: "box", width, height, depth });
// The case has real thickness, mounting lugs, a stepped crown and bright seams.
mesh("caseBody", "caseLayer", cylinder(1.42, 0.38), "case");
mesh("caseLowerLip", "caseLayer", cylinder(1.39, 0.04), "silver", {
  x: 0,
  y: -0.2,
  z: 0,
});
mesh(
  "caseRim",
  "caseLayer",
  { kind: "torus", radius: 1.39, tube: 0.045 },
  "silver",
  { x: 0, y: 0.2, z: 0 },
  { rotation: { x: 90, y: 0, z: 0 } },
);
for (const x of [-0.79, 0.79])
  for (const z of [-1.22, 1.22])
    mesh(
      `lug${x < 0 ? "L" : "R"}${z < 0 ? "B" : "F"}`,
      "caseLayer",
      box(0.34, 0.28, 0.62),
      "silver",
      { x, y: 0, z },
    );
mesh(
  "crownStem",
  "caseLayer",
  cylinder(0.13, 0.25),
  "silver",
  { x: 1.47, y: 0, z: 0 },
  { rotation: { x: 0, y: 0, z: 90 } },
);
mesh(
  "crownGrip",
  "caseLayer",
  cylinder(0.23, 0.18),
  "amber",
  { x: 1.65, y: 0, z: 0 },
  { rotation: { x: 0, y: 0, z: 90 } },
);
mesh(
  "crownCap",
  "caseLayer",
  cylinder(0.17, 0.025),
  "case",
  { x: 1.75, y: 0, z: 0 },
  { rotation: { x: 0, y: 0, z: 90 } },
);

// Mechanical movement: three independent driven wheels, a plate and bridges.
mesh("movementPlate", "mechanism", cylinder(1.25, 0.06), "plate");
mesh(
  "movementRing",
  "mechanism",
  { kind: "torus", radius: 1.17, tube: 0.025 },
  "amber",
  { x: 0, y: 0.05, z: 0 },
  { rotation: { x: 90, y: 0, z: 0 } },
);
function gear(id, x, z, radius, speed, mat) {
  objects[id] = {
    kind: "group",
    parentId: "mechanism",
    position: { x, y: 0.11, z },
    spin: { x: 0, y: speed, z: 0 },
  };
  mesh(`${id}wheel`, id, cylinder(radius, 0.055), mat);
  mesh(`${id}well`, id, cylinder(radius * 0.68, 0.06), "case", {
    x: 0,
    y: 0.008,
    z: 0,
  });
  mesh(`${id}hub`, id, cylinder(radius * 0.18, 0.13), "silver", {
    x: 0,
    y: 0.04,
    z: 0,
  });
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    mesh(
      `${id}tooth${i}`,
      id,
      box(radius * 0.25, 0.055, radius * 0.23),
      mat,
      { x: Math.sin(angle) * radius, y: 0, z: Math.cos(angle) * radius },
      { rotation: { x: 0, y: i * 30, z: 0 } },
    );
  }
  for (let i = 0; i < 3; i++)
    mesh(
      `${id}spoke${i}`,
      id,
      box(radius * 1.7, 0.045, radius * 0.12),
      mat,
      { x: 0, y: 0.04, z: 0 },
      { rotation: { x: 0, y: i * 60, z: 0 } },
    );
}
gear("driveWheel", -0.49, 0.21, 0.43, 30, "amber");
gear("balanceWheel", 0.45, 0.27, 0.39, -36, "silver");
gear("escapeWheel", 0.08, -0.58, 0.27, 52, "amber");
mesh(
  "bridgeA",
  "mechanism",
  box(0.12, 0.07, 1.3),
  "silver",
  { x: -0.92, y: 0.13, z: 0 },
  { rotation: { x: 0, y: -14, z: 0 } },
);
mesh(
  "bridgeB",
  "mechanism",
  box(0.12, 0.07, 0.95),
  "silver",
  { x: 0.91, y: 0.13, z: 0.05 },
  { rotation: { x: 0, y: 14, z: 0 } },
);
for (const [i, x, z] of [
  [0, -0.92, -0.58],
  [1, -0.92, 0.58],
  [2, 0.91, -0.4],
  [3, 0.91, 0.47],
])
  mesh(`bridgeScrew${i}`, "mechanism", cylinder(0.052, 0.1), "amber", {
    x,
    y: 0.2,
    z,
  });

// Dial details are geometry too, including applied indices and moving hands.
mesh("dialFace", "dial", cylinder(1.29, 0.045), "dial");
mesh(
  "dialEdge",
  "dial",
  { kind: "torus", radius: 1.26, tube: 0.02 },
  "silver",
  { x: 0, y: 0.025, z: 0 },
  { rotation: { x: 90, y: 0, z: 0 } },
);
for (let i = 0; i < 24; i++) {
  const angle = (i * Math.PI) / 12;
  mesh(
    `index${i}`,
    "dial",
    box(i % 2 ? 0.025 : 0.055, 0.025, i % 2 ? 0.075 : 0.18),
    i % 6 === 0 ? "amber" : "ivory",
    { x: Math.sin(angle) * 1.09, y: 0.04, z: Math.cos(angle) * 1.09 },
    { rotation: { x: 0, y: i * 15, z: 0 } },
  );
}
objects.hourHand = {
  kind: "group",
  parentId: "dial",
  position: { x: 0, y: 0.08, z: 0 },
  rotation: { x: 0, y: -50, z: 0 },
  spin: { x: 0, y: 1.5, z: 0 },
};
mesh("hourBlade", "hourHand", box(0.085, 0.025, 0.67), "ivory", {
  x: 0,
  y: 0,
  z: 0.27,
});
objects.minuteHand = {
  kind: "group",
  parentId: "dial",
  position: { x: 0, y: 0.12, z: 0 },
  rotation: { x: 0, y: 50, z: 0 },
  spin: { x: 0, y: 7, z: 0 },
};
mesh("minuteBlade", "minuteHand", box(0.045, 0.025, 0.94), "ivory", {
  x: 0,
  y: 0,
  z: 0.37,
});
objects.secondHand = {
  kind: "group",
  parentId: "dial",
  position: { x: 0, y: 0.16, z: 0 },
  rotation: { x: 0, y: 160, z: 0 },
  spin: { x: 0, y: 36, z: 0 },
};
mesh("secondBlade", "secondHand", box(0.018, 0.018, 1.2), "amber", {
  x: 0,
  y: 0,
  z: 0.34,
});
mesh("handPin", "dial", cylinder(0.074, 0.08), "amber", {
  x: 0,
  y: 0.17,
  z: 0,
});
mesh(
  "bezelRing",
  "bezel",
  { kind: "torus", radius: 1.34, tube: 0.065 },
  "silver",
  { x: 0, y: 0, z: 0 },
  { rotation: { x: 90, y: 0, z: 0 } },
);
mesh(
  "bezelInner",
  "bezel",
  { kind: "torus", radius: 1.245, tube: 0.018 },
  "amber",
  { x: 0, y: 0.012, z: 0 },
  { rotation: { x: 90, y: 0, z: 0 } },
);

const instrument = {
  id: "precision-instrument",
  type: "extension",
  from: 0,
  duration: D,
  style: { position: "absolute", left: 180, top: 126, width: 920, height: 530 },
  extension: {
    name: "dojo.three-scene",
    version: "1.0.0",
    params: {
      camera: {
        kind: "orthographic",
        position: { x: 4.1, y: 5.7, z: 8 },
        target: { x: 0, y: 0, z: 0 },
        size: 5.45,
      },
      lighting: { ambient: 1.5, intensity: 3, position: { x: -4, y: 8, z: 5 } },
      materials: {
        case: { color: "#434F52", metalness: 0.26, roughness: 0.27 },
        silver: { color: "#D9E2DF", metalness: 0.24, roughness: 0.23 },
        amber: { color: amber, metalness: 0.2, roughness: 0.3 },
        plate: { color: "#877756", metalness: 0.16, roughness: 0.48 },
        dial: { color: "#151F22", roughness: 0.5 },
        ivory: { color: ivory, unlit: true },
      },
      objects,
    },
  },
};
const callout = (id, title, subtitle, x, y, width = 220) =>
  group(id, [
    text(`${id}-title`, title, x, y, width, 12, amber, { letterSpacing: 2 }),
    text(`${id}-sub`, subtitle, x, y + 24, width, 15, ivory, {
      letterSpacing: 0.2,
    }),
  ]);
const annotation = group(
  "precision-annotations",
  [
    callout(
      "bezel-callout",
      "01 / BEZEL",
      "Polished to a fine edge",
      940,
      164,
      260,
    ),
    rect("bezel-leader", 872, 184, 48, 1, "#607475"),
    rect("bezel-pin", 868, 181, 5, 5, amber),
    callout(
      "dial-callout",
      "02 / DIAL",
      "Every second, considered",
      68,
      281,
      260,
    ),
    rect("dial-leader", 326, 304, 66, 1, "#607475"),
    rect("dial-pin", 389, 301, 5, 5, amber),
    callout(
      "core-callout",
      "03 / MOVEMENT",
      "Independent. In harmony.",
      944,
      416,
      270,
    ),
    rect("core-leader", 862, 437, 62, 1, "#607475"),
    rect("core-pin", 858, 434, 5, 5, amber),
    callout(
      "case-callout",
      "04 / CASE",
      "Form follows precision",
      70,
      518,
      250,
    ),
    rect("case-leader", 322, 542, 98, 1, "#607475"),
    rect("case-pin", 417, 539, 5, 5, amber),
  ],
  {
    animations: [
      k("opacity", [
        [0, 0],
        [112, 0],
        [135, 1],
        [237, 1],
        [259, 0],
        [359, 0],
      ]),
    ],
  },
);
function chapter(id, from, duration, title, subtitle) {
  return group(
    id,
    [
      text(`${id}-headline`, title, 250, 90, 780, 32, ivory, {
        fontFamily: "Georgia, serif",
        textAlign: "center",
        letterSpacing: 1,
      }),
      text(`${id}-caption`, subtitle, 250, 133, 780, 11, muted, {
        textAlign: "center",
        letterSpacing: 2.2,
      }),
    ],
    {
      from,
      duration,
      animations: [
        k("opacity", [
          [0, 0],
          [15, 1],
          [duration - 20, 1],
          [duration - 1, 0],
        ]),
      ],
    },
  );
}
export const scene = {
  schemaVersion: 1,
  width: W,
  height: H,
  fps: 30,
  duration: D,
  assets: {},
  nodes: [
    group("precision-atmosphere", [
      {
        ...rect("precision-background", 0, 0, W, H, ink),
        style: {
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 48%, #344448 0%, #1C292D 42%, #101719 78%)",
        },
      },
      {
        id: "precision-shadow",
        type: "shape",
        shape: { kind: "ellipse" },
        style: {
          position: "absolute",
          left: 415,
          top: 556,
          width: 450,
          height: 58,
          fill: "rgba(0,0,0,0.3)",
          filter: "blur(18px)",
        },
      },
      rect("header-line", 64, 65, 1152, 1, "#405154"),
      rect("footer-line", 64, 649, 1152, 1, "#405154"),
    ]),
    instrument,
    annotation,
    group("precision-frame", [
      text("precision-brand", "P—01 / PRECISION", 64, 31, 400, 14, ivory, {
        letterSpacing: 3,
      }),
      text(
        "precision-edition",
        "A STUDY IN MECHANICAL HARMONY",
        790,
        33,
        426,
        10,
        muted,
        { textAlign: "right", letterSpacing: 2 },
      ),
      text(
        "precision-footer",
        "ORIGINAL CONCEPT / EDITABLE 3D ASSEMBLY",
        64,
        673,
        750,
        10,
        muted,
        { letterSpacing: 2 },
      ),
      text(
        "precision-footer-index",
        "DOJO / OBJECT STUDIES",
        840,
        673,
        376,
        10,
        amber,
        { textAlign: "right", letterSpacing: 2 },
      ),
    ]),
    chapter(
      "precision-opening",
      0,
      112,
      "Every part has a purpose.",
      "ONE INSTRUMENT. MANY PRECISE MOVEMENTS.",
    ),
    chapter(
      "precision-exploded",
      112,
      145,
      "Beauty, from the inside out.",
      "FOUR LAYERS. ONE CONTINUOUS MOTION.",
    ),
    chapter(
      "precision-ending",
      257,
      103,
      "Everything, in its place.",
      "DESIGNED TO WORK TOGETHER.",
    ),
  ],
};
export const metadata = {
  title: "Precision",
  description:
    "A mechanical timepiece opens into an exploded diagram and reassembles, with independently moving gear assemblies and hands.",
  posterFrame: 192,
  frames: [0, 50, 95, 145, 192, 230, 290, 335, 359],
};
export default scene;
