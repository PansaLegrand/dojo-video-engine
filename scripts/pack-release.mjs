#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { publicPackageDirectories } from "./public-package-policy.mjs";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputArg = process.argv[2];

if (!outputArg) {
  throw new Error(
    "Usage: node scripts/pack-release.mjs <empty-output-directory>",
  );
}

const outputDir = resolve(rootDir, outputArg);
if (outputDir === rootDir || basename(outputDir).length < 3) {
  throw new Error("Release output must be a dedicated non-root directory.");
}

await ensureEmptyOutput(outputDir);

const gitCommit = runText("git", ["rev-parse", "HEAD"]);
const gitTimestamp = runText("git", ["show", "-s", "--format=%cI", "HEAD"]);
const lockfileBytes = await readFile(join(rootDir, "pnpm-lock.yaml"));
const lockfileSha256 = sha256(lockfileBytes);
await writeFile(join(outputDir, "pnpm-lock.yaml"), lockfileBytes);
const rootManifest = await readJson(join(rootDir, "package.json"));
const registryLicenseCache = new Map();

const packages = [];
const publicManifests = new Map();
for (const packageDir of publicPackageDirectories) {
  const absoluteDir = join(rootDir, packageDir);
  const manifest = await readJson(join(absoluteDir, "package.json"));
  publicManifests.set(manifest.name, { ...manifest, packageDir, absoluteDir });

  run("pnpm", [
    "--filter",
    manifest.name,
    "pack",
    "--pack-destination",
    outputDir,
  ]);
  const file = tarballName(manifest.name, manifest.version);
  const bytes = await readFile(join(outputDir, file));
  packages.push({
    name: manifest.name,
    version: manifest.version,
    file,
    byteLength: bytes.byteLength,
    sha256: sha256(bytes),
    integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
  });
}

packages.sort(compareNamed);
const versions = new Set(packages.map(({ version }) => version));
if (versions.size !== 1) {
  throw new Error(
    `Public package versions disagree: ${[...versions].sort().join(", ")}`,
  );
}

const releaseVersion = packages[0]?.version;
if (!releaseVersion) throw new Error("No public packages were packed.");

const changelog = await readFile(join(rootDir, "CHANGELOG.md"), "utf8");
if (!changelog.includes(`## ${releaseVersion} —`)) {
  throw new Error(`CHANGELOG.md has no ${releaseVersion} release heading.`);
}

const dependencyEvidence = await collectLockedDependencyEvidence(
  packages,
  publicManifests,
);
const installEvidence = await verifyTarballInstall(
  packages,
  dependencyEvidence.externalVersions,
  dependencyEvidence.unavailableOnCurrentPlatform,
);

const sbomFile = "release.cdx.json";
await writeJson(
  join(outputDir, sbomFile),
  createReleaseSbom({
    packages,
    releaseVersion,
    gitCommit,
    gitTimestamp,
    lockfileSha256,
    ...dependencyEvidence,
  }),
);

const licensesFile = "release-licenses.json";
await writeJson(join(outputDir, licensesFile), {
  format: "dojo-video-engine.release-licenses",
  version: 1,
  releaseVersion,
  gitCommit,
  lockfileSha256,
  source: "frozen pnpm production graph verified by exact-tarball install",
  packages: [...dependencyEvidence.components.values()]
    .map(({ name, version, license, publicRoot }) => ({
      name,
      version,
      license,
      publicRoot,
    }))
    .sort(compareNamed),
});

const auditFile = "release-audit.json";
await writeJson(join(outputDir, auditFile), {
  format: "dojo-video-engine.release-audit",
  version: 1,
  releaseVersion,
  gitCommit,
  lockfileSha256,
  source:
    "npm audit of the exact local tarballs with external versions constrained to the frozen pnpm production graph",
  installedPackages: installEvidence.installedPackages,
  metadata: installEvidence.audit.metadata,
  vulnerabilities: installEvidence.audit.vulnerabilities,
});

const evidence = {};
for (const [key, file] of [
  ["sbom", sbomFile],
  ["licenses", licensesFile],
  ["audit", auditFile],
]) {
  evidence[key] = await fileEvidence(file);
}

