import { describe, expect, it } from "vitest";
import { Ajv } from "ajv";
import { parseScene, type Scene } from "@dojo-video-engine/schema";
import {
  applySceneCommands,
  compileSceneCommands,
  sceneCommandJsonSchema,
  sceneCommandSchema,
  sceneCommandsSchema,
  type SceneCommand,
} from "./commands.js";

function fixture(): Scene {
  return {
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 360,
    audioBuses: { music: {} },
    assets: {
      footage: {
        id: "footage",
        type: "video",
        src: "https://example.test/footage.mp4",
        metadata: { duration: 12, width: 1080, height: 1920 },
      },
      music: {
        id: "music",
        type: "audio",
        src: "https://example.test/music.mp3",
        metadata: { duration: 20 },
      },
      still: {
        id: "still",
        type: "image",
        src: "https://example.test/still.png",
        metadata: { width: 1000, height: 1000 },
      },
    },
    nodes: [
      {
        id: "footage-node",
        type: "video",
        assetId: "footage",
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          width: 1080,
          height: 1920,
          objectFit: "cover",
        },
      },
      {
        id: "music-node",
        type: "audio",
        assetId: "music",
        duration: 360,
      },
      {
        id: "title",
        type: "text",
        text: "Before",
        style: {
          position: "absolute",
          left: 100,
          top: 100,
          width: 300,
          height: 80,
          color: "#ffffff",
          background: "#111111",
        },
      },
      {
        id: "card",
        type: "div",
        style: {
          position: "absolute",
          left: 80,
          top: 300,
          width: 900,
          height: 400,
        },
      },
      {
        id: "a",
        type: "img",
        assetId: "still",
        style: {
          position: "absolute",
          left: 0,
          top: 800,
          width: 100,
          height: 100,
        },
      },
      {
        id: "b",
        type: "img",
        assetId: "still",
        style: {
          position: "absolute",
          left: 200,
          top: 900,
          width: 100,
          height: 100,
        },
      },
      {
        id: "c",
        type: "img",
        assetId: "still",
        style: {
          position: "absolute",
          left: 500,
          top: 1000,
          width: 100,
          height: 100,
        },
      },
    ],
  };
}

function findNode(scene: Scene, id: string) {
  const visit = (nodes: Scene["nodes"]): Scene["nodes"][number] | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const child = visit(node.children ?? []);
      if (child) return child;
    }
    return undefined;
  };
  return visit(scene.nodes);
}

