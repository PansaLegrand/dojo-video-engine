// Production-size export benchmark. Boots the golden harness browser and
// runs render/decode/encode stages at the requested size.
//
// Usage: pnpm --filter @motionforge/golden run benchmark [width height fps seconds]
// Defaults: 1920 1080 30 10

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { createServer } from "vite";
import type { BenchmarkResult } from "./harness.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const harnessDir = resolve(rootDir, "tools/golden");

const [width, height, fps, seconds] = [
  Number(process.argv[2] ?? 1920),
  Number(process.argv[3] ?? 1080),
  Number(process.argv[4] ?? 30),
  Number(process.argv[5] ?? 10),
];

const server = await createServer({
  root: harnessDir,
  logLevel: "error",
  resolve: {
    alias: {
      "@motionforge/presets/macros": resolve(
        rootDir,
        "packages/presets/src/macros.ts",
      ),
      "@motionforge/schema/values": resolve(
        rootDir,
        "packages/schema/src/values.ts",
      ),
      "@motionforge/renderer-canvas2d/runtime": resolve(
        rootDir,
        "packages/renderer-canvas2d/src/runtime.ts",
      ),
      "@motionforge/runtime": resolve(rootDir, "packages/runtime/src/index.ts"),
      ...Object.fromEntries(
        [
          "agent-tools",
          "schema",
          "core",
          "presets",
          "showcase",
          "renderer-canvas2d",
          "export",
          "player",
        ].map((name) => [
          `@motionforge/${name}`,
          resolve(rootDir, `packages/${name}/src/index.ts`),
        ]),
      ),
    },
  },
  server: { host: "127.0.0.1", port: 0, strictPort: false },
});

let browser: Browser | undefined;

try {
  await server.listen();
  const url = server.resolvedUrls?.local[0];

  if (!url) {
    throw new Error("Harness dev server did not expose a local URL.");
  }

  browser = await chromium.launch({
    headless: true,
    args: ["--enable-precise-memory-info"],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "load" });

  console.log(
    `benchmark: ${width}x${height} @ ${fps}fps, ${seconds}s (${seconds * fps} frames)\n`,
  );

  const result = (await page.evaluate(
    (options) => window.runGoldenBenchmark(options),
    { width, height, fps, seconds },
  )) as BenchmarkResult;

  const pad = (value: string | number, width: number) =>
    String(value).padStart(width);

  console.log(
    "stage                                   frames   total ms   ms/frame   output KiB",
  );
  for (const stage of result.stages) {
    console.log(
      `${stage.label.padEnd(40)}${pad(stage.frames, 6)} ${pad(stage.totalMs, 10)} ${pad(stage.msPerFrame, 10)} ${pad(stage.outputKiB, 12)}`,
    );
  }

  console.log("\nJS heap after each stage:");
  for (const snapshot of result.heapMiB) {
    console.log(
      `  ${snapshot.label.padEnd(40)} ${snapshot.usedMiB === null ? "n/a" : `${snapshot.usedMiB} MiB`}`,
    );
  }
} finally {
  await browser?.close();
  await server.close();
}
