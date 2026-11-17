/**
 * MAKE MAGIC — original hand-drawn lettering revealed with Lottie trim paths.
 * These are authored vector strokes, not a font or an arbitrary text generator.
 * The pen marker follows sampled points on the same curves. No expressions,
 * images, external fonts, or remote assets are used.
 */
const W = 1280,
  H = 720,
  FPS = 30,
  DURATION = 360;
const ink = [0.102, 0.208, 0.278, 1];
const clay = [0.78, 0.365, 0.247, 1];
const gold = [0.72, 0.51, 0.27, 1];

// Cubic centerlines. Each entry starts with a point and continues with
// [control 1, control 2, endpoint] segments. Their imperfections are deliberate.
const glyphs = {
  M: {
    advance: 103,
    curve: [
      [-18, 105],
      [
        [0, 102],
        [34, -20],
        [43, 1],
      ],
      [
        [49, 18],
        [15, 88],
        [23, 101],
      ],
      [
        [28, 115],
        [67, -9],
        [77, 8],
      ],
      [
        [86, 27],
        [60, 82],
        [65, 99],
      ],
      [
        [71, 114],
        [90, 97],
        [103, 80],
      ],
    ],
  },
  a: {
    advance: 65,
    curve: [
      [0, 80],
      [
        [18, 55],
        [50, 61],
        [40, 87],
      ],
      [
        [29, 113],
        [3, 105],
        [15, 79],
      ],
      [
        [27, 55],
        [49, 64],
        [43, 87],
      ],
      [
        [37, 113],
        [56, 102],
        [65, 80],
      ],
    ],
  },
  k: {
    advance: 65,
    curve: [
      [0, 80],
      [
        [16, 61],
        [34, 0],
        [22, 4],
      ],
      [
        [8, 7],
        [10, 73],
        [9, 101],
      ],
      [
        [18, 77],
        [46, 59],
        [45, 73],
      ],
      [
        [44, 87],
        [23, 83],
        [22, 87],
      ],
      [
        [40, 85],
        [34, 122],
        [65, 80],
      ],
    ],
  },
  e: {
    advance: 61,
    curve: [
      [0, 80],
      [
        [12, 80],
        [35, 78],
        [36, 66],
      ],
      [
        [36, 49],
        [18, 54],
        [12, 70],
      ],
      [
        [0, 96],
        [19, 111],
        [39, 100],
      ],
      [
        [49, 94],
        [56, 86],
        [61, 80],
      ],
    ],
  },
  m: {
    advance: 100,
    curve: [
      [0, 80],
      [
        [13, 57],
        [15, 66],
        [9, 100],
      ],
      [
        [23, 57],
        [47, 49],
        [33, 101],
      ],
      [
        [50, 57],
        [77, 56],
        [64, 101],
      ],
      [
        [69, 112],
        [88, 99],
        [100, 80],
      ],
    ],
  },
  g: {
    advance: 67,
    curve: [
      [0, 80],
      [
        [18, 55],
        [49, 61],
        [40, 87],
      ],
      [
        [28, 111],
        [3, 104],
        [15, 79],
      ],
      [
        [28, 55],
        [48, 64],
        [42, 87],
      ],
      [
        [40, 106],
        [31, 148],
        [12, 141],
      ],
      [
        [-7, 130],
        [40, 116],
        [67, 80],
      ],
    ],
  },
  i: {
    advance: 35,
    curve: [
      [0, 80],
      [
        [13, 59],
        [22, 62],
        [13, 87],
      ],
      [
        [5, 113],
        [25, 103],
        [35, 80],
      ],
    ],
  },
  c: {
    advance: 64,
    curve: [
      [0, 80],
      [
        [29, 47],
        [55, 63],
        [42, 70],
      ],
      [
        [19, 57],
        [0, 83],
        [12, 98],
      ],
      [
        [24, 118],
        [46, 104],
        [64, 80],
      ],
    ],
  },
};

