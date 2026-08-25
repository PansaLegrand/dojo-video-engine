import type {
  Scene,
  SceneAnimation,
  SceneAnimationTarget,
  SceneNode,
  SceneOp,
  ScenePatch,
} from "@motionforge/schema";
import {
  applyScenePatch,
  isEasingExpression,
  isFilterExpression,
  parseScene,
  repairSceneInput,
  supportedStyleKeys,
  validateScene,
} from "@motionforge/schema";
import {
  audioOverlay,
  fadeUp,
  imageOverlay,
  popIn,
  slideIn,
  styledSubtitles,
  styledCaptions,
  timeline,
  videoOverlay,
  type CaptionTemplateKey,
  type CaptionWord,
  type AudioOverlayTemplateKey,
  type ImageOverlayPlacement,
  type ImageOverlayTemplateKey,
  type VideoOverlayPlacement,
  type VideoOverlayTemplateKey,
} from "@motionforge/presets";
import type { ChatMediaAssetManifestItem } from "../media/assets";
import { compileMediaInstruction } from "../media/instruction-compiler";
import { parseMediaMentions } from "../media/mentions";
import { repairMediaPatch } from "../media/patch-repair";
import type { MediaOperationPlan } from "../media/plan";

export type MotionforgeAgentResult = {
  mode: "scene" | "patch";
  scene: Scene;
  patch?: ScenePatch;
  summary: string;
  source: "local" | "model";
  diagnostics: string[];
  mediaPlan?: MediaOperationPlan;
};

type Theme = {
  background: string;
  panel: string;
  title: string;
  body: string;
  accent: string;
  accent2: string;
};

type FirstDraftChoreographyId =
  | "accent-panel"
  | "eyebrow"
  | "title"
  | "subtitle"
  | "caption";

const themes = {
  bright: {
    background:
      "linear-gradient(180deg, #f8fafc 0%, #d9f4f2 46%, #ffe4e6 100%)",
    panel: "rgba(255,255,255,0.84)",
    title: "#111827",
    body: "#475569",
    accent: "#0f766e",
    accent2: "#e11d48",
  },
  launch: {
    background:
      "linear-gradient(180deg, #0f172a 0%, #0f766e 54%, #f43f5e 100%)",
    panel: "rgba(15,23,42,0.54)",
    title: "#ffffff",
    body: "#d9f4f2",
    accent: "#5eead4",
    accent2: "#fb7185",
  },
  calm: {
    background:
      "linear-gradient(180deg, #f6f7fb 0%, #dcecff 50%, #e7f8ef 100%)",
    panel: "rgba(255,255,255,0.86)",
    title: "#18212f",
    body: "#526071",
    accent: "#2563eb",
    accent2: "#16a34a",
  },
  punch: {
    background:
      "linear-gradient(180deg, #18181b 0%, #4c1d95 42%, #fb7185 100%)",
    panel: "rgba(24,24,27,0.56)",
    title: "#ffffff",
    body: "#f5d0fe",
    accent: "#facc15",
    accent2: "#22d3ee",
  },
} satisfies Record<"bright" | "launch" | "calm" | "punch", Theme>;

export function createSceneFromInstruction(instruction: string): Scene {
  const normalized = instruction.toLowerCase();

  if (isSubtitleGalleryPrompt(normalized)) {
    return createSubtitleTemplateGalleryScene();
  }

  const theme = selectTheme(normalized);
  const title = titleFromInstruction(instruction);
  const subtitle = subtitleFromInstruction(instruction);
  const isLandscape =
    normalized.includes("landscape") || normalized.includes("youtube");
  const width = isLandscape ? 1280 : 1080;
  const height = isLandscape ? 720 : 1920;
  const duration = normalized.includes("3 second")
    ? 90
    : normalized.includes("6 second")
      ? 180
      : 150;
  const titleTop = isLandscape ? 220 : 704;
  const panelTop = isLandscape ? 132 : 492;
  const panelHeight = isLandscape ? 420 : 790;
  const titleSize = isLandscape ? 58 : title.length > 28 ? 72 : 86;
  const choreography = createFirstDraftChoreography();

  return parseScene({
    schemaVersion: 1,
    width,
    height,
    fps: 30,
    duration,
    assets: {},
    nodes: [
      {
        id: "bg",
        type: "div",
        from: 0,
        duration,
        style: {
          width: "100%",
          height: "100%",
          background: theme.background,
        },
      },
      {
        id: "accent-panel",
        type: "div",
        from: 0,
        duration,
        style: {
          position: "absolute",
          left: Math.round(width * 0.07),
          right: Math.round(width * 0.07),
          top: panelTop,
          height: panelHeight,
          backgroundColor: theme.panel,
          border: "2px solid rgba(255,255,255,0.22)",
          borderRadius: isLandscape ? 34 : 48,
          boxShadow: "0 30px 76px rgba(15,23,42,0.24)",
        },
        animations: choreography["accent-panel"] ?? [],
      },
      {
        id: "eyebrow",
        type: "text",
        text: "MOTIONFORGE",
        from: 0,
        duration,
        style: {
          position: "absolute",
          left: Math.round(width * 0.1),
          right: Math.round(width * 0.1),
          top: isLandscape ? 180 : 625,
          fontSize: isLandscape ? 24 : 34,
          fontWeight: 850,
          letterSpacing: isLandscape ? 6 : 8,
          color: theme.accent,
          textAlign: "center",
        },
        animations: choreography.eyebrow ?? [],
      },
      {
        id: "title",
        type: "text",
        text: title,
        from: 0,
        duration,
        style: {
          position: "absolute",
          left: Math.round(width * 0.11),
          right: Math.round(width * 0.11),
          top: titleTop,
          fontSize: titleSize,
          fontWeight: 900,
          lineHeight: 1.04,
          color: theme.title,
          textAlign: "center",
        },
        animations: choreography.title ?? [],
      },
      {
        id: "subtitle",
        type: "text",
        text: subtitle,
        from: 0,
        duration,
        style: {
          position: "absolute",
          left: Math.round(width * 0.13),
          right: Math.round(width * 0.13),
          top: isLandscape ? 390 : 1010,
          fontSize: isLandscape ? 28 : 42,
          lineHeight: 1.18,
          color: theme.body,
          textAlign: "center",
        },
        animations: choreography.subtitle ?? [],
      },
      firstDraftCaptionNode({
        instruction: normalized,
        width,
        top: isLandscape ? 535 : 1190,
        isLandscape,
        duration,
        accent: theme.accent2,
        animations: choreography.caption ?? [],
      }),
    ],
  });
}

function createFirstDraftChoreography(): Record<
  FirstDraftChoreographyId,
  SceneAnimation[]
> {
  const compiled = timeline()
    .add(
      "accent-panel",
      fadeUp({
        distance: 48,
        durationInFrames: 20,
        easing: "spring(0.2)",
      }),
      { at: 0 },
    )
    .add("eyebrow", fadeUp({ distance: 18, durationInFrames: 14 }), {
      after: "accent-panel",
      overlap: 14,
    })
    .add(
      "title",
      popIn({
        durationInFrames: 22,
        fromScale: 0.84,
        easing: "spring(0.34)",
      }),
      { after: "eyebrow", overlap: 8 },
    )
    .add(
      "subtitle",
      slideIn("down", {
        distance: 30,
        durationInFrames: 16,
        easing: "easeOut",
      }),
      { after: "title", overlap: 4 },
    )
    .add(
      "caption",
      popIn({
        durationInFrames: 16,
        fromScale: 0.88,
        easing: "spring(0.24)",
      }),
      { after: "subtitle", overlap: 6 },
    )
    .compile();

  return {
    "accent-panel": compiled["accent-panel"] ?? [],
    eyebrow: compiled.eyebrow ?? [],
    title: compiled.title ?? [],
    subtitle: compiled.subtitle ?? [],
    caption: compiled.caption ?? [],
  };
}

