import { resolve } from "node:path";
import { chromium, type Browser } from "playwright";
import { createServer } from "vite";
import type {
  CompositingBenchmarkOptions,
  CompositingBenchmarkResult,
} from "./harness.js";

const rootDir = resolve(import.meta.dirname, "../../..");
const harnessDir = resolve(rootDir, "tools/golden");
const maxMsPerFrame = Number(process.env.DOJO_VIDEO_ENGINE_MAX_MS_PER_FRAME ?? 100);
const maxHeapMiB = Number(process.env.DOJO_VIDEO_ENGINE_MAX_HEAP_MIB ?? 256);

type PublishedCompositingBudget = CompositingBenchmarkOptions & {
  label: string;
  maxMsPerFrame: number;
  maxPeakPoolMiB: number;
  maxStaticCacheMiB: number;
  maxAllocations: number;
  maxEvictions: number;
  minOraclePoolReuses: number;
  minCacheHitsPerFrame: number;
};

// Deliberately generous cross-machine ceilings, but finite enough to catch a
// return to per-frame scratch allocation or an accidental full-scene surface
// explosion. These values are printed with every successful gate run.
const publishedCompositingBudgets: readonly PublishedCompositingBudget[] = [
  {
    label: "compositing 1920x1080",
    width: 1920,
    height: 1080,
    frames: 8,
    warmupFrames: 2,
    maxPoolBytes: 96 * 1024 * 1024,
    maxPoolSurfaces: 32,
    maxStaticCacheBytes: 32 * 1024 * 1024,
    maxStaticCacheEntries: 8,
    maxStaticCacheKeyBytes: 256 * 1024,
    maxMsPerFrame: 750,
    maxPeakPoolMiB: 88,
    maxStaticCacheMiB: 24,
    maxAllocations: 24,
    maxEvictions: 0,
    minOraclePoolReuses: 10,
    minCacheHitsPerFrame: 1,
  },
  {
    label: "compositing 3840x2160",
    width: 3840,
    height: 2160,
    frames: 4,
    warmupFrames: 2,
    maxPoolBytes: 384 * 1024 * 1024,
    maxPoolSurfaces: 32,
    maxStaticCacheBytes: 96 * 1024 * 1024,
    maxStaticCacheEntries: 8,
    maxStaticCacheKeyBytes: 256 * 1024,
    maxMsPerFrame: 3_000,
    maxPeakPoolMiB: 336,
    maxStaticCacheMiB: 80,
    maxAllocations: 24,
    maxEvictions: 0,
    minOraclePoolReuses: 10,
    minCacheHitsPerFrame: 1,
  },
] as const;

