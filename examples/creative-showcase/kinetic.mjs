/**
 * TYPE IN MOTION — a portrait editorial motion poster.
 * Three authored graphic chapters: assemble, disrupt, move. All typography,
 * masks, shapes and keyframes remain editable native Scene data.
 */
const W = 720;
const H = 1280;
const FPS = 30;
const BEAT = 120;
const paper = "#F4F0E5";
const ink = "#171613";
const orange = "#FF4B16";

const track = (property, values) => ({
  kind: "keyframes",
  property,
  frames: values.map(([frame, value, easing]) => ({
    frame,
    value,
    ...(easing ? { easing } : {}),
  })),
});
const rectangle = (id, x, y, width, height, color, style = {}) => ({
  id,
  type: "div",
  style: {
    position: "absolute",
    left: x,
    top: y,
    width,
    height,
    backgroundColor: color,
    ...style,
  },
});
const type = (id, copy, x, y, width, height, size, color, style = {}) => ({
  id,
  type: "text",
  text: copy,
  style: {
    position: "absolute",
    left: x,
    top: y,
    width,
    height,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontWeight: 900,
    fontSize: size,
    color,
    lineHeight: 1,
    letterSpacing: -size * 0.065,
    maxLines: 1,
    ...style,
  },
});
const label = (id, copy, x, y, width, color, align = "left") =>
  type(id, copy, x, y, width, 30, 17, color, {
    letterSpacing: 2,
    fontWeight: 700,
    textAlign: align,
  });
const group = (id, children, style = {}, animations = []) => ({
  id,
  type: "div",
  style: {
    position: "absolute",
    left: 0,
    top: 0,
    width: W,
    height: H,
    ...style,
  },
  children,
  animations,
});

// A striped asterisk rather than an imported icon. Rotation is frame driven.
function asterisk(id, x, y, size, color, turn = 90) {
  return group(
    id,
    Array.from({ length: 4 }, (_, index) =>
      rectangle(`${id}-${index}`, size * 0.43, 0, size * 0.14, size, color, {
        transform: `rotate(${index * 45}deg)`,
        transformOrigin: "center center",
      }),
    ),
    {
      left: x,
      top: y,
      width: size,
      height: size,
      transformOrigin: "center center",
    },
    [
      track("transform", [
        [0, "rotate(0deg)"],
        [119, `rotate(${turn}deg)`],
      ]),
    ],
  );
}

function checker(id, y, color, background) {
  const cells = [];
  for (let row = 0; row < 2; row++)
    for (let column = 0; column < 12; column++)
      cells.push(
        rectangle(
          `${id}-${row}-${column}`,
          column * 60,
          row * 60,
          60,
          60,
          (row + column) % 2 ? background : color,
        ),
      );
  return group(id, cells, {
    left: 0,
    top: y,
    width: W,
    height: 120,
    overflow: "hidden",
  });
}

function runningBand(
  id,
  y,
  copy,
  foreground,
  background,
  angle,
  reverse = false,
) {
  const textNodes = [0, 1, 2].map((index) =>
    type(
      `${id}-copy-${index}`,
      copy,
      index * 760,
      9,
      760,
      105,
      83,
      foreground,
      {
        letterSpacing: -3.5,
      },
    ),
  );
  return group(
    id,
    [
      rectangle(`${id}-backing`, 0, 0, 2400, 118, background),
      group(`${id}-loop`, textNodes, { width: 2400, height: 118 }, [
        track(
          "transform",
          reverse
            ? [
                [0, "translate(-760px, 0px)"],
                [119, "translate(0px, 0px)"],
              ]
            : [
                [0, "translate(0px, 0px)"],
                [119, "translate(-760px, 0px)"],
              ],
        ),
      ]),
    ],
    {
      left: -80,
      top: y,
      width: 2400,
      height: 118,
      transform: `rotate(${angle}deg)`,
      transformOrigin: "left center",
    },
  );
}

