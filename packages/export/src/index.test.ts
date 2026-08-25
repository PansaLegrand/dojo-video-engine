import { describe, expect, it, vi } from "vitest";
import type { Scene } from "@motionforge/schema";
import type { ResolvedAssets } from "@motionforge/renderer-canvas2d";
import {
  audioChunkRanges,
  collectAudioPlacements,
  detectExportCapability,
  evaluateVolumeEnvelope,
  estimateExport,
  exportVideo,
  exportVideoWithFallback,
  frameToTimestampUs,
  loopedSourceRanges,
  limitAudioPeak,
  measureAudioLoudness,
  mixSceneAudioData,
  mixAudioSegments,
  preflightExport,
  renderFrameSequence,
  withResolvedAssetOwnership,
} from "./index.js";

const scene: Scene = {
  schemaVersion: 1,
  width: 320,
  height: 180,
  fps: 30,
  duration: 10,
  assets: {},
  nodes: [],
};

const context = {} as CanvasRenderingContext2D;

describe("detectExportCapability", () => {
  it("reports missing APIs in plain Node", () => {
    expect(detectExportCapability({})).toEqual({
      webCodecs: false,
      videoEncoder: false,
      offscreenCanvas: false,
      worker: false,
      streamingTarget: false,
    });
  });
});

describe("export planning", () => {
  it("estimates frame, raw pixel, encoded, audio, and media resources", () => {
    const estimate = estimateExport(
      {
        ...scene,
        duration: 60,
        nodes: [
          {
            id: "audio",
            type: "audio",
            assetId: "tone",
          },
        ],
        assets: { tone: { id: "tone", type: "audio", src: "tone.wav" } },
      },
      { bitrate: 1_000_000 },
    );
    expect(estimate).toMatchObject({
      totalFrames: 60,
      durationSeconds: 2,
      rawRgbaBytes: 320 * 180 * 4 * 60,
      hasAudio: true,
      resources: { reachableAssets: 1 },
    });
    expect(estimate.estimatedEncodedBytes).toBe(282_000);
  });

  it("preflights export capability with actionable issues", () => {
    const result = preflightExport(scene, {});
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "canvas_unavailable",
      "video_frame_unavailable",
      "video_encoder_unavailable",
      "worker_unavailable",
    ]);
  });

  it("delegates unsupported local export only through an explicit host fallback", async () => {
    const fallback = vi.fn(async () => ({
      blob: new Blob(),
      codec: "avc" as const,
      audioCodec: null,
      totalFrames: scene.duration,
    }));
    const result = await exportVideoWithFallback({ scene }, fallback, {});

    expect(result.executor).toBe("host");
    expect(result.preflight.ok).toBe(false);
    expect(fallback).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { scene },
        preflight: expect.objectContaining({ ok: false }),
      }),
    );
  });

  it("fails worker preflight for a declared embedded soundtrack without AudioDecoder", () => {
    class FakeOffscreenCanvas {
      getContext() {
        return {};
      }
    }
    const videoScene: Scene = {
      ...scene,
      assets: {
        clip: {
          id: "clip",
          type: "video",
          src: "clip.mp4",
          metadata: { hasAudio: true },
        },
      },
      nodes: [{ id: "clip", type: "video", assetId: "clip" }],
    };
    const result = preflightExport(
      videoScene,
      {
        VideoFrame: class {},
        VideoEncoder: class {},
        VideoDecoder: class {},
        OffscreenCanvas: FakeOffscreenCanvas,
        Worker: class {},
      } as unknown as Partial<typeof globalThis>,
      { worker: true },
    );

    expect(result.issues.map((issue) => issue.code)).toContain(
      "audio_decoder_unavailable",
    );
  });
});

