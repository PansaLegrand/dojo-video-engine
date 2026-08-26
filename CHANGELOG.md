# Changelog

All public packages version together, including the engine, authoring, CLI, and
starter packages.

Release headings record repository source/API baselines. They do not by
themselves assert that an npm package or Git tag exists; external publication
requires the receipts and provenance in
[`docs/release-process.md`](docs/release-process.md).

## Unreleased

No changes recorded after the 1.1.0 source candidate.

## 1.1.0 — 2026-08-26

Repository release candidate. This heading records the tested source/API
baseline; npm publication and the Git tag remain external maintainer steps
until the receipts required by `docs/release-process.md` exist.

### Governance and release policy

- Added security support/reporting windows, maintainer governance and RFC
  decisions, a Code of Conduct, and contributor links for private reports.
- Added supply-chain policy for dependency/license review, vulnerability
  response, per-package SBOMs, pack-once artifacts, provenance, signing,
  reproducibility, codec patents, and trusted extension distribution.
- Defined the extension trust/capability/worker/migration/failure-isolation ABI,
  the exact 1.1 candidate/tag/package/schema/tool release checklist, rollback
  and advisory handling, and source-baseline 1.0 → 1.1 migration guidance.
- Qualified repository version headings and 1.0 gate evidence so they do not
  claim an npm publication, Git tag, or provenance receipt that does not exist.

### Open-source platform and interoperability

- Added `@motionforge/interchange` with a versioned common flat-timeline
  contract, deterministic rational/NTSC conversion, explicit import/export
  losses, a data-only Remotion host descriptor, and a sanitized static
  HTML-snapshot bridge that never executes scripts or arbitrary React code.
- Added a provider-neutral MotionForge Agent Skill, a private thin MCP/JSON-RPC
  adapter over the exact public workflow registry, evidence-manifest discovery,
  protocol-clean stdio guidance, and repair, macro, and extension starter
  examples. Provider-facing Scene load descriptors now embed the canonical
  strict Scene schema rather than an unconstrained placeholder.
- Added a public API reference, current Remotion/HyperFrames equivalent-task
  comparison, extension ABI, 1.0-to-1.1 migration notes, and compatibility,
  browser, performance, and deterministic agent-evaluation reports.
- Renamed the repository starter package from the registry-conflicting
  unscoped `create-motionforge` identity to `@motionforge/create`, while
  retaining the `create-motionforge` command.
- Synchronized all 16 public packages at `1.1.0`; added exact pack-once release
  artifacts, SHA-256/SHA-512 integrity, frozen-lock CycloneDX/license/audit
  evidence, pinned CI actions, staged/idempotent npm provenance publication,
  durable GitHub release attachments, and external ESM/browser/worker
  clean-install coverage against those retained bytes.
- Updated the production dependency set and pnpm toolchain so the source
  candidate has no reported high-or-higher production advisories. Registry
  publication remains a separately authorized maintainer operation.

### Canonical Scene integrity

- Canonical v0/v1 parsing now rejects unknown keys at every object nesting layer
  instead of relying on Zod's implicit stripping behavior.
- Added explicit `repairSceneInput()` tolerant ingestion, which removes unknown
  keys on a clone, reports every removal, and preserves all other validation
  failures.
- Added configurable `preflightScene()` host execution limits for canvas size,
  complete document values/depth, frames, assets, node count/depth, geometry,
  animations, and keyframes without changing Scene v1 document validity.
- Added compatibility coverage spanning top-level, asset, node, style, text-run,
  animation, keyframe, envelope, audio, shape/mask, effect, and extension data.
- Added the shared `@motionforge/schema/values` portable grammar for lengths,
  named/hex/legacy-and-modern RGB/HSL colors, gradients, transforms/origins,
  filters, borders, shadows, text strokes, and easing; schema, core
  interpolation, and Canvas2D now consume the same parsed semantics.
- Accepted RFC 0010 for the portable Scene v1 value policy, including explicit
  CSS Color 4/P3 exclusion and capability-failure semantics. The generated
  JSON Schema now carries a registered custom-format vocabulary and enforces
  target-dependent animation values against the same valid/invalid corpus.
