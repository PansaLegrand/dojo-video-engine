# Authoring API

`@dojo-video-engine/authoring` is the high-level TypeScript layer. It reduces boilerplate but still emits the same validated Dojo Video Engine scene JSON.

Use this package first for programmer-facing videos: `textBox()` handles unknown-length overlay copy, `subtitleTrack()` handles SRT/VTT-style subtitle cues, and `captionTrack()` handles word-timed ASR captions while keeping the output as ordinary scene nodes.

## Scene

```ts
import {
  frames,
  makeScene,
  seconds,
  toFrames,
  toSeconds,
} from "@dojo-video-engine/authoring";

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [],
});
```

`size` accepts:

- `"portrait"` -> `1080x1920`
- `"landscape"` -> `1920x1080`
- `"square"` -> `1080x1080`
- `{ width, height }`

Timing helpers:

```ts
seconds(2.5);
frames(75);
toFrames(seconds(2.5), 30); // 75
toSeconds(frames(75), 30); // 2.5
```

Bare numbers are not timing values. Use `seconds()` for readability or `frames()` for exact control.

## Visual Nodes

```ts
bg("#0f172a");

title("Launch Week", {
  at: seconds(0.5),
  duration: seconds(3),
  enter: fadeUp(),
});

textBlock("Three updates. One clean video.", {
  at: seconds(1.2),
  style: { top: 980, color: "#cbd5e1" },
});

box({
  id: "card",
  at: seconds(1),
  style: {
    left: 96,
    top: 360,
    width: 888,
    height: 420,
    backgroundColor: "#ffffff",
    borderRadius: 28,
  },
});
```

Every helper accepts `id`, `at`, `duration`, and most visual helpers accept `style` and `enter`.

## Robust Text Overlays

Use `textBox()` when copy may come from users, chat instructions, CSV rows, or any other source where the final length is not known ahead of time. It emits ordinary text nodes with bounded dimensions, `textFit`, `maxLines`, `minFontSize`, and ellipsis behavior already set.

```ts
import { bg, makeScene, seconds, textBox } from "@dojo-video-engine/authoring";

export default makeScene({
  size: "portrait",
  duration: seconds(6),
  children: [
    bg("#111827"),
    textBox("Launch Week: every update in under one minute", {
      id: "headline",
      placement: "title",
      maxLines: 2,
    }),
    textBox("I love this", {
      id: "subtitle",
      placement: "subtitle",
      fit: "shrink",
      minFontSize: 24,
    }),
    textBox("Ada Chen\nProduct Lead", {
      id: "speaker",
      placement: "lowerThird",
      safeArea: { x: 96, y: 120 },
    }),
    textBox("42%", {
      id: "stat",
      placement: "statCallout",
      maxLines: 1,
      style: { color: "#fde68a" },
    }),
  ],
});
```

`placement` accepts `"center"`, `"top"`, `"bottom"`, `"title"`, `"subtitle"`, `"lowerThird"`, and `"statCallout"`. `safeArea` defaults to the named profile inferred from composition aspect ratio: `"vertical"`, `"square"`, or `"landscape"`. Pass one of those names, a number for equal padding, `{ x, y }` for axis padding, edge-specific values, or `false` for full-frame placement.

When you need the placement box without creating a text node, use the same primitives directly:

```ts
import { resolveSafeArea, safeAreaBox } from "@dojo-video-engine/authoring";

const size = { width: 1080, height: 1920 };

resolveSafeArea(size, "vertical");
safeAreaBox(size, "lowerThird", { widthRatio: 0.72 });
```

The defaults are intentionally production-safe:

- `fit: "shrink"` keeps long text inside the box.
- `textOverflow: "ellipsis"` preserves a visible ending when text is clamped.
- `overflow: "hidden"` prevents accidental bleed into neighboring overlays.
- `style` remains an escape hatch and overrides all generated defaults.

## Subtitle Tracks

Use `subtitleTrack()` for sentence- or line-timed subtitles such as SRT, WebVTT, transcript segments, or chat-generated cue lists. It emits a timed container with bounded text nodes, safe-area subtitle placement, shrink-to-fit, `maxLines`, and ellipsis defaults.

Paste SRT directly when the subtitle file is small or generated with the scene:

