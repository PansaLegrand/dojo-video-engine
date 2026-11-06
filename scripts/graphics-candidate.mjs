/** Explicit local qualification only. Never publishes or changes consumer release pins. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  cp,
  rename,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const consumerIndex = process.argv.indexOf("--consumer");
const consumer =
  consumerIndex >= 0
    ? path.resolve(process.argv[consumerIndex + 1] ?? "")
    : null;
if (consumerIndex >= 0 && !process.argv[consumerIndex + 1])
  throw new Error("--consumer requires a web or harness checkout path.");
const out = path.join(root, "test-results/graphics-candidate");
await mkdir(out, { recursive: true });
const names = ["extensions", "interchange", "three"];
const packages = [];
for (const name of names) {
  execFileSync("pnpm", ["--filter", `@dojo-video-engine/${name}`, "build"], {
    cwd: root,
    stdio: "inherit",
  });
  execFileSync(
    "pnpm",
    [
      "--filter",
      `@dojo-video-engine/${name}`,
      "pack",
      "--pack-destination",
      out,
    ],
    { cwd: root, stdio: "inherit" },
  );
  const manifest = JSON.parse(
    await readFile(path.join(root, "packages", name, "package.json"), "utf8"),
  );
  const file = `dojo-video-engine-${name}-${manifest.version}.tgz`;
  const sha256 = createHash("sha256")
    .update(await readFile(path.join(out, file)))
    .digest("hex");
  packages.push({
    name: manifest.name,
    version: manifest.version,
    file,
    sha256,
  });
}
const manifest = {
  status: "unpublished-source-candidate",
  baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  packages,
};
await writeFile(
  path.join(out, "graphics-candidate.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(`Unpublished graphics candidate: ${out}`);
if (consumer) {
  const release = JSON.parse(
    await readFile(path.join(consumer, "config/engine-release.json"), "utf8"),
  );
  if (packages.some((pkg) => pkg.version !== release.engineVersion))
    throw new Error(
      "Candidate baseline must match the consumer's installed engine release. Use the full release qualification path for version upgrades.",
    );
  const stage = await mkdtemp(path.join(tmpdir(), "dojo-graphics-packaged-"));
  await writeFile(
    path.join(stage, "package.json"),
    JSON.stringify(
      {
        private: true,
        dependencies: {
          ...Object.fromEntries(
            packages.map((pkg) => [
              pkg.name,
              `file:${path.join(out, pkg.file)}`,
            ]),
          ),
          three: "0.187.0",
          saxes: "6.0.0",
          xmlchars: "2.2.0",
        },
      },
      null,
      2,
    ),
  );
  execFileSync(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: stage, stdio: "inherit" },
  );
  const install = [
    ...packages.map((pkg) => pkg.name),
    "three",
    "saxes",
    "xmlchars",
  ];
  // Preserve the exact previous installation for rollback. No sibling source aliases.
  const backup = path.join(stage, "previous-consumer-packages");
  const replacements = [];
  try {
    for (const name of install) {
      const destination = path.join(consumer, "node_modules", name);
      const old = path.join(backup, name);
      const replacement = path.join(stage, "prepared", name);
      await mkdir(path.dirname(old), { recursive: true });
      await cp(path.join(stage, "node_modules", name), replacement, {
        recursive: true,
      });
      let previous = false;
      try {
        await stat(destination);
        await rename(destination, old);
        previous = true;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      replacements.push({ destination, old, previous, installed: false });
      await rename(replacement, destination);
      replacements.at(-1).installed = true;
    }
  } catch (error) {
    for (const [index, entry] of replacements.reverse().entries()) {
      if (entry.installed)
        await rename(
          entry.destination,
          path.join(stage, `rolled-back-${index}`),
        );
      if (entry.previous) await rename(entry.old, entry.destination);
    }
    throw error;
  }
  const receipt = out;
  await mkdir(receipt, { recursive: true });
  await writeFile(
    path.join(receipt, `installed-${path.basename(consumer)}.json`),
    JSON.stringify({ ...manifest, backup }, null, 2) + "\n",
  );
  console.log(
    `Installed packed candidate into ${consumer}. Previous packages: ${backup}`,
  );
  console.log(
    "Consumer package.json, lockfile and published-release provenance are unchanged. npm ci restores the published baseline; public release/pin updates are still required before pushing these consumer changes.",
  );
}
