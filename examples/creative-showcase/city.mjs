/** LITTLE WORLDS — an original editable miniature city, built one detail at a time. */
const W = 1280,
  H = 720,
  D = 360;
const objects = {};
const materials = {
  slab: { color: "#8071A2", roughness: 0.75 },
  pavement: { color: "#E7DBCE", roughness: 0.85 },
  curb: { color: "#FFF0D8", roughness: 0.8 },
  road: { color: "#424959", roughness: 0.9 },
  markings: { color: "#F2DFAF", unlit: true },
  lilac: { color: "#A193C8", roughness: 0.7 },
  coral: { color: "#E68F7E", roughness: 0.65 },
  cream: { color: "#F2D5A6", roughness: 0.7 },
  teal: { color: "#3C7779", roughness: 0.7 },
  roof: { color: "#3B4C64", roughness: 0.8 },
  white: { color: "#F3EBDC", roughness: 0.7 },
  window: { color: "#FFE8AD", unlit: true },
  glass: { color: "#37576C", roughness: 0.2, metalness: 0.15 },
  park: { color: "#92B69A", roughness: 0.9 },
  green: { color: "#417B72", roughness: 0.8 },
  mint: { color: "#80B995", roughness: 0.8 },
  wood: { color: "#947057", roughness: 0.9 },
  water: { color: "#78C6C8", roughness: 0.15, metalness: 0.15 },
  tire: { color: "#293544", roughness: 0.9 },
  amber: { color: "#F5B968", roughness: 0.5 },
  light: { color: "#FFF2C8", unlit: true },
};
const vector = (x, y, z) => ({ x, y, z });
const channel = (points) => points.map(([time, value]) => ({ time, value }));
const mesh = (id, geometry, materialId, x, y, z, extra = {}) => {
  objects[id] = {
    kind: "mesh",
    geometry,
    materialId,
    position: vector(x, y, z),
    ...extra,
  };
};
const box = (id, w, h, d, mat, x, y, z, extra = {}) =>
  mesh(id, { kind: "box", width: w, height: h, depth: d }, mat, x, y, z, extra);
const sphere = (id, r, mat, x, y, z, extra = {}) =>
  mesh(id, { kind: "sphere", radius: r }, mat, x, y, z, extra);
const cylinder = (id, r, h, mat, x, y, z, extra = {}) =>
  mesh(
    id,
    { kind: "cylinder", radiusTop: r, radiusBottom: r, height: h },
    mat,
    x,
    y,
    z,
    extra,
  );
const quad = (out, a, b, c, d) => out.push(...a, ...b, ...c, ...a, ...c, ...d);
const horizontal = (out, x, y, z, w, d) =>
  quad(
    out,
    [x - w / 2, y, z - d / 2],
    [x + w / 2, y, z - d / 2],
    [x + w / 2, y, z + d / 2],
    [x - w / 2, y, z + d / 2],
  );
const triangleMesh = (id, positions, mat, extra = {}) =>
  mesh(id, { kind: "triangles", positions }, mat, 0, 0, 0, extra);
const parentId = "world";
objects.world = {
  kind: "group",
  keyframes: {
    "rotation.y": channel([
      [0, -6],
      [12, 5],
    ]),
    "position.y": channel([
      [0, -0.15],
      [3, 0],
      [7, 0.06],
      [12, 0],
    ]),
  },
};
const world = { parentId };

// A cross-axis street plan with a quiet garden quarter. The beveled-looking
// stepped base is real geometry, rather than a picture of a diorama.
box("floatingSlab", 9.7, 0.42, 7.5, "slab", 0, -0.31, 0, world);
box("islandTop", 9.5, 0.18, 7.3, "pavement", 0, -0.02, 0, world);
box("eastWestStreet", 9.5, 0.018, 0.85, "road", 0, 0.08, 0.1, world);
box("northSouthStreet", 0.82, 0.02, 7.3, "road", 0.28, 0.081, 0, world);
box("northSidewalk", 9.5, 0.035, 0.22, "curb", 0, 0.095, -0.44, world);
box("southSidewalk", 9.5, 0.035, 0.22, "curb", 0, 0.095, 0.65, world);
box("westSidewalk", 0.2, 0.035, 7.3, "curb", -0.23, 0.095, 0, world);
box("eastSidewalk", 0.2, 0.035, 7.3, "curb", 0.79, 0.095, 0, world);
box("gardenQuarter", 3.35, 0.045, 2.75, "park", 2.8, 0.11, 2.05, world);
const markings = [];
for (let i = 0; i < 12; i++)
  horizontal(markings, -4.25 + i * 0.76, 0.105, 0.1, 0.35, 0.035);
