import { describe, expect, it } from "vitest";
import type { Scene } from "@motionforge/schema";
import {
  materializeEvidenceArtifacts,
  planComparisonSheet,
  type ComparisonSheetPlan,
  type EvidenceError,
  type EvidenceRenderedArtifact,
  type ProofFrameSelection,
} from "./evidence.js";
import {
  createCanvas2DEvidenceRenderer,
  createMemoryEvidenceArtifactStore,
  type EvidenceRuntimeFactory,
} from "./browser-evidence.js";

class FakeContext {
  pixels = new Uint8ClampedArray();
  globalAlpha = 0.37;
  globalCompositeOperation = "multiply" as GlobalCompositeOperation;
  filter = "blur(3px)";
  shadowBlur = 7;
  shadowColor = "#ff00ff";
  shadowOffsetX = 4;
  shadowOffsetY = -2;
  transform = "poison";
  private stack: Array<Record<string, unknown>> = [];

  constructor(readonly canvas: FakeCanvas) {
    this.resize();
  }

  resize() {
    this.pixels = new Uint8ClampedArray(
      this.canvas.width * this.canvas.height * 4,
    );
  }

  save() {
    this.stack.push({
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
      filter: this.filter,
      shadowBlur: this.shadowBlur,
      shadowColor: this.shadowColor,
      shadowOffsetX: this.shadowOffsetX,
      shadowOffsetY: this.shadowOffsetY,
      transform: this.transform,
    });
  }

  restore() {
    Object.assign(this, this.stack.pop());
  }

  resetTransform() {
    this.transform = "identity";
  }

  setTransform() {
    this.transform = "identity";
  }

  clearRect() {
    this.pixels.fill(0);
  }

  paint(rgba: [number, number, number, number]) {
    for (let index = 0; index < this.pixels.length; index += 4) {
      this.pixels.set(rgba, index);
    }
    this.globalAlpha = 0.9;
    this.filter = "none";
    this.transform = "runtime-mutated";
  }

  getImageData() {
    return { data: new Uint8ClampedArray(this.pixels) } as ImageData;
  }

  createImageData(width: number, height: number) {
    return {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    } as ImageData;
  }

  putImageData(image: ImageData) {
    this.pixels.set(image.data.subarray(0, this.pixels.length));
  }

  drawImage(
    source: FakeCanvas,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ) {
    for (let y = 0; y < dh; y += 1) {
      for (let x = 0; x < dw; x += 1) {
        const sourceX = Math.min(
          source.width - 1,
          Math.floor((x / Math.max(1, dw)) * source.width),
        );
        const sourceY = Math.min(
          source.height - 1,
          Math.floor((y / Math.max(1, dh)) * source.height),
        );
        const from = (sourceY * source.width + sourceX) * 4;
        const to = ((dy + y) * this.canvas.width + dx + x) * 4;
        this.pixels.set(source.context.pixels.subarray(from, from + 4), to);
      }
    }
  }
}

class FakeCanvas {
  private widthValue: number;
  private heightValue: number;
  readonly context: FakeContext;

  constructor(width: number, height: number) {
    this.widthValue = width;
    this.heightValue = height;
    this.context = new FakeContext(this);
  }

  get width() {
    return this.widthValue;
  }
  set width(value: number) {
    this.widthValue = value;
    this.context?.resize();
  }
  get height() {
    return this.heightValue;
  }
  set height(value: number) {
    this.heightValue = value;
    this.context?.resize();
  }

  getContext() {
    return this.context;
  }
}

function scene(label: "before" | "after", width = 2, height = 1): Scene {
  return {
    schemaVersion: 1,
    width,
    height,
    fps: 30,
    duration: 2,
    assets: {},
    nodes: [{ id: label, type: "div" }],
  };
}

function selection(frames = [0]): ProofFrameSelection {
  return {
    ok: true,
    kind: "motionforge.proof-frame-selection",
    version: 1,
    beforeDuration: 2,
    afterDuration: 2,
    timelineDuration: 2,
    candidatesConsidered: frames.length,
    droppedCandidates: 0,
    frames: frames.map((frame, index) => ({
      frame,
      rank: index + 1,
      score: 1000,
      reasons: [{ code: "explicit", label: `frame ${frame}` }],
    })),
  };
}