describe("frameToTimestampUs", () => {
  it("converts frame numbers to microsecond timestamps", () => {
    expect(frameToTimestampUs(0, 30)).toBe(0);
    expect(frameToTimestampUs(15, 30)).toBe(500_000);
    expect(frameToTimestampUs(29, 30)).toBe(966_667);
  });

  it("rejects invalid frame and fps values", () => {
    expect(() => frameToTimestampUs(-1, 30)).toThrow("non-negative integer");
    expect(() => frameToTimestampUs(1.5, 30)).toThrow("non-negative integer");
    expect(() => frameToTimestampUs(1, 0)).toThrow("positive integer");
  });
});

describe("renderFrameSequence", () => {
  it("renders the requested inclusive frame range in order", async () => {
    const rendered: number[] = [];
    const progress: Array<{
      frame: number;
      frameIndex: number;
      totalFrames: number;
      timestampUs: number;
      sceneTimestampUs: number;
    }> = [];

    const result = await renderFrameSequence({
      scene,
      context,
      startFrame: 2,
      endFrame: 4,
      renderFrame: (_context, _scene, frame) => {
        rendered.push(frame);
      },
      onProgress: (event) => {
        progress.push(event);
      },
    });

    expect(rendered).toEqual([2, 3, 4]);
    expect(progress).toEqual([
      {
        frame: 2,
        frameIndex: 0,
        totalFrames: 3,
        timestampUs: 0,
        sceneTimestampUs: 66_667,
      },
      {
        frame: 3,
        frameIndex: 1,
        totalFrames: 3,
        timestampUs: 33_333,
        sceneTimestampUs: 100_000,
      },
      {
        frame: 4,
        frameIndex: 2,
        totalFrames: 3,
        timestampUs: 66_667,
        sceneTimestampUs: 133_333,
      },
    ]);
    expect(result).toEqual({
      startFrame: 2,
      endFrame: 4,
      totalFrames: 3,
      renderedFrames: 3,
    });
  });

  it("awaits onFrame before reporting progress", async () => {
    const events: string[] = [];

    await renderFrameSequence({
      scene,
      context,
      startFrame: 0,
      endFrame: 1,
      renderFrame: (_context, _scene, frame) => {
        events.push(`render:${frame}`);
      },
      onFrame: async ({ frame }) => {
        events.push(`frame:${frame}`);
      },
      onProgress: ({ frame }) => {
        events.push(`progress:${frame}`);
      },
    });

    expect(events).toEqual([
      "render:0",
      "frame:0",
      "progress:0",
      "render:1",
      "frame:1",
      "progress:1",
    ]);
  });

  it("rejects invalid frame ranges", async () => {
    await expect(
      renderFrameSequence({
        scene,
        context,
        startFrame: -1,
        endFrame: 1,
        renderFrame: () => undefined,
      }),
    ).rejects.toThrow("startFrame must be >= 0");

    await expect(
      renderFrameSequence({
        scene,
        context,
        startFrame: 5,
        endFrame: 4,
        renderFrame: () => undefined,
      }),
    ).rejects.toThrow("endFrame must be >= startFrame");

    await expect(
      renderFrameSequence({
        scene,
        context,
        startFrame: 0,
        endFrame: 10,
        renderFrame: () => undefined,
      }),
    ).rejects.toThrow("endFrame must be less than scene.duration");
  });

  it("stops before rendering when aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("stop"));

    const rendered: number[] = [];

    await expect(
      renderFrameSequence({
        scene,
        context,
        signal: controller.signal,
        renderFrame: (_context, _scene, frame) => {
          rendered.push(frame);
        },
      }),
    ).rejects.toThrow("stop");

    expect(rendered).toEqual([]);
  });

  it("stops between frames when aborted by progress callback", async () => {
    const controller = new AbortController();
    const rendered: number[] = [];

    await expect(
      renderFrameSequence({
        scene,
        context,
        startFrame: 0,
        endFrame: 4,
        signal: controller.signal,
        renderFrame: (_context, _scene, frame) => {
          rendered.push(frame);
        },
        onProgress: ({ frame }) => {
          if (frame === 1) {
            controller.abort(new Error("stop after frame 1"));
          }
        },
      }),
    ).rejects.toThrow("stop after frame 1");

    expect(rendered).toEqual([0, 1]);
  });
});

