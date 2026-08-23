# Progress

## 2026-08-24 (0.7 visual primitives)

### Changed

- Drafted RFC 0004 and added serializable rectangle, ellipse, normalized
  line/polyline/polygon, and bounded SVG path + viewBox geometry through the
  new Scene v1 `shape` node.
- Added closed vector clips, binary/inverted vector masks, bounded Canvas
  blend modes, shape fills/strokes/dashes, and linear/radial/conic paint.
- Added per-side margin/padding, aspect-ratio sizing, and per-corner radii used
  consistently across layout, backgrounds, media, overflow, borders, and
  rectangle shapes.
- Added core and seconds-first authoring builders, patch support, inspection
  capability flags, Canvas Path2D/DOMMatrix preflight, and generated JSON
  Schema coverage.
- Added a combined pinned-browser exact-pixel fixture covering the complete
  primitive render path without changing existing golden hashes.
- Completed the milestone with staged multiple shadows, isolated subtree
  compositing, feathered/opacity vector masks, composable safe-area insets,
  metric-stable inline text runs, and explicit text direction.

### Tested

- `pnpm release:full` — typecheck, 558 unit tests, contract/determinism/schema/
  migration lint, production builds, six resource checks, all existing and
  visual-primitive browser goldens, ten E2E checks, CLI/starter smoke, and all
  ten 0.7.0 package dry-runs passed.
- `pnpm golden:test` passes with `visual-primitives` at hash
  `57fec0d6db33b95946191035a85315cdc9573f32e67eadf95429c0b739151b2d`.
- `pnpm verify:clean` packed and installed all ten 0.7.0 packages into a
  temporary starter, then validated, migrated, inspected, linted, and built it
  outside the monorepo.

### Notes

- Bitmap/luminance masks, per-run font metrics, path morphing, and shadow
  spread/inset remain additive follow-ups; the roadmap's Milestone 3 outcome is
  otherwise complete and ready for the 0.7 release gate.

## 2026-08-24 (0.6 versioned extension kernel)

### Changed

- Accepted RFC 0003 and added `@motionforge/extensions` with trusted
  definitions, exact-version registries, explicit compatibility aliases,
  parameter JSON Schema manifests, and typed preflight issues.
- Added JSON-only Scene v1 `extension` nodes, core and seconds-first authoring
  builders, patch support, inspection counts/capabilities, and generated Scene
  JSON Schema coverage.
- Integrated extension asset discovery/resolution, optional per-frame
  preparation, typed Canvas2D drawing, staged-frame validation, and disposal
  into the shared renderer lifecycle.
- Added player/export registry and worker-policy forwarding so preview and
  export use the same installed definitions and resources.
- Added unit coverage across schema, patches, builders, registries, preflight,
  and renderer lifecycle, plus a pinned-browser exact-pixel extension golden.
- Synchronized all ten public packages at 0.6.0 and included the extension
  package in dependency-boundary, pack, release, and clean-machine gates.

### Tested

- `pnpm release:full` — typecheck, 541 unit tests, package/determinism/schema/
  migration lint, production builds, six long-resource checks, extension and
  existing pixel/media/audio goldens, ten browser E2E checks, CLI/starter
  smoke, and all ten 0.6.0 package dry-runs passed.
- `pnpm verify:clean` — packed and installed all ten 0.6.0 packages in a
  temporary starter, then validated, migrated, inspected, linted, and built
  the project successfully outside the monorepo.

### Notes

- Existing built-in effects remain schema-native in 0.6. Moving them into an
  official extension pack requires a separately versioned pixel-compatible
  migration and is not part of the kernel release.
- The commercial DojoClip repository remains untouched; downstream adoption
  stays a separate guarded upgrade.

## 2026-08-23 (0.5 Scene v1 compatibility and preflight contract)

### Changed

- Accepted RFC 0002 and made `schemaVersion: 1` canonical across builders,
  authoring, fixtures, examples, prompts, verification scenes, and docs.
- Added cached, deterministic, non-mutating v0 migration through
  `migrateScene()`. `parseScene()` and `validateScene()` remain backward
  compatible, while `sceneSchema` and the shipped JSON Schema are strict v1.
- Added early typed reference validation for image, video, audio, Lottie,
  audio-reactive, and cover-image asset references.
- Moved stable scene inspection into `@motionforge/schema`, added `lintScene()`
  editorial warnings, and added Canvas2D runtime preflight for Canvas, decoder,
  font, and current DOM-Lottie requirements.
- Added `motionforge migrate` / `motionforge lint`, exposed both in generated
  starters, and removed the starter generator's hard-coded package version.
- Added paired v0/v1 migration fixtures plus generated-schema and migration
  parity checks to the normal lint/release gate.
- Updated the testing strategy, package docs, CLI guides, agent contract, Scene
  Format, roadmap, and changelog for the v1 contract.

### Tested

- `pnpm release:full` — typecheck, 529 unit tests, package/determinism/schema/
  migration lint, production builds, six long-resource checks, pixel/media/
  audio and v0→v1 parity goldens, ten browser E2E checks, CLI/starter smoke,
  and all nine 0.5.0 package dry-runs passed.
- `pnpm verify:clean` — packed and installed all nine 0.5.0 packages in a
  temporary starter, then validated, migrated, inspected, linted, and built the
  project successfully outside the monorepo.

### Notes

- The v0 → v1 migration intentionally changes only the version after normal
  validation/defaulting, and the pinned-browser golden hashes remain unchanged.
- Downstream application adoption remains a separate guarded change; the
  DojoClip repository is still untouched.

## 2026-08-23 (0.4 production reconciliation and source-of-truth gate)

### Changed

- Reconciled the reusable MotionForge changes proven in DojoClip's production
  consumer back into the standalone open-source packages: effect nodes, 24
  procedural/audio-reactive effects, agent macros and intents, shared effect
  normalization, sequential video decoding, player audio/lifecycle hardening,
  and export frame-loop optimizations.
- Kept the reconciliation engine-only. No authentication, database, billing,
  storage, queue, or product UI code was introduced, and the DojoClip
  repository was not modified.
- Fixed standalone integration boundaries surfaced by the merge: NodeNext ESM
  specifiers, effect-node exhaustiveness in authoring/CLI code, player mock
  return types, and the presets macro package export/dependency.
- Completed the public builder surface for the new node union with core
  `lottie()` / `effect()` builders and authoring `lottieAsset()`,
  `lottieClip()`, and `effectLayer()` helpers.
- Synchronized all nine public packages at 0.4.0 and added
  `pnpm check:contracts` for version, changelog, internal dependency, and
  browser-engine boundary enforcement. Filled missing package-local MIT
  licenses and made README/license presence part of the contract gate.
- Added `effect-showcase`, a seeded pinned-Chromium exact-pixel fixture covering
  the six general procedural effects.
- Added the v1 base-engine roadmap and source-of-truth integration policy, and
  updated README, scene-format, agent, package, and Remotion comparison docs.

### Tested

- `pnpm release:full` — typecheck, 518 unit tests, contract/determinism
  lint, production builds, six long-resource checks, pixel/media/audio goldens,
  ten browser E2E checks, CLI/starter smoke, and all nine package dry-runs
  passed.
- `pnpm verify:clean` — packed all nine 0.4.0 packages, installed the generated
  starter from tarballs in a temporary clean project, then validated, inspected,
  and built it successfully.

### Notes

- The open-source side is ready to be authoritative. Upgrading the commercial
  downstream consumer is a separate guarded step after a tag or exact commit
  is selected and the application runs its own acceptance suite.
- Scene v1 and the extension kernel are deliberately the next milestones;
  additional named effects should not expand the core switch indefinitely.

This is the living project log. Every meaningful implementation slice should record what changed, how it was tested, and what remains uncertain.

## 2026-06-19 (core engine RC6: long-scene resource confidence)

### Changed

- Added `tools/golden/src/resource-smoke.ts`.
- Added root `pnpm resource:smoke` and golden-package `resource:smoke`.
- Added resource smoke to `pnpm release:full`.
- Documented current long-scene behavior: export audio is chunked, player preview audio is whole-scene, looped beds split source ranges instead of duplicating nodes, and asset disposal remains explicit.
- Marked RC6 complete in the core engine RC roadmap.

### Tested

- `pnpm exec prettier --write package.json tools/golden/package.json scripts/release-gate.mjs tools/golden/src/resource-smoke.ts README.md docs/benchmarks.md docs/testing-strategy.md docs/core-engine-rc-roadmap.md docs/progress.md packages/player/README.md packages/export/README.md`
- `git diff --check`
- `pnpm resource:smoke`
- `pnpm --filter @motionforge/golden typecheck`

### Notes

- This does not replace browser goldens. It is a cheap Node smoke for long-scene math and many-node evaluation; encoded audio/video behavior remains covered by `pnpm golden:test`.

## 2026-06-19 (core engine RC5: clean-machine verification)

### Changed

- Added `scripts/verify-clean-machine.mjs`.
- Added root `pnpm verify:clean`.
- The verification packs publishable packages, generates a starter project in a temp directory, installs local tarball dependencies, then runs the starter's `validate`, `inspect`, and `build` scripts outside the monorepo.
- Documented `pnpm verify:clean -- --keep` for preserving the temp starter and manually checking Studio/browser export.
- Marked RC5 complete in the core engine RC roadmap.

### Tested

- `pnpm exec prettier --write package.json scripts/verify-clean-machine.mjs README.md docs/testing-strategy.md docs/core-engine-rc-roadmap.md docs/progress.md`
- `pnpm verify:clean`

### Notes

- Browser MP4 export remains a browser capability check; the clean-machine script verifies the install/build/CLI path and prints the manual Studio follow-up.
- The verification installs local tarballs into a temp starter, then runs `pnpm validate`, `pnpm inspect`, and `pnpm build` from that starter.

## 2026-06-19 (core engine RC4: release gate)

### Changed

- Added `scripts/release-gate.mjs` with `fast` and `full` modes.
- Added root `pnpm release:fast` and `pnpm release:full` scripts.
- Added built CLI smokes for `motionforge validate` and `motionforge inspect`.
- Added a built `create-motionforge` smoke that verifies generated starter scripts.
- Added `inspect` to the generated starter project scripts so docs and generator output match.
- Documented release gates in the README, testing strategy, and core RC roadmap.

### Tested

- `pnpm exec prettier --write package.json scripts/release-gate.mjs README.md docs/testing-strategy.md docs/core-engine-rc-roadmap.md docs/progress.md docs/guides/getting-started.md packages/create-motionforge/src/index.ts packages/create-motionforge/src/index.test.ts`
- `pnpm --filter create-motionforge test`
- `pnpm --filter @motionforge/cli build`
- `pnpm --filter create-motionforge build`
- `node scripts/release-gate.mjs smoke`
- `node scripts/release-gate.mjs pack`
- `pnpm --filter @motionforge/playground build`
- `pnpm release:fast`

### Notes

- `release:full` includes `npm pack --dry-run`, but clean install from packed tarballs remains RC5.
- The first `release:fast` run exposed and drove a fix for playground production builds resolving workspace package dist dependencies.

## 2026-06-19 (core engine RC3: golden RC matrix)

### Changed

- Reworked `docs/testing-strategy.md` into an RC golden matrix covering exact goldens, probe goldens, browser export smoke, video checks, audio checks, and playground E2E.
- Added browser-level exported-audio checks for `volumeEnvelope` fade behavior and `loop: true` audio beds.
- Factored the golden harness RMS window reader so future ducking checks can reuse the same decoded-MP4 assertion path.
- Marked RC3 complete in the core engine RC roadmap.

### Tested

- `pnpm exec prettier --write tools/golden/src/harness.ts docs/testing-strategy.md docs/core-engine-rc-roadmap.md docs/progress.md`
- `git diff --check`
- `pnpm --filter @motionforge/golden typecheck`
- `pnpm --filter @motionforge/golden run golden:test`

### Notes

- Ducking remains future mixer work. The matrix now names it as the audio-browser gap to fill when that feature lands.

## 2026-06-19 (core engine RC2: public API audit)

### Changed

- Added API Stability sections to the schema, core, renderer, export, player, presets, authoring, CLI, and create-project package READMEs.
- Classified package surfaces as stable for 0.x integrations, experimental before 1.0, or internal/not public.
- Marked `@motionforge/showcase` as private workspace infrastructure rather than a public API package.
- Clarified browser export, audio helper, preset catalog, Studio, and generated-template boundaries so app internals do not look like engine contracts.

### Tested

- `pnpm exec prettier --write docs/core-engine-rc-roadmap.md docs/progress.md docs/scene-format.md docs/audio-overlay-roadmap.md packages/schema/README.md packages/core/README.md packages/renderer-canvas2d/README.md packages/export/README.md packages/player/README.md packages/presets/README.md packages/authoring/README.md packages/cli/README.md packages/create-motionforge/README.md packages/showcase/README.md`
- `git diff --check`

### Notes

- These labels are a 0.x compatibility guide, not a full 1.0 freeze. Additive schema and inspection fields remain expected while the RC track continues.

## 2026-06-19 (core engine RC1: CLI scene inspection)

### Changed

- Added `docs/core-engine-rc-roadmap.md` for the release-candidate hardening track.
- Linked the RC track from the main roadmap.
- Added `motionforge inspect <scene-module>` to validate a scene and print machine-readable metadata.
- Inspection output summarizes dimensions, duration, asset counts, node counts, and capability flags for visuals, audio, video, Lottie, animations, volume automation, and looped audio.
- Updated the CLI README with `inspect` usage.

### Tested

- `pnpm --filter @motionforge/cli typecheck`
- `pnpm --filter @motionforge/cli test`
- `pnpm --filter @motionforge/cli build`

### Notes

- This starts the RC track by strengthening automation and agent ergonomics around the existing CLI instead of adding a parallel tool.

## 2026-06-19 (audio overlay AX5d: looped beds)

### Changed

- Added audio-only `loop` to the scene schema, patch vocabulary, and core builders.
- Made export/player audio mixing split looped source ranges deterministically across source wraps.
- Added `loop` options to preset and authoring audio helpers.
- Taught deterministic chat audio prompts to recognize loop/repeat wording for audio overlays.
- Updated scene docs, authoring docs, preset docs, chat examples, and LLM context.

### Tested

- `pnpm --filter @motionforge/schema typecheck`
- `pnpm --filter @motionforge/schema test`
- `pnpm --filter @motionforge/schema build`
- `pnpm --filter @motionforge/core typecheck`
- `pnpm --filter @motionforge/core test`
- `pnpm --filter @motionforge/core build`
- `pnpm --filter @motionforge/export typecheck`
- `pnpm --filter @motionforge/export test`
- `pnpm --filter @motionforge/export build`
- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/presets test -- index.test.ts`
- `pnpm --filter @motionforge/presets build`
- `pnpm --filter @motionforge/authoring typecheck`
- `pnpm --filter @motionforge/authoring test`
- `pnpm --filter @motionforge/authoring build`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat test -- local-agent.test.ts`
- `pnpm --filter @motionforge/chat test -- examples.test.ts`

### Notes

- Looping is deliberately audio-only in this slice. Video visual looping and ducking remain separate work.

## 2026-06-19 (audio overlay AX5c: chat fade refresh)

### Changed

- Taught the deterministic chat audio overlay parser to recognize `fade in` and `fade out` durations in seconds.
- Threaded parsed fade durations into preset-backed audio overlay nodes, producing validated `volumeEnvelope` data.
- Updated chat prompt chips, README examples, and model prompt context around fade-capable audio overlays.

### Tested

- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat test -- local-agent.test.ts`
- `pnpm --filter @motionforge/chat test -- examples.test.ts`

### Notes

- Chat now exercises the same fade API as programmers. Looping and ducking still need dedicated engine support.

## 2026-06-19 (audio overlay AX5b: fade helpers)

### Changed

- Added `audioFadeEnvelope()` to `@motionforge/presets` for deterministic gain curves.
- Added `fadeInDuration` and `fadeOutDuration` options to preset-level `audioOverlay()`.
- Added seconds-friendly `fadeIn` and `fadeOut` options to authoring `audioOverlay()` and `audioTrack()`.
- Preserved explicit `volumeEnvelope` values when adapting preset nodes through the authoring API.
- Updated authoring and preset docs to show fades as supported mixer-visible data.

### Tested

- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/presets test -- index.test.ts`
- `pnpm --filter @motionforge/presets build`
- `pnpm --filter @motionforge/authoring typecheck`
- `pnpm --filter @motionforge/authoring test`
- `pnpm --filter @motionforge/authoring build`

### Notes

- Fades now compile to ordinary `volumeEnvelope` points. Looping and ducking remain separate AX5 work.

## 2026-06-19 (audio overlay AX5a: volume envelopes)

### Changed

- Added `volumeEnvelope` to the scene contract for audio and video nodes.
- Carried volume envelopes through `@motionforge/core` builders and validated them through `setNodeProps`.
- Made the export mixer multiply static `volume` by node-local envelope samples, including ancestor-clipped chunks.
- Reused the existing keyframe easing evaluator so envelope points can use the same easing vocabulary as visual animations.
- Updated scene-format docs, LLM prompt context, and the audio roadmap.

### Tested

- `pnpm --filter @motionforge/schema typecheck`
- `pnpm --filter @motionforge/schema test`
- `pnpm --filter @motionforge/schema build`
- `pnpm --filter @motionforge/core typecheck`
- `pnpm --filter @motionforge/core test`
- `pnpm --filter @motionforge/core build`
- `pnpm --filter @motionforge/export typecheck`
- `pnpm --filter @motionforge/export test`
- `pnpm --filter @motionforge/export build`

### Notes

- This is the mixer-visible foundation for fades and ducking. Preset/authoring helpers and browser-level audible regression checks remain in AX5.

## 2026-06-19 (audio overlay AX4b: chat/app refresh)

### Changed

- Added chat prompt chips for background music, voiceover, and notification ping audio overlay instructions using `@` asset mentions.
- Added local audio-overlay intent handling for background music, voiceover, sound effects, beat accents, ambient beds, and notification pings.
- Made uploaded audio mentions produce `setAsset` plus preset-backed audio nodes, including first-draft scenes.
- Kept existing scene audio assets usable through plain-language instructions like "add quiet background music".
- Marked AX4 complete in the audio overlay roadmap.

### Tested

- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat test -- local-agent.test.ts`
- `pnpm --filter @motionforge/chat test -- examples.test.ts`

### Notes

- Audio overlay instructions now prefer preset-backed audio nodes over generic fallback text edits when an audio asset is available. Fade/ducking language still waits for AX5 engine support.

## 2026-06-19 (audio overlay AX4a: catalog and patch examples)

### Changed

- Added an `audio` preset family to the shared preset catalog.
- Added catalog entries and TypeScript snippets for all audio overlay templates.
- Added audio overlay patch examples that insert audio nodes using the first audio asset in the current scene.
- Added unavailable-state messaging when a scene has no audio assets.
- Updated Playground preset catalog tests through the shared catalog re-export path.

### Tested

- `pnpm --filter @motionforge/presets test -- catalog.test.ts`
- `pnpm --filter @motionforge/playground test -- preset-catalog.test.ts`
- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/playground typecheck`

### Notes

- The Playground preset explorer can list audio presets immediately. A visual gallery scene is deferred until the audio stress gallery because the useful proof is audible/export-measurable rather than visual cards alone.

## 2026-06-19 (audio overlay AX3: authoring helper)

### Changed

- Added authoring-level `audioOverlay(asset, options)` that accepts an audio asset object or existing asset id.
- Passing an audio asset object now auto-adds it to `scene.assets`, matching `audioTrack()`, image overlays, and video overlays.
- Re-exported audio overlay template metadata and template-key types from `@motionforge/authoring`.
- Documented background music, voiceover, ambience, notification cue, and existing-asset workflows in the authoring guide and package README.
- Marked AX3 complete in the audio overlay roadmap.

