// Regenerates the TikTok-captions caption track from preset calls instead of
// hand-written JSON. Run after `pnpm build`:
//   node examples/generate-tiktok.mjs > /tmp/tiktok-presets.json
import { tiktokCaptions } from "../packages/presets/dist/index.js";
import { validateScene } from "../packages/schema/dist/index.js";

const words = [
  { word: "FORGE", startMs: 800, endMs: 1600 },
  { word: "MOTION", startMs: 1600, endMs: 2400 },
  { word: "IN", startMs: 2400, endMs: 3200 },
  { word: "THE", startMs: 3200, endMs: 4000 },
  { word: "BROWSER", startMs: 4000, endMs: 5000 },
];

const scene = {
  schemaVersion: 1,
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 150,
  assets: {},
  nodes: [
    {
      id: "background",
      type: "div",
      style: {
        width: "100%",
        height: "100%",
        background: "linear-gradient(180deg, #101820 0%, #244f46 100%)",
      },
    },
    tiktokCaptions(words, {
      fps: 30,
      highlightIndices: [1, 4],
      area: { top: 760, height: 360 },
    }),
  ],
};

const result = validateScene(scene);

if (!result.ok) {
  console.error(result.errors.join("\n"));
  process.exit(1);
}

console.log(JSON.stringify(scene, null, 2));
