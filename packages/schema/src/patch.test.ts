import { describe, expect, it } from "vitest";
import { applyScenePatch, closestIds, type ScenePatch } from "./patch.js";

const baseScene = () => ({
  schemaVersion: 1,
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 90,
  assets: {
    logo: { id: "logo", type: "image", src: "data:image/png;base64,AAAA" },
  },
  nodes: [
    {
      id: "bg",
      type: "div",
      style: { width: "100%", height: "100%", backgroundColor: "#101820" },
    },
    {
      id: "title",
      type: "text",
      text: "Hello",
      from: 0,
      duration: 60,
      style: { fontSize: 48, color: "#ffffff" },
    },
    {
      id: "badge",
      type: "img",
      assetId: "logo",
      style: { width: 64, height: 64 },
    },
  ],
});

const mediaScene = () => ({
  ...baseScene(),
  assets: {
    ...baseScene().assets,
    clip: { id: "clip", type: "video" as const, src: "clip.mp4" },
  },
  nodes: [
    ...baseScene().nodes,
    {
      id: "shot",
      type: "video" as const,
      assetId: "clip",
      from: 0,
      duration: 60,
      videoStartTime: 1,
      playbackRate: 1,
      volume: 1,
      style: { width: 1080, height: 1920 },
    },
  ],
});

function applied(patch: ScenePatch, scene: unknown = baseScene()) {
  const result = applyScenePatch(scene, patch);
  if (!result.ok) {
    throw new Error(result.errors.map((e) => e.message).join("\n"));
  }
  return result.scene;
}

function appliedUnknown(patch: unknown, scene: unknown = baseScene()) {
  const result = applyScenePatch(scene, patch);
  if (!result.ok) {
    throw new Error(result.errors.map((e) => e.message).join("\n"));
  }
  return result.scene;
}

function rejected(patch: unknown, scene: unknown = baseScene()) {
  const result = applyScenePatch(scene, patch);
  if (result.ok) {
    throw new Error("expected the patch to be rejected");
  }
  return result.errors;
}

