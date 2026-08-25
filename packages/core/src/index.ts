import {
  type Scene,
  type SceneAnimation,
  type SceneAudioBus,
  type SceneAsset,
  type SceneEffectName,
  type SceneEffectParams,
  type SceneDucking,
  type SceneExtensionDescriptor,
  type SceneMaskDescriptor,
  type SceneNode,
  type SceneShapeGeometry,
  type SceneStyle,
  type SceneTextRun,
  type VolumeEnvelope,
  parseScene,
} from "@motionforge/schema";
import {
  parseColorValue,
  parseEasingValue,
  parseFilterValue,
  parseTransformValue,
} from "@motionforge/schema/values";

export type CompositionOptions = {
  width: number;
  height: number;
  fps: number;
  duration: number;
};

export type NodeOptions = {
  id?: string;
  from?: number;
  duration?: number;
  style?: SceneStyle;
  assetId?: string;
  clip?: SceneShapeGeometry;
  mask?: SceneMaskDescriptor;
};

export type VideoNodeOptions = NodeOptions & {
  /** Source trim offset in seconds. */
  videoStartTime?: number;
  /** Playback speed multiplier (1 = natural speed). */
  playbackRate?: number;
  /** Gain from 0 to 1 for the clip soundtrack. */
  volume?: number;
  /** Node-local gain curve multiplied by `volume`. */
  volumeEnvelope?: VolumeEnvelope;
  audioBus?: string;
  pan?: number;
  ducks?: SceneDucking;
  videoEndBehavior?: "hold" | "loop";
};

export type AudioNodeOptions = Omit<NodeOptions, "style"> & {
  /** Source trim offset in seconds. */
  audioStartTime?: number;
  /** Gain from 0 (silent) to 1 (natural), default 1. */
  volume?: number;
  /** Node-local gain curve multiplied by `volume`. */
  volumeEnvelope?: VolumeEnvelope;
  /** Wrap source playback through the node's active window. */
  loop?: boolean;
  audioBus?: string;
  pan?: number;
  ducks?: SceneDucking;
};

export type LottieNodeOptions = NodeOptions & {
  /** Playback speed multiplier (1 = natural speed). */
  playbackRate?: number;
};

export type EffectNodeOptions = NodeOptions & {
  /** Bounded effect-specific parameters from the scene contract. */
  params?: SceneEffectParams;
};

export type ExtensionNodeOptions = NodeOptions & {
  /** Trusted host extension identity and JSON-only parameters. */
  extension: SceneExtensionDescriptor;
};

export type ShapeNodeOptions = NodeOptions;

type InternalNodeOptions = NodeOptions & {
  text?: string;
  runs?: SceneTextRun[];
  videoStartTime?: number;
  playbackRate?: number;
  audioStartTime?: number;
  volume?: number;
  volumeEnvelope?: VolumeEnvelope;
  loop?: boolean;
  audioBus?: string;
  pan?: number;
  ducks?: SceneDucking;
  videoEndBehavior?: "hold" | "loop";
  effect?: SceneEffectName;
  params?: SceneEffectParams;
  extension?: SceneExtensionDescriptor;
  shape?: SceneShapeGeometry;
};

type IdCounter = { next: number };

export class SceneBuilder {
  private readonly options: CompositionOptions;
  private readonly assets: Record<string, SceneAsset> = {};
  private readonly childBuilders: NodeBuilder[] = [];
  private readonly markers: Record<string, number> = {};
  private readonly audioBuses: Record<string, SceneAudioBus> = {};

  constructor(options: CompositionOptions) {
    this.options = options;
  }

  asset(asset: SceneAsset): this {
    this.assets[asset.id] = asset;
    return this;
  }

  children(...nodes: NodeBuilder[]): this {
    this.childBuilders.push(...nodes);
    return this;
  }

  marker(name: string, frame: number): this {
    this.markers[name] = frame;
    return this;
  }

  audioBus(name: string, bus: SceneAudioBus): this {
    this.audioBuses[name] = bus;
    return this;
  }

  toJSON(): Scene {
    const counter: IdCounter = { next: 0 };

    return parseScene({
      schemaVersion: 1,
      width: this.options.width,
      height: this.options.height,
      fps: this.options.fps,
      duration: this.options.duration,
      assets: structuredClone(this.assets),
      ...(Object.keys(this.markers).length > 0
        ? {
            markers: Object.fromEntries(
              Object.entries(this.markers).sort(([left], [right]) =>
                left.localeCompare(right),
              ),
            ),
          }
        : {}),
      ...(Object.keys(this.audioBuses).length > 0
        ? { audioBuses: structuredClone(this.audioBuses) }
        : {}),
      nodes: this.childBuilders.map((node) => node.build(counter)),
    });
  }
}

export class NodeBuilder {
  private readonly type: SceneNode["type"];
  private readonly id?: string;
  private readonly text?: string;
  private readonly runs?: SceneTextRun[];
  private readonly assetId?: string;
  private readonly videoStartTime?: number;
  private readonly playbackRate?: number;
  private readonly audioStartTime?: number;
  private readonly volume?: number;
  private readonly volumeEnvelope?: VolumeEnvelope;
  private readonly loop?: boolean;
  private readonly audioBus?: string;
  private readonly pan?: number;
  private readonly ducks?: SceneDucking;
  private readonly videoEndBehavior?: "hold" | "loop";
  private readonly effect?: SceneEffectName;
  private readonly params?: SceneEffectParams;
  private readonly extension?: SceneExtensionDescriptor;
  private readonly shape?: SceneShapeGeometry;
  private readonly clip?: SceneShapeGeometry;
  private readonly mask?: SceneMaskDescriptor;
  private from: number;
  private duration?: number;
  private readonly style: SceneStyle;
  private readonly animations: SceneAnimation[] = [];
  private readonly childBuilders: NodeBuilder[] = [];

