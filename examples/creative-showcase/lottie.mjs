/** SPECIAL DELIVERY — original, expression-free Lottie vector story.
 * All envelopes, plane, clouds, mailbox and confetti are genuine Lottie shapes.
 * Native Scene text remains independently editable above the Lottie animation.
 */
const W = 1280,
  H = 720,
  D = 360;
const C = {
  ink: "#204B42",
  cream: "#FFF7E8",
  coral: "#ED806A",
  blush: "#F5B29E",
  blue: "#657BD4",
  pale: "#E1E9DA",
  gold: "#EBC266",
  paper: "#FFFEF8",
  dark: "#17382F",
};
const rgb = (hex) => [
  ...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255),
  1,
];
const val = (k) => ({ a: 0, k });
const anim = (points, ease = true) => ({
  a: 1,
  k: points.map(([t, value], index) => ({
    t,
    s: Array.isArray(value) ? value : [value],
    ...(index < points.length - 1
      ? {
          e: Array.isArray(points[index + 1][1])
            ? points[index + 1][1]
            : [points[index + 1][1]],
          i: { x: [ease ? 0.68 : 0.667], y: [ease ? 1 : 0.667] },
          o: { x: [ease ? 0.24 : 0.333], y: [ease ? 0 : 0.333] },
        }
      : {}),
  })),
});
const path = (
  vertices,
  closed = true,
  incoming = vertices.map(() => [0, 0]),
  outgoing = vertices.map(() => [0, 0]),
) => ({ v: vertices, i: incoming, o: outgoing, c: closed });
const poly = (nm, vertices) => ({ ty: "sh", nm, ks: val(path(vertices)) });
const ellipse = (nm, x, y, w, h) => ({
  ty: "el",
  nm,
  d: 1,
  p: val([x, y]),
  s: val([w, h]),
});
const rect = (nm, x, y, w, h, r = 0) => ({
  ty: "rc",
  nm,
  d: 1,
  p: val([x, y]),
  s: val([w, h]),
  r: val(r),
});
const fill = (color, opacity = 100) => ({
  ty: "fl",
  c: val(rgb(color)),
  o: val(opacity),
  r: 1,
});
const stroke = (color, width, opacity = 100) => ({
  ty: "st",
  c: val(rgb(color)),
  o: val(opacity),
  w: val(width),
  lc: 2,
  lj: 2,
  ml: 4,
});
const tr = ({
  p = [0, 0],
  s = [100, 100],
  r = 0,
  o = 100,
  a = [0, 0],
} = {}) => ({
  ty: "tr",
  p: p.a === undefined ? val(p) : p,
  a: val(a),
  s: s.a === undefined ? val(s) : s,
  r: r.a === undefined ? val(r) : r,
  o: o.a === undefined ? val(o) : o,
});
const group = (nm, shapes, paint = [], transform = {}) => ({
  ty: "gr",
  nm,
  it: [
    ...(shapes.every((shape) => shape.ty === "gr")
      ? [...shapes].reverse()
      : shapes),
    ...(Array.isArray(paint) ? paint : [paint]),
    tr(transform),
  ],
});
const layer = (
  nm,
  shapes,
  { p = [0, 0, 0], s = [100, 100, 100], r = 0, o = 100, ip = 0, op = D } = {},
) => ({
  ddd: 0,
  ty: 4,
  nm,
  sr: 1,
  ks: {
    o: o.a === undefined ? val(o) : o,
    r: r.a === undefined ? val(r) : r,
    p: p.a === undefined ? val(p) : p,
    a: val([0, 0, 0]),
    s: s.a === undefined ? val(s) : s,
  },
  ao: 0,
  shapes: [...shapes].reverse(),
  ip,
  op,
  st: 0,
  bm: 0,
});
const layers = [];

