import { describe, expect, it } from "vitest";
import {
  CURRENT_SCENE_VERSION,
  legacySceneV0JsonSchema,
  migrateScene,
  parseScene,
  sceneJsonSchema,
  sceneSchema,
  validateScene,
} from "./index.js";

describe("scene schema", () => {
  it("migrates legacy v0 scenes to canonical v1 without mutation", () => {
    const legacy = {
      schemaVersion: 0,
      width: 320,
      height: 180,
      fps: 30,
      duration: 60,
      assets: {},
      nodes: [{ id: "background", type: "div" }],
    } as const;
    const snapshot = structuredClone(legacy);

    const first = migrateScene(legacy);
    const second = migrateScene(legacy);

    expect(first).toMatchObject({
      fromVersion: 0,
      toVersion: CURRENT_SCENE_VERSION,
      migrations: ["scene-v0-to-v1"],
      scene: { schemaVersion: 1 },
    });
    expect(second).toEqual(first);
    expect(second.scene).toBe(first.scene);
    expect(legacy).toEqual(snapshot);
    expect(parseScene(legacy)).toBe(first.scene);
  });

  it("keeps current v1 migration idempotent and rejects future versions", () => {
    const current = {
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 60,
      assets: {},
      nodes: [],
    } as const;
    const migrated = migrateScene(current);

    expect(migrated).toMatchObject({
      fromVersion: 1,
      toVersion: 1,
      migrations: [],
    });
    expect(migrateScene(migrated.scene).scene).toBe(migrated.scene);

    const future = validateScene({ ...current, schemaVersion: 2 });
    expect(future.ok).toBe(false);
    expect(future.ok ? "" : future.errors.join("\n")).toContain(
      "Unsupported scene schemaVersion 2",
    );
  });

  it("keeps the current schema strict while exposing legacy structure", () => {
    const legacy = {
      schemaVersion: 0,
      width: 320,
      height: 180,
      fps: 30,
      duration: 60,
      assets: {},
      nodes: [],
    };

    expect(sceneSchema.safeParse(legacy).success).toBe(false);
    expect(validateScene(legacy)).toMatchObject({
      ok: true,
      scene: { schemaVersion: 1 },
    });
    expect(JSON.stringify(legacySceneV0JsonSchema())).toContain(
      '"schemaVersion":{"type":"number","const":0}',
    );
  });

  it("parses a minimal scene", () => {
    const scene = parseScene({
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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

  it("accepts data-only extension descriptors and rejects misplaced fields", () => {
    const valid = validateScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "grid",
          type: "extension",
          extension: {
            name: "com.example.grid",
            version: "1.2.0",
            params: { columns: 8, color: "#22d3ee" },
          },
        },
      ],
    });
    expect(valid.ok).toBe(true);

    const legacyExtension = validateScene({
      schemaVersion: 0,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "grid",
          type: "extension",
          extension: {
            name: "com.example.grid",
            version: "1.0.0",
            params: {},
          },
        },
      ],
    });
    expect(legacyExtension.ok).toBe(false);

    const missing = validateScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      nodes: [{ id: "grid", type: "extension" }],
    });
    expect(missing.ok ? "" : missing.errors.join("\n")).toContain(
      "Extension nodes require an extension descriptor",
    );

    const misplaced = validateScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "box",
          type: "div",
          extension: {
            name: "com.example.grid",
            version: "1.0.0",
            params: {},
          },
        },
      ],
    });
    expect(misplaced.ok ? "" : misplaced.errors.join("\n")).toContain(
      "extension only applies to extension nodes",
    );

    const executable = validateScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "unsafe",
          type: "extension",
          extension: {
            name: "com.example.grid",
            version: "1.0.0",
            params: { draw: () => undefined },
          },
        },
      ],
    });
    expect(executable.ok).toBe(false);

    for (const version of ["1.0", "01.0.0", "1.0.0-01"]) {
      const result = validateScene({
        schemaVersion: 1,
        width: 320,
        height: 180,
        fps: 30,
        duration: 30,
        nodes: [
          {
            id: `bad-${version}`,
            type: "extension",
            extension: {
              name: "com.example.grid",
              version,
              params: {},
            },
          },
        ],
      });
      expect(result.ok, version).toBe(false);
    }
  });

  it("validates shape, SVG path, clipping, mask, and blend primitives", () => {
    const valid = validateScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "triangle",
          type: "shape",
          shape: {
            kind: "polygon",
            points: [
              { x: 0.5, y: 0 },
              { x: 1, y: 1 },
              { x: 0, y: 1 },
            ],
          },
          clip: { kind: "ellipse" },
          mask: {
            shape: { kind: "rect", radius: "12%" },
            inverted: false,
          },
          style: {
            fill: "#22d3ee",
            stroke: "#ffffff",
            strokeWidth: 4,
            strokeLineJoin: "round",
            strokeDash: [8, 4],
            blendMode: "screen",
          },
        },
        {
          id: "wave",
          type: "shape",
          shape: {
            kind: "path",
            d: "M 0 50 C 25 0 75 100 100 50 Z",
            viewBox: { x: 0, y: 0, width: 100, height: 100 },
            fillRule: "evenodd",
          },
        },
      ],
    });
    expect(valid.ok).toBe(true);

    const missing = validateScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      nodes: [{ id: "missing", type: "shape" }],
    });
    expect(missing.ok ? "" : missing.errors.join("\n")).toContain(
      "Shape nodes require serializable shape geometry",
    );

    const unsafePath = validateScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "unsafe",
          type: "shape",
          shape: {
            kind: "path",
            d: "javascript:alert(1)",
            viewBox: { x: 0, y: 0, width: 100, height: 100 },
          },
        },
      ],
    });
    expect(unsafePath.ok).toBe(false);

    const openClip = validateScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "bad-clip",
          type: "div",
          clip: {
            kind: "line",
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        },
      ],
    });
    expect(openClip.ok ? "" : openClip.errors.join("\n")).toContain(
      "Clip and mask geometry must be closed",
    );

    const legacy = validateScene({
      schemaVersion: 0,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "legacy-shape",
          type: "shape",
          shape: { kind: "rect" },
        },
      ],
    });
    expect(legacy.ok).toBe(false);
  });

  it("validates metric-stable rich text runs and isolated soft masks", () => {
    const valid = validateScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "headline",
          type: "text",
          runs: [
            { text: "Build ", style: { color: "#ffffff" } },
            {
              text: "boldly",
              style: {
                color: "#22d3ee",
                textStroke: "2px #082f49",
                textBackgroundColor: "rgba(34,211,238,0.15)",
              },
            },
          ],
          mask: {
            shape: { kind: "ellipse" },
            opacity: 0.8,
            feather: 12,
          },
          style: {
            isolation: true,
            safeArea: { top: "10%", right: 20, bottom: "5%", left: 20 },
          },
        },
      ],
    });
    expect(valid.ok).toBe(true);

    const both = validateScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "ambiguous",
          type: "text",
          text: "plain",
          runs: [{ text: "rich" }],
        },
      ],
    });
    expect(both.ok ? "" : both.errors.join("\n")).toContain(
      "either `text` or `runs`, not both",
    );
  });

  it("rejects malformed effect nodes", () => {
    const missingPreset = validateScene({
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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

  it("validates node and effect asset references before rendering", () => {
    const base = {
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 60,
    } as const;

    const missing = validateScene({
      ...base,
      assets: {},
      nodes: [{ id: "clip", type: "video", assetId: "missing" }],
    });
    expect(missing.ok ? "" : missing.errors.join("\n")).toContain(
      'references missing asset "missing"',
    );

    const wrongMediaType = validateScene({
      ...base,
      assets: {
        picture: { id: "picture", type: "image", src: "picture.png" },
      },
      nodes: [{ id: "clip", type: "video", assetId: "picture" }],
    });
    expect(wrongMediaType.ok ? "" : wrongMediaType.errors.join("\n")).toContain(
      'requires a video asset, but "picture" is image',
    );

    const wrongEffectType = validateScene({
      ...base,
      assets: {
        picture: { id: "picture", type: "image", src: "picture.png" },
        music: { id: "music", type: "audio", src: "music.mp3" },
      },
      nodes: [
        {
          id: "spectrum",
          type: "effect",
          effect: "spectrumBars",
          params: { audioAssetId: "picture", coverAssetId: "music" },
        },
      ],
    });
    const effectErrors = wrongEffectType.ok
      ? ""
      : wrongEffectType.errors.join("\n");
    expect(effectErrors).toContain(
      'requires an audio asset, but "picture" is image',
    );
    expect(effectErrors).toContain(
      'requires an image asset, but "music" is audio',
    );
  });

  it("rejects invalid bounded text controls", () => {
    const result = validateScene({
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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

  it("validates repeat/yoyo playback and named scene markers", () => {
    const valid = validateScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 60,
      markers: { intro: 0, "beat.drop": 24, outro: 48 },
      nodes: [
        {
          id: "pulse",
          type: "div",
          animations: [
            {
              kind: "keyframes",
              property: "opacity",
              frames: [
                { frame: 0, value: 0.4 },
                { frame: 10, value: 1 },
              ],
              repeat: "infinite",
              yoyo: true,
            },
          ],
        },
      ],
    });
    expect(valid.ok).toBe(true);

    const invalid = validateScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 60,
      markers: { "9bad marker": 60 },
      nodes: [],
    });
    const errors = invalid.ok ? "" : invalid.errors.join("\n");
    expect(errors).toContain("Marker names must start with a letter");
    expect(errors).toContain("must be inside the scene duration");

    expect(
      validateScene({
        schemaVersion: 0,
        width: 320,
        height: 180,
        fps: 30,
        duration: 60,
        markers: { intro: 0 },
        nodes: [],
      }).ok,
    ).toBe(false);
  });

  it("validates proxy metadata, audio buses, ducking, pan, and video edge behavior", () => {
    const valid = validateScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 60,
      audioBuses: {
        music: { gain: 0.8, pan: -0.1, limiter: true },
        voice: { gain: 1 },
      },
      assets: {
        music: {
          id: "music",
          type: "audio",
          src: "music.wav",
          sourceMode: "stream",
          proxy: { src: "music-proxy.mp3", bitrate: 128000 },
          metadata: { duration: 120, byteLength: 12_000_000 },
        },
        clip: {
          id: "clip",
          type: "video",
          src: "clip.mp4",
          metadata: { width: 1920, height: 1080, duration: 10 },
        },
      },
      nodes: [
        {
          id: "music",
          type: "audio",
          assetId: "music",
          audioBus: "music",
          pan: -0.25,
        },
        {
          id: "voice",
          type: "audio",
          assetId: "music",
          audioBus: "voice",
          ducks: {
            bus: "music",
            gain: 0.35,
            attackFrames: 3,
            releaseFrames: 8,
          },
        },
        {
          id: "reverse",
          type: "video",
          assetId: "clip",
          playbackRate: -1,
          videoStartTime: 9,
          videoEndBehavior: "loop",
          volume: 0,
        },
      ],
    });
    expect(valid.ok).toBe(true);

    const invalid = validateScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 60,
      assets: { clip: { id: "clip", type: "video", src: "clip.mp4" } },
      nodes: [
        {
          id: "reverse",
          type: "video",
          assetId: "clip",
          playbackRate: -1,
          audioBus: "missing",
        },
      ],
    });
    const errors = invalid.ok ? "" : invalid.errors.join("\n");
    expect(errors).toContain("Reverse video playback is visual-only");
    expect(errors).toContain("missing audio bus");
  });

  it("accepts trim and rate on video nodes, rejects them elsewhere", () => {
    const valid = validateScene({
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      assets: { clip: { id: "clip", type: "video", src: "clip.mp4" } },
      nodes: [{ id: "shot", type: "video", assetId: "clip", volume: 0.5 }],
    });

    expect(valid.ok).toBe(true);

    const audioTrimOnVideo = validateScene({
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
