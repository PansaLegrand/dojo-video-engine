#!/usr/bin/env node
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(rootDir, "packages");
const changelog = await readFile(join(rootDir, "CHANGELOG.md"), "utf8");
const packageDirs = await readdir(packagesDir, { withFileTypes: true });
const publicPackages = [];

for (const entry of packageDirs) {
  if (!entry.isDirectory()) continue;
  const packageDir = join(packagesDir, entry.name);
  const manifest = JSON.parse(
    await readFile(join(packageDir, "package.json"), "utf8"),
  );
  if (manifest.private) continue;
  publicPackages.push({ packageDir, manifest });
}

const errors = [];
const versions = new Set(
  publicPackages.map(({ manifest }) => manifest.version),
);

if (versions.size !== 1) {
  errors.push(
    `Public package versions must match; found ${Array.from(versions).sort().join(", ")}.`,
  );
}

const releaseVersion = versions.size === 1 ? Array.from(versions)[0] : null;
if (releaseVersion && !changelog.includes(`## ${releaseVersion} `)) {
  errors.push(`CHANGELOG.md has no release heading for ${releaseVersion}.`);
}

for (const { packageDir, manifest } of publicPackages) {
  for (const requiredFile of ["README.md", "LICENSE"]) {
    try {
      await access(join(packageDir, requiredFile));
    } catch {
      errors.push(`${manifest.name} is missing ${requiredFile}.`);
    }
  }

  for (const dependencyField of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
  ]) {
    for (const [name, version] of Object.entries(
      manifest[dependencyField] ?? {},
    )) {
      if (name.startsWith("@motionforge/") && version !== "workspace:*") {
        errors.push(
          `${manifest.name} ${dependencyField}.${name} must use workspace:*, found ${version}.`,
        );
      }
    }
  }
}

const browserEnginePackages = [
  "authoring",
  "core",
  "export",
  "extensions",
  "agent-tools",
  "player",
  "presets",
  "renderer-canvas2d",
  "schema",
];
const forbiddenSpecifiers = [
  /^@\//,
  /^@clerk(?:\/|$)/,
  /^@prisma(?:\/|$)/,
  /^next(?:\/|$)/,
  /^react(?:\/|$)/,
  /^stripe(?:\/|$)/,
];
const importPattern = /(?:from\s+|import\s*\()\s*["']([^"']+)["']/g;

for (const packageName of browserEnginePackages) {
  const srcDir = join(packagesDir, packageName, "src");
  const sourceFiles = await collectTypeScriptFiles(srcDir);

  for (const sourceFile of sourceFiles) {
    const source = await readFile(sourceFile, "utf8");
    const displayPath = relative(rootDir, sourceFile);

    if (source.includes("/Users/") || source.includes("dojo-video-web")) {
      errors.push(
        `${displayPath} contains a local or downstream repository path.`,
      );
    }

    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier) continue;
      if (forbiddenSpecifiers.some((pattern) => pattern.test(specifier))) {
        errors.push(
          `${displayPath} imports forbidden browser-engine dependency ${JSON.stringify(specifier)}.`,
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Package contract check failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `package contracts ok (${publicPackages.length} public packages at ${releaseVersion})`,
);

async function collectTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }

  return files;
}
