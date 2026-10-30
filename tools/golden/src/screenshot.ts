// Captures the README hero screenshot of the playground at a representative
// frame. Run with: pnpm --filter @dojo-video-engine/golden run screenshot
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { createServer, type ViteDevServer } from "vite";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const playgroundDir = resolve(rootDir, "apps/playground");
const outPath = resolve(rootDir, "docs/assets/playground.png");
const heroFrame = 40;

const server = await createServer({
  root: playgroundDir,
  logLevel: "error",
  resolve: {
    alias: {
      "@dojo-video-engine/schema/values": resolve(
        rootDir,
        "packages/schema/src/values.ts",
      ),
      "@dojo-video-engine/schema": resolve(rootDir, "packages/schema/src/index.ts"),
      "@dojo-video-engine/core": resolve(rootDir, "packages/core/src/index.ts"),
      "@dojo-video-engine/presets": resolve(rootDir, "packages/presets/src/index.ts"),
      "@dojo-video-engine/showcase": resolve(
        rootDir,
        "packages/showcase/src/index.ts",
      ),
      "@dojo-video-engine/renderer-canvas2d/runtime": resolve(
        rootDir,
        "packages/renderer-canvas2d/src/runtime.ts",
      ),
      "@dojo-video-engine/renderer-canvas2d": resolve(
        rootDir,
        "packages/renderer-canvas2d/src/index.ts",
      ),
      "@dojo-video-engine/runtime": resolve(rootDir, "packages/runtime/src/index.ts"),
      "@dojo-video-engine/export": resolve(rootDir, "packages/export/src/index.ts"),
      "@dojo-video-engine/player": resolve(rootDir, "packages/player/src/index.ts"),
    },
  },
  server: { host: "127.0.0.1", port: 0, strictPort: false },
});

let browser: Browser | undefined;

try {
  await server.listen();
  const url = server.resolvedUrls?.local[0];

  if (!url) {
    throw new Error("Playground dev server did not expose a local URL.");
  }

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1100, height: 720 },
    deviceScaleFactor: 2,
  });
  await page.goto(url, { waitUntil: "load" });
  // The playground draws only after resolveAssets() finishes; wait until the
  // canvas has opaque pixels so the capture isn't a blank frame.
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas");
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return false;
    }

    return (
      context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1)
        .data[3] !== 0
    );
  });
  await page.fill("#frame", String(heroFrame));
  await page.waitForFunction(
    (frame) => document.querySelector("output")?.textContent === String(frame),
    heroFrame,
  );

  await mkdir(dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath });
  console.log(`wrote ${outPath} at frame ${heroFrame}`);
} finally {
  await browser?.close();
  await closeServer(server);
}

async function closeServer(viteServer: ViteDevServer): Promise<void> {
  await viteServer.close();
}
