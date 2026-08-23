# Changelog

All public packages version together, including the engine, authoring, CLI, and
starter packages.

## 0.7.0 — 2026-08-24

The visual-primitives release: MotionForge gains a compact serializable vector
and compositing vocabulary instead of growing one hard-coded effect at a time.

### Scene, layout, and authoring

- Added `shape` nodes for rectangles, ellipses, normalized lines/polylines/
  polygons, and bounded SVG path data mapped through an explicit viewBox.
- Added shape fill/stroke/dash styles, closed vector clips, inverted/opacity/
  feather masks, bounded blend modes, and isolated subtree compositing.
- Added linear, circular-radial, and conic paint plus staged comma-separated
  box shadows and per-corner radii.
- Added per-side margin/padding, aspect-ratio sizing, and composable engine
  `safeArea` insets.
- Added metric-stable inline text runs for color, opacity, stroke, and
  background styling, plus explicit LTR/RTL direction.
- Added `shape()`, `richText()`, `shapeLayer()`, `richTextNode()`, and
  `richTextBlock()` builders and complete patch/inspection support.

### Renderer and capability contract

- Canvas2D maps normalized/path geometry deterministically through Path2D and
  DOMMatrix, with early runtime preflight when either API is unavailable.
- Soft masks and isolated groups use explicit offscreen alpha composition;
  multiple shadows use shadow-only staging so translucent fills are not
  accidentally repainted.
- Existing Scene v1 pixels remain unchanged; legacy v0 stays frozen and rejects
  post-v1 primitive fields.

### Testing and documentation

- Accepted [RFC 0004](docs/rfcs/0004-visual-primitives.md) defining geometry,
  paint, mask, compositing, layout, security, and compatibility semantics.
- Added schema/builder/layout/parser/preflight tests and the combined
  `visual-primitives` exact-pixel Chromium golden covering the complete stack.

## 0.6.0 — 2026-08-24

The extension-kernel release: trusted host applications can add deterministic,
versioned renderer capabilities while scenes remain portable, validated JSON.

### @motionforge/extensions

- Added the public extension package with `defineExtension()`,
  `createExtensionRegistry()`, exact-version resolution, and explicit
  `compatibleVersions` aliases. Duplicate and ambiguous registrations fail
  loudly instead of silently changing old scene pixels.
- Added parameter validation, generated JSON Schema discovery metadata,
  renderer/worker declarations, typed asset requirements, async resolution,
  per-frame preparation, and deterministic disposal hooks.
- Added `preflightExtensions()` with typed errors for absent/incompatible
  definitions, invalid parameters/assets, unsupported renderers, and
  worker-incompatible extensions.

### Scene, renderer, player, and export

- Scene v1 now supports JSON-only `extension` nodes carrying a stable name,
  exact semantic version, and bounded parameters. Functions and other
  non-JSON parameter values are rejected; executable code remains host-owned.
- Added the `extension()` core builder, patch support, inspection counts,
  extension capability reporting, and generated Scene JSON Schema coverage.
- Canvas2D now preflights the registry before loading, resolves node-scoped
  resources once, prepares optional frame data, invokes typed draw adapters,
  validates staged-frame freshness, and disposes extension resources.
- Player and export accept an extension registry and worker policy and pass
  them through the shared resolution/render path, preserving preview/export
  parity.

### Testing and documentation

- Accepted [RFC 0003](docs/rfcs/0003-extension-kernel.md), documenting
  versioning, trust boundaries, lifecycle, determinism, and rejected designs.
- Added registry/preflight/schema/builder/lifecycle unit coverage and a
  pinned-Chromium pixel golden that exercises resolve → prepare → draw.
- Added `@motionforge/extensions` to package, dependency-boundary,
  clean-install, and release gates.

## 0.5.0 — 2026-08-23

The Scene v1 compatibility release: MotionForge now has a canonical versioned
document, deterministic legacy migration, early reference validation, and
machine-readable inspection/preflight APIs.

