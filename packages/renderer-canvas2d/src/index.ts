import {
  evaluateScene,
  layoutScene,
  normalizeLayoutCornerRadii,
  prepareTextLayout,
  resolveObjectFitRect,
  resolveLayoutCornerRadii,
  wrapTextLines,
  type LayoutCornerRadii,
  type LayoutBox,
  type MeasureTextLine,
  type ResolvedNode,
  type ResolvedScene,
} from "@motionforge/core";
import {
  inspectScene,
  parseScene,
  isAudioReactiveEffect,
  type Scene,
  type SceneAsset,
  type SceneNode,
  type SceneShapeGeometry,
  type SceneStyle,
  type SceneTextRun,
} from "@motionforge/schema";
import {
  parseBorderValue,
  parseConicGradientValue,
  parseLinearGradientValue,
  parseRadialGradientValue,
  parseShadowListValue,
  parseShadowValue,
  parseTransformOriginValue,
  parseTransformValue,
  resolveGradientStopOffsets,
  type TransformOriginComponent,
} from "@motionforge/schema/values";
import {
  createExtensionRegistry,
  preflightExtensions,
  type ExtensionRegistry,
  type ExtensionPreflightIssue,
  type ExtensionSceneNode,
  type ResolvedExtensionNode,
} from "@motionforge/extensions";
import {
  AudioAnalysisCache as BoundedAudioAnalysisCache,
  FontAssetCache,
  assetDeclarationKey,
  createBoundedAssetFetch,
  fetchAssetBounded,
  prepareAssetRequest,
  readResponseBytes,
  type AssetPolicy,
  type AssetSourceKind,
  type PreparedAssetRequest,
} from "./media-lifecycle.js";

export {
  AssetPolicyError,
  AudioAnalysisCache as BoundedAudioAnalysisCache,
  FontAssetCache,
  assetDeclarationKey,
  createAudioAnalysisCache as createBoundedAudioAnalysisCache,
  type AssetPolicy,
  type AssetPolicyContext,
  type AssetSourceKind,
  type CacheStats,
  type FontCacheStats,
  type FontLease,
  type PreparedAssetRequest,
} from "./media-lifecycle.js";

// Re-exported so existing imports keep working; the implementation moved to
// @motionforge/core where layout uses it for intrinsic text sizing.
export { wrapTextLines };
import {
  ALL_FORMATS,
  AudioSampleSink,
  BlobSource,
  CanvasSink,
  Input,
  UrlSource,
  type AudioSample,
  type InputVideoTrack,
  type WrappedCanvas,
} from "mediabunny";

export type RenderOptions = {
  clear?: boolean;
  /** Result of resolveAssets(). Required when the scene draws img/video nodes. */
  assets?: ResolvedAssets;
  /** A scene frame already resolved by prepareFrame(). */
  resolvedScene?: ResolvedScene;
  /** Reused across frames to avoid repeated canvas text measurement. */
  textMeasureCache?: TextMeasureCache;
};

export type ResolveAssetsOptions = {
  /** Trusted definitions available to extension nodes in this scene. */
  extensions?: ExtensionRegistry;
  /** Reject definitions that cannot execute in a worker host. */
  worker?: boolean;
  signal?: AbortSignal;
  /** Use declared proxy sources (normally true for preview, false for export). */
  preferProxy?: boolean;
  budget?: Partial<MediaResourceBudget>;
  analysisCache?: AudioAnalysisCache;
  /** Host-owned URL, credential, proxy, MIME, and byte policy. */
  assetPolicy?: AssetPolicy;
  /** Optional host-owned bounded font cache. */
  fontCache?: FontAssetCache<FontFace>;
  /** Precompute cached editor waveforms for reachable audio assets. */
  analyzeWaveforms?: boolean;
};

export type MediaResourceBudget = {
  maxSourceCacheBytes: number;
  maxDecodedImageBytes: number;
  maxVideoDecoders: number;
  /** Maximum bytes for any one buffered/direct asset. Optional for 1.0 compatibility. */
  maxAssetBytes?: number;
  /** Process-owned analysis cache ceiling; host-owned caches set their own policy. */
  maxAudioAnalysisCacheBytes?: number;
  /** Reachable fonts allowed in one resolution. Inject fontCache to own a different resident ceiling. */
  maxFontCacheEntries?: number;
  /** Maximum wait for a Lottie document to become ready. */
  maxLottieWaitMs?: number;
};

export const defaultMediaResourceBudget: MediaResourceBudget = {
  maxSourceCacheBytes: 64 * 1024 * 1024,
  maxDecodedImageBytes: 256 * 1024 * 1024,
  maxVideoDecoders: 8,
  maxAssetBytes: 512 * 1024 * 1024,
  maxAudioAnalysisCacheBytes: 64 * 1024 * 1024,
  maxFontCacheEntries: 32,
  maxLottieWaitMs: 15_000,
};

export function resolveMediaResourceBudget(
  overrides: Partial<MediaResourceBudget> = {},
): MediaResourceBudget {
  const budget = { ...defaultMediaResourceBudget, ...overrides };
  const finiteNonnegative = [
    "maxSourceCacheBytes",
    "maxDecodedImageBytes",
    "maxAssetBytes",
    "maxAudioAnalysisCacheBytes",
    "maxLottieWaitMs",
  ] as const;
  for (const key of finiteNonnegative) {
    const value = budget[key];
    if (value === undefined || !Number.isFinite(value) || value < 0) {
      throw new Error(`${key} must be a finite non-negative number.`);
    }
  }
  if (
    !Number.isInteger(budget.maxVideoDecoders) ||
    budget.maxVideoDecoders < 1
  ) {
    throw new Error("maxVideoDecoders must be a positive integer.");
  }
  if (
    budget.maxFontCacheEntries === undefined ||
    !Number.isInteger(budget.maxFontCacheEntries) ||
    budget.maxFontCacheEntries < 1
  ) {
    throw new Error("maxFontCacheEntries must be a positive integer.");
  }
  return budget;
}

export type Canvas2DExtensionDrawContext<
  P = unknown,
  ExtensionAssets = unknown,
  ExtensionFrame = unknown,
> = {
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  scene: Scene;
  node: ResolvedNode & ExtensionSceneNode;
  box: LayoutBox;
  params: P;
  resolvedAssets: ExtensionAssets;
  preparedFrame: ExtensionFrame;
  sceneFrame: number;
  localFrame: number;
  sceneFps: number;
};

export type Canvas2DExtensionAdapter<
  P = unknown,
  ExtensionAssets = unknown,
  ExtensionFrame = unknown,
> = {
  draw(
    context: Canvas2DExtensionDrawContext<P, ExtensionAssets, ExtensionFrame>,
  ): void;
};

export type ResolvedCanvas2DExtensionNode = Omit<
  ResolvedExtensionNode,
  "rendererAdapter"
> & {
  adapter: Canvas2DExtensionAdapter;
  resolvedAssets: unknown;
};

export type PreparedExtensionFrame = {
  sceneFrame: number;
  value: unknown;
};

export type TextMeasureCache = Map<string, number>;

export type Canvas2DPreflightIssue = {
  severity: "error" | "warning";
  code:
    | "audio_decoder_unavailable"
    | "canvas_unavailable"
    | "font_loading_unavailable"
    | "filter_unavailable"
    | "letter_spacing_unavailable"
    | "image_decoder_unavailable"
    | "lottie_requires_dom"
    | "extension_adapter_invalid"
    | "dom_matrix_unavailable"
    | "path2d_unavailable"
    | "conic_gradient_unavailable"
    | "video_decoder_budget_exceeded"
    | "decoded_image_budget_estimate_exceeded"
    | "asset_byte_budget_exceeded"
    | "video_decoder_unavailable";
  message: string;
};

export type Canvas2DPreflightResult = {
  ok: boolean;
  renderer: "canvas2d";
  requirements: {
    canvas: boolean;
    imageDecoder: boolean;
    videoDecoder: boolean;
    audioDecoder: boolean;
    fontLoading: boolean;
    domLottie: boolean;
    extensions: boolean;
    path2d: boolean;
    domMatrix: boolean;
    filter: boolean;
    conicGradient: boolean;
    letterSpacing: boolean;
  };
  issues: Array<Canvas2DPreflightIssue | ExtensionPreflightIssue>;
  resourceEstimate: MediaResourceEstimate;
};

export type Canvas2DPreflightOptions = Pick<
  ResolveAssetsOptions,
  "extensions" | "worker" | "budget"
>;

export type MediaResourceEstimate = {
  declaredAssets: number;
  reachableAssets: number;
  proxyAssets: number;
  estimatedDecodedImageBytes: number;
  maxSimultaneousVideoDecoders: number;
};

/**
 * Checks environment capabilities before asset loading or frame preparation.
 * This is intentionally synchronous: codec-specific negotiation remains the
 * exporter's job, while obvious unsupported runtime combinations fail early.
 */
export function preflightCanvas2D(
  sceneInput: unknown,
  globalObject: Partial<typeof globalThis> = globalThis,
  options: Canvas2DPreflightOptions = {},
): Canvas2DPreflightResult {
  const scene = parseScene(sceneInput);
  const budget = resolveMediaResourceBudget(options.budget);
  const inspection = inspectScene(scene);
  const extensionPreflight = preflightExtensions(
    scene,
    options.extensions ?? createExtensionRegistry(),
    { renderer: "canvas2d", worker: options.worker },
  );
  const reachableAssetIds = collectReachableAssetIds(
    scene,
    extensionPreflight.nodes,
  );
  const reachableAssets = Array.from(reachableAssetIds)
    .map((id) => scene.assets[id])
    .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
  const reachableByType = (type: (typeof reachableAssets)[number]["type"]) =>
    reachableAssets.filter((asset) => asset.type === type);
  const reachableImages = reachableByType("image");
  const reachableVideos = reachableByType("video");
  const reachableAudio = reachableByType("audio");
  const reachableFonts = reachableByType("font");
  const reachableLotties = reachableByType("lottie");
  const needsAudioDecoder =
    reachableAudio.length > 0 ||
    reachableVideos.some((asset) => asset.metadata?.hasAudio === true);
  const resourceEstimate = estimateMediaResources(
    scene,
    extensionPreflight.nodes,
  );
  const documentObject = globalObject.document;
  const hasDomCanvas = Boolean(documentObject?.createElement);
  const hasOffscreenCanvas = typeof globalObject.OffscreenCanvas === "function";
  const hasCanvas = hasDomCanvas || hasOffscreenCanvas;
  const hasImageDecoder = typeof globalObject.createImageBitmap === "function";
  const hasVideoDecoder = typeof globalObject.VideoDecoder === "function";
  const hasAudioDecoder = typeof globalObject.AudioDecoder === "function";
  const hasPath2D = typeof globalObject.Path2D === "function";
  const hasDomMatrix = typeof globalObject.DOMMatrix === "function";
  const hasFontLoading = Boolean(
    typeof globalObject.FontFace === "function" &&
    (documentObject?.fonts ||
      (globalObject as Partial<typeof globalThis> & { fonts?: FontFaceSet })
        .fonts),
  );
  const visualRequirements = inspectVisualRuntimeRequirements(scene.nodes);
  const canvasContext = probeCanvas2DContext(
    globalObject,
    documentObject,
    options.worker === true,
  );
  const hasCanvasFilter = Boolean(canvasContext && "filter" in canvasContext);
  const hasLetterSpacing = Boolean(
    canvasContext && "letterSpacing" in canvasContext,
  );
  const hasConicGradient = Boolean(
    canvasContext && typeof canvasContext.createConicGradient === "function",
  );
  const issues: Array<Canvas2DPreflightIssue | ExtensionPreflightIssue> = [];

  if (!hasCanvas) {
    issues.push({
      severity: "error",
      code: "canvas_unavailable",
      message:
        "Canvas2D rendering needs OffscreenCanvas or a DOM canvas element.",
    });
  }
  if (reachableImages.length > 0 && !hasImageDecoder) {
    issues.push({
      severity: "error",
      code: "image_decoder_unavailable",
      message: "Image assets need createImageBitmap in this renderer.",
    });
  }
  if (reachableVideos.length > 0 && !hasVideoDecoder) {
    issues.push({
      severity: "error",
      code: "video_decoder_unavailable",
      message: "Video assets need the WebCodecs VideoDecoder API.",
    });
  }
  if (needsAudioDecoder && !hasAudioDecoder) {
    issues.push({
      severity: "error",
      code: "audio_decoder_unavailable",
      message: "Audio assets need the WebCodecs AudioDecoder API.",
    });
  }
  if (reachableFonts.length > 0 && !hasFontLoading) {
    issues.push({
      severity: "error",
      code: "font_loading_unavailable",
      message:
        "Font assets need FontFace plus document.fonts or a worker FontFaceSet.",
    });
  }
  if (reachableLotties.length > 0 && !hasDomCanvas) {
    issues.push({
      severity: "error",
      code: "lottie_requires_dom",
      message:
        "The current Lottie adapter requires a DOM canvas; render this scene on the main thread or omit Lottie assets.",
    });
  }
  const needsPath2D =
    inspection.capabilities.hasShapes ||
    inspection.capabilities.hasClipping ||
    inspection.capabilities.hasMasks;
  if (needsPath2D && !hasPath2D) {
    issues.push({
      severity: "error",
      code: "path2d_unavailable",
      message:
        "Shape, clip, and mask nodes need the Canvas Path2D API in this renderer.",
    });
  }
  if (inspection.capabilities.hasVectorPaths && !hasDomMatrix) {
    issues.push({
      severity: "error",
      code: "dom_matrix_unavailable",
      message:
        "SVG path geometry needs DOMMatrix to map its viewBox into the node box.",
    });
  }
  if (visualRequirements.filter && !hasCanvasFilter) {
    issues.push({
      severity: "error",
      code: "filter_unavailable",
      message:
        "This scene uses Canvas2D filters, but the selected canvas runtime has no context.filter support.",
    });
  }
  if (visualRequirements.conicGradient && !hasConicGradient) {
    issues.push({
      severity: "error",
      code: "conic_gradient_unavailable",
      message:
        "This scene uses a conic gradient, but the selected canvas runtime has no createConicGradient() support.",
    });
  }
  if (visualRequirements.letterSpacing && !hasLetterSpacing) {
    issues.push({
      severity: "error",
      code: "letter_spacing_unavailable",
      message:
        "This scene uses text letter spacing, but the selected canvas runtime has no context.letterSpacing support.",
    });
  }
  if (resourceEstimate.maxSimultaneousVideoDecoders > budget.maxVideoDecoders) {
    issues.push({
      severity: "error",
      code: "video_decoder_budget_exceeded",
      message: `Scene may need ${resourceEstimate.maxSimultaneousVideoDecoders} simultaneous video decoders, above the budget of ${budget.maxVideoDecoders}.`,
    });
  }
  if (
    resourceEstimate.estimatedDecodedImageBytes > budget.maxDecodedImageBytes
  ) {
    issues.push({
      severity: "error",
      code: "decoded_image_budget_estimate_exceeded",
      message: `Declared image dimensions estimate ${resourceEstimate.estimatedDecodedImageBytes} decoded bytes, above the budget of ${budget.maxDecodedImageBytes}.`,
    });
  }
  const maxAssetBytes =
    budget.maxAssetBytes ??
    defaultMediaResourceBudget.maxAssetBytes ??
    Infinity;
  for (const asset of reachableAssets) {
    if (
      asset.metadata?.byteLength !== undefined &&
      asset.metadata.byteLength > maxAssetBytes
    ) {
      issues.push({
        severity: "error",
        code: "asset_byte_budget_exceeded",
        message: `Asset "${asset.id}" declares ${asset.metadata.byteLength} bytes, above the per-asset budget of ${maxAssetBytes}. Use a proxy or raise maxAssetBytes.`,
      });
    }
  }
  issues.push(...extensionPreflight.issues);
  for (const resolvedNode of extensionPreflight.nodes) {
    if (!isCanvas2DExtensionAdapter(resolvedNode.rendererAdapter)) {
      issues.push({
        severity: "error",
        code: "extension_adapter_invalid",
        message: `Extension ${resolvedNode.node.extension.name}@${resolvedNode.definition.version} declares canvas2d support but its adapter has no draw(context) function.`,
      });
    }
  }

  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    renderer: "canvas2d",
    requirements: {
      canvas: true,
      imageDecoder: reachableImages.length > 0,
      videoDecoder: reachableVideos.length > 0,
      audioDecoder: needsAudioDecoder,
      fontLoading: reachableFonts.length > 0,
      domLottie: reachableLotties.length > 0,
      extensions: inspection.capabilities.hasExtensions,
      path2d: needsPath2D,
      domMatrix: inspection.capabilities.hasVectorPaths,
      filter: visualRequirements.filter,
      conicGradient: visualRequirements.conicGradient,
      letterSpacing: visualRequirements.letterSpacing,
    },
    issues,
    resourceEstimate,
  };
}

function inspectVisualRuntimeRequirements(nodes: readonly SceneNode[]): {
  filter: boolean;
  conicGradient: boolean;
  letterSpacing: boolean;
} {
  let filter = false;
  let conicGradient = false;
  let letterSpacing = false;
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (node.style?.filter && node.style.filter !== "none") filter = true;
    if (isNonzeroLength(node.style?.letterSpacing)) letterSpacing = true;
    for (const paint of [
      node.style?.background,
      node.style?.fill,
      node.style?.stroke,
    ]) {
      if (paint && parseConicGradientValue(paint)) conicGradient = true;
    }
    for (const animation of node.animations ?? []) {
      if (
        animation.property === "filter" &&
        animation.frames.some(
          (frame) => typeof frame.value === "string" && frame.value !== "none",
        )
      ) {
        filter = true;
      }
      if (
        (animation.property === "background" ||
          animation.property === "fill" ||
          animation.property === "stroke") &&
        animation.frames.some(
          (frame) =>
            typeof frame.value === "string" &&
            parseConicGradientValue(frame.value) !== null,
        )
      ) {
        conicGradient = true;
      }
      if (
        animation.property === "letterSpacing" &&
        animation.frames.some((frame) => isNonzeroLength(frame.value))
      ) {
        letterSpacing = true;
      }
    }
    stack.push(...(node.children ?? []));
  }
  return { filter, conicGradient, letterSpacing };
}

function isNonzeroLength(value: unknown): boolean {
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return false;
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) && amount !== 0;
}

function probeCanvas2DContext(
  globalObject: Partial<typeof globalThis>,
  documentObject: Document | undefined,
  preferOffscreen: boolean,
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  const offscreen = () => {
    const Constructor = globalObject.OffscreenCanvas;
    if (typeof Constructor === "function") {
      return new Constructor(1, 1).getContext("2d");
    }
    return null;
  };
  try {
    if (preferOffscreen) return offscreen();
    const canvas = documentObject?.createElement?.("canvas");
    const context = canvas?.getContext?.("2d");
    if (context) return context;
    return offscreen();
  } catch {
    try {
      return offscreen();
    } catch {
      // Capability remains unavailable.
    }
  }
  return null;
}

/** A decodable video clip opened by resolveAssets(). */
export type VideoClip = {
  /** Clip duration in seconds. */
  duration: number;
  /** Natural display size of the video track. */
  width: number;
  height: number;
  /** The demuxed video track; cursors open decoders on it. Internal. */
  track: InputVideoTrack;
  /** Underlying input; closed by disposeAssets(). */
  input: Input;
  /** The clip's own audio track, when it has one (mixed into exports). */
  audio?: {
    duration: number;
    sampleRate: number;
    numberOfChannels: number;
    sink: AudioSampleSink;
  };
};

/** A decodable audio clip opened by resolveAssets(). */
export type AudioClip = {
  /** Clip duration in seconds. */
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  /** Decoded PCM access; consumed by the export mixer. */
  sink: AudioSampleSink;
  /** Underlying input; closed by disposeAssets(). */
  input: Input;
};

type MediabunnyInputInternals = {
  _demuxerPromise?: Promise<{ dispose(): void }> | null;
};

/**
 * Disposes pinned Mediabunny Inputs without its 1.46 rejected-demuxer `.then()`
 * creating an unhandled child promise. Remove this shim after the dependency
 * handles the rejection internally.
 */
export function disposeMediaInputSafely(input: Input): void {
  if (input.disposed) return;
  const internals = input as Input & MediabunnyInputInternals;
  const demuxer = internals._demuxerPromise ?? null;
  if (demuxer) internals._demuxerPromise = null;
  try {
    input.dispose();
  } finally {
    if (demuxer) {
      void demuxer
        .then(
          (resolved) => {
            try {
              resolved.dispose();
            } catch {
              // Built-in cleanup aggregates resources it owns; this late
              // dependency continuation has no synchronous caller.
            }
          },
          () => undefined,
        )
        .catch(() => undefined);
    }
  }
}

/** Copies decoded PCM without constructing a Web Audio AudioBuffer. */
function copyAudioSampleChannels(sample: AudioSample): Float32Array[] {
  return Array.from({ length: sample.numberOfChannels }, (_, planeIndex) => {
    const channel = new Float32Array(sample.numberOfFrames);
    sample.copyTo(channel, { planeIndex, format: "f32-planar" });
    return channel;
  });
}

export type AudioSpectrum = {
  fps: number;
  barCount: number;
  frameCount: number;
  values: Uint8Array;
};

export type AudioWaveform = {
  duration: number;
  values: Float32Array;
};

export type AudioAnalysis = {
  spectrum?: AudioSpectrum;
  waveform: AudioWaveform;
};

export type AudioAnalysisCache = Map<string, AudioAnalysis> & {
  getOrCreate?(
    key: string,
    loader: () => AudioAnalysis | Promise<AudioAnalysis>,
  ): Promise<AudioAnalysis>;
};

export function createAudioAnalysisCache(
  maxBytes = defaultMediaResourceBudget.maxAudioAnalysisCacheBytes ??
    64 * 1024 * 1024,
): AudioAnalysisCache {
  return new BoundedAudioAnalysisCache<AudioAnalysis>(maxBytes);
}

const sharedAudioAnalysisCache = createAudioAnalysisCache();

/** A loaded Lottie animation opened by resolveAssets(). */
export type LottieClip = {
  /** Lottie frame rate (independent of scene fps). */
  fr: number;
  /** First/last animation frames (op is exclusive, per the Lottie format). */
  ip: number;
  op: number;
  /** Natural size of the animation document. */
  width: number;
  height: number;
  /** The lottie-web player, seeked by prepareFrame(); destroyed on dispose. */
  animation: {
    goToAndStop(value: number, isFrame?: boolean): void;
    destroy(): void;
  };
  /** The canvas the player renders into; copied into per-node staging. */
  canvas: HTMLCanvasElement;
};