  constructor(type: SceneNode["type"], options: InternalNodeOptions = {}) {
    this.type = type;
    this.id = options.id;
    this.text = options.text;
    this.runs = options.runs;
    this.assetId = options.assetId;
    this.videoStartTime = options.videoStartTime;
    this.playbackRate = options.playbackRate;
    this.audioStartTime = options.audioStartTime;
    this.volume = options.volume;
    this.volumeEnvelope = options.volumeEnvelope;
    this.loop = options.loop;
    this.audioBus = options.audioBus;
    this.pan = options.pan;
    this.ducks = options.ducks;
    this.videoEndBehavior = options.videoEndBehavior;
    this.effect = options.effect;
    this.params = options.params;
    this.extension = options.extension;
    this.shape = options.shape;
    this.clip = options.clip;
    this.mask = options.mask;
    this.from = options.from ?? 0;
    this.duration = options.duration;
    this.style = options.style ?? {};
  }

  children(...nodes: NodeBuilder[]): this {
    this.childBuilders.push(...nodes);
    return this;
  }

  at(from: number, duration?: number): this {
    this.from = from;
    this.duration = duration;
    return this;
  }

  animate(animation: SceneAnimation): this;
  animate(
    property: SceneAnimation["property"],
    frames: SceneAnimation["frames"],
    playback?: Pick<SceneAnimation, "repeat" | "yoyo">,
  ): this;
  animate(
    animationOrProperty: SceneAnimation | SceneAnimation["property"],
    frames?: SceneAnimation["frames"],
    playback: Pick<SceneAnimation, "repeat" | "yoyo"> = {},
  ): this {
    const animation: SceneAnimation =
      typeof animationOrProperty === "object"
        ? structuredClone(animationOrProperty)
        : {
            kind: "keyframes",
            property: animationOrProperty,
            frames: structuredClone(frames ?? []),
            ...(playback.repeat === undefined
              ? {}
              : { repeat: playback.repeat }),
            ...(playback.yoyo === undefined ? {} : { yoyo: playback.yoyo }),
          };
    this.animations.push(animation);
    return this;
  }

  toJSON(): SceneNode {
    return this.build({ next: 0 });
  }

  /**
   * Serializes the builder tree. Auto ids are assigned in document order from
   * the shared counter, so the same builder program always emits the same JSON.
   */
  build(counter: IdCounter): SceneNode {
    return structuredClone({
      id: this.id ?? `${this.type}-${counter.next++}`,
      type: this.type,
      text: this.text,
      runs: this.runs,
      assetId: this.assetId,
      videoStartTime: this.videoStartTime,
      playbackRate: this.playbackRate,
      audioStartTime: this.audioStartTime,
      volume: this.volume,
      volumeEnvelope: this.volumeEnvelope,
      loop: this.loop,
      audioBus: this.audioBus,
      pan: this.pan,
      ducks: this.ducks,
      videoEndBehavior: this.videoEndBehavior,
      effect: this.effect,
      params: this.params,
      extension: this.extension,
      shape: this.shape,
      clip: this.clip,
      mask: this.mask,
      from: this.from,
      duration: this.duration,
      style: this.style,
      animations: this.animations,
      children: this.childBuilders.map((child) => child.build(counter)),
    });
  }
}

export function composition(options: CompositionOptions): SceneBuilder {
  return new SceneBuilder(options);
}

export function div(options: NodeOptions = {}): NodeBuilder {
  return new NodeBuilder("div", options);
}

export function text(value: string, options: NodeOptions = {}): NodeBuilder {
  return new NodeBuilder("text", { ...options, text: value });
}

export function richText(
  runs: SceneTextRun[],
  options: NodeOptions = {},
): NodeBuilder {
  return new NodeBuilder("text", { ...options, runs });
}

export function img(assetId: string, options: NodeOptions = {}): NodeBuilder {
  return new NodeBuilder("img", { ...options, assetId });
}

export function video(
  assetId: string,
  options: VideoNodeOptions = {},
): NodeBuilder {
  return new NodeBuilder("video", { ...options, assetId });
}

export function audio(
  assetId: string,
  options: AudioNodeOptions = {},
): NodeBuilder {
  return new NodeBuilder("audio", { ...options, assetId });
}

export function lottie(
  assetId: string,
  options: LottieNodeOptions = {},
): NodeBuilder {
  return new NodeBuilder("lottie", { ...options, assetId });
}

export function effect(
  name: SceneEffectName,
  options: EffectNodeOptions = {},
): NodeBuilder {
  return new NodeBuilder("effect", {
    ...options,
    effect: name,
    params: options.params,
  });
}

export function extension(options: ExtensionNodeOptions): NodeBuilder {
  return new NodeBuilder("extension", options);
}

export function shape(
  geometry: SceneShapeGeometry,
  options: ShapeNodeOptions = {},
): NodeBuilder {
  return new NodeBuilder("shape", { ...options, shape: geometry });
}

