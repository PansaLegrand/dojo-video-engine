# Engine verification

For the planned capability inventory, independent media checks, acceptance gates,
and harness handoff, see [the engine readiness plan](engine-readiness-plan.md).
That plan records future work; the commands below describe existing checks.

Build first: package typechecks rely on generated project-reference declarations.

- `pnpm test`: engine, command, authoring, lifecycle, inspection, and CLI unit tests.
- `pnpm check:contracts`: package ownership, exports, dependency, and source boundaries.
- `pnpm check:schema` / `pnpm check:migrations`: generated schema and versioned scene fixtures.
- `pnpm fuzz:scene` / `pnpm corpus:check`: bounded scene mutation and example corpus validation.
- `pnpm golden:test`: pinned-Chromium frame goldens plus real media/audio/export and proof checks.
- `pnpm resource:smoke`: media lifecycle and resource release.
- `pnpm cross-browser`: renderer capability/tolerance probes on Chromium, Firefox, and WebKit.
- `pnpm performance:gate`: bounded render/encode/decode and compositing budgets.
- `pnpm release:fast` / `pnpm release:full`: aggregate release gates and package smoke tests.
- `pnpm verify:clean`: all public tarballs installed into an external headless consumer,
  including Node, browser, worker, CLI, and TypeScript builds.
- `pnpm verify:terminal`: opt-in registry consumer example in a fresh external
  project, using the example's pinned published packages and lockfile. Exercises
  Scene commands, headless preview/export, independent FFmpeg content checks,
  reopening and invalid-input rejection. It does not validate unreleased source
  changes or call a model. See [terminal acceptance](terminal-editing-2026-11-03.md).
- `pnpm verify:media`: build, then independently generate source media with FFmpeg,
  trim/split/retime through the browser engine and decode every output frame with
  FFmpeg. Requires `ffmpeg`/`ffprobe`; retains source hashes, Scenes, exports and
  measured tone/color results under ignored `test-results/media/`. The full gate
  includes this check. `pnpm check:media-oracle` fault-tests the independent grader.

The browser harness is engine test infrastructure, not a second editor application.
UI interaction, provider contracts, and editing-agent acceptance live in
[Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).

No engine gate requires paid LLM/ASR credentials. Exact pixels depend on the pinned
browser/font/color environment; other browsers are checked through semantic probes.
Inspect actual differences before changing a golden. Do not equate these local
checks with production, physical-mobile, or universal-device acceptance.

## Canonical pixel environment

The exact PNG/hash baselines use macOS 26 arm64 and the Playwright-pinned Chromium. CI runs the full gate on `macos-26`. Linux independently runs the full source/contract/CLI gate, three browser capability probes, and the external package-consumer check. OS text rasterization is not assumed byte-identical; exact pixel assertions are not disabled or made tolerant.
