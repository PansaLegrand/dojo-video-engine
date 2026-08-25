import type { ServerResponse } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateScene } from "@motionforge/schema";
import { createServer, type Plugin } from "vite";
import { loadSceneModule } from "./loader.js";

export type StudioServerOptions = {
  sceneModulePath: string;
  host?: string;
  port?: number;
};

export type StudioServerResult = {
  url: string;
  sceneModulePath: string;
  close: () => Promise<void>;
};

export async function createStudioServer(
  options: StudioServerOptions,
): Promise<StudioServerResult> {
  const sceneModulePath = resolve(options.sceneModulePath);
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 5173;
  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    resolve: {
      alias: resolveStudioRuntimeAliases(),
    },
    server: {
      host,
      port,
      strictPort: false,
    },
    plugins: [studioPlugin(sceneModulePath)],
  });

  await server.listen();

  const address = server.resolvedUrls?.local[0] ?? `http://${host}:${port}/`;

  return {
    url: address,
    sceneModulePath,
    close: async () => {
      await server.close();
    },
  };
}

function resolveStudioRuntimeAliases() {
  return {
    "@motionforge/export": resolveStudioRuntimePackage(
      "@motionforge/export",
      "packages/export/src/index.ts",
    ),
    "@motionforge/presets/catalog": resolveStudioRuntimePackage(
      "@motionforge/presets/catalog",
      "packages/presets/src/catalog.ts",
    ),
    "@motionforge/player": resolveStudioRuntimePackage(
      "@motionforge/player",
      "packages/player/src/index.ts",
    ),
    "@motionforge/renderer-canvas2d/runtime": resolveStudioRuntimePackage(
      "@motionforge/renderer-canvas2d/runtime",
      "packages/renderer-canvas2d/src/runtime.ts",
    ),
    "@motionforge/renderer-canvas2d": resolveStudioRuntimePackage(
      "@motionforge/renderer-canvas2d",
      "packages/renderer-canvas2d/src/index.ts",
    ),
    "@motionforge/runtime": resolveStudioRuntimePackage(
      "@motionforge/runtime",
      "packages/runtime/src/index.ts",
    ),
    "@motionforge/schema/values": resolveStudioRuntimePackage(
      "@motionforge/schema/values",
      "packages/schema/src/values.ts",
    ),
    "@motionforge/schema": resolveStudioRuntimePackage(
      "@motionforge/schema",
      "packages/schema/src/index.ts",
    ),
  };
}

function resolveStudioRuntimePackage(specifier: string, workspacePath: string) {
  const resolver = (import.meta as { resolve?: (specifier: string) => string })
    .resolve;

  if (resolver) {
    try {
      return fileURLToPath(resolver(specifier));
    } catch {
      // Fall through to the monorepo source path used by Vitest/local DX.
    }
  }

  return fileURLToPath(new URL(`../../../${workspacePath}`, import.meta.url));
}

function studioPlugin(sceneModulePath: string): Plugin {
  const virtualClientId = "virtual:motionforge-studio-client";
  const resolvedVirtualClientId = `\0${virtualClientId}`;

  return {
    name: "motionforge-studio",
    resolveId(id) {
      if (id === virtualClientId) {
        return resolvedVirtualClientId;
      }

      return null;
    },
    load(id) {
      if (id === resolvedVirtualClientId) {
        return studioClientSource();
      }

      return null;
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        try {
          if (!request.url) {
            next();
            return;
          }

          const url = new URL(request.url, "http://motionforge.local");

          if (url.pathname === "/") {
            const html = await server.transformIndexHtml(
              url.pathname,
              studioHtml(),
            );
            sendHtml(response, html);
            return;
          }

          if (url.pathname === "/__motionforge/scene") {
            await sendSceneJson(response, sceneModulePath);
            return;
          }

          next();
        } catch (error) {
          sendJson(response, 500, {
            ok: false,
            errors: [error instanceof Error ? error.message : String(error)],
          });
        }
      });
    },
  };
}

async function sendSceneJson(
  response: ServerResponse,
  sceneModulePath: string,
) {
  const sceneInput = await loadSceneModule(sceneModulePath);
  const result = validateScene(sceneInput);

  if (!result.ok) {
    sendJson(response, 422, { ok: false, errors: result.errors });
    return;
  }

  sendJson(response, 200, { ok: true, scene: result.scene });
}