### @motionforge/schema

- `schemaVersion: 1` is canonical. Builders, examples, fixtures, prompts, and
  generated documents now emit Scene v1.
- Added `migrateScene()` and `CURRENT_SCENE_VERSION`. Valid v0 documents are
  normalized to v1 without mutation; current scenes migrate idempotently, and
  future versions fail loudly.
- Kept `parseScene()` / `validateScene()` backward-compatible with v0 while
  making `sceneSchema` strict v1. Added `legacySceneV0Schema` and
  `legacySceneV0JsonSchema()` for ingestion tooling.
- Added cross-field reference validation for image, video, audio, Lottie,
  audio-reactive, and cover-image asset references, including expected-type
  diagnostics before rendering begins.
- Added `inspectScene()` for stable node/asset/effect capabilities and
  `lintScene()` for valid-but-suspicious timing, visibility, animation, audio,
  and unused-asset warnings.

### @motionforge/renderer-canvas2d

- Added `preflightCanvas2D()` with typed Canvas, image/video/audio decoder,
  font-loading, and DOM-Lottie requirements. Unsupported environments can now
  fail before fetching or decoding assets.
- Confirmed through the complete golden suite that v0 → v1 migration changes
  no rendered pixels, media timing, audio, or exported MP4 behavior.

### CLI, starter, and tooling

- Added `motionforge migrate` and `motionforge lint`; CLI inspection now uses
  the shared schema inspection API.
- Starter projects expose migrate/lint scripts, and `create-motionforge`
  derives dependency versions from its own package manifest instead of a
  drift-prone source constant.
- Added generated JSON Schema parity checking to the standard lint/release
  gate.
- Accepted [RFC 0002](docs/rfcs/0002-scene-v1.md) defining compatibility,
  migration, referential validation, inspection, and future-version rules.

## 0.4.0 — 2026-08-23

The production reconciliation release: reusable engine improvements proven in
DojoClip's Video Agent are now part of the open-source source of truth.

### @motionforge/schema

- Added deterministic `effect` nodes with a bounded parameter contract and 24
  built-in effect names, including six general motion effects and 18
  audio-reactive visualizers.
- Added audio-reactive asset validation and stricter patch normalization for
  effect parameters and node properties.
- Regenerated the shipped JSON Schema from the reconciled runtime contract.

### @motionforge/renderer-canvas2d

- Added deterministic procedural rendering for impact, confetti, cloud,
  speed-line, aura, annotation, waveform, spectrum, particle, tunnel, vinyl,
  terrain, gradient, and other audio-reactive effects.
- Added compact, cached audio-spectrum analysis for only the assets referenced
  by audio-reactive nodes.
- Replaced repeated random-access video seeks with per-node sequential decode
  cursors and bounded canvas pools; inactive cursors are disposed explicitly.
- Added pixelated media rendering and hardened text, transform, filter, media,
  Lottie, and resource-lifecycle behavior.

### @motionforge/player and @motionforge/export

- Player creation no longer waits for the whole preview audio mix before
  painting its first frame; late audio joins the current playback position.
- Owned assets are not disposed while an asynchronous frame render is still in
  flight.
- Export now reuses resolved frame evaluation and text-measure caches, reduces
  progress callback pressure, and keeps encoder backpressure explicit.

### @motionforge/presets

- Added the schema-backed macro registry and `expandMacroNodes()` /
  `expandMacroNodeInput()` APIs for agent-friendly, compact scene authoring.
- Added media, text, caption, subtitle, transition, countdown, Lottie, B-roll,
  emphasis, lower-third, title-card, callout, kinetic-text, progress-bar, and
  chapter-transition macros.
- Added layout and text-role intents plus shared effect-parameter
  normalization. Macro metadata generates an agent prompt guide from the same
  registered definitions used at runtime.

### @motionforge/core and @motionforge/authoring

