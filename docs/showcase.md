# Showcase

These scenes are the public proof that dojo-video-engine's JSON-to-video pipeline is useful today. They live in `@dojo-video-engine/showcase`, feed the playground scene picker, and can be exported to JSON under `examples/generated`.

## Render Commands

```sh
pnpm build
pnpm showcase:generate
pnpm --filter @dojo-video-engine/golden run example examples/generated/tiktok-captions.json out/tiktok-captions.mp4 60
```

The trailing frame numbers write poster PNGs next to the MP4.

## Scenes

| Scene                   | Poster                                                                                            | What It Proves                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Engine Intro            | <img src="assets/showcase/intro.png" alt="Engine intro" width="180">                              | Gradients, image assets, text layout, opacity keyframes, MP4 export                                                                |
| TikTok Captions         | <img src="assets/showcase/tiktok-captions.png" alt="TikTok captions" width="180">                 | `tiktokCaptions()` compiles ASR timestamps into timed caption nodes with spring transforms, text stroke, and measured fitted pills |
| Karaoke Captions        | <img src="assets/showcase/karaoke-captions.png" alt="Karaoke captions" width="180">               | `karaokeCaptions()` keeps a full line visible while per-word color keyframes track spoken timestamps                               |
| Launch Info Display     | <img src="assets/showcase/launch-info-display.png" alt="Launch info display" width="180">         | Prompt-shaped scene generation: animated panels, scan lines, countdown timing, and progress motion from one serializable document  |
| Timed Text Overlay      | <img src="assets/showcase/timed-text-overlay.png" alt="Timed text overlay" width="180">           | Written timing instructions mapped to exact text nodes: first 5 seconds top-center, final 10 seconds bottom-right                  |
| Text Stress Gallery     | <img src="assets/showcase/text-stress-gallery.png" alt="Text stress gallery" width="180">         | Long Latin, URLs, CJK, emoji, long single-token text, and multiline captions stay bounded through scene-data style semantics       |
| Subtitle Stress Gallery | <img src="assets/showcase/subtitle-stress-gallery.png" alt="Subtitle stress gallery" width="180"> | SRT, WebVTT, long Latin, URLs, CJK, emoji, and fast subtitle cue changes stay bounded as ordinary timed scene nodes                |
| Image Overlay Stress Gallery | <img src="assets/showcase/image-overlay-stress-gallery.png" alt="Image overlay stress gallery" width="180"> | Logos, watermarks, transparent stickers, product shots, avatars, and oversized badges use shared image overlay presets             |
| Video Overlay Stress Gallery | <img src="assets/showcase/video-overlay-stress-gallery.png" alt="Video overlay stress gallery" width="180"> | Picture-in-picture, reaction cam, screen demo, muted background loop, b-roll strip, and video badge presets render as video nodes   |
| Audio Sync Pulse        | <img src="assets/showcase/audio-sync-pulse.png" alt="Audio sync pulse" width="180">               | A synthesized WAV data URL with beat-locked keyframes: audible in player preview, mixed into the AAC export                        |
| Lottie Sticker          | <img src="assets/showcase/lottie-sticker.png" alt="Lottie sticker" width="180">                   | A self-contained vector Lottie document seeked frame-exactly; the same asset at two playback rates                                 |

## Prompt-Style Readiness

dojo-video-engine can already render and export prompt-shaped results once the prompt has been compiled into scene JSON. `apps/chat` is the current reference product surface for that loop: chat generation creates or patches the canonical scene, the manual editor refines layers/timing/style through `applyScenePatch`, and export uses the same renderer. The playground remains the minimal engine surface: paste a generated scene or patch into the agent console, validate it, preview it, and export the MP4.

## Source

- Shared scene definitions: [packages/showcase/src/index.ts](../packages/showcase/src/index.ts)
- Generated JSON: [examples/generated](../examples/generated)
- Playground: [apps/playground](https://github.com/PansaLegrand/dojo-video-harness)

## Why This Matters

The showcase is deliberately data-first: each demo is a serializable scene document, not a React component or a browser screenshot script. Preview and export use the same Canvas2D renderer, so the playground frame and exported MP4 frame come from the same pipeline.
