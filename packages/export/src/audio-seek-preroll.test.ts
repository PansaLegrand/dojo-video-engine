import { describe, expect, it, vi } from "vitest";
import type { Scene } from "@dojo-video-engine/schema";
import type { ResolvedAssets } from "@dojo-video-engine/renderer-canvas2d";
import { mixSceneAudioData } from "./index.js";
const sampleRate = 48000;
const sampleValue = (sample: number) =>
  Math.fround(Math.sin(sample * 0.013) * 0.2);
function fixture(trim: number, abort?: AbortController, firstSourceSample = 0) {
  const queries: Array<[number, number]> = [],
    close = vi.fn(),
    finished = vi.fn(),
    copied = vi.fn();
  const sink = {
    async *samples(start: number, end: number) {
      queries.push([start, end]);
      const first = Math.max(
        firstSourceSample,
        Math.floor((start * sampleRate) / 1024) * 1024,
      );
      try {
        for (let at = first; at < Math.ceil(end * sampleRate); at += 1024) {
          if (abort) abort.abort(new Error("cancel during warm-up"));
          yield {
            timestamp: at / sampleRate,
            numberOfFrames: 1024,
            numberOfChannels: 1,
            copyTo(values: Float32Array) {
              copied();
              for (let i = 0; i < values.length; i++)
                values[i] =
                  first > firstSourceSample && at === first
                    ? 0
                    : sampleValue(at + i);
            },
            close,
          };
        }
      } finally {
        finished();
      }
    },
  };
  const scene: Scene = {
    schemaVersion: 1,
    width: 160,
    height: 90,
    fps: 10,
    duration: 1,
    assets: { audio: { id: "audio", type: "audio", src: "fixture.wav" } },
    nodes: [
      {
        id: "clip",
        type: "audio",
        assetId: "audio",
        from: 0,
        duration: 1,
        audioStartTime: trim,
        volume: 0.8,
      },
    ],
  };
  const assets = {
    audio: new Map([
      ["audio", { duration: 2, sampleRate, numberOfChannels: 1, sink }],
    ]),
    videos: new Map(),
  } as unknown as ResolvedAssets;
  return { scene, assets, queries, close, finished, copied };
}
describe("bounded decoder warm-up for trimmed audio", () => {
  it.each([0.5, 0.05, 0])(
    "discards preroll while preserving the exact output window at source %s",
    async (trim) => {
      const f = fixture(trim),
        result = await mixSceneAudioData(f.scene, f.assets, 0, 0);
      expect(f.queries).toHaveLength(1);
      expect(f.queries[0]![0]).toBeCloseTo(trim - 0.1, 12);
      expect(f.queries[0]![1]).toBeCloseTo(trim + 0.1, 12);
      expect(result!.channels[0]).toHaveLength(4800);
      expect(result!.channels[1]).toHaveLength(4800);
      const first = Math.round(trim * sampleRate);
      for (let i = 0; i < 4800; i++)
        expect(result!.channels[0]![i]).toBeCloseTo(
          Math.fround(sampleValue(first + i) * 0.8),
          7,
        );
      expect(result!.channels[1]).toEqual(result!.channels[0]);
      expect(f.close).toHaveBeenCalledTimes(f.copied.mock.calls.length);
      expect(f.finished).toHaveBeenCalledOnce();
    },
  );
  it("includes negative presentation-time priming without shifting the first visible sample", async () => {
    const f = fixture(0, undefined, -1024),
      result = await mixSceneAudioData(f.scene, f.assets, 0, 0);
    expect(result!.channels[0]).toHaveLength(4800);
    for (let i = 0; i < 4800; i++)
      expect(result!.channels[0]![i]).toBeCloseTo(
        Math.fround(sampleValue(i) * 0.8),
        7,
      );
    expect(f.queries).toEqual([[-0.1, 0.1]]);
    expect(f.finished).toHaveBeenCalledOnce();
  });
  it("cancels during decoder warm-up and closes the sample and iterator without copying it", async () => {
    const controller = new AbortController(),
      f = fixture(0.5, controller);
    await expect(
      mixSceneAudioData(f.scene, f.assets, 0, 0, controller.signal),
    ).rejects.toThrow("cancel during warm-up");
    expect(f.queries[0]![0]).toBeCloseTo(0.4, 12);
    expect(f.copied).not.toHaveBeenCalled();
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.finished).toHaveBeenCalledOnce();
  });
});
