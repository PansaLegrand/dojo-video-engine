#!/usr/bin/env node

import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { publicPackagePolicy } from "./public-package-policy.mjs";

const execFileAsync = promisify(execFile);
const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseManifestFile = "release-manifest.json";
const checksumFile = "SHA256SUMS";
const packageNamePattern = /^@dojo-video-engine\/[a-z0-9][a-z0-9._-]{0,190}$/;
const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const gitCommitPattern = /^[a-f0-9]{40}$/;
const sha512IntegrityPattern = /^sha512-[A-Za-z0-9+/]+={0,2}$/;
const safeFilePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const maximumReleaseFileBytes = 1024 * 1024 * 1024;
const maximumManifestBytes = 2 * 1024 * 1024;

/**
 * Loads a v2 release bundle, verifies every retained byte, and checks packed
 * package identity before any registry operation is allowed.
 */
export async function loadAndVerifyReleaseBundle(options) {
  const directory = resolve(options.directory);
  const directoryInfo = await lstat(directory);
  if (!directoryInfo.isDirectory()) {
    throw new Error("Release bundle path must be a directory.");
  }

  const manifestPath = join(directory, releaseManifestFile);
  const manifestBytes = await readRegularFile(
    manifestPath,
    releaseManifestFile,
  );
  if (manifestBytes.byteLength > maximumManifestBytes) {
    throw new Error("Release manifest exceeds the 2 MiB safety limit.");
  }
  const manifest = parseJson(manifestBytes, releaseManifestFile);
  validateReleaseManifest(manifest, options.expectedPackageNames);
  if (
    options.expectedVersion !== undefined &&
    manifest.releaseVersion !== options.expectedVersion
  ) {
    throw new Error(
      `Release manifest version ${manifest.releaseVersion} does not match requested ${options.expectedVersion}.`,
    );
  }

  const packages = [];
  for (const entry of manifest.packages) {
    const path = join(directory, entry.file);
    const bytes = await readRegularFile(path, entry.file);
    assertFileEvidence(entry, bytes, { integrity: true });
    const packedManifest = readPackedPackageManifest(path);
    validatePackedPackageManifest(
      packedManifest,
      entry,
      options.expectedPackageNames,
    );
    packages.push({ ...entry, path });
  }

  const evidenceEntries = [manifest.sbom, manifest.licenses, manifest.audit];
  for (const entry of evidenceEntries) {
    const bytes = await readRegularFile(
      join(directory, entry.file),
      entry.file,
    );
    assertFileEvidence(entry, bytes);
  }
  const lockfileBytes = await readRegularFile(
    join(directory, manifest.lockfile.file),
    manifest.lockfile.file,
  );
  assertFileEvidence(manifest.lockfile, lockfileBytes);

  const sbom = parseJson(
    await readFile(join(directory, manifest.sbom.file)),
    manifest.sbom.file,
  );
  if (sbom.bomFormat !== "CycloneDX" || typeof sbom.specVersion !== "string") {
    throw new Error("Release SBOM must be a CycloneDX document.");
  }
  assertNoAbsoluteFileReferences(sbom);
  assertSbomIdentity(sbom, manifest);

  const licenses = parseJson(
    await readFile(join(directory, manifest.licenses.file)),
    manifest.licenses.file,
  );
  assertLicenseEvidence(licenses, manifest);
  const audit = parseJson(
    await readFile(join(directory, manifest.audit.file)),
    manifest.audit.file,
  );
  assertAuditAllowsRelease(audit, manifest);

  const checksumBytes = await readRegularFile(
    join(directory, checksumFile),
    checksumFile,
  );
  if (checksumBytes.byteLength > maximumManifestBytes) {
    throw new Error("SHA256SUMS exceeds the 2 MiB safety limit.");
  }
  const checksums = parseChecksumFile(checksumBytes.toString("utf8"));
  const expectedChecksumFiles = [
    releaseManifestFile,
    manifest.lockfile.file,
    manifest.sbom.file,
    manifest.licenses.file,
    manifest.audit.file,
    ...manifest.packages.map(({ file }) => file),
  ].sort(compareStrings);
  if (
    !sameStrings(
      [...checksums.keys()].sort(compareStrings),
      expectedChecksumFiles,
    )
  ) {
    throw new Error(
      `SHA256SUMS must cover exactly: ${expectedChecksumFiles.join(", ")}.`,
    );
  }
  for (const [file, expectedHash] of checksums) {
    const bytes =
      file === releaseManifestFile
        ? manifestBytes
        : await readRegularFile(join(directory, file), file);
    assertSha256(expectedHash, bytes, file);
  }

  const extraTarballs = (await readdir(directory))
    .filter((file) => file.endsWith(".tgz"))
    .filter((file) => !manifest.packages.some((entry) => entry.file === file));
  if (extraTarballs.length > 0) {
    throw new Error(
      `Release directory contains unlisted tarballs: ${extraTarballs.sort(compareStrings).join(", ")}.`,
    );
  }

  return {
    directory,
    manifest,
    packages,
  };
}