function sendHtml(response: ServerResponse, html: string) {
  response.statusCode = 200;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(html);
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function studioHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MotionForge Studio</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: #e5e7eb;
        color: #111827;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        display: grid;
        min-height: 100vh;
        grid-template-columns: minmax(260px, 420px) minmax(340px, 1fr) minmax(300px, 380px);
        gap: 24px;
        align-items: center;
        padding: 24px;
      }
      .preview {
        justify-self: end;
        max-height: calc(100vh - 48px);
        overflow: hidden;
        border-radius: 10px;
        background: #111827;
        box-shadow: 0 24px 72px rgb(15 23 42 / 24%);
      }
      canvas {
        display: block;
        max-height: calc(100vh - 48px);
        max-width: 100%;
      }
      .panel { max-width: 640px; }
      .preset-panel {
        align-self: stretch;
        display: flex;
        min-height: 0;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: rgb(255 255 255 / 68%);
      }
      h1 { margin: 0 0 8px; font-size: 40px; line-height: 1; }
      p { color: #4b5563; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
      button {
        height: 38px;
        border: 0;
        border-radius: 8px;
        background: #111827;
        color: white;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        padding: 0 14px;
      }
      button.secondary { background: #ffffff; color: #111827; border: 1px solid #cbd5e1; }
      button:disabled { cursor: not-allowed; opacity: 0.45; }
      input[type="range"] { width: min(100%, 420px); }
      .preset-tabs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }
      .preset-tabs button,
      .preset-actions button {
        height: 32px;
        border-radius: 6px;
        padding: 0 10px;
        font-size: 12px;
      }
      .preset-tabs button[data-active="true"],
      .preset-card[data-active="true"] {
        border-color: #111827;
        background: #111827;
        color: white;
      }
      .preset-list {
        display: grid;
        gap: 8px;
        max-height: 220px;
        overflow: auto;
        padding-right: 2px;
      }
      .preset-card {
        display: grid;
        gap: 4px;
        min-height: 0;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 10px;
        background: #ffffff;
        color: #111827;
        text-align: left;
      }
      .preset-card strong { font-size: 13px; }
      .preset-card span { color: #475569; font-size: 11px; font-weight: 800; overflow-wrap: anywhere; }
      .preset-card p { margin: 0; font-size: 12px; line-height: 1.35; }
      .preset-block {
        display: grid;
        gap: 8px;
        min-height: 0;
      }
      .preset-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .preset-header strong { font-size: 13px; overflow-wrap: anywhere; }
      .preset-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
      .preset-description { margin: 0; font-size: 12px; line-height: 1.35; }
      .preset-status {
        min-height: 1.2em;
        color: #475569;
        white-space: pre-wrap;
        font-size: 12px;
      }
      pre {
        max-height: 280px;
        overflow: auto;
        border-radius: 8px;
        background: #0f172a;
        color: #dbeafe;
        padding: 12px;
        font-size: 12px;
        line-height: 1.5;
      }
      .preset-panel pre {
        max-height: 180px;
        white-space: pre;
      }
      #preset-patch[data-available="false"] { display: none; }
      .error { color: #b91c1c; }
      @media (max-width: 1120px) {
        main { grid-template-columns: 1fr; }
        .preview { justify-self: center; max-height: 62vh; }
        canvas { max-height: 62vh; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="preview">
        <canvas id="preview" width="1080" height="1920"></canvas>
      </section>
      <section class="panel">
        <h1>MotionForge Studio</h1>
        <p id="status">Loading scene...</p>
        <label>
          Frame
          <input id="frame" type="range" min="0" max="0" value="0" />
          <output id="frame-readout">0</output>
        </label>
        <div class="actions">
          <button id="play" type="button">Play</button>
          <button id="reload" type="button" class="secondary">Reload scene</button>
          <button id="export" type="button" class="secondary">Export MP4</button>
        </div>
        <pre id="json"></pre>
      </section>
      <aside class="preset-panel">
        <div>
          <h2>Presets</h2>
          <p class="preset-description">Copy code or apply scene patches while previewing this project.</p>
        </div>
        <div id="preset-family-tabs" class="preset-tabs" aria-label="Preset families"></div>
        <div id="preset-list" class="preset-list"></div>
        <div class="preset-block">
          <div class="preset-header">
            <strong id="preset-snippet-title">Snippet</strong>
            <div class="preset-actions">
              <button id="preset-copy" type="button" class="secondary">Copy</button>
            </div>
          </div>
          <pre id="preset-snippet"></pre>
          <output id="preset-copy-status" class="preset-status"></output>
        </div>
        <div class="preset-block">
          <div class="preset-header">
            <strong id="preset-patch-title">Patch example</strong>
            <div class="preset-actions">
              <button id="preset-patch-apply" type="button">Apply</button>
              <button id="preset-patch-copy" type="button" class="secondary">Copy patch</button>
            </div>
          </div>
          <p id="preset-patch-description" class="preset-description"></p>
          <pre id="preset-patch"></pre>
          <output id="preset-patch-status" class="preset-status"></output>
        </div>
      </aside>
    </main>
    <script type="module" src="/@id/__x00__virtual:motionforge-studio-client"></script>
  </body>
</html>
`;
}

function studioClientSource() {
  return `import { detectExportCapability, exportVideo } from "@motionforge/export";
import { createPlayer } from "@motionforge/player";
import { buildPresetPatchExample, presetCatalog, presetFamilyLabels } from "@motionforge/presets/catalog";
import { applyScenePatch } from "@motionforge/schema";

const canvas = document.querySelector("#preview");
const status = document.querySelector("#status");
const slider = document.querySelector("#frame");
const readout = document.querySelector("#frame-readout");
const playButton = document.querySelector("#play");
const reloadButton = document.querySelector("#reload");
const exportButton = document.querySelector("#export");
const json = document.querySelector("#json");
const presetFamilyTabs = document.querySelector("#preset-family-tabs");
const presetList = document.querySelector("#preset-list");
const presetSnippetTitle = document.querySelector("#preset-snippet-title");
const presetSnippet = document.querySelector("#preset-snippet");
const presetCopy = document.querySelector("#preset-copy");
const presetCopyStatus = document.querySelector("#preset-copy-status");
const presetPatchTitle = document.querySelector("#preset-patch-title");
const presetPatchDescription = document.querySelector("#preset-patch-description");
const presetPatch = document.querySelector("#preset-patch");
const presetPatchApply = document.querySelector("#preset-patch-apply");
const presetPatchCopy = document.querySelector("#preset-patch-copy");
const presetPatchStatus = document.querySelector("#preset-patch-status");

if (!(canvas instanceof HTMLCanvasElement) || !status || !(slider instanceof HTMLInputElement) || !(readout instanceof HTMLOutputElement) || !(playButton instanceof HTMLButtonElement) || !(reloadButton instanceof HTMLButtonElement) || !(exportButton instanceof HTMLButtonElement) || !json || !presetFamilyTabs || !presetList || !presetSnippetTitle || !presetSnippet || !(presetCopy instanceof HTMLButtonElement) || !(presetCopyStatus instanceof HTMLOutputElement) || !presetPatchTitle || !presetPatchDescription || !presetPatch || !(presetPatchApply instanceof HTMLButtonElement) || !(presetPatchCopy instanceof HTMLButtonElement) || !(presetPatchStatus instanceof HTMLOutputElement)) {
  throw new Error("Studio DOM is missing required elements.");
}

const context = canvas.getContext("2d");

if (!context) {
  throw new Error("Canvas2D is unavailable.");
}

const capability = detectExportCapability();
let scene = null;
let player = null;
let selectedPresetFamily = "subtitles";
let selectedPreset = presetCatalog[0];
let selectedPatchExample = null;

renderPresetExplorer();

async function loadScene() {
  status.classList.remove("error");
  status.textContent = "Loading scene...";
  player?.dispose();
  player = null;
  playButton.textContent = "Play";

  const response = await fetch("/__motionforge/scene", { cache: "no-store" });
  const payload = await response.json();

  if (!payload.ok) {
    scene = null;
    status.classList.add("error");
    status.textContent = "Scene failed validation.";
    json.textContent = payload.errors.join("\\n");
    renderPresetSnippet();
    return;
  }

  scene = payload.scene;
  await loadSceneDoc(scene);
}

async function loadSceneDoc(nextScene) {
  scene = nextScene;
  canvas.width = nextScene.width;
  canvas.height = nextScene.height;
  slider.max = String(nextScene.duration - 1);
  slider.value = "0";
  readout.value = "0";
  player?.dispose();
  player = null;
  json.textContent = JSON.stringify(scene, null, 2);
  status.classList.remove("error");
  status.textContent = \`\${nextScene.width}x\${nextScene.height} · \${nextScene.fps}fps · \${(nextScene.duration / nextScene.fps).toFixed(1)}s\`;
  exportButton.disabled = !capability.videoEncoder;
  exportButton.title = capability.videoEncoder
    ? "Export MP4"
    : "MP4 export needs WebCodecs VideoEncoder. Try desktop Chrome or Edge.";
  renderPresetSnippet();

  try {
    player = await createPlayer({ context, scene: nextScene, loop: true });
    await player.seek(0);
    player.on("frame", (frame) => {
      slider.value = String(frame);
      readout.value = String(frame);
    });
  } catch (error) {
    status.classList.add("error");
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

slider.addEventListener("input", () => {
  if (!player) return;
  player.pause();
  playButton.textContent = "Play";
  void player.seek(Number(slider.value));
});

playButton.addEventListener("click", () => {
  if (!player) return;

  if (player.playing) {
    player.pause();
    playButton.textContent = "Play";
  } else {
    void player.play();
    playButton.textContent = "Pause";
  }
});

reloadButton.addEventListener("click", () => {
  void loadScene();
});

exportButton.addEventListener("click", async () => {
  if (!scene || exportButton.disabled) return;

  exportButton.disabled = true;
  status.textContent = "Exporting MP4...";

  try {
    const { blob } = await exportVideo({
      scene,
      onProgress: ({ frameIndex, totalFrames }) => {
        status.textContent = \`Exporting \${frameIndex + 1}/\${totalFrames}\`;
      },
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "motionforge-studio.mp4";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    status.textContent = "Export complete.";
  } catch (error) {
    status.classList.add("error");
    status.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    exportButton.disabled = !capability.videoEncoder;
  }
});

function renderPresetExplorer() {
  renderPresetFamilyTabs();
  renderPresetList();
  renderPresetSnippet();
}

function renderPresetFamilyTabs() {
  presetFamilyTabs.replaceChildren(
    ...Object.entries(presetFamilyLabels).map(([family, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.active = selectedPresetFamily === family ? "true" : "false";
      button.addEventListener("click", () => {
        selectedPresetFamily = family;
        selectedPreset =
          presetCatalog.find((item) => item.family === selectedPresetFamily) ??
          selectedPreset;
        renderPresetExplorer();
      });
      return button;
    }),
  );
}

function renderPresetList() {
  const items = presetCatalog.filter(
    (item) => item.family === selectedPresetFamily,
  );

  presetList.replaceChildren(
    ...items.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset-card";
      button.dataset.active = item.key === selectedPreset.key ? "true" : "false";
      button.addEventListener("click", () => {
        selectedPreset = item;
        renderPresetList();
        renderPresetSnippet();
      });

      const heading = document.createElement("strong");
      heading.textContent = item.name;

      const meta = document.createElement("span");
      meta.textContent = \`\${item.key} · \${item.category}\`;

      const description = document.createElement("p");
      description.textContent = item.description;

      button.append(heading, meta, description);
      return button;
    }),
  );
}

function renderPresetSnippet() {
  if (!selectedPreset) return;

  presetSnippetTitle.textContent = \`\${selectedPreset.name} snippet\`;
  presetSnippet.textContent = selectedPreset.snippet;
  presetCopyStatus.value = "";
  renderPresetPatchExample();
}

function renderPresetPatchExample() {
  if (!selectedPreset) return;

  selectedPatchExample = buildPresetPatchExample(selectedPreset, scene);
  presetPatchStatus.value = "";
  presetPatchTitle.textContent = selectedPatchExample.title;

  if (selectedPatchExample.ok) {
    presetPatchDescription.textContent =
      scene === null
        ? \`\${selectedPatchExample.description} Load a valid scene before applying.\`
        : selectedPatchExample.description;
    presetPatch.textContent = JSON.stringify(selectedPatchExample.patch, null, 2);
    presetPatch.dataset.available = "true";
    presetPatchApply.disabled = scene === null;
    presetPatchCopy.disabled = false;
    return;
  }

  presetPatchDescription.textContent = selectedPatchExample.reason;
  presetPatch.textContent = "";
  presetPatch.dataset.available = "false";
  presetPatchApply.disabled = true;
  presetPatchCopy.disabled = true;
}

presetCopy.addEventListener("click", () => {
  if (!selectedPreset) return;

  void navigator.clipboard
    .writeText(selectedPreset.snippet)
    .then(() => {
      presetCopyStatus.value = \`Copied \${selectedPreset.key}\`;
    })
    .catch(() => {
      presetCopyStatus.value = "Clipboard unavailable.";
    });
});

presetPatchCopy.addEventListener("click", () => {
  if (!selectedPatchExample?.ok) return;

  void navigator.clipboard
    .writeText(JSON.stringify(selectedPatchExample.patch, null, 2))
    .then(() => {
      presetPatchStatus.value = \`Copied \${selectedPreset.key} patch\`;
    })
    .catch(() => {
      presetPatchStatus.value = "Clipboard unavailable.";
    });
});

presetPatchApply.addEventListener("click", () => {
  if (!selectedPatchExample?.ok || !scene) return;

  const result = applyScenePatch(scene, selectedPatchExample.patch);

  if (!result.ok) {
    presetPatchStatus.value = result.errors.map((error) => error.message).join("\\n");
    return;
  }

  void loadSceneDoc(result.scene).then(() => {
    presetPatchStatus.value = \`Applied \${selectedPreset.key}\`;
  });
});

void loadScene();
`;
}
