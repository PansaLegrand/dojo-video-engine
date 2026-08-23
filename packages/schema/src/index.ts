import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const supportedStyleKeys = [
  "display",
  "flexDirection",
  "justifyContent",
  "alignItems",
  "gap",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "padding",
  "margin",
  "position",
  "left",
  "right",
  "top",
  "bottom",
  "inset",
  "background",
  "backgroundColor",
  "border",
  "borderRadius",
  "boxShadow",
  "overflow",
  "opacity",
  "filter",
  "zIndex",
  "transform",
  "transformOrigin",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "color",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textShadow",
  "textStroke",
  "maxLines",
  "minFontSize",
  "textFit",
  "textOverflow",
  "textBackgroundColor",
  "textBackgroundPadding",
  "textBackgroundPaddingX",
  "textBackgroundPaddingY",
  "textBackgroundRadius",
  "objectFit",
  "objectPosition",
  "imageRendering",
  "pixelSize",
] as const;

export type SupportedStyleKey = (typeof supportedStyleKeys)[number];

const lengthValueSchema = z.union([z.number(), z.string()]);

export const styleSchema = z
  .object({
    display: z.literal("flex").optional(),
    flexDirection: z.enum(["row", "column"]).optional(),
    justifyContent: z
      .enum(["flex-start", "center", "flex-end", "space-between"])
      .optional(),
    alignItems: z
      .enum(["flex-start", "center", "flex-end", "stretch"])
      .optional(),
    gap: lengthValueSchema.optional(),
    width: lengthValueSchema.optional(),
    height: lengthValueSchema.optional(),
    minWidth: lengthValueSchema.optional(),
    minHeight: lengthValueSchema.optional(),
    maxWidth: lengthValueSchema.optional(),
    maxHeight: lengthValueSchema.optional(),
    padding: lengthValueSchema.optional(),
    margin: lengthValueSchema.optional(),
    position: z.enum(["relative", "absolute"]).optional(),
    left: lengthValueSchema.optional(),
    right: lengthValueSchema.optional(),
    top: lengthValueSchema.optional(),
    bottom: lengthValueSchema.optional(),
    inset: lengthValueSchema.optional(),
    background: z.string().optional(),
    backgroundColor: z.string().optional(),
    border: z.string().optional(),
    borderRadius: lengthValueSchema.optional(),
    boxShadow: z.string().optional(),
    overflow: z.enum(["visible", "hidden"]).optional(),
    opacity: z.number().min(0).max(1).optional(),
    filter: z
      .string()
      .refine(isFilterExpression, {
        message:
          "filter must be `none` or a space-separated chain of brightness()/contrast()/saturate()/grayscale()/sepia()/invert()/opacity() with a number or percentage, hue-rotate(<deg>), and blur(<px>).",
      })
      .optional(),
    zIndex: z.number().int().optional(),
    transform: z.string().optional(),
    transformOrigin: z.string().optional(),
    fontFamily: z.string().optional(),
    fontSize: lengthValueSchema.optional(),
    fontWeight: z.union([z.number(), z.string()]).optional(),
    fontStyle: z.enum(["normal", "italic"]).optional(),
    color: z.string().optional(),
    lineHeight: z.union([z.number(), z.string()]).optional(),
    letterSpacing: lengthValueSchema.optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(),
    textShadow: z.string().optional(),
    textStroke: z.string().optional(),
    maxLines: z.number().int().positive().optional(),
    minFontSize: lengthValueSchema.optional(),
    textFit: z.enum(["wrap", "shrink", "truncate"]).optional(),
    textOverflow: z.enum(["clip", "ellipsis"]).optional(),
    textBackgroundColor: z.string().optional(),
    textBackgroundPadding: lengthValueSchema.optional(),
    textBackgroundPaddingX: lengthValueSchema.optional(),
    textBackgroundPaddingY: lengthValueSchema.optional(),
    textBackgroundRadius: lengthValueSchema.optional(),
    objectFit: z
      .enum(["contain", "cover", "fill", "none", "scale-down"])
      .optional(),
    objectPosition: z.string().optional(),
    imageRendering: z.enum(["auto", "pixelated"]).optional(),
    pixelSize: z.number().min(1).max(256).optional(),
  })
  .strict({
    message:
      "Unsupported style property. MotionForge Scene v1 supports a curated CSS-like subset; move unsupported behavior into supported transforms, layout, or extension nodes.",
  });

