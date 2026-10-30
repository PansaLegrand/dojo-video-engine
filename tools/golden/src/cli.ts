import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { fixtures, type GoldenFixture } from "./fixtures.js";

type GoldenMode = "test" | "update";

type RenderedFrame = {
  width: number;
  height: number;
  rgba: number[];
};

type GoldenSnapshot = {
  fixtureId: string;
  frame: number;
  width: number;
  height: number;
  hash: string;
};

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const goldenDir = resolve(rootDir, "fixtures/goldens");
const diffDir = resolve(goldenDir, "__diffs__");
const harnessDir = resolve(rootDir, "tools/golden");
const mode = parseMode(process.argv[2]);

await run(mode);

async function run(currentMode: GoldenMode): Promise<void> {
  const server = await createServer({
    root: harnessDir,
    logLevel: "error",
    // Resolve workspace packages from source so goldens never depend on a
    // stale or missing dist build.
    resolve: {
      alias: {
        "@dojo-video-engine/presets/macros": resolve(
          rootDir,
          "packages/presets/src/macros.ts",
        ),
        "@dojo-video-engine/schema/values": resolve(
          rootDir,
          "packages/schema/src/values.ts",
        ),
        "@dojo-video-engine/schema": resolve(rootDir, "packages/schema/src/index.ts"),
        "@dojo-video-engine/core": resolve(rootDir, "packages/core/src/index.ts"),
        "@dojo-video-engine/agent-tools": resolve(
          rootDir,
          "packages/agent-tools/src/index.ts",
        ),
        "@dojo-video-engine/extensions": resolve(
          rootDir,
          "packages/extensions/src/index.ts",
        ),
        "@dojo-video-engine/layout": resolve(rootDir, "packages/layout/src/index.ts"),
        "@dojo-video-engine/presets": resolve(
          rootDir,
          "packages/presets/src/index.ts",
        ),
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
        "@dojo-video-engine/runtime": resolve(
          rootDir,
          "packages/runtime/src/index.ts",
        ),
        "@dojo-video-engine/export": resolve(rootDir, "packages/export/src/index.ts"),
        "@dojo-video-engine/player": resolve(rootDir, "packages/player/src/index.ts"),
      },
    },
    server: {
      host: "127.0.0.1",
      port: 0,
      strictPort: false,
    },
  });

  let browser: Browser | undefined;

  try {
    await server.listen();
    const url = server.resolvedUrls?.local[0];

    if (!url) {
      throw new Error("Golden harness dev server did not expose a local URL.");
    }

    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "load" });

    const failures: string[] = [];

    for (const fixture of fixtures) {
      const rendered = await renderFrame(page, fixture.scene, fixture.frame);

      if (fixture.kind === "exact") {
        const snapshot = snapshotFrame(fixture, rendered);
        const snapshotPath = resolve(goldenDir, `${fixture.id}.json`);
        const baselinePngPath = resolve(goldenDir, `${fixture.id}.png`);

        if (currentMode === "update") {
          await writeSnapshot(snapshotPath, snapshot);
          await writeFramePng(page, baselinePngPath, fixture);
          console.log(`updated ${fixture.id} ${snapshot.hash}`);
        } else {
          const expected = await readSnapshot(snapshotPath);

          if (expected.hash !== snapshot.hash) {
            const artifacts = await writeFailureArtifacts(
              page,
              fixture,
              rendered,
              baselinePngPath,
            );
            failures.push(
              [
                `${fixture.id}: hash mismatch`,
                `  expected ${expected.hash}`,
                `  received ${snapshot.hash}`,
                `  artifacts ${artifacts.join(", ")}`,
                `  run pnpm golden:update after inspecting the visual change`,
              ].join("\n"),
            );
          } else {
            console.log(`ok ${fixture.id} ${snapshot.hash}`);
          }
        }
      } else {
        const probeFailures = evaluateProbes(fixture, rendered);

        if (probeFailures.length > 0) {
          failures.push(...probeFailures);
        } else {
          console.log(`ok ${fixture.id} probes`);
        }
      }
    }

    failures.push(...(await runLegacyMigrationChecks(page)));
    failures.push(...(await runRendererConformanceChecks(page)));
    failures.push(...(await runExportSmokeTest(page)));
    failures.push(...(await runVideoChecks(page)));
    failures.push(...(await runAudioChecks(page)));
    failures.push(...(await runRuntimeParityChecks(page)));
    failures.push(...(await runAgentToolChecks(page)));
    failures.push(...(await runLayoutV2Checks(page)));

    if (failures.length > 0) {
      throw new Error(`Golden failures:\n${failures.join("\n\n")}`);
    }
  } finally {
    await browser?.close();
    await closeServer(server);
  }
}

