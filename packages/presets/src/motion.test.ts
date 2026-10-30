import { describe, expect, it } from "vitest";
import { validateScene } from "@dojo-video-engine/schema";
import {
  compileMotionPreset,
  maskReveal,
  motionPath,
  motionPresetDefinitions,
  motionPresetNames,
  seededSignal,
} from "./motion.js";

describe("motion preset registry", () => {
  it("publishes a curated 30-40 preset catalog with schemas and thumbnails", () => {
    expect(motionPresetDefinitions).toHaveLength(38);
    expect(new Set(motionPresetNames()).size).toBe(38);
    for (const definition of motionPresetDefinitions) {
      expect(definition.description.length).toBeGreaterThan(8);
      expect(
        definition.paramsSchema.safeParse({ durationInFrames: 16 }).success,
      ).toBe(true);
      expect(definition.thumbnail.frame).toBeGreaterThanOrEqual(0);
    }
  });

  it("compiles every preset to valid scene keyframes with no preset names stored", () => {
    for (const name of motionPresetNames()) {
      const animations = compileMotionPreset(name, { durationInFrames: 18 });
      const result = validateScene({
        schemaVersion: 1,
        width: 320,
        height: 180,
        fps: 30,
        duration: 90,
        nodes: [{ id: name, type: "div", animations }],
      });
      expect(result.ok, name).toBe(true);
      expect(JSON.stringify(animations)).not.toContain(`"preset":"${name}"`);
    }
  });

  it("provides reduced-motion variants without spatial transforms", () => {
    const reduced = compileMotionPreset(
      "slideInLeft",
      { durationInFrames: 30, distance: 1000 },
      { reducedMotion: true },
    );
    expect(reduced).toHaveLength(1);
    expect(reduced[0]?.property).toBe("opacity");
    expect(reduced[0]?.frames.at(-1)?.frame).toBeLessThanOrEqual(12);
  });
});

describe("procedural animation compilers", () => {
  it("compiles distance-weighted motion paths with optional orientation", () => {
    const [animation] = motionPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      { durationInFrames: 30, orientToPath: true, repeat: 1, yoyo: true },
    );
    expect(animation).toMatchObject({
      property: "transform",
      repeat: 1,
      yoyo: true,
    });
    expect(animation?.frames.map((frame) => frame.frame)).toEqual([0, 15, 30]);
    expect(animation?.frames[1]?.value).toContain("rotate(45deg)");
  });

  it("generates deterministic seeded numeric signals", () => {
    const first = seededSignal("opacity", {
      seed: 42,
      durationInFrames: 12,
      every: 3,
      center: 0.5,
      amplitude: 0.25,
    });
    const second = seededSignal("opacity", {
      seed: 42,
      durationInFrames: 12,
      every: 3,
      center: 0.5,
      amplitude: 0.25,
    });
    expect(first).toEqual(second);
    expect(first[0]?.frames).toHaveLength(5);
  });

  it("compiles animated soft-mask reveals", () => {
    expect(maskReveal({ durationInFrames: 20, feather: 32 })).toEqual([
      {
        kind: "keyframes",
        property: "mask.opacity",
        frames: [
          { frame: 0, value: 0 },
          { frame: 20, value: 1, easing: "easeOut" },
        ],
      },
      {
        kind: "keyframes",
        property: "mask.feather",
        frames: [
          { frame: 0, value: 32 },
          { frame: 20, value: 0, easing: "easeOut" },
        ],
      },
    ]);
  });
});
