import { describe, expect, it, vi } from "vitest";
import { resolveMediaMetrics } from "@motionforge/core";
import {
  createExtensionRegistry,
  defineExtension,
} from "@motionforge/extensions";
import { createSceneRuntime } from "@motionforge/runtime";
import { parseScene } from "@motionforge/schema";
import { z } from "zod";
import {
  createCanvas2DRuntimeBackend,
  createCanvas2DSceneRuntime,
  createResolvedMediaMetricsProvider,
  withCanvas2DResolvedAssets,
} from "./runtime.js";
import type { ResolvedAssets } from "./index.js";
import {
  Canvas2DStaticDisplayCache,
  createCanvas2DOpaqueExtensionRegistry,
  createCanvasTextMetricsProvider,
} from "./index.js";
import { ScratchSurfacePool } from "./surface-pool.js";

type Call = { name: string; args: unknown[] };

function contextCalls(widthFactor = 10): {
  context: OffscreenCanvasRenderingContext2D;
  calls: Call[];
} {
  const calls: Call[] = [];
  const stateStack: Array<Record<string, unknown>> = [];
  const target: Record<string, unknown> = {
    canvas: { width: 320, height: 180 },
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    filter: "none",
    shadowBlur: 0,
    shadowColor: "rgba(0, 0, 0, 0)",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    save: () => {
      calls.push({ name: "save", args: [] });
      stateStack.push({
        globalAlpha: target.globalAlpha,
        globalCompositeOperation: target.globalCompositeOperation,
        filter: target.filter,
        shadowBlur: target.shadowBlur,
        shadowColor: target.shadowColor,
        shadowOffsetX: target.shadowOffsetX,
        shadowOffsetY: target.shadowOffsetY,
      });
    },
    restore: () => {
      calls.push({ name: "restore", args: [] });
      Object.assign(target, stateStack.pop() ?? {});
    },
    measureText: (text: string) => {
      calls.push({ name: "measureText", args: [text] });
      return {
        width: text.length * widthFactor,
        actualBoundingBoxAscent: 8,
        actualBoundingBoxDescent: 2,
      };
    },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createConicGradient: () => ({ addColorStop() {} }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
      colorSpace: "srgb",
    }),
    putImageData: (...args: unknown[]) => {
      calls.push({ name: "putImageData", args });
    },
  };
  const context = new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property as string];
      return (...args: unknown[]) => {
        calls.push({ name: String(property), args });
      };
    },
    set(object, property, value) {
      object[property as string] = value;
      calls.push({ name: `set:${String(property)}`, args: [value] });
      return true;
    },
  }) as unknown as OffscreenCanvasRenderingContext2D;
  return { context, calls };
}

class FakeOffscreenCanvas {
  readonly log = contextCalls();
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext(): OffscreenCanvasRenderingContext2D {
    return this.log.context;
  }
  async convertToBlob(options: { type?: string }): Promise<Blob> {
    return new Blob([new Uint8Array([9, 8, 7])], {
      type: options.type ?? "image/png",
    });
  }
}

const testScene = (text = "Hello") => ({
  schemaVersion: 1,
  width: 320,
  height: 180,
  fps: 30,
  duration: 30,
  assets: {},
  nodes: [
    {
      id: "title",
      type: "text",
      text,
      style: { width: 320, height: 180, fontSize: 24 },
    },
  ],
});

const isolatedScene = (duration = 30) => ({
  ...testScene(),
  duration,
  nodes: [
    {
      id: "isolated",
      type: "div",
      style: {
        width: 160,
        height: 90,
        isolation: true,
        backgroundColor: "#123456",
      },
    },
  ],
});

function createHostScratchPool(): ScratchSurfacePool {
  return new ScratchSurfacePool({
    createCanvas: (width, height) =>
      new FakeOffscreenCanvas(width, height) as unknown as OffscreenCanvas,
    maxBytes: 64 * 1024 * 1024,
    maxSurfaces: 8,
    maxDimension: 320,
  });
}

function memorySink() {
  const chunks: number[][] = [];
  return {
    chunks,
    sink: {
      begin: async () => ({
        write: async (chunk: Uint8Array) => {
          chunks.push([...chunk]);
        },
        commit: async () => ({ uri: "memory://canvas" }),
        abort: async () => {},
      }),
    },
  };
}