- Animation targets are a typed supported union with target-specific value and
  mask compatibility checks while retaining all previously supported scalar
  Scene v1 targets; misspelled or type-incompatible tracks fail before
  evaluation.
- Canvas2D preflight now reports missing filter, conic-gradient, and text
  letter-spacing support, and schema-valid text shadows use the shared shadow
  parser instead of silently disappearing.
- Object-position axes and Canvas font family/weight descriptors now use
  bounded shared grammars, preventing invalid values from falling back to
  center or retaining stale font state.
- Scene patch operation envelopes are strict, clip mutations require closed
  geometry, and muted reverse-video playback now has patch parity with Scene
  validation.
- Core/authoring round trips preserve repeat/yoyo animation playback. Media
  asset helpers preserve source/proxy/metadata options, include fonts, and
  video clips support the same gain envelopes/fade compiler as audio clips.
  Helper identity fields cannot be overwritten at runtime, and fade-out gain
  reaches zero on the final active node frame.

### Post-1.0 architecture contract

- Accepted RFC 0009 defining the standalone engine boundary, target dependency
  direction, canonical/ephemeral layers, and downstream synchronization policy.
- Recorded every 1.0 public package entry point in a machine-checked ownership
  and deprecation baseline.
- Extended package contract checks with an allowed dependency graph, cycle and
  undeclared/deep/cross-package import detection, framework/product boundary
  rules, public entry-point drift detection, and controlled negative tests.

### Transactional media and verified export

- Asset resolution now rolls back partial failure/cancellation, exposes
  awaitable idempotent disposal, serializes frame preparation per lease, prunes
  inactive staging state, and rejects stale source reuse.
- Added host-owned `AssetPolicy` callbacks for proxy/source selection,
  authorization, credentials, signed-URL refresh, MIME/response checks,
  content identity, Fetch injection, byte ceilings, and cancellation.
- Added byte-bounded/coalesced audio-analysis and reference-counted bounded
  font caches, plus per-asset/source/image/decoder/Lottie resource budgets.
- Preflight now uses reachable assets and includes declared embedded-video
  soundtracks; worker request ids retain unique cancellation ownership.
- Export disposes internally owned resources on every outcome, propagates
  cancellation through audio/frame work, provides an explicit host fallback,
  and supports `none`/`container`/`sampled`/bounded-`full` output verification
  with a verification-capable custom-sink contract.
- Player creation rolls back on first-frame failure, concurrent seeks settle
  after their frames paint, asynchronous render errors are observable, and
  `disposeAsync()` joins audio/render work before releasing owned media.

### Renderer-neutral composition inspection

- Added `@motionforge/inspection` with JSON-safe tree, timeline, per-frame
  layout, hit-test, sampled-composition, and unified check APIs.
- Inspection reports stable hierarchy/source paths, half-open local and
  absolute windows, border/content/transformed/clip bounds, paint order,
  text-line and media-fit geometry, and explicit measurement provenance.
- Added deterministic outside-frame, zero-size, safe-edge, overlap,
  possible-occlusion, subtitle-collision, excessive-crop, and flex-overflow
  diagnostics with confidence, evidence, and remediation classes. Semantic
  roles and permitted overlaps are accepted only as explicit host intent.
- Moved affine-transform and object-fit geometry into renderer-neutral core
  helpers while retaining the existing Canvas2D compatibility export and
  pixel behavior.
- Added `motionforge inspect-layout` and `motionforge check`; the latter emits
  one versioned JSON envelope even for invalid scenes. Agent tools expose the
  same bounded tree/timeline/layout/hit-test/check operations.

### Typed commands and revisioned workspaces

- Added `@motionforge/commands` with 16 strict, discriminated, non-recursive
  command kinds for text/style/layout/timing/media/node/preset/macro edits and
  a draft-07 JSON Schema for editors and function-calling agents.
- Commands compile sequentially against a private Scene into one canonical,
  transactional ScenePatch with affected IDs and actionable diagnostics;
  align/distribute reject unresolved geometry rather than guessing.
