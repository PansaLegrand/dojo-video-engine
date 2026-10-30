import { describe, expect, it } from "vitest";
import type { SceneAnimation, SceneAsset } from "@dojo-video-engine/schema";
import {
  audio,
  composition,
  createBoundedMediaMetricsProvider,
  createBoundedTextMetricsProvider,
  cubicBezierEasing,
  div,
  effect,
  extension,
  evaluateKeyframes,
  evaluateScene,
  getLayoutContentRect,
  invertAffineMatrix,
  layoutScene,
  lottie,
  parseColor,
  parseFilter,
  parseAspectRatio,
  parseTransform,
  pointInRoundedLayoutRect,
  prepareTextLayout,
  prepareTextLines,
  richText,
  resolveObjectFitRect,
  resolveMediaMetrics,
  resolveLayoutCornerRadii,
  resolveStyleTransformMatrix,
  resolveTextLineMetrics,
  resolveAnimationFrame,
  sampleScene,
  shape,
  springEasing,
  text,
  transformLayoutPoint,
  transformLayoutRect,
  video,
  type MediaMetricsProvider,
  type TextMetricsProvider,
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

  it("preserves complete repeat/yoyo animations through the builder", () => {
    const animation = {
      kind: "keyframes" as const,
      property: "opacity",
      frames: [
        { frame: 0, value: 0 },
        { frame: 10, value: 1 },
      ],
      repeat: 2,
      yoyo: true,
    } satisfies SceneAnimation;
    const scene = composition({
      width: 100,
      height: 100,
      fps: 30,
      duration: 40,
    })
      .children(div({ id: "pulse" }).animate(animation))
      .toJSON();

    expect(scene.nodes[0]?.animations).toEqual([animation]);
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
            { text: "DojoVideoEngine", style: { color: "#22d3ee" } },
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
        { text: "DojoVideoEngine", style: { color: "#22d3ee" } },
      ],
    });
    expect(scene.nodes[0]?.text).toBeUndefined();
  });

  it("builds sorted named scene markers", () => {
    const scene = composition({
      width: 320,
      height: 180,
      fps: 30,
      duration: 60,
    })
      .marker("outro", 48)
      .marker("intro", 0)
      .toJSON();

    expect(scene.markers).toEqual({ intro: 0, outro: 48 });
  });

  it("builds audio buses, panning, ducking, and looping video behavior", () => {
    const scene = composition({
      width: 320,
      height: 180,
      fps: 30,
      duration: 60,
    })
      .audioBus("music", { gain: 0.8, limiter: true })
      .asset({ id: "music", type: "audio", src: "music.wav" })
      .asset({ id: "clip", type: "video", src: "clip.mp4" })
      .children(
        audio("music", {
          id: "bed",
          audioBus: "music",
          pan: -0.2,
        }),
        video("clip", {
          id: "clip",
          videoEndBehavior: "loop",
          ducks: { bus: "music", gain: 0.4 },
        }),
      )
      .toJSON();

    expect(scene.audioBuses).toEqual({ music: { gain: 0.8, limiter: true } });
    expect(scene.nodes).toMatchObject([
      { audioBus: "music", pan: -0.2 },
      { videoEndBehavior: "loop", ducks: { bus: "music", gain: 0.4 } },
    ]);
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

  it("rejects non-string transform animation values before evaluation", () => {
    expect(() =>
      composition({
        width: 100,
        height: 100,
        fps: 30,
        duration: 10,
      })
        .children(
          div({ id: "box" }).animate("transform", [{ frame: 0, value: 1 }]),
        )
        .toJSON(),
    ).toThrow("Expected string");
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

  it("interpolates legacy HSL and modern space/slash RGB colors", () => {
    expect(
      evaluateKeyframes(
        [
          { frame: 0, value: "hsl(0, 100%, 50%)" },
          { frame: 10, value: "rgb(0 0 255 / 50%)" },
        ],
        5,
      ),
    ).toBe("rgba(128, 0, 128, 0.75)");
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

describe("animation playback", () => {
  const repeated = {
    kind: "keyframes" as const,
    property: "opacity",
    frames: [
      { frame: 0, value: 0 },
      { frame: 10, value: 1 },
    ],
    repeat: 2,
    yoyo: true,
  } satisfies SceneAnimation;

  it("maps repeated and yoyo cycles deterministically", () => {
    expect(resolveAnimationFrame(repeated, 0)).toBe(0);
    expect(resolveAnimationFrame(repeated, 10)).toBe(10);
    expect(resolveAnimationFrame(repeated, 15)).toBe(5);
    expect(resolveAnimationFrame(repeated, 20)).toBe(0);
    expect(resolveAnimationFrame(repeated, 30)).toBe(10);
  });

  it("animates mask opacity and feather as bounded node data", () => {
    const scene = composition({
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
    })
      .children(
        div({
          id: "masked",
          mask: { shape: { kind: "ellipse" }, opacity: 0, feather: 20 },
        })
          .animate("mask.opacity", [
            { frame: 0, value: 0 },
            { frame: 10, value: 1 },
          ])
          .animate("mask.feather", [
            { frame: 0, value: 20 },
            { frame: 10, value: 0 },
          ]),
      )
      .toJSON();
    const node = evaluateScene(scene, 5).nodes[0];

    expect(node?.mask?.opacity).toBe(0.5);
    expect(node?.mask?.feather).toBe(10);
  });

  it("interpolates matching filter chains", () => {
    const frames = [
      { frame: 0, value: "blur(18px) brightness(0.8)" },
      { frame: 10, value: "blur(0px) brightness(1.2)" },
    ];
    expect(evaluateKeyframes(frames, 5)).toBe("blur(9px) brightness(1)");
    expect(parseFilter("blur(4px) saturate(120%)")).toHaveLength(2);
    expect(parseFilter("none")).toBeNull();
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

    expect(spaced).toMatchObject({
      x: 20,
      y: 10,
      width: 150,
      height: 75,
      content: { x: 30, y: 16, width: 120, height: 61 },
    });
    expect(content).toMatchObject({ x: 30, y: 16, width: 120, height: 61 });
  });

  it("clamps over-padded content and exposes a compatibility accessor", () => {
    const layout = layoutOf(
      composition({ width: 100, height: 80, fps: 30, duration: 1 }).children(
        div({
          id: "padded",
          style: { width: 40, height: 30, padding: 50 },
        }),
      ),
    );
    const padded = layout.boxes[0];

    expect(padded?.content).toEqual({ x: 50, y: 50, width: 0, height: 0 });
    expect(padded && getLayoutContentRect(padded)).toEqual(padded?.content);
    expect(
      getLayoutContentRect({
        id: "legacy-fixture",
        x: 1,
        y: 2,
        width: 3,
        height: 4,
        node: padded!.node,
        children: [],
      }),
    ).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });

  it("combines safe-area, padding, flex, and nested content coordinates", () => {
    const layout = layoutOf(
      composition({ width: 300, height: 200, fps: 30, duration: 1 }).children(
        div({
          id: "safe-flex",
          style: {
            safeArea: { top: 10, right: 20, bottom: 30, left: 40 },
            padding: 5,
            display: "flex",
            alignItems: "stretch",
          },
        }).children(
          div({ id: "child", style: { width: 50, paddingLeft: 7 } }).children(
            div({ id: "grandchild" }),
          ),
        ),
      ),
    );
    const parent = layout.boxes[0]!;
    const child = parent.children[0]!;
    const grandchild = child.children[0]!;

    expect(parent.content).toEqual({ x: 45, y: 15, width: 230, height: 150 });
    expect(child).toMatchObject({ x: 45, y: 15, width: 50, height: 150 });
    expect(child.content).toEqual({ x: 52, y: 15, width: 43, height: 150 });
    expect(grandchild).toMatchObject({ x: 52, y: 15, width: 43, height: 150 });
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

  it("reports an impossible minimum instead of silently dropping text", () => {
    expect(() =>
      prepareTextLayout("aaaaaaaaaaaaaaaaaaaaaaaa", 20, 20, measureTextLine, {
        textFit: "shrink",
        height: 10,
        minFontSize: 12,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "TEXT_DOES_NOT_FIT",
        constraints: expect.objectContaining({ minFontSize: 12 }),
      }),
    );
  });

  it("fits the entire caption before enforcing the maximum line count", () => {
    const text = "Every word must fit inside this narrow caption box";
    const layout = prepareTextLayout(text, 210, 40, measureTextLine, {
      textFit: "shrink",
      maxLines: 2,
      height: 80,
      minFontSize: 12,
    });
    expect(layout.lines.join(" ")).toBe(text);
    expect(layout.lines.length).toBeLessThanOrEqual(2);
    expect(layout.fontSize).toBeLessThan(40);
    expect(
      layout.lines.every(
        (line) => measureTextLine(line, layout.fontSize) <= 210,
      ),
    ).toBe(true);
  });

  it("does not turn shrink plus ellipsis into implicit text truncation", () => {
    expect(() =>
      prepareTextLayout(
        "Every word must be retained",
        60,
        40,
        measureTextLine,
        {
          textFit: "shrink",
          maxLines: 1,
          height: 20,
          minFontSize: 20,
          textOverflow: "ellipsis",
        },
      ),
    ).toThrow(/complete text cannot fit/);
    const explicit = prepareTextLayout(
      "Every word must be retained",
      60,
      40,
      measureTextLine,
      { textFit: "truncate", textOverflow: "ellipsis" },
    );
    expect(explicit.lines).toHaveLength(1);
    expect(explicit.lines[0]).toContain("…");
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

describe("renderer-neutral geometry", () => {
  it("resolves object fit and position for every fit mode", () => {
    const box = { width: 200, height: 100 };
    const square = { width: 100, height: 100 };

    expect(resolveObjectFitRect(undefined, undefined, box, square)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
    expect(
      resolveObjectFitRect("contain", "right bottom", box, square),
    ).toEqual({ x: 100, y: 0, width: 100, height: 100 });
    expect(resolveObjectFitRect("cover", "left top", box, square)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    expect(resolveObjectFitRect("none", "100% 50%", box, square)).toEqual({
      x: 100,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(
      resolveObjectFitRect("scale-down", "center", box, {
        width: 400,
        height: 200,
      }),
    ).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });

  it("resolves ordered transforms, percentage translation, and origins", () => {
    const box = { x: 10, y: 20, width: 100, height: 50 };
    const matrix = resolveStyleTransformMatrix(
      {
        transform: "translate(10%, 20%) scale(2, 3) rotate(90deg)",
        transformOrigin: "left top",
      },
      box,
    );
    const point = transformLayoutPoint(matrix, { x: 10, y: 20 });

    expect(point.x).toBeCloseTo(20);
    expect(point.y).toBeCloseTo(30);
    const transformed = transformLayoutRect(matrix, box);
    expect(transformed.width).toBeCloseTo(100);
    expect(transformed.height).toBeCloseTo(300);
    const inverse = invertAffineMatrix(matrix)!;
    expect(transformLayoutPoint(inverse, point)).toEqual({ x: 10, y: 20 });
  });

  it("handles center, far-edge, and singular transforms deterministically", () => {
    const box = { x: 0, y: 0, width: 100, height: 80 };
    const centered = resolveStyleTransformMatrix(
      { transform: "scale(2)", transformOrigin: "center" },
      box,
    );
    expect(transformLayoutPoint(centered, { x: 50, y: 40 })).toEqual({
      x: 50,
      y: 40,
    });
    const farEdge = resolveStyleTransformMatrix(
      { transform: "scale(2)", transformOrigin: "right bottom" },
      box,
    );
    expect(transformLayoutPoint(farEdge, { x: 100, y: 80 })).toEqual({
      x: 100,
      y: 80,
    });
    expect(
      invertAffineMatrix(
        resolveStyleTransformMatrix({ transform: "scale(0)" }, box),
      ),
    ).toBeNull();
  });

  it("normalizes renderer-shared per-corner overflow geometry", () => {
    const box = { x: 0, y: 0, width: 100, height: 50 };
    const radii = resolveLayoutCornerRadii(
      {
        borderRadius: 60,
        borderTopRightRadius: "20%",
      },
      box,
    );
    expect(radii.topLeft).toBeCloseTo(25);
    expect(radii.topRight).toBeCloseTo(25 / 6);
    expect(radii.bottomRight).toBeCloseTo(25);
    expect(radii.bottomLeft).toBeCloseTo(25);
    expect(pointInRoundedLayoutRect({ x: 0, y: 0 }, box, radii)).toBe(false);
    expect(pointInRoundedLayoutRect({ x: 25, y: 0 }, box, radii)).toBe(true);
    expect(pointInRoundedLayoutRect({ x: 50, y: 25 }, box, radii)).toBe(true);
    expect(pointInRoundedLayoutRect({ x: -1, y: 25 }, box, radii)).toBe(false);
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

describe("shared intrinsic metrics", () => {
  const textInput = {
    nodeId: "title",
    text: "Hello",
    style: { fontFamily: "Metrics Sans", fontWeight: 700 } as const,
    fontSize: 20,
  };

  it("normalizes per-field text provenance without changing legacy layout", () => {
    const provider: TextMetricsProvider = {
      measureLine: ({ text, fontSize }) => ({
        width: text.length * fontSize,
        ascent: fontSize * 0.7,
        descent: fontSize * 0.2,
        measurement: "exact",
        reason: "prepared font metrics",
        fieldMeasurements: {
          ascent: {
            measurement: "declared",
            reason: "font table ascent",
          },
        },
      }),
    };
    const metrics = resolveTextLineMetrics(textInput, provider);
    expect(metrics).toMatchObject({
      width: 100,
      ascent: 14,
      descent: 4,
      measurement: "declared",
      fieldMeasurements: {
        width: { measurement: "exact", reason: "prepared font metrics" },
        ascent: { measurement: "declared", reason: "font table ascent" },
        descent: { measurement: "exact", reason: "prepared font metrics" },
      },
    });

    const scene = composition({ width: 120, height: 100, fps: 30, duration: 1 })
      .children(
        text("ONE TWO", {
          id: "title",
          style: { width: 50, fontSize: 10, lineHeight: 1 },
        }),
      )
      .toJSON();
    const resolved = evaluateScene(scene, 0);
    const legacy = layoutScene(resolved, {
      measureTextLine: (line, _style, size) => line.length * size,
    });
    const shared = layoutScene(resolved, {
      textMetrics: {
        measureLine: ({ text: line, fontSize: size }) => ({
          width: line.length * size,
        }),
      },
    });
    expect(shared).toEqual(legacy);
  });

  it("merges exact prepared dimensions with declared duration and frame rate", () => {
    const asset: SceneAsset = {
      id: "clip",
      type: "video",
      src: "clip.mp4",
      metadata: {
        width: 640,
        height: 360,
        duration: 12,
        frameRate: { numerator: 30_000, denominator: 1001 },
      },
    };
    const provider: MediaMetricsProvider = {
      measure: () => ({
        width: 1920,
        height: 1080,
        measurement: "exact",
        reason: "decoded source track",
      }),
    };
    const metrics = resolveMediaMetrics(asset, provider);
    expect(metrics).toMatchObject({
      width: 1920,
      height: 1080,
      durationSeconds: 12,
      frameRate: { numerator: 30_000, denominator: 1001 },
      measurement: "declared",
      fieldMeasurements: {
        width: { measurement: "exact", reason: "decoded source track" },
        height: { measurement: "exact", reason: "decoded source track" },
        durationSeconds: {
          measurement: "declared",
          reason: "Scene asset metadata",
        },
        frameRate: {
          measurement: "declared",
          reason: "Scene asset metadata",
        },
      },
    });
    expect(asset.metadata?.width).toBe(640);

    const prefersDeclared = resolveMediaMetrics(asset, {
      measure: () => ({
        width: 100,
        measurement: "estimated",
        reason: "filename heuristic",
      }),
    });
    expect(prefersDeclared.width).toBe(640);
    expect(prefersDeclared.fieldMeasurements.width).toEqual({
      measurement: "declared",
      reason: "Scene asset metadata",
    });
  });

  it("rejects invalid values, labels, unexplained estimates, and orphan provenance", () => {
    expect(() =>
      resolveTextLineMetrics(textInput, {
        measureLine: () => ({ width: Number.NaN }),
      }),
    ).toThrow(/invalid width/);
    expect(() =>
      resolveTextLineMetrics(textInput, {
        measureLine: () => ({
          width: 10,
          measurement: "estimated",
        }),
      }),
    ).toThrow(/explain estimated/);
    expect(() =>
      resolveTextLineMetrics(textInput, {
        measureLine: () =>
          ({ width: 10, measurement: "pixel-perfect" }) as never,
      }),
    ).toThrow(/invalid measurement label/);
    expect(() =>
      resolveTextLineMetrics(textInput, {
        measureLine: () => ({
          width: 10,
          fieldMeasurements: {
            ascent: { measurement: "exact" },
          },
        }),
      }),
    ).toThrow(/without an ascent value/);

    const asset: SceneAsset = {
      id: "clip",
      type: "video",
      src: "clip.mp4",
    };
    expect(() =>
      resolveMediaMetrics(asset, {
        measure: () => ({
          width: 100,
          frameRate: { numerator: 0, denominator: 1 },
        }),
      }),
    ).toThrow(/invalid frameRate/);
    expect(() =>
      resolveMediaMetrics(asset, {
        measure: () => ({
          width: 100,
          fieldMeasurements: {
            height: { measurement: "exact" },
          },
        }),
      }),
    ).toThrow(/without a height value/);
  });

  it("passes frozen defensive inputs to host metrics providers", () => {
    const styleBefore = structuredClone(textInput.style);
    resolveTextLineMetrics(textInput, {
      measureLine: (input) => {
        expect(Object.isFrozen(input)).toBe(true);
        expect(Object.isFrozen(input.style)).toBe(true);
        expect(() => {
          (input.style as { fontFamily?: string }).fontFamily = "Mutated";
        }).toThrow();
        return { width: 10 };
      },
    });
    expect(textInput.style).toEqual(styleBefore);

    const asset: SceneAsset = {
      id: "image",
      type: "image",
      src: "image.png",
      metadata: { width: 100, height: 50 },
    };
    const before = structuredClone(asset);
    resolveMediaMetrics(asset, {
      measure: (input) => {
        expect(Object.isFrozen(input)).toBe(true);
        expect(Object.isFrozen(input.metadata)).toBe(true);
        expect(() => {
          (input.metadata as { width?: number }).width = 999;
        }).toThrow();
        return { width: 100, height: 50 };
      },
    });
    expect(asset).toEqual(before);
  });

  it("bounds and isolates provider caches and returns defensive values", () => {
    let firstCalls = 0;
    let secondCalls = 0;
    const first = createBoundedTextMetricsProvider(
      {
        measureLine: ({ text }) => {
          firstCalls += 1;
          return { width: text.length, reason: "first" };
        },
      },
      { maxEntries: 1 },
    );
    const second = createBoundedTextMetricsProvider(
      {
        measureLine: ({ text }) => {
          secondCalls += 1;
          return { width: text.length * 2, reason: "second" };
        },
      },
      { maxEntries: 1 },
    );
    const firstValue = first.measureLine(textInput);
    firstValue.width = 999;
    expect(first.measureLine(textInput).width).toBe(5);
    expect(second.measureLine(textInput).width).toBe(10);
    expect(firstCalls).toBe(1);
    expect(secondCalls).toBe(1);
    first.measureLine({ ...textInput, text: "Other" });
    first.measureLine(textInput);
    expect(firstCalls).toBe(3);
    expect(first.cacheStats()).toMatchObject({
      entries: 1,
      maxEntries: 1,
      hits: 1,
      misses: 3,
    });
    second.clearCache();
    expect(second.cacheStats()).toEqual({
      entries: 0,
      maxEntries: 1,
      hits: 0,
      misses: 0,
    });

    let mediaCalls = 0;
    const media = createBoundedMediaMetricsProvider(
      {
        measure: () => {
          mediaCalls += 1;
          return { width: 100, height: 50 };
        },
      },
      { maxEntries: 2 },
    );
    const asset: SceneAsset = {
      id: "image",
      type: "image",
      src: "one.png",
    };
    const measured = media.measure(asset);
    if (measured) measured.width = 999;
    expect(media.measure(asset)?.width).toBe(100);
    expect(media.measure({ ...asset, src: "two.png" })?.width).toBe(100);
    expect(mediaCalls).toBe(2);

    expect(() =>
      createBoundedTextMetricsProvider(
        { measureLine: () => ({ width: 1 }) },
        { maxEntries: 0 },
      ),
    ).toThrow(/maxEntries/);
  });
});
