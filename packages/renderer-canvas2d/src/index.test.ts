import { describe, expect, it, vi } from "vitest";
import { sampleScene } from "@motionforge/core";
import {
  createExtensionRegistry,
  defineExtension,
} from "@motionforge/extensions";
import { z } from "zod";
import {
  compileCanvas2DDisplayList,
  BoundedTextMeasureCache,
  Canvas2DStaticDisplayCache,
  assetDeclarationKey,
  computeObjectFit,
  createCanvas2DOpaqueExtensionRegistry,
  collectReachableAssetIds,
  assertResolvedAssetsCompatible,
  disposeAssetsAsync,
  executeCanvas2DDisplayList,
  estimateMediaResources,
  FontAssetCache,
  lottieSourceFrame,
  parseBorder,
  parseBoxShadow,
  parseBoxShadows,
  parseConicGradient,
  parseLinearGradient,
  parseRadialGradient,
  parseTextBackground,
  parseTextStroke,
  preflightCanvas2D,
  prepareFrame,
  renderStill,
  resolveAssets,
  ScratchSurfacePool,
  shapePointInBox,
  type Canvas2DExtensionAdapter,
  validateLottieDocument,
  waitForLottieReady,
  VideoPlaybackCursor,
  videoSourceTime,
  waveformFromSamples,
  wrapTextLines,
} from "./index.js";

// Deterministic fake measurer: every character is 10px wide.
const measure = (line: string): number => line.length * 10;

type RecordedDrawImage = unknown[];

function createScratchRenderHarness() {
  const surfaces: Array<{
    width: number;
    height: number;
    context: CanvasRenderingContext2D;
    drawImages: RecordedDrawImage[];
  }> = [];

  const createContext = () => {
    const drawImages: RecordedDrawImage[] = [];
    const context = {
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      fillStyle: "#000000",
      strokeStyle: "#000000",
      filter: "none",
      font: "normal 400 10px sans-serif",
      direction: "inherit",
      textAlign: "left",
      textBaseline: "alphabetic",
      lineWidth: 1,
      lineCap: "butt",
      lineJoin: "miter",
      miterLimit: 10,
      shadowColor: "transparent",
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowBlur: 0,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
      save: vi.fn(),
      restore: vi.fn(),
      reset: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      rect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arcTo: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      clip: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: (text: string) => ({ width: text.length * 10 }),
      getImageData: vi.fn(
        (_x: number, _y: number, width: number, height: number) =>
          ({
            data: new Uint8ClampedArray(width * height * 4),
            width,
            height,
            colorSpace: "srgb",
          }) as ImageData,
      ),
      putImageData: vi.fn(),
      drawImage: (...args: unknown[]) => drawImages.push(args),
    } as unknown as CanvasRenderingContext2D;
    return { context, drawImages };
  };

  const target = createContext();
  const pool = new ScratchSurfacePool({
    createCanvas(width, height) {
      const staged = createContext();
      const surface = {
        width,
        height,
        getContext: () => staged.context,
        context: staged.context,
        drawImages: staged.drawImages,
      };
      surfaces.push(surface);
      return surface as unknown as OffscreenCanvas;
    },
    maxBytes: 32 * 1024 * 1024,
    maxSurfaces: 16,
    maxDimension: 1_024,
  });
  return { pool, surfaces, target };
}

describe("Canvas2D preflight", () => {
  class PreflightCanvas {
    getContext() {
      return {};
    }
  }

  const mediaScene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 30,
    assets: {
      picture: { id: "picture", type: "image", src: "picture.png" },
      clip: { id: "clip", type: "video", src: "clip.mp4" },
      music: { id: "music", type: "audio", src: "music.mp3" },
      font: { id: "font", type: "font", src: "font.woff2" },
      sticker: { id: "sticker", type: "lottie", src: "sticker.json" },
    },
    nodes: [
      { id: "picture", type: "img", assetId: "picture" },
      { id: "clip", type: "video", assetId: "clip" },
      { id: "music", type: "audio", assetId: "music" },
      { id: "sticker", type: "lottie", assetId: "sticker" },
    ],
  };

  it("reports missing runtime capabilities before loading assets", () => {
    const result = preflightCanvas2D(mediaScene, {});

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "canvas_unavailable",
      "image_decoder_unavailable",
      "video_decoder_unavailable",
      "audio_decoder_unavailable",
      "lottie_requires_dom",
    ]);
  });

  it("accepts an environment satisfying the scene's declared requirements", () => {
    const environment = {
      OffscreenCanvas: PreflightCanvas,
      createImageBitmap: () => undefined,
      VideoDecoder: class {},
      AudioDecoder: class {},
      FontFace: class {},
      document: {
        createElement: () => ({}),
        fonts: {},
      },
    } as unknown as Partial<typeof globalThis>;

    expect(preflightCanvas2D(mediaScene, environment)).toMatchObject({
      ok: true,
      issues: [],
      requirements: {
        canvas: true,
        imageDecoder: true,
        videoDecoder: true,
        audioDecoder: true,
        fontLoading: false,
        domLottie: true,
        extensions: false,
        path2d: false,
        domMatrix: false,
      },
    });
  });

  it("uses reachable assets and includes declared embedded-video audio", () => {
    const scene = {
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      assets: {
        clip: {
          id: "clip",
          type: "video",
          src: "clip.mp4",
          metadata: { hasAudio: true, byteLength: 2_000 },
        },
        unused: { id: "unused", type: "image", src: "unused.png" },
      },
      nodes: [{ id: "clip", type: "video", assetId: "clip" }],
    };
    const environment = {
      OffscreenCanvas: PreflightCanvas,
      VideoDecoder: class {},
    } as unknown as Partial<typeof globalThis>;
    const result = preflightCanvas2D(scene, environment, {
      budget: { maxAssetBytes: 1_000 },
    });

    expect(result.requirements).toMatchObject({
      imageDecoder: false,
      videoDecoder: true,
      audioDecoder: true,
    });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "audio_decoder_unavailable",
      "asset_byte_budget_exceeded",
    ]);
  });

  it("includes extension registry compatibility in Canvas2D preflight", () => {
    const extensionScene = {
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      assets: {},
      nodes: [
        {
          id: "grid",
          type: "extension",
          extension: {
            name: "com.example.grid",
            version: "1.0.0",
            params: { columns: 8 },
          },
        },
      ],
    };
    const environment = {
      OffscreenCanvas: PreflightCanvas,
    } as unknown as Partial<typeof globalThis>;
    const missing = preflightCanvas2D(extensionScene, environment);
    expect(missing.issues.map((issue) => issue.code)).toContain(
      "extension_not_installed",
    );

    const registry = createExtensionRegistry([
      defineExtension({
        name: "com.example.grid",
        version: "1.0.0",
        paramsSchema: z.object({ columns: z.number().int() }),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: { draw: () => undefined } },
      }),
    ]);
    expect(
      preflightCanvas2D(extensionScene, environment, { extensions: registry }),
    ).toMatchObject({
      ok: true,
      requirements: { extensions: true },
      issues: [],
    });

    const malformedRegistry = createExtensionRegistry([
      defineExtension({
        name: "com.example.grid",
        version: "1.0.0",
        paramsSchema: z.object({ columns: z.number().int() }),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: {} },
      }),
    ]);
    expect(
      preflightCanvas2D(extensionScene, environment, {
        extensions: malformedRegistry,
      }).issues.map((issue) => issue.code),
    ).toContain("extension_adapter_invalid");
  });

  it("preflights Path2D and DOMMatrix for vector geometry", () => {
    const vectorScene = {
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      assets: {},
      nodes: [
        {
          id: "wave",
          type: "shape",
          shape: {
            kind: "path",
            d: "M0 0 L100 0 L100 100 Z",
            viewBox: { x: 0, y: 0, width: 100, height: 100 },
          },
        },
      ],
    };
    const missing = preflightCanvas2D(vectorScene, {});
    expect(missing.issues.map((issue) => issue.code)).toEqual([
      "canvas_unavailable",
      "path2d_unavailable",
      "dom_matrix_unavailable",
    ]);

    const supported = preflightCanvas2D(vectorScene, {
      OffscreenCanvas: PreflightCanvas,
      Path2D: class {},
      DOMMatrix: class {},
    } as unknown as Partial<typeof globalThis>);
    expect(supported).toMatchObject({
      ok: true,
      issues: [],
      requirements: { path2d: true, domMatrix: true },
    });
  });

  it("preflights filter and conic-gradient canvas capabilities", () => {
    const visualScene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 10,
      assets: {},
      nodes: [
        {
          id: "visual",
          type: "div",
          style: {
            filter: "blur(2px)",
            background: "conic-gradient(red 0%, blue 100%)",
            letterSpacing: 1,
          },
        },
      ],
    };
    class MissingCanvasFeatures {
      getContext() {
        return {};
      }
    }
    const missing = preflightCanvas2D(visualScene, {
      OffscreenCanvas: MissingCanvasFeatures,
    } as unknown as Partial<typeof globalThis>);
    expect(missing.issues.map((issue) => issue.code)).toEqual([
      "filter_unavailable",
      "conic_gradient_unavailable",
      "letter_spacing_unavailable",
    ]);
    expect(missing.requirements).toMatchObject({
      filter: true,
      conicGradient: true,
      letterSpacing: true,
    });

    class CompleteCanvasFeatures {
      getContext() {
        return {
          filter: "none",
          letterSpacing: "0px",
          createConicGradient: () => ({ addColorStop: () => undefined }),
        };
      }
    }
    expect(
      preflightCanvas2D(visualScene, {
        OffscreenCanvas: CompleteCanvasFeatures,
      } as unknown as Partial<typeof globalThis>),
    ).toMatchObject({ ok: true, issues: [] });
  });

  it("requires filter support for feather-only masks in preflight and execution", () => {
    const featherScene = {
      schemaVersion: 1 as const,
      width: 64,
      height: 64,
      fps: 30,
      duration: 2,
      assets: {},
      nodes: [
        {
          id: "masked",
          type: "div" as const,
          style: { width: 40, height: 40, backgroundColor: "#fff" },
          mask: { shape: { kind: "rect" as const }, feather: 4 },
        },
      ],
    };
    class NoFilterCanvas {
      getContext() {
        return {};
      }
    }
    expect(
      preflightCanvas2D(featherScene, {
        OffscreenCanvas: NoFilterCanvas,
        Path2D: class {},
      } as unknown as Partial<typeof globalThis>).issues.map(
        (issue) => issue.code,
      ),
    ).toContain("filter_unavailable");

    const targetHarness = createScratchRenderHarness().target;
    const target = targetHarness.context;
    const list = compileCanvas2DDisplayList(target, featherScene, 0);
    delete (target as unknown as Record<string, unknown>).filter;
    expect(() =>
      executeCanvas2DDisplayList(target, list, { scene: featherScene }),
    ).toThrow(/feathered masks require context.filter/);
  });

  it("reports decoder and decoded-image budget estimates", () => {
    const budgetScene = {
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      assets: {
        one: {
          id: "one",
          type: "image",
          src: "one.png",
          metadata: { width: 100, height: 100 },
        },
        clip: { id: "clip", type: "video", src: "clip.mp4" },
      },
      nodes: [
        { id: "one", type: "img", assetId: "one" },
        { id: "a", type: "video", assetId: "clip" },
        { id: "b", type: "video", assetId: "clip" },
      ],
    };
    const result = preflightCanvas2D(
      budgetScene,
      {
        OffscreenCanvas: PreflightCanvas,
        createImageBitmap: () => undefined,
        VideoDecoder: class {},
      } as unknown as Partial<typeof globalThis>,
      { budget: { maxVideoDecoders: 1, maxDecodedImageBytes: 1000 } },
    );
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "video_decoder_budget_exceeded",
      "decoded_image_budget_estimate_exceeded",
    ]);
  });
});

describe("resolved asset source identity", () => {
  const assets = {
    images: new Map(),
    fonts: new Map(),
    videos: new Map(),
    videoFrames: new Map(),
    audio: new Map(),
    lotties: new Map(),
    lottieFrames: new Map(),
    resolvedSources: new Map([
      [
        "clip",
        {
          assetId: "clip",
          declaredSource: "https://cdn.test/old.mp4",
          resolvedSource: "https://signed.test/old.mp4",
          contentKey: "sha256:same",
          usingProxy: false,
          sourceKind: "primary",
          declarationKey: "primary:https://cdn.test/old.mp4\u0000proxy:",
        },
      ],
    ]),
  };

  it("rejects changed URLs unless a stable content identity proves equivalence", () => {
    const scene = (contentHash?: string) => ({
      schemaVersion: 1,
      width: 10,
      height: 10,
      fps: 30,
      duration: 1,
      assets: {
        clip: {
          id: "clip",
          type: "video",
          src: "https://cdn.test/new.mp4",
          ...(contentHash ? { metadata: { contentHash } } : {}),
        },
      },
      nodes: [{ id: "clip", type: "video", assetId: "clip" }],
    });

    expect(() =>
      assertResolvedAssetsCompatible(scene(), assets as never),
    ).toThrow(/changed source/);
    expect(() =>
      assertResolvedAssetsCompatible(scene("sha256:same"), assets as never),
    ).not.toThrow();
    expect(() =>
      renderStill({} as never, scene() as never, 0, {
        assets: assets as never,
      }),
    ).toThrow(/changed source/);
  });
});

