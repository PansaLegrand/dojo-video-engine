> Historical record. The editor, UI demos, and model-agent examples have been retired from this engine repository. Current application development: [Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).

# Core Engine Release Candidate Roadmap

**Status:** started 2026-06-19

**Completed slices:** RC1 CLI scene inspection; RC2 public API surface audit; RC3 golden RC matrix; RC4 release gate script; RC5 clean-machine verification; RC6 long-scene and resource confidence.

Dojo Video Engine has enough feature surface to stop chasing overlay breadth for a moment. The next milestone is release-candidate confidence for the open-source base layer: a programmer can author, validate, inspect, preview, test, and export deterministic video scenes with clear APIs and failure modes.

This track is not about making the chat app smarter. The chat app remains a useful reference consumer, but the RC bar is set by the engine packages, CLI/Studio, golden harness, docs, and starter workflow.

## Product Rule

Core readiness work must make Dojo Video Engine easier to trust, automate, and maintain:

- strengthen public contracts before adding more preset convenience
- prefer machine-readable tooling output for CI, agents, and release checks
- prove preview/export behavior with deterministic unit and browser checks
- keep browser-only capabilities explicit instead of implying Node can encode MP4s today
- avoid app-specific semantics in engine packages

## Current Baseline

Already strong:

- validated scene JSON plus JSON Schema
- deterministic frame evaluation, layout, and Canvas2D rendering
- image, video, audio, font, text, subtitle, Lottie, and overlay presets
- player preview with audio synced from the export mixer
- browser MP4 export through WebCodecs and mediabunny
- CLI `validate`, `print`, and `dev`
- create-project starter and programmer authoring helpers
- golden harness with pixel hashes, export smoke, video checks, and audio checks

Not RC-ready yet:

- no single machine-readable CLI inspection command for scene metadata and capabilities
- public API stability is not explicitly classified by package
- golden coverage is broad but not organized as an RC matrix
- browser export checks do not yet cover the newest audio envelope/loop combinations
- release gate commands are scattered across docs and progress notes
- package READMEs do not consistently state stable vs experimental surfaces
- clean-machine verification is documented informally rather than as a repeatable checklist

## Slice RC1 - CLI Scene Inspection

**Goal:** CI, coding agents, and programmers can ask "what is this scene?" without parsing full scene JSON.

Targets:

- `@dojo-video-engine/cli`
- root/package docs
- tests

Done when:

- `dojo-video-engine inspect <scene-module>` validates the module and prints stable JSON metadata
- output includes dimensions, fps, duration, node count, asset counts, media-node counts, and detected capabilities such as audio/video/lottie/presets-relevant media
- invalid scenes fail exactly like `validate`
- CLI docs explain when to use `validate`, `print`, `inspect`, and `dev`

## Slice RC2 - Public API Surface Audit

**Goal:** users know what is stable enough to build on.

Targets:

- package READMEs
- `docs/guides`
- `docs/scene-format.md`

Done when:

- every package lists stable exports, experimental exports, and internal-only concepts
- package boundaries are checked for accidental app-only exports
- README and guides stop implying features are planned when they are already shipped

Completed:

- Package READMEs now classify stable, experimental, and internal API surfaces.
- `@dojo-video-engine/showcase` is documented as private workspace infrastructure rather than a public integration package.
- Guide and scene-format wording was refreshed where it still implied shipped audio preview, fade, or loop behavior was future-only.

## Slice RC3 - Golden RC Matrix

**Goal:** release confidence is visible and systematic.

Targets:

- `tools/golden`
- `docs/testing-strategy.md`
- generated fixtures if needed

Done when:

- one table lists exact goldens, probe goldens, browser export smoke, video checks, and audio checks
- newest audio paths have browser-level coverage: static volume, `volumeEnvelope`, fade, loop, and chunk boundary
- golden failure artifacts and update commands are documented in one place

Completed:

- `docs/testing-strategy.md` now lists the RC golden matrix by area, check type, and command.
- Browser golden audio checks now decode exported MP4 audio for static volume, chunk boundaries, `volumeEnvelope` fade behavior, looped audio beds, and video-node soundtrack timing.
- Failure artifact and update commands are documented alongside the matrix.

## Slice RC4 - Release Gate Script

**Goal:** maintainers have one command or checklist before tagging.

Targets:

- root scripts or docs
- package scripts if needed

Done when:

- release gate includes typecheck, unit tests, builds, lint, golden tests, CLI smoke, create-project smoke, and pack dry-runs
- docs separate "fast local confidence" from "full pre-release confidence"
- failures point to actionable commands

Completed:

- Added `pnpm release:fast` for source checks plus built CLI/create-project smoke.
- Added `pnpm release:full` for the fast gate plus browser goldens, playground E2E, and publishable-package pack dry-runs.
- Documented the two gates in the README and testing strategy.

## Slice RC5 - Clean-Machine Verification

**Goal:** prove the OSS package story outside the monorepo.

Targets:

- docs
- optional script under `scripts/`

Done when:

- verification installs packed packages into a temp project
- validates/inspects a starter scene
- starts Studio or documents the manual check
- records browser export constraints honestly

Completed:

- Added `pnpm verify:clean` to pack publishable packages and install a starter in a temp directory.
- The script runs the starter's `pnpm validate`, `pnpm inspect`, and `pnpm build` outside the monorepo against local tarballs.
- `--keep` preserves the temp starter for the documented manual Studio/browser export check.

## Slice RC6 - Long-Scene And Resource Confidence

**Goal:** long scenes fail predictably or pass with flat memory.

Targets:

- `@dojo-video-engine/export`
- `@dojo-video-engine/player`
- golden/benchmark docs

Done when:

- benchmark docs include long-scene audio/video memory notes
- tests or benchmark scripts cover audio chunks, looped beds, and many-node scenes
- asset disposal and decoder cleanup expectations are documented

Completed:

- Added `pnpm resource:smoke` for 10-minute audio chunk ranges, looped-bed source splitting, envelope chunk offsets, and a 1,000-node evaluate/layout pass.
- Added resource smoke to `pnpm release:full`.
- Updated benchmark/export/player docs with current export chunking, preview audio memory cost, and disposal expectations.

## Acceptance Criteria

- A new programmer can create, validate, inspect, preview, and export a Dojo Video Engine scene by following docs only.
- CI can run a clear pre-release gate without reading project history.
- Core package APIs have documented stability expectations.
- Golden/browser checks cover every media class and the newest audio automation paths.
- Chat and playground remain reference apps, not prerequisites for understanding the engine.
