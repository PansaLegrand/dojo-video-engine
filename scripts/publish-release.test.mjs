import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
  copyFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertReleaseGitContext,
  loadAndVerifyReleaseBundle,
  publishVerifiedRelease,
  sha256,
  sha512Integrity,
  temporaryReleaseTag,
  validateReleaseManifest,
} from "./publish-release.mjs";

const commit = "a".repeat(40);
const temporaryPaths = [];

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("release bundle validation", () => {
  it("verifies manifest v2, exact files, tar identities, evidence, and checksums", async () => {
    const fixture = await releaseFixture();
    const result = await loadAndVerifyReleaseBundle({
      directory: fixture.directory,
      expectedVersion: "1.1.0",
      expectedPackageNames: fixture.names,
    });

    expect(result.manifest).toMatchObject({
      version: 2,
      releaseVersion: "1.1.0",
      gitCommit: commit,
    });
    expect(result.packages.map(({ name }) => name)).toEqual(fixture.names);
  });

  it("rejects tampering, packed identity mismatches, workspace specs, and absolute SBOM paths", async () => {
    const tampered = await releaseFixture();
    await writeFile(tampered.packagePaths[0], "tampered");
    await expect(
      loadAndVerifyReleaseBundle({
        directory: tampered.directory,
        expectedPackageNames: tampered.names,
      }),
    ).rejects.toThrow(/sha256|byte length/);

    const wrongIdentity = await releaseFixture({
      packedName: "@dojo-video-engine/wrong",
    });
    await expect(
      loadAndVerifyReleaseBundle({
        directory: wrongIdentity.directory,
        expectedPackageNames: wrongIdentity.names,
      }),
    ).rejects.toThrow(/contains @dojo-video-engine\/wrong/);

    const workspace = await releaseFixture({ workspaceDependency: true });
    await expect(
      loadAndVerifyReleaseBundle({
        directory: workspace.directory,
        expectedPackageNames: workspace.names,
      }),
    ).rejects.toThrow(/not publishable/);

    const absoluteSbom = await releaseFixture({ absoluteSbom: true });
    await expect(
      loadAndVerifyReleaseBundle({
        directory: absoluteSbom.directory,
        expectedPackageNames: absoluteSbom.names,
      }),
    ).rejects.toThrow(/absolute file URL/);
  });

  it("rejects unknown manifest fields, package-set drift, and noncanonical SRI", () => {
    const manifest = baseManifest([]);
    manifest.unexpected = true;
    expect(() => validateReleaseManifest(manifest, [])).toThrow(
      /keys must be exactly/,
    );

    const entry = packageEvidence(
      "@dojo-video-engine/alpha",
      Buffer.from("alpha"),
    );
    const withPackage = baseManifest([entry]);
    expect(() =>
      validateReleaseManifest(withPackage, ["@dojo-video-engine/beta"]),
    ).toThrow(/package set mismatch/);
    withPackage.packages[0].integrity = "sha256-not-sri";
    expect(() => validateReleaseManifest(withPackage)).toThrow(/sha512 SRI/);
  });
});

describe("release Git context", () => {
  it("requires the exact version tag, HEAD, tag commit, and workflow ref", () => {
    const manifest = baseManifest([]);
    expect(() =>
      assertReleaseGitContext({
        manifest,
        currentCommit: commit,
        tagCommit: commit,
        expectedTag: "v1.1.0",
        githubSha: commit,
        githubRef: "refs/tags/v1.1.0",
      }),
    ).not.toThrow();
    expect(() =>
      assertReleaseGitContext({
        manifest,
        currentCommit: "b".repeat(40),
        tagCommit: commit,
        expectedTag: "v1.1.0",
      }),
    ).toThrow(/current HEAD/);
    expect(() =>
      assertReleaseGitContext({
        manifest,
        currentCommit: commit,
        tagCommit: commit,
        expectedTag: "v1.1.1",
      }),
    ).toThrow(/does not match/);
  });
});