type LottieReadyAnimation = LottieClip["animation"] & {
  addEventListener(name: string, handler: (...args: unknown[]) => void): void;
  removeEventListener(
    name: string,
    handler: (...args: unknown[]) => void,
  ): void;
};

/** @internal Cancellable readiness gate shared by DOM Lottie loading tests. */
export async function waitForLottieReady(
  animation: LottieReadyAnimation,
  signal?: AbortSignal,
  timeoutMs = 15_000,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      animation.removeEventListener("DOMLoaded", onReady);
      animation.removeEventListener("data_failed", onFailed);
      if (error) reject(error);
      else resolve();
    };
    const onReady = () => finish();
    const onFailed = (error?: unknown) =>
      finish(
        error instanceof Error
          ? error
          : new Error("lottie-web reported data_failed."),
      );
    const onAbort = () => {
      try {
        assertNotAborted(signal);
      } catch (error) {
        finish(error);
      }
    };
    const timeout = setTimeout(
      () =>
        finish(new Error(`Lottie readiness timed out after ${timeoutMs}ms.`)),
      timeoutMs,
    );
    animation.addEventListener("DOMLoaded", onReady);
    animation.addEventListener("data_failed", onFailed);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

/** A decoded video frame staged for one scene frame by prepareFrame(). */
export type PreparedVideoFrame = {
  image: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
  /** The scene frame this image was prepared for; renderStill rejects stale frames. */
  sceneFrame: number;
};

export type ResolvedAssetSource = {
  assetId: string;
  declaredSource: string;
  resolvedSource: string;
  contentKey: string;
  usingProxy: boolean;
  sourceKind: AssetSourceKind;
  declarationKey: string;
};

/**
 * Decoded media for a scene, produced by resolveAssets(). Asset loading is
 * the only async phase: given the same scene, frame, and resolved assets,
 * rendering is pure and deterministic.
 */
export type ResolvedAssets = {
  images: Map<string, ImageBitmap>;
  /** Loaded font faces, keyed by asset id (which is the font-family name). */
  fonts: Map<string, FontFace>;
  /** Opened video clips, keyed by asset id. */
  videos: Map<string, VideoClip>;
  /** Frames staged by prepareFrame(), keyed by video node id. */
  videoFrames: Map<string, PreparedVideoFrame>;
  /** Opened audio clips, keyed by asset id. */
  audio: Map<string, AudioClip>;
  /** Compact, deterministic per-frame spectra for audio-reactive effects. */
  audioSpectra?: Map<string, AudioSpectrum>;
  audioWaveforms?: Map<string, AudioWaveform>;
  /** Loaded Lottie animations, keyed by asset id. */
  lotties: Map<string, LottieClip>;
  /** Lottie frames staged by prepareFrame(), keyed by lottie node id. */
  lottieFrames: Map<string, PreparedVideoFrame>;
  /**
   * Sequential decode cursors created lazily by prepareFrame(), keyed by
   * video node id + asset id. Disposed by disposeAssets(); pruned to the
   * nodes active in the frame so idle nodes never hold a decoder.
   */
  videoCursors?: Map<string, VideoPlaybackCursor>;
  /** Validated definitions and node-scoped resources for extension nodes. */
  extensionNodes?: Map<string, ResolvedCanvas2DExtensionNode>;
  /** Node-local values staged by extension prepareFrame hooks. */
  extensionFrames?: Map<string, PreparedExtensionFrame>;
  budget?: MediaResourceBudget;
  resourceUsage?: {
    decodedImageBytes: number;
    reachableAssets: number;
    declaredAssets: number;
  };
  /** Source identity used to reject stale reuse after Scene asset changes. */
  resolvedSources?: Map<string, ResolvedAssetSource>;
};

type ResolvedAssetsLifecycle = {
  controller: AbortController;
  disposed: boolean;
  disposal?: Promise<void>;
  abortCleanups: Set<() => void>;
  fontLeases: Map<string, { release(): void }>;
};

const resolvedAssetsLifecycles = new WeakMap<
  ResolvedAssets,
  ResolvedAssetsLifecycle
>();
const framePreparationQueues = new WeakMap<ResolvedAssets, Promise<void>>();

function getResolvedAssetsLifecycle(
  assets: ResolvedAssets,
): ResolvedAssetsLifecycle {
  let lifecycle = resolvedAssetsLifecycles.get(assets);
  if (!lifecycle) {
    lifecycle = {
      controller: new AbortController(),
      disposed: false,
      abortCleanups: new Set(),
      fontLeases: new Map(),
    };
    resolvedAssetsLifecycles.set(assets, lifecycle);
  }
  return lifecycle;
}

function assertAssetsAlive(assets: ResolvedAssets): void {
  if (getResolvedAssetsLifecycle(assets).disposed) {
    throw new Error(
      "Resolved assets are disposed; call resolveAssets(scene) for a new lease.",
    );
  }
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error("MotionForge asset resolution was aborted.");
  }
}

function combineAbortSignals(signals: Array<AbortSignal | undefined>): {
  signal: AbortSignal;
  dispose(): void;
} {
  const controller = new AbortController();
  const cleanups: Array<() => void> = [];
  const abortFrom = (signal: AbortSignal) => {
    if (!controller.signal.aborted) controller.abort(signal.reason);
  };
  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      abortFrom(signal);
      break;
    }
    const listener = () => abortFrom(signal);
    signal.addEventListener("abort", listener, { once: true });
    cleanups.push(() => signal.removeEventListener("abort", listener));
  }
  return {
    signal: controller.signal,
    dispose: () => cleanups.splice(0).forEach((cleanup) => cleanup()),
  };
}

async function awaitWithAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  onAbort?: () => void | Promise<void>,
): Promise<T> {
  assertNotAborted(signal);
  if (!signal) return promise;
  let listener: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    listener = () => {
      void Promise.resolve(onAbort?.()).finally(() => {
        try {
          assertNotAborted(signal);
        } catch (error) {
          reject(error);
        }
      });
    };
    signal.addEventListener("abort", listener, { once: true });
  });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    if (listener) signal.removeEventListener("abort", listener);
  }
}

function parseCanvas2DExtensionAdapter(
  value: unknown,
  resolvedNode: ResolvedExtensionNode,
): Canvas2DExtensionAdapter {
  if (!isCanvas2DExtensionAdapter(value)) {
    throw new Error(
      `Extension ${resolvedNode.node.extension.name}@${resolvedNode.definition.version} declares canvas2d support but its adapter has no draw(context) function.`,
    );
  }
  return value as Canvas2DExtensionAdapter;
}

function isCanvas2DExtensionAdapter(
  value: unknown,
): value is Canvas2DExtensionAdapter {
  return (
    typeof value === "object" &&
    value !== null &&
    "draw" in value &&
    typeof value.draw === "function"
  );
}

/**
 * Yields decoded frames in presentation order starting at a timestamp; the
 * first yielded frame is the one covering the start timestamp. CanvasSink
 * satisfies this; tests substitute a scripted source.
 */
export type SequentialFrameSource = {
  canvases(
    startTimestamp?: number,
  ): AsyncGenerator<WrappedCanvas, void, unknown>;
};

/**
 * Forward jumps larger than this (seconds) re-seek from a keyframe instead
 * of decoding every intermediate frame. Below it, sequential advance wins:
 * a re-seek decodes from the previous keyframe anyway.
 */
const CURSOR_RESEEK_AHEAD_SECONDS = 1;

/**
 * Reused canvases per cursor: the staged frame, the peeked next frame, and
 * headroom for multi-frame advances within one prepareFrame() call.
 * CanvasSink writes a pool slot only when a frame is pulled, so the slot a
 * staged frame lives in is not touched again until this many pulls later —
 * by which time the frame has been drawn and replaced.
 */
const CURSOR_CANVAS_POOL_SIZE = 4;

/**
 * Sequential access to one video node's decoded frames. Playback and export
 * request monotonically increasing timestamps, so frames come from a single
 * canvases() iterator that decodes each packet exactly once — random-access
 * getCanvas() per frame re-decodes from the previous keyframe and cannot
 * keep up with real media. Backward seeks and far-forward jumps re-seek.
 */
export class VideoPlaybackCursor {
  private iterator: AsyncGenerator<WrappedCanvas, void, unknown> | null = null;
  private current: WrappedCanvas | null = null;
  private next: WrappedCanvas | null = null;
  private lastRequested = Number.NEGATIVE_INFINITY;

  constructor(private readonly source: SequentialFrameSource) {}

  /**
   * The frame covering `timestamp` (last frame starting at or before it), or
   * the clip's first frame for timestamps before it. Not reentrant: one
   * request at a time per cursor, which prepareFrame() guarantees by using
   * one cursor per video node.
   */
  async frameAt(timestamp: number): Promise<WrappedCanvas | null> {
    // A request between current and next needs no decoding at all — the
    // common case whenever the scene fps exceeds the clip fps.
    if (
      this.current &&
      timestamp >= this.current.timestamp &&
      (this.next === null || timestamp < this.next.timestamp)
    ) {
      this.lastRequested = timestamp;
      return this.current;
    }

    // `timestamp < current.timestamp` alone is not a backward seek: requests
    // before the clip's first frame resolve to that first frame, and
    // re-seeking for each of them would decode the head of the clip per
    // request. Only a decrease in requested time is a real seek.
    const seekedBackward =
      timestamp < this.lastRequested &&
      this.current !== null &&
      timestamp < this.current.timestamp;
    const jumpedFar =
      this.next !== null &&
      timestamp - this.next.timestamp > CURSOR_RESEEK_AHEAD_SECONDS;

    this.lastRequested = timestamp;

    if (this.iterator === null || seekedBackward || jumpedFar) {
      await this.reseek(timestamp);
    }

    while (this.next !== null && this.next.timestamp <= timestamp) {
      this.current = this.next;
      this.next = await this.pull();
    }

    return this.current;
  }

  private async reseek(timestamp: number): Promise<void> {
    await this.closeIterator();
    this.iterator = this.source.canvases(Math.max(0, timestamp));
    this.current = await this.pull();
    this.next = await this.pull();
  }

  private async pull(): Promise<WrappedCanvas | null> {
    if (!this.iterator) {
      return null;
    }

    const result = await this.iterator.next();
    return result.done ? null : result.value;
  }

  /** Terminates the decode pipeline. The cursor must not be used afterwards. */
  async dispose(): Promise<void> {
    await this.closeIterator();
  }

  private async closeIterator(): Promise<void> {
    const iterator = this.iterator;
    this.iterator = null;
    this.current = null;
    this.next = null;

    if (iterator) {
      await iterator.return(undefined);
    }
  }
}

const sharedFontCaches = new WeakMap<object, FontAssetCache<FontFace>>();

function getSharedFontCache(fontSet: FontFaceSet): FontAssetCache<FontFace> {
  let cache = sharedFontCaches.get(fontSet);
  if (!cache) {
    cache = new FontAssetCache<FontFace>({
      maxEntries: defaultMediaResourceBudget.maxFontCacheEntries ?? 32,
      maxBytes: 64 * 1024 * 1024,
      fontSet,
    });
    sharedFontCaches.set(fontSet, cache);
  }
  return cache;
}

/**
 * Fetches and decodes every asset the scene references. Call once per scene
 * (or whenever scene.assets changes) and pass the result to renderStill via
 * options.assets. Throws with the failing asset id and src on any failure;
 * a scene never renders with silently missing media.
 */
export async function resolveAssets(
  scene: Scene,
  options: ResolveAssetsOptions = {},
): Promise<ResolvedAssets> {
  const parsed = parseScene(scene);
  const budget = resolveMediaResourceBudget(options.budget);
  assertNotAborted(options.signal);
  const extensionPreflight = preflightExtensions(
    parsed,
    options.extensions ?? createExtensionRegistry(),
    { renderer: "canvas2d", worker: options.worker },
  );
  if (!extensionPreflight.ok) {
    throw new Error(
      `Canvas2D extension preflight failed:\n${extensionPreflight.issues
        .map((issue) => `- [${issue.code}] ${issue.message}`)
        .join("\n")}`,
    );
  }
  const extensionAdapters = new Map(
    extensionPreflight.nodes.map((resolvedNode) => [
      resolvedNode.node.id,
      parseCanvas2DExtensionAdapter(resolvedNode.rendererAdapter, resolvedNode),
    ]),
  );
  const reachableAssetIds = collectReachableAssetIds(
    parsed,
    extensionPreflight.nodes,
  );
  const reachableFontCount = Array.from(reachableAssetIds).filter(
    (id) => parsed.assets[id]?.type === "font",
  ).length;
  const effectiveFontLimit = options.fontCache
    ? (budget.maxFontCacheEntries ?? 32)
    : Math.min(
        budget.maxFontCacheEntries ?? 32,
        defaultMediaResourceBudget.maxFontCacheEntries ?? 32,
      );
  if (reachableFontCount > effectiveFontLimit) {
    throw new Error(
      `Reachable font count ${reachableFontCount} exceeds maxFontCacheEntries. Supply a larger host-owned cache or reduce fonts.`,
    );
  }
  const images = new Map<string, ImageBitmap>();
  const fonts = new Map<string, FontFace>();
  const videos = new Map<string, VideoClip>();
  const audio = new Map<string, AudioClip>();
  const lotties = new Map<string, LottieClip>();
  const resolvedSources = new Map<string, ResolvedAssetSource>();
  let decodedImageBytes = 0;
  const resolvedAssets: ResolvedAssets = {
    images,
    fonts,
    videos,
    videoFrames: new Map(),
    audio,
    audioSpectra: new Map(),
    audioWaveforms: new Map(),
    lotties,
    lottieFrames: new Map(),
    extensionNodes: new Map(),
    extensionFrames: new Map(),
    budget,
    resourceUsage: {
      decodedImageBytes: 0,
      reachableAssets: reachableAssetIds.size,
      declaredAssets: Object.keys(parsed.assets).length,
    },
    resolvedSources,
  };
  const lifecycle = getResolvedAssetsLifecycle(resolvedAssets);
  const failureController = new AbortController();
  const combined = combineAbortSignals([
    options.signal,
    failureController.signal,
    lifecycle.controller.signal,
  ]);
  const signal = combined.signal;
  const assetPolicy = withAssetByteBudget(
    options.assetPolicy,
    budget.maxAssetBytes ??
      defaultMediaResourceBudget.maxAssetBytes ??
      512 * 1024 * 1024,
  );

  try {
    await runResolutionTasks(
      Object.values(parsed.assets)
        .filter((asset) => reachableAssetIds.has(asset.id))
        .map((asset) => async () => {
          assertNotAborted(signal);
          const preferAssetProxy =
            (options.preferProxy ?? false) && asset.type !== "font";
          const request = await prepareAssetRequest(asset, {
            policy: assetPolicy,
            signal,
            preferProxy: preferAssetProxy,
          });
          const src = request.source;
          const declaredSource =
            request.sourceKind === "declared-proxy"
              ? (asset.proxy?.src ?? request.source)
              : request.sourceKind === "primary"
                ? asset.src
                : request.source;
          resolvedSources.set(asset.id, {
            assetId: asset.id,
            declaredSource,
            resolvedSource: src,
            contentKey: request.contentKey,
            usingProxy:
              request.sourceKind === "declared-proxy" ||
              request.sourceKind === "derived-proxy",
            sourceKind: request.sourceKind,
            declarationKey: request.declarationKey,
          });
          try {
            if (asset.type === "image") {
              const image = await decodeImageBlob(
                await readPreparedAssetBlob(asset, request, signal),
              );
              if (signal.aborted) {
                image.close();
                assertNotAborted(signal);
              }
              decodedImageBytes += image.width * image.height * 4;
              if (decodedImageBytes > budget.maxDecodedImageBytes) {
                image.close();
                throw new Error(
                  `Decoded image budget exceeded (${decodedImageBytes} > ${budget.maxDecodedImageBytes} bytes). Use proxy assets or raise resolveAssets().budget.maxDecodedImageBytes.`,
                );
              }
              images.set(asset.id, image);
            } else if (asset.type === "font") {
              const lease = await loadFont(
                asset.id,
                asset,
                request,
                options.fontCache,
                signal,
              );
              lifecycle.fontLeases.set(asset.id, lease);
              fonts.set(asset.id, lease.face);
            } else if (asset.type === "video") {
              videos.set(
                asset.id,
                await openVideoClip(
                  asset,
                  request,
                  asset.sourceMode ?? "auto",
                  budget,
                  signal,
                  lifecycle.abortCleanups,
                ),
              );
            } else if (asset.type === "audio") {
              audio.set(
                asset.id,
                await openAudioClip(
                  asset,
                  request,
                  asset.sourceMode ?? "auto",
                  budget,
                  signal,
                  lifecycle.abortCleanups,
                ),
              );
            } else if (asset.type === "lottie") {
              lotties.set(
                asset.id,
                await openLottieClip(
                  asset,
                  request,
                  signal,
                  budget.maxLottieWaitMs ??
                    defaultMediaResourceBudget.maxLottieWaitMs ??
                    15_000,
                ),
              );
            }
          } catch (cause) {
            throw new Error(
              `Failed to load ${asset.type} asset "${asset.id}" from ${truncateSrc(src)}: ${cause instanceof Error ? cause.message : String(cause)}`,
              { cause },
            );
          }
        }),
      failureController,
    );

    const assetDefinitions = new Map(Object.entries(parsed.assets));
    const extensionNodes = resolvedAssets.extensionNodes ?? new Map();
    await runResolutionTasks(
      extensionPreflight.nodes.map((resolvedNode) => async () => {
        assertNotAborted(signal);
        const adapter = extensionAdapters.get(resolvedNode.node.id);
        if (!adapter) {
          throw new Error(
            `Canvas2D extension adapter for node "${resolvedNode.node.id}" disappeared after preflight.`,
          );
        }
        const resolvedAssets = resolvedNode.definition.resolveAssets
          ? await Promise.resolve(
              resolvedNode.definition.resolveAssets({
                scene: parsed,
                node: resolvedNode.node,
                params: resolvedNode.params,
                requirements: resolvedNode.requirements,
                assets: assetDefinitions,
                signal,
              }),
            ).catch((cause: unknown) => {
              throw new Error(
                `Failed to resolve extension ${resolvedNode.node.extension.name}@${resolvedNode.definition.version} for node "${resolvedNode.node.id}": ${cause instanceof Error ? cause.message : String(cause)}`,
                { cause },
              );
            })
          : undefined;
        extensionNodes.set(resolvedNode.node.id, {
          node: resolvedNode.node,
          definition: resolvedNode.definition,
          params: resolvedNode.params,
          requirements: resolvedNode.requirements,
          adapter,
          resolvedAssets,
        });
      }),
      failureController,
    );

    const spectrumAssetIds = collectSpectrumAssetIds(parsed.nodes);
    const analysisAssetIds = new Set([
      ...(options.analyzeWaveforms ? audio.keys() : []),
      ...spectrumAssetIds,
    ]);
    const audioSpectra = resolvedAssets.audioSpectra ?? new Map();
    const audioWaveforms = resolvedAssets.audioWaveforms ?? new Map();
    const configuredAnalysisBytes =
      budget.maxAudioAnalysisCacheBytes ??
      defaultMediaResourceBudget.maxAudioAnalysisCacheBytes ??
      64 * 1024 * 1024;
    const analysisCache =
      options.analysisCache ??
      (configuredAnalysisBytes ===
      defaultMediaResourceBudget.maxAudioAnalysisCacheBytes
        ? sharedAudioAnalysisCache
        : createAudioAnalysisCache(configuredAnalysisBytes));
    const retainedAnalyses = new Set<AudioAnalysis>();
    let retainedAnalysisBytes = 0;
    await runResolutionTasksSequential(
      Array.from(analysisAssetIds).map((assetId) => async () => {
        assertNotAborted(signal);
        const clip = audio.get(assetId);

        if (!clip) {
          throw new Error(
            `Audio-reactive effect references audio asset "${assetId}", but that asset could not be resolved.`,
          );
        }

        const needsSpectrum = spectrumAssetIds.has(assetId);
        const contentKey =
          resolvedSources.get(assetId)?.contentKey ?? `asset:${assetId}`;
        const analysisKey = `${contentKey}\u0000audio-analysis-v1\u0000${needsSpectrum ? "spectrum" : "waveform"}\u0000${parsed.fps}\u0000${parsed.duration}`;
        const analysisDuration = Math.min(
          clip.duration,
          parsed.duration / parsed.fps,
        );
        const createAnalysis = async (): Promise<AudioAnalysis> => {
          const analysis = needsSpectrum
            ? await analyzeAudio(clip, analysisDuration, parsed.fps, signal)
            : {
                waveform: await analyzeAudioWaveform(
                  clip,
                  analysisDuration,
                  2048,
                  signal,
                ),
              };
          assertNotAborted(signal);
          return analysis;
        };
        let analysis: AudioAnalysis;
        if (analysisCache.getOrCreate) {
          analysis = await analysisCache.getOrCreate(
            analysisKey,
            createAnalysis,
          );
        } else {
          analysis = analysisCache.get(analysisKey) ?? (await createAnalysis());
          analysisCache.set(analysisKey, analysis);
        }
        if (!retainedAnalyses.has(analysis)) {
          retainedAnalyses.add(analysis);
          retainedAnalysisBytes +=
            analysis.waveform.values.byteLength +
            (analysis.spectrum?.values.byteLength ?? 0);
          if (retainedAnalysisBytes > configuredAnalysisBytes) {
            throw new Error(
              `Resolved audio analysis exceeds the ${configuredAnalysisBytes}-byte budget. Analyze fewer assets or raise maxAudioAnalysisCacheBytes.`,
            );
          }
        }
        if (needsSpectrum && analysis.spectrum) {
          audioSpectra.set(assetId, analysis.spectrum);
        }
        audioWaveforms.set(assetId, analysis.waveform);
      }),
      failureController,
    );

    if (resolvedAssets.resourceUsage) {
      resolvedAssets.resourceUsage.decodedImageBytes = decodedImageBytes;
    }
    assertNotAborted(signal);
    lifecycle.abortCleanups.forEach((cleanup) => cleanup());
    lifecycle.abortCleanups.clear();
    return resolvedAssets;
  } catch (cause) {
    if (!failureController.signal.aborted) failureController.abort(cause);
    try {
      await disposeAssetsAsync(resolvedAssets);
    } catch (cleanupError) {
      throw new AggregateError(
        [cause, cleanupError],
        "MotionForge asset resolution failed and rollback reported errors.",
        { cause },
      );
    }
    throw cause;
  } finally {
    combined.dispose();
  }
}