### Tested

- `pnpm --filter @motionforge/authoring typecheck`
- `pnpm --filter @motionforge/authoring test`
- `pnpm --filter @motionforge/authoring build`

### Notes

- `audioOverlay()` accepts seconds-first `trimStart`, `at`, and `duration` options, then emits ordinary frame-timed `audio` scene nodes.

## 2026-06-19 (audio overlay AX2: preset helper)

### Changed

- Added `audioOverlay()` to `@motionforge/presets`.
- Added audio overlay template metadata for `backgroundMusic`, `voiceover`, `soundEffect`, `beatAccent`, `ambientBed`, and `notificationPing`.
- Added role defaults for conservative volumes and short cue durations where appropriate.
- Documented audio overlay presets in the preset catalog guide.
- Marked AX2 complete in the audio overlay roadmap.

### Tested

- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/presets test -- index.test.ts`
- `pnpm --filter @motionforge/presets build`

### Notes

- The helper emits ordinary `audio` nodes with static `volume`, `audioStartTime`, `from`, and `duration`. Fades, looping, and ducking wait for a mixer-visible scene contract.

## 2026-06-19 (audio overlay AX1: roadmap)

### Changed

- Added `docs/audio-overlay-roadmap.md` as the next media theme after video overlays.
- Scoped audio overlays around data-first helpers for background music, voiceover, ambience, sound effects, beat accents, and notification cues.
- Recorded the current engine baseline: `audio` nodes, `audioStartTime`, static `volume`, export mixing, player preview, and `audioTrack()`.
- Explicitly separated current-helper work from later engine work for volume automation, fades, looping, and ducking.

### Tested

- Documentation-only slice; no code tests run.

### Notes

- Audio nodes currently reject animations, so fade and ducking helpers should wait for mixer-visible schema support instead of pretending style/keyframe animations affect sound.

## 2026-06-19 (video overlay VX5: stress gallery)

### Changed

- Added a self-contained video overlay stress gallery to `@motionforge/showcase`.
- Embedded a tiny deterministic MP4 data URL so generated JSON can render without external media files.
- Covered picture-in-picture, reaction cam, screen demo, muted background loop, b-roll strip, and video badge overlay presets in one scene.
- Added showcase tests for trim start, playback rate, clip volume, object-fit contain, object position, and muted defaults.
- Documented the generated example and docs poster refresh command.
- Marked VX5 complete in the video overlay roadmap.

### Tested

- `pnpm --filter @motionforge/showcase typecheck`
- `pnpm --filter @motionforge/showcase test`
- `pnpm --filter @motionforge/showcase build`
- `pnpm showcase:generate`
- `pnpm --filter @motionforge/golden run example examples/generated/video-overlay-stress-gallery.json docs/assets/showcase/video-overlay-stress-gallery.mp4 45`

### Notes

- The fixture intentionally uses ordinary `video` nodes, so app UIs and agents can patch the same `assetId`, `videoStartTime`, `playbackRate`, `volume`, and style fields they already understand.

## 2026-06-18 (video overlay VX4: chat/app refresh)

### Changed

- Added chat prompt chips for picture-in-picture, b-roll strip, and screen demo video overlay instructions using `@` asset mentions.
- Added local video-overlay intent handling for picture-in-picture, reaction cam, screen demo, background loop, b-roll strip, and video badge instructions.
- Made uploaded video mentions produce `setAsset` plus preset-backed overlay nodes, including first-draft scenes.
- Kept existing scene video assets usable through plain-language instructions like “put the clip top-right as picture-in-picture”.
- Marked VX4 complete in the video overlay roadmap.

### Tested

- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat test -- local-agent.test.ts`
- `pnpm --filter @motionforge/chat test -- examples.test.ts`

### Notes

- Video-overlay-like instructions now prefer overlay nodes over the generic video sequencing path when a video asset is available. Full-frame sequencing still owns ordinary “put video one first, then video two...” edits.

## 2026-06-18 (video overlay VX3: catalog and patch examples)

### Changed

- Added a `video` preset family to the shared preset catalog.
- Added catalog entries and TypeScript snippets for all video overlay templates.
- Added video overlay patch examples that insert overlay nodes using the first video asset in the current scene.
- Added unavailable-state messaging when a scene has no video assets.
- Updated Playground preset catalog tests through the shared catalog re-export path.
- Widened preset gallery lookup to accept catalog families without preview scenes, returning `undefined` for families that do not yet have a gallery.
- Marked VX3 complete in the video overlay roadmap.

### Tested

- `pnpm --filter @motionforge/presets test -- catalog.test.ts`
- `pnpm --filter @motionforge/playground test -- preset-catalog.test.ts`
- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/presets build`
- `pnpm --filter @motionforge/showcase typecheck`
- `pnpm --filter @motionforge/showcase build`
- `pnpm --filter @motionforge/playground typecheck`

### Notes

- Video overlay previews intentionally wait for the VX5 stress gallery; the Playground explorer can still show snippets and insert patch examples immediately.

## 2026-06-18 (video overlay VX2: authoring helper)

### Changed

- Added authoring-level `videoOverlay(asset, options)` that accepts a video asset object or existing asset id.
- Passing a video asset object now auto-adds it to `scene.assets`, matching `videoClip()` and `imageOverlay()`.
- Re-exported video overlay template metadata and types from `@motionforge/authoring`.
- Preserved `volume` when adapting preset-generated video nodes through authoring builders.
- Documented picture-in-picture, reaction cam, and screen demo overlay workflows in the authoring guide and package README.
- Marked VX2 complete in the video overlay roadmap.

### Tested

- `pnpm --filter @motionforge/authoring typecheck`
- `pnpm --filter @motionforge/authoring test`
- `pnpm --filter @motionforge/authoring build`

### Notes

- `videoOverlay()` accepts seconds-first `trimStart`, `at`, and `duration` options, then emits ordinary frame-timed `video` scene nodes.

## 2026-06-18 (video overlay VX1: preset helper)

### Changed

- Added `videoOverlay()` to `@motionforge/presets`.
- Added video overlay template metadata for `pictureInPicture`, `reactionCam`, `screenDemo`, `backgroundLoop`, `brollStrip`, and `videoBadge`.
- Added options for composition-aware safe-area placement, object fit, object position, opacity, border radius, shadows, source trim, playback rate, volume, muted defaults, timing, and entrance motion.
- Documented video overlay templates in the preset catalog guide.
- Marked VX1 complete in the video overlay roadmap.

### Tested

- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/presets test`
- `pnpm --filter @motionforge/presets build`

### Notes

- `videoOverlay()` emits ordinary `video` nodes, not wrappers. That keeps trim, playback rate, volume, object fit, opacity, rounded crop, and shadows patchable on one node.

## 2026-06-18 (video overlay roadmap)

### Changed

- Added `docs/video-overlay-roadmap.md` as the next overlay theme after image overlays.
- Scoped the theme around data-first video overlay helpers, authoring convenience, preset catalog discovery, chat/app refresh, and visual stress galleries.
- Recorded the current video baseline: schema-backed `video` nodes, source trims, playback rate, volume, clip audio export, `videoClip()`, media looks, clip layouts, and chat media sequencing.
- Linked the roadmap from `docs/roadmap.md`.

### Tested

- Documentation-only change; no runtime tests.

### Notes

- Video overlays will default toward muted/decorative behavior for overlay templates, while full media sequencing remains responsible for normal clip audio unless the caller opts in.

## 2026-06-18 (image overlay IX5: stress gallery)

### Changed

- Added a self-contained image overlay stress gallery to `@motionforge/showcase`.
- Covered square logo bugs, wide watermarks, transparent stickers, wide product shots, tall portraits, and oversized badge assets through shared `imageOverlay()` presets.
- Added showcase tests for stable scene id, six image assets, six overlay nodes, SVG data URLs, and watermark opacity.
- Documented the generated image overlay stress example and render command.
- Marked IX5 complete in the image overlay roadmap.

### Tested

- `pnpm --filter @motionforge/showcase typecheck`
- `pnpm --filter @motionforge/showcase test`
- `pnpm --filter @motionforge/showcase build`
- `pnpm showcase:generate`
- `pnpm --filter @motionforge/golden run example examples/generated/image-overlay-stress-gallery.json docs/assets/showcase/image-overlay-stress-gallery.mp4 45`

### Notes

- The gallery uses deterministic SVG data URLs so contributors can refresh the JSON and poster without managing external asset files.
- The generated poster was visually checked after rendering and the gallery coordinates were adjusted to keep overlays clear of the proof cards.

## 2026-06-18 (image overlay IX4: chat/app refresh)

### Changed

- Added chat prompt chips for logo bugs, watermarks, stickers, and product shots using `@` asset mentions.
- Added local image-overlay intent handling for logo, watermark, sticker, product, avatar, and badge instructions.
- Made uploaded image mentions produce `setAsset` plus preset-backed overlay nodes, including first-draft scenes.
- Kept existing scene image assets usable through plain-language instructions like “put the logo top-right”.
- Marked IX4 complete in the image overlay roadmap.

### Tested

- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat test -- local-agent.test.ts`
- `pnpm --filter @motionforge/chat test -- examples.test.ts`

### Notes

- Image-overlay-like instructions now prefer overlay nodes over the generic image sequencing path when an image asset is available. Full-frame image sequencing still owns ordinary “use this image first, then...” media edits.

## 2026-06-18 (image overlay IX3: catalog and patch examples)

### Changed

- Added an `image` preset family to the shared preset catalog.
- Added catalog entries and TypeScript snippets for all image overlay templates.
- Added image overlay patch examples that insert overlay nodes using the first image asset in the current scene.
- Added unavailable-state messaging when a scene has no image assets.
- Updated Playground preset catalog tests through the shared catalog re-export path.
- Marked IX3 complete in the image overlay roadmap.

### Tested

- `pnpm --filter @motionforge/presets test -- catalog.test.ts`
- `pnpm --filter @motionforge/playground test -- preset-catalog.test.ts`
- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/presets build`
- `pnpm --filter @motionforge/playground typecheck`

### Notes

- The visual gallery preview for image overlays is intentionally left to IX5; until then, the Playground preset explorer shows snippets and patch examples for the image family.

## 2026-06-18 (image overlay IX2: authoring helper)

### Changed

- Added authoring-level `imageOverlay(asset, options)` that accepts an image asset object or existing asset id.
- Passing an image asset object now auto-adds it to `scene.assets`, matching existing `image()` and `videoClip()` behavior.
- Re-exported image overlay template metadata and types from `@motionforge/authoring`.
- Added authoring tests for safe-area placement, timing conversion, asset registration, string asset ids, and manual overrides.
- Documented logo/product/avatar overlay workflows in the authoring guide and package README.
- Marked IX2 complete in the image overlay roadmap.

### Tested

- `pnpm --filter @motionforge/authoring typecheck`
- `pnpm --filter @motionforge/authoring test`
- `pnpm --filter @motionforge/authoring build`

### Notes

- The helper wraps the preset `imageOverlay()` and adapts generated scene nodes back into authoring builders, so the emitted JSON remains the same data shape used by lower-level presets.

## 2026-06-18 (image overlay IX1: preset helper)

### Changed

- Added `imageOverlay()` to `@motionforge/presets`.
- Added image overlay template metadata for `logoBug`, `watermark`, `sticker`, `productShot`, `cornerBadge`, and `avatarBadge`.
- Added image-specific placement names such as `topRight` and `bottomLeft`, mapped onto the existing safe-area anchors and alignment options.
- Added options for composition-aware safe-area placement, object fit, object position, opacity, border radius, shadows, image style overrides, timing, and entrance motion.
- Added tests for metadata stability, schema-valid output, safe-area placement, override behavior, and invalid asset ids.
- Documented the image overlay template catalog.
- Marked IX1 complete in the image overlay roadmap.

### Tested

- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/presets test`
- `pnpm --filter @motionforge/presets build`

### Notes

- `imageOverlay()` emits ordinary wrapper `div` nodes with a single `img` child so chat, Studio, Playground, validators, and patch loops can inspect and edit overlays directly.

## 2026-06-18 (image overlay roadmap)

### Changed

- Added `docs/image-overlay-roadmap.md` as the next overlay theme after robust text and subtitle overlays.
- Scoped the theme around data-first image overlay helpers, authoring convenience, preset catalog discovery, chat/app refresh, and visual stress galleries.
- Recorded the current image baseline: schema-backed `img` nodes, `objectFit`/`objectPosition`, image assets, authoring media helpers, and shared safe-area primitives.
- Linked the roadmap from `docs/roadmap.md`.

### Tested

- Documentation-only change.

### Notes

- First implementation slice is IX1: an `imageOverlay()` preset helper for common overlays such as logos, watermarks, stickers, product shots, corner badges, and avatar badges.

## 2026-06-18 (subtitle overlay SX5: stress gallery)

### Changed

- Added `subtitleStressGalleryScene()` to `@motionforge/showcase`.
- Added the generated scene JSON at `examples/generated/subtitle-stress-gallery.json`.
- Added a docs poster at `docs/assets/showcase/subtitle-stress-gallery.png`.
- Covered parsed SRT multiline cues, parsed WebVTT cue settings/notes, long Latin, URLs, CJK, emoji, and fast cue changes in one deterministic showcase scene.
- Documented the gallery in `docs/showcase.md` and the refresh/render command in `examples/README.md`.
- Marked SX5 complete in the subtitle overlay roadmap.

### Tested

- `pnpm --filter @motionforge/showcase typecheck`
- `pnpm --filter @motionforge/showcase test`
- `pnpm --filter @motionforge/showcase build`
- `pnpm showcase:generate`
- `pnpm --filter @motionforge/golden run example examples/generated/subtitle-stress-gallery.json docs/assets/showcase/subtitle-stress-gallery.mp4 90`

### Notes

- The intermediate MP4 was removed after rendering; the committed poster is frame 90, where the long Latin subtitle proves bounded shrink/clamp behavior.

## 2026-06-18 (subtitle overlay SX4: template robustness)

### Changed

- Added an explicit subtitle text safety helper for segment-timed subtitle tracks.
- Added regression coverage that runs long subtitle text through every named subtitle template.
- Verified every template keeps segment subtitles bounded with full-size text boxes, hidden overflow, shrink fit, ellipsis, `maxLines`, and `minFontSize`.
- Documented segment subtitle safety semantics and override controls in the preset catalog.
- Marked SX4 complete in the subtitle overlay roadmap.

### Tested

- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/presets test`
- `pnpm --filter @motionforge/presets build`

### Notes

- This slice keeps the existing template visuals intact; it hardens the contract around long SRT/VTT-style text and proves the override path still works.

## 2026-06-18 (subtitle overlay SX3: authoring workflow)

### Changed

- Added authoring-level `subtitleTrack()` and `subtitles()` helpers that compile SRT/VTT-style segments into validated scene nodes with scene-aware safe-area placement.
- Added authoring-level `captionTrack()` and `captions()` helpers for word-timed ASR caption templates.
- Re-exported `parseSrt()`, `parseVtt()`, `subtitleTemplates`, and subtitle/caption types from `@motionforge/authoring`.
- Added authoring tests for parsed SRT, parsed WebVTT, and word-timed caption tracks.
- Documented paste-SRT, paste-VTT, manual segment, and ASR word-timing workflows in the authoring guide and package README.
- Documented where transcript/subtitle assets belong in example projects.
- Marked SX3 complete in the subtitle overlay roadmap.

### Tested

- `pnpm --filter @motionforge/authoring typecheck`
- `pnpm --filter @motionforge/authoring test`
- `pnpm --filter @motionforge/authoring build`

### Notes

- The authoring helpers wrap the preset subtitle engine and still emit ordinary scene nodes, so Studio, Playground, chat, validators, and renderers all see the same data shape.
- The internal adapter intentionally rejects preset `lottie` nodes until `@motionforge/core` exposes a matching builder; subtitle and caption presets currently emit `div`/`text` trees.

## 2026-06-18 (subtitle overlay SX2: SRT and VTT parsing)

### Changed

- Added `parseSrt()` to `@motionforge/presets`.
- Added `parseVtt()` to `@motionforge/presets`.
- SRT parsing supports cue indexes, comma millisecond separators, multiline cue text, and whitespace normalization.
- WebVTT parsing supports `WEBVTT`, cue ids, cue settings, notes, dot millisecond separators, and multiline cue text.
- Parser output feeds directly into `subtitleTrack()`.
- Marked SX2 complete in the subtitle overlay roadmap.

### Tested

- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/presets test`
- `pnpm --filter @motionforge/presets build`

### Notes

- Parsers are pure string-to-segment functions, so browser uploads, chat paste flows, and CLI code can share them.

## 2026-06-18 (subtitle overlay SX1: segment subtitle track)

### Changed

- Added `SubtitleSegment` and `subtitleTrack()` to `@motionforge/presets` for SRT/VTT-style cue workflows without ASR word timing.
- Added robust subtitle text defaults: shrink fit, ellipsis, hidden overflow, `maxLines`, and `minFontSize`.
- Added composition-aware safe-area subtitle placement through the shared `safeAreaBox()` primitive.
- Kept `area`, style, fit, line-count, minimum font-size, and entrance-motion overrides available.
- Documented segment-timed subtitle usage in the preset catalog guide.
- Marked SX1 complete in the subtitle overlay roadmap.

### Tested

- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/presets test`
- `pnpm --filter @motionforge/presets build`

### Notes

- `subtitleTrack()` intentionally emits ordinary timed scene nodes so chat, Studio, Playground, and validators can inspect and patch subtitles like any other layer.

## 2026-06-18 (subtitle overlay roadmap)

### Changed

- Added `docs/subtitle-overlay-roadmap.md` as the next overlay theme after robust text overlays.
- Scoped the theme around segment subtitle tracks, SRT/VTT parsing, authoring workflow, template robustness, and subtitle stress galleries.
- Recorded the current subtitle baseline: `tiktokCaptions()`, `karaokeCaptions()`, `styledCaptions()`, subtitle templates, robust text style keys, and safe-area placement helpers.
- Linked the roadmap from the main project roadmap.

### Tested

- Documentation/link sanity review with `rg`.

### Notes

- First implementation slice is SX1: segment-level `subtitleTrack()` for production-safe subtitles without ASR word timings.

## 2026-06-18 (text robustness TX6: stress gallery)

### Changed

- Added `textStressGalleryScene()` to `@motionforge/showcase`.
- Covered long Latin, long URLs/paths, CJK text, emoji clusters, long single-token text, and multiline captions in bounded overlay cards.
- Added the generated scene JSON at `examples/generated/text-stress-gallery.json`.
- Added a docs poster at `docs/assets/showcase/text-stress-gallery.png`.
- Documented the refresh/render command in `examples/README.md` and listed the scene in `docs/showcase.md`.
- Marked TX6 complete in the text overlay robustness roadmap.

### Tested

- `pnpm --filter @motionforge/showcase typecheck`
- `pnpm --filter @motionforge/showcase test`
- `pnpm --filter @motionforge/showcase build`
- `pnpm showcase:generate`
- `pnpm --filter @motionforge/golden run example examples/generated/text-stress-gallery.json /tmp/text-stress-gallery.mp4 30`

### Notes

- The golden render wrote `/tmp/text-stress-gallery-f30.png`; that verified frame was committed as the docs poster.

## 2026-06-18 (text robustness TX5: robust preset upgrade)

### Changed

- Added slot-specific robust text defaults to `textOverlay()` templates: shrink fit, ellipsis, hidden overflow, `maxLines`, and `minFontSize`.
- Covered title, lower-third, quote, stat, announcement banner, social hook, and chapter title templates.
- Kept slot style overrides last so callers and patch examples can replace fit, overflow, line count, and minimum font size.
- Documented robust text defaults and safe-area composition usage in the preset catalog guide.
- Marked TX5 complete in the text overlay robustness roadmap.

