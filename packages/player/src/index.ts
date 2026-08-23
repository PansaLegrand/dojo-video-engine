import { inspectScene, parseScene, type Scene } from "@motionforge/schema";
import {
  disposeAssets,
  prepareFrame,
  renderStill,
  resolveAssets,
  type ResolvedAssets,
  type ResolveAssetsOptions,
  type TextMeasureCache,
} from "@motionforge/renderer-canvas2d";
import { WebAudioPreview, type AudioPreview } from "./audio.js";

export { WebAudioPreview, type AudioPreview } from "./audio.js";

/**
 * Maps wall-clock time to scene frames. This is the only place in the
 * playback path where wall-clock time exists: rendering stays a pure function
 * of (scene, frame). The clock is pure given injected timestamps, so playback
 * timing is unit-testable without timers.
 *
 * Frames are integers in [0, durationInFrames). While playing, the frame at
 * time `now` is anchored to the play() position: floor((now − anchorTime) /
 * 1000 × fps) + anchorFrame. Pausing re-anchors; seeking re-anchors while
 * preserving play state.
 */
export class FrameClock {
  readonly fps: number;
  readonly durationInFrames: number;
  loop: boolean;

  private anchorFrame = 0;
  private anchorTime = 0;
  private isPlaying = false;

  constructor(options: {
    fps: number;
    durationInFrames: number;
    loop?: boolean;
  }) {
    if (options.fps <= 0 || !Number.isFinite(options.fps)) {
      throw new Error(
        `FrameClock fps must be a positive number, got ${options.fps}.`,
      );
    }
    if (
      !Number.isInteger(options.durationInFrames) ||
      options.durationInFrames <= 0
    ) {
      throw new Error(
        `FrameClock durationInFrames must be a positive integer, got ${options.durationInFrames}.`,
      );
    }

    this.fps = options.fps;
    this.durationInFrames = options.durationInFrames;
    this.loop = options.loop ?? false;
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  /** Starts (or restarts) playback at the current frame position. */
  play(now: number): void {
    if (this.isPlaying) {
      return;
    }

    // Playing from the final frame restarts from 0 — the universal
    // player-button expectation.
    if (!this.loop && this.anchorFrame >= this.durationInFrames - 1) {
      this.anchorFrame = 0;
    }

    this.anchorTime = now;
    this.isPlaying = true;
  }

  /** Freezes the clock at the frame visible at `now`. */
  pause(now: number): void {
    if (!this.isPlaying) {
      return;
    }

    this.anchorFrame = this.frameAt(now).frame;
    this.isPlaying = false;
  }

  /** Jumps to a frame (clamped to the scene range), preserving play state. */
  seek(frame: number, now: number): void {
    this.anchorFrame = Math.min(
      Math.max(Math.floor(frame), 0),
      this.durationInFrames - 1,
    );
    this.anchorTime = now;
  }

  /**
   * The frame visible at wall time `now`, and whether non-looping playback
   * has run past the final frame. Calling this never mutates the clock;
   * the caller decides what to do at the end (pause, loop is internal).
   */
  frameAt(now: number): { frame: number; ended: boolean } {
    if (!this.isPlaying) {
      return { frame: this.anchorFrame, ended: false };
    }

    const elapsed = Math.max(0, now - this.anchorTime);
    const advanced = Math.floor((elapsed / 1000) * this.fps) + this.anchorFrame;

    if (advanced < this.durationInFrames) {
      return { frame: advanced, ended: false };
    }

    if (this.loop) {
      return { frame: advanced % this.durationInFrames, ended: false };
    }

    return { frame: this.durationInFrames - 1, ended: true };
  }
}

export type PlayerEvent = "frame" | "play" | "pause" | "ended";

export type PlayerOptions = {
  /** A 2D context sized to the scene; the player draws into it. */
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  scene: unknown;
  /**
   * Pre-resolved assets. When omitted, createPlayer() resolves them and
   * dispose() releases them; when provided, the caller owns their lifetime.
   */
  assets?: ResolvedAssets;
  /** Trusted extension definitions used when resolving extension nodes. */
  extensions?: ResolveAssetsOptions["extensions"];
  /** Require every extension definition to support worker execution. */
  worker?: boolean;
  loop?: boolean;
  /**
   * Audio preview. Defaults to a WebAudioPreview when the environment has
   * AudioContext; pass `false` to disable sound, or your own AudioPreview.
   * Preview audio is best-effort — the export is the audio source of truth.
   */
  audio?: AudioPreview | false;
  /** Injectable time source for tests; defaults to performance.now. */
  now?: () => number;
  /** Injectable frame scheduler for tests; defaults to requestAnimationFrame. */
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (handle: number) => void;
};

/**
 * A playing/seekable view of a scene on a canvas. Create with createPlayer().
 *
 * The render loop awaits prepareFrame() per displayed frame (video decode),
 * so a slow decode never tears: the player skips to the latest target frame
 * rather than rendering stale intermediates.
 */
export class Player {
  readonly scene: Scene;

