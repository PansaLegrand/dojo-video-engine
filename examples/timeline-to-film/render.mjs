import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "../..");
const tooling = createRequire(resolve(root, "tools/golden/package.json"));
const { chromium } = tooling("playwright");
const { createServer } = await import(pathToFileURL(tooling.resolve("vite")));
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    packages: { type: "string" },
    out: { type: "string" },
    scene: { type: "string" },
  },
});
const modules = resolve(
  values.packages ?? resolve(root, "tools/golden/node_modules"),
);
const out = resolve(
  values.out ?? resolve(root, "test-results/timeline-to-film"),
);
assert(
  !values.scene || (!positionals.length && values.scene.endsWith(".json")),
  "Use --scene FILE.json or named cuts, not both",
);
const sceneDir = values.scene ? dirname(resolve(values.scene)) : directory;
const cuts = values.scene
  ? [basename(values.scene, ".json")]
  : positionals.length
    ? positionals
    : ["cut-a", "cut-b"];
assert(
  cuts.every((cut) =>
    values.scene
      ? /^[a-zA-Z0-9_-]+$/.test(cut)
      : ["cut-a", "cut-b"].includes(cut),
  ),
  "Expected cut-a, cut-b, or a named Scene JSON file",
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const aliases = {};
const versions = new Set();
for (const leaf of ["export", "renderer-canvas2d", "schema"]) {
  const name = "@dojo-video-engine/" + leaf;
  const pkg = JSON.parse(
    await readFile(resolve(modules, name, "package.json"), "utf8"),
  );
  assert.equal(pkg.name, name);
  versions.add(pkg.version);
  aliases[name] = resolve(modules, name, pkg.exports["."].import);
}
assert.equal(versions.size, 1, "Expected synchronized engine packages");
const { parseScene } = await import(
  pathToFileURL(aliases["@dojo-video-engine/schema"])
);
const server = await createServer({
  root: directory,
  configFile: false,
  logLevel: "error",
  resolve: {
    alias: Object.entries(aliases).map(([name, replacement]) => ({
      find: new RegExp("^" + name + "$"),
      replacement,
    })),
  },
  server: {
    host: "127.0.0.1",
    port: 0,
    hmr: false,
    fs: { allow: [root, modules, sceneDir] },
  },
});
await mkdir(out, { recursive: true });
let browser;
try {
  await server.listen();
  const origin = new URL(server.resolvedUrls.local[0]).origin;
  browser = await chromium.launch();
  for (const cut of cuts) {
    const sceneBytes = await readFile(resolve(sceneDir, cut + ".json"));
    const scene = parseScene(JSON.parse(sceneBytes));
    assert.deepEqual(
      [scene.width, scene.height, scene.fps, scene.duration],
      [1280, 720, 30, 240],
    );
    const media = {};
    for (const asset of Object.values(scene.assets)) {
      assert(
        /^(?:\.\/)?assets\/[a-zA-Z0-9_.-]+$/.test(asset.src),
        "Use assets bundled next to the Scene: " + asset.src,
      );
      const sourceFile = resolve(sceneDir, asset.src);
      media[asset.src] = hash(await readFile(sourceFile));
      if (values.scene) asset.src = "/@fs/" + sourceFile;
    }
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    await page.goto(origin + "/render.html");
    await page.waitForFunction(() => typeof window.exportCut === "function");
    const rendered = await page.evaluate((s) => window.exportCut(s), scene);
    assert.deepEqual(errors, []);
    assert.equal(rendered.frames, scene.duration);
    await page.close();
    const bytes = Buffer.from(rendered.data, "base64");
    const mp4 = resolve(out, cut + ".mp4");
    await writeFile(mp4, bytes);
    const { streams } = JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-count_frames",
          "-show_entries",
          "stream=codec_type,codec_name,width,height,r_frame_rate,duration,nb_read_frames",
          "-of",
          "json",
          mp4,
        ],
        { encoding: "utf8" },
      ),
    );
    const video = streams.find((s) => s.codec_type === "video");
    assert.deepEqual(
      [
        video.codec_name,
        video.width,
        video.height,
        video.r_frame_rate,
        Number(video.duration),
        Number(video.nb_read_frames),
      ],
      ["h264", 1280, 720, "30/1", 8, 240],
    );
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-xerror",
      "-i",
      mp4,
      "-f",
      "null",
      "-",
    ]);
    let audioLevels;
    if (Object.values(scene.assets).some((asset) => asset.type === "audio")) {
      assert.equal(
        streams.filter((stream) => stream.codec_type === "audio").length,
        1,
        "Missing authored soundtrack",
      );
      const pcm = execFileSync("ffmpeg", [
        "-v",
        "error",
        "-i",
        mp4,
        "-map",
        "0:a:0",
        "-ac",
        "1",
        "-ar",
        "12000",
        "-f",
        "f32le",
        "-",
      ]);
      let energy = 0,
        peak = 0;
      for (let offset = 0; offset < pcm.length; offset += 4) {
        const sample = pcm.readFloatLE(offset);
        energy += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
      assert(peak > 0.001, "Decoded soundtrack is silent");
      audioLevels = {
        peakDbfs: 20 * Math.log10(peak),
        rmsDbfs: 10 * Math.log10(energy / (pcm.length / 4)),
      };
    }
    const frames = [
      0, 15, 30, 48, 60, 72, 84, 96, 108, 126, 144, 165, 186, 204, 222, 239,
    ];
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-i",
      mp4,
      "-vf",
      "select='" +
        frames.map((f) => "eq(n," + f + ")").join("+") +
        "',scale=320:180,tile=4x4:padding=2:margin=2:color=black",
      "-frames:v",
      "1",
      resolve(out, cut + "-sheet.jpg"),
    ]);
    const report = {
      cut,
      engine: [...versions][0],
      browser: browser.version(),
      sha256: hash(bytes),
      sceneSha256: hash(sceneBytes),
      media,
      loadedFontFamilies: rendered.fonts,
      decoded: streams,
      audioLevels,
      contactSheetFrames: frames,
    };
    await writeFile(
      resolve(out, cut + "-report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      cut + ": verified " + video.nb_read_frames + " frames → " + mp4,
    );
  }
} finally {
  await browser?.close();
  await server.close();
}
