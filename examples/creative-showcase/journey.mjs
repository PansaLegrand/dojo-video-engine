/** NIGHT TRAIN — an original illustrated journey, drawn entirely as editable
 * vector shapes. The landscape, viaduct, train and typography are separate
 * layers; motion is deterministic parallax and native keyframes. */
const W = 1280,
  H = 720,
  D = 360;
const key = (property, points) => ({
  kind: "keyframes",
  property,
  frames: points.map(([frame, value, easing]) => ({
    frame,
    value,
    ...(easing ? { easing } : {}),
  })),
});
const motion = (x0, x1, y0 = 0, y1 = 0) => [
  key("transform", [
    [0, `translate(${x0}px, ${y0}px)`],
    [D - 1, `translate(${x1}px, ${y1}px)`],
  ]),
];
const group = (id, children, animations = []) => ({
  id,
  type: "div",
  from: 0,
  duration: D,
  style: { position: "absolute", left: 0, top: 0, width: W, height: H },
  children,
  animations,
});
const box = (id, x, y, w, h, color, style = {}) => ({
  id,
  type: "div",
  style: {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    backgroundColor: color,
    ...style,
  },
});
const ellipse = (id, x, y, w, h, color, style = {}) => ({
  id,
  type: "shape",
  shape: { kind: "ellipse" },
  style: {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    fill: color,
    ...style,
  },
});
const path = (id, d, color, style = {}) => ({
  id,
  type: "shape",
  shape: { kind: "path", d, viewBox: { x: 0, y: 0, width: W, height: H } },
  style: {
    position: "absolute",
    left: 0,
    top: 0,
    width: W,
    height: H,
    fill: color,
    ...style,
  },
});
const text = (id, value, x, y, w, size, color, style = {}) => ({
  id,
  type: "text",
  text: value,
  style: {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: size * 1.35,
    fontFamily: "Arial",
    fontSize: size,
    fontWeight: 700,
    color,
    lineHeight: 1.1,
    ...style,
  },
});
const sky = group("journey-sky", [
  box("evening-sky", 0, 0, W, H, "#222344", {
    background:
      "linear-gradient(180deg, #15172f 0%, #41456f 46%, #d38c8b 78%, #f4bf9d 100%)",
  }),
  ellipse("moon-glow", 880, 40, 300, 300, "#f7d8b0", { opacity: 0.055 }),
  ellipse("moon-halo", 925, 85, 210, 210, "#f7d8b0", { opacity: 0.07 }),
  ellipse("moon", 965, 124, 132, 132, "#ffe4bb"),
  ellipse("moon-crater-a", 988, 160, 27, 25, "#e9c8a4", { opacity: 0.4 }),
  ellipse("moon-crater-b", 1040, 191, 16, 15, "#e9c8a4", { opacity: 0.3 }),
  ...Array.from({ length: 46 }, (_, i) => {
    const x = 31 + ((i * 197) % 1190),
      y = 30 + ((i * 83) % 303),
      size = i % 5 === 0 ? 3 : 1.7;
    const star = ellipse(`star-${i}`, x, y, size, size, "#ffe9cb", {
      opacity: 0.8,
    });
    star.animations = [
      key("opacity", [
        [0, 0.3 + (i % 4) * 0.15],
        [90, 0.8 - (i % 3) * 0.15],
        [180, 0.35 + (i % 3) * 0.15],
        [270, 0.9 - (i % 4) * 0.12],
        [359, 0.3 + (i % 4) * 0.15],
      ]),
    ];
    return star;
  }),
  path(
    "long-cloud",
    "M 415 173 C 467 161 514 158 561 163 C 586 135 627 137 657 161 C 696 151 735 159 757 175 C 650 182 528 183 415 173 Z",
    "#bb9fb6",
    { opacity: 0.17 },
  ),
  path(
    "small-cloud",
    "M 773 283 C 815 269 856 270 883 279 C 910 259 940 264 963 280 C 987 276 1006 281 1027 289 C 920 298 842 297 773 283 Z",
    "#dec2c8",
    { opacity: 0.15 },
  ),
]);

