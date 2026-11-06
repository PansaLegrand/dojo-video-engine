import { describe, expect, it, vi } from "vitest";
import { createPlayer, createPlayerFromRuntime, FrameClock } from "./index.js";
import {
  Canvas2DStaticDisplayCache,
  disposeAssetsAsync,
  prepareFrame,
  renderStill,
  resolveAssets,
  type ResolvedAssets,
  ScratchSurfacePool,
} from "@dojo-video-engine/renderer-canvas2d";
import type { Canvas2DSceneRuntime } from "@dojo-video-engine/renderer-canvas2d/runtime";
import { evaluateScene } from "@dojo-video-engine/core";

vi.mock("@dojo-video-engine/renderer-canvas2d", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@dojo-video-engine/renderer-canvas2d")
    >();

  return {
    ...actual,
    disposeAssetsAsync: vi.fn(actual.disposeAssetsAsync),
    prepareFrame: vi.fn(actual.prepareFrame),
    renderStill: vi.fn(actual.renderStill),
    resolveAssets: vi.fn(actual.resolveAssets),
  };
});

function runtimeScratchPolicyTypeCheck(
  runtime: Canvas2DSceneRuntime,
  scratchSurfacePool: ScratchSurfacePool,
): void {
  void createPlayerFromRuntime(runtime, {
    context: {} as CanvasRenderingContext2D,
    // @ts-expect-error runtime-backed players own the scratch policy.
    scratchSurfacePool,
  });
}
void runtimeScratchPolicyTypeCheck;

describe("FrameClock", () => {
  const clock = (
    overrides: Partial<{
      fps: number;
      durationInFrames: number;
      loop: boolean;
    }> = {},
  ) => new FrameClock({ fps: 30, durationInFrames: 90, ...overrides });

  it("maps elapsed wall time to frames while playing", () => {
    const c = clock();
    c.play(1000);

    expect(c.frameAt(1000)).toEqual({ frame: 0, ended: false });
    expect(c.frameAt(1033)).toEqual({ frame: 0, ended: false }); // 0.99 frames
    expect(c.frameAt(1034)).toEqual({ frame: 1, ended: false });
    expect(c.frameAt(2000)).toEqual({ frame: 30, ended: false });
    expect(c.frameAt(3999)).toEqual({ frame: 89, ended: false });
  });

  it("holds the anchor frame while paused", () => {
    const c = clock();
    c.play(0);
    c.pause(1000); // frame 30

    expect(c.frameAt(99999)).toEqual({ frame: 30, ended: false });

    c.play(5000);
    expect(c.frameAt(6000)).toEqual({ frame: 60, ended: false });
  });

  it("clamps to the final frame and reports ended without looping", () => {
    const c = clock();
    c.play(0);

    expect(c.frameAt(3000)).toEqual({ frame: 89, ended: true });
    expect(c.frameAt(60000)).toEqual({ frame: 89, ended: true });
  });

  it("wraps with loop enabled and never reports ended", () => {
    const c = clock({ loop: true });
    c.play(0);

    expect(c.frameAt(3000)).toEqual({ frame: 0, ended: false }); // frame 90 → 0
    expect(c.frameAt(3034)).toEqual({ frame: 1, ended: false });
    expect(c.frameAt(6000)).toEqual({ frame: 0, ended: false });
  });

  it("seek clamps into range and preserves play state", () => {
    const c = clock();
    c.seek(500, 0);
    expect(c.frameAt(0)).toEqual({ frame: 89, ended: false });

    c.seek(-5, 0);
    expect(c.frameAt(0)).toEqual({ frame: 0, ended: false });
    expect(c.playing).toBe(false);

    c.play(1000);
    c.seek(45, 2000);
    expect(c.playing).toBe(true);
    expect(c.frameAt(2500)).toEqual({ frame: 60, ended: false });
  });

  it("replaying from the final frame restarts at 0", () => {
    const c = clock();
    c.seek(89, 0);
    c.play(100);
    expect(c.frameAt(100)).toEqual({ frame: 0, ended: false });
  });

  it("rejects invalid fps and duration", () => {
    expect(() => new FrameClock({ fps: 0, durationInFrames: 10 })).toThrow(
      /fps/,
    );
    expect(() => new FrameClock({ fps: 30, durationInFrames: 0 })).toThrow(
      /durationInFrames/,
    );
    expect(() => new FrameClock({ fps: 30, durationInFrames: 1.5 })).toThrow(
      /durationInFrames/,
    );
  });
});