### Tested

- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/presets test`
- `pnpm --filter @motionforge/presets build`
- `pnpm --filter @motionforge/showcase typecheck`
- `pnpm --filter @motionforge/showcase test`
- `pnpm --filter @motionforge/showcase build`
- `pnpm presets:generate`

### Notes

- The change stays data-first: generated presets remain ordinary scene nodes with ordinary style keys, so chat and app inspectors can patch them directly.

## 2026-06-18 (text robustness TX4: safe-area placement primitives)

### Changed

- Added named safe-area profiles in `@motionforge/presets` for vertical, square, and landscape compositions.
- Added `inferSafeAreaProfile()`, `resolveSafeArea()`, and `safeAreaBox()` as reusable style primitives.
- Rewired authoring `textBox()` to consume the shared safe-area primitive and re-export the helper API.
- Added `composition` and `safeArea` options to `textOverlay()` so preset templates can opt into safe-area anchors while preserving legacy fixed placement by default.
- Documented direct safe-area helper usage in the authoring guide.
- Marked TX4 complete in the text overlay robustness roadmap.

### Tested

- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/presets test`
- `pnpm --filter @motionforge/presets build`
- `pnpm --filter @motionforge/authoring typecheck`
- `pnpm --filter @motionforge/authoring test`
- `pnpm --filter @motionforge/authoring build`

### Notes

- Text overlay presets keep their historical fixed coordinates unless callers pass `composition`. That avoids surprising existing scenes while giving chat, Studio, and programmer APIs a shared safe placement path.

## 2026-06-18 (text robustness TX3: authoring text box helper)

### Changed

- Added `textBox()` to `@motionforge/authoring` for bounded, production-safe text overlays.
- Added typed placement options for center, top, bottom, title, subtitle, lower-third, and stat-callout overlays.
- Added safe-area options with default scene-relative insets, equal padding, axis padding, edge-specific padding, and full-frame opt-out.
- Wired helper options to scene style data: `textFit`, `maxLines`, `minFontSize`, `textOverflow`, and hidden overflow.
- Documented title, subtitle, lower-third, and stat-callout examples in the authoring guide.
- Marked TX3 complete in the text overlay robustness roadmap.

### Tested

- `pnpm --filter @motionforge/authoring typecheck`
- `pnpm --filter @motionforge/authoring test`
- `pnpm --filter @motionforge/authoring build`

### Notes

- `textBox()` remains an authoring convenience only. It emits ordinary text nodes so chat, Studio, Playground, renderers, and validators all see the same scene data.

## 2026-06-18 (text robustness TX2: shrink-to-fit text)

### Changed

- Added `textFit: "wrap" | "shrink" | "truncate"` and `minFontSize` to scene styles.
- Added `prepareTextLayout()` in `@motionforge/core` to resolve fitted font size, visible lines, and line height together.
- Updated Canvas2D text drawing to use the same fitted text layout helper as core layout.
- Added deterministic tests for truncate, shrink-to-fit, min font-size clamping, and renderer font selection.
- Regenerated `packages/schema/scene.schema.json`.
- Marked TX2 complete in the text overlay robustness roadmap.

### Tested

- `pnpm --filter @motionforge/schema typecheck`
- `pnpm --filter @motionforge/schema test`
- `pnpm --filter @motionforge/schema build`
- `pnpm --filter @motionforge/core typecheck`
- `pnpm --filter @motionforge/core test`
- `pnpm --filter @motionforge/core build`
- `pnpm --filter @motionforge/renderer-canvas2d typecheck`
- `pnpm --filter @motionforge/renderer-canvas2d test`
- `pnpm --filter @motionforge/renderer-canvas2d build`

### Notes

- Shrink currently optimizes within a bounded text box and clamps at `minFontSize`; impossible-fit text remains bounded by existing line wrapping and overflow semantics.

## 2026-06-18 (text robustness TX1: bounded lines and ellipsis)

### Changed

- Added `maxLines` and `textOverflow: "clip" | "ellipsis"` to the scene style schema.
- Added `prepareTextLines()` in `@motionforge/core` so layout and renderers share clamping/ellipsis semantics.
- Updated intrinsic text auto-height to respect bounded visible lines.
- Updated Canvas2D text rendering to draw only the prepared visible lines.
- Regenerated `packages/schema/scene.schema.json`.
- Marked TX1 complete in the text overlay robustness roadmap.

### Tested

- `pnpm --filter @motionforge/schema typecheck`
- `pnpm --filter @motionforge/schema test`
- `pnpm --filter @motionforge/schema build`
- `pnpm --filter @motionforge/core typecheck`
- `pnpm --filter @motionforge/core test`
- `pnpm --filter @motionforge/core build`
- `pnpm --filter @motionforge/renderer-canvas2d typecheck`
- `pnpm --filter @motionforge/renderer-canvas2d test`
- `pnpm --filter @motionforge/renderer-canvas2d build`

### Notes

- Ellipsis keeps as much of the final visible line as fits. If even the ellipsis cannot fit, the final visible line becomes empty instead of overflowing.

## 2026-06-18 (text overlay robustness roadmap)

### Changed

- Added `docs/text-overlay-robustness-roadmap.md` as the next core-engine theme.
- Scoped the theme around bounded text semantics, shrink-to-fit, authoring helpers, safe-area placement, preset upgrades, and stress goldens.
- Recorded the current text baseline: grapheme-aware wrapping, CJK/emoji tests, renderer-aligned measurement, auto-height text boxes, and existing overlay presets.
- Linked the roadmap from the main project roadmap.

### Tested

- Documentation/link sanity review with `rg`.

### Notes

- The first implementation slice is TX1: `maxLines` plus `textOverflow` semantics across schema, layout, renderer, and tests.

## 2026-06-18 (preset explorer PX4: CLI Studio adoption)

### Changed

- Moved the preset catalog/snippet/patch-example builder into `@motionforge/presets/catalog`.
- Kept the playground on the shared catalog through a local re-export and Vite alias.
- Added a compact preset panel to MotionForge Studio with family filters, preset cards, snippet copy, patch copy, and patch apply.
- Studio preset patches run through `applyScenePatch` and update the in-memory preview scene/JSON inspector.
- Studio now exposes validated scene JSON before preview player creation finishes, so preset inspection remains usable even if media preview setup fails.
- Marked PX4 complete in the preset explorer roadmap.

### Tested

- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/presets test`
- `pnpm --filter @motionforge/presets build`
- `pnpm --filter @motionforge/cli typecheck`
- `pnpm --filter @motionforge/cli test`
- `pnpm --filter @motionforge/cli build`
- `pnpm --filter @motionforge/playground typecheck`
- `pnpm --filter @motionforge/playground test`
- `pnpm --filter @motionforge/playground build`
- Browser smoke at `http://127.0.0.1:5173/`: opened Studio for a temp scene, selected Text, confirmed an `insertNode` patch, applied it, confirmed unique-id refresh and JSON update, selected Media Looks, confirmed a `setStyle` patch targeted the image node, and checked console error logs were empty.

### Notes

- The shared catalog is still intentionally devtool-shaped. Core scene rendering remains independent of preset metadata and UI affordances.

## 2026-06-18 (preset explorer PX3: executable patch examples)

### Changed

- Added preset-backed patch generation to the playground catalog.
- Media look and clip layout presets now generate `setStyle` patch examples against the first compatible image/video node in the current scene.
- Text overlay and transition presets now generate schema-valid `insertNode` examples with unique ids.
- Added a playground patch panel with copy/apply actions that runs through the same `applyScenePatch` API as the agent console.
- Added explicit unavailable states for subtitle presets and scenes without compatible media targets.
- Marked PX3 complete in the preset explorer roadmap.

### Tested

- `pnpm --filter @motionforge/playground typecheck`
- `pnpm --filter @motionforge/playground test`
- `pnpm --filter @motionforge/playground build`
- Browser smoke at `http://localhost:5173/`: selected Text, confirmed an `insertNode` patch, applied it, confirmed the next patch refreshed to a unique id, selected Media Looks, confirmed a `setStyle` patch, and checked console error logs were empty.

### Notes

- PX3 infers a known compatible media node instead of adding a full node-selection model. Selection-aware targeting remains a natural future UI improvement.

## 2026-06-17 (preset explorer PX2: gallery preview loading)

### Changed

- Moved preset gallery scene construction into `@motionforge/showcase` as `presetGalleryScenes` plus `findPresetGalleryScene()`.
- Slimmed `examples/generate-preset-gallery.mjs` so docs JSON is serialized from the shared showcase gallery source.
- Added playground Preset Explorer "Preview gallery" action that loads the selected preset family's gallery scene into the canvas.
- Marked PX1 and PX2 complete in the preset explorer roadmap.

### Tested

- `pnpm --filter @motionforge/showcase test`
- `pnpm --filter @motionforge/showcase typecheck`
- `pnpm --filter @motionforge/showcase build`
- `pnpm presets:generate`
- `pnpm --filter @motionforge/playground typecheck`
- `pnpm --filter @motionforge/playground build`
- Browser smoke at `http://localhost:5173/`: selected Text in the explorer, clicked Preview gallery, confirmed the canvas switched to the 1600x900 text overlay gallery at frame 45, scene metadata updated, and console error logs were empty.

### Notes

- PX2 keeps generated docs JSON and playground preview aligned without making the playground import files from `examples/`.

## 2026-06-17 (preset explorer roadmap + playground PX1)

### Changed

- Added `docs/preset-explorer-roadmap.md` for the next preset discovery theme.
- Added exported transition metadata through `transitionTemplates` and `transitionTemplateEntries`.
- Added a playground Preset Explorer driven by `@motionforge/presets` metadata.
- The explorer filters by preset family and shows key, category, description, and copyable TypeScript snippets.
- Linked the preset explorer roadmap from the main roadmap.

### Tested

- `pnpm --filter @motionforge/presets test`
- `pnpm --filter @motionforge/presets typecheck`
- `pnpm --filter @motionforge/presets build`
- `pnpm --filter @motionforge/playground typecheck`
- `pnpm --filter @motionforge/playground build`
- Browser smoke at `http://localhost:5173/`: explorer rendered, transition family filter updated the list/snippet, copy fallback placed the snippet in the agent console, and console error logs were empty.

### Notes

- PX1 is a discovery/copy surface. Loading gallery scenes and applying preset-backed patches are intentionally scoped as later slices.

## 2026-06-17 (preset/template visual gallery)

### Changed

- Added `examples/generate-preset-gallery.mjs` to generate schema-valid gallery scene JSON for preset docs.
- Added `pnpm presets:generate` as the root shortcut for refreshing generated preset gallery scenes.
- Generated docs thumbnails for subtitle templates, text overlay templates, media looks, clip layouts, and transition overlays under `docs/assets/presets`.
- Embedded the thumbnails into `docs/guides/preset-catalog.md`.
- Documented the thumbnail regeneration commands in `examples/README.md`.
- Updated the preset/template roadmap to mark PT5 complete.

### Tested

- `pnpm presets:generate`
- `pnpm --filter @motionforge/golden run example examples/generated/presets/preset-subtitles.json docs/assets/presets/preset-subtitles.mp4 45`
- `pnpm --filter @motionforge/golden run example examples/generated/presets/preset-text-overlays.json docs/assets/presets/preset-text-overlays.mp4 45`
- `pnpm --filter @motionforge/golden run example examples/generated/presets/preset-media-looks.json docs/assets/presets/preset-media-looks.mp4 45`
- `pnpm --filter @motionforge/golden run example examples/generated/presets/preset-clip-layouts.json docs/assets/presets/preset-clip-layouts.mp4 45`
- `pnpm --filter @motionforge/golden run example examples/generated/presets/preset-transitions.json docs/assets/presets/preset-transitions.mp4 30`

### Notes

- The committed assets are PNG stills; intermediate MP4 files stay ignored.
- Studio or playground preset browsing remains a possible product UX layer, but the open-source docs now have visual preset selection.

## 2026-06-17 (preset/template docs catalog)

### Changed

- Added `docs/guides/preset-catalog.md` as a stable lookup table for subtitle templates, text overlays, media looks, clip layouts, and transition overlays.
- Linked the preset catalog from the programmer guide index, root README, and agent-generated scenes guide.
- Updated the preset/template roadmap with the docs catalog status and the remaining visual-preview follow-up.

### Tested

- Markdown link/path sanity review with `rg`.

### Notes

- This is a docs catalog, not the full visual gallery. PNG/Studio previews remain useful follow-up work.

## 2026-06-17 (preset/template slices PT3-PT4: clip layouts and transitions)

### Changed

- Added `clipLayout()` to `@motionforge/presets`.
- Added stable clip layout catalog metadata through `clipLayouts` and `clipLayoutEntries`.
- Shipped eleven layout presets: fullscreen, contain, picture-in-picture, split screen, 2x2 grid cells, blurred background, and phone-safe vertical.
- Added `transitionOverlay()` for full-frame transition nodes.
- Shipped six transition templates: `fade`, `dipToBlack`, `flash`, `wipeLeft`, `wipeRight`, and `zoom`.
- Documented layouts and transitions in the presets README and programmer guides.
- Updated the preset/template roadmap to mark PT3 and PT4 complete.

### Tested

- `pnpm --filter @motionforge/presets test`
- `pnpm --filter @motionforge/presets typecheck`

### Notes

- Clip layouts return `SceneStyle` fragments. Transitions emit ordinary `div` nodes with opacity/transform keyframes, so no renderer special cases were introduced.

## 2026-06-17 (preset/template slice PT2: media looks)

### Changed

- Added `mediaLook()` to `@motionforge/presets`.
- Added stable media look catalog metadata through `mediaLooks` and `mediaLookEntries`.
- Shipped seven named filter/style presets:
  - `cleanProduct`
  - `punchySocial`
  - `cinematicWarm`
  - `coolNoir`
  - `retroTape`
  - `softPortrait`
  - `blurredBackdrop`
- Documented media looks in the presets README and media guide.
- Updated the preset/template roadmap to mark PT2 complete.

### Tested

- `pnpm --filter @motionforge/presets test`
- `pnpm --filter @motionforge/presets typecheck`

### Notes

- Media looks return `SceneStyle` fragments, not nodes, so they compose with authoring media helpers, future clip layouts, and direct scene JSON.

## 2026-06-17 (preset/template slice PT1: text overlays)

### Changed

- Added `textOverlay()` to `@motionforge/presets`.
- Added stable text overlay catalog metadata through `textOverlayTemplates` and `textOverlayTemplateEntries`.
- Shipped seven overlay templates that compile to ordinary scene nodes:
  - `titleCard`
  - `lowerThird`
  - `quoteCard`
  - `statCallout`
  - `announcementBanner`
  - `socialHook`
  - `chapterTitle`
- Added per-template required slot validation and override support for timing, container style, per-slot style, accent color, and entrance animations.
- Documented overlay templates in the presets README and animation guide.
- Updated the preset/template roadmap to mark PT1 complete.

### Tested

- `pnpm --filter @motionforge/presets test`
- `pnpm --filter @motionforge/presets typecheck`

### Notes

- The templates intentionally emit normal nested `div`/`text` nodes with stable ids. Apps and agents can patch generated children directly.

## 2026-06-17 (preset/template roadmap)

### Changed

- Added `docs/preset-template-roadmap.md`, the next implementation theme after the DX milestone.
- Scoped the preset system around pure compilers that emit normal scene nodes, styles, and animations.
- Planned slices for text overlays, media/filter looks, clip layouts, transitions, and a visual preset gallery.
- Linked the preset/template roadmap from the main roadmap.

### Tested

- Documentation-only slice.

### Notes

- The immediate implementation priority is text overlay templates, because subtitle templates already exist while non-subtitle text overlays are still too manual.

## 2026-06-17 (DX slice DX6: programmer docs path)

### Changed

- Reworked `docs/guides/getting-started.md` around the new `pnpm create motionforge` -> `motionforge dev src/video.ts` flow.
- Added focused programmer guides for:
  - authoring API
  - animation and presets
  - media assets
  - preview/export APIs
  - MotionForge vs Remotion positioning
  - agent-generated scenes and patch loops
- Added `docs/guides/README.md` as the guide index.
- Linked the guide path from the root README.
- Updated the DX roadmap to mark DX6 complete and clarify that browser export is shipped while a dedicated Node CLI render command remains deferred.

### Tested

- `pnpm --filter @motionforge/authoring test`
- `pnpm --filter @motionforge/cli test`
- Markdown link/path sanity review with `rg` across README, DX roadmap, and `docs/guides`.

### Notes

- The docs deliberately lead with the OSS programmer path. The chat app remains a reference consumer and product surface, not the first concept a library user must learn.

## 2026-06-17 (DX slice DX5: asset path story)

### Changed

- Added `publicAsset()` to `@motionforge/authoring` for the supported local asset convention: files under `public/assets` are referenced as `/assets/...` in emitted scene JSON.
- Added typed authoring asset helpers: `imageAsset()`, `videoAsset()`, `audioAsset()`, and `defineAssets()`.
- Updated `image()`, `videoClip()`, and `audioTrack()` so callers can pass either an existing asset id or a typed asset object; typed asset objects are auto-collected into `scene.assets`.
- Updated `create-motionforge` to generate `public/assets/logo.svg` and a starter scene that uses `imageAsset()` plus `publicAsset()`.
- Documented where programmers put asset files and how those paths map to browser-fetchable scene asset URLs.

### Tested

- `pnpm --filter @motionforge/authoring test`
- `pnpm --filter @motionforge/authoring typecheck`
- `pnpm --filter @motionforge/authoring build`
- `pnpm --filter create-motionforge test`
- `pnpm --filter create-motionforge typecheck`
- `pnpm --filter create-motionforge build`
- Generated-project smoke in `/tmp/motionforge-dx5-smoke`, confirming:
  - `create-motionforge` emits `public/assets/logo.svg` and `src/video.ts`
  - `motionforge validate src/video.ts` passes when the local package link is available
  - `motionforge print src/video.ts` emits `assets.logo.src` as `/assets/logo.svg`
  - `motionforge dev src/video.ts --host 127.0.0.1 --port 5189` serves `/assets/logo.svg` and `/__motionforge/scene`

### Notes

- The runtime remains intentionally explicit: MotionForge scene JSON stores asset ids and fetchable `src` strings. There is no hidden resolver attached to a project directory.
- Outside-the-monorepo `file:` installs of unpublished workspace packages still fail on internal `workspace:*` dependencies. This is the same pre-publish limitation recorded in DX3; smoke validation used local symlinks to simulate installed packages.
- Large video/audio files still load as whole blobs through the existing renderer/export path. Streaming sources remain a future runtime improvement.

## 2026-06-17 (DX slice DX4: CLI-hosted Studio)

### Changed

- Added `motionforge dev <scene-module>` to `@motionforge/cli`.
- Implemented a CLI-hosted MotionForge Studio using Vite middleware and a virtual browser client module.
- The Studio loads a local scene module through the existing CLI loader, validates it through `@motionforge/schema`, renders via `@motionforge/player`, and exposes play/pause, frame scrubbing, reload, JSON inspection, and browser MP4 export through `@motionforge/export`.
- Split scene-module loading into `packages/cli/src/loader.ts` so CLI commands and Studio share the loader without an import cycle.
- Added runtime aliasing so the Studio client resolves MotionForge player/export/schema/renderer packages from the CLI package graph rather than requiring generated projects to depend on every runtime package directly.
- Simplified the `create-motionforge` starter so projects contain only `src/video.ts`, `package.json`, and `tsconfig.json`; `pnpm dev` now runs `motionforge dev src/video.ts`.
- Updated package docs, the root README, and the DX roadmap for the new first-run path.

### Tested