export type ResolvedNode = Omit<SceneNode, "children"> & {
  style: SceneStyle;
  /** Frames since this node became active (0 on its first visible frame). */
  localFrame: number;
  children: ResolvedNode[];
};

export type ResolvedScene = Omit<Scene, "nodes"> & {
  frame: number;
  nodes: ResolvedNode[];
};

export function evaluateScene(sceneInput: Scene, frame: number): ResolvedScene {
  const scene = parseScene(sceneInput);
  const clampedFrame = Math.max(0, Math.min(frame, scene.duration - 1));

  return {
    ...scene,
    frame: clampedFrame,
    nodes: scene.nodes.flatMap((node) =>
      evaluateNode(node, clampedFrame, scene.duration),
    ),
  };
}

function evaluateNode(
  node: SceneNode,
  absoluteFrame: number,
  parentDuration: number,
): ResolvedNode[] {
  const from = node.from ?? 0;
  const duration = node.duration ?? parentDuration;
  const localFrame = absoluteFrame - from;

  if (localFrame < 0 || localFrame >= duration) {
    return [];
  }

  const style = { ...(node.style ?? {}) };
  const mask = node.mask ? { ...node.mask } : undefined;

  for (const animation of node.animations ?? []) {
    if (animation.kind === "keyframes") {
      const value = evaluateKeyframes(
        animation.frames,
        resolveAnimationFrame(animation, localFrame),
      );
      if (value !== undefined) {
        if (animation.property === "transform" && typeof value !== "string") {
          continue;
        }

        if (animation.property === "mask.opacity" && mask) {
          mask.opacity = clampNumber(value, 0, 1, mask.opacity ?? 1);
        } else if (animation.property === "mask.feather" && mask) {
          mask.feather = clampNumber(value, 0, 256, mask.feather ?? 0);
        } else if (
          animation.property === "mask.radius" &&
          mask?.shape.kind === "rect"
        ) {
          mask.shape = { ...mask.shape, radius: value };
        } else {
          (style as Record<string, unknown>)[animation.property] = value;
        }
      }
    }
  }

  const children = (node.children ?? []).flatMap((child) =>
    evaluateNode(child, localFrame, duration),
  );

  return [
    {
      ...node,
      style,
      ...(mask ? { mask } : {}),
      localFrame,
      children,
    },
  ];
}

export function resolveAnimationFrame(
  animation: SceneAnimation,
  frame: number,
): number {
  const first = animation.frames[0];
  const last = animation.frames[animation.frames.length - 1];
  if (!first || !last || frame <= first.frame) return frame;
  const span = last.frame - first.frame;
  if (span <= 0) return last.frame;
  const repeat = animation.repeat ?? 0;
  const elapsed = frame - first.frame;
  const cycles = repeat === "infinite" ? Number.POSITIVE_INFINITY : repeat + 1;
  const total = span * cycles;
  if (elapsed >= total) {
    return animation.yoyo && repeat !== "infinite" && repeat % 2 === 1
      ? first.frame
      : last.frame;
  }
  const iteration = Math.floor(elapsed / span);
  const within = elapsed % span;
  return (
    first.frame +
    (animation.yoyo && iteration % 2 === 1 ? span - within : within)
  );
}