// A scene with no assets so the player needs no DOM beyond the 2d context.
const testScene = {
  schemaVersion: 1,
  width: 100,
  height: 100,
  fps: 30,
  duration: 10,
  assets: {},
  nodes: [
    {
      id: "bg",
      type: "div",
      style: { width: "100%", height: "100%", backgroundColor: "#101820" },
    },
  ],
};

function fakeContext(): CanvasRenderingContext2D {
  return {
    globalAlpha: 1,
    fillStyle: "",
    save: () => undefined,
    restore: () => undefined,
    clearRect: () => undefined,
    fillRect: () => undefined,
    translate: () => undefined,
  } as unknown as CanvasRenderingContext2D;
}

/** Manual time + scheduler so playback is fully deterministic in tests. */
function fakeDriver() {
  let time = 0;
  const queue = new Map<number, () => void>();
  let nextHandle = 1;

  return {
    now: () => time,
    requestFrame: (callback: () => void) => {
      const handle = nextHandle++;
      queue.set(handle, callback);
      return handle;
    },
    cancelFrame: (handle: number) => void queue.delete(handle),
    /** Advances the clock then fires every queued callback. */
    async step(ms: number) {
      time += ms;
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) {
        callback();
      }
      // Let the async tick (prepare/render) settle.
      for (let index = 0; index < 8; index += 1) {
        await Promise.resolve();
      }
    },
    get pending() {
      return queue.size;
    },
  };
}

function emptyAssets(): ResolvedAssets {
  return {
    images: new Map(),
    fonts: new Map(),
    videos: new Map(),
    videoFrames: new Map(),
    audio: new Map(),
    lotties: new Map(),
    lottieFrames: new Map(),
  };
}

function borrowedRuntime(
  runtimeScene: typeof testScene,
  assets: ResolvedAssets,
): {
  runtime: Canvas2DSceneRuntime;
  abortActive(reason?: unknown): Promise<void>;
  readonly activeScopes: number;
  readonly preparedGeneration: number;
  readonly scratchSurfacePool: ScratchSurfacePool;
  readonly staticDisplayCache: Canvas2DStaticDisplayCache;
} {
  const scratchSurfacePool = new ScratchSurfacePool({
    createCanvas: () => ({}) as OffscreenCanvas,
    maxBytes: 1024,
    maxSurfaces: 1,
    maxDimension: 16,
  });
  const staticDisplayCache = new Canvas2DStaticDisplayCache({
    maxBytes: 0,
    maxEntries: 0,
    maxKeyBytes: 0,
  });
  const state = {
    assets,
    scratchSurfacePool,
    ownsScratchSurfacePool: false,
    staticDisplayCache,
    ownsStaticDisplayCache: false,
    textMeasureCaches: new WeakMap(),
    disposed: false,
    preparedGeneration: 0,
  };
  let activeScopes = 0;
  let active:
    | { controller: AbortController; settled: Promise<unknown> }
    | undefined;
  const runtime = {
    useBackendState: <Result>(
      backendId: string,
      callback: (context: {
        state: typeof state;
        scene: typeof testScene;
        revision: number;
        signal: AbortSignal;
      }) => Result | Promise<Result>,
      options: { signal?: AbortSignal } = {},
    ): Promise<Result> => {
      if (backendId !== "canvas2d") {
        return Promise.reject(new Error(`Unexpected backend ${backendId}.`));
      }
      const controller = new AbortController();
      const abort = () => controller.abort(options.signal?.reason);
      if (options.signal?.aborted) abort();
      else options.signal?.addEventListener("abort", abort, { once: true });
      activeScopes += 1;
      const settled = Promise.resolve(
        callback({
          state,
          scene: runtimeScene,
          revision: 0,
          signal: controller.signal,
        }),
      ).finally(() => {
        options.signal?.removeEventListener("abort", abort);
        activeScopes -= 1;
      });
      active = { controller, settled };
      return settled;
    },
  } as unknown as Canvas2DSceneRuntime;

  return {
    runtime,
    scratchSurfacePool,
    staticDisplayCache,
    async abortActive(reason = new Error("runtime revision changed")) {
      active?.controller.abort(reason);
      await active?.settled.catch(() => undefined);
    },
    get activeScopes() {
      return activeScopes;
    },
    get preparedGeneration() {
      return state.preparedGeneration;
    },
  };
}