describe("Scene command schema", () => {
  it("covers the complete strict command vocabulary", () => {
    const samples: SceneCommand[] = [
      { kind: "text.set", id: "title", text: "After" },
      { kind: "style.set", id: "title", style: { color: "#ff0000" } },
      { kind: "placement.set", id: "title", left: 24, top: 48 },
      { kind: "resize.set", id: "title", width: 640 },
      { kind: "align", ids: ["a", "b"], edge: "left", relativeTo: "selection" },
      {
        kind: "distribute",
        ids: ["a", "b", "c"],
        axis: "horizontal",
        spacing: "gaps",
      },
      { kind: "timing.set", id: "title", from: 12, duration: 90 },
      {
        kind: "media.trim",
        id: "footage-node",
        startSeconds: 1,
        endSeconds: 5,
      },
      { kind: "media.gain", id: "music-node", gain: 0.4 },
      {
        kind: "node.add",
        node: { id: "new", type: "text", text: "New" },
      },
      { kind: "node.remove", id: "c" },
      { kind: "node.move", id: "title", parentId: "card" },
      { kind: "node.group", ids: ["a", "b"], groupId: "images" },
      { kind: "motion.preset", id: "title", preset: "fadeIn", mode: "replace" },
      { kind: "macro.insert", name: "lowerThird", params: { title: "Ada" } },
      { kind: "layout.apply", id: "footage-node", layout: "fullscreen" },
      { kind: "scene.set", width: 1920, height: 1080, fps: 60 },
      {
        kind: "asset.set",
        asset: { id: "voice", type: "audio", src: "voice.wav" },
      },
      { kind: "asset.remove", id: "voice" },
    ];

    expect(sceneCommandsSchema.parse(samples)).toHaveLength(samples.length);
    expect(
      sceneCommandSchema.safeParse({
        kind: "text.set",
        id: "title",
        text: "After",
        surprise: true,
      }).success,
    ).toBe(false);
    expect(
      sceneCommandSchema.safeParse({ kind: "text.set", text: "missing id" })
        .success,
    ).toBe(false);
    expect(
      sceneCommandSchema.safeParse({
        kind: "style.set",
        id: "title",
        style: {},
      }).success,
    ).toBe(false);
    expect(
      sceneCommandSchema.safeParse({
        kind: "node.add",
        node: {
          id: "recursive",
          type: "div",
          children: [{ id: "child", type: "div" }],
        },
      }).success,
    ).toBe(false);
    expect(
      sceneCommandSchema.safeParse({
        kind: "macro.insert",
        name: "lowerThird",
        params: { children: [] },
      }).success,
    ).toBe(false);
  });

  it("publishes strict draft-07 JSON Schema without a recursive node field", () => {
    const schema = sceneCommandJsonSchema();
    const serialized = JSON.stringify(schema);
    expect(serialized).toContain("http://json-schema.org/draft-07/schema#");
    expect(serialized).toContain('"kind"');
    expect(serialized).not.toContain('"children":');
    expect(serialized).not.toContain("DojoVideoEngineSceneNode");

    const strictBranches: boolean[] = [];
    const requiredDiscriminators: boolean[] = [];
    const walk = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      const record = value as Record<string, unknown>;
      if (
        record.properties &&
        typeof record.properties === "object" &&
        "kind" in (record.properties as Record<string, unknown>)
      ) {
        strictBranches.push(record.additionalProperties === false);
        requiredDiscriminators.push(
          Array.isArray(record.required) && record.required.includes("kind"),
        );
      }
      for (const child of Object.values(record)) walk(child);
    };
    walk(schema);
    expect(strictBranches.length).toBeGreaterThanOrEqual(19);
    expect(strictBranches.every(Boolean)).toBe(true);
    expect(requiredDiscriminators.every(Boolean)).toBe(true);
  });

  it("keeps strict AJV and Zod structural acceptance in parity", () => {
    const validate = new Ajv({
      strict: true,
      allErrors: true,
    }).compile(sceneCommandJsonSchema());
    const cases: Array<{ name: string; input: unknown; accepted: boolean }> = [
      {
        name: "valid scene metadata",
        input: [{ kind: "scene.set", width: 1920, height: 1080, fps: 60 }],
        accepted: true,
      },
      {
        name: "missing scene metadata fields",
        input: [{ kind: "scene.set" }],
        accepted: false,
      },
      {
        name: "invalid scene metadata bounds",
        input: [{ kind: "scene.set", width: 0, fps: 29.97 }],
        accepted: false,
      },
      {
        name: "valid canonical asset",
        input: [
          {
            kind: "asset.set",
            asset: {
              id: "voice",
              type: "audio",
              src: "voice.wav",
              metadata: { duration: 3 },
            },
          },
        ],
        accepted: true,
      },
      {
        name: "asset unknown field",
        input: [
          {
            kind: "asset.set",
            asset: {
              id: "voice",
              type: "audio",
              src: "voice.wav",
              children: [],
            },
          },
        ],
        accepted: false,
      },
      {
        name: "asset id leading whitespace",
        input: [
          {
            kind: "asset.set",
            asset: { id: " voice", type: "audio", src: "voice.wav" },
          },
        ],
        accepted: false,
      },
      {
        name: "asset id trailing whitespace removal",
        input: [{ kind: "asset.remove", id: "voice " }],
        accepted: false,
      },
      {
        name: "asset id bounded",
        input: [
          {
            kind: "asset.set",
            asset: {
              id: "x".repeat(192),
              type: "image",
              src: "image.png",
            },
          },
        ],
        accepted: false,
      },
      {
        name: "asset metadata unknown field",
        input: [
          {
            kind: "asset.set",
            asset: {
              id: "voice",
              type: "audio",
              src: "voice.wav",
              metadata: { semanticDescription: "unsafe" },
            },
          },
        ],
        accepted: false,
      },
      {
        name: "valid asset removal",
        input: [{ kind: "asset.remove", id: "voice" }],
        accepted: true,
      },
      {
        name: "valid style",
        input: [{ kind: "style.set", id: "title", style: { color: "#fff" } }],
        accepted: true,
      },
      {
        name: "empty style",
        input: [{ kind: "style.set", id: "title", style: {} }],
        accepted: false,
      },
      {
        name: "missing placement fields",
        input: [{ kind: "placement.set", id: "title" }],
        accepted: false,
      },
      {
        name: "conflicting horizontal edges",
        input: [{ kind: "placement.set", id: "title", left: 1, right: 2 }],
        accepted: false,
      },
      {
        name: "conflicting vertical edges",
        input: [{ kind: "placement.set", id: "title", top: 1, bottom: 2 }],
        accepted: false,
      },
      {
        name: "missing resize fields",
        input: [{ kind: "resize.set", id: "title" }],
        accepted: false,
      },
      {
        name: "missing timing fields",
        input: [{ kind: "timing.set", id: "title" }],
        accepted: false,
      },
      {
        name: "missing layout intent",
        input: [{ kind: "layout.apply", id: "title" }],
        accepted: false,
      },
      {
        name: "forbidden macro envelope",
        input: [
          { kind: "macro.insert", name: "lowerThird", params: { macro: "x" } },
        ],
        accepted: false,
      },
      {
        name: "deep Scene-like data",
        input: [
          {
            kind: "macro.insert",
            name: "lowerThird",
            params: { payload: { nodes: [] } },
          },
        ],
        accepted: false,
      },
      {
        name: "semantic trim comparison",
        input: [
          {
            kind: "media.trim",
            id: "footage-node",
            startSeconds: 5,
            endSeconds: 2,
          },
        ],
        accepted: true,
      },
      {
        name: "semantic duplicate ids",
        input: [{ kind: "align", ids: ["a", "a"], edge: "left" }],
        accepted: true,
      },
      {
        name: "style value deferred to canonical validation",
        input: [
          { kind: "style.set", id: "title", style: { color: "not-a-color" } },
        ],
        accepted: true,
      },
      {
        name: "bounded text",
        input: [{ kind: "text.set", id: "title", text: "x".repeat(100_001) }],
        accepted: false,
      },
      {
        name: "bounded unset",
        input: [
          {
            kind: "style.set",
            id: "title",
            unset: Array.from({ length: 77 }, () => "left"),
          },
        ],
        accepted: false,
      },
      {
        name: "bounded coordinate",
        input: [{ kind: "placement.set", id: "title", left: 10_000_001 }],
        accepted: false,
      },
      {
        name: "bounded opaque array",
        input: [
          {
            kind: "macro.insert",
            name: "subtitles",
            params: { segments: Array.from({ length: 65 }, () => "line") },
          },
        ],
        accepted: false,
      },
      {
        name: "bounded opaque properties",
        input: [
          {
            kind: "macro.insert",
            name: "lowerThird",
            params: Object.fromEntries(
              Array.from({ length: 65 }, (_, index) => [`key${index}`, index]),
            ),
          },
        ],
        accepted: false,
      },
      {
        name: "bounded opaque depth",
        input: [
          {
            kind: "macro.insert",
            name: "lowerThird",
            params: { a: { b: { c: { d: { e: 1 } } } } },
          },
        ],
        accepted: false,
      },
      {
        name: "non-JSON function",
        input: [
          {
            kind: "macro.insert",
            name: "lowerThird",
            params: { title: () => "no" },
          },
        ],
        accepted: false,
      },
      {
        name: "bounded command batch",
        input: Array.from({ length: 257 }, (_, index) => ({
          kind: "text.set",
          id: `text-${index}`,
          text: "x",
        })),
        accepted: false,
      },
    ];

    for (const item of cases) {
      expect(
        sceneCommandsSchema.safeParse(item.input).success,
        `${item.name} (Zod)`,
      ).toBe(item.accepted);
      expect(
        validate(item.input),
        `${item.name} (AJV): ${JSON.stringify(validate.errors)}`,
      ).toBe(item.accepted);
    }
  });

  it("caps flat-node animation tracks and keyframes in Zod and JSON Schema", () => {
    const schema = sceneCommandJsonSchema();
    const maxItems: number[] = [];
    const walk = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      const record = value as Record<string, unknown>;
      if (typeof record.maxItems === "number") maxItems.push(record.maxItems);
      Object.values(record).forEach(walk);
    };
    walk(schema);
    expect(maxItems).toContain(128);
    expect(maxItems).toContain(2048);

    const oversized = {
      kind: "node.add",
      node: {
        id: "animated",
        type: "div",
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: Array.from({ length: 100_001 }, (_, frame) => ({
              frame,
              value: 1,
            })),
          },
        ],
      },
    };
    expect(sceneCommandSchema.safeParse(oversized).success).toBe(false);
    const validate = new Ajv({ strict: true, allErrors: true }).compile(schema);
    expect(validate([oversized])).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "maxItems",
          params: { limit: 2048 },
        }),
      ]),
    );

    const tooManyTracks = {
      kind: "node.add",
      node: {
        id: "too-many-tracks",
        type: "div",
        animations: Array.from({ length: 129 }, (_, index) => ({
          kind: "keyframes",
          property: "opacity",
          frames: [{ frame: index, value: 1 }],
        })),
      },
    };
    expect(sceneCommandSchema.safeParse(tooManyTracks).success).toBe(false);
    expect(validate([tooManyTracks])).toBe(false);

    const semanticValue = {
      kind: "node.add",
      node: {
        id: "semantic-animation",
        type: "div",
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [{ frame: 0, value: "not-an-opacity" }],
          },
        ],
      },
    };
    expect(sceneCommandSchema.safeParse(semanticValue).success).toBe(true);
    expect(validate([semanticValue])).toBe(true);
    expect(compileSceneCommands(fixture(), [semanticValue]).ok).toBe(false);
  });
});

