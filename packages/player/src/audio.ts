import { collectAudioPlacements, mixSceneAudio } from "@dojo-video-engine/export";
import type { ResolvedAssets } from "@dojo-video-engine/renderer-canvas2d";
import type { Scene } from "@dojo-video-engine/schema";

/**
 * Best-effort audio for preview playback. The export remains the audio
 * source of truth; implementations of this interface only need to play
 * scene-time-aligned sound and report their clock.
 */
export interface AudioPreview {
  /** Prepares the scene's audio. Resolves false when there is nothing audible. */
  load(
    scene: Scene,
    assets: ResolvedAssets | undefined,
    signal?: AbortSignal,
  ): Promise<boolean>;
  /** Starts playback at the given scene time in seconds. */
  start(atSeconds: number): void;
  stop(): void;
  /**
   * The audio clock's current scene-time position in seconds, or null when
   * not playing. The player treats this as the steadier reference and
   * re-anchors its frame clock to it on drift.
   */
  position(): number | null;
  dispose(): void;
}

export function previewAudioChunkRange(
  scene: Pick<Scene, "duration" | "fps">,
  atSeconds: number,
  chunkSeconds = 30,
): { chunkStart: number; startFrame: number; endFrame: number } {
  const chunkStart =
    Math.floor(Math.max(0, atSeconds) / chunkSeconds) * chunkSeconds;
  return {
    chunkStart,
    startFrame: Math.floor(chunkStart * scene.fps),
    endFrame: Math.min(
      scene.duration - 1,
      Math.ceil((chunkStart + chunkSeconds) * scene.fps) - 1,
    ),
  };
}

/**
 * Web Audio implementation: the scene's audible nodes are mixed once with
 * the exact pure mix functions the export uses (`mixSceneAudio`), cached as
 * one AudioBuffer, and played through a single AudioBufferSourceNode.
 * Seeking restarts the source at an offset — no re-mixing.
 */
export class WebAudioPreview implements AudioPreview {
  private context: AudioContext | undefined;
  private buffer: AudioBuffer | null = null;
  private adoptedBuffer = false;
  private source: AudioBufferSourceNode | null = null;
  private startedAtContextTime = 0;
  private startOffset = 0;

  constructor(private readonly createContext = () => new AudioContext()) {}

  /** True when this environment can play audio at all. */
  static supported(): boolean {
    return typeof AudioContext !== "undefined";
  }

  /**
   * Reuses a mix produced by an earlier preview (read from `mixedBuffer`),
   * so load() skips decoding and mixing entirely. Callers own cache
   * invalidation: adopt only when the scene's audible content is unchanged.
   */
  adoptMixedBuffer(buffer: AudioBuffer | null): void {
    this.buffer = buffer;
    this.adoptedBuffer = true;
  }

  /**
   * The mixed scene audio after load() (null when the scene is silent).
   * AudioBuffers are context-independent, so callers may cache this across
   * players and hand it to a new preview via adoptMixedBuffer().
   */
  get mixedBuffer(): AudioBuffer | null {
    return this.buffer;
  }

  async load(
    scene: Scene,
    assets: ResolvedAssets | undefined,
    signal?: AbortSignal,
  ): Promise<boolean> {
    if (!this.adoptedBuffer) {
      this.buffer = assets
        ? await mixSceneAudio(scene, assets, 0, scene.duration - 1, signal)
        : null;
    }

    return this.buffer !== null;
  }

  start(atSeconds: number): void {
    if (!this.buffer) {
      return;
    }

    // Created lazily inside start(), which the player calls from play() —
    // normally a user gesture, satisfying autoplay policies.
    this.context ??= this.createContext();
    void this.context.resume?.();
    this.stop();

    const offset = Math.max(0, Math.min(atSeconds, this.buffer.duration));
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.context.destination);
    source.start(0, offset);
    this.source = source;
    this.startedAtContextTime = this.context.currentTime;
    this.startOffset = offset;
  }

  stop(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // Stopping a source that already ended throws in some engines.
      }
      this.source.disconnect();
      this.source = null;
    }
  }

  position(): number | null {
    if (!this.source || !this.context) {
      return null;
    }

    return (
      this.startOffset + (this.context.currentTime - this.startedAtContextTime)
    );
  }

  dispose(): void {
    this.stop();
    void this.context?.close?.();
    this.context = undefined;
    this.buffer = null;
  }
}

/**
 * Bounded-memory preview backend. It mixes only the chunk containing the
 * current play/seek position and chains the next chunk on demand, so preview
 * memory does not grow with scene duration.
 */