const manifest = {
  format: "dojo-video-engine.release-manifest",
  version: 2,
  releaseVersion,
  gitCommit,
  node: process.version,
  packageManager: rootManifest.packageManager,
  lockfile: {
    file: "pnpm-lock.yaml",
    byteLength: lockfileBytes.byteLength,
    sha256: lockfileSha256,
  },
  ...evidence,
  packages,
};
const manifestFile = "release-manifest.json";
await writeJson(join(outputDir, manifestFile), manifest);

const checksumEntries = [
  ...packages.map(({ file, sha256: hash }) => ({ file, sha256: hash })),
  ...Object.values(evidence),
  manifest.lockfile,
  await fileEvidence(manifestFile),
].sort((left, right) => left.file.localeCompare(right.file));
await writeFile(
  join(outputDir, "SHA256SUMS"),
  `${checksumEntries.map(({ sha256: hash, file }) => `${hash}  ${file}`).join("\n")}\n`,
);

console.log(
  `Packed and verified ${packages.length} DojoVideoEngine ${releaseVersion} packages in ${outputDir}`,
);

async function collectLockedDependencyEvidence(packed, manifests) {
  const components = new Map();
  const dependencyEdges = new Map();
  const roots = [];

  for (const item of packed) {
    const manifest = manifests.get(item.name);
    const component = await componentFromPackage({
      name: item.name,
      version: item.version,
      path: manifest.absoluteDir,
      publicRoot: true,
      tarballSha256: item.sha256,
    });
    components.set(component.ref, component);
    roots.push(component.ref);
    dependencyEdges.set(component.ref, new Set());
  }

  for (const item of packed) {
    const listed = JSON.parse(
      runText("pnpm", [
        "list",
        "--filter",
        item.name,
        "--prod",
        "--json",
        "--depth",
        "Infinity",
      ]),
    )[0];
    const rootRef = packageRef(item.name, item.version);
    await visitDependencies(listed?.dependencies ?? {}, rootRef, new Set());
  }

  const versionsByExternalName = new Map();
  for (const component of components.values()) {
    if (component.publicRoot) continue;
    const known = versionsByExternalName.get(component.name) ?? new Set();
    known.add(component.version);
    versionsByExternalName.set(component.name, known);
  }
  const externalVersions = {};
  const unavailableOnCurrentPlatform = new Set();
  for (const [name, known] of versionsByExternalName) {
    if (known.size !== 1) {
      throw new Error(
        `Release graph has multiple production versions for ${name}: ${[
          ...known,
        ].join(", ")}`,
      );
    }
    externalVersions[name] = [...known][0];
    const component = components.get(packageRef(name, externalVersions[name]));
    if (component?.platformCompatible === false) {
      unavailableOnCurrentPlatform.add(name);
    }
  }

  return {
    components,
    dependencyEdges,
    roots: roots.sort(),
    externalVersions,
    unavailableOnCurrentPlatform,
  };

  async function visitDependencies(dependencies, parentRef, ancestors) {
    const runtimeNames = new Set(
      components.get(parentRef)?.runtimeDependencyNames ?? [],
    );
    for (const [name, dependency] of Object.entries(dependencies)
      .filter(([candidate]) => runtimeNames.has(candidate))
      .sort(([a], [b]) => a.localeCompare(b))) {
      const publicManifest = manifests.get(name);
      const version = publicManifest?.version ?? dependency.version;
      if (
        !version ||
        version.startsWith("link:") ||
        version.startsWith("file:")
      ) {
        throw new Error(
          `Cannot resolve locked production version for ${name}.`,
        );
      }
      const ref = packageRef(name, version);
      if (!components.has(ref)) {
        components.set(
          ref,
          await componentFromPackage({
            name,
            version,
            path: dependency.path ?? publicManifest?.absoluteDir,
            publicRoot: Boolean(publicManifest),
          }),
        );
      }
      if (!dependencyEdges.has(parentRef))
        dependencyEdges.set(parentRef, new Set());
      dependencyEdges.get(parentRef).add(ref);
      if (!dependencyEdges.has(ref)) dependencyEdges.set(ref, new Set());

      const edgeKey = `${parentRef}->${ref}`;
      if (ancestors.has(edgeKey)) continue;
      const nextAncestors = new Set(ancestors).add(edgeKey);
      await visitDependencies(
        dependency.dependencies ?? {},
        ref,
        nextAncestors,
      );
    }
  }
}