function plan(frames = [0]): ComparisonSheetPlan {
  const result = planComparisonSheet({ selection: selection(frames) });
  if (!result.ok) throw new Error(result.errors[0]?.message);
  return result;
}

function runtimeFactory(state: { created: number; disposed: number }) {
  const factory: EvidenceRuntimeFactory = async ({ scene: input }) => {
    state.created += 1;
    const value =
      (input as Scene).nodes[0]?.id === "before"
        ? ([10, 20, 30, 40] as const)
        : ([40, 10, 50, 90] as const);
    return {
      async renderFrame(_frame, target, { signal } = {}) {
        if (signal?.aborted) throw new Error("aborted");
        (target as unknown as FakeContext).paint([...value]);
      },
      async disposeAsync() {
        state.disposed += 1;
      },
    };
  };
  return factory;
}

describe("Canvas2D evidence renderer", () => {
  it("reuses prepared runtimes, produces a visible channel diff/sheet, and isolates state", async () => {
    const lifecycle = { created: 0, disposed: 0 };
    const canvases: FakeCanvas[] = [];
    const renderer = createCanvas2DEvidenceRenderer({
      createCanvas(width, height) {
        const canvas = new FakeCanvas(width, height);
        canvases.push(canvas);
        return canvas as unknown as OffscreenCanvas;
      },
      createRuntime: runtimeFactory(lifecycle),
      contactSheetCellWidth: 2,
      contactSheetCellHeight: 1,
      async encodeCanvas(canvas) {
        return new Uint8Array((canvas as unknown as FakeCanvas).context.pixels);
      },
    });
    const comparison = plan();
    const context = {
      before: scene("before"),
      after: scene("after"),
      plan: comparison,
      signal: new AbortController().signal,
    };
    const output = new Map<string, EvidenceRenderedArtifact>();
    for (const request of comparison.artifacts) {
      output.set(request.id, await renderer.render(request, context));
    }

    expect(lifecycle).toEqual({ created: 2, disposed: 2 });
    expect(renderer.stats()).toMatchObject({
      activeMaterializations: 0,
      runtimesCreated: 2,
      runtimesDisposed: 2,
    });
    expect([...output.get("visual-diff-00000000")!.bytes.slice(0, 4)]).toEqual([
      50, 50, 50, 255,
    ]);
    expect(output.get("comparison-sheet")).toMatchObject({
      width: 6,
      height: 1,
      mimeType: "image/png",
    });
    expect(canvases[0]?.context).toMatchObject({
      globalAlpha: 0.37,
      filter: "blur(3px)",
      transform: "poison",
    });
    await renderer.dispose();
    await renderer.dispose();
  });

  it("assembles multi-row portrait sheets into bounded aspect-preserving thumbnails", async () => {
    const lifecycle = { created: 0, disposed: 0 };
    const renderer = createCanvas2DEvidenceRenderer({
      createCanvas: (width, height) =>
        new FakeCanvas(width, height) as unknown as OffscreenCanvas,
      createRuntime: runtimeFactory(lifecycle),
      contactSheetCellWidth: 160,
      contactSheetCellHeight: 160,
      encodeCanvas: async (canvas) =>
        new Uint8Array((canvas as unknown as FakeCanvas).context.pixels),
    });
    const comparison = plan([0, 1]);
    const contact = comparison.artifacts.at(-1)!;
    const output = await renderer.render(contact, {
      before: scene("before", 1080, 1920),
      after: scene("after", 1080, 1920),
      plan: comparison,
      signal: new AbortController().signal,
    });
    expect(output).toMatchObject({ width: 480, height: 320 });
    expect(lifecycle).toEqual({ created: 2, disposed: 2 });
    expect(renderer.stats()).toMatchObject({
      activeMaterializations: 0,
      peakRasterBytes: expect.any(Number),
      peakRasterSurfaces: expect.any(Number),
    });
    expect(renderer.stats().peakRasterBytes).toBeLessThanOrEqual(
      128 * 1024 * 1024,
    );
  });

  it("rejects bounded dimensions and cancellation and disposes active runtimes", async () => {
    const dimensions = createCanvas2DEvidenceRenderer({
      maxDimension: 1,
      createCanvas: (width, height) =>
        new FakeCanvas(width, height) as unknown as OffscreenCanvas,
      createRuntime: runtimeFactory({ created: 0, disposed: 0 }),
      encodeCanvas: async () => new Uint8Array([1]),
    });
    const comparison = plan();
    await expect(
      dimensions.render(comparison.artifacts[0]!, {
        before: scene("before"),
        after: scene("after"),
        plan: comparison,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/dimensions/);

    let factories = 0;
    const fourK = createCanvas2DEvidenceRenderer({
      maxRasterBytes: 1024 * 1024,
      createCanvas(width, height) {
        factories += 1;
        return new FakeCanvas(width, height) as unknown as OffscreenCanvas;
      },
      createRuntime: runtimeFactory({ created: 0, disposed: 0 }),
      encodeCanvas: async () => new Uint8Array([1]),
    });
    await expect(
      fourK.render(comparison.artifacts[0]!, {
        before: scene("before", 3840, 2160),
        after: scene("after", 3840, 2160),
        plan: comparison,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/raster residency/);
    expect(factories).toBe(0);
    expect(fourK.stats().activeMaterializations).toBe(0);

    let rejectRender!: (error: Error) => void;
    const lifecycle = { created: 0, disposed: 0 };
    const cancelled = createCanvas2DEvidenceRenderer({
      createCanvas: (width, height) =>
        new FakeCanvas(width, height) as unknown as OffscreenCanvas,
      createRuntime: async () => {
        lifecycle.created += 1;
        return {
          renderFrame(_frame, _target, { signal } = {}) {
            return new Promise<void>((_resolve, reject) => {
              rejectRender = reject;
              signal?.addEventListener(
                "abort",
                () => reject(new Error("runtime aborted")),
                { once: true },
              );
            });
          },
          async disposeAsync() {
            lifecycle.disposed += 1;
          },
        };
      },
      encodeCanvas: async () => new Uint8Array([1]),
    });
    const render = cancelled.render(comparison.artifacts[0]!, {
      before: scene("before"),
      after: scene("after"),
      plan: comparison,
      signal: new AbortController().signal,
    });
    await Promise.resolve();
    await cancelled.dispose();
    rejectRender?.(new Error("runtime aborted"));
    await expect(render).rejects.toThrow(/abort/i);
    expect(lifecycle).toEqual({ created: 1, disposed: 1 });
  });

  it("joins runtime cleanup immediately when the artifact sink fails", async () => {
    const lifecycle = { created: 0, disposed: 0 };
    const renderer = createCanvas2DEvidenceRenderer({
      createCanvas: (width, height) =>
        new FakeCanvas(width, height) as unknown as OffscreenCanvas,
      createRuntime: runtimeFactory(lifecycle),
      contactSheetCellWidth: 2,
      contactSheetCellHeight: 1,
      encodeCanvas: async (canvas) =>
        new Uint8Array((canvas as unknown as FakeCanvas).context.pixels),
    });
    const comparison = plan();
    const result = await materializeEvidenceArtifacts({
      before: scene("before"),
      after: scene("after"),
      plan: comparison,
      renderer,
      sink: {
        async begin() {
          return {
            async write() {
              throw new Error("sink failed");
            },
            async commit() {},
            async abort() {},
          };
        },
      },
    });
    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: "artifact_sink_failed" }],
    });
    expect(renderer.stats()).toMatchObject({ activeMaterializations: 0 });
    expect(lifecycle.created).toBe(lifecycle.disposed);
  });
});