function shapeFromCurve(curve) {
  const v = [curve[0]],
    incoming = [[0, 0]],
    outgoing = [[0, 0]];
  for (const [c1, c2, end] of curve.slice(1)) {
    const start = v.at(-1);
    outgoing[outgoing.length - 1] = [c1[0] - start[0], c1[1] - start[1]];
    v.push(end);
    incoming.push([c2[0] - end[0], c2[1] - end[1]]);
    outgoing.push([0, 0]);
  }
  return { i: incoming, o: outgoing, v, c: false };
}
function cubic(a, b, c, d, t) {
  const u = 1 - t;
  return [0, 1].map(
    (axis) =>
      u * u * u * a[axis] +
      3 * u * u * t * b[axis] +
      3 * u * t * t * c[axis] +
      t * t * t * d[axis],
  );
}
// Length-based marker motion matches the fraction revealed by trim paths.
function sampleCurve(curve) {
  const points = [curve[0]];
  let start = curve[0];
  for (const [c1, c2, end] of curve.slice(1)) {
    for (let n = 1; n <= 40; n++)
      points.push(cubic(start, c1, c2, end, n / 40));
    start = end;
  }
  const lengths = [0];
  for (let n = 1; n < points.length; n++)
    lengths.push(
      lengths.at(-1) +
        Math.hypot(
          points[n][0] - points[n - 1][0],
          points[n][1] - points[n - 1][1],
        ),
    );
  return { points, lengths, total: lengths.at(-1) };
}
function pointAt(sample, fraction) {
  const target = sample.total * fraction;
  let n = 1;
  while (n < sample.lengths.length - 1 && sample.lengths[n] < target) n++;
  const amount =
    (target - sample.lengths[n - 1]) /
    (sample.lengths[n] - sample.lengths[n - 1] || 1);
  return [0, 1].map(
    (axis) =>
      sample.points[n - 1][axis] +
      amount * (sample.points[n][axis] - sample.points[n - 1][axis]),
  );
}
const stat = (k) => ({ a: 0, k });
const easeLinear = { i: { x: [1], y: [1] }, o: { x: [0], y: [0] } };
const animated = (from, to, start, end) => ({
  a: 1,
  k: [
    { t: start, s: [from], e: [to], ...easeLinear },
    { t: end, s: [to] },
  ],
});
const identity = {
  ty: "tr",
  p: stat([0, 0]),
  a: stat([0, 0]),
  s: stat([100, 100]),
  r: stat(0),
  o: stat(100),
};
const strokes = [];
let frame = 25;
function word(value, x, y, scale, framesPerLetter) {
  for (const [index, char] of [...value].entries()) {
    const glyph = glyphs[char];
    strokes.push({
      name: `${value}-${index}-${char}`,
      curve: glyph.curve,
      x,
      y,
      scale,
      start: frame,
      end: frame + framesPerLetter,
      color: ink,
      width: 4.4,
    });
    x += glyph.advance * scale;
    frame += framesPerLetter;
  }
}
word("Make", 361, 119, 1.9, 22);
frame = 124;
word("magic", 326, 319, 1.9, 21);
// The i's dot and the finishing punctuation are genuine little pen paths.
strokes.push({
  name: "dot-the-i",
  curve: [
    [16, 47],
    [
      [20, 42],
      [23, 49],
      [17, 49],
    ],
    [
      [12, 48],
      [15, 44],
      [16, 47],
    ],
  ],
  x: 326 + (100 + 65 + 67) * 1.9,
  y: 319,
  scale: 1.9,
  start: 230,
  end: 236,
  color: ink,
  width: 4.4,
});
strokes.push({
  name: "full-stop",
  curve: [
    [0, 0],
    [
      [4, -2],
      [5, 3],
      [1, 4],
    ],
    [
      [0, 4],
      [-2, 1],
      [0, 0],
    ],
  ],
  x: 978,
  y: 514,
  scale: 1,
  start: 240,
  end: 246,
  color: ink,
  width: 7,
});
strokes.push({
  name: "signature-flourish",
  curve: [
    [355, 611],
    [
      [485, 583],
      [693, 602],
      [861, 604],
    ],
    [
      [994, 606],
      [1024, 571],
      [977, 575],
    ],
    [
      [931, 580],
      [933, 625],
      [1030, 613],
    ],
  ],
  x: 0,
  y: 0,
  scale: 1,
  start: 253,
  end: 289,
  color: clay,
  width: 3.4,
});

