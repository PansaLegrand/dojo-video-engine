import { mixSceneAudio } from "@motionforge/export";
import type { ResolvedAssets } from "@motionforge/renderer-canvas2d";
import type { Scene } from "@motionforge/schema";

/**
 * Best-effort audio for preview playback. The export remains the audio
 * source of truth; implementations of this interface only need to play
 * scene-time-aligned sound and report their clock.
 */
export interface AudioPreview {
  /** Prepares the scene's audio. Resolves false when there is nothing audible. */
  load(scene: Scene, assets: ResolvedAssets | undefined): Promise<boolean>;
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
  ): Promise<boolean> {
    if (!this.adoptedBuffer) {
      this.buffer = assets
        ? await mixSceneAudio(scene, assets, 0, scene.duration - 1)
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
