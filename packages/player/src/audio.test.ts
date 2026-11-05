import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mixSceneAudio } from "@dojo-video-engine/export";
import type { ResolvedAssets } from "@dojo-video-engine/renderer-canvas2d";
import type { Scene } from "@dojo-video-engine/schema";
import { ChunkedWebAudioPreview, previewAudioChunkRange } from "./audio.js";
import { createPlayer } from "./index.js";

vi.mock("@dojo-video-engine/export", () => ({
  collectAudioPlacements: vi.fn(() => [{}]),
  mixSceneAudio: vi.fn(),
}));

const mix = vi.mocked(mixSceneAudio);
const assets = {} as ResolvedAssets;
const scene = { fps: 30, duration: 2700 } as Scene;
const buffer = (duration = 30) => ({ duration }) as AudioBuffer;
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
async function settle() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

function fakeAudioContext() {
  const sources: Array<{
    buffer: AudioBuffer | null;
    onended: (() => void) | null;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];
  const context = {
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null as AudioBuffer | null,
        onended: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      sources.push(source);
      return source;
    }),
  };
  return { context, sources, create: () => context as unknown as AudioContext };
}

beforeEach(() => {
  vi.useFakeTimers();
  mix.mockReset();
  mix.mockResolvedValue(buffer());
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("chunked audio preview", () => {
  it("bounds a long scene to the chunk around the seek position", () => {
    const scene = { fps: 30, duration: 30 * 60 * 20 };
    expect(previewAudioChunkRange(scene, 12 * 60 + 7, 30)).toEqual({
      chunkStart: 720,
      startFrame: 21_600,
      endFrame: 22_499,
    });
  });

  it("clamps the final chunk to scene duration", () => {
    expect(previewAudioChunkRange({ fps: 30, duration: 1000 }, 32, 30)).toEqual(
      {
        chunkStart: 30,
        startFrame: 900,
        endFrame: 999,
      },
    );
  });

  it("holds the requested clock while the first mix loads without skipping initial sound", async () => {
    const first = deferred<AudioBuffer | null>();
    mix.mockImplementationOnce(() => first.promise);
    const audio = fakeAudioContext();
    const preview = new ChunkedWebAudioPreview(30, audio.create);
    await preview.load(scene, assets);
    preview.start(7);
    audio.context.currentTime = 2;
    expect(preview.position()).toBe(7);
    first.resolve(buffer());
    await settle();
    expect(audio.sources[0]!.start).toHaveBeenCalledWith(2, 7, 23);
    expect(audio.sources[1]!.start).toHaveBeenCalledWith(25, 0, 30);
    expect(preview.position()).toBe(7);
    audio.context.currentTime = 3;
    expect(preview.position()).toBe(8);
    preview.dispose();
  });

  it.each([false, true])(
    "keeps the player synchronized while initial audio loads (loop=%s)",
    async (loop) => {
      const first = deferred<AudioBuffer | null>();
      mix.mockImplementationOnce(() => first.promise);
      const audio = fakeAudioContext();
      const preview = new ChunkedWebAudioPreview(30, audio.create);
      let now = 0;
      let scheduled: (() => void) | null = null;
      const player = await createPlayer({
        loop,
        scene: {
          ...scene,
          schemaVersion: 1,
          width: 100,
          height: 100,
          assets: {},
          nodes: [],
        },
        assets: {
          images: new Map(),
          fonts: new Map(),
          videos: new Map(),
          videoFrames: new Map(),
          audio: new Map(),
          lotties: new Map(),
          lottieFrames: new Map(),
        },
        context: { clearRect: vi.fn() } as unknown as CanvasRenderingContext2D,
        audio: preview,
        now: () => now,
        requestFrame: (callback) => {
          scheduled = callback;
          return 1;
        },
        cancelFrame: () => {
          scheduled = null;
        },
      });
      const tick = async (time: number) => {
        now = time;
        audio.context.currentTime = time / 1000;
        const callback = scheduled;
        scheduled = null;
        callback?.();
        await settle();
      };
      await player.audioReady;
      player.play();
      await tick(34);
      expect(player.currentFrame).toBe(1);
      await tick(2000);
      expect(mix).toHaveBeenCalledTimes(1);
      expect(mix.mock.calls[0]?.[4]?.aborted).toBe(false);
      expect(player.currentFrame).toBe(0);
      first.resolve(buffer());
      await settle();
      expect(audio.sources[0]!.start).toHaveBeenCalledWith(2, 0, 30);
      await tick(2034);
      expect(player.currentFrame).toBe(1);
      expect(preview.position()).toBeCloseTo(0.034);
      await player.disposeAsync();
    },
  );

  it("prefetches one chunk and schedules uninterrupted boundaries with bounded sources", async () => {
    const audio = fakeAudioContext();
    const preview = new ChunkedWebAudioPreview(30, audio.create);
    await preview.load(scene, assets);
    preview.start(0);
    await settle();
    expect(mix.mock.calls.map((call) => call.slice(2, 4))).toEqual([
      [0, 899],
      [900, 1799],
    ]);
    expect(audio.sources[0]!.start).toHaveBeenCalledWith(0, 0, 30);
    expect(audio.sources[1]!.start).toHaveBeenCalledWith(30, 0, 30);
    expect(mix).toHaveBeenCalledTimes(2);
    audio.context.currentTime = 30;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(audio.sources[0]!.disconnect).toHaveBeenCalledOnce();
    expect(audio.sources[2]!.start).toHaveBeenCalledWith(60, 0, 30);
    expect(mix.mock.calls.map((call) => call.slice(2, 4))).toEqual([
      [0, 899],
      [900, 1799],
      [1800, 2699],
    ]);
    expect(
      audio.sources.filter(
        (source) => source.disconnect.mock.calls.length === 0,
      ),
    ).toHaveLength(2);
    preview.stop();
    expect(audio.sources[1]!.stop).toHaveBeenCalledOnce();
    expect(audio.sources[2]!.stop).toHaveBeenCalledOnce();
    expect(preview.position()).toBeNull();
  });

  it("preserves silence and schedules the following audible chunk on the same clock", async () => {
    mix.mockResolvedValueOnce(null);
    const audio = fakeAudioContext();
    const preview = new ChunkedWebAudioPreview(30, audio.create);
    await preview.load(scene, assets);
    preview.start(0);
    await settle();
    expect(audio.sources).toHaveLength(1);
    expect(audio.sources[0]!.start).toHaveBeenCalledWith(30, 0, 30);
    audio.context.currentTime = 15;
    expect(preview.position()).toBe(15);
    expect(mix).toHaveBeenCalledTimes(2);
    preview.dispose();
  });

  it("aligns a late prefetched chunk to the established clock without shifting later audio", async () => {
    const next = deferred<AudioBuffer | null>();
    mix
      .mockResolvedValueOnce(buffer())
      .mockImplementationOnce(() => next.promise);
    const audio = fakeAudioContext();
    const preview = new ChunkedWebAudioPreview(30, audio.create);
    await preview.load(scene, assets);
    preview.start(0);
    await settle();
    audio.context.currentTime = 32;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(preview.position()).toBe(32);
    next.resolve(buffer());
    await settle();
    expect(audio.sources[1]!.start).toHaveBeenCalledWith(32, 2, 28);
    expect(audio.sources[2]!.start).toHaveBeenCalledWith(60, 0, 30);
    expect(preview.position()).toBe(32);
    preview.dispose();
  });

  it("discards an expired prefetch and jumps directly to the current chunk", async () => {
    const next = deferred<AudioBuffer | null>();
    mix
      .mockResolvedValueOnce(buffer())
      .mockImplementationOnce(() => next.promise);
    const audio = fakeAudioContext();
    const preview = new ChunkedWebAudioPreview(30, audio.create);
    await preview.load({ ...scene, duration: 9000 }, assets);
    preview.start(0);
    await settle();
    audio.context.currentTime = 125;
    await vi.advanceTimersByTimeAsync(30_000);
    next.resolve(buffer());
    await settle();
    expect(mix.mock.calls.map((call) => call.slice(2, 4))).toEqual([
      [0, 899],
      [900, 1799],
      [3600, 4499],
      [4500, 5399],
    ]);
    expect(audio.sources[1]!.start).toHaveBeenCalledWith(125, 5, 25);
    expect(audio.sources[2]!.start).toHaveBeenCalledWith(150, 0, 30);
    preview.dispose();
  });

  it("cancels an old generation on seek and rejects its late mix result", async () => {
    const next = deferred<AudioBuffer | null>();
    mix
      .mockResolvedValueOnce(buffer())
      .mockImplementationOnce(() => next.promise);
    const audio = fakeAudioContext();
    const preview = new ChunkedWebAudioPreview(30, audio.create);
    await preview.load(scene, assets);
    preview.start(0);
    await settle();
    const oldSignal = mix.mock.calls[1]![4]!;
    audio.context.currentTime = 2;
    preview.start(45);
    await settle();
    expect(oldSignal.aborted).toBe(true);
    expect(audio.sources[0]!.stop).toHaveBeenCalledOnce();
    expect(audio.sources[1]!.start).toHaveBeenCalledWith(2, 15, 15);
    expect(audio.sources[2]!.start).toHaveBeenCalledWith(17, 0, 30);
    next.resolve(buffer());
    await settle();
    expect(audio.sources).toHaveLength(3);
    expect(preview.position()).toBe(45);
    preview.dispose();
  });

  it("replaces a loaded revision without letting its pending mix or abort affect the new one", async () => {
    const old = deferred<AudioBuffer | null>();
    mix.mockImplementationOnce(() => old.promise);
    const audio = fakeAudioContext();
    const oldSignal = new AbortController();
    const preview = new ChunkedWebAudioPreview(30, audio.create);
    await preview.load(scene, assets, oldSignal.signal);
    preview.start(0);
    const oldMixSignal = mix.mock.calls[0]![4]!;
    const replacement = { ...scene, duration: 900 };
    await preview.load(replacement, assets);
    preview.start(5);
    await settle();
    expect(oldMixSignal.aborted).toBe(true);
    oldSignal.abort();
    old.resolve(buffer());
    await settle();
    expect(audio.sources).toHaveLength(1);
    expect(audio.sources[0]!.start).toHaveBeenCalledWith(0, 5, 25);
    expect(audio.sources[0]!.stop).not.toHaveBeenCalled();
    expect(preview.position()).toBe(5);
    preview.dispose();
  });

  it("stops both playing and scheduled chunks when the loaded revision is aborted", async () => {
    const audio = fakeAudioContext();
    const signal = new AbortController();
    const preview = new ChunkedWebAudioPreview(30, audio.create);
    await preview.load(scene, assets, signal.signal);
    preview.start(0);
    await settle();
    signal.abort();
    expect(audio.sources).toHaveLength(2);
    expect(
      audio.sources.every((source) => source.stop.mock.calls.length === 1),
    ).toBe(true);
    expect(preview.position()).toBeNull();
    preview.start(0);
    await settle();
    expect(audio.sources).toHaveLength(2);
    preview.dispose();
  });

  it("does not resurrect a stopped or disposed preview after its initial mix resolves", async () => {
    const first = deferred<AudioBuffer | null>();
    mix.mockImplementationOnce(() => first.promise);
    const audio = fakeAudioContext();
    const preview = new ChunkedWebAudioPreview(30, audio.create);
    await preview.load(scene, assets);
    preview.start(0);
    const signal = mix.mock.calls[0]![4]!;
    preview.dispose();
    first.resolve(buffer());
    await settle();
    expect(signal.aborted).toBe(true);
    expect(audio.sources).toHaveLength(0);
    expect(preview.position()).toBeNull();
    expect(audio.context.close).toHaveBeenCalledOnce();
  });

  it("keeps scheduled audio bounded when AudioContext time is suspended", async () => {
    const audio = fakeAudioContext();
    const preview = new ChunkedWebAudioPreview(30, audio.create);
    await preview.load(scene, assets);
    preview.start(0);
    await settle();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(mix).toHaveBeenCalledTimes(2);
    expect(audio.sources).toHaveLength(2);
    expect(preview.position()).toBe(0);
    preview.dispose();
  });

  it("schedules non-overlapping frame ranges at fractional frame rates", async () => {
    const audio = fakeAudioContext();
    const preview = new ChunkedWebAudioPreview(1, audio.create);
    const fractionalScene = { ...scene, fps: 29.97, duration: 90 };
    await preview.load(fractionalScene, assets);
    preview.start(0);
    await settle();
    expect(mix.mock.calls.map((call) => call.slice(2, 4))).toEqual([
      [0, 29],
      [30, 59],
    ]);
    const end = 30 / 29.97;
    expect(audio.sources[0]!.start.mock.calls[0]).toEqual([0, 0, end]);
    expect(audio.sources[1]!.start.mock.calls[0]).toEqual([end, 0, end]);
    audio.context.currentTime = end;
    await vi.advanceTimersByTimeAsync(Math.ceil(end * 1000));
    expect(mix.mock.calls[2]!.slice(2, 4)).toEqual([60, 89]);
    expect(audio.sources[2]!.start.mock.calls[0]![0]).toBe(60 / 29.97);
    preview.dispose();
  });

  it("stops at the final partial chunk without mixing past scene duration", async () => {
    const audio = fakeAudioContext();
    const preview = new ChunkedWebAudioPreview(30, audio.create);
    const shortScene = { ...scene, duration: 1000 };
    await preview.load(shortScene, assets);
    preview.start(32);
    await settle();
    expect(mix.mock.calls.map((call) => call.slice(2, 4))).toEqual([
      [900, 999],
    ]);
    expect(audio.sources[0]!.start.mock.calls[0]![1]).toBe(2);
    expect(audio.sources[0]!.start.mock.calls[0]![2]).toBeCloseTo(4 / 3);
    audio.context.currentTime = 4 / 3 + 0.001;
    await vi.advanceTimersByTimeAsync(1335);
    expect(preview.position()).toBeNull();
    expect(mix).toHaveBeenCalledOnce();
    preview.dispose();
  });

  it("surfaces mixing failure and releases a scheduled successor", async () => {
    mix
      .mockResolvedValueOnce(buffer())
      .mockRejectedValueOnce(new Error("Decode failed"));
    const audio = fakeAudioContext();
    const preview = new ChunkedWebAudioPreview(30, audio.create);
    await preview.load(scene, assets);
    preview.start(0);
    await settle();
    expect(preview.error?.message).toBe("Decode failed");
    expect(audio.sources[0]!.stop).toHaveBeenCalledOnce();
    expect(preview.position()).toBeNull();
    preview.dispose();
  });
});
