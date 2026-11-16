/**
 * AFTER HOURS — an original motion-poster study, built entirely from editable
 * Scene nodes and the engine's bounded Three.js layer. No images, external
 * models, shaders, footage, fonts or provider calls are used.
 *
 * Three acts: the invitation (0–4 s), the energy (4–8 s), the celebration
 * (8–12 s). All animation is baked into frame/second keyframes; seeking is pure.
 */
const WIDTH = 1280;
const HEIGHT = 720;
const DURATION = 360;
const palette = {
  ink: "#160d2d",
  purple: "#5920e5",
  pink: "#ff4daa",
  orange: "#ff783a",
  lime: "#e4ff67",
  cream: "#fff4e6",
};
const position = (left, top, width, height) => ({
  position: "absolute",
  left,
  top,
  width,
  height,
});
const track = (property, points) => ({
  kind: "keyframes",
  property,
  frames: points.map(([frame, value, easing]) => ({
    frame,
    value,
    ...(easing ? { easing } : {}),
  })),
});
const rect = (id, x, y, w, h, color, extra = {}) => ({
  id,
  type: "div",
  style: { ...position(x, y, w, h), backgroundColor: color, ...extra },
});
const type = (
  id,
  text,
  x,
  y,
  w,
  h,
  size,
  color = palette.cream,
  extra = {},
) => ({
  id,
  type: "text",
  text,
  style: {
    ...position(x, y, w, h),
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: size,
    fontWeight: 900,
    lineHeight: 1,
    color,
    textFit: "shrink",
    minFontSize: size - 2,
    maxLines: 1,
    ...extra,
  },
});

// A tiled disco sculpture: every tile is a separate editable mesh. Tiny gaps
// expose the violet sphere under the tiles. The three-dimensional rings and
// satellites share depth with the sphere instead of being flat image overlays.
const objects = {
  sculpture: {
    kind: "group",
    rotation: { x: 12, y: -18, z: -8 },
    spin: { x: 0, y: 23, z: 0 },
    keyframes: {
      "scale.x": [
        { time: 0, value: 0.72 },
        { time: 0.9, value: 1 },
        { time: 3.9, value: 1 },
        { time: 4.3, value: 1.06 },
        { time: 7.9, value: 1.06 },
        { time: 8.3, value: 0.94 },
        { time: 12, value: 0.94 },
      ],
      "scale.y": [
        { time: 0, value: 0.72 },
        { time: 0.9, value: 1 },
        { time: 3.9, value: 1 },
        { time: 4.3, value: 1.06 },
        { time: 7.9, value: 1.06 },
        { time: 8.3, value: 0.94 },
        { time: 12, value: 0.94 },
      ],
      "scale.z": [
        { time: 0, value: 0.72 },
        { time: 0.9, value: 1 },
        { time: 3.9, value: 1 },
        { time: 4.3, value: 1.06 },
        { time: 7.9, value: 1.06 },
        { time: 8.3, value: 0.94 },
        { time: 12, value: 0.94 },
      ],
    },
  },
  core: {
    kind: "mesh",
    parentId: "sculpture",
    geometry: { kind: "sphere", radius: 1.39 },
    materialId: "violet",
  },
  orbitPeach: {
    kind: "mesh",
    geometry: { kind: "torus", radius: 2.11, tube: 0.13 },
    materialId: "peach",
    rotation: { x: 65, y: 15, z: -22 },
    spin: { x: 6, y: 9, z: 12 },
  },
  orbitLime: {
    kind: "mesh",
    geometry: { kind: "torus", radius: 2.28, tube: 0.055 },
    materialId: "lime",
    rotation: { x: -20, y: 64, z: 35 },
    spin: { x: -6, y: 4, z: -9 },
  },
  satellites: { kind: "group", spin: { x: 7, y: -12, z: 10 } },
};
for (let row = 0; row < 8; row++) {
  const latitude = ((-70 + row * 20) * Math.PI) / 180;
  for (let column = 0; column < 12; column++) {
    const longitude = (column * Math.PI) / 6;
    objects[`tile_${row}_${column}`] = {
      kind: "mesh",
      parentId: "sculpture",
      geometry: {
        kind: "box",
        width: 0.66 * Math.cos(latitude),
        height: 0.435,
        depth: 0.045,
      },
      materialId: ["rose", "lavender", "ivory", "pink"][(column + row * 3) % 4],
      position: {
        x: Math.sin(longitude) * Math.cos(latitude) * 1.46,
        y: Math.sin(latitude) * 1.46,
        z: Math.cos(longitude) * Math.cos(latitude) * 1.46,
      },
      rotation: {
        x: (-latitude * 180) / Math.PI,
        y: (longitude * 180) / Math.PI,
        z: 0,
      },
    };
  }
}
for (let i = 0; i < 10; i++) {
  const angle = i * 2.399963;
  objects[`satellite_${i}`] = {
    kind: "mesh",
    parentId: "satellites",
    geometry: { kind: "sphere", radius: i % 3 === 0 ? 0.16 : 0.09 },
    materialId: i % 2 === 0 ? "lime" : "peach",
    position: {
      x: Math.cos(angle) * 2.43,
      y: Math.sin(angle) * 2.24,
      z: Math.sin(angle * 1.7) * 0.8,
    },
  };
}

