> Historical record. The editor, UI demos, and model-agent examples have been retired from this engine repository. Current application development: [Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).

# Image Overlay Roadmap

**Status:** implementation started 2026-06-18

Dojo Video Engine already renders image assets with `objectFit` and `objectPosition`, and the authoring layer can place images directly. The next goal is production image overlays: programmers and agents should be able to add logos, stickers, product shots, watermarks, avatars, and badges without hand-coding every absolute box and style detail.

This theme stays base-layer first. Chat, Studio, and Playground should consume the same image scene nodes, asset references, safe-area boxes, and preset names rather than carrying app-specific overlay layout logic.

## Product Rule

Image overlays must stay data-first:

- image overlays are ordinary `img` nodes and optional wrapper `div` nodes
- local files use explicit `scene.assets` entries and fetchable `src` strings
- placement uses shared safe-area primitives instead of app-only pixel math
- templates compile to scene data that apps and agents can patch by id
- defaults handle common aspect-ratio mismatch without stretching surprises
- examples include tiny logos, wide product shots, tall portraits, transparent stickers, and oversized assets

## Current Baseline

Already shipped:

- schema-backed `img` nodes with required `assetId`
- image asset loading through `resolveAssets()`
- renderer support for `objectFit` and `objectPosition`
- authoring helpers: `imageAsset()`, `image()`, `publicAsset()`, `defineAssets()`
- safe-area placement primitives used by text and subtitle overlays
- preset catalog infrastructure and showcase/golden gallery pattern

Known gaps:

- no named image overlay helper for logos, stickers, watermarks, or product shots
- no image overlay template catalog
- no authoring-level `imageOverlay()` convenience that accepts safe-area placement
- no image-specific preset patch examples for chat/playground-style insertion
- no stress gallery for aspect ratio, transparent PNG/SVG, safe-area placement, and object fit behavior

## Slice IX1 - Image Overlay Preset Helper ✅

**Goal:** programmers can create common image overlays from a stable helper instead of hand-writing absolute image styles.

Targets:

- `@dojo-video-engine/presets`
- docs/tests

Done:

- `imageOverlay()` emits schema-valid overlay nodes from an asset id
- templates cover `logoBug`, `watermark`, `sticker`, `productShot`, `cornerBadge`, and `avatarBadge`
- helper exposes placement, safeArea, composition, objectFit, objectPosition, opacity, borderRadius, shadow, and enter options
- default placement uses shared safe-area anchors for portrait, square, and landscape
- tests cover schema validity, safe-area placement, template defaults, and override behavior

## Slice IX2 - Authoring Image Overlay Helper ✅

**Goal:** `@dojo-video-engine/authoring` makes image overlays as easy as text boxes and subtitle tracks.

Targets:

- `packages/authoring`
- docs/guides

Done:

- `imageOverlay(asset, options)` accepts an asset object or asset id
- passing an asset object auto-adds it to `scene.assets`
- helper compiles through the preset helper with scene-aware composition defaults
- docs show logo, watermark, sticker, product shot, and avatar examples
- generated nodes validate through `@dojo-video-engine/schema`

## Slice IX3 - Preset Catalog And Patch Examples ✅

**Goal:** image overlay templates become discoverable by programmers, agents, and app UIs.

Targets:

- `@dojo-video-engine/presets`
- playground preset catalog
- docs/guides

Done:

- preset catalog lists image overlay template keys and best-use descriptions
- patch examples can insert image overlay nodes against an existing scene asset
- docs explain how asset ids and `public/assets` paths connect to image overlays
- tests prove generated patch examples validate after application

## Slice IX4 - Chat/App Refresh ✅

**Goal:** the reference apps can demonstrate image overlay instructions using the shared helper semantics.

Targets:

- `apps/chat`
- `apps/playground`
- docs/examples

Done:

- chat prompt chips include logo, watermark, sticker, and product-shot examples
- local media instruction examples can insert image overlays when image assets are available
- Playground/Studio can preview image overlay examples as ordinary scene data
- tests cover image overlay prompt examples or patch compilation paths

## Slice IX5 - Image Overlay Stress Gallery ✅

**Goal:** image overlay regressions become visible before they reach app users.

Targets:

- `@dojo-video-engine/showcase`
- examples
- golden harness
- docs assets

Done:

- generated stress scene covers square logo, wide product image, tall portrait image, transparent sticker, watermark opacity, rounded crop, and oversized source assets
- generated JSON and poster image are committed
- docs explain how to refresh/render the gallery

## Acceptance Criteria

- A programmer can add a logo, watermark, sticker, product shot, or avatar badge with one helper call.
- Agents can express image overlay intent through stable template names and patchable scene nodes.
- Chat can say “put this logo in the top-right” without inventing custom layout code.
- Studio and Playground preview image overlays as ordinary scene data.
- Aspect-ratio and safe-area image examples are covered by automated validation and visual artifacts.
