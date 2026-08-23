import {
  prepareFrame,
  renderStill,
  resolveAssets,
  type AudioClip,
  type ResolvedAssets,
  type ResolveAssetsOptions,
  type TextMeasureCache,
} from "@motionforge/renderer-canvas2d";
import { evaluateKeyframes, type ResolvedScene } from "@motionforge/core";
import type {
  Scene,
  SceneAudioBus,
  SceneNode,
  VolumeEnvelope,
} from "@motionforge/schema";
import {
  AudioSample,
  AudioSampleSource,
  BufferTarget,
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  type AudioCodec,
  type Quality,
  type VideoCodec,
} from "mediabunny";

export type ExportCapability = {
  webCodecs: boolean;
  videoEncoder: boolean;
  offscreenCanvas: boolean;
};

export type ExportVideoOptions = {
  scene: Scene;
  signal?: AbortSignal;
  onProgress?: (progress: RenderFrameSequenceProgress) => void;
  /**
   * Minimum milliseconds between progress callbacks. The final frame always
   * reports. Defaults to per-frame progress for backwards compatibility.
   */
  progressIntervalMs?: number;
  /** First scene frame to export (default 0). */
  startFrame?: number;
  /** Last scene frame to export, inclusive (default scene.duration - 1). */
  endFrame?: number;
  /**
   * Target bitrate in bits per second, or a mediabunny Quality preset.
   * Defaults to QUALITY_HIGH.
   */
  bitrate?: number | Quality;
  /**
   * Candidate codecs in order of preference. Defaults to every codec the MP4
   * container supports; the first one this browser can encode is used.
   */
  codecs?: VideoCodec[];
  /**
   * Pre-resolved assets. When omitted, exportVideo calls resolveAssets(scene)
   * itself before the frame loop.
   */
  assets?: ResolvedAssets;
  /** Trusted extension definitions used when resolving extension nodes. */
  extensions?: ResolveAssetsOptions["extensions"];
  /** Require every extension definition to support worker execution. */
  worker?: boolean;
  /** Final export uses original sources by default; opt in for draft proxy export. */
  preferProxy?: boolean;
  budget?: ResolveAssetsOptions["budget"];
  /**
   * Audio is mixed and fed to the encoder in windows of this many seconds
   * (default 10), so audio memory stays flat regardless of scene length.
   * Exposed mainly for tests; the default is fine.
   */
  audioChunkSeconds?: number;
};

export type ExportVideoResult = {
  blob: Blob;
  codec: VideoCodec;
  /** Audio codec of the mixed track, or null when the scene has no audio. */
  audioCodec: AudioCodec | null;
  totalFrames: number;
};

/** An audible node's absolute active window in scene frames, ancestors applied. */
export type AudioPlacement = {
  node: SceneNode;
  /** First scene frame the node is audible (inclusive). */
  startFrame: number;
  /** Scene frame the node stops being audible (exclusive). */
  endFrame: number;
  /**
   * Frames between the node's own start and the audible window's start
   * (nonzero when an ancestor window clips the node's head). Needed to map
   * the window back to source time for video nodes, whose source clock runs
   * from the node's start, not the window's.
   */
  framesIntoNode: number;
};

/**
 * Walks the scene tree and returns every audible node — audio nodes and
 * video nodes (whose clips may carry their own soundtrack) — with its
 * absolute active window, mirroring the evaluator's timing semantics
 * (parent-relative `from`, duration defaulting to the parent's, clipped by
 * ancestor windows).
 */
export function collectAudioPlacements(scene: Scene): AudioPlacement[] {
  const placements: AudioPlacement[] = [];

  const visit = (
    nodes: SceneNode[],
    origin: number,
    windowStart: number,
    windowEnd: number,
    parentDuration: number,
  ): void => {
    for (const node of nodes) {
      const from = node.from ?? 0;
      const duration = node.duration ?? parentDuration;
      const start = origin + from;
      const activeStart = Math.max(windowStart, start);
      const activeEnd = Math.min(windowEnd, start + duration);

      if (activeStart >= activeEnd) {
        continue;
      }

      if (node.type === "audio" || node.type === "video") {
        placements.push({
          node,
          startFrame: activeStart,
          endFrame: activeEnd,
          framesIntoNode: activeStart - start,
        });
      }

      visit(node.children ?? [], start, activeStart, activeEnd, duration);
    }
  };

  visit(scene.nodes, 0, 0, scene.duration, scene.duration);
  return placements;
}