/** Strict structural validation for `dojo-video-engine.release-manifest` v2. */
export function validateReleaseManifest(value, expectedPackageNames) {
  assertRecord(value, "Release manifest");
  assertExactKeys(
    value,
    [
      "audit",
      "format",
      "gitCommit",
      "licenses",
      "lockfile",
      "node",
      "packageManager",
      "packages",
      "releaseVersion",
      "sbom",
      "version",
    ],
    "Release manifest",
  );
  if (value.format !== "dojo-video-engine.release-manifest" || value.version !== 2) {
    throw new Error(
      "Release manifest must use dojo-video-engine.release-manifest v2.",
    );
  }
  assertStableVersion(value.releaseVersion, "releaseVersion");
  if (
    typeof value.node !== "string" ||
    value.node.length < 1 ||
    value.node.length > 64
  ) {
    throw new Error("Release manifest node must be a bounded version string.");
  }
  if (
    typeof value.packageManager !== "string" ||
    value.packageManager.length < 1 ||
    value.packageManager.length > 128
  ) {
    throw new Error(
      "Release manifest packageManager must be a bounded string.",
    );
  }
  if (
    typeof value.gitCommit !== "string" ||
    !gitCommitPattern.test(value.gitCommit)
  ) {
    throw new Error(
      "Release manifest gitCommit must be a lowercase 40-byte SHA.",
    );
  }

  validateLockfileEvidence(value.lockfile);
  validateFileEvidence(value.sbom, "sbom");
  validateFileEvidence(value.licenses, "licenses");
  validateFileEvidence(value.audit, "audit");
  if (value.lockfile.file !== "pnpm-lock.yaml") {
    throw new Error("Release lockfile evidence must be pnpm-lock.yaml.");
  }
  if (value.sbom.file !== "release.cdx.json") {
    throw new Error("Release SBOM evidence must be release.cdx.json.");
  }
  if (value.licenses.file !== "release-licenses.json") {
    throw new Error("Release license evidence must be release-licenses.json.");
  }
  if (value.audit.file !== "release-audit.json") {
    throw new Error("Release audit evidence must be release-audit.json.");
  }

  if (
    !Array.isArray(value.packages) ||
    value.packages.length < 1 ||
    value.packages.length > 128
  ) {
    throw new Error("Release manifest packages must contain 1..128 entries.");
  }
  const names = new Set();
  const files = new Set([
    value.lockfile.file,
    value.sbom.file,
    value.licenses.file,
    value.audit.file,
    releaseManifestFile,
    checksumFile,
  ]);
  for (const entry of value.packages) {
    assertRecord(entry, "Release package");
    assertExactKeys(
      entry,
      ["byteLength", "file", "integrity", "name", "sha256", "version"],
      "Release package",
    );
    if (
      typeof entry.name !== "string" ||
      !packageNamePattern.test(entry.name)
    ) {
      throw new Error(
        `Invalid release package name ${JSON.stringify(entry.name)}.`,
      );
    }
    if (names.has(entry.name)) {
      throw new Error(`Duplicate release package ${entry.name}.`);
    }
    names.add(entry.name);
    if (entry.version !== value.releaseVersion) {
      throw new Error(
        `${entry.name} version ${String(entry.version)} does not match ${value.releaseVersion}.`,
      );
    }
    assertSafeFileName(entry.file, `${entry.name} file`);
    const expectedFile = tarballName(entry.name, entry.version);
    if (entry.file !== expectedFile) {
      throw new Error(`${entry.name} tarball must be named ${expectedFile}.`);
    }
    if (files.has(entry.file)) {
      throw new Error(`Duplicate release file ${entry.file}.`);
    }
    files.add(entry.file);
    assertByteLength(entry.byteLength, `${entry.name} byteLength`);
    if (typeof entry.sha256 !== "string" || !sha256Pattern.test(entry.sha256)) {
      throw new Error(`${entry.name} sha256 is invalid.`);
    }
    if (
      typeof entry.integrity !== "string" ||
      !sha512IntegrityPattern.test(entry.integrity)
    ) {
      throw new Error(`${entry.name} integrity must be canonical sha512 SRI.`);
    }
  }

  if (expectedPackageNames !== undefined) {
    const expected = [...expectedPackageNames].sort(compareStrings);
    const actual = [...names].sort(compareStrings);
    if (!sameStrings(actual, expected)) {
      throw new Error(
        `Release package set mismatch; expected ${expected.join(", ")}, found ${actual.join(", ")}.`,
      );
    }
  }
}