export type SceneStyle = z.infer<typeof styleSchema>;

const filterFunctionPattern =
  /^(?:(?:brightness|contrast|saturate|grayscale|sepia|invert|opacity)\(\s*\d+(?:\.\d+)?%?\s*\)|hue-rotate\(\s*-?\d+(?:\.\d+)?deg\s*\)|blur\(\s*\d+(?:\.\d+)?px\s*\))$/;

/**
 * Validates a filter expression: `none` or a space-separated chain of
 * brightness()/contrast()/saturate()/grayscale()/sepia()/invert()/opacity()
 * (number or percentage), hue-rotate(<deg>), and blur(<px>). This is the
 * subset Canvas2D `context.filter` accepts with deterministic output.
 */
export function isFilterExpression(value: string): boolean {
  const trimmed = value.trim();

  if (trimmed === "none") {
    return true;
  }

  const parts = trimmed.split(/\s+(?![^(]*\))/).filter(Boolean);

  return (
    parts.length > 0 && parts.every((part) => filterFunctionPattern.test(part))
  );
}

export const namedEasings = [
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
] as const;

/**
 * Validates an easing expression: a named easing, `cubic-bezier(x1, y1, x2,
 * y2)` with x1/x2 in [0, 1], or `spring`/`spring(bounce)` with bounce in
 * [0, 1).
 */
export function isEasingExpression(value: string): boolean {
  if ((namedEasings as readonly string[]).includes(value)) {
    return true;
  }

  const bezier = value.match(
    /^cubic-bezier\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/,
  );

  if (bezier) {
    const x1 = Number.parseFloat(bezier[1] ?? "");
    const x2 = Number.parseFloat(bezier[3] ?? "");
    return x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1;
  }

  const spring = value.match(/^spring(?:\(\s*(\d+(?:\.\d+)?)\s*\))?$/);

  if (spring) {
    const bounce =
      spring[1] === undefined ? 0.25 : Number.parseFloat(spring[1]);
    return bounce >= 0 && bounce < 1;
  }

  return false;
}

export const keyframeSchema = z.object({
  frame: z.number().int().nonnegative(),
  value: z.union([z.number(), z.string()]),
  easing: z
    .string()
    .refine(isEasingExpression, {
      message:
        "Easing must be linear/easeIn/easeOut/easeInOut, cubic-bezier(x1, y1, x2, y2) with x1 and x2 in [0, 1], or spring(bounce) with bounce in [0, 1).",
    })
    .optional(),
});

export const animationSchema = z
  .object({
    kind: z.literal("keyframes"),
    property: z.string().min(1),
    frames: z.array(keyframeSchema).min(1),
  })
  .superRefine((animation, ctx) => {
    for (let index = 1; index < animation.frames.length; index += 1) {
      const previous = animation.frames[index - 1];
      const current = animation.frames[index];

      if (previous && current && current.frame <= previous.frame) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["frames", index, "frame"],
          message: `Keyframe frames must be strictly increasing; frame ${current.frame} follows frame ${previous.frame}. Sort the frames and merge duplicates.`,
        });
      }
    }
  });

export type SceneAnimation = z.infer<typeof animationSchema>;

export const volumeEnvelopePointSchema = z.object({
  frame: z.number().int().nonnegative(),
  value: z.number().min(0).max(1),
  easing: z
    .string()
    .refine(isEasingExpression, {
      message:
        "Easing must be linear/easeIn/easeOut/easeInOut, cubic-bezier(x1, y1, x2, y2) with x1 and x2 in [0, 1], or spring(bounce) with bounce in [0, 1).",
    })
    .optional(),
});

export const volumeEnvelopeSchema = z
  .array(volumeEnvelopePointSchema)
  .min(1)
  .superRefine((envelope, ctx) => {
    for (let index = 1; index < envelope.length; index += 1) {
      const previous = envelope[index - 1];
      const current = envelope[index];

      if (previous && current && current.frame <= previous.frame) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "frame"],
          message: `Volume envelope frames must be strictly increasing; frame ${current.frame} follows frame ${previous.frame}. Sort the points and merge duplicates.`,
        });
      }
    }
  });

export type VolumeEnvelope = z.infer<typeof volumeEnvelopeSchema>;