export function createPatchFromInstruction(
  scene: Scene,
  instruction: string,
  mediaAssets: ChatMediaAssetManifestItem[] = [],
): ScenePatch {
  const normalized = instruction.toLowerCase();
  const ops: SceneOp[] = [];
  const ids = collectNodeIds(scene);
  const titleId = ids.find((id) => /title/i.test(id)) ?? firstTextId(scene);
  const subtitleId =
    ids.find((id) => /subtitle|caption/i.test(id)) ?? firstTextId(scene);
  const bgId = ids.find((id) => /bg|background/i.test(id));
  const panelId = ids.find((id) => /panel|card|accent/i.test(id));
  const imageOverlayIntent = selectImageOverlayIntent(normalized);
  const videoOverlayIntent = selectVideoOverlayIntent(normalized);
  const audioOverlayIntent = selectAudioOverlayIntent(normalized, scene.fps);

  if (imageOverlayIntent) {
    const imageAsset = selectImageAssetForInstruction(
      scene,
      instruction,
      mediaAssets,
    );

    if (imageAsset) {
      if (!scene.assets[imageAsset.assetId]) {
        ops.push({
          op: "setAsset",
          asset: imageAsset.asset,
        });
      }

      ops.push({
        op: "insertNode",
        node: imageOverlay({
          template: imageOverlayIntent.template,
          id: uniqueNodeId(scene, `${imageOverlayIntent.template}-overlay`),
          assetId: imageAsset.assetId,
          composition: { width: scene.width, height: scene.height },
          from: 0,
          duration: scene.duration,
          ...(imageOverlayIntent.placement
            ? { placement: imageOverlayIntent.placement }
            : {}),
        }),
      });
    }
  }

  if (videoOverlayIntent) {
    const videoAsset = selectVideoAssetForInstruction(
      scene,
      instruction,
      mediaAssets,
    );

    if (videoAsset) {
      if (!scene.assets[videoAsset.assetId]) {
        ops.push({
          op: "setAsset",
          asset: videoAsset.asset,
        });
      }

      ops.push({
        op: "insertNode",
        node: videoOverlay({
          template: videoOverlayIntent.template,
          id: uniqueNodeId(scene, `${videoOverlayIntent.template}-overlay`),
          assetId: videoAsset.assetId,
          composition: { width: scene.width, height: scene.height },
          from: 0,
          duration: scene.duration,
          ...(videoOverlayIntent.placement
            ? { placement: videoOverlayIntent.placement }
            : {}),
        }),
      });
    }
  }

  if (audioOverlayIntent) {
    const audioAsset = selectAudioAssetForInstruction(
      scene,
      instruction,
      mediaAssets,
    );

    if (audioAsset) {
      if (!scene.assets[audioAsset.assetId]) {
        ops.push({
          op: "setAsset",
          asset: audioAsset.asset,
        });
      }

      ops.push({
        op: "insertNode",
        node: audioOverlay({
          template: audioOverlayIntent.template,
          id: uniqueNodeId(scene, `${audioOverlayIntent.template}-overlay`),
          assetId: audioAsset.assetId,
          from: audioOverlayIntent.from ?? 0,
          ...audioOverlayDurationOptions(audioOverlayIntent, scene.duration),
          volume: audioOverlayIntent.volume,
        }),
      });
    }
  }

  if (
    normalized.includes("bigger") ||
    normalized.includes("larger") ||
    normalized.includes("huge")
  ) {
    const current = getNodeStyleNumber(scene, titleId, "fontSize", 72);
    if (titleId) {
      ops.push({
        op: "setStyle",
        id: titleId,
        style: { fontSize: Math.min(144, Math.round(current * 1.22)) },
      });
    }
  }

  const quoted = instruction.match(/["“](.+?)["”]/)?.[1];
  if (
    quoted &&
    titleId &&
    /(title|say|text|headline|write)/i.test(instruction)
  ) {
    ops.push({ op: "setText", id: titleId, text: quoted });
  }

  if (normalized.includes("caption") || normalized.includes("subtitle")) {
    const template = selectCaptionTemplate(normalized);

    if (template) {
      ops.push({
        op: "insertNode",
        node: chatCaptionTemplateNode({
          fps: scene.fps,
          idPrefix: uniqueCaptionPrefix(scene, `${template}-captions`),
          template,
        }),
      });
    } else if (subtitleId) {
      ops.push({
        op: "setText",
        id: subtitleId,
        text: quoted ?? "Clean captions, timed for the edit",
      });
      ops.push({
        op: "setStyle",
        id: subtitleId,
        style: {
          top: Math.round(scene.height * 0.76),
          fontSize: Math.round(scene.height * 0.028),
          fontWeight: 900,
          color: "#ffffff",
          textStroke: "6px rgba(0,0,0,0.72)",
          textBackgroundColor: "#e11d48",
          textBackgroundPaddingX: 34,
          textBackgroundPaddingY: 18,
          textBackgroundRadius: 28,
        },
      });
    }
  }

  if (
    normalized.includes("color") ||
    normalized.includes("palette") ||
    normalized.includes("coral") ||
    normalized.includes("teal") ||
    normalized.includes("dark") ||
    normalized.includes("calm")
  ) {
    const theme = selectTheme(normalized);
    if (bgId) {
      ops.push({
        op: "setStyle",
        id: bgId,
        style: { background: theme.background },
      });
    }
    if (panelId) {
      ops.push({
        op: "setStyle",
        id: panelId,
        style: { backgroundColor: theme.panel },
      });
    }
    if (titleId) {
      ops.push({ op: "setStyle", id: titleId, style: { color: theme.title } });
    }
    if (subtitleId) {
      ops.push({
        op: "setStyle",
        id: subtitleId,
        style: { color: theme.body },
      });
    }
  }

  if (
    normalized.includes("animate") ||
    normalized.includes("motion") ||
    normalized.includes("pop") ||
    normalized.includes("spring")
  ) {
    if (titleId) {
      ops.push({
        op: "setAnimations",
        id: titleId,
        animations: [
          keyframes("opacity", [
            [0, 0],
            [10, 1, "easeOut"],
          ]),
          keyframes("transform", [
            [0, "translate(0px, 46px) scale(0.78)"],
            [18, "translate(0px, 0px) scale(1.08)", "spring(0.42)"],
            [28, "translate(0px, 0px) scale(1)", "easeOut"],
          ]),
        ],
      });
    }
  }

  if (normalized.includes("faster") || normalized.includes("shorter")) {
    ops.push({
      op: "setSceneMeta",
      duration: Math.max(75, Math.round(scene.duration * 0.75)),
    });
  } else if (normalized.includes("slower") || normalized.includes("longer")) {
    ops.push({
      op: "setSceneMeta",
      duration: Math.min(300, Math.round(scene.duration * 1.25)),
    });
  }

  if (
    ops.length === 0 &&
    titleId &&
    !imageOverlayIntent &&
    !videoOverlayIntent &&
    !audioOverlayIntent
  ) {
    ops.push({
      op: "setText",
      id: titleId,
      text: titleFromInstruction(instruction),
    });
  }

  return ops;
}

const chatCaptionWords: CaptionWord[] = [
  { word: "WORDS", startMs: 450, endMs: 900 },
  { word: "LAND", startMs: 900, endMs: 1350 },
  { word: "RIGHT", startMs: 1350, endMs: 1900 },
  { word: "ON", startMs: 1900, endMs: 2250 },
  { word: "THE", startMs: 2250, endMs: 2600 },
  { word: "BEAT", startMs: 2600, endMs: 3350 },
];

