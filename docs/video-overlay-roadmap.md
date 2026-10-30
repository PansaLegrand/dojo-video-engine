> Historical record. The editor, UI demos, and model-agent examples have been retired from this engine repository. Current application development: [Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).

# Video Overlay Roadmap

**Status:** implementation started 2026-06-18

Dojo Video Engine already supports full-frame `video` nodes, source trimming with `videoStartTime`, `playbackRate`, clip audio through `volume`, object-fit styling, media looks, clip layouts, and chat media sequencing. The next goal is production video overlays: picture-in-picture clips, reaction cams, product/app demos, background loops, and muted b-roll that programmers and agents can add with stable names.

This remains a base-layer open-source feature. Apps should consume ordinary scene assets and `video` nodes from shared helpers, not carry one-off layout code.

## Product Rule

Video overlays must stay data-first:

- video overlays are ordinary `video` nodes, optionally styled as framed/cropped overlays
- local files use explicit `scene.assets` entries and fetchable `src` strings
- placement uses shared safe-area primitives where possible
- templates compile to patchable scene nodes with stable ids
- options expose source trim, playback rate, volume, object fit, object position, opacity, border radius, shadow, and entrance motion
- defaults avoid surprising audio: decorative overlays should be muted unless the caller opts in
- examples cover picture-in-picture, reaction cam, screen demo, background loop, b-roll strip, and lower-third video badges

## Current Baseline

Already shipped:

- schema-backed `video` nodes with `assetId`
- `videoStartTime`, `playbackRate`, and `volume`
- video asset loading and clip audio export
- authoring helper `videoClip()`
- media looks and clip layouts for full-frame media
- chat media compiler for sequencing uploaded videos/images
- safe-area placement primitives used by text, subtitle, and image overlays

Known gaps:

- no named video overlay helper for picture-in-picture, reaction cam, b-roll, or screen demo clips
- no video overlay template catalog
- no authoring-level `videoOverlay()` convenience that auto-registers video assets
- no video-specific preset patch examples for catalog-driven insertion
- chat does not distinguish "overlay this clip" from "sequence this clip"
- no visual stress gallery for trim, muted overlay audio, rounded crop, object-fit, safe-area placement, and looping-style background video nodes

## Slice VX1 - Video Overlay Preset Helper ✅

**Goal:** programmers can create common video overlays from a stable helper instead of hand-writing absolute video styles.

Targets:

- `@dojo-video-engine/presets`
- docs/tests

Done:

- `videoOverlay()` emits schema-valid `video` nodes from an asset id
- templates cover `pictureInPicture`, `reactionCam`, `screenDemo`, `backgroundLoop`, `brollStrip`, and `videoBadge`
- helper exposes placement, safeArea, composition, objectFit, objectPosition, opacity, borderRadius, shadow, trimStart, playbackRate, volume, muted, and enter options
- default placement uses shared safe-area anchors for portrait, square, and landscape
- tests cover schema validity, timing/source fields, safe-area placement, template defaults, and override behavior

## Slice VX2 - Authoring Video Overlay Helper ✅

**Goal:** `@dojo-video-engine/authoring` makes video overlays as easy as image overlays and video clips.

Targets:

- `packages/authoring`
- docs/guides

Done:

- `videoOverlay(asset, options)` accepts a video asset object or existing asset id
- passing a video asset object auto-adds it to `scene.assets`
- helper compiles through the preset helper with scene-aware composition defaults
- docs show picture-in-picture, reaction cam, background loop, and muted b-roll workflows
- generated nodes validate through `@dojo-video-engine/schema`

## Slice VX3 - Preset Catalog And Patch Examples ✅

**Goal:** video overlay templates become discoverable by programmers, agents, and app UIs.

Targets:

- `@dojo-video-engine/presets`
- playground preset catalog
- docs/guides

Done:

- preset catalog lists video overlay template keys and best-use descriptions
- patch examples can insert video overlay nodes against an existing scene video asset
- docs explain how video asset ids, trims, and audio volume connect to overlays
- tests prove generated patch examples validate after application

## Slice VX4 - Chat/App Refresh ✅

**Goal:** the reference apps can demonstrate video overlay instructions using shared helper semantics.

Targets:

- `apps/chat`
- docs/examples

Done:

- chat prompt chips include picture-in-picture, reaction cam, b-roll strip, and background loop examples
- local media instruction examples can insert video overlays when video assets are available
- uploaded `@Video` overlay instructions prefer overlay nodes over generic sequencing
- tests cover video overlay prompt examples and local patch compilation paths

## Slice VX5 - Video Overlay Stress Gallery ✅

**Goal:** video overlay regressions become visible before they reach app users.

Targets:

- `@dojo-video-engine/showcase`
- examples
- golden harness
- docs assets

Done:

- generated stress scene covers picture-in-picture, reaction cam, muted background loop, b-roll strip, rounded crop, object-fit cover/contain, trim start, playback rate, and volume semantics
- generated JSON and poster image are committed
- docs explain how to refresh/render the gallery

## Acceptance Criteria

- A programmer can add a picture-in-picture clip, reaction cam, screen demo, background loop, b-roll strip, or video badge with one helper call.
- Agents can express video overlay intent through stable template names and patchable scene nodes.
- Chat can say “put this clip as a muted picture-in-picture in the top-right” without inventing custom layout code.
- Studio and Playground preview video overlays as ordinary scene data.
- Video overlay trims, muted audio, object-fit behavior, and safe-area placement are covered by automated validation and visual artifacts.