export const effectNames = [
  "cartoonBurst",
  "confettiBurst",
  "cloudPop",
  "speedLines",
  "neonAura",
  "scribbleCircle",
  "spectrumBars",
  "cassetteVuMeter",
  "waveformLine",
  "mirrorBars",
  "circularSpectrum",
  "neonWaveform",
  "pulseRings",
  "particleGalaxy",
  "albumCoverPulse",
  "audioBlob",
  "starfieldTunnel",
  "equalizerGrid",
  "liquidGradient",
  "kaleidoscope",
  "vinylRecord",
  "audioTerrain",
  "lightningArc",
  "minimalLineArt",
] as const;

// Effects that read per-frame audio spectra. resolveAssets() analyzes only the
// audio assets referenced by these, and each requires params.audioAssetId.
export const audioReactiveEffectNames = [
  "spectrumBars",
  "cassetteVuMeter",
  "waveformLine",
  "mirrorBars",
  "circularSpectrum",
  "neonWaveform",
  "pulseRings",
  "particleGalaxy",
  "albumCoverPulse",
  "audioBlob",
  "starfieldTunnel",
  "equalizerGrid",
  "liquidGradient",
  "kaleidoscope",
  "vinylRecord",
  "audioTerrain",
  "lightningArc",
  "minimalLineArt",
] as const;

export function isAudioReactiveEffect(
  effect: string | undefined,
): effect is (typeof audioReactiveEffectNames)[number] {
  return (audioReactiveEffectNames as readonly string[]).includes(effect ?? "");
}

export const effectParamsSchema = z
  .object({
    intensity: z.enum(["low", "medium", "high"]).optional(),
    seed: z.number().int().nonnegative().optional(),
    colors: z.array(z.string().min(1)).min(1).max(8).optional(),
    particleCount: z.number().int().min(1).max(240).optional(),
    shockwave: z.boolean().optional(),
    emoji: z.string().min(1).max(12).optional(),
    direction: z
      .enum(["left", "right", "up", "down", "in", "out", "diagonal"])
      .optional(),
    density: z.enum(["low", "medium", "high"]).optional(),
    loops: z.number().int().min(1).max(8).optional(),
    strokeWidth: z.number().min(1).max(80).optional(),
    radius: z.number().positive().optional(),
    wobble: z.number().min(0).max(1).optional(),
    pulse: z.number().min(0).max(1).optional(),
    scale: z.number().min(0.1).max(4).optional(),
    spread: z.number().min(0).max(1).optional(),
    softness: z.number().min(0).max(1).optional(),
    glow: z.number().min(0).max(1).optional(),
    scope: z.enum(["text", "frame"]).optional(),
    audioAssetId: z.string().min(1).optional(),
    coverAssetId: z.string().min(1).optional(),
    barCount: z.number().int().min(8).max(128).optional(),
    sensitivity: z.number().min(0.2).max(10).optional(),
    smoothing: z.boolean().optional(),
  })
  .strict({
    message:
      "Unsupported effect param. Use the documented params for this MotionForge effect preset.",
  });

export type SceneEffectName = (typeof effectNames)[number];
export type SceneEffectParams = z.infer<typeof effectParamsSchema>;

export const assetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["image", "video", "audio", "font", "lottie"]),
  src: z.string().min(1),
});

export type SceneAsset = z.infer<typeof assetSchema>;

export type SceneNodeInput = {
  id: string;
  type: "div" | "text" | "img" | "video" | "audio" | "lottie" | "effect";
  text?: string;
  assetId?: string;
  /** Effect nodes: named procedural visual preset rendered by the effect renderer. */
  effect?: SceneEffectName;
  /** Effect nodes: preset-specific parameters. */
  params?: SceneEffectParams;
  /** Video nodes: source trim offset in seconds (source footage has its own timebase, independent of scene fps). */
  videoStartTime?: number;
  /** Video and lottie nodes: playback speed multiplier (1 = natural speed). */
  playbackRate?: number;
  /** Audio nodes: source trim offset in seconds. */
  audioStartTime?: number;
  /**
   * Audio and video nodes: gain from 0 (silent) to 1 (natural), default 1.
   * A video node's clip audio is mixed into the export at this gain;
   * playbackRate also retimes the sound (pitch shifts — no time-stretch).
   */
  volume?: number;
  /**
   * Audio and video nodes: node-local gain curve multiplied by `volume`.
   * Frames are node-local, not source-local. Export and preview both sample it
   * during mixing, so fades and ducking affect sound rather than visuals.
   */
  volumeEnvelope?: VolumeEnvelope;
  /** Audio nodes: wrap source playback through the node's active window. */
  loop?: boolean;
  from?: number;
  duration?: number;
  style?: SceneStyle;
  animations?: SceneAnimation[];
  children?: SceneNodeInput[];
};