  private readonly clock: FrameClock;
  private readonly context: PlayerOptions["context"];
  private readonly assets: ResolvedAssets | undefined;
  private readonly ownsAssets: boolean;
  private readonly now: () => number;
  private readonly requestFrame: (callback: () => void) => number;
  private readonly cancelFrame: (handle: number) => void;

  private listeners = new Map<PlayerEvent, Set<(frame: number) => void>>();
  private renderedFrame = -1;
  private rafHandle: number | null = null;
  private rendering = false;
  private assetsReleased = false;
  private disposed = false;
  private audio: AudioPreview | null = null;
  private audioReadyPromise: Promise<void> = Promise.resolve();
  private readonly textMeasureCache: TextMeasureCache = new Map();

  /** @internal — use createPlayer(). */
  constructor(
    scene: Scene,
    options: PlayerOptions,
    assets: ResolvedAssets | undefined,
    ownsAssets: boolean,
  ) {
    this.scene = scene;
    this.context = options.context;
    this.assets = assets;
    this.ownsAssets = ownsAssets;
    this.now = options.now ?? (() => performance.now());
    this.requestFrame =
      options.requestFrame ??
      ((callback) => globalThis.requestAnimationFrame(callback));
    this.cancelFrame =
      options.cancelFrame ??
      ((handle) => globalThis.cancelAnimationFrame(handle));
    this.clock = new FrameClock({
      fps: scene.fps,
      durationInFrames: scene.duration,
      loop: options.loop ?? false,
    });
  }

  get playing(): boolean {
    return this.clock.playing;
  }

  /** The most recently rendered frame (−1 before the first render). */
  get currentFrame(): number {
    return this.renderedFrame;
  }

  get loop(): boolean {
    return this.clock.loop;
  }

  set loop(value: boolean) {
    this.clock.loop = value;
  }

  /**
   * Resolves once the audio preview is attached, or once the player knows
   * there will be none (silent scene, unsupported environment, mix failure).
   * The mix is prepared off the critical path, so the first frame paints
   * before sound exists; playback started earlier joins the audio clock the
   * moment it attaches. Await this when audio must be live before play().
   */
  get audioReady(): Promise<void> {
    return this.audioReadyPromise;
  }

  on(event: PlayerEvent, listener: (frame: number) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)?.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  play(): void {
    this.assertAlive();

    if (this.clock.playing) {
      return;
    }

    this.clock.play(this.now());
    const startFrame = this.clock.frameAt(this.now()).frame;
    this.audio?.start(startFrame / this.scene.fps);
    this.emit("play", this.renderedFrame);
    this.scheduleTick();
  }

  pause(): void {
    this.assertAlive();

    if (!this.clock.playing) {
      return;
    }

    this.clock.pause(this.now());
    this.audio?.stop();
    this.stopTicking();
    this.emit("pause", this.clock.frameAt(this.now()).frame);
  }

  /** Jumps to a frame and renders it; resolves when the frame is on screen. */
  async seek(frame: number): Promise<void> {
    this.assertAlive();
    this.clock.seek(frame, this.now());
    const target = this.clock.frameAt(this.now()).frame;

    if (this.clock.playing) {
      this.audio?.start(target / this.scene.fps);
    }

    await this.renderFrame(target);
  }

  /** Stops playback and releases player-owned assets. */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.stopTicking();
    this.disposed = true;
    this.listeners.clear();
    this.audio?.dispose();
    this.audio = null;

    if (!this.rendering) {
      this.releaseOwnedAssets();
    }
  }

  /** @internal — wired by createPlayer() after load() decides audibility. */
  attachAudio(audio: AudioPreview): void {
    if (this.disposed) {
      audio.dispose();
      return;
    }

    this.audio = audio;

    // The mix finished while playback was already running: join it at the
    // current position instead of staying silent until the next play().
    if (this.clock.playing) {
      audio.start(this.clock.frameAt(this.now()).frame / this.scene.fps);
    }
  }

  /** @internal — wired by createPlayer(). */
  setAudioReady(ready: Promise<void>): void {
    this.audioReadyPromise = ready;
  }

