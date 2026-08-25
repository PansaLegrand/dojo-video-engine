#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { publicPackageDirectories } from "./package-contracts.mjs";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const keep = process.argv.includes("--keep");
const createBin = join(
  rootDir,
  "packages/create-motionforge/dist/bin/create-motionforge.js",
);

const tempDir = await mkdtemp(join(tmpdir(), "motionforge-clean-machine-"));
const packDir = join(tempDir, "packs");
const projectDir = join(tempDir, "starter");

try {
  await mkdir(packDir, { recursive: true });

  await run("pnpm", ["install", "--frozen-lockfile"]);
  const packed = await packWorkspacePackages();
  await run("node", [createBin, projectDir]);
  await rewriteStarterDependencies(packed);
  await writeRuntimeSmoke();

  await run("pnpm", ["install"], { cwd: projectDir });
  await run("node", ["runtime-smoke.mjs"], { cwd: projectDir });
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
    "@motionforge/authoring": spec("@motionforge/authoring"),
    "@motionforge/cli": spec("@motionforge/cli"),
    "@motionforge/renderer-canvas2d": spec("@motionforge/renderer-canvas2d"),
    "@motionforge/runtime": spec("@motionforge/runtime"),
  };
  manifest.pnpm = {
    ...manifest.pnpm,
    overrides: Object.fromEntries(
      [...packed.keys()]
        .filter((name) => name !== "create-motionforge")
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

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
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