async function runLegacyMigrationChecks(page: Page): Promise<string[]> {
  const fixture = fixtures.find((entry) => entry.id === "effect-showcase");
  if (!fixture) {
    return ["scene-v0-migration: missing effect-showcase fixture"];
  }

  const current = await renderFrame(page, fixture.scene, fixture.frame);
  const legacyScene = {
    ...fixture.scene,
    schemaVersion: 0,
  } as unknown as typeof fixture.scene;
  const legacy = await renderFrame(page, legacyScene, fixture.frame);
  const currentHash = hashFrame(current);
  const legacyHash = hashFrame(legacy);

  if (currentHash !== legacyHash) {
    return [
      `scene-v0-migration: expected migrated pixels ${currentHash}, received ${legacyHash}`,
    ];
  }

  console.log(`ok scene-v0-migration ${legacyHash}`);
  return [];
}

/**
 * DisplayList v1 backend contract: structural fixtures plus exact Canvas2D
 * compile/execute RGBA parity in the Playwright-pinned Chromium build.
 */
async function runRendererConformanceChecks(page: Page): Promise<string[]> {
  const checks = await page.evaluate(() =>
    window.runGoldenRendererConformanceChecks(),
  );
  const failures: string[] = [];
  for (const check of checks) {
    if (check.pass) {
      console.log(`ok renderer-conformance: ${check.label} (${check.detail})`);
    } else {
      failures.push(
        `renderer-conformance: ${check.label} failed — ${check.detail}`,
      );
    }
  }
  return failures;
}

/**
 * Encodes a short scene to MP4 inside the harness browser and checks the
 * result is a plausible MP4 file. This is the integration test for
 * exportVideo(); Node cannot run it because it has no WebCodecs.
 */
async function runExportSmokeTest(page: Page): Promise<string[]> {
  const fixture = fixtures.find((entry) => entry.id === "opacity-keyframe");

  if (!fixture) {
    return ["export-smoke: missing opacity-keyframe fixture scene"];
  }

  const exported = await page.evaluate(
    (sceneJson) => window.renderGoldenExport(JSON.parse(sceneJson)),
    JSON.stringify(fixture.scene),
  );

  const failures: string[] = [];
  const ftyp = String.fromCharCode(...exported.header.slice(4, 8));
  const streamFtyp = String.fromCharCode(...exported.streamHeader.slice(4, 8));

  if (exported.size <= 0) {
    failures.push("export-smoke: produced an empty file");
  }

  if (ftyp !== "ftyp") {
    failures.push(
      `export-smoke: expected an MP4 ftyp box at byte 4, got "${ftyp}" (header ${exported.header.join(",")})`,
    );
  }

  if (exported.totalFrames !== fixture.scene.duration) {
    failures.push(
      `export-smoke: expected ${fixture.scene.duration} frames, got ${exported.totalFrames}`,
    );
  }

  if (exported.streamSize <= 0 || streamFtyp !== "ftyp") {
    failures.push(
      `export-smoke: streamed MP4 is invalid (${exported.streamSize} bytes, header ${exported.streamHeader.join(",")})`,
    );
  }

  if (failures.length === 0) {
    console.log(
      `ok export-smoke ${exported.size} bytes, ${exported.codec}, ${exported.totalFrames} frames, ${exported.mimeType}`,
    );
  }

  return failures;
}

/**
 * Video clip integration checks: synthesize a clip with exportVideo, composite
 * it through video nodes (trim + playbackRate), verify preview pixels, then
 * export the composite and verify the decoded file matches the preview.
 */
async function runVideoChecks(page: Page): Promise<string[]> {
  const checks = await page.evaluate(() => window.runGoldenVideoChecks());
  const failures: string[] = [];

  for (const check of checks) {
    if (check.pass) {
      console.log(`ok video: ${check.label} (${check.detail})`);
    } else {
      failures.push(`video: ${check.label} failed — ${check.detail}`);
    }
  }

  return failures;
}