async function runResolutionTasks(
  tasks: Array<() => Promise<void>>,
  failureController: AbortController,
): Promise<void> {
  const results = await Promise.allSettled(
    tasks.map(async (task) => {
      try {
        await task();
      } catch (error) {
        if (!failureController.signal.aborted) failureController.abort(error);
        throw error;
      }
    }),
  );
  const failed = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failed) {
    throw failureController.signal.aborted
      ? failureController.signal.reason
      : failed.reason;
  }
}

async function runResolutionTasksSequential(
  tasks: Array<() => Promise<void>>,
  failureController: AbortController,
): Promise<void> {
  for (const task of tasks) {
    try {
      await task();
    } catch (error) {
      if (!failureController.signal.aborted) failureController.abort(error);
      throw error;
    }
  }
}

/**
 * Starts best-effort disposal for backwards compatibility. New lifecycle
 * owners should await disposeAssetsAsync() so decoder shutdown completes
 * before the underlying Inputs are closed.
 */
export function disposeAssets(assets: ResolvedAssets): void {
  void disposeAssetsAsync(assets).catch(() => {
    // The legacy void API has nowhere to deliver asynchronous teardown errors.
  });
}

/** Transactional, idempotent teardown for every built-in and extension resource. */
export function disposeAssetsAsync(assets: ResolvedAssets): Promise<void> {
  const lifecycle = getResolvedAssetsLifecycle(assets);
  if (lifecycle.disposal) return lifecycle.disposal;
  lifecycle.disposed = true;
  lifecycle.controller.abort(
    createAbortError("Resolved assets were disposed."),
  );

  lifecycle.disposal = (async () => {
    const preparation = framePreparationQueues.get(assets);
    if (preparation) await preparation.catch(() => undefined);

    const disposalErrors: unknown[] = [];
    const extensionDisposals: Array<Promise<void>> = [];
    const cursorDisposals: Array<Promise<void>> = [];
    const videos = Array.from(assets.videos.values());
    const audio = Array.from(assets.audio.values());

    lifecycle.abortCleanups.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        disposalErrors.push(error);
      }
    });
    lifecycle.abortCleanups.clear();

    Array.from(assets.extensionNodes?.values() ?? []).forEach((runtime) => {
      try {
        extensionDisposals.push(
          Promise.resolve(
            runtime.definition.disposeAssets?.(runtime.resolvedAssets),
          ),
        );
      } catch (error) {
        disposalErrors.push(error);
      }
    });
    Array.from(assets.videoCursors?.values() ?? []).forEach((cursor) => {
      try {
        cursorDisposals.push(cursor.dispose());
      } catch (error) {
        disposalErrors.push(error);
      }
    });
    assets.images.forEach((image) => {
      try {
        image.close();
      } catch (error) {
        disposalErrors.push(error);
      }
    });
    lifecycle.fontLeases.forEach((lease) => {
      try {
        lease.release();
      } catch (error) {
        disposalErrors.push(error);
      }
    });
    Array.from(assets.lotties.values()).forEach((clip) => {
      try {
        clip.animation.destroy();
      } catch (error) {
        disposalErrors.push(error);
      }
    });

    assets.extensionNodes?.clear();
    assets.extensionFrames?.clear();
    assets.images.clear();
    assets.fonts.clear();
    lifecycle.fontLeases.clear();
    assets.videoCursors?.clear();
    assets.videos.clear();
    assets.videoFrames.clear();
    assets.audio.clear();
    assets.audioSpectra?.clear();
    assets.audioWaveforms?.clear();
    assets.lotties.clear();
    assets.lottieFrames.clear();
    assets.resolvedSources?.clear();

    for (const result of await Promise.allSettled([
      ...extensionDisposals,
      ...cursorDisposals,
    ])) {
      if (result.status === "rejected") disposalErrors.push(result.reason);
    }

    // Cursors must stop before their shared Inputs are closed.
    [...videos, ...audio].forEach((clip) => {
      try {
        disposeMediaInputSafely(clip.input);
      } catch (error) {
        disposalErrors.push(error);
      }
    });

    if (disposalErrors.length > 0) {
      throw new AggregateError(
        disposalErrors,
        "One or more MotionForge media resources failed to dispose.",
      );
    }
  })();

  return lifecycle.disposal;
}

function createAbortError(message: string): Error {
  if (typeof DOMException === "function") {
    return new DOMException(message, "AbortError");
  }
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function collectReachableAssetIds(
  scene: Scene,
  extensionNodes: readonly ResolvedExtensionNode[] = [],
): Set<string> {
  const ids = new Set<string>();
  const visit = (nodes: Scene["nodes"]): void => {
    for (const node of nodes) {
      if (node.assetId) ids.add(node.assetId);
      if (node.params?.audioAssetId) ids.add(node.params.audioAssetId);
      if (node.params?.coverAssetId) ids.add(node.params.coverAssetId);
      if (
        node.style?.fontFamily &&
        scene.assets[node.style.fontFamily]?.type === "font"
      ) {
        ids.add(node.style.fontFamily);
      }
      visit(node.children ?? []);
    }
  };
  visit(scene.nodes);
  extensionNodes.forEach((node) =>
    node.requirements.forEach((requirement) => {
      if (scene.assets[requirement.assetId]) ids.add(requirement.assetId);
    }),
  );
  return ids;
}

/** Rejects reuse when a Scene asset id now points at different source content. */
export function assertResolvedAssetsCompatible(
  sceneInput: unknown,
  assets: ResolvedAssets,
): void {
  const scene = parseScene(sceneInput);
  assets.resolvedSources?.forEach((resolved, assetId) => {
    const current = scene.assets[assetId];
    if (!current) {
      throw new Error(
        `Resolved asset "${assetId}" is absent from the current Scene. Resolve a new asset lease.`,
      );
    }
    if (
      current.metadata?.contentHash &&
      current.metadata.contentHash === resolved.contentKey
    ) {
      return;
    }
    if (assetDeclarationKey(current) !== resolved.declarationKey) {
      throw new Error(
        `Scene asset "${assetId}" changed source after resolution. Resolve assets again or provide a stable metadata.contentHash through the host policy.`,
      );
    }
  });
}

export function estimateMediaResources(
  sceneInput: unknown,
  extensionNodes: readonly ResolvedExtensionNode[] = [],
): MediaResourceEstimate {
  const scene = parseScene(sceneInput);
  const reachable = collectReachableAssetIds(scene, extensionNodes);
  const events: Array<{ frame: number; delta: number }> = [];
  const visit = (
    nodes: Scene["nodes"],
    origin: number,
    parentStart: number,
    parentEnd: number,
    parentDuration: number,
  ): void => {
    for (const node of nodes) {
      const start = origin + (node.from ?? 0);
      const duration = node.duration ?? parentDuration;
      const activeStart = Math.max(start, parentStart);
      const activeEnd = Math.min(start + duration, parentEnd);
      if (activeStart >= activeEnd) continue;
      if (node.type === "video" && activeStart < activeEnd) {
        events.push({ frame: activeStart, delta: 1 });
        events.push({ frame: activeEnd, delta: -1 });
      }
      visit(node.children ?? [], start, activeStart, activeEnd, duration);
    }
  };
  visit(scene.nodes, 0, 0, scene.duration, scene.duration);
  events.sort(
    (left, right) => left.frame - right.frame || left.delta - right.delta,
  );
  let active = 0;
  let maxSimultaneousVideoDecoders = 0;
  events.forEach((event) => {
    active += event.delta;
    maxSimultaneousVideoDecoders = Math.max(
      maxSimultaneousVideoDecoders,
      active,
    );
  });
  let estimatedDecodedImageBytes = 0;
  let proxyAssets = 0;
  reachable.forEach((id) => {
    const asset = scene.assets[id];
    if (!asset) return;
    if (asset.proxy) proxyAssets += 1;
    if (asset.type === "image") {
      const width = asset.metadata?.width ?? asset.proxy?.width ?? 0;
      const height = asset.metadata?.height ?? asset.proxy?.height ?? 0;
      estimatedDecodedImageBytes += width * height * 4;
    }
  });
  return {
    declaredAssets: Object.keys(scene.assets).length,
    reachableAssets: reachable.size,
    proxyAssets,
    estimatedDecodedImageBytes,
    maxSimultaneousVideoDecoders,
  };
}

function withAssetByteBudget(
  policy: AssetPolicy | undefined,
  maximum: number,
): AssetPolicy {
  const base = policy ?? {};
  return {
    ...base,
    maxBytes: (asset, context) => {
      const configured =
        typeof base.maxBytes === "function"
          ? base.maxBytes(asset, context)
          : base.maxBytes;
      return Math.min(maximum, configured ?? Number.POSITIVE_INFINITY);
    },
  };
}

function withoutSignal(init: RequestInit): Omit<RequestInit, "signal"> {
  const { signal: _signal, ...rest } = init;
  return rest;
}

async function readPreparedAssetBytes(
  asset: SceneAsset,
  request: PreparedAssetRequest,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const response = await fetchPreparedAssetResponse(asset, request, signal);
  return readResponseBytes(response, {
    maxBytes: request.maxBytes,
    signal,
  });
}

async function fetchPreparedAssetResponse(
  asset: SceneAsset,
  request: PreparedAssetRequest,
  signal?: AbortSignal,
): Promise<Response> {
  return fetchAssetBounded(asset, {
    policy: request.policy,
    signal,
    source: request.source,
    requestInit: withoutSignal(request.init),
  });
}

async function readPreparedAssetBlob(
  asset: SceneAsset,
  request: PreparedAssetRequest,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetchPreparedAssetResponse(asset, request, signal);
  const bytes = await readResponseBytes(response, {
    maxBytes: request.maxBytes,
    signal,
  });
  return new Blob([ownedArrayBuffer(bytes)], {
    type:
      asset.metadata?.mimeType ??
      response.headers.get("content-type")?.split(";", 1)[0] ??
      "",
  });
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function collectSpectrumAssetIds(nodes: Scene["nodes"]): Set<string> {
  const ids = new Set<string>();

  const visit = (items: Scene["nodes"]): void => {
    items.forEach((node) => {
      if (
        node.type === "effect" &&
        isAudioReactiveEffect(node.effect) &&
        node.params?.audioAssetId
      ) {
        ids.add(node.params.audioAssetId);
      }
      visit(node.children ?? []);
    });
  };

  visit(nodes);
  return ids;
}

const SPECTRUM_SAMPLE_RATE = 8192;
const SPECTRUM_FFT_SIZE = 512;
const SPECTRUM_BAR_COUNT = 128;
const SPECTRUM_MAX_FPS = 15;

async function analyzeAudio(
  clip: AudioClip,
  durationSeconds: number,
  sceneFps: number,
  signal?: AbortSignal,
): Promise<AudioAnalysis> {
  assertNotAborted(signal);
  const sampleCount = Math.max(
    1,
    Math.ceil(durationSeconds * SPECTRUM_SAMPLE_RATE),
  );
  const mono = new Float32Array(sampleCount);

  for await (const sample of clip.sink.samples(0, durationSeconds)) {
    try {
      assertNotAborted(signal);
      const sourceRate = sample.sampleRate;
      const channels = copyAudioSampleChannels(sample);
      const startIndex = Math.max(
        0,
        Math.floor(sample.timestamp * SPECTRUM_SAMPLE_RATE),
      );
      const endIndex = Math.min(
        sampleCount,
        Math.ceil((sample.timestamp + sample.duration) * SPECTRUM_SAMPLE_RATE),
      );

      for (
        let targetIndex = startIndex;
        targetIndex < endIndex;
        targetIndex += 1
      ) {
        const sourceIndex = Math.min(
          sample.numberOfFrames - 1,
          Math.max(
            0,
            Math.floor(
              (targetIndex / SPECTRUM_SAMPLE_RATE - sample.timestamp) *
                sourceRate,
            ),
          ),
        );
        let value = 0;
        for (const channel of channels) {
          value += channel[sourceIndex] ?? 0;
        }
        mono[targetIndex] = value / Math.max(1, channels.length);
      }
    } finally {
      sample.close();
    }
  }

  const fps = Math.min(SPECTRUM_MAX_FPS, sceneFps);
  const frameCount = Math.max(1, Math.ceil(durationSeconds * fps));
  const values = new Uint8Array(frameCount * SPECTRUM_BAR_COUNT);
  const real = new Float64Array(SPECTRUM_FFT_SIZE);
  const imag = new Float64Array(SPECTRUM_FFT_SIZE);
  const magnitudes = new Float64Array(SPECTRUM_FFT_SIZE / 2);

  for (let frame = 0; frame < frameCount; frame += 1) {
    if (frame % 8 === 0) assertNotAborted(signal);
    const center = Math.round((frame / fps) * SPECTRUM_SAMPLE_RATE);
    const start = center - Math.floor(SPECTRUM_FFT_SIZE / 2);

    for (let index = 0; index < SPECTRUM_FFT_SIZE; index += 1) {
      const sampleIndex = start + index;
      const window =
        0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (SPECTRUM_FFT_SIZE - 1));
      real[index] = (mono[sampleIndex] ?? 0) * window;
      imag[index] = 0;
    }

    fftInPlace(real, imag);
    let framePeak = 0;
    for (let index = 1; index < magnitudes.length; index += 1) {
      const magnitude =
        Math.hypot(real[index] ?? 0, imag[index] ?? 0) / SPECTRUM_FFT_SIZE;
      magnitudes[index] = magnitude;
      framePeak = Math.max(framePeak, magnitude);
    }

    for (let bar = 0; bar < SPECTRUM_BAR_COUNT; bar += 1) {
      const frequency =
        45 * Math.pow(4000 / 45, bar / Math.max(1, SPECTRUM_BAR_COUNT - 1));
      const bin = Math.min(
        magnitudes.length - 1,
        Math.max(
          1,
          Math.round((frequency * SPECTRUM_FFT_SIZE) / SPECTRUM_SAMPLE_RATE),
        ),
      );
      const magnitude =
        ((magnitudes[bin - 1] ?? 0) +
          (magnitudes[bin] ?? 0) * 2 +
          (magnitudes[bin + 1] ?? 0)) /
        4;
      const absolute = Math.log1p(magnitude * 220) / Math.log(221);
      const relative = framePeak > 0 ? magnitude / framePeak : 0;
      const normalized = clamp01(
        Math.pow(absolute * 0.78 + relative * 0.34, 0.7),
      );
      values[frame * SPECTRUM_BAR_COUNT + bar] = Math.round(normalized * 255);
    }
  }

  return {
    spectrum: { fps, barCount: SPECTRUM_BAR_COUNT, frameCount, values },
    waveform: {
      duration: durationSeconds,
      values: waveformFromSamples(mono),
    },
  };
}

export function waveformFromSamples(
  samples: Float32Array,
  pointCount = 2048,
): Float32Array {
  const count = Math.max(1, Math.min(pointCount, samples.length || 1));
  const values = new Float32Array(count);
  for (let point = 0; point < count; point += 1) {
    const start = Math.floor((point / count) * samples.length);
    const end = Math.max(
      start + 1,
      Math.floor(((point + 1) / count) * samples.length),
    );
    let peak = 0;
    for (let index = start; index < end && index < samples.length; index += 1) {
      peak = Math.max(peak, Math.abs(samples[index] ?? 0));
    }
    values[point] = peak;
  }
  return values;
}

async function analyzeAudioWaveform(
  clip: AudioClip,
  duration: number,
  pointCount = 2048,
  signal?: AbortSignal,
): Promise<AudioWaveform> {
  assertNotAborted(signal);
  const values = new Float32Array(Math.max(1, pointCount));
  for await (const sample of clip.sink.samples(0, duration)) {
    try {
      assertNotAborted(signal);
      const channels = copyAudioSampleChannels(sample);
      for (
        let sampleIndex = 0;
        sampleIndex < sample.numberOfFrames;
        sampleIndex += 1
      ) {
        if (sampleIndex % 4096 === 0) assertNotAborted(signal);
        const at = sample.timestamp + sampleIndex / sample.sampleRate;
        if (at < 0 || at >= duration) continue;
        const point = Math.min(
          values.length - 1,
          Math.floor((at / Math.max(duration, 0.001)) * values.length),
        );
        let peak = 0;
        for (const channel of channels) {
          peak = Math.max(peak, Math.abs(channel[sampleIndex] ?? 0));
        }
        values[point] = Math.max(values[point] ?? 0, peak);
      }
    } finally {
      sample.close();
    }
  }
  return { duration, values };
}

function fftInPlace(real: Float64Array, imag: Float64Array): void {
  const length = real.length;
  for (let index = 1, reversed = 0; index < length; index += 1) {
    let bit = length >> 1;
    for (; reversed & bit; bit >>= 1) reversed ^= bit;
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed] ?? 0, real[index] ?? 0];
      [imag[index], imag[reversed]] = [imag[reversed] ?? 0, imag[index] ?? 0];
    }
  }

  for (let size = 2; size <= length; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    const half = size >> 1;
    for (let offset = 0; offset < length; offset += size) {
      for (let index = 0; index < half; index += 1) {
        const cos = Math.cos(angle * index);
        const sin = Math.sin(angle * index);
        const even = offset + index;
        const odd = even + half;
        const oddReal = (real[odd] ?? 0) * cos - (imag[odd] ?? 0) * sin;
        const oddImag = (real[odd] ?? 0) * sin + (imag[odd] ?? 0) * cos;
        const evenReal = real[even] ?? 0;
        const evenImag = imag[even] ?? 0;
        real[even] = evenReal + oddReal;
        imag[even] = evenImag + oddImag;
        real[odd] = evenReal - oddReal;
        imag[odd] = evenImag - oddImag;
      }
    }
  }
}

async function openAudioClip(
  asset: SceneAsset,
  request: PreparedAssetRequest,
  sourceMode: "auto" | "stream" | "buffer",
  budget: MediaResourceBudget,
  signal?: AbortSignal,
  abortCleanups?: Set<() => void>,
): Promise<AudioClip> {
  const input = new Input({
    formats: ALL_FORMATS,
    source: await createMediaSource(asset, request, sourceMode, budget, signal),
  });
  const unlinkAbort = disposeInputOnAbort(input, signal);
  try {
    const track = await input.getPrimaryAudioTrack();
    assertNotAborted(signal);
    if (!track) {
      throw new Error("the file has no audio track");
    }

    const duration = await input.computeDuration([track]);
    assertNotAborted(signal);
    if (abortCleanups) abortCleanups.add(unlinkAbort);
    else unlinkAbort();
    return {
      duration,
      sampleRate: track.sampleRate,
      numberOfChannels: track.numberOfChannels,
      sink: new AudioSampleSink(track),
      input,
    };
  } catch (error) {
    unlinkAbort();
    disposeMediaInputSafely(input);
    throw error;
  }
}

async function openVideoClip(
  asset: SceneAsset,
  request: PreparedAssetRequest,
  sourceMode: "auto" | "stream" | "buffer",
  budget: MediaResourceBudget,
  signal?: AbortSignal,
  abortCleanups?: Set<() => void>,
): Promise<VideoClip> {
  const input = new Input({
    formats: ALL_FORMATS,
    source: await createMediaSource(asset, request, sourceMode, budget, signal),
  });
  const unlinkAbort = disposeInputOnAbort(input, signal);
  try {
    const track = await input.getPrimaryVideoTrack();
    assertNotAborted(signal);
    if (!track) {
      throw new Error("the file has no video track");
    }

    const duration = await input.computeDuration([track]);

    // Silent clips are normal; only wire audio when a track exists. The audio
    // sink shares the clip's input, so disposal releases both at once.
    const audioTrack = await input.getPrimaryAudioTrack();
    assertNotAborted(signal);
    const audio = audioTrack
      ? {
          duration: await input.computeDuration([audioTrack]),
          sampleRate: audioTrack.sampleRate,
          numberOfChannels: audioTrack.numberOfChannels,
          sink: new AudioSampleSink(audioTrack),
        }
      : undefined;
    assertNotAborted(signal);
    if (abortCleanups) abortCleanups.add(unlinkAbort);
    else unlinkAbort();
    return {
      duration,
      width: track.displayWidth,
      height: track.displayHeight,
      track,
      input,
      ...(audio ? { audio } : {}),
    };
  } catch (error) {
    unlinkAbort();
    disposeMediaInputSafely(input);
    throw error;
  }
}

async function createMediaSource(
  asset: SceneAsset,
  request: PreparedAssetRequest,
  sourceMode: "auto" | "stream" | "buffer",
  budget: MediaResourceBudget,
  signal?: AbortSignal,
): Promise<BlobSource | UrlSource> {
  assertNotAborted(signal);
  const src = request.source;
  const shouldBuffer =
    sourceMode === "buffer" ||
    (sourceMode === "auto" &&
      (src.startsWith("data:") || src.startsWith("blob:")));
  if (shouldBuffer) {
    return new BlobSource(await readPreparedAssetBlob(asset, request, signal));
  }
  return new UrlSource(src, {
    maxCacheSize: budget.maxSourceCacheBytes,
    requestInit: withoutSignal(request.init),
    fetchFn: createBoundedAssetFetch(asset, {
      policy: request.policy,
      source: request.source,
      requestInit: withoutSignal(request.init),
    }),
  });
}

function disposeInputOnAbort(input: Input, signal?: AbortSignal): () => void {
  if (!signal) return () => undefined;
  const dispose = () => disposeMediaInputSafely(input);
  signal.addEventListener("abort", dispose, { once: true });
  return () => signal.removeEventListener("abort", dispose);
}

/**
 * Maps a video node's local frame to a source timestamp in seconds:
 * videoStartTime + (localFrame / fps) * playbackRate, clamped to the clip so
 * scenes outlasting their footage hold the last frame.
 */
export function videoSourceTime(
  localFrame: number,
  fps: number,
  videoStartTime: number,
  playbackRate: number,
  clipDuration: number,
  endBehavior: "hold" | "loop" = "hold",
): number {
  const raw = videoStartTime + (localFrame / fps) * playbackRate;
  const lastFrameTime = Math.max(0, clipDuration - 0.001);
  if (endBehavior === "loop" && clipDuration > 0) {
    const looped = ((raw % clipDuration) + clipDuration) % clipDuration;
    return Math.min(looped, lastFrameTime);
  }
  return Math.min(Math.max(0, raw), lastFrameTime);
}

/**
 * Decodes the source frames every active video node needs at the given scene
 * frame and stages them in assets.videoFrames. Must be awaited before
 * renderStill() for scenes containing video nodes; a no-op otherwise.
 */
