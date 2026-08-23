import { describe, expect, it, vi } from "vitest";
import type { Scene } from "@motionforge/schema";
import {
  createChatMediaAssetManifest,
  createLocalMediaAssetShell,
  describeLargeLocalMediaAsset,
  describeLocalMediaAssetReadiness,
  formatFileSize,
  formatMediaDuration,
  isLocalMediaAssetUsed,
  largeLocalMediaAssetBytes,
  localMediaTypeFromFile,
  revokeLocalMediaAssetUrls,
  veryLargeLocalMediaAssetBytes,
  type LocalMediaAsset,
} from "./assets";

describe("local media asset helpers", () => {
  it("classifies files by mime type or extension", () => {
    expect(localMediaTypeFromFile(fileLike("clip.mp4", "video/mp4"))).toBe(
      "video",
    );
    expect(localMediaTypeFromFile(fileLike("voice.m4a", ""))).toBe("audio");
    expect(localMediaTypeFromFile(fileLike("poster.WEBP", ""))).toBe("image");
    expect(localMediaTypeFromFile(fileLike("notes.txt", "text/plain"))).toBeNull();
  });

  it("creates stable per-type labels, ids, scene ids, and aliases", () => {
    const existing = [
      assetLike({ id: "video-1", sceneAssetId: "video_1", type: "video" }),
    ];

    const asset = createLocalMediaAssetShell({
      file: fileLike("Beach Day.mp4", "video/mp4", 2_048) as File,
      objectUrl: "blob:video-2",
      existingAssets: existing,
    });

    expect(asset).toMatchObject({
      id: "video-2",
      sceneAssetId: "video_2",
      type: "video",
      label: "Video 2",
      fileName: "Beach Day.mp4",
      mimeType: "video/mp4",
      sizeBytes: 2_048,
      status: "probing",
    });
    expect(asset?.aliases).toEqual([
      "Video 2",
      "video two",
      "second video",
      "Beach Day.mp4",
      "Beach Day",
    ]);
  });

  it("builds a compact manifest with scene usage state", () => {
    const scene: Scene = {
      schemaVersion: 1,
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 120,
      assets: {
        video_1: { id: "video_1", type: "video", src: "blob:video-1" },
      },
      nodes: [],
    };
    const assets = [
      assetLike({
        id: "video-1",
        sceneAssetId: "video_1",
        type: "video",
        label: "Video 1",
        durationSeconds: 12.4,
        width: 1920,
        height: 1080,
      }),
      assetLike({
        id: "audio-1",
        sceneAssetId: "audio_1",
        type: "audio",
        label: "Audio 1",
      }),
    ];

    expect(createChatMediaAssetManifest({ assets, scene })).toEqual([
      {
        id: "video-1",
        sceneAssetId: "video_1",
        type: "video",
        src: "blob:asset",
        label: "Video 1",
        aliases: ["Video 1"],
        fileName: "asset.bin",
        durationSeconds: 12.4,
        width: 1920,
        height: 1080,
        alreadyInScene: true,
      },
      {
        id: "audio-1",
        sceneAssetId: "audio_1",
        type: "audio",
        src: "blob:asset",
        label: "Audio 1",
        aliases: ["Audio 1"],
        fileName: "asset.bin",
        durationSeconds: undefined,
        width: undefined,
        height: undefined,
        alreadyInScene: false,
      },
    ]);
    expect(isLocalMediaAssetUsed(assets[0]!, scene)).toBe(true);
    expect(isLocalMediaAssetUsed(assets[1]!, scene)).toBe(false);
  });

  it("formats media durations and file sizes", () => {
    expect(formatMediaDuration(undefined)).toBe("unknown");
    expect(formatMediaDuration(5.2)).toBe("00:05");
    expect(formatMediaDuration(65.6)).toBe("01:06");
    expect(formatMediaDuration(3661)).toBe("1:01:01");
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(2_621_440)).toBe("2.5 MB");
  });

  it("describes readiness for probing, errors, ready, and large files", () => {
    expect(
      describeLocalMediaAssetReadiness(
        assetLike({
          id: "video-1",
          sceneAssetId: "video_1",
          type: "video",
          status: "probing",
        }),
      ),
    ).toMatchObject({
      severity: "probing",
      label: "reading",
      blocksUse: true,
    });

    expect(
      describeLocalMediaAssetReadiness(
        assetLike({
          id: "video-1",
          sceneAssetId: "video_1",
          type: "video",
          status: "error",
          error: "Could not read video metadata.",
        }),
      ),
    ).toEqual({
      severity: "error",
      label: "error",
      detail: "Could not read video metadata.",
      blocksUse: true,
    });

    expect(
      describeLocalMediaAssetReadiness(
        assetLike({
          id: "video-1",
          sceneAssetId: "video_1",
          type: "video",
          sizeBytes: largeLocalMediaAssetBytes,
        }),
      ),
    ).toMatchObject({
      severity: "warning",
      label: "large",
      blocksUse: false,
    });

    expect(
      describeLocalMediaAssetReadiness(
        assetLike({
          id: "image-1",
          sceneAssetId: "image_1",
          type: "image",
        }),
      ),
    ).toEqual({
      severity: "ready",
      label: "ready",
      detail: "Ready to use.",
      blocksUse: false,
    });
  });

  it("describes the whole-blob memory boundary for large local files", () => {
    expect(describeLargeLocalMediaAsset(largeLocalMediaAssetBytes - 1)).toBeNull();
    expect(describeLargeLocalMediaAsset(largeLocalMediaAssetBytes)).toContain(
      "whole blobs",
    );
    expect(
      describeLargeLocalMediaAsset(veryLargeLocalMediaAssetBytes),
    ).toContain("full source in memory");
  });

  it("revokes object urls through an injectable revoker", () => {
    const revoke = vi.fn();

    revokeLocalMediaAssetUrls(
      assetLike({
        id: "image-1",
        sceneAssetId: "image_1",
        type: "image",
        objectUrl: "blob:image-1",
      }),
      revoke,
    );

    expect(revoke).toHaveBeenCalledWith("blob:image-1");
  });
});

function fileLike(name: string, type: string, size = 128): Pick<File, "name" | "type" | "size"> {
  return { name, type, size };
}

function assetLike(
  overrides: Partial<LocalMediaAsset> & {
    id: string;
    sceneAssetId: string;
    type: LocalMediaAsset["type"];
  },
): LocalMediaAsset {
  return {
    file: fileLike("asset.bin", "application/octet-stream") as File,
    objectUrl: "blob:asset",
    label: overrides.id,
    aliases: [overrides.label ?? overrides.id],
    fileName: "asset.bin",
    mimeType: "application/octet-stream",
    sizeBytes: 128,
    status: "ready",
    ...overrides,
  };
}
