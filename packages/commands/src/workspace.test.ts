import { describe, expect, it } from "vitest";
import {
  applyScenePatch,
  parseScene,
  type ScenePatch,
} from "@dojo-video-engine/schema";
import {
  SceneWorkspaceError,
  createSceneWorkspace,
  diffSceneSemantics,
  invertScenePatch,
} from "./workspace.js";

function baseScene() {
  return {
    schemaVersion: 1 as const,
    width: 1280,
    height: 720,
    fps: 30,
    duration: 180,
    assets: {
      image: {
        id: "image",
        type: "image" as const,
        src: "image.png",
        metadata: { width: 640, height: 360 },
      },
      unused: { id: "unused", type: "audio" as const, src: "unused.wav" },
      clip: { id: "clip", type: "video" as const, src: "clip.mp4" },
    },
    markers: { intro: 10 },
    audioBuses: { music: { gain: 0.8, pan: -0.1 } },
    nodes: [
      {
        id: "group",
        type: "div" as const,
        from: 0,
        duration: 150,
        style: { width: 1000, height: 600, padding: 20 },
        children: [
          {
            id: "title",
            type: "text" as const,
            text: "Original",
            from: 5,
            duration: 90,
            style: { fontSize: 48, color: "#fff" },
            animations: [],
          },
          {
            id: "picture",
            type: "img" as const,
            assetId: "image",
            style: { width: 320, height: 180 },
          },
          {
            id: "shot",
            type: "video" as const,
            assetId: "clip",
            from: 0,
            duration: 120,
            videoStartTime: 1,
            playbackRate: 1,
            volume: 0.7,
            audioBus: "music",
            style: { width: 640, height: 360 },
          },
        ],
      },
      { id: "plain", type: "div" as const },
      { id: "tail", type: "text" as const, text: "Tail" },
    ],
  };
}

function expectExactInverse(scene: unknown, patch: ScenePatch): void {
  const original = parseScene(scene);
  const inverted = invertScenePatch(original, patch);
  expect(inverted.ok).toBe(true);
  if (!inverted.ok) return;

  const forward = applyScenePatch(original, inverted.forwardPatch);
  expect(forward.ok).toBe(true);
  if (!forward.ok) return;
  expect(forward.scene).toEqual(inverted.scene);

  const restored = applyScenePatch(forward.scene, inverted.inversePatch);
  expect(restored.ok).toBe(true);
  if (!restored.ok) return;
  expect(restored.scene).toEqual(original);
  expect(JSON.parse(JSON.stringify(inverted.inversePatch))).toEqual(
    inverted.inversePatch,
  );
}

