/**
 * ORBIT — an original, fictional company launch. No external media or fonts.
 * Three editorial chapters share the same sculptural motif. Every visible
 * element remains a native Scene node or an editable Three.js object.
 */
const W = 1280;
const H = 720;
const FPS = 30;
const CHAPTER = 120;
const ivory = "#F3F1E9";
const ink = "#152039";
const cobalt = "#244EFF";
const lime = "#D8FD7B";

const track = (property, points) => ({
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
const text = (id, content, x, y, width, size, color, extra = {}) => ({
  id,
  type: "text",
  text: content,
  style: {
    position: "absolute",
    left: x,
    top: y,
    width,
    height: size * 1.28,
    color,
    fontFamily: "Arial",
    fontWeight: 700,
    fontSize: size,
    lineHeight: 1.08,
    letterSpacing: -size * 0.045,
    ...extra,
  },
});

// All children of a chapter use that chapter's local clock. Entrances are
// described once and attached to groups, so their copy moves as one layout.
const entrance = () => [
  track("opacity", [
    [0, 0],
    [19, 1, "easeOut"],
  ]),
  track("transform", [
    [0, "translate(0px, 42px)"],
    [27, "translate(0px, 0px)", "cubic-bezier(0.2, 0.8, 0.2, 1)"],
  ]),
];
const group = (id, children, animations = []) => ({
  id,
  type: "div",
  style: { position: "absolute", left: 0, top: 0, width: W, height: H },
  children,
  animations,
});

function sculpture(id, chapter) {
  const objects = {
    assembly: {
      kind: "group",
      rotation: { x: -12, y: 18, z: -24 },
      spin: { x: 8, y: 18, z: 4 },
    },
    blueOrbit: {
      kind: "mesh",
      parentId: "assembly",
      geometry: { kind: "torus", radius: 1.53, tube: 0.27 },
      materialId: "blue",
      rotation: { x: 18, y: 10, z: -8 },
    },
    pearlOrbit: {
      kind: "mesh",
      parentId: "assembly",
      geometry: { kind: "torus", radius: 1.47, tube: 0.18 },
      materialId: "pearl",
      rotation: { x: 75, y: 48, z: 35 },
      spin: { x: 0, y: 9, z: 0 },
    },
    fineOrbit: {
      kind: "mesh",
      parentId: "assembly",
      geometry: { kind: "torus", radius: 2.03, tube: 0.023 },
      materialId: "line",
      rotation: { x: 45, y: -32, z: 24 },
      spin: { x: 0, y: 0, z: 13 },
    },
    nucleus: {
      kind: "mesh",
      parentId: "assembly",
      geometry: { kind: "sphere", radius: 0.58 },
      materialId: "pearl",
    },
    outerOrbit: {
      kind: "group",
      parentId: "assembly",
      rotation: { x: 45, y: -32, z: 24 },
      spin: { x: 0, y: 0, z: 32 },
    },
    brightSatellite: {
      kind: "mesh",
      parentId: "outerOrbit",
      geometry: { kind: "sphere", radius: 0.23 },
      materialId: "accent",
      position: { x: 2.03, y: 0, z: 0 },
    },
    blueSatellite: {
      kind: "mesh",
      parentId: "outerOrbit",
      geometry: { kind: "sphere", radius: 0.14 },
      materialId: "blue",
      position: { x: -2.03, y: 0, z: 0 },
    },
    innerOrbit: {
      kind: "group",
      parentId: "assembly",
      rotation: { x: 18, y: 10, z: -8 },
      spin: { x: 0, y: 0, z: -40 },
    },
    innerSatellite: {
      kind: "mesh",
      parentId: "innerOrbit",
      geometry: { kind: "sphere", radius: 0.18 },
      materialId: "accent",
      position: { x: 1.53, y: 0, z: 0 },
    },
  };
  return {
    id,
    type: "extension",
    style: {
      position: "absolute",
      left: 592,
      top: 84,
      width: 650,
      height: 574,
    },
    animations: [
      track("opacity", [
        [0, 0],
        [16, 1, "easeOut"],
      ]),
      track("transform", [
        [0, "scale(0.82)"],
        [37, "scale(1)", "cubic-bezier(0.2, 0.8, 0.2, 1)"],
        [119, "scale(1.04)"],
      ]),
    ],
    extension: {
      name: "dojo.three-scene",
      version: "1.0.0",
      params: {
        camera: {
          kind: "perspective",
          position: { x: 0, y: 0.55, z: 7.1 },
          target: { x: 0, y: 0, z: 0 },
          fov: 43,
          orbit: { degreesPerSecond: 5, phase: chapter * 18 },
        },
        lighting: {
          ambient: 1.65,
          intensity: 3.1,
          position: { x: -4, y: 5, z: 6 },
        },
        materials: {
          blue: {
            color: chapter === 2 ? "#92B2FF" : cobalt,
            roughness: 0.22,
            metalness: 0.12,
          },
          pearl: { color: "#FFFFFF", roughness: 0.27, metalness: 0.08 },
          line: {
            color: chapter === 0 ? "#6A7894" : "#B9C8EF",
            roughness: 0.5,
            metalness: 0.1,
          },
          accent: { color: lime, roughness: 0.31, metalness: 0 },
        },
        objects,
        timeOffset: chapter * 4,
      },
    },
  };
}

function brand(id, color, mark) {
  return group(id, [
    {
      id: `${id}-symbol`,
      type: "shape",
      shape: { kind: "ellipse" },
      style: {
        position: "absolute",
        left: 74,
        top: 46,
        width: 24,
        height: 24,
        fill: "transparent",
        stroke: mark,
        strokeWidth: 5,
      },
    },
    text(`${id}-name`, "ORBIT", 111, 40, 180, 29, color, {
      letterSpacing: 1.2,
    }),
  ]);
}

function chapter(index, background, foreground, eyebrow, lines, caption) {
  const id = `orbit-chapter-${index + 1}`;
  const dark = index > 0;
  const muted = dark ? "#BDCAEE" : "#687087";
  const headline = group(
    `${id}-headline`,
    [
      text(
        `${id}-eyebrow`,
        eyebrow,
        76,
        182,
        520,
        13,
        index === 0 ? cobalt : lime,
        { letterSpacing: 2.5 },
      ),
      text(
        `${id}-line-one`,
        lines[0],
        69,
        238,
        580,
        index === 1 ? 73 : 87,
        foreground,
      ),
      text(
        `${id}-line-two`,
        lines[1],
        69,
        333,
        580,
        index === 1 ? 73 : 87,
        foreground,
      ),
      rect(`${id}-accent`, 76, 452, 54, 4, index === 0 ? cobalt : lime),
      text(`${id}-caption`, caption, 76, 481, 465, 20, muted, {
        fontWeight: 400,
        letterSpacing: 0,
        height: 62,
        lineHeight: 1.4,
      }),
    ],
    entrance(),
  );
  return {
    ...group(id, [
      rect(`${id}-background`, 0, 0, W, H, background),
      // Fine editorial hairlines and a large outline orbit give the abstract
      // 3D object a designed context rather than a floating demo viewport.
      rect(
        `${id}-header-rule`,
        76,
        100,
        1128,
        1,
        dark ? "#FFFFFF25" : "#15203920",
      ),
      rect(
        `${id}-footer-rule`,
        76,
        627,
        1128,
        1,
        dark ? "#FFFFFF25" : "#15203920",
      ),
      brand(`${id}-brand`, foreground, index === 0 ? cobalt : lime),
      text(`${id}-top-right`, "A SHARED VISION", 936, 51, 268, 12, muted, {
        letterSpacing: 2.4,
        textAlign: "right",
      }),
      sculpture(`${id}-sculpture`, index),
      headline,
      text(
        `${id}-footer`,
        "IDEAS BECOME POSSIBLE TOGETHER",
        76,
        653,
        600,
        11,
        muted,
        { letterSpacing: 2 },
      ),
      text(
        `${id}-chapter-number`,
        `0${index + 1} / 03`,
        1116,
        650,
        88,
        13,
        muted,
        { letterSpacing: 1, textAlign: "right" },
      ),
      rect(
        `${id}-progress-track`,
        76,
        609,
        1128,
        2,
        dark ? "#FFFFFF18" : "#15203912",
      ),
      {
        ...rect(`${id}-progress`, 76, 609, 0, 2, index === 0 ? cobalt : lime),
        animations: [
          track("width", [
            [0, 0],
            [119, 1128],
          ]),
        ],
      },
    ]),
    from: index * CHAPTER,
    duration: CHAPTER,
  };
}

export const scene = {
  schemaVersion: 1,
  width: W,
  height: H,
  fps: FPS,
  duration: CHAPTER * 3,
  assets: {},
  markers: { introduction: 0, connection: CHAPTER, launch: CHAPTER * 2 },
  nodes: [
    chapter(
      0,
      ivory,
      ink,
      "INTRODUCING ORBIT",
      ["Great ideas.", "Start here."],
      "A place for people, ideas\nand the possibilities between them.",
    ),
    chapter(
      1,
      ink,
      ivory,
      "BRING YOUR PERSPECTIVE",
      ["Different minds.", "One direction."],
      "Connect the dots. Share the vision.\nMake something that moves us.",
    ),
    chapter(
      2,
      cobalt,
      "#FFFFFF",
      "THE NEXT CHAPTER",
      ["Move forward.", "Together."],
      "Your next big idea\nhas good company.",
    ),
  ],
};

export const metadata = {
  title: "ORBIT — Better together",
  description:
    "An original fictional company launch: sculptural 3D rings, orbiting satellites and three editorial chapters in ivory, ink and cobalt.",
  posterFrame: 300,
  frames: [35, 82, 155, 202, 275, 330],
};

export default scene;
