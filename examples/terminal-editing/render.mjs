// A small local example host, not a public render CLI or multi-user server.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { parseScene } from "@dojo-video-engine/schema";

const scenePath = process.argv[2] ?? "scene.json";
const output = resolve(process.argv[3] ?? "output");
const sceneBytes = await readFile(scenePath);
const scene = parseScene(JSON.parse(sceneBytes));
const engineVersion = JSON.parse(
  await readFile("node_modules/@dojo-video-engine/export/package.json", "utf8"),
).version;
// Keep this local example's resource envelope bounded.
if (scene.duration > 1800 || scene.width > 1920 || scene.height > 1920)
  throw new Error("Example limit: 1800 frames and 1920 pixels per dimension.");
for (const asset of Object.values(scene.assets)) {
  if (
    !/^\/[a-zA-Z0-9_-]+\.(mp4|wav|png|jpg|woff2)$/.test(asset.src) ||
    asset.proxy
  )
    throw new Error(
      "Example accepts flat /filename assets from public/ only, without proxies.",
    );
  await readFile(resolve("public", asset.src.slice(1)));
}
await mkdir(output, { recursive: true });
const frames = [
  ...new Set(
    [0, 15, 45, 65, 90, scene.duration - 1].filter((f) => f < scene.duration),
  ),
];
const allowed = new Set([
  "edited.mp4",
  "contact-sheet.png",
  ...frames.map((f) => `frame-${f}.png`),
]);
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, strictPort: false },
  plugins: [
    {
      name: "terminal-output",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/__output/")) return next();
          const name = req.url.slice("/__output/".length);
          if (
            req.method !== "POST" ||
            !allowed.has(name) ||
            req.headers.origin !==
              server.resolvedUrls?.local[0]?.replace(/\/$/, "")
          ) {
            res.statusCode = 403;
            res.end();
            return;
          }
          try {
            const chunks = [];
            let bytes = 0;
            for await (const chunk of req) {
              bytes += chunk.length;
              if (bytes > 64 * 1024 * 1024)
                throw new Error("Output exceeds 64 MiB example limit");
              chunks.push(chunk);
            }
            const target = resolve(output, name);
            await writeFile(`${target}.tmp`, Buffer.concat(chunks));
            await rename(`${target}.tmp`, target);
            res.end("saved");
          } catch (error) {
            res.statusCode = 500;
            res.end(error.message);
          }
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const origin = new URL(server.resolvedUrls.local[0]).origin;
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  page.on("pageerror", (error) => console.error(error));
  await page.goto(origin);
  await page.waitForFunction(
    () => typeof window.runTerminalRender === "function",
  );
  const result = await Promise.race([
    page.evaluate(
      ({ scene, frames }) => window.runTerminalRender(scene, frames),
      { scene, frames },
    ),
    new Promise((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Render exceeded 120 seconds")),
        120_000,
      );
      timer.unref();
    }),
  ]);
  await writeFile(
    resolve(output, "render-report.json"),
    JSON.stringify(
      {
        engine: engineVersion,
        node: process.version,
        platform: `${process.platform}/${process.arch}`,
        browser: browser.version(),
        sceneSha256: createHash("sha256").update(sceneBytes).digest("hex"),
        frames,
        ...result,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Rendered ${result.totalFrames} frames to ${output}`);
} finally {
  await browser?.close();
  await server.close();
}