describe("staged registry publication", () => {
  it("skips identical versions, stages only missing tarballs, then promotes the complete set", async () => {
    const bundle = publicationBundle();
    const registry = new FakeRegistry({
      "@dojo-video-engine/alpha": {
        integrity: bundle.packages[0].integrity,
        tags: { latest: "1.0.0" },
      },
    });

    const result = await publishVerifiedRelease(bundle, registry);
    expect(result).toMatchObject({
      temporaryTag: "dojo-video-engine-1-1-0-candidate",
      published: ["@dojo-video-engine/beta"],
      skipped: ["@dojo-video-engine/alpha"],
      promoted: ["@dojo-video-engine/alpha", "@dojo-video-engine/beta"],
    });
    expect(registry.calls.filter(({ kind }) => kind === "publish")).toEqual([
      {
        kind: "publish",
        name: "@dojo-video-engine/beta",
        tag: "dojo-video-engine-1-1-0-candidate",
      },
    ]);
    expect(registry.records.get("@dojo-video-engine/alpha").tags).toEqual({
      latest: "1.1.0",
    });
    expect(registry.records.get("@dojo-video-engine/beta").tags).toEqual({
      latest: "1.1.0",
    });
  });

  it("is a no-op when every immutable version and latest tag already match", async () => {
    const bundle = publicationBundle();
    const registry = new FakeRegistry(
      Object.fromEntries(
        bundle.packages.map((entry) => [
          entry.name,
          { integrity: entry.integrity, tags: { latest: entry.version } },
        ]),
      ),
    );
    const result = await publishVerifiedRelease(bundle, registry);
    expect(result.published).toEqual([]);
    expect(result.promoted).toEqual([]);
    expect(registry.calls).toEqual([]);

    const temporaryTag = temporaryReleaseTag("1.1.0");
    const cleanup = new FakeRegistry(
      Object.fromEntries(
        bundle.packages.map((entry, index) => [
          entry.name,
          {
            integrity: entry.integrity,
            tags: {
              latest: entry.version,
              ...(index === 0 ? { [temporaryTag]: entry.version } : {}),
            },
          },
        ]),
      ),
    );
    await publishVerifiedRelease(bundle, cleanup);
    expect(cleanup.calls).toEqual([
      {
        kind: "removeTag",
        name: "@dojo-video-engine/alpha",
        tag: temporaryTag,
      },
    ]);
  });

  it("fails before mutation on differing immutable content or a newer latest", async () => {
    const bundle = publicationBundle();
    const different = new FakeRegistry({
      "@dojo-video-engine/alpha": {
        integrity: "sha512-ZGlmZmVyZW50",
        tags: { latest: "1.0.0" },
      },
    });
    await expect(publishVerifiedRelease(bundle, different)).rejects.toThrow(
      /different registry integrity/,
    );
    expect(different.calls).toEqual([]);

    const newer = new FakeRegistry({
      "@dojo-video-engine/alpha": {
        integrity: bundle.packages[0].integrity,
        tags: { latest: "2.0.0" },
      },
    });
    await expect(publishVerifiedRelease(bundle, newer)).rejects.toThrow(
      /refusing to downgrade/,
    );
    expect(newer.calls).toEqual([]);

    const temporaryTag = temporaryReleaseTag("1.1.0");
    const conflictingStage = new FakeRegistry({
      "@dojo-video-engine/alpha": {
        integrity: bundle.packages[0].integrity,
        tags: { latest: "1.0.0", [temporaryTag]: "1.0.0" },
      },
    });
    await expect(
      publishVerifiedRelease(bundle, conflictingStage),
    ).rejects.toThrow(/temporary tag.*unexpected/);
    expect(conflictingStage.calls).toEqual([]);
  });

  it("resumes a partial staged publish without exposing an incomplete latest set", async () => {
    const bundle = publicationBundle();
    const registry = new FakeRegistry();
    const publish = registry.publish.bind(registry);
    registry.publish = async (entry, tag) => {
      if (entry.name === "@dojo-video-engine/beta") {
        throw new Error("simulated registry outage");
      }
      await publish(entry, tag);
    };

    await expect(publishVerifiedRelease(bundle, registry)).rejects.toThrow(
      /simulated registry outage/,
    );
    expect(registry.records.get("@dojo-video-engine/alpha").tags).toEqual({
      "dojo-video-engine-1-1-0-candidate": "1.1.0",
    });
    expect(
      registry.records.get("@dojo-video-engine/alpha").tags.latest,
    ).toBeUndefined();

    registry.publish = publish;
    const result = await publishVerifiedRelease(bundle, registry);
    expect(result.published).toEqual(["@dojo-video-engine/beta"]);
    expect(result.skipped).toEqual(["@dojo-video-engine/alpha"]);
    expect(registry.records.get("@dojo-video-engine/alpha").tags).toEqual({
      latest: "1.1.0",
    });
    expect(registry.records.get("@dojo-video-engine/beta").tags).toEqual({
      latest: "1.1.0",
    });
  });

  it("uses a deterministic non-SemVer temporary tag", () => {
    expect(temporaryReleaseTag("1.1.0")).toBe(
      "dojo-video-engine-1-1-0-candidate",
    );
    expect(() => temporaryReleaseTag("1.1.0-beta.1")).toThrow(
      /stable canonical/,
    );
  });
});

