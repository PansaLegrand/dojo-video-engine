import { evaluateScene, layoutScene } from "@dojo-video-engine/core";
import {
  audioChunkRanges,
  evaluateVolumeEnvelope,
  loopedSourceRanges,
} from "@dojo-video-engine/export";
import { estimateMediaResources } from "@dojo-video-engine/renderer-canvas2d";
import type { Scene, SceneNode } from "@dojo-video-engine/schema";

type Check = {
  label: string;
  pass: boolean;
  detail?: string;
};

const checks: Check[] = [];

checkLongAudioChunks();
checkLoopedRanges();
checkVolumeEnvelopeOffsets();
checkManyNodeScene();
checkReachableBudgetEstimate();

const failed = checks.filter((entry) => !entry.pass);

for (const entry of checks) {
  console.log(
    `${entry.pass ? "ok" : "not ok"} ${entry.label}${entry.detail ? ` (${entry.detail})` : ""}`,
  );
}

if (failed.length > 0) {
  throw new Error(`${failed.length}/${checks.length} resource checks failed`);
}

console.log(`\nall ${checks.length} resource checks passed`);

function checkLongAudioChunks() {
  const fps = 30;
  const minutes = 10;
  const endFrame = minutes * 60 * fps - 1;
  const ranges = audioChunkRanges(0, endFrame, fps, 10);

  record(
    "audio chunks cover a 10-minute scene in 10s windows",
    ranges.length === 60 &&
      ranges[0]?.[0] === 0 &&
      ranges[0]?.[1] === 299 &&
      ranges.at(-1)?.[0] === endFrame - 299 &&
      ranges.at(-1)?.[1] === endFrame,
    `${ranges.length} chunks, last ${ranges.at(-1)?.join("-")}`,
  );

  const contiguous = ranges.every(
    ([start, end], index) =>
      end >= start &&
      (index === 0 || start === (ranges[index - 1]?.[1] ?? 0) + 1),
  );

  record("audio chunks are contiguous with no gaps", contiguous);
}

function checkLoopedRanges() {
  const ranges = loopedSourceRanges({
    start: 1.25,
    duration: 600,
    sourceDuration: 2.5,
    loop: true,
  });

  record(
    "looped audio splits a 10-minute bed into bounded source ranges",
    ranges.length === 241 &&
      ranges[0]?.sourceStart === 1.25 &&
      ranges[0]?.sourceEnd === 2.5 &&
      ranges.at(-1)?.sourceStart === 0 &&
      ranges.at(-1)?.sourceEnd === 1.25,
    `${ranges.length} ranges`,
  );

  const totalDuration = ranges.reduce(
    (sum, range) => sum + (range.sourceEnd - range.sourceStart),
    0,
  );

  record(
    "looped source ranges preserve requested output duration",
    Math.abs(totalDuration - 600) < 1e-6,
    `${totalDuration.toFixed(3)}s`,
  );
}

function checkVolumeEnvelopeOffsets() {
  const envelope = [
    { frame: 0, value: 0 },
    { frame: 30, value: 1, easing: "linear" },
    { frame: 300, value: 1 },
  ];

  record(
    "volumeEnvelope samples node-local chunk offsets",
    evaluateVolumeEnvelope(envelope, 0) === 0 &&
      evaluateVolumeEnvelope(envelope, 15) === 0.5 &&
      evaluateVolumeEnvelope(envelope, 300) === 1,
  );
}

function checkManyNodeScene() {
  const nodes: SceneNode[] = Array.from({ length: 1_000 }, (_, index) => ({
    id: `node-${index}`,
    type: "div",
    from: 0,
    duration: 300,
    style: {
      position: "absolute",
      left: (index % 40) * 8,
      top: Math.floor(index / 40) * 4,
      width: 6,
      height: 3,
      backgroundColor: index % 2 === 0 ? "#14b8a6" : "#f59e0b",
    },
    children: [],
  }));
  const scene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 300,
    assets: {},
    nodes,
  };
  const start = performance.now();
  const evaluated = evaluateScene(scene, 150);
  const laidOut = layoutScene(evaluated);
  const elapsed = performance.now() - start;

  record(
    "many-node evaluate/layout keeps every active node addressable",
    evaluated.nodes.length === 1_000 && laidOut.boxes.length === 1_000,
    `${elapsed.toFixed(1)}ms`,
  );
}

function checkReachableBudgetEstimate() {
  const scene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 300,
    assets: {
      clip: { id: "clip", type: "video", src: "clip.mp4" },
      unused: { id: "unused", type: "image", src: "unused.png" },
    },
    nodes: Array.from({ length: 12 }, (_, index) => ({
      id: `clip-${index}`,
      type: "video" as const,
      assetId: "clip",
      from: index * 5,
      duration: 60,
    })),
  };
  const estimate = estimateMediaResources(scene);
  record(
    "reachable resource estimate excludes unused declarations and counts decoder overlap",
    estimate.declaredAssets === 2 &&
      estimate.reachableAssets === 1 &&
      estimate.maxSimultaneousVideoDecoders === 12,
    `${estimate.reachableAssets}/${estimate.declaredAssets} assets, ${estimate.maxSimultaneousVideoDecoders} decoders`,
  );
}

function record(label: string, pass: boolean, detail?: string) {
  checks.push({ label, pass, detail });
}