// Lottie painting order is reversed below, so author the illustration back to front.
layers.push(
  layer(
    "sun-wash",
    [group("sun", [ellipse("disc", 0, 0, 650, 650)], fill("#F4DCA8", 38))],
    {
      p: [640, 340, 0],
      s: anim([
        [0, [80, 80, 100]],
        [100, [105, 105, 100]],
        [240, [90, 90, 100]],
        [320, [110, 110, 100]],
      ]),
    },
  ),
);
for (let i = 0; i < 5; i++) {
  const x = 180 + i * 245,
    y = 205 + (i % 3) * 60;
  layers.push(
    layer(
      `cloud-${i}`,
      [
        group(
          "soft-cloud",
          [
            ellipse("left", -48, 0, 94, 61),
            ellipse("crest", 0, -23, 112, 94),
            ellipse("right", 56, 1, 92, 58),
            rect("base", 5, 16, 152, 34, 16),
          ],
          fill(i % 2 ? "#FFFEF7" : "#E6EBDD", 80),
        ),
      ],
      {
        p: anim(
          [
            [0, [x + 90, y, 0]],
            [360, [x - 90, y - 15, 0]],
          ],
          false,
        ),
        s: val([90 + i * 4, 90 + i * 4, 100]).k,
        o: anim([
          [0, 0],
          [90, 0],
          [118, 75],
          [242, 75],
          [285, 0],
        ]),
      },
    ),
  );
}
// Fine orbit marks add a sense of scale without competing with the character.
for (let i = 0; i < 10; i++) {
  const angle = i * 2.39996,
    rx = 430 + (i % 2) * 70;
  layers.push(
    layer(
      `floating-dot-${i}`,
      [
        group(
          "dot",
          [ellipse("circle", 0, 0, 6 + (i % 3) * 3, 6 + (i % 3) * 3)],
          fill(i % 2 ? C.coral : C.blue, 60),
        ),
      ],
      {
        p: anim(
          [
            [0, [640 + Math.cos(angle) * rx, 340 + Math.sin(angle) * 230, 0]],
            [
              180,
              [
                640 + Math.cos(angle + 0.12) * rx,
                340 + Math.sin(angle + 0.12) * 230,
                0,
              ],
            ],
            [
              359,
              [
                640 + Math.cos(angle + 0.24) * rx,
                340 + Math.sin(angle + 0.24) * 230,
                0,
              ],
            ],
          ],
          false,
        ),
      },
    ),
  );
}
layers.push(
  layer(
    "intro-shadow",
    [group("soft-ground", [ellipse("ground", 0, 0, 320, 35)], fill(C.ink, 12))],
    {
      p: [640, 530, 0],
      s: anim([
        [0, [80, 80, 100]],
        [35, [100, 100, 100]],
        [95, [75, 75, 100]],
      ]),
      o: anim([
        [0, 0],
        [20, 100],
        [89, 100],
        [110, 0],
      ]),
    },
  ),
);

// The envelope flap morphs from closed to open using the same three vertices.
const closedFlap = path([
  [-118, -75],
  [118, -75],
  [0, 18],
]);
const openFlap = path([
  [-118, -75],
  [118, -75],
  [0, -176],
]);
const envelope = [
  group("back", [rect("envelope-body", 0, 0, 240, 154, 13)], fill(C.coral)),
  group(
    "opening-flap",
    [
      {
        ty: "sh",
        nm: "flap-path",
        ks: anim([
          [0, closedFlap],
          [26, closedFlap],
          [53, openFlap],
          [99, openFlap],
        ]),
      },
    ],
    fill(C.blush),
  ),
  group(
    "letter",
    [
      group("sheet", [rect("paper", 0, 0, 172, 160, 10)], fill(C.paper)),
      group(
        "letter-line-a",
        [rect("line", 0, -34, 98, 7, 4)],
        fill(C.blue, 30),
      ),
      group(
        "letter-line-b",
        [rect("line", -17, -16, 64, 7, 4)],
        fill(C.blue, 20),
      ),
      group(
        "letter-heart",
        [
          {
            ty: "sh",
            nm: "heart",
            ks: val(
              path(
                [
                  [0, 32],
                  [-32, 7],
                  [-20, -19],
                  [0, -7],
                  [20, -19],
                  [32, 7],
                ],
                true,
                [
                  [-12, -10],
                  [-8, -8],
                  [-15, 0],
                  [-6, -13],
                  [-11, 0],
                  [8, -8],
                ],
                [
                  [12, -10],
                  [0, -13],
                  [12, 0],
                  [6, -13],
                  [15, 0],
                  [0, 12],
                ],
              ),
            ),
          },
        ],
        fill(C.coral),
        { s: [66, 66] },
      ),
    ],
    [],
    {
      p: anim([
        [0, [0, 8]],
        [28, [0, 8]],
        [70, [0, -97]],
        [95, [0, -97]],
      ]),
    },
  ),
  group(
    "front-fold",
    [
      poly("front", [
        [-120, -63],
        [0, 16],
        [120, -63],
        [120, 69],
        [110, 77],
        [-110, 77],
        [-120, 69],
      ]),
    ],
    fill(C.coral),
  ),
  group(
    "left-fold",
    [
      {
        ty: "sh",
        ks: val(
          path(
            [
              [-111, 66],
              [-21, 8],
            ],
            false,
          ),
        ),
      },
    ],
    stroke("#D56957", 2),
  ),
  group(
    "right-fold",
    [
      {
        ty: "sh",
        ks: val(
          path(
            [
              [111, 66],
              [21, 8],
            ],
            false,
          ),
        ),
      },
    ],
    stroke("#D56957", 2),
  ),
  group("seal", [ellipse("round-seal", 0, 25, 28, 28)], fill(C.gold)),
];
layers.push(
  layer("letter-opening", envelope, {
    p: anim([
      [0, [640, 395, 0]],
      [26, [640, 348, 0]],
      [61, [640, 364, 0]],
      [92, [640, 350, 0]],
      [112, [640, 320, 0]],
    ]),
    s: anim([
      [0, [0, 0, 100]],
      [15, [148, 127, 100]],
      [26, [132, 142, 100]],
      [38, [140, 140, 100]],
      [92, [140, 140, 100]],
      [112, [60, 60, 100]],
    ]),
    r: anim([
      [0, -7],
      [26, 3],
      [61, -3],
      [92, 0],
    ]),
    o: anim([
      [0, 0],
      [10, 100],
      [94, 100],
      [112, 0],
    ]),
    op: 113,
  }),
);