/** Verifies the explicit tag and workflow ref resolve to the manifest commit. */
export function assertReleaseGitContext(options) {
  const { manifest, currentCommit, tagCommit, expectedTag } = options;
  if (expectedTag !== `v${manifest.releaseVersion}`) {
    throw new Error(
      `Release tag ${expectedTag} does not match v${manifest.releaseVersion}.`,
    );
  }
  for (const [label, commit] of [
    ["current HEAD", currentCommit],
    [expectedTag, tagCommit],
  ]) {
    if (typeof commit !== "string" || !gitCommitPattern.test(commit)) {
      throw new Error(`${label} is not a canonical Git commit SHA.`);
    }
    if (commit !== manifest.gitCommit) {
      throw new Error(
        `${label} ${commit} does not match release commit ${manifest.gitCommit}.`,
      );
    }
  }
  if (
    options.githubSha !== undefined &&
    options.githubSha !== manifest.gitCommit
  ) {
    throw new Error("GITHUB_SHA does not match the release manifest commit.");
  }
  if (
    options.githubRef !== undefined &&
    options.githubRef !== `refs/tags/${expectedTag}`
  ) {
    throw new Error(`GITHUB_REF must be refs/tags/${expectedTag}.`);
  }
}

/** A deterministic npm dist-tag that cannot be parsed as a SemVer version. */
export function temporaryReleaseTag(version) {
  assertStableVersion(version, "release version");
  return `dojo-video-engine-${version.replaceAll(".", "-")}-candidate`;
}

/**
 * Executes a resumable staged publication. No `latest` tag moves until every
 * immutable package version exists with the expected registry integrity.
 */