/** Source PCM positioned on the output timeline, ready for mixing. */
export type AudioSegment = {
  /** One Float32Array per source channel. */
  channels: Float32Array[];
  sampleRate: number;
  /** Seconds from the start of the mix where this segment begins. */
  startTime: number;
  /** Gain 0..1. */
  volume: number;
  /** Optional node-local gain curve multiplied by volume. */
  volumeEnvelope?: VolumeEnvelope;
  /** Node-local seconds at segment start, used when sampling volumeEnvelope. */
  envelopeStartTime?: number;
  /** Scene fps for frame-based volumeEnvelope sampling. */
  envelopeFps?: number;
  /** Stereo balance from -1 (left) to 1 (right). */
  pan?: number;
  /** Named mix bus; default master. */
  bus?: string;
};

/**
 * Mixes segments into output PCM (one Float32Array per channel) using linear
 * resampling. Mono segments fan out to every output channel; overlapping
 * segments sum and the final mix clamps to [-1, 1]. Pure and deterministic.
 */
export function mixAudioSegments(
  segments: AudioSegment[],
  durationSeconds: number,
  sampleRate = 48_000,
  channelCount = 2,
  clampOutput = true,
): Float32Array<ArrayBuffer>[] {
  const length = Math.max(1, Math.round(durationSeconds * sampleRate));
  const output = Array.from(
    { length: channelCount },
    () => new Float32Array(length),
  );

  for (const segment of segments) {
    const sourceLength = segment.channels[0]?.length ?? 0;

    if (sourceLength === 0 || segment.channels.length === 0) {
      continue;
    }

    const startIndex = Math.round(segment.startTime * sampleRate);
    const outSamples = Math.ceil(
      (sourceLength / segment.sampleRate) * sampleRate,
    );
    // Precomputed once per segment (not per channel, not per sample):
    // keyframe evaluation per output sample dominated the whole mix.
    const gains = segmentEnvelopeGains(segment, outSamples, sampleRate);

    for (let channel = 0; channel < channelCount; channel += 1) {
      const target = output[channel];
      const source =
        segment.channels[Math.min(channel, segment.channels.length - 1)];

      if (!target || !source) {
        continue;
      }

      for (let index = 0; index < outSamples; index += 1) {
        const outIndex = startIndex + index;

        if (outIndex < 0 || outIndex >= length) {
          continue;
        }

        const sourcePosition = (index / sampleRate) * segment.sampleRate;
        const lower = Math.floor(sourcePosition);
        const upper = Math.min(sourceLength - 1, lower + 1);
        const t = sourcePosition - lower;
        const lowerValue = source[lower] ?? 0;
        const upperValue = source[upper] ?? 0;
        target[outIndex] =
          (target[outIndex] ?? 0) +
          (lowerValue + (upperValue - lowerValue) * t) *
            segment.volume *
            (gains ? (gains[index] ?? 1) : 1) *
            panGain(segment.pan ?? 0, channel, channelCount);
      }
    }
  }

  if (clampOutput) {
    for (const channel of output) {
      for (let index = 0; index < channel.length; index += 1) {
        channel[index] = Math.min(1, Math.max(-1, channel[index] ?? 0));
      }
    }
  }

  return output;
}

function panGain(pan: number, channel: number, channelCount: number): number {
  if (channelCount !== 2) return 1;
  const bounded = Math.min(1, Math.max(-1, pan));
  return channel === 0
    ? bounded > 0
      ? 1 - bounded
      : 1
    : bounded < 0
      ? 1 + bounded
      : 1;
}

export function evaluateVolumeEnvelope(
  envelope: VolumeEnvelope | undefined,
  frame: number,
): number {
  const value = evaluateKeyframes(envelope ?? [], frame);
  return typeof value === "number" ? value : 1;
}

/**
 * Envelope gains are evaluated at block edges and interpolated within the
 * block (~2.7 ms at 48 kHz) instead of per sample. Linear ramps stay exact;
 * eased ramps deviate by less than the easing curvature across 128 samples,
 * far below audibility for volume automation.
 */
const ENVELOPE_BLOCK_SAMPLES = 128;

/**
 * Per-output-sample envelope gains for a segment, or null when the segment
 * has no envelope. Edges are sampled at the first and last sample of each
 * block so envelopes that clamp at their final keyframe inside a block keep
 * their exact endpoint values.
 */
