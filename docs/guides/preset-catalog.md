# Preset Catalog

Dojo Video Engine presets are stable names that compile to normal scene data. Use this page as the quick lookup table for programmers, apps, and agents.

## Subtitle Templates

Use `styledCaptions(words, { fps, template })` for ASR word timings, or `subtitleTrack(segments, { fps, template })` for SRT/VTT-style subtitle cues.

![Subtitle template gallery](../assets/presets/preset-subtitles-f45.png)

| Key           | Best For                                                |
| ------------- | ------------------------------------------------------- |
| `classic`     | Clean readable subtitles with a strong outline          |
| `minimalBar`  | Compact pill-backed captions                            |
| `handwritten` | Friendly casual narration                               |
| `retro`       | Vintage golden title/subtitle energy                    |
| `cinematic`   | Premium serif captions with restrained backing          |
| `storyteller` | Warm interview or recap narration                       |
| `hustle`      | One-word punch captions with red active badges          |
| `spotlight`   | Short-form captions with bright active pills            |
| `karaoke`     | Full-line captions with active-word emphasis            |
| `neon`        | Electric captions with glow                             |
| `future`      | Clean tech subtitles                                    |
| `terminal`    | Code-inspired green captions                            |
| `colorShift`  | High-contrast karaoke captions with color-only emphasis |

```ts
scene.nodes.push(
  styledCaptions(words, {
    fps: 30,
    template: "spotlight",
  }),
);
```

```ts
scene.nodes.push(
  subtitleTrack(
    [
      { text: "First subtitle.", startSeconds: 0.4, endSeconds: 2.1 },
      { text: "Second subtitle.", startSeconds: 2.4, endSeconds: 4.2 },
    ],
    {
      fps: 30,
      template: "minimalBar",
      composition: { width: scene.width, height: scene.height },
    },
  ),
);
```

Segment subtitle tracks use the same template names as word-timed captions, but their text nodes always add production-safe bounds: `width: "100%"`, `height: "100%"`, `overflow: "hidden"`, `textFit: "shrink"`, `textOverflow: "ellipsis"`, `maxLines: 2`, and a template-derived `minFontSize`. Pass `maxLines`, `minFontSize`, `textFit`, `textOverflow`, or `style` when a project needs stricter manual control.

## Text Overlay Templates

Use with `textOverlay({ template })`.

![Text overlay template gallery](../assets/presets/preset-text-overlays-f45.png)

| Key                  | Required Text | Best For                       |
| -------------------- | ------------- | ------------------------------ |
| `titleCard`          | `title`       | Opening title stacks           |
| `lowerThird`         | `title`       | Speaker labels, subject labels |
| `quoteCard`          | `body`        | Pull quotes and testimonials   |
| `statCallout`        | `value`       | Metrics and numeric proof      |
| `announcementBanner` | `title`       | Launch, sale, or alert strips  |
| `socialHook`         | `title`       | Short-form hook text           |
| `chapterTitle`       | `title`       | Section breaks                 |

Text overlay slots use robust bounded text defaults: shrink-to-fit, ellipsis, hidden overflow, and slot-specific `maxLines`. Pass `composition` to opt into safe-area placement, and override any generated slot style through `titleStyle`, `bodyStyle`, `subtitleStyle`, and related style options.

```ts
scene.nodes.push(
  textOverlay({
    template: "lowerThird",
    title: "Ada Lovelace",
    subtitle: "Programmer",
    composition: { width: scene.width, height: scene.height },
    from: 30,
    duration: 120,
  }),
);
```

## Image Overlay Templates

Use with `imageOverlay({ assetId, template })`. Image overlays emit ordinary wrapper `div` nodes with one `img` child, so apps and agents can patch placement, timing, object fit, opacity, shadows, and crop styles by id.

| Key           | Best For                                      |
| ------------- | --------------------------------------------- |
| `logoBug`     | Small brand marks in a safe top corner        |
| `watermark`   | Subtle persistent lower-corner branding       |
| `sticker`     | Transparent stickers, badges, and decorations |
| `productShot` | Large product or app screenshots              |
| `cornerBadge` | Rounded badges, awards, and CTA images        |
| `avatarBadge` | Circular speaker or channel portraits         |

```ts
scene.nodes.push(
  imageOverlay({
    assetId: "logo",
    template: "logoBug",
    composition: { width: scene.width, height: scene.height },
  }),
);
```

Templates use shared safe-area placement and set conservative `objectFit` defaults. Pass `placement`, `style`, `imageStyle`, `objectFit`, `objectPosition`, `opacity`, `borderRadius`, `shadow`, or `enter` when a project needs stricter control.

## Video Overlay Templates

Use with `videoOverlay({ assetId, template })`. Video overlays emit ordinary `video` nodes, so apps and agents can patch placement, timing, source trim, playback rate, volume, object fit, opacity, shadows, and crop styles by id.

| Key                | Best For                                   |
| ------------------ | ------------------------------------------ |
| `pictureInPicture` | Small inset video clips                    |
| `reactionCam`      | Talking-head or reaction camera overlays   |
| `screenDemo`       | Large contained app/product walkthroughs   |
| `backgroundLoop`   | Muted full-frame looping-style backgrounds |
| `brollStrip`       | Wide editorial supplemental footage        |
| `videoBadge`       | Compact rounded live/proof video badges    |