export type SceneNode = SceneNodeInput;

export const sceneNodeSchema: z.ZodType<SceneNodeInput> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1),
      type: z.enum([
        "div",
        "text",
        "img",
        "video",
        "audio",
        "lottie",
        "effect",
      ]),
      text: z.string().optional(),
      assetId: z.string().optional(),
      effect: z.enum(effectNames).optional(),
      params: effectParamsSchema.optional(),
      videoStartTime: z.number().nonnegative().optional(),
      playbackRate: z.number().positive().optional(),
      audioStartTime: z.number().nonnegative().optional(),
      volume: z.number().min(0).max(1).optional(),
      volumeEnvelope: volumeEnvelopeSchema.optional(),
      loop: z.boolean().optional(),
      from: z.number().int().default(0),
      duration: z.number().int().positive().optional(),
      style: styleSchema.default({}),
      animations: z.array(animationSchema).default([]),
      children: z.array(sceneNodeSchema).default([]),
    })
    .superRefine((node, ctx) => {
      if (node.type === "text" && typeof node.text !== "string") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["text"],
          message: "Text nodes require a `text` string.",
        });
      }

      if (node.type === "effect" && !node.effect) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["effect"],
          message: "Effect nodes require an `effect` preset name.",
        });
      }

      if (
        node.type === "effect" &&
        isAudioReactiveEffect(node.effect) &&
        !node.params?.audioAssetId
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["params", "audioAssetId"],
          message: `${node.effect} requires params.audioAssetId so preview and export analyze the same audio asset.`,
        });
      }

      if (node.type !== "effect" && node.effect !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["effect"],
          message: `effect only applies to effect nodes; remove it from this ${node.type} node.`,
        });
      }

      if (node.type !== "effect" && node.params !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["params"],
          message: `params only applies to effect nodes; remove it from this ${node.type} node.`,
        });
      }

      if (
        (node.type === "img" ||
          node.type === "video" ||
          node.type === "audio" ||
          node.type === "lottie") &&
        !node.assetId
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assetId"],
          message: `${node.type} nodes require an assetId that points at scene.assets.`,
        });
      }

      if (node.type !== "video" && node.videoStartTime !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["videoStartTime"],
          message: `videoStartTime only applies to video nodes; remove it from this ${node.type} node.`,
        });
      }

      if (
        node.type !== "video" &&
        node.type !== "lottie" &&
        node.playbackRate !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["playbackRate"],
          message: `playbackRate only applies to video and lottie nodes; remove it from this ${node.type} node.`,
        });
      }

      if (node.type !== "audio" && node.audioStartTime !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["audioStartTime"],
          message: `audioStartTime only applies to audio nodes; video nodes trim picture and sound together via videoStartTime. Remove it from this ${node.type} node.`,
        });
      }

      if (
        node.type !== "audio" &&
        node.type !== "video" &&
        (node.volume !== undefined || node.volumeEnvelope !== undefined)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: node.volume !== undefined ? ["volume"] : ["volumeEnvelope"],
          message: `volume and volumeEnvelope only apply to audio and video nodes; remove them from this ${node.type} node.`,
        });
      }

      if (node.type !== "audio" && node.loop !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["loop"],
          message: `loop only applies to audio nodes; remove it from this ${node.type} node.`,
        });
      }

      if (node.type === "audio") {
        if (Object.keys(node.style ?? {}).length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["style"],
            message:
              "Audio nodes are not visual; remove style (timeline placement uses from/duration).",
          });
        }

        if ((node.children ?? []).length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["children"],
            message: "Audio nodes cannot have children.",
          });
        }

        if ((node.animations ?? []).length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["animations"],
            message:
              "Audio nodes do not support animations yet; use volume or volumeEnvelope for sound gain.",
          });
        }
      }
    }),
);

const sceneDocumentFields = {
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  duration: z.number().int().positive(),
  assets: z.record(assetSchema).default({}),
  nodes: z.array(sceneNodeSchema).default([]),
};

type SceneDocumentForValidation = {
  assets: Record<string, SceneAsset>;
  nodes: SceneNodeInput[];
};

const nodeAssetTypes: Partial<
  Record<SceneNodeInput["type"], SceneAsset["type"]>
> = {
  img: "image",
  video: "video",
  audio: "audio",
  lottie: "lottie",
};