function segmentEnvelopeGains(
  segment: AudioSegment,
  outSamples: number,
  sampleRate: number,
): Float32Array | null {
  const envelope = segment.volumeEnvelope;
  const fps = segment.envelopeFps;

  if (!envelope || !fps || outSamples <= 0) {
    return null;
  }

  const startTime = segment.envelopeStartTime ?? 0;
  const gains = new Float32Array(outSamples);

  for (let block = 0; block < outSamples; block += ENVELOPE_BLOCK_SAMPLES) {
    const end = Math.min(outSamples, block + ENVELOPE_BLOCK_SAMPLES);
    const first = evaluateVolumeEnvelope(
      envelope,
      (startTime + block / sampleRate) * fps,
    );
    const last = evaluateVolumeEnvelope(
      envelope,
      (startTime + (end - 1) / sampleRate) * fps,
    );
    const span = end - 1 - block;

    for (let index = block; index < end; index += 1) {
      gains[index] =
        span === 0 ? first : first + ((last - first) * (index - block)) / span;
    }
  }

  return gains;
}

export type RenderFrameSequenceProgress = {
  frame: number;
  frameIndex: number;
  totalFrames: number;
  timestampUs: number;
  sceneTimestampUs: number;
};

export type RenderedSequenceFrame = {
  frame: number;
  frameIndex: number;
  timestampUs: number;
  sceneTimestampUs: number;
};

export type RenderFrameSequenceOptions = {
  scene: Scene;
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  startFrame?: number;
  endFrame?: number;
  signal?: AbortSignal;
  /** Resolved assets forwarded to the default renderStill renderer. */
  assets?: ResolvedAssets;
  renderFrame?: (
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    scene: Scene,
    frame: number,
    resolvedScene?: ResolvedScene,
    textMeasureCache?: TextMeasureCache,
  ) => void;
  onFrame?: (frame: RenderedSequenceFrame) => void | Promise<void>;
  onProgress?: (progress: RenderFrameSequenceProgress) => void;
  /**
   * Minimum milliseconds between progress callbacks. Defaults to 0 so callers
   * that need per-frame progress keep the historical behavior.
   */
  progressIntervalMs?: number;
};

export type RenderFrameSequenceResult = {
  startFrame: number;
  endFrame: number;
  totalFrames: number;
  renderedFrames: number;
};

export function detectExportCapability(
  globalObject: Partial<typeof globalThis> = globalThis,
): ExportCapability {
  return {
    webCodecs: "VideoFrame" in globalObject,
    videoEncoder: "VideoEncoder" in globalObject,
    offscreenCanvas: "OffscreenCanvas" in globalObject,
  };
}

export async function renderFrameSequence(
  options: RenderFrameSequenceOptions,
): Promise<RenderFrameSequenceResult> {
  const startFrame = options.startFrame ?? 0;
  const endFrame = options.endFrame ?? options.scene.duration - 1;

  validateFrameRange(options.scene, startFrame, endFrame);
  throwIfAborted(options.signal);

  const totalFrames = endFrame - startFrame + 1;
  const renderFrame =
    options.renderFrame ??
    ((
      context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      scene: Scene,
      frame: number,
      resolvedScene?: ResolvedScene,
      textMeasureCache?: TextMeasureCache,
    ) =>
      renderStill(context, scene, frame, {
        assets: options.assets,
        resolvedScene,
        textMeasureCache,
      }));
  let renderedFrames = 0;
  let lastProgressAt = 0;
  const textMeasureCache: TextMeasureCache = new Map();

  for (let frame = startFrame; frame <= endFrame; frame += 1) {
    throwIfAborted(options.signal);

    let resolvedScene: ResolvedScene | undefined;

    if (options.assets) {
      // Stages decoded video frames for this scene frame; no-op for scenes
      // without video assets.
      resolvedScene = await prepareFrame(options.scene, frame, options.assets);
    }

    renderFrame(
      options.context,
      options.scene,
      frame,
      resolvedScene,
      textMeasureCache,
    );

    const rendered: RenderedSequenceFrame = {
      frame,
      frameIndex: frame - startFrame,
      timestampUs: frameToTimestampUs(frame - startFrame, options.scene.fps),
      sceneTimestampUs: frameToTimestampUs(frame, options.scene.fps),
    };

    await options.onFrame?.(rendered);

    renderedFrames += 1;
    if (options.onProgress) {
      const progress = {
        ...rendered,
        totalFrames,
      };
      const progressIntervalMs = options.progressIntervalMs ?? 0;
      const now = performance.now();
      const isFinalFrame = frame === endFrame;

      if (
        progressIntervalMs <= 0 ||
        isFinalFrame ||
        now - lastProgressAt >= progressIntervalMs
      ) {
        lastProgressAt = now;
        options.onProgress(progress);
      }
    }
  }

  return {
    startFrame,
    endFrame,
    totalFrames,
    renderedFrames,
  };
}

