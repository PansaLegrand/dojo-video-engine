import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Canvas2DStaticDisplayCache,
  ScratchSurfacePool,
  compileCanvas2DDisplayList,
} from "@dojo-video-engine/renderer-canvas2d";
import type { Scene } from "@dojo-video-engine/schema";
import { renderFrameSequence } from "./index.js";

class TestCanvas {
  readonly context = { reset: vi.fn(), clearRect: vi.fn() };

  constructor(
    public width: number,
    public height: number,
  ) {}

  getContext() {
    return this.context;
  }
}

const scene: Scene = {
  schemaVersion: 1,
  width: 320,
  height: 180,
  fps: 30,
  duration: 3,
  assets: {},
  nodes: [{ id: "plate", type: "div", style: { width: 32, height: 32 } }],
};
const context = {} as CanvasRenderingContext2D;
const bounds = { x: 0, y: 0, width: 32, height: 32 };

function retainStaticRaster(
  scratch: ScratchSurfacePool,
  cache: Canvas2DStaticDisplayCache,
) {
  const group = compileCanvas2DDisplayList(context, scene, 0).groups[0]!;
  const lease = scratch.acquire({ ...bounds, purpose: "static isolation" });
  const detached = lease.detach()!;
  expect(cache.adopt(group, bounds, detached)).toBe(true);
  return { group, surface: detached.surface };
}

