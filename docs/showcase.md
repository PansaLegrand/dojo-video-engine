# Engine scene examples

## Creative motion studies

**[Fifteen creative studies](../examples/creative-showcase/README.md)** lead with
finished designs: illustrated stories, data reports, portrait motion posters,
cinematic titles, festive 3D, company launches, miniature cities, exploded assemblies
kinetic vector art, sports broadcasts, software demos, food/drink campaigns, Lottie stories, handwriting and expressive typography.
Each includes editable source, a landscape or portrait MP4, a README preview and
browser-render/decode evidence. The dedicated example renderer registers the
Three.js extension for both preview and export.

## Rendering and editing tutorials

The engine's source scenes live in `@dojo-video-engine/showcase` and
[`examples/generated`](../examples/generated). They exercise rendering primitives,
caption layout, motion, media compositing, and audio synchronization. They are
serializable scene data, not an editor or an LLM agent.

To generate the tutorial scene JSON and render an example through the engine:

```sh
pnpm build
pnpm showcase:generate
pnpm --filter @dojo-video-engine/golden run example examples/generated/tiktok-captions.json out/tiktok-captions.mp4 60
```

| Source                                                           | Exercises                                      |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| [Intro](../examples/generated/intro.json)                        | Gradients, image assets, text, keyframes       |
| [Launch display](../examples/generated/launch-info-display.json) | Panels, countdown timing, progress motion      |
| [Captions](../examples/generated/tiktok-captions.json)           | Timed caption nodes, fitted pills, text stroke |
| [Karaoke](../examples/generated/karaoke-captions.json)           | Per-word highlighting                          |
| [Text stress](../examples/generated/text-stress-gallery.json)    | Bounded multilingual text layout               |
| [Audio pulse](../examples/generated/audio-sync-pulse.json)       | Source audio and frame-locked animation        |
| [Lottie](../examples/generated/lottie-sticker.json)              | Deterministic vector animation                 |

For the manual editor, chat, tools, skills, and provider integration, develop in
[Dojo Video Agent](https://github.com/PansaLegrand/dojo-video-agent).
