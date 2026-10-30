> Historical record. The editor, UI demos, and model-agent examples have been retired from this engine repository. Current application development: [Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).

# Audio Overlay Roadmap

**Status:** implementation started 2026-06-19

Dojo Video Engine already has `audio` assets, `audio` nodes, source trimming with `audioStartTime`, static `volume`, browser preview through `@dojo-video-engine/player`, and AAC export mixing. The next goal is production audio overlays: music beds, voiceover, sound effects, beat accents, ambience, and notification-style cues that programmers and agents can add with stable helper names.

This stays a base-layer open-source feature. Audio overlays compile to ordinary scene assets and audio nodes. Apps may expose richer UI, but they should not need app-specific mixer semantics.

## Product Rule

Audio overlays must stay data-first:

- audio overlays are ordinary `audio` nodes, not a hidden runtime graph
- local files use explicit `scene.assets` entries and fetchable `src` strings
- timing uses frame `from` / `duration`; source trim uses `audioStartTime` in seconds
- static volume uses the existing `volume` field
- fades use `volumeEnvelope` points on ordinary audio/video nodes
- looping beds use `loop: true` on ordinary audio nodes
- helpers expose named roles and sensible defaults, but every output is patchable scene data
- ducking behavior must be represented in schema and mixer code before presets claim to support it
- generated examples must prove preview/export semantics, not just TypeScript helper shapes

## Current Baseline

Already shipped:

- schema-backed `audio` nodes with `assetId`
- `audioStartTime` and `volume`
- audio asset loading through `resolveAssets()`
- AAC export mixing through `mixSceneAudio()`
- player audio preview from the exact export mix
- authoring helper `audioTrack()`
- chat asset shelf visibility and manual insert support for audio assets
- mixer-visible `volumeEnvelope` support for audio/video nodes
- audio overlay preset and authoring helpers with fade-in/fade-out options
- audio-node `loop` support for repeated music/ambience beds

Known gaps:

- no deterministic ducking compiler for lowering beds under voice/video audio windows
- no audio stress gallery proving trim, volume, fades, looping, ducking, and export mix behavior together

## Slice AX1 - Audio Overlay Roadmap ✅

**Goal:** make the product and engine shape explicit before code grows.

Targets:

- docs

Done:

- baseline capabilities recorded
- implementation slices scoped around current engine support first, then mixer/schema extensions
- acceptance criteria defined for programmer helpers, agents, preview, and export

## Slice AX2 - Audio Overlay Preset Helper ✅

**Goal:** programmers can create common audio roles from stable names instead of hand-writing audio node fields.

Targets:

- `@dojo-video-engine/presets`
- docs/tests

Done:

- `audioOverlay()` emits schema-valid `audio` nodes from an asset id
- templates cover `backgroundMusic`, `voiceover`, `soundEffect`, `beatAccent`, `ambientBed`, and `notificationPing`
- helper exposes id, from, duration, trimStart, volume, muted, and template-specific defaults
- tests cover schema validity, template metadata, default volumes, source trim, timing, and override behavior
- docs originally scoped fades, looping, and ducking as later engine work; fades and looping have since shipped through `volumeEnvelope` and `loop`, while ducking remains future mixer work

## Slice AX3 - Authoring Audio Overlay Helper ✅

**Goal:** `@dojo-video-engine/authoring` makes audio roles as easy as `audioTrack()` and media overlays.

Targets:

- `packages/authoring`
- docs/guides

Done:

- `audioOverlay(asset, options)` accepts an audio asset object or existing asset id
- passing an audio asset object auto-adds it to `scene.assets`
- helper compiles through the preset helper with seconds-first authoring time values
- role templates are documented through `audioOverlay({ template })`
- generated nodes validate through `@dojo-video-engine/schema`

## Slice AX4 - Preset Catalog And Chat/App Refresh ✅

**Goal:** audio roles become discoverable to programmers, agents, and product UIs.

Targets:

- `@dojo-video-engine/presets`
- Playground preset catalog
- `apps/chat`
- docs/examples

Done:

- preset catalog lists audio template keys and best-use descriptions
- patch examples can insert an audio node against an existing scene audio asset
- unavailable-state messaging is clear when no audio asset exists
- chat prompt chips include background music, voiceover, and sound-effect examples
- deterministic local chat can compile basic audio instructions such as "add @Audio 1 as quiet background music" and "put @Audio 2 at 3s as a sound effect"

## Slice AX5 - Engine Volume Automation, Fades, Looping, And Ducking

**Goal:** production audio controls have a truthful serializable scene representation.

Targets:

- `@dojo-video-engine/schema`
- `@dojo-video-engine/core`
- `@dojo-video-engine/export`
- `@dojo-video-engine/player`
- docs/tests

Done when:

- audio and video nodes can express volume over time without pretending style animations affect sound
- fade-in and fade-out helpers compile to mixer-visible volume automation
- long music/ambience beds can loop through a node window without duplicating nodes manually
- ducking can be compiled deterministically: music lowers under voiceover/video audio windows, then recovers
- unit tests cover envelope math, chunk boundaries, overlap mixing, loop wrap, and ducking windows
- in-browser export tests decode the resulting AAC and verify audible levels before, during, and after fades/ducking

Progress:

- AX5a complete: schema/core/export now carry `volumeEnvelope` on audio/video nodes and the mixer samples it in node-local frames, including clipped chunks.
- AX5b complete: preset and authoring audio helpers compile fade-in/fade-out options to `volumeEnvelope`.
- AX5d complete: audio nodes can loop source playback through long node windows, and preset/authoring/chat helpers expose `loop`.
- Still remaining in AX5: ducking compilation and browser-level audible regression checks.

## Slice AX6 - Audio Overlay Stress Gallery

**Goal:** audio overlay regressions become audible/measurable before they reach app users.

Targets:

- `@dojo-video-engine/showcase`
- examples
- golden harness
- docs assets

Done when:

- generated stress scene covers music bed, voiceover, sound effect, beat accent, ambience, notification cue, trim start, static volume, fades, looping, and ducking once supported
- generated JSON and poster image are committed
- golden/browser test exports the scene and verifies RMS windows for expected silence, quiet bed, voiceover duck, and cue peaks
- docs explain how to refresh/render and what to listen for

## Acceptance Criteria

- A programmer can add background music, voiceover, ambience, beat accents, notification pings, or one-shot sound effects with one helper call.
- Agents can express audio intent through stable template names and patchable scene nodes.
- Chat can say "add this as quiet background music" without inventing custom mixer logic.
- Studio and Playground expose audio presets without app-specific semantics.
- Preview and export use the same audio mix.
- Fades, looping, and ducking are implemented only when they are represented in schema and covered by automated mixer/export checks.
