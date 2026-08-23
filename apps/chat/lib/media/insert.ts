import type { Scene, SceneNode, ScenePatch } from "@motionforge/schema";
import type { LocalMediaAsset } from "./assets";

export type InsertLocalMediaAssetResult =
  | {
      ok: true;
      baseScene: Scene;
      patch: ScenePatch;
      nodeId: string;
      summary: string;
    }
  | { ok: false; error: string };

const defaultFps = 30;
const defaultImageDurationFrames = 90;
const defaultMediaDurationFrames = 150;

export function createInsertLocalMediaAssetPatch({
  scene,
  asset,
  insertAtFrame = 0,
}: {
  scene: Scene | null;
  asset: LocalMediaAsset;
  insertAtFrame?: number;
}): InsertLocalMediaAssetResult {
  if (asset.status === "error") {
    return {
      ok: false,
      error: asset.error ?? `Could not use ${asset.label}.`,
    };
  }

  if (asset.status !== "ready") {
    return {
      ok: false,
      error: `${asset.label} is still reading metadata.`,
    };
  }

  const baseScene = scene ?? createDefaultSceneForAsset(asset);
  const from = scene
    ? clampFrame(insertAtFrame, 0, Math.max(0, baseScene.duration - 1))
    : 0;
  const duration = durationFramesForAsset(asset, baseScene.fps);
  const nodeId = uniqueNodeId(baseScene, `${asset.id}-node`);
  const node = createNodeForAsset({
    asset,
    nodeId,
    scene: baseScene,
    from,
    duration,
  });
  const patch: ScenePatch = [];
  const nextDuration = Math.max(baseScene.duration, from + duration);

  if (nextDuration !== baseScene.duration) {
    patch.push({ op: "setSceneMeta", duration: nextDuration });
  }

  patch.push({
    op: "setAsset",
    asset: {
      id: asset.sceneAssetId,
      type: asset.type,
      src: asset.objectUrl,
    },
  });
  patch.push({ op: "insertNode", node });

  return {
    ok: true,
    baseScene,
    patch,
    nodeId,
    summary: `${asset.label} added at ${framesToSecondsLabel(from, baseScene.fps)}.`,
  };
}

export function createDefaultSceneForAsset(asset: LocalMediaAsset): Scene {
  const size = defaultSceneSizeForAsset(asset);
  const duration = durationFramesForAsset(asset, defaultFps);

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

function createNodeForAsset({
  asset,
  nodeId,
  scene,
  from,
  duration,
}: {
  asset: LocalMediaAsset;
  nodeId: string;
  scene: Scene;
  from: number;
  duration: number;
}): SceneNode {
  if (asset.type === "audio") {
    return {
      id: nodeId,
      type: "audio",
      assetId: asset.sceneAssetId,
      from,
      duration,
      audioStartTime: 0,
      volume: 1,
    };
  }

  const style = {
    position: "absolute" as const,
    left: 0,
    top: 0,
    width: scene.width,
    height: scene.height,
    objectFit: "cover" as const,
    objectPosition: "center center",
    zIndex: nextVisualZIndex(scene),
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
    videoStartTime: 0,
    volume: 1,
    style,
  };
}

function durationFramesForAsset(asset: LocalMediaAsset, fps: number) {
  if (asset.type === "image") {
    return defaultImageDurationFrames;
  }

  const durationSeconds = asset.durationSeconds;

  if (
    !Number.isFinite(durationSeconds) ||
    !durationSeconds ||
    durationSeconds <= 0
  ) {
    return defaultMediaDurationFrames;
  }

  return Math.max(1, Math.ceil(durationSeconds * fps));
}

function defaultSceneSizeForAsset(asset: LocalMediaAsset) {
  if (!asset.width || !asset.height || asset.type === "audio") {
    return { width: 1080, height: 1920 };
  }

  if (asset.width === asset.height) {
    return { width: 1080, height: 1080 };
  }

  if (asset.width > asset.height) {
    const height = 720;
    return {
      width: Math.min(
        1920,
        Math.max(1, Math.round((asset.width / asset.height) * height)),
      ),
      height,
    };
  }

  const width = 1080;
  return {
    width,
    height: Math.min(
      1920,
      Math.max(1, Math.round((asset.height / asset.width) * width)),
    ),
  };
}

function uniqueNodeId(scene: Scene, baseId: string) {
  const ids = new Set<string>();
  collectNodeIds(scene.nodes, ids);

  if (!ids.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  let candidate = `${baseId}-${suffix}`;

  while (ids.has(candidate)) {
    suffix += 1;
    candidate = `${baseId}-${suffix}`;
  }

  return candidate;
}

function collectNodeIds(nodes: SceneNode[], ids: Set<string>) {
  for (const node of nodes) {
    ids.add(node.id);
    collectNodeIds(node.children ?? [], ids);
  }
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

function clampFrame(frame: number, min: number, max: number) {
  if (!Number.isFinite(frame)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(frame)));
}

function framesToSecondsLabel(frame: number, fps: number) {
  return `${(frame / fps).toFixed(2)}s`;
}