function validateSceneDocument(
  scene: SceneDocumentForValidation,
  ctx: z.RefinementCtx,
): void {
  for (const [id, asset] of Object.entries(scene.assets)) {
    if (id !== asset.id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assets", id],
        message: `Asset map key "${id}" must match asset.id "${asset.id}".`,
      });
    }
  }

  const seenNodeIds = new Set<string>();

  const validateAssetReference = (
    assetId: string,
    expectedType: SceneAsset["type"],
    path: Array<string | number>,
    owner: string,
  ): void => {
    const asset = scene.assets[assetId];
    if (!asset) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: `${owner} references missing asset "${assetId}". Add it to scene.assets or update the reference.`,
      });
      return;
    }

    if (asset.type !== expectedType) {
      const article =
        expectedType === "audio" || expectedType === "image" ? "an" : "a";
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: `${owner} requires ${article} ${expectedType} asset, but "${assetId}" is ${asset.type}. Use a ${expectedType} asset or change the node/effect.`,
      });
    }
  };

  const visit = (
    nodes: SceneNodeInput[],
    path: Array<string | number>,
  ): void => {
    nodes.forEach((node, index) => {
      const nodePath = [...path, index];
      if (seenNodeIds.has(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...nodePath, "id"],
          message: `Duplicate node id "${node.id}". Node ids must be unique across the scene so tools can patch and diff nodes reliably.`,
        });
      }

      seenNodeIds.add(node.id);

      const expectedAssetType = nodeAssetTypes[node.type];
      if (node.assetId && expectedAssetType) {
        validateAssetReference(
          node.assetId,
          expectedAssetType,
          [...nodePath, "assetId"],
          `${node.type} node "${node.id}"`,
        );
      }

      if (node.type === "effect" && node.params?.audioAssetId) {
        validateAssetReference(
          node.params.audioAssetId,
          "audio",
          [...nodePath, "params", "audioAssetId"],
          `${node.effect ?? "audio-reactive"} effect "${node.id}"`,
        );
      }

      if (node.type === "effect" && node.params?.coverAssetId) {
        validateAssetReference(
          node.params.coverAssetId,
          "image",
          [...nodePath, "params", "coverAssetId"],
          `${node.effect ?? "cover"} effect "${node.id}"`,
        );
      }

      visit(node.children ?? [], [...nodePath, "children"]);
    });
  };

  visit(scene.nodes, ["nodes"]);
}

/** Legacy 0.4-and-earlier scene document, accepted only through migration. */
export const legacySceneV0Schema = z
  .object({ schemaVersion: z.literal(0), ...sceneDocumentFields })
  .superRefine(validateSceneDocument);

/** Current canonical Scene v1 document. */
export const sceneSchema = z
  .object({ schemaVersion: z.literal(1), ...sceneDocumentFields })
  .superRefine(validateSceneDocument);

export type LegacySceneV0 = z.infer<typeof legacySceneV0Schema>;
export type Scene = z.infer<typeof sceneSchema>;
export type SceneInput = Scene | LegacySceneV0;

export const CURRENT_SCENE_VERSION = 1 as const;

export type SceneMigrationResult = {
  scene: Scene;
  fromVersion: 0 | 1;
  toVersion: typeof CURRENT_SCENE_VERSION;
  migrations: readonly string[];
};

export class SceneValidationError extends Error {
  constructor(readonly issues: z.ZodIssue[]) {
    super(formatSceneIssues(issues));
    this.name = "SceneValidationError";
  }
}

/**
 * Objects previously normalized by parseScene/validateScene/migrateScene.
 * Re-parsing the same input object returns its cached canonical v1 scene, so
 * frame loops never pay for validation or legacy migration more than once.
 * Parsed scenes must be treated as immutable — mutating one bypasses
 * re-validation by design.
 */
const normalizedScenes = new WeakMap<object, SceneMigrationResult>();

type SafeSceneMigrationResult =
  | { ok: true; result: SceneMigrationResult }
  | { ok: false; issues: z.ZodIssue[] };

