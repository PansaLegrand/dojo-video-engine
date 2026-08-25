#!/usr/bin/env node
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateEntrypointBaseline,
  validateSourceContract,
  validateWorkspaceGraph,
} from "./package-contracts.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(rootDir, "packages");
const changelog = await readFile(join(rootDir, "CHANGELOG.md"), "utf8");
const baseline = JSON.parse(
  await readFile(join(rootDir, "docs/public-api-baseline.json"), "utf8"),
);
const packageDirs = await readdir(packagesDir, { withFileTypes: true });
const packages = [];

for (const entry of packageDirs) {
  if (!entry.isDirectory()) continue;
  const packageDir = join(packagesDir, entry.name);
  const manifest = JSON.parse(
    await readFile(join(packageDir, "package.json"), "utf8"),
  );
  packages.push({ packageDir, manifest });
}

const publicPackages = packages.filter((entry) => !entry.manifest.private);
const packageManifests = new Map(
  packages.map((entry) => [entry.manifest.name, entry.manifest]),
);
const errors = [
  ...validateWorkspaceGraph(packages),
  ...validateEntrypointBaseline(packages, baseline),
];
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

  const sourceFiles = await collectTypeScriptFiles(join(packageDir, "src"));
  for (const sourceFile of sourceFiles) {
    errors.push(
      ...validateSourceContract({
        source: await readFile(sourceFile, "utf8"),
        sourceFile,
        packageDir,
        manifest,
        packageManifests,
      }),
    );
  }
}

if (errors.length > 0) {
  console.error("Package contract check failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `package contracts ok (${publicPackages.length} public packages at ${releaseVersion}; dependency graph and entrypoint baseline verified)`,
);

async function collectTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(path)));
    } else if (
      entry.isFile() &&
      /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(entry.name)
    ) {
      files.push(path);
    }
  }
  return files;
}