export async function publishVerifiedRelease(bundle, registry) {
  const version = bundle.manifest.releaseVersion;
  const temporaryTag = temporaryReleaseTag(version);
  const states = await Promise.all(
    bundle.packages.map(async (entry) => ({
      entry,
      integrity: await registry.getIntegrity(entry.name, entry.version),
      tags: await registry.getTags(entry.name),
    })),
  );

  for (const { entry, integrity, tags } of states) {
    if (integrity !== null && integrity !== entry.integrity) {
      throw new Error(
        `${entry.name}@${entry.version} already exists with different registry integrity.`,
      );
    }
    const latest = tags.latest;
    if (latest !== undefined) {
      assertStableVersion(latest, `${entry.name} latest tag`);
      if (compareStableVersions(latest, version) > 0) {
        throw new Error(
          `${entry.name} latest ${latest} is newer than ${version}; refusing to downgrade.`,
        );
      }
    }
    const staged = tags[temporaryTag];
    if (staged !== undefined && staged !== version) {
      throw new Error(
        `${entry.name} temporary tag ${temporaryTag} points to unexpected ${staged}.`,
      );
    }
  }

  const alreadyComplete = states.every(
    ({ integrity, tags, entry }) =>
      integrity === entry.integrity && tags.latest === entry.version,
  );
  if (alreadyComplete) {
    await removeTemporaryTags(bundle.packages, registry, temporaryTag);
    return {
      temporaryTag,
      published: [],
      skipped: bundle.packages.map(({ name }) => name),
      promoted: [],
    };
  }

  const published = [];
  const skipped = [];
  for (const { entry, integrity } of states) {
    if (integrity === entry.integrity) {
      skipped.push(entry.name);
      continue;
    }
    await registry.publish(entry, temporaryTag);
    published.push(entry.name);
  }

  await verifyRegistryIntegrity(bundle.packages, registry);

  for (const entry of bundle.packages) {
    const tags = await registry.getTags(entry.name);
    if (tags[temporaryTag] !== entry.version) {
      await registry.setTag(entry.name, entry.version, temporaryTag);
    }
  }
  await verifyRegistryTags(bundle.packages, registry, temporaryTag);

  const promoted = [];
  for (const entry of bundle.packages) {
    const tags = await registry.getTags(entry.name);
    if (tags.latest !== entry.version) {
      await registry.setTag(entry.name, entry.version, "latest");
      promoted.push(entry.name);
    }
  }
  await verifyRegistryTags(bundle.packages, registry, "latest");

  await removeTemporaryTags(bundle.packages, registry, temporaryTag);

  return { temporaryTag, published, skipped, promoted };
}