export type PrepareFrameOptions = { signal?: AbortSignal };

export async function prepareFrame(
  scene: Scene,
  frame: number,
  assets: ResolvedAssets,
  options: PrepareFrameOptions = {},
): Promise<ResolvedScene> {
  assertAssetsAlive(assets);
  const lifecycle = getResolvedAssetsLifecycle(assets);
  const combined = combineAbortSignals([
    options.signal,
    lifecycle.controller.signal,
  ]);
  const previous = framePreparationQueues.get(assets) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => gate);
  framePreparationQueues.set(assets, queued);
  void queued.then(() => {
    if (framePreparationQueues.get(assets) === queued) {
      framePreparationQueues.delete(assets);
    }
  });
  try {
    await awaitWithAbort(
      previous.catch(() => undefined),
      combined.signal,
    );
    assertAssetsAlive(assets);
    return await prepareFrameExclusive(scene, frame, assets, combined.signal);
  } finally {
    release();
    combined.dispose();
  }
}

async function prepareFrameExclusive(
  scene: Scene,
  frame: number,
  assets: ResolvedAssets,
  signal: AbortSignal,
): Promise<ResolvedScene> {
  assertNotAborted(signal);
  const parsed = parseScene(scene);
  assertResolvedAssetsCompatible(parsed, assets);
  const resolved = evaluateScene(parsed, frame);

  if (
    assets.videos.size === 0 &&
    assets.lotties.size === 0 &&
    (assets.extensionNodes?.size ?? 0) === 0
  ) {
    return resolved;
  }

  const failureController = new AbortController();
  const frameAbort = combineAbortSignals([signal, failureController.signal]);
  const frameSignal = frameAbort.signal;

  const tasks: Array<Promise<void>> = [];
  const nextVideoFrames = new Map<string, PreparedVideoFrame>();
  const nextLottieFrames = new Map<string, PreparedVideoFrame>();
  const nextExtensionFrames = new Map<string, PreparedExtensionFrame>();
  const cursors = (assets.videoCursors ??= new Map<
    string,
    VideoPlaybackCursor
  >());
  const activeCursorKeys = new Set<string>();

  const visit = (node: ResolvedNode): void => {
    assertNotAborted(frameSignal);
    if (node.type === "extension" && node.extension) {
      const runtime = assets.extensionNodes?.get(node.id);
      if (!runtime) {
        throw new Error(
          `Scene draws extension node "${node.id}" but it was not resolved. Call resolveAssets(scene, { extensions }) first.`,
        );
      }

      if (runtime.definition.prepareFrame) {
        tasks.push(
          Promise.resolve(
            runtime.definition.prepareFrame({
              scene: parsed,
              node: node as ResolvedNode & ExtensionSceneNode,
              params: runtime.params,
              resolvedAssets: runtime.resolvedAssets,
              frame: resolved.frame,
              localFrame: node.localFrame,
              signal: frameSignal,
            }),
          )
            .then((value) => {
              assertNotAborted(frameSignal);
              nextExtensionFrames.set(node.id, {
                sceneFrame: resolved.frame,
                value,
              });
            })
            .catch((cause: unknown) => {
              throw new Error(
                `Failed to prepare extension ${node.extension?.name}@${runtime.definition.version} for node "${node.id}" at frame ${resolved.frame}: ${cause instanceof Error ? cause.message : String(cause)}`,
                { cause },
              );
            }),
        );
      }
    }

    if (node.type === "video" && node.assetId) {
      const assetId = node.assetId;
      const clip = assets.videos.get(assetId);

      if (!clip) {
        throw new Error(
          `Video node "${node.id}" references asset "${assetId}" which is not in the resolved assets. Call resolveAssets(scene) first.`,
        );
      }

      const timestamp = videoSourceTime(
        node.localFrame,
        parsed.fps,
        node.videoStartTime ?? 0,
        node.playbackRate ?? 1,
        clip.duration,
        node.videoEndBehavior ?? "hold",
      );

      // Keyed by node AND asset: reused assets can outlive one scene
      // revision, and a node id may point at a different clip afterwards.
      const cursorKey = `${node.id} ${assetId}`;
      activeCursorKeys.add(cursorKey);
      let cursor = cursors.get(cursorKey);

      if (!cursor) {
        const maxVideoDecoders =
          assets.budget?.maxVideoDecoders ??
          defaultMediaResourceBudget.maxVideoDecoders;
        if (activeCursorKeys.size > maxVideoDecoders) {
          throw new Error(
            `Active video decoder budget exceeded (${activeCursorKeys.size} > ${maxVideoDecoders}). Reduce simultaneous video nodes, use proxies, or raise maxVideoDecoders.`,
          );
        }
        // One sink (and thus one decoder + canvas pool) per node, even when
        // nodes share an asset — cursors advance independently.
        cursor = new VideoPlaybackCursor(
          new CanvasSink(clip.track, { poolSize: CURSOR_CANVAS_POOL_SIZE }),
        );
        cursors.set(cursorKey, cursor);
      }
      const activeCursor = cursor;

      tasks.push(
        awaitWithAbort(
          activeCursor.frameAt(timestamp),
          frameSignal,
          async () => {
            cursors.delete(cursorKey);
            await activeCursor.dispose();
          },
        )
          .then((wrapped) => {
            assertNotAborted(frameSignal);
            if (!wrapped) {
              throw new Error(
                `Video asset "${assetId}" produced no frame at ${timestamp.toFixed(3)}s for node "${node.id}".`,
              );
            }

            nextVideoFrames.set(node.id, {
              image: wrapped.canvas,
              width: wrapped.canvas.width,
              height: wrapped.canvas.height,
              sceneFrame: resolved.frame,
            });
          })
          .catch(async (cause: unknown) => {
            cursors.delete(cursorKey);
            try {
              await activeCursor.dispose();
            } catch {
              // Preserve the decode/abort error; final disposal retries cleanup.
            }
            throw cause;
          }),
      );
    }

    if (node.type === "lottie" && node.assetId) {
      const assetId = node.assetId;
      const clip = assets.lotties.get(assetId);

      if (!clip) {
        throw new Error(
          `Lottie node "${node.id}" references asset "${assetId}" which is not in the resolved assets. Call resolveAssets(scene) first.`,
        );
      }

      // Seeking is synchronous; the staged copy isolates this node from
      // other nodes sharing the same animation instance at other times.
      assertNotAborted(frameSignal);
      clip.animation.goToAndStop(
        lottieSourceFrame(
          node.localFrame,
          parsed.fps,
          node.playbackRate ?? 1,
          clip,
        ),
        true,
      );

      // Reuse the node's staging canvas across frames; allocating one per
      // frame is pure GC churn since the staged copy is redrawn anyway.
      const previous = assets.lottieFrames.get(node.id)?.image;
      const staged =
        previous &&
        previous.width === clip.width &&
        previous.height === clip.height
          ? previous
          : createStagingCanvas(clip.width, clip.height);
      const stagedContext = staged.getContext("2d") as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;

      if (!stagedContext) {
        throw new Error("Canvas2D unavailable for lottie staging.");
      }

      stagedContext.clearRect(0, 0, clip.width, clip.height);
      stagedContext.drawImage(clip.canvas, 0, 0);
      nextLottieFrames.set(node.id, {
        image: staged,
        width: clip.width,
        height: clip.height,
        sceneFrame: resolved.frame,
      });
    }

    for (const child of node.children) {
      visit(child);
    }
  };

  let traversalError: unknown;
  try {
    for (const node of resolved.nodes) visit(node);
  } catch (error) {
    traversalError = error;
    failureController.abort(error);
  }

  // Decoders are a scarce resource (hardware decode sessions are capped):
  // release cursors for nodes not active at this frame. Reactivation costs
  // one keyframe seek, which the node was paying anyway.
  const disposeTasks: Array<Promise<void>> = [];
  if (traversalError === undefined) {
    cursors.forEach((cursor, key) => {
      if (!activeCursorKeys.has(key)) {
        disposeTasks.push(cursor.dispose());
        cursors.delete(key);
      }
    });
  }

  try {
    const results = await Promise.allSettled(
      [...tasks, ...disposeTasks].map(async (task) => {
        try {
          await task;
        } catch (error) {
          if (!failureController.signal.aborted) {
            failureController.abort(error);
          }
          throw error;
        }
      }),
    );
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    const failure =
      traversalError ??
      (failureController.signal.aborted
        ? failureController.signal.reason
        : rejected?.reason);
    if (failure !== undefined) throw failure;
    assertNotAborted(frameSignal);
    replaceMapContents(assets.videoFrames, nextVideoFrames);
    replaceMapContents(assets.lottieFrames, nextLottieFrames);
    replaceMapContents(
      (assets.extensionFrames ??= new Map()),
      nextExtensionFrames,
    );
    return resolved;
  } finally {
    frameAbort.dispose();
  }
}

function replaceMapContents<K, V>(target: Map<K, V>, source: Map<K, V>): void {
  target.clear();
  source.forEach((value, key) => target.set(key, value));
}

function createStagingCanvas(
  width: number,
  height: number,
): HTMLCanvasElement | OffscreenCanvas {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  return new OffscreenCanvas(width, height);
}

/**
 * Maps a lottie node's local frame to an animation frame offset (relative to
 * the document's in-point): (localFrame / fps) x playbackRate x lottie.fr,
 * clamped so scenes outlasting the animation hold its last frame —
 * lottie-web does NOT clamp out-of-range seeks itself (verified in the
 * spike). Fractional frames are fine; lottie interpolates deterministically.
 */
export function lottieSourceFrame(
  localFrame: number,
  fps: number,
  playbackRate: number,
  clip: Pick<LottieClip, "fr" | "ip" | "op">,
): number {
  const raw = (localFrame / fps) * playbackRate * clip.fr;
  const lastFrame = Math.max(0, clip.op - clip.ip - 0.001);
  return Math.min(Math.max(0, raw), lastFrame);
}

/**
 * Determinism and self-containment guards for a Lottie document. Returns
 * problem strings (empty = acceptable). Rejection beats nondeterministic
 * rendering:
 * - expressions are JavaScript and may call Date/random;
 * - image layers reference external bitmaps (v0 accepts vectors only).
 */
export function validateLottieDocument(document: unknown): string[] {
  const problems: string[] = [];

  if (typeof document !== "object" || document === null) {
    return ["not a JSON object"];
  }

  const doc = document as {
    layers?: unknown[];
    assets?: Array<{ p?: unknown; u?: unknown; layers?: unknown[] }>;
    fr?: unknown;
    op?: unknown;
  };

  if (typeof doc.fr !== "number" || typeof doc.op !== "number") {
    problems.push("missing fr/op — not a Lottie animation document");
    return problems;
  }

  for (const asset of doc.assets ?? []) {
    if (typeof asset?.p === "string" && asset.p.length > 0) {
      problems.push(
        `references external image "${asset.p}" — v0 supports self-contained vector documents only`,
      );
    }
  }

  const layerLists = [
    doc.layers ?? [],
    ...(doc.assets ?? []).map((asset) => asset?.layers ?? []),
  ];

  for (const layers of layerLists) {
    for (const layer of layers as Array<{ ty?: unknown }>) {
      if (layer?.ty === 2) {
        problems.push("contains an image layer (ty 2) — vectors only in v0");
      }
    }
  }

  if (containsExpression(document)) {
    problems.push(
      'contains expressions (string-valued "x") — expressions are JavaScript and may break determinism',
    );
  }

  return problems;
}

function containsExpression(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsExpression);
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      if (key === "x" && typeof child === "string") {
        return true;
      }

      if (containsExpression(child)) {
        return true;
      }
    }
  }

  return false;
}

async function openLottieClip(
  asset: SceneAsset,
  request: PreparedAssetRequest,
  signal?: AbortSignal,
  timeoutMs = 15_000,
): Promise<LottieClip> {
  const bytes = await readPreparedAssetBytes(asset, request, signal);
  let data: {
    fr: number;
    ip?: number;
    op: number;
    w?: number;
    h?: number;
  };
  try {
    data = JSON.parse(new TextDecoder().decode(bytes)) as typeof data;
  } catch (cause) {
    throw new Error("Lottie asset is not valid UTF-8 JSON.", { cause });
  }

  const problems = validateLottieDocument(data);

  if (problems.length > 0) {
    throw new Error(problems.join("; "));
  }

  let imported: unknown;

  try {
    imported = await import("lottie-web");
  } catch {
    throw new Error(
      "the scene uses a lottie asset but lottie-web is not installed. Add the optional peer dependency: npm install lottie-web",
    );
  }

  const lottie = ((imported as { default?: unknown }).default ?? imported) as {
    loadAnimation(options: unknown): unknown;
  };
  const width = data.w ?? 512;
  const height = data.h ?? 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas2D unavailable for the lottie player.");
  }

  let animation: LottieReadyAnimation | undefined;
  try {
    animation = lottie.loadAnimation({
      renderer: "canvas",
      loop: false,
      autoplay: false,
      animationData: data,
      rendererSettings: { context, clearCanvas: true },
    } as never) as typeof animation;
    if (!animation) throw new Error("lottie-web returned no animation.");

    await waitForLottieReady(animation, signal, timeoutMs);
    assertNotAborted(signal);
    return {
      fr: data.fr,
      ip: data.ip ?? 0,
      op: data.op,
      width,
      height,
      animation,
      canvas,
    };
  } catch (error) {
    animation?.destroy();
    throw error;
  }
}

/**
 * Loads a font asset and registers it with the environment's FontFaceSet
 * under the asset id, so styles reference it as fontFamily: "<asset id>".
 * Registration is idempotent per (id, src) pair.
 */
async function loadFont(
  id: string,
  asset: SceneAsset,
  request: PreparedAssetRequest,
  configuredCache: FontAssetCache<FontFace> | undefined,
  signal?: AbortSignal,
): Promise<{ readonly face: FontFace; release(): void }> {
  // Windows expose the set as document.fonts, workers as self.fonts.
  const fontSet =
    typeof document !== "undefined"
      ? document.fonts
      : (globalThis as { fonts?: FontFaceSet }).fonts;

  if (!fontSet) {
    throw new Error(
      "this environment has no FontFaceSet (document.fonts or self.fonts); font assets need a browser or worker context",
    );
  }

  const cache = configuredCache ?? getSharedFontCache(fontSet);
  const lease = await cache.acquire(
    `${id}\u0000${request.contentKey}`,
    async () => {
      const bytes = await readPreparedAssetBytes(asset, request, signal);
      const face = new FontFace(id, ownedArrayBuffer(bytes));
      await face.load();
      assertNotAborted(signal);
      return face;
    },
    asset.metadata?.byteLength,
  );
  fontSet.add(lease.face);
  return lease;
}

