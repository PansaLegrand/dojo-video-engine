// Renders an example scene JSON to MP4 (plus optional PNG frames) using the
// harness browser. Usage:
//   pnpm --filter @motionforge/golden run example <scene.json> <out.mp4> [frame ...]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import type { Scene } from "@motionforge/schema";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const harnessDir = resolve(rootDir, "tools/golden");
// pnpm runs scripts with cwd = the package dir; resolve user paths against
// the directory the command was invoked from.
const invokedFrom = process.env.INIT_CWD ?? process.cwd();

const [scenePath, outPath, ...frameArgs] = process.argv.slice(2);

if (!scenePath || !outPath) {
  console.error(
    "usage: render-example <scene.json> <out.mp4> [pngFrame ...]\nPNG frames are written next to the mp4 as <out>-f<frame>.png",
  );
  process.exit(1);
}

const scene = JSON.parse(
  await readFile(resolve(invokedFrom, scenePath), "utf-8"),
) as Scene;

const server = await createServer({
  root: harnessDir,
  logLevel: "error",
  resolve: {
    alias: {
      "@motionforge/schema": resolve(rootDir, "packages/schema/src/index.ts"),
      "@motionforge/core": resolve(rootDir, "packages/core/src/index.ts"),
      "@motionforge/presets": resolve(rootDir, "packages/presets/src/index.ts"),
      "@motionforge/showcase": resolve(
        rootDir,
        "packages/showcase/src/index.ts",
      ),
      "@motionforge/renderer-canvas2d": resolve(
        rootDir,
        "packages/renderer-canvas2d/src/index.ts",
      ),
      "@motionforge/export": resolve(rootDir, "packages/export/src/index.ts"),
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

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "load" });

  const started = performance.now();
  const exported = await page.evaluate(
    (sceneJson) => window.renderGoldenExportFile(JSON.parse(sceneJson)),
    JSON.stringify(scene),
  );
  const elapsed = performance.now() - started;

  const target = resolve(invokedFrom, outPath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(exported.base64, "base64"));
  console.log(
    `wrote ${target}: ${(exported.size / 1024).toFixed(0)} KiB, ${exported.codec}` +
      `${exported.audioCodec ? ` + ${exported.audioCodec}` : ""}, ` +
      `${exported.totalFrames} frames in ${elapsed.toFixed(0)}ms`,
  );

  for (const frameArg of frameArgs) {
    const frame = Number.parseInt(frameArg, 10);
    const png = await page.evaluate(
      ({ sceneJson, at }) =>
        window.renderGoldenFramePng(JSON.parse(sceneJson), at),
      { sceneJson: JSON.stringify(scene), at: frame },
    );
    const pngPath = target.replace(/\.mp4$/, `-f${frame}.png`);
    await writeFile(pngPath, Buffer.from(png, "base64"));
    console.log(`wrote ${pngPath}`);
  }
} finally {
  await browser?.close();
  await closeServer(server);
}

async function closeServer(viteServer: ViteDevServer): Promise<void> {
  await viteServer.close();
}
