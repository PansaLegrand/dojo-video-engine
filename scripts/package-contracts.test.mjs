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
  assert.ok(publicPackageDirectories.includes("packages/create-motionforge"));
});

const packageEntry = (name, dependencies = {}, extra = {}) => ({
  packageDir: `/workspace/packages/${name.replace(/^@motionforge\//, "")}`,
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
    name === "@motionforge/core"
      ? packageEntry(name, { "@motionforge/schema": "workspace:*" })
      : packageEntry(name),
  );
  assert.deepEqual(validateWorkspaceGraph(packages), []);
});

test("dependency checks reject an unapproved edge and a cycle", () => {
  const packages = [
    packageEntry("@motionforge/schema", {
      "@motionforge/core": "workspace:*",
    }),
    packageEntry("@motionforge/core", {
      "@motionforge/schema": "workspace:*",
    }),
  ];
  const errors = validateWorkspaceGraph(packages).join("\n");
  assert.match(errors, /not allowed to depend on @motionforge\/core/);
  assert.match(errors, /dependency cycle/);
});

test("dependency checks include the unscoped create-motionforge package", () => {
  const packages = [
    packageEntry("@motionforge/core"),
    packageEntry("create-motionforge", {
      "@motionforge/core": "^1.0.0",
    }),
  ];
  const errors = validateWorkspaceGraph(packages).join("\n");
  assert.match(errors, /must use workspace:\*/);
  assert.match(
    errors,
    /create-motionforge is not allowed to depend on @motionforge\/core/,
  );
});

test("source checks reject product frameworks and undeclared package imports", () => {
  const manifest = packageEntry("@motionforge/core").manifest;
  const schema = packageEntry("@motionforge/schema").manifest;
  const errors = validateSourceContract({
    source:
      'import next from "next/server"; import { parseScene } from "@motionforge/schema";',
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
  const manifest = packageEntry("@motionforge/core").manifest;
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
  const manifest = packageEntry("@motionforge/core", {
    "@motionforge/schema": "workspace:*",
  }).manifest;
  const schema = packageEntry("@motionforge/schema").manifest;
  const errors = validateSourceContract({
    source:
      'import "../../schema/src/index.js"; import "@motionforge/schema/private";',
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

test("source checks resolve unscoped workspace package entry points", () => {
  const manifest = packageEntry("@motionforge/core", {
    "create-motionforge": "workspace:*",
  }).manifest;
  const starter = packageEntry("create-motionforge").manifest;
  const errors = validateSourceContract({
    source: 'import "create-motionforge/private";',
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
  const manifest = packageEntry("@motionforge/core").manifest;
  const packageManifests = new Map([[manifest.name, manifest]]);
  const errors = validateSourceContract({
    source: [
      'import "left-pad";',
      'import "@motionforge/core/private";',
      'type Private = typeof import("@motionforge/core/private");',
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
    "@motionforge/core",
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
  const entry = packageEntry("@motionforge/schema");
  const baseline = {
    schemaVersion: 1,
    packages: {
      "@motionforge/schema": {
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
