import { describe, expect, it } from "vitest";
import { applyScenePatch, validateScene, type Scene } from "@motionforge/schema";
import type { ChatMediaAssetManifestItem } from "./assets";
import { compileMediaInstruction } from "./instruction-compiler";

describe("compileMediaInstruction", () => {
  it("compiles the north-star two-video prompt into a valid scene patch", () => {
    const result = compileMediaInstruction({
      scene: null,
      mediaAssets: mediaAssets(),
      instruction:
        'Put video one first, but only keep it from 5 to 10 seconds, and the second video keep it all, write text "I love this" at the second video on top.',
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.baseScene).toMatchObject({
      width: 1280,
      height: 720,
      fps: 30,
    });
    expect(result.patch).toMatchObject([
      { op: "setSceneMeta", duration: 510 },
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
          duration: 150,
          videoStartTime: 5,
        },
      },
      {
        op: "setAsset",
        asset: { id: "video_2", type: "video", src: "blob:video-2" },
      },
      {
        op: "insertNode",
        node: {
          id: "video-2-node",
          type: "video",
          assetId: "video_2",
          from: 150,
          duration: 360,
          videoStartTime: 0,
        },
      },
      {
        op: "insertNode",
        node: {
          id: "video-2-text",
          type: "text",
          text: "I love this",
          from: 150,
          duration: 360,
          style: { top: 58 },
        },
      },
    ]);
    expect(result.plan).toEqual({
      summary: result.summary,
      fps: 30,
      steps: [
        {
          type: "sequence-clip",
          nodeId: "video-1-node",
          assetId: "video-1",
          label: "Video 1",
          mediaType: "video",
          sourceStartSeconds: 5,
          sourceEndSeconds: 10,
          sceneStartFrame: 0,
          durationFrames: 150,
        },
        {
          type: "sequence-clip",
          nodeId: "video-2-node",
          assetId: "video-2",
          label: "Video 2",
          mediaType: "video",
          sourceStartSeconds: 0,
          sourceEndSeconds: undefined,
          sceneStartFrame: 150,
          durationFrames: 360,
        },
        {
          type: "text-overlay",
          nodeId: "video-2-text",
          text: "I love this",
          targetAssetId: "video-2",
          fromFrame: 150,
          durationFrames: 360,
          position: "top",
        },
      ],
    });

    const patched = applyScenePatch(result.baseScene, result.patch);
    expect(patched.ok).toBe(true);

    if (patched.ok) {
      expect(validateScene(patched.scene)).toMatchObject({ ok: true });
      expect(patched.scene.duration).toBe(510);
      expect(patched.scene.nodes.map((node) => node.id)).toEqual([
        "video-1-node",
        "video-2-node",
        "video-2-text",
      ]);
    }
    expect(result.summary).toContain("Video 1 5s-10s");
  });

  it("uses explicit @ mention ranges and unique ids against an existing scene", () => {
    const result = compileMediaInstruction({
      scene: existingScene(),
      mediaAssets: mediaAssets(),
      instruction: "Use @Video 1[00:02-00:04] then @Video 2.",
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.patch).toMatchObject([
      { op: "setSceneMeta", duration: 420 },
      { op: "setAsset", asset: { id: "video_1" } },
      {
        op: "insertNode",
        node: {
          id: "video-1-node-2",
          from: 0,
          duration: 60,
          videoStartTime: 2,
        },
      },
      { op: "setAsset", asset: { id: "video_2" } },
      {
        op: "insertNode",
        node: {
          id: "video-2-node",
          from: 60,
          duration: 360,
        },
      },
    ]);
    expect(result.plan.steps.map((step) => step.nodeId)).toEqual([
      "video-1-node-2",
      "video-2-node",
    ]);
  });

  it("declines prompts without referenced media", () => {
    expect(
      compileMediaInstruction({
        scene: null,
        mediaAssets: mediaAssets(),
        instruction: "Make the title bigger.",
      }),
    ).toEqual({
      ok: false,
      reason: "Instruction did not reference media assets.",
    });
  });
});

function mediaAssets(): ChatMediaAssetManifestItem[] {
  return [
    {
      id: "video-1",
      sceneAssetId: "video_1",
      type: "video",
      src: "blob:video-1",
      label: "Video 1",
      aliases: ["video one", "first video"],
      fileName: "first.mp4",
      durationSeconds: 20,
      width: 1920,
      height: 1080,
      alreadyInScene: false,
    },
    {
      id: "video-2",
      sceneAssetId: "video_2",
      type: "video",
      src: "blob:video-2",
      label: "Video 2",
      aliases: ["video two", "second video"],
      fileName: "second.mp4",
      durationSeconds: 12,
      width: 1920,
      height: 1080,
      alreadyInScene: false,
    },
  ];
}

function existingScene(): Scene {
  return {
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 120,
    assets: {
      existing: { id: "existing", type: "video", src: "blob:existing" },
    },
    nodes: [
      {
        id: "video-1-node",
        type: "video",
        assetId: "existing",
        duration: 120,
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          width: 1080,
          height: 1920,
        },
      },
    ],
  };
}