for (let i = 0; i < 9; i++)
  horizontal(markings, 0.28, 0.107, -3.1 + i * 0.76, 0.035, 0.34);
for (let i = 0; i < 5; i++) {
  horizontal(markings, -0.75, 0.11, -0.25 + i * 0.17, 0.55, 0.075);
  horizontal(markings, 1.19, 0.11, -0.25 + i * 0.17, 0.55, 0.075);
}
triangleMesh("roadMarkings", markings, "markings", world);

function building(
  id,
  x,
  z,
  w,
  d,
  h,
  color,
  start,
  { cap = "roof", columns = 3, rows = 4 } = {},
) {
  objects[id] = {
    kind: "group",
    parentId,
    position: vector(x, 0.14, z),
    keyframes: {
      "scale.y": channel([
        [0, 0.001],
        [start, 0.001],
        [start + 0.65, 1.06],
        [start + 0.95, 1],
      ]),
      "position.y": channel([
        [0, 0.08],
        [start, 0.08],
        [start + 0.9, 0.14],
      ]),
    },
  };
  const part = { parentId: id };
  box(`${id}Body`, w, h, d, color, 0, h / 2, 0, part);
  box(`${id}Plinth`, w + 0.09, 0.1, d + 0.09, "white", 0, 0.05, 0, part);
  box(`${id}Roof`, w + 0.12, 0.11, d + 0.12, cap, 0, h + 0.035, 0, part);
  const warm = [],
    dark = [];
  const windowW = ((w - 0.35) / columns) * 0.57,
    windowH = Math.min(0.32, ((h - 0.38) / rows) * 0.54);
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const x0 = -w / 2 + 0.17 + ((col + 0.5) * (w - 0.34)) / columns;
      const y0 = 0.32 + ((row + 0.5) * (h - 0.4)) / rows;
      const arr = (row + col) % 4 === 0 ? dark : warm;
      quad(
        arr,
        [x0 - windowW / 2, y0 - windowH / 2, d / 2 + 0.006],
        [x0 + windowW / 2, y0 - windowH / 2, d / 2 + 0.006],
        [x0 + windowW / 2, y0 + windowH / 2, d / 2 + 0.006],
        [x0 - windowW / 2, y0 + windowH / 2, d / 2 + 0.006],
      );
      const z0 = -d / 2 + 0.16 + ((col + 0.5) * (d - 0.32)) / columns;
      quad(
        arr,
        [w / 2 + 0.006, y0 - windowH / 2, z0 - windowW / 2],
        [w / 2 + 0.006, y0 - windowH / 2, z0 + windowW / 2],
        [w / 2 + 0.006, y0 + windowH / 2, z0 + windowW / 2],
        [w / 2 + 0.006, y0 + windowH / 2, z0 - windowW / 2],
      );
    }
  triangleMesh(`${id}WarmWindows`, warm, "window", part);
  triangleMesh(`${id}GlassWindows`, dark, "glass", part);
  box(`${id}Entrance`, 0.29, 0.45, 0.025, "glass", 0, 0.24, d / 2 + 0.02, part);
}
building("roseHotel", -3.3, -2.07, 1.45, 1.42, 1.9, "coral", 0.65, { rows: 4 });
building("violetTower", -1.45, -2.18, 1.35, 1.5, 3.18, "lilac", 1.1, {
  rows: 6,
});
building("sunHouse", 1.65, -2.12, 1.38, 1.45, 2.5, "cream", 1.5, { rows: 5 });
building("tealStudio", 3.52, -2.15, 1.35, 1.4, 1.7, "teal", 2.0, {
  rows: 3,
  cap: "cream",
});
building("cornerCafe", -3.25, 2.02, 1.6, 1.3, 1.05, "cream", 2.4, {
  rows: 2,
  cap: "coral",
});
building("neighborhoodGallery", -1.34, 2.05, 1.15, 1.4, 1.4, "white", 2.75, {
  rows: 3,
  columns: 2,
  cap: "teal",
});
box("hotelRoofHouse", 0.75, 0.35, 0.82, "cream", 0, 2.13, -0.1, {
  parentId: "roseHotel",
});
box("towerCrown", 0.88, 0.27, 0.95, "white", 0, 3.38, 0, {
  parentId: "violetTower",
});
box("towerAntenna", 0.045, 0.5, 0.045, "roof", 0, 3.76, 0, {
  parentId: "violetTower",
});
sphere("towerBeacon", 0.065, "light", 0, 4.02, 0, { parentId: "violetTower" });
box("studioRoofTerrace", 0.72, 0.08, 0.8, "park", 0, 1.82, 0, {
  parentId: "tealStudio",
});
box("cafeAwning", 1.7, 0.09, 0.55, "coral", 0, 0.76, 0.8, {
  parentId: "cornerCafe",
  rotation: vector(-9, 0, 0),
});

