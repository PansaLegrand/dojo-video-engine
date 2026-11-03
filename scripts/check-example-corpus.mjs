#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { migrateScene, validateScene } from "../packages/schema/dist/index.js";

const root = resolve(new URL("..", import.meta.url).pathname);
const files = [];
for (const directory of ["examples", "verification", "fixtures/migrations"]) {
  await collectJson(resolve(root, directory), files);
}
for (const name of await readdir(resolve(root, "fixtures"))) {
  if (name.endsWith(".json")) files.push(resolve(root, "fixtures", name));
}
files.sort();
const failures = [];
for (const path of files) {
  const displayPath = relative(root, path);
  const value = JSON.parse(await readFile(path, "utf8"));
  const result = validateScene(value);
  if (!result.ok) {
    failures.push(`${displayPath}: ${result.errors.join("; ")}`);
    continue;
  }
  const migrated = migrateScene(value);
  if (migrated.scene.schemaVersion !== 1) {
    failures.push(`${displayPath}: did not normalize to Scene v1`);
  }
}
if (failures.length > 0) {
  throw new Error(`example corpus failures:\n${failures.join("\n")}`);
}
console.log(`example corpus ok (${files.length} canonical/migratable scenes)`);

async function collectJson(directory, into) {
  // This directory is an independently installed consumer, not a Scene corpus.
  // Its package.json and generated reports are checked by verify:terminal.
  if (directory === resolve(root, "examples/terminal-editing")) return;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collectJson(path, into);
    else if (entry.isFile() && entry.name.endsWith(".json")) into.push(path);
  }
}
