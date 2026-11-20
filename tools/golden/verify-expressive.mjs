import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
const here = fileURLToPath(new URL(".", import.meta.url)),
  root = path.join(here, "../../test-results/expressive");
await mkdir(root, { recursive: true });
const out = await mkdtemp(path.join(root, "run-"));
const video = path.join(out, "footage.mp4");
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=480x270:rate=24:duration=2",
  "-vf",
  "eq=brightness=-0.32:saturation=0.2",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  video,
]);
const server = await createServer({
  root: here,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "fixture-video",
      configureServer(server) {
        server.middlewares.use("/expressive-proof.mp4", async (req, res) => {
          res.setHeader("Content-Type", "video/mp4");
          res.end(await readFile(video));
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
  const page = await browser.newPage();
  await page.goto(
    `http://127.0.0.1:${server.httpServer.address().port}/graphics.html`,
  );
  const r = await page.evaluate(async () => {
    const m = await import("/src/expressive-browser.ts");
    return m.expressiveProof();
  });
  assert.equal(r.totalFrames, 48);
  const mp4 = path.join(out, "proof.mp4");
  await writeFile(mp4, Buffer.from(r.mp4, "base64"));
  const raw = (file, args) =>
    execFileSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        file,
        ...args,
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-",
      ],
      { maxBuffer: 24 * 1024 * 1024 },
    );
  const decoded = raw(mp4, []);
  assert.equal(decoded.length, 48 * 480 * 270 * 3);
  function measure(data, f) {
    const rgb = (x, y) => {
      const i = (480 * y + x) * 3;
      return [...data.subarray(i, i + 3)];
    };
    const px = (x, y) => rgb(x, y)[0];
    assert(Math.abs(px(48, 20) - px(53, 20)) > 160, "stripes outside glass");
    assert(
      Math.abs(px(48, 50) - px(53, 50)) < 25 &&
        px(48, 50) > 60 &&
        px(48, 50) < 160,
      "clipped, blurred and darkened backdrop",
    );
    const orange = (x, y) => {
      const [r, g, b] = rgb(x, y);
      return r > 185 && g > 90 && b < 70;
    };
    assert(
      orange(40, 124) && !orange(40, 155) && orange(80, 155),
      "skewed corner coverage",
    );
    let stroke = 0,
      red = 0,
      rx = 0,
      ry = 0,
      bx = 0,
      by = 0,
      blue = 0;
    for (let y = 0; y < 270; y++)
      for (let x = 0; x < 480; x++) {
        const [r, g, b] = rgb(x, y);
        if (x < 200 && y > 180 && r > 180 && g < 70 && b > 180) stroke++;
        if (x >= 192 && r > 180 && g < 65 && b < 90) {
          rx += x;
          ry += y;
          red++;
        }
        if (x >= 192 && b > 165 && r < 80 && g < 110) {
          bx += x;
          by += y;
          blue++;
        }
      }
    assert(
      red > 500 && blue > 500 && ry / red + 15 < by / blue,
      "texture orientation/owned image",
    );
    return { f, stroke, redX: rx / red, blueX: bx / blue };
  }
  const checks = [];
  for (const f of [0, 24, 47]) {
    const file = path.join(out, `frame-${f}.png`);
    await writeFile(file, Buffer.from(r.frames[f].split(",")[1], "base64"));
    const preview = measure(raw(file, ["-frames:v", "1"]), f),
      encoded = measure(
        decoded.subarray(f * 480 * 270 * 3, (f + 1) * 480 * 270 * 3),
        f,
      );
    assert(Math.abs(preview.redX - encoded.redX) < 2);
    checks.push(encoded);
  }
  assert(
    checks[0].stroke < 9 &&
      checks[1].stroke > 200 &&
      checks[2].stroke > checks[1].stroke * 1.4,
  );
  const progress =
    (checks[1].redX - checks[0].redX) / (checks[2].redX - checks[0].redX);
  assert(progress > 0.21 && progress < 0.32, `easeIn displacement ${progress}`);
  await writeFile(
    path.join(out, "proof.json"),
    JSON.stringify(checks, null, 2),
  );
  console.log(out, JSON.stringify(checks));
} finally {
  await browser?.close();
  await server.close();
}
