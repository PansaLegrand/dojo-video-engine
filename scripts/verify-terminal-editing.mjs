// Registry-only consumer acceptance. Never invokes a model or paid provider.
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const directory = await mkdtemp(join(tmpdir(), "dojo-terminal-editing-"));
await cp(
  fileURLToPath(new URL("../examples/terminal-editing/", import.meta.url)),
  directory,
  { recursive: true },
);
console.log(
  `Isolated registry consumer (retained on success or failure): ${directory}`,
);
function run(args, failure = false) {
  const result = spawnSync("pnpm", args, {
    cwd: directory,
    encoding: "utf8",
    timeout: 180_000,
  });
  if (result.error) throw result.error;
  if (result.signal)
    throw new Error(`pnpm ${args.join(" ")} terminated: ${result.signal}`);
  if (failure) assert.notEqual(result.status, 0, "invalid input must fail");
  else {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    assert.equal(result.status, 0, `pnpm ${args.join(" ")} failed`);
  }
  return result;
}
run(["install", "--ignore-workspace", "--frozen-lockfile"]);
run(["exec", "playwright", "install", "--only-shell", "chromium"]);
run(["fixtures"]);
run(["author"]);
run(["validate"]);
const inspection = run([
  "exec",
  "dojo-video-engine",
  "check",
  "scene.json",
  "--sample-count",
  "5",
]);
await writeFile(join(directory, "inspection.json"), inspection.stdout);
run(["render"]);
run(["verify"]);
// A fresh process reopens the saved scene, preserving source clocks and audio.
run(["render"]);
run(["verify"]);
const missing = JSON.parse(
  await readFile(join(directory, "scene.json"), "utf8"),
);
missing.assets.a.src = "/missing.mp4";
await writeFile(join(directory, "missing.json"), JSON.stringify(missing));
const missingResult = run(["render", "missing.json", "missing-output"], true);
assert.match(missingResult.stderr, /ENOENT/);
await writeFile(join(directory, "invalid.json"), '{"schemaVersion":99}');
const invalidResult = run(["render", "invalid.json", "invalid-output"], true);
await writeFile(
  join(directory, "output/negative-checks.json"),
  JSON.stringify(
    {
      missingAssetRejected: missingResult.status !== 0,
      invalidSceneRejected: invalidResult.status !== 0,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Terminal editing acceptance passed. MP4, preview images and evidence: ${directory}/output`,
);