describe("resolved asset lease reuse", () => {
  const imageScene = (
    sources: Record<string, string>,
    visible = Object.keys(sources),
    options: {
      contentHash?: string;
      sourceMode?: "auto" | "stream" | "buffer";
      proxy?: Record<string, string>;
      extraNodes?: unknown[];
    } = {},
  ) => ({
    schemaVersion: 1,
    width: 32,
    height: 32,
    fps: 30,
    duration: 2,
    assets: Object.fromEntries(
      Object.entries(sources).map(([id, src]) => [
        id,
        {
          id,
          type: "image",
          src,
          ...(options.sourceMode ? { sourceMode: options.sourceMode } : {}),
          ...(options.proxy?.[id] ? { proxy: { src: options.proxy[id] } } : {}),
          ...(options.contentHash
            ? { metadata: { contentHash: options.contentHash } }
            : {}),
        },
      ]),
    ),
    nodes: [
      ...visible.map((id) => ({ id: `node-${id}`, type: "img", assetId: id })),
      ...(options.extraNodes ?? []),
    ],
  });

  function stubImageDecode() {
    const decoded: Array<{
      width: number;
      height: number;
      close: ReturnType<typeof vi.fn>;
    }> = [];
    const decode = vi.fn(async () => {
      const image = { width: 8, height: 6, close: vi.fn() };
      decoded.push(image);
      return image;
    });
    vi.stubGlobal("createImageBitmap", decode);
    return { decode, decoded };
  }

  function silentWavDataUrl(): string {
    const sampleBytes = 2;
    const bytes = new Uint8Array(44 + sampleBytes);
    const view = new DataView(bytes.buffer);
    const write = (offset: number, value: string) =>
      Array.from(value).forEach((character, index) => {
        bytes[offset + index] = character.charCodeAt(0);
      });
    write(0, "RIFF");
    view.setUint32(4, 36 + sampleBytes, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 8_000, true);
    view.setUint32(28, 16_000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, sampleBytes, true);
    return `data:audio/wav;base64,${Buffer.from(bytes).toString("base64")}`;
  }

  it("reuses unchanged resources and closes them only after the final lease", async () => {
    const { decode, decoded } = stubImageDecode();
    try {
      const before = imageScene({ image: "data:image/png;base64,AA==" });
      const after = { ...before, duration: 3 };
      const first = await resolveAssets(before as never);
      const second = await resolveAssets(after as never, {
        reuseFrom: { scene: before, assets: first },
      });

      expect(decode).toHaveBeenCalledTimes(1);
      expect(second.images.get("image")).toBe(first.images.get("image"));
      expect(second.videoFrames).not.toBe(first.videoFrames);
      expect(second.lottieFrames).not.toBe(first.lottieFrames);

      await disposeAssetsAsync(first);
      expect(decoded[0]?.close).not.toHaveBeenCalled();
      expect(second.images.get("image")).toBe(decoded[0]);

      const firstDisposal = disposeAssetsAsync(second);
      const secondDisposal = disposeAssetsAsync(second);
      expect(secondDisposal).toBe(firstDisposal);
      await firstDisposal;
      expect(decoded[0]?.close).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps shared audio inputs alive until the final lease", async () => {
    const scene = {
      schemaVersion: 1,
      width: 16,
      height: 16,
      fps: 30,
      duration: 1,
      assets: {
        sound: {
          id: "sound",
          type: "audio",
          src: silentWavDataUrl(),
          sourceMode: "buffer",
        },
      },
      nodes: [{ id: "sound", type: "audio", assetId: "sound" }],
    };
    const first = await resolveAssets(scene as never);
    const second = await resolveAssets(scene as never, {
      reuseFrom: { scene, assets: first },
    });
    const clip = first.audio.get("sound");
    expect(clip).toBeDefined();
    expect(second.audio.get("sound")).toBe(clip);
    await disposeAssetsAsync(first);
    expect(clip?.input.disposed).toBe(false);
    await disposeAssetsAsync(second);
    expect(clip?.input.disposed).toBe(true);
  });

  it("keeps font cache ownership and refuses cross-cache reuse", async () => {
    class FakeFontFace {
      constructor(
        readonly family: string,
        readonly source: ArrayBuffer,
      ) {}
      async load() {
        return this;
      }
    }
    const fontSet = {
      add: vi.fn(),
      delete: vi.fn(() => true),
    };
    const firstCache = new FontAssetCache<FakeFontFace>({
      maxEntries: 4,
      fontSet,
    });
    const secondCache = new FontAssetCache<FakeFontFace>({
      maxEntries: 4,
      fontSet,
    });
    vi.stubGlobal("FontFace", FakeFontFace);
    vi.stubGlobal("fonts", fontSet);
    try {
      const scene = {
        schemaVersion: 1,
        width: 16,
        height: 16,
        fps: 30,
        duration: 1,
        assets: {
          Inter: {
            id: "Inter",
            type: "font",
            src: "data:font/woff2;base64,AA==",
          },
        },
        nodes: [
          {
            id: "text",
            type: "text",
            text: "Hello",
            style: { fontFamily: "Inter" },
          },
        ],
      };
      const first = await resolveAssets(scene as never, {
        fontCache: firstCache as never,
      });
      const shared = await resolveAssets(scene as never, {
        fontCache: firstCache as never,
        reuseFrom: { scene, assets: first },
      });
      expect(shared.fonts.get("Inter")).toBe(first.fonts.get("Inter"));
      expect(firstCache.stats.activeLeases).toBe(1);

      const otherCache = await resolveAssets(scene as never, {
        fontCache: secondCache as never,
        reuseFrom: { scene, assets: shared },
      });
      expect(otherCache.fonts.get("Inter")).not.toBe(shared.fonts.get("Inter"));
      expect(secondCache.stats.activeLeases).toBe(1);

      await disposeAssetsAsync(first);
      expect(firstCache.stats.activeLeases).toBe(1);
      await disposeAssetsAsync(shared);
      expect(firstCache.stats.activeLeases).toBe(0);
      await disposeAssetsAsync(otherCache);
      expect(secondCache.stats.activeLeases).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("loads only added/replaced resources and drops unreachable bindings", async () => {
    const { decode, decoded } = stubImageDecode();
    try {
      const before = imageScene(
        {
          a: "data:image/png;base64,AA==",
          b: "data:image/png;base64,AQ==",
        },
        ["b"],
      );
      const first = await resolveAssets(before as never);
      expect(decode).toHaveBeenCalledTimes(1);

      const added = imageScene(
        {
          a: "data:image/png;base64,AA==",
          b: "data:image/png;base64,AQ==",
        },
        ["a", "b"],
      );
      const second = await resolveAssets(added as never, {
        reuseFrom: { scene: before, assets: first },
      });
      expect(decode).toHaveBeenCalledTimes(2);
      expect(second.images.get("b")).toBe(first.images.get("b"));
      expect(second.images.get("a")).not.toBe(first.images.get("b"));

      const replaced = imageScene(
        {
          a: "data:image/png;base64,Ag==",
          b: "data:image/png;base64,AQ==",
        },
        ["a"],
      );
      const third = await resolveAssets(replaced as never, {
        reuseFrom: { scene: added, assets: second },
      });
      expect(decode).toHaveBeenCalledTimes(3);
      expect(third.images.has("b")).toBe(false);
      expect(third.images.get("a")).not.toBe(second.images.get("a"));

      await disposeAssetsAsync(first);
      expect(decoded[0]?.close).not.toHaveBeenCalled();
      await disposeAssetsAsync(second);
      expect(decoded[0]?.close).toHaveBeenCalledTimes(1);
      expect(decoded[1]?.close).toHaveBeenCalledTimes(1);
      expect(decoded[2]?.close).not.toHaveBeenCalled();
      await disposeAssetsAsync(third);
      expect(decoded[2]?.close).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("reuses stable content across URL rotation but not source variants or modes", async () => {
    const { decode } = stubImageDecode();
    try {
      const firstScene = imageScene(
        { image: "data:image/png;base64,AA==" },
        ["image"],
        {
          contentHash: "sha256:same",
          proxy: { image: "data:image/png;base64,AQ==" },
        },
      );
      const first = await resolveAssets(firstScene as never);
      const rotated = imageScene(
        { image: "data:image/png;base64,Ag==" },
        ["image"],
        {
          contentHash: "sha256:same",
          proxy: { image: "data:image/png;base64,Aw==" },
        },
      );
      const stable = await resolveAssets(rotated as never, {
        reuseFrom: { scene: firstScene, assets: first },
      });
      expect(stable.images.get("image")).toBe(first.images.get("image"));
      expect(decode).toHaveBeenCalledTimes(1);

      const bufferedScene = imageScene(
        { image: "data:image/png;base64,Ag==" },
        ["image"],
        { contentHash: "sha256:same", sourceMode: "buffer" },
      );
      const buffered = await resolveAssets(bufferedScene as never, {
        reuseFrom: { scene: rotated, assets: stable },
      });
      expect(buffered.images.get("image")).not.toBe(stable.images.get("image"));

      const proxy = await resolveAssets(firstScene as never, {
        preferProxy: true,
        reuseFrom: { scene: firstScene, assets: first },
      });
      expect(proxy.images.get("image")).not.toBe(first.images.get("image"));
      expect(decode).toHaveBeenCalledTimes(3);

      await Promise.all([
        disposeAssetsAsync(first),
        disposeAssetsAsync(stable),
        disposeAssetsAsync(buffered),
        disposeAssetsAsync(proxy),
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rolls retained references back on successor failure and cancellation", async () => {
    const { decoded } = stubImageDecode();
    try {
      const before = imageScene({ image: "data:image/png;base64,AA==" });
      const first = await resolveAssets(before as never);
      const failureRegistry = createExtensionRegistry([
        defineExtension({
          name: "com.example.reuse-failure",
          version: "1.0.0",
          paramsSchema: z.object({}),
          deterministic: true,
          workerCompatible: true,
          renderers: { canvas2d: { draw: () => undefined } },
          resolveAssets: () => {
            throw new Error("successor failed");
          },
        }),
      ]);
      const failedScene = imageScene(
        { image: "data:image/png;base64,AA==" },
        ["image"],
        {
          extraNodes: [
            {
              id: "failure",
              type: "extension",
              extension: {
                name: "com.example.reuse-failure",
                version: "1.0.0",
                params: {},
              },
            },
          ],
        },
      );
      await expect(
        resolveAssets(failedScene as never, {
          extensions: failureRegistry,
          reuseFrom: { scene: before, assets: first },
        }),
      ).rejects.toThrow("successor failed");
      expect(decoded[0]?.close).not.toHaveBeenCalled();

      let started!: () => void;
      const waiting = new Promise<void>((resolve) => {
        started = resolve;
      });
      const cancelRegistry = createExtensionRegistry([
        defineExtension({
          name: "com.example.reuse-cancel",
          version: "1.0.0",
          paramsSchema: z.object({}),
          deterministic: true,
          workerCompatible: true,
          renderers: { canvas2d: { draw: () => undefined } },
          resolveAssets: ({ signal }) =>
            new Promise((_resolve, reject) => {
              started();
              signal?.addEventListener("abort", () => reject(signal.reason), {
                once: true,
              });
            }),
        }),
      ]);
      const cancelScene = imageScene(
        { image: "data:image/png;base64,AA==" },
        ["image"],
        {
          extraNodes: [
            {
              id: "cancel",
              type: "extension",
              extension: {
                name: "com.example.reuse-cancel",
                version: "1.0.0",
                params: {},
              },
            },
          ],
        },
      );
      const controller = new AbortController();
      const cancelled = resolveAssets(cancelScene as never, {
        extensions: cancelRegistry,
        signal: controller.signal,
        reuseFrom: { scene: before, assets: first },
      });
      await waiting;
      controller.abort(new Error("cancel successor"));
      await expect(cancelled).rejects.toThrow("cancel successor");
      expect(decoded[0]?.close).not.toHaveBeenCalled();

      await disposeAssetsAsync(first);
      expect(decoded[0]?.close).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("honors policy generations and tighter resource budgets before reuse", async () => {
    const { decode, decoded } = stubImageDecode();
    try {
      const before = imageScene({ image: "data:image/png;base64,AA==" });
      const authorizeFirst = vi.fn(() => true);
      const firstPolicy = {
        reuseKey: "policy-v1",
        authorizeSource: authorizeFirst,
        contentKey: () => "stable-image-content",
      };
      const first = await resolveAssets(before as never, {
        assetPolicy: firstPolicy,
      });

      const authorizeEquivalent = vi.fn(() => true);
      const equivalentPolicy = {
        reuseKey: "policy-v1",
        authorizeSource: authorizeEquivalent,
        contentKey: () => "stable-image-content",
      };
      const equivalent = await resolveAssets(before as never, {
        assetPolicy: equivalentPolicy,
        reuseFrom: { scene: before, assets: first },
      });
      expect(authorizeEquivalent).toHaveBeenCalledTimes(1);
      expect(equivalent.images.get("image")).toBe(first.images.get("image"));
      expect(decode).toHaveBeenCalledTimes(1);

      const changedPolicy = {
        ...equivalentPolicy,
        reuseKey: "policy-v2",
      };
      const policyReplacement = await resolveAssets(before as never, {
        assetPolicy: changedPolicy,
        reuseFrom: { scene: before, assets: equivalent },
      });
      expect(policyReplacement.images.get("image")).not.toBe(
        equivalent.images.get("image"),
      );

      const tighter = await resolveAssets(before as never, {
        assetPolicy: changedPolicy,
        budget: { maxAssetBytes: 1024, maxSourceCacheBytes: 1024 },
        reuseFrom: { scene: before, assets: policyReplacement },
      });
      expect(tighter.images.get("image")).not.toBe(
        policyReplacement.images.get("image"),
      );
      expect(decode).toHaveBeenCalledTimes(3);

      await Promise.all([
        disposeAssetsAsync(first),
        disposeAssetsAsync(equivalent),
        disposeAssetsAsync(policyReplacement),
        disposeAssetsAsync(tighter),
      ]);
      expect(
        decoded.every((image) => image.close.mock.calls.length === 1),
      ).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("applies a tighter decoded-image budget to retained images", async () => {
    const { decode, decoded } = stubImageDecode();
    try {
      const scene = imageScene({ image: "data:image/png;base64,AA==" });
      const first = await resolveAssets(scene as never);
      await expect(
        resolveAssets(scene as never, {
          budget: { maxDecodedImageBytes: 100 },
          reuseFrom: { scene, assets: first },
        }),
      ).rejects.toThrow(/Decoded image budget exceeded/);
      expect(decode).toHaveBeenCalledTimes(1);
      expect(decoded[0]?.close).not.toHaveBeenCalled();
      await disposeAssetsAsync(first);
      expect(decoded[0]?.close).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to a fresh load if the old lease disposes before retain", async () => {
    const { decode, decoded } = stubImageDecode();
    try {
      let pauseIdentity = false;
      let identityStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        identityStarted = resolve;
      });
      let releaseIdentity!: () => void;
      const identityGate = new Promise<void>((resolve) => {
        releaseIdentity = resolve;
      });
      const policy = {
        reuseKey: "race-policy",
        contentKey: async () => {
          if (pauseIdentity) {
            identityStarted();
            await identityGate;
          }
          return "stable-image-content";
        },
      };
      const scene = imageScene({ image: "data:image/png;base64,AA==" });
      const first = await resolveAssets(scene as never, {
        assetPolicy: policy,
      });
      pauseIdentity = true;
      const successorPromise = resolveAssets(scene as never, {
        assetPolicy: policy,
        reuseFrom: { scene, assets: first },
      });
      await started;
      await disposeAssetsAsync(first);
      expect(decoded[0]?.close).toHaveBeenCalledTimes(1);
      releaseIdentity();
      const successor = await successorPromise;
      expect(decode).toHaveBeenCalledTimes(2);
      expect(successor.images.get("image")).toBe(decoded[1]);
      await disposeAssetsAsync(successor);
      expect(decoded[1]?.close).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not let content identity mask decoder type or sourceMode changes", async () => {
    const { decoded } = stubImageDecode();
    try {
      const before = imageScene(
        { image: "data:image/png;base64,AA==" },
        ["image"],
        { contentHash: "sha256:same" },
      );
      const assets = await resolveAssets(before as never);
      const changedType = {
        ...before,
        assets: {
          image: {
            id: "image",
            type: "video",
            src: "data:video/mp4;base64,AA==",
            metadata: { contentHash: "sha256:same" },
          },
        },
        nodes: [
          {
            id: "node-image",
            type: "video",
            assetId: "image",
            volume: 0,
          },
        ],
      };
      expect(() => assertResolvedAssetsCompatible(changedType, assets)).toThrow(
        /changed type/,
      );
      const changedMode = imageScene(
        { image: "data:image/png;base64,AA==" },
        ["image"],
        { contentHash: "sha256:same", sourceMode: "buffer" },
      );
      expect(() => assertResolvedAssetsCompatible(changedMode, assets)).toThrow(
        /changed sourceMode/,
      );
      await disposeAssetsAsync(assets);
      expect(decoded[0]?.close).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("media resource planning", () => {
  const scene = {
    schemaVersion: 1 as const,
    width: 320,
    height: 180,
    fps: 30,
    duration: 60,
    assets: {
      used: { id: "used", type: "image" as const, src: "used.png" },
      unused: { id: "unused", type: "image" as const, src: "unused.png" },
      font: { id: "font", type: "font" as const, src: "font.woff2" },
      clip: {
        id: "clip",
        type: "video" as const,
        src: "clip.mp4",
        proxy: { src: "clip-proxy.mp4", width: 640, height: 360 },
      },
    },
    nodes: [
      { id: "image", type: "img" as const, assetId: "used" },
      {
        id: "title",
        type: "text" as const,
        text: "Hi",
        style: { fontFamily: "font" },
      },
      { id: "a", type: "video" as const, assetId: "clip", duration: 30 },
      {
        id: "b",
        type: "video" as const,
        assetId: "clip",
        from: 15,
        duration: 30,
      },
    ],
  };

  it("loads only assets reachable from scene nodes and styles", () => {
    expect(Array.from(collectReachableAssetIds(scene as never)).sort()).toEqual(
      ["clip", "font", "used"],
    );
    expect(estimateMediaResources(scene)).toMatchObject({
      declaredAssets: 4,
      reachableAssets: 3,
      proxyAssets: 1,
      maxSimultaneousVideoDecoders: 2,
    });
  });

  it("builds bounded waveform peaks", () => {
    expect(
      Array.from(waveformFromSamples(new Float32Array([0, -0.5, 0.25, 1]), 2)),
    ).toEqual([0.5, 1]);
  });
});

describe("shape geometry", () => {
  it("maps normalized shape points into a layout box", () => {
    expect(
      shapePointInBox(
        { x: 0.25, y: 0.75 },
        { x: 10, y: 20, width: 200, height: 80 },
      ),
    ).toEqual({ x: 60, y: 80 });
  });
});

describe("bounded scratch compositing", () => {
  const sceneWith = (node: Record<string, unknown>) => ({
    schemaVersion: 1,
    width: 200,
    height: 120,
    fps: 30,
    duration: 1,
    assets: {},
    nodes: [node],
  });

  it("uses integer pixel crops without compositing unused pool bucket pixels", () => {
    const { pool, target } = createScratchRenderHarness();
    renderStill(
      target.context,
      sceneWith({
        id: "fractional",
        type: "div",
        style: {
          position: "absolute",
          left: 25.25,
          top: 14.5,
          width: 30.5,
          height: 20.25,
          backgroundColor: "#ffffff",
          isolation: true,
        },
      }) as never,
      0,
      { scratchSurfacePool: pool },
    );

    expect(target.drawImages).toHaveLength(1);
    expect(target.drawImages[0]!.slice(1)).toEqual([
      0, 0, 31, 21, 25, 14, 31, 21,
    ]);
    expect(pool.stats()).toMatchObject({
      allocations: 1,
      leasedSurfaceCount: 0,
    });
  });

  it("honors transform origins when cropping transformed isolated ink", () => {
    const { pool, target } = createScratchRenderHarness();
    renderStill(
      target.context,
      sceneWith({
        id: "rotated",
        type: "div",
        style: {
          position: "absolute",
          left: 50,
          top: 40,
          width: 20,
          height: 10,
          backgroundColor: "#ffffff",
          isolation: true,
          transform: "rotate(90deg)",
          transformOrigin: "left top",
        },
      }) as never,
      0,
      { scratchSurfacePool: pool },
    );

    expect(target.drawImages[0]!.slice(1)).toEqual([
      0, 0, 10, 20, 40, 40, 10, 20,
    ]);
  });

  it("unions descendant transformed bounds and leases nested isolation safely", () => {
    const { pool, surfaces, target } = createScratchRenderHarness();
    const scene = sceneWith({
      id: "outer",
      type: "div",
      style: {
        position: "absolute",
        left: 10,
        top: 10,
        width: 20,
        height: 20,
        backgroundColor: "#111111",
        isolation: true,
      },
      children: [
        {
          id: "inner",
          type: "div",
          style: {
            position: "absolute",
            left: 40,
            top: 5,
            width: 10,
            height: 10,
            backgroundColor: "#ffffff",
            isolation: true,
          },
        },
      ],
    });

    renderStill(target.context, scene as never, 0, {
      scratchSurfacePool: pool,
    });
    expect(target.drawImages[0]!.slice(1)).toEqual([
      0, 0, 50, 20, 10, 10, 50, 20,
    ]);
    expect(surfaces[0]!.drawImages[0]!.slice(1)).toEqual([
      0, 0, 10, 10, 50, 15, 10, 10,
    ]);
    expect(pool.stats()).toMatchObject({
      allocations: 2,
      leasedSurfaceCount: 0,
      idleSurfaceCount: 2,
    });

    renderStill(target.context, scene as never, 0, {
      scratchSurfacePool: pool,
    });
    expect(pool.stats()).toMatchObject({
      allocations: 2,
      reuses: 2,
      leasedSurfaceCount: 0,
    });
  });

  it("includes border, stroke, text-shadow, box-shadow, and filter ink margins", () => {
    const cases = [
      {
        node: {
          id: "border",
          type: "div",
          style: {
            position: "absolute",
            left: 50,
            top: 40,
            width: 20,
            height: 10,
            border: "4px solid #fff",
            isolation: true,
          },
        },
        crop: [0, 0, 24, 14, 48, 38, 24, 14],
      },
      {
        node: {
          id: "stroke",
          type: "shape",
          shape: {
            kind: "line",
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
          style: {
            position: "absolute",
            left: 50,
            top: 40,
            width: 20,
            height: 10,
            strokeWidth: 4,
            isolation: true,
          },
        },
        crop: [0, 0, 60, 50, 30, 20, 60, 50],
      },
      {
        node: {
          id: "text-shadow",
          type: "text",
          text: "x",
          style: {
            position: "absolute",
            left: 50,
            top: 40,
            width: 20,
            height: 10,
            fontSize: 20,
            textShadow: "10px -4px 6px #000",
            isolation: true,
          },
        },
        crop: [0, 0, 36, 46, 47, 12, 36, 46],
      },
      {
        node: {
          id: "filtered-shadow",
          type: "div",
          style: {
            position: "absolute",
            left: 50,
            top: 40,
            width: 20,
            height: 10,
            backgroundColor: "#fff",
            boxShadow: "-3px 5px 4px #000",
            filter: "blur(2px)",
            isolation: true,
          },
        },
        crop: [0, 0, 48, 38, 33, 31, 48, 38],
      },
    ];

    vi.stubGlobal(
      "Path2D",
      class {
        rect() {}
        moveTo() {}
        lineTo() {}
        closePath() {}
      },
    );
    try {
      for (const { node, crop } of cases) {
        const { pool, target } = createScratchRenderHarness();
        renderStill(target.context, sceneWith(node) as never, 0, {
          scratchSurfacePool: pool,
        });
        expect(target.drawImages[0]!.slice(1), node.id).toEqual(crop);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("bounds inverted feather masks and composites only their requested rect", () => {
    vi.stubGlobal(
      "Path2D",
      class {
        rect() {}
        addPath() {}
      },
    );
    try {
      const { pool, surfaces, target } = createScratchRenderHarness();
      renderStill(
        target.context,
        sceneWith({
          id: "masked",
          type: "div",
          mask: {
            shape: { kind: "rect" },
            inverted: true,
            opacity: 0.5,
            feather: 4,
          },
          style: {
            position: "absolute",
            left: 50,
            top: 30,
            width: 20,
            height: 10,
            backgroundColor: "#fff",
            isolation: true,
          },
        }) as never,
        0,
        { scratchSurfacePool: pool },
      );

      expect(target.drawImages[0]!.slice(1)).toEqual([
        0, 0, 44, 34, 38, 18, 44, 34,
      ]);
      expect(surfaces[0]!.drawImages[0]!.slice(1)).toEqual([
        0, 0, 44, 34, 0, 0, 44, 34,
      ]);
      expect(surfaces[1]!.context.fillRect).toHaveBeenCalledWith(0, 0, 44, 34);
      expect(pool.stats()).toMatchObject({
        allocations: 2,
        leasedSurfaceCount: 0,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps filtered soft-mask buckets independent of larger idle history", () => {
    const node = {
      id: "history-independent",
      type: "div",
      style: {
        position: "absolute",
        left: 50,
        top: 40,
        width: 20,
        height: 10,
        backgroundColor: "#fff",
        filter: "blur(2px)",
        isolation: true,
      },
      mask: { shape: { kind: "rect" }, feather: 2 },
    };
    vi.stubGlobal(
      "Path2D",
      class {
        rect() {}
        moveTo() {}
        lineTo() {}
        closePath() {}
      },
    );
    try {
      const polluted = createScratchRenderHarness();
      const large = polluted.pool.acquire({
        width: 65,
        height: 65,
        purpose: "unrelated-history",
      });
      large.release();
      const fresh = createScratchRenderHarness();

      renderStill(polluted.target.context, sceneWith(node) as never, 0, {
        scratchSurfacePool: polluted.pool,
      });
      renderStill(fresh.target.context, sceneWith(node) as never, 0, {
        scratchSurfacePool: fresh.pool,
      });

      expect(polluted.target.drawImages[0]!.slice(1)).toEqual(
        fresh.target.drawImages[0]!.slice(1),
      );
      expect(polluted.surfaces[0]).toMatchObject({ width: 128, height: 128 });
      expect(
        polluted.surfaces.slice(1).map(({ width, height }) => [width, height]),
      ).toEqual([
        [64, 64],
        [64, 64],
      ]);
      expect(polluted.pool.stats()).toMatchObject({
        allocations: 3,
        reuses: 0,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("reuses one lease across multi-shadow layers and composites exact source rects", () => {
    const { pool, target } = createScratchRenderHarness();
    renderStill(
      target.context,
      sceneWith({
        id: "shadowed",
        type: "div",
        style: {
          position: "absolute",
          left: 50,
          top: 40,
          width: 20,
          height: 10,
          backgroundColor: "#fff",
          boxShadow: "0 2px 2px #000, -3px 0 1px #fff",
        },
      }) as never,
      0,
      { scratchSurfacePool: pool },
    );

    expect(target.drawImages.map((args) => args.slice(1))).toEqual([
      [0, 0, 32, 22, 44, 34, 32, 22],
      [0, 0, 30, 20, 45, 35, 30, 20],
    ]);
    expect(pool.stats()).toMatchObject({
      allocations: 1,
      reuses: 1,
      leasedSurfaceCount: 0,
    });
  });

  it("poisons a multi-shadow staging lease when compositing fails", () => {
    const { pool, target } = createScratchRenderHarness();
    target.context.drawImage = () => {
      throw new Error("shadow composite failed");
    };

    expect(() =>
      renderStill(
        target.context,
        sceneWith({
          id: "shadowed",
          type: "div",
          style: {
            width: 20,
            height: 10,
            backgroundColor: "#fff",
            boxShadow: "0 2px 2px #000, -3px 0 1px #fff",
          },
        }) as never,
        0,
        { scratchSurfacePool: pool },
      ),
    ).toThrow("shadow composite failed");
    expect(pool.stats()).toMatchObject({
      surfaceCount: 0,
      leasedSurfaceCount: 0,
      poisonedReleases: 1,
    });
  });

  it("poisons pixelation staging when the scaled composite fails", () => {
    const { pool, target } = createScratchRenderHarness();
    target.context.drawImage = () => {
      throw new Error("pixel composite failed");
    };
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {
        clip: { id: "clip", type: "video", src: "blob:fake" },
      },
      nodes: [
        {
          id: "shot",
          type: "video",
          assetId: "clip",
          style: {
            width: 100,
            height: 100,
            imageRendering: "pixelated",
            pixelSize: 10,
          },
        },
      ],
    };
    const source = { width: 100, height: 100 } as HTMLCanvasElement;
    const assets = {
      videoFrames: new Map([
        ["shot", { image: source, width: 100, height: 100, sceneFrame: 0 }],
      ]),
    };

    expect(() =>
      renderStill(target.context, scene as never, 0, {
        assets: assets as never,
        scratchSurfacePool: pool,
      }),
    ).toThrow("pixel composite failed");
    expect(pool.stats()).toMatchObject({
      surfaceCount: 0,
      leasedSurfaceCount: 0,
      poisonedReleases: 1,
    });
  });

  it("falls back to the full scene for legacy opaque extensions", async () => {
    const registry = createExtensionRegistry([
      defineExtension({
        name: "com.example.opaque",
        version: "1.0.0",
        paramsSchema: z.object({}),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: { draw: () => undefined } },
      }),
    ]);
    const scene = sceneWith({
      id: "opaque",
      type: "extension",
      extension: {
        name: "com.example.opaque",
        version: "1.0.0",
        params: {},
      },
      style: {
        position: "absolute",
        left: 80,
        top: 50,
        width: 10,
        height: 10,
        isolation: true,
      },
    });
    const assets = await resolveAssets(scene as never, {
      extensions: registry,
    });
    const { pool, target } = createScratchRenderHarness();
    try {
      renderStill(target.context, scene as never, 0, {
        assets,
        scratchSurfacePool: pool,
      });
      expect(target.drawImages[0]!.slice(1)).toEqual([
        0, 0, 200, 120, 0, 0, 200, 120,
      ]);
    } finally {
      await disposeAssetsAsync(assets);
    }
  });

  it("poisons failed draw leases and never leaves a surface leased", async () => {
    const registry = createExtensionRegistry([
      defineExtension({
        name: "com.example.throwing",
        version: "1.0.0",
        paramsSchema: z.object({}),
        deterministic: true,
        workerCompatible: true,
        renderers: {
          canvas2d: {
            draw: () => {
              throw new Error("adapter draw failed");
            },
          },
        },
      }),
    ]);
    const scene = sceneWith({
      id: "throwing",
      type: "extension",
      extension: {
        name: "com.example.throwing",
        version: "1.0.0",
        params: {},
      },
      style: { width: 10, height: 10, isolation: true },
    });
    const assets = await resolveAssets(scene as never, {
      extensions: registry,
    });
    const { pool, target } = createScratchRenderHarness();
    try {
      expect(() =>
        renderStill(target.context, scene as never, 0, {
          assets,
          scratchSurfacePool: pool,
        }),
      ).toThrow("adapter draw failed");
      expect(pool.stats()).toMatchObject({
        surfaceCount: 0,
        leasedSurfaceCount: 0,
        poisonedReleases: 1,
      });
    } finally {
      await disposeAssetsAsync(assets);
    }
  });
});

describe("renderStill", () => {
  it("exports a callable browser renderer", () => {
    expect(typeof renderStill).toBe("function");
    expect(sampleScene().width).toBe(1080);
  });

  it("rejects non-string transform values before rendering", () => {
    const context = {
      globalAlpha: 1,
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
      fillRect: () => undefined,
      translate: () => undefined,
      scale: () => undefined,
      rotate: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "box",
          type: "div",
          style: {
            width: 20,
            height: 20,
          },
          animations: [
            {
              kind: "keyframes",
              property: "transform",
              frames: [{ frame: 0, value: 1.1 }],
            },
          ],
        },
      ],
    };

    expect(() => renderStill(context, scene as never, 0)).toThrow(
      "Expected string",
    );
  });

  it("rejects invalid font descriptors before mutating Canvas font state", () => {
    let fontAssignments = 0;
    const context = {
      globalAlpha: 1,
      get font() {
        return "normal 400 10px sans-serif";
      },
      set font(_value: string) {
        fontAssignments += 1;
      },
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "bad-font",
          type: "text",
          text: "stale",
          style: { fontWeight: "banana" },
        },
      ],
    };

    expect(() => renderStill(context, scene as never, 0)).toThrow(
      "Expected normal/bold/bolder/lighter",
    );
    expect(fontAssignments).toBe(0);
  });

  it("applies validated transform-origin components to the resolved box", () => {
    const translations: Array<[number, number]> = [];
    const context = {
      globalAlpha: 1,
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
      translate: (x: number, y: number) => translations.push([x, y]),
      rotate: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    renderStill(
      context,
      {
        schemaVersion: 1,
        width: 100,
        height: 80,
        fps: 30,
        duration: 1,
        assets: {},
        nodes: [
          {
            id: "box",
            type: "div",
            style: {
              width: 100,
              height: 80,
              transform: "rotate(10deg)",
              transformOrigin: "left bottom",
            },
          },
        ],
      },
      0,
    );
    expect(translations).toEqual([
      [0, 80],
      [-0, -80],
    ]);
  });

  it("runs the extension resolve, prepare, draw, and dispose lifecycle", async () => {
    const events: string[] = [];
    const draws: Array<{ color: string; phase: number; width: number }> = [];
    const adapter: Canvas2DExtensionAdapter = {
      draw: ({ box, params, preparedFrame, resolvedAssets }) => {
        draws.push({
          color: (params as { color: string }).color,
          phase: preparedFrame as number,
          width:
            box.width + (resolvedAssets as { widthOffset: number }).widthOffset,
        });
        events.push("draw");
      },
    };
    const registry = createExtensionRegistry([
      defineExtension({
        name: "com.example.grid",
        version: "1.0.0",
        paramsSchema: z.object({ color: z.string() }),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: adapter },
        resolveAssets: () => {
          events.push("resolve");
          return { widthOffset: 5 };
        },
        prepareFrame: ({ localFrame }) => {
          events.push(`prepare:${localFrame}`);
          return localFrame;
        },
        disposeAssets: () => {
          events.push("dispose");
        },
      }),
    ]);
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 60,
      fps: 30,
      duration: 10,
      assets: {},
      nodes: [
        {
          id: "grid",
          type: "extension",
          extension: {
            name: "com.example.grid",
            version: "1.0.0",
            params: { color: "#22d3ee" },
          },
          style: { width: 40, height: 20 },
        },
      ],
    };
    const context = {
      globalAlpha: 1,
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
    } as unknown as CanvasRenderingContext2D;

    const assets = await resolveAssets(scene as never, {
      extensions: registry,
    });
    const resolvedScene = await prepareFrame(scene as never, 3, assets);
    renderStill(context, scene as never, 3, { assets, resolvedScene });
    await disposeAssetsAsync(assets);

    expect(events).toEqual(["resolve", "prepare:3", "draw", "dispose"]);
    expect(draws).toEqual([{ color: "#22d3ee", phase: 3, width: 45 }]);
  });

  it("reuses opted-in extension resources across unrelated edits and disposes the final owner once", async () => {
    let resolutions = 0;
    const disposed: number[] = [];
    const adapter = { draw: () => undefined };
    const registry = createExtensionRegistry([
      defineExtension({
        name: "com.example.reusable",
        version: "1.0.0",
        paramsSchema: z.object({ variant: z.string() }),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: adapter },
        reuseKey: ({ params }) => `variant:${params.variant}`,
        reuseSafety: "immutable",
        resolveAssets: () => ({ lease: ++resolutions }),
        disposeAssets: (value) => {
          disposed.push(value.lease);
        },
      }),
    ]);
    const before = {
      schemaVersion: 1,
      width: 64,
      height: 64,
      fps: 30,
      duration: 2,
      assets: {},
      nodes: [
        {
          id: "reusable",
          type: "extension",
          extension: {
            name: "com.example.reusable",
            version: "1.0.0",
            params: { variant: "blue" },
          },
          style: { width: 20, height: 20 },
        },
      ],
    };
    const after = {
      ...before,
      duration: 3,
      nodes: before.nodes.map((node) => ({
        ...node,
        style: { ...node.style, left: 10 },
      })),
    };
    const first = await resolveAssets(before as never, {
      extensions: registry,
    });
    const second = await resolveAssets(after as never, {
      extensions: registry,
      reuseFrom: { scene: before, assets: first },
    });
    expect(resolutions).toBe(1);
    expect(second.extensionNodes?.get("reusable")?.resolvedAssets).toBe(
      first.extensionNodes?.get("reusable")?.resolvedAssets,
    );

    await disposeAssetsAsync(first);
    expect(disposed).toEqual([]);
    const once = disposeAssetsAsync(second);
    const twice = disposeAssetsAsync(second);
    expect(twice).toBe(once);
    await once;
    expect(disposed).toEqual([1]);
  });

  it("reacquires extension resources when its key or required asset identity changes", async () => {
    let resolutions = 0;
    const disposed: number[] = [];
    const decoded: Array<{ close: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        const image = { width: 1, height: 1, close: vi.fn() };
        decoded.push(image);
        return image;
      }),
    );
    try {
      const registry = createExtensionRegistry([
        defineExtension({
          name: "com.example.asset-reuse",
          version: "1.0.0",
          paramsSchema: z.object({
            assetId: z.string(),
            resourceVersion: z.string(),
          }),
          deterministic: true,
          workerCompatible: true,
          renderers: { canvas2d: { draw: () => undefined } },
          assets: ({ params }) => [
            { assetId: params.assetId, type: "image" as const },
          ],
          reuseKey: ({ params }) => params.resourceVersion,
          reuseSafety: "immutable",
          resolveAssets: () => ({ lease: ++resolutions }),
          disposeAssets: (value) => {
            disposed.push(value.lease);
          },
        }),
      ]);
      const makeScene = (src: string, resourceVersion: string) => ({
        schemaVersion: 1,
        width: 16,
        height: 16,
        fps: 30,
        duration: 1,
        assets: {
          texture: { id: "texture", type: "image", src },
        },
        nodes: [
          {
            id: "asset-reuse",
            type: "extension",
            extension: {
              name: "com.example.asset-reuse",
              version: "1.0.0",
              params: { assetId: "texture", resourceVersion },
            },
          },
        ],
      });
      const firstScene = makeScene("data:image/png;base64,AA==", "v1");
      const first = await resolveAssets(firstScene as never, {
        extensions: registry,
      });
      const keyChangedScene = makeScene("data:image/png;base64,AA==", "v2");
      const keyChanged = await resolveAssets(keyChangedScene as never, {
        extensions: registry,
        reuseFrom: { scene: firstScene, assets: first },
      });
      const assetChangedScene = makeScene("data:image/png;base64,AQ==", "v2");
      const assetChanged = await resolveAssets(assetChangedScene as never, {
        extensions: registry,
        reuseFrom: { scene: keyChangedScene, assets: keyChanged },
      });

      expect(resolutions).toBe(3);
      expect(
        keyChanged.extensionNodes?.get("asset-reuse")?.resolvedAssets,
      ).not.toBe(first.extensionNodes?.get("asset-reuse")?.resolvedAssets);
      expect(
        assetChanged.extensionNodes?.get("asset-reuse")?.resolvedAssets,
      ).not.toBe(keyChanged.extensionNodes?.get("asset-reuse")?.resolvedAssets);
      expect(decoded).toHaveLength(2);
      await Promise.all([
        disposeAssetsAsync(first),
        disposeAssetsAsync(keyChanged),
        disposeAssetsAsync(assetChanged),
      ]);
      expect(disposed.sort()).toEqual([1, 2, 3]);
      expect(
        decoded.every((image) => image.close.mock.calls.length === 1),
      ).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rolls a retained extension reference back after sibling failure without poisoning the old owner", async () => {
    let resolutions = 0;
    const disposed: number[] = [];
    const reusable = defineExtension({
      name: "com.example.rollback-reuse",
      version: "1.0.0",
      paramsSchema: z.object({}),
      deterministic: true,
      workerCompatible: true,
      renderers: { canvas2d: { draw: () => undefined } },
      reuseKey: () => "stable",
      reuseSafety: "immutable",
      resolveAssets: () => ({ lease: ++resolutions }),
      disposeAssets: (value) => {
        disposed.push(value.lease);
      },
    });
    const failing = defineExtension({
      name: "com.example.rollback-failure",
      version: "1.0.0",
      paramsSchema: z.object({}),
      deterministic: true,
      workerCompatible: true,
      renderers: { canvas2d: { draw: () => undefined } },
      resolveAssets: async () => {
        await Promise.resolve();
        throw new Error("reuse successor failed");
      },
    });
    const registry = createExtensionRegistry([reusable, failing]);
    const baseNode = {
      id: "rollback-reuse",
      type: "extension",
      extension: {
        name: "com.example.rollback-reuse",
        version: "1.0.0",
        params: {},
      },
    };
    const baseScene = {
      schemaVersion: 1,
      width: 16,
      height: 16,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [baseNode],
    };
    const first = await resolveAssets(baseScene as never, {
      extensions: registry,
    });
    const failedScene = {
      ...baseScene,
      nodes: [
        baseNode,
        {
          id: "rollback-failure",
          type: "extension",
          extension: {
            name: "com.example.rollback-failure",
            version: "1.0.0",
            params: {},
          },
        },
      ],
    };
    await expect(
      resolveAssets(failedScene as never, {
        extensions: registry,
        reuseFrom: { scene: baseScene, assets: first },
      }),
    ).rejects.toThrow("reuse successor failed");
    expect(disposed).toEqual([]);

    const successor = await resolveAssets(baseScene as never, {
      extensions: registry,
      reuseFrom: { scene: baseScene, assets: first },
    });
    expect(resolutions).toBe(1);
    await disposeAssetsAsync(first);
    expect(disposed).toEqual([]);
    await disposeAssetsAsync(successor);
    expect(disposed).toEqual([1]);
  });

  it("keeps legacy extensions without reuseKey independently owned", async () => {
    let resolutions = 0;
    const disposed: number[] = [];
    const registry = createExtensionRegistry([
      defineExtension({
        name: "com.example.legacy-resource",
        version: "1.0.0",
        paramsSchema: z.object({}),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: { draw: () => undefined } },
        resolveAssets: () => ({ lease: ++resolutions }),
        disposeAssets: (value) => {
          disposed.push(value.lease);
        },
      }),
    ]);
    const scene = {
      schemaVersion: 1,
      width: 16,
      height: 16,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "legacy-resource",
          type: "extension",
          extension: {
            name: "com.example.legacy-resource",
            version: "1.0.0",
            params: {},
          },
        },
      ],
    };
    const first = await resolveAssets(scene as never, { extensions: registry });
    const second = await resolveAssets(scene as never, {
      extensions: registry,
      reuseFrom: { scene, assets: first },
    });
    expect(resolutions).toBe(2);
    expect(
      second.extensionNodes?.get("legacy-resource")?.resolvedAssets,
    ).not.toBe(first.extensionNodes?.get("legacy-resource")?.resolvedAssets);
    await Promise.all([disposeAssetsAsync(first), disposeAssetsAsync(second)]);
    expect(disposed.sort()).toEqual([1, 2]);
  });

  it("fails before rendering when an extension is not installed", async () => {
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 60,
      fps: 30,
      duration: 10,
      assets: {},
      nodes: [
        {
          id: "missing",
          type: "extension",
          extension: {
            name: "com.example.missing",
            version: "1.0.0",
            params: {},
          },
        },
      ],
    };

    await expect(resolveAssets(scene as never)).rejects.toThrow(
      /extension_not_installed/,
    );
  });

  it("rolls back successfully prepared sibling extensions after partial failure", async () => {
    const events: string[] = [];
    const registry = createExtensionRegistry([
      defineExtension({
        name: "com.example.ready",
        version: "1.0.0",
        paramsSchema: z.object({}),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: { draw: () => undefined } },
        resolveAssets: () => {
          events.push("ready");
          return { lease: true };
        },
        disposeAssets: async () => {
          await Promise.resolve();
          events.push("disposed");
        },
      }),
      defineExtension({
        name: "com.example.failed",
        version: "1.0.0",
        paramsSchema: z.object({}),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: { draw: () => undefined } },
        resolveAssets: async () => {
          await Promise.resolve();
          throw new Error("partial failure");
        },
      }),
    ]);
    const scene = {
      schemaVersion: 1,
      width: 10,
      height: 10,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "ready",
          type: "extension",
          extension: {
            name: "com.example.ready",
            version: "1.0.0",
            params: {},
          },
        },
        {
          id: "failed",
          type: "extension",
          extension: {
            name: "com.example.failed",
            version: "1.0.0",
            params: {},
          },
        },
      ],
    };

    await expect(
      resolveAssets(scene as never, { extensions: registry }),
    ).rejects.toThrow("partial failure");
    expect(events).toEqual(["ready", "disposed"]);
  });

  it("cancels in-flight extension resolution and rolls back acquired siblings", async () => {
    const controller = new AbortController();
    const events: string[] = [];
    let started!: () => void;
    const waiting = new Promise<void>((resolve) => {
      started = resolve;
    });
    const registry = createExtensionRegistry([
      defineExtension({
        name: "com.example.acquired",
        version: "1.0.0",
        paramsSchema: z.object({}),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: { draw: () => undefined } },
        resolveAssets: () => ({ acquired: true }),
        disposeAssets: () => {
          events.push("disposed");
        },
      }),
      defineExtension({
        name: "com.example.waiting",
        version: "1.0.0",
        paramsSchema: z.object({}),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: { draw: () => undefined } },
        resolveAssets: ({ signal }) =>
          new Promise((_resolve, reject) => {
            started();
            signal?.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            });
          }),
      }),
    ]);
    const scene = {
      schemaVersion: 1,
      width: 10,
      height: 10,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "acquired",
          type: "extension",
          extension: {
            name: "com.example.acquired",
            version: "1.0.0",
            params: {},
          },
        },
        {
          id: "waiting",
          type: "extension",
          extension: {
            name: "com.example.waiting",
            version: "1.0.0",
            params: {},
          },
        },
      ],
    };

    const resolution = resolveAssets(scene as never, {
      extensions: registry,
      signal: controller.signal,
    });
    await waiting;
    controller.abort(new Error("cancel resolution"));
    await expect(resolution).rejects.toThrow("cancel resolution");
    expect(events).toEqual(["disposed"]);
  });

  it("rejects corrupt media without a later unhandled demux rejection", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      await expect(
        resolveAssets({
          schemaVersion: 1,
          width: 10,
          height: 10,
          fps: 30,
          duration: 1,
          assets: {
            bad: {
              id: "bad",
              type: "video",
              src: "data:text/plain;base64,YmFk",
              sourceMode: "buffer",
            },
          },
          nodes: [{ id: "bad", type: "video", assetId: "bad" }],
        } as never),
      ).rejects.toThrow(/unsupported|unrecognizable/i);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("preserves fetched image MIME when constructing the bounded Blob", async () => {
    const decode = vi.fn(async (blob: Blob) => ({
      width: 1,
      height: 1,
      close: () => undefined,
      type: blob.type,
    }));
    vi.stubGlobal("createImageBitmap", decode);
    try {
      const assets = await resolveAssets({
        schemaVersion: 1,
        width: 1,
        height: 1,
        fps: 30,
        duration: 1,
        assets: {
          badge: {
            id: "badge",
            type: "image",
            src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
          },
        },
        nodes: [{ id: "badge", type: "img", assetId: "badge" }],
      } as never);
      expect((decode.mock.calls[0]?.[0] as Blob).type).toBe("image/svg+xml");
      await disposeAssetsAsync(assets);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("awaits cursor shutdown before inputs and makes disposal idempotent", async () => {
    const events: string[] = [];
    const assets = {
      images: new Map(),
      fonts: new Map(),
      videos: new Map([
        [
          "clip",
          {
            input: { dispose: () => events.push("input") },
          },
        ],
      ]),
      videoFrames: new Map(),
      videoCursors: new Map([
        [
          "node\u0000clip",
          {
            dispose: async () => {
              await Promise.resolve();
              events.push("cursor");
            },
          },
        ],
      ]),
      audio: new Map(),
      lotties: new Map(),
      lottieFrames: new Map(),
    };

    const first = disposeAssetsAsync(assets as never);
    const second = disposeAssetsAsync(assets as never);
    expect(second).toBe(first);
    await first;
    expect(events).toEqual(["cursor", "input"]);
  });

  it("serializes frame preparation for one resolved-asset lease", async () => {
    const frames: number[] = [];
    const releases: Array<() => void> = [];
    let active = 0;
    let maxActive = 0;
    const registry = createExtensionRegistry([
      defineExtension({
        name: "com.example.serial",
        version: "1.0.0",
        paramsSchema: z.object({}),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: { draw: () => undefined } },
        prepareFrame: ({ frame }) =>
          new Promise<number>((resolve) => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            frames.push(frame);
            releases.push(() => {
              active -= 1;
              resolve(frame);
            });
          }),
      }),
    ]);
    const scene = {
      schemaVersion: 1,
      width: 10,
      height: 10,
      fps: 30,
      duration: 4,
      assets: {},
      nodes: [
        {
          id: "serial",
          type: "extension",
          extension: {
            name: "com.example.serial",
            version: "1.0.0",
            params: {},
          },
        },
      ],
    };
    const assets = await resolveAssets(scene as never, {
      extensions: registry,
    });
    const first = prepareFrame(scene as never, 1, assets);
    const second = prepareFrame(scene as never, 2, assets);
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
    expect(frames).toEqual([1]);
    releases.shift()?.();
    await first;
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
    expect(frames).toEqual([1, 2]);
    releases.shift()?.();
    await second;

    expect(maxActive).toBe(1);
    expect(assets.extensionFrames?.get("serial")?.sceneFrame).toBe(2);
    await disposeAssetsAsync(assets);
  });

  it("keeps the queue tail locked when a middle frame is aborted", async () => {
    const frames: number[] = [];
    const releases: Array<() => void> = [];
    const registry = createExtensionRegistry([
      defineExtension({
        name: "com.example.abort-queue",
        version: "1.0.0",
        paramsSchema: z.object({}),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: { draw: () => undefined } },
        prepareFrame: ({ frame }) =>
          new Promise<number>((resolve) => {
            frames.push(frame);
            releases.push(() => resolve(frame));
          }),
      }),
    ]);
    const scene = {
      schemaVersion: 1,
      width: 10,
      height: 10,
      fps: 30,
      duration: 5,
      assets: {},
      nodes: [
        {
          id: "queue",
          type: "extension",
          extension: {
            name: "com.example.abort-queue",
            version: "1.0.0",
            params: {},
          },
        },
      ],
    };
    const assets = await resolveAssets(scene as never, {
      extensions: registry,
    });
    const first = prepareFrame(scene as never, 1, assets);
    const middleController = new AbortController();
    const middle = prepareFrame(scene as never, 2, assets, {
      signal: middleController.signal,
    });
    const last = prepareFrame(scene as never, 3, assets);
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
    middleController.abort(new Error("skip middle"));
    await expect(middle).rejects.toThrow("skip middle");
    expect(frames).toEqual([1]);

    releases.shift()?.();
    await first;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(frames).toEqual([1, 3]);
    releases.shift()?.();
    await last;
    await disposeAssetsAsync(assets);
  });

  it("waits for started frame tasks after a later traversal failure", async () => {
    const events: string[] = [];
    const registry = createExtensionRegistry([
      defineExtension({
        name: "com.example.started",
        version: "1.0.0",
        paramsSchema: z.object({}),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: { draw: () => undefined } },
        prepareFrame: ({ signal }) =>
          new Promise<void>((resolve) => {
            signal?.addEventListener(
              "abort",
              () => {
                queueMicrotask(() => {
                  events.push("started-settled");
                  resolve();
                });
              },
              { once: true },
            );
          }),
      }),
      defineExtension({
        name: "com.example.removed",
        version: "1.0.0",
        paramsSchema: z.object({}),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: { draw: () => undefined } },
      }),
    ]);
    const scene = {
      schemaVersion: 1,
      width: 10,
      height: 10,
      fps: 30,
      duration: 2,
      assets: {},
      nodes: [
        {
          id: "started",
          type: "extension",
          extension: {
            name: "com.example.started",
            version: "1.0.0",
            params: {},
          },
        },
        {
          id: "removed",
          type: "extension",
          extension: {
            name: "com.example.removed",
            version: "1.0.0",
            params: {},
          },
        },
      ],
    };
    const assets = await resolveAssets(scene as never, {
      extensions: registry,
    });
    assets.extensionNodes?.delete("removed");

    await expect(prepareFrame(scene as never, 1, assets)).rejects.toThrow(
      /was not resolved/,
    );
    expect(events).toEqual(["started-settled"]);
    await disposeAssetsAsync(assets);
  });
});

describe("wrapTextLines", () => {
  it("keeps short text on a single line", () => {
    expect(wrapTextLines("hello world", 200, measure)).toEqual(["hello world"]);
  });

  it("always breaks on explicit newlines", () => {
    expect(wrapTextLines("one\ntwo three", 1000, measure)).toEqual([
      "one",
      "two three",
    ]);
  });

  it("preserves empty lines from consecutive newlines", () => {
    expect(wrapTextLines("one\n\ntwo", 1000, measure)).toEqual([
      "one",
      "",
      "two",
    ]);
  });

  it("wraps words when a line would exceed maxWidth", () => {
    // "aaaa bbbb" measures 90px; maxWidth 50 fits one 4-char word per line.
    expect(wrapTextLines("aaaa bbbb cccc", 50, measure)).toEqual([
      "aaaa",
      "bbbb",
      "cccc",
    ]);
  });

  it("packs as many words as fit before breaking", () => {
    expect(wrapTextLines("aa bb cc dd", 60, measure)).toEqual([
      "aa bb",
      "cc dd",
    ]);
  });

  it("breaks an overlong single word by grapheme instead of squishing", () => {
    expect(wrapTextLines("tiny enormousword tiny", 60, measure)).toEqual([
      "tiny",
      "enormo",
      "usword",
      "tiny",
    ]);
  });

  it("collapses runs of whitespace like HTML text rendering", () => {
    expect(wrapTextLines("one   two", 1000, measure)).toEqual(["one two"]);
  });
});

describe("computeObjectFit", () => {
  const box = { width: 200, height: 100 };
  const landscape = { width: 400, height: 100 };
  const square = { width: 50, height: 50 };

  it("fill stretches to the box by default", () => {
    expect(computeObjectFit(undefined, undefined, box, square)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
  });

  it("contain letterboxes and centers by default", () => {
    // 400x100 into 200x100: scale 0.5 -> 200x50, centered vertically.
    expect(computeObjectFit("contain", undefined, box, landscape)).toEqual({
      x: 0,
      y: 25,
      width: 200,
      height: 50,
    });
  });

  it("cover overflows the short axis and honors objectPosition keywords", () => {
    // 50x50 into 200x100: cover scale 4 -> 200x200; "left top" pins origin.
    expect(computeObjectFit("cover", "left top", box, square)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    expect(computeObjectFit("cover", "bottom right", box, square)).toEqual({
      x: 0,
      y: -100,
      width: 200,
      height: 200,
    });
  });

  it("none keeps natural size and supports percentage positions", () => {
    // 50x50 at natural size; 100% x -> right edge, 50% y -> centered.
    expect(computeObjectFit("none", "100% 50%", box, square)).toEqual({
      x: 150,
      y: 25,
      width: 50,
      height: 50,
    });
  });

  it("scale-down never upscales but shrinks like contain", () => {
    expect(computeObjectFit("scale-down", undefined, box, square)).toEqual({
      x: 75,
      y: 25,
      width: 50,
      height: 50,
    });
    expect(computeObjectFit("scale-down", undefined, box, landscape)).toEqual({
      x: 0,
      y: 25,
      width: 200,
      height: 50,
    });
  });
});

describe("renderStill with image nodes", () => {
  it("fails loudly when an img node has no resolved asset", () => {
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {
        pic: { id: "pic", type: "image", src: "data:image/png;base64,x" },
      },
      nodes: [{ id: "shot", type: "img", assetId: "pic" }],
    };

    // Minimal context stub: the error must fire before any drawing happens.
    const context = {
      globalAlpha: 1,
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
    } as unknown as CanvasRenderingContext2D;

    expect(() => renderStill(context, scene as never, 0)).toThrow(
      /resolveAssets\(scene\)/,
    );
  });
});

describe("renderStill with effect nodes", () => {
  it("draws cartoonBurst without resolved assets", () => {
    const calls: string[] = [];
    const context = {
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      clearRect: () => calls.push("clearRect"),
      beginPath: () => calls.push("beginPath"),
      arc: () => calls.push("arc"),
      ellipse: () => calls.push("ellipse"),
      fill: () => calls.push("fill"),
      stroke: () => calls.push("stroke"),
      translate: () => undefined,
      rotate: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      arcTo: () => undefined,
      closePath: () => undefined,
      fillText: () => calls.push("fillText"),
      fillRect: () => undefined,
      strokeRect: () => undefined,
      measureText: (line: string) => ({ width: line.length * 10 }),
    } as unknown as CanvasRenderingContext2D;
    const scene = {
      schemaVersion: 1,
      width: 400,
      height: 400,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "boom",
          type: "effect",
          effect: "cartoonBurst",
          duration: 30,
          style: {
            position: "absolute",
            left: 100,
            top: 100,
            width: 200,
            height: 200,
          },
          params: {
            seed: 7,
            particleCount: 8,
            emoji: "!",
          },
        },
      ],
    };

    renderStill(context, scene as never, 10);

    expect(calls).toContain("arc");
    expect(calls).toContain("fill");
    expect(calls).toContain("fillText");
  });

  it("restores nested effect state after a draw failure and permits a clean retry", () => {
    type Snapshot = {
      globalAlpha: number;
      globalCompositeOperation: GlobalCompositeOperation;
      fillStyle: string | CanvasGradient | CanvasPattern;
      lineWidth: number;
    };
    const stack: Snapshot[] = [];
    let maxDepth = 0;
    let failMove = true;
    const state = {
      globalAlpha: 0.37,
      globalCompositeOperation: "xor" as GlobalCompositeOperation,
      fillStyle: "#caller",
      lineWidth: 17,
      save() {
        stack.push({
          globalAlpha: state.globalAlpha,
          globalCompositeOperation: state.globalCompositeOperation,
          fillStyle: state.fillStyle,
          lineWidth: state.lineWidth,
        });
        maxDepth = Math.max(maxDepth, stack.length);
      },
      restore() {
        const snapshot = stack.pop();
        if (!snapshot) throw new Error("unmatched restore");
        Object.assign(state, snapshot);
      },
      clearRect: () => undefined,
      beginPath: () => undefined,
      arc: () => undefined,
      fill: () => undefined,
      stroke: () => undefined,
      translate: () => undefined,
      rotate: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      fillText: () => undefined,
      moveTo() {
        if (failMove) {
          failMove = false;
          throw new Error("primitive failed");
        }
      },
    };
    const context = state as unknown as CanvasRenderingContext2D;
    const scene = {
      schemaVersion: 1,
      width: 200,
      height: 200,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "boom",
          type: "effect",
          effect: "cartoonBurst",
          duration: 30,
          style: { width: 200, height: 200 },
          params: { shockwave: false, seed: 7, particleCount: 1 },
        },
      ],
    };

    expect(() => renderStill(context, scene as never, 10)).toThrow(
      "primitive failed",
    );
    expect(stack).toHaveLength(0);
    expect(state.globalAlpha).toBe(0.37);
    expect(state.globalCompositeOperation).toBe("xor");
    expect(state.fillStyle).toBe("#caller");
    expect(state.lineWidth).toBe(17);
    expect(maxDepth).toBeGreaterThanOrEqual(3);

    expect(() => renderStill(context, scene as never, 10)).not.toThrow();
    expect(stack).toHaveLength(0);
    expect(state.globalAlpha).toBe(0.37);
    expect(state.globalCompositeOperation).toBe("xor");
    expect(state.fillStyle).toBe("#caller");
    expect(state.lineWidth).toBe(17);
  });

  it("draws the Phase 1B effect catalog without resolved assets", () => {
    const calls: string[] = [];
    const context = {
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      lineCap: "butt",
      lineJoin: "miter",
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      clearRect: () => calls.push("clearRect"),
      beginPath: () => calls.push("beginPath"),
      arc: () => calls.push("arc"),
      ellipse: () => calls.push("ellipse"),
      rect: () => calls.push("rect"),
      fill: () => calls.push("fill"),
      stroke: () => calls.push("stroke"),
      translate: () => undefined,
      rotate: () => undefined,
      moveTo: () => calls.push("moveTo"),
      lineTo: () => calls.push("lineTo"),
      arcTo: () => calls.push("arcTo"),
      quadraticCurveTo: () => calls.push("quadraticCurveTo"),
      closePath: () => undefined,
      fillText: () => calls.push("fillText"),
      fillRect: () => calls.push("fillRect"),
      strokeRect: () => undefined,
      measureText: (line: string) => ({ width: line.length * 10 }),
    } as unknown as CanvasRenderingContext2D;
    const effectNames = [
      "confettiBurst",
      "cloudPop",
      "speedLines",
      "neonAura",
      "scribbleCircle",
    ];
    const scene = {
      schemaVersion: 1,
      width: 500,
      height: 500,
      fps: 30,
      duration: 30,
      nodes: effectNames.map((effect, index) => ({
        id: effect,
        type: "effect",
        effect,
        duration: 30,
        style: {
          position: "absolute",
          left: 40,
          top: 40,
          width: 220,
          height: 180,
        },
        params: {
          seed: index + 1,
          particleCount: 8,
          colors: ["#ffffff", "#38bdf8"],
          emoji: effect === "confettiBurst" ? "!" : undefined,
        },
      })),
    };

    renderStill(context, scene as never, 10);

    expect(calls).toContain("fillRect");
    expect(calls).toContain("ellipse");
    expect(calls).toContain("lineTo");
    expect(calls).toContain("arcTo");
    expect(calls).toContain("stroke");
    expect(calls).toContain("fillText");
  });

  it("draws mirrorBars as upper and lower center-reflected segments", () => {
    const moveTos: Array<{ x: number; y: number }> = [];
    const gradient = {
      addColorStop: () => undefined,
    };
    const context = {
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
      translate: () => undefined,
      rotate: () => undefined,
      scale: () => undefined,
      createLinearGradient: () => gradient,
      beginPath: () => undefined,
      moveTo: (x: number, y: number) => moveTos.push({ x, y }),
      arcTo: () => undefined,
      closePath: () => undefined,
      fill: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    const values = new Uint8Array(128);
    values.fill(255);
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {
        music: { id: "music", type: "audio", src: "music.mp3" },
      },
      nodes: [
        {
          id: "mirror",
          type: "effect",
          effect: "mirrorBars",
          duration: 1,
          style: {
            position: "absolute",
            left: 0,
            top: 0,
            width: 100,
            height: 100,
          },
          params: {
            audioAssetId: "music",
            barCount: 8,
            sensitivity: 1,
            smoothing: false,
          },
        },
      ],
    };
    const assets = {
      images: new Map(),
      fonts: new Map(),
      videos: new Map(),
      videoFrames: new Map(),
      audio: new Map(),
      audioSpectra: new Map([
        [
          "music",
          {
            fps: 30,
            barCount: 128,
            frameCount: 1,
            values,
          },
        ],
      ]),
      lotties: new Map(),
      lottieFrames: new Map(),
    };

    renderStill(context, scene as never, 0, { assets: assets as never });

    expect(moveTos).toHaveLength(16);
    expect(moveTos.filter(({ y }) => y < 5)).toHaveLength(8);
    expect(moveTos.filter(({ y }) => y > 50 && y < 55)).toHaveLength(8);
  });
});

describe("parseLinearGradient", () => {
  it("returns null for non-gradient fills", () => {
    expect(parseLinearGradient("#ff0000")).toBeNull();
    expect(parseLinearGradient("rgba(0, 0, 0, 0.5)")).toBeNull();
    expect(
      parseLinearGradient("linear-gradient(#not-a-color, #ffffff)"),
    ).toBeNull();
  });

  it("defaults to 180deg (to bottom) when no direction is given", () => {
    expect(parseLinearGradient("linear-gradient(#000 0%, #fff 100%)")).toEqual({
      angleDeg: 180,
      stops: [
        { color: "#000", offset: 0 },
        { color: "#fff", offset: 1 },
      ],
    });
  });

  it("parses deg angles and to-side keywords", () => {
    expect(
      parseLinearGradient("linear-gradient(135deg, #000 0%, #fff 100%)")
        ?.angleDeg,
    ).toBe(135);
    expect(
      parseLinearGradient("linear-gradient(to right, #000 0%, #fff 100%)")
        ?.angleDeg,
    ).toBe(90);
  });

  it("handles many stops and rgba colors with embedded commas", () => {
    const parsed = parseLinearGradient(
      "linear-gradient(90deg, rgba(255, 0, 0, 0.5) 0%, #00ff00 50%, rgb(0, 0, 255) 100%)",
    );

    expect(parsed?.stops).toEqual([
      { color: "rgba(255, 0, 0, 0.5)", offset: 0 },
      { color: "#00ff00", offset: 0.5 },
      { color: "rgb(0, 0, 255)", offset: 1 },
    ]);
  });

  it("rejects nonzero px stops instead of silently discarding them", () => {
    expect(
      parseLinearGradient(
        "linear-gradient(180deg, rgba(90,120,255,0.10) 1px, rgba(255,255,255,0.92) 100%)",
      ),
    ).toBeNull();
  });

  it("distributes omitted stop positions evenly like CSS", () => {
    const parsed = parseLinearGradient(
      "linear-gradient(to right, #000, #888, #aaa, #fff)",
    );

    expect(parsed?.stops.map((stop) => stop.offset)).toEqual([
      0,
      1 / 3,
      2 / 3,
      1,
    ]);
  });

  it("clamps out-of-order positions to be non-decreasing", () => {
    const parsed = parseLinearGradient(
      "linear-gradient(#000 60%, #888 20%, #fff 100%)",
    );

    expect(parsed?.stops.map((stop) => stop.offset)).toEqual([0.6, 0.6, 1]);
  });
});

describe("radial and conic gradients", () => {
  it("parses radial centers and distributes color stops", () => {
    expect(
      parseRadialGradient(
        "radial-gradient(circle at 25% 75%, #fff 0%, #38bdf8, #020617 100%)",
      ),
    ).toEqual({
      centerX: 0.25,
      centerY: 0.75,
      stops: [
        { color: "#fff", offset: 0 },
        { color: "#38bdf8", offset: 0.5 },
        { color: "#020617", offset: 1 },
      ],
    });
  });

  it("parses conic start angles and centers", () => {
    expect(
      parseConicGradient(
        "conic-gradient(from 45deg at 40% 60%, #f00 0%, #0f0 50%, #00f 100%)",
      ),
    ).toEqual({
      angleDeg: 45,
      centerX: 0.4,
      centerY: 0.6,
      stops: [
        { color: "#f00", offset: 0 },
        { color: "#0f0", offset: 0.5 },
        { color: "#00f", offset: 1 },
      ],
    });
  });

  it("rejects unsupported radial/conic prefixes", () => {
    expect(
      parseRadialGradient("radial-gradient(ellipse, #fff, #000)"),
    ).toBeNull();
    expect(
      parseConicGradient("conic-gradient(from turn, #fff, #000)"),
    ).toBeNull();
  });
});

describe("parseTextStroke", () => {
  it("returns null when no stroke is provided", () => {
    expect(parseTextStroke(undefined)).toBeNull();
    expect(parseTextStroke("")).toBeNull();
  });

  it("parses width and color shorthand", () => {
    expect(parseTextStroke("4px #000000", 40)).toEqual({
      width: 4,
      color: "#000000",
    });
  });

  it("resolves percentages against font size and preserves color strings", () => {
    expect(parseTextStroke("10% rgba(0, 0, 0, 0.8)", 40)).toEqual({
      width: 4,
      color: "rgba(0, 0, 0, 0.8)",
    });
  });

  it("ignores malformed and non-positive strokes", () => {
    expect(parseTextStroke("nope")).toBeNull();
    expect(parseTextStroke("0px #000000")).toBeNull();
    expect(parseTextStroke("-2px #000000")).toBeNull();
  });
});

describe("parseTextBackground", () => {
  it("returns null without a background color", () => {
    expect(parseTextBackground({})).toBeNull();
  });

  it("parses fitted text background controls", () => {
    expect(
      parseTextBackground(
        {
          textBackgroundColor: "rgba(255, 209, 102, 0.16)",
          textBackgroundPaddingX: 24,
          textBackgroundPaddingY: "10%",
          textBackgroundRadius: "8px",
        },
        40,
      ),
    ).toEqual({
      color: "rgba(255, 209, 102, 0.16)",
      paddingX: 24,
      paddingY: 4,
      radius: 8,
    });
  });

  it("uses shared padding as the axis fallback and clamps negative values", () => {
    expect(
      parseTextBackground(
        {
          textBackgroundColor: "#111111",
          textBackgroundPadding: 12,
          textBackgroundPaddingX: -4,
          textBackgroundRadius: -2,
        },
        40,
      ),
    ).toEqual({
      color: "#111111",
      paddingX: 0,
      paddingY: 12,
      radius: 0,
    });
  });
});

describe("videoSourceTime", () => {
  it("maps local frames to source seconds at natural speed", () => {
    expect(videoSourceTime(0, 30, 0, 1, 10)).toBe(0);
    expect(videoSourceTime(15, 30, 0, 1, 10)).toBe(0.5);
  });

  it("applies trim offset and playback rate", () => {
    // 0.5s trim + (15/30)s * 2x = 1.5s into the source.
    expect(videoSourceTime(15, 30, 0.5, 2, 10)).toBe(1.5);
  });

  it("maps the integer composition grid to NTSC source seconds without drift", () => {
    const ntscFrameSeconds = 1_001 / 30_000;
    const sourceTime = videoSourceTime(300, 30, 0, 1, 20);
    expect(sourceTime).toBe(10);
    expect(sourceTime / ntscFrameSeconds).toBeCloseTo(299.7003, 4);
  });

  it("holds the last frame when the scene outlasts the clip", () => {
    expect(videoSourceTime(900, 30, 0, 1, 2)).toBeCloseTo(1.999, 5);
    expect(videoSourceTime(0, 30, 99, 1, 2)).toBeCloseTo(1.999, 5);
  });

  it("loops and reverses visual source time", () => {
    expect(videoSourceTime(75, 30, 0, 1, 2, "loop")).toBeCloseTo(0.5);
    expect(videoSourceTime(15, 30, 1.5, -1, 2, "hold")).toBeCloseTo(1);
    expect(videoSourceTime(75, 30, 0.5, -1, 2, "loop")).toBeCloseTo(0);
  });
});

describe("renderStill with video nodes", () => {
  it("fails loudly when no frame was staged via prepareFrame", () => {
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {
        clip: { id: "clip", type: "video", src: "blob:fake" },
      },
      nodes: [{ id: "shot", type: "video", assetId: "clip" }],
    };

    const context = {
      globalAlpha: 1,
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
    } as unknown as CanvasRenderingContext2D;

    expect(() => renderStill(context, scene as never, 0)).toThrow(
      /prepareFrame\(scene, frame, assets\)/,
    );
  });

  it("draws pixelated media through a low-resolution staging canvas", () => {
    const originalOffscreenCanvas = globalThis.OffscreenCanvas;
    const stagingDraws: unknown[][] = [];
    const stagingCanvases: Array<{ width: number; height: number }> = [];

    class FakeOffscreenCanvas {
      constructor(
        public width: number,
        public height: number,
      ) {
        stagingCanvases.push(this);
      }

      getContext() {
        return {
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
          clearRect: () => undefined,
          drawImage: (...args: unknown[]) => {
            stagingDraws.push(args);
          },
        };
      }
    }

    (
      globalThis as { OffscreenCanvas?: typeof OffscreenCanvas }
    ).OffscreenCanvas =
      FakeOffscreenCanvas as unknown as typeof OffscreenCanvas;

    try {
      const scene = {
        schemaVersion: 1,
        width: 100,
        height: 100,
        fps: 30,
        duration: 1,
        assets: {
          clip: { id: "clip", type: "video", src: "blob:fake" },
        },
        nodes: [
          {
            id: "shot",
            type: "video",
            assetId: "clip",
            style: {
              width: 100,
              height: 100,
              imageRendering: "pixelated",
              pixelSize: 10,
            },
          },
        ],
      };
      const outputDraws: unknown[][] = [];
      const context = {
        globalAlpha: 1,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
        save: () => undefined,
        restore: () => undefined,
        clearRect: () => undefined,
        translate: () => undefined,
        scale: () => undefined,
        rotate: () => undefined,
        beginPath: () => undefined,
        rect: () => undefined,
        clip: () => undefined,
        drawImage: (...args: unknown[]) => {
          outputDraws.push(args);
        },
      } as unknown as CanvasRenderingContext2D;
      const source = { width: 100, height: 100 } as HTMLCanvasElement;
      const assets = {
        videoFrames: new Map([
          [
            "shot",
            {
              image: source,
              width: 100,
              height: 100,
              sceneFrame: 0,
            },
          ],
        ]),
      };
      const scratchSurfacePool = new ScratchSurfacePool({
        createCanvas: (width, height) =>
          new FakeOffscreenCanvas(width, height) as unknown as OffscreenCanvas,
        maxBytes: 1024 * 1024,
        maxSurfaces: 4,
        maxDimension: 100,
      });

      renderStill(context, scene as never, 0, {
        assets: assets as never,
        scratchSurfacePool,
      });

      expect(stagingCanvases[0]).toMatchObject({ width: 64, height: 64 });
      expect(stagingDraws[0]?.slice(-2)).toEqual([10, 10]);
      expect(outputDraws[0]?.[0]).toBe(stagingCanvases[0]);
      expect(outputDraws[0]?.slice(1)).toEqual([0, 0, 10, 10, 0, 0, 100, 100]);
      expect(scratchSurfacePool.stats()).toMatchObject({
        allocations: 1,
        leasedSurfaceCount: 0,
      });
    } finally {
      (
        globalThis as { OffscreenCanvas?: typeof OffscreenCanvas }
      ).OffscreenCanvas = originalOffscreenCanvas;
    }
  });
});

describe("renderStill bounded text", () => {
  it("paints schema-valid unitless text shadows", () => {
    let painted:
      | { color: string; x: number; y: number; blur: number }
      | undefined;
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "title",
          type: "text",
          text: "shadow",
          style: { width: 100, fontSize: 20, textShadow: "0 2 6 #000" },
        },
      ],
    };
    const context = {
      globalAlpha: 1,
      font: "",
      fillStyle: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      shadowColor: "transparent",
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowBlur: 0,
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
      translate: () => undefined,
      measureText: (line: string) => ({ width: line.length * 10 }),
      fillText: function (this: {
        shadowColor: string;
        shadowOffsetX: number;
        shadowOffsetY: number;
        shadowBlur: number;
      }) {
        painted = {
          color: this.shadowColor,
          x: this.shadowOffsetX,
          y: this.shadowOffsetY,
          blur: this.shadowBlur,
        };
      },
    } as unknown as CanvasRenderingContext2D;

    renderStill(context, scene as never, 0);
    expect(painted).toEqual({ color: "#000", x: 0, y: 2, blur: 6 });
  });

  it("draws only maxLines and ellipsizes the final visible line", () => {
    const drawn: string[] = [];
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "title",
          type: "text",
          text: "aaaa bbbb cccc",
          style: {
            width: 50,
            fontSize: 20,
            maxLines: 2,
            textOverflow: "ellipsis",
          },
        },
      ],
    };

    const context = {
      globalAlpha: 1,
      font: "",
      fillStyle: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
      translate: () => undefined,
      measureText: (line: string) => ({
        width: Array.from(line).length * 10,
      }),
      fillText: (line: string) => {
        drawn.push(line);
      },
    } as unknown as CanvasRenderingContext2D;

    renderStill(context, scene as never, 0);

    expect(drawn).toEqual(["aaaa", "bbbb…"]);
  });

  it("draws shrink-fit text with the resolved smaller font", () => {
    const drawnFonts: string[] = [];
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "title",
          type: "text",
          text: "aaaa bbbb cccc dddd",
          style: {
            width: 50,
            height: 40,
            fontSize: 20,
            minFontSize: 10,
            lineHeight: 1,
            textFit: "shrink",
          },
        },
      ],
    };

    const context = {
      globalAlpha: 1,
      font: "",
      fillStyle: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
      translate: () => undefined,
      measureText: function (this: { font: string }, line: string) {
        const match = this.font.match(/(\d+(?:\.\d+)?)px/);
        const fontSize = match ? Number.parseFloat(match[1] ?? "20") : 20;
        return { width: Array.from(line).length * fontSize * 0.5 };
      },
      fillText: function (this: { font: string }) {
        drawnFonts.push(this.font);
      },
    } as unknown as CanvasRenderingContext2D;

    renderStill(context, scene as never, 0);

    expect(drawnFonts.length).toBeGreaterThan(0);
    expect(drawnFonts.every((font) => !font.includes("20px"))).toBe(true);
  });
});