/**
 * Renders the scene frame by frame through the shared Canvas2D renderer and
 * encodes it to an MP4 in the browser via WebCodecs (encoding and muxing by
 * mediabunny). Resolves with the finished file as a Blob.
 */
export async function exportVideo(
  options: ExportVideoOptions,
): Promise<ExportVideoResult> {
  const { scene } = options;
  const capability = detectExportCapability();

  if (!capability.videoEncoder) {
    throw new Error(
      "exportVideo() needs WebCodecs (VideoEncoder) which this environment does not provide. Gate export UI with detectExportCapability().",
    );
  }

  const format = new Mp4OutputFormat();
  const codec = await getFirstEncodableVideoCodec(
    options.codecs ?? format.getSupportedVideoCodecs(),
    { width: scene.width, height: scene.height },
  );

  if (!codec) {
    throw new Error(
      `This browser cannot encode any MP4-compatible video codec at ${scene.width}x${scene.height}. Try a smaller scene size or a browser with WebCodecs encoding support.`,
    );
  }

  const assets =
    options.assets ??
    (await resolveAssets(scene, {
      extensions: options.extensions,
      worker: options.worker,
      signal: options.signal,
      preferProxy: options.preferProxy ?? false,
      budget: options.budget,
    }));
  const { canvas, context } = createExportCanvas(scene.width, scene.height);
  const output = new Output({ format, target: new BufferTarget() });
  const source = new CanvasSource(canvas, {
    codec,
    bitrate: options.bitrate ?? QUALITY_HIGH,
  });
  output.addVideoTrack(source, { frameRate: scene.fps });

  // Tracks can only be added while the output is pending, so probe for
  // audible content up front (no decoding); the actual mix happens in
  // chunks after the frame loop so audio memory stays flat.
  const startFrame = options.startFrame ?? 0;
  const endFrame = options.endFrame ?? scene.duration - 1;
  const hasAudio = sceneHasAudibleContent(scene, assets, startFrame, endFrame);
  let audioSource: AudioSampleSource | null = null;
  let audioCodec: AudioCodec | null = null;

  if (hasAudio) {
    audioCodec = await getFirstEncodableAudioCodec(
      format.getSupportedAudioCodecs(),
      {
        numberOfChannels: MIX_CHANNELS,
        sampleRate: MIX_SAMPLE_RATE,
      },
    );

    if (!audioCodec) {
      throw new Error(
        "The scene has audio nodes but this browser cannot encode any MP4-compatible audio codec.",
      );
    }

    // AudioSampleSource over AudioBufferSource: samples are built from raw
    // Float32Arrays, so the whole export runs in workers, where AudioBuffer
    // does not exist.
    audioSource = new AudioSampleSource({
      codec: audioCodec,
      bitrate: QUALITY_HIGH,
    });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  const frameDuration = 1 / scene.fps;
  let result: RenderFrameSequenceResult;

  try {
    result = await renderFrameSequence({
      scene,
      context,
      assets,
      startFrame: options.startFrame,
      endFrame: options.endFrame,
      signal: options.signal,
      // Awaiting add() respects encoder backpressure before the next frame
      // is drawn over the shared canvas.
      onFrame: async ({ timestampUs }) => {
        await source.add(timestampUs / 1_000_000, frameDuration);
      },
      onProgress: options.onProgress,
      progressIntervalMs: options.progressIntervalMs,
    });

    if (audioSource) {
      // Sequential appends: every chunk must be added, so silent windows
      // become explicit silence rather than skipped (skipping would shift
      // everything after them earlier).
      const ranges = audioChunkRanges(
        startFrame,
        endFrame,
        scene.fps,
        options.audioChunkSeconds ?? 10,
      );

      for (const [chunkStart, chunkEnd] of ranges) {
        const mixed = await mixSceneAudioData(
          scene,
          assets,
          chunkStart,
          chunkEnd,
        );
        const sampleCount = Math.max(
          1,
          Math.round(
            ((chunkEnd - chunkStart + 1) / scene.fps) * MIX_SAMPLE_RATE,
          ),
        );
        // Planar f32 layout: all of channel 0, then all of channel 1. An
        // absent mix leaves the zero-filled buffer — explicit silence.
        const data = new Float32Array(sampleCount * MIX_CHANNELS);

        if (mixed) {
          mixed.channels.forEach((channel, index) => {
            data.set(channel.subarray(0, sampleCount), index * sampleCount);
          });
        }

        const sample = new AudioSample({
          data,
          format: "f32-planar",
          numberOfChannels: MIX_CHANNELS,
          sampleRate: MIX_SAMPLE_RATE,
          timestamp: (chunkStart - startFrame) / scene.fps,
        });
        await audioSource.add(sample);
        sample.close();
      }
    }

    await output.finalize();
  } catch (error) {
    try {
      await output.cancel();
    } catch {
      // The render/encode error is the one worth surfacing.
    }

    throw error;
  }

  const buffer = output.target.buffer;

  if (!buffer) {
    throw new Error("MP4 muxing finished without producing an output buffer.");
  }

  return {
    blob: new Blob([buffer], { type: format.mimeType }),
    codec,
    audioCodec,
    totalFrames: result.totalFrames,
  };
}

const MIX_SAMPLE_RATE = 48_000;
const MIX_CHANNELS = 2;

/**
 * Splits an inclusive frame range into consecutive inclusive chunks of at
 * most `chunkSeconds`. Pure; exported for tests. Chunks cover the full range
 * with no overlap and no gaps.
 */
export function audioChunkRanges(
  startFrame: number,
  endFrame: number,
  fps: number,
  chunkSeconds: number,
): Array<[number, number]> {
  const chunkFrames = Math.max(1, Math.round(chunkSeconds * fps));
  const ranges: Array<[number, number]> = [];

  for (let from = startFrame; from <= endFrame; from += chunkFrames) {
    ranges.push([from, Math.min(endFrame, from + chunkFrames - 1)]);
  }

  return ranges;
}

/**
 * Whether any node would contribute sound to the range — the same walk the
 * mixer does, minus decoding. Decides up front if the MP4 gets an audio
 * track (tracks can only be added before output.start()).
 */
function sceneHasAudibleContent(
  scene: Scene,
  assets: ResolvedAssets,
  startFrame: number,
  endFrame: number,
): boolean {
  for (const placement of collectAudioPlacements(scene)) {
    const assetId = placement.node.assetId ?? "";
    const isVideo = placement.node.type === "video";
    const clip = isVideo
      ? assets.videos.get(assetId)?.audio
      : assets.audio.get(assetId);

    if (!clip) {
      continue; // silent video clip, or missing asset surfaced later
    }

    const audibleStart = Math.max(placement.startFrame, startFrame);
    const audibleEnd = Math.min(placement.endFrame, endFrame + 1);

    if (audibleStart >= audibleEnd) {
      continue;
    }

    const rate = isVideo ? (placement.node.playbackRate ?? 1) : 1;
    const nodeTrim = isVideo
      ? (placement.node.videoStartTime ?? 0)
      : (placement.node.audioStartTime ?? 0);
    const framesIntoSource =
      placement.framesIntoNode + (audibleStart - placement.startFrame);
    const loopsAudio = placement.node.type === "audio" && placement.node.loop;
    const trimOffset = nodeTrim + (framesIntoSource / scene.fps) * rate;

    if (loopsAudio) {
      if (clip.duration > 0) {
        return true;
      }
    } else if (trimOffset < clip.duration) {
      return true;
    }
  }

  return false;
}

/** Mixed PCM for a frame range: one Float32Array per output channel. */
export type MixedAudioData = {
  channels: Float32Array<ArrayBuffer>[];
  sampleRate: number;
};

/**
 * Decodes and mixes every audible node (audio nodes and video-node
 * soundtracks) into raw per-channel PCM covering the frame range, or null
 * when the range has nothing audible. Environment-free (no AudioBuffer), so
 * it runs identically on the main thread and in workers; the export encodes
 * this directly and the player preview wraps it via mixSceneAudio().
 */
export async function mixSceneAudioData(
  scene: Scene,
  assets: ResolvedAssets,
  startFrame: number,
  endFrame: number,
): Promise<MixedAudioData | null> {
  const placements = collectAudioPlacements(scene);

  if (placements.length === 0) {
    return null;
  }

  const segments: AudioSegment[] = [];

  for (const placement of placements) {
    const assetId = placement.node.assetId ?? "";
    const isVideo = placement.node.type === "video";
    const clip = isVideo
      ? assets.videos.get(assetId)?.audio
      : assets.audio.get(assetId);

    if (!clip) {
      if (isVideo) {
        // Silent video clips are normal.
        if (assets.videos.has(assetId)) {
          continue;
        }
      }

      throw new Error(
        `${isVideo ? "Video" : "Audio"} node "${placement.node.id}" references asset "${assetId}" which is not in the resolved assets. Call resolveAssets(scene) first.`,
      );
    }

    // Video clips retime sound with playbackRate: the source range stretches
    // by the rate, and declaring the segment at rate × sampleRate makes the
    // mixer's resampler play it back in window time (pitch shifts, like a
    // varispeed deck — no time-stretch).
    const rate = isVideo ? (placement.node.playbackRate ?? 1) : 1;

    // Intersect the node's audible window with the export range.
    const audibleStart = Math.max(placement.startFrame, startFrame);
    const audibleEnd = Math.min(placement.endFrame, endFrame + 1);

    if (audibleStart >= audibleEnd) {
      continue;
    }

    const nodeTrim = isVideo
      ? (placement.node.videoStartTime ?? 0)
      : (placement.node.audioStartTime ?? 0);
    const framesIntoSource =
      placement.framesIntoNode + (audibleStart - placement.startFrame);
    const windowSeconds = (audibleEnd - audibleStart) / scene.fps;
    const trimOffset = nodeTrim + (framesIntoSource / scene.fps) * rate;
    const sourceRanges = loopedSourceRanges({
      start: trimOffset,
      duration: windowSeconds * rate,
      sourceDuration: clip.duration,
      loop: placement.node.type === "audio" && placement.node.loop === true,
    });

    if (sourceRanges.length === 0) {
      // Trimmed past the end of the clip: silence, not an error.
      continue;
    }

    for (const range of sourceRanges) {
      segments.push({
        channels: await decodeAudioRange(
          clip,
          range.sourceStart,
          range.sourceEnd,
        ),
        sampleRate: clip.sampleRate * rate,
        startTime:
          (audibleStart - startFrame) / scene.fps + range.outputOffset / rate,
        volume: placement.node.volume ?? 1,
        volumeEnvelope: placement.node.volumeEnvelope,
        envelopeStartTime:
          framesIntoSource / scene.fps + range.outputOffset / rate,
        envelopeFps: scene.fps,
        pan: placement.node.pan,
        bus: placement.node.audioBus ?? "master",
      });
    }
  }

  if (segments.length === 0) {
    return null;
  }

  const durationSeconds = (endFrame - startFrame + 1) / scene.fps;
  const byBus = new Map<string, AudioSegment[]>();
  segments.forEach((segment) => {
    const bus = segment.bus ?? "master";
    const group = byBus.get(bus);
    if (group) group.push(segment);
    else byBus.set(bus, [segment]);
  });
  const busMixes = new Map<string, Float32Array<ArrayBuffer>[]>();
  for (const [name, busSegments] of byBus) {
    const channels = mixAudioSegments(
      busSegments,
      durationSeconds,
      MIX_SAMPLE_RATE,
      MIX_CHANNELS,
      false,
    );
    if (name !== "master") {
      applyBusGainAndPan(channels, scene.audioBuses?.[name]);
    }
    if (name !== "master" && scene.audioBuses?.[name]?.limiter) {
      limitAudioPeak(channels, scene.audioBuses[name]?.limiterCeiling ?? 0.98);
    }
    busMixes.set(name, channels);
  }

  const duckingWindows = placements.flatMap((placement) =>
    placement.node.ducks
      ? [
          {
            ...placement.node.ducks,
            startFrame: placement.startFrame,
            endFrame: placement.endFrame,
          },
        ]
      : [],
  );
  for (const [name, channels] of busMixes) {
    applyDucking(
      channels,
      duckingWindows.filter((window) => window.bus === name),
      startFrame,
      scene.fps,
      MIX_SAMPLE_RATE,
    );
  }

  const length = Math.max(1, Math.round(durationSeconds * MIX_SAMPLE_RATE));
  const mixed = Array.from(
    { length: MIX_CHANNELS },
    () => new Float32Array(length),
  );
  for (const channels of busMixes.values()) {
    channels.forEach((channel, channelIndex) => {
      const target = mixed[channelIndex];
      if (!target) return;
      for (let index = 0; index < target.length; index += 1) {
        target[index] = (target[index] ?? 0) + (channel[index] ?? 0);
      }
    });
  }
  applyBusGainAndPan(mixed, scene.audioBuses?.master);
  limitAudioPeak(mixed, scene.audioBuses?.master?.limiterCeiling ?? 0.98);

  if (length === 0) {
    return null;
  }

  return { channels: mixed, sampleRate: MIX_SAMPLE_RATE };
}

type DuckingWindow = {
  bus: string;
  gain: number;
  attackFrames?: number;
  releaseFrames?: number;
  startFrame: number;
  endFrame: number;
};

function applyBusGainAndPan(
  channels: Float32Array[],
  bus: SceneAudioBus | undefined,
): void {
  const gain = bus?.gain ?? 1;
  const pan = bus?.pan ?? 0;
  channels.forEach((channel, channelIndex) => {
    const balance = panGain(pan, channelIndex, channels.length);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = (channel[index] ?? 0) * gain * balance;
    }
  });
}