export class ChunkedWebAudioPreview implements AudioPreview {
  private context: AudioContext | undefined;
  private scene: Scene | null = null;
  private assets: ResolvedAssets | undefined;
  private source: AudioBufferSourceNode | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private mixController: AbortController | null = null;
  private lastMixError: Error | null = null;
  private generation = 0;
  private startedAtContextTime = 0;
  private startOffset = 0;

  constructor(
    private readonly chunkSeconds = 30,
    private readonly createContext = () => new AudioContext(),
  ) {}

  static supported(): boolean {
    return typeof AudioContext !== "undefined";
  }

  get error(): Error | null {
    return this.lastMixError;
  }

  async load(
    scene: Scene,
    assets: ResolvedAssets | undefined,
    signal?: AbortSignal,
  ): Promise<boolean> {
    if (signal?.aborted) throw signal.reason;
    this.scene = scene;
    this.assets = assets;
    return Boolean(assets && collectAudioPlacements(scene).length > 0);
  }

  start(atSeconds: number): void {
    if (!this.scene || !this.assets) return;
    this.context ??= this.createContext();
    void this.context.resume?.();
    this.stopSource();
    const generation = ++this.generation;
    const requestedAt = this.context.currentTime;
    this.lastMixError = null;
    this.mixController = new AbortController();
    this.launchChunk(
      atSeconds,
      requestedAt,
      generation,
      this.mixController.signal,
    );
  }

  stop(): void {
    this.generation += 1;
    this.stopSource();
  }

  position(): number | null {
    if (!this.source || !this.context) return null;
    return (
      this.startOffset + (this.context.currentTime - this.startedAtContextTime)
    );
  }

  dispose(): void {
    this.stop();
    void this.context?.close?.();
    this.context = undefined;
    this.scene = null;
    this.assets = undefined;
  }

  private async startChunk(
    requestedSceneTime: number,
    requestedAtContextTime: number,
    generation: number,
    signal: AbortSignal,
  ): Promise<void> {
    const scene = this.scene;
    const assets = this.assets;
    const context = this.context;
    if (!scene || !assets || !context || generation !== this.generation) return;
    const elapsed = Math.max(0, context.currentTime - requestedAtContextTime);
    const sceneTime = Math.max(0, requestedSceneTime + elapsed);
    const sceneDuration = scene.duration / scene.fps;
    if (sceneTime >= sceneDuration) return;
    const { chunkStart, startFrame, endFrame } = previewAudioChunkRange(
      scene,
      sceneTime,
      this.chunkSeconds,
    );
    const buffer = await mixSceneAudio(
      scene,
      assets,
      startFrame,
      endFrame,
      signal,
    );
    if (generation !== this.generation || !this.context) return;
    const nowSceneTime =
      requestedSceneTime +
      Math.max(0, this.context.currentTime - requestedAtContextTime);
    if (nowSceneTime >= (endFrame + 1) / scene.fps) {
      await this.startChunk(
        nowSceneTime,
        this.context.currentTime,
        generation,
        signal,
      );
      return;
    }
    if (!buffer) {
      const nextTime = (endFrame + 1) / scene.fps;
      const delayMs = Math.max(0, (nextTime - nowSceneTime) * 1000);
      this.timer = setTimeout(() => {
        if (!this.context) return;
        this.launchChunk(
          nextTime,
          this.context.currentTime,
          generation,
          signal,
        );
      }, delayMs);
      return;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.start(0, Math.max(0, nowSceneTime - chunkStart));
    this.source = source;
    this.startedAtContextTime = this.context.currentTime;
    this.startOffset = nowSceneTime;
    source.onended = () => {
      source.disconnect();
      if (this.source === source) this.source = null;
      if (generation !== this.generation || !this.context) return;
      const nextTime = (endFrame + 1) / scene.fps;
      this.launchChunk(nextTime, this.context.currentTime, generation, signal);
    };
  }

  private launchChunk(
    sceneTime: number,
    contextTime: number,
    generation: number,
    signal: AbortSignal,
  ): void {
    void this.startChunk(sceneTime, contextTime, generation, signal).catch(
      (error: unknown) => {
        if (signal.aborted || generation !== this.generation) return;
        this.lastMixError =
          error instanceof Error ? error : new Error(String(error));
        this.stopSource();
      },
    );
  }

  private stopSource(): void {
    this.mixController?.abort(
      typeof DOMException === "function"
        ? new DOMException("Audio preview work was superseded.", "AbortError")
        : new Error("Audio preview work was superseded."),
    );
    this.mixController = null;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.source) return;
    try {
      this.source.stop();
    } catch {
      // Already ended.
    }
    this.source.disconnect();
    this.source = null;
  }
}