describe("exportVideo", () => {
  it("fails fast with an actionable error when WebCodecs is unavailable", async () => {
    // Plain Node has no VideoEncoder; the happy path is covered by the
    // browser-based export smoke test in tools/golden.
    await expect(exportVideo({ scene })).rejects.toThrow(
      /video_encoder_unavailable.*detectExportCapability/s,
    );
  });
});

describe("export media ownership", () => {
  function assetsWithInput(dispose: () => void): ResolvedAssets {
    return {
      images: new Map(),
      fonts: new Map(),
      videos: new Map([["clip", { input: { dispose } } as never]]),
      videoFrames: new Map(),
      audio: new Map(),
      lotties: new Map(),
      lottieFrames: new Map(),
    };
  }

  it("disposes internally owned resources after success and failure", async () => {
    const successDispose = vi.fn();
    await expect(
      withResolvedAssetOwnership(
        assetsWithInput(successDispose),
        true,
        async () => "ok",
      ),
    ).resolves.toBe("ok");
    expect(successDispose).toHaveBeenCalledOnce();

    const failureDispose = vi.fn();
    await expect(
      withResolvedAssetOwnership(
        assetsWithInput(failureDispose),
        true,
        async () => {
          throw new Error("encode failed");
        },
      ),
    ).rejects.toThrow("encode failed");
    expect(failureDispose).toHaveBeenCalledOnce();
  });

  it("never disposes caller-owned resources", async () => {
    const dispose = vi.fn();
    await withResolvedAssetOwnership(
      assetsWithInput(dispose),
      false,
      async () => undefined,
    );
    expect(dispose).not.toHaveBeenCalled();
  });
});

describe("collectAudioPlacements", () => {
  it("returns absolute windows clipped by ancestors", () => {
    const placements = collectAudioPlacements({
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 90,
      assets: { tone: { id: "tone", type: "audio", src: "tone.wav" } },
      nodes: [
        { id: "track", type: "audio", assetId: "tone", from: 12, duration: 30 },
        {
          id: "group",
          type: "div",
          from: 10,
          duration: 40,
          children: [
            // Wants 100 frames from local frame 5, but the parent window
            // [10, 50) clips it to [15, 50).
            {
              id: "nested",
              type: "audio",
              assetId: "tone",
              from: 5,
              duration: 100,
            },
          ],
        },
      ],
    });

    expect(
      placements.map(({ node, startFrame, endFrame }) => [
        node.id,
        startFrame,
        endFrame,
      ]),
    ).toEqual([
      ["track", 12, 42],
      ["nested", 15, 50],
    ]);
  });

  it("includes video nodes and reports head clipping via framesIntoNode", () => {
    const placements = collectAudioPlacements({
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 90,
      assets: { clip: { id: "clip", type: "video", src: "clip.mp4" } },
      nodes: [
        {
          id: "group",
          type: "div",
          from: 10,
          duration: 40,
          children: [
            // Starts at local frame -5 relative to the parent window via the
            // grandparent clip: parent window [10, 50), node start 10 + 5 = 15
            // here is NOT clipped; use a deeper case below for clipping.
            {
              id: "shot",
              type: "video",
              assetId: "clip",
              from: 5,
              duration: 20,
            },
          ],
        },
        {
          id: "outer",
          type: "div",
          from: 20,
          duration: 30,
          children: [
            {
              id: "inner",
              type: "div",
              from: -10,
              duration: 60,
              children: [
                // Node starts at scene frame 10, but the ancestor window
                // starts at 20 — ten frames of the node's head are clipped,
                // so its audio must start ten frames into the source.
                { id: "late", type: "video", assetId: "clip", duration: 60 },
              ],
            },
          ],
        },
      ],
    });

    expect(
      placements.map(({ node, startFrame, endFrame, framesIntoNode }) => [
        node.id,
        startFrame,
        endFrame,
        framesIntoNode,
      ]),
    ).toEqual([
      ["shot", 15, 35, 0],
      ["late", 20, 50, 10],
    ]);
  });
});