/** npm CLI adapter used only by the protected release workflow. */
export function createNpmRegistryAdapter() {
  return {
    async getIntegrity(name, version) {
      const result = await runNpmJson(
        ["view", `${name}@${version}`, "dist.integrity", "--json"],
        { allowNotFound: true },
      );
      if (result === null) return null;
      if (typeof result !== "string" || !sha512IntegrityPattern.test(result)) {
        throw new Error(
          `${name}@${version} returned invalid registry integrity.`,
        );
      }
      return result;
    },
    async getTags(name) {
      const result = await runNpmJson(["dist-tag", "ls", name, "--json"], {
        allowNotFound: true,
      });
      if (result === null) return {};
      assertRecord(result, `${name} registry tags`);
      const tags = {};
      for (const [key, value] of Object.entries(result)) {
        if (
          !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(key) ||
          typeof value !== "string" ||
          value.length > 128
        ) {
          throw new Error(`${name} returned an invalid registry dist-tag.`);
        }
        tags[key] = value;
      }
      return tags;
    },
    async publish(entry, tag) {
      await runNpmMutation([
        "publish",
        entry.path,
        "--access",
        "public",
        "--provenance",
        "--tag",
        tag,
      ]);
    },
    async setTag(name, version, tag) {
      await runNpmMutation(["dist-tag", "add", `${name}@${version}`, tag]);
    },
    async removeTag(name, tag) {
      await runNpmMutation(["dist-tag", "rm", name, tag]);
    },
  };
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha512Integrity(bytes) {
  return `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
}

export function compareStableVersions(left, right) {
  const leftParts = parseStableVersion(left);
  const rightParts = parseStableVersion(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index] - rightParts[index];
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}

async function verifyRegistryIntegrity(entries, registry) {
  for (const entry of entries) {
    const integrity = await registry.getIntegrity(entry.name, entry.version);
    if (integrity !== entry.integrity) {
      throw new Error(
        `${entry.name}@${entry.version} did not verify after staged publication.`,
      );
    }
  }
}

async function verifyRegistryTags(entries, registry, tag) {
  for (const entry of entries) {
    const tags = await registry.getTags(entry.name);
    if (tags[tag] !== entry.version) {
      throw new Error(
        `${entry.name} dist-tag ${tag} did not resolve to ${entry.version}.`,
      );
    }
  }
}

async function removeTemporaryTags(entries, registry, tag) {
  for (const entry of entries) {
    const tags = await registry.getTags(entry.name);
    if (tags[tag] === entry.version) {
      await registry.removeTag(entry.name, tag);
    }
  }
  for (const entry of entries) {
    const tags = await registry.getTags(entry.name);
    if (Object.hasOwn(tags, tag)) {
      throw new Error(`${entry.name} retained temporary tag ${tag}.`);
    }
  }
}

function validatePackedPackageManifest(value, entry, expectedPackageNames) {
  assertRecord(value, `${entry.name} packed package.json`);
  if (value.name !== entry.name || value.version !== entry.version) {
    throw new Error(
      `${entry.file} contains ${String(value.name)}@${String(value.version)}, expected ${entry.name}@${entry.version}.`,
    );
  }
  if (value.private === true) {
    throw new Error(`${entry.name} packed package must not be private.`);
  }
  if (value.publishConfig?.access !== "public") {
    throw new Error(`${entry.name} packed package must declare public access.`);
  }
  const publicNames = new Set(expectedPackageNames ?? []);
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    const dependencies = value[field];
    if (dependencies === undefined) continue;
    assertRecord(dependencies, `${entry.name} ${field}`);
    for (const [name, specifier] of Object.entries(dependencies)) {
      if (typeof specifier !== "string" || specifier.startsWith("workspace:")) {
        throw new Error(`${entry.name} ${field}.${name} is not publishable.`);
      }
      if (publicNames.has(name) && specifier !== entry.version) {
        throw new Error(
          `${entry.name} ${field}.${name} must be exact ${entry.version}, found ${specifier}.`,
        );
      }
    }
  }
}

function readPackedPackageManifest(path) {
  let output;
  try {
    output = execFileSync("tar", ["-xOf", path, "package/package.json"], {
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(
      `Cannot read package/package.json from ${basename(path)}.`,
      {
        cause: error,
      },
    );
  }
  return parseJson(Buffer.from(output), `${basename(path)} package.json`);
}

function validateLockfileEvidence(value) {
  assertRecord(value, "Release lockfile evidence");
  assertExactKeys(
    value,
    ["byteLength", "file", "sha256"],
    "Release lockfile evidence",
  );
  assertSafeFileName(value.file, "lockfile file");
  assertByteLength(value.byteLength, "lockfile byteLength");
  if (typeof value.sha256 !== "string" || !sha256Pattern.test(value.sha256)) {
    throw new Error("Release lockfile sha256 is invalid.");
  }
}

function validateFileEvidence(value, label) {
  assertRecord(value, `Release ${label} evidence`);
  assertExactKeys(
    value,
    ["byteLength", "file", "sha256"],
    `Release ${label} evidence`,
  );
  assertSafeFileName(value.file, `${label} file`);
  assertByteLength(value.byteLength, `${label} byteLength`);
  if (typeof value.sha256 !== "string" || !sha256Pattern.test(value.sha256)) {
    throw new Error(`Release ${label} sha256 is invalid.`);
  }
}

function assertFileEvidence(entry, bytes, options = {}) {
  if (bytes.byteLength !== entry.byteLength) {
    throw new Error(
      `${entry.file} byte length ${bytes.byteLength} does not match ${entry.byteLength}.`,
    );
  }
  assertSha256(entry.sha256, bytes, entry.file);
  if (options.integrity && sha512Integrity(bytes) !== entry.integrity) {
    throw new Error(
      `${entry.file} sha512 integrity does not match its manifest.`,
    );
  }
}

function assertSha256(expected, bytes, file) {
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new Error(`${file} sha256 ${actual} does not match ${expected}.`);
  }
}

function assertAuditAllowsRelease(value, manifest) {
  assertRecord(value, "Release audit");
  assertEvidenceIdentity(
    value,
    manifest,
    "dojo-video-engine.release-audit",
    "Release audit",
  );
  const vulnerabilities = value.metadata?.vulnerabilities;
  assertRecord(vulnerabilities, "Release audit vulnerability metadata");
  for (const severity of ["high", "critical"]) {
    if (vulnerabilities[severity] !== 0) {
      throw new Error(
        `Release audit reports ${String(vulnerabilities[severity])} ${severity} vulnerabilities.`,
      );
    }
  }
}

function assertLicenseEvidence(value, manifest) {
  assertEvidenceIdentity(
    value,
    manifest,
    "dojo-video-engine.release-licenses",
    "Release license evidence",
  );
  if (!Array.isArray(value.packages) || value.packages.length < 1) {
    throw new Error("Release license evidence must list production packages.");
  }
  for (const entry of value.packages) {
    assertRecord(entry, "Release license package");
    if (
      typeof entry.name !== "string" ||
      typeof entry.version !== "string" ||
      typeof entry.license !== "string" ||
      !entry.license.trim()
    ) {
      throw new Error(
        "Release license evidence contains an invalid package license.",
      );
    }
  }
}

function assertEvidenceIdentity(value, manifest, format, label) {
  if (
    value.format !== format ||
    value.version !== 1 ||
    value.releaseVersion !== manifest.releaseVersion ||
    value.gitCommit !== manifest.gitCommit ||
    value.lockfileSha256 !== manifest.lockfile.sha256
  ) {
    throw new Error(`${label} does not match the release manifest identity.`);
  }
}

function assertSbomIdentity(value, manifest) {
  const component = value.metadata?.component;
  assertRecord(component, "Release SBOM metadata component");
  if (component.version !== manifest.releaseVersion) {
    throw new Error(
      "Release SBOM version does not match the release manifest.",
    );
  }
  const properties = Array.isArray(component.properties)
    ? new Map(
        component.properties.flatMap((entry) =>
          entry &&
          typeof entry.name === "string" &&
          typeof entry.value === "string"
            ? [[entry.name, entry.value]]
            : [],
        ),
      )
    : new Map();
  if (
    properties.get("dojo-video-engine:gitCommit") !== manifest.gitCommit ||
    properties.get("dojo-video-engine:pnpmLockSha256") !== manifest.lockfile.sha256
  ) {
    throw new Error(
      "Release SBOM provenance does not match the release manifest.",
    );
  }
}

function assertNoAbsoluteFileReferences(value) {
  if (typeof value === "string") {
    if (/^file:\//.test(value)) {
      throw new Error("Release SBOM contains an absolute file URL.");
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(assertNoAbsoluteFileReferences);
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(assertNoAbsoluteFileReferences);
  }
}

function parseChecksumFile(source) {
  const output = new Map();
  for (const line of source.split(/\r?\n/)) {
    if (!line) continue;
    const match =
      /^([a-f0-9]{64})\s+\*?([A-Za-z0-9][A-Za-z0-9._-]{0,199})$/.exec(line);
    if (!match)
      throw new Error(`Invalid SHA256SUMS line ${JSON.stringify(line)}.`);
    const [, hash, file] = match;
    if (output.has(file)) throw new Error(`SHA256SUMS repeats ${file}.`);
    output.set(file, hash);
  }
  if (output.size < 1) throw new Error("SHA256SUMS is empty.");
  return output;
}

async function readRegularFile(path, label) {
  const info = await lstat(path).catch((error) => {
    throw new Error(`Release file ${label} is missing.`, { cause: error });
  });
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`Release file ${label} must be a regular file.`);
  }
  if (info.size > maximumReleaseFileBytes) {
    throw new Error(`Release file ${label} exceeds the 1 GiB safety limit.`);
  }
  return readFile(path);
}

function parseJson(bytes, label) {
  try {
    const value = JSON.parse(bytes.toString("utf8"));
    assertRecord(value, label);
    return value;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${label} must be valid JSON.`, { cause: error });
    }
    throw error;
  }
}

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort(compareStrings);
  const expected = [...keys].sort(compareStrings);
  if (!sameStrings(actual, expected)) {
    throw new Error(`${label} keys must be exactly ${expected.join(", ")}.`);
  }
}

