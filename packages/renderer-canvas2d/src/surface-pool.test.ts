import { describe, expect, it, vi } from "vitest";
import {
  SCRATCH_SURFACE_BUCKET_SIZE,
  ScratchSurfacePool,
  ScratchSurfacePoolError,
  checkedRgbaBytes,
  type Canvas2DSurface,
} from "./surface-pool.js";

class FakeSurface {
  readonly reset = vi.fn();
  readonly clearRect = vi.fn();
  readonly getContextCalls = vi.fn();
  readonly context = {
    reset: this.reset,
    clearRect: this.clearRect,
  };

  constructor(
    public width: number,
    public height: number,
    private readonly contextAvailable = true,
  ) {}

  getContext(kind: string) {
    this.getContextCalls(kind);
    return kind === "2d" && this.contextAvailable ? this.context : null;
  }
}

function asCanvas(surface: FakeSurface): Canvas2DSurface {
  return surface as unknown as OffscreenCanvas;
}

function createPool(
  options: Partial<{
    maxBytes: number;
    maxSurfaces: number;
    maxDimension: number;
    factory: (width: number, height: number) => FakeSurface;
  }> = {},
) {
  const surfaces: FakeSurface[] = [];
  const factory = vi.fn((width: number, height: number) => {
    const surface =
      options.factory?.(width, height) ?? new FakeSurface(width, height);
    surfaces.push(surface);
    return asCanvas(surface);
  });
  const pool = new ScratchSurfacePool({
    createCanvas: factory,
    maxBytes: options.maxBytes ?? 16 * 1024 * 1024,
    maxSurfaces: options.maxSurfaces ?? 16,
    maxDimension: options.maxDimension ?? 4_096,
  });
  return { pool, factory, surfaces };
}

