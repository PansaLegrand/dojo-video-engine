#!/usr/bin/env node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { publicPackageDirectories } from "./package-contracts.mjs";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cliBin = join(rootDir, "packages/cli/dist/bin/motionforge.js");
const createBin = join(
  rootDir,
  "packages/create-motionforge/dist/bin/create-motionforge.js",
);
const mode = process.argv[2] ?? "fast";

if (!["fast", "full", "smoke", "pack"].includes(mode)) {
  console.error("Usage: node scripts/release-gate.mjs [fast|full|smoke|pack]");
  process.exit(2);
}

const steps =
  mode === "fast"
    ? [
        ["pnpm", ["typecheck"]],
        ["pnpm", ["test"]],
        ["pnpm", ["lint"]],
        ["pnpm", ["build"]],
        ["node", ["scripts/release-gate.mjs", "smoke"]],
      ]
    : [
        ["pnpm", ["typecheck"]],
        ["pnpm", ["test"]],
        ["pnpm", ["lint"]],
        ["pnpm", ["build"]],
        ["pnpm", ["fuzz:scene"]],
        ["pnpm", ["corpus:check"]],
        ["pnpm", ["agent:gate"]],
        ["pnpm", ["resource:smoke"]],
        ["pnpm", ["golden:test"]],
        ["pnpm", ["cross-browser"]],
        ["pnpm", ["performance:gate"]],
        ["pnpm", ["e2e"]],
        ["node", ["scripts/release-gate.mjs", "smoke"]],
        ["node", ["scripts/release-gate.mjs", "pack"]],
      ];

if (mode === "smoke") {
  await runSmokeChecks();
} else if (mode === "pack") {
  await runPackDryRuns();
} else {
  await runSteps(steps);
}

async function runSteps(items) {
  for (const [command, args] of items) {
    await run(command, args);
  }
}

async function runSmokeChecks() {
  const dir = await mkdtemp(join(tmpdir(), "motionforge-release-gate-"));

  try {
    const scenePath = join(dir, "scene.json");
    await writeFile(
      scenePath,
      JSON.stringify({
        schemaVersion: 1,
        width: 320,
        height: 180,
        fps: 30,
        duration: 30,
        assets: {},
        nodes: [
          {
            id: "title",
            type: "text",
            text: "Release gate",
            style: { width: "100%", height: "100%", fontSize: 32 },
          },
        ],
      }),
    );

    await run("node", [cliBin, "validate", scenePath]);
    await run("node", [cliBin, "inspect", scenePath]);
    await run("node", [cliBin, "inspect-layout", scenePath, "--frame", "0"]);
    await run("node", [cliBin, "check", scenePath, "--frames", "0,29"]);

    await run("node", [createBin, "gate-video"], { cwd: dir });

    const packageJson = JSON.parse(
      await readFile(join(dir, "gate-video", "package.json"), "utf8"),
    );

    for (const script of [
      "dev",
      "validate",
      "print",
      "migrate",
      "inspect",
      "lint",
      "build",
    ]) {
      if (!packageJson.scripts?.[script]) {
        throw new Error(`Starter package.json is missing script "${script}".`);
      }
    }

    console.log("release smoke checks ok");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function runPackDryRuns() {
  for (const packageDir of publicPackageDirectories) {
    await run("npm", ["pack", "--dry-run"], { cwd: packageDir });
  }
}

async function run(command, args, options = {}) {
  const label = [command, ...args].join(" ");
  console.log(`\n$ ${label}`);

  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ? resolve(rootDir, options.cwd) : rootDir,
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
