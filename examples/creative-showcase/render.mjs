// Local example renderer. Uses the existing golden tool dependencies and built
// public engine entry points; no provider calls, external media or credentials.
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "../..");
const require = createRequire(resolve(root, "tools/golden/package.json"));
async function engineEntry(name) {
  const [scope, packageName, ...parts] = name.split("/");
  const packageDirectory = resolve(
    root,
    "tools/golden/node_modules",
    scope,
    packageName,
  );
  const manifest = JSON.parse(
    await readFile(resolve(packageDirectory, "package.json"), "utf8"),
  );
  const entry = manifest.exports[parts.length ? `./${parts.join("/")}` : "."];
  const target = typeof entry === "string" ? entry : entry.import;
  if (typeof target !== "string")
    throw new Error(`Missing ESM export: ${name}`);
  return resolve(packageDirectory, target);
}
const { createServer } = await import(pathToFileURL(require.resolve("vite")));
const { chromium } = require("playwright");
const { parseScene } = await import(
  pathToFileURL(await engineEntry("@dojo-video-engine/schema"))
);
const { validateThreeLayers } = await import(
  pathToFileURL(await engineEntry("@dojo-video-engine/three"))
);
const ids = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const demos = [
  "festival",
  "company",
  "journey",
  "data-story",
  "kinetic",
  "cinema",
  "city",
  "precision",
  "bloom",
  "sports",
  "software",
  "citrus",
];
const stillsOnly = process.argv.includes("--stills");
for (const arg of process.argv.slice(2))
  if (arg.startsWith("--") && arg !== "--stills")
    throw new Error(`Unknown option: ${arg}`);
for (const id of ids)
  if (!demos.includes(id)) throw new Error(`Unknown demo: ${id}`);
const output = resolve(root, "docs/assets/showcase");
const proof = resolve(root, "test-results/creative-showcase");
const reports = resolve(root, "docs/reports/showcase");
await mkdir(output, { recursive: true });
await mkdir(proof, { recursive: true });
await mkdir(reports, { recursive: true });
const aliases = await Promise.all(
  [
    "@dojo-video-engine/renderer-canvas2d/runtime",
    "@dojo-video-engine/schema/values",
    "@dojo-video-engine/three",
    "@dojo-video-engine/export",
    "@dojo-video-engine/renderer-canvas2d",
    "@dojo-video-engine/schema",
    "@dojo-video-engine/core",
    "@dojo-video-engine/extensions",
    "@dojo-video-engine/runtime",
  ].map(async (name) => ({ find: name, replacement: await engineEntry(name) })),
);
const server = await createServer({
  configFile: false,
  root: directory,
  logLevel: "error",
  resolve: { alias: aliases },
  server: { host: "127.0.0.1", port: 0, strictPort: false },
});
let browser;
try {
  await server.listen();
  const origin = new URL(server.resolvedUrls.local[0]).origin;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "log") console.log(message.text());
  });
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  await page.goto(origin);
  await page.waitForFunction(() => typeof window.renderShowcase === "function");
  for (const id of ids.length ? ids : demos) {
    const { scene: input, metadata = {} } = await import(`./${id}.mjs`);
    const scene = parseScene(input);
    validateThreeLayers(scene.nodes);
    const json = JSON.stringify(scene, null, 2) + "\n";
    await writeFile(resolve(directory, `${id}.json`), json);
    const frames = metadata.frames ?? [30, 90, 150, 210, 270, 330];
    let timer;
    const result = await Promise.race([
      page.evaluate((args) => window.renderShowcase(args), {
        scene,
        frames,
        stillsOnly,
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${id}: browser render exceeded 180 seconds`)),
          180_000,
        );
        timer.unref();
      }),
    ]).finally(() => clearTimeout(timer));
    if (errors.length) throw new Error(errors.join("\n"));
    for (const still of result.stills)
      await writeFile(
        resolve(proof, `${id}-${still.frame}.png`),
        Buffer.from(still.png, "base64"),
      );
    console.log(`${id}: ${result.stills.length} preview frames`);
    if (stillsOnly) continue;
    const mp4 = resolve(output, `${id}.mp4`);
    await writeFile(mp4, Buffer.from(result.mp4, "base64"));
    const probe = JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-count_frames",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=codec_name,width,height,nb_read_frames,duration",
          "-of",
          "json",
          mp4,
        ],
        { encoding: "utf8" },
      ),
    );
    const stream = probe.streams[0];
    if (
      Number(stream.nb_read_frames) !== scene.duration ||
      stream.width !== scene.width ||
      stream.height !== scene.height
    )
      throw new Error(`${id}: decoded output does not match scene`);
    execFileSync("ffmpeg", ["-v", "error", "-i", mp4, "-f", "null", "-"], {
      stdio: "pipe",
    });
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-i",
      mp4,
      "-ss",
      String((metadata.posterFrame ?? 90) / scene.fps),
      "-frames:v",
      "1",
      resolve(output, `${id}.png`),
    ]);
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-i",
      mp4,
      "-filter_complex",
      "fps=12,scale=640:360:force_original_aspect_ratio=decrease:flags=lanczos,pad=640:360:(ow-iw)/2:(oh-ih)/2:color=0x101018,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=bayer:bayer_scale=3",
      "-loop",
      "0",
      resolve(output, `${id}.gif`),
    ]);
    await writeFile(
      resolve(reports, `${id}.render.json`),
      JSON.stringify(
        {
          title: metadata.title ?? id,
          source: `examples/creative-showcase/${id}.mjs`,
          sceneSha256: createHash("sha256").update(json).digest("hex"),
          engine: JSON.parse(
            await readFile(
              resolve(
                dirname(await engineEntry("@dojo-video-engine/export")),
                "../package.json",
              ),
              "utf8",
            ),
          ).version,
          browser: browser.version(),
          platform: `${process.platform}/${process.arch}`,
          frames,
          codec: result.codec,
          verification: result.verification,
          decoded: stream,
          audio: "Silent motion study; no audio track authored.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `${id}: exported and fully decoded ${stream.nb_read_frames} frames; poster and GIF ready`,
    );
  }
} finally {
  await browser?.close();
  await server.close();
}