const mountains = group(
  "journey-mountains",
  [
    path(
      "far-mountain",
      "M -70 500 L 28 374 L 103 414 L 243 223 L 391 388 L 492 326 L 603 421 L 768 278 L 905 402 L 1097 241 L 1264 416 L 1390 340 L 1480 720 L -70 720 Z",
      "#77718c",
    ),
    path(
      "snow-left",
      "M 176 314 L 243 223 L 311 299 L 276 287 L 251 309 L 229 287 L 209 323 Z",
      "#c6a5ac",
    ),
    path(
      "snow-right",
      "M 1026 321 L 1097 241 L 1176 324 L 1130 302 L 1100 326 L 1081 295 L 1062 323 Z",
      "#cfadb0",
    ),
    path(
      "mountain-shadow-left",
      "M 243 223 L 391 388 L 488 428 L 339 430 L 285 333 Z",
      "#625e7f",
    ),
    path(
      "mountain-shadow-right",
      "M 1097 241 L 1264 416 L 1330 512 L 1153 420 L 1120 317 Z",
      "#5d5b7b",
    ),
    path(
      "middle-mountain",
      "M -100 577 C 40 406 137 406 248 510 L 389 361 L 532 506 L 683 414 L 848 523 L 1030 380 L 1228 522 L 1430 407 L 1530 720 L -100 720 Z",
      "#424f6e",
    ),
    path(
      "mountain-highlight",
      "M 305 451 L 389 361 L 453 428 L 408 407 L 391 436 L 365 411 Z",
      "#758096",
    ),
    path(
      "soft-ridge",
      "M -80 599 C 44 530 169 529 275 567 C 387 495 490 495 620 572 C 720 530 846 521 969 556 C 1080 485 1230 494 1385 570 L 1460 720 L -80 720 Z",
      "#2d465f",
    ),
  ],
  motion(0, -58),
);

const village = [];
for (let i = 0; i < 12; i++) {
  const x = 95 + i * 27,
    y = 435 - (i % 4) * 9;
  village.push(box(`house-${i}`, x, y, 19, 17, "#455269"));
  village.push(
    path(
      `roof-${i}`,
      `M ${x - 3} ${y} L ${x + 9} ${y - 9} L ${x + 22} ${y} Z`,
      "#26374e",
    ),
  );
  village.push(
    box(`house-light-${i}`, x + 4, y + 5, 4, 5, "#f3c684", { opacity: 0.7 }),
  );
  if (i % 2 === 0)
    village.push(
      box(`house-light-b-${i}`, x + 12, y + 5, 3, 5, "#f3c684", {
        opacity: 0.6,
      }),
    );
}
const valley = group(
  "journey-valley",
  [
    path(
      "river",
      "M 729 474 C 664 524 734 533 845 551 C 977 573 883 615 668 663 C 541 691 559 712 580 720 L 1010 720 C 970 689 1036 673 1122 644 C 1248 602 1089 551 905 526 C 803 512 797 492 817 474 Z",
      "#497386",
    ),
    path(
      "river-light",
      "M 761 478 C 735 518 815 532 907 548 C 1044 572 1029 589 969 608 C 908 626 784 650 736 664 C 688 678 669 692 681 720 L 704 720 C 686 697 713 680 774 664 C 820 652 941 631 1000 613 C 1070 591 1068 570 935 547 C 838 530 754 519 785 479 Z",
      "#7298a0",
      { opacity: 0.55 },
    ),
    ...Array.from({ length: 10 }, (_, i) =>
      box(
        `water-ripple-${i}`,
        785 + (i % 3) * 34 - i * 7,
        537 + i * 14,
        65 + (i % 4) * 17,
        2,
        "#b3c1b0",
        { opacity: 0.22, borderRadius: 2 },
      ),
    ),
    ...village,
  ],
  motion(10, -95),
);

