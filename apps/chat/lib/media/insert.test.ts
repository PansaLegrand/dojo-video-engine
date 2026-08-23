import { describe, expect, it } from "vitest";
import { applyScenePatch, type Scene } from "@motionforge/schema";
import type { LocalMediaAsset } from "./assets";
import {
  createDefaultSceneForAsset,
  createInsertLocalMediaAssetPatch,
} from "./insert";

describe("createInsertLocalMediaAssetPatch", () => {
  it("creates a default scene and inserts a first video asset", () => {
    const asset = assetLike({
      id: "video-1",
      sceneAssetId: "video_1",
      type: "video",
      label: "Video 1",
      objectUrl: "blob:video-1",
      durationSeconds: 4.2,
      width: 1920,
      height: 1080,
    });
    const result = createInsertLocalMediaAssetPatch({ scene: null, asset });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.baseScene).toMatchObject({
      width: 1280,
      height: 720,
      fps: 30,
      duration: 126,
    });
    expect(result.nodeId).toBe("video-1-node");
    expect(result.patch).toEqual([
      {
        op: "setAsset",
        asset: { id: "video_1", type: "video", src: "blob:video-1" },
      },
      {
        op: "insertNode",
        node: {
          id: "video-1-node",
          type: "video",
          assetId: "video_1",
          from: 0,
          duration: 126,
          videoStartTime: 0,
          volume: 1,
          style: {
            position: "absolute",
            left: 0,
            top: 0,
            width: 1280,
            height: 720,
            objectFit: "cover",
            objectPosition: "center center",
            zIndex: 0,
          },
        },
      },
    ]);

    const patched = applyScenePatch(result.baseScene, result.patch);
    expect(patched.ok).toBe(true);
  });

  it("inserts media at the playhead and extends an existing scene", () => {
    const scene = baseScene();
    const asset = assetLike({
      id: "audio-1",
      sceneAssetId: "audio_1",
      type: "audio",
      label: "Audio 1",
      objectUrl: "blob:audio-1",
      durationSeconds: 5,
    });
    const result = createInsertLocalMediaAssetPatch({
      scene,
      asset,
      insertAtFrame: 90,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.patch).toEqual([
      { op: "setSceneMeta", duration: 240 },
      {
        op: "setAsset",
        asset: { id: "audio_1", type: "audio", src: "blob:audio-1" },
      },
      {
        op: "insertNode",
        node: {
          id: "audio-1-node",
          type: "audio",
          assetId: "audio_1",
          from: 90,
          duration: 150,
          audioStartTime: 0,
          volume: 1,
        },
      },
    ]);

    const patched = applyScenePatch(result.baseScene, result.patch);
    expect(patched.ok).toBe(true);

    if (patched.ok) {
      expect(patched.scene.duration).toBe(240);
      expect(patched.scene.nodes.at(-1)?.id).toBe("audio-1-node");
    }
  });

  it("uses unique node ids and layers visual assets above existing visuals", () => {
    const scene = baseScene();
    const asset = assetLike({
      id: "image-1",
      sceneAssetId: "image_1",
      type: "image",
      label: "Image 1",
      objectUrl: "blob:image-1",
      width: 800,
      height: 1200,
    });
    const result = createInsertLocalMediaAssetPatch({
      scene,
      asset,
      insertAtFrame: 25,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.nodeId).toBe("image-1-node-2");
    expect(result.patch.at(-1)).toMatchObject({
      op: "insertNode",
      node: {
        id: "image-1-node-2",
        type: "img",
        from: 25,
        duration: 90,
        style: { zIndex: 15 },
      },
    });
  });

  it("rejects assets before metadata is ready", () => {
    const result = createInsertLocalMediaAssetPatch({
      scene: baseScene(),
      asset: assetLike({
        id: "video-1",
        sceneAssetId: "video_1",
        type: "video",
        label: "Video 1",
        status: "probing",
      }),
    });

    expect(result).toEqual({
      ok: false,
      error: "Video 1 is still reading metadata.",
    });
  });
});

describe("createDefaultSceneForAsset", () => {
  it("sizes portrait, square, and audio starts predictably", () => {
    expect(
      createDefaultSceneForAsset(
        assetLike({
          id: "video-1",
          sceneAssetId: "video_1",
          type: "video",
          width: 1080,
          height: 1920,
        }),
      ),
    ).toMatchObject({ width: 1080, height: 1920 });
    expect(
      createDefaultSceneForAsset(
        assetLike({
          id: "image-1",
          sceneAssetId: "image_1",
          type: "image",
          width: 500,
          height: 500,
        }),
      ),
    ).toMatchObject({ width: 1080, height: 1080 });
    expect(
      createDefaultSceneForAsset(
        assetLike({
          id: "audio-1",
          sceneAssetId: "audio_1",
          type: "audio",
        }),
      ),
    ).toMatchObject({ width: 1080, height: 1920 });
  });
});

function baseScene(): Scene {
  return {
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 120,
    assets: {
      existing_image: {
        id: "existing_image",
        type: "image",
        src: "existing.png",
      },
    },
    nodes: [
      {
        id: "image-1-node",
        type: "img",
        assetId: "existing_image",
        from: 0,
        duration: 120,
        style: { zIndex: 5 },
      },
    ],
  };
}

function assetLike(
  overrides: Partial<LocalMediaAsset> &
    Pick<LocalMediaAsset, "id" | "sceneAssetId" | "type">,
): LocalMediaAsset {
  return {
    file: {
      name: "asset.bin",
      type: "application/octet-stream",
      size: 100,
    } as File,
    objectUrl: "blob:asset",
    label: overrides.id,
    aliases: [overrides.id],
    fileName: "asset.bin",
    mimeType: "application/octet-stream",
    sizeBytes: 100,
    status: "ready",
    ...overrides,
  };
}