- `pnpm --filter @motionforge/cli test`
- `pnpm --filter @motionforge/cli typecheck`
- `pnpm --filter @motionforge/cli build`
- `pnpm --filter create-motionforge test`
- `pnpm --filter create-motionforge typecheck`
- `pnpm --filter create-motionforge build`
- Built-command smoke with `node packages/cli/dist/bin/motionforge.js dev examples/generated/intro.json --host 127.0.0.1 --port 5188`, confirming the Studio HTML, `/__motionforge/scene`, and transformed virtual client load successfully.

### Notes

- Hot module reload for arbitrary scene module edits is not automatic yet; the Studio ships a reliable `Reload scene` button. File-watcher-driven reload can be added after the asset-path slice if it proves useful.
- Browser visual smoke through the in-app browser could not be completed because the browser helper in this session did not expose the expected tab/documentation methods. The Studio server and transformed client were verified directly with HTTP checks.

## 2026-06-17 (DX slice DX3: create-motionforge starter)

### Changed

- Added `create-motionforge`, a publishable starter generator with a `create-motionforge` bin.
- The generator creates a minimal Vite + TypeScript MotionForge project with:
  - `src/video.ts` authored through `@motionforge/authoring`
  - `src/main.ts` preview/export bootstrap using `@motionforge/player` and `@motionforge/export`
  - `index.html`
  - `src/style.css`
  - scripts for `dev`, `validate`, `print`, and `build`
- Added generator tests for project creation, package scripts/dependencies, source contents, non-empty directory refusal, and `--force` behavior.
- Updated the DX roadmap to mark DX3 complete and keep asset examples deferred to DX5.

### Tested

- `pnpm --filter create-motionforge test`
- `pnpm --filter create-motionforge typecheck`
- `pnpm --filter create-motionforge build`
- Manual generator smoke with `/tmp/motionforge-create-smoke`, confirming project files and package scripts/dependencies.

### Notes

- The generated project uses public semver dependency ranges such as `@motionforge/authoring@^0.3.0`. Full outside-the-monorepo install/preview validation should be repeated after packages are published or packed, because local `file:` installs of unpublished workspace packages still expose their internal `workspace:*` dependencies.
- The starter is intentionally text-only. Local asset path resolution belongs to DX5.

## 2026-06-17 (DX slice DX2: minimal CLI)

### Changed

- Added `@motionforge/cli` with a `motionforge` bin entry.
- Implemented `motionforge validate <scene-module>` for `.json`, JavaScript, and TypeScript scene modules.
- Implemented `motionforge print <scene-module>` to validate then print normalized scene JSON.
- Supported default exports, named `scene` exports, functions returning scenes, and promises resolving to scenes.
- Added CLI tests for valid JSON scenes, JavaScript module printing, invalid-scene diagnostics, TypeScript module loading, and usage errors.
- Updated the root README with the CLI validation/printing commands.
- Updated the DX roadmap to mark DX1 and DX2 complete and explicitly defer still rendering until the Node canvas dependency story is settled.

### Tested

- `pnpm --filter @motionforge/cli test`
- `pnpm --filter @motionforge/cli typecheck`
- `pnpm --filter @motionforge/cli build`
- `pnpm --filter @motionforge/authoring test`
- `pnpm typecheck`
- `pnpm build`

### Notes

- `motionforge still` and `motionforge render` are intentionally not shipped in this slice. The first CLI release is validation/inspection only so the dependency and runtime behavior stay reliable.
- The CLI TypeScript loader uses `tsx/esm`, so source-level CLI tests require workspace dependency links from `pnpm install`. The packaged CLI includes `tsx` as a dependency.
- The first full `pnpm typecheck` attempt ran before Next regenerated `apps/chat/.next/types`; after `pnpm build`, the same command passed.
- `pnpm build` still reports the existing playground warnings from `lottie-web` eval usage and large chunks; the build exits successfully.

## 2026-06-17 (DX roadmap + slice DX1: authoring helpers)

### Changed

- Added `docs/dx-roadmap.md`, an executable roadmap for making MotionForge easier for programmers to author with: authoring helpers, CLI, starter, studio, asset path, and docs.
- Added `@motionforge/authoring`, a seconds-first TypeScript authoring package that compiles friendly scene helpers into normal validated MotionForge `Scene` JSON.
- Added timing helpers: `seconds()`, `frames()`, `time()`, `toFrames()`, and `toSeconds()`.
- Added scene/node helpers: `makeScene()`, `bg()`, `box()`, `title()`, `textBlock()`, `textNode()`, `image()`, `videoClip()`, and `audioTrack()`.
- Re-exported safe motion presets from `@motionforge/presets` so beginner examples can use one import.
- Updated the root README package table and quickstart to lead with `@motionforge/authoring` before the lower-level builder API.
- Linked the DX roadmap from the main roadmap.

### Tested

- `pnpm --filter @motionforge/authoring test`
- `pnpm --filter @motionforge/authoring typecheck`
- `pnpm --filter @motionforge/authoring build`
- `pnpm typecheck`
- `pnpm build`

### Notes

- This is the first move toward Remotion-level first-run clarity, not the full developer workflow yet. CLI, project scaffolding, local asset path resolution, and a Studio-style app remain follow-up slices.
- `pnpm build` still reports the existing playground warnings from `lottie-web` eval usage and large chunks; the build exits successfully.

## 2026-06-17 (media assets + chat slice M9: large-file readiness)

### Changed

- Added shared local-media readiness helpers for probing, ready, warning, and error states.
- Added 100 MB and 500 MB local-file warning thresholds that explain the current whole-blob source-loading boundary without blocking user action.
- Updated asset cards with separate readiness badges, actionable decode failure copy, and large-file warnings.
- Updated composer mention chips and manual insert handling to block unreadable/probing assets while allowing large-but-decodable assets.
- Added a large-used-asset export status hint before MP4 encoding starts.
- Improved missing-WebCodecs export copy so unsupported browsers point users toward desktop Chrome/Edge or JSON.
- Documented the local-media memory boundary, manual phone-footage QA matrix, and the decision to defer streaming sources until real-device results force it.
- Updated the media roadmap to mark M9 complete.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat build`
- `pnpm --filter @motionforge/chat typecheck`
- Chrome smoke against a clean dev server on `http://127.0.0.1:5198`, confirming the editor, Assets panel, generated PNG upload, `ready` badge, file metadata, and Add action render.

### Notes

- Real 100-500 MB phone footage was not available in this environment. The benchmark doc now records the manual fixture matrix rather than inventing results.
- `resolveAssets()` still opens video/audio with `BlobSource(await response.blob())`; this is the known streaming-source trigger point.
- The first typecheck attempt ran before Next regenerated `.next/types` and failed on missing generated files; after `next build`, the same typecheck command passed.
- Browser smoke used system Chrome because Playwright's bundled Chromium binary is not installed. The only browser console error was the existing missing `/favicon.ico`.

## 2026-06-17 (media assets + chat slice M8: asset timeline polish)

### Changed

- Projected scene asset type/source into `EditorLayer` so timeline UI can identify media even when the local asset catalog is unavailable.
- Added timeline media descriptors for labels, thumbnails, source-start labels, playback-rate detail, and volume detail.
- Passed local uploaded assets into `TimelinePanel` so video/image blocks can show thumbnails when available and all media blocks can prefer user-facing labels like `Video 1`.
- Updated the track list and timeline blocks with stable icon/thumbnail badges, compact labels, and source detail such as `src 00:05`, `1.25x`, and `vol 50%`.
- Preserved existing drag, resize, split, and scrub handlers; timeline polish is display-only.
- Updated the media roadmap to mark M8 complete.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Chrome smoke against a clean dev server on `http://127.0.0.1:5197`, confirming the editor and timeline scrub area render with no page errors.

### Notes

- Audio waveform rendering and snapping are still deferred. The first production-friendly pass keeps the timeline readable without adding decode cost or changing edit semantics.
- Browser smoke used system Chrome because Playwright's bundled Chromium binary is not installed. The only browser console error was the existing missing `/favicon.ico`.

## 2026-06-16 (media assets + chat slice M6: model path for media edits)

### Changed

- Added media patch repair for model-authored patches before `applyScenePatch`, focused on manifest-backed mistakes:
  - repairs chat asset ids, labels, aliases, and filenames to renderable `sceneAssetId`s
  - inserts missing `setAsset` ops before `insertNode` and `setNodeProps` media references
  - rejects unresolved uploaded-media references with readable diagnostics
  - guards invalid visual/audio asset replacement through `setNodeProps`
- Threaded uploaded media manifests into `normalizeModelOutput()` so the model path and local fallback use the same media context.
- Added model-boundary tests proving media patches from the model path are repaired, applied, and returned with diagnostics.
- Added media eval cases for two-video sequencing, image background plus text, audio bed under an existing scene, and ambiguous logo replacement.
- Updated the eval scorer and runner so media evals receive manifests and are scored through manifest-aware repair before schema patch application.
- Added a concrete media patch example to both the app prompt and eval runner prompt.
- Updated the media roadmap to mark M6 complete.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/agent-eval test`
- `pnpm --filter @motionforge/agent-eval typecheck`
- `pnpm --filter @motionforge/chat build`
- Live `/api/chat` smoke on `http://127.0.0.1:5196` for the north-star two-video prompt, confirming the local fallback still returns a 3-step `mediaPlan` and 510-frame scene.

### Notes

- The repair layer is intentionally narrow: it repairs uploaded-media ids/source metadata from the manifest, but still lets `applyScenePatch` and scene validation reject structurally invalid patches.
- In the live smoke, the model path failed and the local fallback handled the turn as designed; model repair behavior is covered by unit tests and eval scorer tests.

## 2026-06-16 (media assets + chat slice M3: media inspector controls)

### Changed

- Added a narrowly scoped schema patch op, `setNodeProps`, for existing scalar node fields: `assetId`, `videoStartTime`, `audioStartTime`, `playbackRate`, and `volume`.
- Kept `setNodeProps` constrained and validated: unsupported keys are rejected and final scene validation still enforces node-type rules.
- Projected media fields from scene nodes into `EditorLayer`, including source start, playback rate, volume, object fit, object position, and asset id.
- Extended inspector patch generation so media scalar controls emit `setNodeProps`, while object fit and object position continue through `setStyle`.
- Added inspector controls for video/audio source start, playback rate, volume, and visual asset fit/position.
- Updated the model prompt so model-authored patches know about `setNodeProps`.
- Updated the media roadmap to mark M3 complete.

### Tested

- `pnpm --filter @motionforge/schema test`
- `pnpm --filter @motionforge/schema typecheck`
- `pnpm --filter @motionforge/schema build`
- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Chrome smoke against a clean dev server on `http://127.0.0.1:5195`, confirming the editor renders with the Inspector rail and no page errors.

### Notes

- The schema package was rebuilt so downstream workspace consumers pick up the new patch-op type and generated schema artifacts.
- Browser smoke used system Chrome because Playwright's bundled Chromium binary is not installed. The only browser console error was the existing missing `/favicon.ico`.

## 2026-06-16 (media assets + chat slice M7: operation plan UI)

### Changed

- Added a typed `MediaOperationPlan` structure for media chat edits, including generated node ids, source trim ranges, scene timing, and text overlay placement.
- The deterministic media compiler now returns operation-plan data alongside the canonical `ScenePatch`.
- Threaded `mediaPlan` through the local agent result, API response type, assistant chat messages, and chat panel rendering.
- Rendered compact operation rows in assistant messages, with clip/text icons, human-readable timing, and click-to-select behavior that opens the Layers panel on the affected generated node.
- Kept the plan as explanatory UI data only; scene state still flows through `ScenePatch` and `applyScenePatch`.
- Updated the media roadmap to mark M7 complete.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Chrome smoke against a clean dev server on `http://127.0.0.1:5194`, confirming the editor renders with the Assets rail and no page errors.
- Live `/api/chat` smoke on `http://127.0.0.1:5194` for the north-star two-video prompt, confirming a 3-step `mediaPlan` and 510-frame scene.

### Notes

- Revert still uses the existing undo control. A dedicated "revert last assistant edit" button should wait until scene history tracks semantic edit sources, so it cannot accidentally undo a later manual edit.
- Browser automation used system Chrome because Playwright's bundled Chromium binary is not installed. The only browser console error in smoke was a missing `/favicon.ico`, which is unrelated to the media-plan UI.

## 2026-06-16 (media assets + chat slice M5: local media instruction compiler)

### Changed

- Added a deterministic media instruction compiler for the first high-value chat workflow: sequence uploaded visual media, trim the first referenced video by source seconds, keep later clips full length, and add quoted text overlays to the target clip.
- The compiler consumes the same chat media manifest sent to the model, produces a canonical `ScenePatch`, creates a default scene when needed, and validates through the normal `applyScenePatch` path.
- Implemented support for explicit mention ranges like `@Video 1[00:05-00:10]` and natural references like `video one`, `video two`, `first video`, and `second video`.
- Wired the compiler into `applyInstructionLocally()`, so the north-star two-video prompt now works without model credentials.
- Added tests for the north-star prompt, explicit `@` ranges, unique ids against existing scenes, and local-agent integration.
- Updated the media roadmap to mark M5 complete.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`

### Notes

- The v0 compiler is intentionally narrow. It handles the production-critical sequence/trim/text-overlay path and leaves broader edit grammar, operation-plan UI, and model/eval hardening to later slices.

## 2026-06-16 (media assets + chat slice M4: chat asset context)

### Changed

- Added a typed chat media manifest that carries uploaded asset ids, renderable `sceneAssetId`s, object URL `src`s, labels, aliases, filenames, dimensions, durations, and scene usage state into `/api/chat`.
- Added server-side manifest sanitization before prompt construction.
- Expanded the MotionForge system prompt with uploaded-media rules: use only manifest assets, emit `setAsset` before `insertNode` for unused assets, choose the correct node type, and map source trims/timing through `videoStartTime`, `audioStartTime`, `from`, and `duration`.
- Included the media manifest in the user prompt for easier model debugging.
- Added `@` mention and alias helpers for parsing `@Video 1[00:05-00:10]`, resolving natural aliases like `video one`, and generating mention tokens.
- Added composer asset chips that append `@Video 1`-style mentions so users can reference files without guessing exact names.
- Updated the media roadmap to mark M4 complete.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`

### Notes

- This slice gives model-backed chat the right media context. The local fallback still does not compile the full two-video natural-language edit; that is the next M5 slice.

## 2026-06-16 (media assets + chat slice M2: manual add-to-scene)

### Changed

- Added a patch-backed media insertion compiler that turns a local uploaded asset into a `setAsset` + `insertNode` patch against the canonical scene.
- Added default scene creation for first media inserts, sizing visual scenes from the first image/video where possible and using a vertical default for audio-only starts.
- Inserted images/videos as full-frame bounded visual layers with `objectFit: "cover"` and inserted audio as a timeline-only `audio` node.
- Extended existing scenes when inserted media would run past the current duration, selected the new layer, switched to Layers, showed the generated patch, and recorded one-click insertion as an undoable scene change.
- Added Add controls to asset cards and disabled removal for assets already used by the scene so local object URLs cannot be revoked while preview/export still depend on them.
- Updated the media roadmap to mark M2 complete.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`

### Notes

- This is the manual bridge that chat will reuse conceptually: asset intent becomes a visible `ScenePatch`. The next implementation slice should expose media-specific inspector controls or send the asset manifest into chat, depending on whether we want manual precision or natural-language asset targeting next.

## 2026-06-16 (media assets + chat slice M1: asset catalog and shelf)

### Changed

- Added a local media asset model for uploaded images, videos, and audio, including stable ids, renderable `sceneAssetId`s, display labels, natural-language aliases, object URLs, metadata, and compact chat manifests.
- Added pure helpers and tests for media type detection, label/alias generation, manifest creation, usage detection, duration/file-size formatting, and object URL revocation.
- Added an **Assets** panel to the editor rail with upload/drop-zone UI, asset cards, status metadata, thumbnails for images/video when available, used/unused state, and remove controls.
- Wired app-level upload state, browser metadata probing, session reset cleanup, unmount cleanup, and unsupported-file handling without inserting uploaded files into `scene.assets` yet.
- Updated the media roadmap to mark M1 complete.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Browser smoke test on `http://localhost:5190`: opened the new Assets rail panel, confirmed the empty upload state rendered, and verified no browser console errors.

### Notes

- The in-app browser control surface does not expose a file-chooser setter, so the actual upload path is covered by unit-tested helper behavior and TypeScript/build coverage in this slice. M2 should add a deeper browser or harness-level upload smoke when we wire insertion into the scene.
- Uploaded files intentionally stay in the local asset catalog until a manual add or chat command uses them.

## 2026-06-16 (media assets + chat roadmap)

### Changed

- Added `docs/media-assets-chat-roadmap.md`, an executable roadmap for introducing uploaded video, image, and audio assets into the chat + manual editor.
- Defined the north-star two-video flow: trim `Video 1` to `00:05-00:10`, append `Video 2`, and add a top text overlay on the second clip.
- Specified the product rule that media upload state lives in a local asset catalog while all renderable edits still converge on the canonical `Scene` through `ScenePatch`.
- Broke implementation into slices for the asset shelf, manual add-to-scene, media inspector controls, chat asset context, local media instruction compiler, model path, operation-plan UI, timeline polish, and large-file reality checks.
- Linked the new media roadmap from the Phase 2 roadmap.

### Tested

- Docs-only change; no code tests run.

### Notes

- The first implementation target should be the vertical slice: upload two videos, reference them as `Video 1`/`Video 2` in chat, generate the sequence and text overlay, preview, undo, and export.

## 2026-06-16 (chat + edit slice 16: preview drag-to-move)

### Changed

- Turned the selected preview outline into a drag handle for bounded layers in the clip area.
- Added scene-space drag math that converts rendered canvas pixel movement into patchable `left`/`top` style values.
- Preview movement commits as a single `setStyle` patch so one drag is one undoable edit.
- Added mouse-window fallback handling so drag remains stable when the cursor leaves the outline during a move.
- Updated the roadmap to mark preview direct manipulation complete and queue preview resize handles next.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Browser smoke test on `http://localhost:5188`: loaded **Animated Chart**, selected the title layer, dragged its preview outline, confirmed the last patch was `{"op":"setStyle","id":"title","style":{"left":174,"top":97}}`, confirmed Undo restored the original outline position, and verified no current-tab browser console errors.

### Notes

- This slice moves bounded layers only. Resize handles and keyboard nudging should be separate follow-up slices so each interaction can share the same patch-backed drag/undo behavior deliberately.

## 2026-06-16 (chat + edit slice 15: preview selection feedback)

### Changed

- Added a pure preview-selection helper that projects selected layer bounds from scene coordinates into the rendered canvas coordinate space.
- Preview now draws a non-interactive outline and label for the selected layer directly in the clip area.
- Layers outside the current playhead frame show a dashed outline and `hidden at playhead` label so the user understands why a selected layer is not visible in the preview.
- Added an unbounded selection fallback for layers without explicit geometry.
- Added a stable layer-row data hook for selection smoke tests and future editor interaction checks.
- Updated the roadmap to mark preview selection feedback complete before the next clip-area manipulation slices.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Browser smoke test on `http://localhost:5187`: loaded **Animated Chart**, selected the title layer and confirmed a canvas-space outline/label, selected the later footnote layer and confirmed `hidden at playhead` feedback, and verified no browser console errors.

### Notes

- This is still selection feedback only. The next clip-area step should turn the selected outline into direct manipulation: drag to move, then handles to resize once the drag path is patch-backed and undoable.

## 2026-06-16 (chat + edit slice 14: split at playhead)

### Changed