describe("parseBoxShadow", () => {
  it("parses offset/blur/color forms", () => {
    expect(parseBoxShadow("2px 4px 8px rgba(0, 0, 0, 0.5)")).toEqual({
      offsetX: 2,
      offsetY: 4,
      blur: 8,
      color: "rgba(0, 0, 0, 0.5)",
    });
    expect(parseBoxShadow("0 6 #000000")).toEqual({
      offsetX: 0,
      offsetY: 6,
      blur: 0,
      color: "#000000",
    });
    expect(parseBoxShadow("-3px -3px 10px gold")).toEqual({
      offsetX: -3,
      offsetY: -3,
      blur: 10,
      color: "gold",
    });
  });

  it("rejects inset, spread, and incomplete values", () => {
    expect(parseBoxShadow("inset 2px 2px 4px #000")).toBeNull();
    expect(parseBoxShadow("2px 2px 4px 6px #000")).toBeNull();
    expect(parseBoxShadow("2px #000")).toBeNull();
    expect(parseBoxShadow("2px 2px 4px")).toBeNull();
    expect(parseBoxShadow("2px 2px 4px #not-a-color")).toBeNull();
  });

  it("parses comma-separated shadows without splitting rgba colors", () => {
    expect(
      parseBoxShadows("0 8px 20px rgba(0,0,0,0.45), -4px 0 10px #38bdf8"),
    ).toEqual([
      { offsetX: 0, offsetY: 8, blur: 20, color: "rgba(0,0,0,0.45)" },
      { offsetX: -4, offsetY: 0, blur: 10, color: "#38bdf8" },
    ]);
    expect(parseBoxShadows("0 4px #000, inset 0 1px #fff")).toEqual([]);
  });
});

