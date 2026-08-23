import { describe, expect, it } from "vitest";
import {
  composition,
  cubicBezierEasing,
  div,
  effect,
  extension,
  evaluateKeyframes,
  evaluateScene,
  layoutScene,
  lottie,
  parseColor,
  parseAspectRatio,
  parseTransform,
  prepareTextLayout,
  prepareTextLines,
  richText,
  sampleScene,
  shape,
  springEasing,
  text,
} from "./index.js";

function layoutOf(builder: ReturnType<typeof composition>) {
  return layoutScene(evaluateScene(builder.toJSON(), 0));
}

describe("builder", () => {
  it("builds schema-valid scenes", () => {
    const scene = composition({
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 90,
    })
      .children(
        div({ id: "root", style: { width: "100%", height: "100%" } }).children(
          text("Hello"),
        ),
      )
      .toJSON();

    expect(scene.nodes[0]?.id).toBe("root");
    expect(scene.nodes[0]?.children?.[0]?.text).toBe("Hello");
  });

  it("assigns auto ids deterministically per scene", () => {
    const build = () =>
      composition({ width: 100, height: 100, fps: 30, duration: 10 })
        .children(div().children(text("a"), text("b")))
        .toJSON();

    const first = build();
    const second = build();

    expect(first).toEqual(second);
    expect(first.nodes[0]?.id).toBe("div-0");
    expect(first.nodes[0]?.children?.map((child) => child.id)).toEqual([
      "text-1",
      "text-2",
    ]);
  });

  it("builds versioned extension nodes", () => {
    const scene = composition({
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
    })
      .children(
        extension({
          id: "grid",
          extension: {
            name: "com.example.grid",
            version: "1.0.0",
            params: { columns: 8 },
          },
        }),
      )
      .toJSON();

    expect(scene.nodes[0]).toMatchObject({
      id: "grid",
      type: "extension",
      extension: {
        name: "com.example.grid",
        version: "1.0.0",
        params: { columns: 8 },
      },
    });
  });

  it("builds serializable shape, clip, and mask geometry", () => {
    const scene = composition({
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
    })
      .children(
        shape(
          {
            kind: "polygon",
            points: [
              { x: 0.5, y: 0 },
              { x: 1, y: 1 },
              { x: 0, y: 1 },
            ],
          },
          {
            id: "triangle",
            clip: { kind: "ellipse" },
            mask: { shape: { kind: "rect", radius: 12 } },
            style: { fill: "#22d3ee", blendMode: "screen" },
          },
        ),
      )
      .toJSON();

    expect(scene.nodes[0]).toMatchObject({
      id: "triangle",
      type: "shape",
      shape: { kind: "polygon" },
      clip: { kind: "ellipse" },
      mask: { shape: { kind: "rect", radius: 12 } },
      style: { fill: "#22d3ee", blendMode: "screen" },
    });
  });

  it("builds metric-stable rich text runs", () => {
    const scene = composition({
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
    })
      .children(
        richText(
          [
            { text: "Hello ", style: { color: "#ffffff" } },
            { text: "MotionForge", style: { color: "#22d3ee" } },
          ],
          { id: "headline" },
        ),
      )
      .toJSON();

    expect(scene.nodes[0]).toMatchObject({
      id: "headline",
      type: "text",
      runs: [
        { text: "Hello ", style: { color: "#ffffff" } },
        { text: "MotionForge", style: { color: "#22d3ee" } },
      ],
    });
    expect(scene.nodes[0]?.text).toBeUndefined();
  });

  it("reflects builder mutations made after attaching to a parent", () => {
    const label = text("late", { id: "label" });
    const scene = composition({
      width: 100,
      height: 100,
      fps: 30,
      duration: 10,
    })
      .children(div({ id: "root" }).children(label))
      .toJSON();

    label.animate("opacity", [{ frame: 0, value: 0 }]);

    const updated = composition({
      width: 100,
      height: 100,
      fps: 30,
      duration: 10,
    })
      .children(div({ id: "root" }).children(label))
      .toJSON();

    expect(scene.nodes[0]?.children?.[0]?.animations).toEqual([]);
    expect(updated.nodes[0]?.children?.[0]?.animations).toHaveLength(1);
  });

  it("builds lottie and deterministic effect nodes", () => {
    const scene = composition({
      width: 320,
      height: 180,
      fps: 30,
      duration: 60,
    })
      .asset({
        id: "sticker",
        type: "lottie",
        src: "/assets/sticker.json",
      })
      .children(
        lottie("sticker", {
          id: "sticker-node",
          playbackRate: 1.5,
          style: { width: 80, height: 80 },
        }),
        effect("confettiBurst", {
          id: "celebration",
          params: { seed: 42, intensity: "high" },
          style: { width: "100%", height: "100%" },
        }),
      )
      .toJSON();

    expect(scene.nodes).toMatchObject([
      {
        id: "sticker-node",
        type: "lottie",
        assetId: "sticker",
        playbackRate: 1.5,
      },
      {
        id: "celebration",
        type: "effect",
        effect: "confettiBurst",
        params: { seed: 42, intensity: "high" },
      },
    ]);
  });
});