- Added a split-at-playhead helper that converts a selected leaf layer into two adjacent replacement nodes through RFC 0001 patch ops (`insertNode`, `insertNode`, `removeNode`).
- Preserved media continuity when splitting video/audio nodes by offsetting the right half's source trim (`videoStartTime`/`audioStartTime`).
- Added a compact timeline Split button that is enabled only when a leaf layer is selected and the playhead is inside its local timing range.
- Split commits through `applyScenePatch`, records undo history, selects the left split half, and displays the generated patch for developer inspection.
- Updated the roadmap to mark split-at-playhead complete while leaving timeline snapping as the remaining compact timeline editing slice.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Browser smoke test on `http://localhost:5186`: loaded **Animated Chart**, selected the title layer at playhead frame `36`, split it into `title-a` and `title-b`, confirmed the last patch used `insertNode`/`insertNode`/`removeNode`, and verified no browser console errors.

### Notes

- This first split slice is intentionally leaf-layer only. Splitting containers with children needs a dedicated subtree id-rewrite policy before it should be enabled.

## 2026-06-16 (chat + edit slice 13: timeline duration handles)

### Changed

- Added compact timeline right-edge resize handles for visible layer blocks.
- Dragging the handle previews block width changes and commits through the same patch-backed `retime` duration path as the Inspector.
- Shared the block drag lifecycle between move and resize interactions so future snap/split behavior can build on one timeline gesture path.
- Added `resizeLayerDurationFromTimelineDrag()` with tests for drag deltas, one-frame minimums, and scene-end clamping.
- Updated the roadmap to mark duration handles complete while leaving split-at-playhead and snapping as follow-up timeline slices.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Browser smoke test on `http://localhost:5185`: loaded **Animated Chart**, dragged the title block's right-edge handle shorter, confirmed the last patch was `{"op":"retime","id":"title","duration":117}`, and verified no browser console errors.

### Notes

- This slice covers right-edge duration changes only. Left-edge trim, snapping, and split-at-playhead remain separate follow-up decisions.

## 2026-06-16 (chat + edit slice 12: timeline block retiming)

### Changed

- Added horizontal drag retiming for compact timeline layer blocks.
- Dragging previews the new block position while preserving absolute placement for nested layers.
- Releasing a dragged block commits through the existing inspector patch path, producing a `retime` patch and recording undo history.
- Added a tested frame-delta helper, `retimeLayerFromTimelineDrag()`, with clamp coverage at both scene edges.
- Kept timeline-surface scrubbing separate from block dragging so playhead seeking and layer retiming do not fight each other.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Browser smoke test on `http://localhost:5184`: loaded **Animated Chart**, shortened the title layer through the Inspector to create a visible short block, dragged that title block from frame `0` to frame `20`, confirmed the last patch was `{"op":"retime","id":"title","from":20}`, and verified no browser console errors.

### Notes

- This slice covers moving existing blocks only. Duration handles, split at playhead, and snapping remain the next compact timeline editing steps.

## 2026-06-16 (chat + edit slice 11: compact timeline scrub)

### Changed

- Added timeline-surface scrubbing: click or drag the compact timeline body to seek the playhead frame.
- Added pointer capture during scrubbing so drag remains stable while the pointer stays inside the timeline interaction.
- Layer block clicks still select layers without also scrubbing.
- Added tested frame-math helper `frameFromTimelinePoint()` to map pointer position to clamped scene frames.
- Updated the roadmap to mark compact timeline scrub complete while leaving drag retiming, resize handles, split, and snap as follow-up timeline slices.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Browser smoke test on `http://localhost:5183`: loaded **Product Launch**, clicked the timeline scrub gutter near the end, confirmed the range value moved from frame `36` to `143` and the displayed time changed to `00:04`, with no browser console errors reported.

### Notes

- This is the first compact timeline interaction slice. It changes only playhead seeking, not layer timing.
- The timeline now has a dedicated top scrub gutter so full-width layer blocks can still be selected without blocking playhead scrubbing.

## 2026-06-16 (chat + edit slice 10: narrow-viewport layout)

### Changed

- Made the chat editor shell responsive below `lg`: the tool rail becomes a top bar, the active side panel sits above the editor, and preview/timeline share the remaining height.
- Kept the existing desktop layout intact at `lg` and up: vertical rail, side panel, central editor.
- Compacted mobile toolbar controls and timeline tracks so JSON/export actions and track rows fit without horizontal overflow.
- Added a small responsive-layout helper and tests to document the stacked-vs-desktop breakpoint.
- Updated the roadmap to mark usable narrow-viewport layout complete.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Browser smoke test on `http://localhost:5182` desktop `1280x720`: confirmed rail/sidebar/editor stayed in desktop columns, empty copy rendered, and no horizontal overflow or browser console errors appeared.
- Browser smoke test on `http://localhost:5182` mobile `390x844`: confirmed stacked rail/panel/editor layout, no horizontal overflow, loaded **Product Launch**, saw a `1080x1920` scene with `6 layers`, populated timeline tracks, and no browser console errors.

### Notes

- This is a usability pass, not a dedicated mobile editor redesign. The next roadmap item is compact timeline interaction: scrub, drag, resize handles, split, and snap.

## 2026-06-16 (chat + edit slice 9: capability and empty-state messaging)

### Changed

- Added a pure capability-message helper for export readiness and preview overlays.
- Export disabled states now explain the specific blocker: no scene, preview preparing, preview error, missing WebCodecs `VideoEncoder`, or an active export.
- The timeline status now uses the same readiness copy as the toolbar, including the explicit `MP4 unavailable · JSON available` fallback when browser export support is missing.
- Preview empty and error overlays now use clearer first-touch copy: no scene loaded, Assistant/Examples ready, and render failures labeled as preview errors.
- Updated the roadmap to mark capability/empty-state messaging complete while leaving narrow-viewport layout as the remaining honest-edge item.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Browser smoke test on `http://localhost:5181`: confirmed the empty preview shows **No scene loaded** with Assistant/Examples guidance, the disabled Export button explains the no-scene blocker, loading **Product Launch** shows a `1080x1920` scene with `6 layers`, the timeline reports export readiness/fallback copy, and no browser console errors were reported.

### Notes

- This slice changes messaging and readiness decisions only; it does not add alternate export implementations for browsers without WebCodecs.
- Natural next step is the narrow-viewport layout pass, then compact timeline interactions.

## 2026-06-16 (chat + edit slice 8: starter template examples)

### Changed

- Replaced the unused static starter scene with a typed starter-template catalog generated through the local `createSceneFromInstruction()` path.
- Added three preset-backed first drafts to the Examples dialog: Product Launch, Kinetic Typography, and Founder Update.
- Loading a starter template now commits a real scene into the editor, records history, switches to Layers, clears stale patch/error state, and leaves an assistant message with the source prompt.
- Prompt examples remain available as chat-input chips, and README scenes remain available as full showcase JSON loads.
- Updated the roadmap to mark starter-template examples complete.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Browser smoke test on `http://localhost:5180`: opened Examples, loaded **Product Launch** from Starter templates, confirmed the dialog closed into a `1080x1920` scene with `6 layers` and populated timeline tracks, and verified no browser console errors were reported.

### Notes

- The template catalog intentionally uses the same local generator as the no-credential chat fallback, so example starts exercise the path users see when they click before configuring a model.
- The next Week 5 slice should address honest browser/export capability messaging and empty/error states before timeline drag behavior.

## 2026-06-16 (chat + edit slice 7: preset-backed first drafts)

### Changed

- Refactored the local first-scene generator to use `@motionforge/presets` `timeline()` choreography with `fadeUp`, `popIn`, and `slideIn`.
- First drafts now share the same preset vocabulary as engine examples, giving the empty/local fallback path designed entrance motion instead of hand-built one-off keyframes.
- Subtitle and caption nodes now start with the scene and let timeline keyframe holds control their entrance timing, which keeps layer timing simple while preserving staggered visual motion.
- Updated the roadmap to mark the Week 5 first-touch quality foundation complete while leaving richer template/suggestion-chip expansion as follow-up polish.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat build`
- `pnpm --filter @motionforge/chat typecheck`
- Browser smoke test on `http://localhost:5179`: submitted **Create a kinetic typography scene saying SHIP THE DEMO.**, confirmed the local fallback created a `1080x1920` scene with `6 layers`, and verified no browser console errors were reported.

### Notes

- This is deliberately the smallest Week 5 slice: it improves the first draft quality path without changing the chat protocol, editor state model, or manual edit surfaces.
- Natural next steps are richer preset-backed example starts, honest browser/export capability messaging, and then compact timeline drag behavior.

## 2026-06-16 (chat + edit slice 6: text style inspector controls)

### Changed

- Extended editor layer projection with common text style values: color, font size, font weight, text alignment, and text stroke.
- Inspector edits now map those fields to `setStyle` patches through the same patch-backed path as timing and geometry.
- Added text style controls to the Inspector for text nodes, including a color swatch, font size/weight inputs, alignment select, and stroke input.
- Updated the roadmap to mark undo/redo and common text style Inspector coverage complete.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Browser smoke test on `http://localhost:5178`: loaded README scene **Animated Chart**, selected the title text layer, edited Color to `#14b8a6`, changed Align to `right`, confirmed both emitted `setStyle` patches, and verified no browser console errors were reported.

### Notes

- This slice focuses on text-node style controls. Shape/image/container fills, borders, shadows, and timeline drag handles remain natural follow-up slices.

## 2026-06-16 (chat + edit slice 5: undo/redo for manual edits)

### Changed

- Added a pure scene history helper for undo/redo stacks, capped at 50 past scenes and covered by unit tests.
- The chat editor now records scene history for assistant, README showcase, and inspector-driven scene changes.
- Added accessible Undo/Redo icon buttons to the editor toolbar; undo/redo clear stale patch/error/export feedback and preserve the canonical scene model.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat build`
- `pnpm --filter @motionforge/chat typecheck`
- Browser smoke test on `http://localhost:5177`: loaded README scene **Animated Chart**, edited Inspector `Left` to `99`, confirmed Undo restored the prior value, Redo reapplied `99`, and verified no browser console errors were reported.

### Notes

- This is snapshot-based history for the reference editor. If large documents or rapid drag edits become expensive, compact patch/inverse-patch history can replace the storage layer without changing the toolbar behavior.

## 2026-06-15 (chat + edit slice 4: patch-backed inspector edits)

### Changed

- Added a small inspector patch helper that maps text, local timing, geometry, and opacity edits to RFC 0001 scene patches (`setText`, `retime`, `setStyle`).
- The Inspector panel now exposes editable controls for text nodes, start/duration, left/top/width/height, and opacity; commits flow through `applyScenePatch` against the canonical MotionForge scene.
- Layer projection now carries text and opacity so the inspector can show real editable values, and the editor displays the latest applied patch or a validation error for developer feedback.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat build`
- `pnpm --filter @motionforge/chat typecheck`
- Browser smoke test on `http://localhost:5176`: opened Examples, loaded README scene **Animated Chart**, switched to Inspector, edited `Left` to `99`, confirmed the app emitted a `setStyle` patch with `left: 99`, and verified no browser console errors were reported.

### Notes

- Inputs intentionally commit on blur/Enter for this first precision-edit slice. Drag handles, undo/redo, and selection-aware chat context remain follow-up slices.
- An existing stale dev server on `5174` was serving HTML but missing unversioned client chunks after a production build; smoke verification used a clean temporary dev server on `5176`.

## 2026-06-15 (chat + edit slice 3: README showcase scene loader)

### Changed

- The chat editor Examples dialog now has two sections: prompt examples and README scene examples.
- Added a typed catalog for the root README verification gallery (`verification/edgy-*.json`), so clicking a README scene loads the actual scene JSON into the editor, selects the Layers panel, and preserves the current conversation as context.
- The root README showcase table now links each demo's scene JSON directly beside the MP4/poster link.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Browser smoke test on `http://localhost:5175`: opened Examples, selected README scene **Animated Chart**, confirmed the modal closed, the canvas resized to `1280x720`, layers/tracks populated, and no browser console errors were reported.

### Notes

- Bundling the six README verification JSON files increased the chat app route size from roughly 174 kB to 205 kB. Acceptable for this developer/editor slice; revisit with lazy loading if the public app needs a smaller first load.
- This should make the next inspector-editing slice much easier to test against realistic scene documents.

## 2026-06-15 (chat + edit slice 2: editor component boundaries)

### Changed

- Split the chat app shell from the editor workspace UI: the top-level app now owns scene state, player lifecycle, assistant requests, export, and JSON modal wiring, while the rail, panel switcher, chat panel, layer panel, inspector, preview workspace, and compact timeline live under `apps/chat/components/editor/`.
- Added shared editor UI types for chat messages, active panel state, and player UI state.
- Added pure timeline formatting helpers so preview/timeline labels can be tested outside React.

### Tested

- `pnpm --filter @motionforge/chat test`
- `pnpm --filter @motionforge/chat typecheck`
- `pnpm --filter @motionforge/chat build`
- Browser smoke test on `http://localhost:5175`: editor workspace, preview canvas, Assistant panel, and Tracks area rendered with no browser console errors.

### Notes

- This slice is intentionally behavior-preserving. The next slice should add the first manual edit action through the existing scene patch model rather than mutating editor-local state.

## 2026-06-15 (chat + edit slice 1: layer projection and inspector shell)

### Changed

- Added a pure editor projection module for the chat app: `deriveEditorLayers(scene)` flattens scene nodes into document-order layers with parent/depth metadata, absolute visible timing, labels, z-index, and numeric bounds where they can be derived safely.
- Added a collapsible chat panel to the reference app so the preview/edit area can stand on its own while preserving the session.
- Added the first read-only manual edit surface: a Layers panel and Inspector panel driven from the canonical MotionForge `Scene`. Selection is UI-only in this slice; no manual mutation yet.

### Tested

- Added unit tests for layer projection, nested timing clamping, label normalization, numeric bound extraction, and helper behavior.

### Notes

- This is intentionally a foundation slice. The next manual-edit step should apply inspector edits through RFC 0001 patch ops.

## 2026-06-15 (phase 2 direction: chat + edit coexistence)

### Changed

- Product direction updated: the reference app is no longer chat-only. It should become a chat + edit coexistence app where chat creates the first draft, chat can be hidden, and manual tools refine the scene for precision.
- Added `docs/chat-edit-app-plan.md`: product position, UX shape, what to borrow from Dojo, what not to port, scene projection model, patch mapping, and implementation slices.
- Updated `docs/roadmap.md`: phase 2 now includes a precision edit layer, compact timeline, and selection-aware chat. Manual editor UI is no longer listed as fully deferred; only full traditional NLE scope remains deferred.

### Tested

- Documentation-only change. No runtime tests were needed.

### Notes

- Core architectural decision: MotionForge `Scene` remains the canonical document. Chat edits and manual UI edits both apply RFC 0001 scene patches.
- Dojo remains a product-design and selective-code reference, not the rendering core or canonical data model for MotionForge.

## 2026-06-12 (phase 2 week 1: intrinsic text auto-height + launch surface)

### Changed

- **Intrinsic text auto-height** (the sharpest documented edge for LLM-generated scenes, phase-2 week-1 slice): a text node without an explicit `height` is now exactly as tall as its wrapped line count × `lineHeight` instead of filling its parent. Top-anchored absolute text starts at `top`; bottom-anchored text sits its own height above `bottom`; absolute nodes with both `top` and `bottom` keep the inset-constrained height; flex parents' size assignments are respected (`sizedByParent`).
- **Layout and render now share one text measurement**: `wrapTextLines` (+ grapheme breaking) moved from the renderer into `@motionforge/core` (renderer re-exports it); `layoutScene(scene, { measureTextLine })` accepts a measurer, and `renderStill` passes one backed by its canvas context (same font string + `letterSpacing` as `drawText`), so intrinsic boxes wrap exactly like painted text. Without a measurer (plain Node), the 0.58 × fontSize character heuristic stands in — now wrap-aware for flex height estimates too (one slot per rendered line, not per `\n`).
- Golden harness: probes gained an `absent` option (pass only when _no_ pixel matches) so fixtures can assert text does **not** paint somewhere; new `text-auto-height` probe fixture covers top-anchored wrap, bottom-anchored subtitle placement, and no-pixels-below-the-intrinsic-box.
- Launch surface: GitHub Pages deploy workflow for the playground (`.github/workflows/deploy-playground.yml`) + `base: "./"` Vite config (with `passWithNoTests` to keep `pnpm -r test` green); getting-started guide fixed (`tiktokCaptions` returns one container node — `push(captionTrack)`, not spread); `docs/roadmap.md` gained the phase-2 plan; scene-format and llms.txt rewritten for the new auto-height contract (the "give absolute text an explicit height" hard rule is gone).

### Tested

- 5 new core layout tests (top-anchored wrap height, bottom anchoring, top+bottom constraint, explicit height, flex slot per rendered line, heuristic fallback) — 32 core tests green.
- All 36 golden checks pass: the 35 pre-existing fixtures are **byte-identical** (existing scenes set explicit heights or use flex, exactly as the old docs instructed), plus the new `text-auto-height` fixture.
- Full `pnpm test` (159 unit tests), `pnpm typecheck`, `pnpm e2e` (10 checks) green.
- Pre-publish clean-install verification: all six 0.3.0 tarballs `npm pack`ed and installed into a fresh project outside the workspace; validate → patch → evaluate → layout → presets exercised via ESM imports.
- Verification stress scenes re-rendered after the change: `font-styles-f5`, `vertical-60fps-captions-f50/f130` byte-identical to pre-change renders; `intro` and `karaoke-captions` showcase frames visually verified (flex text widths now use real measurement instead of the heuristic).

### Notes

- Percent `fontSize` on auto-height text has no stable basis before the box exists and resolves against zero; documented (use absolute font sizes). No scene in the repo uses percent fontSize.
- `drawText` still resolves percent `fontSize` against the box height at paint time; for pixel/number font sizes (every preset and example) layout and paint agree exactly.

## 2026-06-11 (core engine verification: multilingual text — CJK wrap fix)

### Changed

- Pre-phase-2 verification pass over the engine, presets, and international text. One real gap found and fixed: **Chinese/Japanese text did not wrap** — `wrapTextLines` only broke on whitespace, so a spaceless CJK paragraph was one "word" horizontally condensed into a single squished line by `fillText`'s maxWidth clamp.
- Fix: when a run alone exceeds the box width, it now breaks by **grapheme cluster** (`Intl.Segmenter`, code-point fallback) — fixes CJK, long URLs, and any spaceless run, and never splits emoji or combining marks. Behavior change for overlong Latin words: they now break instead of being condensed (the better behavior). All existing goldens unchanged — Latin wrapping with normal words is byte-identical.
- Docs: new "International text" section in scene-format (grapheme wrapping, RTL/Arabic guidance — shaping/bidi are automatic per line, use `textAlign: right`, avoid `letterSpacing` on cursive scripts, kinsoku simplification noted, CJK font-asset guidance); llms.txt note for agents.

### Tested

- Rendered a zh/ja/ko/ar/emoji/mixed-bidi scene through the engine before and after: before, Chinese and Japanese were single squished lines; after, both wrap cleanly at natural glyph width. Arabic verified correct both times (cursive shaping, RTL, wraps on spaces, right-aligned); Korean wraps; color emoji and mixed-direction lines render.
- 5 new `wrapTextLines` unit tests (CJK paragraph breaking, mixed runs, emoji cluster integrity, single-grapheme clamp, Latin regression); one old test updated to the new break-instead-of-squish contract. 47 renderer tests, 35 golden checks green (existing hashes unchanged).
- All seven motion presets rendered mid-entrance in one strip and visually verified (popIn growth, fadeUp rise+fade, four slideIn directions, pulse peak).

### Notes

- Verification verdict recorded for phase-2 planning: engine is complete against its documented contract; remaining known simplifications are kinsoku, mixed Latin+CJK line packing (correct but not maximally dense), letterSpacing-vs-cursive (documented), and intrinsic text auto-height (queued for phase 2 week A).