/**
 * Audio integration checks: a synthesized WAV tone placed mid-timeline must
 * export into the MP4's audio track, silent before its start frame and
 * audible after, verified by decoding the exported file.
 */
async function runAudioChecks(page: Page): Promise<string[]> {
  const checks = await page.evaluate(() => window.runGoldenAudioChecks());
  const failures: string[] = [];

  for (const check of checks) {
    if (check.pass) {
      console.log(`ok audio: ${check.label} (${check.detail})`);
    } else {
      failures.push(`audio: ${check.label} failed — ${check.detail}`);
    }
  }

  return failures;
}

/**
 * MF5 compatibility evidence: every prepared-runtime facade must preserve the
 * exact legacy Canvas2D pixels and Float32 PCM in the pinned Chromium build.
 */
async function runRuntimeParityChecks(page: Page): Promise<string[]> {
  const checks = await page.evaluate(() =>
    window.runGoldenRuntimeParityChecks(),
  );
  const failures: string[] = [];

  for (const check of checks) {
    if (check.pass) {
      console.log(`ok runtime: ${check.label} (${check.detail})`);
    } else {
      failures.push(`runtime: ${check.label} failed — ${check.detail}`);
    }
  }

  return failures;
}

async function runAgentToolChecks(page: Page): Promise<string[]> {
  const checks = await page.evaluate(() => window.runGoldenAgentToolChecks());
  const failures: string[] = [];
  for (const check of checks) {
    if (check.pass) console.log(`ok tools: ${check.label} (${check.detail})`);
    else failures.push(`tools: ${check.label} failed — ${check.detail}`);
  }
  return failures;
}

/** MF7 browser evidence for semantic layout compilation and legacy isolation. */
async function runLayoutV2Checks(page: Page): Promise<string[]> {
  const checks = await page.evaluate(() => window.runGoldenLayoutV2Checks());
  const failures: string[] = [];
  for (const check of checks) {
    if (check.pass)
      console.log(`ok layout-v2: ${check.label} (${check.detail})`);
    else failures.push(`layout-v2: ${check.label} failed — ${check.detail}`);
  }
  return failures;
}

async function launchBrowser(): Promise<Browser> {
  // Default to the Playwright-pinned Chromium so every machine hashes pixels
  // from the same browser build. GOLDEN_CHROME_PATH overrides for debugging.
  return chromium.launch({
    executablePath: process.env.GOLDEN_CHROME_PATH,
    headless: true,
  });
}

function snapshotFrame(
  fixture: GoldenFixture,
  frame: RenderedFrame,
): GoldenSnapshot {
  return {
    fixtureId: fixture.id,
    frame: fixture.frame,
    width: frame.width,
    height: frame.height,
    hash: hashFrame(frame),
  };
}

function hashFrame(frame: RenderedFrame): string {
  return createHash("sha256").update(Buffer.from(frame.rgba)).digest("hex");
}

async function readSnapshot(path: string): Promise<GoldenSnapshot> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as GoldenSnapshot;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(
        `Missing golden snapshot ${path}. Run pnpm golden:update to create it.`,
      );
    }

    throw error;
  }
}

