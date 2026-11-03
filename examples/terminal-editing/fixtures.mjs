// Independently generated, redistributable fixtures; no model/provider calls.
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

mkdirSync("public", { recursive: true });
for (const [name, colors, frequency] of [
  ["a", ["red", "lime", "blue"], 440],
  ["b", ["magenta", "cyan", "yellow"], 880],
]) {
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      ...colors.flatMap((color) => [
        "-f",
        "lavfi",
        "-i",
        `color=c=${color}:s=640x360:r=30:d=1`,
      ]),
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${frequency}:sample_rate=48000:duration=3`,
      "-filter_complex",
      "[0:v][1:v][2:v]concat=n=3:v=1:a=0,scale=in_color_matrix=bt601:out_color_matrix=bt709[v]",
      "-map",
      "[v]",
      "-map",
      "3:a",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-colorspace",
      "bt709",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-c:a",
      "aac",
      "-shortest",
      `public/${name}.mp4`,
    ],
    { stdio: "inherit" },
  );
}
execFileSync(
  "ffmpeg",
  [
    "-v",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=220:sample_rate=48000:duration=4",
    "public/music.wav",
  ],
  { stdio: "inherit" },
);
console.log("Created two three-second clips and a four-second music tone.");
