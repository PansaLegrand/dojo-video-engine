import { describe, expect, it } from "vitest";
import { applyScenePatch, type Scene } from "@dojo-video-engine/schema";
import { buildPresetPatchExample, presetCatalog } from "./catalog.js";

function sceneWithMedia(): Scene {
  return {
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 180,
    assets: {
      shotAsset: {
        id: "shotAsset",
        type: "image",
        src: "data:image/png;base64,AAAA",
      },
      clipAsset: {
        id: "clipAsset",
        type: "video",
        src: "clip.mp4",
      },
      musicAsset: {
        id: "musicAsset",
        type: "audio",
        src: "music.mp3",
      },
    },
    nodes: [
      {
        id: "background",
        type: "div",
        style: { width: "100%", height: "100%", backgroundColor: "#101820" },
      },
      {
        id: "shot",
        type: "img",
        assetId: "shotAsset",
        style: { width: "100%", height: "100%", objectFit: "cover" },
      },
      {
        id: "clip",
        type: "video",
        assetId: "clipAsset",
        style: { width: "100%", height: "100%", objectFit: "cover" },
      },
    ],
  };
}

function sceneWithoutVideoAsset(): Scene {
  const scene = sceneWithMedia();

  return {
    ...scene,
    assets: {
      shotAsset: scene.assets.shotAsset!,
      musicAsset: scene.assets.musicAsset!,
    },
    nodes: scene.nodes.filter((node) => node.id !== "clip"),
  };
}

function sceneWithoutAudioAsset(): Scene {
  const scene = sceneWithMedia();

  return {
    ...scene,
    assets: {
      shotAsset: scene.assets.shotAsset!,
      clipAsset: scene.assets.clipAsset!,
    },
  };
}

function sceneWithoutMedia(): Scene {
  return {
    ...sceneWithMedia(),
    assets: {},
    nodes: [
      {
        id: "background",
        type: "div",
        style: { width: "100%", height: "100%", backgroundColor: "#101820" },
      },
    ],
  };
}

function catalogItem(family: string, key: string) {
  const item = presetCatalog.find(
    (entry) => entry.family === family && entry.key === key,
  );

  if (!item) {
    throw new Error(`Missing catalog item ${family}:${key}`);
  }

  return item;
}

describe("preset patch examples", () => {
  it("builds setStyle examples for media looks", () => {
    const example = buildPresetPatchExample(
      catalogItem("media", "punchySocial"),
      sceneWithMedia(),
    );

    expect(example.ok).toBe(true);
    if (!example.ok) return;

    expect(example.patch).toMatchObject([
      { op: "setStyle", id: "shot", style: { filter: expect.any(String) } },
    ]);
    expect(applyScenePatch(sceneWithMedia(), example.patch).ok).toBe(true);
  });

  it("builds setStyle examples for clip layouts", () => {
    const example = buildPresetPatchExample(
      catalogItem("layout", "phoneSafeVertical"),
      sceneWithMedia(),
    );

    expect(example.ok).toBe(true);
    if (!example.ok) return;

    expect(example.patch).toMatchObject([
      { op: "setStyle", id: "shot", style: { objectFit: "cover" } },
    ]);
    expect(applyScenePatch(sceneWithMedia(), example.patch).ok).toBe(true);
  });

  it("builds insertNode examples for text overlays", () => {
    const example = buildPresetPatchExample(
      catalogItem("text", "titleCard"),
      sceneWithMedia(),
    );

    expect(example.ok).toBe(true);
    if (!example.ok) return;

    expect(example.patch[0]).toMatchObject({
      op: "insertNode",
      node: { id: "titleCard-overlay", type: "div" },
    });
    expect(applyScenePatch(sceneWithMedia(), example.patch).ok).toBe(true);
  });

  it("builds insertNode examples for image overlays", () => {
    const example = buildPresetPatchExample(
      catalogItem("image", "logoBug"),
      sceneWithMedia(),
    );

    expect(example.ok).toBe(true);
    if (!example.ok) return;

    expect(example.patch[0]).toMatchObject({
      op: "insertNode",
      node: {
        id: "logoBug-overlay",
        type: "div",
        children: [{ type: "img", assetId: "shotAsset" }],
      },
    });
    expect(applyScenePatch(sceneWithMedia(), example.patch).ok).toBe(true);
  });

  it("builds insertNode examples for video overlays", () => {
    const example = buildPresetPatchExample(
      catalogItem("video", "pictureInPicture"),
      sceneWithMedia(),
    );

    expect(example.ok).toBe(true);
    if (!example.ok) return;

    expect(example.patch[0]).toMatchObject({
      op: "insertNode",
      node: {
        id: "pictureInPicture-overlay",
        type: "video",
        assetId: "clipAsset",
        volume: 0,
      },
    });
    expect(applyScenePatch(sceneWithMedia(), example.patch).ok).toBe(true);
  });

  it("builds insertNode examples for audio overlays", () => {
    const example = buildPresetPatchExample(
      catalogItem("audio", "backgroundMusic"),
      sceneWithMedia(),
    );

    expect(example.ok).toBe(true);
    if (!example.ok) return;

    expect(example.patch[0]).toMatchObject({
      op: "insertNode",
      node: {
        id: "backgroundMusic-overlay",
        type: "audio",
        assetId: "musicAsset",
        volume: 0.28,
      },
    });
    expect(applyScenePatch(sceneWithMedia(), example.patch).ok).toBe(true);
  });

  it("builds insertNode examples for transitions", () => {
    const example = buildPresetPatchExample(
      catalogItem("transition", "fade"),
      sceneWithMedia(),
    );

    expect(example.ok).toBe(true);
    if (!example.ok) return;

    expect(example.patch[0]).toMatchObject({
      op: "insertNode",
      node: { id: "fade-transition", type: "div", from: 90 },
    });
    expect(applyScenePatch(sceneWithMedia(), example.patch).ok).toBe(true);
  });

  it("explains unsupported preset applications", () => {
    const noTarget = buildPresetPatchExample(
      catalogItem("media", "cleanProduct"),
      sceneWithoutMedia(),
    );
    const subtitles = buildPresetPatchExample(
      catalogItem("subtitles", "classic"),
      sceneWithMedia(),
    );
    const image = buildPresetPatchExample(
      catalogItem("image", "logoBug"),
      sceneWithoutMedia(),
    );
    const video = buildPresetPatchExample(
      catalogItem("video", "pictureInPicture"),
      sceneWithoutVideoAsset(),
    );
    const audio = buildPresetPatchExample(
      catalogItem("audio", "backgroundMusic"),
      sceneWithoutAudioAsset(),
    );

    expect(noTarget).toMatchObject({
      ok: false,
      reason: expect.stringContaining("image or video"),
    });
    expect(subtitles).toMatchObject({
      ok: false,
      reason: expect.stringContaining("word-level transcript"),
    });
    expect(image).toMatchObject({
      ok: false,
      reason: expect.stringContaining("image asset"),
    });
    expect(video).toMatchObject({
      ok: false,
      reason: expect.stringContaining("video asset"),
    });
    expect(audio).toMatchObject({
      ok: false,
      reason: expect.stringContaining("audio asset"),
    });
  });
});