describe("invertScenePatch", () => {
  const categories: Array<{ name: string; patch: ScenePatch }> = [
    {
      name: "setStyle",
      patch: [
        { op: "setStyle", id: "title", style: { fontSize: 72, color: null } },
      ],
    },
    {
      name: "setText",
      patch: [{ op: "setText", id: "title", text: "Changed" }],
    },
    {
      name: "setNodeProps",
      patch: [
        {
          op: "setNodeProps",
          id: "shot",
          props: { volume: 0.3, pan: 0.5, videoStartTime: null },
        },
      ],
    },
    {
      name: "retime",
      patch: [{ op: "retime", id: "title", from: 20, duration: 60 }],
    },
    {
      name: "setAnimations",
      patch: [
        {
          op: "setAnimations",
          id: "title",
          animations: [
            {
              kind: "keyframes",
              property: "opacity",
              frames: [
                { frame: 0, value: 0 },
                { frame: 15, value: 1 },
              ],
            },
          ],
        },
      ],
    },
    {
      name: "insertNode",
      patch: [
        {
          op: "insertNode",
          node: { id: "inserted", type: "text", text: "Inserted" },
          parentId: "group",
          beforeId: "picture",
        },
      ],
    },
    { name: "removeNode", patch: [{ op: "removeNode", id: "picture" }] },
    {
      name: "moveNode",
      patch: [
        { op: "moveNode", id: "picture", parentId: "group", beforeId: "title" },
      ],
    },
    {
      name: "setAsset",
      patch: [
        {
          op: "setAsset",
          asset: {
            id: "unused",
            type: "audio",
            src: "new.wav",
            metadata: { duration: 4 },
          },
        },
      ],
    },
    { name: "removeAsset", patch: [{ op: "removeAsset", id: "unused" }] },
    {
      name: "setSceneMeta",
      patch: [{ op: "setSceneMeta", width: 1920, height: 1080, fps: 60 }],
    },
    {
      name: "setMarker",
      patch: [
        { op: "setMarker", name: "intro", frame: null },
        { op: "setMarker", name: "outro", frame: 160 },
      ],
    },
    {
      name: "setAudioBus",
      patch: [
        { op: "setAudioBus", name: "music", bus: { gain: 0.4, limiter: true } },
        { op: "setAudioBus", name: "dialogue", bus: { gain: 1 } },
      ],
    },
  ];

  for (const category of categories) {
    it(`restores ${category.name} exactly`, () => {
      expectExactInverse(baseScene(), category.patch);
    });
  }

  it("restores absent optional node fields and containers exactly", () => {
    expectExactInverse(baseScene(), [
      { op: "setStyle", id: "plain", style: { opacity: 0.5 } },
      { op: "retime", id: "plain", from: 20, duration: 30 },
      { op: "setAnimations", id: "plain", animations: [] },
      {
        op: "insertNode",
        parentId: "plain",
        node: { id: "temporary-child", type: "text", text: "Temporary" },
      },
    ]);
  });

  it("reverses repeated edits to the same node in strict operation order", () => {
    expectExactInverse(baseScene(), [
      { op: "setText", id: "title", text: "First" },
      { op: "setText", id: "title", text: "Second" },
      { op: "setStyle", id: "title", style: { fontSize: 60 } },
      { op: "setStyle", id: "title", style: { fontSize: 72, color: null } },
      { op: "retime", id: "title", from: 10, duration: 80 },
      { op: "retime", id: "title", from: 20, duration: 60 },
      {
        op: "setAnimations",
        id: "title",
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [{ frame: 0, value: 0.5 }],
          },
        ],
      },
      { op: "setAnimations", id: "title", animations: [] },
    ]);
  });

  it("restores nested moves, removals, empty child containers, and root order", () => {
    expectExactInverse(baseScene(), [
      { op: "moveNode", id: "title", parentId: "plain" },
      { op: "moveNode", id: "picture", beforeId: "group" },
      { op: "moveNode", id: "tail", beforeId: "picture" },
      { op: "removeNode", id: "shot" },
    ]);
  });

  it("restores subtree placement, order, assets, markers, buses, and metadata after a mixed patch", () => {
    expectExactInverse(baseScene(), [
      {
        op: "setAsset",
        asset: { id: "new-image", type: "image", src: "new.png" },
      },
      { op: "setNodeProps", id: "picture", props: { assetId: "new-image" } },
      { op: "removeAsset", id: "image" },
      { op: "moveNode", id: "tail", parentId: "group", beforeId: "shot" },
      { op: "setText", id: "title", text: "Mixed" },
      { op: "setMarker", name: "intro", frame: 25 },
      { op: "setAudioBus", name: "music", bus: { gain: 0.5, pan: 0.2 } },
      { op: "setSceneMeta", width: 1440, duration: 200 },
    ]);
  });

  it("returns structured failures and leaves its inputs untouched", () => {
    const scene = baseScene();
    const snapshot = structuredClone(scene);
    const result = invertScenePatch(scene, [
      { op: "setText", id: "missing", text: "No" },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.opIndex).toBe(0);
    expect(scene).toEqual(snapshot);
  });

  it("exports deterministic id-aware semantic diffs", () => {
    const changed = applyScenePatch(baseScene(), [
      { op: "moveNode", id: "tail", beforeId: "group" },
      { op: "setText", id: "title", text: "Changed" },
    ]);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    const diff = diffSceneSemantics(baseScene(), changed.scene);
    expect(diff.equal).toBe(false);
    expect(diff.changes[0]).toMatchObject({
      kind: "order",
      path: ["nodes"],
    });
    expect(JSON.parse(JSON.stringify(diff))).toEqual(diff);
  });

  it("does not collapse duplicate ids inside extension parameter arrays", () => {
    const before = parseScene(baseScene());
    before.nodes.push({
      id: "extension",
      type: "extension",
      extension: {
        name: "com.example.records",
        version: "1.0.0",
        params: {
          records: [
            { id: "duplicate", value: 1 },
            { id: "duplicate", value: 2 },
          ],
        },
      },
    });
    const after = structuredClone(before);
    const extension = after.nodes.at(-1);
    if (extension?.type === "extension" && extension.extension) {
      extension.extension.params = {
        records: [
          { id: "duplicate", value: 3 },
          { id: "duplicate", value: 2 },
        ],
      };
    }

    const diff = diffSceneSemantics(before, after);
    expect(diff.equal).toBe(false);
    expect(diff.changes).toContainEqual(
      expect.objectContaining({
        kind: "change",
        path: [
          "nodes",
          "extension",
          "extension",
          "params",
          "records",
          0,
          "value",
        ],
      }),
    );
  });

  it("represents order as a typed change without colliding with a '$order' node id", () => {
    const before = baseScene();
    before.nodes.push({ id: "$order", type: "text", text: "Before" });
    const after = structuredClone(before);
    const orderNode = after.nodes.pop();
    if (orderNode) {
      orderNode.text = "After";
      after.nodes.unshift(orderNode);
    }

    const diff = diffSceneSemantics(before, after);
    expect(diff.changes).toContainEqual(
      expect.objectContaining({ kind: "order", path: ["nodes"] }),
    );
    expect(diff.changes).toContainEqual(
      expect.objectContaining({
        kind: "change",
        path: ["nodes", "$order", "text"],
      }),
    );
  });
});