describe("mixAudioSegments with rate-scaled segments", () => {
  it("a segment declared at 2x sample rate occupies half the output time", () => {
    // 100 source samples captured at a native 100 Hz (1 s of source).
    // Declared at 2 x 100 = 200 Hz, the mixer plays them in 0.5 s of output —
    // the playbackRate varispeed trick used for video clip audio.
    const source = new Float32Array(100).fill(0.5);
    const [channel] = mixAudioSegments(
      [{ channels: [source], sampleRate: 200, startTime: 0, volume: 1 }],
      1,
      100,
      1,
    );

    const firstHalf = Array.from(channel?.slice(0, 50) ?? []);
    const secondHalf = Array.from(channel?.slice(51, 100) ?? []);

    expect(firstHalf.every((v) => Math.abs(v - 0.5) < 1e-6)).toBe(true);
    expect(secondHalf.every((v) => v === 0)).toBe(true);
  });
});

describe("worker-safe decoded audio", () => {
  it("mixes raw AudioSamples when the AudioBuffer global is absent", async () => {
    const globals = globalThis as unknown as {
      AudioBuffer?: typeof AudioBuffer;
    };
    const originalAudioBuffer = globals.AudioBuffer;
    delete globals.AudioBuffer;
    const close = vi.fn();
    const sink = {
      async *samples() {
        yield {
          sampleRate: 48_000,
          numberOfChannels: 1,
          numberOfFrames: 4,
          timestamp: 0,
          duration: 4 / 48_000,
          copyTo(target: Float32Array) {
            target.set([0.25, 0.5, -0.25, -0.5]);
          },
          close,
        };
      },
    };
    const audioScene: Scene = {
      schemaVersion: 1,
      width: 16,
      height: 16,
      fps: 4,
      duration: 4,
      assets: { tone: { id: "tone", type: "audio", src: "tone.wav" } },
      nodes: [
        {
          id: "tone-node",
          type: "audio",
          assetId: "tone",
          from: 0,
          duration: 4,
        },
      ],
    };
    const assets = {
      audio: new Map([
        [
          "tone",
          {
            duration: 1,
            sampleRate: 48_000,
            numberOfChannels: 1,
            sink,
          },
        ],
      ]),
      videos: new Map(),
    } as unknown as ResolvedAssets;

    try {
      const mixed = await mixSceneAudioData(audioScene, assets, 0, 3);
      expect(mixed).not.toBeNull();
      expect(Array.from(mixed?.channels[0]?.slice(0, 4) ?? [])).toEqual([
        0.25, 0.5, -0.25, -0.5,
      ]);
      expect(close).toHaveBeenCalledOnce();
      expect(typeof globals.AudioBuffer).toBe("undefined");
    } finally {
      if (originalAudioBuffer) globals.AudioBuffer = originalAudioBuffer;
    }
  });

  it("mixes an embedded video soundtrack without AudioBuffer", async () => {
    const globals = globalThis as unknown as {
      AudioBuffer?: typeof AudioBuffer;
    };
    const originalAudioBuffer = globals.AudioBuffer;
    delete globals.AudioBuffer;
    const close = vi.fn();
    const sink = {
      async *samples() {
        yield {
          sampleRate: 48_000,
          numberOfChannels: 1,
          numberOfFrames: 2,
          timestamp: 0,
          duration: 2 / 48_000,
          copyTo(target: Float32Array) {
            target.set([0.4, -0.4]);
          },
          close,
        };
      },
    };
    const videoScene: Scene = {
      schemaVersion: 1,
      width: 16,
      height: 16,
      fps: 2,
      duration: 2,
      assets: { clip: { id: "clip", type: "video", src: "clip.mp4" } },
      nodes: [
        {
          id: "clip-node",
          type: "video",
          assetId: "clip",
          from: 0,
          duration: 2,
        },
      ],
    };
    const assets = {
      audio: new Map(),
      videos: new Map([
        [
          "clip",
          {
            duration: 1,
            audio: {
              duration: 1,
              sampleRate: 48_000,
              numberOfChannels: 1,
              sink,
            },
          },
        ],
      ]),
    } as unknown as ResolvedAssets;

    try {
      const mixed = await mixSceneAudioData(videoScene, assets, 0, 1);
      expect(mixed?.channels[0]?.[0]).toBeCloseTo(0.4, 6);
      expect(mixed?.channels[0]?.[1]).toBeCloseTo(-0.4, 6);
      expect(close).toHaveBeenCalledOnce();
      expect(typeof globals.AudioBuffer).toBe("undefined");
    } finally {
      if (originalAudioBuffer) globals.AudioBuffer = originalAudioBuffer;
    }
  });

  it("stops audio decoding on cancellation and still closes the yielded sample", async () => {
    const controller = new AbortController();
    const close = vi.fn();
    const assets = {
      audio: new Map([
        [
          "tone",
          {
            duration: 1,
            sampleRate: 48_000,
            numberOfChannels: 1,
            sink: {
              async *samples() {
                controller.abort(new Error("cancel audio"));
                yield {
                  sampleRate: 48_000,
                  numberOfChannels: 1,
                  numberOfFrames: 1,
                  timestamp: 0,
                  duration: 1 / 48_000,
                  copyTo: () => undefined,
                  close,
                };
              },
            },
          },
        ],
      ]),
      videos: new Map(),
    } as unknown as ResolvedAssets;
    const audioScene: Scene = {
      schemaVersion: 1,
      width: 16,
      height: 16,
      fps: 30,
      duration: 30,
      assets: { tone: { id: "tone", type: "audio", src: "tone.wav" } },
      nodes: [{ id: "tone", type: "audio", assetId: "tone" }],
    };

    await expect(
      mixSceneAudioData(audioScene, assets, 0, 29, controller.signal),
    ).rejects.toThrow("cancel audio");
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("mixAudioSegments", () => {
  it("evaluates volume envelopes with keyframe easing", () => {
    expect(
      evaluateVolumeEnvelope(
        [
          { frame: 0, value: 0 },
          { frame: 10, value: 1, easing: "linear" },
        ],
        5,
      ),
    ).toBeCloseTo(0.5, 5);
    expect(
      evaluateVolumeEnvelope(
        [
          { frame: 0, value: 0 },
          { frame: 10, value: 1, easing: "easeOut" },
        ],
        5,
      ),
    ).toBeGreaterThan(0.5);
  });

  it("applies node-local volume envelopes during mixing", () => {
    const mixed = mixAudioSegments(
      [
        {
          channels: [new Float32Array([1, 1, 1, 1])],
          sampleRate: 4,
          startTime: 0,
          volume: 0.5,
          envelopeFps: 4,
          volumeEnvelope: [
            { frame: 0, value: 0 },
            { frame: 3, value: 1 },
          ],
        },
      ],
      1,
      4,
      1,
    );

    expect(Array.from(mixed[0] ?? [])).toEqual([
      0,
      expect.closeTo(1 / 6, 6),
      expect.closeTo(1 / 3, 6),
      0.5,
    ]);
  });

  it("samples volume envelopes from a chunk's node-local offset", () => {
    const mixed = mixAudioSegments(
      [
        {
          channels: [new Float32Array([1, 1])],
          sampleRate: 2,
          startTime: 0,
          volume: 1,
          envelopeStartTime: 0.5,
          envelopeFps: 2,
          volumeEnvelope: [
            { frame: 0, value: 0 },
            { frame: 2, value: 1 },
          ],
        },
      ],
      1,
      2,
      1,
    );

    expect(Array.from(mixed[0] ?? [])).toEqual([0.5, 1]);
  });

  it("places segments at the right offset with volume applied", () => {
    const mixed = mixAudioSegments(
      [
        {
          channels: [new Float32Array([1, 1])],
          sampleRate: 4,
          startTime: 0.5,
          volume: 0.5,
        },
      ],
      1,
      4,
      2,
    );

    // 4 samples of output; the segment lands on samples 2 and 3 at gain 0.5,
    // fanned out from mono to both channels.
    expect(Array.from(mixed[0] ?? [])).toEqual([0, 0, 0.5, 0.5]);
    expect(Array.from(mixed[1] ?? [])).toEqual([0, 0, 0.5, 0.5]);
  });

  it("resamples to the output rate", () => {
    const mixed = mixAudioSegments(
      [
        {
          channels: [new Float32Array([1, 1, 1, 1])],
          sampleRate: 4,
          startTime: 0,
          volume: 1,
        },
      ],
      1,
      8,
      1,
    );

    // 1s of constant 1.0 at 4 Hz should cover all 8 output samples.
    expect(Array.from(mixed[0] ?? [])).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it("sums overlapping segments and clamps the final mix", () => {
    const loud = {
      channels: [new Float32Array([0.8, 0.8])],
      sampleRate: 2,
      startTime: 0,
      volume: 1,
    };
    const mixed = mixAudioSegments([loud, loud], 1, 2, 1);

    expect(Array.from(mixed[0] ?? [])).toEqual([1, 1]);
  });

  it("applies deterministic stereo panning", () => {
    const mixed = mixAudioSegments(
      [
        {
          channels: [new Float32Array([0.5, 0.5])],
          sampleRate: 2,
          startTime: 0,
          volume: 1,
          pan: 1,
        },
      ],
      1,
      2,
      2,
    );
    expect(Array.from(mixed[0] ?? [])).toEqual([0, 0]);
    expect(Array.from(mixed[1] ?? [])).toEqual([0.5, 0.5]);
  });

  it("measures loudness and applies a peak limiter", () => {
    const channels = [
      new Float32Array([0.5, -1.5]),
      new Float32Array([0.5, 1.5]),
    ];
    expect(measureAudioLoudness(channels)).toMatchObject({ peak: 1.5 });
    const limited = limitAudioPeak(channels, 0.9);
    expect(limited).toMatchObject({ peakBefore: 1.5, gain: 0.6 });
    expect(measureAudioLoudness(channels).peak).toBeCloseTo(0.9);
  });
});

describe("loopedSourceRanges", () => {
  it("returns one bounded range for non-looped audio", () => {
    expect(
      loopedSourceRanges({
        start: 0.25,
        duration: 2,
        sourceDuration: 1,
        loop: false,
      }),
    ).toEqual([{ sourceStart: 0.25, sourceEnd: 1, outputOffset: 0 }]);
  });

  it("splits looped audio across source wraps", () => {
    expect(
      loopedSourceRanges({
        start: 0.75,
        duration: 2,
        sourceDuration: 1,
        loop: true,
      }),
    ).toEqual([
      { sourceStart: 0.75, sourceEnd: 1, outputOffset: 0 },
      { sourceStart: 0, sourceEnd: 1, outputOffset: 0.25 },
      { sourceStart: 0, sourceEnd: 0.75, outputOffset: 1.25 },
    ]);
  });

  it("wraps trim offsets beyond the source duration", () => {
    expect(
      loopedSourceRanges({
        start: 2.5,
        duration: 0.75,
        sourceDuration: 1,
        loop: true,
      }),
    ).toEqual([
      { sourceStart: 0.5, sourceEnd: 1, outputOffset: 0 },
      { sourceStart: 0, sourceEnd: 0.25, outputOffset: 0.5 },
    ]);
  });
});

describe("audioChunkRanges", () => {
  it("covers the range with consecutive inclusive chunks", () => {
    // 1.5s at 30fps in 0.4s chunks: 12-frame windows over [0, 44]
    expect(audioChunkRanges(0, 44, 30, 0.4)).toEqual([
      [0, 11],
      [12, 23],
      [24, 35],
      [36, 44],
    ]);
  });

  it("single chunk when the range fits, clamped to at least one frame", () => {
    expect(audioChunkRanges(10, 20, 30, 10)).toEqual([[10, 20]]);
    expect(audioChunkRanges(5, 5, 30, 0.0001)).toEqual([[5, 5]]);
  });
});