const threeLayer = {
  id: "disco-sculpture",
  type: "extension",
  from: 0,
  duration: DURATION,
  style: { ...position(565, 30, 710, 650) },
  extension: {
    name: "dojo.three-scene",
    version: "1.0.0",
    params: {
      camera: {
        kind: "perspective",
        fov: 42,
        position: { x: 0, y: 0.1, z: 7.6 },
        target: { x: 0, y: 0, z: 0 },
        orbit: { degreesPerSecond: 2, phase: 0 },
      },
      lighting: {
        ambient: 1.25,
        intensity: 3.2,
        position: { x: -3, y: 5, z: 7 },
      },
      materials: {
        violet: { color: "#5723be", roughness: 0.45, metalness: 0.05 },
        rose: { color: "#ff99c8", roughness: 0.2, metalness: 0.12 },
        lavender: { color: "#a59bff", roughness: 0.2, metalness: 0.12 },
        ivory: { color: "#fff2d8", roughness: 0.22, metalness: 0.1 },
        pink: { color: "#ee4ba1", roughness: 0.28, metalness: 0.08 },
        peach: { color: "#ff8547", roughness: 0.26 },
        lime: { color: "#e6ff74", roughness: 0.35 },
      },
      objects,
    },
  },
  animations: [
    track("opacity", [
      [0, 0],
      [14, 1, "easeOut"],
    ]),
  ],
};

function act(index, first, second, footnote, color, size = 118) {
  const from = index * 120;
  return {
    id: `act-${index}`,
    type: "div",
    from,
    duration: 120,
    style: { ...position(64, 180, 560, 365) },
    children: [
      {
        ...type(`act-${index}-first`, first, 0, 0, 560, 132, size, color, {
          letterSpacing: -7,
        }),
        animations: [
          track("transform", [
            [0, "translate(0px, 65px)"],
            [18, "translate(0px, 0px)", "easeOut"],
          ]),
          track("opacity", [
            [0, 0],
            [8, 1],
          ]),
        ],
      },
      {
        ...type(`act-${index}-second`, second, 0, 112, 560, 132, size, color, {
          letterSpacing: -7,
        }),
        animations: [
          track("transform", [
            [0, "translate(0px, 65px)"],
            [6, "translate(0px, 65px)"],
            [24, "translate(0px, 0px)", "easeOut"],
          ]),
          track("opacity", [
            [0, 0],
            [6, 0],
            [14, 1],
          ]),
        ],
      },
      {
        ...type(
          `act-${index}-note`,
          footnote,
          4,
          274,
          490,
          35,
          19,
          palette.cream,
          { fontWeight: 400, letterSpacing: 0.1 },
        ),
        animations: [
          track("opacity", [
            [0, 0],
            [18, 0],
            [32, 1],
          ]),
        ],
      },
    ],
    animations: [
      track("opacity", [
        [0, 1],
        [106, 1],
        [119, 0, "easeIn"],
      ]),
      track("transform", [
        [0, "translate(0px, 0px)"],
        [106, "translate(0px, 0px)"],
        [119, "translate(0px, -20px)", "easeIn"],
      ]),
    ],
  };
}

// The pseudorandom-looking positions below are fixed arithmetic, not runtime
// randomness. Confetti stays in the sculpture's column so it cannot cover copy.
const confetti = Array.from({ length: 32 }, (_, i) => {
  const x = 650 + ((i * 137) % 560);
  const y = ((i * 91) % 740) - 50;
  const drift = 25 + ((i * 11) % 60);
  return {
    ...rect(
      `confetti-${i}`,
      x,
      y,
      i % 3 === 0 ? 7 : 11,
      i % 3 === 0 ? 22 : 6,
      [palette.pink, palette.lime, palette.orange, palette.cream][i % 4],
      {
        opacity: 0.8,
        borderRadius: i % 3 === 0 ? 4 : 0,
        transformOrigin: "center center",
      },
    ),
    animations: [
      track("transform", [
        [0, `translate(0px, -32px) rotate(${i * 23}deg)`],
        [180, `translate(${drift}px, 48px) rotate(${i * 23 + 180}deg)`],
        [359, `translate(0px, -32px) rotate(${i * 23 + 360}deg)`],
      ]),
      track("opacity", [
        [0, 0],
        [20 + i, 0.8],
        [330, 0.8],
        [359, 0],
      ]),
    ],
  };
});