describe("animation evaluator", () => {
  it("interpolates numeric keyframes", () => {
    expect(
      evaluateKeyframes(
        [
          { frame: 0, value: 0 },
          { frame: 10, value: 100 },
        ],
        5,
      ),
    ).toBe(50);
  });

  it("filters inactive nodes by frame", () => {
    const scene = sampleScene();
    const resolved = evaluateScene(scene, 130);

    expect(resolved.frame).toBe(119);
    expect(resolved.nodes.length).toBeGreaterThan(0);
  });

  it("exposes node-local frames through nested from offsets", () => {
    const scene = composition({
      width: 100,
      height: 100,
      fps: 30,
      duration: 60,
    })
      .children(
        div({ id: "outer", from: 10, duration: 40 }).children(
          div({ id: "inner", from: 5, duration: 20 }),
        ),
      )
      .toJSON();

    // Scene frame 18: outer local = 8, inner local = 8 - 5 = 3.
    const resolved = evaluateScene(scene, 18);
    const outer = resolved.nodes[0];
    const inner = outer?.children[0];

    expect(outer?.localFrame).toBe(8);
    expect(inner?.localFrame).toBe(3);
  });

  it("does not assign non-string transform animation values into resolved style", () => {
    const scene = composition({
      width: 100,
      height: 100,
      fps: 30,
      duration: 10,
    })
      .children(
        div({ id: "box" }).animate("transform", [{ frame: 0, value: 1 }]),
      )
      .toJSON();

    const resolved = evaluateScene(scene, 0);
    expect(resolved.nodes[0]?.style.transform).toBeUndefined();
  });

  it("interpolates hex colors in RGBA space", () => {
    expect(
      evaluateKeyframes(
        [
          { frame: 0, value: "#000000" },
          { frame: 10, value: "#ffffff" },
        ],
        5,
      ),
    ).toBe("rgba(128, 128, 128, 1)");
  });

  it("interpolates alpha between rgba colors", () => {
    expect(
      evaluateKeyframes(
        [
          { frame: 0, value: "rgba(255, 0, 0, 0)" },
          { frame: 10, value: "rgba(255, 0, 0, 1)" },
        ],
        5,
      ),
    ).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("supports short hex and applies easing to color segments", () => {
    // easeIn at t=0.5 gives 0.25: 255 * 0.25 = 63.75 -> 64.
    expect(
      evaluateKeyframes(
        [
          { frame: 0, value: "#000" },
          { frame: 10, value: "#fff", easing: "easeIn" },
        ],
        5,
      ),
    ).toBe("rgba(64, 64, 64, 1)");
  });

  it("steps non-color strings at the next keyframe", () => {
    const frames = [
      { frame: 0, value: "left" },
      { frame: 10, value: "right" },
    ];

    expect(evaluateKeyframes(frames, 9)).toBe("left");
    expect(evaluateKeyframes(frames, 10)).toBe("right");
  });
});

describe("parseColor", () => {
  it("parses hex and rgb() forms", () => {
    expect(parseColor("#1080ff")).toEqual({ r: 16, g: 128, b: 255, a: 1 });
    expect(parseColor("#108")).toEqual({ r: 17, g: 0, b: 136, a: 1 });
    expect(parseColor("rgb(1, 2, 3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseColor("rgba(1, 2, 3, 0.25)")).toEqual({
      r: 1,
      g: 2,
      b: 3,
      a: 0.25,
    });
  });

  it("returns null for non-colors so they step instead", () => {
    expect(parseColor("tomato")).toBeNull();
    expect(
      parseColor("linear-gradient(180deg, #000 0%, #fff 100%)"),
    ).toBeNull();
    expect(parseColor("translate(10px)")).toBeNull();
  });
});

describe("layout", () => {
  it("resolves absolute left/right insets into an inner width", () => {
    const resolved = evaluateScene(sampleScene(), 25);
    const layout = layoutScene(resolved);
    const subtitleWrap = layout.boxes.find((box) => box.id === "subtitle-wrap");
    const subtitle = subtitleWrap?.children.find(
      (box) => box.id === "subtitle",
    );

    expect(subtitleWrap?.x).toBe(64);
    expect(subtitleWrap?.width).toBe(952);
    expect(subtitle?.x).toBeGreaterThanOrEqual(96);
    expect((subtitle?.x ?? 0) + (subtitle?.width ?? 0)).toBeLessThanOrEqual(
      984,
    );
  });

  it("applies margin as outer spacing and shrinks auto sizes", () => {
    const layout = layoutOf(
      composition({ width: 200, height: 100, fps: 30, duration: 1 }).children(
        div({ id: "spaced", style: { margin: 10 } }),
      ),
    );
    const spaced = layout.boxes.find((box) => box.id === "spaced");

    expect(spaced?.x).toBe(10);
    expect(spaced?.y).toBe(10);
    expect(spaced?.width).toBe(180);
    expect(spaced?.height).toBe(80);
  });

  it("applies per-side margin and padding overrides", () => {
    const layout = layoutOf(
      composition({ width: 200, height: 100, fps: 30, duration: 1 }).children(
        div({
          id: "spaced",
          style: {
            margin: 5,
            marginTop: 10,
            marginRight: 30,
            marginBottom: 15,
            marginLeft: 20,
            padding: 4,
            paddingTop: 6,
            paddingRight: 20,
            paddingBottom: 8,
            paddingLeft: 10,
          },
        }).children(div({ id: "content" })),
      ),
    );
    const spaced = layout.boxes.find((box) => box.id === "spaced");
    const content = spaced?.children[0];

    expect(spaced).toMatchObject({ x: 20, y: 10, width: 150, height: 75 });
    expect(content).toMatchObject({ x: 30, y: 16, width: 120, height: 61 });
  });

  it("derives an auto dimension from aspectRatio", () => {
    const layout = layoutOf(
      composition({ width: 400, height: 300, fps: 30, duration: 1 }).children(
        div({ id: "wide", style: { width: 160, aspectRatio: "16/9" } }),
        div({ id: "tall", style: { height: 100, aspectRatio: 2 } }),
      ),
    );

    expect(layout.boxes.find((box) => box.id === "wide")).toMatchObject({
      width: 160,
      height: 90,
    });
    expect(layout.boxes.find((box) => box.id === "tall")).toMatchObject({
      width: 200,
      height: 100,
    });
    expect(parseAspectRatio("4 / 3")).toBe(4 / 3);
    expect(parseAspectRatio("1/0")).toBeNull();
  });

  it("constrains a node to engine-level safe-area insets", () => {
    const layout = layoutOf(
      composition({ width: 400, height: 200, fps: 30, duration: 1 }).children(
        div({
          id: "safe",
          style: {
            safeArea: { top: 20, right: "10%", bottom: 30, left: "5%" },
          },
        }),
      ),
    );

    expect(layout.boxes.find((box) => box.id === "safe")).toMatchObject({
      x: 20,
      y: 20,
      width: 340,
      height: 150,
    });
  });

  it("clamps explicit sizes with min/max, min winning", () => {
    const layout = layoutOf(
      composition({ width: 200, height: 100, fps: 30, duration: 1 }).children(
        div({ id: "maxed", style: { width: 500, maxWidth: "50%" } }),
        div({
          id: "conflicted",
          style: { width: 10, minWidth: 120, maxWidth: 80 },
        }),
      ),
    );

    expect(layout.boxes.find((box) => box.id === "maxed")?.width).toBe(100);
    expect(layout.boxes.find((box) => box.id === "conflicted")?.width).toBe(
      120,
    );
  });

  it("distributes leftover space with justify-content space-between", () => {
    const layout = layoutOf(
      composition({ width: 300, height: 100, fps: 30, duration: 1 }).children(
        div({
          id: "rowbox",
          style: {
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "space-between",
          },
        }).children(
          div({ id: "a", style: { width: 50, height: 20 } }),
          div({ id: "b", style: { width: 50, height: 20 } }),
          div({ id: "c", style: { width: 50, height: 20 } }),
        ),
      ),
    );
    const row = layout.boxes.find((box) => box.id === "rowbox");
    const xs = row?.children.map((child) => child.x);

    expect(xs).toEqual([0, 125, 250]);
  });

  it("stretches unsized children across the cross axis", () => {
    const layout = layoutOf(
      composition({ width: 300, height: 100, fps: 30, duration: 1 }).children(
        div({
          id: "rowbox",
          style: {
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "stretch",
          },
        }).children(
          div({ id: "auto", style: { width: 50 } }),
          div({ id: "fixed", style: { width: 50, height: 40 } }),
        ),
      ),
    );
    const row = layout.boxes.find((box) => box.id === "rowbox");

    expect(row?.children.find((child) => child.id === "auto")?.height).toBe(
      100,
    );
    expect(row?.children.find((child) => child.id === "fixed")?.height).toBe(
      40,
    );
  });
});

describe("intrinsic text auto-height", () => {
  // Deterministic stand-in for canvas measurement: every character is 10px.
  const measureTextLine = (line: string) => line.length * 10;

  function layoutWithMeasure(builder: ReturnType<typeof composition>) {
    return layoutScene(evaluateScene(builder.toJSON(), 0), {
      measureTextLine,
    });
  }

  it("sizes top-anchored absolute text to its wrapped line count", () => {
    const layout = layoutWithMeasure(
      composition({ width: 200, height: 400, fps: 30, duration: 1 }).children(
        text("aaaa bbbb", {
          id: "title",
          style: {
            position: "absolute",
            left: 0,
            top: 30,
            width: 50,
            fontSize: 20,
          },
        }),
      ),
    );
    const title = layout.boxes.find((box) => box.id === "title");

    // "aaaa bbbb" measures 90px, the box is 50px: two lines at the default
    // 1.25 lineHeight = 2 × 25, instead of filling the 400px parent.
    expect(title?.y).toBe(30);
    expect(title?.height).toBe(50);
  });

  it("anchors bottom-positioned auto-height text just above `bottom`", () => {
    const layout = layoutWithMeasure(
      composition({ width: 200, height: 400, fps: 30, duration: 1 }).children(
        text("abc", {
          id: "subtitle",
          style: {
            position: "absolute",
            left: 0,
            bottom: 40,
            width: 100,
            fontSize: 20,
          },
        }),
      ),
    );
    const subtitle = layout.boxes.find((box) => box.id === "subtitle");

    expect(subtitle?.height).toBe(25);
    expect(subtitle?.y).toBe(400 - 40 - 25);
  });

  it("keeps top+bottom constrained heights and explicit heights", () => {
    const layout = layoutWithMeasure(
      composition({ width: 200, height: 400, fps: 30, duration: 1 }).children(
        text("abc", {
          id: "constrained",
          style: { position: "absolute", top: 50, bottom: 50, fontSize: 20 },
        }),
        text("abc", {
          id: "explicit",
          style: { position: "absolute", top: 0, height: 80, fontSize: 20 },
        }),
      ),
    );

    expect(layout.boxes.find((box) => box.id === "constrained")?.height).toBe(
      300,
    );
    expect(layout.boxes.find((box) => box.id === "explicit")?.height).toBe(80);
  });

  it("reserves one flex slot per wrapped line, not per explicit newline", () => {
    const layout = layoutWithMeasure(
      composition({ width: 200, height: 400, fps: 30, duration: 1 }).children(
        div({
          id: "column",
          style: {
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
          },
        }).children(
          text("aaaa bbbb", {
            id: "wrapped",
            style: { width: 50, fontSize: 20 },
          }),
          div({ id: "after", style: { width: 50, height: 10 } }),
        ),
      ),
    );
    const column = layout.boxes.find((box) => box.id === "column");
    const wrapped = column?.children.find((child) => child.id === "wrapped");
    const after = column?.children.find((child) => child.id === "after");

    expect(wrapped?.height).toBe(50);
    expect(after?.y).toBe(50);
  });

  it("falls back to the character-count heuristic without a measurer", () => {
    const layout = layoutOf(
      composition({ width: 200, height: 400, fps: 30, duration: 1 }).children(
        text("aaaa bbbb", {
          id: "title",
          style: {
            position: "absolute",
            left: 0,
            top: 30,
            width: 50,
            fontSize: 20,
          },
        }),
      ),
    );
    const title = layout.boxes.find((box) => box.id === "title");

    // Heuristic: 9 chars × 20 × 0.58 = 104.4 > 50, each word 46.4 ≤ 50 →
    // two lines, same shape as real measurement at this size.
    expect(title?.height).toBe(50);
  });
});

describe("bounded text lines", () => {
  const measureTextLine = (line: string) => Array.from(line).length * 10;

  it("limits rendered lines to maxLines", () => {
    expect(
      prepareTextLines("aaaa bbbb cccc", 50, measureTextLine, {
        maxLines: 2,
      }),
    ).toEqual(["aaaa", "bbbb"]);
  });

  it("adds a measured ellipsis to the final visible line", () => {
    expect(
      prepareTextLines("aaaa bbbb cccc", 50, measureTextLine, {
        maxLines: 2,
        textOverflow: "ellipsis",
      }),
    ).toEqual(["aaaa", "bbbb…"]);
  });

  it("returns an empty final line when the ellipsis cannot fit", () => {
    expect(
      prepareTextLines("abcdef", 5, measureTextLine, {
        maxLines: 1,
        textOverflow: "ellipsis",
      }),
    ).toEqual([""]);
  });

  it("clamps CJK text after grapheme wrapping", () => {
    expect(
      prepareTextLines("这是一个很长的中文段落", 40, measureTextLine, {
        maxLines: 2,
        textOverflow: "ellipsis",
      }),
    ).toEqual(["这是一个", "很长的…"]);
  });

  it("uses maxLines for intrinsic auto-height", () => {
    const layout = layoutScene(
      evaluateScene(
        composition({ width: 200, height: 400, fps: 30, duration: 1 })
          .children(
            text("aaaa bbbb cccc", {
              id: "title",
              style: {
                position: "absolute",
                left: 0,
                top: 30,
                width: 50,
                fontSize: 20,
                maxLines: 2,
                textOverflow: "ellipsis",
              },
            }),
          )
          .toJSON(),
        0,
      ),
      { measureTextLine },
    );
    const title = layout.boxes.find((box) => box.id === "title");

    expect(title?.height).toBe(50);
  });
});

describe("text fit modes", () => {
  const measureTextLine = (line: string, fontSize: number) =>
    Array.from(line).length * fontSize * 0.5;

  it("truncate mode keeps one line and can ellipsize it", () => {
    const layout = prepareTextLayout(
      "aaaa bbbb cccc",
      50,
      20,
      measureTextLine,
      {
        textFit: "truncate",
        textOverflow: "ellipsis",
      },
    );

    expect(layout.lines).toEqual(["aaaa…"]);
    expect(layout.fontSize).toBe(20);
  });

  it("shrinks font size until bounded text fits the box height", () => {
    const layout = prepareTextLayout(
      "aaaa bbbb cccc dddd",
      50,
      20,
      measureTextLine,
      {
        textFit: "shrink",
        height: 40,
        lineHeight: 1,
        minFontSize: 10,
      },
    );

    expect(layout.fontSize).toBeLessThan(20);
    expect(layout.fontSize).toBeGreaterThanOrEqual(10);
    expect(layout.lines.length * layout.lineHeight).toBeLessThanOrEqual(40);
  });

  it("does not shrink below minFontSize", () => {
    const layout = prepareTextLayout(
      "aaaaaaaaaaaaaaaaaaaaaaaa",
      20,
      20,
      measureTextLine,
      {
        textFit: "shrink",
        height: 10,
        minFontSize: 12,
      },
    );

    expect(layout.fontSize).toBe(12);
  });
});

describe("parseTransform", () => {
  it("normalizes translate, scale, and rotate", () => {
    expect(
      parseTransform("translate(10px, 20%) scale(1.5) rotate(45deg)"),
    ).toEqual([
      {
        name: "translate",
        args: [
          { value: 10, unit: "px" },
          { value: 20, unit: "%" },
        ],
      },
      {
        name: "scale",
        args: [
          { value: 1.5, unit: "" },
          { value: 1.5, unit: "" },
        ],
      },
      { name: "rotate", args: [{ value: 45, unit: "deg" }] },
    ]);
  });

  it("rejects non-transform strings", () => {
    expect(parseTransform("#ff0000")).toBeNull();
    expect(parseTransform("rgba(0, 0, 0, 1)")).toBeNull();
    expect(parseTransform("matrix(1, 0, 0, 1, 0, 0)")).toBeNull();
    expect(parseTransform("scale(1) extra")).toBeNull();
  });
});

describe("transform keyframes", () => {
  it("tweens matching transform lists", () => {
    expect(
      evaluateKeyframes(
        [
          { frame: 0, value: "scale(1) rotate(0deg)" },
          { frame: 10, value: "scale(1.5) rotate(90deg)" },
        ],
        5,
      ),
    ).toBe("scale(1.25, 1.25) rotate(45deg)");
  });

  it("applies easing to transform tweens", () => {
    // easeIn at t=0.5 -> 0.25: 0 + 100 * 0.25 = 25px.
    expect(
      evaluateKeyframes(
        [
          { frame: 0, value: "translate(0px, 0px)" },
          { frame: 10, value: "translate(100px, 0px)", easing: "easeIn" },
        ],
        5,
      ),
    ).toBe("translate(25px, 0px)");
  });

  it("steps when function sequences or units mismatch", () => {
    const mismatched = [
      { frame: 0, value: "scale(1)" },
      { frame: 10, value: "rotate(90deg)" },
    ];
    expect(evaluateKeyframes(mismatched, 5)).toBe("scale(1)");

    const unitClash = [
      { frame: 0, value: "translate(10px, 0px)" },
      { frame: 10, value: "translate(50%, 0px)" },
    ];
    expect(evaluateKeyframes(unitClash, 5)).toBe("translate(10px, 0px)");
  });
});

describe("easing expressions", () => {
  it("cubic-bezier hits the endpoints and stays monotonic", () => {
    expect(cubicBezierEasing(0, 0.25, 0.1, 0.25, 1)).toBe(0);
    expect(cubicBezierEasing(1, 0.25, 0.1, 0.25, 1)).toBe(1);

    let previous = 0;

    for (let step = 1; step <= 20; step += 1) {
      const value = cubicBezierEasing(step / 20, 0.25, 0.1, 0.25, 1);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("a linear-equivalent bezier reproduces t", () => {
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      expect(cubicBezierEasing(t, 0.25, 0.25, 0.75, 0.75)).toBeCloseTo(t, 5);
    }
  });

  it("symmetric ease-in-out crosses 0.5 at the midpoint", () => {
    expect(cubicBezierEasing(0.5, 0.42, 0, 0.58, 1)).toBeCloseTo(0.5, 5);
  });

  it("spring(0) never overshoots; spring(0.4) does", () => {
    let calmMax = 0;
    let bouncyMax = 0;

    for (let step = 0; step <= 100; step += 1) {
      calmMax = Math.max(calmMax, springEasing(step / 100, 0));
      bouncyMax = Math.max(bouncyMax, springEasing(step / 100, 0.4));
    }

    expect(calmMax).toBeLessThanOrEqual(1);
    expect(bouncyMax).toBeGreaterThan(1.05);
    expect(springEasing(0.99, 0.4)).toBeCloseTo(1, 1);
  });

  it("evaluateKeyframes accepts expression easings", () => {
    expect(
      evaluateKeyframes(
        [
          { frame: 0, value: 0 },
          {
            frame: 10,
            value: 100,
            easing: "cubic-bezier(0.25, 0.25, 0.75, 0.75)",
          },
        ],
        5,
      ),
    ).toBeCloseTo(50, 4);
  });
});