function truncateSrc(src: string): string {
  if (src.startsWith("data:")) return "data:[redacted]";
  let redacted = src;
  try {
    const parsed = new URL(src, "https://motionforge.invalid");
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    redacted = src.startsWith("/")
      ? `${parsed.pathname}`
      : parsed.origin === "https://motionforge.invalid"
        ? parsed.pathname
        : parsed.toString();
  } catch {
    redacted = src.split(/[?#]/, 1)[0] ?? "[invalid source]";
  }
  return redacted.length > 96 ? `${redacted.slice(0, 96)}…` : redacted;
}

/**
 * createImageBitmap(blob) cannot decode SVG in Chromium; fall back to an
 * HTMLImageElement (already rasterized at its intrinsic size) when available.
 */
async function decodeImageBlob(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob);
  } catch (error) {
    if (typeof document === "undefined") {
      throw error;
    }

    const url = URL.createObjectURL(blob);

    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return await createImageBitmap(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export function renderStill(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  scene: Scene,
  frame: number,
  options: RenderOptions = {},
): void {
  if (options.assets) assertResolvedAssetsCompatible(scene, options.assets);
  const resolved = options.resolvedScene ?? evaluateScene(scene, frame);
  const layout = layoutScene(resolved, {
    measureTextLine: createContextTextMeasurer(
      context,
      options.textMeasureCache,
    ),
  });

  if (options.clear ?? true) {
    context.clearRect(0, 0, scene.width, scene.height);
  }

  for (const box of sortByZIndex(layout.boxes)) {
    drawBox(
      context,
      box,
      scene,
      options.assets,
      layout.frame,
      scene.fps,
      options.textMeasureCache,
    );
  }
}

/**
 * Layout-side text measurement backed by the render context, so intrinsic
 * text boxes wrap exactly like drawText paints. Mutates the context's font
 * state; every draw routine sets its own font before drawing, and
 * letterSpacing is reset after each measurement because nothing else does.
 */
function createContextTextMeasurer(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  textMeasureCache?: TextMeasureCache,
): MeasureTextLine {
  return (line, style, fontSize) =>
    measureTextLine(context, line, style, fontSize, textMeasureCache);
}

function canvasFont(style: SceneStyle, fontSize: number): string {
  const fontFamily = style.fontFamily ?? "system-ui, sans-serif";
  const fontWeight = style.fontWeight ?? 400;
  const fontStyle = style.fontStyle ?? "normal";
  return `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
}

function measureTextLine(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  line: string,
  style: SceneStyle,
  fontSize: number,
  textMeasureCache?: TextMeasureCache,
): number {
  const font = canvasFont(style, fontSize);
  const letterSpacing = readLength(style.letterSpacing, fontSize, 0);
  const cacheKey = textMeasureCache
    ? `${font}\u0000${letterSpacing}\u0000${line}`
    : null;
  const cached = cacheKey ? textMeasureCache?.get(cacheKey) : undefined;

  if (cached !== undefined) {
    return cached;
  }

  context.font = font;
  context.direction = style.direction ?? "inherit";
  const spaced = letterSpacing !== 0 && "letterSpacing" in context;
  const previousLetterSpacing = spaced ? context.letterSpacing : undefined;

  if (spaced) {
    context.letterSpacing = `${letterSpacing}px`;
  }

  const width = context.measureText(line).width;

  if (spaced) {
    context.letterSpacing = previousLetterSpacing ?? "0px";
  }

  if (cacheKey) {
    textMeasureCache?.set(cacheKey, width);
  }

  return width;
}

/**
 * Paint order among siblings: ascending zIndex (default 0), stable for equal
 * values so document order keeps deciding ties. zIndex never affects layout.
 */
function sortByZIndex(boxes: LayoutBox[]): LayoutBox[] {
  return boxes
    .map((box, index) => ({ box, index }))
    .sort((a, b) => {
      const za = a.box.node.style.zIndex ?? 0;
      const zb = b.box.node.style.zIndex ?? 0;
      return za === zb ? a.index - b.index : za - zb;
    })
    .map((entry) => entry.box);
}

function drawBox(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  scene: Scene,
  assets: ResolvedAssets | undefined,
  sceneFrame: number,
  sceneFps: number,
  textMeasureCache: TextMeasureCache | undefined,
): void {
  const softMask =
    box.node.mask !== undefined &&
    ((box.node.mask.feather ?? 0) > 0 || (box.node.mask.opacity ?? 1) < 1);
  if (box.node.style.isolation || softMask) {
    drawIsolatedBox(
      context,
      box,
      scene,
      assets,
      sceneFrame,
      sceneFps,
      textMeasureCache,
      softMask,
    );
    return;
  }
  drawBoxDirect(
    context,
    box,
    scene,
    assets,
    sceneFrame,
    sceneFps,
    textMeasureCache,
  );
}

function drawBoxDirect(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  scene: Scene,
  assets: ResolvedAssets | undefined,
  sceneFrame: number,
  sceneFps: number,
  textMeasureCache: TextMeasureCache | undefined,
  options: {
    suppressRootComposite?: boolean;
    suppressRootMask?: boolean;
  } = {},
): void {
  const { node } = box;
  const style = node.style;

  context.save();
  if (!options.suppressRootComposite) {
    context.globalAlpha *= style.opacity ?? 1;
  }
  applyTransform(context, box, style);

  if (style.blendMode && !options.suppressRootComposite) {
    context.globalCompositeOperation = style.blendMode;
  }

  if (style.filter && style.filter !== "none") {
    // Canvas2D applies the filter per draw call, not to the composited
    // subtree, and a child's own filter replaces (not stacks with) this one.
    // Identical to CSS for leaf media/text nodes — the dominant use. Safari
    // has no context.filter; the assignment is a silent no-op there.
    context.filter = style.filter;
  }

  applyVectorConstraints(
    context,
    box,
    node.clip,
    options.suppressRootMask ? undefined : node.mask,
  );

  drawBackground(context, box, style);

  if (style.overflow === "hidden") {
    // Clip own content and the subtree to the border box, following
    // borderRadius — CSS overflow:hidden semantics. The clip lives inside
    // this box's save/restore, so siblings are unaffected.
    const radius = resolveCornerRadii(style, box);

    if (hasCornerRadius(radius)) {
      roundedRect(context, box.x, box.y, box.width, box.height, radius);
    } else {
      context.beginPath();
      context.rect(box.x, box.y, box.width, box.height);
    }

    context.clip();
  }

  if (node.type === "text" && (node.text !== undefined || node.runs)) {
    drawText(
      context,
      box,
      node.text ?? node.runs?.map((run) => run.text).join("") ?? "",
      style,
      textMeasureCache,
      node.runs,
    );
  }

  if (node.type === "img" && node.assetId) {
    drawImage(context, box, node.assetId, style, assets);
  }

  if (node.type === "video" && node.assetId) {
    drawVideo(context, box, node, style, assets, sceneFrame);
  }

  if (node.type === "lottie" && node.assetId) {
    drawLottie(context, box, node, style, assets, sceneFrame);
  }

  if (node.type === "effect" && node.effect) {
    drawEffect(context, box, node, assets, sceneFps);
  }

  if (node.type === "extension" && node.extension) {
    drawExtension(context, box, scene, node, assets, sceneFrame, sceneFps);
  }

  if (node.type === "shape" && node.shape) {
    drawShape(context, box, node.shape, style);
  }

  drawBorder(context, box, style);

  for (const child of sortByZIndex(box.children)) {
    drawBox(
      context,
      child,
      scene,
      assets,
      sceneFrame,
      sceneFps,
      textMeasureCache,
    );
  }

  context.restore();
}

function drawIsolatedBox(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  scene: Scene,
  assets: ResolvedAssets | undefined,
  sceneFrame: number,
  sceneFps: number,
  textMeasureCache: TextMeasureCache | undefined,
  softMask: boolean,
): void {
  const canvas = createStagingCanvas(scene.width, scene.height);
  const isolatedContext = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!isolatedContext) {
    throw new Error("Canvas2D unavailable for isolated group compositing.");
  }
  isolatedContext.clearRect(0, 0, scene.width, scene.height);
  drawBoxDirect(
    isolatedContext,
    box,
    scene,
    assets,
    sceneFrame,
    sceneFps,
    textMeasureCache,
    { suppressRootComposite: true, suppressRootMask: softMask },
  );

  if (softMask && box.node.mask) {
    applySoftMask(isolatedContext, box, box.node.mask, scene);
  }

  context.save();
  context.globalAlpha *= box.node.style.opacity ?? 1;
  if (box.node.style.blendMode) {
    context.globalCompositeOperation = box.node.style.blendMode;
  }
  context.drawImage(canvas, 0, 0);
  context.restore();
}

function drawExtension(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  scene: Scene,
  node: LayoutBox["node"],
  assets: ResolvedAssets | undefined,
  sceneFrame: number,
  sceneFps: number,
): void {
  const runtime = assets?.extensionNodes?.get(node.id);
  if (!runtime) {
    throw new Error(
      `Scene draws extension node "${node.id}" but it is not in the resolved assets. Call resolveAssets(scene, { extensions }) and pass the result to renderStill.`,
    );
  }

  const prepared = assets?.extensionFrames?.get(node.id);
  if (runtime.definition.prepareFrame && !prepared) {
    throw new Error(
      `Extension node "${node.id}" has no prepared frame. Await prepareFrame(scene, frame, assets) before renderStill.`,
    );
  }
  if (prepared && prepared.sceneFrame !== sceneFrame) {
    throw new Error(
      `Extension node "${node.id}" has data prepared for scene frame ${prepared.sceneFrame}, but frame ${sceneFrame} is being rendered. Await prepareFrame(scene, ${sceneFrame}, assets) first.`,
    );
  }

  runtime.adapter.draw({
    context,
    scene,
    node: node as ResolvedNode & ExtensionSceneNode,
    box,
    params: runtime.params,
    resolvedAssets: runtime.resolvedAssets,
    preparedFrame: prepared?.value,
    sceneFrame,
    localFrame: node.localFrame,
    sceneFps,
  });
}

type ShapePath = {
  path: Path2D;
  fillRule: CanvasFillRule;
  open: boolean;
};

type CornerRadii = LayoutCornerRadii;

export function shapePointInBox(
  point: { x: number; y: number },
  box: Pick<LayoutBox, "x" | "y" | "width" | "height">,
): { x: number; y: number } {
  return {
    x: box.x + point.x * box.width,
    y: box.y + point.y * box.height,
  };
}

function createShapePath(
  box: Pick<LayoutBox, "x" | "y" | "width" | "height">,
  geometry: SceneShapeGeometry,
  radius: number | CornerRadii = 0,
): ShapePath {
  if (typeof Path2D === "undefined") {
    throw new Error(
      "Shape rendering needs Path2D. Call preflightCanvas2D() before rendering in this environment.",
    );
  }

  const path = new Path2D();

  if (geometry.kind === "rect") {
    addRoundedRectPath(
      path,
      box,
      geometry.radius === undefined
        ? radius
        : readLength(geometry.radius, Math.min(box.width, box.height), 0),
    );
    return { path, fillRule: "nonzero", open: false };
  }

  if (geometry.kind === "ellipse") {
    path.ellipse(
      box.x + box.width / 2,
      box.y + box.height / 2,
      Math.abs(box.width / 2),
      Math.abs(box.height / 2),
      0,
      0,
      Math.PI * 2,
    );
    return { path, fillRule: "nonzero", open: false };
  }

  if (
    geometry.kind === "line" ||
    geometry.kind === "polyline" ||
    geometry.kind === "polygon"
  ) {
    const first = geometry.points[0];
    if (first) {
      const start = shapePointInBox(first, box);
      path.moveTo(start.x, start.y);
      for (const point of geometry.points.slice(1)) {
        const next = shapePointInBox(point, box);
        path.lineTo(next.x, next.y);
      }
      if (geometry.kind === "polygon") path.closePath();
    }
    return {
      path,
      fillRule: "nonzero",
      open: geometry.kind !== "polygon",
    };
  }

  if (typeof DOMMatrix === "undefined") {
    throw new Error(
      "SVG path rendering needs DOMMatrix. Call preflightCanvas2D() before rendering in this environment.",
    );
  }
  const source = new Path2D(geometry.d);
  const scaleX = box.width / geometry.viewBox.width;
  const scaleY = box.height / geometry.viewBox.height;
  path.addPath(
    source,
    new DOMMatrix([
      scaleX,
      0,
      0,
      scaleY,
      box.x - geometry.viewBox.x * scaleX,
      box.y - geometry.viewBox.y * scaleY,
    ]),
  );
  return {
    path,
    fillRule: geometry.fillRule ?? "nonzero",
    open: false,
  };
}

function addRoundedRectPath(
  path: Path2D,
  box: Pick<LayoutBox, "x" | "y" | "width" | "height">,
  radius: number | CornerRadii,
): void {
  const radii = normalizeCornerRadii(radius, box.width, box.height);
  if (!hasCornerRadius(radii)) {
    path.rect(box.x, box.y, box.width, box.height);
    return;
  }

  path.moveTo(box.x + radii.topLeft, box.y);
  path.lineTo(box.x + box.width - radii.topRight, box.y);
  path.quadraticCurveTo(
    box.x + box.width,
    box.y,
    box.x + box.width,
    box.y + radii.topRight,
  );
  path.lineTo(box.x + box.width, box.y + box.height - radii.bottomRight);
  path.quadraticCurveTo(
    box.x + box.width,
    box.y + box.height,
    box.x + box.width - radii.bottomRight,
    box.y + box.height,
  );
  path.lineTo(box.x + radii.bottomLeft, box.y + box.height);
  path.quadraticCurveTo(
    box.x,
    box.y + box.height,
    box.x,
    box.y + box.height - radii.bottomLeft,
  );
  path.lineTo(box.x, box.y + radii.topLeft);
  path.quadraticCurveTo(box.x, box.y, box.x + radii.topLeft, box.y);
  path.closePath();
}

function applyVectorConstraints(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  clip: LayoutBox["node"]["clip"],
  mask: LayoutBox["node"]["mask"],
): void {
  if (clip) {
    const clipPath = createShapePath(box, clip);
    if (clipPath.open) {
      throw new Error(`Node "${box.id}" uses open geometry as a clip.`);
    }
    context.clip(clipPath.path, clipPath.fillRule);
  }

  if (mask) {
    const maskPath = createShapePath(box, mask.shape);
    if (maskPath.open) {
      throw new Error(`Node "${box.id}" uses open geometry as a mask.`);
    }
    if (mask.inverted) {
      const inverse = new Path2D();
      inverse.rect(box.x, box.y, box.width, box.height);
      inverse.addPath(maskPath.path);
      context.clip(inverse, "evenodd");
    } else {
      context.clip(maskPath.path, maskPath.fillRule);
    }
  }
}

function applySoftMask(
  isolatedContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  mask: NonNullable<LayoutBox["node"]["mask"]>,
  scene: Scene,
): void {
  const maskCanvas = createStagingCanvas(scene.width, scene.height);
  const maskContext = maskCanvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!maskContext) {
    throw new Error("Canvas2D unavailable for soft-mask staging.");
  }
  const maskPath = createShapePath(box, mask.shape);
  if (maskPath.open) {
    throw new Error(`Node "${box.id}" uses open geometry as a mask.`);
  }
  const opacity = mask.opacity ?? 1;
  const feather = mask.feather ?? 0;

  if (mask.inverted) {
    maskContext.fillStyle = "#ffffff";
    maskContext.fillRect(0, 0, scene.width, scene.height);
    maskContext.globalCompositeOperation = "destination-out";
  }
  maskContext.save();
  applyTransform(maskContext, box, box.node.style);
  maskContext.globalAlpha = opacity;
  if (feather > 0) {
    maskContext.filter = `blur(${feather}px)`;
  }
  maskContext.fillStyle = "#ffffff";
  maskContext.fill(maskPath.path, maskPath.fillRule);
  maskContext.restore();

  isolatedContext.save();
  isolatedContext.globalCompositeOperation = "destination-in";
  isolatedContext.drawImage(maskCanvas, 0, 0);
  isolatedContext.restore();
}

function drawShape(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  geometry: SceneShapeGeometry,
  style: SceneStyle,
): void {
  const shapePath = createShapePath(
    box,
    geometry,
    resolveCornerRadii(style, box),
  );
  const fill = style.fill ?? (shapePath.open ? undefined : "#000000");
  const stroke = style.stroke ?? (shapePath.open ? "#000000" : undefined);

  if (fill) {
    context.fillStyle = parseFill(context, box, fill);
    context.fill(shapePath.path, shapePath.fillRule);
  }

  if (stroke && (style.strokeWidth ?? 1) > 0) {
    context.strokeStyle = parseFill(context, box, stroke);
    context.lineWidth = style.strokeWidth ?? 1;
    context.lineCap = style.strokeLineCap ?? "butt";
    context.lineJoin = style.strokeLineJoin ?? "miter";
    context.setLineDash(style.strokeDash ?? []);
    context.stroke(shapePath.path);
  }
}

/**
 * Geometry for drawing media into a box under objectFit/objectPosition.
 * Exported for tests; coordinates are relative to the box origin.
 */
export function computeObjectFit(
  fit: SceneStyle["objectFit"],
  position: string | undefined,
  box: { width: number; height: number },
  natural: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  return resolveObjectFitRect(fit, position, box, natural);
}

function drawImage(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  assetId: string,
  style: SceneStyle,
  assets: ResolvedAssets | undefined,
): void {
  const image = assets?.images.get(assetId);

  if (!image) {
    throw new Error(
      `Scene draws image asset "${assetId}" but it is not in the resolved assets. Call resolveAssets(scene) and pass the result to renderStill via options.assets.`,
    );
  }

  drawMedia(context, box, style, image, image);
}

function drawVideo(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  node: LayoutBox["node"],
  style: SceneStyle,
  assets: ResolvedAssets | undefined,
  sceneFrame: number,
): void {
  const prepared = assets?.videoFrames.get(node.id);

  if (!prepared) {
    throw new Error(
      `Scene draws video node "${node.id}" but no frame was staged for it. Await prepareFrame(scene, frame, assets) before renderStill.`,
    );
  }

  if (prepared.sceneFrame !== sceneFrame) {
    throw new Error(
      `Video node "${node.id}" has a frame staged for scene frame ${prepared.sceneFrame}, but frame ${sceneFrame} is being rendered. Await prepareFrame(scene, ${sceneFrame}, assets) first.`,
    );
  }

  drawMedia(context, box, style, prepared.image, prepared);
}

function drawLottie(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  node: LayoutBox["node"],
  style: SceneStyle,
  assets: ResolvedAssets | undefined,
  sceneFrame: number,
): void {
  const prepared = assets?.lottieFrames.get(node.id);

  if (!prepared) {
    throw new Error(
      `Scene draws lottie node "${node.id}" but no frame was staged for it. Await prepareFrame(scene, frame, assets) before renderStill.`,
    );
  }

  if (prepared.sceneFrame !== sceneFrame) {
    throw new Error(
      `Lottie node "${node.id}" has a frame staged for scene frame ${prepared.sceneFrame}, but frame ${sceneFrame} is being rendered. Await prepareFrame(scene, ${sceneFrame}, assets) first.`,
    );
  }

  drawMedia(context, box, style, prepared.image, prepared);
}

function drawEffect(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  node: LayoutBox["node"],
  assets: ResolvedAssets | undefined,
  sceneFps: number,
): void {
  const params = node.params ?? {};
  const duration = node.duration ?? 30;

  switch (node.effect) {
    case "cartoonBurst":
      drawCartoonBurst(context, box, node.localFrame, duration, params);
      break;
    case "confettiBurst":
      drawConfettiBurst(context, box, node.localFrame, duration, params);
      break;
    case "cloudPop":
      drawCloudPop(context, box, node.localFrame, duration, params);
      break;
    case "speedLines":
      drawSpeedLines(context, box, node.localFrame, duration, params);
      break;
    case "neonAura":
      drawNeonAura(context, box, node.localFrame, duration, params);
      break;
    case "scribbleCircle":
      drawScribbleCircle(context, box, node.localFrame, duration, params);
      break;
    case "spectrumBars":
      drawSpectrumBars(context, box, node.localFrame, sceneFps, params, assets);
      break;
    case "cassetteVuMeter":
      drawCassetteVuMeter(
        context,
        box,
        node.localFrame,
        sceneFps,
        params,
        assets,
      );
      break;
    case "waveformLine":
      drawWaveformLine(context, box, node.localFrame, sceneFps, params, assets);
      break;
    case "mirrorBars":
      drawMirrorBars(context, box, node.localFrame, sceneFps, params, assets);
      break;
    case "circularSpectrum":
      drawCircularSpectrum(
        context,
        box,
        node.localFrame,
        sceneFps,
        params,
        assets,
      );
      break;
    case "neonWaveform":
      drawNeonWaveform(context, box, node.localFrame, sceneFps, params, assets);
      break;
    case "pulseRings":
      drawPulseRings(context, box, node.localFrame, sceneFps, params, assets);
      break;
    case "particleGalaxy":
      drawParticleGalaxy(
        context,
        box,
        node.localFrame,
        sceneFps,
        params,
        assets,
      );
      break;
    case "albumCoverPulse":
      drawAlbumCoverPulse(
        context,
        box,
        node.localFrame,
        sceneFps,
        params,
        assets,
      );
      break;
    case "audioBlob":
      drawAudioBlob(context, box, node.localFrame, sceneFps, params, assets);
      break;
    case "starfieldTunnel":
      drawStarfieldTunnel(
        context,
        box,
        node.localFrame,
        sceneFps,
        params,
        assets,
      );
      break;
    case "equalizerGrid":
      drawEqualizerGrid(
        context,
        box,
        node.localFrame,
        sceneFps,
        params,
        assets,
      );
      break;
    case "liquidGradient":
      drawLiquidGradient(
        context,
        box,
        node.localFrame,
        sceneFps,
        params,
        assets,
      );
      break;
    case "kaleidoscope":
      drawKaleidoscope(context, box, node.localFrame, sceneFps, params, assets);
      break;
    case "vinylRecord":
      drawVinylRecord(context, box, node.localFrame, sceneFps, params, assets);
      break;
    case "audioTerrain":
      drawAudioTerrain(context, box, node.localFrame, sceneFps, params, assets);
      break;
    case "lightningArc":
      drawLightningArc(context, box, node.localFrame, sceneFps, params, assets);
      break;
    case "minimalLineArt":
      drawMinimalLineArt(
        context,
        box,
        node.localFrame,
        sceneFps,
        params,
        assets,
      );
      break;
  }
}

type EffectParams = NonNullable<LayoutBox["node"]["params"]>;

function spectrumValues(
  assets: ResolvedAssets | undefined,
  params: EffectParams,
  localFrame: number,
  sceneFps: number,
): number[] {
  const spectrum = params.audioAssetId
    ? assets?.audioSpectra?.get(params.audioAssetId)
    : undefined;

  if (!spectrum) {
    throw new Error(
      `Audio-reactive effect references spectrum asset "${params.audioAssetId ?? ""}", but no analysis was resolved. Call resolveAssets(scene) and pass the result to preview/export.`,
    );
  }

  const requestedCount = Math.max(
    8,
    Math.min(128, Math.round(params.barCount ?? 64)),
  );
  const frame = Math.min(
    spectrum.frameCount - 1,
    Math.max(0, Math.floor((localFrame / sceneFps) * spectrum.fps)),
  );
  const sensitivity = params.sensitivity ?? 1;
  const values = Array.from({ length: requestedCount }, (_, index) => {
    const sourceStart = Math.floor(
      (index / requestedCount) * spectrum.barCount,
    );
    const sourceEnd = Math.max(
      sourceStart + 1,
      Math.floor(((index + 1) / requestedCount) * spectrum.barCount),
    );
    let total = 0;
    for (let source = sourceStart; source < sourceEnd; source += 1) {
      total += spectrum.values[frame * spectrum.barCount + source] ?? 0;
    }
    return clamp01(
      (total / Math.max(1, sourceEnd - sourceStart) / 255) * sensitivity,
    );
  });

  if (params.smoothing) {
    return values.map(
      (value, index) =>
        ((values[index - 1] ?? value) +
          value * 2 +
          (values[index + 1] ?? value)) /
        4,
    );
  }

  return values;
}

function drawSpectrumBars(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(assets, params, localFrame, sceneFps);
  const colors = effectColors(params, ["#00e676", "#7c3aed", "#f8fbff"]);
  const gap = Math.max(1, box.width * (values.length >= 96 ? 0.0015 : 0.0035));
  const barWidth = Math.max(
    1,
    (box.width - gap * (values.length - 1)) / values.length,
  );
  const baseline = box.y + box.height;

  context.save();
  context.globalCompositeOperation = "lighter";
  values.forEach((value, index) => {
    const response = clamp01(Math.pow(value * 0.88 + 0.04, 0.62));
    const height = Math.max(2, box.height * response);
    const x = box.x + index * (barWidth + gap);
    const gradient = context.createLinearGradient(
      x,
      baseline,
      x,
      baseline - height,
    );
    gradient.addColorStop(0, colors[1] ?? "#7c3aed");
    gradient.addColorStop(0.55, colors[0] ?? "#00e676");
    gradient.addColorStop(1, colors[2] ?? "#f8fbff");
    context.fillStyle = gradient;
    context.shadowColor = colors[0] ?? "#00e676";
    context.shadowBlur = Math.max(4, barWidth * 1.8);
    roundedRect(
      context,
      x,
      baseline - height,
      barWidth,
      height,
      Math.min(barWidth / 2, 8),
    );
    context.fill();
  });
  context.restore();
}

function drawMirrorBars(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(assets, params, localFrame, sceneFps);
  const colors = effectColors(params, ["#22d3ee", "#f472b6", "#f8fbff"]);
  const gap = Math.max(1, box.width * (values.length >= 96 ? 0.0015 : 0.0035));
  const barWidth = Math.max(
    1,
    (box.width - gap * (values.length - 1)) / values.length,
  );
  const centerY = box.y + box.height / 2;
  const centerGap = Math.min(
    box.height * 0.12,
    Math.max(2, box.height * 0.035),
  );
  const maxHalf = Math.max(1, (box.height - centerGap) / 2);

  context.save();
  context.globalCompositeOperation = "lighter";
  values.forEach((value, index) => {
    const response = clamp01(Math.pow(value * 0.88 + 0.04, 0.62));
    const half = Math.max(1, maxHalf * response);
    const x = box.x + index * (barWidth + gap);
    const topY = centerY - centerGap / 2 - half;
    const bottomY = centerY + centerGap / 2;
    const gradient = context.createLinearGradient(x, topY, x, bottomY + half);
    gradient.addColorStop(0, colors[2] ?? "#f8fbff");
    gradient.addColorStop(0.5, colors[0] ?? "#22d3ee");
    gradient.addColorStop(1, colors[1] ?? "#f472b6");
    context.fillStyle = gradient;
    context.shadowColor = colors[0] ?? "#22d3ee";
    context.shadowBlur = Math.max(4, barWidth * 1.6);
    roundedRect(context, x, topY, barWidth, half, Math.min(barWidth / 2, 8));
    context.fill();
    roundedRect(context, x, bottomY, barWidth, half, Math.min(barWidth / 2, 8));
    context.fill();
  });
  context.restore();
}

function drawWaveformLine(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(assets, params, localFrame, sceneFps);
  if (values.length < 2) return;
  const colors = effectColors(params, ["#22d3ee", "#7c3aed", "#f8fbff"]);
  const centerY = box.y + box.height / 2;
  const maxHalf = (box.height / 2) * 0.92;
  const count = values.length;
  const xAt = (index: number) => box.x + (index / (count - 1)) * box.width;
  const ampAt = (index: number) =>
    Math.max(
      1,
      maxHalf * clamp01(Math.pow((values[index] ?? 0) * 0.9 + 0.03, 0.6)),
    );

  context.save();
  context.globalCompositeOperation = "lighter";

  // Filled ribbon between the upper wave and its mirror below the center line.
  context.beginPath();
  context.moveTo(xAt(0), centerY - ampAt(0));
  for (let i = 1; i < count; i += 1) context.lineTo(xAt(i), centerY - ampAt(i));
  for (let i = count - 1; i >= 0; i -= 1)
    context.lineTo(xAt(i), centerY + ampAt(i));
  context.closePath();
  const fill = context.createLinearGradient(
    box.x,
    centerY - maxHalf,
    box.x,
    centerY + maxHalf,
  );
  fill.addColorStop(0, colors[0] ?? "#22d3ee");
  fill.addColorStop(1, colors[1] ?? "#7c3aed");
  context.globalAlpha = 0.5;
  context.fillStyle = fill;
  context.fill();
  context.globalAlpha = 1;

  // Bright mirrored strokes for the oscilloscope edge.
  context.lineJoin = "round";
  context.lineCap = "round";
  context.lineWidth = Math.max(2, box.height * 0.012);
  context.strokeStyle = colors[2] ?? "#f8fbff";
  context.shadowColor = colors[0] ?? "#22d3ee";
  context.shadowBlur = Math.max(6, box.height * 0.03);
  for (const sign of [-1, 1]) {
    context.beginPath();
    context.moveTo(xAt(0), centerY + sign * ampAt(0));
    for (let i = 1; i < count; i += 1) {
      context.lineTo(xAt(i), centerY + sign * ampAt(i));
    }
    context.stroke();
  }
  context.restore();
}

function spectrumBands(values: number[]): {
  energy: number;
  bass: number;
  mid: number;
  high: number;
} {
  const averageRange = (start: number, end: number) => {
    const slice = values.slice(start, Math.max(start + 1, end));
    return (
      slice.reduce((sum, value) => sum + value, 0) / Math.max(1, slice.length)
    );
  };

  return {
    energy: averageRange(0, values.length),
    bass: averageRange(0, Math.ceil(values.length * 0.2)),
    mid: averageRange(
      Math.floor(values.length * 0.28),
      Math.ceil(values.length * 0.65),
    ),
    high: averageRange(Math.floor(values.length * 0.72), values.length),
  };
}

function drawCircularSpectrum(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 64 },
    localFrame,
    sceneFps,
  );
  const bands = spectrumBands(values);
  const colors = effectColors(params, ["#14f195", "#7c3aed", "#f8fbff"]);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const base = Math.min(box.width, box.height);
  const inner = base * (0.23 + bands.bass * 0.025);
  const maxLength = base * 0.19;
  const rotation = (localFrame / sceneFps) * 0.18;

  context.save();
  context.globalCompositeOperation = "lighter";
  values.forEach((value, index) => {
    const angle =
      (index / values.length) * Math.PI * 2 - Math.PI / 2 + rotation;
    const response = clamp01(Math.pow(value * 0.9 + 0.05, 0.58));
    const outer = inner + base * 0.025 + response * maxLength;
    const x1 = cx + Math.cos(angle) * inner;
    const y1 = cy + Math.sin(angle) * inner;
    const x2 = cx + Math.cos(angle) * outer;
    const y2 = cy + Math.sin(angle) * outer;
    context.strokeStyle = colors[index % 5 === 0 ? 1 : 0] ?? "#14f195";
    context.lineWidth = Math.max(2, base * (0.003 + response * 0.006));
    context.lineCap = "round";
    context.shadowColor = context.strokeStyle as string;
    context.shadowBlur = Math.max(5, base * 0.018);
    context.globalAlpha = 0.5 + response * 0.5;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  });

  const orb = context.createRadialGradient(
    cx,
    cy,
    base * 0.025,
    cx,
    cy,
    inner * 0.94,
  );
  orb.addColorStop(0, colors[2] ?? "#f8fbff");
  orb.addColorStop(0.28, colors[0] ?? "#14f195");
  orb.addColorStop(1, colors[1] ?? "#7c3aed");
  context.globalAlpha = 0.28 + bands.energy * 0.38;
  context.fillStyle = orb;
  context.beginPath();
  context.arc(cx, cy, inner * (0.83 + bands.bass * 0.12), 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = 0.4;
  context.strokeStyle = colors[2] ?? "#f8fbff";
  context.lineWidth = Math.max(1, base * 0.003);
  for (let ring = 0; ring < 3; ring += 1) {
    context.setLineDash([
      base * (0.012 + ring * 0.006),
      base * (0.014 + ring * 0.007),
    ]);
    context.lineDashOffset = -localFrame * (0.8 + ring * 0.35);
    context.beginPath();
    context.arc(cx, cy, inner + base * (0.08 + ring * 0.055), 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function drawNeonWaveform(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 64 },
    localFrame,
    sceneFps,
  );
  const bands = spectrumBands(values);
  const colors = effectColors(params, ["#ff4d6d", "#ffb703", "#fff7ed"]);
  const centerY = box.y + box.height / 2;
  const phase = (localFrame / sceneFps) * Math.PI * 2.2;

  context.save();
  context.globalCompositeOperation = "lighter";
  [0, 1, 2].forEach((ribbon) => {
    context.beginPath();
    values.forEach((value, index) => {
      const x = box.x + (index / Math.max(1, values.length - 1)) * box.width;
      const response = clamp01(value * 0.92 + bands.energy * 0.18);
      const wave = Math.sin(index * 0.58 + phase + ribbon * 1.7);
      const y =
        centerY +
        wave * box.height * (0.08 + response * (0.28 - ribbon * 0.04));
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = colors[ribbon === 0 ? 2 : ribbon - 1] ?? "#fff7ed";
    context.lineWidth = Math.max(
      2,
      box.height * (ribbon === 0 ? 0.025 : 0.012),
    );
    context.lineCap = "round";
    context.lineJoin = "round";
    context.shadowColor = colors[ribbon % 2] ?? "#ff4d6d";
    context.shadowBlur = Math.max(8, box.height * (0.06 + bands.high * 0.05));
    context.globalAlpha = ribbon === 0 ? 0.96 : 0.4;
    context.stroke();
  });
  context.restore();
}

function drawPulseRings(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 32 },
    localFrame,
    sceneFps,
  );
  const bands = spectrumBands(values);
  const colors = effectColors(params, ["#22d3ee", "#f472b6", "#f7f7ff"]);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const base = Math.min(box.width, box.height);

  context.save();
  context.globalCompositeOperation = "lighter";
  for (let ring = 0; ring < 7; ring += 1) {
    const phase = ((localFrame / sceneFps) * 0.54 + ring / 7) % 1;
    const radius = base * (0.11 + phase * 0.39 + bands.bass * 0.025);
    context.globalAlpha = (1 - phase) * (0.2 + bands.energy * 0.72);
    context.strokeStyle = colors[ring % 2] ?? "#22d3ee";
    context.lineWidth = Math.max(
      2,
      base * (0.004 + (1 - phase) * 0.014 + bands.bass * 0.008),
    );
    context.shadowColor = context.strokeStyle as string;
    context.shadowBlur = Math.max(6, base * 0.025);
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.stroke();
  }

  const core = context.createRadialGradient(cx, cy, 0, cx, cy, base * 0.13);
  core.addColorStop(0, colors[2] ?? "#f7f7ff");
  core.addColorStop(0.35, colors[0] ?? "#22d3ee");
  core.addColorStop(1, "rgba(0,0,0,0)");
  context.globalAlpha = 0.52 + bands.energy * 0.4;
  context.fillStyle = core;
  context.beginPath();
  context.arc(cx, cy, base * (0.1 + bands.bass * 0.035), 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawParticleGalaxy(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 64 },
    localFrame,
    sceneFps,
  );
  const bands = spectrumBands(values);
  const colors = effectColors(params, ["#14f195", "#7c3aed", "#f8fbff"]);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const base = Math.min(box.width, box.height);
  const count = Math.max(32, Math.min(160, params.particleCount ?? 96));
  const time = localFrame / sceneFps;

  context.save();
  context.globalCompositeOperation = "lighter";
  for (let index = 0; index < count; index += 1) {
    const lane = index % 9;
    const random = seededRandom(9137 + index * 73);
    const angle = index * 2.399 + time * (0.2 + lane * 0.018);
    const radius =
      base *
      (0.07 +
        lane * 0.042 +
        random * 0.045 +
        bands.bass * (0.018 + lane * 0.002));
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * (0.38 + (index % 5) * 0.035);
    const size =
      base *
      (0.0025 + (index % 6) * 0.0009 + bands.high * (index % 4) * 0.0008);
    const color = colors[index % 5 === 0 ? 2 : index % 2] ?? "#ffffff";
    context.globalAlpha = 0.35 + random * 0.42 + bands.high * 0.2;
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = Math.max(3, size * 3);
    context.beginPath();
    context.arc(x, y, Math.max(1, size), 0, Math.PI * 2);
    context.fill();
  }

  const core = context.createRadialGradient(cx, cy, 0, cx, cy, base * 0.13);
  core.addColorStop(0, colors[2] ?? "#f8fbff");
  core.addColorStop(0.28, colors[0] ?? "#14f195");
  core.addColorStop(1, "rgba(0,0,0,0)");
  context.globalAlpha = 0.72;
  context.fillStyle = core;
  context.beginPath();
  context.arc(cx, cy, base * (0.1 + bands.bass * 0.025), 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawAlbumCoverPulse(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 32 },
    localFrame,
    sceneFps,
  );
  const bands = spectrumBands(values);
  const colors = effectColors(params, ["#f59e0b", "#ec4899", "#fff7ed"]);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const base = Math.min(box.width, box.height);
  const coverSize = base * 0.48 * (1 + bands.bass * 0.075);
  const coverX = cx - coverSize / 2;
  const coverY = cy - coverSize / 2;
  const cover = params.coverAssetId
    ? assets?.images.get(params.coverAssetId)
    : undefined;

  context.save();
  context.globalCompositeOperation = "lighter";
  for (let ring = 0; ring < 3; ring += 1) {
    context.globalAlpha = 0.18 + bands.energy * (0.28 - ring * 0.045);
    context.strokeStyle = colors[ring % 2] ?? "#f59e0b";
    context.lineWidth = Math.max(2, base * (0.004 + bands.bass * 0.008));
    context.shadowColor = context.strokeStyle as string;
    context.shadowBlur = Math.max(8, base * 0.028);
    context.beginPath();
    context.arc(cx, cy, coverSize * (0.56 + ring * 0.15), 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();

  context.save();
  context.shadowColor = colors[0] ?? "#f59e0b";
  context.shadowBlur = Math.max(12, base * (0.035 + bands.bass * 0.06));
  roundedRect(context, coverX, coverY, coverSize, coverSize, coverSize * 0.075);
  context.clip();
  if (cover) {
    context.drawImage(cover, coverX, coverY, coverSize, coverSize);
  } else {
    const fallback = context.createLinearGradient(
      coverX,
      coverY,
      coverX + coverSize,
      coverY + coverSize,
    );
    fallback.addColorStop(0, colors[1] ?? "#ec4899");
    fallback.addColorStop(0.58, colors[0] ?? "#f59e0b");
    fallback.addColorStop(1, "#020617");
    context.fillStyle = fallback;
    context.fillRect(coverX, coverY, coverSize, coverSize);
    context.fillStyle = "#09090b";
    context.beginPath();
    context.arc(cx, cy, coverSize * 0.23, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = colors[2] ?? "#fff7ed";
    context.lineWidth = Math.max(2, coverSize * 0.015);
    context.beginPath();
    context.arc(cx, cy, coverSize * 0.065, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();

  context.save();
  context.strokeStyle = "rgba(255,255,255,0.42)";
  context.lineWidth = Math.max(1, base * 0.002);
  roundedRect(context, coverX, coverY, coverSize, coverSize, coverSize * 0.075);
  context.stroke();
  context.restore();
}

function drawAudioBlob(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 32 },
    localFrame,
    sceneFps,
  );
  const bands = spectrumBands(values);
  const colors = effectColors(params, ["#22d3ee", "#f472b6", "#f7f7ff"]);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const base = Math.min(box.width, box.height);
  const time = localFrame / sceneFps;
  context.save();
  context.globalCompositeOperation = "lighter";
  for (let layer = 3; layer >= 0; layer -= 1) {
    const radius = base * (0.18 + layer * 0.055 + bands.bass * 0.045);
    const gradient = context.createRadialGradient(
      cx - radius * 0.24,
      cy - radius * 0.2,
      radius * 0.04,
      cx,
      cy,
      radius,
    );
    gradient.addColorStop(0, colors[2] ?? "#f7f7ff");
    gradient.addColorStop(0.36, colors[layer % 2] ?? "#22d3ee");
    gradient.addColorStop(
      1,
      layer === 0 ? (colors[1] ?? "#f472b6") : "rgba(0,0,0,0)",
    );
    context.fillStyle = gradient;
    context.strokeStyle = colors[layer % 2] ?? "#22d3ee";
    context.lineWidth = Math.max(1, base * (0.002 + (3 - layer) * 0.0015));
    context.globalAlpha = layer === 0 ? 0.76 : 0.18 + bands.energy * 0.13;
    context.shadowColor = context.strokeStyle as string;
    context.shadowBlur = base * (0.025 + bands.bass * 0.05);
    context.beginPath();
    context.ellipse(
      cx,
      cy,
      radius * (1 + Math.sin(time * 1.3 + layer) * 0.12),
      radius * (0.82 + Math.cos(time * 1.1 + layer) * 0.13),
      time * (layer % 2 ? -0.18 : 0.15) + layer,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.stroke();
  }
  context.restore();
}

function drawStarfieldTunnel(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 32 },
    localFrame,
    sceneFps,
  );
  const bands = spectrumBands(values);
  const colors = effectColors(params, ["#14f195", "#7c3aed", "#f8fbff"]);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const count = Math.max(48, Math.min(160, params.particleCount ?? 96));
  context.save();
  context.globalCompositeOperation = "lighter";
  for (let index = 0; index < count; index += 1) {
    const speed = 0.7 + (index % 7) * 0.13 + bands.energy * 1.2;
    const phase =
      ((((localFrame / sceneFps) * speed + index * 0.17) % 1) + 1) % 1;
    const angle = index * 2.399 + (index % 5) * 0.17;
    const radius =
      Math.pow(phase, 1.65) * Math.min(box.width * 0.56, box.height * 0.84);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * 0.58;
    const tail = box.width * (0.002 + phase * (0.025 + bands.bass * 0.025));
    const color =
      colors[index % 6 === 0 ? 1 : index % 3 === 0 ? 0 : 2] ?? "#fff";
    context.strokeStyle = color;
    context.lineWidth = Math.max(1, phase * 3.5);
    context.globalAlpha = 0.15 + phase * 0.85;
    context.shadowColor = color;
    context.shadowBlur = 4 + phase * 10;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(
      x + Math.cos(angle) * tail,
      y + Math.sin(angle) * tail * 0.58,
    );
    context.stroke();
  }
  context.restore();
}

function drawEqualizerGrid(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 32 },
    localFrame,
    sceneFps,
  );
  const colors = effectColors(params, ["#00e676", "#7c3aed", "#f8fbff"]);
  const columns = 16;
  const rows = 9;
  const gap = Math.max(2, Math.min(box.width, box.height) * 0.012);
  const cellWidth = (box.width - gap * (columns - 1)) / columns;
  const cellHeight = (box.height - gap * (rows - 1)) / rows;
  context.save();
  context.globalCompositeOperation = "lighter";
  for (let column = 0; column < columns; column += 1) {
    const source = Math.floor((column / columns) * values.length);
    const response = clamp01((values[source] ?? 0) * 0.92 + 0.05);
    const active = Math.max(1, Math.round(response * rows));
    for (let row = 0; row < rows; row += 1) {
      const lit = rows - row <= active;
      const color = row < 2 ? colors[1] : row < 5 ? colors[2] : colors[0];
      context.globalAlpha = lit ? 0.48 + response * 0.48 : 0.06;
      context.fillStyle = color ?? "#00e676";
      context.shadowColor = context.fillStyle as string;
      context.shadowBlur = lit ? 6 + response * 12 : 0;
      roundedRect(
        context,
        box.x + column * (cellWidth + gap),
        box.y + row * (cellHeight + gap),
        cellWidth,
        cellHeight,
        Math.min(cellWidth, cellHeight) * 0.22,
      );
      context.fill();
    }
  }
  context.restore();
}

function drawLiquidGradient(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 64 },
    localFrame,
    sceneFps,
  );
  const bands = spectrumBands(values);
  const colors = effectColors(params, ["#22d3ee", "#f472b6", "#f7f7ff"]);
  const time = localFrame / sceneFps;
  context.save();
  context.globalCompositeOperation = "lighter";
  for (let blob = 0; blob < 6; blob += 1) {
    const x =
      box.x +
      box.width *
        (0.12 + ((blob * 0.23 + Math.sin(time * (0.24 + blob * 0.03))) % 0.82));
    const y =
      box.y +
      box.height *
        (0.16 + ((blob * 0.31 + Math.cos(time * (0.2 + blob * 0.02))) % 0.7));
    const radius =
      Math.min(box.width, box.height) *
      (0.16 + (blob % 3) * 0.05 + bands.bass * 0.06);
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, colors[blob % 2] ?? "#22d3ee");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.globalAlpha = 0.24 + bands.energy * 0.2;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 0.86;
  context.strokeStyle = colors[2] ?? "#f7f7ff";
  context.lineWidth = Math.max(2, box.height * 0.01);
  context.shadowColor = colors[0] ?? "#22d3ee";
  context.shadowBlur = box.height * 0.04;
  context.beginPath();
  values.forEach((value, index) => {
    const x = box.x + (index / Math.max(1, values.length - 1)) * box.width;
    const y =
      box.y +
      box.height *
        (0.5 + Math.sin(index * 0.42 + time * 1.6) * (0.06 + value * 0.22));
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.restore();
}

function drawKaleidoscope(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 32 },
    localFrame,
    sceneFps,
  );
  const bands = spectrumBands(values);
  const colors = effectColors(params, ["#22d3ee", "#f472b6", "#f7f7ff"]);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const base = Math.min(box.width, box.height);
  const time = localFrame / sceneFps;
  context.save();
  context.globalCompositeOperation = "lighter";
  for (let layer = 0; layer < 4; layer += 1) {
    const radius = base * (0.16 + layer * 0.09 + bands.bass * 0.035);
    const segments = 16;
    context.save();
    context.translate(cx, cy);
    context.rotate(time * (layer % 2 ? -0.22 : 0.28) + layer * 0.35);
    for (let segment = 0; segment < segments; segment += 1) {
      context.rotate((Math.PI * 2) / segments);
      context.globalAlpha = 0.18 + bands.energy * 0.25 + (segment % 2) * 0.08;
      context.fillStyle =
        colors[(segment + layer) % colors.length] ?? "#22d3ee";
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(radius * 0.32, -radius * 0.14);
      context.lineTo(radius, 0);
      context.lineTo(radius * 0.32, radius * 0.14);
      context.closePath();
      context.fill();
    }
    context.restore();
  }
  context.restore();
}

function drawVinylRecord(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 32 },
    localFrame,
    sceneFps,
  );
  const bands = spectrumBands(values);
  const colors = effectColors(params, ["#f59e0b", "#ec4899", "#fff7ed"]);
  const cx = box.x + box.width * 0.46;
  const cy = box.y + box.height * 0.55;
  const radius = Math.min(box.width, box.height) * (0.32 + bands.bass * 0.018);
  context.save();
  context.fillStyle = "#070707";
  context.shadowColor = colors[0] ?? "#f59e0b";
  context.shadowBlur = 18 + bands.bass * 50;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.13)";
  context.lineWidth = Math.max(1, radius * 0.006);
  for (let groove = 1; groove < 13; groove += 1) {
    context.beginPath();
    context.arc(cx, cy, radius * (0.2 + groove * 0.062), 0, Math.PI * 2);
    context.stroke();
  }
  const label = context.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.25);
  label.addColorStop(0, colors[2] ?? "#fff7ed");
  label.addColorStop(0.28, colors[0] ?? "#f59e0b");
  label.addColorStop(1, colors[1] ?? "#ec4899");
  context.fillStyle = label;
  context.beginPath();
  context.arc(cx, cy, radius * 0.24, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#09090b";
  context.beginPath();
  context.arc(cx, cy, radius * 0.035, 0, Math.PI * 2);
  context.fill();
  context.translate(box.x + box.width * 0.82, box.y + box.height * 0.24);
  context.rotate(0.48 + bands.mid * 0.18);
  context.fillStyle = colors[2] ?? "#fff7ed";
  roundedRect(
    context,
    0,
    -radius * 0.035,
    radius * 0.88,
    radius * 0.07,
    radius * 0.03,
  );
  context.fill();
  context.restore();
}

function drawAudioTerrain(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 32 },
    localFrame,
    sceneFps,
  );
  const colors = effectColors(params, ["#14f195", "#7c3aed", "#f8fbff"]);
  const time = localFrame / sceneFps;
  context.save();
  context.globalCompositeOperation = "lighter";
  for (let row = 0; row < 15; row += 1) {
    const depth = row / 14;
    const horizonY = box.y + box.height * (0.28 + depth * 0.68);
    const inset = box.width * (0.04 + (1 - depth) * 0.22);
    context.beginPath();
    values.forEach((value, column) => {
      const x =
        box.x +
        inset +
        (column / Math.max(1, values.length - 1)) * (box.width - inset * 2);
      const history = Math.sin(column * 0.52 + row * 0.7 - time * 1.35) * 0.16;
      const y =
        horizonY -
        box.height *
          (0.025 + value * 0.12 + history * 0.08) *
          (0.35 + depth * 0.65);
      if (column === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = colors[row % 4 === 0 ? 1 : 0] ?? "#14f195";
    context.lineWidth = Math.max(1, 1 + depth * 2.2);
    context.globalAlpha = 0.18 + depth * 0.72;
    context.shadowColor = context.strokeStyle as string;
    context.shadowBlur = depth * 8;
    context.stroke();
  }
  context.restore();
}

function drawLightningArc(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 32 },
    localFrame,
    sceneFps,
  );
  const bands = spectrumBands(values);
  const colors = effectColors(params, ["#22d3ee", "#f472b6", "#f7f7ff"]);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const time = localFrame / sceneFps;
  context.save();
  context.globalCompositeOperation = "lighter";
  for (let bolt = 0; bolt < 7; bolt += 1) {
    const angle = bolt * ((Math.PI * 2) / 7) + time * (bolt % 2 ? -0.08 : 0.11);
    const distance =
      Math.min(box.width, box.height) * (0.28 + bands.high * 0.18);
    context.beginPath();
    context.moveTo(cx, cy);
    for (let segment = 1; segment <= 10; segment += 1) {
      const progress = segment / 10;
      const jitter =
        Math.sin(localFrame * 0.37 + bolt * 17 + segment * 11) *
        distance *
        0.045;
      const x =
        cx +
        Math.cos(angle) * distance * progress +
        Math.cos(angle + Math.PI / 2) * jitter;
      const y =
        cy +
        Math.sin(angle) * distance * progress +
        Math.sin(angle + Math.PI / 2) * jitter;
      context.lineTo(x, y);
    }
    context.strokeStyle = colors[bolt % 3] ?? "#f7f7ff";
    context.lineWidth = Math.max(1, 1.5 + bands.high * 4);
    context.globalAlpha = 0.26 + bands.high * 0.7;
    context.shadowColor = context.strokeStyle as string;
    context.shadowBlur = 9 + bands.high * 24;
    context.stroke();
  }
  context.restore();
}

function drawMinimalLineArt(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 64 },
    localFrame,
    sceneFps,
  );
  const bands = spectrumBands(values);
  const colors = effectColors(params, ["#ffffff", "#a3a3a3", "#ffffff"]);
  const time = localFrame / sceneFps;
  context.save();
  context.globalCompositeOperation = "lighter";
  for (let line = 0; line < 5; line += 1) {
    context.beginPath();
    values.forEach((value, index) => {
      const x = box.x + (index / Math.max(1, values.length - 1)) * box.width;
      const y =
        box.y +
        box.height *
          (0.5 +
            (line - 2) * 0.1 +
            Math.sin(index * 0.55 + time * (0.75 + line * 0.08) + line) *
              (0.03 + value * 0.1));
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = colors[line === 2 ? 2 : line % 2] ?? "#ffffff";
    context.lineWidth = line === 2 ? 2.2 : 1;
    context.globalAlpha = line === 2 ? 0.82 : 0.24 + bands.high * 0.2;
    context.shadowColor = colors[0] ?? "#ffffff";
    context.shadowBlur = line === 2 ? 8 + bands.energy * 10 : 0;
    context.stroke();
  }
  context.restore();
}

function drawCassetteVuMeter(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  sceneFps: number,
  params: EffectParams,
  assets: ResolvedAssets | undefined,
): void {
  const values = spectrumValues(
    assets,
    { ...params, barCount: 24 },
    localFrame,
    sceneFps,
  );
  const colors = effectColors(params, ["#fb7185", "#facc15", "#f8fafc"]);
  const energy = values.reduce((sum, value) => sum + value, 0) / values.length;
  const bass = values.slice(0, 6).reduce((sum, value) => sum + value, 0) / 6;
  const radius = Math.min(box.width, box.height) * 0.06;

  context.save();
  context.fillStyle = "#111827";
  roundedRect(context, box.x, box.y, box.width, box.height, radius);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,0.18)";
  context.lineWidth = Math.max(2, box.width * 0.006);
  context.stroke();

  const panelX = box.x + box.width * 0.08;
  const panelY = box.y + box.height * 0.1;
  const panelWidth = box.width * 0.84;
  const panelHeight = box.height * 0.48;
  const panelGradient = context.createLinearGradient(
    panelX,
    panelY,
    panelX,
    panelY + panelHeight,
  );
  panelGradient.addColorStop(0, "#e5e7eb");
  panelGradient.addColorStop(1, "#94a3b8");
  context.fillStyle = panelGradient;
  roundedRect(context, panelX, panelY, panelWidth, panelHeight, radius * 0.55);
  context.fill();

  const reelRadius = Math.min(panelWidth, panelHeight) * 0.24;
  [0.3, 0.7].forEach((position, index) => {
    const cx = panelX + panelWidth * position;
    const cy = panelY + panelHeight * 0.5;
    context.save();
    context.translate(cx, cy);
    context.rotate(
      (localFrame / sceneFps) * Math.PI * (index === 0 ? 1.8 : -1.8),
    );
    context.fillStyle = "#020617";
    context.beginPath();
    context.arc(0, 0, reelRadius * (1 + bass * 0.05), 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.72)";
    context.lineWidth = reelRadius * 0.08;
    for (let spoke = 0; spoke < 6; spoke += 1) {
      context.rotate(Math.PI / 3);
      context.beginPath();
      context.moveTo(reelRadius * 0.22, 0);
      context.lineTo(reelRadius * 0.78, 0);
      context.stroke();
    }
    context.restore();
  });

  const meterY = box.y + box.height * 0.66;
  const meterHeight = box.height * 0.18;
  [0.1, 0.54].forEach((left, index) => {
    const x = box.x + box.width * left;
    const width = box.width * 0.36;
    context.fillStyle = "#020617";
    roundedRect(context, x, meterY, width, meterHeight, radius * 0.35);
    context.fill();
    const needle = -0.72 + clamp01(energy * (index === 0 ? 1.05 : 0.92)) * 1.44;
    context.save();
    context.translate(x + width / 2, meterY + meterHeight * 0.82);
    context.rotate(needle);
    context.strokeStyle = colors[index] ?? colors[0] ?? "#fb7185";
    context.shadowColor = context.strokeStyle as string;
    context.shadowBlur = 12;
    context.lineWidth = Math.max(2, width * 0.012);
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, -meterHeight * 0.62);
    context.stroke();
    context.restore();
  });

  const ledY = box.y + box.height * 0.9;
  const ledGap = box.width * 0.008;
  const ledWidth =
    (box.width * 0.8 - ledGap * (values.length - 1)) / values.length;
  values.forEach((value, index) => {
    const height = box.height * 0.1 * clamp01(value + 0.08);
    context.fillStyle =
      index > 18 ? (colors[1] ?? "#facc15") : (colors[0] ?? "#fb7185");
    context.shadowColor = context.fillStyle as string;
    context.shadowBlur = 8;
    roundedRect(
      context,
      box.x + box.width * 0.1 + index * (ledWidth + ledGap),
      ledY - height,
      ledWidth,
      height,
      ledWidth / 2,
    );
    context.fill();
  });
  context.restore();
}

function drawCartoonBurst(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  duration: number,
  params: EffectParams,
): void {
  const progress = clamp01(localFrame / Math.max(1, duration - 1));
  const easedOut = 1 - Math.pow(1 - progress, 3);
  const fade = clamp01(1 - progress);
  const intensity = effectLevel(params.intensity, "medium");
  const intensityScale = levelScale(intensity);
  const scale = params.scale ?? 1;
  const spread = 0.82 + (params.spread ?? 0.5) * 0.48;
  const colors = effectColors(params, [
    "#fff3a3",
    "#ff7a18",
    "#ef233c",
    "#7dd3fc",
  ]);
  const particleCount = Math.round(
    params.particleCount ??
      (intensity === "high" ? 108 : intensity === "low" ? 44 : 72),
  );
  const seed =
    params.seed ??
    hashString(`${nodeSafeId(box.node.id)}:${box.width}x${box.height}`);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const radiusBase = Math.min(box.width, box.height);
  const burstRadius =
    radiusBase * 0.08 +
    radiusBase * 0.48 * easedOut * intensityScale * scale * spread;

  context.save();
  context.globalCompositeOperation = "lighter";

  if (params.shockwave ?? true) {
    const ringRadius = radiusBase * (0.14 + easedOut * 0.56 * scale * spread);
    context.globalAlpha *= 0.7 * fade;
    context.strokeStyle = colors[0] ?? "#fff3a3";
    context.lineWidth = Math.max(3, radiusBase * 0.025 * (1 - progress));
    context.beginPath();
    context.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    context.stroke();
  }

  for (let index = 0; index < particleCount; index += 1) {
    const particleSeed = seededRandom(seed + index * 97);
    const angle = particleSeed * Math.PI * 2;
    const speed = 0.36 + seededRandom(seed + index * 131) * 0.76;
    const distance = burstRadius * speed;
    const wobble =
      Math.sin(progress * Math.PI * 2 + index) * radiusBase * 0.025;
    const x =
      centerX +
      Math.cos(angle) * distance +
      Math.cos(angle + Math.PI / 2) * wobble;
    const y =
      centerY +
      Math.sin(angle) * distance +
      Math.sin(angle + Math.PI / 2) * wobble;
    const size =
      radiusBase *
      (0.012 + seededRandom(seed + index * 193) * 0.025) *
      intensityScale *
      (0.55 + fade) *
      Math.sqrt(scale);
    const color = colors[index % colors.length] ?? "#ffffff";

    context.globalAlpha = Math.max(
      0,
      Math.min(1, fade * (0.7 + particleSeed * 0.3)),
    );
    context.fillStyle = color;

    if (index % 4 === 0) {
      drawSpark(context, x, y, size * 1.8, angle + progress * Math.PI);
    } else {
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
    }
  }

  const corePulse = Math.sin(progress * Math.PI);
  context.globalAlpha = 0.8 * corePulse;
  context.fillStyle = colors[1] ?? "#ff7a18";
  context.beginPath();
  context.arc(
    centerX,
    centerY,
    radiusBase * (0.05 + corePulse * 0.16 * scale),
    0,
    Math.PI * 2,
  );
  context.fill();

  if (params.emoji) {
    const fontSize = Math.max(18, radiusBase * (0.22 + corePulse * 0.06));
    context.globalAlpha = clamp01(Math.sin(progress * Math.PI) * 1.2);
    context.font = `${Math.round(fontSize)}px system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(params.emoji, centerX, centerY, box.width);
  }

  context.restore();
}

function drawConfettiBurst(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  duration: number,
  params: EffectParams,
): void {
  const progress = clamp01(localFrame / Math.max(1, duration - 1));
  const fadeIn = clamp01(progress * 6);
  const fadeOut = clamp01((1 - progress) * 1.7);
  const intensity = effectLevel(params.intensity ?? params.density, "medium");
  const colors = effectColors(params, [
    "#facc15",
    "#fb7185",
    "#38bdf8",
    "#a78bfa",
    "#34d399",
  ]);
  const count = Math.round(
    params.particleCount ??
      (intensity === "high" ? 140 : intensity === "low" ? 50 : 90),
  );
  const seed = params.seed ?? hashString(`${nodeSafeId(box.node.id)}:confetti`);
  const spreadAmount = 0.78 + (params.spread ?? 0.5) * 0.68;
  const scale = params.scale ?? 1;
  const gravity = box.height * 0.32 * progress * progress;
  const centerX = box.x + box.width / 2;
  const startY = box.y + box.height * 0.18;
  const spread = box.width * (0.16 + progress * 0.52) * spreadAmount * scale;

  context.save();

  for (let index = 0; index < count; index += 1) {
    const rnd = seededRandom(seed + index * 109);
    const angle = -Math.PI / 2 + (rnd - 0.5) * Math.PI * 1.45;
    const speed = 0.35 + seededRandom(seed + index * 173) * 0.95;
    const drift = Math.sin(progress * Math.PI * 2 + index) * box.width * 0.018;
    const x = centerX + Math.cos(angle) * spread * speed + drift;
    const y =
      startY +
      Math.sin(angle) * box.height * 0.28 * progress * speed +
      gravity * (0.86 + scale * 0.14) +
      seededRandom(seed + index * 211) * box.height * 0.08;
    const w = box.width * (0.01 + seededRandom(seed + index * 251) * 0.018);
    const h = w * (0.45 + seededRandom(seed + index * 283) * 0.75);

    context.save();
    context.globalAlpha *= fadeIn * fadeOut * (0.72 + rnd * 0.28);
    context.fillStyle = colors[index % colors.length] ?? "#ffffff";
    context.translate(x, y);
    context.rotate(progress * Math.PI * 5 + rnd * Math.PI);
    context.fillRect(-w / 2, -h / 2, w, h);
    context.restore();
  }

  if (params.emoji) {
    const pop = Math.sin(Math.min(1, progress * 1.25) * Math.PI);
    context.globalAlpha *= fadeIn * fadeOut;
    context.font = `${Math.round(Math.max(18, Math.min(box.width, box.height) * (0.14 + pop * 0.04)))}px system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      params.emoji,
      centerX,
      box.y + box.height * 0.46,
      box.width,
    );
  }

  context.restore();
}

function drawCloudPop(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  duration: number,
  params: EffectParams,
): void {
  const progress = clamp01(localFrame / Math.max(1, duration - 1));
  const appear = clamp01(progress * 4);
  const fade = clamp01((1 - progress) * 1.45);
  const intensity = effectLevel(params.intensity ?? params.density, "medium");
  const colors = effectColors(params, ["#ffffff", "#e0f2fe", "#fef3c7"]);
  const seed = params.seed ?? hashString(`${nodeSafeId(box.node.id)}:cloud`);
  const puffCount = intensity === "high" ? 18 : intensity === "low" ? 9 : 13;
  const textScope = params.scope === "text";
  const scale = params.scale ?? 1;
  const spread = (textScope ? 0.62 : 0.78) + (params.spread ?? 0.5) * 0.55;
  const softness = params.softness ?? 0.35;
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const base = Math.min(box.width, box.height);

  context.save();

  for (let index = 0; index < puffCount + (textScope ? 4 : 0); index += 1) {
    const rnd = seededRandom(seed + index * 137);
    const totalPuffs = puffCount + (textScope ? 4 : 0);
    const angle = (Math.PI * 2 * index) / totalPuffs + rnd * 0.55;
    const orbit =
      base *
      ((textScope ? 0.18 : 0.22) + seededRandom(seed + index * 191) * 0.18) *
      (0.62 + progress * 0.42) *
      spread *
      scale;
    const x =
      centerX +
      Math.cos(angle) *
        orbit *
        (box.width / Math.max(1, base)) *
        (textScope ? 1.08 : 1);
    const y =
      centerY +
      Math.sin(angle) *
        orbit *
        (box.height / Math.max(1, base)) *
        (textScope ? 0.58 : 1);
    const radius =
      base *
      ((textScope ? 0.072 : 0.095) + seededRandom(seed + index * 223) * 0.075) *
      (0.7 + appear * 0.45) *
      (0.9 + scale * 0.18 + softness * 0.28);

    context.globalAlpha =
      (0.42 + softness * 0.2) * fade * appear * (0.72 + rnd * 0.28);
    context.fillStyle = colors[index % colors.length] ?? "#ffffff";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.globalAlpha = (0.2 + softness * 0.22) * fade * appear;
  context.strokeStyle = colors[1] ?? "#e0f2fe";
  context.lineWidth = Math.max(2, base * (0.014 + softness * 0.018));
  context.beginPath();
  context.ellipse(
    centerX,
    centerY,
    box.width * (textScope ? 0.42 : 0.38) * scale,
    box.height * (textScope ? 0.16 : 0.25) * scale,
    0,
    0,
    Math.PI * 2,
  );
  context.stroke();
  context.restore();
}

function drawSpeedLines(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  duration: number,
  params: EffectParams,
): void {
  const progress = clamp01(localFrame / Math.max(1, duration - 1));
  const intensity = effectLevel(params.intensity ?? params.density, "medium");
  const colors = effectColors(params, ["#ffffff", "#facc15"]);
  const lineCount = intensity === "high" ? 34 : intensity === "low" ? 14 : 24;
  const seed = params.seed ?? hashString(`${nodeSafeId(box.node.id)}:speed`);
  const direction = params.direction ?? "in";
  const textScope = params.scope === "text";
  const spread = (textScope ? 0.58 : 0.78) + (params.spread ?? 0.5) * 0.58;
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const maxRadius =
    Math.hypot(box.width, box.height) * (textScope ? 0.44 : 0.58) * spread;
  const minRadius =
    Math.min(box.width, box.height) *
    (textScope ? 0.2 : 0.14) *
    (0.9 + spread * 0.1);

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";

  for (let index = 0; index < lineCount; index += 1) {
    const rnd = seededRandom(seed + index * 157);
    let angle = rnd * Math.PI * 2;

    if (direction === "left") angle = Math.PI + (rnd - 0.5) * 0.75;
    if (direction === "right") angle = (rnd - 0.5) * 0.75;
    if (direction === "up") angle = -Math.PI / 2 + (rnd - 0.5) * 0.75;
    if (direction === "down") angle = Math.PI / 2 + (rnd - 0.5) * 0.75;
    if (direction === "diagonal") {
      angle =
        (index % 2 === 0 ? Math.PI / 4 : (Math.PI * 3) / 4) +
        (rnd - 0.5) * 0.55;
    }

    const phase = (progress + rnd) % 1;
    const outer = maxRadius * (0.74 + phase * 0.36);
    const inner =
      direction === "out"
        ? minRadius + outer * (0.42 + phase * 0.22)
        : minRadius + outer * (0.12 + (1 - phase) * 0.18);
    const alpha = Math.sin(phase * Math.PI) * 0.7;

    context.globalAlpha = alpha;
    context.strokeStyle = colors[index % colors.length] ?? "#ffffff";
    context.lineWidth = Math.max(
      2,
      Math.min(box.width, box.height) * (0.006 + rnd * 0.006),
    );
    context.beginPath();
    context.moveTo(
      centerX + Math.cos(angle) * inner,
      centerY + Math.sin(angle) * inner,
    );
    context.lineTo(
      centerX + Math.cos(angle) * outer,
      centerY + Math.sin(angle) * outer,
    );
    context.stroke();
  }

  context.restore();
}

function drawNeonAura(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  duration: number,
  params: EffectParams,
): void {
  const progress = clamp01(localFrame / Math.max(1, duration - 1));
  const pulseAmount = params.pulse ?? 0.65;
  const pulse =
    pulseAmount *
    (0.5 + Math.sin(progress * Math.PI * 2 * (params.loops ?? 2)) * 0.5);
  const intensity = effectLevel(params.intensity, "medium");
  const colors = effectColors(params, ["#22d3ee", "#a78bfa", "#f0abfc"]);
  const base = Math.min(box.width, box.height);
  const scale = params.scale ?? 1;
  const glow = params.glow ?? params.softness ?? 0.55;
  const textScope = params.scope === "text";
  const radius = readEffectRadius(params, textScope ? base * 0.5 : base * 0.11);
  const lineWidth =
    params.strokeWidth ??
    base *
      (textScope ? 0.014 + pulse * 0.014 : 0.025 + pulse * 0.024) *
      levelScale(intensity) *
      scale;
  const insetX = textScope ? box.width * 0.08 : lineWidth * 0.4;
  const insetY = textScope ? box.height * 0.18 : lineWidth * 0.4;

  context.save();
  context.globalCompositeOperation = "lighter";

  for (let index = colors.length - 1; index >= 0; index -= 1) {
    context.globalAlpha =
      (0.1 + glow * 0.1 + pulse * 0.18) * (1 - index * 0.12);
    context.strokeStyle = colors[index] ?? "#22d3ee";
    context.lineWidth = lineWidth * (1 + index * (1.2 + glow * 0.8));
    if (textScope) {
      context.beginPath();
      context.ellipse(
        box.x + box.width / 2,
        box.y + box.height / 2,
        Math.max(1, box.width / 2 - insetX + index * lineWidth * 0.36),
        Math.max(1, box.height / 2 - insetY + index * lineWidth * 0.28),
        0,
        0,
        Math.PI * 2,
      );
    } else {
      roundedRect(
        context,
        box.x + insetX,
        box.y + insetY,
        Math.max(1, box.width - insetX * 2),
        Math.max(1, box.height - insetY * 2),
        radius,
      );
    }
    context.stroke();
  }

  context.globalAlpha = 0.42 + glow * 0.2 + pulse * 0.35;
  context.strokeStyle = colors[0] ?? "#22d3ee";
  context.lineWidth = Math.max(2, lineWidth * 0.45);
  if (textScope) {
    context.beginPath();
    context.ellipse(
      box.x + box.width / 2,
      box.y + box.height / 2,
      Math.max(1, box.width / 2 - insetX * 1.15),
      Math.max(1, box.height / 2 - insetY * 1.15),
      0,
      0,
      Math.PI * 2,
    );
  } else {
    roundedRect(
      context,
      box.x + lineWidth * 0.65,
      box.y + lineWidth * 0.65,
      Math.max(1, box.width - lineWidth * 1.3),
      Math.max(1, box.height - lineWidth * 1.3),
      radius,
    );
  }
  context.stroke();
  context.restore();
}

function drawScribbleCircle(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  localFrame: number,
  duration: number,
  params: EffectParams,
): void {
  const progress = clamp01(localFrame / Math.max(1, duration - 1));
  const drawProgress = clamp01(progress * 1.35);
  const colors = effectColors(params, ["#facc15", "#ffffff"]);
  const seed = params.seed ?? hashString(`${nodeSafeId(box.node.id)}:scribble`);
  const loops = params.loops ?? 2;
  const wobble = params.wobble ?? 0.35;
  const scale = params.scale ?? 1;
  const textScope = params.scope === "text";
  const strokeWidth =
    params.strokeWidth ??
    Math.max(3, Math.min(box.width, box.height) * (textScope ? 0.018 : 0.025));
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const radiusX = box.width * (textScope ? 0.44 : 0.42) * scale;
  const radiusY = box.height * (textScope ? 0.24 : 0.34) * scale;
  const steps = Math.max(18, Math.round(96 * drawProgress));

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  for (let loop = 0; loop < loops; loop += 1) {
    context.globalAlpha = 0.72 - loop * 0.1;
    context.strokeStyle = colors[loop % colors.length] ?? "#facc15";
    context.lineWidth = Math.max(1, strokeWidth * (1 - loop * 0.12));
    context.beginPath();

    for (let step = 0; step <= steps; step += 1) {
      const t = (step / Math.max(1, steps)) * Math.PI * 2;
      const noise = seededRandom(seed + loop * 503 + step * 19) - 0.5;
      const wobbleOffset =
        Math.sin(t * 3 + loop + progress * Math.PI * 2) * wobble +
        noise * wobble;
      const x = centerX + Math.cos(t) * radiusX * (1 + wobbleOffset * 0.08);
      const y = centerY + Math.sin(t) * radiusY * (1 + wobbleOffset * 0.1);

      if (step === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.stroke();
  }

  context.restore();
}

function nodeSafeId(value: string): string {
  return value || "effect";
}

function drawSpark(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  angle: number,
): void {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.beginPath();
  context.moveTo(0, -radius);
  context.lineTo(radius * 0.28, -radius * 0.28);
  context.lineTo(radius, 0);
  context.lineTo(radius * 0.28, radius * 0.28);
  context.lineTo(0, radius);
  context.lineTo(-radius * 0.28, radius * 0.28);
  context.lineTo(-radius, 0);
  context.lineTo(-radius * 0.28, -radius * 0.28);
  context.closePath();
  context.fill();
  context.restore();
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededRandom(seed: number): number {
  let value = seed >>> 0;
  value += 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function effectColors(params: EffectParams, fallback: string[]): string[] {
  return params.colors && params.colors.length > 0 ? params.colors : fallback;
}

function effectLevel(
  value: EffectParams["intensity"] | EffectParams["density"],
  fallback: "low" | "medium" | "high",
): "low" | "medium" | "high" {
  return value ?? fallback;
}

function levelScale(value: "low" | "medium" | "high"): number {
  return value === "high" ? 1.3 : value === "low" ? 0.72 : 1;
}

function readEffectRadius(params: EffectParams, fallback: number): number {
  return params.radius && Number.isFinite(params.radius)
    ? params.radius
    : fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function drawMedia(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  style: SceneStyle,
  source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas,
  natural: { width: number; height: number },
): void {
  const fitted = computeObjectFit(
    style.objectFit,
    style.objectPosition,
    box,
    natural,
  );

  context.save();
  // Explicit smoothing settings so scaled pixels are deliberate, not
  // browser-default-dependent.
  const pixelated = style.imageRendering === "pixelated";
  context.imageSmoothingEnabled = !pixelated;
  if (!pixelated) {
    context.imageSmoothingQuality = "high";
  }

  const radius = resolveCornerRadii(style, box);

  if (hasCornerRadius(radius)) {
    roundedRect(context, box.x, box.y, box.width, box.height, radius);
  } else {
    context.beginPath();
    context.rect(box.x, box.y, box.width, box.height);
  }

  context.clip();
  if (pixelated) {
    drawPixelatedMedia(context, source, natural, {
      x: box.x + fitted.x,
      y: box.y + fitted.y,
      width: fitted.width,
      height: fitted.height,
      pixelSize: Math.max(1, Math.round(style.pixelSize ?? 12)),
    });
  } else {
    context.drawImage(
      source,
      box.x + fitted.x,
      box.y + fitted.y,
      fitted.width,
      fitted.height,
    );
  }
  context.restore();
}

function drawPixelatedMedia(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas,
  natural: { width: number; height: number },
  fitted: {
    x: number;
    y: number;
    width: number;
    height: number;
    pixelSize: number;
  },
): void {
  const lowWidth = Math.max(1, Math.ceil(fitted.width / fitted.pixelSize));
  const lowHeight = Math.max(1, Math.ceil(fitted.height / fitted.pixelSize));
  const lowCanvas = createStagingCanvas(lowWidth, lowHeight);
  const lowContext = lowCanvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;

  if (!lowContext) {
    throw new Error("Canvas2D unavailable for pixelated media staging.");
  }

  lowContext.clearRect(0, 0, lowWidth, lowHeight);
  lowContext.imageSmoothingEnabled = true;
  lowContext.imageSmoothingQuality = "high";
  lowContext.drawImage(
    source,
    0,
    0,
    natural.width,
    natural.height,
    0,
    0,
    lowWidth,
    lowHeight,
  );

  context.imageSmoothingEnabled = false;
  context.drawImage(lowCanvas, fitted.x, fitted.y, fitted.width, fitted.height);
}

function drawBackground(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  style: SceneStyle,
): void {
  const background = style.background ?? style.backgroundColor;

  if (!background) {
    return;
  }

  const shadows = style.boxShadow ? parseBoxShadows(style.boxShadow) : [];
  if (shadows.length > 1) {
    shadows.forEach((shadow) =>
      drawBoxShadowLayer(context, box, style, shadow),
    );
  }
  const shadow = shadows.length === 1 ? shadows[0] : null;

  if (shadow) {
    // Canvas shadows emit from painted pixels, so the shadow rides the
    // background fill. A node with boxShadow but no background paints no
    // shadow — documented in scene-format.
    context.save();
    context.shadowColor = shadow.color;
    context.shadowOffsetX = shadow.offsetX;
    context.shadowOffsetY = shadow.offsetY;
    context.shadowBlur = shadow.blur;
  }

  context.fillStyle = parseFill(context, box, background);
  const radius = resolveCornerRadii(style, box);

  if (hasCornerRadius(radius)) {
    roundedRect(context, box.x, box.y, box.width, box.height, radius);
    context.fill();
  } else {
    context.fillRect(box.x, box.y, box.width, box.height);
  }

  if (shadow) {
    context.restore();
  }
}

export type ParsedBoxShadow = {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
};

export function parseBoxShadows(value: string): ParsedBoxShadow[] {
  return (parseShadowListValue(value) ?? []).map((shadow) => ({
    offsetX: shadow.offsetX,
    offsetY: shadow.offsetY,
    blur: shadow.blur,
    color: shadow.color.source,
  }));
}

function drawBoxShadowLayer(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  style: SceneStyle,
  shadow: ParsedBoxShadow,
): void {
  const padding = Math.ceil(
    Math.max(
      2,
      shadow.blur * 2 + Math.abs(shadow.offsetX) + Math.abs(shadow.offsetY),
    ),
  );
  const canvas = createStagingCanvas(
    Math.max(1, Math.ceil(box.width + padding * 2)),
    Math.max(1, Math.ceil(box.height + padding * 2)),
  );
  const shadowContext = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!shadowContext) {
    throw new Error("Canvas2D unavailable for multiple box-shadow staging.");
  }
  const stagedBox = {
    width: box.width,
    height: box.height,
  };
  const radii = resolveCornerRadii(style, stagedBox);
  shadowContext.fillStyle = "#000000";
  shadowContext.shadowColor = shadow.color;
  shadowContext.shadowOffsetX = shadow.offsetX;
  shadowContext.shadowOffsetY = shadow.offsetY;
  shadowContext.shadowBlur = shadow.blur;
  roundedRect(shadowContext, padding, padding, box.width, box.height, radii);
  shadowContext.fill();

  // Remove the staging source while keeping its emitted shadow.
  shadowContext.globalCompositeOperation = "destination-out";
  shadowContext.shadowColor = "transparent";
  shadowContext.shadowOffsetX = 0;
  shadowContext.shadowOffsetY = 0;
  shadowContext.shadowBlur = 0;
  roundedRect(shadowContext, padding, padding, box.width, box.height, radii);
  shadowContext.fill();
  context.drawImage(canvas, box.x - padding, box.y - padding);
}

/**
 * Parses `<offset-x> <offset-y> [blur] <color>` box shadows (px lengths;
 * color last, rgb()/rgba() allowed). Inset and spread are not supported and
 * make the whole value null (no shadow), so unsupported shadows are loud in
 * review rather than subtly wrong.
 */
export function parseBoxShadow(value: string): ParsedBoxShadow | null {
  const shadow = parseShadowValue(value);
  return shadow
    ? {
        offsetX: shadow.offsetX,
        offsetY: shadow.offsetY,
        blur: shadow.blur,
        color: shadow.color.source,
      }
    : null;
}

export type ParsedBorder = { width: number; color: string };

/**
 * Parses `<width> [solid] <color>` borders. Only solid is supported; other
 * line styles make the value null.
 */
export function parseBorder(value: string): ParsedBorder | null {
  const border = parseBorderValue(value);
  return border && border.width > 0
    ? { width: border.width, color: border.color.source }
    : null;
}

/**
 * Strokes the border inside the border box (CSS border-box sizing), following
 * borderRadius. Painted after the node's own content, before children.
 */
function drawBorder(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  style: SceneStyle,
): void {
  const border = style.border ? parseBorder(style.border) : null;

  if (!border) {
    return;
  }

  const radius = resolveCornerRadii(style, box);
  const inset = border.width / 2;

  context.save();
  context.strokeStyle = border.color;
  context.lineWidth = border.width;

  if (hasCornerRadius(radius)) {
    roundedRect(
      context,
      box.x + inset,
      box.y + inset,
      box.width - border.width,
      box.height - border.width,
      insetCornerRadii(radius, inset),
    );
    context.stroke();
  } else {
    context.strokeRect(
      box.x + inset,
      box.y + inset,
      box.width - border.width,
      box.height - border.width,
    );
  }

  context.restore();
}

function resolveLineHeight(
  value: number | string | undefined,
  fontSize: number,
): number {
  // CSS semantics: a unitless number is a multiplier of the font size.
  if (typeof value === "number") {
    return fontSize * value;
  }

  return readLength(value, fontSize, fontSize * 1.25);
}

function drawText(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  value: string,
  style: SceneStyle,
  textMeasureCache: TextMeasureCache | undefined,
  runs?: SceneTextRun[],
): void {
  const fontSize = readLength(style.fontSize, box.height, 24);
  context.font = canvasFont(style, fontSize);
  context.fillStyle = style.color ?? "#ffffff";
  context.textAlign = style.textAlign ?? "left";
  context.direction = style.direction ?? "inherit";
  context.textBaseline = "middle";

  const letterSpacing = readLength(style.letterSpacing, fontSize, 0);
  if (letterSpacing !== 0 && "letterSpacing" in context) {
    context.letterSpacing = `${letterSpacing}px`;
  }

  const shadow = parseTextShadow(style.textShadow);
  if (shadow) {
    context.shadowOffsetX = shadow.x;
    context.shadowOffsetY = shadow.y;
    context.shadowBlur = shadow.blur;
    context.shadowColor = shadow.color;
  }

  const stroke = parseTextStroke(style.textStroke, fontSize);
  if (stroke) {
    context.lineWidth = stroke.width;
    context.strokeStyle = stroke.color;
    context.lineJoin = "round";
    context.miterLimit = 2;
  }

  const x =
    style.textAlign === "center"
      ? box.x + box.width / 2
      : style.textAlign === "right"
        ? box.x + box.width
        : box.x;

  const textLayout = prepareTextLayout(
    value,
    box.width,
    fontSize,
    (line, size) =>
      measureTextLine(context, line, style, size, textMeasureCache),
    {
      maxLines: style.maxLines,
      minFontSize: readLength(style.minFontSize, box.height, 12),
      textFit: style.textFit,
      textOverflow: style.textOverflow,
      height: box.height,
      lineHeight: style.lineHeight,
    },
  );
  context.font = canvasFont(style, textLayout.fontSize);
  const lineHeight = textLayout.lineHeight;
  const lines = textLayout.lines;
  // The line block is centered vertically in the box, matching the previous
  // single-line behavior when there is exactly one line.
  const firstLineY =
    box.y + box.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  const background = parseTextBackground(style, fontSize);

  if (runs) {
    drawRichTextLines(
      context,
      box,
      runs,
      style,
      textLayout,
      firstLineY,
      background,
      stroke,
      textMeasureCache,
    );
    return;
  }

  lines.forEach((line, index) => {
    if (line !== "") {
      const y = firstLineY + index * lineHeight;
      const measuredWidth = Math.min(
        measureTextLine(
          context,
          line,
          style,
          textLayout.fontSize,
          textMeasureCache,
        ),
        box.width,
      );

      if (background) {
        drawTextBackground(context, {
          x: textLineX(
            style.textAlign,
            box,
            x,
            measuredWidth,
            background.paddingX,
          ),
          y: y - lineHeight / 2 - background.paddingY,
          width: measuredWidth + background.paddingX * 2,
          height: lineHeight + background.paddingY * 2,
          radius: background.radius,
          color: background.color,
        });
      }

      if (stroke) {
        context.strokeText(line, x, y, box.width);
      }

      context.fillText(line, x, y, box.width);
    }
  });
}

type RichTextSegment = { text: string; run: SceneTextRun };

function drawRichTextLines(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  runs: SceneTextRun[],
  style: SceneStyle,
  textLayout: ReturnType<typeof prepareTextLayout>,
  firstLineY: number,
  background: TextBackground | null,
  nodeStroke: ReturnType<typeof parseTextStroke>,
  textMeasureCache: TextMeasureCache | undefined,
): void {
  const styledLines = richSegmentsByLine(runs, textLayout.lines);
  styledLines.forEach((segments, lineIndex) => {
    const line = textLayout.lines[lineIndex] ?? "";
    if (line === "") return;
    const y = firstLineY + lineIndex * textLayout.lineHeight;
    const lineWidth = Math.min(
      measureTextLine(
        context,
        line,
        style,
        textLayout.fontSize,
        textMeasureCache,
      ),
      box.width,
    );
    const anchorX =
      style.textAlign === "center"
        ? box.x + box.width / 2
        : style.textAlign === "right"
          ? box.x + box.width
          : box.x;
    let cursorX = textLineX(style.textAlign, box, anchorX, lineWidth, 0);

    if (background) {
      drawTextBackground(context, {
        x: cursorX - background.paddingX,
        y: y - textLayout.lineHeight / 2 - background.paddingY,
        width: lineWidth + background.paddingX * 2,
        height: textLayout.lineHeight + background.paddingY * 2,
        radius: background.radius,
        color: background.color,
      });
    }

    for (const segment of segments) {
      const segmentWidth = measureTextLine(
        context,
        segment.text,
        style,
        textLayout.fontSize,
        textMeasureCache,
      );
      const runStyle = segment.run.style ?? {};
      if (runStyle.textBackgroundColor) {
        drawTextBackground(context, {
          x: cursorX,
          y: y - textLayout.lineHeight / 2,
          width: segmentWidth,
          height: textLayout.lineHeight,
          radius: 0,
          color: runStyle.textBackgroundColor,
        });
      }

      context.save();
      context.globalAlpha *= runStyle.opacity ?? 1;
      context.textAlign = "left";
      context.fillStyle = runStyle.color ?? style.color ?? "#ffffff";
      const runStroke = runStyle.textStroke
        ? parseTextStroke(runStyle.textStroke, textLayout.fontSize)
        : nodeStroke;
      if (runStroke) {
        context.lineWidth = runStroke.width;
        context.strokeStyle = runStroke.color;
        context.lineJoin = "round";
        context.miterLimit = 2;
        context.strokeText(segment.text, cursorX, y);
      }
      context.fillText(segment.text, cursorX, y);
      context.restore();
      cursorX += segmentWidth;
    }
  });
}

function richSegmentsByLine(
  runs: SceneTextRun[],
  lines: string[],
): RichTextSegment[][] {
  const source = runs.flatMap((run) =>
    Array.from(run.text).map((character) => ({ character, run })),
  );
  let sourceIndex = 0;
  const fallbackRun = runs[runs.length - 1] ?? { text: "", style: {} };

  return lines.map((line) => {
    const segments: RichTextSegment[] = [];
    for (const character of Array.from(line)) {
      let matchedIndex = sourceIndex;
      while (
        matchedIndex < source.length &&
        source[matchedIndex]?.character !== character
      ) {
        matchedIndex += 1;
      }
      const matched = source[matchedIndex];
      const run = matched?.run ?? fallbackRun;
      if (matched) sourceIndex = matchedIndex + 1;
      const previous = segments[segments.length - 1];
      if (previous?.run === run) {
        previous.text += character;
      } else {
        segments.push({ text: character, run });
      }
    }
    return segments;
  });
}

function textLineX(
  align: SceneStyle["textAlign"],
  box: LayoutBox,
  textX: number,
  textWidth: number,
  paddingX: number,
): number {
  if (align === "center") {
    return textX - textWidth / 2 - paddingX;
  }

  if (align === "right") {
    return textX - textWidth - paddingX;
  }

  return box.x - paddingX;
}

function resolveTransformOrigin(
  value: string | undefined,
  box: LayoutBox,
): { x: number; y: number } {
  const parsed = value ? parseTransformOriginValue(value) : null;

  return {
    x: box.x + resolveOriginComponent(parsed?.x, box.width),
    y: box.y + resolveOriginComponent(parsed?.y, box.height),
  };
}

function resolveOriginComponent(
  part: TransformOriginComponent | undefined,
  size: number,
): number {
  if (!part) return size / 2;
  if (part.kind === "length") {
    return part.value.unit === "%"
      ? (part.value.value / 100) * size
      : part.value.value;
  }
  if (part.value === "left" || part.value === "top") {
    return 0;
  }

  if (part.value === "right" || part.value === "bottom") {
    return size;
  }
  return size / 2;
}

function applyTransform(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  style: SceneStyle,
): void {
  if (!style.transform) {
    return;
  }

  if (typeof style.transform !== "string") {
    return;
  }

  const origin = resolveTransformOrigin(style.transformOrigin, box);
  context.translate(origin.x, origin.y);

  const transform = parseTransformValue(style.transform);
  if (transform?.kind === "transform-list") {
    for (const fn of transform.functions) {
      if (fn.kind === "translate") {
        context.translate(
          fn.x.unit === "%" ? (fn.x.value / 100) * box.width : fn.x.value,
          fn.y.unit === "%" ? (fn.y.value / 100) * box.height : fn.y.value,
        );
      } else if (fn.kind === "scale") {
        context.scale(fn.x, fn.y);
      } else {
        context.rotate((fn.degrees * Math.PI) / 180);
      }
    }
  }

  context.translate(-origin.x, -origin.y);
}

export type ParsedLinearGradient = {
  /** CSS angle in degrees: 0 = to top, 90 = to right, 180 = to bottom. */
  angleDeg: number;
  stops: Array<{ color: string; offset: number }>;
};

/**
 * Parses `linear-gradient(...)` with any number of stops. The direction is a
 * `<deg>` angle or a `to <side>` keyword (default 180deg = to bottom). Stop
 * positions are `%` and may be omitted; omitted positions distribute evenly
 * between their neighbors, like CSS. Returns null for non-gradient values.
 */
export function parseLinearGradient(
  value: string,
): ParsedLinearGradient | null {
  const parsed = parseLinearGradientValue(value);
  return parsed
    ? {
        angleDeg: parsed.angleDeg,
        stops: resolveGradientStopOffsets(parsed.stops),
      }
    : null;
}

export type ParsedRadialGradient = {
  centerX: number;
  centerY: number;
  stops: Array<{ color: string; offset: number }>;
};

export function parseRadialGradient(
  value: string,
): ParsedRadialGradient | null {
  const parsed = parseRadialGradientValue(value);
  return parsed
    ? {
        centerX: parsed.centerX,
        centerY: parsed.centerY,
        stops: resolveGradientStopOffsets(parsed.stops),
      }
    : null;
}

export type ParsedConicGradient = {
  angleDeg: number;
  centerX: number;
  centerY: number;
  stops: Array<{ color: string; offset: number }>;
};

export function parseConicGradient(value: string): ParsedConicGradient | null {
  const parsed = parseConicGradientValue(value);
  return parsed
    ? {
        angleDeg: parsed.angleDeg,
        centerX: parsed.centerX,
        centerY: parsed.centerY,
        stops: resolveGradientStopOffsets(parsed.stops),
      }
    : null;
}

function parseFill(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  value: string,
): string | CanvasGradient {
  const parsed = parseLinearGradient(value);

  if (!parsed) {
    const radial = parseRadialGradient(value);
    if (radial) {
      const centerX = box.x + box.width * radial.centerX;
      const centerY = box.y + box.height * radial.centerY;
      const radius = Math.max(
        Math.hypot(centerX - box.x, centerY - box.y),
        Math.hypot(centerX - (box.x + box.width), centerY - box.y),
        Math.hypot(centerX - box.x, centerY - (box.y + box.height)),
        Math.hypot(
          centerX - (box.x + box.width),
          centerY - (box.y + box.height),
        ),
      );
      const gradient = context.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius,
      );
      radial.stops.forEach((stop) =>
        gradient.addColorStop(stop.offset, stop.color),
      );
      return gradient;
    }

    const conic = parseConicGradient(value);
    if (conic) {
      if (!("createConicGradient" in context)) {
        throw new Error(
          "Conic gradients need CanvasRenderingContext2D.createConicGradient().",
        );
      }
      const gradient = context.createConicGradient(
        ((conic.angleDeg - 90) * Math.PI) / 180,
        box.x + box.width * conic.centerX,
        box.y + box.height * conic.centerY,
      );
      conic.stops.forEach((stop) =>
        gradient.addColorStop(stop.offset, stop.color),
      );
      return gradient;
    }

    return value;
  }

  // CSS gradient line: passes through the box center; its length is the
  // projection of the box onto the gradient direction.
  const radians = (parsed.angleDeg * Math.PI) / 180;
  const dirX = Math.sin(radians);
  const dirY = -Math.cos(radians); // canvas y grows downward
  const length =
    Math.abs(box.width * Math.sin(radians)) +
    Math.abs(box.height * Math.cos(radians));
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const gradient = context.createLinearGradient(
    centerX - (dirX * length) / 2,
    centerY - (dirY * length) / 2,
    centerX + (dirX * length) / 2,
    centerY + (dirY * length) / 2,
  );

  for (const stop of parsed.stops) {
    gradient.addColorStop(stop.offset, stop.color);
  }

  return gradient;
}

function parseTextShadow(
  value: string | undefined,
): { x: number; y: number; blur: number; color: string } | null {
  const shadow = value ? parseShadowValue(value) : null;
  return shadow
    ? {
        x: shadow.offsetX,
        y: shadow.offsetY,
        blur: shadow.blur,
        color: shadow.color.source,
      }
    : null;
}

export function parseTextStroke(
  value: string | undefined,
  fontSize = 24,
): { width: number; color: string } | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^(\S+)\s+(.+)$/);

  if (!match) {
    return null;
  }

  const width = readLength(match[1], fontSize, Number.NaN);

  if (!Number.isFinite(width) || width <= 0) {
    return null;
  }

  return {
    width,
    color: match[2]?.trim() || "#000000",
  };
}

export type TextBackground = {
  color: string;
  paddingX: number;
  paddingY: number;
  radius: number;
};

export function parseTextBackground(
  style: SceneStyle,
  fontSize = 24,
): TextBackground | null {
  if (!style.textBackgroundColor) {
    return null;
  }

  const padding = readLength(style.textBackgroundPadding, fontSize, 0);
  const paddingX = readLength(style.textBackgroundPaddingX, fontSize, padding);
  const paddingY = readLength(style.textBackgroundPaddingY, fontSize, padding);
  const radius = readLength(style.textBackgroundRadius, fontSize, 0);

  return {
    color: style.textBackgroundColor,
    paddingX: Math.max(0, paddingX),
    paddingY: Math.max(0, paddingY),
    radius: Math.max(0, radius),
  };
}

function drawTextBackground(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  background: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    color: string;
  },
): void {
  context.save();
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.fillStyle = background.color;

  if (background.radius > 0) {
    roundedRect(
      context,
      background.x,
      background.y,
      background.width,
      background.height,
      background.radius,
    );
    context.fill();
  } else {
    context.fillRect(
      background.x,
      background.y,
      background.width,
      background.height,
    );
  }

  context.restore();
}

function resolveCornerRadii(
  style: SceneStyle,
  box: Pick<LayoutBox, "width" | "height">,
): CornerRadii {
  return resolveLayoutCornerRadii(style, box);
}

function insetCornerRadii(radii: CornerRadii, inset: number): CornerRadii {
  return {
    topLeft: Math.max(0, radii.topLeft - inset),
    topRight: Math.max(0, radii.topRight - inset),
    bottomRight: Math.max(0, radii.bottomRight - inset),
    bottomLeft: Math.max(0, radii.bottomLeft - inset),
  };
}

function normalizeCornerRadii(
  radius: number | CornerRadii,
  width: number,
  height: number,
): CornerRadii {
  return normalizeLayoutCornerRadii(radius, width, height);
}

function hasCornerRadius(radii: CornerRadii): boolean {
  return (
    radii.topLeft > 0 ||
    radii.topRight > 0 ||
    radii.bottomRight > 0 ||
    radii.bottomLeft > 0
  );
}

function roundedRect(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | CornerRadii,
): void {
  const radii = normalizeCornerRadii(radius, width, height);
  if (
    radii.topLeft === radii.topRight &&
    radii.topLeft === radii.bottomRight &&
    radii.topLeft === radii.bottomLeft
  ) {
    const uniform = radii.topLeft;
    context.beginPath();
    context.moveTo(x + uniform, y);
    context.arcTo(x + width, y, x + width, y + height, uniform);
    context.arcTo(x + width, y + height, x, y + height, uniform);
    context.arcTo(x, y + height, x, y, uniform);
    context.arcTo(x, y, x + width, y, uniform);
    context.closePath();
    return;
  }
  context.beginPath();
  context.moveTo(x + radii.topLeft, y);
  context.lineTo(x + width - radii.topRight, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radii.topRight);
  context.lineTo(x + width, y + height - radii.bottomRight);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radii.bottomRight,
    y + height,
  );
  context.lineTo(x + radii.bottomLeft, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radii.bottomLeft);
  context.lineTo(x, y + radii.topLeft);
  context.quadraticCurveTo(x, y, x + radii.topLeft, y);
  context.closePath();
}

function readLength(
  value: string | number | undefined,
  parent: number,
  fallback: number,
): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  if (value.endsWith("%")) {
    return (Number.parseFloat(value) / 100) * parent;
  }

  if (value.endsWith("px")) {
    return Number.parseFloat(value);
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
