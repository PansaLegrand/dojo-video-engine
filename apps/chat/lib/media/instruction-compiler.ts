import type { Scene, SceneNode, ScenePatch } from "@motionforge/schema";
import type { ChatMediaAssetManifestItem } from "./assets";
import { parseMediaMentions, resolveMediaAssetAlias } from "./mentions";
import type { MediaOperationPlan, MediaOperationPlanStep } from "./plan";

type VisualMediaAsset = ChatMediaAssetManifestItem & {
  type: "image" | "video";
};

export type MediaInstructionCompileResult =
  | {
      ok: true;
      baseScene: Scene;
      patch: ScenePatch;
      summary: string;
      plan: MediaOperationPlan;
    }
  | { ok: false; reason: string };

const defaultFps = 30;
const fallbackDurationSeconds = 5;

export function compileMediaInstruction({
  scene,
  instruction,
  mediaAssets,
}: {
  scene: Scene | null;
  instruction: string;
  mediaAssets: ChatMediaAssetManifestItem[];
}): MediaInstructionCompileResult {
  const visualAssets = mediaAssets.filter(isVisualMediaAsset);

  if (visualAssets.length === 0) {
    return { ok: false, reason: "No visual media assets available." };
  }

  const orderedAssets = referencedVisualAssets(instruction, visualAssets);

  if (orderedAssets.length === 0) {
    return { ok: false, reason: "Instruction did not reference media assets." };
  }

  if (!looksLikeMediaSequenceInstruction(instruction)) {
    return { ok: false, reason: "Instruction is not a media sequence edit." };
  }

  const firstVisual = orderedAssets[0]!;
  const baseScene = scene ?? createSceneForAsset(firstVisual);
  const patch: ScenePatch = [];
  const ids = new Set(collectNodeIds(baseScene.nodes));
  const quotedText = instruction.match(/["“](.+?)["”]/)?.[1];
  const textTarget = quotedText
    ? findTextOverlayTarget(instruction, orderedAssets) ?? orderedAssets.at(-1)
    : null;
  let cursor = 0;
  let zIndex = nextVisualZIndex(baseScene);
  const insertedLabels: string[] = [];
  const planSteps: MediaOperationPlanStep[] = [];

  for (const [assetIndex, asset] of orderedAssets.entries()) {
    const trim = trimForAsset(instruction, asset, assetIndex);
    const duration = durationFramesForAsset(asset, baseScene.fps, trim);
    const nodeId = uniqueId(ids, `${asset.id}-node`);

    patch.push({
      op: "setAsset",
      asset: {
        id: asset.sceneAssetId,
        type: asset.type,
        src: asset.src,
      },
    });
    patch.push({
      op: "insertNode",
      node: createVisualNode({
        asset,
        scene: baseScene,
        nodeId,
        from: cursor,
        duration,
        zIndex,
        sourceStartSeconds: trim.startSeconds,
      }),
    });
    planSteps.push({
      type: "sequence-clip",
      nodeId,
      assetId: asset.id,
      label: asset.label,
      mediaType: asset.type,
      sourceStartSeconds: trim.startSeconds,
      sourceEndSeconds: trim.explicit ? trim.endSeconds : undefined,
      sceneStartFrame: cursor,
      durationFrames: duration,
    });

    insertedLabels.push(
      `${asset.label}${trim.explicit ? ` ${formatSeconds(trim.startSeconds)}-${formatSeconds(trim.endSeconds)}` : " full"}`,
    );

    if (quotedText && textTarget?.id === asset.id) {
      const textId = uniqueId(ids, `${asset.id}-text`);
      const position = textPositionFromInstruction(instruction);
      patch.push({
        op: "insertNode",
        node: createTextOverlayNode({
          id: textId,
          text: quotedText,
          scene: baseScene,
          from: cursor,
          duration,
          zIndex: zIndex + 5,
          position,
        }),
      });
      planSteps.push({
        type: "text-overlay",
        nodeId: textId,
        text: quotedText,
        targetAssetId: asset.id,
        fromFrame: cursor,
        durationFrames: duration,
        position,
      });
    }

    cursor += duration;
    zIndex += 10;
  }

  if (cursor !== baseScene.duration) {
    patch.unshift({ op: "setSceneMeta", duration: cursor });
  }

  const summary = `Built media sequence: ${insertedLabels.join(", ")}${quotedText ? ` with text "${quotedText}".` : "."}`;

  return {
    ok: true,
    baseScene,
    patch,
    summary,
    plan: {
      summary,
      fps: baseScene.fps,
      steps: planSteps,
    },
  };
}