// A continuous viaduct with vector arch cutouts. The transparent arches reveal
// the valley behind rather than painting fake rectangles in a matching color.
let bridgeD = "M -100 499 H 1430 V 775 H -100 Z ";
for (let i = 0; i < 9; i++) {
  const x = -75 + i * 175;
  bridgeD += `M ${x} 780 V 594 C ${x} 521 ${x + 126} 521 ${x + 126} 594 V 780 Z `;
}
const bridgeShape = path("viaduct-arches", bridgeD, "#203749");
bridgeShape.shape.fillRule = "evenodd";
const bridge = group(
  "journey-viaduct",
  [
    bridgeShape,
    box("bridge-coping", -100, 496, 1600, 11, "#58717e"),
    box("bridge-fascia", -100, 507, 1600, 9, "#314b5e"),
    box("rail-upper", -100, 487, 1600, 3, "#9eaaa0"),
    box("rail-lower", -100, 493, 1600, 3, "#152c3c"),
    ...Array.from({ length: 64 }, (_, i) =>
      box(`rail-sleeper-${i}`, i * 25 - 10, 490, 3, 7, "#203344"),
    ),
    ...Array.from({ length: 38 }, (_, i) =>
      box(`parapet-post-${i}`, i * 43 - 6, 481, 2, 15, "#718087"),
    ),
    box("parapet-rail", -100, 481, 1600, 2, "#72838b"),
  ],
  motion(0, -130),
);

const carriages = [];
for (let c = 0; c < 3; c++) {
  const x = c * 170;
  carriages.push(box(`car-${c}-connector`, x - 8, 445, 12, 32, "#132a3a"));
  carriages.push(
    box(`car-${c}-body`, x, 426, 160, 52, "#f1c7a0", { borderRadius: 9 }),
  );
  carriages.push(
    box(`car-${c}-roof`, x + 4, 423, 152, 8, "#ab6c65", { borderRadius: 6 }),
  );
  carriages.push(box(`car-${c}-orange`, x, 465, 160, 11, "#df785f"));
  carriages.push(box(`car-${c}-underbody`, x + 5, 477, 150, 7, "#1a2937"));
  for (let j = 0; j < 6; j++) {
    carriages.push(
      box(
        `car-${c}-window-frame-${j}`,
        x + 11 + j * 24,
        436,
        18,
        23,
        "#756a72",
        { borderRadius: 4 },
      ),
    );
    carriages.push(
      box(
        `car-${c}-window-${j}`,
        x + 13 + j * 24,
        438,
        14,
        19,
        j % 3 === 1 ? "#f6c983" : "#ffe2a2",
        { borderRadius: 2 },
      ),
    );
    carriages.push(
      box(
        `car-${c}-window-reflection-${j}`,
        x + 15 + j * 24,
        440,
        3,
        15,
        "#fff1cc",
        { opacity: 0.45 },
      ),
    );
  }
  for (const w of [21, 132]) {
    carriages.push(
      ellipse(`car-${c}-wheel-${w}`, x + w, 478, 14, 14, "#102736"),
    );
    carriages.push(
      ellipse(`car-${c}-hub-${w}`, x + w + 4, 482, 6, 6, "#647786"),
    );
  }
}
const engineX = 510;
const train = group(
  "journey-train",
  [
    ...carriages,
    path(
      "engine-body",
      `M ${engineX} 426 H ${engineX + 54} C ${engineX + 77} 426 ${engineX + 85} 436 ${engineX + 104} 451 L ${engineX + 121} 466 Q ${engineX + 128} 478 ${engineX + 112} 478 H ${engineX} Z`,
      "#f1c7a0",
    ),
    path(
      "engine-stripe",
      `M ${engineX} 465 H ${engineX + 119} Q ${engineX + 127} 477 ${engineX + 112} 478 H ${engineX} Z`,
      "#e2765e",
    ),
    path(
      "driver-window",
      `M ${engineX + 57} 435 Q ${engineX + 72} 435 ${engineX + 85} 449 H ${engineX + 57} Z`,
      "#f7dda1",
    ),
    box("engine-window", engineX + 16, 436, 30, 22, "#ffe2a2", {
      borderRadius: 3,
    }),
    box("engine-grille", engineX + 11, 466, 31, 3, "#bc5d52"),
    box("engine-underbody", engineX + 8, 478, 99, 7, "#172c39"),
    ellipse("engine-wheel-a", engineX + 18, 478, 14, 14, "#102736"),
    ellipse("engine-wheel-b", engineX + 87, 478, 14, 14, "#102736"),
    ellipse("headlight", engineX + 113, 458, 9, 6, "#fff0b4"),
    path(
      "headlight-beam",
      `M ${engineX + 119} 460 L ${engineX + 224} 442 L ${engineX + 224} 482 Z`,
      "#ffe9a9",
      { opacity: 0.075 },
    ),
  ],
  motion(-600, 1420),
);

