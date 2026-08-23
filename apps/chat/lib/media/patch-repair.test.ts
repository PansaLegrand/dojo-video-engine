import { describe, expect, it } from "vitest";
import { applyScenePatch, type Scene } from "@motionforge/schema";
import type { ChatMediaAssetManifestItem } from "./assets";
import { repairMediaPatch } from "./patch-repair";

describe("repairMediaPatch", () => {
  it("repairs model media ids and inserts missing setAsset ops", () => {
    const result = repairMediaPatch({
      scene: baseScene(),
      mediaAssets: mediaAssets(),
      patchInput: [
        {
          op: "insertNode",
          node: {
            id: "clip",
            type: "video",
            assetId: "video-1",
            from: 0,
            duration: 90,
            videoStartTime: 2,
            style: { width: 1280, height: 720 },
          },
        },
      ],
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.patch).toMatchObject([
      {
        op: "setAsset",
        asset: { id: "video_1", type: "video", src: "blob:video-1" },
      },
      {
        op: "insertNode",
        node: { id: "clip", assetId: "video_1", videoStartTime: 2 },
      },
    ]);
    expect(result.diagnostics.join("\n")).toContain(
      'Repaired node assetId "video-1"',
    );
    expect(applyScenePatch(baseScene(), result.patch).ok).toBe(true);
  });

  it("repairs setAsset ops to manifest source data", () => {
    const result = repairMediaPatch({
      scene: baseScene(),
      mediaAssets: mediaAssets(),
      patchInput: [
        {
          op: "setAsset",
          asset: { id: "Video 1", type: "image", src: "made-up.png" },
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      patch: [
        {
          op: "setAsset",
          asset: { id: "video_1", type: "video", src: "blob:video-1" },
        },
      ],
    });
  });

  it("repairs setNodeProps asset replacement and inserts missing assets", () => {
    const scene: Scene = {
      ...baseScene(),
      assets: {
        existing: { id: "existing", type: "video", src: "existing.mp4" },
      },
      nodes: [
        {
          id: "clip",
          type: "video",
          assetId: "existing",
          duration: 90,
          style: { width: 1280, height: 720 },
        },
      ],
    };
    const result = repairMediaPatch({
      scene,
      mediaAssets: mediaAssets(),
      patchInput: [
        { op: "setNodeProps", id: "clip", props: { assetId: "first.mp4" } },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      patch: [
        { op: "setAsset", asset: { id: "video_1", src: "blob:video-1" } },
        { op: "setNodeProps", id: "clip", props: { assetId: "video_1" } },
      ],
    });
  });

  it("splits model setNodeProps timing, text, and style into supported ops", () => {
    const scene: Scene = {
      ...baseScene(),
      nodes: [
        {
          id: "title",
          type: "text",
          text: "Old",
          duration: 90,
          style: { color: "#fff" },
        },
      ],
    };
    const result = repairMediaPatch({
      scene,
      mediaAssets: [],
      patchInput: [
        {
          op: "setNodeProps",
          id: "title",
          props: {
            from: 12,
            duration: 45,
            text: "New",
            style: {
              color: "#facc15",
              textTransform: "uppercase",
              transform: "scale(1.1)",
            },
            durationSeconds: 1.5,
          },
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      patch: [
        { op: "retime", id: "title", from: 12, duration: 45 },
        { op: "setText", id: "title", text: "New" },
        {
          op: "setStyle",
          id: "title",
          style: { color: "#facc15", transform: "scale(1.1)" },
        },
      ],
    });

    if (result.ok) {
      expect(result.diagnostics.join("\n")).toContain(
        'Converted setNodeProps timing for "title" to retime',
      );
      expect(applyScenePatch(scene, result.patch).ok).toBe(true);
    }
  });

  it("normalizes unsupported style enum values in patch styles", () => {
    const scene: Scene = {
      ...baseScene(),
      nodes: [{ id: "row", type: "div", duration: 90 }],
    };
    const result = repairMediaPatch({
      scene,
      mediaAssets: [],
      patchInput: [
        {
          op: "setStyle",
          id: "row",
          style: {
            alignItems: "baseline",
            justifyContent: "space-around",
            position: "fixed",
            overflow: "auto",
            textAlign: "justify",
            fontStyle: "oblique",
            background: "radial-gradient(circle, #fff, #000)",
            filter: "url(#glow) drop-shadow(0px 0px 12px #fff)",
          },
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      patch: [
        {
          op: "setStyle",
          id: "row",
          style: {
            alignItems: "center",
            justifyContent: "space-between",
            position: "absolute",
            overflow: "hidden",
            textAlign: "center",
            fontStyle: "italic",
          },
        },
      ],
    });

    if (result.ok) {
      const style =
        result.patch[0]?.op === "setStyle" ? result.patch[0].style : {};
      expect(style).not.toHaveProperty("background");
      expect(style).not.toHaveProperty("filter");
      expect(applyScenePatch(scene, result.patch).ok).toBe(true);
    }
  });

  it("drops impossible patch ops while keeping repairable ops", () => {
    const scene: Scene = {
      ...baseScene(),
      nodes: [{ id: "title", type: "text", text: "Old", duration: 90 }],
    };
    const result = repairMediaPatch({
      scene,
      mediaAssets: [],
      patchInput: [
        { op: "setNodeProps", props: { duration: 30 } },
        { op: "animateNode", id: "title" },
        { op: "setNodeProps", id: "title", props: { duration: 30 } },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      patch: [{ op: "retime", id: "title", duration: 30 }],
    });

    if (result.ok) {
      expect(result.diagnostics.join("\n")).toContain(
        "Dropped setNodeProps op because it has no node id",
      );
      expect(result.diagnostics.join("\n")).toContain(
        'Dropped unsupported patch op 1 "animateNode"',
      );
      expect(applyScenePatch(scene, result.patch).ok).toBe(true);
    }
  });

  it("declines unresolved uploaded media references", () => {
    expect(
      repairMediaPatch({
        scene: baseScene(),
        mediaAssets: mediaAssets(),
        patchInput: [
          {
            op: "insertNode",
            node: { id: "clip", type: "video", assetId: "video-99" },
          },
        ],
      }),
    ).toEqual({
      ok: false,
      errors: ['Patch op 0: insertNode references unknown uploaded asset "video-99".'],
    });
  });
});

function baseScene(): Scene {
  return {
    schemaVersion: 1,
    width: 1280,
    height: 720,
    fps: 30,
    duration: 90,
    assets: {},
    nodes: [],
  };
}

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
      durationSeconds: 8,
      width: 1280,
      height: 720,
      alreadyInScene: false,
    },
  ];
}