  /** @internal — first paint from createPlayer(). */
  async renderInitialFrame(): Promise<void> {
    await this.renderFrame(0);
  }

  private scheduleTick(): void {
    if (this.rafHandle !== null || this.disposed) {
      return;
    }

    this.rafHandle = this.requestFrame(() => {
      this.rafHandle = null;
      void this.tick();
    });
  }

  private stopTicking(): void {
    if (this.rafHandle !== null) {
      this.cancelFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.disposed || !this.clock.playing) {
      return;
    }

    // Audio hardware is the steadier clock: when the frame clock drifts more
    // than one frame from the audio position, re-anchor the frame clock. A
    // skipped video frame is invisible; skipped audio is not.
    const audioPosition = this.audio?.position();

    if (audioPosition != null) {
      const audioFrame = Math.floor(audioPosition * this.scene.fps);
      const clockFrame = this.clock.frameAt(this.now()).frame;

      if (
        Math.abs(audioFrame - clockFrame) > 1 &&
        audioFrame < this.clock.durationInFrames
      ) {
        this.clock.seek(audioFrame, this.now());
      }
    }

    const { frame, ended } = this.clock.frameAt(this.now());

    // Loop wrap: the clock jumped backwards, so the audio source (which
    // plays linearly) must restart from the wrapped position.
    if (frame < this.renderedFrame && this.clock.loop) {
      this.audio?.start(frame / this.scene.fps);
    }

    if (frame !== this.renderedFrame) {
      await this.renderFrame(frame);
    }

    if (ended) {
      this.clock.pause(this.now());
      this.audio?.stop();
      this.emit("ended", frame);
      return;
    }

    this.scheduleTick();
  }

  private async renderFrame(frame: number): Promise<void> {
    // One render in flight at a time; the next tick picks up the latest
    // clock position, so a slow video decode skips ahead instead of queueing
    // stale frames.
    if (this.rendering || this.disposed) {
      return;
    }

    this.rendering = true;

    try {
      const resolvedScene = this.assets
        ? await prepareFrame(this.scene, frame, this.assets)
        : undefined;

      if (this.disposed) {
        return;
      }

      renderStill(this.context, this.scene, frame, {
        assets: this.assets,
        resolvedScene,
        textMeasureCache: this.textMeasureCache,
      });
      this.renderedFrame = frame;
      this.emit("frame", frame);
    } catch (error) {
      if (!this.disposed) {
        throw error;
      }
    } finally {
      this.rendering = false;

      if (this.disposed) {
        this.releaseOwnedAssets();
      }
    }
  }

  private releaseOwnedAssets(): void {
    if (!this.ownsAssets || !this.assets || this.assetsReleased) {
      return;
    }

    this.assetsReleased = true;
    disposeAssets(this.assets);
  }

  private emit(event: PlayerEvent, frame: number): void {
    const listeners = Array.from(this.listeners.get(event) ?? []);

    for (const listener of listeners) {
      listener(frame);
    }
  }

  private assertAlive(): void {
    if (this.disposed) {
      throw new Error(
        "Player is disposed; create a new one with createPlayer().",
      );
    }
  }
}

/**
 * Validates the scene, resolves assets (unless provided), renders frame 0,
 * and returns a ready Player.
 */
export async function createPlayer(options: PlayerOptions): Promise<Player> {
  const scene = parseScene(options.scene);
  const inspection = inspectScene(scene);
  const needsAssets =
    Object.keys(scene.assets).length > 0 ||
    inspection.capabilities.hasExtensions;
  const ownsAssets = options.assets === undefined && needsAssets;
  const assets =
    options.assets ??
    (needsAssets
      ? await resolveAssets(scene, {
          extensions: options.extensions,
          worker: options.worker,
        })
      : undefined);

  const player = new Player(scene, options, assets, ownsAssets);

  // Best-effort audio preview: attach only when the scene actually has
  // something audible, so silent scenes never touch AudioContext. The mix
  // runs concurrently with the first paint and attaches whenever it lands —
  // decoding a long soundtrack must never delay the first visible frame.
  if (options.audio !== false) {
    const audio =
      options.audio ??
      (WebAudioPreview.supported() ? new WebAudioPreview() : null);

    if (audio) {
      player.setAudioReady(
        audio
          .load(scene, assets)
          .then((audible) => {
            if (audible) {
              player.attachAudio(audio);
            } else {
              audio.dispose();
            }
          })
          .catch(() => {
            // Preview audio is best-effort; the export mixes its own.
            audio.dispose();
          }),
      );
    }
  }

  await player.renderInitialFrame();
  return player;
}