describe("Player", () => {
  it("reuses but never disposes caller-owned render caches", async () => {
    const scratchSurfacePool = new ScratchSurfacePool({
      createCanvas: () => ({}) as OffscreenCanvas,
      maxBytes: 1024,
      maxSurfaces: 1,
      maxDimension: 16,
    });
    const staticDisplayCache = new Canvas2DStaticDisplayCache({
      maxBytes: 0,
      maxEntries: 0,
      maxKeyBytes: 0,
    });
    const renderStillMock = vi.mocked(renderStill);
    renderStillMock.mockClear();
    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      audio: false,
      scratchSurfacePool,
      staticDisplayCache,
    });
    expect(renderStillMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      0,
      expect.objectContaining({ scratchSurfacePool, staticDisplayCache }),
    );
    await player.disposeAsync();
    expect(scratchSurfacePool.stats().disposed).toBe(false);
    expect(staticDisplayCache.stats().disposed).toBe(false);
  });

  it("renders frame 0 on creation and frames advance with the clock", async () => {
    const driver = fakeDriver();
    const frames: number[] = [];

    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });
    player.on("frame", (frame) => frames.push(frame));

    expect(player.currentFrame).toBe(0);

    player.play();
    await driver.step(34); // ~1 frame at 30fps
    expect(player.currentFrame).toBe(1);
    await driver.step(100); // skips ahead — latest frame wins, no stale queue
    expect(player.currentFrame).toBe(4);
    expect(frames).toEqual([1, 4]);
  });

  it("pauses, seeks, and fires ended at the final frame", async () => {
    const driver = fakeDriver();
    const events: string[] = [];

    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });
    player.on("play", () => events.push("play"));
    player.on("pause", () => events.push("pause"));
    player.on("ended", (frame) => events.push(`ended@${frame}`));

    player.play();
    await driver.step(100);
    player.pause();
    expect(player.playing).toBe(false);
    expect(driver.pending).toBe(0); // no leaked animation frame

    await player.seek(7);
    expect(player.currentFrame).toBe(7);

    player.play();
    await driver.step(1000); // way past the end
    expect(player.playing).toBe(false);
    expect(player.currentFrame).toBe(9);
    expect(events).toEqual(["play", "pause", "play", "ended@9"]);
  });

  it("loops instead of ending when loop is set", async () => {
    const driver = fakeDriver();

    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      loop: true,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });

    player.play();
    await driver.step(334); // frame 10 → wraps to 0
    expect(player.playing).toBe(true);
    expect(player.currentFrame).toBe(0);

    await driver.step(34);
    expect(player.currentFrame).toBe(1);
    player.dispose();
  });

  it("dispose stops the loop and makes the player inert", async () => {
    const driver = fakeDriver();

    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });

    player.play();
    player.dispose();
    expect(driver.pending).toBe(0);
    expect(() => player.play()).toThrow(/disposed/);
  });

  it("serializes concurrent seeks and resolves each only after its frame paints", async () => {
    const assets: ResolvedAssets = {
      images: new Map(),
      fonts: new Map(),
      videos: new Map(),
      videoFrames: new Map(),
      audio: new Map(),
      lotties: new Map(),
      lottieFrames: new Map(),
    };
    const prepareFrameMock = vi.mocked(prepareFrame);
    prepareFrameMock.mockClear();
    let finishFirst!: () => void;
    prepareFrameMock.mockResolvedValueOnce(
      evaluateScene(testScene as never, 0),
    );
    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      assets,
      audio: false,
    });
    prepareFrameMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = () => resolve(evaluateScene(testScene as never, 2));
          }),
      )
      .mockResolvedValueOnce(evaluateScene(testScene as never, 4));

    const first = player.seek(2);
    const second = player.seek(4);
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
    expect(prepareFrameMock).toHaveBeenCalledTimes(2); // initial + first seek
    finishFirst();
    await first;
    await second;

    expect(player.currentFrame).toBe(4);
    expect(prepareFrameMock).toHaveBeenCalledTimes(3);
  });

  it("rolls back owned assets when initial rendering fails", async () => {
    const ownedAssetScene = {
      ...testScene,
      assets: {
        clip: { id: "clip", type: "video" as const, src: "blob:fake" },
      },
    };
    const assets: ResolvedAssets = {
      images: new Map(),
      fonts: new Map(),
      videos: new Map(),
      videoFrames: new Map(),
      audio: new Map(),
      lotties: new Map(),
      lottieFrames: new Map(),
    };
    const disposeAssetsMock = vi.mocked(disposeAssetsAsync);
    disposeAssetsMock.mockClear();
    vi.mocked(resolveAssets).mockResolvedValueOnce(assets);
    vi.mocked(prepareFrame).mockRejectedValueOnce(new Error("initial decode"));

    await expect(
      createPlayer({
        context: fakeContext(),
        scene: ownedAssetScene,
        audio: false,
      }),
    ).rejects.toThrow("initial decode");
    expect(disposeAssetsMock).toHaveBeenCalledWith(assets);
  });

  it("aborts an in-flight frame before awaiting owned asset disposal", async () => {
    const driver = fakeDriver();
    const ownedAssetScene = {
      ...testScene,
      assets: {
        clip: { id: "clip", type: "video" as const, src: "blob:fake" },
      },
    };
    const assets: ResolvedAssets = {
      images: new Map(),
      fonts: new Map(),
      videos: new Map(),
      videoFrames: new Map(),
      audio: new Map(),
      lotties: new Map(),
      lottieFrames: new Map(),
    };
    const disposeAssetsMock = vi.mocked(disposeAssetsAsync);
    const prepareFrameMock = vi.mocked(prepareFrame);
    const resolveAssetsMock = vi.mocked(resolveAssets);
    let finishFrame!: () => void;
    const resolvedFrame = (
      frame: number,
    ): Awaited<ReturnType<typeof prepareFrame>> =>
      evaluateScene(ownedAssetScene as never, frame);

    disposeAssetsMock.mockClear();
    resolveAssetsMock.mockResolvedValueOnce(assets);
    prepareFrameMock
      .mockResolvedValueOnce(resolvedFrame(0))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFrame = () => resolve(resolvedFrame(1));
          }),
      );

    const player = await createPlayer({
      context: fakeContext(),
      scene: ownedAssetScene,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });

    player.play();
    const renderPromise = driver.step(34);
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
    await player.disposeAsync();
    await renderPromise;
    expect(disposeAssetsMock).toHaveBeenCalledWith(assets);
    finishFrame();
  });
});

