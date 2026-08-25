import { resolve } from "node:path";
import { chromium, type Browser } from "playwright";
import { createServer } from "vite";

const rootDir = resolve(import.meta.dirname, "../../..");
const harnessDir = resolve(rootDir, "tools/golden");
const maxMsPerFrame = Number(process.env.MOTIONFORGE_MAX_MS_PER_FRAME ?? 100);
const maxHeapMiB = Number(process.env.MOTIONFORGE_MAX_HEAP_MIB ?? 256);

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
  if (!url) throw new Error("Performance gate server exposed no URL.");
  browser = await chromium.launch({
    headless: true,
    args: ["--enable-precise-memory-info"],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "load" });
  const result = await page.evaluate(() =>
    window.runGoldenBenchmark({
      width: 1280,
      height: 720,
      fps: 30,
      seconds: 2,
    }),
  );
  const slow = result.stages.filter(
    (stage) => stage.msPerFrame > maxMsPerFrame,
  );
  const heavy = result.heapMiB.filter(
    (entry) => entry.usedMiB !== null && entry.usedMiB > maxHeapMiB,
  );
  if (slow.length || heavy.length) {
    throw new Error(
      `Performance budget failed: ${JSON.stringify({ slow, heavy })}`,
    );
  }
  console.log(
    `performance gate ok ${JSON.stringify({
      viewport: "1280x720@30",
      seconds: 2,
      maxMsPerFrame,
      maxHeapMiB,
      stages: result.stages,
      heapMiB: result.heapMiB,
    })}`,
  );
} finally {
  await browser?.close();
  await server.close();
}
