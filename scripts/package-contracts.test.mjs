import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizePublicSurface,
  publicPackageDirectories,
  publicPackagePolicy,
  validateEntrypointBaseline,
  validateSourceContract,
  validateWorkspaceGraph,
} from "./package-contracts.mjs";

test("release package directories derive from every public package owner", () => {
  assert.equal(
    publicPackageDirectories.length,
    Object.keys(publicPackagePolicy).length,
  );
  assert.ok(publicPackageDirectories.includes("packages/commands"));
  assert.ok(publicPackageDirectories.includes("packages/create-dojo-video-engine"));
});

const packageEntry = (name, dependencies = {}, extra = {}) => ({
  packageDir: `/workspace/packages/${name.replace(/^@dojo-video-engine\//, "")}`,
  manifest: {
    name,
    version: "1.0.0",
    dependencies,
    exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
    ...extra,
  },
});

test("a minimal accepted graph has no forbidden edge or cycle", () => {
  const packages = Object.keys(publicPackagePolicy).map((name) =>
    name === "@dojo-video-engine/core"
      ? packageEntry(name, { "@dojo-video-engine/schema": "workspace:*" })
      : packageEntry(name),
  );
  assert.deepEqual(validateWorkspaceGraph(packages), []);
});

test("dependency checks reject an unapproved edge and a cycle", () => {
  const packages = [
    packageEntry("@dojo-video-engine/schema", {
      "@dojo-video-engine/core": "workspace:*",
    }),
    packageEntry("@dojo-video-engine/core", {
      "@dojo-video-engine/schema": "workspace:*",
    }),
  ];
  const errors = validateWorkspaceGraph(packages).join("\n");
  assert.match(errors, /not allowed to depend on @dojo-video-engine\/core/);
  assert.match(errors, /dependency cycle/);
});

test("dependency checks include the scoped starter package", () => {
  const packages = [
    packageEntry("@dojo-video-engine/core"),
    packageEntry("@dojo-video-engine/create", {
      "@dojo-video-engine/core": "^1.0.0",
    }),
  ];
  const errors = validateWorkspaceGraph(packages).join("\n");
  assert.match(errors, /must use workspace:\*/);
  assert.match(
    errors,
    /@dojo-video-engine\/create is not allowed to depend on @dojo-video-engine\/core/,
  );
});

test("source checks reject product frameworks and undeclared package imports", () => {
  const manifest = packageEntry("@dojo-video-engine/core").manifest;
  const schema = packageEntry("@dojo-video-engine/schema").manifest;
  const errors = validateSourceContract({
    source:
      'import next from "next/server"; import { parseScene } from "@dojo-video-engine/schema";',
    sourceFile: "/workspace/packages/core/src/index.ts",
    packageDir: "/workspace/packages/core",
    manifest,
    packageManifests: new Map([
      [manifest.name, manifest],
      [schema.name, schema],
    ]),
  }).join("\n");
  assert.match(errors, /application frameworks/);
  assert.match(errors, /undeclared runtime dependency/);
});

test("source checks reject CommonJS and cloud/data provider escapes", () => {
  const manifest = packageEntry("@dojo-video-engine/core").manifest;
  const errors = validateSourceContract({
    source:
      'const queue = require("bullmq"); import { S3Client } from "@aws-sdk/client-s3";',
    sourceFile: "/workspace/packages/core/src/index.ts",
    packageDir: "/workspace/packages/core",
    manifest,
    packageManifests: new Map([[manifest.name, manifest]]),
  }).join("\n");
  assert.match(errors, /application queues/);
  assert.match(errors, /cloud provider SDKs/);
});

test("source checks reject relative boundary escapes and unexported subpaths", () => {
  const manifest = packageEntry("@dojo-video-engine/core", {
    "@dojo-video-engine/schema": "workspace:*",
  }).manifest;
  const schema = packageEntry("@dojo-video-engine/schema").manifest;
  const errors = validateSourceContract({
    source:
      'import "../../schema/src/index.js"; import "@dojo-video-engine/schema/private";',
    sourceFile: "/workspace/packages/core/src/index.ts",
    packageDir: "/workspace/packages/core",
    manifest,
    packageManifests: new Map([
      [manifest.name, manifest],
      [schema.name, schema],
    ]),
  }).join("\n");
  assert.match(errors, /crosses its package boundary/);
  assert.match(errors, /non-public entry point/);
});

test("source checks resolve scoped starter package entry points", () => {
  const manifest = packageEntry("@dojo-video-engine/core", {
    "@dojo-video-engine/create": "workspace:*",
  }).manifest;
  const starter = packageEntry("@dojo-video-engine/create").manifest;
  const errors = validateSourceContract({
    source: 'import "@dojo-video-engine/create/private";',
    sourceFile: "/workspace/packages/core/src/index.ts",
    packageDir: "/workspace/packages/core",
    manifest,
    packageManifests: new Map([
      [manifest.name, manifest],
      [starter.name, starter],
    ]),
  }).join("\n");
  assert.match(errors, /non-public entry point/);
});

test("source checks close external, self-subpath, import-type, and JSX bypasses", () => {
  const manifest = packageEntry("@dojo-video-engine/core").manifest;
  const packageManifests = new Map([[manifest.name, manifest]]);
  const errors = validateSourceContract({
    source: [
      'import "left-pad";',
      'import "@dojo-video-engine/core/private";',
      'type Private = typeof import("@dojo-video-engine/core/private");',
      'import "ai/react";',
    ].join("\n"),
    sourceFile: "/workspace/packages/core/src/component.jsx",
    packageDir: "/workspace/packages/core",
    manifest,
    packageManifests,
  }).join("\n");

  assert.match(errors, /undeclared runtime dependency "left-pad"/);
  assert.equal(errors.match(/non-public self entry point/g)?.length, 2);
  assert.match(errors, /model-provider SDKs dependency "ai\/react"/);
});

test("test sources may use declared dev dependencies on Windows paths", () => {
  const manifest = packageEntry(
    "@dojo-video-engine/core",
    {},
    {
      devDependencies: { vitest: "^3.2.4" },
    },
  ).manifest;
  assert.deepEqual(
    validateSourceContract({
      source: 'import { describe } from "vitest";',
      sourceFile: "C:\\workspace\\packages\\core\\src\\index.test.ts",
      packageDir: "C:\\workspace\\packages\\core",
      manifest,
      packageManifests: new Map([[manifest.name, manifest]]),
    }),
    [],
  );
});

test("entrypoint checks require deliberate baseline updates", () => {
  const entry = packageEntry("@dojo-video-engine/schema");
  const baseline = {
    schemaVersion: 1,
    packages: {
      "@dojo-video-engine/schema": {
        owner: "Canonical Scene contract",
        stability: "stable",
        ...normalizePublicSurface(entry.manifest),
      },
    },
  };
  assert.deepEqual(validateEntrypointBaseline([entry], baseline), []);

  entry.manifest.exports["./private"] = {
    types: "./dist/private.d.ts",
    import: "./dist/private.js",
  };
  assert.match(
    validateEntrypointBaseline([entry], baseline).join("\n"),
    /public entry points changed/,
  );
});