- Added verified exact inverse-patch generation plus a bounded in-memory
  workspace with draft/commit, monotonic revisions, stale-write rejection,
  semantic diffs, undo/redo, and forward/inverse history evidence.
- Added versioned motion-preset and built-in macro manifests with parameter
  schemas, validated examples, explicit asset requirements, and output roles.
- Release packing now derives from the public package ownership policy, so a
  newly classified package cannot be omitted from full or clean-install gates.

### Reusable prepared Scene runtime

- Added `@motionforge/runtime` with revisioned prepared sessions, backend
  preflight/capabilities, transactional incremental updates, latest-intent
  cancellation, opaque frame tokens, portable phase events/errors, artifact
  sinks, and asynchronous idempotent disposal.
- Canvas2D now retains unchanged native and explicitly reusable extension
  resources across Scene edits, rolls provisional leases back on failure, and
  disposes replaced resources after their final owner releases them.
- Added shared text/media intrinsic-metrics providers with per-field
  exact/declared/estimated provenance, defensive provider inputs, and bounded
  caches consumed by layout, inspection, and the prepared Canvas backend.
- Added `@motionforge/renderer-canvas2d/runtime`, safe player/export borrowing
  facades, headless Canvas factories, neutral target compositing, strict
  portable progress metadata, and packed external entry-point verification.

### Renderer-neutral display list and bounded Canvas backend

- Added the ephemeral JSON-safe display-list v1 compiler with stable group/op
  IDs, resolved geometry/paint/composites, compiler-owned text layout, media
  references, explicit capabilities, defensive snapshots, and hard structural
  budgets; Scene v1 remains the only canonical stored artifact.
- `renderStill()` now assembles evaluate → layout → display compile → Canvas
  execute. Public compile/execute APIs support conformance testing and reject
  composition, capability, prepared-frame, hierarchy, and paint tampering.
- Extensions now explicitly choose a bounded standard rect/text/image builder,
  an exact versioned opaque JSON operation/realm, or the preserved 1.x legacy
  Canvas bridge. Immutable resource reuse, worker handler injection, and native
  resource separation are enforced.
- Added pooled, box-bounded isolation/masks/pixelation/shadow staging plus
  byte-bounded static-isolation and text caches with revision/resource-aware
  invalidation, collision checks, lifecycle statistics, and deterministic
  disposal.
- Added a reusable renderer conformance suite and compositing-heavy 1080p/4K
  performance gates with measured scratch allocation/reuse/memory budgets.

### Semantic Layout v2 authoring

- Added the public `@motionforge/layout` package and accepted RFC 0012. Flat,
  bounded Layout Contract v1 plans compile stack/row/column, wrapping, grid,
  overlay, safe-area, fill/hug, grow/shrink, track/span, anchor, and sibling
  constraint intent completely into ordinary numeric Scene v1 geometry.
- Added strict Zod validation, a conditional draft-07 tool schema, nonthrowing
  structured compilation, deterministic ordering/errors, host-tightenable
  item/track/constraint/text/step/coordinate budgets, finite JSON evidence,
  and portrait/square/landscape plus nested-layout coverage.
- Added prepared intrinsic media/text metrics with explicit missing-media and
  font fallback policies. Plain text receives a deterministic final width and
  height plan with bounded Latin/CJK/supported-emoji/RTL wrapping, fitting, source
  cluster/ellipsis evidence, and an explicit Scene-v1 projection. Existing
  Scene-v1 layout and pixels remain isolated from the opt-in compiler.
- Added stable `@motionforge/presets/intents` discovery and nonthrowing
  compilation for `place`, safe-area boxes, text roles, media looks, and clip
  layouts through versioned JSON-safe manifests.
- Documented the compiled Scene as a target-specific render projection:
  responsive editors retain the source Scene plus LayoutPlan(s), while player,
  export, workers, inspection, and storage continue to consume Scene v1.

### Typed iterative agent workflows and proof evidence