function blobDeferred() {
  let resolve!: (blob: Blob) => void;
  const promise = new Promise<Blob>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("Canvas2D prepared runtime backend", () => {
  it("fails preflight when a canvas element cannot provide a 2D context", async () => {
    const backend = createCanvas2DRuntimeBackend({
      globalObject: {
        document: {
          createElement: () => ({ getContext: () => null }),
        } as unknown as Document,
      },
    });
    await expect(
      createSceneRuntime({ scene: testScene(), backend }),
    ).rejects.toMatchObject({ code: "preflight_failed" });
  });

  it("forwards an exact opaque registry through runtime preflight and render", async () => {
    const draw = vi.fn();
    const definition = defineExtension({
      name: "com.example.runtime-opaque",
      version: "1.0.0",
      paramsSchema: z.object({ value: z.number() }),
      deterministic: true,
      workerCompatible: true,
      display: {
        kind: "opaque",
        capability: {
          id: "com.example.runtime-opaque.canvas",
          version: "1.0.0",
          realms: ["main"],
        },
        payloadSchema: z.object({ value: z.number() }),
        compile: ({ params }) => ({ value: params.value }),
      },
    });
    const opaqueExtensionRegistry = createCanvas2DOpaqueExtensionRegistry({
      realm: "main",
      handlers: [
        {
          capability: {
            id: "com.example.runtime-opaque.canvas",
            version: "1.0.0",
            realms: ["main"],
          },
          draw,
        },
      ],
    });
    const runtime = await createCanvas2DSceneRuntime({
      scene: {
        schemaVersion: 1,
        width: 32,
        height: 32,
        fps: 30,
        duration: 2,
        assets: {},
        nodes: [
          {
            id: "opaque",
            type: "extension",
            extension: {
              name: definition.name,
              version: definition.version,
              params: { value: 1 },
            },
          },
        ],
      },
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
      resolve: {
        extensions: createExtensionRegistry([definition]),
        opaqueExtensionRegistry,
      },
    });
    await runtime.renderFrame(0, contextCalls().context);
    expect(draw).toHaveBeenCalledOnce();
    await runtime.disposeAsync();
  });

  it("accepts a headless render factory without DOM or OffscreenCanvas globals", async () => {
    const runtime = await createCanvas2DSceneRuntime({
      scene: testScene(),
      globalObject: {},
      createRenderCanvas: (width, height) =>
        new FakeOffscreenCanvas(width, height) as unknown as OffscreenCanvas,
      createArtifactCanvas: (width, height) =>
        new FakeOffscreenCanvas(width, height) as unknown as OffscreenCanvas,
    });
    await runtime.renderFrame(0, contextCalls().context);
    await runtime.disposeAsync();
  });

  it("does not advertise frame artifacts when a headless host only supplies rendering", async () => {
    const runtime = await createCanvas2DSceneRuntime({
      scene: testScene(),
      globalObject: {},
      createRenderCanvas: (width, height) =>
        new FakeOffscreenCanvas(width, height) as unknown as OffscreenCanvas,
    });
    expect(runtime.capabilities.frameImageMimeTypes).toEqual([]);
    await expect(
      runtime.writeFrameArtifact(0, memorySink().sink),
    ).rejects.toMatchObject({ code: "artifact_unsupported" });
    await runtime.disposeAsync();
  });

  it("renders, updates, captures an artifact, and disposes through legacy primitives", async () => {
    const artifactCanvases: FakeOffscreenCanvas[] = [];
    const backend = createCanvas2DRuntimeBackend({
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
      createArtifactCanvas: (width, height) => {
        const canvas = new FakeOffscreenCanvas(width, height);
        artifactCanvases.push(canvas);
        return canvas as unknown as OffscreenCanvas;
      },
    });
    const runtime = await createSceneRuntime({
      scene: testScene(),
      backend,
      sessionId: "canvas-runtime",
    });
    const target = contextCalls();
    await runtime.renderFrame(0, target.context);
    expect(target.calls.some((call) => call.name === "drawImage")).toBe(true);

    await runtime.updateScene(testScene("Updated"), { expectedRevision: 0 });
    expect(runtime.revision).toBe(1);
    await runtime.renderFrame(1, target.context);

    const memory = memorySink();
    const artifact = await runtime.writeFrameArtifact(1, memory.sink);
    expect(memory.chunks).toEqual([[9, 8, 7]]);
    expect(artifact).toMatchObject({
      descriptor: { mimeType: "image/png", byteLength: 3 },
      receipt: { uri: "memory://canvas" },
    });
    expect(artifactCanvases).toHaveLength(1);
    expect(
      artifactCanvases[0]?.log.calls.some(
        (call) => call.name === "measureText",
      ),
    ).toBe(true);
    await runtime.disposeAsync();
  });

  it("renders through an owned surface instead of target-dependent text metrics", async () => {
    const backend = createCanvas2DRuntimeBackend({
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
    });
    const runtime = await createSceneRuntime({ scene: testScene(), backend });
    const narrow = contextCalls(10);
    const wide = contextCalls(20);
    await runtime.renderFrame(0, narrow.context);
    await runtime.renderFrame(0, wide.context);
    expect(
      narrow.calls.filter((call) => call.name === "measureText").length,
    ).toBe(0);
    expect(
      wide.calls.filter((call) => call.name === "measureText").length,
    ).toBe(0);
    expect(narrow.calls.some((call) => call.name === "drawImage")).toBe(true);
    expect(wide.calls.some((call) => call.name === "drawImage")).toBe(true);
    await runtime.disposeAsync();
  });

  it("replaces transparent target pixels with neutral compositing and restores caller state", async () => {
    const runtime = await createCanvas2DSceneRuntime({
      scene: { ...testScene(), nodes: [] },
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
    });
    const target = contextCalls();
    target.context.globalAlpha = 0.25;
    target.context.globalCompositeOperation = "multiply";
    target.context.filter = "blur(4px)";
    target.context.shadowBlur = 12;
    target.calls.length = 0;

    await runtime.renderFrame(0, target.context);

    const clearIndex = target.calls.findIndex(
      (call) => call.name === "clearRect",
    );
    const drawIndex = target.calls.findIndex(
      (call) => call.name === "drawImage",
    );
    expect(clearIndex).toBeGreaterThanOrEqual(0);
    expect(drawIndex).toBeGreaterThan(clearIndex);
    expect(target.calls).toEqual(
      expect.arrayContaining([
        { name: "set:globalAlpha", args: [1] },
        { name: "set:globalCompositeOperation", args: ["source-over"] },
        { name: "set:filter", args: ["none"] },
        { name: "set:shadowBlur", args: [0] },
      ]),
    );
    expect(target.context.globalAlpha).toBe(0.25);
    expect(target.context.globalCompositeOperation).toBe("multiply");
    expect(target.context.filter).toBe("blur(4px)");
    expect(target.context.shadowBlur).toBe(12);
    await runtime.disposeAsync();
  });

  it("assembles a borrowed-assets compatibility facade", async () => {
    const runtime = await createCanvas2DSceneRuntime({
      scene: testScene(),
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
    });
    await expect(
      withCanvas2DResolvedAssets(runtime, ({ assets }) => assets.images.size),
    ).resolves.toBe(0);
    await runtime.disposeAsync();
    expect(() => withCanvas2DResolvedAssets(runtime, async () => 0)).toThrow(
      /Runtime session is disposed/,
    );
  });

  it("allows bounded scratch staging beyond the composition dimensions", async () => {
    const runtime = await createCanvas2DSceneRuntime({
      scene: testScene(),
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
    });
    await withCanvas2DResolvedAssets(runtime, ({ scratchSurfacePool }) => {
      const lease = scratchSurfacePool.acquire({
        width: 640,
        height: 256,
        purpose: "large-shadow-regression",
      });
      expect(lease.requested).toEqual({ width: 640, height: 256 });
      lease.release();
    });
    await runtime.disposeAsync();
  });

  it("reuses revision-owned scratch and disposes each replaced pool exactly once", async () => {
    const runtime = await createCanvas2DSceneRuntime({
      scene: isolatedScene(),
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
      staticDisplayCachePolicy: { maxEntries: 0 },
    });
    let first!: ScratchSurfacePool;
    await withCanvas2DResolvedAssets(runtime, ({ scratchSurfacePool }) => {
      first = scratchSurfacePool;
    });

    await runtime.renderFrame(0, contextCalls().context);
    await runtime.renderFrame(1, contextCalls().context);
    await runtime.writeFrameArtifact(2, memorySink().sink);
    expect(first.stats()).toMatchObject({
      disposed: false,
      allocations: 1,
      reuses: 2,
      idleSurfaceCount: 1,
    });

    await runtime.updateScene(isolatedScene(31));
    expect(first.stats().disposed).toBe(true);
    let second!: ScratchSurfacePool;
    await withCanvas2DResolvedAssets(runtime, ({ scratchSurfacePool }) => {
      second = scratchSurfacePool;
    });
    expect(second).not.toBe(first);
    expect(second.stats().disposed).toBe(false);

    await runtime.disposeAsync();
    await runtime.disposeAsync();
    expect(second.stats().disposed).toBe(true);
  });

  it("never disposes an explicitly host-owned scratch pool", async () => {
    const scratchSurfacePool = createHostScratchPool();
    const runtime = await createCanvas2DSceneRuntime({
      scene: isolatedScene(),
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
      scratchSurfacePool,
      staticDisplayCachePolicy: { maxEntries: 0 },
    });
    await runtime.renderFrame(0, contextCalls().context);
    await runtime.updateScene(isolatedScene(31));
    await runtime.renderFrame(1, contextCalls().context);
    await runtime.disposeAsync();

    expect(scratchSurfacePool.stats()).toMatchObject({
      disposed: false,
      allocations: 1,
      reuses: 1,
    });
    scratchSurfacePool.dispose();
  });

  it("transfers an owned static cache across commits and disposes only the final owner", async () => {
    const runtime = await createCanvas2DSceneRuntime({
      scene: isolatedScene(),
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
    });
    let cache!: Canvas2DStaticDisplayCache;
    await withCanvas2DResolvedAssets(runtime, ({ staticDisplayCache }) => {
      cache = staticDisplayCache;
    });
    await runtime.renderFrame(0, contextCalls().context);
    await runtime.renderFrame(1, contextCalls().context);
    expect(cache.stats()).toMatchObject({
      entries: 1,
      hits: 1,
      disposed: false,
    });

    await runtime.updateScene(isolatedScene(31));
    await withCanvas2DResolvedAssets(runtime, ({ staticDisplayCache }) => {
      expect(staticDisplayCache).toBe(cache);
    });
    expect(cache.stats().disposed).toBe(false);
    await runtime.renderFrame(2, contextCalls().context);
    expect(cache.stats().hits).toBeGreaterThanOrEqual(2);
    await runtime.disposeAsync();
    expect(cache.stats().disposed).toBe(true);
  });

  it("never disposes an explicitly host-owned static cache", async () => {
    const staticDisplayCache = new Canvas2DStaticDisplayCache({
      maxBytes: 4 * 1024 * 1024,
      maxEntries: 8,
      maxKeyBytes: 128 * 1024,
    });
    const runtime = await createCanvas2DSceneRuntime({
      scene: isolatedScene(),
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
      staticDisplayCache,
    });
    await runtime.renderFrame(0, contextCalls().context);
    await runtime.updateScene(isolatedScene(31));
    await runtime.disposeAsync();
    expect(staticDisplayCache.stats()).toMatchObject({
      disposed: false,
      entries: 1,
    });
    staticDisplayCache.dispose();
  });

  it("enforces an owned scratch policy without leaking the failed pool", async () => {
    const runtime = await createCanvas2DSceneRuntime({
      scene: isolatedScene(),
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
      scratchSurfacePoolPolicy: { maxBytes: 0 },
    });
    let pool!: ScratchSurfacePool;
    await withCanvas2DResolvedAssets(runtime, ({ scratchSurfacePool }) => {
      pool = scratchSurfacePool;
    });

    await expect(
      runtime.renderFrame(0, contextCalls().context),
    ).rejects.toMatchObject({ phase: "frame-render" });
    expect(pool.stats()).toMatchObject({ disposed: false, failures: 1 });
    await runtime.disposeAsync();
    expect(pool.stats().disposed).toBe(true);
  });

  it("disposes provisional owned scratch on rollback and keeps the current pool", async () => {
    const dispose = vi.spyOn(ScratchSurfacePool.prototype, "disposeAsync");
    const backend = createCanvas2DRuntimeBackend({
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
    });
    const operation = {
      signal: new AbortController().signal,
      sessionId: "scratch-rollback",
      operationId: "prepare",
      revision: 0,
      generation: 0,
      emitProgress: () => undefined,
    };
    const before = parseScene(testScene());
    const current = await backend.prepare(before, operation);
    const transaction = await backend.prepareUpdate!(
      current,
      before,
      { ...before, duration: 31 },
      operation,
    );
    await transaction.rollback();
    await transaction.rollback();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(current.scratchSurfacePool.stats().disposed).toBe(false);

    await backend.dispose(current);
    await backend.dispose(current);
    expect(dispose).toHaveBeenCalledTimes(2);
    dispose.mockRestore();
  });

  it("disposes a candidate pool when state construction fails", async () => {
    const dispose = vi.spyOn(ScratchSurfacePool.prototype, "disposeAsync");
    const runtime = await createCanvas2DSceneRuntime({
      scene: testScene(),
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
      textMetricsFactory: ({ scene }) => {
        if (scene.duration === 31) throw new Error("metrics unavailable");
        return createCanvasTextMetricsProvider(contextCalls().context);
      },
    });
    let current!: ScratchSurfacePool;
    await withCanvas2DResolvedAssets(runtime, ({ scratchSurfacePool }) => {
      current = scratchSurfacePool;
    });

    await expect(
      runtime.updateScene({ ...testScene(), duration: 31 }),
    ).rejects.toThrow("metrics unavailable");
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(current.stats().disposed).toBe(false);
    await runtime.disposeAsync();
    expect(dispose).toHaveBeenCalledTimes(2);
    dispose.mockRestore();
  });

  it("reports reused extension resources and their required assets on update", async () => {
    const close = vi.fn();
    const createImageBitmap = vi.fn(async () => ({
      width: 4,
      height: 4,
      close,
    }));
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    try {
      const registry = createExtensionRegistry([
        defineExtension({
          name: "com.example.runtime-reuse",
          version: "1.0.0",
          paramsSchema: z.object({ assetId: z.string() }),
          deterministic: true,
          workerCompatible: true,
          renderers: { canvas2d: { draw: () => undefined } },
          assets: ({ params }) => [
            { assetId: params.assetId, type: "image" as const },
          ],
          reuseKey: () => "stable-v1",
          reuseSafety: "immutable",
          resolveAssets: () => ({ prepared: true }),
        }),
      ]);
      const before = {
        schemaVersion: 1,
        width: 320,
        height: 180,
        fps: 30,
        duration: 30,
        assets: {
          texture: {
            id: "texture",
            type: "image",
            src: "data:image/png;base64,AA==",
          },
        },
        nodes: [
          {
            id: "brand-grid",
            type: "extension",
            extension: {
              name: "com.example.runtime-reuse",
              version: "1.0.0",
              params: { assetId: "texture" },
            },
          },
        ],
      };
      const runtime = await createCanvas2DSceneRuntime({
        scene: before,
        globalObject: {
          OffscreenCanvas:
            FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
          createImageBitmap:
            createImageBitmap as unknown as typeof globalThis.createImageBitmap,
        },
        resolve: { extensions: registry },
      });
      const result = await runtime.updateScene({
        ...before,
        duration: 31,
      });
      expect(result.summary).toMatchObject({
        reused: ["extension-node:brand-grid", "texture"],
        loaded: [],
        replaced: [],
        removed: [],
      });
      expect(createImageBitmap).toHaveBeenCalledOnce();
      await runtime.disposeAsync();
      expect(close).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects Canvas prepared tokens superseded by newer or legacy staging", async () => {
    const runtime = await createCanvas2DSceneRuntime({
      scene: testScene(),
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
    });
    const first = await runtime.prepareFrame(0);
    await runtime.prepareFrame(1);
    await expect(
      runtime.renderPrepared(first, contextCalls().context),
    ).rejects.toMatchObject({
      code: "stale_operation",
      phase: "frame-render",
    });
    const latest = await runtime.prepareFrame(2);
    await withCanvas2DResolvedAssets(runtime, async () => {});
    await expect(
      runtime.renderPrepared(latest, contextCalls().context),
    ).rejects.toMatchObject({ code: "stale_operation" });
    await runtime.disposeAsync();
  });

  it("merges exact prepared dimensions with declared duration/frame rate", () => {
    const assets: ResolvedAssets = {
      images: new Map([["image", { width: 640, height: 360 } as ImageBitmap]]),
      fonts: new Map(),
      videos: new Map(),
      videoFrames: new Map(),
      audio: new Map(),
      lotties: new Map(),
      lottieFrames: new Map(),
      resolvedSources: new Map([
        [
          "image",
          {
            assetId: "image",
            declaredSource: "proxy.png",
            resolvedSource: "proxy.png",
            contentKey: "image-v1",
            usingProxy: true,
            sourceKind: "declared-proxy",
            declarationKey: "image-v1",
          },
        ],
      ]),
    };
    const asset = {
      id: "image",
      type: "image" as const,
      src: "original.png",
      metadata: {
        duration: 4,
        frameRate: { numerator: 30_000, denominator: 1_001 },
      },
    };
    const resolved = resolveMediaMetrics(
      asset,
      createResolvedMediaMetricsProvider(assets),
    );
    expect(resolved).toMatchObject({
      width: 640,
      height: 360,
      durationSeconds: 4,
      frameRate: { numerator: 30_000, denominator: 1_001 },
      fieldMeasurements: {
        width: { measurement: "exact", reason: expect.stringMatching(/proxy/) },
        height: {
          measurement: "exact",
          reason: expect.stringMatching(/proxy/),
        },
        durationSeconds: { measurement: "declared" },
        frameRate: { measurement: "declared" },
      },
    });
  });

  it("provides bounded exact Canvas text metrics without leaking context state", () => {
    const canvas = contextCalls();
    canvas.context.font = "italic 400 11px serif";
    canvas.context.direction = "rtl";
    canvas.context.textBaseline = "bottom";
    canvas.context.letterSpacing = "3px";
    canvas.context.measureText = function (
      this: OffscreenCanvasRenderingContext2D,
      text: string,
    ) {
      return {
        width: text.length * 10,
        actualBoundingBoxAscent: this.textBaseline === "middle" ? 8 : 12,
        // A caller-selected bottom baseline can legitimately report a
        // negative descent. The provider must canonicalize before validating.
        actualBoundingBoxDescent: this.textBaseline === "middle" ? 2 : -1,
      } as TextMetrics;
    };
    const provider = createCanvasTextMetricsProvider(canvas.context, {
      maxEntries: 2,
      generationKey: "font-revision-7",
    });
    const metrics = provider.measureLine({
      nodeId: "title",
      text: "abcd",
      style: { fontFamily: "Test Sans", letterSpacing: 2 },
      fontSize: 20,
    });
    expect(metrics).toMatchObject({
      width: 40,
      ascent: 8,
      descent: 2,
      fieldMeasurements: {
        width: {
          measurement: "exact",
          reason: expect.stringMatching(/font-revision-7/),
        },
      },
    });
    expect(canvas.context.font).toBe("italic 400 11px serif");
    expect(canvas.context.direction).toBe("rtl");
    expect(canvas.context.textBaseline).toBe("bottom");
    expect(canvas.context.letterSpacing).toBe("3px");
  });

  it("reports null-blob encoding as a stable runtime error", async () => {
    const nullCanvas = {
      width: 320,
      height: 180,
      getContext: () => contextCalls().context,
      toBlob: (callback: (blob: Blob | null) => void) => callback(null),
    } as unknown as HTMLCanvasElement;
    const backend = createCanvas2DRuntimeBackend({
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
      createArtifactCanvas: () => nullCanvas,
    });
    const runtime = await createSceneRuntime({ scene: testScene(), backend });
    await expect(
      runtime.writeFrameArtifact(0, memorySink().sink),
    ).rejects.toMatchObject({ code: "artifact_encode_failed" });
    await runtime.disposeAsync();
  });

  it("releases the runtime queue when Canvas encoding is aborted", async () => {
    const gate = blobDeferred();
    let started = false;
    const delayedCanvas = {
      width: 320,
      height: 180,
      getContext: () => contextCalls().context,
      convertToBlob: () => {
        started = true;
        return gate.promise;
      },
    } as unknown as OffscreenCanvas;
    const backend = createCanvas2DRuntimeBackend({
      globalObject: {
        OffscreenCanvas:
          FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
      },
      createArtifactCanvas: () => delayedCanvas,
    });
    const runtime = await createSceneRuntime({
      scene: isolatedScene(),
      backend,
    });
    let scratch!: ScratchSurfacePool;
    await withCanvas2DResolvedAssets(runtime, ({ scratchSurfacePool }) => {
      scratch = scratchSurfacePool;
    });
    const artifact = runtime.writeFrameArtifact(0, memorySink().sink);
    for (let index = 0; index < 50 && !started; index += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    expect(started).toBe(true);
    const update = runtime.updateScene(testScene("updated"));
    await expect(artifact).rejects.toMatchObject({ code: "aborted" });
    await expect(update).resolves.toMatchObject({ revision: 1 });
    expect(scratch.stats().disposed).toBe(true);
    gate.resolve(new Blob([new Uint8Array([1])], { type: "image/png" }));
    await runtime.disposeAsync();
  });
});