class FakeRegistry {
  constructor(records = {}) {
    this.records = new Map(
      Object.entries(records).map(([name, value]) => [
        name,
        { integrity: value.integrity, tags: { ...value.tags } },
      ]),
    );
    this.calls = [];
  }

  async getIntegrity(name) {
    return this.records.get(name)?.integrity ?? null;
  }

  async getTags(name) {
    return { ...(this.records.get(name)?.tags ?? {}) };
  }

  async publish(entry, tag) {
    this.calls.push({ kind: "publish", name: entry.name, tag });
    this.records.set(entry.name, {
      integrity: entry.integrity,
      tags: { [tag]: entry.version },
    });
  }

  async setTag(name, version, tag) {
    this.calls.push({ kind: "setTag", name, version, tag });
    const record = this.records.get(name);
    if (!record) throw new Error(`Missing fake package ${name}.`);
    record.tags[tag] = version;
  }

  async removeTag(name, tag) {
    this.calls.push({ kind: "removeTag", name, tag });
    const record = this.records.get(name);
    if (record) delete record.tags[tag];
  }
}

function publicationBundle() {
  const packages = ["alpha", "beta"].map((suffix) => ({
    name: `@dojo-video-engine/${suffix}`,
    version: "1.1.0",
    file: `dojo-video-engine-${suffix}-1.1.0.tgz`,
    path: `/release/dojo-video-engine-${suffix}-1.1.0.tgz`,
    byteLength: suffix.length,
    sha256: "a".repeat(64),
    integrity: sha512Integrity(Buffer.from(suffix)),
  }));
  return { manifest: baseManifest(packages), packages };
}