function chapter(id, from, background, children) {
  return {
    ...group(
      id,
      [rectangle(`${id}-background`, 0, 0, W, H, background), ...children],
      { overflow: "hidden" },
    ),
    from,
    duration: BEAT,
  };
}

const assembly = chapter("kinetic-assemble", 0, paper, [
  label("assemble-label", "DOJO / MOTION POSTERS", 36, 40, 450, ink),
  label("assemble-issue", "01 / 03", 530, 40, 154, ink, "right"),
  rectangle("assemble-rule", 36, 90, 648, 2, ink),
  label("assemble-small", "WORDS HAVE MOMENTUM.", 38, 130, 620, ink),
  // Four independent letterforms land on the same baseline with unique rotation.
  ...["T", "Y", "P", "E"].map((letter, index) => ({
    ...type(
      `assemble-letter-${index}`,
      letter,
      22 + index * 166,
      200,
      194,
      265,
      257,
      ink,
    ),
    animations: [
      track("transform", [
        [
          0,
          `translate(0px, ${index % 2 ? -320 : 320}px) rotate(${index % 2 ? 25 : -25}deg)`,
        ],
        [
          12 + index * 4,
          `translate(0px, ${index % 2 ? -320 : 320}px) rotate(${index % 2 ? 25 : -25}deg)`,
        ],
        [
          32 + index * 4,
          "translate(0px, 0px) rotate(0deg)",
          "cubic-bezier(0.18, 0.9, 0.25, 1)",
        ],
      ]),
    ],
  })),
  group(
    "assemble-middle",
    [
      rectangle("assemble-orange", 0, 0, 648, 279, orange),
      type("assemble-in", "IN", 25, -5, 440, 280, 283, ink),
      asterisk("assemble-star", 475, 63, 150, ink, -90),
    ],
    {
      left: 36,
      top: 487,
      width: 648,
      height: 279,
      overflow: "hidden",
      transformOrigin: "left center",
    },
    [
      track("transform", [
        [0, "scale(0.01, 1)"],
        [24, "scale(0.01, 1)"],
        [48, "scale(1, 1)", "easeOut"],
      ]),
    ],
  ),
  group(
    "assemble-motion-window",
    [
      type("assemble-motion", "MOTION", 0, 0, 960, 197, 167, ink, {
        letterSpacing: -12,
      }),
    ],
    { left: 27, top: 801, width: 670, height: 190, overflow: "hidden" },
    [
      track("transform", [
        [0, "translate(760px, 0px)"],
        [35, "translate(760px, 0px)"],
        [60, "translate(0px, 0px)", "easeOut"],
      ]),
    ],
  ),
  rectangle("assemble-bottom-rule", 36, 1040, 648, 2, ink),
  label(
    "assemble-bottom-copy",
    "LET THE LETTERS DO THE TALKING.",
    36,
    1080,
    648,
    ink,
  ),
  checker("assemble-checkers", 1160, ink, paper),
  // An opaque wipe is the final beat; the next chapter begins under its color.
  {
    ...rectangle("assemble-out-wipe", 0, 1280, 720, 1280, ink),
    animations: [
      track("top", [
        [0, 1280],
        [106, 1280],
        [119, 0, "easeInOut"],
      ]),
    ],
  },
]);