describe("export frame resource ownership", () => {
  beforeEach(() => vi.stubGlobal("OffscreenCanvas", TestCanvas));
  afterEach(() => vi.unstubAllGlobals());

  it("reuses real scratch surfaces and static rasters until the last encode settles", async () => {
    let scratch: ScratchSurfacePool | undefined;
    let cache: Canvas2DStaticDisplayCache | undefined;
    let retained: ReturnType<typeof retainStaticRaster> | undefined;
    const surfaces: Array<HTMLCanvasElement | OffscreenCanvas> = [];
    let finishEncoding = () => {};
    const encoding = new Promise<void>((resolve) => {
      finishEncoding = resolve;
    });
    let finalFrameReached = false;

    const rendering = renderFrameSequence({
      scene,
      context,
      renderFrame: (
        _context,
        _scene,
        frame,
        _resolved,
        _text,
        pool,
        staticCache,
      ) => {
        scratch ??= pool;
        cache ??= staticCache;
        expect(pool).toBe(scratch);
        expect(staticCache).toBe(cache);
        const lease = pool!.acquire({ ...bounds, purpose: "mask" });
        surfaces.push(lease.surface);
        lease.release();
        if (frame === 0) retained = retainStaticRaster(pool!, staticCache!);
        else
          expect(staticCache!.get(retained!.group, bounds)).toBe(
            retained!.surface,
          );
      },
      onFrame: ({ frame }) => {
        if (frame === scene.duration - 1) {
          finalFrameReached = true;
          return encoding;
        }
      },
    });
    await vi.waitFor(() => expect(finalFrameReached).toBe(true));
    expect(scratch!.stats()).toMatchObject({
      disposed: false,
      allocations: 2,
      reuses: 2,
    });
    expect(cache!.stats()).toMatchObject({
      disposed: false,
      entries: 1,
      hits: 2,
    });
    expect(surfaces[1]).toBe(surfaces[2]);
    finishEncoding();
    await expect(rendering).resolves.toMatchObject({ renderedFrames: 3 });
    expect(scratch!.stats()).toMatchObject({
      disposed: true,
      allocatedBytes: 0,
      surfaceCount: 0,
    });
    expect(cache!.stats()).toMatchObject({
      disposed: true,
      entries: 0,
      bytes: 0,
    });
    expect(retained!.surface).toMatchObject({ width: 1, height: 1 });
    expect(surfaces[2]).toMatchObject({ width: 1, height: 1 });
  });

  it.each(["drawing", "encoding", "cancellation"] as const)(
    "releases owned resources after %s failure",
    async (failurePoint) => {
      const controller = new AbortController();
      const failure = new Error(`${failurePoint} failed`);
      let scratch: ScratchSurfacePool | undefined;
      let cache: Canvas2DStaticDisplayCache | undefined;
      let retained: ReturnType<typeof retainStaticRaster> | undefined;
      const rendering = renderFrameSequence({
        scene,
        context,
        signal: controller.signal,
        renderFrame: (
          _context,
          _scene,
          _frame,
          _resolved,
          _text,
          pool,
          staticCache,
        ) => {
          scratch = pool;
          cache = staticCache;
          retained = retainStaticRaster(pool!, staticCache!);
          if (failurePoint === "drawing") throw failure;
        },
        onFrame: async () => {
          if (failurePoint === "encoding") throw failure;
          if (failurePoint === "cancellation") controller.abort(failure);
        },
      });
      await expect(rendering).rejects.toBe(failure);
      expect(scratch!.stats()).toMatchObject({
        disposed: true,
        allocatedBytes: 0,
      });
      expect(cache!.stats()).toMatchObject({ disposed: true, entries: 0 });
      expect(retained!.surface).toMatchObject({ width: 1, height: 1 });
    },
  );

  it.each(["success", "failure", "cancellation"] as const)(
    "preserves caller-owned resources on %s",
    async (outcome) => {
      const pool = new ScratchSurfacePool({
        createCanvas: (width, height) =>
          new TestCanvas(width, height) as unknown as OffscreenCanvas,
        maxBytes: 1024 * 1024,
        maxSurfaces: 4,
        maxDimension: 1024,
      });
      const cache = new Canvas2DStaticDisplayCache({
        maxBytes: 1024 * 1024,
        maxEntries: 4,
        maxKeyBytes: 64 * 1024,
      });
      const retained = retainStaticRaster(pool, cache);
      const controller = new AbortController();
      const failure = new Error("stop");
      try {
        const rendering = renderFrameSequence({
          scene,
          context,
          signal: controller.signal,
          scratchSurfacePool: pool,
          staticDisplayCache: cache,
          renderFrame: (
            _context,
            _scene,
            _frame,
            _resolved,
            _text,
            delegatedPool,
            delegatedCache,
          ) => {
            expect(delegatedPool).toBe(pool);
            expect(delegatedCache).toBe(cache);
            if (outcome === "failure") throw failure;
            if (outcome === "cancellation") controller.abort(failure);
          },
        });
        if (outcome === "success") await rendering;
        else await expect(rendering).rejects.toBe(failure);
        expect(pool.stats().disposed).toBe(false);
        expect(cache.stats().disposed).toBe(false);
        expect(cache.get(retained.group, bounds)).toBe(retained.surface);
        expect(retained.surface.width).toBe(64);
      } finally {
        cache.dispose();
        pool.dispose();
      }
    },
  );

  it.each(["scratch", "static"] as const)(
    "disposes only its owned resource when a caller supplies the %s resource",
    async (supplied) => {
      const pool = new ScratchSurfacePool({
        createCanvas: (width, height) =>
          new TestCanvas(width, height) as unknown as OffscreenCanvas,
        maxBytes: 1024 * 1024,
        maxSurfaces: 4,
        maxDimension: 1024,
      });
      const cache = new Canvas2DStaticDisplayCache({
        maxBytes: 1024 * 1024,
        maxEntries: 4,
        maxKeyBytes: 64 * 1024,
      });
      let delegatedPool: ScratchSurfacePool | undefined;
      let delegatedCache: Canvas2DStaticDisplayCache | undefined;
      try {
        await renderFrameSequence({
          scene,
          context,
          scratchSurfacePool: supplied === "scratch" ? pool : undefined,
          staticDisplayCache: supplied === "static" ? cache : undefined,
          renderFrame: (
            _context,
            _scene,
            _frame,
            _resolved,
            _text,
            scratch,
            staticCache,
          ) => {
            delegatedPool = scratch;
            delegatedCache = staticCache;
          },
        });
        expect(delegatedPool!.stats().disposed).toBe(supplied !== "scratch");
        expect(delegatedCache!.stats().disposed).toBe(supplied !== "static");
      } finally {
        cache.dispose();
        pool.dispose();
      }
    },
  );
});