describe("Canvas2D prepared runtime player compatibility", () => {
  it("holds borrowed assets until async player disposal completes", async () => {
    const assets = emptyAssets();
    const scope = borrowedRuntime(testScene, assets);
    const disposeAssetsMock = vi.mocked(disposeAssetsAsync);
    disposeAssetsMock.mockClear();

    const player = await createPlayerFromRuntime(scope.runtime, {
      context: fakeContext(),
      audio: false,
    });

    expect(scope.activeScopes).toBe(1);
    expect(scope.preparedGeneration).toBe(1);
    await player.disposeAsync();
    await vi.waitFor(() => expect(scope.activeScopes).toBe(0));
    expect(scope.preparedGeneration).toBe(2);
    expect(disposeAssetsMock).not.toHaveBeenCalledWith(assets);
  });

  it("delegates runtime-owned scratch and static caches by identity", async () => {
    const scope = borrowedRuntime(testScene, emptyAssets());
    const renderStillMock = vi.mocked(renderStill);
    renderStillMock.mockClear();
    const player = await createPlayerFromRuntime(scope.runtime, {
      context: fakeContext(),
      audio: false,
    });

    expect(renderStillMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      0,
      expect.objectContaining({
        scratchSurfacePool: scope.scratchSurfacePool,
        staticDisplayCache: scope.staticDisplayCache,
      }),
    );
    await player.disposeAsync();
  });

  it("disposes and releases a player before a runtime update continues", async () => {
    const scope = borrowedRuntime(testScene, emptyAssets());
    const player = await createPlayerFromRuntime(scope.runtime, {
      context: fakeContext(),
      audio: false,
    });

    await scope.abortActive();

    expect(scope.activeScopes).toBe(0);
    expect(() => player.play()).toThrow(/disposed/);
  });

  it("links caller cancellation to player disposal and scope release", async () => {
    const controller = new AbortController();
    const scope = borrowedRuntime(testScene, emptyAssets());
    const player = await createPlayerFromRuntime(scope.runtime, {
      context: fakeContext(),
      audio: false,
      signal: controller.signal,
    });

    controller.abort(new Error("close preview"));
    await scope.abortActive(controller.signal.reason);

    expect(scope.activeScopes).toBe(0);
    await expect(player.seek(1)).rejects.toThrow(/disposed/);
  });

  it("releases the borrow when initial rendering fails", async () => {
    const scope = borrowedRuntime(testScene, emptyAssets());
    vi.mocked(prepareFrame).mockRejectedValueOnce(new Error("initial decode"));

    await expect(
      createPlayerFromRuntime(scope.runtime, {
        context: fakeContext(),
        audio: false,
      }),
    ).rejects.toThrow("initial decode");
    await Promise.resolve();

    expect(scope.activeScopes).toBe(0);
    expect(scope.preparedGeneration).toBe(2);
  });
});