// Trim-path route is drawn while the plane flies: actual Lottie trim semantics.
layers.push(
  layer(
    "flight-path",
    [
      group("route", [
        {
          ty: "sh",
          nm: "swooping-route",
          ks: val(
            path(
              [
                [275, 365],
                [480, 230],
                [720, 305],
                [915, 220],
                [1040, 365],
              ],
              false,
              [
                [0, 0],
                [-110, -22],
                [-95, 2],
                [-90, -60],
                [10, -60],
              ],
              [
                [85, -60],
                [95, 25],
                [110, 0],
                [95, 70],
                [0, 0],
              ],
            ),
          ),
        },
        {
          ...stroke(C.blue, 3, 38),
          d: [
            { n: "d", nm: "dash", v: val(5) },
            { n: "g", nm: "gap", v: val(11) },
          ],
        },
        {
          ty: "tm",
          s: val(0),
          e: anim(
            [
              [98, 0],
              [244, 100],
            ],
            false,
          ),
          o: val(0),
          m: 1,
          nm: "draw-flight-path",
        },
      ]),
    ],
    {
      o: anim([
        [0, 0],
        [98, 0],
        [104, 100],
        [250, 100],
        [282, 0],
      ]),
      ip: 98,
      op: 283,
    },
  ),
);
layers.push(
  layer(
    "paper-airplane",
    [
      group(
        "plane-shadow-wing",
        [
          poly("lower-wing", [
            [-121, -50],
            [127, 0],
            [-78, 69],
            [-35, 5],
          ]),
        ],
        fill(C.blue),
      ),
      group(
        "plane-top-wing",
        [
          poly("top-wing", [
            [-121, -50],
            [127, 0],
            [-38, 20],
          ]),
        ],
        fill(C.paper),
      ),
      group(
        "plane-fold",
        [
          poly("center-fold", [
            [-38, 20],
            [127, 0],
            [-78, 69],
          ]),
        ],
        fill("#CBD8F6"),
      ),
      group(
        "plane-seam",
        [
          {
            ty: "sh",
            ks: val(
              path(
                [
                  [-38, 20],
                  [127, 0],
                ],
                false,
              ),
            ),
          },
        ],
        stroke("#AABBE3", 2),
      ),
    ],
    {
      p: anim(
        [
          [98, [640, 335, 0]],
          [113, [310, 352, 0]],
          [143, [480, 230, 0]],
          [174, [720, 305, 0]],
          [210, [915, 220, 0]],
          [247, [1040, 365, 0]],
        ],
        false,
      ),
      r: anim(
        [
          [98, -12],
          [113, -28],
          [143, 2],
          [174, 10],
          [210, -5],
          [247, 42],
        ],
        false,
      ),
      s: anim([
        [98, [0, 0, 100]],
        [112, [87, 87, 100]],
        [225, [75, 75, 100]],
        [247, [20, 20, 100]],
      ]),
      o: anim([
        [98, 0],
        [107, 100],
        [235, 100],
        [249, 0],
      ]),
      ip: 98,
      op: 250,
    },
  ),
);