async function releaseFixture(options = {}) {
  const directory = await mkdtemp(
    join(tmpdir(), "dojo-video-engine-publish-test-"),
  );
  temporaryPaths.push(directory);
  const names = ["@dojo-video-engine/alpha", "@dojo-video-engine/beta"];
  const packagePaths = [];
  const packageEntries = [];
  for (const [index, name] of names.entries()) {
    const packedName =
      index === 0 && options.packedName ? options.packedName : name;
    const dependencies =
      index === 0 && options.workspaceDependency
        ? { "@dojo-video-engine/beta": "workspace:*" }
        : index === 0
          ? { "@dojo-video-engine/beta": "1.1.0" }
          : {};
    const path = await createTarball(directory, name, {
      name: packedName,
      version: "1.1.0",
      publishConfig: { access: "public" },
      dependencies,
    });
    packagePaths.push(path);
    packageEntries.push(packageEvidence(name, await readFile(path)));
  }

  const lockfile = Buffer.from("lockfileVersion: '9.0'\n");
  const identity = {
    version: 1,
    releaseVersion: "1.1.0",
    gitCommit: commit,
    lockfileSha256: sha256(lockfile),
  };
  const files = {
    "pnpm-lock.yaml": lockfile,
    "release.cdx.json": Buffer.from(
      `${JSON.stringify({
        bomFormat: "CycloneDX",
        specVersion: "1.6",
        metadata: {
          component: {
            version: "1.1.0",
            properties: [
              { name: "dojo-video-engine:gitCommit", value: commit },
              {
                name: "dojo-video-engine:pnpmLockSha256",
                value: identity.lockfileSha256,
              },
            ],
          },
        },
        externalReferences: options.absoluteSbom
          ? [{ type: "distribution", url: "file:/tmp/private/package.tgz" }]
          : [],
      })}\n`,
    ),
    "release-licenses.json": Buffer.from(
      `${JSON.stringify({
        format: "dojo-video-engine.release-licenses",
        ...identity,
        packages: [{ name: "zod", version: "3.25.76", license: "MIT" }],
      })}\n`,
    ),
    "release-audit.json": Buffer.from(
      `${JSON.stringify({
        format: "dojo-video-engine.release-audit",
        ...identity,
        metadata: { vulnerabilities: { high: 0, critical: 0 } },
      })}\n`,
    ),
  };
  for (const [file, bytes] of Object.entries(files)) {
    await writeFile(join(directory, file), bytes);
  }

  const manifest = baseManifest(packageEntries, files);
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(directory, "release-manifest.json"), manifestBytes);
  const checksumEntries = [
    ["release-manifest.json", manifestBytes],
    ...Object.entries(files),
    ...packageEntries.map((entry, index) => [entry.file, null, index]),
  ];
  const lines = [];
  for (const [file, bytes, packageIndex] of checksumEntries) {
    const content = bytes ?? (await readFile(packagePaths[packageIndex]));
    lines.push(`${sha256(content)}  ${file}`);
  }
  await writeFile(
    join(directory, "SHA256SUMS"),
    `${lines.sort().join("\n")}\n`,
  );
  return { directory, names, packagePaths };
}

function baseManifest(packages, files = {}) {
  const evidence = (file) => {
    const bytes = files[file] ?? Buffer.from("{}");
    return { file, byteLength: bytes.byteLength, sha256: sha256(bytes) };
  };
  const lockfile = files["pnpm-lock.yaml"] ?? Buffer.from("lock");
  return {
    format: "dojo-video-engine.release-manifest",
    version: 2,
    releaseVersion: "1.1.0",
    gitCommit: commit,
    node: "v24.0.0",
    packageManager: "pnpm@10.34.5",
    lockfile: {
      file: "pnpm-lock.yaml",
      byteLength: lockfile.byteLength,
      sha256: sha256(lockfile),
    },
    sbom: evidence("release.cdx.json"),
    licenses: evidence("release-licenses.json"),
    audit: evidence("release-audit.json"),
    packages,
  };
}

function packageEvidence(name, bytes) {
  return {
    name,
    version: "1.1.0",
    file: `${name.slice(1).replace("/", "-")}-1.1.0.tgz`,
    byteLength: bytes.byteLength,
    sha256: sha256(bytes),
    integrity: sha512Integrity(bytes),
  };
}

async function createTarball(directory, releaseName, manifest) {
  const source = await mkdtemp(
    join(tmpdir(), "dojo-video-engine-package-test-"),
  );
  temporaryPaths.push(source);
  const packageDirectory = join(source, "package");
  await mkdir(packageDirectory);
  await writeFile(
    join(packageDirectory, "package.json"),
    `${JSON.stringify(manifest)}\n`,
  );
  const file = `${releaseName.slice(1).replace("/", "-")}-1.1.0.tgz`;
  const path = join(directory, file);
  execFileSync("tar", ["-czf", path, "-C", source, "package"]);
  return path;
}

it("loads the publisher without workspace dependencies on a clean release runner", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dojo-publisher-standalone-"));
  temporaryPaths.push(directory);
  const scripts = join(directory, "scripts");
  await mkdir(scripts);
  for (const name of ["publish-release.mjs", "public-package-policy.mjs"])
    await copyFile(
      fileURLToPath(new URL(name, import.meta.url)),
      join(scripts, name),
    );
  const url = pathToFileURL(join(scripts, "publish-release.mjs")).href;
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const m = await import(${JSON.stringify(url)}); console.log(typeof m.loadAndVerifyReleaseBundle)`,
    ],
    { cwd: directory, encoding: "utf8" },
  );
  expect(output.trim()).toBe("function");
});