- Added the provider-neutral MF8 workflow registry. One strict load boundary
  returns an opaque session handle; flat read/search/check, typed command,
  undo/redo, evidence, event, close, and dispose calls no longer repeat the
  recursive Scene.
- Every workflow tool now publishes strict detached draft-07 input and output
  schemas. Results have hard JSON depth/value/string/collection budgets,
  monotonic revision checks, stable portable errors, and exactly ordered start
  and terminal events.
- Added deterministic proof-frame selection from Scene changes, media cuts,
  keyframes, text/caption windows, markers, and explicit frames; portable
  before/after/diff/contact-sheet plans; transactional renderer/sink ports; a
  prepared Canvas2D browser renderer; and scoped bounded memory artifact
  storage.
- Added `scene.set`, `asset.set`, and `asset.remove` to the typed command union,
  enabling blank-workspace initialization and multiple asset management without
  whole-Scene replacement. All 19 commands retain transactional inverse,
  workspace undo/redo, and draft-07 parity.
- Upgraded the open-source chat reference: first drafts keep the compact
  one-shot path, while existing-Scene edits run a bounded
  inspect → command → check → proof → repair loop that starts from the latest UI
  Scene and returns the trusted final workspace snapshot/history.
- Added bounded `observe` decisions for exact-node reads/search beyond a
  truncated summary. Client project epochs/revisions prevent stale in-flight
  responses from overwriting newer/manual or new-session work, and
  model-proposed asset sources are canonicalized only through the uploaded
  manifest.
- Added strict live-evaluation report metadata and an explicit no-network
  offline gate. Optional runs record provider/model version, prompt/tool hashes,
  temperature, budgets, trials, UTC date, success, latency, and available token
  usage without making paid calls part of release tests.

### Worker audio export

- Replaced Mediabunny `AudioBufferSink` with worker-safe `AudioSampleSink` for
  resolved audio assets and embedded video soundtracks.
- Waveform, spectrum, and export mixing now copy raw planar PCM directly and
  no longer construct Web Audio `AudioBuffer` values in dedicated workers.
- Added regressions for explicit audio and video-embedded audio with the
  `AudioBuffer` global absent.

## 1.0.0 — 2026-08-24

The first stable MotionForge source/API baseline. Scene v1, public package
contracts, renderer behavior, export adapters, and agent tool names now follow
the documented 1.x compatibility policy. See the repository-level publication
qualification above.

### Hardening gate

- Added deterministic property/fuzz coverage (750 scenes / 2,250 frames) and a
  28-scene canonical/migration corpus gate.
- Added Chromium, Firefox, and WebKit renderer probes to the mandatory release
  gate and CI browser installation.
- Added pinned performance budgets at 1280×720@30: all stages below 7 ms/frame
  and 20 MiB heap locally, against 100 ms/256 MiB ceilings.
- Promoted resource, golden media/audio/stream/tool, browser E2E, agent-eval,
  package dry-run, and clean-tarball install checks into the full 1.0 gate.

### Compatibility and evidence

- Published [the 1.x compatibility contract](docs/compatibility.md) and
  [reproducible 1.0 release evidence](docs/1.0-release.md).
- Updated CI to run the full release and clean-install gates on every change.
- Validated the full curated example/verification/migration corpus.

## 0.11.0 — 2026-08-24

The agent-tools release: MotionForge's complete generation/edit/render/export
workflow is available through one stable public package and function-calling
registry.

### @motionforge/agent-tools

- Added validation, migration, inspection, lint, patch, semantic diff, and
  runtime capability discovery APIs.
- Added browser still and contact-sheet rendering plus export estimate,
  preflight, and MP4 wrappers over the production engine path.
- Added `createAgentToolRegistry()` with stable names/descriptions and generated
  draft-07 input JSON Schemas.
- Capability discovery is derived from schema, motion preset, macro, installed
  extension, and export runtime registries.

### CLI and verification

- Added `motionforge diff <before> <after>` and `motionforge capabilities`.
- Added id-addressed/order-aware diff tests, registry execution tests, and
  browser checks for painted stills and contact-sheet layout.