function clampNumber(
  value: string | number,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/**
 * Resolves an animated value at a node-local frame. Frames must be in strictly
 * increasing order (the schema enforces this). Numeric values interpolate;
 * string values interpolate when both parse as colors (RGBA space) or as
 * transform lists with matching function sequences; anything else steps.
 */
export function evaluateKeyframes(
  frames: SceneAnimation["frames"],
  frame: number,
): string | number | undefined {
  const first = frames[0];
  const last = frames[frames.length - 1];

  if (!first || !last) {
    return undefined;
  }

  if (frame <= first.frame) {
    return first.value;
  }

  if (frame >= last.frame) {
    return last.value;
  }

  const nextIndex = frames.findIndex((entry) => entry.frame >= frame);
  const next = frames[nextIndex];
  const prev = frames[nextIndex - 1];

  if (!prev || !next) {
    return last.value;
  }

  const span = next.frame - prev.frame;
  const rawT = span === 0 ? 1 : (frame - prev.frame) / span;
  const t = applyEasing(rawT, next.easing ?? "linear");

  if (typeof prev.value === "number" && typeof next.value === "number") {
    return prev.value + (next.value - prev.value) * t;
  }

  if (typeof prev.value === "string" && typeof next.value === "string") {
    const from = parseColor(prev.value);
    const to = parseColor(next.value);

    if (from && to) {
      return mixColors(from, to, t);
    }

    const fromTransform = parseTransform(prev.value);
    const toTransform = parseTransform(next.value);

    if (fromTransform && toTransform) {
      const mixed = mixTransforms(fromTransform, toTransform, t);

      if (mixed !== null) {
        return mixed;
      }
    }

    const fromFilter = parseFilter(prev.value);
    const toFilter = parseFilter(next.value);
    if (fromFilter && toFilter) {
      const mixedFilter = mixFilters(fromFilter, toFilter, t);
      if (mixedFilter !== null) return mixedFilter;
    }
  }

  // Non-interpolatable values step at the next keyframe.
  return frame < next.frame ? prev.value : next.value;
}

export type TransformFunction = {
  name: "translate" | "scale" | "rotate";
  args: Array<{ value: number; unit: "px" | "%" | "deg" | "" }>;
};

export type FilterFunction = {
  name:
    | "brightness"
    | "contrast"
    | "saturate"
    | "grayscale"
    | "sepia"
    | "invert"
    | "opacity"
    | "hue-rotate"
    | "blur";
  value: number;
  unit: "" | "%" | "deg" | "px";
};

export function parseFilter(value: string): FilterFunction[] | null {
  const parsed = parseFilterValue(value);
  return parsed?.kind === "filter-list"
    ? parsed.functions.map((fn) => ({
        name: fn.kind,
        value: fn.value,
        unit: fn.unit,
      }))
    : null;
}

function mixFilters(
  from: FilterFunction[],
  to: FilterFunction[],
  t: number,
): string | null {
  if (from.length !== to.length) return null;
  const parts: string[] = [];
  for (let index = 0; index < from.length; index += 1) {
    const left = from[index];
    const right = to[index];
    if (
      !left ||
      !right ||
      left.name !== right.name ||
      left.unit !== right.unit
    ) {
      return null;
    }
    const value = left.value + (right.value - left.value) * t;
    parts.push(`${left.name}(${formatInterpolatedNumber(value)}${left.unit})`);
  }
  return parts.join(" ");
}

function formatInterpolatedNumber(value: number): string {
  return String(Number(value.toFixed(5)));
}

/**
 * Parses a transform list of translate()/scale()/rotate() into normalized
 * functions: translate gets two length args (unitless = px), scale two
 * unitless args (sy defaults to sx), rotate one deg arg. Returns null for
 * anything that is not purely such a list, which makes the value step.
 */
export function parseTransform(value: string): TransformFunction[] | null {
  const parsed = parseTransformValue(value);
  if (parsed?.kind !== "transform-list") return null;
  return parsed.functions.map((fn): TransformFunction => {
    if (fn.kind === "translate") {
      return { name: "translate", args: [fn.x, fn.y] };
    }
    if (fn.kind === "scale") {
      return {
        name: "scale",
        args: [
          { value: fn.x, unit: "" },
          { value: fn.y, unit: "" },
        ],
      };
    }
    return {
      name: "rotate",
      args: [{ value: fn.degrees, unit: "deg" }],
    };
  });
}

/**
 * Tweens two parsed transform lists. Returns null when the function
 * sequences or units do not match slot-for-slot (mismatches step instead,
 * like CSS between non-interpolable transforms).
 */
function mixTransforms(
  from: TransformFunction[],
  to: TransformFunction[],
  t: number,
): string | null {
  if (from.length !== to.length) {
    return null;
  }

  const parts: string[] = [];

  for (let index = 0; index < from.length; index += 1) {
    const start = from[index];
    const end = to[index];

    if (!start || !end || start.name !== end.name) {
      return null;
    }

    const args: string[] = [];

    for (let slot = 0; slot < start.args.length; slot += 1) {
      const a = start.args[slot];
      const b = end.args[slot];

      if (!a || !b || a.unit !== b.unit) {
        return null;
      }

      args.push(`${a.value + (b.value - a.value) * t}${a.unit}`);
    }

    parts.push(`${start.name}(${args.join(", ")})`);
  }

  return parts.join(" ");
}

export type RgbaColor = { r: number; g: number; b: number; a: number };

/**
 * Parses #rgb/#rgba/#rrggbb/#rrggbbaa hex and rgb()/rgba() color strings.
 * Returns null for anything else (named colors, gradients, hsl, ...), which
 * makes the value step instead of interpolate.
 */
export function parseColor(value: string): RgbaColor | null {
  const parsed = parseColorValue(value);
  return parsed?.kind === "rgba"
    ? {
        r: parsed.red,
        g: parsed.green,
        b: parsed.blue,
        a: parsed.alpha,
      }
    : null;
}

function mixColors(from: RgbaColor, to: RgbaColor, t: number): string {
  const channel = (start: number, end: number): number =>
    Math.round(Math.min(255, Math.max(0, start + (end - start) * t)));
  const alpha = Math.min(1, Math.max(0, from.a + (to.a - from.a) * t));

  return `rgba(${channel(from.r, to.r)}, ${channel(from.g, to.g)}, ${channel(from.b, to.b)}, ${Number(alpha.toFixed(4))})`;
}

export function applyEasing(t: number, easing: string): number {
  switch (easing) {
    case "easeIn":
      return t * t;
    case "easeOut":
      return 1 - (1 - t) * (1 - t);
    case "easeInOut":
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case "linear":
      return t;
    default:
      break;
  }

  const parsed = parseEasingValue(easing);
  if (parsed?.kind === "cubic-bezier") {
    return cubicBezierEasing(t, parsed.x1, parsed.y1, parsed.x2, parsed.y2);
  }

  if (parsed?.kind === "spring") {
    return springEasing(t, parsed.bounce);
  }

  // Unknown expressions cannot pass validation; degrade to linear.
  return t;
}

/**
 * CSS cubic-bezier easing with control points (x1, y1) and (x2, y2):
 * solves the curve parameter for x = t (Newton with bisection fallback,
 * fixed iteration counts so the result is deterministic), then samples y.
 */
export function cubicBezierEasing(
  t: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  if (t <= 0) {
    return 0;
  }

  if (t >= 1) {
    return 1;
  }

  const sample = (a: number, b: number, u: number): number =>
    3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u;
  const sampleDerivative = (a: number, b: number, u: number): number =>
    3 * (1 - u) * (1 - u) * a + 6 * (1 - u) * u * (b - a) + 3 * u * u * (1 - b);

  let u = t;

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const error = sample(x1, x2, u) - t;
    const slope = sampleDerivative(x1, x2, u);

    if (Math.abs(error) < 1e-7 || Math.abs(slope) < 1e-7) {
      break;
    }

    u = Math.min(1, Math.max(0, u - error / slope));
  }

  if (Math.abs(sample(x1, x2, u) - t) > 1e-7) {
    let lower = 0;
    let upper = 1;

    for (let iteration = 0; iteration < 32; iteration += 1) {
      u = (lower + upper) / 2;

      if (sample(x1, x2, u) < t) {
        lower = u;
      } else {
        upper = u;
      }
    }
  }

  return sample(y1, y2, u);
}