async function componentFromPackage({
  name,
  version,
  path,
  publicRoot,
  tarballSha256,
}) {
  let packageManifest = {};
  let packageManifestFound = false;
  if (path) {
    try {
      packageManifest = await readJson(join(path, "package.json"));
      packageManifestFound = true;
    } catch {
      packageManifest = {};
    }
  }
  const license = packageManifestFound
    ? normalizeLicense(packageManifest.license)
    : await registryLicense(name, version);
  if (license === "UNKNOWN") {
    throw new Error(`Production dependency ${name}@${version} has no license.`);
  }
  return {
    ref: packageRef(name, version),
    name,
    version,
    license,
    publicRoot,
    tarballSha256,
    platformCompatible:
      packageManifestFound && isPlatformCompatible(packageManifest),
    runtimeDependencyNames: [
      ...new Set([
        ...Object.keys(packageManifest.dependencies ?? {}),
        ...Object.keys(packageManifest.optionalDependencies ?? {}),
      ]),
    ].sort(),
  };
}

async function registryLicense(name, version) {
  const key = `${name}@${version}`;
  if (!registryLicenseCache.has(key)) {
    registryLicenseCache.set(
      key,
      Promise.resolve().then(() => {
        try {
          return normalizeLicense(
            JSON.parse(runText("npm", ["view", key, "license", "--json"])),
          );
        } catch {
          return "UNKNOWN";
        }
      }),
    );
  }
  return await registryLicenseCache.get(key);
}

async function verifyTarballInstall(
  packed,
  externalVersions,
  unavailableOnCurrentPlatform,
) {
  const temporary = await mkdtemp(
    join(tmpdir(), "dojo-video-engine-release-verify-"),
  );
  try {
    await writeJson(join(temporary, "package.json"), {
      name: "dojo-video-engine-release-verifier",
      version: "0.0.0",
      private: true,
      dependencies: Object.fromEntries(
        packed.map(({ name, file }) => [name, `file:${join(outputDir, file)}`]),
      ),
      overrides: externalVersions,
    });
    run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: temporary,
    });

    const listed = JSON.parse(
      runText("npm", ["ls", "--omit=dev", "--all", "--json"], {
        cwd: temporary,
      }),
    );
    const installed = collectInstalledVersions(listed.dependencies ?? {});
    const expected = new Map([
      ...packed.map(({ name, version }) => [name, version]),
      ...Object.entries(externalVersions),
    ]);
    for (const [name, version] of expected) {
      const actual = installed.get(name);
      if (!actual && unavailableOnCurrentPlatform.has(name)) continue;
      if (!actual?.has(version)) {
        throw new Error(
          `Exact tarball install is missing ${name}@${version}; found ${
            [...(actual ?? [])].join(", ") || "nothing"
          }.`,
        );
      }
    }
    for (const [name, versions] of installed) {
      const expectedVersion = expected.get(name);
      if (
        !expectedVersion ||
        versions.size !== 1 ||
        !versions.has(expectedVersion)
      ) {
        throw new Error(
          `Exact tarball graph drifted at ${name}: expected ${
            expectedVersion ?? "no package"
          }, installed ${[...versions].join(", ")}.`,
        );
      }
    }

    const auditResult = spawnSync(
      "npm",
      ["audit", "--omit=dev", "--audit-level=high", "--json"],
      {
        cwd: temporary,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      },
    );
    if (auditResult.error) throw auditResult.error;
    const audit = JSON.parse(auditResult.stdout || "{}");
    if (auditResult.status !== 0) {
      throw new Error(
        `Exact tarball production audit failed: ${JSON.stringify(
          audit.metadata?.vulnerabilities ?? audit.error ?? audit,
        )}`,
      );
    }

    return {
      installedPackages: [...installed.entries()]
        .flatMap(([name, versions]) =>
          [...versions].map((version) => ({ name, version })),
        )
        .sort(compareNamed),
      audit,
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

function collectInstalledVersions(dependencies, target = new Map()) {
  for (const [name, dependency] of Object.entries(dependencies)) {
    if (!dependency?.version) continue;
    const versions = target.get(name) ?? new Set();
    versions.add(dependency.version);
    target.set(name, versions);
    collectInstalledVersions(dependency.dependencies ?? {}, target);
  }
  return target;
}

function createReleaseSbom({
  packages: packed,
  releaseVersion: version,
  gitCommit: commit,
  gitTimestamp: timestamp,
  lockfileSha256: lockHash,
  components,
  dependencyEdges,
  roots,
}) {
  const releaseRef = `pkg:generic/dojo-video-engine-release-set@${version}`;
  const packageHashByRef = new Map(
    packed.map((item) => [packageRef(item.name, item.version), item.sha256]),
  );
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {
      timestamp,
      tools: {
        components: [
          {
            type: "application",
            name: "dojo-video-engine-release-bundler",
            version: "1",
          },
        ],
      },
      component: {
        type: "application",
        name: "dojo-video-engine-release-set",
        version,
        "bom-ref": releaseRef,
        properties: [
          { name: "dojo-video-engine:gitCommit", value: commit },
          { name: "dojo-video-engine:pnpmLockSha256", value: lockHash },
        ],
      },
    },
    components: [...components.values()]
      .sort(compareNamed)
      .map((component) => ({
        type: "library",
        group: component.name.startsWith("@")
          ? component.name.slice(1).split("/")[0]
          : undefined,
        name: component.name.startsWith("@")
          ? component.name.split("/")[1]
          : component.name,
        version: component.version,
        "bom-ref": component.ref,
        purl: component.ref,
        hashes: packageHashByRef.has(component.ref)
          ? [{ alg: "SHA-256", content: packageHashByRef.get(component.ref) }]
          : undefined,
        licenses:
          component.license === "UNKNOWN"
            ? undefined
            : [{ expression: component.license }],
        properties: [
          {
            name: "dojo-video-engine:publicReleaseRoot",
            value: String(component.publicRoot),
          },
          {
            name: "dojo-video-engine:currentPlatformCompatible",
            value: String(component.platformCompatible),
          },
        ],
      })),
    dependencies: [
      { ref: releaseRef, dependsOn: roots },
      ...[...components.values()].sort(compareNamed).map((component) => ({
        ref: component.ref,
        dependsOn: [...(dependencyEdges.get(component.ref) ?? [])].sort(),
      })),
    ],
  };
}