function applyDucking(
  channels: Float32Array[],
  windows: DuckingWindow[],
  mixStartFrame: number,
  fps: number,
  sampleRate: number,
): void {
  if (windows.length === 0) return;
  const length = channels[0]?.length ?? 0;
  for (let index = 0; index < length; index += 1) {
    const frame = mixStartFrame + (index / sampleRate) * fps;
    let gain = 1;
    for (const window of windows) {
      const attack = window.attackFrames ?? Math.round(fps * 0.08);
      const release = window.releaseFrames ?? Math.round(fps * 0.18);
      let candidate = 1;
      if (frame >= window.startFrame && frame < window.endFrame) {
        const progress =
          attack === 0 ? 1 : Math.min(1, (frame - window.startFrame) / attack);
        candidate = 1 + (window.gain - 1) * progress;
      } else if (
        frame >= window.endFrame &&
        frame < window.endFrame + release
      ) {
        const progress =
          release === 0 ? 1 : (frame - window.endFrame) / release;
        candidate = window.gain + (1 - window.gain) * progress;
      }
      gain = Math.min(gain, candidate);
    }
    if (gain < 1) {
      channels.forEach((channel) => {
        channel[index] = (channel[index] ?? 0) * gain;
      });
    }
  }
}

export function limitAudioPeak(
  channels: Float32Array[],
  ceiling = 0.98,
): { peakBefore: number; gain: number } {
  let peakBefore = 0;
  channels.forEach((channel) =>
    channel.forEach((sample) => {
      peakBefore = Math.max(peakBefore, Math.abs(sample));
    }),
  );
  const gain = peakBefore > ceiling ? ceiling / peakBefore : 1;
  channels.forEach((channel) => {
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.min(
        ceiling,
        Math.max(-ceiling, (channel[index] ?? 0) * gain),
      );
    }
  });
  return { peakBefore, gain };
}