/**
 * Deterministic spring easing. bounce = 0 is critically damped (no
 * overshoot); larger bounce (< 1) overshoots and oscillates before settling
 * at 1. The final keyframe value is exact because the evaluator returns it
 * directly at and beyond the last frame.
 */
export function springEasing(t: number, bounce = 0.25): number {
  if (t <= 0) {
    return 0;
  }

  if (t >= 1) {
    return 1;
  }

  if (bounce <= 0) {
    const damping = 10;
    return 1 - (1 + damping * t) * Math.exp(-damping * t);
  }

  const damping = 10 * (1 - bounce);
  const frequency = Math.PI * (2 + 4 * bounce);
  return 1 - Math.exp(-damping * t) * Math.cos(frequency * t);
}

export type LayoutBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  node: ResolvedNode;
  children: LayoutBox[];
};

export type LayoutScene = Omit<ResolvedScene, "nodes"> & {
  boxes: LayoutBox[];
};

/**
 * Measures the width of a single already-broken line of text. `fontSize` is
 * pre-resolved by layout; implementations must honor it plus the style's
 * family/weight/style/letterSpacing so layout and paint agree on wrapping.
 */
export type MeasureTextLine = (
  line: string,
  style: SceneStyle,
  fontSize: number,
) => number;

export type LayoutOptions = {
  /**
   * Real text measurement (e.g. canvas measureText). Without it, layout falls
   * back to a character-count heuristic that over/under-estimates by font.
   */
  measureTextLine?: MeasureTextLine;
};

/**
 * The renderer-free fallback: average glyph width as a fontSize ratio. Kept as
 * the default so layout stays usable in plain Node, but renderers should pass
 * their own measurement for wrap-exact boxes.
 */
const heuristicMeasureTextLine: MeasureTextLine = (line, _style, fontSize) =>
  line.length * fontSize * 0.58;

/**
 * Splits text into rendered lines: explicit "\n" always breaks, and words
 * wrap when a line would exceed maxWidth. A single run wider than maxWidth
 * (CJK text has no spaces, so a whole paragraph is one "word") breaks by
 * grapheme cluster so every script wraps instead of being condensed; only a
 * single grapheme wider than the box is clamped by fillText at draw time.
 */
export function wrapTextLines(
  text: string,
  maxWidth: number,
  measure: (line: string) => number,
): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter((word) => word.length > 0);

    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";

    for (const word of words) {
      const candidate = current === "" ? word : `${current} ${word}`;

      if (current !== "" && measure(candidate) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }

      // The line so far may exceed the box on its own (spaceless scripts,
      // long URLs): emit grapheme-fitted lines until the remainder fits.
      while (measure(current) > maxWidth) {
        const broken = breakByGrapheme(current, maxWidth, measure);

        if (broken === null) {
          break; // single grapheme wider than the box: clamp at draw time
        }

        lines.push(broken.fit);
        current = broken.rest;
      }
    }

    lines.push(current);
  }

  return lines;
}

/**
 * Largest grapheme-cluster prefix of `text` that fits `maxWidth` (at least
 * one cluster), plus the remainder. Returns null when the text cannot be
 * split further. Grapheme segmentation keeps emoji and combining marks
 * intact; falls back to code points where Intl.Segmenter is unavailable.
 */
function breakByGrapheme(
  text: string,
  maxWidth: number,
  measure: (line: string) => number,
): { fit: string; rest: string } | null {
  const clusters = splitGraphemes(text);

  if (clusters.length <= 1) {
    return null;
  }

  let fit = clusters[0] ?? "";
  let index = 1;

  while (index < clusters.length) {
    const candidate = fit + clusters[index];

    if (measure(candidate) > maxWidth) {
      break;
    }

    fit = candidate;
    index += 1;
  }

  if (index >= clusters.length) {
    return null; // everything fits after all (measurement settled)
  }

  return { fit, rest: clusters.slice(index).join("") };
}

function splitGraphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });
    return Array.from(segmenter.segment(text), (entry) => entry.segment);
  }

  return Array.from(text);
}

export type PrepareTextLinesOptions = {
  maxLines?: number;
  textOverflow?: SceneStyle["textOverflow"];
};

export type PrepareTextLayoutOptions = PrepareTextLinesOptions & {
  textFit?: SceneStyle["textFit"];
  minFontSize?: number;
  height?: number;
  lineHeight?: SceneStyle["lineHeight"];
};

export type PreparedTextLayout = {
  fontSize: number;
  lines: string[];
  lineHeight: number;
};