```ts
import {
  makeScene,
  parseSrt,
  seconds,
  subtitleTrack,
  videoAsset,
  videoClip,
} from "@dojo-video-engine/authoring";

const clip = videoAsset("clip", "/assets/interview.mp4");
const subtitles = parseSrt(`1
00:00:00,500 --> 00:00:02,100
Welcome to Dojo Video Engine

2
00:00:02,400 --> 00:00:04,600
Programmatic video, plain TypeScript`);

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(6),
  children: [
    videoClip(clip, { duration: seconds(6) }),
    subtitleTrack(subtitles, {
      template: "minimalBar",
      maxLines: 2,
    }),
  ],
});
```

Paste WebVTT the same way:

```ts
import { parseVtt, subtitleTrack } from "@dojo-video-engine/authoring";

subtitleTrack(
  parseVtt(`WEBVTT

00:00:00.000 --> 00:00:01.500 align:center
First cue

00:00:01.800 --> 00:00:03.200
Second cue`),
  { template: "cinematic" },
);
```

Manual segments are useful when chat, a CMS, or your own code already has cue timing:

```ts
subtitleTrack(
  [
    {
      text: "Keep only the strong opening.",
      startSeconds: 0.5,
      endSeconds: 2.2,
    },
    {
      text: "Then let the full second thought land.",
      startSeconds: 2.5,
      endSeconds: 5.8,
    },
  ],
  {
    idPrefix: "story-subs",
    template: "classic",
    style: { fontSize: 62 },
  },
);
```

Use `captionTrack()` when ASR gives word-level timings and you want TikTok/karaoke-style templates:

```ts
import { captionTrack } from "@dojo-video-engine/authoring";

captionTrack(
  [
    { word: "Natural", startMs: 0, endMs: 360 },
    { word: "language", startMs: 380, endMs: 820 },
    { word: "video", startMs: 840, endMs: 1240 },
  ],
  {
    template: "spotlight",
    renderMode: "word",
  },
);
```

Subtitle templates share the preset names from the [Preset Catalog](preset-catalog.md), including `"classic"`, `"minimalBar"`, `"cinematic"`, `"spotlight"`, `"karaoke"`, `"future"`, and `"terminal"`. `area` can manually place the track, while the default uses the scene size and safe-area subtitle band.

## Image Overlays

Use `imageOverlay()` when an image is part of the composition UI rather than the full background: logos, watermarks, stickers, product shots, corner badges, and avatars. Passing an image asset object auto-adds it to `scene.assets`.

```ts
import {
  imageAsset,
  imageOverlay,
  makeScene,
  publicAsset,
  seconds,
} from "@dojo-video-engine/authoring";

const logo = imageAsset("logo", publicAsset("assets/logo.svg"));
const product = imageAsset("product", publicAsset("assets/product.png"));

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(6),
  children: [
    imageOverlay(logo, {
      id: "logo-bug",
      template: "logoBug",
    }),
    imageOverlay(product, {
      id: "product-card",
      template: "productShot",
      at: seconds(0.4),
      duration: seconds(5),
      objectFit: "contain",
    }),
  ],
});
```

You can also pass an existing image asset id when assets are defined elsewhere:

```ts
imageOverlay("avatar", {
  template: "avatarBadge",
  placement: "lowerThird",
  objectPosition: "center top",
});
```

Template keys are listed in the [Preset Catalog](preset-catalog.md). `style` controls the wrapper box; `imageStyle`, `objectFit`, and `objectPosition` control the inner `img` node.

## Video Overlays

Use `videoOverlay()` when a clip is part of the composition UI rather than the main sequence: picture-in-picture demos, reaction cameras, screen recordings, muted background loops, b-roll strips, and compact video badges. Passing a video asset object auto-adds it to `scene.assets`.

```ts
import {
  makeScene,
  publicAsset,
  seconds,
  videoAsset,
  videoOverlay,
} from "@dojo-video-engine/authoring";

const demo = videoAsset("demo", publicAsset("assets/demo.mp4"));
const reaction = videoAsset("reaction", publicAsset("assets/reaction.mp4"));

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(8),
  children: [
    videoOverlay(demo, {
      id: "demo-pip",
      template: "pictureInPicture",
      trimStart: seconds(4),
      duration: seconds(5),
    }),
    videoOverlay(reaction, {
      id: "reaction-cam",
      template: "reactionCam",
      volume: 0.65,
      at: seconds(1),
      duration: seconds(6),
    }),
  ],
});
```