describe("compileSceneCommands", () => {
  it("compiles Scene metadata and canonical asset registration/removal additively", () => {
    const result = applySceneCommands(fixture(), [
      { kind: "scene.set", width: 1920, height: 1080, fps: 60, duration: 600 },
      {
        kind: "asset.set",
        asset: {
          id: "voice",
          type: "audio",
          src: "voice.wav",
          metadata: { duration: 4, audioChannels: 2 },
        },
      },
      {
        kind: "node.add",
        node: {
          id: "voice-node",
          type: "audio",
          assetId: "voice",
          duration: 240,
        },
      },
      {
        kind: "asset.set",
        asset: { id: "temporary", type: "image", src: "temporary.png" },
      },
      { kind: "asset.remove", id: "temporary" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scene).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 60,
      duration: 600,
      assets: {
        voice: {
          id: "voice",
          type: "audio",
          src: "voice.wav",
          metadata: { duration: 4, audioChannels: 2 },
        },
      },
    });
    expect(findNode(result.scene, "voice-node")).toMatchObject({
      type: "audio",
      assetId: "voice",
      duration: 240,
    });
    expect(result.scene.assets.temporary).toBeUndefined();
    expect(result.patch.map(({ op }) => op)).toEqual([
      "setSceneMeta",
      "setAsset",
      "insertNode",
      "setAsset",
      "removeAsset",
    ]);
    expect(result.affectedIds).toEqual(["voice", "voice-node", "temporary"]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "scene_meta_set",
      "asset_set",
      "asset_set",
      "asset_removed",
    ]);
  });

  it("rejects referenced/missing asset removal and rolls back earlier commands", () => {
    const input = fixture();
    const before = structuredClone(input);
    const referenced = applySceneCommands(input, [
      { kind: "scene.set", width: 1920 },
      { kind: "asset.remove", id: "footage" },
    ]);
    expect(referenced.ok).toBe(false);
    expect(input).toEqual(before);
    if (!referenced.ok) {
      expect(referenced.errors[0]).toMatchObject({
        commandIndex: 1,
        kind: "asset.remove",
        code: "command_not_applicable",
      });
      expect(referenced.errors[0]?.message).toMatch(/reference/i);
      expect(referenced.affectedIds).toEqual([]);
    }

    const missing = compileSceneCommands(fixture(), [
      { kind: "asset.remove", id: "not-registered" },
    ]);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.errors[0]?.message).toMatch(
        /not-registered|does not exist/i,
      );
    }
  });

  it("compiles direct text, style, placement, resize, and timing commands", () => {
    const result = applySceneCommands(fixture(), [
      { kind: "text.set", id: "title", text: "After" },
      {
        kind: "style.set",
        id: "title",
        style: { color: "#ff0000" },
        unset: ["background"],
      },
      { kind: "placement.set", id: "title", right: 40, top: 120, zIndex: 9 },
      { kind: "resize.set", id: "title", width: 500, height: 120 },
      { kind: "timing.set", id: "title", from: 15, duration: 75 },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const title = findNode(result.scene, "title");
    expect(title).toMatchObject({ text: "After", from: 15, duration: 75 });
    expect(title?.style).toMatchObject({
      color: "#ff0000",
      right: 40,
      top: 120,
      width: 500,
      height: 120,
      zIndex: 9,
    });
    expect(title?.style).not.toHaveProperty("background");
    expect(title?.style).not.toHaveProperty("left");
    expect(result.affectedIds).toEqual(["title"]);
  });

  it("aligns and distributes only from explicit numeric geometry", () => {
    const aligned = applySceneCommands(fixture(), [
      { kind: "align", ids: ["a", "b", "c"], edge: "left" },
    ]);
    expect(aligned.ok).toBe(true);
    if (aligned.ok) {
      expect(findNode(aligned.scene, "a")?.style?.left).toBe(0);
      expect(findNode(aligned.scene, "b")?.style?.left).toBe(0);
      expect(findNode(aligned.scene, "c")?.style?.left).toBe(0);
    }

    const distributed = applySceneCommands(fixture(), [
      {
        kind: "distribute",
        ids: ["a", "b", "c"],
        axis: "horizontal",
        spacing: "gaps",
      },
    ]);
    expect(distributed.ok).toBe(true);
    if (distributed.ok) {
      expect(findNode(distributed.scene, "a")?.style?.left).toBe(0);
      expect(findNode(distributed.scene, "b")?.style?.left).toBe(250);
      expect(findNode(distributed.scene, "c")?.style?.left).toBe(500);
    }
  });

  it("compiles media trim and gain with declared source bounds", () => {
    const result = applySceneCommands(fixture(), [
      {
        kind: "media.trim",
        id: "footage-node",
        startSeconds: 1,
        endSeconds: 5,
      },
      { kind: "media.gain", id: "footage-node", gain: 0.25, pan: -0.2 },
      { kind: "media.gain", id: "music-node", gain: 0.5, bus: "music" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(findNode(result.scene, "footage-node")).toMatchObject({
      videoStartTime: 1,
      duration: 120,
      volume: 0.25,
      pan: -0.2,
    });
    expect(findNode(result.scene, "music-node")).toMatchObject({
      volume: 0.5,
      audioBus: "music",
    });
  });

  it("adds, moves, groups, and removes nodes without recursive command payloads", () => {
    const result = applySceneCommands(fixture(), [
      {
        kind: "node.add",
        node: {
          id: "new-label",
          type: "text",
          text: "New",
          style: { width: 200, height: 40 },
        },
      },
      { kind: "node.move", id: "new-label", parentId: "card" },
      { kind: "node.group", ids: ["a", "b"], groupId: "image-group" },
      { kind: "node.remove", id: "c" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      findNode(result.scene, "card")?.children?.map((node) => node.id),
    ).toContain("new-label");
    expect(
      findNode(result.scene, "image-group")?.children?.map((node) => node.id),
    ).toEqual(["a", "b"]);
    expect(findNode(result.scene, "c")).toBeUndefined();
    expect(result.affectedIds).toEqual([
      "new-label",
      "card",
      "image-group",
      "a",
      "b",
      "c",
    ]);
  });

  it("compiles motion presets, macros, and layout intents", () => {
    const result = applySceneCommands(fixture(), [
      {
        kind: "motion.preset",
        id: "title",
        preset: "fadeIn",
        params: { durationInFrames: 18 },
      },
      {
        kind: "macro.insert",
        name: "lowerThird",
        params: { title: "Ada Lovelace", subtitle: "Analyst", duration: 90 },
      },
      {
        kind: "layout.apply",
        id: "footage-node",
        layout: "fullscreen",
        look: "cinematicWarm",
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(findNode(result.scene, "title")?.animations?.length).toBeGreaterThan(
      0,
    );
    expect(
      result.scene.nodes.some((node) => node.id.startsWith("lower-third")),
    ).toBe(true);
    expect(findNode(result.scene, "footage-node")?.style).toMatchObject({
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
    });
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "motion_preset_compiled",
        "macro_expanded",
        "layout_intent_compiled",
      ]),
    );
  });

  it("lets a transcript-aware macro use host context", () => {
    const result = compileSceneCommands(
      fixture(),
      [
        {
          kind: "macro.insert",
          name: "captions",
          params: { assetId: "footage", template: "classic" },
        },
      ],
      {
        transcripts: {
          footage: {
            words: [
              { text: "Hello", startMs: 0, endMs: 500 },
              { text: "world", startMs: 500, endMs: 900 },
            ],
          },
        },
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.patch[0]?.op).toBe("insertNode");
  });

  it("enforces caption manifest media requirements when assets are known", () => {
    const result = compileSceneCommands(
      fixture(),
      [
        {
          kind: "macro.insert",
          name: "captions",
          params: { assetId: "still" },
        },
      ],
      {
        transcripts: {
          still: { words: [{ text: "No", startMs: 0, endMs: 300 }] },
        },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toMatch(/image asset.*audio or video/);
    }
  });

  it("clears rich text runs when text.set switches a node to plain text", () => {
    const scene = fixture();
    scene.nodes.push({
      id: "rich-title",
      type: "text",
      runs: [
        { text: "Rich", style: { color: "#ff0000" } },
        { text: " text", style: { color: "#ffffff" } },
      ],
    });
    const result = applySceneCommands(scene, [
      { kind: "text.set", id: "rich-title", text: "Plain text" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(findNode(result.scene, "rich-title")).toMatchObject({
      text: "Plain text",
    });
    expect(findNode(result.scene, "rich-title")).not.toHaveProperty("runs");
    expect(result.patch[0]).toMatchObject({
      op: "setNodeProps",
      props: { text: "Plain text", runs: null },
    });
  });

  it("groups in source sibling order and handles explicit reparenting", () => {
    const sameParent = fixture();
    const card = findNode(sameParent, "card");
    if (card) {
      card.children = [
        { id: "first", type: "text", text: "First" },
        { id: "middle", type: "text", text: "Middle" },
        { id: "last", type: "text", text: "Last" },
      ];
    }
    const grouped = applySceneCommands(sameParent, [
      {
        kind: "node.group",
        ids: ["last", "first"],
        groupId: "same-parent-group",
      },
    ]);
    expect(grouped.ok).toBe(true);
    if (grouped.ok) {
      expect(
        findNode(grouped.scene, "same-parent-group")?.children?.map(
          (node) => node.id,
        ),
      ).toEqual(["first", "last"]);
      expect(grouped.affectedIds).toContain("card");
    }

    const reparentedScene = fixture();
    const source = findNode(reparentedScene, "card");
    if (source) {
      source.children = [
        { id: "source-first", type: "text", text: "First" },
        { id: "source-last", type: "text", text: "Last" },
      ];
    }
    reparentedScene.nodes.push({
      id: "target-parent",
      type: "div",
      children: [{ id: "target-child", type: "text", text: "Target" }],
    });
    const reparented = applySceneCommands(reparentedScene, [
      {
        kind: "node.group",
        ids: ["source-last", "source-first"],
        groupId: "reparented-group",
        parentId: "target-parent",
      },
    ]);
    expect(reparented.ok).toBe(true);
    if (!reparented.ok) return;
    expect(
      findNode(reparented.scene, "target-parent")?.children?.map(
        (node) => node.id,
      ),
    ).toEqual(["target-child", "reparented-group"]);
    expect(
      findNode(reparented.scene, "reparented-group")?.children?.map(
        (node) => node.id,
      ),
    ).toEqual(["source-first", "source-last"]);
    expect(reparented.affectedIds).toEqual(
      expect.arrayContaining(["card", "target-parent"]),
    );
  });

  it("includes structural parents in add, remove, and macro affected ids", () => {
    const scene = fixture();
    const card = findNode(scene, "card");
    if (card) {
      card.children = [{ id: "nested", type: "text", text: "Nested" }];
    }
    const added = compileSceneCommands(scene, [
      {
        kind: "node.add",
        node: { id: "added", type: "text", text: "Added" },
        parentId: "card",
      },
    ]);
    expect(added.ok).toBe(true);
    if (added.ok) expect(added.affectedIds).toEqual(["added", "card"]);

    const removed = compileSceneCommands(scene, [
      { kind: "node.remove", id: "nested" },
    ]);
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.affectedIds).toEqual(["nested", "card"]);

    const macro = compileSceneCommands(scene, [
      {
        kind: "macro.insert",
        name: "lowerThird",
        params: { title: "Nested macro" },
        parentId: "card",
      },
    ]);
    expect(macro.ok).toBe(true);
    if (macro.ok) expect(macro.affectedIds).toContain("card");
  });

  it("uses the trim end boundary for reverse video and derives known ends", () => {
    const scene = fixture();
    scene.nodes.push({
      id: "reverse-video",
      type: "video",
      assetId: "footage",
      playbackRate: -2,
      volume: 0,
    });
    const explicit = applySceneCommands(scene, [
      {
        kind: "media.trim",
        id: "reverse-video",
        startSeconds: 2,
        endSeconds: 10,
      },
    ]);
    expect(explicit.ok).toBe(true);
    if (explicit.ok) {
      expect(findNode(explicit.scene, "reverse-video")).toMatchObject({
        videoStartTime: 10,
        duration: 120,
      });
    }

    const derived = applySceneCommands(scene, [
      {
        kind: "media.trim",
        id: "reverse-video",
        startSeconds: 2,
      },
    ]);
    expect(derived.ok).toBe(true);
    if (derived.ok) {
      expect(findNode(derived.scene, "reverse-video")).toMatchObject({
        videoStartTime: 12,
        duration: 150,
      });
    }

    const unknown = fixture();
    unknown.assets.unknown = {
      id: "unknown",
      type: "video",
      src: "unknown.mp4",
    };
    unknown.nodes.push({
      id: "unknown-reverse",
      type: "video",
      assetId: "unknown",
      playbackRate: -1,
      volume: 0,
    });
    const missingEnd = compileSceneCommands(unknown, [
      {
        kind: "media.trim",
        id: "unknown-reverse",
        startSeconds: 1,
      },
    ]);
    expect(missingEnd.ok).toBe(false);
    if (!missingEnd.ok) {
      expect(missingEnd.errors[0]?.code).toBe("reverse_trim_needs_end");
    }
  });

  it("never discards repeat or yoyo metadata while appending motion", () => {
    const conflictScene = fixture();
    const conflictTitle = findNode(conflictScene, "title");
    if (conflictTitle) {
      conflictTitle.animations = [
        {
          kind: "keyframes",
          property: "opacity",
          frames: [{ frame: 0, value: 1 }],
          repeat: "infinite",
          yoyo: true,
        },
      ];
    }
    const conflict = compileSceneCommands(conflictScene, [
      {
        kind: "motion.preset",
        id: "title",
        preset: "fadeOut",
        mode: "append",
      },
    ]);
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.errors[0]?.code).toBe("motion_append_playback_conflict");
    }

    const preservedScene = fixture();
    const preservedTitle = findNode(preservedScene, "title");
    if (preservedTitle) {
      preservedTitle.animations = [
        {
          kind: "keyframes",
          property: "transform",
          frames: [{ frame: 0, value: "scale(1)" }],
          repeat: "infinite",
          yoyo: true,
        },
      ];
    }
    const preserved = applySceneCommands(preservedScene, [
      {
        kind: "motion.preset",
        id: "title",
        preset: "fadeOut",
        mode: "append",
      },
    ]);
    expect(preserved.ok).toBe(true);
    if (!preserved.ok) return;
    expect(
      findNode(preserved.scene, "title")?.animations?.find(
        (animation) => animation.property === "transform",
      ),
    ).toMatchObject({ repeat: "infinite", yoyo: true });
  });

  it("clears every layout-owned field absent from the next layout", () => {
    const scene = fixture();
    const footage = findNode(scene, "footage-node");
    if (footage?.style) {
      Object.assign(footage.style, {
        left: undefined,
        top: undefined,
        right: 48,
        bottom: 48,
        width: 360,
        height: 640,
        border: "3px solid white",
        borderRadius: 24,
        boxShadow: "0px 20px 52px rgba(0,0,0,0.36)",
        overflow: "hidden",
        zIndex: 20,
        filter: "blur(8px)",
      });
      delete footage.style.left;
      delete footage.style.top;
    }
    const result = applySceneCommands(scene, [
      { kind: "layout.apply", id: "footage-node", layout: "fullscreen" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const style = findNode(result.scene, "footage-node")?.style;
    expect(style).toMatchObject({
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
    });
    for (const key of [
      "right",
      "bottom",
      "border",
      "borderRadius",
      "boxShadow",
      "overflow",
      "zIndex",
      "filter",
    ]) {
      expect(style).not.toHaveProperty(key);
    }
  });

  it("requires absolute geometry and sorts center distribution by centers", () => {
    const relative = fixture();
    const a = findNode(relative, "a");
    if (a?.style) a.style.position = "relative";
    const rejected = compileSceneCommands(relative, [
      { kind: "align", ids: ["a", "b"], edge: "left" },
    ]);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.errors[0]?.code).toBe("non_absolute_geometry");
    }

    const centers = fixture();
    const centerA = findNode(centers, "a");
    const centerB = findNode(centers, "b");
    const centerC = findNode(centers, "c");
    if (centerA?.style) Object.assign(centerA.style, { left: 0, width: 1000 });
    if (centerB?.style) Object.assign(centerB.style, { left: 400, width: 10 });
    if (centerC?.style) Object.assign(centerC.style, { left: 800, width: 10 });
    const distributed = applySceneCommands(centers, [
      {
        kind: "distribute",
        ids: ["a", "b", "c"],
        axis: "horizontal",
        spacing: "centers",
      },
    ]);
    expect(distributed.ok).toBe(true);
    if (distributed.ok) {
      expect(findNode(distributed.scene, "a")?.style?.left).toBe(105);
      expect(findNode(distributed.scene, "b")?.style?.left).toBe(400);
      expect(findNode(distributed.scene, "c")?.style?.left).toBe(800);
    }
  });

  it("defers bounded style semantics and rejects semantic-only command errors", () => {
    expect(
      sceneCommandsSchema.safeParse([
        {
          kind: "style.set",
          id: "title",
          style: { color: "definitely-not-a-color" },
        },
      ]).success,
    ).toBe(true);
    const badStyle = compileSceneCommands(fixture(), [
      {
        kind: "style.set",
        id: "title",
        style: { color: "definitely-not-a-color" },
      },
    ]);
    expect(badStyle.ok).toBe(false);
    if (!badStyle.ok) {
      expect(badStyle.errors[0]?.code).toBe("command_not_applicable");
    }

    const trim = compileSceneCommands(fixture(), [
      {
        kind: "media.trim",
        id: "footage-node",
        startSeconds: 5,
        endSeconds: 2,
      },
    ]);
    expect(trim.ok).toBe(false);
    if (!trim.ok) expect(trim.errors[0]?.code).toBe("invalid_trim_window");

    const duplicates = compileSceneCommands(fixture(), [
      { kind: "align", ids: ["a", "a"], edge: "left" },
    ]);
    expect(duplicates.ok).toBe(false);
    if (!duplicates.ok) {
      expect(duplicates.errors[0]?.code).toBe("duplicate_ids");
    }
  });

  it("is transactional and preserves the caller's input on late failure", () => {
    const scene = fixture();
    const before = structuredClone(scene);
    const result = applySceneCommands(scene, [
      { kind: "text.set", id: "title", text: "Would have changed" },
      { kind: "style.set", id: "missing", style: { opacity: 0.5 } },
    ]);
    expect(result.ok).toBe(false);
    expect(scene).toEqual(before);
    if (!result.ok) {
      expect(result.errors[0]).toMatchObject({
        commandIndex: 1,
        kind: "style.set",
        code: "command_not_applicable",
      });
      expect(result.affectedIds).toEqual([]);
    }
  });

  it("keeps untouched nodes byte-for-byte identical", () => {
    const scene = fixture();
    const untouched = structuredClone(findNode(parseScene(scene), "card"));
    const result = applySceneCommands(scene, [
      { kind: "text.set", id: "title", text: "Only title changes" },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(findNode(result.scene, "card")).toEqual(untouched);
  });

  it("reports removed subtrees and both parents of a move as affected", () => {
    const scene = fixture();
    const card = findNode(scene, "card");
    if (card) {
      card.children = [
        {
          id: "nested-label",
          type: "text",
          text: "Nested",
          style: { width: 100, height: 30 },
        },
      ];
    }
    scene.nodes.push({
      id: "target-card",
      type: "div",
      style: { width: 200, height: 200 },
    });
    const moved = applySceneCommands(scene, [
      { kind: "node.move", id: "nested-label", parentId: "target-card" },
    ]);
    expect(moved.ok).toBe(true);
    if (moved.ok) {
      expect(moved.affectedIds).toEqual([
        "nested-label",
        "card",
        "target-card",
      ]);
    }

    const removed = compileSceneCommands(scene, [
      { kind: "node.remove", id: "card" },
    ]);
    expect(removed.ok).toBe(true);
    if (removed.ok)
      expect(removed.affectedIds).toEqual(["card", "nested-label"]);
  });

  it("merges appended motion tracks by property and permits zero-size resize", () => {
    const scene = fixture();
    const title = findNode(scene, "title");
    if (title) {
      title.animations = [
        {
          kind: "keyframes",
          property: "opacity",
          frames: [
            { frame: 0, value: 0 },
            { frame: 10, value: 1 },
          ],
        },
      ];
    }
    const result = applySceneCommands(scene, [
      {
        kind: "motion.preset",
        id: "title",
        preset: "fadeOut",
        params: { delay: 60, durationInFrames: 15 },
        mode: "append",
      },
      { kind: "resize.set", id: "title", width: 0, height: 0 },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edited = findNode(result.scene, "title");
    expect(
      edited?.animations?.filter((track) => track.property === "opacity"),
    ).toHaveLength(1);
    expect(edited?.style).toMatchObject({ width: 0, height: 0 });
  });

  it("returns actionable errors for bad ids, geometry, assets, and trim bounds", () => {
    const missing = compileSceneCommands(fixture(), [
      { kind: "text.set", id: "titel", text: "Typo" },
    ]);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.errors[0]?.code).toBe("command_not_applicable");
      expect(missing.errors[0]?.message).toContain("Closest existing ids");
    }

    const percentScene = fixture();
    const a = findNode(percentScene, "a");
    if (a?.style) a.style.width = "20%";
    const geometry = compileSceneCommands(percentScene, [
      { kind: "align", ids: ["a", "b"], edge: "left" },
    ]);
    expect(geometry.ok).toBe(false);
    if (!geometry.ok) {
      expect(geometry.errors[0]).toMatchObject({ code: "nonnumeric_geometry" });
      expect(geometry.errors[0]?.message).toContain("numeric pixels");
    }

    const badAsset = compileSceneCommands(fixture(), [
      {
        kind: "node.add",
        node: { id: "orphan-video", type: "video", assetId: "not-an-asset" },
      },
    ]);
    expect(badAsset.ok).toBe(false);
    if (!badAsset.ok) {
      expect(badAsset.errors[0]?.code).toBe("command_not_applicable");
      expect(badAsset.errors[0]?.message).toContain("not-an-asset");
    }

    const bounds = compileSceneCommands(fixture(), [
      {
        kind: "media.trim",
        id: "footage-node",
        startSeconds: 11,
        endSeconds: 13,
      },
    ]);
    expect(bounds.ok).toBe(false);
    if (!bounds.ok) expect(bounds.errors[0]?.code).toBe("trim_out_of_bounds");
  });

  it("rejects invalid command fields without coercing or guessing", () => {
    const result = compileSceneCommands(fixture(), [
      { kind: "placement.set", id: "title", left: "10%" },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatchObject({
        commandIndex: 0,
        code: "invalid_command",
      });
    }
  });
});
