// This oracle uses FFmpeg and explicit expected media, never engine evaluation.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const run = (command, args) =>
  execFileSync(command, args, { maxBuffer: 128 * 1024 * 1024 });
const file = "output/edited.mp4";
const metadata = JSON.parse(
  run("ffprobe", [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    file,
  ]),
);
const video = metadata.streams.find((s) => s.codec_type === "video");
assert.equal(video.width, 640);
assert.equal(video.height, 360);
assert.equal(video.nb_frames, "120");
assert.equal(video.avg_frame_rate, "30/1");
assert.ok(Math.abs(Number(metadata.format.duration) - 4) < 0.08);
assert.ok(metadata.streams.some((s) => s.codec_type === "audio"));
const rgb = run("ffmpeg", [
  "-v",
  "error",
  "-i",
  file,
  "-an",
  "-f",
  "rawvideo",
  "-pix_fmt",
  "rgb24",
  "pipe:1",
]);
const stride = 640 * 360 * 3;
assert.equal(rgb.length, stride * 120, "all frames must decode");
const expected = (frame) =>
  frame < 30
    ? [0, 255, 0]
    : frame < 60
      ? [0, 0, 255]
      : frame < 75
        ? [255, 0, 255]
        : frame < 105
          ? [0, 255, 255]
          : [255, 255, 0];
const pixel = (bytes, frame, x, y) => [
  ...bytes.subarray(
    frame * stride + (y * 640 + x) * 3,
    frame * stride + (y * 640 + x) * 3 + 3,
  ),
];
function checkColor(actual, frame) {
  const allowed = [-1, 0, 1].map((d) =>
    expected(Math.max(0, Math.min(119, frame + d))),
  );
  assert.ok(
    allowed.some((color) =>
      color.every((value, channel) => Math.abs(value - actual[channel]) < 25),
    ),
    `wrong clip/trim at ${frame}: ${actual}`,
  );
}
for (let frame = 0; frame < 120; frame++)
  checkColor(pixel(rgb, frame, 320, 180), frame);
assert.throws(
  () => checkColor([255, 0, 0], 15),
  "oracle must reject the untrimmed first clip",
);
// White glyphs must appear in the title window and disappear with the title.
function whitePixels(frame) {
  let count = 0;
  for (let y = 20; y < 90; y++)
    for (let x = 24; x < 616; x++) {
      if (pixel(rgb, frame, x, y).every((value) => value > 210)) count++;
    }
  return count;
}
assert.ok(whitePixels(15) > 150, "title glyphs missing");
assert.equal(whitePixels(90), 0, "title must end after two seconds");
const render = JSON.parse(readFileSync("output/render-report.json", "utf8"));
for (const frame of render.frames) {
  const preview = run("ffmpeg", [
    "-v",
    "error",
    "-i",
    `output/frame-${frame}.png`,
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "pipe:1",
  ]);
  checkColor(pixel(preview, 0, 320, 180), frame);
}
const audio = run("ffmpeg", [
  "-v",
  "error",
  "-i",
  file,
  "-vn",
  "-af",
  "pan=mono|c0=c0",
  "-ar",
  "48000",
  "-f",
  "f32le",
  "pipe:1",
]);
function amplitude(start, end, frequency) {
  let re = 0,
    im = 0;
  const low = Math.round(start * 48000),
    high = Math.round(end * 48000);
  assert.ok(audio.length >= high * 4, "missing audio tail");
  for (let i = low; i < high; i++) {
    const value = audio.readFloatLE(i * 4),
      phase = (2 * Math.PI * frequency * i) / 48000;
    re += value * Math.cos(phase);
    im += value * Math.sin(phase);
  }
  return (2 * Math.hypot(re, im)) / (high - low);
}
const measured = [];
for (const [start, end, voice, absent] of [
  [0.25, 0.75, 440, 880],
  [1.25, 1.75, 440, 880],
  [2.25, 2.75, 880, 440],
  [3.25, 3.75, 880, 440],
]) {
  const clipAmplitude = amplitude(start, end, voice),
    musicAmplitude = amplitude(start, end, 220);
  assert.ok(
    Math.abs(20 * Math.log10(clipAmplitude / 0.0625)) < 1,
    `clip gain mismatch: ${clipAmplitude}`,
  );
  assert.ok(
    Math.abs(20 * Math.log10(musicAmplitude / 0.025)) < 1,
    `music gain mismatch: ${musicAmplitude}`,
  );
  assert.ok(
    amplitude(start, end, absent) < 0.003,
    "wrong clip audio leaks across cut",
  );
  measured.push({ start, end, voice, clipAmplitude, musicAmplitude });
}
const hash = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
assert.equal(
  hash("scene.json"),
  render.sceneSha256,
  "report must bind to the current scene",
);
assert.equal(render.verification.status, "verified");
const report = {
  status: "passed",
  dimensions: [640, 360],
  fps: 30,
  frames: 120,
  duration: Number(metadata.format.duration),
  previewFrames: render.frames,
  titleWhitePixels: whitePixels(15),
  audio: measured,
  hashes: Object.fromEntries(
    [
      "scene.json",
      "public/a.mp4",
      "public/b.mp4",
      "public/music.wav",
      file,
      "pnpm-lock.yaml",
    ].map((path) => [path, hash(path)]),
  ),
  environment: {
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    browser: render.browser,
    ffmpeg: run("ffmpeg", ["-version"]).toString().split("\n")[0],
  },
};
writeFileSync(
  "output/verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
