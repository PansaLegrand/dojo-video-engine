# Media Guide

MotionForge supports images, video, audio, fonts, and self-contained vector Lottie documents. Assets are explicit scene entries with fetchable `src` strings.

## Local Files

For CLI Studio and generated projects, put local files under `public/assets`:

```txt
public/assets/poster.png
public/assets/clip.mp4
public/assets/music.mp3
public/assets/Inter-Bold.woff2
public/assets/sticker.json
```

Reference them without `public/`:

```ts
import {
  audioAsset,
  imageAsset,
  publicAsset,
  videoAsset,
} from "@motionforge/authoring";

const poster = imageAsset("poster", publicAsset("assets/poster.png"));
const clip = videoAsset("clip", publicAsset("assets/clip.mp4"));
const music = audioAsset("music", publicAsset("assets/music.mp3"));
```

`publicAsset("assets/clip.mp4")` emits `/assets/clip.mp4`. The final scene JSON is portable because it contains explicit URLs, not an implicit project-relative resolver.

Absolute URLs are allowed:

```ts
const clip = videoAsset("clip", "https://cdn.example.com/clip.mp4");
```

## Images

```ts
import { image, seconds } from "@motionforge/authoring";
import { mediaLook } from "@motionforge/presets";

image(poster, {
  duration: seconds(5),
  objectFit: "cover",
  style: {
    left: 0,
    top: 0,
    width: 1920,
    height: 1080,
    ...mediaLook("cleanProduct"),
  },
});
```

`objectFit` supports `contain`, `cover`, `fill`, `none`, and `scale-down`. `objectPosition` accepts CSS-like positions such as `"center center"` or `"50% 20%"`.

## Video

```ts
import { seconds, videoClip } from "@motionforge/authoring";

videoClip(clip, {
  at: seconds(0),
  duration: seconds(5),
  trimStart: seconds(5),
  playbackRate: 1,
  volume: 0.8,
});
```

`trimStart` is in source seconds. Video nodes contribute their clip soundtrack to export when the clip has audio. `playbackRate` retimes picture and sound together.

## Audio

```ts
import { audioTrack, seconds } from "@motionforge/authoring";

audioTrack(music, {
  at: seconds(0),
  duration: seconds(8),
  trimStart: seconds(12),
  volume: 0.35,
});
```

Audio preview is best-effort in browsers; exported MP4 audio is mixed through the same pure mixer path.

## Fonts

Font assets register under their asset id:

```ts
import {
  defineAssets,
  makeScene,
  publicAsset,
  seconds,
} from "@motionforge/authoring";

export default makeScene({
  size: "portrait",
  duration: seconds(5),
  assets: defineAssets({
    id: "Inter-Bold",
    type: "font",
    src: publicAsset("assets/Inter-Bold.woff2"),
  }),
  children: [],
});
```

Then reference `fontFamily: "Inter-Bold"`. Use one asset id per family and weight when pixel-exact text matters.

## Lottie

Lottie assets must be self-contained vector JSON. Expressions and external image layers are rejected to preserve deterministic rendering.

```json
{ "id": "sticker", "type": "lottie", "src": "/assets/sticker.json" }
```

## Current Limits

- Large video/audio files are fetched into memory as whole blobs before decode.
- Streaming sources are deferred until real projects force the complexity.
- A failed fetch or decode rejects; MotionForge does not silently render placeholders.
- Rendering a media node without resolved assets throws with the missing asset id and fix.

## Named Looks

`@motionforge/presets` ships named media looks that compile to plain style fragments:

```ts
mediaLook("punchySocial");
mediaLook("cinematicWarm");
mediaLook("coolNoir");
mediaLook("retroTape");
mediaLook("softPortrait");
mediaLook("blurredBackdrop");
```

These use the supported Canvas2D `filter` subset. Preview/export preflight
rejects a Canvas runtime that cannot paint filters instead of silently dropping
the look.

## Clip Layouts

Clip layouts are named style fragments for common media placement:

```ts
import { clipLayout, mediaLook } from "@motionforge/presets";

videoClip(clip, {
  style: {
    ...clipLayout("pictureInPicture"),
    ...mediaLook("cleanProduct"),
  },
});
```

Useful layout keys include `fullscreen`, `containCenter`, `pictureInPicture`, `splitLeft`, `splitRight`, the four `grid...` cells, `blurredBackground`, and `phoneSafeVertical`.