async function writeSnapshot(
  path: string,
  snapshot: GoldenSnapshot,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`);
}

async function writeFramePng(
  page: Page,
  path: string,
  fixture: Extract<GoldenFixture, { kind: "exact" }>,
): Promise<void> {
  const pngBase64 = await renderFramePng(page, fixture.scene, fixture.frame);

  await writeBase64File(path, pngBase64);
}

async function writeFailureArtifacts(
  page: Page,
  fixture: Extract<GoldenFixture, { kind: "exact" }>,
  received: RenderedFrame,
  baselinePngPath: string,
): Promise<string[]> {
  await mkdir(diffDir, { recursive: true });

  const receivedPath = resolve(diffDir, `${fixture.id}.received.png`);
  const diffPath = resolve(diffDir, `${fixture.id}.diff.png`);

  const receivedBase64 = await renderFramePng(
    page,
    fixture.scene,
    fixture.frame,
  );
  await writeBase64File(receivedPath, receivedBase64);

  const artifacts = [receivedPath];
  const expected = await readBaselinePng(page, baselinePngPath);

  if (expected) {
    const diffBase64 = await page.evaluate(
      ({ expectedFrame, receivedFrame }) =>
        window.renderGoldenDiffPng(expectedFrame, receivedFrame),
      { expectedFrame: expected, receivedFrame: received },
    );
    await writeBase64File(diffPath, diffBase64);
    artifacts.push(diffPath);
  }

  return artifacts;
}

async function renderFrame(
  page: Page,
  scene: GoldenFixture["scene"],
  frame: number,
): Promise<RenderedFrame> {
  return page.evaluate(
    ({ sceneJson, requestedFrame }) =>
      window.renderGoldenFrame(JSON.parse(sceneJson), requestedFrame),
    { sceneJson: JSON.stringify(scene), requestedFrame: frame },
  );
}

async function renderFramePng(
  page: Page,
  scene: GoldenFixture["scene"],
  frame: number,
): Promise<string> {
  return page.evaluate(
    ({ sceneJson, requestedFrame }) =>
      window.renderGoldenFramePng(JSON.parse(sceneJson), requestedFrame),
    { sceneJson: JSON.stringify(scene), requestedFrame: frame },
  );
}

async function readBaselinePng(
  page: Page,
  path: string,
): Promise<RenderedFrame | undefined> {
  try {
    const pngBase64 = (await readFile(path)).toString("base64");

    return await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        throw new Error("Canvas2D unavailable for baseline PNG");
      }

      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;

      return {
        width: canvas.width,
        height: canvas.height,
        rgba: Array.from(data),
      };
    }, pngBase64);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function writeBase64File(path: string, base64: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(base64, "base64"));
}

function evaluateProbes(
  fixture: Extract<GoldenFixture, { kind: "probe" }>,
  frame: RenderedFrame,
): string[] {
  const failures: string[] = [];

  for (const probe of fixture.probes) {
    // A probe with toX scans the row segment [x, toX] and passes if any pixel
    // matches; a point probe checks the single pixel at (x, y). An `absent`
    // probe inverts this: it passes only when no pixel matches.
    const xs = probe.toX === undefined ? [probe.x] : range(probe.x, probe.toX);
    const pixels = xs.map((x) => readPixel(frame, x, probe.y));
    const anyMatch = pixels.some((rgba) => probeMatches(probe, rgba));

    if (anyMatch === (probe.absent ?? false)) {
      const sample = pixels[Math.floor(pixels.length / 2)] ?? [0, 0, 0, 0];
      const where =
        probe.toX === undefined
          ? `at (${probe.x}, ${probe.y})`
          : `in row ${probe.y}, x ${probe.x}..${probe.toX}`;
      const verdict = probe.absent
        ? "found an unexpected matching pixel"
        : "found no matching pixel";
      failures.push(
        `${fixture.id}: ${probe.label} ${verdict} ${where} ` +
          `(minAlpha=${probe.minAlpha ?? "-"}, notRgb=${probe.notRgb?.join(",") ?? "-"}, sample=${sample.join(",")})`,
      );
    }
  }

  return failures;
}

function probeMatches(
  probe: { minAlpha?: number; notRgb?: [number, number, number] },
  rgba: [number, number, number, number],
): boolean {
  if (probe.minAlpha !== undefined && rgba[3] < probe.minAlpha) {
    return false;
  }

  if (
    probe.notRgb &&
    rgba[0] === probe.notRgb[0] &&
    rgba[1] === probe.notRgb[1] &&
    rgba[2] === probe.notRgb[2]
  ) {
    return false;
  }

  return true;
}

function readPixel(
  frame: RenderedFrame,
  x: number,
  y: number,
): [number, number, number, number] {
  const offset = (y * frame.width + x) * 4;
  return frame.rgba.slice(offset, offset + 4) as [
    number,
    number,
    number,
    number,
  ];
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function parseMode(value: string | undefined): GoldenMode {
  if (value === "test" || value === "update") {
    return value;
  }

  throw new Error("Usage: tsx src/cli.ts <test|update>");
}

async function closeServer(server: ViteDevServer): Promise<void> {
  await server.close();
}