- Added complete builder coverage for the reconciled node union through
  `lottie()` and `effect()` in core.
- Added seconds-first `lottieAsset()`, `lottieClip()`, and `effectLayer()`
  helpers, including adaptation of preset-produced Lottie/effect nodes.

### Tooling and governance

- Added a package-contract gate that enforces synchronized public package
  versions, changelog coverage, internal workspace dependency policy, and
  browser-engine dependency boundaries; every public tarball now carries its
  own README and MIT license.
- CLI inspection now reports effect nodes and effect capability usage.
- Added a pinned-Chromium pixel golden covering all six core procedural motion
  effects in one seeded scene.
- Documented the standalone repository as the authoritative source and updated
  the Remotion comparison for current client-side rendering support.

## 0.3.0 — 2026-06-11

The agent-loop and playback release: scenes are now editable by patch, playable in real time with sound, and can carry Lottie vector animations.

### @motionforge/schema

- **Scene patch ops (RFC 0001)**: `applyScenePatch(scene, patch)` applies id-addressed, transactional edits — `setStyle` (merge, null deletes), `setText`, `retime`, `setAnimations`, `insertNode`/`removeNode`/`moveNode`, `setAsset`/`removeAsset` (guarded by references), `setSceneMeta`. Pure: a failing op rejects the whole patch and never mutates the input; misspelled ids get closest-match suggestions. `scenePatchSchema`/`sceneOpSchema` exported.
- New style properties: `filter` (validated brightness/contrast/saturate/grayscale/sepia/invert/opacity/hue-rotate/blur chains), `zIndex`, `border`, `boxShadow`.
- New node/asset type `lottie`; `volume` now validates on video nodes; `playbackRate` on video and lottie nodes.

### @motionforge/player (new package)

- Real-time playback: deterministic `FrameClock` (wall-clock time exists only here), play/pause/seek/loop, latest-frame-wins decode policy, `frame`/`play`/`pause`/`ended` events.
- Audio preview: scenes with audible nodes play sound via one cached buffer mixed by the exact export functions; audio is the master clock (frame clock re-anchors on drift). Injectable `AudioPreview`/`now`/scheduler keep everything unit-testable.

### @motionforge/renderer-canvas2d

- `filter` chains (Canvas2D `context.filter`), `zIndex` sibling paint order, `border` strokes, `boxShadow` on background fills.
- **Lottie nodes**: self-contained vector Lottie documents render frame-exactly (clamped seek, per-node staging, `objectFit`). Documents with JS expressions or external images are rejected — determinism contract. lottie-web is an optional peer dependency, loaded only when a scene uses it.
- Video clips expose their own audio track (`VideoClip.audio`).

### @motionforge/export

- Video nodes contribute their clip soundtrack to the export at `volume`, trimmed with the picture; `playbackRate` retimes audio varispeed-style.
- Audio mixes in fixed windows (`audioChunkSeconds`, default 10 s) — flat memory at any scene length. `mixSceneAudio`, `audioChunkRanges` exported.
- Benchmarked: 1080p two-decoder export beats realtime (see `docs/benchmarks.md`).

### @motionforge/presets

- **`timeline()` choreography**: `.add(id, preset, { at | after | overlap | gap })`, `.stagger(ids, preset, { every })`, `.compile()` per-node keyframes or `.compileToPatch()` ready-to-apply patch ops. Frame-0 holds keep entrances hidden until their slot.

### Tooling and docs

- Playground: agent console (paste a scene or patch, applied via the public APIs, agent-grade errors), seven showcase scenes including audio and Lottie demos.
- Golden harness: committed baseline PNGs with received/diff artifacts on mismatch; 1080p benchmark; Playwright E2E (`pnpm e2e`); determinism lint (`scripts/check-determinism.mjs`).
- `tools/agent-eval`: mechanical LLM eval harness for scene generation/editing.

## 0.2.0 — 2026-06-11

