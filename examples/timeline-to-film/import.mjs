import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [choice = "both", address = "http://127.0.0.1:4310"] =
  process.argv.slice(2);
const sceneFile =
  /^[a-zA-Z0-9_-]+\.json$/.test(basename(choice)) && choice.endsWith(".json")
    ? pathToFileURL(resolve(choice))
    : null;
if (
  (!sceneFile && !["both", "cut-a", "cut-b"].includes(choice)) ||
  process.argv.length > 4
)
  throw new Error(
    "Usage: node import.mjs [both|cut-a|cut-b|FILE.json] [http://127.0.0.1:4310]",
  );
const origin = new URL(address);
if (
  origin.protocol !== "http:" ||
  !["127.0.0.1", "localhost"].includes(origin.hostname) ||
  origin.href !== origin.origin + "/"
)
  throw new Error("Use the local editor's HTTP loopback origin.");

const formats = {
  ".mp4": ["video", "video/mp4"],
  ".wav": ["audio", "audio/wav"],
  ".woff2": ["font", "font/woff2"],
  ".png": ["image", "image/png"],
  ".jpg": ["image", "image/jpeg"],
};
const label = (value) =>
  value.replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase());
async function readCut(cut) {
  const scene = JSON.parse(
    await readFile(
      sceneFile ?? new URL(cut + ".json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(
    [scene.width, scene.height, scene.fps, scene.duration],
    [1280, 720, 30, 240],
  );
  assert.ok(scene.nodes.length && scene.nodes.length < 100);
  const files = new Map();
  for (const [id, asset] of Object.entries(scene.assets)) {
    const match =
      /^(?:\.\/)?assets\/([a-zA-Z0-9_-]+(\.(?:mp4|wav|woff2|png|jpg)))$/.exec(
        asset.src,
      );
    assert.ok(
      match && formats[match[2]][0] === asset.type,
      "Use the bundled footage, font and image files only.",
    );
    const fileName = match[1],
      mimeType = formats[match[2]][1];
    const bytes = await readFile(
      new URL("assets/" + fileName, sceneFile ?? import.meta.url),
    );
    assert.ok(
      bytes.length && bytes.length <= 32 * 1024 * 1024,
      "Invalid bundled file size.",
    );
    const hash = createHash("sha256").update(bytes).digest("hex");
    files.set(id, {
      asset,
      bytes,
      hash,
      fileName,
      mimeType,
      sourceId: "local:" + hash,
    });
  }
  return { cut, scene, files };
}

async function request(path, body, bytes = false, mimeType) {
  const response = await fetch(new URL(path, origin), {
    method: bytes ? "PUT" : body === undefined ? "GET" : "POST",
    ...(body !== undefined
      ? {
          headers: { "Content-Type": bytes ? mimeType : "application/json" },
          body: bytes ? body : JSON.stringify(body),
        }
      : {}),
    redirect: "error",
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok || !result.success)
    throw Error(path + ": " + (result.message ?? response.statusText));
  return result.data;
}

async function importCut({ cut, scene, files }) {
  const { id } = await request("/api/projects", {
    name: sceneFile
      ? "DojoClip · " + label(basename(choice, ".json"))
      : "DojoClip · The timeline becomes the film · " +
        cut.slice(-1).toUpperCase(),
  });
  const api = "/api/projects/" + encodeURIComponent(id);
  const url = new URL(
    "/en/applications/editor/" + encodeURIComponent(id),
    origin,
  ).href;
  try {
    const commands = [];
    for (const {
      asset,
      bytes,
      hash,
      fileName,
      mimeType,
      sourceId,
    } of files.values()) {
      const source =
        api + "/sources/" + encodeURIComponent(sourceId) + "/upload";
      await request(api + "/sources/register", {
        sourceId,
        fingerprint: hash,
        scheme: "sha256",
        byteLength: bytes.length,
        mimeType,
        fileName,
      });
      const ticket = await request(source + "/prepare", {});
      assert.equal(ticket.uploadUrl, source + "/bytes");
      await request(ticket.uploadUrl, bytes, true, mimeType);
      const saved = await request(source + "/complete", {});
      assert.equal(saved.assetId, sourceId);
      assert.equal(saved.status, "available");
      commands.push(
        {
          type: "addAsset",
          asset: {
            id: sourceId,
            assetId: saved.assetId,
            name: fileName,
            source: "project",
            type: asset.type,
            byteLength: bytes.length,
            mimeType,
            width: asset.metadata?.width,
            height: asset.metadata?.height,
            durationSeconds: asset.metadata?.duration,
            mediaMetadata: asset.metadata,
            sourceMode: asset.sourceMode,
          },
        },
        {
          type: "addSource",
          source: {
            assetId: sourceId,
            revision: "sha256:" + hash,
            contentHash: hash,
          },
        },
      );
    }
    for (const [key, value] of Object.entries({
      width: scene.width,
      height: scene.height,
      fps: scene.fps,
      durationInFrames: scene.duration,
      backgroundColor: scene.backgroundColor ?? "#000000",
    }))
      commands.push({
        type: "set",
        target: { kind: "format" },
        path: [key],
        value,
      });
    if (scene.markers && Object.keys(scene.markers).length)
      commands.push({
        type: "set",
        target: { kind: "project" },
        path: ["markers"],
        value: scene.markers,
      });
    const remap = (node) => {
      const copy = { ...node };
      if (node.assetId) {
        assert.ok(files.has(node.assetId), "Unbound asset: " + node.assetId);
        copy.assetId = files.get(node.assetId).sourceId;
      }
      if (node.children) copy.children = node.children.map(remap);
      return copy;
    };
    for (const [index, root] of scene.nodes.entries()) {
      const trackId = "film-layer-" + index,
        name = label(root.id);
      commands.push(
        {
          type: "addTrack",
          track: {
            id: trackId,
            name,
            kind: root.type === "audio" ? "audio" : "visual",
            muted: false,
            hidden: false,
            locked: false,
          },
        },
        {
          type: "addItem",
          item: {
            id: root.id,
            name,
            trackId,
            node: {
              ...remap(root),
              from: root.from ?? 0,
              duration: root.duration ?? scene.duration - (root.from ?? 0),
            },
          },
        },
      );
    }
    commands.push(
      { type: "removeTrack", id: "visual" },
      { type: "removeTrack", id: "audio" },
    );
    const snapshot = await request(api + "/document");
    const imported = await request(api + "/commands", {
      operationId: randomUUID(),
      baseRevision: snapshot.revision,
      baseHash: snapshot.documentHash,
      summary: "Import the editable " + cut + " composition",
      commands,
    });
    assert.equal(imported.document.items.length, scene.nodes.length);
    return {
      cut,
      editorUrl: url,
      revision: imported.revision,
      documentHash: imported.documentHash,
      layers: imported.document.items.length,
    };
  } catch (error) {
    console.error("Import did not finish. The new project is at " + url);
    throw error;
  }
}

const cuts = await Promise.all(
  (choice === "both" ? ["cut-a", "cut-b"] : [choice]).map(readCut),
);
for (const cut of cuts) console.log(JSON.stringify(await importCut(cut)));