function assertSafeFileName(value, label) {
  if (typeof value !== "string" || !safeFilePattern.test(value)) {
    throw new Error(`${label} must be a safe basename.`);
  }
}

function assertByteLength(value, label) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximumReleaseFileBytes
  ) {
    throw new Error(`${label} must be an integer from 1 through 1 GiB.`);
  }
}

function assertStableVersion(value, label) {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !stableVersionPattern.test(value) ||
    value.split(".").some((part) => !Number.isSafeInteger(Number(part)))
  ) {
    throw new Error(`${label} must be a stable canonical SemVer version.`);
  }
}

function parseStableVersion(value) {
  assertStableVersion(value, "version");
  return value.split(".").map(Number);
}

function tarballName(name, version) {
  return `${name.slice(1).replace("/", "-")}-${version}.tgz`;
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameStrings(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

async function runNpmJson(args, options = {}) {
  try {
    const { stdout } = await execFileAsync("npm", args, {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      env: process.env,
    });
    return JSON.parse(stdout);
  } catch (error) {
    const detail = `${error?.stdout ?? ""}\n${error?.stderr ?? ""}`;
    if (options.allowNotFound && /(?:E404|404 Not Found)/.test(detail)) {
      return null;
    }
    throw new Error(`npm ${args.join(" ")} failed.`, { cause: error });
  }
}

async function runNpmMutation(args) {
  try {
    const { stdout, stderr } = await execFileAsync("npm", args, {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      env: process.env,
    });
    if (stdout.trim()) process.stdout.write(stdout);
    if (stderr.trim()) process.stderr.write(stderr);
  } catch (error) {
    throw new Error(`npm ${args.join(" ")} failed.`, { cause: error });
  }
}

async function main() {
  const directory = process.argv[2];
  const mode = process.argv[3] ?? process.env.RELEASE_TAG;
  if (!directory || !mode) {
    throw new Error(
      "Usage: node scripts/publish-release.mjs <release-directory> <exact-tag|--verify-only>",
    );
  }
  if (!process.env.RELEASE_VERSION) {
    throw new Error("RELEASE_VERSION is required for release verification.");
  }
  const expectedPackageNames =
    Object.keys(publicPackagePolicy).sort(compareStrings);
  const bundle = await loadAndVerifyReleaseBundle({
    directory,
    expectedVersion: process.env.RELEASE_VERSION,
    expectedPackageNames,
  });
  if (mode === "--verify-only") {
    console.log(
      `Verified DojoVideoEngine ${bundle.manifest.releaseVersion} bundle (${bundle.packages.length} packages).`,
    );
    return;
  }
  const expectedTag = mode;
  if (process.env.GITHUB_ACTIONS !== "true") {
    throw new Error("Registry publication is restricted to GitHub Actions.");
  }
  if (!process.env.GITHUB_SHA || !process.env.GITHUB_REF) {
    throw new Error("GITHUB_SHA and GITHUB_REF are required for publication.");
  }
  if (expectedTag !== `v${bundle.manifest.releaseVersion}`) {
    throw new Error(
      `Release tag ${expectedTag} does not match v${bundle.manifest.releaseVersion}.`,
    );
  }
  const currentCommit = runGit(["rev-parse", "HEAD"]);
  const tagCommit = runGit(["rev-parse", `refs/tags/${expectedTag}^{commit}`]);
  assertReleaseGitContext({
    manifest: bundle.manifest,
    currentCommit,
    tagCommit,
    expectedTag,
    githubSha: process.env.GITHUB_SHA,
    githubRef: process.env.GITHUB_REF,
  });

  const result = await publishVerifiedRelease(
    bundle,
    createNpmRegistryAdapter(),
  );
  console.log(
    `DojoVideoEngine ${bundle.manifest.releaseVersion} registry verified: ` +
      `${result.published.length} published, ${result.skipped.length} reused, ` +
      `${result.promoted.length} latest tag(s) promoted.`,
  );
}

function runGit(args) {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  }).trim();
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  await main();
}