describe("parseBorder", () => {
  it("parses width/solid/color in any practical order", () => {
    expect(parseBorder("2px solid #ff0000")).toEqual({
      width: 2,
      color: "#ff0000",
    });
    expect(parseBorder("3 rgb(10, 20, 30)")).toEqual({
      width: 3,
      color: "rgb(10, 20, 30)",
    });
  });

  it("rejects non-solid line styles and missing parts", () => {
    expect(parseBorder("2px dashed #fff")).toBeNull();
    expect(parseBorder("solid #fff")).toBeNull();
    expect(parseBorder("2px solid")).toBeNull();
    expect(parseBorder("0 solid #fff")).toBeNull();
    expect(parseBorder("2px solid #not-a-color")).toBeNull();
  });
});

describe("zIndex paint order", () => {
  it("paints siblings in ascending zIndex order, document order for ties", () => {
    const fills: string[] = [];
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "top",
          type: "div",
          style: {
            width: 10,
            height: 10,
            backgroundColor: "#aa0000",
            zIndex: 5,
          },
        },
        {
          id: "bottom",
          type: "div",
          style: {
            width: 10,
            height: 10,
            backgroundColor: "#00bb00",
            zIndex: -1,
          },
        },
        {
          id: "mid-a",
          type: "div",
          style: { width: 10, height: 10, backgroundColor: "#0000cc" },
        },
        {
          id: "mid-b",
          type: "div",
          style: { width: 10, height: 10, backgroundColor: "#dd00dd" },
        },
      ],
    };

    const context = {
      globalAlpha: 1,
      set fillStyle(value: string) {
        fills.push(value);
      },
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
      fillRect: () => undefined,
      translate: () => undefined,
    } as unknown as CanvasRenderingContext2D;

    renderStill(context, scene as never, 0);

    expect(fills).toEqual(["#00bb00", "#0000cc", "#dd00dd", "#aa0000"]);
  });
});

