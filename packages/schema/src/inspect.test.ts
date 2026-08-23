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
      markers: { intro: 0, outro: 75 },
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
        {
          id: "grid",
          type: "extension",
          extension: {
            name: "com.example.grid",
            version: "1.0.0",
            params: { columns: 8 },
          },
        },
        {
          id: "wave",
          type: "shape",
          shape: {
            kind: "path",
            d: "M0 0 L100 0 L100 100 Z",
            viewBox: { x: 0, y: 0, width: 100, height: 100 },
          },
          clip: { kind: "ellipse" },
          mask: { shape: { kind: "rect" }, feather: 8 },
          style: {
            fill: "#22d3ee",
            blendMode: "screen",
            isolation: true,
          },
        },
        {
          id: "rich",
          type: "text",
          runs: [
            { text: "Hello ", style: { color: "#ffffff" } },
            { text: "world", style: { color: "#22d3ee" } },
          ],
        },
      ],
    });

    expect(inspection).toMatchObject({
      schemaVersion: 1,
      durationSeconds: 3,
      markers: { total: 2, names: ["intro", "outro"] },
      assets: { total: 2, audio: 1, font: 1 },
      nodes: {
        total: 5,
        root: 5,
        text: 2,
        effect: 1,
        extension: 1,
        shape: 1,
      },
      effects: { spectrumBars: 1 },
      extensions: { "com.example.grid@1.0.0": 1 },
      capabilities: {
        hasEffects: true,
        hasAudioReactiveEffects: true,
        hasFonts: true,
        hasAnimations: true,
        hasExtensions: true,
        hasShapes: true,
        hasVectorPaths: true,
        hasClipping: true,
        hasMasks: true,
        hasSoftMasks: true,
        hasBlendModes: true,
        hasIsolatedGroups: true,
        hasRichText: true,
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