const subtitleGalleryTemplates: CaptionTemplateKey[] = [
  "classic",
  "minimalBar",
  "handwritten",
  "retro",
  "cinematic",
  "storyteller",
  "hustle",
  "spotlight",
  "karaoke",
  "neon",
  "future",
  "terminal",
  "colorShift",
];

const subtitleGalleryWords: CaptionWord[] = [
  { word: "FORGE", startMs: 0, endMs: 420 },
  { word: "THE", startMs: 420, endMs: 700 },
  { word: "CAPTION", startMs: 700, endMs: 1180 },
  { word: "STYLE", startMs: 1180, endMs: 1680 },
];

function createSubtitleTemplateGalleryScene(): Scene {
  const width = 1080;
  const height = 1920;
  const fps = 30;
  const duration = 150;

  return parseScene({
    schemaVersion: 1,
    width,
    height,
    fps,
    duration,
    assets: {},
    nodes: [
      {
        id: "bg",
        type: "div",
        from: 0,
        duration,
        style: {
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #101820 0%, #18212f 100%)",
        },
      },
      {
        id: "title",
        type: "text",
        text: "Subtitle Templates",
        from: 0,
        duration,
        style: {
          position: "absolute",
          left: 64,
          right: 64,
          top: 56,
          height: 76,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 58,
          fontWeight: 900,
          color: "#ffffff",
          textAlign: "center",
        },
        animations: popIn({
          fromScale: 0.9,
          durationInFrames: 14,
          easing: "spring(0.24)",
        }),
      },
      {
        id: "subtitle",
        type: "text",
        text: "Native MotionForge presets for captions and text overlays",
        from: 0,
        duration,
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 134,
          height: 44,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 26,
          color: "#b8d8d8",
          textAlign: "center",
        },
        animations: fadeUp({ distance: 18, durationInFrames: 14, delay: 5 }),
      },
      ...subtitleGalleryTemplates.map((template, index) =>
        subtitleTemplateGalleryCard(template, index, duration, fps),
      ),
    ],
  });
}