export function measureAudioLoudness(channels: Float32Array[]): {
  peak: number;
  rms: number;
  dbfs: number;
} {
  let peak = 0;
  let sumSquares = 0;
  let count = 0;
  channels.forEach((channel) =>
    channel.forEach((sample) => {
      peak = Math.max(peak, Math.abs(sample));
      sumSquares += sample * sample;
      count += 1;
    }),
  );
  const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
  return {
    peak,
    rms,
    dbfs: rms > 0 ? 20 * Math.log10(rms) : Number.NEGATIVE_INFINITY,
  };
}

/**
 * mixSceneAudioData() packaged as a Web Audio AudioBuffer for playback.
 * DOM/AudioContext environments only — workers must use mixSceneAudioData().
 */
export async function mixSceneAudio(
  scene: Scene,
  assets: ResolvedAssets,
  startFrame: number,
  endFrame: number,
): Promise<AudioBuffer | null> {
  const mixed = await mixSceneAudioData(scene, assets, startFrame, endFrame);

  if (!mixed) {
    return null;
  }

  const buffer = new AudioBuffer({
    numberOfChannels: mixed.channels.length,
    length: mixed.channels[0]?.length ?? 1,
    sampleRate: mixed.sampleRate,
  });

  mixed.channels.forEach((data, channel) => {
    buffer.copyToChannel(data, channel);
  });

  return buffer;
}

