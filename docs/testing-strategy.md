# Testing Strategy

Testing is part of the design, not a cleanup phase. Each engine slice should land with the smallest useful test that proves the behavior and makes future renderer work safer.

## Current Test Layers

- `pnpm typecheck`: strict TypeScript across every workspace package.
- `pnpm test`: Vitest unit tests for schema, core, renderer, presets, authoring, player, export helpers, chat, and app utilities.
- `pnpm build`: package builds plus app production builds where packages define them.
- `pnpm check:contracts`: synchronized package versions, changelog coverage, package files, internal dependency policy, and browser-engine boundaries.
- `pnpm check:schema`: built Zod Scene v1 schema must byte-match the committed JSON Schema artifact.
- `pnpm check:migrations`: every committed v0 fixture must migrate without mutation to its paired canonical v1 fixture, and v1 must remain idempotent.
- `pnpm golden:test`: Playwright-pinned Chromium renders fixture scenes, checks golden-frame hashes/probes, runs browser MP4 export smoke, and decodes exported video/audio for media assertions.
- `pnpm e2e`: launches the real playground, verifies canvas paint, playback controls, patch validation/application, audio scene playback, Lottie playback, and console cleanliness.

## Release Gates

- `pnpm release:fast`: run before merging core changes. It runs typecheck, unit tests, determinism lint, builds, and built CLI/create-project smokes.
- `pnpm release:full`: run before tagging or publishing. It runs the fast gate plus long-scene resource smoke, browser goldens, playground E2E, and `npm pack --dry-run` for every publishable package.
- `pnpm verify:clean`: pack publishable packages, install a generated starter in a temp directory, import and execute the packed runtime/Canvas runtime entry points, and run the starter's `validate`, `inspect`, and `build` scripts outside the monorepo.
- `pnpm fuzz:scene`, `pnpm corpus:check`, `pnpm cross-browser`, `pnpm performance:gate`, and `pnpm agent:gate` are mandatory parts of the 1.0 full gate.

The gate script lives at `scripts/release-gate.mjs`; clean-machine verification lives at `scripts/verify-clean-machine.mjs`. When a command fails, the scripts print the exact command and let the underlying tool output stay visible.

## RC Golden Matrix

`pnpm golden:test` is the release-candidate browser media gate. It runs `tools/golden/src/cli.ts` against `tools/golden/src/harness.ts` and the fixtures in `tools/golden/src/fixtures.ts`.

