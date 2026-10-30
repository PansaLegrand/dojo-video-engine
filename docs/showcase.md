# Engine scene examples

The engine's source scenes live in `@dojo-video-engine/showcase` and
[`examples/generated`](../examples/generated). They exercise rendering primitives,
caption layout, motion, media compositing, and audio synchronization. They are
serializable scene data, not an editor or an LLM agent.

Stale rendered marketing images and videos were removed during the repository
split. Their historical versions remain in Git. To generate current scene JSON
and render an example through the engine:

```sh
pnpm build
pnpm showcase:generate
pnpm --filter @dojo-video-engine/golden run example examples/generated/tiktok-captions.json out/tiktok-captions.mp4 60
```

| Source | Exercises |
| --- | --- |
| [Intro](../examples/generated/intro.json) | Gradients, image assets, text, keyframes |
| [Launch display](../examples/generated/launch-info-display.json) | Panels, countdown timing, progress motion |
| [Captions](../examples/generated/tiktok-captions.json) | Timed caption nodes, fitted pills, text stroke |
| [Karaoke](../examples/generated/karaoke-captions.json) | Per-word highlighting |
| [Text stress](../examples/generated/text-stress-gallery.json) | Bounded multilingual text layout |
| [Audio pulse](../examples/generated/audio-sync-pulse.json) | Source audio and frame-locked animation |
| [Lottie](../examples/generated/lottie-sticker.json) | Deterministic vector animation |

For the manual editor, chat, tools, skills, and provider integration, develop in
[Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).