/** Records calls; position is settable to simulate the audio clock. */
function fakeAudio(audible = true) {
  const calls: string[] = [];
  let playingPosition: number | null = null;

  return {
    calls,
    setPosition(seconds: number | null) {
      playingPosition = seconds;
    },
    preview: {
      load: async () => audible,
      start: (at: number) => void calls.push(`start@${at.toFixed(3)}`),
      stop: () => void calls.push("stop"),
      position: () => playingPosition,
      dispose: () => void calls.push("dispose"),
    },
  };
}

describe("Player audio preview", () => {
  it("starts audio at the current scene time and stops on pause", async () => {
    const driver = fakeDriver();
    const audio = fakeAudio();

    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      audio: audio.preview,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });
    await player.audioReady;

    await player.seek(3);
    player.play();
    expect(audio.calls).toEqual(["start@0.100"]); // frame 3 at 30fps

    player.pause();
    expect(audio.calls).toEqual(["start@0.100", "stop"]);

    // Seeking while paused must not start sound.
    await player.seek(5);
    expect(audio.calls).toEqual(["start@0.100", "stop"]);

    player.dispose();
    expect(audio.calls).toContain("dispose");
  });

  it("seek during playback restarts audio at the new offset", async () => {
    const driver = fakeDriver();
    const audio = fakeAudio();

    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      audio: audio.preview,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });
    await player.audioReady;

    player.play();
    await player.seek(6);
    expect(audio.calls).toEqual(["start@0.000", "start@0.200"]);
    player.dispose();
  });

  it("re-anchors the frame clock to the audio position on drift", async () => {
    const driver = fakeDriver();
    const audio = fakeAudio();

    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      audio: audio.preview,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });
    await player.audioReady;

    player.play();
    // Wall clock advances one frame, but the audio clock reports frame 7 —
    // more than one frame ahead, so the player must snap to audio.
    audio.setPosition(7 / 30);
    await driver.step(34);
    expect(player.currentFrame).toBe(7);
    player.dispose();
  });

  it("keeps a pending audio start alive when looped playback corrects backwards", async () => {
    const driver = fakeDriver();
    const audio = fakeAudio();
    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      loop: true,
      audio: audio.preview,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });
    await player.audioReady;
    player.play();
    audio.setPosition(0);
    // The picture must hold the requested frame until the audio clock advances.
    const frames: number[] = [];
    player.on("frame", (frame) => frames.push(frame));
    for (let tick = 0; tick < 12; tick += 1) await driver.step(34);
    expect(player.currentFrame).toBe(0);
    expect(frames.every((frame) => frame === 0)).toBe(true);
    expect(audio.calls).toEqual(["start@0.000"]);
    audio.setPosition(0.2);
    await driver.step(34);
    expect(player.currentFrame).toBe(6);
    expect(audio.calls).toEqual(["start@0.000"]);
    audio.setPosition(null);
    await driver.step(150);
    expect(player.currentFrame).toBe(0);
    expect(audio.calls).toEqual(["start@0.000", "start@0.000"]);
    player.dispose();
  });

  it("follows one-frame audio lag without presenting a forward-then-backward jump", async () => {
    const driver = fakeDriver();
    const audio = fakeAudio();
    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      loop: true,
      audio: audio.preview,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });
    await player.audioReady;
    const frames: number[] = [];
    player.on("frame", (frame) => frames.push(frame));
    player.play();
    for (const frame of [0, 0, 1, 1, 2, 2, 3]) {
      audio.setPosition(frame / 30);
      await driver.step(34);
      expect(player.currentFrame).toBe(frame);
    }
    expect(frames).toEqual([1, 2, 3]);
    expect(audio.calls).toEqual(["start@0.000"]);
    player.dispose();
  });

  it("uses one wall-clock sample when an update crosses a frame boundary", async () => {
    const driver = fakeDriver();
    const audio = fakeAudio();
    let readAdvance = 0;
    let readOffset = 0;
    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      audio: audio.preview,
      now: () => {
        const value = driver.now() + readOffset;
        readOffset += readAdvance;
        return value;
      },
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });
    await player.audioReady;
    player.play();
    audio.setPosition(0);
    readAdvance = 34;
    await driver.step(33);
    expect(player.currentFrame).toBe(0);
    expect(audio.calls).toEqual(["start@0.000"]);
    player.dispose();
  });

  it("does not attach audio when the scene has nothing audible", async () => {
    const driver = fakeDriver();
    const audio = fakeAudio(false);

    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      audio: audio.preview,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });
    await player.audioReady;

    player.play();
    player.pause();
    // load() said inaudible: the preview was disposed, never started.
    expect(audio.calls).toEqual(["dispose"]);
    player.dispose();
  });

  it("does not block the first frame on the mix and joins playback on attach", async () => {
    const driver = fakeDriver();
    const calls: string[] = [];
    let finishLoad!: (audible: boolean) => void;
    const preview = {
      load: () =>
        new Promise<boolean>((resolve) => {
          finishLoad = resolve;
        }),
      start: (at: number) => void calls.push(`start@${at.toFixed(3)}`),
      stop: () => void calls.push("stop"),
      position: () => null,
      dispose: () => void calls.push("dispose"),
    };

    // createPlayer resolves (first frame painted) while the mix is pending.
    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      audio: preview,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });
    expect(player.currentFrame).toBe(0);

    // Play three frames silently, then the mix lands mid-playback.
    player.play();
    await driver.step(3000 / 30);
    expect(calls).toEqual([]);

    finishLoad(true);
    await player.audioReady;
    expect(calls.length).toBe(1);
    expect(calls[0]).toMatch(/^start@/);
    player.dispose();
    expect(calls).toContain("dispose");
  });

  it("disposes a late-arriving audio preview when the player is already disposed", async () => {
    const driver = fakeDriver();
    const calls: string[] = [];
    let finishLoad!: (audible: boolean) => void;
    const preview = {
      load: () =>
        new Promise<boolean>((resolve) => {
          finishLoad = resolve;
        }),
      start: () => void calls.push("start"),
      stop: () => void calls.push("stop"),
      position: () => null,
      dispose: () => void calls.push("dispose"),
    };

    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      audio: preview,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });

    player.dispose();
    finishLoad(true);
    await player.audioReady;
    expect(calls).toEqual(["dispose"]);
  });

  it("does not let a non-cooperative audio load block disposeAsync", async () => {
    const calls: string[] = [];
    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      audio: {
        load: () => new Promise<boolean>(() => undefined),
        start: () => undefined,
        stop: () => calls.push("stop"),
        position: () => null,
        dispose: () => calls.push("dispose"),
      },
    });

    await player.disposeAsync();
    expect(calls).toContain("dispose");
  });
});