function subtitleTemplateGalleryCard(
  template: CaptionTemplateKey,
  index: number,
  duration: number,
  fps: number,
): SceneNode {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const left = column === 0 ? 56 : 552;
  const top = 220 + row * 226;
  const cardHeight = 192;
  const id = `template-${template}`;
  const delay = 8 + index * 2;

  return {
    id,
    type: "div",
    from: 0,
    duration,
    style: {
      position: "absolute",
      left,
      top,
      width: 472,
      height: cardHeight,
      background:
        column === 0
          ? "linear-gradient(135deg, rgba(255,255,255,0.11) 0%, rgba(94,234,212,0.08) 100%)"
          : "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(251,113,133,0.08) 100%)",
      border: "1px solid rgba(255,255,255,0.18)",
      borderRadius: 18,
      boxShadow: "0 18px 44px rgba(0,0,0,0.22)",
      opacity: 0,
      transform: "translate(0px, 26px)",
    },
    animations: [
      {
        kind: "keyframes",
        property: "opacity",
        frames: [
          { frame: 0, value: 0 },
          { frame: delay, value: 0 },
          { frame: delay + 10, value: 1, easing: "easeOut" },
        ],
      },
      {
        kind: "keyframes",
        property: "transform",
        frames: [
          { frame: 0, value: "translate(0px, 26px)" },
          { frame: delay, value: "translate(0px, 26px)" },
          {
            frame: delay + 14,
            value: "translate(0px, 0px)",
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        ],
      },
    ],
    children: [
      {
        id: `${id}-label`,
        type: "text",
        text: templateLabel(template),
        from: 0,
        duration,
        style: {
          position: "absolute",
          left: 22,
          top: 18,
          width: 428,
          height: 28,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 22,
          fontWeight: 850,
          letterSpacing: 1.4,
          color: "#b8d8d8",
          textAlign: "left",
        },
      },
      styledSubtitles(subtitleGalleryWords, {
        fps,
        template,
        idPrefix: `${id}-sample`,
        area: { top: 58, height: 108 },
        renderMode:
          template === "hustle" || template === "spotlight"
            ? "word"
            : undefined,
        maxWordsPerSegment: 4,
        maxSegmentDurationMs: 2400,
        style: { fontSize: galleryFontSize(template) },
      }),
    ],
  };
}

function galleryFontSize(template: CaptionTemplateKey): number {
  if (template === "hustle" || template === "spotlight") {
    return 44;
  }

  if (template === "handwritten") {
    return 48;
  }

  return 38;
}

function templateLabel(template: CaptionTemplateKey): string {
  return template
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function isSubtitleGalleryPrompt(instruction: string): boolean {
  return (
    (instruction.includes("subtitle") || instruction.includes("caption")) &&
    (instruction.includes("gallery") ||
      instruction.includes("all") ||
      instruction.includes("preview"))
  );
}

function firstDraftCaptionNode(options: {
  instruction: string;
  width: number;
  top: number;
  isLandscape: boolean;
  duration: number;
  accent: string;
  animations: SceneAnimation[];
}): SceneNode {
  const template = selectCaptionTemplate(options.instruction);

  if (template) {
    const node = chatCaptionTemplateNode({
      fps: 30,
      idPrefix: "caption",
      template,
      area: {
        top: options.isLandscape ? 500 : 1180,
        height: options.isLandscape ? 150 : 280,
      },
    });
    return {
      ...node,
      animations: options.animations,
    };
  }

  return {
    id: "caption",
    type: "text",
    text: options.instruction.includes("caption")
      ? "Words land right on the beat"
      : "Preview now. Export when ready.",
    from: 0,
    duration: options.duration,
    style: {
      position: "absolute",
      left: Math.round(options.width * 0.18),
      right: Math.round(options.width * 0.18),
      top: options.top,
      fontSize: options.isLandscape ? 30 : 40,
      fontWeight: 850,
      color: "#ffffff",
      textAlign: "center",
      textStroke: "5px rgba(15,23,42,0.62)",
      textBackgroundColor: options.accent,
      textBackgroundPaddingX: options.isLandscape ? 24 : 38,
      textBackgroundPaddingY: options.isLandscape ? 13 : 20,
      textBackgroundRadius: 28,
    },
    animations: options.animations,
  };
}

function chatCaptionTemplateNode(options: {
  fps: number;
  idPrefix: string;
  template: CaptionTemplateKey;
  area?: { top?: number | string; height?: number | string };
}): SceneNode {
  return styledCaptions(chatCaptionWords, {
    fps: options.fps,
    template: options.template,
    idPrefix: options.idPrefix,
    area: options.area ?? { top: "70%", height: "18%" },
  });
}

function selectCaptionTemplate(instruction: string): CaptionTemplateKey | null {
  if (instruction.includes("minimal") || instruction.includes("bar")) {
    return "minimalBar";
  }

  if (instruction.includes("handwritten") || instruction.includes("casual")) {
    return "handwritten";
  }

  if (instruction.includes("retro") || instruction.includes("vintage")) {
    return "retro";
  }

  if (instruction.includes("cinematic") || instruction.includes("premium")) {
    return "cinematic";
  }

  if (
    instruction.includes("storyteller") ||
    instruction.includes("narrative")
  ) {
    return "storyteller";
  }

  if (instruction.includes("hustle")) {
    return "hustle";
  }

  if (instruction.includes("spotlight") || instruction.includes("tiktok")) {
    return "spotlight";
  }

  if (instruction.includes("neon")) {
    return "neon";
  }

  if (instruction.includes("future") || instruction.includes("tech")) {
    return "future";
  }

  if (instruction.includes("terminal") || instruction.includes("code")) {
    return "terminal";
  }

  if (
    instruction.includes("color shift") ||
    instruction.includes("colorshift")
  ) {
    return "colorShift";
  }

  if (instruction.includes("karaoke")) {
    return "karaoke";
  }

  if (
    instruction.includes("classic subtitle") ||
    instruction.includes("classic caption")
  ) {
    return "classic";
  }

  return instruction.includes("subtitle") || instruction.includes("caption")
    ? "spotlight"
    : null;
}

function selectImageOverlayIntent(instruction: string): {
  template: ImageOverlayTemplateKey;
  placement?: ImageOverlayPlacement;
} | null {
  const mentionsImageOverlay =
    /\b(logo|watermark|sticker|product shot|product image|product|avatar|portrait|badge|image overlay|overlay image)\b/.test(
      instruction,
    ) && /\b(add|put|place|use|show|insert|overlay)\b/.test(instruction);

  if (!mentionsImageOverlay) {
    return null;
  }

  const placement = selectImageOverlayPlacement(instruction);

  if (instruction.includes("watermark")) {
    return { template: "watermark", placement };
  }

  if (instruction.includes("sticker")) {
    return { template: "sticker", placement };
  }

  if (instruction.includes("product")) {
    return { template: "productShot", placement };
  }

  if (instruction.includes("avatar") || instruction.includes("portrait")) {
    return { template: "avatarBadge", placement };
  }

  if (instruction.includes("badge")) {
    return { template: "cornerBadge", placement };
  }

  if (instruction.includes("logo")) {
    return { template: "logoBug", placement };
  }

  return { template: "sticker", placement };
}

function selectImageOverlayPlacement(
  instruction: string,
): ImageOverlayPlacement | undefined {
  if (
    instruction.includes("top right") ||
    instruction.includes("upper right") ||
    instruction.includes("top-right") ||
    instruction.includes("upper-right")
  ) {
    return "topRight";
  }

  if (
    instruction.includes("top left") ||
    instruction.includes("upper left") ||
    instruction.includes("top-left") ||
    instruction.includes("upper-left")
  ) {
    return "topLeft";
  }

  if (
    instruction.includes("bottom right") ||
    instruction.includes("lower right") ||
    instruction.includes("bottom-right") ||
    instruction.includes("lower-right")
  ) {
    return "bottomRight";
  }

  if (
    instruction.includes("bottom left") ||
    instruction.includes("lower left") ||
    instruction.includes("bottom-left") ||
    instruction.includes("lower-left")
  ) {
    return "bottomLeft";
  }

  if (instruction.includes("center") || instruction.includes("middle")) {
    return "center";
  }

  if (
    instruction.includes("lower third") ||
    instruction.includes("lower-third")
  ) {
    return "lowerThird";
  }

  return undefined;
}

function selectVideoOverlayIntent(instruction: string): {
  template: VideoOverlayTemplateKey;
  placement?: VideoOverlayPlacement;
} | null {
  const mentionsVideoOverlay =
    /\b(picture in picture|picture-in-picture|pip|reaction cam|reaction camera|screen demo|screen recording|background loop|b-roll|broll|video badge|video overlay|overlay video)\b/.test(
      instruction,
    ) && /\b(add|put|place|use|show|insert|overlay)\b/.test(instruction);

  if (!mentionsVideoOverlay) {
    return null;
  }

  const placement = selectImageOverlayPlacement(instruction) as
    | VideoOverlayPlacement
    | undefined;

  if (
    instruction.includes("picture in picture") ||
    instruction.includes("picture-in-picture") ||
    instruction.includes("pip")
  ) {
    return { template: "pictureInPicture", placement };
  }

  if (
    instruction.includes("reaction cam") ||
    instruction.includes("reaction camera")
  ) {
    return { template: "reactionCam", placement };
  }

  if (
    instruction.includes("screen demo") ||
    instruction.includes("screen recording")
  ) {
    return { template: "screenDemo", placement };
  }

  if (instruction.includes("background loop")) {
    return { template: "backgroundLoop", placement };
  }

  if (instruction.includes("b-roll") || instruction.includes("broll")) {
    return { template: "brollStrip", placement };
  }

  if (instruction.includes("badge")) {
    return { template: "videoBadge", placement };
  }

  return { template: "pictureInPicture", placement };
}

function selectAudioOverlayIntent(
  instruction: string,
  fps = 30,
): {
  template: AudioOverlayTemplateKey;
  from?: number;
  duration?: number;
  volume?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  loop?: boolean;
} | null {
  const mentionsAudioOverlay =
    /\b(background music|music bed|voiceover|voice over|sound effect|sfx|beat accent|beat hit|ambient bed|ambience|notification ping|audio overlay|overlay audio)\b/.test(
      instruction,
    ) && /\b(add|put|place|use|insert|overlay|play)\b/.test(instruction);

  if (!mentionsAudioOverlay) {
    return null;
  }

  const from = audioStartFrameFromInstruction(instruction, fps);
  const volume = audioVolumeFromInstruction(instruction);
  const fadeInDuration = audioFadeFrameDurationFromInstruction(
    instruction,
    "in",
    fps,
  );
  const fadeOutDuration = audioFadeFrameDurationFromInstruction(
    instruction,
    "out",
    fps,
  );
  const sharedOptions = {
    from,
    volume,
    fadeInDuration,
    fadeOutDuration,
    loop: audioLoopFromInstruction(instruction),
  };

  if (instruction.includes("voiceover") || instruction.includes("voice over")) {
    return { template: "voiceover", ...sharedOptions };
  }

  if (instruction.includes("beat accent") || instruction.includes("beat hit")) {
    return { template: "beatAccent", ...sharedOptions };
  }

  if (instruction.includes("notification ping")) {
    return { template: "notificationPing", ...sharedOptions };
  }

  if (instruction.includes("ambient") || instruction.includes("ambience")) {
    return { template: "ambientBed", ...sharedOptions };
  }

  if (instruction.includes("sound effect") || instruction.includes("sfx")) {
    return { template: "soundEffect", ...sharedOptions };
  }

  return { template: "backgroundMusic", ...sharedOptions };
}

function audioStartFrameFromInstruction(
  instruction: string,
  fps: number,
): number | undefined {
  const match = instruction.match(
    /\b(?:at|from|after)\s+(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/i,
  );

  if (!match) {
    return undefined;
  }

  return Math.max(0, Math.round(Number(match[1]) * fps));
}

function audioFadeFrameDurationFromInstruction(
  instruction: string,
  direction: "in" | "out",
  fps: number,
): number | undefined {
  const match = instruction.match(
    new RegExp(
      `\\bfade[-\\s]+(?:it\\s+)?${direction}\\s*(?:for|over)?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:s|sec|secs|second|seconds)\\b`,
      "i",
    ),
  );

  if (!match) {
    return undefined;
  }

  return Math.max(0, Math.round(Number(match[1]) * fps));
}

function audioLoopFromInstruction(instruction: string): boolean | undefined {
  return /\b(loop|looped|looping|repeat|repeating)\b/.test(instruction)
    ? true
    : undefined;
}

function audioOverlayDurationOptions(
  intent: {
    template: AudioOverlayTemplateKey;
    duration?: number;
    fadeInDuration?: number;
    fadeOutDuration?: number;
    loop?: boolean;
  },
  sceneDuration: number,
): {
  duration?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  loop?: boolean;
} {
  const options: {
    duration?: number;
    fadeInDuration?: number;
    fadeOutDuration?: number;
    loop?: boolean;
  } = {};

  if (intent.fadeInDuration !== undefined) {
    options.fadeInDuration = intent.fadeInDuration;
  }

  if (intent.fadeOutDuration !== undefined) {
    options.fadeOutDuration = intent.fadeOutDuration;
  }

  if (intent.loop !== undefined) {
    options.loop = intent.loop;
  }

  if (intent.duration !== undefined) {
    return { ...options, duration: intent.duration };
  }

  if (
    intent.template === "backgroundMusic" ||
    intent.template === "ambientBed" ||
    intent.template === "voiceover"
  ) {
    return { ...options, duration: sceneDuration };
  }

  return options;
}

function audioVolumeFromInstruction(instruction: string): number | undefined {
  if (/\b(mute|muted|silent)\b/.test(instruction)) {
    return 0;
  }

  if (
    /\b(quiet|quietly|soft|softly|low|under|subtle|background)\b/.test(
      instruction,
    )
  ) {
    return 0.22;
  }

  if (/\b(loud|louder|full volume)\b/.test(instruction)) {
    return 1;
  }

  const percent = instruction.match(/\b(\d{1,3})\s*%\s*(?:volume|vol)?\b/i);

  if (percent) {
    return Math.max(0, Math.min(1, Number(percent[1]) / 100));
  }

  return undefined;
}

function selectImageAssetForInstruction(
  scene: Scene,
  instruction: string,
  mediaAssets: ChatMediaAssetManifestItem[],
): {
  assetId: string;
  asset: { id: string; type: "image"; src: string };
} | null {
  const imageMediaAssets = mediaAssets.filter(
    (asset) => asset.type === "image",
  );
  const mentionedUploadId = parseMediaMentions(instruction, imageMediaAssets)[0]
    ?.assetId;
  const mentionedUpload = imageMediaAssets.find(
    (asset) =>
      asset.id === mentionedUploadId ||
      instructionMentionsImageAsset(instruction, asset),
  );

  if (mentionedUpload) {
    return {
      assetId: mentionedUpload.sceneAssetId,
      asset: {
        id: mentionedUpload.sceneAssetId,
        type: "image",
        src: mentionedUpload.src,
      },
    };
  }

  const existingImageAsset = Object.values(scene.assets).find(
    (asset) => asset.type === "image",
  );

  if (!existingImageAsset) {
    return null;
  }

  return {
    assetId: existingImageAsset.id,
    asset: {
      id: existingImageAsset.id,
      type: "image",
      src: existingImageAsset.src,
    },
  };
}

function selectVideoAssetForInstruction(
  scene: Scene,
  instruction: string,
  mediaAssets: ChatMediaAssetManifestItem[],
): {
  assetId: string;
  asset: { id: string; type: "video"; src: string };
} | null {
  const videoMediaAssets = mediaAssets.filter(
    (asset) => asset.type === "video",
  );
  const mentionedUploadId = parseMediaMentions(instruction, videoMediaAssets)[0]
    ?.assetId;
  const mentionedUpload = videoMediaAssets.find(
    (asset) =>
      asset.id === mentionedUploadId ||
      instructionMentionsMediaAsset(instruction, asset),
  );

  if (mentionedUpload) {
    return {
      assetId: mentionedUpload.sceneAssetId,
      asset: {
        id: mentionedUpload.sceneAssetId,
        type: "video",
        src: mentionedUpload.src,
      },
    };
  }

  const existingVideoAsset = Object.values(scene.assets).find(
    (asset) => asset.type === "video",
  );

  if (!existingVideoAsset) {
    return null;
  }

  return {
    assetId: existingVideoAsset.id,
    asset: {
      id: existingVideoAsset.id,
      type: "video",
      src: existingVideoAsset.src,
    },
  };
}

function selectAudioAssetForInstruction(
  scene: Scene,
  instruction: string,
  mediaAssets: ChatMediaAssetManifestItem[],
): {
  assetId: string;
  asset: { id: string; type: "audio"; src: string };
} | null {
  const audioMediaAssets = mediaAssets.filter(
    (asset) => asset.type === "audio",
  );
  const mentionedUploadId = parseMediaMentions(instruction, audioMediaAssets)[0]
    ?.assetId;
  const mentionedUpload = audioMediaAssets.find(
    (asset) =>
      asset.id === mentionedUploadId ||
      instructionMentionsMediaAsset(instruction, asset),
  );

  if (mentionedUpload) {
    return {
      assetId: mentionedUpload.sceneAssetId,
      asset: {
        id: mentionedUpload.sceneAssetId,
        type: "audio",
        src: mentionedUpload.src,
      },
    };
  }

  const existingAudioAsset = Object.values(scene.assets).find(
    (asset) => asset.type === "audio",
  );

  if (!existingAudioAsset) {
    return null;
  }

  return {
    assetId: existingAudioAsset.id,
    asset: {
      id: existingAudioAsset.id,
      type: "audio",
      src: existingAudioAsset.src,
    },
  };
}

function instructionMentionsImageAsset(
  instruction: string,
  asset: ChatMediaAssetManifestItem,
): boolean {
  return instructionMentionsMediaAsset(instruction, asset);
}

function instructionMentionsMediaAsset(
  instruction: string,
  asset: ChatMediaAssetManifestItem,
): boolean {
  return [
    asset.id,
    asset.sceneAssetId,
    asset.label,
    asset.fileName,
    ...asset.aliases,
  ]
    .filter(Boolean)
    .some((alias) => aliasInText(instruction, alias));
}

function aliasInText(text: string, alias: string): boolean {
  const normalizedAlias = alias
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (!normalizedAlias) {
    return false;
  }

  const normalizedText = text
    .toLowerCase()
    .replace(/@/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  return new RegExp(`\\b${escapeRegex(normalizedAlias)}\\b`, "i").test(
    normalizedText,
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isImageOverlayInsertOp(op: SceneOp): boolean {
  return (
    op.op === "insertNode" &&
    op.node.type === "div" &&
    op.node.children?.some((child) => child.type === "img") === true
  );
}

function isVideoOverlayInsertOp(op: SceneOp): boolean {
  return op.op === "insertNode" && op.node.type === "video";
}

function isAudioOverlayInsertOp(op: SceneOp): boolean {
  return op.op === "insertNode" && op.node.type === "audio";
}

function uniqueCaptionPrefix(scene: Scene, base: string): string {
  return uniqueNodeId(scene, base);
}

function uniqueNodeId(scene: Scene, base: string): string {
  const ids = new Set(collectNodeIds(scene));
  let candidate = base;
  let suffix = 2;

  while (ids.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export function applyInstructionLocally(
  currentScene: Scene | null,
  instruction: string,
  mediaAssets: ChatMediaAssetManifestItem[] = [],
): MotionforgeAgentResult {
  const patchBaseScene =
    currentScene ??
    (selectImageOverlayIntent(instruction.toLowerCase()) ||
    selectVideoOverlayIntent(instruction.toLowerCase()) ||
    selectAudioOverlayIntent(instruction.toLowerCase())
      ? createSceneFromInstruction(instruction)
      : null);
  const audioOverlayIntent = selectAudioOverlayIntent(
    instruction.toLowerCase(),
  );
  const localPatch = patchBaseScene
    ? createPatchFromInstruction(patchBaseScene, instruction, mediaAssets)
    : [];
  const overlayOnlyPatch = localPatch.filter(
    (op) =>
      op.op === "setAsset" ||
      isImageOverlayInsertOp(op) ||
      isVideoOverlayInsertOp(op) ||
      (audioOverlayIntent !== null && isAudioOverlayInsertOp(op)),
  );
  const shouldPreferOverlayPatch = overlayOnlyPatch.length > 0;
  const mediaResult = shouldPreferOverlayPatch
    ? ({ ok: false, reason: "Image overlay handled by local patch." } as const)
    : compileMediaInstruction({
        scene: currentScene,
        instruction,
        mediaAssets,
      });

  if (mediaResult.ok) {
    const result = applyScenePatch(mediaResult.baseScene, mediaResult.patch);

    if (!result.ok) {
      return {
        mode: currentScene ? "patch" : "scene",
        scene: currentScene ?? mediaResult.baseScene,
        patch: mediaResult.patch,
        summary: "The local media patch did not apply.",
        source: "local",
        diagnostics: result.errors.map((error) => error.message),
      };
    }

    return {
      mode: currentScene ? "patch" : "scene",
      scene: result.scene,
      patch: mediaResult.patch,
      summary: mediaResult.summary,
      source: "local",
      diagnostics: [],
      mediaPlan: mediaResult.plan,
    };
  }

  if (!patchBaseScene) {
    const scene = createSceneFromInstruction(instruction);
    return {
      mode: "scene",
      scene,
      summary: "Created a new deterministic scene locally.",
      source: "local",
      diagnostics: [],
    };
  }

  const patch = localPatch.length
    ? localPatch
    : createPatchFromInstruction(patchBaseScene, instruction, mediaAssets);
  const result = applyScenePatch(patchBaseScene, patch);

  if (!result.ok) {
    return {
      mode: currentScene ? "patch" : "scene",
      scene: patchBaseScene,
      patch,
      summary: "The local patch did not apply.",
      source: "local",
      diagnostics: result.errors.map((error) => error.message),
    };
  }

  return {
    mode: currentScene ? "patch" : "scene",
    scene: result.scene,
    patch,
    summary: `Applied ${patch.length} local edit${patch.length === 1 ? "" : "s"}.`,
    source: "local",
    diagnostics: [],
  };
}

export function normalizeModelOutput(
  raw: unknown,
  currentScene: Scene | null,
  mediaAssets: ChatMediaAssetManifestItem[] = [],
): Omit<MotionforgeAgentResult, "source"> {
  const payload = unwrapModelPayload(raw);

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const object = payload as {
      scene?: unknown;
      patch?: unknown;
      ops?: unknown;
      summary?: unknown;
    };

    if (object.scene !== undefined) {
      const sceneResult = repairSceneInput(normalizeModelScene(object.scene));
      if (!sceneResult.ok) {
        throw new Error(sceneResult.errors.join("\n"));
      }

      return {
        mode: "scene",
        scene: sceneResult.scene,
        summary:
          typeof object.summary === "string"
            ? object.summary
            : "Generated a new scene.",
        diagnostics: sceneResult.diagnostics.map(
          (diagnostic) => diagnostic.message,
        ),
      };
    }

    const patchInput = object.patch ?? object.ops;

    if (patchInput !== undefined) {
      return applyPatchOutput(
        currentScene,
        normalizeModelPatch(patchInput),
        object.summary,
        mediaAssets,
      );
    }
  }

  if (Array.isArray(payload)) {
    return applyPatchOutput(
      currentScene,
      normalizeModelPatch(payload),
      undefined,
      mediaAssets,
    );
  }

  const sceneResult = repairSceneInput(normalizeModelScene(payload));

  if (sceneResult.ok) {
    return {
      mode: "scene",
      scene: sceneResult.scene,
      summary: "Generated a new scene.",
      diagnostics: sceneResult.diagnostics.map(
        (diagnostic) => diagnostic.message,
      ),
    };
  }

  throw new Error("Model output was neither a valid scene nor a valid patch.");
}

export function extractJsonFromText(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.search(/[\[{]/);

  if (start === -1) {
    throw new Error("No JSON object or array found in model output.");
  }

  const sliced = candidate.slice(start);
  const end = Math.max(sliced.lastIndexOf("}"), sliced.lastIndexOf("]"));

  if (end === -1) {
    throw new Error("JSON output appears incomplete.");
  }

  const jsonText = sliced.slice(0, end + 1);

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    if (error instanceof SyntaxError) {
      const position = parseJsonErrorPosition(error.message);
      const context =
        position === null
          ? jsonText.slice(0, 360)
          : jsonText.slice(Math.max(0, position - 180), position + 180);
      throw new SyntaxError(
        `${error.message}\nModel JSON near ${position === null ? "the parse failure" : `position ${position}`}:\n${context}`,
      );
    }

    throw error;
  }
}

function applyPatchOutput(
  currentScene: Scene | null,
  patchInput: unknown,
  summary: unknown,
  mediaAssets: ChatMediaAssetManifestItem[] = [],
): Omit<MotionforgeAgentResult, "source"> {
  if (!currentScene) {
    throw new Error("The model returned patch ops, but there is no scene yet.");
  }

  const repairResult = repairMediaPatch({
    scene: currentScene,
    patchInput,
    mediaAssets,
  });

  if (!repairResult.ok) {
    throw new Error(repairResult.errors.join("\n"));
  }

  const result = applyScenePatch(currentScene, repairResult.patch);

  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.message).join("\n"));
  }

  return {
    mode: "patch",
    scene: result.scene,
    patch: repairResult.patch,
    summary:
      typeof summary === "string"
        ? summary
        : `Applied ${repairResult.patch.length} patch ops.`,
    diagnostics: repairResult.diagnostics,
  };
}

function unwrapModelPayload(raw: unknown): unknown {
  if (typeof raw === "string") {
    return extractJsonFromText(raw);
  }

  return raw;
}

function normalizeModelScene(input: unknown): unknown {
  if (!isRecord(input)) {
    return input;
  }

  const scene: Record<string, unknown> = { ...input };
  const meta = isRecord(scene.meta) ? scene.meta : {};

  scene.schemaVersion ??= 0;

  for (const key of ["width", "height", "fps", "duration"] as const) {
    if (scene[key] === undefined && typeof meta[key] === "number") {
      scene[key] = meta[key];
    }
  }

  if (Array.isArray(scene.assets)) {
    scene.assets = Object.fromEntries(
      scene.assets
        .filter((asset): asset is Record<string, unknown> => isRecord(asset))
        .filter((asset) => typeof asset.id === "string")
        .map((asset) => [asset.id as string, asset]),
    );
  } else {
    scene.assets ??= {};
  }

  if (Array.isArray(scene.nodes)) {
    scene.nodes = scene.nodes.map(normalizeModelNode);
  }

  return scene;
}

function normalizeModelPatch(input: unknown): unknown {
  if (!Array.isArray(input)) {
    return input;
  }

  return input.map((op) => {
    if (!isRecord(op)) {
      return op;
    }

    const normalized: Record<string, unknown> = { ...op };

    if (
      normalized.op === "setAnimations" &&
      Array.isArray(normalized.animations)
    ) {
      normalized.animations = normalizeModelAnimations(normalized.animations);
    }

    if (normalized.op === "insertNode" && normalized.node !== undefined) {
      normalized.node = normalizeModelNode(normalized.node);
    }

    return normalized;
  });
}

function normalizeModelNode(input: unknown): unknown {
  if (!isRecord(input)) {
    return input;
  }

  const node: Record<string, unknown> = { ...input };
  const timing = {
    from: typeof node.from === "number" ? node.from : 0,
    duration: typeof node.duration === "number" ? node.duration : undefined,
  };

  if (isRecord(node.style)) {
    node.style = normalizeModelStyle(node.style);
  }

  if (Array.isArray(node.animations)) {
    node.animations = normalizeModelAnimations(node.animations, timing);
  }

  if (
    node.type === "text" &&
    isRecord(node.style) &&
    node.style.opacity === 0 &&
    !hasAnimationForProperty(node.animations, "opacity")
  ) {
    node.style = { ...node.style, opacity: 1 };
  }

  if (Array.isArray(node.children)) {
    node.children = node.children.map(normalizeModelNode);
  }

  return node;
}

function normalizeModelAnimations(
  input: unknown[],
  timing?: { from: number; duration?: number },
): unknown[] {
  return input.map((animation) => {
    if (!isRecord(animation)) {
      return animation;
    }

    const frames = Array.isArray(animation.frames)
      ? animation.frames
      : Array.isArray(animation.keyframes)
        ? animation.keyframes
        : undefined;

    if (!frames || typeof animation.property !== "string") {
      return animation;
    }

    const normalizedFrames = normalizeModelKeyframes(
      frames,
      animation.property,
      timing,
    );

    return {
      ...animation,
      kind: animation.kind ?? "keyframes",
      frames: normalizedFrames,
    };
  });
}

function normalizeModelStyle(style: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(style)
      .filter(([key]) => supportedModelStyleKeys.has(key))
      .map(([key, value]) => [key, normalizeModelStyleValue(key, value)])
      .filter((entry): entry is [string, unknown] => entry[1] !== undefined),
  );
}

const supportedModelStyleKeys = new Set<string>(supportedStyleKeys);

function normalizeModelStyleValue(key: string, value: unknown): unknown {
  if (key === "transform" && typeof value === "string") {
    return normalizeModelTransform(value);
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();

  switch (key) {
    case "filter":
      return isFilterExpression(normalized) ? normalized : undefined;
    case "background":
      return isUnsupportedGradient(normalized) ? undefined : value;
    case "alignItems":
      return normalizeEnumValue(normalized, {
        start: "flex-start",
        end: "flex-end",
        baseline: "center",
        "first baseline": "center",
        "last baseline": "center",
      });
    case "justifyContent":
      return normalizeEnumValue(normalized, {
        start: "flex-start",
        end: "flex-end",
        "space-around": "space-between",
        "space-evenly": "space-between",
      });
    case "flexDirection":
      return normalizeEnumValue(normalized, {
        "row-reverse": "row",
        "column-reverse": "column",
      });
    case "position":
      return normalizeEnumValue(normalized, {
        fixed: "absolute",
        sticky: "absolute",
        static: "relative",
      });
    case "overflow":
      return normalizeEnumValue(normalized, {
        auto: "hidden",
        scroll: "hidden",
        clip: "hidden",
      });
    case "textAlign":
      return normalizeEnumValue(normalized, {
        start: "left",
        end: "right",
        justify: "center",
      });
    case "fontStyle":
      return normalizeEnumValue(normalized, {
        oblique: "italic",
      });
    case "objectFit":
      return normalizeEnumValue(normalized, {
        "scale-down": "scale-down",
      });
    default:
      return value;
  }
}

function normalizeEnumValue(value: string, aliases: Record<string, string>) {
  return aliases[value] ?? value;
}

function isUnsupportedGradient(value: string): boolean {
  return /(?:^|[\s,])(?:radial|conic|repeating-linear|repeating-radial)-gradient\(/i.test(
    value,
  );
}

function normalizeModelKeyframes(
  frames: unknown[],
  property: string,
  timing?: { from: number; duration?: number },
) {
  const normalized = frames.map((frame, index) =>
    normalizeModelKeyframe(frame, property, timing, index, frames.length),
  );

  if (!shouldConvertAbsoluteFramesToLocal(normalized, timing)) {
    return sortAndDedupeModelKeyframes(normalized);
  }

  return sortAndDedupeModelKeyframes(
    normalized.map((frame) =>
      isRecord(frame) && typeof frame.frame === "number"
        ? { ...frame, frame: frame.frame - timing.from }
        : frame,
    ),
  );
}

function normalizeModelKeyframe(
  frame: unknown,
  property: string,
  timing: { from: number; duration?: number } | undefined,
  index: number,
  totalFrames: number,
): unknown {
  if (!isRecord(frame)) {
    return frame;
  }

  const frameNumber = readModelKeyframeFrame(frame, timing, index, totalFrames);
  const value = readModelKeyframeValue(frame, property);

  if (frameNumber === null || value === null) {
    return {
      ...frame,
      ...(frameNumber === null ? {} : { frame: frameNumber }),
      ...(value === null ? {} : { value }),
    };
  }

  const normalized: Record<string, unknown> = {
    frame: frameNumber,
    value,
  };
  const easing = normalizeModelEasing(frame.easing);

  if (easing) {
    normalized.easing = easing;
  }

  return normalized;
}

function readModelKeyframeFrame(
  frame: Record<string, unknown>,
  timing: { from: number; duration?: number } | undefined,
  index: number,
  totalFrames: number,
): number | null {
  const explicitFrame = readFiniteNumber(frame.frame);

  if (explicitFrame !== null) {
    return Math.max(0, Math.round(explicitFrame));
  }

  const offset = readFiniteNumber(frame.offset ?? frame.progress);

  if (offset !== null && timing?.duration) {
    return Math.max(
      0,
      Math.round(clampNumber(offset, 0, 1) * Math.max(0, timing.duration - 1)),
    );
  }

  const time = readFiniteNumber(frame.time ?? frame.t ?? frame.at);

  if (time !== null) {
    if (timing?.duration && time >= 0 && time <= 1) {
      return Math.max(0, Math.round(time * Math.max(0, timing.duration - 1)));
    }

    return Math.max(0, Math.round(time));
  }

  if (timing?.duration && totalFrames > 1) {
    return Math.round(
      (index / (totalFrames - 1)) * Math.max(0, timing.duration - 1),
    );
  }

  return index;
}

function readModelKeyframeValue(
  frame: Record<string, unknown>,
  property: string,
): string | number | null {
  const direct = normalizeModelKeyframeValue(frame.value, property);

  if (direct !== null) {
    return direct;
  }

  const propertyValue = normalizeModelKeyframeValue(frame[property], property);

  if (propertyValue !== null) {
    return propertyValue;
  }

  if (isRecord(frame.style)) {
    const styleValue = normalizeModelKeyframeValue(
      frame.style[property],
      property,
    );

    if (styleValue !== null) {
      return styleValue;
    }
  }

  if (property === "transform") {
    return transformFromModelRecord(frame);
  }

  return null;
}

function normalizeModelKeyframeValue(
  value: unknown,
  property: string,
): string | number | null {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    if (property === "transform") {
      return normalizeModelTransform(value);
    }

    const numberValue = numericKeyframeProperties.has(property)
      ? readFiniteNumber(value)
      : null;

    return numberValue ?? value;
  }

  if (!isRecord(value)) {
    return null;
  }

  const nested = normalizeModelKeyframeValue(value[property], property);

  if (nested !== null) {
    return nested;
  }

  if (isRecord(value.style)) {
    const styleNested = normalizeModelKeyframeValue(
      value.style[property],
      property,
    );

    if (styleNested !== null) {
      return styleNested;
    }
  }

  if (property === "transform") {
    return transformFromModelRecord(value);
  }

  return null;
}

function sortAndDedupeModelKeyframes(frames: unknown[]) {
  const valid = frames.every(
    (frame) =>
      isRecord(frame) &&
      typeof frame.frame === "number" &&
      (typeof frame.value === "number" || typeof frame.value === "string"),
  );

  if (!valid) {
    return frames;
  }

  return [...frames]
    .sort((left, right) => {
      const leftFrame = isRecord(left)
        ? (readFiniteNumber(left.frame) ?? 0)
        : 0;
      const rightFrame = isRecord(right)
        ? (readFiniteNumber(right.frame) ?? 0)
        : 0;
      return leftFrame - rightFrame;
    })
    .filter((frame, index, sorted) => {
      if (!isRecord(frame)) {
        return true;
      }

      const next = sorted[index + 1];
      return !(
        isRecord(next) &&
        typeof next.frame === "number" &&
        next.frame === frame.frame
      );
    });
}

function normalizeModelEasing(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const mapped =
    {
      ease: "easeInOut",
      "ease-in": "easeIn",
      "ease-out": "easeOut",
      "ease-in-out": "easeInOut",
    }[value] ?? value;

  return isEasingExpression(mapped) ? mapped : null;
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const numericKeyframeProperties = new Set([
  "opacity",
  "zIndex",
  "fontSize",
  "lineHeight",
  "left",
  "right",
  "top",
  "bottom",
  "width",
  "height",
]);

function transformFromModelRecord(
  record: Record<string, unknown>,
): string | null {
  const translate = translateFromModelRecord(record);
  const scale = scaleFromModelRecord(record);
  const rotate = rotateFromModelRecord(record);
  const parts = [translate, scale, rotate].filter(Boolean);

  return parts.length ? parts.join(" ") : null;
}

function translateFromModelRecord(record: Record<string, unknown>) {
  const translate = record.translate;

  if (typeof translate === "string") {
    return normalizeModelTransform(`translate(${translate})`);
  }

  if (Array.isArray(translate)) {
    const x = formatTransformLength(translate[0]) ?? "0px";
    const y = formatTransformLength(translate[1]) ?? "0px";
    return `translate(${x}, ${y})`;
  }

  const x =
    formatTransformLength(record.translateX) ??
    formatTransformLength(record.x) ??
    "0px";
  const y =
    formatTransformLength(record.translateY) ??
    formatTransformLength(record.y) ??
    "0px";

  const hasTranslateSignal =
    "translateX" in record ||
    "translateY" in record ||
    "x" in record ||
    "y" in record;

  if (!hasTranslateSignal && x === "0px" && y === "0px") {
    return null;
  }

  return `translate(${x}, ${y})`;
}

function scaleFromModelRecord(record: Record<string, unknown>) {
  const scale = record.scale;

  if (typeof scale === "number" || typeof scale === "string") {
    const value = readFiniteNumber(scale);
    return value === null ? null : `scale(${value})`;
  }

  if (Array.isArray(scale)) {
    const x = readFiniteNumber(scale[0]);
    const y = readFiniteNumber(scale[1]);

    if (x === null) {
      return null;
    }

    return y === null ? `scale(${x})` : `scale(${x}, ${y})`;
  }

  const x = readFiniteNumber(record.scaleX);
  const y = readFiniteNumber(record.scaleY);

  if (x === null && y === null) {
    return null;
  }

  return `scale(${x ?? 1}, ${y ?? x ?? 1})`;
}

function rotateFromModelRecord(record: Record<string, unknown>) {
  const rotate = record.rotate ?? record.rotation;

  if (typeof rotate === "string" && rotate.trim().endsWith("deg")) {
    return `rotate(${rotate.trim()})`;
  }

  const value = readFiniteNumber(rotate);
  return value === null ? null : `rotate(${value}deg)`;
}

function formatTransformLength(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}px`;
  }

  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    const parsed = trimmed.match(/^-?\d+(?:\.\d+)?(?:px|%)?$/);

    if (!parsed) {
      return null;
    }

    return /\d(?:px|%)$/.test(trimmed) ? trimmed : `${trimmed}px`;
  }

  return null;
}

function shouldConvertAbsoluteFramesToLocal(
  frames: unknown[],
  timing: { from: number; duration?: number } | undefined,
): timing is { from: number; duration: number } {
  if (!timing || timing.from <= 0 || timing.duration === undefined) {
    return false;
  }

  const frameNumbers = frames
    .map((frame) =>
      isRecord(frame) && typeof frame.frame === "number" ? frame.frame : NaN,
    )
    .filter(Number.isFinite);

  if (frameNumbers.length !== frames.length || frameNumbers.length === 0) {
    return false;
  }

  const min = Math.min(...frameNumbers);
  const max = Math.max(...frameNumbers);

  return min >= timing.from && max <= timing.from + timing.duration;
}

function hasAnimationForProperty(input: unknown, property: string): boolean {
  return (
    Array.isArray(input) &&
    input.some(
      (animation) =>
        isRecord(animation) &&
        animation.property === property &&
        Array.isArray(animation.frames) &&
        animation.frames.length > 0,
    )
  );
}

function normalizeModelTransform(value: string) {
  return value
    .replace(
      /translateX\(\s*(-?\d+(?:\.\d+)?(?:px|%)?)\s*\)/g,
      "translate($1, 0px)",
    )
    .replace(
      /translateY\(\s*(-?\d+(?:\.\d+)?(?:px|%)?)\s*\)/g,
      "translate(0px, $1)",
    );
}

function parseJsonErrorPosition(message: string): number | null {
  const match = message.match(/position (\d+)/i);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function titleFromInstruction(instruction: string): string {
  const quoted = instruction.match(/["“](.+?)["”]/)?.[1];

  if (quoted && quoted.length <= 72) {
    return quoted;
  }

  const cleaned = instruction
    .replace(/^make\s+/i, "")
    .replace(/^create\s+/i, "")
    .replace(/\b(a|an|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "Prompt to polished video";
  }

  const words = cleaned.split(" ").slice(0, 8).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function subtitleFromInstruction(instruction: string): string {
  const normalized = instruction.toLowerCase();

  if (normalized.includes("product") || normalized.includes("launch")) {
    return "A fast, polished launch card with motion and a clear call to action.";
  }

  if (normalized.includes("founder") || normalized.includes("update")) {
    return "Three crisp beats, calm pacing, and a title that feels intentional.";
  }

  if (normalized.includes("caption") || normalized.includes("tiktok")) {
    return "Caption-first layout with punchy text treatment near the bottom.";
  }

  return "A serializable scene document, previewed and exported through one render path.";
}

function selectTheme(instruction: string): Theme {
  if (
    instruction.includes("dark") ||
    instruction.includes("punch") ||
    instruction.includes("kinetic")
  ) {
    return themes.punch;
  }

  if (
    instruction.includes("calm") ||
    instruction.includes("founder") ||
    instruction.includes("clean")
  ) {
    return themes.calm;
  }

  if (
    instruction.includes("launch") ||
    instruction.includes("bold") ||
    instruction.includes("coral")
  ) {
    return themes.launch;
  }

  return themes.bright;
}

function collectNodeIds(scene: Scene): string[] {
  const ids: string[] = [];
  const visit = (nodes: Scene["nodes"]) => {
    for (const node of nodes) {
      ids.push(node.id);
      visit(node.children ?? []);
    }
  };
  visit(scene.nodes);
  return ids;
}

function firstTextId(scene: Scene): string | undefined {
  const stack = [...scene.nodes];

  while (stack.length > 0) {
    const node = stack.shift();
    if (!node) {
      continue;
    }
    if (node.type === "text") {
      return node.id;
    }
    stack.push(...(node.children ?? []));
  }

  return undefined;
}

function getNodeStyleNumber(
  scene: Scene,
  id: string | undefined,
  key: string,
  fallback: number,
): number {
  if (!id) {
    return fallback;
  }

  const stack = [...scene.nodes];

  while (stack.length > 0) {
    const node = stack.shift();
    if (!node) {
      continue;
    }

    if (node.id === id) {
      const value = (node.style as Record<string, unknown> | undefined)?.[key];
      return typeof value === "number" ? value : fallback;
    }

    stack.push(...(node.children ?? []));
  }

  return fallback;
}

type KeyframeTuple = [number, string | number, string?];

function keyframes(
  property: SceneAnimationTarget,
  frames: KeyframeTuple[],
): SceneAnimation {
  return {
    kind: "keyframes" as const,
    property,
    frames: frames.map(([frame, value, easing]) => ({
      frame,
      value,
      ...(easing ? { easing } : {}),
    })),
  };
}