describe("ScratchSurfacePool", () => {
  it("rounds requests into 64px buckets and exposes immutable lease bounds", () => {
    const { pool, factory } = createPool();
    const lease = pool.acquire({
      width: 64.01,
      height: 70,
      purpose: "isolation",
    });

    expect(SCRATCH_SURFACE_BUCKET_SIZE).toBe(64);
    expect(factory).toHaveBeenCalledWith(128, 128);
    expect(lease.requested).toEqual({ width: 65, height: 70 });
    expect(lease.bucket).toEqual({ width: 128, height: 128 });
    expect(Object.isFrozen(lease.requested)).toBe(true);
    expect(Object.isFrozen(lease.bucket)).toBe(true);
    expect(lease.purpose).toBe("isolation");
    lease.release();
  });

  it("reuses an exact idle bucket regardless of larger idle entries", () => {
    const { pool, surfaces } = createPool();
    const large = pool.acquire({ width: 65, height: 65, purpose: "large" });
    const small = pool.acquire({ width: 1, height: 1, purpose: "small" });
    large.release();
    small.release();

    const reused = pool.acquire({ width: 50, height: 50, purpose: "reuse" });
    expect(reused.surface).toBe(asCanvas(surfaces[1]!));
    expect(reused.bucket).toEqual({ width: 64, height: 64 });
    expect(pool.stats().reuses).toBe(1);
    reused.release();
  });

  it("allocates an exact bucket instead of reusing larger history-dependent shapes", () => {
    const { pool, surfaces } = createPool();
    const first = pool.acquire({ width: 64, height: 128, purpose: "first" });
    const second = pool.acquire({ width: 128, height: 64, purpose: "second" });
    first.release();
    second.release();

    const exact = pool.acquire({ width: 64, height: 64, purpose: "exact" });
    expect(exact.surface).toBe(asCanvas(surfaces[2]!));
    expect(exact.bucket).toEqual({ width: 64, height: 64 });
    expect(pool.stats()).toMatchObject({ allocations: 3, reuses: 0 });
    expect(surfaces[0]).toMatchObject({ width: 64, height: 128 });
    expect(surfaces[1]).toMatchObject({ width: 128, height: 64 });
    exact.release();
  });

  it("resets and clears normal releases before making them reusable", () => {
    const { pool, surfaces } = createPool();
    const lease = pool.acquire({ width: 80, height: 70, purpose: "mask" });
    lease.release();

    expect(surfaces[0]!.reset).toHaveBeenCalledTimes(1);
    expect(surfaces[0]!.clearRect).toHaveBeenCalledWith(0, 0, 128, 128);
    const reused = pool.acquire({ width: 80, height: 70, purpose: "mask-2" });
    expect(reused.surface).toBe(lease.surface);
    reused.release();
  });

  it("falls back to a width reset when context.reset is unavailable", () => {
    let widthAssignments = 0;
    const { pool, surfaces } = createPool({
      factory: (width, height) => {
        const surface = new FakeSurface(width, height);
        let currentWidth = width;
        Object.defineProperty(surface, "width", {
          get: () => currentWidth,
          set: (value: number) => {
            widthAssignments += 1;
            currentWidth = value;
          },
          configurable: true,
        });
        delete (surface.context as { reset?: unknown }).reset;
        return surface;
      },
    });
    const lease = pool.acquire({ width: 30, height: 30, purpose: "fallback" });
    const assignmentsAfterCreate = widthAssignments;
    lease.release();

    expect(widthAssignments).toBe(assignmentsAfterCreate + 1);
    expect(surfaces[0]!.clearRect).toHaveBeenCalledWith(0, 0, 64, 64);
  });

  it("evicts idle surfaces in LRU order but never evicts a leased surface", () => {
    const { pool, surfaces } = createPool({
      maxSurfaces: 2,
      maxBytes: 256 * 1024,
    });
    const first = pool.acquire({ width: 64, height: 64, purpose: "first" });
    const second = pool.acquire({ width: 64, height: 64, purpose: "second" });
    first.release();
    second.release();

    // Refresh the first entry, so the second entry becomes the oldest idle.
    const refreshed = pool.acquire({
      width: 64,
      height: 64,
      purpose: "refresh",
    });
    expect(refreshed.surface).toBe(first.surface);
    refreshed.release();

    const large = pool.acquire({ width: 129, height: 129, purpose: "large" });
    expect(large.bucket).toEqual({ width: 192, height: 192 });
    expect(surfaces[1]).toMatchObject({ width: 1, height: 1 });
    expect(surfaces[0]).toMatchObject({ width: 64, height: 64 });
    expect(pool.stats().evictions).toBe(1);

    expect(() =>
      pool.acquire({ width: 129, height: 129, purpose: "while-leased" }),
    ).toThrowError(
      expect.objectContaining({
        code: "budget_exceeded",
      }) as ScratchSurfacePoolError,
    );
    expect(large.surface).toMatchObject({ width: 192, height: 192 });
    large.release();
  });

  it("accounts checked RGBA bytes and rejects unsafe or over-limit requests", () => {
    expect(checkedRgbaBytes(128, 64)).toBe(32_768);
    expect(() => checkedRgbaBytes(2 ** 27, 2 ** 27)).toThrowError(
      expect.objectContaining({
        code: "invalid_request",
      }) as ScratchSurfacePoolError,
    );

    const { pool, factory } = createPool({
      maxBytes: checkedRgbaBytes(64, 64) - 1,
      maxDimension: 2 ** 27,
    });
    expect(() =>
      pool.acquire({ width: 1, height: 1, purpose: "over-budget" }),
    ).toThrowError(
      expect.objectContaining({
        code: "budget_exceeded",
      }) as ScratchSurfacePoolError,
    );
    expect(() =>
      pool.acquire({ width: 2 ** 27, height: 2 ** 27, purpose: "unsafe" }),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_request",
      }) as ScratchSurfacePoolError,
    );
    expect(factory).not.toHaveBeenCalled();
    expect(pool.stats().failures).toBe(2);
  });

  it("rejects invalid requests before calling the host factory", () => {
    const { pool, factory } = createPool({ maxDimension: 100 });
    for (const request of [
      { width: 0, height: 1, purpose: "zero" },
      { width: Number.NaN, height: 1, purpose: "nan" },
      { width: 101, height: 1, purpose: "large" },
      { width: 1, height: 1, purpose: "" },
    ]) {
      expect(() => pool.acquire(request)).toThrowError(
        expect.objectContaining({
          code: "invalid_request",
        }) as ScratchSurfacePoolError,
      );
    }
    expect(factory).not.toHaveBeenCalled();
    expect(pool.stats().failures).toBe(4);
  });

  it("destroys poisoned surfaces and makes release idempotent", () => {
    const { pool, surfaces } = createPool();
    const lease = pool.acquire({
      width: 100,
      height: 100,
      purpose: "extension",
    });
    lease.release({ poisoned: true });
    lease.release({ poisoned: true });

    expect(lease.released).toBe(true);
    expect(surfaces[0]).toMatchObject({ width: 1, height: 1 });
    expect(pool.stats()).toMatchObject({
      surfaceCount: 0,
      allocatedBytes: 0,
      poisonedReleases: 1,
    });
    const replacement = pool.acquire({
      width: 100,
      height: 100,
      purpose: "replacement",
    });
    expect(replacement.surface).not.toBe(lease.surface);
    replacement.release();
  });

  it("atomically detaches a live surface without shrinking or double accounting", () => {
    const { pool, surfaces } = createPool();
    const lease = pool.acquire({ width: 10, height: 8, purpose: "static" });
    const detached = lease.detach();

    expect(detached).toMatchObject({
      surface: lease.surface,
      context: lease.context,
      requested: { width: 10, height: 8 },
      bucket: { width: 64, height: 64 },
      bytes: checkedRgbaBytes(64, 64),
    });
    expect(lease.released).toBe(true);
    expect(lease.detach()).toBeUndefined();
    lease.release({ poisoned: true });
    expect(pool.stats()).toMatchObject({
      surfaceCount: 0,
      leasedSurfaceCount: 0,
      allocatedBytes: 0,
      leasedBytes: 0,
      detaches: 1,
      poisonedReleases: 0,
    });
    expect(surfaces[0]).toMatchObject({ width: 64, height: 64 });
    pool.dispose();
    expect(surfaces[0]).toMatchObject({ width: 64, height: 64 });
  });

  it("cannot detach a released or pool-disposed lease", () => {
    const released = createPool();
    const releasedLease = released.pool.acquire({
      width: 1,
      height: 1,
      purpose: "released",
    });
    releasedLease.release();
    expect(releasedLease.detach()).toBeUndefined();

    const disposed = createPool();
    const disposedLease = disposed.pool.acquire({
      width: 1,
      height: 1,
      purpose: "disposed",
    });
    disposed.pool.dispose();
    expect(disposedLease.detach()).toBeUndefined();
    expect(disposedLease.released).toBe(true);
    expect(disposed.surfaces[0]).toMatchObject({ width: 1, height: 1 });
  });

  it("drops a surface whose reset fails instead of reusing poisoned state", () => {
    const { pool, surfaces } = createPool();
    const lease = pool.acquire({ width: 64, height: 64, purpose: "broken" });
    surfaces[0]!.reset.mockImplementation(() => {
      throw new Error("reset failed");
    });
    Object.defineProperty(surfaces[0]!, "width", {
      get: () => 64,
      set: () => {
        throw new Error("width reset failed");
      },
      configurable: true,
    });
    lease.release();

    expect(pool.stats()).toMatchObject({
      surfaceCount: 0,
      failures: 1,
    });
  });

  it("normalizes host factory and context failures into counted errors", () => {
    const throwing = createPool({
      factory: () => {
        throw new Error("factory exploded");
      },
    });
    expect(() =>
      throwing.pool.acquire({ width: 1, height: 1, purpose: "factory" }),
    ).toThrowError(
      expect.objectContaining({
        code: "factory_failed",
      }) as ScratchSurfacePoolError,
    );
    expect(throwing.pool.stats().failures).toBe(1);

    const rejectedSurface = new FakeSurface(32, 32);
    Object.defineProperty(rejectedSurface, "height", {
      get: () => 32,
      set: () => {
        throw new Error("height rejected");
      },
      configurable: true,
    });
    const rejectedSize = createPool({ factory: () => rejectedSurface });
    expect(() =>
      rejectedSize.pool.acquire({ width: 1, height: 1, purpose: "size" }),
    ).toThrowError(
      expect.objectContaining({
        code: "factory_failed",
      }) as ScratchSurfacePoolError,
    );
    expect(rejectedSurface.width).toBe(1);
    expect(rejectedSize.pool.stats().failures).toBe(1);

    const missing = createPool({
      factory: (width, height) => new FakeSurface(width, height, false),
    });
    expect(() =>
      missing.pool.acquire({ width: 1, height: 1, purpose: "context" }),
    ).toThrowError(
      expect.objectContaining({
        code: "context_unavailable",
      }) as ScratchSurfacePoolError,
    );
    expect(missing.surfaces[0]).toMatchObject({ width: 1, height: 1 });
    expect(missing.pool.stats().failures).toBe(1);
  });

  it("reports live and peak accounting and disposes leased and idle surfaces", async () => {
    const { pool, surfaces } = createPool();
    const small = pool.acquire({ width: 1, height: 1, purpose: "small" });
    const large = pool.acquire({ width: 65, height: 65, purpose: "large" });
    expect(pool.stats()).toMatchObject({
      surfaceCount: 2,
      leasedSurfaceCount: 2,
      allocatedBytes: checkedRgbaBytes(64, 64) + checkedRgbaBytes(128, 128),
      leasedBytes: checkedRgbaBytes(64, 64) + checkedRgbaBytes(128, 128),
      peakAllocatedBytes: checkedRgbaBytes(64, 64) + checkedRgbaBytes(128, 128),
      peakLeasedBytes: checkedRgbaBytes(64, 64) + checkedRgbaBytes(128, 128),
      allocations: 2,
    });

    small.release();
    expect(pool.stats()).toMatchObject({
      idleSurfaceCount: 1,
      leasedSurfaceCount: 1,
      idleBytes: checkedRgbaBytes(64, 64),
      leasedBytes: checkedRgbaBytes(128, 128),
    });

    await pool.disposeAsync();
    await pool.disposeAsync();
    expect(surfaces).toEqual([
      expect.objectContaining({ width: 1, height: 1 }),
      expect.objectContaining({ width: 1, height: 1 }),
    ]);
    expect(pool.stats()).toMatchObject({
      disposed: true,
      surfaceCount: 0,
      allocatedBytes: 0,
      leasedBytes: 0,
      peakAllocatedBytes: checkedRgbaBytes(64, 64) + checkedRgbaBytes(128, 128),
    });
    large.release();
    expect(() =>
      pool.acquire({ width: 1, height: 1, purpose: "after-dispose" }),
    ).toThrowError(
      expect.objectContaining({ code: "disposed" }) as ScratchSurfacePoolError,
    );
    expect(pool.stats().failures).toBe(1);
  });

  it("caps the final bucket at a non-multiple maxDimension", () => {
    const { pool, factory } = createPool({ maxDimension: 100 });
    const lease = pool.acquire({ width: 90, height: 99, purpose: "capped" });
    expect(factory).toHaveBeenCalledWith(100, 100);
    expect(lease.bucket).toEqual({ width: 100, height: 100 });
    lease.release();
  });
});

describe("ScratchSurfacePool options", () => {
  it("rejects unsafe or negative limits", () => {
    const factory = () => asCanvas(new FakeSurface(1, 1));
    for (const options of [
      { maxBytes: -1, maxSurfaces: 1, maxDimension: 1 },
      { maxBytes: 1, maxSurfaces: -1, maxDimension: 1 },
      { maxBytes: 1, maxSurfaces: 1, maxDimension: 0 },
      { maxBytes: Number.MAX_VALUE, maxSurfaces: 1, maxDimension: 1 },
    ]) {
      expect(
        () => new ScratchSurfacePool({ createCanvas: factory, ...options }),
      ).toThrowError(
        expect.objectContaining({
          code: "invalid_options",
        }) as ScratchSurfacePoolError,
      );
    }
  });
});