function pine(id, x, y, size, color) {
  const w = size * 0.52;
  return path(
    id,
    `M ${x} ${y - size} L ${x - w * 0.6} ${y - size * 0.52} H ${x - w * 0.35} L ${x - w * 0.82} ${y - size * 0.22} H ${x - w * 0.5} L ${x - w} ${y + size * 0.12} H ${x - 4} V ${y + size * 0.38} H ${x + 4} V ${y + size * 0.12} H ${x + w} L ${x + w * 0.5} ${y - size * 0.22} H ${x + w * 0.82} L ${x + w * 0.35} ${y - size * 0.52} H ${x + w * 0.6} Z`,
    color,
  );
}
const foreground = group(
  "journey-foreground",
  [
    path(
      "near-hill-left",
      "M -100 585 C 42 577 98 620 199 659 C 299 702 355 698 411 720 H -100 Z",
      "#142d3d",
    ),
    path(
      "near-hill-right",
      "M 892 720 C 981 666 1032 632 1133 612 C 1238 592 1378 558 1474 579 L 1480 720 Z",
      "#142d3d",
    ),
    pine("pine-left-back", 100, 595, 118, "#1b3c49"),
    pine("pine-left", 24, 598, 185, "#112b3a"),
    pine("pine-left-small", 175, 654, 86, "#112b3a"),
    pine("pine-right-back", 1190, 620, 115, "#21414d"),
    pine("pine-right", 1285, 615, 218, "#102b3a"),
    pine("pine-right-small", 1130, 665, 96, "#102b3a"),
    ...Array.from({ length: 20 }, (_, i) =>
      ellipse(
        `firefly-${i}`,
        41 + ((i * 71) % 1220),
        595 + ((i * 29) % 110),
        2 + (i % 2),
        2 + (i % 2),
        "#f6c982",
        { opacity: 0.3 + (i % 3) * 0.18 },
      ),
    ),
  ],
  motion(45, -190),
);

const typography = group("journey-lettering", [
  text(
    "journey-kicker",
    "A SMALL JOURNEY / A BIG WORLD",
    65,
    58,
    580,
    12,
    "#edc9bc",
    { letterSpacing: 3, fontWeight: 700 },
  ),
  text("journey-title", "Night train.", 61, 89, 610, 67, "#fff0d8", {
    fontFamily: "Georgia, serif",
    fontWeight: 400,
    letterSpacing: -2,
  }),
  text(
    "journey-subtitle",
    "Take the scenic route.",
    65,
    179,
    460,
    16,
    "#e8c9bf",
    { fontWeight: 400, letterSpacing: 0.2 },
  ),
  text(
    "journey-bottom",
    "SOMEWHERE NEW IS WAITING.",
    65,
    653,
    700,
    12,
    "#c0d5cf",
    { letterSpacing: 2.5 },
  ),
  text(
    "journey-edition",
    "DOJO / MOTION STORIES",
    965,
    653,
    250,
    11,
    "#c0d5cf",
    { letterSpacing: 2, textAlign: "right" },
  ),
  box("journey-rule", 65, 639, 1150, 1, "#91adb0", { opacity: 0.35 }),
]);

export const scene = {
  schemaVersion: 1,
  width: W,
  height: H,
  fps: 30,
  duration: D,
  assets: {},
  nodes: [sky, mountains, valley, bridge, train, foreground, typography],
  markers: { departure: 0, crossing: 140, arrival: 300 },
};
export const metadata = {
  title: "Night Train",
  description:
    "An illustrated journey through a moonlit mountain valley, with layered parallax and an editable vector train.",
  posterFrame: 165,
  frames: [0, 45, 95, 140, 165, 215, 285, 359],
};
export default scene;
