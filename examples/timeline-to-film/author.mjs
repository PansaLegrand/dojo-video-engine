import { writeFile } from "node:fs/promises";

const W = 1280,
  H = 720,
  fps = 30,
  duration = 240;
const paper = "#f7f5ef",
  ink = "#1c211d",
  secondary = "#536058",
  pale = "#b9beb4";
const blue = "#315dc4",
  white = "#fffdf5";
const family = "Archivo Variable",
  mono = "Menlo, Consolas, monospace";
const out = "cubic-bezier(0.16, 1, 0.30, 1)";
const glide = "cubic-bezier(0.58, 0.02, 0.19, 1)";
const box = (left, top, width, height) => ({
  position: "absolute",
  left,
  top,
  width,
  height,
});
const rect = (id, x, y, w, h, color, style = {}) => ({
  id,
  type: "div",
  style: { ...box(x, y, w, h), backgroundColor: color, ...style },
});
const group = (id, children, animations = []) => ({
  id,
  type: "div",
  from: 0,
  duration,
  style: box(0, 0, W, H),
  children,
  animations,
});
const text = (id, content, x, y, w, h, size, style = {}) => ({
  id,
  type: "text",
  text: content,
  style: {
    ...box(x, y, w, h),
    fontFamily: family,
    fontSize: size,
    color: ink,
    lineHeight: 1,
    maxLines: 1,
    fontWeight: 500,
    ...style,
  },
});
const small = (id, content, x, y, w, style = {}) =>
  text(id, content, x, y, w, 23, 14, {
    fontFamily: mono,
    color: secondary,
    letterSpacing: 1,
    ...style,
  });
const anim = (property, points) => ({
  kind: "keyframes",
  property,
  frames: points.map(([frame, value, easing]) => ({
    frame,
    value,
    ...(easing ? { easing } : {}),
  })),
});
const fadeOut = (start, end) =>
  anim("opacity", [
    [0, 1],
    [start, 1],
    [end, 0],
  ]);
const video = (id, width, height) => ({
  id,
  type: "video",
  src: "./assets/" + id + ".mp4",
  metadata: {
    duration: 9,
    width,
    height,
    hasAudio: false,
    mimeType: "video/mp4",
    frameRate: { numerator: 30, denominator: 1 },
  },
});
const assets = {
  "side-a": video("side-a", 640, 360),
  hero: video("hero", 1280, 720),
  "side-b": video("side-b", 640, 360),
  ambience: {
    id: "ambience",
    type: "audio",
    src: "./assets/hero-ambience.wav",
    metadata: {
      mimeType: "audio/wav",
      duration: 9,
      hasAudio: true,
      audioSampleRate: 48000,
      audioChannels: 1,
    },
  },
  archivo: {
    id: "archivo",
    type: "font",
    src: "./assets/archivo.woff2",
    metadata: {
      fontFamily: family,
      fontWeight: "100 900",
      fontStyle: "normal",
    },
  },
};
const variants = [
  {
    file: "cut-a",
    name: "Snap",
    cross: 79,
    full: 97,
    ease: "cubic-bezier(0.24, 0.96, 0.30, 1)",
  },
  { file: "cut-b", name: "Glide", cross: 79, full: 126, ease: glide },
];