/**
 * Decodes a source range into per-channel PCM at the clip's sample rate,
 * positioning decoded packets at exact sample offsets relative to `start`.
 */
async function decodeAudioRange(
  clip: Pick<AudioClip, "sampleRate" | "numberOfChannels" | "sink">,
  start: number,
  end: number,
): Promise<Float32Array[]> {
  const totalSamples = Math.max(1, Math.ceil((end - start) * clip.sampleRate));
  const channels = Array.from(
    { length: Math.max(1, clip.numberOfChannels) },
    () => new Float32Array(totalSamples),
  );

  for await (const wrapped of clip.sink.buffers(start, end)) {
    const offsetSamples = Math.round(
      (wrapped.timestamp - start) * clip.sampleRate,
    );

    for (let channel = 0; channel < channels.length; channel += 1) {
      const target = channels[channel];

      if (!target) {
        continue;
      }

      const data = wrapped.buffer.getChannelData(
        Math.min(channel, wrapped.buffer.numberOfChannels - 1),
      );

      for (let index = 0; index < data.length; index += 1) {
        const targetIndex = offsetSamples + index;

        if (targetIndex >= 0 && targetIndex < totalSamples) {
          target[targetIndex] = data[index] ?? 0;
        }
      }
    }
  }

  return channels;
}