describe("host-owned preview rendering", () => {
  it("uses the host renderer without resolving or painting duplicate local media", async () => {
    const calls: number[] = [];
    const beforeResolve = vi.mocked(resolveAssets).mock.calls.length;
    const beforePaint = vi.mocked(renderStill).mock.calls.length;
    const player = await createPlayer({
      scene: {
        ...testScene,
        assets: {
          clip: { id: "clip", type: "video", src: "blob:owned-only-by-worker" },
        },
      },
      context: fakeContext(),
      audio: false,
      renderFrame: async (frame) => {
        calls.push(frame);
      },
    });
    await player.seek(7);
    expect(calls).toEqual([0, 7]);
    expect(player.currentFrame).toBe(7);
    expect(vi.mocked(resolveAssets).mock.calls.length).toBe(beforeResolve);
    expect(vi.mocked(renderStill).mock.calls.length).toBe(beforePaint);
    await player.disposeAsync();
  });
  it("requires explicit audio ownership instead of silently dropping sound", async () => {
    await expect(
      createPlayer({
        scene: testScene,
        context: fakeContext(),
        renderFrame: async () => {},
      }),
    ).rejects.toThrow("audio:false");
  });
  it("aborts host work and does not publish a late frame after disposal", async () => {
    let release!: () => void;
    let activeSignal: AbortSignal | undefined;
    const player = await createPlayer({
      scene: testScene,
      context: fakeContext(),
      audio: false,
      renderFrame: async (frame, signal) => {
        if (frame === 5) {
          activeSignal = signal;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
      },
    });
    const frames: number[] = [];
    player.on("frame", (frame) => frames.push(frame));
    const seek = player.seek(5);
    await vi.waitFor(() => expect(activeSignal).toBeDefined());
    await player.disposeAsync();
    expect(activeSignal!.aborted).toBe(true);
    release();
    await seek;
    expect(frames).toEqual([]);
    expect(player.currentFrame).toBe(0);
  });
});