function referencedVisualAssets(
  instruction: string,
  assets: VisualMediaAsset[],
) {
  const mentions = parseMediaMentions(instruction, assets);
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const ordered: VisualMediaAsset[] = [];
  const seen = new Set<string>();

  for (const mention of mentions) {
    const asset = byId.get(mention.assetId);

    if (asset && !seen.has(asset.id)) {
      ordered.push(asset);
      seen.add(asset.id);
    }
  }

  if (ordered.length) {
    return ordered;
  }

  for (const asset of assets) {
    if (instructionMentionsAsset(instruction, asset)) {
      ordered.push(asset);
    }
  }

  return ordered;
}

function instructionMentionsAsset(
  instruction: string,
  asset: ChatMediaAssetManifestItem,
) {
  return [asset.id, asset.sceneAssetId, asset.label, asset.fileName, ...asset.aliases]
    .some((alias) => aliasInInstruction(instruction, alias));
}

function findTextOverlayTarget(
  instruction: string,
  assets: VisualMediaAsset[],
) {
  const targetMatch = instruction.match(
    /\b(?:second|2nd|video two|clip two|video 2|clip 2)\b/i,
  );

  if (targetMatch && assets[1]) {
    return assets[1];
  }

  for (const asset of assets) {
    const resolved = resolveMediaAssetAlias(asset.label, assets);
    if (resolved && aliasInInstruction(instruction, `at ${asset.label}`)) {
      return asset;
    }
  }

  return null;
}

function trimForAsset(
  instruction: string,
  asset: VisualMediaAsset,
  assetIndex: number,
): { explicit: boolean; startSeconds: number; endSeconds: number } {
  const mention = parseMediaMentions(instruction, [asset]).find(
    (entry) => entry.range,
  );

  if (mention?.range) {
    return {
      explicit: true,
      startSeconds: mention.range.startSeconds,
      endSeconds: mention.range.endSeconds,
    };
  }

  if (assetIndex === 0 && instructionMentionsAsset(instruction, asset)) {
    const range = instruction.match(
      /(?:from\s+)?(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds)?\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds)?/i,
    );

    if (range) {
      return {
        explicit: true,
        startSeconds: Number(range[1]),
        endSeconds: Number(range[2]),
      };
    }
  }

  return {
    explicit: false,
    startSeconds: 0,
    endSeconds: asset.durationSeconds ?? fallbackDurationSeconds,
  };
}

function durationFramesForAsset(
  asset: VisualMediaAsset,
  fps: number,
  trim: { startSeconds: number; endSeconds: number },
) {
  if (asset.type === "image") {
    return Math.max(1, Math.round(fallbackDurationSeconds * fps));
  }

  const seconds = Math.max(0.1, trim.endSeconds - trim.startSeconds);
  return Math.max(1, Math.ceil(seconds * fps));
}

function createSceneForAsset(asset: VisualMediaAsset): Scene {
  const size = sceneSizeForAsset(asset);
  const duration = Math.max(
    1,
    Math.ceil((asset.durationSeconds ?? fallbackDurationSeconds) * defaultFps),
  );

  return {
    schemaVersion: 1,
    width: size.width,
    height: size.height,
    fps: defaultFps,
    duration,
    assets: {},
    nodes: [],
  };
}