export type LoopedSourceRange = {
  /** Source seconds to decode, inclusive start. */
  sourceStart: number;
  /** Source seconds to decode, exclusive end. */
  sourceEnd: number;
  /** Seconds from the audible window start where this decoded range plays. */
  outputOffset: number;
};

export function loopedSourceRanges({
  start,
  duration,
  sourceDuration,
  loop,
}: {
  start: number;
  duration: number;
  sourceDuration: number;
  loop: boolean;
}): LoopedSourceRange[] {
  if (duration <= 0 || sourceDuration <= 0) {
    return [];
  }

  if (!loop) {
    const sourceStart = start;
    const sourceEnd = Math.min(sourceDuration, start + duration);

    return sourceStart < sourceEnd
      ? [{ sourceStart, sourceEnd, outputOffset: 0 }]
      : [];
  }

  const ranges: LoopedSourceRange[] = [];
  let remaining = duration;
  let outputOffset = 0;
  let cursor = positiveModulo(start, sourceDuration);

  while (remaining > 1e-9) {
    const span = Math.min(sourceDuration - cursor, remaining);

    if (span <= 0) {
      break;
    }

    ranges.push({
      sourceStart: cursor,
      sourceEnd: cursor + span,
      outputOffset,
    });
    remaining -= span;
    outputOffset += span;
    cursor = 0;
  }

  return ranges;
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function createExportCanvas(
  width: number,
  height: number,
): {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
} {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");

    if (context) {
      return { canvas, context };
    }
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (context) {
      return { canvas, context };
    }
  }

  throw new Error(
    "exportVideo() needs a Canvas2D context via OffscreenCanvas or a DOM canvas element.",
  );
}

export function frameToTimestampUs(frame: number, fps: number): number {
  if (!Number.isInteger(frame) || frame < 0) {
    throw new Error(`Frame must be a non-negative integer, received ${frame}.`);
  }

  if (!Number.isInteger(fps) || fps <= 0) {
    throw new Error(`FPS must be a positive integer, received ${fps}.`);
  }

  return Math.round((frame * 1_000_000) / fps);
}

function validateFrameRange(
  scene: Scene,
  startFrame: number,
  endFrame: number,
): void {
  if (!Number.isInteger(startFrame) || !Number.isInteger(endFrame)) {
    throw new Error(
      `Frame range must use integer frames, received startFrame=${startFrame}, endFrame=${endFrame}.`,
    );
  }

  if (startFrame < 0) {
    throw new Error(`startFrame must be >= 0, received ${startFrame}.`);
  }

  if (endFrame < startFrame) {
    throw new Error(
      `endFrame must be >= startFrame, received startFrame=${startFrame}, endFrame=${endFrame}.`,
    );
  }

  if (endFrame >= scene.duration) {
    throw new Error(
      `endFrame must be less than scene.duration (${scene.duration}), received ${endFrame}.`,
    );
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error("Frame sequence render aborted.");
  }
}
