/** CHROMA BLOOM — an original kinetic vector sculpture.
 * All surfaces are editable cubic-bezier paths. Gradients, overlapping layers
 * and native transform keyframes create depth without images or custom code.
 */
const W = 1280,
  H = 720,
  D = 360;
const key = (property, values) => ({
  kind: "keyframes",
  property,
  frames: values.map(([frame, value, easing]) => ({
    frame,
    value,
    ...(easing ? { easing } : {}),
  })),
});
const full = (id, children, animations = []) => ({
  id,
  type: "div",
  from: 0,
  duration: D,
  style: { position: "absolute", left: 0, top: 0, width: W, height: H },
  children,
  animations,
});
const shape = (id, d, fill, extra = {}) => ({
  id,
  type: "shape",
  shape: {
    kind: "path",
    d,
    viewBox: { x: -360, y: -360, width: 720, height: 720 },
  },
  style: {
    position: "absolute",
    left: 280,
    top: 0,
    width: 720,
    height: 720,
    fill,
    transformOrigin: "center center",
    ...extra,
  },
});
const label = (id, value, x, y, width, size, color, extra = {}) => ({
  id,
  type: "text",
  text: value,
  style: {
    position: "absolute",
    left: x,
    top: y,
    width,
    height: size * 1.45,
    fontFamily: "Arial",
    fontSize: size,
    fontWeight: 600,
    letterSpacing: 2.5,
    color,
    ...extra,
  },
});
const field = full("bloom-atmosphere", [
  {
    id: "night-ground",
    type: "div",
    style: {
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(circle at 50% 50%, #24213C 0%, #141526 45%, #090C18 100%)",
    },
  },
  ...Array.from({ length: 64 }, (_, i) => ({
    id: `pin-${i}`,
    type: "shape",
    shape: { kind: "ellipse" },
    style: {
      position: "absolute",
      left: 60 + ((i * 197) % 1160),
      top: 72 + ((i * 137) % 575),
      width: i % 7 === 0 ? 2.4 : 1.2,
      height: i % 7 === 0 ? 2.4 : 1.2,
      fill: i % 3 ? "#636279" : "#DDBCA5",
      opacity: 0.22 + (i % 4) * 0.08,
    },
    animations: [
      key("opacity", [
        [0, 0.2],
        [90 + i, 0.6],
        [250 + i, 0.18],
        [359, 0.3],
      ]),
    ],
  })),
]);

// Delicate contour lines surround the sculpture, like a field drawn by its motion.
const traces = full(
  "bloom-contour-field",
  Array.from({ length: 18 }, (_, i) => {
    const r = 285 + i * 8;
    const d = `M ${-r} 0 C ${-r} ${-r * 0.72} ${r * 0.56} ${-r * 0.91} ${r} ${-r * 0.12} C ${r * 1.12} ${r * 0.43} ${-r * 0.15} ${r * 0.95} ${-r * 0.88} ${r * 0.27}`;
    return {
      ...shape(`contour-${i}`, d, "transparent", {
        stroke: i % 3 ? "#494067" : "#7B627F",
        strokeWidth: 0.7,
        opacity: 0.2,
      }),
      animations: [
        key("transform", [
          [0, `rotate(${i * 2}deg) scale(1.32, 0.72)`],
          [179, `rotate(${i * 2 + 30}deg) scale(1.1, 0.91)`],
          [359, `rotate(${i * 2 + 80}deg) scale(1.32, 0.72)`],
        ]),
        key("opacity", [
          [0, 0.06],
          [70, 0.26],
          [220, 0.16],
          [359, 0.22],
        ]),
      ],
    };
  }),
);

const leaf =
  "M 0 -24 C -28 -81 -130 -192 -25 -312 C 81 -279 125 -150 58 -70 C 40 -48 14 -30 0 -24 Z";
const ridge = "M -14 -49 C -8 -118 -76 -218 -25 -298";
const palettes = {
  outer: [
    ["#3924C2", "#E958E0", "#FFBDA4"],
    ["#34268A", "#9B55DF", "#FF786C"],
    ["#4132A7", "#E747A1", "#FFD49C"],
  ],
  middle: [
    ["#861E7D", "#FA5E8C", "#FFE5A8"],
    ["#4730C8", "#B77EEB", "#FFB8C9"],
    ["#A83273", "#FF8B6B", "#FFE6AD"],
  ],
  inner: [
    ["#0E4A7E", "#4FBBDE", "#B6F1CA"],
    ["#343EAB", "#79C5EB", "#F4E8B5"],
    ["#153A75", "#42ACC8", "#D7F3DA"],
  ],
};

function petalRing(id, count, scale, offset, direction, paletteName) {
  return full(
    id,
    Array.from({ length: count }, (_, i) => {
      const base = (i * 360) / count + offset;
      const [shade, middle, tip] = palettes[paletteName][i % 3];
      const delay = i * 2;
      const transform = (angle, s, stretch = 1) =>
        `rotate(${angle}deg) scale(${s}, ${s * stretch})`;
      return {
        id: `${id}-petal-${i}`,
        type: "div",
        style: {
          position: "absolute",
          inset: 0,
          transformOrigin: "center center",
        },
        children: [
          shape(
            `${id}-surface-${i}`,
            leaf,
            `linear-gradient(165deg, ${tip} 0%, ${middle} 34%, ${shade} 72%, #17152D 100%)`,
            {
              stroke: "rgba(255,215,235,0.15)",
              strokeWidth: 0.55,
            },
          ),
          shape(`${id}-ridge-${i}`, ridge, "transparent", {
            stroke: "rgba(255,239,222,0.38)",
            strokeWidth: 0.65,
            strokeLineCap: "round",
          }),
        ],
        animations: [
          key("transform", [
            [0, transform(base - direction * 24, scale * 0.21)],
            [
              delay + 46,
              transform(base, scale * 0.95),
              "cubic-bezier(0.2, 0.8, 0.2, 1)",
            ],
            [
              120,
              transform(base + direction * 24, scale * 1.06, 0.93),
              "easeInOut",
            ],
            [
              205,
              transform(base + direction * 80, scale * 0.78, 1.16),
              "easeInOut",
            ],
            [285, transform(base + direction * 135, scale * 1.04), "easeInOut"],
            [
              359,
              transform(base + direction * 190, scale * 0.96, 1.04),
              "easeInOut",
            ],
          ]),
          key("opacity", [
            [0, 0],
            [delay + 22, 0.96, "easeOut"],
            [359, 0.96],
          ]),
        ],
      };
    }),
  );
}

const sculpture = full(
  "bloom-vector-sculpture",
  [
    petalRing("outer-corolla", 24, 1.02, -10, 1, "outer"),
    petalRing("middle-corolla", 20, 0.77, 8, -1, "middle"),
    petalRing("inner-corolla", 16, 0.5, 2, 1, "inner"),
    ...Array.from({ length: 12 }, (_, i) => ({
      ...shape(
        `seed-${i}`,
        "M 0 -2 C -12 -14 -15 -39 0 -53 C 15 -39 12 -14 0 -2 Z",
        "linear-gradient(180deg, #FFF2C8 0%, #73D9C9 46%, #245B93 100%)",
      ),
      animations: [
        key("transform", [
          [0, `rotate(${i * 30}deg) scale(0.1)`],
          [80, `rotate(${i * 30}deg) scale(1)`, "easeOut"],
          [359, `rotate(${i * 30 + 220}deg) scale(1.08)`],
        ]),
      ],
    })),
    {
      id: "heart",
      type: "shape",
      shape: { kind: "ellipse" },
      style: {
        position: "absolute",
        left: 630,
        top: 350,
        width: 20,
        height: 20,
        fill: "radial-gradient(circle at 35% 30%, #F5F2CC 0%, #7BCBCA 45%, #2E567C 100%)",
      },
    },
  ],
  [
    key("transform", [
      [0, "scale(1, 1)"],
      [110, "scale(1.04, 0.96)", "easeInOut"],
      [205, "scale(1.18, 0.78)", "easeInOut"],
      [300, "scale(1, 1.02)", "easeInOut"],
      [359, "scale(1.03, 0.98)", "easeInOut"],
    ]),
  ],
);

const marks = full("bloom-editorial-marks", [
  label("edition", "DOJO / GENERATIVE STUDIES", 52, 38, 420, 11, "#BFB8CD"),
  label("serial", "NO. 009", 1050, 38, 178, 11, "#BFB8CD", {
    textAlign: "right",
  }),
  label("bloom-name", "CHROMA BLOOM", 52, 639, 490, 29, "#EBDDDC", {
    fontWeight: 400,
    letterSpacing: 4,
  }),
  label(
    "bloom-detail",
    "SIXTY PETALS. ONE CONTINUOUS MOTION.",
    54,
    685,
    650,
    9,
    "#877F98",
    { letterSpacing: 2 },
  ),
  label(
    "bloom-note",
    "NATIVE VECTORS\nIN FULL BLOOM",
    980,
    654,
    248,
    10,
    "#BFB8CD",
    { textAlign: "right", height: 40, lineHeight: 1.6 },
  ),
  {
    id: "edition-line",
    type: "div",
    style: {
      position: "absolute",
      left: 52,
      top: 73,
      width: 1176,
      height: 1,
      backgroundColor: "#373346",
      opacity: 0.7,
    },
  },
]);

export const scene = {
  schemaVersion: 1,
  width: W,
  height: H,
  fps: 30,
  duration: D,
  assets: {},
  nodes: [field, traces, sculpture, marks],
};
export const metadata = {
  title: "Chroma Bloom",
  description:
    "An unfolding kinetic sculpture of sixty gradient-filled bezier petals and counter-rotating vector waves.",
  posterFrame: 285,
  frames: [0, 30, 75, 120, 180, 225, 285, 330, 359],
};
export default scene;