const abortEvidence: EvidenceError = {
  code: "aborted",
  path: ["signal"],
  message: "aborted",
};

function fakeArtifact(id: string, bytes = [1, 2, 3]): EvidenceRenderedArtifact {
  return {
    mimeType: "image/png",
    width: 2,
    height: 1,
    bytes: new Uint8Array(bytes),
  };
}

describe("transactional memory evidence store", () => {
  it("publishes only after commit and returns defensive bytes/refs", async () => {
    const store = createMemoryEvidenceArtifactStore({ storeId: "test" });
    const comparison = plan();
    const signal = new AbortController().signal;
    const writer = await store
      .sinkFor({ sessionId: "s", handle: "h" })
      .begin(comparison, { signal });
    const refs = [];
    for (const request of comparison.artifacts) {
      refs.push(
        await writer.write(request, fakeArtifact(request.id), { signal }),
      );
    }
    expect(store.read(refs[0]!.uri)).toBeUndefined();
    await writer.commit({ signal });
    const first = store.read(refs[0]!.uri)!;
    expect([...first]).toEqual([1, 2, 3]);
    first[0] = 99;
    expect([...store.read(refs[0]!.uri)!]).toEqual([1, 2, 3]);
    const ref = store.ref(refs[0]!.uri)!;
    ref.uri = "memory://mutated";
    expect(store.ref(refs[0]!.uri)?.uri).toBe(refs[0]!.uri);
    expect(store.list({ sessionId: "s", handle: "h" })).toHaveLength(
      comparison.artifacts.length,
    );
    await writer.abort(abortEvidence, { signal });
    expect(store.stats()).toMatchObject({
      entries: comparison.artifacts.length,
      openTransactions: 0,
    });
  });

  it("rolls back aborts, incomplete commits, cancellation, and byte overflow", async () => {
    const store = createMemoryEvidenceArtifactStore({
      storeId: "bounded",
      maxArtifactBytes: 2,
      maxBytes: 8,
    });
    const comparison = plan();
    const signal = new AbortController().signal;
    const writer = await store.sink.begin(comparison, { signal });
    await expect(
      writer.write(comparison.artifacts[0]!, fakeArtifact("large", [1, 2, 3]), {
        signal,
      }),
    ).rejects.toThrow(/byte limit/);
    await expect(writer.commit({ signal })).rejects.toThrow(/0\//);
    await writer.abort(abortEvidence, { signal });
    expect(store.stats()).toMatchObject({ entries: 0, openTransactions: 0 });

    const aborted = new AbortController();
    aborted.abort();
    await expect(
      store.sink.begin(comparison, { signal: aborted.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("cleans handle/session scopes and prevents writes after disposal", async () => {
    const store = createMemoryEvidenceArtifactStore({ storeId: "cleanup" });
    const comparison = plan();
    const signal = new AbortController().signal;
    for (const scope of [
      { sessionId: "s", handle: "a" },
      { sessionId: "s", handle: "b" },
      { sessionId: "other", handle: "a" },
    ]) {
      const writer = await store.sinkFor(scope).begin(comparison, { signal });
      for (const request of comparison.artifacts) {
        await writer.write(request, fakeArtifact(request.id, [1]), { signal });
      }
      await writer.commit({ signal });
    }
    await store.disposeHandle({ sessionId: "s", handle: "a" });
    expect(store.list({ sessionId: "s", handle: "a" })).toHaveLength(0);
    expect(store.list({ sessionId: "s", handle: "b" })).not.toHaveLength(0);

    const pending = await store
      .sinkFor({ sessionId: "s", handle: "pending" })
      .begin(comparison, { signal });
    await pending.write(
      comparison.artifacts[0]!,
      fakeArtifact("pending", [1]),
      { signal },
    );
    expect(store.stats().openTransactions).toBe(1);
    await store.disposeHandle({ sessionId: "s", handle: "pending" });
    expect(store.stats().openTransactions).toBe(0);
    await expect(pending.commit({ signal })).rejects.toThrow(/aborted/);

    await store.disposeSession({ sessionId: "s" });
    expect(store.list({ sessionId: "s", handle: "b" })).toHaveLength(0);
    expect(store.list({ sessionId: "other", handle: "a" })).not.toHaveLength(0);
    await store.dispose();
    await expect(store.sink.begin(comparison, { signal })).rejects.toThrow(
      /disposed/,
    );
    expect(store.stats()).toEqual({
      entries: 0,
      bytes: 0,
      openTransactions: 0,
      disposed: true,
    });
  });
});
