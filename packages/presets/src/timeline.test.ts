import { describe, expect, it } from "vitest";
import { applyScenePatch, validateScene } from "@dojo-video-engine/schema";
import { fadeUp, popIn, slideIn } from "./index.js";
import { timeline } from "./timeline.js";

/** Frame where a property's motion begins (skipping the frame-0 hold). */
function startOf(
  animations: {
    property: string;
    frames: { frame: number; value: unknown }[];
  }[],
  property: string,
): number {
  const frames = animations.find((a) => a.property === property)?.frames ?? [];
  const [first, second] = frames;
  // A shifted list starts with a hold: two keys with the same value, the
  // second marking where motion actually begins.
  if (first && second && first.frame === 0 && first.value === second.value) {
    return second.frame;
  }
  return first?.frame ?? -1;
}

describe("timeline", () => {
  it("sequences entries end-to-start by default", () => {
    const compiled = timeline()
      .add("title", popIn({ durationInFrames: 12 }))
      .add("subtitle", fadeUp({ durationInFrames: 10 }))
      .compile();

    // title runs 0..12; subtitle's motion must start at 12.
    expect(startOf(compiled["title"] ?? [], "transform")).toBe(0);
    expect(startOf(compiled["subtitle"] ?? [], "opacity")).toBe(12);
  });

  it("after + overlap starts relative to a named entry", () => {
    const compiled = timeline()
      .add("title", popIn({ durationInFrames: 12 }))
      .add("badge", popIn({ durationInFrames: 6 }), { at: 30 })
      .add("subtitle", fadeUp({ durationInFrames: 10 }), {
        after: "title",
        overlap: 4,
      })
      .compile();

    // title ends at 12; subtitle starts at 12 - 4 = 8 despite badge at 30.
    expect(startOf(compiled["subtitle"] ?? [], "opacity")).toBe(8);
  });

  it("holds the first value from frame 0 so entrances stay hidden until their slot", () => {
    const compiled = timeline()
      .add("a", popIn({ durationInFrames: 5 }))
      .add("b", fadeUp({ durationInFrames: 5 }))
      .compile();

    const opacity = (compiled["b"] ?? []).find((x) => x.property === "opacity");
    expect(opacity?.frames[0]).toEqual({ frame: 0, value: 0 });
  });

  it("staggers a group and positions later entries after the whole group", () => {
    const tl = timeline()
      .stagger(["c1", "c2", "c3"], slideIn("left", { durationInFrames: 8 }), {
        every: 5,
      })
      .add("outro", fadeUp({ durationInFrames: 6 }));

    const compiled = tl.compile();
    expect(startOf(compiled["c1"] ?? [], "transform")).toBe(0);
    expect(startOf(compiled["c2"] ?? [], "transform")).toBe(5);
    expect(startOf(compiled["c3"] ?? [], "transform")).toBe(10);
    // group ends at 10 + 8 = 18 → outro starts there
    expect(startOf(compiled["outro"] ?? [], "opacity")).toBe(18);
    expect(tl.durationInFrames).toBe(24);
  });

  it("stagger accepts a per-index preset factory", () => {
    const compiled = timeline()
      .stagger(
        ["a", "b"],
        (index) => popIn({ durationInFrames: 4 + index * 2 }),
        {
          every: 3,
        },
      )
      .compile();

    expect(startOf(compiled["a"] ?? [], "transform")).toBe(0);
    expect(startOf(compiled["b"] ?? [], "transform")).toBe(3);
  });

  it("clamps overlap larger than the reference to frame 0", () => {
    const compiled = timeline()
      .add("a", popIn({ durationInFrames: 4 }))
      .add("b", fadeUp({ durationInFrames: 4 }), { after: "a", overlap: 99 })
      .compile();

    const opacity = (compiled["b"] ?? []).find((x) => x.property === "opacity");
    expect(opacity?.frames[0]?.frame).toBe(0);
  });

  it("rejects duplicate ids, unknown after targets, and negative nudges", () => {
    expect(() => timeline().add("x", popIn()).add("x", fadeUp())).toThrow(
      /already has an entry/,
    );

    expect(() => timeline().add("x", popIn(), { after: "ghost" })).toThrow(
      /unknown entry "ghost"/,
    );

    expect(() => timeline().add("x", popIn(), { overlap: -2 })).toThrow(
      /non-negative/,
    );
  });

  it("compiled output round-trips through validateScene", () => {
    const compiled = timeline()
      .add("title", popIn({ durationInFrames: 12 }))
      .stagger(["w1", "w2"], fadeUp(), { after: "title", overlap: 2 })
      .compile();

    const scene = {
      schemaVersion: 1,
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 90,
      nodes: ["title", "w1", "w2"].map((id) => ({
        id,
        type: "text",
        text: id,
        style: { fontSize: 40, height: 50 },
        animations: compiled[id],
      })),
    };

    expect(validateScene(scene)).toMatchObject({ ok: true });
  });

  it("compileToPatch applies through applyScenePatch", () => {
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 60,
      nodes: [
        { id: "title", type: "text", text: "t", style: {} },
        { id: "sub", type: "text", text: "s", style: {} },
      ],
    };

    const patch = timeline()
      .add("title", popIn({ durationInFrames: 10 }))
      .add("sub", fadeUp({ durationInFrames: 8 }), { overlap: 3 })
      .compileToPatch();

    const result = applyScenePatch(scene, patch);
    expect(result.ok).toBe(true);

    if (result.ok) {
      const sub = result.scene.nodes.find((n) => n.id === "sub");
      const opacity = sub?.animations?.find((a) => a.property === "opacity");
      expect(opacity?.frames[1]?.frame).toBe(7); // 10 - 3 overlap
    }
  });

  it("sequences steps against named markers and compiles marker patches", () => {
    const choreography = timeline()
      .marker("intro", 4)
      .sequence([
        {
          id: "title",
          animations: popIn({ durationInFrames: 8 }),
          position: { atMarker: "intro" },
        },
        {
          id: "subtitle",
          animations: fadeUp({ durationInFrames: 6 }),
        },
      ])
      .marker("content");

    expect(startOf(choreography.compile().title ?? [], "transform")).toBe(4);
    expect(choreography.compileMarkers()).toEqual({ content: 18, intro: 4 });
    expect(choreography.compileScenePatch()).toContainEqual({
      op: "setMarker",
      name: "intro",
      frame: 4,
    });
  });

  it("rejects unknown or duplicate markers", () => {
    expect(() =>
      timeline().add("title", popIn(), { atMarker: "missing" }),
    ).toThrow(/unknown marker/);
    expect(() => timeline().marker("intro").marker("intro")).toThrow(
      /already defined/,
    );
  });
});