Animation maturity release. This is the publish target for the first public launch, skipping the unpublished 0.1.0 package set.

### @motionforge/schema

- Easing expressions are now part of the scene contract: named easings plus `cubic-bezier(x1, y1, x2, y2)`, `spring`, and `spring(bounce)`.
- Validation rejects malformed easing expressions with actionable messages while keeping existing scenes compatible.

### @motionforge/core

- `transform` keyframes now interpolate numerically for matching `translate(...)`, `scale(...)`, and `rotate(...)` function lists and compatible units.
- Mismatched transform lists or unit conflicts keep deterministic step behavior, matching the documented fallback.
- Added deterministic cubic-bezier and spring easing evaluators used by numeric, color, and transform interpolation.

### @motionforge/presets

- New package: pure animation presets and caption generators that compile to scene data.
- Motion presets: `popIn`, `fadeUp`, `slideIn(direction)`, and `pulse`.
- Caption generators: `tiktokCaptions()` for one-word-at-a-time captions with highlight pills and `karaokeCaptions()` for whole-line karaoke captions with active-word color ramps.
- Added a generator example proving the TikTok caption scene can be regenerated from one preset call.

### Docs and Examples

- Added the weeks 3–4 roadmap for animation maturity, launch, and the editor readiness.
- Added/updated TikTok caption examples, generated frames, and agent-facing docs so agents prefer presets over hand-authored animation JSON.

Verified by 80 unit tests, 15 golden fixtures, 11 in-browser integration checks, and the generated TikTok caption scene rendered end to end.

## 0.1.0 — 2026-06-11

First release. A deterministic, browser-native video scene engine: the canonical video is a JSON scene document, and preview and export share the same Canvas2D renderer.

### @motionforge/schema

- Zod scene schema for `schemaVersion: 0`: frame-based timing, a curated CSS-like style subset, keyframe animations, and an asset map.
- `parseScene` / `validateScene` with actionable, path-qualified error messages; cross-field invariants (unique node ids, asset key = asset id, per-node-type requirements, strictly increasing keyframes).
- Parse-once semantics: re-parsing an already-parsed scene is an identity no-op, so frame loops never re-validate.
- `sceneJsonSchema()` plus a shipped `scene.schema.json` (draft-07) for validating scenes without executing code.

### @motionforge/core

- Builder API (`composition`, `div`, `text`, `img`, `video`) with deterministic auto ids, serializing to the exact scene format.
- `evaluateScene(scene, frame)`: pure keyframe evaluation — numeric interpolation with easing, color interpolation in RGBA space (`parseColor` exported), string stepping.
- `layoutScene`: absolute and flex layout implementing every validated layout property (insets, margin, min/max clamps, padding, gap, `justify-content` including `space-between`, `align-items` including `stretch`).

### @motionforge/renderer-canvas2d

- `renderStill(ctx, scene, frame, { assets })`: deterministic still-frame rendering for window and offscreen canvases.
- `resolveAssets(scene)`: the engine's only async phase — decodes image assets (SVG included) and registers font assets under their asset id. Missing media fails loudly, never silently.
- Multi-line text with measured word wrap, `lineHeight`, `letterSpacing`, `fontStyle`; images with the full `objectFit` set and `objectPosition`; `linear-gradient` with arbitrary stops and angles; `overflow: "hidden"` clipping that follows `borderRadius`; transforms with `transformOrigin`.

### @motionforge/export

- `exportVideo({ scene })`: in-browser MP4 export via WebCodecs, encoded and muxed by mediabunny, with codec negotiation (AVC → VP9/AV1 fallback), sub-range export, abort, progress, and bitrate control.
- `renderFrameSequence`: the deterministic frame loop with microsecond timestamps that `exportVideo` is built on.
- `detectExportCapability()` for gating UI.

Verified by 51 unit tests and 14 pixel-exact/probed golden fixtures plus an MP4 export smoke test, all hashed against a Playwright-pinned Chromium.
