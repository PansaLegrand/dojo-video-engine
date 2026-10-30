# Animation Guide

Dojo Video Engine animations are deterministic keyframes on style properties. Keyframe frames are node-local: frame `0` is the first frame the node is active.

## Presets

The fastest path is to use presets re-exported by `@dojo-video-engine/authoring`:

```ts
import {
  fadeUp,
  popIn,
  seconds,
  slideIn,
  textBlock,
  title,
} from "@dojo-video-engine/authoring";

title("Launch Week", {
  at: seconds(0.5),
  enter: popIn({ durationInFrames: 12 }),
});

textBlock("Three updates.", {
  at: seconds(1.2),
  enter: slideIn("up", { delay: 6 }),
});
```

Available motion presets:

- `fadeUp({ durationInFrames, delay, distance, easing })`
- `popIn({ durationInFrames, delay, fromScale, easing })`
- `slideIn("left" | "right" | "up" | "down", options)`
- `pulse({ durationInFrames, delay, peak, easing })`

## Raw Keyframes

```ts
import { box } from "@dojo-video-engine/authoring";

box({
  style: { opacity: 0, transform: "translate(0px, 40px)" },
  enter: [
    {
      kind: "keyframes",
      property: "opacity",
      frames: [
        { frame: 0, value: 0 },
        { frame: 12, value: 1, easing: "easeOut" },
      ],
    },
    {
      kind: "keyframes",
      property: "transform",
      frames: [
        { frame: 0, value: "translate(0px, 40px)" },
        { frame: 12, value: "translate(0px, 0px)", easing: "spring(0.25)" },
      ],
    },
  ],
});
```

Rules:

- Keyframe frames must be strictly increasing.
- Numbers tween.
- Colors tween in RGBA space.
- Matching `translate()`, `scale()`, and `rotate()` transform lists tween.
- Other strings step at the next keyframe.

Supported easing:

```txt
linear
easeIn
easeOut
easeInOut
cubic-bezier(x1, y1, x2, y2)
spring
spring(0.3)
```

## Timeline Choreography

Use `@dojo-video-engine/presets` when several nodes need coordinated entrance timing:

```ts
import { fadeUp, popIn, slideIn, timeline } from "@dojo-video-engine/presets";

const tl = timeline()
  .add("title", popIn({ durationInFrames: 12 }))
  .add("subtitle", fadeUp(), { after: "title", overlap: 4 })
  .stagger(["card-1", "card-2", "card-3"], slideIn("left"), { every: 5 });

const animations = tl.compile();
```

Attach the compiled animation arrays to nodes with matching ids, or use `compileToPatch()` when editing an existing scene through RFC 0001 patch ops.

## Practical Defaults

- Use `seconds()` for node timing and preset `delay` for staggered entrances inside the same node window.
- Keep `transformOrigin` explicit when scaling or rotating cards.
- Prefer transform and opacity animation over changing layout properties every frame.
- Validate early with `dojo-video-engine validate src/video.ts`; validation errors are designed to be read by humans and agents.

## Text Overlay Templates

Use `@dojo-video-engine/presets` for production-shaped text overlays that are not subtitles:

```ts
import { textOverlay } from "@dojo-video-engine/presets";

scene.nodes.push(
  textOverlay({
    template: "quoteCard",
    id: "quote",
    body: "The scene is data, not a screenshot.",
    attribution: "Dojo Video Engine",
    from: 30,
    duration: 120,
  }),
);
```

Available templates: `titleCard`, `lowerThird`, `quoteCard`, `statCallout`, `announcementBanner`, `socialHook`, and `chapterTitle`.

## Transition Overlays

Transitions are full-frame nodes that sit above clips:

```ts
import { transitionOverlay } from "@dojo-video-engine/presets";

scene.nodes.push(
  transitionOverlay("flash", {
    id: "flash-cut",
    at: 90,
    duration: 10,
    color: "rgba(255,255,255,0.9)",
  }),
);
```

Available transitions: `fade`, `dipToBlack`, `flash`, `wipeLeft`, `wipeRight`, and `zoom`.
