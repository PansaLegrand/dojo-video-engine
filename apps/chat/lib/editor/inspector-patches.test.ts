import { describe, expect, it } from "vitest";
import { applyScenePatch, type Scene } from "@motionforge/schema";
import { createInspectorPatch } from "./inspector-patches";

const scene: Scene = {
  schemaVersion: 1,
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 120,
  assets: {
    "video-asset": {
      id: "video-asset",
      type: "video",
      src: "video.mp4",
    },
    "voice-asset": {
      id: "voice-asset",
      type: "audio",
      src: "voice.mp3",
    },
  },
  nodes: [
    {
      id: "title",
      type: "text",
      text: "Original",
      from: 0,
      duration: 90,
      style: {
        position: "absolute",
        left: 100,
        top: 200,
        width: 600,
        opacity: 1,
        color: "#ffffff",
        fontSize: 72,
        fontWeight: 800,
        textAlign: "center",
        textStroke: "4px #000000",
      },
    },
    {
      id: "clip",
      type: "video",
      assetId: "video-asset",
      from: 10,
      duration: 60,
      videoStartTime: 1,
      playbackRate: 1,
      volume: 1,
      style: {
        objectFit: "cover",
        objectPosition: "center center",
      },
    },
    {
      id: "voice",
      type: "audio",
      assetId: "voice-asset",
      from: 0,
      duration: 100,
      audioStartTime: 0,
      volume: 0.8,
    },
  ],
};

describe("createInspectorPatch", () => {
  it("creates text patches", () => {
    const result = createInspectorPatch("title", "text", "Updated title");

    expect(result).toEqual({
      ok: true,
      patch: [{ op: "setText", id: "title", text: "Updated title" }],
    });
  });

  it("creates timing patches that apply through the schema patch API", () => {
    const result = createInspectorPatch("title", "duration", "45");

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const applied = applyScenePatch(scene, result.patch);

    expect(applied.ok).toBe(true);
    expect(applied.ok ? applied.scene.nodes[0]?.duration : undefined).toBe(45);
  });

  it("creates style patches and uses blank numeric fields to delete style values", () => {
    const left = createInspectorPatch("title", "left", "240");
    const height = createInspectorPatch("title", "height", "");
    const fontSize = createInspectorPatch("title", "fontSize", "96");

    expect(left).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { left: 240 } }],
    });
    expect(height).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { height: null } }],
    });
    expect(fontSize).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { fontSize: 96 } }],
    });
    expect(createInspectorPatch("title", "fontSize", "72px")).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { fontSize: "72px" } }],
    });
  });

  it("creates text style patches and deletes blank string values", () => {
    const color = createInspectorPatch("title", "color", "#14b8a6");
    const align = createInspectorPatch("title", "textAlign", "right");
    const stroke = createInspectorPatch("title", "textStroke", "");
    const weight = createInspectorPatch("title", "fontWeight", "bold");

    expect(color).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { color: "#14b8a6" } }],
    });
    expect(align).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { textAlign: "right" } }],
    });
    expect(stroke).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { textStroke: null } }],
    });
    expect(weight).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { fontWeight: "bold" } }],
    });
  });

  it("creates media node prop patches that apply through the schema patch API", () => {
    const sourceStart = createInspectorPatch("clip", "videoStartTime", "2.5");
    const rate = createInspectorPatch("clip", "playbackRate", "1.25");
    const volume = createInspectorPatch("voice", "volume", "0.4");
    const clearAudioStart = createInspectorPatch("voice", "audioStartTime", "");

    expect(sourceStart).toEqual({
      ok: true,
      patch: [
        {
          op: "setNodeProps",
          id: "clip",
          props: { videoStartTime: 2.5 },
        },
      ],
    });
    expect(rate).toEqual({
      ok: true,
      patch: [
        {
          op: "setNodeProps",
          id: "clip",
          props: { playbackRate: 1.25 },
        },
      ],
    });
    expect(volume).toEqual({
      ok: true,
      patch: [{ op: "setNodeProps", id: "voice", props: { volume: 0.4 } }],
    });
    expect(clearAudioStart).toEqual({
      ok: true,
      patch: [
        { op: "setNodeProps", id: "voice", props: { audioStartTime: null } },
      ],
    });

    if (sourceStart.ok) {
      const applied = applyScenePatch(scene, sourceStart.patch);
      expect(
        applied.ok ? applied.scene.nodes[1]?.videoStartTime : undefined,
      ).toBe(2.5);
    }
  });

  it("creates object fit and position style patches", () => {
    expect(createInspectorPatch("clip", "objectFit", "contain")).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "clip", style: { objectFit: "contain" } }],
    });
    expect(createInspectorPatch("clip", "objectPosition", "50% 20%")).toEqual({
      ok: true,
      patch: [
        { op: "setStyle", id: "clip", style: { objectPosition: "50% 20%" } },
      ],
    });
  });

  it("rejects invalid field values before patching", () => {
    expect(createInspectorPatch("title", "duration", "0")).toEqual({
      ok: false,
      error: "duration must be greater than 0.",
    });
    expect(createInspectorPatch("title", "from", "-1")).toEqual({
      ok: false,
      error: "from must be 0 or greater.",
    });
    expect(createInspectorPatch("title", "opacity", "1.4")).toEqual({
      ok: false,
      error: "opacity must be between 0 and 1.",
    });
    expect(createInspectorPatch("title", "textAlign", "justify")).toEqual({
      ok: false,
      error: "textAlign must be left, center, or right.",
    });
    expect(createInspectorPatch("title", "fontWeight", "heavy")).toEqual({
      ok: false,
      error: "fontWeight must be a positive whole number, normal, or bold.",
    });
    expect(createInspectorPatch("clip", "videoStartTime", "-0.5")).toEqual({
      ok: false,
      error: "videoStartTime must be 0 or greater.",
    });
    expect(createInspectorPatch("clip", "playbackRate", "0")).toEqual({
      ok: false,
      error: "playbackRate must be greater than 0.",
    });
    expect(createInspectorPatch("clip", "volume", "1.2")).toEqual({
      ok: false,
      error: "volume must be between 0 and 1.",
    });
    expect(createInspectorPatch("clip", "objectFit", "crop")).toEqual({
      ok: false,
      error: "objectFit must be cover, contain, fill, none, or scale-down.",
    });
  });
});
