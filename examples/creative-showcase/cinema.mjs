// DEEP FIELD: a cinematic title sequence built from editable luminous geometry.
// The tunnel moves through a fixed camera; every seek reconstructs the same space.
const W = 1280,
  H = 720,
  D = 360;
const motion = (property, points) => ({
  kind: "keyframes",
  property,
  frames: points.map(([frame, value, easing]) => ({
    frame,
    value,
    ...(easing ? { easing } : {}),
  })),
});
const box = (id, x, y, w, h, color, extra = {}) => ({
  id,
  type: "div",
  style: {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    backgroundColor: color,
    ...extra,
  },
});
const text = (id, value, x, y, w, size, color, extra = {}) => ({
  id,
  type: "text",
  text: value,
  style: {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: size * 1.5,
    fontFamily: "Arial",
    fontSize: size,
    fontWeight: 400,
    color,
    textAlign: "center",
    letterSpacing: 3,
    ...extra,
  },
});
const group = (id, children) => ({
  id,
  type: "div",
  from: 0,
  duration: D,
  style: { position: "absolute", inset: 0 },
  children,
});
const objects = {
  space: {
    kind: "group",
    keyframes: {
      "position.z": [
        { time: 0, value: -4 },
        { time: 12, value: 16 },
      ],
      "rotation.z": [
        { time: 0, value: -12 },
        { time: 12, value: 32 },
      ],
      "position.x": [
        { time: 0, value: 0.3 },
        { time: 6, value: -0.15 },
        { time: 12, value: 0.15 },
      ],
    },
  },
};
for (let i = 0; i < 20; i++) {
  const id = `gate${i}`;
  objects[id] = {
    kind: "group",
    parentId: "space",
    position: {
      x: Math.sin(i * 0.35) * 0.3,
      y: Math.cos(i * 0.4) * 0.2,
      z: 3 - i * 3.2,
    },
    rotation: { x: 0, y: 0, z: i * 6 },
  };
  const materialId = i % 5 === 0 ? "gold" : i % 2 ? "ice" : "teal";
  const width = 6.7,
    height = 4.3,
    thickness = 0.035 + (i % 3) * 0.015;
  for (const [side, x, y, w, h] of [
    ["top", 0, height / 2, width, thickness],
    ["bottom", 0, -height / 2, width, thickness],
    ["left", -width / 2, 0, thickness, height],
    ["right", width / 2, 0, thickness, height],
  ])
    objects[`${id}${side}`] = {
      kind: "mesh",
      parentId: id,
      geometry: { kind: "box", width: w, height: h, depth: 0.08 },
      position: { x, y, z: 0 },
      materialId,
    };
}
for (let i = 0; i < 20; i++) {
  const angle = i * 2.39996,
    r = 1.4 + (i % 4) * 0.65;
  objects[`spark${i}`] = {
    kind: "mesh",
    parentId: "space",
    geometry: {
      kind: "box",
      width: 0.012,
      height: 0.012,
      depth: 0.45 + (i % 3) * 0.2,
    },
    materialId: i % 3 ? "ice" : "gold",
    position: {
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r * 0.7,
      z: -i * 2.8,
    },
  };
}
const tunnel = {
  id: "light-tunnel",
  type: "extension",
  from: 0,
  duration: D,
  style: { position: "absolute", inset: 0 },
  extension: {
    name: "dojo.three-scene",
    version: "1.0.0",
    params: {
      camera: {
        kind: "perspective",
        position: { x: 0, y: 0, z: 7 },
        target: { x: 0, y: 0, z: -40 },
        fov: 64,
      },
      materials: {
        teal: { color: "#178A96", unlit: true },
        ice: { color: "#86E8E2", unlit: true },
        gold: { color: "#DAAE70", unlit: true },
      },
      objects,
      lighting: { ambient: 1, intensity: 0, position: { x: 0, y: 0, z: 8 } },
    },
  },
};
const title = (id, from, duration, children) => ({
  id,
  type: "div",
  from,
  duration,
  style: { position: "absolute", inset: 0 },
  children,
  animations: [
    motion("opacity", [
      [0, 0],
      [25, 1, "easeOut"],
      [duration - 25, 1],
      [duration - 1, 0, "easeIn"],
    ]),
    motion("transform", [
      [0, "scale(0.94)"],
      [duration - 1, "scale(1.06)"],
    ]),
  ],
});
export const scene = {
  schemaVersion: 1,
  width: W,
  height: H,
  fps: 30,
  duration: D,
  assets: {},
  nodes: [
    group("atmosphere", [
      box("black-space", 0, 0, W, H, "#030D15"),
      {
        ...box("horizon-light", 0, 0, W, H, "transparent"),
        style: {
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 50%, #164B53 0%, #071C28 42%, #02090F 80%)",
        },
      },
    ]),
    tunnel,
    group("lens-and-letterbox", [
      {
        ...box("center-scrim", 0, 0, W, H, "transparent"),
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: H,
          background:
            "radial-gradient(circle at 50% 50%, rgba(2,9,15,0.7) 0%, rgba(2,9,15,0) 65%)",
        },
      },
      box("top-matte", 0, 0, W, 68, "#02070B"),
      box("bottom-matte", 0, 652, W, 68, "#02070B"),
      box("top-rule", 70, 67, 1140, 1, "#28414A"),
      box("bottom-rule", 70, 652, 1140, 1, "#28414A"),
      text(
        "film-label",
        "D O J O   /   M O T I O N   P I C T U R E S",
        100,
        28,
        1080,
        11,
        "#7C9A9E",
      ),
      text(
        "film-footer",
        "LIGHT   /   SPACE   /   POSSIBILITY",
        100,
        680,
        1080,
        10,
        "#7C9A9E",
      ),
    ]),
    title("prologue", 0, 95, [
      text(
        "invitation",
        "EVERY FRAME IS A NEW FRONTIER",
        140,
        338,
        1000,
        20,
        "#D7E8E6",
        { letterSpacing: 5 },
      ),
    ]),
    title("main-title", 80, 205, [
      text("film-title", "DEEP FIELD", 65, 282, 1150, 104, "#F1EEE1", {
        fontFamily: "Georgia, serif",
        letterSpacing: 12,
        textShadow: "0px 4px 24px #02070B",
        fontWeight: 400,
      }),
      box("title-underline", 591, 430, 98, 1, "#BDA375"),
      text(
        "film-tagline",
        "A JOURNEY BEYOND THE FRAME",
        150,
        457,
        980,
        13,
        "#C2D3D0",
        { letterSpacing: 5 },
      ),
    ]),
    title("epilogue", 282, 78, [
      text(
        "closing-line",
        "THE POSSIBILITIES ARE INFINITE",
        120,
        337,
        1040,
        19,
        "#F1EEE1",
        { letterSpacing: 5 },
      ),
    ]),
  ],
};
export const metadata = {
  title: "Deep Field",
  description: "Cinematic titles inside a moving architectural light tunnel.",
  posterFrame: 185,
  frames: [0, 45, 105, 150, 185, 240, 315, 359],
};
export default scene;