function safeMigrateScene(input: unknown): SafeSceneMigrationResult {
  if (typeof input === "object" && input !== null) {
    const cached = normalizedScenes.get(input);
    if (cached) {
      return { ok: true, result: cached };
    }
  }

  const version =
    typeof input === "object" && input !== null && "schemaVersion" in input
      ? (input as { schemaVersion?: unknown }).schemaVersion
      : undefined;

  if (version === 0) {
    const legacy = legacySceneV0Schema.safeParse(input);
    if (!legacy.success) {
      return { ok: false, issues: legacy.error.issues };
    }

    const migrated = sceneSchema.safeParse({
      ...legacy.data,
      schemaVersion: CURRENT_SCENE_VERSION,
    });
    if (!migrated.success) {
      return { ok: false, issues: migrated.error.issues };
    }

    return {
      ok: true,
      result: {
        scene: migrated.data,
        fromVersion: 0,
        toVersion: CURRENT_SCENE_VERSION,
        migrations: ["scene-v0-to-v1"],
      },
    };
  }

  if (version === CURRENT_SCENE_VERSION) {
    const current = sceneSchema.safeParse(input);
    return current.success
      ? {
          ok: true,
          result: {
            scene: current.data,
            fromVersion: CURRENT_SCENE_VERSION,
            toVersion: CURRENT_SCENE_VERSION,
            migrations: [],
          },
        }
      : { ok: false, issues: current.error.issues };
  }

  return {
    ok: false,
    issues: [
      {
        code: z.ZodIssueCode.custom,
        path: ["schemaVersion"],
        message:
          version === undefined
            ? `Scene schemaVersion is required. Use ${CURRENT_SCENE_VERSION} for new scenes or 0 for automatic migration.`
            : `Unsupported scene schemaVersion ${JSON.stringify(version)}. This build supports canonical version ${CURRENT_SCENE_VERSION} and migration from version 0.`,
      },
    ],
  };
}

function cacheNormalizedScene(
  input: unknown,
  result: SceneMigrationResult,
): void {
  normalizedScenes.set(result.scene, {
    scene: result.scene,
    fromVersion: CURRENT_SCENE_VERSION,
    toVersion: CURRENT_SCENE_VERSION,
    migrations: [],
  });
  if (typeof input === "object" && input !== null) {
    normalizedScenes.set(input, result);
  }
}

/**
 * Validates and deterministically migrates a legacy v0 or current v1 scene to
 * canonical Scene v1. The input is never mutated.
 */
export function migrateScene(input: unknown): SceneMigrationResult {
  const migrated = safeMigrateScene(input);
  if (!migrated.ok) {
    throw new SceneValidationError(migrated.issues);
  }

  cacheNormalizedScene(input, migrated.result);
  return migrated.result;
}

export function parseScene(input: unknown): Scene {
  return migrateScene(input).scene;
}

export function validateScene(
  input: unknown,
): { ok: true; scene: Scene } | { ok: false; errors: string[] } {
  const migrated = safeMigrateScene(input);
  if (migrated.ok) {
    cacheNormalizedScene(input, migrated.result);
    return { ok: true, scene: migrated.result.scene };
  }

  return {
    ok: false,
    errors: migrated.issues.map(formatSceneIssue),
  };
}

function formatSceneIssue(issue: z.ZodIssue): string {
  const keys =
    issue.code === z.ZodIssueCode.unrecognized_keys
      ? ` Unsupported key(s): ${issue.keys.join(", ")}.`
      : "";
  return `${issue.path.join(".") || "scene"}: ${issue.message}${keys}`;
}

function formatSceneIssues(issues: z.ZodIssue[]): string {
  return issues.map(formatSceneIssue).join("\n");
}

/**
 * JSON Schema (draft-07) for the scene document, so editors and agents can
 * validate scenes without executing motionforge code. Covers structure only;
 * cross-field invariants (unique node ids, asset key = asset.id, text/assetId
 * requirements per node type) are enforced by parseScene/validateScene.
 */
export function sceneJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(sceneSchema, {
    name: "MotionforgeScene",
    target: "jsonSchema7",
  }) as Record<string, unknown>;
}

/** Structural JSON Schema for legacy v0 ingestion and migration tooling. */
export function legacySceneV0JsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(legacySceneV0Schema, {
    name: "MotionforgeSceneV0",
    target: "jsonSchema7",
  }) as Record<string, unknown>;
}

export {
  applyScenePatch,
  closestIds,
  sceneOpSchema,
  scenePatchSchema,
  type ApplyScenePatchResult,
  type SceneOp,
  type ScenePatch,
  type ScenePatchError,
} from "./patch.js";

export {
  inspectScene,
  lintScene,
  type SceneInspection,
  type SceneLintIssue,
  type SceneLintResult,
} from "./inspect.js";