const disruption = chapter("kinetic-disrupt", 120, ink, [
  label("disrupt-label", "DOJO / MOTION POSTERS", 36, 40, 450, paper),
  label("disrupt-issue", "02 / 03", 530, 40, 154, paper, "right"),
  runningBand("disrupt-top-band", 232, "MAKE SOME /", ink, orange, -11),
  type("disrupt-outline", "NOISE", -60, 352, 950, 200, 204, ink, {
    textStroke: `2 ${paper}`,
    letterSpacing: -12,
  }),
  // The poster becomes a typographic wall: two bands travel in opposite directions.
  group(
    "disrupt-wordwall",
    [
      type("disrupt-noi", "NOI", -5, 0, 720, 320, 357, paper),
      type("disrupt-se", "SE.", 184, 280, 620, 330, 357, paper),
    ],
    { top: 452, width: 720, height: 620 },
    [
      track("transform", [
        [0, "scale(0.82)"],
        [22, "scale(1)", "easeOut"],
        [92, "scale(1)"],
        [108, "scale(1.07)", "easeInOut"],
      ]),
    ],
  ),
  asterisk("disrupt-star", 32, 810, 174, orange, 180),
  runningBand("disrupt-bottom-band", 1108, "TURN IT UP /", ink, paper, 8, true),
  rectangle("disrupt-footer-backing", 0, 1210, W, 70, ink),
  label(
    "disrupt-bottom-label",
    "BOLD IDEAS. LOUD LETTERS.",
    36,
    1230,
    648,
    orange,
  ),
  {
    ...rectangle("disrupt-out-wipe", -720, 0, 720, 1280, orange),
    animations: [
      track("left", [
        [0, -720],
        [108, -720],
        [119, 0, "easeInOut"],
      ]),
    ],
  },
]);

const movement = chapter("kinetic-move", 240, orange, [
  label("move-label", "DOJO / MOTION POSTERS", 36, 40, 450, ink),
  label("move-issue", "03 / 03", 530, 40, 154, ink, "right"),
  rectangle("move-rule", 36, 90, 648, 2, ink),
  ...["MAKE", "IT", "MOVE"].map((word, index) => ({
    ...type(
      `move-word-${index}`,
      word,
      26,
      163 + index * 250,
      900,
      267,
      index === 1 ? 273 : 220,
      ink,
      {
        letterSpacing: -15,
      },
    ),
    animations: [
      track("transform", [
        [0, `translate(${index % 2 ? 760 : -760}px, 0px)`],
        [index * 9 + 1, `translate(${index % 2 ? 760 : -760}px, 0px)`],
        [
          index * 9 + 26,
          "translate(0px, 0px)",
          "cubic-bezier(0.18, 0.9, 0.25, 1)",
        ],
      ]),
    ],
  })),
  asterisk("move-star", 443, 453, 204, paper, 90),
  group(
    "move-arrow",
    [
      {
        id: "move-arrow-shape",
        type: "shape",
        shape: {
          kind: "polygon",
          points: [
            { x: 0, y: 0.39 },
            { x: 0.78, y: 0.39 },
            { x: 0.65, y: 0 },
            { x: 1, y: 0.5 },
            { x: 0.65, y: 1 },
            { x: 0.78, y: 0.61 },
            { x: 0, y: 0.61 },
          ],
        },
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          width: 320,
          height: 90,
          fill: ink,
        },
      },
    ],
    { left: 36, top: 935, width: 320, height: 90 },
    [
      track("transform", [
        [0, "translate(0px, 0px)"],
        [50, "translate(0px, 0px)"],
        [80, "translate(45px, 0px)", "easeInOut"],
        [110, "translate(0px, 0px)", "easeInOut"],
      ]),
    ],
  ),
  label("move-finish", "YOUR NEXT IDEA, IN MOTION.", 36, 1090, 648, ink),
  checker("move-checkers", 1160, ink, paper),
]);

export const scene = {
  schemaVersion: 1,
  width: W,
  height: H,
  fps: FPS,
  duration: 360,
  assets: {},
  markers: { assemble: 0, disrupt: 120, move: 240 },
  nodes: [assembly, disruption, movement],
};
export const metadata = {
  title: "Type in Motion",
  description:
    "A portrait kinetic-type poster: giant letterforms, diagonal marquees, sharp wipes and checkerboard rhythm.",
  posterFrame: 295,
  frames: [0, 55, 90, 145, 190, 265, 295, 330, 359],
};
export default scene;