async function ensureEmptyOutput(directory) {
  try {
    const info = await stat(directory);
    if (!info.isDirectory())
      throw new Error("Release output is not a directory.");
    const entries = await readdir(directory);
    if (entries.length > 0) {
      throw new Error("Release output directory must be empty.");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await mkdir(directory, { recursive: true });
  }
}

async function fileEvidence(file) {
  const bytes = await readFile(join(outputDir, file));
  return { file, byteLength: bytes.byteLength, sha256: sha256(bytes) };
}

function packageRef(name, version) {
  const encodedName = encodeURIComponent(name).replaceAll("%2F", "/");
  return `pkg:npm/${encodedName}@${version}`;
}

function normalizeLicense(license) {
  if (typeof license === "string" && license.trim()) return license.trim();
  if (license && typeof license.type === "string") return license.type;
  return "UNKNOWN";
}

function isPlatformCompatible(packageManifest) {
  return (
    matchesPlatformList(packageManifest.os, process.platform) &&
    matchesPlatformList(packageManifest.cpu, process.arch)
  );
}

function matchesPlatformList(rule, current) {
  if (!Array.isArray(rule) || rule.length === 0) return true;
  const denied = rule.some((value) => value === `!${current}`);
  if (denied) return false;
  const allowed = rule.filter((value) => !value.startsWith("!"));
  return allowed.length === 0 || allowed.includes(current);
}

function tarballName(name, version) {
  const normalized = name.startsWith("@")
    ? name.slice(1).replace("/", "-")
    : name;
  return `${normalized}-${version}.tgz`;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareNamed(left, right) {
  return (
    left.name.localeCompare(right.name) ||
    String(left.version).localeCompare(String(right.version))
  );
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd ?? rootDir,
    stdio: "inherit",
  });
}

function runText(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? rootDir,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
}