const server = await createServer({
  root: harnessDir,
  logLevel: "error",
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
      "@dojo-video-engine/renderer-canvas2d/runtime": resolve(
        rootDir,
        "packages/renderer-canvas2d/src/runtime.ts",
      ),
      "@dojo-video-engine/runtime": resolve(rootDir, "packages/runtime/src/index.ts"),
      ...Object.fromEntries(
        [
          "agent-tools",
          "schema",
          "core",
          "layout",
          "presets",
          "showcase",
          "renderer-canvas2d",
          "export",
          "player",
        ].map((name) => [
          `@dojo-video-engine/${name}`,
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
  // Preserve the original WebCodecs-backed 720p render/decode/encode gate.
  // Run it first so the deliberately stressful 4K Canvas backing stores can
  // never affect codec availability or encode timing.
  const encodePage = await browser.newPage();
  await encodePage.goto(url, { waitUntil: "load" });
  const result = await encodePage.evaluate(() =>
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
  await encodePage.close();

  const compositingPage = await browser.newPage();
  await compositingPage.goto(url, { waitUntil: "load" });
  const compositingResults: Array<{
    budget: PublishedCompositingBudget;
    result: CompositingBenchmarkResult;
  }> = [];
  const compositingFailures: string[] = [];
  for (const budget of publishedCompositingBudgets) {
    const result = await compositingPage.evaluate(
      (benchmarkOptions) =>
        window.runGoldenCompositingBenchmark(benchmarkOptions),
      {
        width: budget.width,
        height: budget.height,
        frames: budget.frames,
        warmupFrames: budget.warmupFrames,
        maxPoolBytes: budget.maxPoolBytes,
        maxPoolSurfaces: budget.maxPoolSurfaces,
        maxStaticCacheBytes: budget.maxStaticCacheBytes,
        maxStaticCacheEntries: budget.maxStaticCacheEntries,
        maxStaticCacheKeyBytes: budget.maxStaticCacheKeyBytes,
      },
    );
    compositingResults.push({ budget, result });
    compositingFailures.push(...checkCompositingBudget(budget, result));
  }

  if (slow.length || heavy.length || compositingFailures.length) {
    throw new Error(
      `Performance budget failed: ${JSON.stringify({ slow, heavy, compositingFailures, compositingResults })}`,
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
      compositing: compositingResults,
    })}`,
  );
} finally {
  await browser?.close();
  await server.close();
}

function checkCompositingBudget(
  budget: PublishedCompositingBudget,
  result: CompositingBenchmarkResult,
): string[] {
  const failures: string[] = [];
  const measured = result.poolAfterMeasuredFrames;
  const warmup = result.poolAfterWarmup;
  const oracleWarmup = result.poolAfterCacheDisabledOracleWarmup;
  const oracle = result.poolAfterCacheDisabledOracle;
  const disposed = result.poolAfterDispose;
  const cacheWarmup = result.staticCacheAfterWarmup;
  const cacheMeasured = result.staticCacheAfterMeasuredFrames;
  const cacheDisposed = result.staticCacheAfterDispose;
  const freshOraclePool = result.oraclePoolAfterRender;
  const freshOracleDisposed = result.oraclePoolAfterDispose;
  const peakPoolMiB = oracle.peakAllocatedBytes / 1048576;
  const oracleReuseDelta = oracle.reuses - oracleWarmup.reuses;
  const cacheHitDelta = cacheMeasured.hits - cacheWarmup.hits;
  const cacheMiB = cacheMeasured.bytes / 1048576;
  const cacheAdoptionFailures =
    (
      cacheMeasured as typeof cacheMeasured & {
        adoptionFailures?: number;
        captureFailures?: number;
      }
    ).adoptionFailures ??
    (
      cacheMeasured as typeof cacheMeasured & {
        captureFailures?: number;
      }
    ).captureFailures ??
    Number.NaN;

  const require = (condition: boolean, detail: string) => {
    if (!condition) failures.push(`${budget.label}: ${detail}`);
  };
  require(result.width === budget.width &&
    result.height ===
      budget.height, `reported ${result.width}x${result.height}`);
  require(result.frames === budget.frames, `reported ${result.frames} frames`);
  require(Number.isFinite(result.msPerFrame) &&
    result.msPerFrame > 0 &&
    result.msPerFrame <=
      budget.maxMsPerFrame, `${result.msPerFrame}ms/frame exceeds ${budget.maxMsPerFrame}ms/frame`);
  require(oracle.peakAllocatedBytes > 0 &&
    peakPoolMiB <= budget.maxPeakPoolMiB &&
    oracle.peakAllocatedBytes <=
      result.configuredPoolBytes, `peak allocated pool ${peakPoolMiB.toFixed(2)}MiB exceeds ${budget.maxPeakPoolMiB}MiB`);
  require(measured.peakLeasedBytes > 0 &&
    measured.peakLeasedBytes <=
      measured.peakAllocatedBytes, `invalid peak leased bytes ${measured.peakLeasedBytes}`);
  require(warmup.allocations > 0 &&
    measured.allocations === warmup.allocations &&
    oracle.allocations <=
      budget.maxAllocations, `allocations changed during cached frames or exceeded the final ceiling (${warmup.allocations} -> ${measured.allocations} -> ${oracle.allocations}, max ${budget.maxAllocations})`);
  require(measured.reuses === warmup.reuses &&
    measured.allocations === warmup.allocations &&
    warmup.detaches > 0 &&
    measured.detaches ===
      warmup.detaches, `scratch work changed during cache-hit frames (reuses ${warmup.reuses} -> ${measured.reuses}, allocations ${warmup.allocations} -> ${measured.allocations}, detaches ${warmup.detaches} -> ${measured.detaches})`);
  require(oracleReuseDelta >= budget.minOraclePoolReuses &&
    oracle.allocations ===
      oracleWarmup.allocations, `second cache-disabled oracle reused ${oracleReuseDelta} surfaces with allocations ${oracleWarmup.allocations} -> ${oracle.allocations}; expected at least ${budget.minOraclePoolReuses} reuses and no allocation`);
  require(oracle.evictions <=
    budget.maxEvictions, `${oracle.evictions} evictions exceeds ${budget.maxEvictions}`);
  require(measured.failures === 0, `${measured.failures} pool failures`);
  require(oracle.leasedSurfaceCount === 0 &&
    oracle.leasedBytes ===
      0, `${oracle.leasedSurfaceCount} surfaces (${oracle.leasedBytes} bytes) remained leased`);
  require(result.pixelChecksum !==
    0, "paint probes produced an empty checksum");
  require(result.cacheDisabledOracleExact, `cached output differed from the cache-disabled oracle: ${result.cacheDisabledOracleDifference}`);
  require(result.replenishedPoolOracleExact, `cached output differed from the replenished-main-pool oracle: ${result.replenishedPoolOracleDifference}`);
  require(cacheWarmup.entries > 0 &&
    cacheWarmup.sets > 0 &&
    cacheWarmup.hits >
      0, `warmup did not populate and hit the static cache: ${JSON.stringify(cacheWarmup)}`);
  require(cacheMeasured.sets === cacheWarmup.sets &&
    cacheMeasured.misses === cacheWarmup.misses &&
    cacheMeasured.entries ===
      cacheWarmup.entries, `cache recaptured during measured frames: sets ${cacheWarmup.sets} -> ${cacheMeasured.sets}, misses ${cacheWarmup.misses} -> ${cacheMeasured.misses}, entries ${cacheWarmup.entries} -> ${cacheMeasured.entries}`);
  require(cacheHitDelta >=
    budget.frames *
      budget.minCacheHitsPerFrame, `only ${cacheHitDelta} measured cache hits, expected at least ${budget.frames * budget.minCacheHitsPerFrame}`);
  require(cacheMeasured.bytes > 0 &&
    cacheMeasured.bytes <= result.configuredStaticCacheBytes &&
    cacheMiB <=
      budget.maxStaticCacheMiB, `static cache ${cacheMiB.toFixed(2)}MiB exceeds ${budget.maxStaticCacheMiB}MiB`);
  require(cacheAdoptionFailures === 0 &&
    cacheMeasured.evictions === 0 &&
    cacheMeasured.bypasses ===
      0, `static cache failures/evictions/bypasses: ${JSON.stringify(cacheMeasured)}`);
  require(disposed.disposed &&
    disposed.surfaceCount === 0 &&
    disposed.allocatedBytes === 0 &&
    disposed.leasedBytes ===
      0, `pool did not dispose to zero: ${JSON.stringify(disposed)}`);
  require(result.hostSurfaceCount > 0 &&
    result.shrunkHostSurfaceCount ===
      result.hostSurfaceCount, `only ${result.shrunkHostSurfaceCount}/${result.hostSurfaceCount} host surfaces shrank to 1x1`);
  require(freshOraclePool.failures === 0 &&
    freshOraclePool.leasedSurfaceCount === 0 &&
    freshOraclePool.leasedBytes ===
      0, `fresh cache-disabled oracle pool did not release cleanly: ${JSON.stringify(freshOraclePool)}`);
  require(freshOracleDisposed.disposed &&
    freshOracleDisposed.surfaceCount === 0 &&
    freshOracleDisposed.allocatedBytes ===
      0, `fresh cache-disabled oracle pool did not dispose to zero: ${JSON.stringify(freshOracleDisposed)}`);
  require(result.oracleHostSurfaceCount > 0 &&
    result.shrunkOracleHostSurfaceCount ===
      result.oracleHostSurfaceCount, `only ${result.shrunkOracleHostSurfaceCount}/${result.oracleHostSurfaceCount} fresh oracle surfaces shrank to 1x1`);
  require(cacheDisposed.disposed &&
    cacheDisposed.entries === 0 &&
    cacheDisposed.bytes === 0 &&
    cacheDisposed.valueBytes ===
      0, `static cache did not dispose to zero: ${JSON.stringify(cacheDisposed)}`);
  return failures;
}
