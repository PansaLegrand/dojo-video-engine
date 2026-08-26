#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { publicPackageDirectories } from "./package-contracts.mjs";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const keep = process.argv.includes("--keep");
const suppliedPackDir = readOption("--pack-dir");

const tempDir = await mkdtemp(join(tmpdir(), "motionforge-clean-machine-"));
const packDir = suppliedPackDir
  ? resolve(rootDir, suppliedPackDir)
  : join(tempDir, "packs");
const projectDir = join(tempDir, "starter");
const launcherDir = join(tempDir, "launcher");

try {
  let packed;
  if (suppliedPackDir) {
    packed = await verifyReleaseBundle(packDir);
  } else {
    await mkdir(packDir, { recursive: true });
    await run("pnpm", ["install", "--frozen-lockfile"]);
    packed = await packWorkspacePackages();
  }
  const createBin = await installPackedCreate(packed);
  await run("node", [createBin, projectDir]);
  await rewriteStarterDependencies(packed);
  await writeRuntimeSmoke();
  await writePlatformSmokes();

  await run("pnpm", ["install"], { cwd: projectDir });
  await run("node", ["runtime-smoke.mjs"], { cwd: projectDir });
  await run("node", ["platform-smoke.mjs"], { cwd: projectDir });
  await run("pnpm", ["browser:build"], { cwd: projectDir });
  await run("pnpm", ["validate"], { cwd: projectDir });
  await run("pnpm", ["migrate"], { cwd: projectDir });
  await run("pnpm", ["inspect"], { cwd: projectDir });
  await run("pnpm", ["lint"], { cwd: projectDir });
  await run("pnpm", ["build"], { cwd: projectDir });

  console.log("\nclean-machine verification ok");
  console.log(`starter project: ${projectDir}`);
  console.log(
    keep
      ? "manual Studio check: cd into the starter project and run pnpm dev"
      : "rerun with --keep to preserve the starter for a manual Studio check",
  );
} finally {
  if (!keep) {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function packWorkspacePackages() {
  const packed = new Map();

  for (const packageDir of publicPackageDirectories) {
    const manifest = await readJson(join(rootDir, packageDir, "package.json"));

    await run("pnpm", [
      "--filter",
      manifest.name,
      "pack",
      "--pack-destination",
      packDir,
    ]);

    const tarball = join(packDir, tarballName(manifest.name, manifest.version));
    packed.set(manifest.name, tarball);
  }

  return packed;
}

async function verifyReleaseBundle(directory) {
  const manifest = await readJson(join(directory, "release-manifest.json"));
  if (
    manifest.format !== "motionforge.release-manifest" ||
    manifest.version !== 2 ||
    !Array.isArray(manifest.packages)
  ) {
    throw new Error("Release directory has no supported manifest v2.");
  }

  const currentCommit = (await runOutput("git", ["rev-parse", "HEAD"])).trim();
  if (manifest.gitCommit !== currentCommit) {
    throw new Error(
      `Release manifest commit ${manifest.gitCommit} does not match ${currentCommit}.`,
    );
  }
  const lockfile = await readFile(join(rootDir, "pnpm-lock.yaml"));
  if (sha256(lockfile) !== manifest.lockfile?.sha256) {
    throw new Error(
      "Release manifest does not match the frozen pnpm lockfile.",
    );
  }

  const packed = new Map();
  for (const packageDir of publicPackageDirectories) {
    const sourceManifest = await readJson(
      join(rootDir, packageDir, "package.json"),
    );
    const item = manifest.packages.find(
      (candidate) => candidate.name === sourceManifest.name,
    );
    if (!item || item.version !== sourceManifest.version) {
      throw new Error(`Release manifest is missing ${sourceManifest.name}.`);
    }
    const path = join(directory, item.file);
    const bytes = await readFile(path);
    if (bytes.byteLength !== item.byteLength || sha256(bytes) !== item.sha256) {
      throw new Error(
        `Release tarball hash mismatch for ${sourceManifest.name}.`,
      );
    }
    packed.set(sourceManifest.name, path);
  }
  if (packed.size !== manifest.packages.length) {
    throw new Error("Release manifest contains an unexpected public package.");
  }

  for (const evidence of [manifest.sbom, manifest.licenses, manifest.audit]) {
    if (!evidence?.file || !evidence.sha256) {
      throw new Error("Release manifest has incomplete evidence metadata.");
    }
    const bytes = await readFile(join(directory, evidence.file));
    if (
      bytes.byteLength !== evidence.byteLength ||
      sha256(bytes) !== evidence.sha256
    ) {
      throw new Error(`Release evidence hash mismatch for ${evidence.file}.`);
    }
  }
  console.log(
    `verified retained MotionForge ${manifest.releaseVersion} release bundle (${packed.size} packages)`,
  );
  return packed;
}

async function installPackedCreate(packed) {
  const createTarball = packed.get("@motionforge/create");
  if (!createTarball)
    throw new Error("Packed @motionforge/create is unavailable.");
  await mkdir(launcherDir, { recursive: true });
  await writeFile(
    join(launcherDir, "package.json"),
    `${JSON.stringify(
      {
        name: "motionforge-create-launcher",
        version: "0.0.0",
        private: true,
        packageManager: "pnpm@10.34.5",
        dependencies: {
          "@motionforge/create": `file:${toProjectRelative(
            launcherDir,
            createTarball,
          )}`,
        },
      },
      null,
      2,
    )}\n`,
  );
  await run("pnpm", ["install"], { cwd: launcherDir });
  return join(
    launcherDir,
    "node_modules/@motionforge/create/dist/bin/create-motionforge.js",
  );
}

async function rewriteStarterDependencies(packed) {
  const manifestPath = join(projectDir, "package.json");
  const manifest = await readJson(manifestPath);
  const spec = (name) => {
    const tarball = packed.get(name);

    if (!tarball) {
      throw new Error(`No packed tarball recorded for ${name}.`);
    }

    return `file:${toProjectRelative(projectDir, tarball)}`;
  };

  manifest.dependencies = {
    ...manifest.dependencies,
    "@motionforge/agent-tools": spec("@motionforge/agent-tools"),
    "@motionforge/authoring": spec("@motionforge/authoring"),
    "@motionforge/cli": spec("@motionforge/cli"),
    "@motionforge/commands": spec("@motionforge/commands"),
    "@motionforge/export": spec("@motionforge/export"),
    "@motionforge/interchange": spec("@motionforge/interchange"),
    "@motionforge/renderer-canvas2d": spec("@motionforge/renderer-canvas2d"),
    "@motionforge/runtime": spec("@motionforge/runtime"),
    "@motionforge/schema": spec("@motionforge/schema"),
  };
  manifest.devDependencies = {
    ...manifest.devDependencies,
    vite: "7.3.6",
  };
  manifest.scripts = {
    ...manifest.scripts,
    "browser:build": "vite build --config browser.vite.config.mjs",
  };
  manifest.pnpm = {
    ...manifest.pnpm,
    overrides: Object.fromEntries(
      [...packed.keys()]
        .filter((name) => name !== "@motionforge/create")
        .map((name) => [name, spec(name)]),
    ),
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function writeRuntimeSmoke() {
  const source = `import { createSceneRuntime } from "@motionforge/runtime";
import { createCanvas2DRuntimeBackend } from "@motionforge/renderer-canvas2d/runtime";

const scene = {
  schemaVersion: 1,
  width: 16,
  height: 16,
  fps: 30,
  duration: 2,
  assets: {},
  nodes: [],
};

const context = {
  canvas: { width: 16, height: 16 },
  save() {},
  restore() {},
  resetTransform() {},
  setTransform() {},
  clearRect() {},
  drawImage() {},
  getTransform() {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  },
  createLinearGradient() {
    return { addColorStop() {} };
  },
  createRadialGradient() {
    return { addColorStop() {} };
  },
  createConicGradient() {
    return { addColorStop() {} };
  },
  filter: "none",
  letterSpacing: "0px",
  globalAlpha: 1,
  globalCompositeOperation: "source-over",
  shadowBlur: 0,
  shadowColor: "rgba(0, 0, 0, 0)",
  shadowOffsetX: 0,
  shadowOffsetY: 0,
};
const surface = (width, height) => ({
  width,
  height,
  getContext: () => context,
});

const backend = createCanvas2DRuntimeBackend({
  globalObject: {},
  createRenderCanvas: surface,
  createArtifactCanvas: surface,
});
const runtime = await createSceneRuntime({ scene, backend });
await runtime.renderFrame(0, context);
await runtime.updateScene({ ...scene, duration: 3 }, {
  expectedRevision: 0,
});
await runtime.disposeAsync();

if (runtime.status !== "disposed" || runtime.revision !== 1) {
  throw new Error("Packed prepared-runtime lifecycle smoke failed.");
}

console.log("packed runtime entry points ok");
`;
  await writeFile(join(projectDir, "runtime-smoke.mjs"), source);
}

async function writePlatformSmokes() {
  const nodeSource = `import { createAgentWorkflowToolRegistry } from "@motionforge/agent-tools";
import { exportTimelineV1, importTimelineV1 } from "@motionforge/interchange";
import { createExportWorkerHandler } from "@motionforge/export/worker";

const scene = {
  schemaVersion: 1,
  width: 320,
  height: 180,
  fps: 30,
  duration: 30,
  assets: {},
  nodes: [{ id: "title", type: "text", text: "Before" }],
};
const registry = createAgentWorkflowToolRegistry({
  sessionOptions: { sessionId: "PackedPlatform" },
});
const loaded = await registry.call("motionforge.workflow.load", { scene });
if (!loaded.ok || !loaded.handle) throw new Error("packed workflow load failed");
const edited = await registry.call("motionforge.workflow.commands", {
  handle: loaded.handle,
  expectedRevision: 0,
  commands: [{ kind: "text.set", id: "title", text: "After" }],
});
if (!edited.ok || edited.revision !== 1) throw new Error("packed workflow edit failed");
const snapshot = await registry.hostSnapshot(loaded.handle);
const exported = exportTimelineV1(snapshot.scene);
if (!exported.ok) throw new Error("packed timeline export failed");
const imported = importTimelineV1(exported.timeline);
if (!imported.ok) throw new Error("packed timeline import failed");
if (typeof createExportWorkerHandler !== "function") {
  throw new Error("packed worker entry point is unavailable");
}
await registry.dispose();
console.log("packed workflow/interchange/worker entry points ok");
`;
  const browserSource = `import { createAgentWorkflowToolRegistry } from "@motionforge/agent-tools";
import { detectExportCapability } from "@motionforge/export";
import { createRemotionHostDescriptor } from "@motionforge/interchange";

const scene = {
  schemaVersion: 1,
  width: 320,
  height: 180,
  fps: 30,
  duration: 30,
  assets: {},
  nodes: [{ id: "title", type: "text", text: "Browser" }],
};
const registry = createAgentWorkflowToolRegistry({
  sessionOptions: { sessionId: "BrowserExample" },
});
const loaded = await registry.call("motionforge.workflow.load", { scene });
const descriptor = createRemotionHostDescriptor(scene);
const capability = detectExportCapability(globalThis);
const status = document.querySelector("#status");
if (status) {
  status.textContent = JSON.stringify({
    loaded: loaded.ok,
    descriptor: descriptor.ok,
    webCodecs: capability.videoEncoder,
  });
}
await registry.dispose();

// Vite must also resolve and emit the real worker subpath.
export const createExportWorker = () =>
  new Worker(new URL("./export-worker.ts", import.meta.url), { type: "module" });
`;
  const workerSource = `import { installExportWorker } from "@motionforge/export/worker";

installExportWorker(
  globalThis as unknown as Parameters<typeof installExportWorker>[0],
);
`;
  const html = `<!doctype html><meta charset="utf-8"><title>MotionForge packed browser smoke</title><pre id="status"></pre><script type="module" src="/src/browser-smoke.ts"></script>`;
  const viteConfig = `import { defineConfig } from "vite";
export default defineConfig({
  root: ".",
  worker: { format: "es" },
  build: { outDir: "browser-dist", emptyOutDir: true },
});
`;
  await writeFile(join(projectDir, "platform-smoke.mjs"), nodeSource);
  await writeFile(join(projectDir, "src/browser-smoke.ts"), browserSource);
  await writeFile(join(projectDir, "src/export-worker.ts"), workerSource);
  await writeFile(join(projectDir, "index.html"), html);
  await writeFile(join(projectDir, "browser.vite.config.mjs"), viteConfig);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a directory.`);
  }
  return value;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function tarballName(name, version) {
  const normalized = name.startsWith("@")
    ? name.slice(1).replace("/", "-")
    : name;
  return `${normalized}-${version}.tgz`;
}

function toProjectRelative(fromDir, path) {
  const value = relative(fromDir, path);
  return value.startsWith(".")
    ? value
    : `.${value.startsWith("/") ? "" : "/"}${value}`;
}

async function run(command, args, options = {}) {
  const cwd = options.cwd ?? rootDir;
  const label = [command, ...args].join(" ");
  console.log(`\n$ ${label}`);

  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(
        new Error(
          signal
            ? `${label} failed with signal ${signal}`
            : `${label} failed with exit code ${code}`,
        ),
      );
    });
  });
}

async function runOutput(command, args, options = {}) {
  const cwd = options.cwd ?? rootDir;
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "inherit"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise(output);
        return;
      }
      reject(
        new Error(
          signal
            ? `${command} failed with signal ${signal}`
            : `${command} failed with exit code ${code}`,
        ),
      );
    });
  });
}
