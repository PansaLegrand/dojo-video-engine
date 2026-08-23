#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrateScene } from "../packages/schema/dist/index.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const legacyDir = join(rootDir, "fixtures/migrations/v0");
const currentDir = join(rootDir, "fixtures/migrations/v1");
const fixtureNames = (await readdir(legacyDir))
  .filter((name) => name.endsWith(".json"))
  .sort();

if (fixtureNames.length === 0) {
  throw new Error("No Scene v0 migration fixtures found.");
}

for (const fixtureName of fixtureNames) {
  const legacy = JSON.parse(
    await readFile(join(legacyDir, fixtureName), "utf8"),
  );
  const expected = JSON.parse(
    await readFile(join(currentDir, fixtureName), "utf8"),
  );
  const legacySnapshot = structuredClone(legacy);
  const migrated = migrateScene(legacy);
  const expectedMigration = migrateScene(expected);

  if (
    JSON.stringify(migrated.scene) !== JSON.stringify(expectedMigration.scene)
  ) {
    throw new Error(
      `${fixtureName}: migrated Scene v1 does not match fixture.`,
    );
  }
  if (JSON.stringify(legacy) !== JSON.stringify(legacySnapshot)) {
    throw new Error(`${fixtureName}: migration mutated the legacy input.`);
  }

  const repeated = migrateScene(legacy);
  if (repeated.scene !== migrated.scene || repeated.fromVersion !== 0) {
    throw new Error(`${fixtureName}: repeated v0 migration is not stable.`);
  }

  const current = expectedMigration;
  if (
    current.fromVersion !== 1 ||
    current.scene.schemaVersion !== 1 ||
    current.migrations.length !== 0
  ) {
    throw new Error(
      `${fixtureName}: canonical v1 migration is not idempotent.`,
    );
  }

  console.log(`migration fixture ok: ${fixtureName}`);
}
