import { describe, expect, it } from "vitest";
import { parseScene, sceneJsonSchema, validateScene } from "./index.js";

describe("scene schema", () => {
  it("parses a minimal scene", () => {
    const scene = parseScene({
      schemaVersion: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 90,
      nodes: [],
    });

    expect(scene.assets).toEqual({});
    expect(scene.nodes).toEqual([]);
  });

  it("rejects unsupported style properties", () => {
    const result = validateScene({
      schemaVersion: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 90,
      nodes: [
        {
          id: "bad",
          type: "div",
          style: {
            backdropFilter: "blur(8px)",
          },
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.join("\n")).toContain(
      "Unsupported style property",
    );
  });

  it("accepts caption text styling shorthands", () => {
    const result = validateScene({
      schemaVersion: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 90,
      nodes: [
        {
          id: "caption",
          type: "text",
          text: "Hello",
          style: {
            textStroke: "6px #000000",
            textBackgroundColor: "rgba(255, 209, 102, 0.16)",
            textBackgroundPaddingX: 48,
            textBackgroundPaddingY: "12px",
            textBackgroundRadius: "30%",
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
  });

  it("accepts bounded text controls", () => {
    const result = validateScene({
      schemaVersion: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 90,
      nodes: [
        {
          id: "title",
          type: "text",
          text: "A long generated title",
          style: {
            maxLines: 2,
            minFontSize: 24,
            textFit: "shrink",
            textOverflow: "ellipsis",
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
  });

  it("accepts effect nodes with bounded preset params", () => {
    const result = validateScene({
      schemaVersion: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 90,
      nodes: [
        {
          id: "burst",
          type: "effect",
          effect: "cartoonBurst",
          from: 12,
          duration: 24,
          style: {
            position: "absolute",
            left: 760,
            top: 360,
            width: 400,
            height: 300,
          },
          params: {
            intensity: "high",
            seed: 42,
            particleCount: 96,
            colors: ["#fff3a3", "#ff7a18", "#ef233c"],
            shockwave: true,
            emoji: "!",
          },
        },
        {
          id: "cloud",
          type: "effect",
          effect: "cloudPop",
          duration: 30,
          params: {
            density: "high",
            direction: "diagonal",
            loops: 3,
            strokeWidth: 12,
            radius: 48,
            wobble: 0.4,
            pulse: 0.8,
            scale: 1.35,
            spread: 0.65,
            softness: 0.75,
            glow: 0.5,
            scope: "text",
          },
        },
        {
          id: "spectrum",
          type: "effect",
          effect: "spectrumBars",
          params: {
            audioAssetId: "music",
            barCount: 64,
            sensitivity: 1.25,
            smoothing: true,
            colors: ["#00e676", "#7c3aed", "#ffffff"],
          },
        },
      ],
      assets: {
        music: { id: "music", type: "audio", src: "music.mp3" },
      },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects malformed effect nodes", () => {
    const missingPreset = validateScene({
      schemaVersion: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 90,
      nodes: [{ id: "burst", type: "effect" }],
    });

    expect(missingPreset.ok).toBe(false);
    expect(missingPreset.ok ? "" : missingPreset.errors.join("\n")).toContain(
      "Effect nodes require an `effect` preset name",
    );

    const misplacedParams = validateScene({
      schemaVersion: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 90,
      nodes: [
        {
          id: "title",
          type: "text",
          text: "Hello",
          params: { intensity: "high" },
        },
      ],
    });

    expect(misplacedParams.ok).toBe(false);
    expect(
      misplacedParams.ok ? "" : misplacedParams.errors.join("\n"),
    ).toContain("params only applies to effect nodes");

    const unsupportedParams = validateScene({
      schemaVersion: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 90,
      nodes: [
        {
          id: "aura",
          type: "effect",
          effect: "neonAura",
          params: { blurAmount: 0.5 },
        },
      ],
    });

    expect(unsupportedParams.ok).toBe(false);
    expect(
      unsupportedParams.ok ? "" : unsupportedParams.errors.join("\n"),
    ).toContain("Unsupported key(s): blurAmount");
  });

  it("rejects invalid bounded text controls", () => {
    const result = validateScene({
      schemaVersion: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 90,
      nodes: [
        {
          id: "title",
          type: "text",
          text: "A long generated title",
          style: {
            maxLines: 0,
            textFit: "squeeze",
            textOverflow: "fade",
          },
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.errors.join("\n")).toContain(
      "Number must be greater than 0",
    );
    expect(result.ok ? "" : result.errors.join("\n")).toContain(
      "Invalid enum value",
    );
  });

  it("rejects duplicate node ids anywhere in the tree", () => {
    const result = validateScene({
      schemaVersion: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 90,
      nodes: [
        {
          id: "root",
          type: "div",
          children: [{ id: "root", type: "div" }],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.join("\n")).toContain(
      'Duplicate node id "root"',
    );
  });

  it("rejects keyframes that are not strictly increasing", () => {
    const result = validateScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "animated",
          type: "div",
          animations: [
            {
              kind: "keyframes",
              property: "opacity",
              frames: [
                { frame: 10, value: 0 },
                { frame: 10, value: 1 },
              ],
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.join("\n")).toContain(
      "strictly increasing",
    );
  });

  it("accepts trim and rate on video nodes, rejects them elsewhere", () => {
    const valid = validateScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      assets: { clip: { id: "clip", type: "video", src: "clip.mp4" } },
      nodes: [
        {
          id: "shot",
          type: "video",
          assetId: "clip",
          videoStartTime: 1.5,
          playbackRate: 2,
        },
      ],
    });

    expect(valid.ok).toBe(true);

    const invalid = validateScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      nodes: [{ id: "box", type: "div", videoStartTime: 1 }],
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.ok ? [] : invalid.errors.join("\n")).toContain(
      "only applies to video nodes",
    );
  });

  it("accepts volume on video nodes, rejects audio-only fields correctly", () => {
    const valid = validateScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      assets: { clip: { id: "clip", type: "video", src: "clip.mp4" } },
      nodes: [{ id: "shot", type: "video", assetId: "clip", volume: 0.5 }],
    });

    expect(valid.ok).toBe(true);

    const audioTrimOnVideo = validateScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      assets: { clip: { id: "clip", type: "video", src: "clip.mp4" } },
      nodes: [
        { id: "shot", type: "video", assetId: "clip", audioStartTime: 1 },
      ],
    });

    expect(audioTrimOnVideo.ok).toBe(false);
    expect(
      audioTrimOnVideo.ok ? [] : audioTrimOnVideo.errors.join("\n"),
    ).toContain("videoStartTime");

    const volumeOnDiv = validateScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      nodes: [{ id: "box", type: "div", volume: 1 }],
    });

    expect(volumeOnDiv.ok).toBe(false);
    expect(volumeOnDiv.ok ? [] : volumeOnDiv.errors.join("\n")).toContain(
      "audio and video nodes",
    );
  });

  it("accepts mixer-visible volume envelopes on audio and video nodes only", () => {
    const valid = validateScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      assets: {
        tone: { id: "tone", type: "audio", src: "tone.wav" },
        clip: { id: "clip", type: "video", src: "clip.mp4" },
      },
      nodes: [
        {
          id: "music",
          type: "audio",
          assetId: "tone",
          volumeEnvelope: [
            { frame: 0, value: 0 },
            { frame: 12, value: 1, easing: "easeOut" },
          ],
        },
        {
          id: "shot",
          type: "video",
          assetId: "clip",
          volumeEnvelope: [
            { frame: 0, value: 1 },
            { frame: 24, value: 0.4 },
          ],
        },
      ],
    });

    expect(valid.ok).toBe(true);

    const invalidTarget = validateScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "box",
          type: "div",
          volumeEnvelope: [{ frame: 0, value: 1 }],
        },
      ],
    });

    expect(invalidTarget.ok).toBe(false);
    expect(invalidTarget.ok ? [] : invalidTarget.errors.join("\n")).toContain(
      "volume and volumeEnvelope only apply",
    );

    const invalidOrder = validateScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      assets: { tone: { id: "tone", type: "audio", src: "tone.wav" } },
      nodes: [
        {
          id: "music",
          type: "audio",
          assetId: "tone",
          volumeEnvelope: [
            { frame: 10, value: 0 },
            { frame: 10, value: 1 },
          ],
        },
      ],
    });

    expect(invalidOrder.ok).toBe(false);
    expect(invalidOrder.ok ? [] : invalidOrder.errors.join("\n")).toContain(
      "strictly increasing",
    );
  });

  it("accepts audio loop flags only on audio nodes", () => {
    const valid = validateScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 90,
      assets: { music: { id: "music", type: "audio", src: "music.mp3" } },
      nodes: [
        {
          id: "music",
          type: "audio",
          assetId: "music",
          duration: 90,
          loop: true,
        },
      ],
    });

    expect(valid.ok).toBe(true);

    const invalid = validateScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 90,
      assets: { clip: { id: "clip", type: "video", src: "clip.mp4" } },
      nodes: [
        {
          id: "shot",
          type: "video",
          assetId: "clip",
          loop: true,
        },
      ],
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.ok ? [] : invalid.errors.join("\n")).toContain(
      "loop only applies to audio nodes",
    );
  });

  it("validates lottie nodes: assetId required, playbackRate allowed", () => {
    const base = {
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      assets: {
        sticker: { id: "sticker", type: "lottie", src: "sticker.json" },
      },
    };

    expect(
      validateScene({
        ...base,
        nodes: [
          { id: "s", type: "lottie", assetId: "sticker", playbackRate: 2 },
        ],
      }).ok,
    ).toBe(true);

    const missingAsset = validateScene({
      ...base,
      nodes: [{ id: "s", type: "lottie" }],
    });
    expect(missingAsset.ok).toBe(false);
    expect(missingAsset.ok ? [] : missingAsset.errors.join("\n")).toContain(
      "lottie nodes require an assetId",
    );

    const rateOnDiv = validateScene({
      ...base,
      nodes: [{ id: "d", type: "div", playbackRate: 2 }],
    });
    expect(rateOnDiv.ok).toBe(false);
    expect(rateOnDiv.ok ? [] : rateOnDiv.errors.join("\n")).toContain(
      "video and lottie nodes",
    );
  });

  it("accepts easing expressions and rejects malformed ones", () => {
    const sceneWith = (easing: string) => ({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "box",
          type: "div",
          animations: [
            {
              kind: "keyframes",
              property: "opacity",
              frames: [
                { frame: 0, value: 0 },
                { frame: 10, value: 1, easing },
              ],
            },
          ],
        },
      ],
    });

    expect(validateScene(sceneWith("cubic-bezier(0.42, 0, 0.58, 1)")).ok).toBe(
      true,
    );
    expect(validateScene(sceneWith("spring")).ok).toBe(true);
    expect(validateScene(sceneWith("spring(0.4)")).ok).toBe(true);
    // x out of range and unknown names must fail with the actionable message.
    expect(validateScene(sceneWith("cubic-bezier(2, 0, 0.5, 1)")).ok).toBe(
      false,
    );
    expect(validateScene(sceneWith("bounce")).ok).toBe(false);
    expect(validateScene(sceneWith("spring(1)")).ok).toBe(false);
  });

  it("validates filter expressions and rejects unknown filter functions", () => {
    const sceneWith = (filter: string) => ({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      nodes: [{ id: "n", type: "div", style: { filter } }],
    });

    // The real chains observed in the downstream editor templates must pass.
    expect(
      validateScene(
        sceneWith(
          "brightness(100%) sepia(20%) hue-rotate(180deg) saturate(90%)",
        ),
      ).ok,
    ).toBe(true);
    expect(
      validateScene(sceneWith("grayscale(100%) contrast(150%) brightness(90%)"))
        .ok,
    ).toBe(true);
    expect(validateScene(sceneWith("blur(4px)")).ok).toBe(true);
    expect(validateScene(sceneWith("brightness(1.2)")).ok).toBe(true);
    expect(validateScene(sceneWith("none")).ok).toBe(true);

    expect(validateScene(sceneWith("drop-shadow(0 0 4px red)")).ok).toBe(false);
    expect(validateScene(sceneWith("blur(4deg)")).ok).toBe(false);
    expect(validateScene(sceneWith("url(#svg-filter)")).ok).toBe(false);
    expect(validateScene(sceneWith("")).ok).toBe(false);
  });

  it("accepts deterministic media image rendering modes", () => {
    const sceneWith = (imageRendering: string, pixelSize = 12) => ({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      nodes: [{ id: "n", type: "div", style: { imageRendering, pixelSize } }],
    });

    expect(validateScene(sceneWith("auto")).ok).toBe(true);
    expect(validateScene(sceneWith("pixelated")).ok).toBe(true);
    expect(validateScene(sceneWith("crisp-edges")).ok).toBe(false);
    expect(validateScene(sceneWith("pixelated", 0)).ok).toBe(false);
  });

  it("accepts integer zIndex and rejects fractional values", () => {
    const sceneWith = (zIndex: number) => ({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      nodes: [{ id: "n", type: "div", style: { zIndex } }],
    });

    expect(validateScene(sceneWith(0)).ok).toBe(true);
    expect(validateScene(sceneWith(-5)).ok).toBe(true);
    expect(validateScene(sceneWith(1.5)).ok).toBe(false);
  });

  it("re-parsing a parsed scene is an identity no-op", () => {
    const scene = parseScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      nodes: [],
    });

    expect(parseScene(scene)).toBe(scene);

    const validated = validateScene(scene);
    expect(validated.ok && validated.scene).toBe(scene);
  });

  it("exports a JSON Schema covering the recursive node structure", () => {
    const jsonSchema = sceneJsonSchema() as {
      $ref?: string;
      definitions?: Record<string, { properties?: Record<string, unknown> }>;
    };

    expect(jsonSchema.$ref).toBe("#/definitions/MotionforgeScene");

    const scene = jsonSchema.definitions?.MotionforgeScene;
    expect(scene?.properties).toHaveProperty("schemaVersion");
    expect(scene?.properties).toHaveProperty("nodes");
    expect(JSON.stringify(jsonSchema)).toContain('"opacity"');
  });
});
