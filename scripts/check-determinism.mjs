// Determinism lint: the render path must never read wall-clock time or
// unseeded randomness — the same (scene, frame) must always produce the
// same pixels. Scans render-package sources for banned calls.
//
// Allowed exceptions are listed explicitly with their justification; add to
// the list only when the call is outside the render path (e.g. an
// injectable default or a progress timer) and say why.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const packages = [
  "packages/schema/src",
  "packages/core/src",
  "packages/renderer-canvas2d/src",
  "packages/presets/src",
  "packages/export/src",
  "packages/player/src",
];

const banned = /\b(Math\.random|Date\.now|new Date|performance\.now)\s*\(/g;

// path → patterns that are acceptable there, with the reason.
const allowlist = {
  // The player's frame clock is the documented wall-clock boundary; the call
  // site is an injectable default (`now` option), never the render path.
  "packages/player/src/index.ts": ["performance.now"],
  // Export uses wall-clock time only to throttle observer progress callbacks;
  // frame evaluation, timestamps, encoded pixels, and audio remain frame-based.
  "packages/export/src/index.ts": ["performance.now"],
};

const failures = [];

function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      scan(path);
      continue;
    }

    if (!path.endsWith(".ts") || path.endsWith(".test.ts")) {
      continue;
    }

    const source = readFileSync(path, "utf8");
    const rel = relative(process.cwd(), path);
    const allowed = allowlist[rel] ?? [];

    for (const match of source.matchAll(banned)) {
      const call = match[1];

      if (allowed.includes(call)) {
        continue;
      }

      const line = source.slice(0, match.index).split("\n").length;
      failures.push(
        `${rel}:${line} uses ${call}() — banned in the render path (determinism contract)`,
      );
    }
  }
}

for (const dir of packages) {
  scan(dir);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`determinism check ok (${packages.length} packages scanned)`);
