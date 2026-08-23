import { describe, expect, it } from "vitest";
import { applyScenePatch, type Scene } from "@motionforge/schema";
import { createSplitLayerPatch } from "./split-layer";

const scene: Scene = {
  schemaVersion: 1,
  width: 1280,
  height: 720,
  fps: 30,
  duration: 150,
  assets: {
    clip: { id: "clip", type: "video", src: "clip.mp4" },
    voice: { id: "voice", type: "audio", src: "voice.wav" },
  },
  nodes: [
    {
      id: "title",
      type: "text",
      text: "Split me",
      from: 10,
      duration: 80,
      style: { left: 100, top: 40 },
    },
    {
      id: "clip-node",
      type: "video",
      assetId: "clip",
      from: 0,
      duration: 90,
      videoStartTime: 1,
      playbackRate: 2,
      style: { width: 1280, height: 720 },
    },
    {
      id: "voice-node",
      type: "audio",
      assetId: "voice",
      from: 20,
      duration: 60,
      audioStartTime: 0.5,
    },
  ],
};

describe("createSplitLayerPatch", () => {
  it("creates a transactional patch that replaces a node with adjacent halves", () => {
    const result = createSplitLayerPatch({
      scene,
      nodeId: "title",
      splitFrame: 40,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.patch).toEqual([
      {
        op: "insertNode",
        parentId: undefined,
        beforeId: "title",
        node: expect.objectContaining({
          id: "title-a",
          from: 10,
          duration: 30,
          text: "Split me",
        }),
      },
      {
        op: "insertNode",
        parentId: undefined,
        beforeId: "title",
        node: expect.objectContaining({
          id: "title-b",
          from: 40,
          duration: 50,
          text: "Split me",
        }),
      },
      { op: "removeNode", id: "title" },
    ]);

    const applied = applyScenePatch(scene, result.patch);
    expect(applied.ok).toBe(true);
    expect(applied.ok ? applied.scene.nodes.map((node) => node.id) : []).toEqual(
      ["title-a", "title-b", "clip-node", "voice-node"],
    );
  });

  it("offsets media trim on the right half so playback continues", () => {
    const video = createSplitLayerPatch({
      scene,
      nodeId: "clip-node",
      splitFrame: 30,
    });
    const audio = createSplitLayerPatch({
      scene,
      nodeId: "voice-node",
      splitFrame: 50,
    });

    expect(video.ok ? video.patch[1] : null).toMatchObject({
      op: "insertNode",
      node: {
        id: "clip-node-b",
        from: 30,
        duration: 60,
        videoStartTime: 3,
      },
    });
    expect(audio.ok ? audio.patch[1] : null).toMatchObject({
      op: "insertNode",
      node: {
        id: "voice-node-b",
        from: 50,
        duration: 30,
        audioStartTime: 1.5,
      },
    });
  });

  it("keeps split ids unique when earlier split suffixes already exist", () => {
    const result = createSplitLayerPatch({
      scene: {
        ...scene,
        nodes: [
          { id: "title-a", type: "text", text: "Existing" },
          { id: "title-b", type: "text", text: "Existing" },
          ...(scene.nodes ?? []),
        ],
      },
      nodeId: "title",
      splitFrame: 20,
    });

    expect(result.ok ? [result.leftId, result.rightId] : []).toEqual([
      "title-a-2",
      "title-b-2",
    ]);
  });

  it("splits nested leaf nodes using parent-local frames", () => {
    const result = createSplitLayerPatch({
      scene: {
        ...scene,
        nodes: [
          {
            id: "group",
            type: "div",
            from: 20,
            duration: 80,
            children: [
              {
                id: "nested-title",
                type: "text",
                text: "Nested",
                from: 10,
                duration: 50,
              },
            ],
          },
        ],
      },
      nodeId: "nested-title",
      splitFrame: 30,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.patch).toMatchObject([
      {
        op: "insertNode",
        parentId: "group",
        beforeId: "nested-title",
        node: { id: "nested-title-a", from: 10, duration: 20 },
      },
      {
        op: "insertNode",
        parentId: "group",
        beforeId: "nested-title",
        node: { id: "nested-title-b", from: 30, duration: 30 },
      },
      { op: "removeNode", id: "nested-title" },
    ]);

    const applied = applyScenePatch(
      {
        ...scene,
        nodes: [
          {
            id: "group",
            type: "div",
            from: 20,
            duration: 80,
            children: [
              {
                id: "nested-title",
                type: "text",
                text: "Nested",
                from: 10,
                duration: 50,
              },
            ],
          },
        ],
      },
      result.patch,
    );
    expect(applied.ok ? applied.scene.nodes[0]?.children?.map((node) => node.id) : []).toEqual([
      "nested-title-a",
      "nested-title-b",
    ]);
  });

  it("rejects splitting nodes with children to avoid duplicate child ids", () => {
    const result = createSplitLayerPatch({
      scene: {
        ...scene,
        nodes: [
          {
            id: "group",
            type: "div",
            from: 0,
            duration: 90,
            children: [{ id: "child", type: "text", text: "Child" }],
          },
        ],
      },
      nodeId: "group",
      splitFrame: 30,
    });

    expect(result).toEqual({
      ok: false,
      error: "Split leaf layers only for now. Select a layer without children.",
    });
  });

  it("rejects split frames outside the selected layer interior", () => {
    expect(
      createSplitLayerPatch({ scene, nodeId: "title", splitFrame: 10 }),
    ).toEqual({
      ok: false,
      error: "Move the playhead inside the selected layer before splitting.",
    });
    expect(
      createSplitLayerPatch({ scene, nodeId: "title", splitFrame: 90 }),
    ).toEqual({
      ok: false,
      error: "Move the playhead inside the selected layer before splitting.",
    });
    expect(
      createSplitLayerPatch({ scene, nodeId: "missing", splitFrame: 40 }),
    ).toEqual({
      ok: false,
      error: "Select a layer that exists before splitting.",
    });
  });
});
