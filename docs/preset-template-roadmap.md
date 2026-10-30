> Historical record. The editor, UI demos, and model-agent examples have been retired from this engine repository. Current application development: [Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).

# Preset And Template Roadmap

**Status:** implementation started 2026-06-17

Dojo Video Engine now has the programmer DX foundation: authoring helpers, CLI validation, Studio preview, a starter generator, asset-path conventions, and programmer-first guides. The next high-leverage layer is a richer preset/template system.

The goal is not to hide the scene format. The goal is to give programmers, apps, and LLMs a strong visual vocabulary that compiles into normal validated scene data.

## Product Rule

Presets must be pure compilers:

```txt
intent + options -> SceneNode[] / SceneStyle / SceneAnimation[]
```

Good:

- named subtitle, overlay, layout, transition, and media-look presets
- stable metadata catalogs that UIs and agents can inspect
- options that override generated style without breaking validation
- output that round-trips through `validateScene`

Avoid:

- runtime-only behavior
- renderer-specific hidden state
- presets that require DOM, React, CSS, or assets not declared in `scene.assets`
- visual randomness without an explicit seed

## Current State

Already shipped:

- motion presets: `popIn`, `fadeUp`, `slideIn`, `pulse`
- caption generators: `tiktokCaptions`, `karaokeCaptions`, `styledCaptions`
- subtitle templates: `classic`, `minimalBar`, `handwritten`, `retro`, `cinematic`, `storyteller`, `hustle`, `spotlight`, `karaoke`, `neon`, `future`, `terminal`, `colorShift`
- timeline choreography: `timeline()`

Missing:

- rich text overlay templates
- named media/filter looks
- clip layout templates
- transition templates
- visual preset gallery

## Slice PT1 - Text Overlay Templates ✅

**Goal:** A programmer can add production-shaped text overlays without hand-writing layout and style.

Code targets:

- `packages/presets`
- `packages/presets/README.md`
- `docs/guides/animation.md` or a new preset guide
- `docs/progress.md`

Templates:

- `titleCard`
- `lowerThird`
- `quoteCard`
- `statCallout`
- `announcementBanner`
- `socialHook`
- `chapterTitle`

API shape:

```ts
import { textOverlay, textOverlayTemplates } from "@dojo-video-engine/presets";

scene.nodes.push(
  textOverlay({
    template: "lowerThird",
    id: "speaker",
    title: "Ada Lovelace",
    subtitle: "Programmer",
    from: 30,
    duration: 120,
  }),
);
```

Done when:

- every template emits schema-valid scene nodes
- callers can override text, timing, placement, and style
- catalog metadata is stable and test-covered
- docs show common overlays

## Slice PT2 - Media Look / Filter Presets ✅

**Goal:** Programmers and agents can apply named looks to image/video nodes instead of hand-writing `style.filter`.

Templates:

- `cleanProduct`
- `punchySocial`
- `cinematicWarm`
- `coolNoir`
- `retroTape`
- `softPortrait`
- `blurredBackdrop`

API shape:

```ts
import { mediaLook } from "@dojo-video-engine/presets";

videoClip(clip, {
  style: {
    ...mediaLook("cinematicWarm"),
  },
});
```

Done when:

- every look returns validated `SceneStyle`
- docs explain Safari filter caveats from the scene-format matrix
- starter or guide shows one applied look

## Slice PT3 - Clip Layout Presets ✅

**Goal:** Common media layouts become one function call.

Templates:

- fullscreen
- picture-in-picture
- split-screen
- two-up
- four-up grid
- background-blur foreground
- phone-safe vertical crop

API shape:

```ts
import { clipLayout } from "@dojo-video-engine/presets";

videoClip(clip, {
  style: clipLayout("phoneSafeVertical"),
});
```

Done when:

- layout presets return plain `SceneStyle`
- docs show how to combine layouts with media looks and text overlays

## Slice PT4 - Transition Presets ✅

**Goal:** Scene sections can transition through normal nodes/keyframes.

Templates:

- fade
- slide
- push
- zoom
- dip-to-black
- flash

API shape:

```ts
import { transitionOverlay } from "@dojo-video-engine/presets";

scene.nodes.push(transitionOverlay("dipToBlack", { at: 90, duration: 18 }));
```

Done when:

- transitions emit schema-valid nodes
- transitions can be composed between clips without special renderer behavior

## Slice PT5 - Preset Gallery ✅

**Goal:** Programmers can see presets before choosing names.

Targets:

- docs page with generated PNG previews
- generated gallery scene group under `examples/generated/presets`

Done:

- subtitle, text overlay, media-look, clip-layout, and transition families have generated PNG gallery sheets
- the docs list template keys, intent, and code examples
- generated preview scenes pass `validateScene`

Docs catalog:

- [`docs/guides/preset-catalog.md`](guides/preset-catalog.md) lists stable preset names, intent, and usage examples.

## Acceptance Criteria

- A new user can build a styled short video mostly from named presets.
- LLM prompts can use stable preset names like "spotlight subtitles", "cinematic lower third", and "warm film look".
- Preset outputs are ordinary scene data and pass `validateScene`.
- No template bypasses the deterministic renderer contract.