describe("lottieSourceFrame", () => {
  const clip = { fr: 60, ip: 0, op: 120 };

  it("maps scene-local frames through fps, rate, and lottie frame rate", () => {
    expect(lottieSourceFrame(0, 30, 1, clip)).toBe(0);
    expect(lottieSourceFrame(15, 30, 1, clip)).toBe(30); // 0.5s x 60fr
    expect(lottieSourceFrame(15, 30, 2, clip)).toBe(60);
  });

  it("clamps to the last frame — lottie-web does not clamp itself", () => {
    expect(lottieSourceFrame(900, 30, 1, clip)).toBeCloseTo(119.999, 3);
    expect(lottieSourceFrame(-5, 30, 1, clip)).toBe(0);
  });

  it("respects a nonzero in-point when clamping", () => {
    expect(
      lottieSourceFrame(900, 30, 1, { fr: 30, ip: 20, op: 50 }),
    ).toBeCloseTo(29.999, 3);
  });
});

describe("validateLottieDocument", () => {
  const minimal = {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    layers: [{ ty: 4 }],
  };

  it("accepts a self-contained vector document", () => {
    expect(validateLottieDocument(minimal)).toEqual([]);
  });

  it("rejects non-lottie JSON and external images", () => {
    expect(validateLottieDocument({ hello: 1 })).toContain(
      "missing fr/op — not a Lottie animation document",
    );
    expect(
      validateLottieDocument({
        ...minimal,
        assets: [{ id: "img_0", p: "image.png", u: "images/" }],
      }).join(" "),
    ).toContain('external image "image.png"');
  });

  it("rejects image layers and expressions", () => {
    expect(
      validateLottieDocument({ ...minimal, layers: [{ ty: 2 }] }).join(" "),
    ).toContain("image layer");

    const withExpression = {
      ...minimal,
      layers: [
        {
          ty: 4,
          ks: { p: { a: 0, k: [0, 0], x: "var $bm_rt = wiggle(2, 30);" } },
        },
      ],
    };
    expect(validateLottieDocument(withExpression).join(" ")).toContain(
      "expressions",
    );
    // bezier easing objects use numeric/array "x" — those must pass
    const withEasing = {
      ...minimal,
      layers: [
        {
          ty: 4,
          ks: { p: { a: 1, k: [{ t: 0, i: { x: [0.5], y: [0.5] } }] } },
        },
      ],
    };
    expect(validateLottieDocument(withEasing)).toEqual([]);
  });
});