export function prepareTextLines(
  text: string,
  maxWidth: number,
  measure: (line: string) => number,
  options: PrepareTextLinesOptions = {},
): string[] {
  const lines = wrapTextLines(text, maxWidth, measure);
  const maxLines = options.maxLines;

  if (maxLines === undefined || lines.length <= maxLines) {
    return lines;
  }

  const visible = lines.slice(0, maxLines);

  if (options.textOverflow === "ellipsis" && visible.length > 0) {
    const lastIndex = visible.length - 1;
    visible[lastIndex] = ellipsizeLine(
      visible[lastIndex] ?? "",
      maxWidth,
      measure,
    );
  }

  return visible;
}

export function prepareTextLayout(
  text: string,
  maxWidth: number,
  fontSize: number,
  measure: (line: string, fontSize: number) => number,
  options: PrepareTextLayoutOptions = {},
): PreparedTextLayout {
  const textFit = options.textFit ?? "wrap";
  const baseOptions = {
    maxLines: textFit === "truncate" ? 1 : options.maxLines,
    textOverflow: options.textOverflow,
  };
  const makeLines = (size: number) =>
    prepareTextLines(
      text,
      maxWidth,
      (line) => measure(line, size),
      baseOptions,
    );
  const makeLayout = (size: number): PreparedTextLayout => ({
    fontSize: size,
    lines: makeLines(size),
    lineHeight: resolveLineHeight(options.lineHeight, size),
  });

  if (textFit !== "shrink") {
    return makeLayout(fontSize);
  }

  const minFontSize = Math.max(
    1,
    Math.min(fontSize, options.minFontSize ?? 12),
  );
  const fits = (size: number): boolean => {
    const lines = makeLines(size);
    const lineHeight = resolveLineHeight(options.lineHeight, size);
    const heightFits =
      options.height === undefined ||
      lines.length * lineHeight <= options.height;
    const widthFits = lines.every((line) => measure(line, size) <= maxWidth);

    return heightFits && widthFits;
  };

  if (fits(fontSize)) {
    return makeLayout(fontSize);
  }

  let low = minFontSize;
  let high = fontSize;

  for (let pass = 0; pass < 10; pass += 1) {
    const mid = (low + high) / 2;

    if (fits(mid)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return makeLayout(low);
}

function ellipsizeLine(
  line: string,
  maxWidth: number,
  measure: (line: string) => number,
): string {
  const ellipsis = "…";

  if (measure(ellipsis) > maxWidth) {
    return "";
  }

  if (measure(`${line}${ellipsis}`) <= maxWidth) {
    return `${line}${ellipsis}`;
  }

  const clusters = splitGraphemes(line);

  while (clusters.length > 0) {
    const candidate = `${clusters.join("")}${ellipsis}`;

    if (measure(candidate) <= maxWidth) {
      return candidate;
    }

    clusters.pop();
  }

  return ellipsis;
}

export function layoutScene(
  scene: ResolvedScene,
  options: LayoutOptions = {},
): LayoutScene {
  const root = { x: 0, y: 0, width: scene.width, height: scene.height };
  const measure = options.measureTextLine ?? heuristicMeasureTextLine;

  return {
    ...scene,
    boxes: scene.nodes.map((node) => layoutNode(node, root, measure)),
  };
}

function layoutNode(
  node: ResolvedNode,
  containingBlock: { x: number; y: number; width: number; height: number },
  measure: MeasureTextLine,
  // Flex parents size their children during distribution; the child box must
  // keep that assigned height instead of re-deriving an intrinsic one.
  sizedByParent = false,
): LayoutBox {
  const style = node.style ?? {};
  if (style.safeArea) {
    containingBlock = insetContainingBlock(containingBlock, style.safeArea);
  }
  const inset = readLength(style.inset, containingBlock.width, 0);
  // Per-side values override the shorthand. Vertical percentages intentionally
  // resolve against containing width, matching CSS spacing semantics.
  const margin = readLength(style.margin, containingBlock.width, 0);
  const marginTop = readLength(style.marginTop, containingBlock.width, margin);
  const marginRight = readLength(
    style.marginRight,
    containingBlock.width,
    margin,
  );
  const marginBottom = readLength(
    style.marginBottom,
    containingBlock.width,
    margin,
  );
  const marginLeft = readLength(
    style.marginLeft,
    containingBlock.width,
    margin,
  );
  const left = readLength(style.left, containingBlock.width, inset);
  const top = readLength(style.top, containingBlock.height, inset);
  const right =
    style.right === undefined
      ? undefined
      : readLength(style.right, containingBlock.width, 0);
  const bottom =
    style.bottom === undefined
      ? undefined
      : readLength(style.bottom, containingBlock.height, 0);
  const widthFallback =
    (style.position === "absolute" &&
    right !== undefined &&
    style.width === undefined
      ? containingBlock.width - left - right
      : containingBlock.width - inset * 2) -
    marginLeft -
    marginRight;
  const heightFallback =
    (style.position === "absolute" &&
    bottom !== undefined &&
    style.height === undefined
      ? containingBlock.height - top - bottom
      : containingBlock.height - inset * 2) -
    marginTop -
    marginBottom;
  let width = clampLength(
    resolveLength(style.width, containingBlock.width, widthFallback),
    style.minWidth,
    style.maxWidth,
    containingBlock.width,
  );
  // Text with auto height gets its intrinsic height (wrapped lines ×
  // lineHeight) instead of filling the containing block — CSS block
  // semantics, and what keeps `top`-anchored text from centering off-canvas.
  // Absolute nodes with both top and bottom set stay inset-constrained.
  const intrinsicHeight =
    node.type === "text" &&
    style.height === undefined &&
    !sizedByParent &&
    !(
      style.position === "absolute" &&
      style.top !== undefined &&
      style.bottom !== undefined
    )
      ? textIntrinsicHeight(node, width, measure)
      : undefined;
  const aspectRatio = parseAspectRatio(style.aspectRatio);
  const ratioHeight = aspectRatio ? width / aspectRatio : undefined;
  let height = clampLength(
    resolveLength(
      style.height,
      containingBlock.height,
      ratioHeight ?? intrinsicHeight ?? heightFallback,
    ),
    style.minHeight,
    style.maxHeight,
    containingBlock.height,
  );

  if (aspectRatio && style.width === undefined && style.height !== undefined) {
    width = clampLength(
      height * aspectRatio,
      style.minWidth,
      style.maxWidth,
      containingBlock.width,
    );
  }

  const x =
    containingBlock.x +
    (style.position === "absolute" &&
    style.left === undefined &&
    right !== undefined
      ? containingBlock.width - right - width - marginRight
      : left + marginLeft);
  const y =
    containingBlock.y +
    (style.position === "absolute" &&
    style.top === undefined &&
    bottom !== undefined
      ? containingBlock.height - bottom - height - marginBottom
      : top + marginTop);

  const paddingReference = Math.min(width, height);
  const padding = readLength(style.padding, paddingReference, 0);
  const paddingTop = readLength(style.paddingTop, paddingReference, padding);
  const paddingRight = readLength(
    style.paddingRight,
    paddingReference,
    padding,
  );
  const paddingBottom = readLength(
    style.paddingBottom,
    paddingReference,
    padding,
  );
  const paddingLeft = readLength(style.paddingLeft, paddingReference, padding);
  const content = {
    x: x + paddingLeft,
    y: y + paddingTop,
    width: Math.max(0, width - paddingLeft - paddingRight),
    height: Math.max(0, height - paddingTop - paddingBottom),
  };

  const children =
    style.display === "flex"
      ? layoutFlexChildren(node.children, content, style, measure)
      : node.children.map((child) => layoutNode(child, content, measure));

  return {
    id: node.id,
    x,
    y,
    width,
    height,
    node,
    children,
  };
}

function insetContainingBlock(
  containingBlock: { x: number; y: number; width: number; height: number },
  safeArea: NonNullable<SceneStyle["safeArea"]>,
): { x: number; y: number; width: number; height: number } {
  const top = readLength(safeArea.top, containingBlock.height, 0);
  const right = readLength(safeArea.right, containingBlock.width, 0);
  const bottom = readLength(safeArea.bottom, containingBlock.height, 0);
  const left = readLength(safeArea.left, containingBlock.width, 0);
  return {
    x: containingBlock.x + left,
    y: containingBlock.y + top,
    width: Math.max(0, containingBlock.width - left - right),
    height: Math.max(0, containingBlock.height - top - bottom),
  };
}

function layoutFlexChildren(
  children: ResolvedNode[],
  content: { x: number; y: number; width: number; height: number },
  style: SceneStyle,
  measure: MeasureTextLine,
): LayoutBox[] {
  const direction = style.flexDirection ?? "row";
  const gap = readLength(
    style.gap,
    direction === "row" ? content.width : content.height,
    0,
  );
  const childBoxes = children.map((child) => {
    const estimatedWidth = estimateNodeWidth(child, measure);
    let childWidth = resolveLength(
      child.style.width,
      content.width,
      Math.min(content.width, estimatedWidth),
    );
    // Height is estimated after the width is known so wrapped text reserves
    // one slot per rendered line, not per explicit "\n".
    const estimatedHeight =
      child.type === "text"
        ? textIntrinsicHeight(child, childWidth, measure)
        : 0;
    let childHeight = resolveLength(
      child.style.height,
      content.height,
      Math.min(content.height, estimatedHeight),
    );
    const childAspectRatio = parseAspectRatio(child.style.aspectRatio);
    if (childAspectRatio) {
      if (child.style.height === undefined && child.style.width !== undefined) {
        childHeight = childWidth / childAspectRatio;
      } else if (
        child.style.width === undefined &&
        child.style.height !== undefined
      ) {
        childWidth = childHeight * childAspectRatio;
      }
    }

    if (style.alignItems === "stretch") {
      // Stretch fills the cross axis for children without an explicit size.
      if (direction === "row" && child.style.height === undefined) {
        childHeight = content.height;
      }

      if (direction === "column" && child.style.width === undefined) {
        childWidth = content.width;
      }
    }

    return { child, width: childWidth, height: childHeight };
  });

  const mainTotal =
    childBoxes.reduce(
      (total, child) =>
        total + (direction === "row" ? child.width : child.height),
      0,
    ) +
    Math.max(0, childBoxes.length - 1) * gap;
  const mainSpace = direction === "row" ? content.width : content.height;
  const crossSpace = direction === "row" ? content.height : content.width;
  // space-between distributes leftover main-axis space on top of `gap`.
  const betweenGap =
    style.justifyContent === "space-between" && childBoxes.length > 1
      ? Math.max(0, mainSpace - mainTotal) / (childBoxes.length - 1)
      : 0;
  let cursor =
    style.justifyContent === "center" ? (mainSpace - mainTotal) / 2 : 0;

  if (style.justifyContent === "flex-end") {
    cursor = mainSpace - mainTotal;
  }

  return childBoxes.map(({ child, width, height }) => {
    const crossSize = direction === "row" ? height : width;
    let crossOffset = 0;

    if (style.alignItems === "center") {
      crossOffset = (crossSpace - crossSize) / 2;
    } else if (style.alignItems === "flex-end") {
      crossOffset = crossSpace - crossSize;
    }

    const box =
      direction === "row"
        ? layoutNode(
            child,
            {
              x: content.x + cursor,
              y: content.y + crossOffset,
              width,
              height,
            },
            measure,
            true,
          )
        : layoutNode(
            child,
            {
              x: content.x + crossOffset,
              y: content.y + cursor,
              width,
              height,
            },
            measure,
            true,
          );

    cursor += (direction === "row" ? width : height) + gap + betweenGap;
    return box;
  });
}

function clampLength(
  value: number,
  min: string | number | undefined,
  max: string | number | undefined,
  parent: number,
): number {
  let clamped = value;

  if (max !== undefined) {
    clamped = Math.min(clamped, readLength(max, parent, clamped));
  }

  // CSS semantics: min wins over max when they conflict.
  if (min !== undefined) {
    clamped = Math.max(clamped, readLength(min, parent, clamped));
  }

  return clamped;
}

export function parseAspectRatio(
  value: SceneStyle["aspectRatio"],
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const match = value.match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const width = Number.parseFloat(match[1] ?? "0");
  const height = Number.parseFloat(match[2] ?? "0");
  return width > 0 && height > 0 ? width / height : null;
}

function estimateNodeWidth(
  node: ResolvedNode,
  measure: MeasureTextLine,
): number {
  if (node.type === "text") {
    const fontSize = readLength(node.style.fontSize, 0, 24);
    return (textNodeContent(node) || " ")
      .split("\n")
      .reduce(
        (longest, line) =>
          Math.max(longest, measure(line, node.style, fontSize)),
        0,
      );
  }

  return 0;
}

/**
 * Intrinsic height of a text node when wrapped to `width`: rendered line
 * count × lineHeight, using the same line breaking the renderer paints with.
 * Percent fontSize has no stable basis before the box exists and resolves
 * against zero — use absolute font sizes on auto-height text.
 */
function textIntrinsicHeight(
  node: ResolvedNode,
  width: number,
  measure: MeasureTextLine,
): number {
  const fontSize = readLength(node.style.fontSize, 0, 24);
  const layout = prepareTextLayout(
    textNodeContent(node),
    width,
    fontSize,
    (line, size) => measure(line, node.style, size),
    {
      maxLines: node.style.maxLines,
      minFontSize: readLength(node.style.minFontSize, 0, 12),
      textFit: node.style.textFit,
      textOverflow: node.style.textOverflow,
      lineHeight: node.style.lineHeight,
    },
  );
  return layout.lines.length * layout.lineHeight;
}

function textNodeContent(node: Pick<ResolvedNode, "text" | "runs">): string {
  return node.text ?? node.runs?.map((run) => run.text).join("") ?? "";
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

function resolveLength(
  value: string | number | undefined,
  parent: number,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  return readLength(value, parent, fallback);
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

// Inline SVG badge so the sample scene exercises image assets without any
// network dependency. Kept tiny and deterministic.
const sampleBadgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><circle cx="80" cy="80" r="72" fill="#ffd166"/><circle cx="80" cy="80" r="56" fill="#101820"/><path d="M52 96 80 44l28 52H92l-12-24-12 24z" fill="#ffd166"/></svg>`;

export function sampleScene(): Scene {
  return composition({ width: 1080, height: 1920, fps: 30, duration: 120 })
    .asset({
      id: "badge",
      type: "image",
      src: `data:image/svg+xml;base64,${toBase64(sampleBadgeSvg)}`,
    })
    .children(
      div({
        id: "background",
        duration: 120,
        style: {
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #101820 0%, #244f46 100%)",
        },
      }),
      img("badge", {
        id: "badge-mark",
        duration: 120,
        style: {
          position: "absolute",
          left: 460,
          top: 360,
          width: 160,
          height: 160,
          objectFit: "contain",
        },
      }).animate("opacity", [
        { frame: 0, value: 0 },
        { frame: 18, value: 1, easing: "easeOut" },
      ]),
      div({
        id: "subtitle-wrap",
        duration: 120,
        style: {
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 160,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        },
      }).children(
        text("Forge motion in the browser", {
          id: "subtitle",
          duration: 120,
          style: {
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 76,
            fontWeight: 800,
            color: "#ffffff",
            textAlign: "center",
            textShadow: "0 6px 28px rgba(0,0,0,0.45)",
          },
        }).animate("opacity", [
          { frame: 0, value: 0 },
          { frame: 12, value: 1, easing: "easeOut" },
          { frame: 100, value: 1 },
          { frame: 119, value: 0, easing: "easeIn" },
        ]),
      ),
    )
    .toJSON();
}

/** Base64 that works in browsers (btoa) and Node (Buffer) without DOM types. */
function toBase64(value: string): string {
  const globalScope = globalThis as {
    btoa?: (data: string) => string;
    Buffer?: {
      from(
        data: string,
        encoding: string,
      ): { toString(encoding: string): string };
    };
  };

  if (typeof globalScope.btoa === "function") {
    return globalScope.btoa(value);
  }

  if (globalScope.Buffer) {
    return globalScope.Buffer.from(value, "utf-8").toString("base64");
  }

  throw new Error("No base64 encoder available in this environment.");
}