// Repeated window rows share one native triangle mesh per material. Trees and
// street furniture remain independently named editable objects.
const treePositions = [
  [-4.21, -3.1],
  [-4.2, 2.7],
  [-2.35, 3.02],
  [-0.85, 3.02],
  [1.52, 2.9],
  [4.1, 2.8],
  [4.1, 1.1],
  [2.2, 1.07],
];
treePositions.forEach(([x, z], i) => {
  const height = 0.75 + (i % 3) * 0.13,
    time = 3 + i * 0.13;
  box(`tree${i}Trunk`, 0.1, 0.48, 0.1, "wood", x, 0.37, z, world);
  sphere(
    `tree${i}Crown`,
    0.34 + (i % 2) * 0.035,
    i % 3 === 0 ? "mint" : "green",
    x,
    height,
    z,
    {
      parentId,
      scale: vector(1, 1.2, 1),
      keyframes: {
        "scale.x": channel([
          [0, 0.001],
          [time, 0.001],
          [time + 0.5, 1],
        ]),
        "scale.y": channel([
          [0, 0.001],
          [time, 0.001],
          [time + 0.5, 1.2],
        ]),
        "scale.z": channel([
          [0, 0.001],
          [time, 0.001],
          [time + 0.5, 1],
        ]),
      },
    },
  );
});
cylinder("fountainBasin", 0.6, 0.16, "white", 2.85, 0.24, 2.03, world);
cylinder("fountainWater", 0.51, 0.025, "water", 2.85, 0.333, 2.03, world);
cylinder("fountainColumn", 0.09, 0.4, "white", 2.85, 0.54, 2.03, world);
sphere("fountainPearl", 0.16, "water", 2.85, 0.78, 2.03, world);
for (const [i, x, z] of [
  [0, 1.65, 1.7],
  [1, 3.85, 2.0],
]) {
  box(`bench${i}Seat`, 0.55, 0.08, 0.22, "wood", x, 0.37, z, world);
  box(`bench${i}Back`, 0.55, 0.25, 0.045, "wood", x, 0.49, z - 0.1, world);
}
for (const [i, x, z] of [
  [0, -4.0, -0.7],
  [1, -1.0, -0.7],
  [2, 1.05, 0.92],
  [3, 4.2, -0.7],
]) {
  cylinder(`lamp${i}Pole`, 0.035, 0.72, "roof", x, 0.5, z, world);
  sphere(`lamp${i}Globe`, 0.12, "light", x, 0.92, z, world);
}
function car(id, mat, z, start, end) {
  objects[id] = {
    kind: "group",
    parentId,
    position: vector(start, 0.22, z),
    keyframes: {
      "position.x": channel([
        [0, start],
        [3, start + 0.1],
        [12, end],
      ]),
    },
  };
  const part = { parentId: id };
  box(`${id}Body`, 0.63, 0.18, 0.29, mat, 0, 0.04, 0, part);
  box(`${id}Roof`, 0.32, 0.12, 0.25, "glass", -0.02, 0.19, 0, part);
  box(`${id}FrontWheels`, 0.12, 0.1, 0.34, "tire", 0.2, -0.05, 0, part);
  box(`${id}BackWheels`, 0.12, 0.1, 0.34, "tire", -0.2, -0.05, 0, part);
}
car("cityCar", "coral", -0.12, -4.3, 4.25);
car("yellowTaxi", "amber", 0.36, 4.2, -4.25);

