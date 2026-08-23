import { describe, expect, it } from "vitest";
import { inspectScene, lintScene } from "./index.js";

describe("scene inspection", () => {
  it("summarizes canonical features and effect usage", () => {
    const inspection = inspectScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 90,
      assets: {
        music: { id: "music", type: "audio", src: "music.mp3" },
        font: { id: "font", type: "font", src: "font.woff2" },
      },
      nodes: [
        {
          id: "spectrum",
          type: "effect",
          effect: "spectrumBars",
          params: { audioAssetId: "music" },
        },
        {
          id: "title",
          type: "text",
          text: "Hello",
          animations: [
            {
              kind: "keyframes",
              property: "opacity",
              frames: [{ frame: 0, value: 1 }],
            },
          ],
        },
      ],
    });

    expect(inspection).toMatchObject({
      schemaVersion: 1,
      durationSeconds: 3,
      assets: { total: 2, audio: 1, font: 1 },
      nodes: { total: 2, root: 2, text: 1, effect: 1 },
      effects: { spectrumBars: 1 },
      capabilities: {
        hasEffects: true,
        hasAudioReactiveEffects: true,
        hasFonts: true,
        hasAnimations: true,
      },
    });
  });
});

describe("scene lint", () => {
  it("returns deterministic warnings for suspicious valid scene data", () => {
    const result = lintScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      assets: {
        music: { id: "music", type: "audio", src: "music.mp3" },
        unused: { id: "unused", type: "image", src: "unused.png" },
      },
      nodes: [
        {
          id: "hidden",
          type: "div",
          duration: 10,
          style: { opacity: 0 },
          animations: [
            {
              kind: "keyframes",
              property: "transform",
              frames: [
                { frame: 0, value: "scale(0)" },
                { frame: 12, value: "scale(1)" },
              ],
            },
          ],
        },
        {
          id: "silent",
          type: "audio",
          assetId: "music",
          from: 20,
          duration: 20,
          volume: 0,
        },
        { id: "late", type: "div", from: 30, duration: 5 },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.issues.map((issue) => issue.code) : []).toEqual([
      "animation_outside_node",
      "invisible_node",
      "node_window_clipped",
      "inaudible_media",
      "node_window_empty",
      "unused_asset",
    ]);
  });

  it("returns validation errors instead of linting an invalid scene", () => {
    const result = lintScene({ schemaVersion: 1 });
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toHaveLength(1);
  });
});