function makeScene({ cross, full, ease }) {
  const side = 64,
    gap = 8,
    width = (W - 2 * side - 2 * gap) / 3,
    height = (width * 9) / 16;
  const xs = [side, side + width + gap, side + 2 * (width + gap)],
    y = 290;
  const stamps = ["01", "02", "03"],
    names = ["Grand Prismatic Spring", "Lower Falls", "Norris Basin"];
  const magnification = W / width;
  const pivotX = (xs[1] * magnification) / (magnification - 1);
  const pivotY = (y * magnification) / (magnification - 1);
  const lens = (node) => ({
    ...node,
    style: { ...node.style, transformOrigin: `${pivotX}px ${pivotY}px` },
    animations: [
      ...node.animations,
      anim("transform", [
        [0, "scale(1)"],
        [cross, "scale(1)"],
        [full, `scale(${magnification})`, ease],
      ]),
    ],
  });
  const furnitureOut = fadeOut(cross + 3, full);
  const labels = xs.flatMap((x, i) => [
    small("shot-index-" + i, stamps[i], x, 529, 39, {
      color: i === 1 ? blue : secondary,
    }),
    text("shot-name-" + i, names[i], x + 39, 523, width - 42, 42, 27, {
      letterSpacing: -0.8,
    }),
  ]);
  const top = group(
    "sequence-heading",
    [
      text("opening-wordmark", "DojoClip", 64, 36, 172, 39, 31, {
        fontWeight: 800,
        letterSpacing: -0.62,
      }),
      small(
        "workspace-label",
        "EDIT ROOM     /     SEQUENCE 01",
        759,
        44,
        457,
        { textAlign: "right" },
      ),
      rect("header-rule", 64, 87, 1152, 1, pale),
      small("eyebrow", "FIELD NOTES     /     001", 67, 117, 510, {
        fontSize: 13,
      }),
      text("project-title", "Yellowstone", 62, 142, 900, 110, 82, {
        fontFamily: "Georgia, serif",
        fontStyle: "italic",
        fontWeight: 400,
        letterSpacing: -4.2,
      }),
      small("spec-label", "PICTURE SEQUENCE", 930, 169, 285, {
        textAlign: "right",
      }),
      small("specs", "16:9    /    30 FPS", 930, 197, 285, {
        fontSize: 13,
        textAlign: "right",
      }),
    ],
    [furnitureOut],
  );
  const ticks = Array.from({ length: 49 }, (_, i) => {
    const large = i % 6 === 0,
      x = side + ((W - 2 * side) * i) / 48;
    return rect(
      "ruler-tick-" + i,
      x,
      281 - (large ? 10 : 4),
      1,
      large ? 10 : 4,
      large ? secondary : pale,
    );
  });
  const ruler = group(
    "timeline-ruler",
    [
      ...[0, 2, 4, 6, 8].map((s, i) =>
        small(
          "ruler-number-" + s,
          String(s).padStart(2, "0") + "s",
          i === 4 ? 1170 : side + i * 288,
          247,
          i === 4 ? 46 : 70,
          { textAlign: i === 4 ? "right" : "left", fontSize: 12 },
        ),
      ),
      ...ticks,
      rect("ruler-base", side, 281, 1152, 1, pale),
      ...xs.map((x, i) =>
        rect("empty-slot-" + i, x, y, width, height, "#e2e4db"),
      ),
    ],
    [furnitureOut],
  );
  const footer = group(
    "shot-captions",
    [
      ...labels,
      rect("footer-rule", 64, 593, 1152, 1, pale),
      small("footer-left", "YELLOWSTONE NATIONAL PARK", 64, 631, 550, {
        fontSize: 13,
      }),
      small("footer-right", "03 SELECTS     /     00:00:08:00", 720, 631, 496, {
        fontSize: 13,
        textAlign: "right",
      }),
    ],
    [furnitureOut],
  );
  function footage(id, assetId, index) {
    const x = xs[index],
      entry = [0, 4, 9][index],
      settle = entry + 17,
      startX = x + [-22, 25, 43][index],
      startY = y + [7, 16, 24][index];
    const hero = index === 1;
    const travel = (property, start, final) =>
      anim(property, [
        [0, start],
        [cross, start],
        [full, final, ease],
      ]);
    const entryTravel = (property, start, rest, final) =>
      anim(property, [
        [0, start],
        ...(entry ? [[entry, start]] : []),
        [settle, rest, out],
        [cross, rest],
        [full, final, ease],
      ]);
    return {
      id,
      type: "video",
      assetId,
      volume: 0,
      from: 0,
      duration: hero ? duration : full + 1,
      style: { ...box(x, y, width, height), objectFit: "cover" },
      animations: [
        entryTravel("left", startX, x, (x - xs[1]) * magnification),
        entryTravel("top", startY, y, 0),
        travel("width", width, W),
        travel("height", height, H),
      ],
    };
  }
  const cursorX = 639;
  const playhead = group(
    "playhead",
    [
      rect("playhead-stem", -1, 273, 2, y + height - 273 + 4, blue),
      {
        id: "playhead-tab",
        type: "shape",
        shape: {
          kind: "path",
          d: "M0 0 H14 V8 L7 15 L0 8 Z",
          viewBox: { x: 0, y: 0, width: 14, height: 15 },
        },
        style: { ...box(-7, 261, 14, 15), fill: blue },
      },
    ],
    [
      anim("left", [
        [0, side + 12],
        [22, side + 115],
        [cross, cursorX],
        [full, cursorX],
      ]),
      fadeOut(cross, cross + 5),
    ],
  );
  const end = group(
    "signature",
    [
      rect("end-exposure", 0, 0, W, H, "#111711", { opacity: 0.48 }),
      text("closing-wordmark", "DojoClip", 0, 309, W, 102, 88, {
        fontWeight: 800,
        letterSpacing: -1.76,
        textAlign: "center",
        color: white,
      }),
    ],
    [
      anim("opacity", [
        [0, 0],
        [188, 0],
        [210, 1, "easeInOut"],
      ]),
    ],
  );
  return {
    schemaVersion: 1,
    width: W,
    height: H,
    fps,
    duration,
    assets,
    nodes: [
      rect("paper", 0, 0, W, H, paper),
      lens(top),
      lens(ruler),
      footage("grand-prismatic", "side-a", 0),
      footage("norris-basin", "side-b", 2),
      lens(footer),
      footage("lower-falls-continuous", "hero", 1),
      playhead,
      end,
      {
        id: "field-recording",
        type: "audio",
        assetId: "ambience",
        from: 0,
        duration,
        volume: 1,
        volumeEnvelope: [
          { frame: 0, value: 0 },
          { frame: 20, value: 0.13 },
          { frame: cross - 7, value: 0.13 },
          { frame: full + 7, value: 1, easing: "easeInOut" },
          { frame: 203, value: 1 },
          { frame: 239, value: 0, easing: "easeInOut" },
        ],
      },
    ],
  };
}

for (const variant of variants) {
  await writeFile(
    new URL(variant.file + ".json", import.meta.url),
    JSON.stringify(makeScene(variant), null, 2) + "\n",
  );
}