```ts
scene.nodes.push(
  videoOverlay({
    assetId: "clip",
    template: "pictureInPicture",
    composition: { width: scene.width, height: scene.height },
    trimStart: 4,
    duration: 120,
  }),
);
```

Decorative templates default to muted output (`volume: 0`); `reactionCam` keeps clip audio unless muted. Pass `volume`, `muted`, `trimStart`, `playbackRate`, `placement`, `style`, `videoStyle`, `objectFit`, `objectPosition`, `opacity`, `borderRadius`, `shadow`, or `enter` for stricter control.

The preset catalog can also generate a patch example for video overlays when the current scene already defines a video asset.

## Audio Overlay Templates

Use with `audioOverlay({ assetId, template })`. Audio overlays emit ordinary `audio` nodes, so apps and agents can patch timing, source trim, static volume, and `volumeEnvelope` by id.

| Key                | Best For                                     |
| ------------------ | -------------------------------------------- |
| `backgroundMusic`  | Quiet music beds under a whole scene/section |
| `voiceover`        | Primary narration or spoken explanation      |
| `soundEffect`      | One-shot effects aligned to edits or actions |
| `beatAccent`       | Short percussive hits for cuts and reveals   |
| `ambientBed`       | Low ambience under a scene                   |
| `notificationPing` | Compact UI/callout cue sounds                |

```ts
scene.nodes.push(
  audioOverlay({
    assetId: "music",
    template: "backgroundMusic",
    from: 0,
    duration: scene.duration,
    trimStart: 8,
    fadeInDuration: 30,
    fadeOutDuration: 45,
    loop: true,
  }),
);
```

Role templates choose conservative default volumes: music and ambience sit quietly, voiceover stays full-level, and short cues get bounded default durations. Pass `volume`, `muted`, `trimStart`, `from`, `duration`, `loop`, `fadeInDuration`, `fadeOutDuration`, or an explicit `volumeEnvelope` for stricter control.

Fades compile to mixer-visible `volumeEnvelope` points, so preview and export use the same gain curve. Looping is audio-node data via `loop: true`; ducking is still future engine work.

## Media Looks

Use with `mediaLook(key)` inside an image or video style.

![Media look gallery](../assets/presets/preset-media-looks-f45.png)

| Key               | Best For                                |
| ----------------- | --------------------------------------- |
| `cleanProduct`    | Product shots, UI footage               |
| `punchySocial`    | High-energy social clips                |
| `cinematicWarm`   | Warm narrative footage                  |
| `coolNoir`        | Dramatic low-saturation scenes          |
| `retroTape`       | Soft analog warmth                      |
| `softPortrait`    | People-focused clips                    |
| `blurredBackdrop` | Background media behind foreground text |

```ts
videoClip(clip, {
  style: {
    ...clipLayout("fullscreen"),
    ...mediaLook("cinematicWarm"),
  },
});
```

## Clip Layouts

Use with `clipLayout(key)` inside an image or video style.

![Clip layout gallery](../assets/presets/preset-clip-layouts-f45.png)

| Key                 | Best For                         |
| ------------------- | -------------------------------- |
| `fullscreen`        | Full-frame cropped media         |
| `containCenter`     | Full source visible inside frame |
| `pictureInPicture`  | Floating small video card        |
| `splitLeft`         | Left half of a split screen      |
| `splitRight`        | Right half of a split screen     |
| `gridTopLeft`       | Top-left cell of a 2x2 grid      |
| `gridTopRight`      | Top-right cell of a 2x2 grid     |
| `gridBottomLeft`    | Bottom-left cell of a 2x2 grid   |
| `gridBottomRight`   | Bottom-right cell of a 2x2 grid  |
| `blurredBackground` | Blurred full-frame backdrop      |
| `phoneSafeVertical` | Vertical crop for phone footage  |

## Transition Overlays

Use with `transitionOverlay(template, options)`.

![Transition overlay gallery](../assets/presets/preset-transitions-f30.png)

| Key          | Best For                   |
| ------------ | -------------------------- |
| `fade`       | General soft cut           |
| `dipToBlack` | Section break              |
| `flash`      | Beat cut or emphasis       |
| `wipeLeft`   | Graphic leftward wipe      |
| `wipeRight`  | Graphic rightward wipe     |
| `zoom`       | Energetic transition flash |

```ts
scene.nodes.push(
  transitionOverlay("flash", {
    at: 90,
    duration: 10,
    color: "rgba(255,255,255,0.9)",
  }),
);
```

## Agent Hint

Use preset names in prompts and patches instead of inventing raw styles:

```txt
Use spotlight subtitles, a cinematic warm look, and a lower third for the speaker.
```

The implementation should compile those names into `styledCaptions()`, `mediaLook("cinematicWarm")`, and `textOverlay({ template: "lowerThird" })`.

## Regenerating Previews

The gallery scenes live under `examples/generated/presets` and are generated from `examples/generate-preset-gallery.mjs`:

```sh
pnpm build
pnpm presets:generate
```

Use the render commands in `examples/README.md` to refresh the committed PNG thumbnails.