| Area                  | Coverage                                                                                                                                          | Check type                          | Command                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------- |
| Paint/layout baseline | Gradient paint, absolute insets, flex centering, space-between/stretch, overflow clipping                                                         | Exact frame hash                    | `pnpm golden:test`      |
| Animation baseline    | Opacity midpoint, color midpoint, transform origin, transform tween/easing                                                                        | Exact frame hash                    | `pnpm golden:test`      |
| Motion preset catalog | All 38 compiled presets, including repeat/yoyo and smooth filter motion                                                                           | Exact contact-sheet hash            | `pnpm golden:test`      |
| Text baseline         | Embedded font, stroke, fitted text background, shadow presence, explicit newlines, wrapping, auto-height                                          | Exact hash or probe                 | `pnpm golden:test`      |
| Image/media styling   | `objectFit`, rounded image clipping, filter, z-index, border, shadow                                                                              | Exact frame hash                    | `pnpm golden:test`      |
| Lottie                | Source-frame seeking and playback-rate mapping for self-contained vector JSON                                                                     | Exact frame hash                    | `pnpm golden:test`      |
| Procedural effects    | Seeded general-effect catalog renders identically                                                                                                 | Exact frame hash                    | `pnpm golden:test`      |
| Extension kernel      | Versioned registry resolution, per-frame preparation, and Canvas2D adapter output                                                                 | Exact frame hash                    | `pnpm golden:test`      |
| Visual primitives     | Shape/path geometry, radial/conic paint, multiple shadows, clips, soft/inverse masks, isolated groups, rich runs, strokes, radii, and blend modes | Exact frame hash                    | `pnpm golden:test`      |
| Scene migration       | Legacy v0 effect scene migrates to pixels identical to canonical v1                                                                               | Cross-version frame hash            | `pnpm golden:test`      |
| Export smoke          | Browser `exportVideo()` creates a plausible MP4 with `ftyp`, expected frame count, and codec metadata                                             | Browser encode assertion            | `pnpm golden:test`      |
| Stream export         | Positional WritableStream output reconstructs a valid MP4 under backpressure                                                                      | Browser stream/mux assertion        | `pnpm golden:test`      |
| Video media           | Synthetic clip trim/rate/hold/loop/reverse, preview pixels, export/decode round trip                                                              | Browser encode/decode assertion     | `pnpm golden:test`      |
| Audio media           | Codec/track/timing, bus pan separation, audible ducking, limiting, automation, looping                                                            | Browser encode/decode RMS assertion | `pnpm golden:test`      |
| Audio chunks          | 0.4s audio chunks across node-start boundaries                                                                                                    | Browser encode/decode RMS assertion | `pnpm golden:test`      |
| Video soundtrack      | Video node's embedded audio reaches export with correct timing and volume                                                                         | Browser encode/decode RMS assertion | `pnpm golden:test`      |
| Audio automation      | `volumeEnvelope` starts quiet and reaches full level in exported MP4                                                                              | Browser encode/decode RMS assertion | `pnpm golden:test`      |
| Audio looping         | `loop: true` continues a 1s WAV beyond its source end in exported MP4                                                                             | Browser encode/decode RMS assertion | `pnpm golden:test`      |
| Prepared runtime      | Legacy/runtime exact RGBA, transparent-frame replacement, borrowed player/export assets, and exact audio mix parity                               | Browser pixel/PCM assertion         | `pnpm golden:test`      |
| Display conformance   | Stable ops/IDs/order, JSON round-trip, capability rejection, Canvas-vs-facade RGBA across neutral fixtures                                        | Reusable backend + pixel suite      | `pnpm golden:test`      |
| 1080p/4K compositing  | Nested isolation, soft/inverted masks, filters, transforms, shadows, pool stabilization/reuse/disposal                                            | Browser time + exact pool budgets   | `pnpm performance:gate` |
| Resource smoke        | 10-minute chunk/preview ranges, reachable assets, budgets, loop splitting, envelope offsets, 1,000-node layout                                    | Node smoke assertion                | `pnpm resource:smoke`   |
| Playground workflow   | Real UI paints, plays, seeks, patches, loads audio and Lottie scenes, and stays console-clean                                                     | Playwright UI smoke                 | `pnpm e2e`              |

## Golden Artifacts

Exact hash fixtures store both JSON snapshots and PNG baselines under `fixtures/goldens`.

- Update accepted visual changes with `pnpm golden:update`.
- Inspect any mismatch before updating; hash failures write `expected`, `received`, and `diff` PNGs under `fixtures/goldens/__diffs__`.
- Probe fixtures intentionally avoid pixel-perfect hashes when text shaping is platform-sensitive but still assert visible/absent pixels.
- Browser media checks synthesize their own video and audio assets inside the harness, so they do not need large binary fixtures.

## Slice Rules

- Schema changes need valid and invalid examples.
- Schema-version changes need paired migration fixtures and idempotence/non-mutation checks.
- Layout changes need at least one geometric assertion.
- Animation changes need deterministic numeric assertions.
- Renderer changes need either a unit-level contract test or a golden/probe fixture.
- Runtime changes need transactional race/disposal tests; renderer adapters additionally need prepared-vs-legacy frame/audio parity and packed-entry-point coverage.
- Display-list changes need structural conformance, cross-context text-layout
  reuse, capability rejection, and Canvas pixel parity. Cache/pool changes
  additionally need exact byte ownership, poisoned failure, eviction, and
  disposal evidence.
- Extension changes need registry/preflight unit coverage and a renderer golden for pixel-visible adapters.
- Export changes need capability/failure-path tests plus a browser encode/decode assertion when the behavior depends on WebCodecs, media decoding, muxing, or AAC output.
- Preset and authoring helpers should test emitted scene data, then rely on golden/showcase coverage for renderer-visible behavior.
- App/editor behavior should get a focused unit test for pure planning logic and a Playwright smoke only when the browser workflow is the product contract.

## Near-Term Gaps

- Ducking is still future mixer work; when it ships, add both unit windows and browser RMS checks before marking AX5 complete.
- Local browser `blob:` sources remain buffer-backed; HTTP media is range-backed and proxy-aware.
- `pnpm verify:clean -- --keep` preserves the temp starter for manual Studio/browser-export checks.

## Verification Template

Use this in `docs/progress.md` for each meaningful change:

```md
## YYYY-MM-DD

### Changed

- ...

### Tested

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm golden:test`
- Browser smoke: ...

### Notes

- ...
```
