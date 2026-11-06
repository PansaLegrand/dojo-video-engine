import { createRequire } from "node:module";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(resolve(root, "tools/golden/package.json"));
const { createServer } = await import(require.resolve("vite"));
const { chromium } = require("playwright");
const out = resolve(root, "test-results/graphics");
await mkdir(out, { recursive: true });
const media = resolve(root, "tools/golden/public/graphics-source.mp4");
execFileSync("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-f",
  "lavfi",
  "-i",
  "color=c=0x15213d:s=640x360:r=30:d=2",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:duration=2",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-shortest",
  media,
]);
const server = await createServer({
  root: resolve(root, "tools/golden"),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.error(error));
  await page.goto(server.resolvedUrls.local[0] + "graphics.html");
  await page.waitForFunction(
    () => typeof window.runGraphicsProof === "function",
  );
  const result = await page.evaluate(() => window.runGraphicsProof());
  await writeFile(
    resolve(out, "preview.png"),
    Buffer.from(result.png, "base64"),
  );
  await writeFile(
    resolve(out, "output.mp4"),
    Buffer.from(result.mp4, "base64"),
  );
  await writeFile(
    resolve(out, "scene.json"),
    JSON.stringify(result.scene, null, 2),
  );
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_streams",
        "-of",
        "json",
        resolve(out, "output.mp4"),
      ],
      { encoding: "utf8" },
    ),
  );
  if (
    !probe.streams.some((stream) => stream.codec_type === "audio") ||
    !probe.streams.some(
      (stream) =>
        stream.codec_type === "video" && Number(stream.nb_frames) === 60,
    )
  )
    throw new Error("Export must contain 60 video frames and audio.");
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    resolve(out, "output.mp4"),
    "-frames:v",
    "1",
    resolve(out, "decoded.png"),
  ]);
  result.checks.push(
    "Independent ffprobe: 60 frames plus audio; FFmpeg decoded frame 0",
  );
  await writeFile(
    resolve(out, "report.json"),
    JSON.stringify({ checks: result.checks, probe }, null, 2),
  );
  console.log(
    JSON.stringify(
      { passed: result.checks.length, output: out, checks: result.checks },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await server.close();
  await rm(media, { force: true });
}
