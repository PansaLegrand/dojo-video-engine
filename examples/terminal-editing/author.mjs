import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createAgentWorkflowToolRegistry } from "@dojo-video-engine/agent-tools";

// The coding agent owns this file/Scene. No nested model loop is needed.
const scene = {
  schemaVersion: 1,
  width: 640,
  height: 360,
  fps: 30,
  duration: 120,
  assets: {
    a: { id: "a", type: "video", src: "/a.mp4" },
    b: { id: "b", type: "video", src: "/b.mp4" },
    music: { id: "music", type: "audio", src: "/music.wav" },
  },
  nodes: [
    {
      id: "clip-a",
      type: "video",
      assetId: "a",
      from: 0,
      duration: 60,
      videoStartTime: 1,
      volume: 0.5,
      style: { width: "100%", height: "100%" },
    },
    {
      id: "clip-b",
      type: "video",
      assetId: "b",
      from: 60,
      duration: 60,
      videoStartTime: 0.5,
      volume: 0.5,
      style: { width: "100%", height: "100%" },
    },
    {
      id: "music",
      type: "audio",
      assetId: "music",
      from: 0,
      duration: 120,
      volume: 0.2,
    },
    {
      id: "title",
      type: "text",
      text: "Draft title",
      from: 0,
      duration: 60,
      style: {
        position: "absolute",
        left: 24,
        top: 20,
        width: 592,
        height: 56,
        fontSize: 32,
        color: "#FFFFFF",
        backgroundColor: "#101820",
        padding: 8,
      },
    },
  ],
};
const json = (value) => JSON.stringify(value, null, 2) + "\n";
await writeFile("before.json", json(scene));
const workflow = createAgentWorkflowToolRegistry();
try {
  const loaded = await workflow.call("dojo-video-engine.workflow.load", {
    scene,
  });
  assert.equal(loaded.ok, true, JSON.stringify(loaded));
  const original = await workflow.hostSnapshot(loaded.handle);
  const edited = await workflow.call("dojo-video-engine.workflow.commands", {
    handle: loaded.handle,
    expectedRevision: 0,
    commands: [
      { kind: "text.set", id: "title", text: "Edited from the terminal" },
    ],
  });
  assert.equal(edited.ok, true, JSON.stringify(edited));
  const stale = await workflow.call("dojo-video-engine.workflow.commands", {
    handle: loaded.handle,
    expectedRevision: 0,
    commands: [{ kind: "text.set", id: "title", text: "Stale overwrite" }],
  });
  assert.equal(stale.ok, false, "stale revision must fail");
  const snapshot = await workflow.hostSnapshot(loaded.handle);
  assert.equal(
    snapshot.scene.nodes.find((n) => n.id === "title").text,
    "Edited from the terminal",
  );
  const expected = structuredClone(original.scene);
  expected.nodes.find((n) => n.id === "title").text =
    "Edited from the terminal";
  assert.deepEqual(snapshot.scene, expected);
  await writeFile("scene.json", json(snapshot.scene));
  await writeFile(
    "edit-receipt.json",
    json({ revision: edited.revision, staleRejected: !stale.ok }),
  );
} finally {
  await workflow.dispose();
}
console.log(
  "Saved scene.json; title revised, unrelated clips preserved, stale edit rejected.",
);