## 2026-06-11 (week 5: launch surface — lottie showcase, determinism lint, E2E, 0.3.0 prep)

### Changed

- Seventh showcase scene **Lottie Sticker**: a hand-written self-contained vector document (spinning star + pulsing stroked ring) shown twice from one asset at 1× and 2× playback — the headline feature demoed in the playground and README. Playground gained the lottie-web optional peer dependency.
- **Determinism lint** (`scripts/check-determinism.mjs`, wired into `pnpm lint`): scans all six render-path packages for `Math.random`/`Date.now`/`new Date`/`performance.now` with an explicit, justified allowlist (the player's injectable `now` default is the only entry). First scan: clean.
- **Committed Playwright E2E** (`pnpm e2e`, `tools/golden/src/e2e.ts`): ten checks driving the real playground — poster paint, play/pause/seek, agent-console closest-id hints and pixel-verified patch apply, audio scene playback with WebAudio, lottie scene vector-pixel detection and playback, zero console errors. Replaces the session-local throwaway smokes with maintained tooling.
- **0.3.0 release prep**: changelog entry (patch ops, player + audio preview, lottie, filter/zIndex/border/boxShadow, video-node audio, chunked mixing, timeline choreography, tooling), all six publishable packages bumped to 0.3.0 (player now versions with the set), README badge, `npm pack --dry-run` verified for all six (11–23 kB each, dist+README+LICENSE only).

### Tested

- `pnpm e2e` — 10/10 checks.
- `pnpm lint` (determinism + tsc across the workspace), `pnpm build`, full `pnpm test` (159 tests), `pnpm golden:test` (35 checks).
- Lottie showcase poster visually verified (star/ring badge + 2× echo + caption).

### Remaining manual steps (maintainer credentials)

1. Push to GitHub; confirm CI green and badge URLs.
2. Reserve/confirm the `@motionforge` npm scope; `pnpm publish -r --access public` from a clean checkout; tag `v0.3.0`.
3. Deploy the playground (GitHub Pages or similar) and link it from the README.
4. Eared check of the Audio Sync Pulse scene in a real browser tab.
5. Optional first eval baseline: run `tools/agent-eval` against a real endpoint.

## 2026-06-11 (lottie node — week-4 slice 6, the launch headline feature)

### Changed

- `@motionforge/schema`: new asset type `"lottie"` and node type `lottie` (requires `assetId`; `playbackRate` now validates on video **and** lottie nodes with an updated message; `videoStartTime` stays video-only).
- `@motionforge/renderer-canvas2d`: lottie assets load through `resolveAssets()` (fetch JSON → determinism guards → lottie-web canvas player with `autoplay: false`); `prepareFrame()` seeks each active lottie node via `goToAndStop(lottieSourceFrame(...), true)` and stages a per-node canvas copy (two nodes can share one asset at different frames); `renderStill()` draws staged frames through the shared objectFit path with the same stale-frame errors video has; `disposeAssets()` destroys players.
- Determinism guards per the spike: `validateLottieDocument()` (exported, pure) rejects documents with JS expressions (string-valued `"x"` — may call `Date`/`random`) or image layers/external images; `lottieSourceFrame()` (exported, pure) clamps to `op − ip − 1` because lottie-web does not clamp out-of-range seeks.
- **lottie-web is an optional peer dependency** of the renderer, dynamically imported only when a scene actually contains a lottie asset; missing install produces an actionable error. Scenes without Lottie pay zero bytes.
- Docs: scene-format Lottie section, llms.txt node-type entry, spike doc flipped to implemented.

### Tested

- 12 new unit tests: `lottieSourceFrame` mapping (fps/rate/lottie-fr, clamping both ends, nonzero in-point), `validateLottieDocument` (accepts self-contained vectors **and bezier easings whose `x` is numeric**, rejects non-lottie JSON, external images, image layers, expressions), schema accept/reject matrix for the new node type. 159 unit tests total.
- New exact golden `lottie-frame-seek`: two lottie nodes sharing one data-URL asset — natural rate and 2× rate at scene frame 20 — hash recorded, re-verified, and the rendered frame visually confirmed (two rects at different rotations/positions). 35 golden checks green.

### Notes

- Export and player needed **zero changes** — both already await `prepareFrame()` per frame, so lottie nodes export and preview automatically.
- Worker/OffscreenCanvas rendering of lottie is unverified (lottie-web touches `document`); fine while export runs on the main thread.

## 2026-06-11 (chunked audio mixing — week-4 slice 5)

### Changed

- `exportVideo()` no longer builds the whole scene's audio as one buffer. The mix is produced and fed to the encoder in windows (`audioChunkSeconds` option, default 10 s), so audio memory stays flat regardless of scene length (the old path held ≈23 MiB/min for the entire video encode).
- `audioChunkRanges()` exported (pure): consecutive inclusive frame windows, no gaps/overlaps. Silent windows append explicit silence — sequential `AudioBufferSource.add()` would otherwise shift later chunks earlier.
- New `sceneHasAudibleContent()` probe (the mixer's walk minus decoding) decides up front whether the MP4 gets an audio track, since tracks can only be added before `output.start()`. Behavior preserved: all-silent scenes (e.g. only soundless video clips) still produce no audio track.

### Tested

- Golden audio checks now run with `audioChunkSeconds: 0.4` — four windows over the 1.5 s tone scene with the tone start crossing a chunk boundary. All RMS/alignment/duration assertions unchanged and green (silence rms 0.0000, tone rms 0.2809): chunk concatenation is sample-correct end-to-end, not just in theory.
- 2 new unit tests for `audioChunkRanges` (coverage, clamping); full suite 152 tests + 34 golden checks green.

### Notes

- The player's preview still caches one whole-scene buffer (it needs random access for seeking); chunked preview is a follow-up if minutes-long scenes become a preview use case.
- Chunk boundaries can round ±1 sample at non-integral samples-per-frame rates; inaudible and absorbed by AAC framing.

## 2026-06-11 (1080p export benchmark — week-4 slice 4)

### Changed

- New repeatable benchmark: `pnpm --filter @motionforge/golden run benchmark [width height fps seconds]` — `window.runGoldenBenchmark` in the harness synthesizes full-motion footage at the target size (stage 1: pure render+encode), then exports composites decoding it through one and two video nodes (stages 2–3), reporting ms/frame, output size, and JS heap per stage. Results table in `docs/benchmarks.md`.
- Measured (Apple Silicon, headless Chromium, AVC): 1080p 30 fps two-decoder export at **29 ms/frame — a 30 s scene exports in 26 s, faster than realtime**; vertical 1080×1920 has the same profile; heap flat (≤ 46 MiB) from 300 to 900 frames.

### Tested

- Three benchmark runs (1080p 10 s, 1080p 30 s, vertical 10 s); linear scaling and flat heap verified across lengths.

### Notes

- **Decision: worker-parallel export stays parked** — single-thread export already beats realtime at production sizes.
- The real memory boundary is `BlobSource` full-file fetch (a 200 MB phone clip = ~200 MB heap before decoding), not frame processing; that is the number that will eventually justify streaming sources.
- Chunked audio mixing remains queued as the long-scene cost (≈23 MiB/min whole-scene mix buffer, doubled by the player's preview cache).

## 2026-06-11 (timeline/stagger choreography — week-4 slice 3)

### Changed

- `@motionforge/presets` gains `timeline()` — the GSAP extraction without GSAP (license + runtime philosophy ruled the library out; the timeline/stagger/position vocabulary is the part worth having). Pure builder: `.add(id, preset, { at | after: id, overlap, gap })`, `.stagger(ids, preset | (index) => preset, { every })`, `.compile()` → per-node keyframe lists, `.compileToPatch()` → ready-to-apply RFC 0001 `setAnimations` ops, `.durationInFrames`.
- Semantics: entries default to starting when the previous one ends; offsets compile to frame-0 holds of each preset's first value, so an entrance's held `opacity: 0` keeps the node invisible until its slot — choreography never retimes nodes. Negative computed starts clamp to 0 (GSAP behavior); duplicate ids, unknown `after` targets, and negative nudges throw actionable errors.
- `llms.txt` hard rule added: never hand-compute cross-node frame offsets — use `timeline()`. Presets README documents the API.

### Tested

- 9 new unit tests (17 total in presets): default sequencing, `after`+`overlap` independence from interleaved `at` entries, hold-from-frame-0 invisibility, stagger spacing + whole-group positioning + `durationInFrames`, per-index preset factories, overlap clamping, error cases, `validateScene` round-trip, `compileToPatch` through `applyScenePatch`.
- Visual proof: a five-node demo (title pop → subtitle overlap → three staggered cards) rendered through the harness; frames 14/24 confirm the declared sequencing (no cards at 14; card-1 settled, card-2 mid-slide at 24).
- `pnpm build`, `pnpm typecheck`, full `pnpm test` green.

### Notes

- The timeline assumes choreographed nodes share a `from`; a future option could emit `retime` ops instead of holds for nodes that should not exist before their slot.
- Decision recorded: GSAP itself stays out (proprietary license, imperative runtime); a GSAP-code _baking adapter_ remains explicitly deferred unless real users ask.

## 2026-06-11 (Lottie spike — week-4 slice 2)

### Changed

- Ran the Lottie feasibility spike (`tools/spike-lottie`, throwaway): lottie-web's canvas renderer driven via `goToAndStop(frame, true)` into a context we own. Findings and the integration design in `docs/lottie-spike.md`.
- **Green light.** Pixels are deterministic per frame, including after backward seeks and across separate browser launches (identical PNG sha twice); distinct frames differ; ~3 ms/seek on a 200×200 shape layer — same order as video staging.
- Integration design recorded: `lottie` asset+node types following the video pattern (resolve → prepareFrame staging → sync draw, frame mapping with clamp), lottie-web as an **optional peer dependency** dynamically imported only when a scene uses it.

### Tested

- Spike script asserts determinism (repeat + backseek + cross-run), frame distinctness, seek timing, and discovered that lottie-web does **not** clamp out-of-range frames (frame 999 ≠ last frame) — the integration must clamp like `videoSourceTime`.

### Notes

- Determinism contract requirements for the real slice: reject Lottie documents with JS expressions (can call `Date`/`random`) and image-layer externals (v0 is self-contained vectors only).
- tsx gotcha worth remembering: esbuild-transformed closures passed to Playwright's `page.evaluate` carry a `__name` helper that breaks in-page; pass browser code as a string.

## 2026-06-11 (audio-sync showcase scene — week-4 slice 1)

### Changed

- Sixth showcase scene **Audio Sync Pulse**: a synthesized four-beat track (pure-function WAV data URL — `beatTrackDataUrl()`, same bytes every run) with visuals locked to the audible beats: pulsing ring/core on frames 0/15/30/45 and per-beat indicator dots. First scene to exercise the player's audio preview in the playground and the AAC export mix end-to-end from showcase data.
- Engine sharp edge found while building it: **absolutely positioned text with auto height resolves to the parent's height**, so the vertically-centered line block lands off-canvas. Documented in `llms.txt` and scene-format (give absolute text an explicit `height`); intrinsic auto-height for text recorded as a follow-up.
- README/showcase docs gained the new scene + poster.

### Tested

- Caught the invisible-caption bug by pixel-sampling the rendered poster, isolated it with an `applyScenePatch` debug render (loud red text — still absent), then diagnosed via `layoutScene` box inspection (box `y:640, h:720`). Fixed with explicit height and re-verified by pixel count.
- Export: 60 frames → 254 KiB MP4, **avc + aac**, in 320 ms; poster frame visually verified (beat-2 dot lit at frame 15).
- Playwright: selecting the scene in the playground and playing attaches WebAudio and advances frames with no console errors.
- Full `pnpm test` and `pnpm build`/`typecheck` green.

### Notes

- Headless Chromium's null audio device free-runs (~1.5× wall clock), and the audio-master-clock design follows it — playback runs fast in headless tests. Real hardware is fine. Follow-up: clamp re-anchoring to wall-clock plausibility so a free-running audio clock can't drag the frame clock.
- The eared check (does it _sound_ beat-locked) is a maintainer task in a real browser tab: `pnpm dev` → Audio Sync Pulse → Play.

## 2026-06-11 (golden diff artifacts — week-3 slice 3)

### Changed

- Week 3 is now complete: the golden harness writes visual artifacts for exact-fixture failures.
- `pnpm golden:update` now emits a committed PNG baseline beside each exact snapshot JSON in `fixtures/goldens/`.
- `pnpm golden:test` still compares exact frames by hash, but on mismatch it writes ignored artifacts under `fixtures/goldens/__diffs__/`: `<fixture>.received.png` and, when a baseline PNG exists, `<fixture>.diff.png` with changed pixels highlighted red.
- Roadmap wording tightened so motionforge remains explicitly independent/open-source first; downstream consumers are reference inputs, not roadmap owners.
- Two new prompt-shaped showcase scenes in `@motionforge/showcase` (now five total): **Launch Info Display** (animated panels, scan lines, countdown text, progress motion) and **Timed Text Overlay** (a written timing prompt mapped to frame-accurate text nodes). README/showcase/examples docs updated with their posters.
- Review fixes before commit: commercial branding scrubbed from the new showcase scene/docs (`motionforge.dev` instead; node id renamed; posters and generated JSON re-rendered and visually verified), and `examples/generated/*.mp4` added to `.gitignore` per the documented rendered-MP4 convention.

### Tested

- `pnpm --filter @motionforge/golden typecheck`
- `pnpm --filter @motionforge/golden build`
- `pnpm golden:update`
- `pnpm golden:test` (34 checks green post-review)
- Deliberately changed one snapshot hash and verified the failure message included the received/diff artifact paths, then restored the snapshot and removed the ignored artifacts. Re-verified independently during review: `__diffs__/opacity-keyframe.received.png` + `.diff.png` written, paths in the failure output.
- Full `pnpm test` (141 unit tests incl. updated showcase assertions), `pnpm build`, `pnpm typecheck` green after the branding scrub and regeneration.

### Notes

- Probe-style fixtures still report textual probe failures; this slice targets exact pixel goldens where a visual before/after/diff is most useful.

## 2026-06-11 (agent-eval harness — week-3 slice 2)

### Changed

- New private tool `tools/agent-eval` (RFC 0001's harness): generate and edit suites scored **mechanically** — `validateScene`/`applyScenePatch` are the judge, plus per-case structural assertions including the don't-break-the-rest check (untouched nodes must stay byte-identical). No LLM judging.
- Runner (`pnpm --filter @motionforge/agent-eval run eval`) talks to any OpenAI-compatible chat endpoint via `EVAL_BASE_URL`/`EVAL_API_KEY`/`EVAL_MODEL`, with `llms.txt` as the system prompt at temperature 0; `--suite`/`--case` filters. Exits non-zero on failures so it can gate prompt changes.
- `extractJson()` tolerates fenced/prose-wrapped replies (what models actually emit); `scoreReply()` is pure.
- Seven seed cases: three generate (minimal title, sequenced sections, caption styling) and four edit (resize with collateral-damage check, retime, pop-in animation, guarded removal).

### Tested

- 8 offline unit tests cover the scorer with canned good/bad replies per suite: fence/prose extraction, validator failures, assertion failures, wrong-node edits, misspelled-id errors surfacing closest-id hints, over-removal detection. No endpoint needed.
- `pnpm typecheck` green; runner without env exits 2 with setup guidance.

### Notes

- The repair suite (invalid scene + errors → fixing patch) is designed but deliberately waits for generate/edit baselines from a real endpoint run.
- First real-model baseline run is a maintainer task (needs an API key); the harness prints a pass table and totals.

## 2026-06-11 (open-source re-scope + playground agent console — week-3 slice 1)

### Changed

- **Plan re-scope:** downstream-editor integration dropped from the roadmap (the maintainer's products consume motionforge on their own schedule); weeks 3–5 now target the open-source project itself — agent loop tangibility, capabilities, robustness, launch surface.
- Playground gains an **agent console**: paste a scene document or a patch op list, apply it through the exact public APIs an agent uses (`validateScene` / `applyScenePatch`), watch the preview update, read the same errors an agent reads. Plus one-click "Copy scene JSON" for the copy → prompt → paste loop. This is the chat loop minus the LLM.
- Playground refactor: scene loading split into `loadScene(showcaseEntry)` and `loadSceneDoc(anySceneDoc)`, so patched/custom documents share the full asset/player/export lifecycle. Export now exports the _current_ (possibly patched) document.
- Patch error display no longer double-prefixes op indexes (messages already carry them).
- README hero regenerated; it now shows the console.

### Tested

- Playwright drive of the real console: misspelled id surfaces the closest-id suggestion; a two-op patch (`setText` + `setStyle` with a null-delete) applies and the canvas pixel-verifies the new background; malformed JSON reports cleanly; a pasted custom scene loads (canvas resizes, pixel-verified). No console errors.
- `pnpm build`, `pnpm typecheck` green.

### Notes

- The test run itself caught a real UX subtlety: patching `backgroundColor` under an existing `background` gradient is silently shadowed (CSS-correct, but surprising). Worth a future validator hint when both are set.
- Next agent-layer step: the eval harness runner (`tools/agent-eval`), which scores generate/edit suites against these same APIs.

## 2026-06-11 (player audio preview — week-2 slice 3)

### Changed

- `@motionforge/export`: the internal mixed-track builder is now public as `mixSceneAudio(scene, assets, startFrame, endFrame)` so preview plays the exact mix the export muxes.
- `@motionforge/player`: scenes with audible nodes get sound during preview.
  - `AudioPreview` interface + `WebAudioPreview` implementation: the scene mixes once into a cached `AudioBuffer`; play/seek restart one `AudioBufferSourceNode` at an offset (no re-mixing). `AudioContext` is created lazily inside `play()` (user gesture → autoplay-safe); capability-gated, silent fallback.
  - Audio is the master clock: ticks re-anchor the frame clock to the audio position past one frame of drift. Loop wraps restart the source; `ended` stops it; `dispose()` closes the context.
  - `audio` option: omit for the default, pass an `AudioPreview` to substitute (how tests drive it), or `false` to disable.

### Tested

- `pnpm --filter @motionforge/player test` (15 tests; 4 new with a recording fake: start-at-scene-time/stop-on-pause/no-start-while-paused-seek, mid-playback seek restarts at the new offset, drift re-anchor snaps the frame clock to the audio frame, inaudible scenes never attach audio)
- Playwright playground smoke re-run green (silent scenes unaffected).
- `pnpm build`, `pnpm typecheck`, full `pnpm test` (126 unit tests).

### Notes

- Audible playback was verified structurally (fake clock) and the mix math is already RMS-verified in the golden harness; an eared end-to-end check in a real browser tab is worth doing when the playground gains an audio showcase scene.
- Whole-scene mix buffer ≈ 23 MB/min at 48 kHz stereo; chunked mixing remains on the robustness list.

## 2026-06-11 (video nodes contribute audio — week-2 slice 2)

### Changed

- `@motionforge/schema`: `volume` now validates on video nodes too (still rejected elsewhere); `audioStartTime` stays audio-only — video trims picture and sound together via `videoStartTime`, and the rejection message says so.
- `@motionforge/renderer-canvas2d`: `openVideoClip()` probes the clip's audio track on the same input and exposes it as `VideoClip.audio` (`duration`/`sampleRate`/`numberOfChannels`/`AudioBufferSink`). Silent clips simply have no `audio`; `disposeAssets()` is unchanged because the sink shares the clip's input.
- `@motionforge/export`: `collectAudioPlacements()` now returns video nodes as well, plus a new `framesIntoNode` field (head clipping by ancestor windows). The mix maps a video window to source time exactly like the renderer's `videoSourceTime` (`videoStartTime + (localFrame / fps) × playbackRate`), so exported sound stays aligned with previewed picture; `playbackRate` retimes audio by declaring the segment at rate × native sample rate — varispeed semantics (pitch shifts; no time-stretch), documented.
- Alignment fix that fell out of `framesIntoNode`: audio nodes whose _head_ is clipped by an ancestor window now start that many frames into their source instead of restarting from 0 — matching the evaluator's `localFrame = absoluteFrame − from` everywhere.

### Tested

- `pnpm test` (122 unit tests; new: volume accept/reject matrix per node type, video placements with `framesIntoNode` under clipped ancestors, varispeed mixer math via a rate-scaled segment)
- `pnpm golden:test` — new in-browser round trip: a 1 s MP4 with an AAC tone soundtrack is synthesized via `exportVideo`, placed as a **video node** (frame 15, volume 0.8) in a composite, exported, and decoded back: silence before 0.5 s (rms 0.0000), tone window rms 0.2815 vs ≈0.283 theoretical through **two** AAC encode passes.
- `pnpm build`, `pnpm typecheck`

### Notes

- Pitch-preserving time-stretch for rate ≠ 1 audio is explicitly out of scope (varispeed is the documented contract); revisit only if a real consumer needs broadcast-style retiming.
- The player's audio preview (next slice) reuses these exact placements/mix functions, so video-node audio will be audible in preview with no extra engine work.

## 2026-06-11 (scene patch ops — RFC 0001 implemented; week-2 slice 1)

### Changed

- `@motionforge/schema` gains `src/patch.ts`: `applyScenePatch(scene, patch)`, `scenePatchSchema`/`sceneOpSchema` (zod), and `closestIds()`. All ten RFC ops implemented with the RFC's semantics: id-addressed, transactional (any failing op rejects the whole patch), pure/copy-on-write (input never mutated), `setStyle` merges with null-deletes, `setAnimations` replaces as a unit, `insertNode` requires caller-supplied unique ids, `removeAsset` is guarded by reference checks, `moveNode` refuses own-subtree cycles, and the final document fully revalidates so cross-field invariants hold after every patch.
- Error model per RFC: `{opIndex, message}` with path/problem/fix phrasing; missing node ids get closest-id suggestions via edit distance (`closestIds` exported for reuse by future tooling).
- `llms.txt` now tells agents to patch rather than re-emit documents, with the full op vocabulary inline. RFC 0001 status flipped to implemented.

### Tested

- `pnpm --filter @motionforge/schema test` (28 tests; 17 new: merge/null-delete, input immutability, transactionality, closest-id hints, per-op type guards, style/keyframe validation through patches, insert positioning, duplicate-id rejection, subtree removal, move-into-own-subtree rejection, guarded asset removal, meta updates, malformed-patch op indexes, cross-field revalidation, edit-distance ranking)
- `pnpm build`, `pnpm typecheck`

### Notes

- Patch ops intentionally have no JSON-Pointer escape hatch; the closed vocabulary is the contract. If a real consumer needs an op we don't have, add an op, not a pointer.
- The eval harness (RFC's generate/edit/repair suites) remains the next agent-layer step; `applyScenePatch` is its scoring function for the edit suite.

## 2026-06-11 (patch-ops RFC, getting-started guide, 5-week roadmap)

### Changed

- `docs/rfcs/0001-scene-patch-ops.md`: the agent edit vocabulary — id-addressed, transactional `ScenePatch` ops (`setStyle` merge / `setAnimations` replace semantics, guarded asset removal, no JSON-Pointer paths, pure application), error model with closest-id hints, and the mechanical eval harness design (generate/edit/repair suites scored by validator + structural assertions, no LLM judging). Implementation scheduled week 2.
- `docs/guides/getting-started.md`: first user-oriented guide — scene JSON in five minutes, player preview, MP4 export, presets, assets, and the LLM entry point.
- `docs/roadmap.md`: rewritten around the 5-week integration plan (5 workstreams, week 1 marked complete with evidence links). Publishing steps are maintainer-owned and non-blocking.

### Tested

- Docs-only slice; `pnpm test` and `pnpm golden:test` re-run green before commit (108 unit tests, 31 golden checks).

### Notes

- Week-1 scope intentionally shipped without npm/GitHub publishing (maintainer will publish when ready); nothing downstream blocks on it.

## 2026-06-11 (@motionforge/player — playback skeleton)

### Changed

- New publishable package `@motionforge/player`:
  - `FrameClock` — the only place wall-clock time exists in the playback path. Maps injected timestamps to integer frames (anchored at play/seek), pauses by re-anchoring, loops by modulo, clamps + reports `ended` otherwise. Pure given timestamps; replaying from the final frame restarts at 0.
  - `Player`/`createPlayer()` — canvas render loop on top of the clock: `play`/`pause`/`seek`/`dispose`, `loop`, `currentFrame`, events (`frame`/`play`/`pause`/`ended`). Awaits `prepareFrame()` per displayed frame with a latest-frame-wins policy (slow video decode skips ahead, never queues stale frames). Asset ownership explicit: pass `assets` and the caller owns them; omit and the player resolves/disposes.
  - `now`/`requestFrame`/`cancelFrame` injectable, so playback behavior is fully unit-tested in Node with a fake driver.
- Playground now runs on the player (replacing its hand-rolled frame-per-rAF loop, which drifted at low rAF rates); it shares one asset resolution between preview and export.
- README/llms.txt package listings updated; audio-preview design recorded in the package README (reuses export's pure mix functions, one AudioBufferSource, clock re-anchors to audio on drift).

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm --filter @motionforge/player test` (11 tests: clock time→frame mapping incl. frame-boundary rounding, pause/anchor, end clamp + ended flag, loop wrap, seek clamping with play-state preservation, replay-from-end; player frame advancement, latest-frame-wins skip, pause freeze + no leaked rAF, seek, ended event, loop, dispose inertness)
- Playwright smoke against the real playground: poster frame renders, play advances ~22 frames in 700 ms (wall-clock 30 fps), pause freezes, slider seeks, scene switching works, no console errors.

### Notes

- Audio preview is design-only this slice (see package README); export remains the audio source of truth.
- The React wrapper stays deferred until the editor integration needs it — the core is framework-free by design.

## 2026-06-11 (filter, zIndex, border, boxShadow — spike-prioritized engine slice)

### Changed

- `@motionforge/schema`: four new style properties, prioritized by measured frequency in real editor templates (see `docs/editor-adapter-spike.md`):
  - `filter` — validated chain of `brightness`/`contrast`/`saturate`/`grayscale`/`sepia`/`invert`/`opacity` (number or `%`), `hue-rotate(<deg>)`, `blur(<px>)`, or `none`. `isFilterExpression()` exported. Used by 13/20 video overlays in production templates.
  - `zIndex` — integer; paint order only, never layout.
  - `border` — `<width> [solid] <color>` string.
  - `boxShadow` — `<x> <y> [blur] <color>` string.
- `@motionforge/renderer-canvas2d`:
  - `filter` sets `context.filter` for the node's own draws; children inherit unless they set their own (per-draw application, not subtree compositing — identical to CSS for leaf media/text nodes, the dominant case). Safari silently ignores it.
  - Siblings paint in ascending `zIndex` (stable; document order breaks ties) at every tree level. A negative `zIndex` paints behind _all_ siblings, including a full-canvas background sibling — CSS sibling semantics, verified visually.
  - `border` strokes inside the border box following `borderRadius` (solid only; other line styles are loud nulls). `parseBorder()` exported.
  - `boxShadow` rides the background fill via canvas shadow state (no background → no shadow, documented); `inset`/spread unsupported and make the whole value null rather than subtly wrong. `parseBoxShadow()` exported.
- Spike correction: `%` translate already tweens and resolves against the node's own box; the editor's `translateX(-100%)` is an adapter rewrite, not engine work.

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (97 unit tests; new: filter expression accept/reject incl. real production filter chains, zIndex int/fractional, parseBoxShadow forms + inset/spread rejection, parseBorder forms + non-solid rejection, sibling paint order via fillStyle capture)
- `pnpm golden:test` (18 fixtures; new exact fixture `filter-zindex-border-shadow` with an unfiltered control image; rendered frame visually verified before trusting the hash; all pre-existing hashes unchanged)

### Notes

- The `shape` node type was deliberately dropped from this slice: zero occurrences in sampled production templates. It lands with the sticker work when a real consumer exists.
- Filter compositing semantics (subtree-as-group, stacking with ancestor filters) need offscreen layer rendering; revisit if a template filters a container with overlapping children.

## 2026-06-11 (the editor-adapter spike — roadmap slice 13)

### Changed

- Ran the deferred adapter spike against two real templates from the downstream timeline editor (10 and 6 overlays: remote videos, image, texts, sound). Throwaway converter at `tools/spike-editor-adapter/convert.mjs`; findings and the classified gap list in `docs/editor-adapter-spike.md`.
- Both templates convert 100% of overlays to schema-valid scenes and render end-to-end in the harness browser (example-5: 124 frames with three remote pexels videos + mixed AAC soundtrack in ~14 s, ~3 ms/frame after fetch; example-7: 203 frames in ~1.9 s).
- Verified the editor semantics in source: `zIndex = 100 − row·10` paint order, top-level `rotation` (center origin), 15-frame named enter/exit animation ramps, rem/em/empty-string style values, @fontsource class names.

### Tested

- `validateScene()` green for both converted scenes; rendered MP4s + poster frames visually verified (letter-by-letter text reveal, padded photo frame, video color/composition).
- One converter bug found and fixed during verification: paint order was inverted (image covered all text); caught by rendering, not validation — a good argument for the planned pixel-diff artifacts.

### Notes

- Engine priorities reordered by measured frequency: CSS `filter` chains (13/20 video overlays!), `zIndex` style, percent `translate`; `textDecoration` deprioritized (present on every text overlay, always `"none"`).
- Won't-support list started: `backdropFilter`, visualizer overlays, animated React stickers, 3D `flip` — these fall back to Remotion in the editor.

## 2026-06-11 (showcase launch surface — open-source demo slice)

### Changed

- Added private workspace package `@motionforge/showcase`: three shared, schema-valid demo scenes (`intro`, `tiktok-captions`, `karaoke-captions`) used by the playground and generated examples.
- Playground now has a scene picker with per-scene descriptions/proof tags; each selected scene can be scrubbed, played, and exported to MP4.
- Added `pnpm showcase:generate`, which writes the shared showcase scenes to `examples/generated/*.json` for people who want to inspect or render raw scene documents.
- Added README showcase gallery, `docs/showcase.md`, and poster images for the three demos.
- Updated the roadmap to defer the editor integration until the open-source demo surface is stronger.

### Tested

- `pnpm build`
- `pnpm typecheck`
- `pnpm test` (90 unit tests)
- `pnpm golden:test`
- `pnpm showcase:generate`
- Rendered all three generated scenes through the browser harness to MP4 plus poster PNGs:
  - `intro` frame 40
  - `tiktok-captions` frame 60
  - `karaoke-captions` frame 78
- Browser smoke at `http://localhost:5173/`: the scene picker lists all three showcases, switching scenes updates the metadata/poster frame, export stays enabled, and no console errors were reported.

### Notes

- The showcase package is private by design for now. It is launch/documentation surface, not a published runtime package.
- Next follow-up after verification: deploy the playground to GitHub Pages and add a live demo link.

## 2026-06-11 (caption-grade text — roadmap slice 12)

### Changed

- `@motionforge/schema`: added the caption text style contract and regenerated `scene.schema.json`: `textStroke`, `textBackgroundColor`, `textBackgroundPadding`, `textBackgroundPaddingX`, `textBackgroundPaddingY`, and `textBackgroundRadius`.
- `@motionforge/renderer-canvas2d`: text nodes now parse `textStroke` as a compact `<width> <color>` shorthand, resolve numeric/`px`/`%` widths against `fontSize`, and paint the outline before fill.
- `@motionforge/renderer-canvas2d`: `textBackgroundColor` draws one measured, rounded background per rendered line after wrapping and before stroke/fill. Padding and radius resolve against `fontSize`; negative values clamp to zero.
- `@motionforge/presets`: caption generators now apply `textStroke` by default. `tiktokCaptions()` no longer hand-sizes highlight wrapper boxes; highlighted words carry measured background styles directly on their `text` nodes.
- Added exact embedded-font goldens: `text-stroke-embedded-font` for the outline path and `caption-fitted-text-background` for stroked text over fitted per-line pills.
- Updated the scene-format support matrix, presets docs, examples notes, and `llms.txt` so the public contract and agent-facing crib sheet match the implementation.

### Tested

- `pnpm --filter @motionforge/schema test`
- `pnpm --filter @motionforge/renderer-canvas2d test`
- `pnpm build`
- `pnpm typecheck`
- `pnpm test` (88 unit tests)
- `pnpm golden:test` (17 golden fixtures, export smoke, video/audio integration checks)

### Notes

- Slice 12 is complete. The next planned step is the editor-adapter spike: one real `CompositionData` converted into a motionforge scene, then a classified gap list.

## 2026-06-11 (0.2.0 publish prep — roadmap slice 11, credential steps pending)

### Changed

- Added the `0.2.0` changelog entry covering animation maturity since the unpublished `0.1.0` package set.
- Bumped all publishable packages to `0.2.0`: `@motionforge/schema`, `@motionforge/core`, `@motionforge/renderer-canvas2d`, `@motionforge/export`, and `@motionforge/presets`.
- Updated the README version badge to `0.2.0`.

### Tested

- `pnpm build`
- `pnpm typecheck`
- `pnpm test` (80 unit tests)
- `pnpm golden:test` (15 golden fixtures, export smoke, video/audio integration checks)
- `npm pack --dry-run` for all five publishable packages

### Remaining manual steps (need account credentials)

1. Push to GitHub and confirm CI is green.
2. Reserve or confirm access to the `@motionforge` npm scope.
3. Publish from a clean checkout with `pnpm publish -r --access public`.
4. Tag `v0.2.0`.
5. Deploy the playground to GitHub Pages and link it from the README.

## 2026-06-11 (@motionforge/presets — roadmap slice 10)

### Changed

- New package `@motionforge/presets`: pure functions that compile animation intent into scene data (depends only on `@motionforge/schema`; no runtime, no rendering).
  - Motion presets: `popIn`, `fadeUp`, `slideIn(direction)`, `pulse` — each takes `durationInFrames`/`delay`/`easing`, returns keyframe arrays using real transform tweens (`scale(0.8) → scale(1)`) and the new spring/bezier easings. `delay` holds the start value from frame 0 so keyframes stay strictly increasing.
  - Caption generators from ASR-style word timestamps (`{ word, startMs, endMs }[]`): `tiktokCaptions` (one word at a time, pop entrance, optional highlight pills, words hold until the next starts) and `karaokeCaptions` (whole line visible, per-word color ramps to the highlight during its spoken span).
- `examples/generate-tiktok.mjs`: regenerates the TikTok example's caption track from one `tiktokCaptions()` call — the roadmap acceptance criterion ("~10 lines of preset calls") met and visually verified by rendering the generated scene.
- README package table, llms.txt (agents are pointed at presets instead of hand-writing animation JSON), and examples README updated.

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (80 unit tests; presets: schema validity of every preset, delay hold semantics, transform-tween usage, ms→frame mapping, pill/highlight structure, karaoke color ramp values, line span math)
- Rendered the generated scene end-to-end: 150 frames at 1080×1920 in ~1.3 s; frame 50 visually matches the hand-written example's highlight-pill style.

### Notes

- Caption pill widths derive from character count (no text measurement in data land); good enough visually, revisit when text-fitted backgrounds land in slice 12.
- These presets are the compilation target the editor's named enter/exit overlay animations will map onto in the adapter.

## 2026-06-11 (transform interpolation + easing expansion — roadmap slices 8 & 9)

### Changed

- `@motionforge/core`: transform keyframes now **tween**. `parseTransform()` normalizes `translate`/`scale`/`rotate` lists (translate → two length args, unitless = px; scale → two unitless args, sy defaults to sx; rotate → one deg arg); when two keyframes have matching function sequences and matching units per slot, every argument interpolates and the result serializes back to a transform string the renderer already parses. Mismatched sequences or unit conflicts step, like CSS. This removes the `fontSize`-pop workaround and the last ⚠️ row in the support matrix.
- `@motionforge/schema` + `@motionforge/core`: easing widens from four names to expressions — `cubic-bezier(x1, y1, x2, y2)` (x1/x2 validated into [0, 1]; deterministic Newton + fixed-iteration bisection solver) and `spring`/`spring(bounce)` (bounce in [0, 1); 0 is critically damped with no overshoot, larger bounces overshoot and settle). `isEasingExpression()` exported from schema; `cubicBezierEasing()`/`springEasing()` exported from core.

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (72 unit tests; new: transform parse/normalize/reject, tween midpoints with easing, mismatch stepping, bezier endpoints/monotonicity/linear-equivalence/symmetric midpoint, spring overshoot behavior for bounce 0 vs 0.4, schema accept/reject of easing expressions)
- `pnpm golden:test` (15 fixtures + 11 integration checks; new exact fixture `transform-tween-easings` covers a bezier-eased scale+rotate tween, a spring translate, and a mismatched list holding its start value)

### Notes

- Spring easings overshoot by design; opacity driven past 1 is effectively clamped by the canvas (out-of-range `globalAlpha` assignments are ignored). Documented in scene-format.
- The matrix has no partial rows left. Every validated property is fully implemented.

## 2026-06-11 (examples: TikTok-style captions demo)

### Changed

- Added `examples/tiktok-captions.json`: a hand-written 1080×1920 scene producing the one-word-at-a-time caption style — word-timed text nodes, `fontSize` pop with `easeOut` (the current substitute for transform scale tweens), opacity fades, highlight pills, a white→gold color keyframe, an animated progress bar, and an SVG image asset. Pure JSON, no code.
- Added `tools/golden/src/render-example.ts` (`pnpm --filter @motionforge/golden run example <scene.json> <out.mp4> [frame ...]`): renders any scene JSON to MP4 plus optional PNG frames through the harness browser. Harness gained `renderGoldenExportFile` (base64 MP4) and `renderGoldenFramePng`.
- `examples/README.md` documents the workflow with frame thumbnails; rendered MP4s are gitignored.

### Tested

- `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm golden:test` (all unchanged and green)
- Rendered the example: 150 frames at 1080×1920 exported in ~1.8 s (1.6 MiB, AVC); frames 30/60/135 visually verified.

### Notes

- Known animation gap surfaced while building this: `transform` strings step rather than interpolate, so scale pops are expressed via numeric `fontSize`/`width`/`height` keyframes. Transform interpolation is the top animation follow-up, then richer easings (cubic-bezier/spring) and an animation-presets helper that compiles names like `popIn` into keyframes.

## 2026-06-11 (audio — roadmap slice 6)

### Changed

- `@motionforge/schema`: new `audio` node type. Placement uses the standard `from`/`duration` frame semantics; fields are `audioStartTime` (source trim, seconds) and `volume` (0–1). Audio nodes are not visual, so `style`, `children`, and `animations` are rejected with actionable messages (volume keyframes can lift the animations restriction later). The audio-only fields reject on other node types.
- `@motionforge/core`: `audio()` builder.
- `@motionforge/renderer-canvas2d`: audio assets open through mediabunny (`Input` + `AudioBufferSink`) in `resolveAssets()`; `disposeAssets()` releases them.
- `@motionforge/export`: `exportVideo()` mixes every audible node into one stereo 48 kHz track and muxes it into the MP4, negotiating the audio codec per browser (AAC in Chromium). The mix is **pure and unit-tested**: `collectAudioPlacements()` mirrors the evaluator's timing semantics to compute absolute audible windows (ancestor-clipped), and `mixAudioSegments()` does linear resampling, mono fan-out, volume, overlap summing, and final clamping — chosen over OfflineAudioContext so the math is deterministic and node-testable. Trimming past the clip end yields silence, not an error. `ExportVideoResult` gains `audioCodec`.

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (61 unit tests; new: placement windows through nested/clipped parents, mixer offset+volume, resampling, overlap clamping, schema accept/reject)
- `pnpm golden:test` — new in-browser audio checks: a synthesized 440 Hz WAV placed at frame 15 of a 45-frame scene exports to MP4 with an AAC track; decoding the file back measures RMS 0.0000 before 0.5 s (alignment exact) and RMS 0.2809 in the tone window vs 0.283 theoretical for 0.5 amp × 0.8 volume (volume math survives the full encode/decode loop). 45-frame export with mixed audio: 50 ms.

### Notes

- Video nodes do not yet contribute their own audio tracks; an explicit audio node is required. Documented; candidate follow-up.
- Audio preview playback in the playground is not wired; the exported file is the audio source of truth for now.
- The mixed track is built as a single AudioBuffer (fine for short scenes); long scenes may want chunked `AudioBufferSource.add()` calls later.

## 2026-06-11 (video clips — roadmap slice 5)

### Changed

- `@motionforge/schema`: video nodes gain `videoStartTime` (source trim, **seconds** — source footage has its own timebase, independent of scene fps) and `playbackRate` (multiplier). Both reject on non-video nodes with actionable messages.
- `@motionforge/core`: `ResolvedNode` exposes `localFrame` (frames since the node became active), the basis for video time mapping. Builder `video()` accepts the new fields.
- `@motionforge/renderer-canvas2d`: video assets open through mediabunny (`Input` + `CanvasSink`) for frame-accurate decoding — no `<video>` element seeking. The async/sync boundary is explicit: `prepareFrame(scene, frame, assets)` decodes the source frame every active video node needs (`sourceTime = videoStartTime + (localFrame / fps) * playbackRate`, clamped so scenes outlasting the clip hold the last frame) and stages it per node id; `renderStill` then draws synchronously through the shared objectFit path. Drawing an unstaged or stale-staged video node throws. `videoSourceTime()` exported pure; `disposeAssets()` releases decoders.
- `@motionforge/export`: `renderFrameSequence` awaits `prepareFrame` per frame when assets are provided, so `exportVideo` handles video scenes with no API change.
- Golden harness: end-to-end in-browser video checks — synthesize a source clip with `exportVideo` (red 1s / blue 1s), composite it through two video nodes (trim 1.5s; trim 0.5s + rate 2), verify previewed pixels at two scene frames, then export the composite and decode the file to verify exported pixels match preview. No committed binary fixtures; the engine bootstraps its own.

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (57 unit tests; new: source-time mapping incl. trim/rate/clamping, localFrame through nested `from` offsets, schema accept/reject for the new fields, unstaged-video error)
- `pnpm golden:test` (14 fixtures + export smoke + 5 video checks, all passing; decoded color error ≤ 4/255 per channel from double lossy encode)

### Notes

- **Timing baseline** (320x180, headless Chromium, AVC): 60-frame source export 16 ms; 30-frame composite export with two simultaneously decoding video nodes 90 ms (~3 ms/frame). No optimization needed yet; remeasure at 1080p when real footage lands.
- Clips are fetched fully into memory (BlobSource) for deterministic access; streaming sources are future work.
- The playground stays synchronous — its sample scene has no video. When a video scene lands there, `draw()` needs an async wrapper around `prepareFrame`.
- CanvasSink is unpooled so staged canvases stay valid between prepares; revisit with a pool + copy if memory becomes an issue on long scenes.

## 2026-06-11 (v0.1.0 release prep — roadmap slice 3, credential steps pending)

### Changed

- Closed M0 in `docs/m0-roadmap.md` after re-verifying every acceptance criterion.
- Added `CHANGELOG.md` with the 0.1.0 entry covering all four packages.
- Bumped `@motionforge/schema`, `core`, `renderer-canvas2d`, and `export` to 0.1.0 (they version together).
- Verified `npm pack --dry-run` for each package: dist + README + LICENSE only (plus `scene.schema.json` for the schema package); no compiled tests, no tsbuildinfo.
- README badges: status → M0 complete, version → 0.1.0.

### Tested

- `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm golden:test`
- `npm pack --dry-run` × 4

### Remaining manual steps (need account credentials)

1. Create the GitHub repository and push (`git remote add origin … && git push -u origin main`); confirm CI is green and badge URLs match the repo slug.
2. Reserve the `@motionforge` npm scope (npm org).
3. `pnpm publish -r --access public` from a clean checkout, then tag `v0.1.0`.
4. Optional: deploy the playground to GitHub Pages and link it from the README.

## 2026-06-11 (renderer paint completion — roadmap slice 4)

### Changed

- `@motionforge/renderer-canvas2d`: rewrote the `linear-gradient` parser. Any number of stops; direction as `<deg>` angles (CSS gradient-line math through the box center) or `to top/right/bottom/left`; rgba colors with embedded commas (paren-aware splitting); omitted `%` positions distribute evenly between neighbors; out-of-order positions clamp non-decreasing like CSS. `parseLinearGradient()` exported as a pure helper. The pre-existing `paint-gradient` exact golden hash is unchanged — the rewrite is pixel-compatible with the old two-stop format.
- New style property `overflow: "visible" | "hidden"` (schema + renderer): `hidden` clips the node's own content and its subtree to the border box, following `borderRadius` — CSS semantics, so `borderRadius` alone correctly does not clip children.
- Support matrix: `background`, `borderRadius` move to ✅; new `overflow` row. The only remaining ⚠️ is `transform` (translate/scale/rotate subset), and the only schema-only feature is `video` node drawing.

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (51 unit tests; 6 new gradient-parser tests: defaults, angles, keywords, rgba commas, even distribution, clamping)
- `pnpm golden:test` (14 fixtures + export smoke; new exact fixtures `gradient-multistop-angle` and `overflow-hidden-clip` with an unclipped sibling as the negative control; all pre-existing hashes unchanged)

### Notes

- Week 1 roadmap slices 1, 2, and 4 are done. Slice 3 (GitHub push, npm publish) needs account credentials and is the remaining week-1 item.
- Gradient color stops pass through to Canvas2D unparsed, so named colors work in gradients even though keyframe interpolation doesn't interpolate them.

## 2026-06-11 (font loading — roadmap slice 2)

### Changed

- `@motionforge/renderer-canvas2d`: `resolveAssets()` now loads `font` assets through the same pipeline as images. Each font registers with the environment's FontFaceSet (`document.fonts` in windows, `self.fonts` in workers) under its **asset id**, so styles reference it as `fontFamily: "<asset id>"`. Registration is idempotent per (id, src) pair, and `ResolvedAssets` gained a `fonts` map.
- Faces register with default descriptors: name font assets per family+weight (e.g. `Inter-Bold`) and reference them without `fontWeight` instead of relying on synthetic bolding.
- Committed `tools/golden/public/fonts/inter-700-latin.woff2` (Inter Bold latin subset, OFL 1.1, 24 KB, provenance in the fonts README) as a fixture-only font — not shipped in any package.
- New **exact-hash** golden `text-embedded-font`: the first text fixture hashed exactly rather than probed, because the embedded font removes system-font platform variance. Hash reproduces across runs.
- Docs: scene-format asset section documents the font contract and the silent-fallback caveat for unregistered families; matrix and llms.txt updated.

### Tested

- `pnpm build`, `pnpm typecheck`, `pnpm test`
- `pnpm golden:test` (12 fixtures + export smoke; `text-embedded-font` exact hash stable across update/test runs)

### Notes

- Font descriptors (weight/style ranges per asset) are a future schema extension if scenes need multiple weights of one family; the per-weight asset-id convention covers current needs.
- Existing text fixtures (wrap, shadow) intentionally stay probe-based: they test layout behavior against system fonts. New text fixtures should embed fonts and use exact hashes.

## 2026-06-11 (asset pipeline + image rendering — roadmap slice 1)

### Changed

- `@motionforge/renderer-canvas2d`: added `resolveAssets(scene)` — the engine's only async phase. Fetches and decodes every `image` asset to an `ImageBitmap`; rejects with the asset id and src on any failure. Rendering stays pure given `(scene, frame, resolvedAssets)`.
- `renderStill()` accepts `options.assets`; `img` nodes now draw with `objectFit` (`fill` default, `contain`, `cover`, `none`, `scale-down`), `objectPosition` (keywords, `%` with CSS alignment semantics, `px`), and `borderRadius` clipping. Image smoothing is set explicitly so scaled pixels are deliberate. `computeObjectFit()` is exported as a pure, unit-tested helper.
- Drawing an `img` node without resolved assets throws an actionable error naming the asset and the fix — never a silently partial frame.
- `@motionforge/schema`: widened `objectFit` to the full CSS set (`none`, `scale-down` added).
- `@motionforge/export`: `renderFrameSequence` forwards `assets` to the default renderer; `exportVideo` resolves assets internally when not given pre-resolved ones.
- Sample scene gains an inline-SVG badge image (data URL, no network dependency); playground and golden harness resolve assets before rendering.
- New exact golden `image-object-fit`: contain letterbox, cover crop with `objectPosition: left top`, and fill under a rounded clip, using a committed 16x16 quadrant PNG data URL.

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (45 unit tests; 6 new: objectFit geometry for all five modes, percentage/keyword objectPosition, missing-asset error path)
- `pnpm golden:test` (11 fixtures + export smoke; all pre-existing hashes unchanged)

### Notes

- The style support matrix now has **zero** validated-but-unimplemented rows. The remaining schema-only feature is `video` node drawing (roadmap slice 5); `font`/`audio` assets validate but load in later slices through this same pipeline.
- `ResolvedAssets` is deliberately a struct of maps (`{ images }`) so fonts and video sample sinks can be added without breaking the call sites.

## 2026-06-11 (core engine hardening slice)

### Changed

- `@motionforge/schema`: `parseScene`/`validateScene` remember their results in a WeakSet, so re-parsing an already-parsed scene is an identity no-op. This removes the full Zod validation that previously ran on **every frame** of preview and export (a 120-frame export validated the scene 120 times). Parsed scenes are documented as immutable.
- `@motionforge/schema`: keyframe frames must now be strictly increasing, with an actionable validation message. This makes evaluation order a contract instead of a per-call sort.
- `@motionforge/core`: `evaluateKeyframes` no longer sorts on every call (the schema guarantees order) and now **interpolates colors**: when both keyframe values parse as `#hex`/`rgb()`/`rgba()`, the value lerps per-channel in RGBA space with easing applied; other strings still step. `parseColor` is exported.
- `@motionforge/core` layout completion — every remaining layout row in the support matrix is now implemented:
  - `margin` (single value): outer spacing that shifts the box away from its anchor edge (including right/bottom-anchored absolute boxes) and shrinks auto-sized dimensions.
  - `minWidth`/`minHeight`/`maxWidth`/`maxHeight`: clamp resolved sizes; min wins over max (CSS semantics).
  - `justifyContent: "space-between"`: distributes leftover main-axis space on top of `gap`.
  - `alignItems: "stretch"`: fills the cross axis for flex children without an explicit cross size.
- `@motionforge/renderer-canvas2d`: `transformOrigin` implemented (`left`/`center`/`right`, `top`/`center`/`bottom`, `px`, `%`; default remains center).
- Support matrix, scene-format animation docs, and `llms.txt` updated; no validated-but-ignored style properties remain except `objectFit`/`objectPosition` (blocked on asset drawing).

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (10 new unit tests: color interpolation/easing on colors, parseColor forms and rejections, margin, min/max conflict, space-between positions, stretch sizing, parse-cache identity, unsorted-keyframe rejection)
- `pnpm golden:test` — 3 new exact fixtures (color-keyframe-midpoint, flex-space-between-stretch, transform-origin-rotate); all 4 pre-existing exact hashes unchanged, proving the layout refactor is pixel-identical for existing scenes

### Notes

- Color interpolation covers hex and rgb()/rgba() only; named colors and hsl() intentionally step. Revisit if scenes need them.
- The WeakSet parse cache means a scene mutated after parsing bypasses re-validation — consistent with the documented immutability contract, but worth a lint rule eventually.
- Remaining renderer gaps (not layout): gradient parser is still two-stop vertical/horizontal, borderRadius does not clip children (would need an `overflow` property), and `objectFit`/`objectPosition` await the asset-loading slice.

## 2026-06-11 (export slice — M0 sequence complete)

### Changed

- `@motionforge/export`: implemented `exportVideo()` — renders the scene through the shared Canvas2D renderer via `renderFrameSequence()` and encodes to MP4 in the browser with WebCodecs, using mediabunny for encoding orchestration and muxing. Returns `{ blob, codec, totalFrames }`.
- Codec negotiation via `getFirstEncodableVideoCodec()` over all MP4-compatible codecs, so Chromium-only builds without H.264 encode fall back to VP9/AV1. Options: `startFrame`/`endFrame` sub-range export, `signal` (cancels the muxer cleanly), `bitrate` (bits/s or Quality preset), `codecs` override.
- Renders into an `OffscreenCanvas` when available, falling back to a DOM canvas. Awaits `CanvasSource.add()` per frame to respect encoder backpressure.
- Playground: added an "Export MP4" button with frame-by-frame progress, capability gating, and automatic download.
- Golden harness: added an export smoke test that encodes the `opacity-keyframe` scene in the harness browser and asserts a non-empty MP4 (`ftyp` box present, expected frame count). Runs as part of `pnpm golden:test`.
- Marked all eight M0 sequence items complete in the roadmap; updated README status, export README, and `llms.txt`.

### Tested

- `pnpm build`
- `pnpm typecheck`
- `pnpm test` (27 unit tests; new test covers the actionable no-WebCodecs error in Node)
- `pnpm golden:test` (7 fixtures + export smoke: 6697 bytes, avc, 31 frames, video/mp4)
- Playwright-driven playground check: clicking "Export MP4" downloaded `motionforge.mp4` (406 KiB, avc, 120 frames).

### Notes

- mediabunny (MIT) is the first runtime dependency outside zod — chosen deliberately over hand-rolling MP4 muxing; it also gives us WebM and streaming targets when we want them.
- Headless Chromium encodes AVC, so golden export smoke results are stable in CI; the codec fallback path (VP9/AV1) is untested in CI until we add a fixture that excludes AVC.
- Export duration scales with scene length (sequential frame loop). Worker-based parallel rendering is a post-M0 optimization.

## 2026-06-11 (text rendering slice)

### Changed

- `@motionforge/renderer-canvas2d`: text nodes now render multi-line. Explicit `\n` always breaks; words wrap to the box width using `measureText` with the resolved font; the line block is centered vertically, matching previous single-line placement exactly (existing exact-hash goldens unchanged).
- Implemented `fontStyle` (italic), `lineHeight` (unitless multiplier or `px`/`%`, default 1.25), and `letterSpacing` (number/`px`, via the Canvas2D `letterSpacing` API) — three of the validated-but-ignored properties from the support matrix.
- Exported `wrapTextLines(text, maxWidth, measure)` as a pure, unit-testable helper.
- `@motionforge/core`: intrinsic text estimates for flex layout now account for explicit newlines and `lineHeight`.
- Golden harness: probes can scan a row segment (`toX`) and pass if any pixel matches, making text-presence assertions robust without exact glyph hashing. Verified the probe fails on a background-only row before trusting it.
- New golden fixtures: `multiline-explicit-newline` (newlines, lineHeight pitch, italic, letterSpacing) and `multiline-word-wrap` (measured wrapping).
- Updated the style support matrix, text-behavior docs, and `llms.txt`.

### Tested

- `pnpm build`
- `pnpm typecheck`
- `pnpm test` (7 new `wrapTextLines` unit tests; 26 total)
- `pnpm golden:test` (7 fixtures, all passing; pre-existing exact hashes unchanged)

### Notes

- Wrapping happens at render time with real font metrics; flex intrinsic sizing still uses the character-count heuristic. Real text measurement in layout needs a metrics provider abstraction — candidate for the font-loading slice.
- `letterSpacing` relies on the Canvas2D `letterSpacing` API (Chromium-class browsers); other engines silently render without spacing until a fallback lands.

## 2026-06-11 (documentation slice)

### Changed

- Rewrote `docs/scene-format.md` into the canonical contract: full type shapes, timing model, length values, animation semantics, validation invariants, a complete example scene, and a property-by-property style support matrix (validated / layout / render, with partial-support notes).
- Added `sceneJsonSchema()` to `@motionforge/schema` (via `zod-to-json-schema`) and a committed `scene.schema.json` artifact regenerated on every build, so agents and editors can validate scenes without executing code.
- Rewrote `llms.txt` as a working agent contract: mental model, hard rules, a complete valid scene in JSON, the implemented-today style list, example validation errors, and API index.
- Rewrote the README: CI/license/status badges, playground hero screenshot, Mermaid render-pipeline and architecture diagrams, package status table, "Why not Remotion?" positioning, agent documentation section, and a builder code example.
- Added `tools/golden/src/screenshot.ts` (`pnpm --filter @motionforge/golden run screenshot`) to regenerate the README hero image deterministically from the playground at frame 40.

### Tested

- `pnpm build` (regenerates `scene.schema.json`)
- `pnpm typecheck`
- `pnpm test` (new unit test for the JSON Schema export)
- `pnpm golden:test`

### Notes

- The support matrix documents which validated properties are not yet implemented (`margin`, min/max sizes, `transformOrigin`, `fontStyle`, `lineHeight`, `letterSpacing`, `objectFit`, `objectPosition`, `justifyContent: space-between`, `alignItems: stretch`). Implementing the text-related ones is the next engine slice.
- The JSON Schema covers structure only; cross-field invariants stay in `parseScene`/`validateScene` and are documented as such.

## 2026-06-11

### Changed

- Added the browser-based golden-frame harness in `tools/golden`.
- Added initial golden fixtures for gradients, absolute insets, opacity keyframes, flex centering, and text-shadow presence.
- Made builder-generated node ids deterministic per scene serialization.
- Added duplicate node id validation so agent patches have stable node handles.
- Prepared package metadata for future public npm publishing.
- Cleaned up test command semantics so `pnpm test` is unit tests only and `pnpm golden:test` is the explicit browser pixel test.
- Added `renderFrameSequence()` in `@motionforge/export` as the deterministic bridge from still rendering to video export.
- Added export-relative and scene-relative timestamp conversion, progress callbacks, range validation, and abort handling for the export frame loop.

### Tested

- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- `pnpm golden:test`
- `pnpm --filter @motionforge/export typecheck`
- `pnpm --filter @motionforge/export test`

### Notes

- Golden tests currently store exact hashes for geometry/paint fixtures and probe-based assertions for text, because text pixels remain font/platform-sensitive until embedded fonts land.
- The next engineering slice should adapt `renderFrameSequence()` to create `VideoFrame` objects and probe `VideoEncoder` support before muxing.

## 2026-06-10

### Changed

- Created the `motionforge` pnpm monorepo.
- Added `@motionforge/schema` with Zod validation for the first scene format.
- Added `@motionforge/core` with the builder API, keyframe evaluator, sample scene, and simple layout pass.
- Added `@motionforge/renderer-canvas2d` with the first still-frame renderer.
- Added `@motionforge/export` with capability detection and the planned export API surface.
- Added a Vite playground that previews the same scene through the Canvas2D renderer.
- Added README, `llms.txt`, M0 roadmap, scene-format docs, fixture scene, and CI.

### Tested

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- Browser smoke test at `http://localhost:5173/`: loaded playground, played the sample scene, verified no console errors.

### Notes

- Browser export is intentionally a placeholder until the render loop stabilizes.
- The first layout pass is deliberately small and already has a regression test for absolute left/right insets and subtitle clipping.