function createVisualNode({
  asset,
  scene,
  nodeId,
  from,
  duration,
  zIndex,
  sourceStartSeconds,
}: {
  asset: VisualMediaAsset;
  scene: Scene;
  nodeId: string;
  from: number;
  duration: number;
  zIndex: number;
  sourceStartSeconds: number;
}): SceneNode {
  const style = {
    position: "absolute" as const,
    left: 0,
    top: 0,
    width: scene.width,
    height: scene.height,
    objectFit: "cover" as const,
    objectPosition: "center center",
    zIndex,
  };

  if (asset.type === "image") {
    return {
      id: nodeId,
      type: "img",
      assetId: asset.sceneAssetId,
      from,
      duration,
      style,
    };
  }

  return {
    id: nodeId,
    type: "video",
    assetId: asset.sceneAssetId,
    from,
    duration,
    videoStartTime: sourceStartSeconds,
    volume: 1,
    style,
  };
}

function createTextOverlayNode({
  id,
  text,
  scene,
  from,
  duration,
  zIndex,
  position,
}: {
  id: string;
  text: string;
  scene: Scene;
  from: number;
  duration: number;
  zIndex: number;
  position: "top" | "center" | "bottom";
}): SceneNode {
  const top =
    position === "top"
      ? Math.round(scene.height * 0.08)
      : position === "center"
        ? Math.round(scene.height * 0.45)
        : Math.round(scene.height * 0.76);

  return {
    id,
    type: "text",
    text,
    from,
    duration,
    style: {
      position: "absolute",
      left: Math.round(scene.width * 0.08),
      right: Math.round(scene.width * 0.08),
      top,
      fontSize: Math.max(34, Math.round(scene.height * 0.052)),
      fontWeight: 900,
      color: "#ffffff",
      textAlign: "center",
      textStroke: "7px rgba(0,0,0,0.72)",
      zIndex,
    },
  };
}

function looksLikeMediaSequenceInstruction(instruction: string) {
  return /\b(put|place|use|add|then|first|second|clip|video|image|sequence|after|before|keep|from)\b/i.test(
    instruction,
  );
}

function textPositionFromInstruction(
  instruction: string,
): "top" | "center" | "bottom" {
  if (/\btop\b/i.test(instruction)) {
    return "top";
  }

  if (/\bbottom\b/i.test(instruction)) {
    return "bottom";
  }

  return "center";
}

function aliasInInstruction(instruction: string, alias: string) {
  const normalizedInstruction = normalizeText(instruction);
  const normalizedAlias = normalizeText(alias);
  return normalizedInstruction.includes(normalizedAlias);
}

function collectNodeIds(nodes: SceneNode[]) {
  const ids: string[] = [];

  for (const node of nodes) {
    ids.push(node.id);
    ids.push(...collectNodeIds(node.children ?? []));
  }

  return ids;
}

function uniqueId(ids: Set<string>, base: string) {
  if (!ids.has(base)) {
    ids.add(base);
    return base;
  }

  let suffix = 2;
  let candidate = `${base}-${suffix}`;

  while (ids.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  ids.add(candidate);
  return candidate;
}

function nextVisualZIndex(scene: Scene) {
  let max = -10;

  const visit = (nodes: SceneNode[]) => {
    for (const node of nodes) {
      if (typeof node.style?.zIndex === "number") {
        max = Math.max(max, node.style.zIndex);
      }
      visit(node.children ?? []);
    }
  };

  visit(scene.nodes);
  return max + 10;
}

function sceneSizeForAsset(asset: VisualMediaAsset) {
  if (!asset.width || !asset.height) {
    return { width: 1080, height: 1920 };
  }

  if (asset.width > asset.height) {
    return { width: 1280, height: 720 };
  }

  if (asset.width === asset.height) {
    return { width: 1080, height: 1080 };
  }

  return { width: 1080, height: 1920 };
}

function isVisualMediaAsset(
  asset: ChatMediaAssetManifestItem,
): asset is VisualMediaAsset {
  return asset.type === "video" || asset.type === "image";
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[-_]+/g, " ")
    .replace(/[^\p{L}\p{N}.:]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatSeconds(value: number) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)}s`;
}