const mailboxPosition = anim([
  [219, [1040, 417, 0]],
  [260, [1040, 417, 0]],
  [296, [640, 417, 0]],
  [359, [640, 417, 0]],
]);
layers.push(
  layer(
    "mailbox-shadow",
    [group("ground", [ellipse("ellipse", 0, 159, 342, 38)], fill(C.ink, 12))],
    {
      p: mailboxPosition,
      o: anim([
        [219, 0],
        [235, 100],
      ]),
      ip: 219,
    },
  ),
);
layers.push(
  layer(
    "mailbox",
    [
      group(
        "post-shadow",
        [rect("post", 11, 100, 31, 147, 5)],
        fill("#B69565"),
      ),
      group("post", [rect("post", 0, 100, 28, 147, 5)], fill("#E5C899")),
      group("post-foot", [rect("foot", 0, 171, 87, 15, 7)], fill("#B69565")),
      group(
        "mailbox-back",
        [
          {
            ty: "sh",
            ks: val(
              path(
                [
                  [-120, 34],
                  [-120, -63],
                  [0, -153],
                  [120, -63],
                  [120, 34],
                ],
                true,
                [
                  [0, 0],
                  [0, 0],
                  [-65, 0],
                  [0, -50],
                  [0, 0],
                ],
                [
                  [0, 0],
                  [0, -50],
                  [65, 0],
                  [0, 0],
                  [0, 0],
                ],
              ),
            ),
          },
        ],
        fill(C.ink),
      ),
      group(
        "mailbox-front",
        [
          {
            ty: "sh",
            ks: val(
              path(
                [
                  [-106, 25],
                  [-106, -60],
                  [0, -138],
                  [106, -60],
                  [106, 25],
                ],
                true,
                [
                  [0, 0],
                  [0, 0],
                  [-56, 0],
                  [0, -44],
                  [0, 0],
                ],
                [
                  [0, 0],
                  [0, -44],
                  [56, 0],
                  [0, 0],
                  [0, 0],
                ],
              ),
            ),
          },
        ],
        fill("#3E7964"),
      ),
      group("slot", [rect("opening", 0, -51, 160, 17, 8)], fill(C.dark)),
      group(
        "delivery-envelope",
        [
          group(
            "mini-paper",
            [rect("envelope", 0, 0, 124, 77, 7)],
            fill(C.cream),
          ),
          group(
            "mini-fold",
            [
              {
                ty: "sh",
                ks: val(
                  path(
                    [
                      [-56, -28],
                      [0, 8],
                      [56, -28],
                    ],
                    false,
                  ),
                ),
              },
            ],
            stroke(C.coral, 3),
          ),
        ],
        [],
        {
          p: anim([
            [220, [0, -155]],
            [237, [0, -155]],
            [257, [0, -52]],
            [276, [0, -35]],
          ]),
          o: anim([
            [220, 0],
            [247, 0],
            [253, 100],
          ]),
          s: anim([
            [237, [100, 100]],
            [257, [100, 10]],
            [276, [100, 100]],
          ]),
        },
      ),
      group(
        "happy-eye-left",
        [ellipse("eye", -29, -100, 9, 11)],
        fill(C.paper),
      ),
      group(
        "happy-eye-right",
        [ellipse("eye", 29, -100, 9, 11)],
        fill(C.paper),
      ),
      group(
        "happy-mouth",
        [
          {
            ty: "sh",
            ks: val(
              path(
                [
                  [-18, -84],
                  [0, -75],
                  [18, -84],
                ],
                false,
                [
                  [0, 0],
                  [-10, 0],
                  [0, 0],
                ],
                [
                  [0, 0],
                  [10, 0],
                  [0, 0],
                ],
              ),
            ),
          },
        ],
        stroke(C.paper, 4),
      ),
      group("flag-arm", [rect("arm", 125, -40, 9, 115, 4)], fill(C.coral)),
      group("raised-flag", [rect("flag", 148, -95, 55, 36, 5)], fill(C.coral)),
      group("base-trim", [rect("trim", 0, 35, 256, 14, 7)], fill(C.dark)),
    ],
    {
      p: mailboxPosition,
      s: anim([
        [219, [0, 0, 100]],
        [234, [110, 85, 100]],
        [244, [94, 108, 100]],
        [255, [100, 100, 100]],
      ]),
      r: anim([
        [219, 0],
        [247, 0],
        [258, -4],
        [267, 3],
        [278, 0],
      ]),
      ip: 219,
    },
  ),
);

