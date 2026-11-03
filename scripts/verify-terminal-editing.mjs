// Registry-only consumer acceptance. Never invokes a model or paid provider.
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { publicPackageDirectories } from "./public-package-policy.mjs";

const packSource = process.argv.includes("--pack-source");
const root = fileURLToPath(new URL("..", import.meta.url));

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
if (packSource) {
  const packs = join(directory, "packs");
  await mkdir(packs);
  const manifest = JSON.parse(
    await readFile(join(directory, "package.json"), "utf8"),
  );
  // Override only internal engine identities to retained candidate tarballs.
  // External media dependencies resolve from their actual published constraints.
  manifest.pnpm = { overrides: {} };
  for (const packageDir of publicPackageDirectories) {
    const candidate = JSON.parse(
      await readFile(join(root, packageDir, "package.json"), "utf8"),
    );
    const packed = spawnSync(
      "pnpm",
      ["--filter", candidate.name, "pack", "--pack-destination", packs],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(packed.status, 0, packed.stderr);
    const tarball = `file:./packs/${candidate.name.slice(1).replace("/", "-")}-${candidate.version}.tgz`;
    manifest.pnpm.overrides[candidate.name] = tarball;
    if (manifest.dependencies[candidate.name])
      manifest.dependencies[candidate.name] = tarball;
  }
  assert.equal(manifest.pnpm.overrides.mediabunny, undefined);
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify(manifest, null, 2),
  );
  await rm(join(directory, "pnpm-lock.yaml"));
  run(["install", "--ignore-workspace", "--no-frozen-lockfile"]);
  const lock = await readFile(join(directory, "pnpm-lock.yaml"), "utf8");
  assert.deepEqual(
    [
      ...new Set(
        [...lock.matchAll(/mediabunny@([^:\s]+):/g)].map((match) => match[1]),
      ),
    ],
    [
      JSON.parse(
        await readFile(join(root, "packages/export/package.json"), "utf8"),
      ).dependencies.mediabunny,
    ],
  );
} else {
  run(["install", "--ignore-workspace", "--frozen-lockfile"]);
}
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