You can also pass an existing video asset id when assets are defined elsewhere:

```ts
videoOverlay("screen", {
  template: "screenDemo",
  objectFit: "contain",
  playbackRate: 1.25,
});
```

Decorative templates default to muted output (`volume: 0`); `reactionCam` keeps clip audio unless you pass `muted: true`. Template keys are listed in the [Preset Catalog](preset-catalog.md). `trimStart` is in source seconds, while `at` and `duration` compile from authoring time values to frame integers.

## Audio Overlays

Use `audioOverlay()` when an audio asset has a role in the composition: background music, voiceover, ambience, one-shot sound effects, beat accents, and notification cues. Passing an audio asset object auto-adds it to `scene.assets`.

```ts
import {
  audioAsset,
  audioOverlay,
  makeScene,
  publicAsset,
  seconds,
} from "@dojo-video-engine/authoring";

const music = audioAsset("music", publicAsset("assets/music.mp3"));
const voice = audioAsset("voice", publicAsset("assets/voiceover.mp3"));
const ping = audioAsset("ping", publicAsset("assets/ping.wav"));

export default makeScene({
  size: "landscape",
  fps: 30,
  duration: seconds(8),
  children: [
    audioOverlay(music, {
      id: "music-bed",
      template: "backgroundMusic",
      duration: seconds(8),
      fadeIn: seconds(0.75),
      fadeOut: seconds(1),
      loop: true,
      volume: 0.22,
    }),
    audioOverlay(voice, {
      id: "voiceover",
      template: "voiceover",
      at: seconds(1),
      duration: seconds(5),
      trimStart: seconds(2.5),
    }),
    audioOverlay(ping, {
      id: "ping",
      template: "notificationPing",
      at: seconds(6.2),
    }),
  ],
});
```

You can also pass an existing audio asset id when assets are defined elsewhere:

```ts
audioOverlay("ambience", {
  template: "ambientBed",
  duration: seconds(12),
  volume: 0.18,
});
```

Template keys are listed in the [Preset Catalog](preset-catalog.md). `trimStart` is in source seconds, while `at`, `duration`, `fadeIn`, and `fadeOut` compile from authoring time values to frame integers. Fades emit `volumeEnvelope` data on the audio node, and `loop: true` repeats source audio through the node duration. Ducking is still future engine work.

## Media Nodes

```ts
import {
  audioAsset,
  audioTrack,
  image,
  imageAsset,
  makeScene,
  publicAsset,
  seconds,
  videoAsset,
  videoClip,
} from "@dojo-video-engine/authoring";

const poster = imageAsset("poster", publicAsset("assets/poster.png"));
const clip = videoAsset("clip", publicAsset("assets/clip.mp4"));
const music = audioAsset("music", publicAsset("assets/music.mp3"));

makeScene({
  size: "landscape",
  duration: seconds(8),
  children: [
    image(poster),
    videoClip(clip, {
      at: seconds(1),
      duration: seconds(4),
      trimStart: seconds(5),
      playbackRate: 1.25,
      volume: 0.5,
    }),
    audioTrack(music, {
      duration: seconds(8),
      volume: 0.25,
    }),
  ],
});
```

Passing an asset object to `image()`, `videoClip()`, or `audioTrack()` auto-adds it to `scene.assets`. You can also pass a string asset id when assets are defined elsewhere:

```ts
import {
  defineAssets,
  makeScene,
  seconds,
  videoAsset,
  videoClip,
} from "@dojo-video-engine/authoring";

makeScene({
  size: "landscape",
  duration: seconds(8),
  assets: defineAssets(videoAsset("clip", "/assets/clip.mp4")),
  children: [videoClip("clip", { duration: seconds(4) })],
});
```

## Escape Hatch

The lower-level packages remain available when you need exact control:

```ts
import { composition, div, text } from "@dojo-video-engine/core";

const scene = composition({ width: 1080, height: 1920, fps: 30, duration: 90 })
  .children(
    div({
      style: { width: "100%", height: "100%", backgroundColor: "#111827" },
    }),
    text("Hello", {
      style: {
        position: "absolute",
        left: 64,
        top: 720,
        fontSize: 96,
        color: "#fff",
      },
    }),
  )
  .toJSON();
```

Use the [scene format](../scene-format.md) when you need the complete property matrix.