describe("SceneWorkspace", () => {
  it("returns defensive read, snapshot, and history clones", () => {
    const workspace = createSceneWorkspace(baseScene());
    const first = workspace.read();
    first.width = 1;
    const snapshot = workspace.snapshot();
    snapshot.scene.height = 1;
    expect(workspace.read().width).toBe(1280);
    expect(workspace.read().height).toBe(720);
    expect(workspace.revision).toBe(0);
    expect(workspace.history).toEqual([]);
  });

  it("rejects invalid history limits", () => {
    expect(() =>
      createSceneWorkspace(baseScene(), { historyLimit: 0 }),
    ).toThrow(SceneWorkspaceError);
  });

  // Command-specific workspace behavior is exercised below once commands are
  // compiled. Keeping this assertion independent verifies stale guards on an
  // otherwise read-only workspace too.
  it("rejects stale and malformed expected revisions deterministically", () => {
    const workspace = createSceneWorkspace(baseScene());
    for (const revision of [-1, 1, 1.5]) {
      try {
        workspace.undo(revision);
        throw new Error("expected stale revision rejection");
      } catch (error) {
        expect(error).toBeInstanceOf(SceneWorkspaceError);
        expect((error as SceneWorkspaceError).code).toBe("stale_revision");
      }
    }
  });

  it("drafts without mutation, then commits the exact inspected patch", () => {
    const workspace = createSceneWorkspace(baseScene());
    const original = workspace.read();
    const draft = workspace.draft([
      { kind: "text.set", id: "title", text: "Drafted title" },
      { kind: "style.set", id: "title", style: { fontSize: 64 } },
    ]);

    expect(workspace.revision).toBe(0);
    expect(workspace.read()).toEqual(original);
    expect(draft.baseRevision).toBe(0);
    expect(draft.scene.nodes[0]?.children?.[0]?.text).toBe("Drafted title");
    expect(draft.affectedIds).toEqual(["title"]);
    expect(draft.semanticDiff.equal).toBe(false);
    expect(Object.isFrozen(draft)).toBe(true);

    const entry = workspace.commit(draft);
    expect(entry.kind).toBe("commit");
    expect(entry.revisionBefore).toBe(0);
    expect(entry.revisionAfter).toBe(1);
    expect(entry.forwardPatch).toEqual(draft.patch);
    expect(entry.inversePatch).toEqual(draft.inversePatch);
    expect(draft.inversePatch.length).toBeGreaterThan(0);
    expect(entry.affectedIds).toEqual(["title"]);
    expect(workspace.read()).toEqual(draft.scene);
    expect(workspace.history).toEqual([entry]);
  });

  it("commits commands directly and leaves untouched roots byte-for-byte equal", () => {
    const workspace = createSceneWorkspace(baseScene());
    const untouchedBefore = workspace
      .read()
      .nodes.find((node) => node.id === "plain");
    const entry = workspace.commit([
      { kind: "timing.set", id: "title", from: 12, duration: 75 },
      { kind: "media.gain", id: "shot", gain: 0.4, pan: 0.2, bus: "music" },
    ]);
    const untouchedAfter = workspace
      .read()
      .nodes.find((node) => node.id === "plain");

    expect(entry.affectedIds).toEqual(["shot", "title"]);
    expect(untouchedAfter).toEqual(untouchedBefore);
    expect(workspace.revision).toBe(1);
  });

  it("undoes and redoes transactionally while revisions remain monotonic", () => {
    const workspace = createSceneWorkspace(baseScene());
    const original = workspace.read();
    const commit = workspace.commit([
      { kind: "text.set", id: "title", text: "Committed" },
      {
        kind: "node.add",
        node: { id: "badge", type: "text", text: "NEW" },
        parentId: "group",
        beforeId: "picture",
      },
    ]);
    const changed = workspace.read();
    const committedForward = applyScenePatch(original, commit.forwardPatch);
    expect(committedForward).toMatchObject({ ok: true, scene: changed });
    const committedInverse = applyScenePatch(changed, commit.inversePatch);
    expect(committedInverse).toMatchObject({ ok: true, scene: original });

    const undo = workspace.undo(1);
    expect(undo?.kind).toBe("undo");
    expect(undo?.revisionBefore).toBe(1);
    expect(undo?.revisionAfter).toBe(2);
    expect(undo?.forwardPatch).toEqual(commit.inversePatch);
    if (undo) {
      expect(applyScenePatch(changed, undo.forwardPatch)).toMatchObject({
        ok: true,
        scene: original,
      });
      expect(applyScenePatch(original, undo.inversePatch)).toMatchObject({
        ok: true,
        scene: changed,
      });
    }
    expect(workspace.read()).toEqual(original);
    expect(workspace.canRedo).toBe(true);

    const redo = workspace.redo(2);
    expect(redo?.kind).toBe("redo");
    expect(redo?.revisionAfter).toBe(3);
    expect(redo?.forwardPatch).toEqual(commit.forwardPatch);
    if (redo) {
      expect(applyScenePatch(original, redo.forwardPatch)).toMatchObject({
        ok: true,
        scene: changed,
      });
      expect(applyScenePatch(changed, redo.inversePatch)).toMatchObject({
        ok: true,
        scene: original,
      });
    }
    expect(workspace.read()).toEqual(changed);
    expect(workspace.canRedo).toBe(false);
  });

  it("previews undo/redo candidates without mutating stacks or revisions", () => {
    const workspace = createSceneWorkspace(baseScene());
    workspace.commit([{ kind: "text.set", id: "title", text: "Changed" }]);
    const committed = workspace.snapshot();
    const undoPreview = workspace.previewUndo(1);
    expect(undoPreview).toMatchObject({
      kind: "undo",
      changed: true,
      revision: 1,
      history: { revisionBefore: 1, revisionAfter: 2 },
    });
    expect(workspace.snapshot()).toEqual(committed);
    const undo = workspace.undo(1);
    expect(undoPreview.changed && undoPreview.scene).toEqual(workspace.read());
    expect(undoPreview.changed && undoPreview.history).toEqual(undo);

    const undone = workspace.snapshot();
    const redoPreview = workspace.previewRedo(2);
    expect(redoPreview).toMatchObject({
      kind: "redo",
      changed: true,
      revision: 2,
      history: { revisionBefore: 2, revisionAfter: 3 },
    });
    expect(workspace.snapshot()).toEqual(undone);
    const redo = workspace.redo(2);
    expect(redoPreview.changed && redoPreview.scene).toEqual(workspace.read());
    expect(redoPreview.changed && redoPreview.history).toEqual(redo);

    expect(workspace.previewRedo(3)).toMatchObject({
      kind: "redo",
      changed: false,
      revision: 3,
    });
  });

  it("undoes and redoes Scene metadata plus asset set/remove exactly", () => {
    const workspace = createSceneWorkspace(baseScene());
    const original = workspace.read();
    const commit = workspace.commit([
      { kind: "scene.set", width: 1920, height: 1080, fps: 60, duration: 300 },
      {
        kind: "asset.set",
        asset: {
          id: "voice",
          type: "audio",
          src: "voice.wav",
          metadata: { duration: 5 },
        },
      },
      { kind: "asset.remove", id: "unused" },
    ]);
    const changed = workspace.read();
    expect(changed).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 60,
      duration: 300,
      assets: { voice: { id: "voice", type: "audio" } },
    });
    expect(changed.assets.unused).toBeUndefined();
    expect(commit.affectedIds).toEqual(["unused", "voice"]);
    expect(commit.diagnostics.map(({ code }) => code)).toEqual([
      "scene_meta_set",
      "asset_set",
      "asset_removed",
    ]);
    expect(applyScenePatch(changed, commit.inversePatch)).toMatchObject({
      ok: true,
      scene: original,
    });

    const undo = workspace.undo(1);
    expect(undo?.revisionAfter).toBe(2);
    expect(workspace.read()).toEqual(original);
    const redo = workspace.redo(2);
    expect(redo?.revisionAfter).toBe(3);
    expect(workspace.read()).toEqual(changed);
  });

  it("rolls back a referenced asset removal without revision/history changes", () => {
    const workspace = createSceneWorkspace(baseScene());
    const before = workspace.snapshot();
    expect(() =>
      workspace.commit([
        { kind: "scene.set", width: 1920 },
        { kind: "asset.remove", id: "image" },
      ]),
    ).toThrowError(expect.objectContaining({ code: "command_failed" }));
    expect(workspace.snapshot()).toEqual(before);
  });

  it("rejects stale drafts after another commit without leaking either draft", () => {
    const workspace = createSceneWorkspace(baseScene());
    const stale = workspace.draft([
      { kind: "text.set", id: "title", text: "Stale" },
    ]);
    workspace.commit([{ kind: "text.set", id: "title", text: "Winner" }]);
    const winner = workspace.read();

    expect(() => workspace.commit(stale)).toThrowError(
      expect.objectContaining({ code: "stale_revision" }),
    );
    expect(workspace.read()).toEqual(winner);
    expect(workspace.revision).toBe(1);
  });

  it("clears the redo branch after a new commit", () => {
    const workspace = createSceneWorkspace(baseScene());
    workspace.commit([{ kind: "text.set", id: "title", text: "First" }]);
    workspace.commit([{ kind: "text.set", id: "title", text: "Second" }]);
    workspace.undo();
    expect(workspace.canRedo).toBe(true);

    workspace.commit([{ kind: "text.set", id: "title", text: "Branch" }]);
    expect(workspace.canRedo).toBe(false);
    expect(workspace.redo()).toBeNull();
    expect(workspace.read().nodes[0]?.children?.[0]?.text).toBe("Branch");
  });

  it("keeps scene, revision, and history unchanged when compilation fails", () => {
    const workspace = createSceneWorkspace(baseScene());
    const before = workspace.snapshot();
    try {
      workspace.commit([
        { kind: "text.set", id: "does-not-exist", text: "No" },
      ]);
      throw new Error("expected command failure");
    } catch (error) {
      expect(error).toBeInstanceOf(SceneWorkspaceError);
      expect((error as SceneWorkspaceError).code).toBe("command_failed");
    }
    expect(workspace.snapshot()).toEqual(before);
  });

  it("rejects drafts created by another workspace", () => {
    const first = createSceneWorkspace(baseScene());
    const second = createSceneWorkspace(baseScene());
    const draft = first.draft([
      { kind: "text.set", id: "title", text: "First" },
    ]);
    expect(() => second.commit(draft)).toThrowError(
      expect.objectContaining({ code: "invalid_draft" }),
    );
  });

  it("bounds journal and undo storage while keeping the revision monotonic", () => {
    const workspace = createSceneWorkspace(baseScene(), { historyLimit: 2 });
    workspace.commit([{ kind: "text.set", id: "title", text: "One" }]);
    workspace.commit([{ kind: "text.set", id: "title", text: "Two" }]);
    workspace.commit([{ kind: "text.set", id: "title", text: "Three" }]);
    expect(workspace.revision).toBe(3);
    expect(workspace.history).toHaveLength(2);
    expect(workspace.undo()).not.toBeNull();
    expect(workspace.undo()).not.toBeNull();
    expect(workspace.undo()).toBeNull();
    expect(workspace.revision).toBe(5);
  });
});