// Delivery celebrates with individually authored, deterministic confetti paths.
for (let i = 0; i < 24; i++) {
  const angle = -Math.PI + (i / 23) * Math.PI * 2;
  const x = 640 + Math.cos(angle) * (190 + (i % 4) * 30),
    y = 360 + Math.sin(angle) * (150 + (i % 3) * 26);
  const shape =
    i % 4 === 0
      ? ellipse("circle", 0, 0, 10, 10)
      : rect("paper", 0, 0, 9, 21, 3);
  layers.push(
    layer(
      `delivery-confetti-${i}`,
      [
        group(
          "confetti",
          [shape],
          fill([C.coral, C.blue, C.gold, C.ink][i % 4]),
        ),
      ],
      {
        p: anim([
          [277, [640, 350, 0]],
          [304, [x, y, 0]],
          [359, [x + (i % 2 ? 30 : -30), y + 70, 0]],
        ]),
        s: anim([
          [277, [0, 0, 100]],
          [289, [100, 100, 100]],
          [359, [80, 80, 100]],
        ]),
        r: anim(
          [
            [277, 0],
            [359, (i % 2 ? 1 : -1) * (80 + i * 17)],
          ],
          false,
        ),
        o: anim([
          [277, 0],
          [287, 100],
          [338, 100],
          [359, 0],
        ]),
        ip: 277,
      },
    ),
  );
}

export const lottieDocument = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: D,
  w: W,
  h: H,
  nm: "Special Delivery — original Dojo Lottie story",
  ddd: 0,
  assets: [],
  layers: layers
    .reverse()
    .map((entry, index) => ({ ...entry, ind: index + 1 })),
};
const sceneMotion = (property, points) => ({
  kind: "keyframes",
  property,
  frames: points.map(([frame, value]) => ({ frame, value })),
});
const text = (id, value, x, y, w, size, extra = {}) => ({
  id,
  type: "text",
  text: value,
  style: {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: size * 1.5,
    fontFamily: "Arial, sans-serif",
    fontSize: size,
    fontWeight: 700,
    color: C.ink,
    letterSpacing: 1,
    ...extra,
  },
});
const chapter = (id, value, from, duration) => ({
  id,
  type: "div",
  from,
  duration,
  style: { position: "absolute", inset: 0 },
  children: [
    text(`${id}-text`, value, 140, 603, 1000, 31, {
      textAlign: "center",
      letterSpacing: -0.6,
    }),
  ],
  animations: [
    sceneMotion("opacity", [
      [0, 0],
      [12, 1],
      [duration - 14, 1],
      [duration - 1, 0],
    ]),
  ],
});
export const scene = {
  schemaVersion: 1,
  width: W,
  height: H,
  fps: 30,
  duration: D,
  assets: {
    "special-delivery-lottie": {
      id: "special-delivery-lottie",
      type: "lottie",
      src: `data:application/json,${encodeURIComponent(JSON.stringify(lottieDocument))}`,
    },
  },
  nodes: [
    {
      id: "lottie-paper",
      type: "div",
      from: 0,
      duration: D,
      style: { position: "absolute", inset: 0, backgroundColor: C.cream },
    },
    {
      id: "lottie-story",
      type: "lottie",
      assetId: "special-delivery-lottie",
      from: 0,
      duration: D,
      style: { position: "absolute", inset: 0, objectFit: "contain" },
    },
    {
      id: "lottie-editorial",
      type: "div",
      from: 0,
      duration: D,
      style: { position: "absolute", inset: 0 },
      children: [
        text("lottie-label", "DOJO / VECTOR STORIES", 50, 34, 600, 13, {
          letterSpacing: 2,
        }),
        text("lottie-edition", "SPECIAL DELIVERY", 860, 34, 370, 13, {
          textAlign: "right",
          letterSpacing: 2,
        }),
        {
          id: "lottie-top-rule",
          type: "div",
          style: {
            position: "absolute",
            left: 50,
            top: 69,
            width: 1180,
            height: 1,
            backgroundColor: "#D7DBCB",
          },
        },
        text("lottie-footer", "SMALL IDEAS. GOOD JOURNEYS.", 50, 679, 700, 10, {
          letterSpacing: 2,
          color: "#7F9387",
        }),
        text("lottie-medium", "ORIGINAL LOTTIE ANIMATION", 850, 679, 380, 10, {
          textAlign: "right",
          letterSpacing: 1.7,
          color: "#7F9387",
        }),
      ],
    },
    chapter("lottie-open", "A small idea.", 0, 100),
    chapter("lottie-fly", "Give it room to fly.", 100, 160),
    chapter("lottie-deliver", "Good things find their way.", 260, 100),
  ],
};
export const metadata = {
  title: "Special Delivery",
  description:
    "An original Lottie envelope-to-flight-to-delivery story with shape morphs, trim paths and springy vector motion.",
  posterFrame: 310,
  frames: [0, 30, 65, 90, 130, 175, 225, 255, 295, 310, 340, 359],
  lottieAssetIds: ["special-delivery-lottie"],
};
export default scene;