describe("applyScenePatch", () => {
  it("merges styles, deletes keys via null, and keeps other nodes untouched", () => {
    const scene = applied([
      { op: "setStyle", id: "title", style: { fontSize: 72, color: null } },
    ]);

    const title = scene.nodes.find((n) => n.id === "title");
    expect(title?.style).toEqual({ fontSize: 72 });
    expect(scene.nodes.find((n) => n.id === "bg")?.style?.backgroundColor).toBe(
      "#101820",
    );
  });

  it("never mutates the input scene", () => {
    const input = baseScene();
    const snapshot = structuredClone(input);

    applied([{ op: "setText", id: "title", text: "Changed" }], input);
    applyScenePatch(input, [{ op: "removeNode", id: "no-such-node" }]);

    expect(input).toEqual(snapshot);
  });

  it("rejects the whole patch when any op fails (transactional)", () => {
    const input = baseScene();
    const result = applyScenePatch(input, [
      { op: "setText", id: "title", text: "Changed" },
      { op: "setText", id: "no-such", text: "x" },
    ]);

    expect(result.ok).toBe(false);
    // first op must not have leaked into the input
    expect(
      (input.nodes.find((n) => n.id === "title") as { text: string }).text,
    ).toBe("Hello");
  });

  it("suggests closest ids for misspelled node ids", () => {
    const errors = rejected([{ op: "setStyle", id: "titel", style: {} }]);
    expect(errors[0]?.message).toContain('No node with id "titel"');
    expect(errors[0]?.message).toContain('"title"');
    expect(errors[0]?.opIndex).toBe(0);
  });

  it("setText only works on text nodes", () => {
    const errors = rejected([{ op: "setText", id: "bg", text: "nope" }]);
    expect(errors[0]?.message).toContain("not a text node");
  });

  it("sets and deletes validated scalar node props", () => {
    const scene = applied(
      [
        {
          op: "setNodeProps",
          id: "shot",
          props: {
            videoStartTime: 2.5,
            playbackRate: 1.25,
            volume: 0.4,
            volumeEnvelope: [
              { frame: 0, value: 0 },
              { frame: 12, value: 1 },
            ],
          },
        },
        { op: "setNodeProps", id: "shot", props: { playbackRate: null } },
      ],
      mediaScene(),
    );
    const shot = scene.nodes.find((n) => n.id === "shot");

    expect(shot?.videoStartTime).toBe(2.5);
    expect(shot?.volume).toBe(0.4);
    expect(shot?.volumeEnvelope).toEqual([
      { frame: 0, value: 0 },
      { frame: 12, value: 1 },
    ]);
    expect(shot?.playbackRate).toBeUndefined();
  });

  it("names unsupported effect param keys in final scene validation errors", () => {
    const scene = {
      ...baseScene(),
      nodes: [
        ...baseScene().nodes,
        {
          id: "cloud",
          type: "effect" as const,
          effect: "cloudPop" as const,
          duration: 30,
          params: { softness: 0.5 },
        },
      ],
    };
    const errors = rejected(
      [
        {
          op: "setNodeProps",
          id: "cloud",
          props: { params: { pulse: 0.8, blurAmount: 0.7 } },
        },
      ],
      scene,
    );

    expect(errors[0]?.message).toContain("Unsupported key(s): blurAmount");
  });

  it("updates extension identity and JSON params transactionally", () => {
    const scene = applied(
      [
        {
          op: "setNodeProps",
          id: "grid",
          props: {
            extension: {
              name: "com.example.grid",
              version: "2.0.0",
              params: { columns: 12 },
            },
          },
        },
      ],
      {
        ...baseScene(),
        nodes: [
          ...baseScene().nodes,
          {
            id: "grid",
            type: "extension",
            extension: {
              name: "com.example.grid",
              version: "1.0.0",
              params: { columns: 8 },
            },
          },
        ],
      },
    );

    expect(scene.nodes.find((node) => node.id === "grid")?.extension).toEqual({
      name: "com.example.grid",
      version: "2.0.0",
      params: { columns: 12 },
    });
  });

  it("updates shape, clip, and mask geometry transactionally", () => {
    const scene = applied(
      [
        {
          op: "setNodeProps",
          id: "shape",
          props: {
            shape: { kind: "ellipse" },
            clip: { kind: "rect", radius: 12 },
            mask: { shape: { kind: "ellipse" }, inverted: true },
          },
        },
      ],
      {
        ...baseScene(),
        nodes: [
          ...baseScene().nodes,
          { id: "shape", type: "shape", shape: { kind: "rect" } },
        ],
      },
    );
    const shape = scene.nodes.find((node) => node.id === "shape");

    expect(shape).toMatchObject({
      shape: { kind: "ellipse" },
      clip: { kind: "rect", radius: 12 },
      mask: { shape: { kind: "ellipse" }, inverted: true },
    });
  });

  it("replaces plain text with metric-stable rich runs", () => {
    const scene = applied([
      {
        op: "setNodeProps",
        id: "title",
        props: {
          text: null,
          runs: [
            { text: "Hello ", style: { color: "#ffffff" } },
            { text: "world", style: { color: "#22d3ee" } },
          ],
        },
      },
    ]);
    const title = scene.nodes.find((node) => node.id === "title");

    expect(title?.runs).toHaveLength(2);
  });

  it("sets and deletes audio loop props", () => {
    const scene = applied(
      [
        { op: "setNodeProps", id: "music", props: { loop: true } },
        { op: "setNodeProps", id: "music", props: { loop: null } },
      ],
      {
        ...baseScene(),
        assets: {
          ...baseScene().assets,
          music: { id: "music", type: "audio", src: "music.mp3" },
        },
        nodes: [
          ...baseScene().nodes,
          {
            id: "music",
            type: "audio",
            assetId: "music",
            duration: 90,
          },
        ],
      },
    );
    const music = scene.nodes.find((node) => node.id === "music");

    expect(music?.loop).toBeUndefined();
  });

  it("rejects setNodeProps when final node-type invariants fail", () => {
    const errors = rejected([
      { op: "setNodeProps", id: "badge", props: { volume: 0.5 } },
    ]);

    expect(errors.map((error) => error.message).join("\n")).toContain(
      "volume and volumeEnvelope only apply to audio and video nodes",
    );
  });

  it("rejects unsupported or empty setNodeProps payloads", () => {
    expect(
      rejected([{ op: "setNodeProps", id: "shot", props: {} }], mediaScene())[0]
        ?.message,
    ).toContain("props must include");
    expect(
      rejected(
        [{ op: "setNodeProps", id: "shot", props: { src: "other.mp4" } }],
        mediaScene(),
      )[0]?.message,
    ).toContain("Unrecognized key");
  });

  it("setStyle validates the merged style against the schema", () => {
    const errors = rejected([
      { op: "setStyle", id: "title", style: { backdropFilter: "blur(4px)" } },
    ]);
    expect(errors[0]?.message).toContain("Unsupported style property");
  });

  it("retimes from and duration", () => {
    const scene = applied([
      { op: "retime", id: "title", from: 10, duration: 40 },
    ]);
    const title = scene.nodes.find((n) => n.id === "title");
    expect(title?.from).toBe(10);
    expect(title?.duration).toBe(40);

    const errors = rejected([{ op: "retime", id: "title", duration: 0 }]);
    expect(errors[0]?.message).toContain("positive integer");
  });

  it("replaces animations as a unit and validates keyframe order", () => {
    const scene = applied([
      {
        op: "setAnimations",
        id: "title",
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [
              { frame: 0, value: 0 },
              { frame: 12, value: 1, easing: "easeOut" },
            ],
          },
        ],
      },
    ]);
    expect(scene.nodes.find((n) => n.id === "title")?.animations).toHaveLength(
      1,
    );

    const errors = rejected([
      {
        op: "setAnimations",
        id: "title",
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [
              { frame: 12, value: 0 },
              { frame: 12, value: 1 },
            ],
          },
        ],
      },
    ]);
    expect(errors[0]?.message).toContain("strictly increasing");
  });

  it("inserts nodes at root, under parents, and before siblings", () => {
    const scene = applied([
      {
        op: "insertNode",
        node: { id: "sub", type: "text", text: "sub", style: {} },
        beforeId: "title",
      },
      {
        op: "insertNode",
        node: { id: "child", type: "div", style: {} },
        parentId: "bg",
      },
    ]);

    expect(scene.nodes.map((n) => n.id)).toEqual([
      "bg",
      "sub",
      "title",
      "badge",
    ]);
    expect(scene.nodes[0]?.children?.[0]?.id).toBe("child");
  });

  it("treats null parent and sibling ids from model JSON as omitted", () => {
    const scene = appliedUnknown([
      {
        op: "insertNode",
        node: { id: "root-note", type: "text", text: "Root note", style: {} },
        parentId: null,
        beforeId: null,
      },
      {
        op: "moveNode",
        id: "root-note",
        parentId: null,
        beforeId: null,
      },
    ]);

    expect(scene.nodes.map((node) => node.id)).toEqual([
      "bg",
      "title",
      "badge",
      "root-note",
    ]);
  });

  it("rejects inserting duplicate ids", () => {
    const errors = rejected([
      { op: "insertNode", node: { id: "title", type: "div", style: {} } },
    ]);
    expect(errors[0]?.message).toContain("already exists");
  });

  it("removes subtrees and moves nodes between parents", () => {
    const scene = applied([
      { op: "moveNode", id: "title", parentId: "bg" },
      { op: "removeNode", id: "badge" },
      { op: "removeAsset", id: "logo" },
    ]);

    expect(scene.nodes.map((n) => n.id)).toEqual(["bg"]);
    expect(scene.nodes[0]?.children?.map((n) => n.id)).toEqual(["title"]);
    expect(Object.keys(scene.assets)).toEqual([]);
  });

  it("refuses to move a node into its own subtree", () => {
    const errors = rejected([
      { op: "moveNode", id: "title", parentId: "bg" },
      { op: "moveNode", id: "bg", parentId: "title" },
    ]);
    expect(errors[0]?.opIndex).toBe(1);
    expect(errors[0]?.message).toContain("own subtree");
  });

  it("guards asset removal while nodes still reference it", () => {
    const errors = rejected([{ op: "removeAsset", id: "logo" }]);
    expect(errors[0]?.message).toContain('"badge"');
    expect(errors[0]?.message).toContain("still reference");
  });

  it("setAsset adds and replaces; setSceneMeta retunes the document", () => {
    const scene = applied([
      { op: "setAsset", asset: { id: "voice", type: "audio", src: "v.mp3" } },
      { op: "setSceneMeta", duration: 240, fps: 60 },
    ]);

    expect(scene.assets["voice"]?.src).toBe("v.mp3");
    expect(scene.duration).toBe(240);
    expect(scene.fps).toBe(60);
    expect(scene.width).toBe(1080);
  });

  it("sets and removes named markers", () => {
    const scene = applied([
      { op: "setMarker", name: "intro", frame: 0 },
      { op: "setMarker", name: "beat.drop", frame: 24 },
      { op: "setMarker", name: "intro", frame: null },
    ]);

    expect(scene.markers).toEqual({ "beat.drop": 24 });
    expect(
      rejected([{ op: "setMarker", name: "outside", frame: 90 }])[0]?.message,
    ).toContain("must be inside the scene duration");
  });

  it("reports malformed patches with op indexes", () => {
    const errors = rejected([
      { op: "setText", id: "title", text: "ok" },
      { op: "warp", id: "title" },
    ]);
    expect(errors.some((e) => e.opIndex === 1)).toBe(true);
  });

  it("the final document revalidates cross-field invariants", () => {
    // Inserting an img node without assetId passes the node schema only in
    // isolation; final validation must reject it.
    const errors = rejected([
      { op: "insertNode", node: { id: "pic", type: "img", style: {} } },
    ]);
    expect(errors.map((e) => e.message).join("\n")).toContain("assetId");
  });
});

describe("closestIds", () => {
  it("ranks by edit distance with stable ordering", () => {
    expect(closestIds("titel", ["bg", "title", "badge", "title-bg"])).toEqual([
      "title",
      "title-bg",
      "badge",
    ]);
    expect(closestIds("x", [])).toEqual([]);
  });
});