describe("Lottie readiness lifecycle", () => {
  function fakeAnimation() {
    const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
    return {
      animation: {
        goToAndStop: () => undefined,
        destroy: () => undefined,
        addEventListener(name: string, handler: (...args: unknown[]) => void) {
          const listeners = handlers.get(name) ?? new Set();
          listeners.add(handler);
          handlers.set(name, listeners);
        },
        removeEventListener(
          name: string,
          handler: (...args: unknown[]) => void,
        ) {
          handlers.get(name)?.delete(handler);
        },
      },
      emit(name: string, value?: unknown) {
        Array.from(handlers.get(name) ?? []).forEach((handler) =>
          handler(value),
        );
      },
      listenerCount() {
        return Array.from(handlers.values()).reduce(
          (total, listeners) => total + listeners.size,
          0,
        );
      },
    };
  }

  it("rejects data failure and abort while removing every listener", async () => {
    const failed = fakeAnimation();
    const failure = waitForLottieReady(failed.animation, undefined, 1_000);
    failed.emit("data_failed", new Error("bad lottie"));
    await expect(failure).rejects.toThrow("bad lottie");
    expect(failed.listenerCount()).toBe(0);

    const aborted = fakeAnimation();
    const controller = new AbortController();
    const cancellation = waitForLottieReady(
      aborted.animation,
      controller.signal,
      1_000,
    );
    controller.abort(new Error("cancel lottie"));
    await expect(cancellation).rejects.toThrow("cancel lottie");
    expect(aborted.listenerCount()).toBe(0);
  });

  it("times out a readiness wait deterministically", async () => {
    vi.useFakeTimers();
    try {
      const pending = fakeAnimation();
      const readiness = waitForLottieReady(pending.animation, undefined, 25);
      const rejection = expect(readiness).rejects.toThrow(
        "timed out after 25ms",
      );
      await vi.advanceTimersByTimeAsync(25);
      await rejection;
      expect(pending.listenerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("wrapTextLines with spaceless scripts", () => {
  // 10px per code point, like the Latin fake measurer above.
  const measureCjk = (line: string): number => Array.from(line).length * 10;

  it("breaks a spaceless CJK paragraph into fitting lines", () => {
    const text = "这是一个很长的中文段落用来测试文本换行";
    const lines = wrapTextLines(text, 80, measureCjk); // 8 chars per line

    expect(lines).toEqual(["这是一个很长的中", "文段落用来测试文", "本换行"]);
    expect(lines.every((line) => measureCjk(line) <= 80)).toBe(true);
  });

  it("mixes spaced and spaceless runs", () => {
    const lines = wrapTextLines("emoji 中文混合测试段落在这里", 80, measureCjk);
    // word-level breaks drop the inter-word space, as they always have
    expect(lines).toEqual(["emoji", "中文混合测试段落", "在这里"]);
    expect(lines.every((line) => measureCjk(line) <= 80)).toBe(true);
  });

  it("keeps emoji grapheme clusters intact when breaking", () => {
    // Each flag emoji is two code points (one grapheme may be wider);
    // ensure no break lands inside a surrogate pair.
    const text = "🎬🎬🎬🎬🎬🎬";
    const lines = wrapTextLines(
      text,
      45,
      (line) => Array.from(line).length * 10,
    );
    for (const line of lines) {
      expect([...line].every((ch) => ch === "🎬")).toBe(true);
    }
  });

  it("clamps a single grapheme wider than the box (unchanged behavior)", () => {
    expect(wrapTextLines("字", 5, measureCjk)).toEqual(["字"]);
  });

  it("Latin wrapping is byte-identical to the previous behavior", () => {
    const measure = (line: string): number => line.length * 10;
    expect(wrapTextLines("the quick brown fox jumps", 100, measure)).toEqual([
      "the quick",
      "brown fox",
      "jumps",
    ]);
  });
});

describe("VideoPlaybackCursor", () => {
  const FRAME = 1 / 30;

  /**
   * Scripted stand-in for CanvasSink: frames at the given timestamps, each
   * canvases(start) yielding the frame covering `start` first (or the first
   * frame when `start` precedes it), mirroring mediabunny's semantics.
   */
  function scriptedSource(timestamps: number[]) {
    const stats = { seeks: [] as number[], decodes: 0, terminated: 0 };
    const source = {
      canvases(start = 0) {
        stats.seeks.push(start);

        async function* generate() {
          try {
            let index = 0;

            for (let i = 0; i < timestamps.length; i += 1) {
              const timestamp = timestamps[i] ?? 0;

              if (timestamp <= start) {
                index = i;
              } else {
                break;
              }
            }

            for (; index < timestamps.length; index += 1) {
              stats.decodes += 1;
              yield {
                canvas: {} as HTMLCanvasElement,
                timestamp: timestamps[index] ?? 0,
                duration: FRAME,
              };
            }
          } finally {
            stats.terminated += 1;
          }
        }

        return generate();
      },
    };

    return { source, stats };
  }

  const evenTimeline = (frames: number) =>
    Array.from({ length: frames }, (_, index) => index * FRAME);

  it("serves monotonic playback from a single iterator, one decode per frame", async () => {
    const { source, stats } = scriptedSource(evenTimeline(90));
    const cursor = new VideoPlaybackCursor(source);

    for (let frame = 0; frame < 60; frame += 1) {
      const wrapped = await cursor.frameAt(frame * FRAME);
      expect(wrapped?.timestamp).toBeCloseTo(frame * FRAME, 9);
    }

    expect(stats.seeks).toEqual([0]);
    // One decode per served frame plus the single-frame peek-ahead.
    expect(stats.decodes).toBe(61);
  });

  it("repeated timestamps and sub-frame steps decode nothing new", async () => {
    const { source, stats } = scriptedSource(evenTimeline(10));
    const cursor = new VideoPlaybackCursor(source);

    await cursor.frameAt(0);
    const decodesAfterFirst = stats.decodes;
    await cursor.frameAt(0);
    await cursor.frameAt(FRAME / 3);
    await cursor.frameAt(FRAME / 2);

    expect(stats.decodes).toBe(decodesAfterFirst);
    expect(stats.seeks).toEqual([0]);
  });

  it("selects frames by presentation timestamps for variable-frame-rate input", async () => {
    const { source } = scriptedSource([0, 0.02, 0.055, 0.11, 0.145]);
    const cursor = new VideoPlaybackCursor(source);

    expect((await cursor.frameAt(1 / 30))?.timestamp).toBeCloseTo(0.02, 9);
    expect((await cursor.frameAt(2 / 30))?.timestamp).toBeCloseTo(0.055, 9);
    expect((await cursor.frameAt(4 / 30))?.timestamp).toBeCloseTo(0.11, 9);
  });

  it("re-seeks on a backward seek and terminates the old iterator", async () => {
    const { source, stats } = scriptedSource(evenTimeline(90));
    const cursor = new VideoPlaybackCursor(source);

    await cursor.frameAt(30 * FRAME);
    const wrapped = await cursor.frameAt(3 * FRAME);

    expect(wrapped?.timestamp).toBeCloseTo(3 * FRAME, 9);
    expect(stats.seeks.length).toBe(2);
    expect(stats.terminated).toBe(1);
  });

  it("re-seeks instead of draining on a far forward jump", async () => {
    const { source, stats } = scriptedSource(evenTimeline(300));
    const cursor = new VideoPlaybackCursor(source);

    await cursor.frameAt(0);
    const decodesBeforeJump = stats.decodes;
    const wrapped = await cursor.frameAt(150 * FRAME); // 5s ahead

    expect(wrapped?.timestamp).toBeCloseTo(150 * FRAME, 9);
    expect(stats.seeks.length).toBe(2);
    // A drain would have decoded ~150 frames; the re-seek decodes two.
    expect(stats.decodes - decodesBeforeJump).toBe(2);
  });

  it("advances through a small forward skip without re-seeking", async () => {
    const { source, stats } = scriptedSource(evenTimeline(90));
    const cursor = new VideoPlaybackCursor(source);

    await cursor.frameAt(0);
    const wrapped = await cursor.frameAt(10 * FRAME); // ~0.33s ahead

    expect(wrapped?.timestamp).toBeCloseTo(10 * FRAME, 9);
    expect(stats.seeks).toEqual([0]);
  });

  it("holds the last frame past the end of the clip", async () => {
    const { source } = scriptedSource(evenTimeline(5));
    const cursor = new VideoPlaybackCursor(source);

    const wrapped = await cursor.frameAt(10 * FRAME);
    expect(wrapped?.timestamp).toBeCloseTo(4 * FRAME, 9);

    const again = await cursor.frameAt(20 * FRAME);
    expect(again?.timestamp).toBeCloseTo(4 * FRAME, 9);
  });

  it("serves timestamps before the first frame without re-seeking per request", async () => {
    const first = 0.5;
    const { source, stats } = scriptedSource([
      first,
      first + FRAME,
      first + 2 * FRAME,
    ]);
    const cursor = new VideoPlaybackCursor(source);

    const early = await cursor.frameAt(0);
    expect(early?.timestamp).toBeCloseTo(first, 9);

    await cursor.frameAt(FRAME);
    await cursor.frameAt(2 * FRAME);
    expect(stats.seeks.length).toBe(1);
  });

  it("dispose terminates the decode pipeline", async () => {
    const { source, stats } = scriptedSource(evenTimeline(90));
    const cursor = new VideoPlaybackCursor(source);

    await cursor.frameAt(0);
    await cursor.dispose();

    expect(stats.terminated).toBe(1);
  });
});

describe("Canvas2D display-list facade", () => {
  const scene = {
    schemaVersion: 1 as const,
    width: 160,
    height: 90,
    fps: 30,
    duration: 10,
    assets: {},
    nodes: [
      {
        id: "card",
        type: "div" as const,
        style: {
          position: "absolute" as const,
          left: 10,
          top: 8,
          width: 120,
          height: 60,
          backgroundColor: "#123456",
        },
        children: [
          {
            id: "label",
            type: "text" as const,
            text: "Display list",
            style: { width: 100, height: 30, color: "#ffffff" },
          },
        ],
      },
    ],
  };

  it("makes renderStill exactly the compile-then-execute compatibility facade", () => {
    const facade = createScratchRenderHarness().target.context;
    const explicit = createScratchRenderHarness().target.context;

    renderStill(facade, scene, 0);
    const list = compileCanvas2DDisplayList(explicit, scene, 0);
    executeCanvas2DDisplayList(explicit, list, { scene });

    for (const method of [
      "clearRect",
      "beginPath",
      "rect",
      "fill",
      "fillText",
      "translate",
      "rotate",
      "scale",
    ] as const) {
      expect(vi.mocked(explicit[method]).mock.calls).toEqual(
        vi.mocked(facade[method]).mock.calls,
      );
    }
    expect(JSON.parse(JSON.stringify(list))).toEqual(list);
  });

  it("rejects composition and undeclared backend capability mismatches", () => {
    const target = createScratchRenderHarness().target.context;
    const list = compileCanvas2DDisplayList(target, scene, 0);
    expect(() =>
      executeCanvas2DDisplayList(
        target,
        {
          ...list,
          composition: { ...list.composition, width: 161 },
        },
        { scene },
      ),
    ).toThrow(/composition width/);
    expect(() =>
      executeCanvas2DDisplayList(
        target,
        {
          ...list,
          requirements: [
            { id: "com.example.future", version: "1.0.0", nodeIds: ["card"] },
          ],
        },
        { scene },
      ),
    ).toThrow(/no registry was supplied/);

    const group = list.groups[0]!;
    expect(() =>
      executeCanvas2DDisplayList(
        target,
        {
          ...list,
          groups: [
            {
              ...group,
              background: group.background
                ? {
                    ...group.background,
                    paint: { kind: "color", source: "#tampered" },
                  }
                : null,
            },
          ],
        },
        { scene },
      ),
    ).toThrow(/tampered background paint semantics/);
  });

  it("preserves legacy clamping and fractional frame evaluation", () => {
    const target = createScratchRenderHarness().target.context;
    expect(
      compileCanvas2DDisplayList(target, scene, -100).composition.frame,
    ).toBe(0);
    expect(
      compileCanvas2DDisplayList(target, scene, 100).composition.frame,
    ).toBe(scene.duration - 1);
    const fractional = compileCanvas2DDisplayList(target, scene, 1.25);
    expect(fractional.composition.frame).toBe(1.25);
    expect(() =>
      executeCanvas2DDisplayList(target, fractional, { scene }),
    ).not.toThrow();
  });

  it("compiles and executes standard extension display without a legacy adapter", async () => {
    const extensionResource = { portable: true };
    const resolveExtension = vi.fn(() => extensionResource);
    const disposeExtension = vi.fn();
    const definition = defineExtension({
      name: "com.example.standard-card",
      version: "1.0.0",
      paramsSchema: z.object({ color: z.string() }),
      deterministic: true,
      workerCompatible: true,
      reuseKey: () => "portable-v1",
      reuseSafety: "immutable",
      resolveAssets: resolveExtension,
      disposeAssets: disposeExtension,
      display: {
        kind: "standard",
        version: "1",
        compile: ({ params }, output) => {
          output.rect("surface", {
            x: 0,
            y: 0,
            width: 40,
            height: 20,
            radius: 4,
            fill: params.color,
          });
        },
      },
    });
    const extensionScene = {
      schemaVersion: 1 as const,
      width: 100,
      height: 60,
      fps: 30,
      duration: 5,
      assets: {},
      nodes: [
        {
          id: "standard",
          type: "extension" as const,
          extension: {
            name: definition.name,
            version: definition.version,
            params: { color: "#ff00aa" },
          },
          style: { width: 40, height: 20 },
        },
      ],
    };
    const extensionRegistry = createExtensionRegistry([definition]);
    const assets = await resolveAssets(extensionScene, {
      extensions: extensionRegistry,
    });
    const target = createScratchRenderHarness().target.context;
    const list = compileCanvas2DDisplayList(target, extensionScene, 0, {
      assets,
    });
    expect(assets.extensionNodes?.get("standard")).toMatchObject({
      adapter: undefined,
      displayDecision: { kind: "standard", version: "1" },
    });
    expect(list.groups[0]?.content).toMatchObject({
      kind: "extension",
      mode: "standard",
      displayVersion: "1",
    });
    expect(() => JSON.stringify(list)).not.toThrow();
    expect(() =>
      executeCanvas2DDisplayList(target, list, {
        scene: extensionScene,
        assets,
      }),
    ).not.toThrow();
    expect(vi.mocked(target.fill)).toHaveBeenCalled();
    const successor = await resolveAssets(extensionScene, {
      extensions: extensionRegistry,
      reuseFrom: { scene: extensionScene, assets },
    });
    expect(resolveExtension).toHaveBeenCalledOnce();
    expect(successor.extensionNodes?.get("standard")?.resolvedAssets).toBe(
      extensionResource,
    );
    await disposeAssetsAsync(assets);
    expect(disposeExtension).not.toHaveBeenCalled();
    await disposeAssetsAsync(successor);
    expect(disposeExtension).toHaveBeenCalledOnce();
  });

  it("prepares standard images from untyped declared requirements", () => {
    const definition = defineExtension({
      name: "com.example.untyped-image",
      version: "1.0.0",
      paramsSchema: z.object({}),
      deterministic: true,
      workerCompatible: true,
      display: {
        kind: "standard",
        version: "1",
        compile: (_context, output) => {
          output.image("hero", {
            assetId: "hero",
            x: 0,
            y: 0,
            width: 20,
            height: 20,
          });
        },
      },
    });
    const heroAsset = {
      id: "hero",
      type: "image" as const,
      src: "hero.png",
      metadata: { width: 20, height: 20 },
    };
    const node = {
      id: "standard-image",
      type: "extension" as const,
      extension: {
        name: definition.name,
        version: definition.version,
        params: {},
      },
      style: { width: 20, height: 20 },
    };
    const imageScene = {
      schemaVersion: 1 as const,
      width: 40,
      height: 40,
      fps: 30,
      duration: 1,
      assets: { hero: heroAsset },
      nodes: [node],
    };
    const image = { width: 20, height: 20 } as unknown as ImageBitmap;
    const assets = {
      images: new Map([["hero", image]]),
      fonts: new Map(),
      videos: new Map(),
      videoFrames: new Map(),
      audio: new Map(),
      lotties: new Map(),
      lottieFrames: new Map(),
      extensionNodes: new Map([
        [
          node.id,
          {
            node,
            definition,
            params: {},
            requirements: [{ assetId: "hero", optional: false }],
            adapter: undefined,
            displayDecision: {
              kind: "standard" as const,
              version: "1" as const,
            },
            resolvedAssets: undefined,
          },
        ],
      ]),
      extensionFrames: new Map(),
      resolvedSources: new Map([
        [
          "hero",
          {
            assetId: "hero",
            declaredSource: heroAsset.src,
            resolvedSource: heroAsset.src,
            contentKey: assetDeclarationKey(heroAsset),
            usingProxy: false,
            sourceKind: "primary" as const,
            declarationKey: assetDeclarationKey(heroAsset),
            assetType: "image" as const,
            sourceMode: "auto" as const,
          },
        ],
      ]),
    };
    const targetHarness = createScratchRenderHarness().target;
    const target = targetHarness.context;
    const list = compileCanvas2DDisplayList(target, imageScene, 0, {
      assets: assets as never,
    });
    executeCanvas2DDisplayList(target, list, {
      scene: imageScene,
      assets: assets as never,
    });
    expect(targetHarness.drawImages).toContainEqual([image, 0, 0, 20, 20]);
  });

  it("keeps opaque native resources outside JSON and enforces realm/frame identity", async () => {
    const nativeResources = new Map([["secret", { token: Symbol("native") }]]);
    const nativeFrame = new Date(0);
    const handler = vi.fn();
    const definition = defineExtension({
      name: "com.example.opaque-card",
      version: "1.0.0",
      paramsSchema: z.object({ columns: z.number() }),
      deterministic: true,
      workerCompatible: true,
      resolveAssets: () => nativeResources,
      prepareFrame: () => nativeFrame,
      display: {
        kind: "opaque",
        capability: {
          id: "com.example.canvas-card",
          version: "1.2.0",
          realms: ["main", "worker"],
        },
        payloadSchema: z.object({ columns: z.number() }).strict(),
        compile: ({ params }) => ({ columns: params.columns }),
      },
    });
    const extensionScene = {
      schemaVersion: 1 as const,
      width: 100,
      height: 60,
      fps: 30,
      duration: 8,
      assets: {},
      nodes: [
        {
          id: "opaque",
          type: "extension" as const,
          extension: {
            name: definition.name,
            version: definition.version,
            params: { columns: 3 },
          },
          style: { width: 40, height: 20 },
        },
      ],
    };
    const registry = createCanvas2DOpaqueExtensionRegistry({
      realm: "main",
      handlers: [
        {
          capability: {
            id: "com.example.canvas-card",
            version: "1.2.0",
            realms: ["main", "worker"],
          },
          draw: handler,
        },
      ],
    });
    const extensions = createExtensionRegistry([definition]);
    const assets = await resolveAssets(extensionScene, {
      extensions,
      opaqueExtensionRegistry: registry,
    });
    await prepareFrame(extensionScene, 3, assets);
    const target = createScratchRenderHarness().target.context;
    const list = compileCanvas2DDisplayList(target, extensionScene, 3, {
      assets,
    });
    const serialized = JSON.stringify(list);
    expect(serialized).toContain('"columns":3');
    expect(serialized).not.toContain("secret");
    executeCanvas2DDisplayList(target, list, { scene: extensionScene, assets });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      resolvedAssets: nativeResources,
      preparedFrame: nativeFrame,
      realm: "main",
    });
    expect(() =>
      compileCanvas2DDisplayList(target, extensionScene, 4, { assets }),
    ).toThrow(/prepared for scene frame 3/);

    assets.opaqueExtensionRegistry = undefined;
    expect(() =>
      executeCanvas2DDisplayList(target, list, {
        scene: extensionScene,
        assets,
      }),
    ).toThrow(/no registry was supplied/);

    const workerRegistry = createCanvas2DOpaqueExtensionRegistry({
      realm: "worker",
      handlers: [
        {
          capability: registry.capabilities[0]!,
          draw: () => undefined,
        },
      ],
    });
    expect(
      preflightCanvas2D(
        extensionScene,
        {
          OffscreenCanvas: class {
            getContext() {
              return {};
            }
          },
        } as unknown as Partial<typeof globalThis>,
        {
          extensions,
          worker: true,
          opaqueExtensionRegistry: workerRegistry,
        },
      ),
    ).toMatchObject({ ok: true, issues: [] });
    await disposeAssetsAsync(assets);
  });

  it("executes compiler-owned text lines without target-context reflow", () => {
    const target = createScratchRenderHarness().target.context;
    const textScene = {
      schemaVersion: 1 as const,
      width: 120,
      height: 60,
      fps: 30,
      duration: 2,
      assets: {},
      nodes: [
        {
          id: "text",
          type: "text" as const,
          text: "hello world",
          style: { width: 60, height: 40, fontSize: 10 },
        },
      ],
    };
    target.measureText = (value) => ({ width: value.length }) as TextMetrics;
    const list = compileCanvas2DDisplayList(target, textScene, 0);
    const compiledLines = (
      list.groups[0]?.content?.kind === "text"
        ? list.groups[0].content.lines
        : []
    ).map((line) => line.text);
    const measureWide = vi.fn((value: string) => ({
      width: value.length * 20,
    }));
    target.measureText = measureWide as unknown as typeof target.measureText;
    vi.mocked(target.fillText).mockClear();
    executeCanvas2DDisplayList(target, list, { scene: textScene });
    expect(
      vi.mocked(target.fillText).mock.calls.map(([value]) => value),
    ).toEqual(compiledLines);
    expect(measureWide).not.toHaveBeenCalled();
  });

  it("caches only already-isolated static subtrees and skips their redraw", () => {
    const harness = createScratchRenderHarness();
    const staticDisplayCache = new Canvas2DStaticDisplayCache({
      maxBytes: 4 * 1024 * 1024,
      maxEntries: 8,
      maxKeyBytes: 256 * 1024,
    });
    const staticScene = {
      schemaVersion: 1 as const,
      width: 120,
      height: 80,
      fps: 30,
      duration: 3,
      assets: {},
      nodes: [
        {
          id: "static",
          type: "div" as const,
          style: {
            position: "absolute" as const,
            left: 10,
            top: 12,
            width: 40,
            height: 30,
            backgroundColor: "#fff",
            opacity: 0.5,
            blendMode: "multiply" as const,
            isolation: true,
          },
        },
      ],
    };
    renderStill(harness.target.context, staticScene, 0, {
      scratchSurfacePool: harness.pool,
      staticDisplayCache,
    });
    const stagedFillCalls = vi.mocked(harness.surfaces[0]!.context.fill).mock
      .calls.length;
    renderStill(harness.target.context, staticScene, 1, {
      scratchSurfacePool: harness.pool,
      staticDisplayCache,
    });
    expect(
      vi.mocked(harness.surfaces[0]!.context.fill).mock.calls,
    ).toHaveLength(stagedFillCalls);
    expect(harness.pool.stats()).toMatchObject({
      allocations: 1,
      reuses: 0,
      detaches: 1,
      surfaceCount: 0,
      allocatedBytes: 0,
    });
    expect(staticDisplayCache.stats()).toMatchObject({
      entries: 1,
      hits: 1,
    });
    expect(harness.surfaces).toHaveLength(1);
  });

  it("uses direction in bounded text cache identity", () => {
    const cache = new BoundedTextMeasureCache();
    const target = createScratchRenderHarness().target.context;
    const base = {
      schemaVersion: 1 as const,
      width: 100,
      height: 40,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "label",
          type: "text" as const,
          text: "abc",
          style: { width: 80, height: 30, direction: "ltr" as const },
        },
      ],
    };
    compileCanvas2DDisplayList(target, base, 0, { textMeasureCache: cache });
    compileCanvas2DDisplayList(
      target,
      {
        ...base,
        nodes: [
          {
            ...base.nodes[0]!,
            style: { ...base.nodes[0]!.style, direction: "rtl" },
          },
        ],
      } as never,
      0,
      { textMeasureCache: cache },
    );
    expect(
      Array.from(cache.keys()).some((key) => key.includes("\u0000ltr\u0000")),
    ).toBe(true);
    expect(
      Array.from(cache.keys()).some((key) => key.includes("\u0000rtl\u0000")),
    ).toBe(true);
  });

  it("uses compiled glyph metrics and rich-run extents for isolation crops", () => {
    const harness = createScratchRenderHarness();
    harness.target.context.measureText = () =>
      ({
        width: 120,
        actualBoundingBoxAscent: 80,
        actualBoundingBoxDescent: 30,
      }) as TextMetrics;
    renderStill(
      harness.target.context,
      {
        schemaVersion: 1,
        width: 220,
        height: 220,
        fps: 30,
        duration: 1,
        assets: {},
        nodes: [
          {
            id: "overshoot",
            type: "text",
            runs: [{ text: "Á", style: { color: "#fff" } }],
            style: {
              position: "absolute",
              left: 60,
              top: 100,
              width: 10,
              height: 10,
              fontSize: 100,
              isolation: true,
            },
          },
        ],
      } as never,
      0,
      { scratchSurfacePool: harness.pool },
    );
    const composite = harness.target.drawImages[0]!;
    expect(composite[7]).toBeGreaterThanOrEqual(100);
    expect(composite[8]).toBeGreaterThanOrEqual(100);
  });
});

describe("audio-reactive trimmed rendering", () => {
  it("renders the same spectrum at equal source times despite different placement and speed", () => {
    const values = new Uint8Array(4 * 128);
    values.fill(255, 2 * 128, 3 * 128);
    const assets = {
      images: new Map(),
      fonts: new Map(),
      videos: new Map(),
      videoFrames: new Map(),
      audio: new Map(),
      audioSpectra: new Map([
        [
          "music",
          {
            fps: 1,
            barCount: 128,
            frameCount: 4,
            values,
            startTime: 0,
            duration: 4,
          },
        ],
      ]),
      lotties: new Map(),
      lottieFrames: new Map(),
    };
    const draw = (
      params: Record<string, unknown>,
      from: number,
      frame: number,
    ) => {
      const tops: number[] = [];
      const context = {
        save() {},
        restore() {},
        setTransform() {},
        clearRect() {},
        translate() {},
        rotate() {},
        scale() {},
        beginPath() {},
        moveTo() {},
        arcTo() {},
        closePath() {},
        fill() {},
        createLinearGradient(
          _x0: number,
          _y0: number,
          _x1: number,
          y1: number,
        ) {
          tops.push(y1);
          return { addColorStop() {} };
        },
      } as unknown as CanvasRenderingContext2D;
      renderStill(
        context,
        {
          schemaVersion: 1,
          width: 100,
          height: 100,
          fps: 30,
          duration: 120,
          assets: { music: { id: "music", type: "audio", src: "music.wav" } },
          nodes: [
            {
              id: "spectrum",
              type: "effect",
              effect: "spectrumBars",
              from,
              duration: 90,
              style: { position: "absolute", width: 100, height: 100 },
              params: { audioAssetId: "music", barCount: 8, ...params },
            },
          ],
        },
        frame,
        { assets: assets as never },
      );
      return tops;
    };
    const trimmed = draw({ audioStartTime: 1, audioPlaybackRate: 2 }, 30, 45);
    expect(trimmed).toEqual(draw({}, 0, 60));
    expect(trimmed).not.toEqual(draw({}, 30, 45));
    expect(draw({ audioStartTime: 5 }, 0, 0)).toEqual(draw({}, 0, 0));
  });
});

describe("rich active-plate isolation bounds", () => {
  it("retains padded plate ink outside the declared glyph box", () => {
    const harness = createScratchRenderHarness();
    renderStill(
      harness.target.context,
      {
        schemaVersion: 1,
        width: 320,
        height: 240,
        fps: 30,
        duration: 1,
        assets: {},
        nodes: [
          {
            id: "plate",
            type: "text",
            runs: [{ text: "X", style: { textBackgroundColor: "#ff00ff" } }],
            style: {
              position: "absolute",
              left: 100,
              top: 100,
              width: 20,
              height: 20,
              fontSize: 20,
              isolation: true,
              textBackgroundPaddingX: 60,
              textBackgroundPaddingY: 40,
              textBackgroundRadius: 24,
            },
          },
        ],
      },
      0,
      { scratchSurfacePool: harness.pool },
    );
    const composite = harness.target.drawImages[0]!;
    expect(composite[7]).toBeGreaterThanOrEqual(130);
    expect(composite[8]).toBeGreaterThanOrEqual(100);
  });
});
