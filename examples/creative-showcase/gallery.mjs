// Assemble README navigation media from actual exported films, using FFmpeg.
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = resolve(root, "docs/assets/showcase");
const studies = process.argv.includes("--studies");
for (const flag of process.argv.slice(2))
  if (flag !== "--studies") throw new Error(`Unknown option: ${flag}`);
const name = studies ? "showoff" : "gallery";
const duration = studies ? 4 : 2;
const entries = studies
  ? [
      ["city", "MINIATURE WORLDS", 4],
      ["precision", "EXPLODED ASSEMBLY", 3.5],
      ["bloom", "KINETIC VECTOR ART", 6],
    ]
  : [
      ["journey", "ILLUSTRATED STORY", 4.5],
      ["data-story", "DATA & REPORTS", 1.5],
      ["kinetic", "PORTRAIT MOTION POSTER", 8.5],
      ["cinema", "CINEMATIC TITLES", 4],
      ["festival", "FESTIVE 3D", 1.5],
      ["company", "COMPANY LAUNCH", 8.5],
    ];
const run = (args) =>
  execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "pipe" });
const fit =
  "scale=640:360:force_original_aspect_ratio=decrease:flags=lanczos,pad=640:400:(ow-iw)/2:(360-ih)/2:color=0x101018";
for (const [id, label] of entries)
  run([
    "-i",
    resolve(output, `${id}.png`),
    "-vf",
    `${fit},drawtext=text='${label}':fontcolor=0xf5f2e9:fontsize=18:x=20:y=372`,
    "-frames:v",
    "1",
    resolve(output, `${id}-card.png`),
  ]);
const inputCards = entries.flatMap(([id]) => [
  "-i",
  resolve(output, `${id}-card.png`),
]);
run([
  ...inputCards,
  "-filter_complex",
  entries.map((_, i) => `[${i}:v]`).join("") +
    `xstack=inputs=${entries.length}:layout=` +
    entries
      .map((_, i) => `${(i % 3) * 640}_${Math.floor(i / 3) * 400}`)
      .join("|") +
    ",scale=1280:-1[out]",
  "-map",
  "[out]",
  "-frames:v",
  "1",
  resolve(output, `${name}.png`),
]);
const inputVideos = entries.flatMap(([id]) => [
  "-i",
  resolve(output, `${id}.mp4`),
]);
const parts = entries.map(
  ([, label, start], i) =>
    `[${i}:v]trim=start=${start}:duration=${duration},setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease:flags=lanczos,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x101018,setsar=1,fps=30,drawbox=x=0:y=680:w=1280:h=40:color=0x101018:t=fill,drawtext=text='${label}':fontcolor=0xf5f2e9:fontsize=18:x=24:y=692[v${i}]`,
);
parts.push(
  entries.map((_, i) => `[v${i}]`).join("") +
    `concat=n=${entries.length}:v=1:a=0[out]`,
);
run([
  ...inputVideos,
  "-filter_complex",
  parts.join(";"),
  "-map",
  "[out]",
  "-an",
  "-c:v",
  "libx264",
  "-crf",
  "20",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  resolve(output, `${name}.mp4`),
]);
run([
  "-i",
  resolve(output, `${name}.mp4`),
  "-filter_complex",
  "fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=bayer:bayer_scale=3",
  "-loop",
  "0",
  resolve(output, `${name}.gif`),
]);
console.log(`Built ${entries.length} category cards and ${name} poster/reel.`);