// A small suspended balloon makes the skyline more than a field of cubes.
objects.balloon = {
  kind: "group",
  parentId,
  position: vector(3.5, 3.25, 1.1),
  keyframes: {
    "position.y": channel([
      [0, 3.25],
      [4, 3.5],
      [8, 3.28],
      [12, 3.5],
    ]),
    "rotation.z": channel([
      [0, -4],
      [6, 4],
      [12, -4],
    ]),
  },
};
sphere("balloonEnvelope", 0.45, "coral", 0, 0.65, 0, {
  parentId: "balloon",
  scale: vector(1, 1.2, 1),
});
box("balloonBasket", 0.22, 0.17, 0.19, "wood", 0, -0.12, 0, {
  parentId: "balloon",
});
const ropes = [];
for (const x of [-0.09, 0.09])
  quad(
    ropes,
    [x - 0.009, -0.03, -0.075],
    [x + 0.009, -0.03, -0.075],
    [x + 0.04, 0.27, -0.075],
    [x + 0.02, 0.27, -0.075],
  );
triangleMesh("balloonRopes", ropes, "cream", { parentId: "balloon" });
if (Object.keys(objects).length > 128)
  throw new Error("Miniature city exceeds the editable object budget.");

const track = (property, points) => ({
  kind: "keyframes",
  property,
  frames: points.map(([frame, value, easing]) => ({
    frame,
    value,
    ...(easing ? { easing } : {}),
  })),
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
    fontWeight: 700,
    color,
    letterSpacing: 1.8,
    ...extra,
  },
});
export const scene = {
  schemaVersion: 1,
  width: W,
  height: H,
  fps: 30,
  duration: D,
  assets: {},
  nodes: [
    {
      id: "city-atmosphere",
      type: "div",
      from: 0,
      duration: D,
      style: {
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(circle at 50% 48%, #F2DCD3 0%, #D9CADB 52%, #B7B4D1 100%)",
      },
      children: [
        {
          id: "ground-shadow",
          type: "div",
          style: {
            position: "absolute",
            left: 300,
            top: 248,
            width: 680,
            height: 680,
            transform: "scale(1, 0.14)",
            transformOrigin: "center center",
            background:
              "radial-gradient(circle at 50% 50%, rgba(79,64,101,0.23) 0%, rgba(79,64,101,0) 65%)",
          },
        },
      ],
    },
    {
      id: "miniature-city",
      type: "extension",
      from: 0,
      duration: D,
      style: {
        position: "absolute",
        left: 90,
        top: 52,
        width: 1100,
        height: 602,
      },
      extension: {
        name: "dojo.three-scene",
        version: "1.0.0",
        params: {
          camera: {
            kind: "orthographic",
            position: vector(10, 9, 13),
            target: vector(0, 0.9, 0),
            size: 8.8,
            orbit: { degreesPerSecond: 1.8, phase: -8 },
          },
          materials,
          objects,
          lighting: {
            ambient: 1.5,
            intensity: 2.3,
            position: vector(-6, 10, 8),
          },
        },
      },
    },
    {
      id: "city-editorial",
      type: "div",
      from: 0,
      duration: D,
      style: { position: "absolute", inset: 0 },
      children: [
        text(
          "city-kicker",
          "DOJO / DIMENSIONAL STORIES",
          48,
          32,
          800,
          12,
          "#494760",
          { letterSpacing: 2.3 },
        ),
        text("city-number", "WORLD / 001", 950, 32, 280, 12, "#494760", {
          textAlign: "right",
          letterSpacing: 2.3,
        }),
        text("city-name", "Little worlds.", 48, 77, 520, 38, "#39364E", {
          fontFamily: "Georgia, serif",
          fontWeight: 400,
          letterSpacing: -1,
        }),
        text(
          "city-caption",
          "BIG POSSIBILITIES.",
          48,
          640,
          780,
          15,
          "#494760",
          { letterSpacing: 4 },
        ),
        text(
          "city-detail",
          "BUILT ONE DETAIL AT A TIME",
          770,
          640,
          460,
          11,
          "#494760",
          { textAlign: "right", letterSpacing: 2.5 },
        ),
        {
          id: "city-rule",
          type: "div",
          style: {
            position: "absolute",
            left: 48,
            top: 677,
            width: 1184,
            height: 1,
            backgroundColor: "#A49BB7",
          },
        },
        text(
          "city-credits",
          "ARCHITECTURE / NATURE / MOTION",
          48,
          691,
          800,
          9,
          "#625D78",
          { letterSpacing: 2 },
        ),
      ],
      animations: [
        track("opacity", [
          [0, 0],
          [15, 1],
        ]),
      ],
    },
  ],
};
export const metadata = {
  title: "Little Worlds",
  description:
    "An editable miniature city with staged buildings, warm windows, moving cars, a garden and a floating balloon.",
  posterFrame: 210,
  frames: [0, 35, 80, 120, 180, 210, 285, 359],
};
export default scene;