export const scene = {
  schemaVersion: 1,
  width: WIDTH,
  height: HEIGHT,
  fps: 30,
  duration: DURATION,
  assets: {},
  nodes: [
    rect("backdrop", 0, 0, WIDTH, HEIGHT, palette.ink),
    {
      id: "ambient-wash",
      type: "div",
      style: {
        ...position(510, -180, 1000, 1080),
        background:
          "radial-gradient(circle at 50% 50%, #6424d1 0%, #32104f 47%, #160d2d 75%)",
      },
    },
    {
      ...rect("orange-disc", 725, 130, 390, 390, palette.orange, {
        borderRadius: 195,
        opacity: 0.94,
      }),
      animations: [
        track("transform", [
          [0, "scale(0.65)"],
          [30, "scale(1)", "easeOut"],
          [180, "scale(1.13)", "easeInOut"],
          [359, "scale(1)", "easeInOut"],
        ]),
      ],
    },
    {
      ...rect("halo", 662, 85, 510, 510, "transparent", {
        border: "1px solid #b880ff",
        borderRadius: 255,
        opacity: 0.7,
      }),
      animations: [
        track("transform", [
          [0, "scale(0.8)"],
          [359, "scale(1.14)"],
        ]),
      ],
    },
    ...confetti,
    threeLayer,
    type(
      "eyebrow",
      "DOJO  /  MOTION STUDIES",
      68,
      52,
      400,
      26,
      14,
      palette.cream,
      { fontWeight: 700, letterSpacing: 2.5 },
    ),
    type("edition", "VOL. 01", 1080, 52, 130, 26, 14, palette.cream, {
      fontWeight: 700,
      textAlign: "right",
      letterSpacing: 2.5,
    }),
    {
      ...rect("invite-pill", 68, 119, 194, 32, palette.lime, {
        borderRadius: 16,
      }),
      children: [
        type(
          "invite-pill-copy",
          "NO ORDINARY NIGHT",
          16,
          9,
          166,
          18,
          11,
          palette.ink,
          { fontWeight: 800, letterSpacing: 1.4 },
        ),
      ],
    },
    act(
      0,
      "AFTER",
      "HOURS",
      "Turn a moment into a celebration.",
      palette.cream,
      124,
    ),
    act(
      1,
      "GOOD",
      "ENERGY.",
      "A little color. A lot of possibility.",
      palette.lime,
      116,
    ),
    act(
      2,
      "MAKE",
      "SOME JOY.",
      "Your next big moment starts here.",
      palette.cream,
      103,
    ),
    rect("footer-rule", 68, 612, 1144, 1, "#654478"),
    type(
      "footer",
      "CELEBRATE THE POSSIBILITIES",
      68,
      638,
      500,
      28,
      13,
      palette.cream,
      { fontWeight: 700, letterSpacing: 2.7 },
    ),
    type(
      "footer-right",
      "BUILT TO MOVE  ↗",
      870,
      638,
      342,
      28,
      13,
      palette.lime,
      { fontWeight: 700, letterSpacing: 2.5, textAlign: "right" },
    ),
    ...Array.from({ length: 3 }, (_, i) => ({
      ...rect(`chapter-${i}`, 68 + i * 41, 569, 29, 4, palette.cream, {
        opacity: 0.2,
      }),
      animations: [
        track("opacity", [
          [0, i === 0 ? 1 : 0.2],
          ...(i > 0
            ? [
                [i * 120 - 1, 0.2],
                [i * 120, 1],
              ]
            : []),
          ...(i < 2
            ? [
                [(i + 1) * 120 - 1, 1],
                [(i + 1) * 120, 0.2],
              ]
            : []),
        ]),
      ],
    })),
  ],
};

export const metadata = {
  title: "After Hours",
  description:
    "An exuberant event identity: an editable Three.js disco sculpture, orbiting rings, floating confetti and three acts of kinetic typography.",
  posterFrame: 70,
  frames: [0, 30, 70, 145, 200, 275, 330, 359],
};
export default scene;
