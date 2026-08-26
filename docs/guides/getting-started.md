# Getting Started

Build a MotionForge video in about five minutes: write TypeScript scene data, preview it in Studio, export MP4 in the browser.

```sh
# From a MotionForge source checkout, retain a locally packed starter:
pnpm install
pnpm build
pnpm verify:clean -- --keep
# Continue in the printed .../motionforge-clean-machine-.../starter directory.

# Use this only after the scoped package is visibly published and verified:
# pnpm dlx @motionforge/create hello-video
# cd hello-video && pnpm install && pnpm dev
```

`pnpm dev` runs:

```sh
motionforge dev src/video.ts
```

Studio validates the scene module, renders it on Canvas2D, lets you scrub frames, inspect the generated JSON, reload source changes, and export MP4 when the browser supports WebCodecs.

Until the packages are published, clean installs outside this monorepo need
local tarballs because workspace packages use `workspace:*` internally and the
generated starter names registry versions. `verify:clean --keep` performs that
pack/install path and preserves the working project. The API below is the
tested 1.1 source-candidate shape.

## Write A Scene

The starter creates `src/video.ts`:

```ts
import {
  bg,
  fadeUp,
  image,
  imageAsset,
  makeScene,
  publicAsset,
  seconds,
  textBlock,
  title,
} from "@motionforge/authoring";

const logo = imageAsset("logo", publicAsset("assets/logo.svg"));

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [
    bg("#0f172a"),
    image(logo, {
      at: seconds(0.2),
      duration: seconds(4.6),
      style: { left: 432, top: 360, width: 216, height: 216 },
      enter: fadeUp({ durationInFrames: 10 }),
    }),
    title("Hello MotionForge", {
      at: seconds(0.8),
      duration: seconds(3.5),
      enter: fadeUp(),
    }),
    textBlock("Write deterministic video as TypeScript data.", {
      at: seconds(1.4),
      duration: seconds(3),
      enter: fadeUp({ delay: 6 }),
    }),
  ],
});
```

`makeScene()` returns plain scene JSON. You can validate it, print it, diff it, patch it, store it, preview it, or export it.

## Add Robust Text And Subtitles

Use `textBox()` when the final copy length is unknown, and `subtitleTrack()` when subtitles come from SRT, WebVTT, transcripts, or chat-generated cue lists:

```ts
import {
  makeScene,
  parseSrt,
  seconds,
  subtitleTrack,
  textBox,
} from "@motionforge/authoring";

const subtitles = parseSrt(`1
00:00:00,500 --> 00:00:02,200
I love this

2
00:00:02,500 --> 00:00:04,800
Long subtitle text stays inside the safe area`);

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [
    textBox("A title that can safely come from a prompt or CMS", {
      placement: "title",
      maxLines: 2,
    }),
    subtitleTrack(subtitles, {
      template: "minimalBar",
      maxLines: 2,
    }),
  ],
});
```

Use `captionTrack()` instead when ASR gives word-level timings such as `{ word, startMs, endMs }[]`.

## Useful Commands

```sh
pnpm dev       # Studio preview
pnpm validate  # schema validation
pnpm print     # formatted generated scene JSON
pnpm migrate   # migration metadata and canonical Scene v1
pnpm inspect   # scene metadata and capability JSON
pnpm lint      # valid-but-suspicious scene warnings
pnpm build     # TypeScript check + validation
```

The raw CLI commands are:

```sh
motionforge dev src/video.ts
motionforge validate src/video.ts
motionforge print src/video.ts
motionforge migrate src/video.ts
motionforge inspect src/video.ts
motionforge lint src/video.ts
```

Scene modules may be `.json`, `.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, or `.cts`. They can export a scene object, a function returning a scene, or a promise.

## Add Media

Put files under `public/assets`:

```txt
public/assets/logo.svg
public/assets/clip.mp4
public/assets/music.mp3
```

Reference them with `publicAsset("assets/file.ext")`. The emitted scene JSON stores fetchable URLs such as `/assets/clip.mp4`.

```ts
import {
  audioAsset,
  audioTrack,
  makeScene,
  publicAsset,
  seconds,
  videoAsset,
  videoClip,
} from "@motionforge/authoring";

const clip = videoAsset("clip", publicAsset("assets/clip.mp4"));
const music = audioAsset("music", publicAsset("assets/music.mp3"));

export default makeScene({
  size: "landscape",
  fps: 30,
  duration: seconds(5),
  children: [
    videoClip(clip, {
      trimStart: seconds(5),
      duration: seconds(3),
      volume: 0.8,
    }),
    audioTrack(music, {
      at: seconds(0),
      duration: seconds(5),
      volume: 0.35,
    }),
  ],
});
```

## What To Read Next

- [Authoring API](authoring-api.md)
- [Animation Guide](animation.md)
- [Media Guide](media.md)
- [Preview And Export](preview-export.md)
- [MotionForge vs Remotion](motionforge-vs-remotion.md)
- [Agent-Generated Scenes](agent-generated-scenes.md)
- [Full Scene Format](../scene-format.md)