- Accepted [RFC 0008](docs/rfcs/0008-agent-tools.md).

## 0.10.0 — 2026-08-24

The export-runtime release: buffered, streamed, worker, and headless exports
share one deterministic render/audio/mux pipeline.

### Export API

- Added `estimateExport()` and `preflightExport()` for frames, duration, raw
  work, estimated output bytes, audio/resource needs, and capability issues.
- Added `exportVideoToStream()` using positional WritableStream chunks and
  encoder/muxer backpressure; `exportVideo()` remains the Blob API.
- Extended capability detection with worker and streaming-target support.

### Worker/headless adapter

- Added `@motionforge/export/worker` with serializable start/cancel requests,
  progress/complete/error events, `ExportWorkerClient`, worker installation,
  and a reusable handler for cloud/headless message hosts.
- Worker jobs own AbortControllers, force worker extension compatibility, and
  return the same Blob/result shape as main-thread export.

### Verification

- Accepted [RFC 0007](docs/rfcs/0007-export-runtime.md).
- Added export estimate/preflight and worker protocol tests.
- Browser export smoke now reconstructs and validates a streamed MP4 in
  addition to the buffered file.

## 0.9.0 — 2026-08-24

The bounded media/audio release: long projects no longer imply loading every
asset, buffering every remote source, or mixing the entire preview soundtrack.

### Media resolution

- Asset resolution now loads reachable references only, including node,
  effect, font, and extension requirements.
- Added HTTP range-backed media via Mediabunny `UrlSource`, explicit
  auto/stream/buffer modes, proxy sources, and source metadata.
- Added decoded-image, source-cache, and simultaneous-video-decoder budgets
  with estimates in Canvas preflight and hard runtime enforcement.
- Preview prefers declared proxies; final export defaults to original sources.
- Added explicit video hold/loop behavior and muted reverse visual playback,
  plus truthful capability reporting.
- Added cached streaming waveforms and shared waveform/spectrum analysis.

### Audio graph and preview

- Added named audio buses with gain/pan/limiting, node panning/routing, and
  frame-based bus ducking with attack/release.
- Added paired crossfade envelope compilation, peak/RMS/dBFS measurement, and
  deterministic peak limiting.
- Default Web Audio preview now mixes bounded chunks around play/seek position
  instead of retaining a whole-scene AudioBuffer.
- Preview and export continue to share the same mixer; browser round trips now
  assert channel separation and audible ducking.

### Testing and documentation

- Accepted [RFC 0006](docs/rfcs/0006-media-audio-runtime.md).
- Added reachability, budget estimation, waveform, panning, limiter/loudness,
  proxy/schema, bus/ducking, chunk-range, loop, and reverse coverage.

## 0.8.0 — 2026-08-24

The animation-system release: repeatable scene playback and markers become
first-class data, while higher-level choreography compiles to ordinary
keyframes.

### Scene and core

- Added finite/infinite `repeat` and `yoyo` keyframe playback with deterministic
  cycle mapping and endpoint holds.
- Added bounded named scene markers across validation, builders, patches, and
  inspection.
- Added animated mask opacity/feather/radius targets and numeric interpolation
  for matching filter chains.

### Presets and choreography

- Added timeline `.sequence()`, named `.marker()` positioning, marker output,
  and scene-patch compilation while retaining existing stagger/overlap APIs.
- Added pure distance-weighted `motionPath()`, deterministic `seededSignal()`,
  and `maskReveal()` compilers.
- Added a curated registry of 38 entrance, exit, emphasis, and ambient motion
  presets with bounded parameter schemas, thumbnail metadata, and opacity-only
  reduced-motion variants.
- Preset names and sequencing intent compile away; stored scenes contain only
  validated keyframe data.

### Testing and documentation

- Accepted [RFC 0005](docs/rfcs/0005-animation-system.md).
- Added unit coverage for playback cycles, markers, path/signal/mask compilers,
  every registry entry, reduced motion, and filter interpolation.
- Added the exact-pixel `motion-preset-catalog` browser contact sheet covering
  the complete curated registry.

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