const shapeGroups = strokes.map((stroke) => ({
  ty: "gr",
  nm: stroke.name,
  it: [
    {
      ty: "sh",
      nm: `${stroke.name}-centerline`,
      ks: stat(shapeFromCurve(stroke.curve)),
    },
    {
      ty: "st",
      nm: "ink",
      c: stat(stroke.color),
      o: stat(100),
      w: stat(stroke.width),
      lc: 2,
      lj: 2,
    },
    {
      ty: "tm",
      nm: "write-stroke",
      s: stat(0),
      e: animated(0, 100, stroke.start, stroke.end),
      o: stat(0),
      m: 1,
    },
    {
      ...identity,
      p: stat([stroke.x, stroke.y]),
      s: stat([stroke.scale * 100, stroke.scale * 100]),
    },
  ],
}));
const penPoints = [];
for (const stroke of strokes) {
  const sample = sampleCurve(stroke.curve);
  for (let t = stroke.start; t <= stroke.end; t++) {
    const pt = pointAt(
      sample,
      (t - stroke.start) / (stroke.end - stroke.start),
    );
    penPoints.push({
      t,
      point: [
        stroke.x + pt[0] * stroke.scale,
        stroke.y + pt[1] * stroke.scale,
        0,
      ],
    });
  }
}
const penPosition = {
  a: 1,
  k: penPoints.map((p, i) => ({
    t: p.t,
    s: p.point,
    ...(i < penPoints.length - 1
      ? { e: penPoints[i + 1].point, ...easeLinear }
      : {}),
  })),
};
const layerTransform = {
  o: stat(100),
  r: stat(0),
  p: stat([0, 0, 0]),
  a: stat([0, 0, 0]),
  s: stat([100, 100, 100]),
};
const lettering = {
  v: "5.7.4",
  fr: FPS,
  ip: 0,
  op: DURATION,
  w: W,
  h: H,
  nm: "Make magic — original stroke lettering",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "pen tip",
      sr: 1,
      ks: {
        ...layerTransform,
        p: penPosition,
        o: {
          a: 1,
          k: [
            { t: 0, s: [0], h: 1 },
            { t: 25, s: [100], h: 1 },
            { t: 292, s: [100], e: [0], ...easeLinear },
            { t: 302, s: [0] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          nm: "nib",
          it: [
            { ty: "el", nm: "tip", d: 1, p: stat([0, 0]), s: stat([9, 9]) },
            { ty: "fl", c: stat(gold), o: stat(100) },
            identity,
          ],
        },
      ],
      ip: 0,
      op: DURATION,
      st: 0,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "authored handwriting",
      sr: 1,
      ks: layerTransform,
      ao: 0,
      shapes: shapeGroups,
      ip: 0,
      op: DURATION,
      st: 0,
    },
  ],
};
const text = (id, value, x, y, width, size, color, extra = {}) => ({
  id,
  type: "text",
  text: value,
  style: {
    position: "absolute",
    left: x,
    top: y,
    width,
    height: size * 1.6,
    fontFamily: "Arial",
    fontSize: size,
    color,
    ...extra,
  },
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
const group = (id, children) => ({
  id,
  type: "div",
  from: 0,
  duration: DURATION,
  style: { position: "absolute", inset: 0 },
  children,
});
const key = (property, points) => ({
  kind: "keyframes",
  property,
  frames: points.map(([frame, value]) => ({ frame, value })),
});

export const scene = {
  schemaVersion: 1,
  width: W,
  height: H,
  fps: FPS,
  duration: DURATION,
  assets: {
    "handwritten-ink": {
      id: "handwritten-ink",
      type: "lottie",
      src: `data:application/json,${encodeURIComponent(JSON.stringify(lettering))}`,
    },
  },
  nodes: [
    group("handwriting-paper", [
      rect("paper", 0, 0, W, H, "#F7F0E2"),
      {
        ...rect("paper-light", 0, 0, W, H, "transparent"),
        style: {
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 40%, #FFFBF1 0%, #F3EADA 85%)",
        },
      },
      ...[310, 510].map((y, i) =>
        rect(`baseline-${i}`, 204, y, 872, 1, "#D9E0DB"),
      ),
      ...[157, 357].map((y, i) =>
        rect(`cap-guide-${i}`, 204, y, 872, 1, "#E8E9DF"),
      ),
      rect("margin-guide", 204, 126, 1, 474, "#E5DDD0"),
      rect("paper-top-rule", 52, 78, 1176, 1, "#D5D1C3"),
      rect("paper-footer-rule", 52, 653, 1176, 1, "#D5D1C3"),
    ]),
    {
      id: "handwritten-lettering",
      type: "lottie",
      assetId: "handwritten-ink",
      from: 0,
      duration: DURATION,
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        width: W,
        height: H,
        objectFit: "contain",
      },
    },
    group("handwriting-editorial", [
      text("studio", "DOJO / LETTERING STUDIO", 52, 34, 650, 13, "#294553", {
        fontWeight: 700,
        letterSpacing: 2.6,
      }),
      text(
        "edition",
        "A LITTLE INK. A LITTLE POSSIBILITY.",
        760,
        34,
        468,
        11,
        "#7D837D",
        { textAlign: "right", letterSpacing: 1.5 },
      ),
      {
        ...text(
          "finish-note",
          "A thought, becoming a line.",
          52,
          672,
          700,
          15,
          "#294553",
        ),
        animations: [
          key("opacity", [
            [0, 0],
            [280, 0],
            [310, 1],
          ]),
        ],
      },
      text("footer", "INK IN MOTION", 920, 675, 308, 10, "#7D837D", {
        textAlign: "right",
        letterSpacing: 3,
      }),
      {
        ...rect("ink-stamp", 1115, 115, 52, 52, "#CC7559", {
          borderRadius: 26,
        }),
        animations: [
          key("transform", [
            [0, "scale(0)"],
            [295, "scale(0)"],
            [312, "scale(1.1)"],
            [325, "scale(1)"],
          ]),
        ],
      },
      {
        ...text("stamp-star", "✦", 1115, 121, 52, 30, "#FFFBF1", {
          textAlign: "center",
        }),
        animations: [
          key("opacity", [
            [0, 0],
            [295, 0],
            [315, 1],
          ]),
        ],
      },
    ]),
  ],
};
export const metadata = {
  title: "Make Magic",
  description:
    "Original hand-authored vector lettering drawn stroke by stroke with Lottie trim paths; not an arbitrary text-to-handwriting generator.",
  posterFrame: 310,
  frames: [0, 35, 80, 115, 160, 205, 250, 285, 310, 359],
  lottieAssetIds: ["handwritten-ink"],
};
export default scene;
