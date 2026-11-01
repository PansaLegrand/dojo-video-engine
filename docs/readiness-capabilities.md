# Engine capability and coverage inventory

Date: 2026-11-01. Scope: Scene v1, current public 1.1.x APIs.
This is E-01 inventory evidence, not new rendering acceptance. Parameter-level
support remains defined by `packages/schema` and `docs/scene-format.md`.

| Capability / public owner                                           | Existing executable coverage                                                                                                                                | Required qualification / boundary                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Validation, migration, patches / schema                             | `packages/schema/src/index.test.ts`, `patch.test.ts`, `preflight.test.ts`, `json-schema.test.ts`                                                            | E-T01; preserve atomic rejection, version and supported-value contracts             |
| Frame evaluation and layout / core                                  | `packages/core/src/index.test.ts`; `tools/golden/src/fixtures.ts`                                                                                           | E-T02; integer/local frame semantics and independent expected positions             |
| Text, rich text, fonts and image fit / renderer                     | `packages/renderer-canvas2d/src/index.test.ts`, `font-descriptors.test.ts`; golden text/image fixtures                                                      | E-T03; pin fonts; qualify CJK/real-media separately                                 |
| Video source offsets, rate and frame preparation / renderer         | `tools/golden/src/harness.ts` video checks; `asset-preparation.test.ts`                                                                                     | E-T04; add an independently encoded source and decoded marker oracle                |
| Seeking, playback and cache identity / player + renderer            | `packages/player/src/index.test.ts`, `audio.test.ts`; `display-cache.test.ts`, `proxy-audio.test.ts`                                                        | E-T05; random seeks, source replacement and original proxy audio                    |
| Gain, envelopes, audio mixing and resampling / export               | `packages/export/src/audio-pipeline.test.ts`, `audio-envelope-boundaries.test.ts`                                                                           | E-T06; independent waveform/marker checks at 44.1/48 kHz                            |
| AAC timing and A/V synchronization / export                         | `packages/export/src/aac-timing.test.ts`, `audio-seek-preroll.test.ts`; golden audio checks                                                                 | E-T07; verify start/end content and drift on declared lengths                       |
| Canvas2D display, masks, effects and animation / renderer + presets | Golden visual-primitives/effect/motion fixtures; `packages/presets/src/index.test.ts`                                                                       | E-T08; exact pinned pixels; semantic cross-browser probes                           |
| Blob/stream/worker MP4 export / export                              | `packages/export/src/verification.test.ts`, `worker.test.ts`; golden export/runtime checks                                                                  | E-T09; external whole-file decode plus correct content, not only readable container |
| Prepared runtime, cancellation and disposal / runtime + renderer    | `packages/runtime/src/session.test.ts`, `media-lifecycle.test.ts`; `tools/golden/src/resource-smoke.ts`                                                     | E-T10/E-T11; cancellation during work, invalid assets and resource release          |
| Resource and performance envelope / runtime + tools                 | `tools/golden/src/performance-gate.ts`, `resource-smoke.ts`                                                                                                 | E-T12; existing budgets; freeze hardware and new workload bounds before judging     |
| Browser capabilities / renderer + export                            | `tools/golden/src/cross-browser.ts`                                                                                                                         | E-T13; distinguish preview from encoding support; no universal pixel claim          |
| Authoring, layout plans, macros and extensions                      | `packages/authoring/src/index.test.ts`, `packages/layout/src/index.test.ts`, `packages/extensions/src/index.test.ts`                                        | Validate generated Scene and registry versions; no arbitrary executable Scene data  |
| Scene commands, inspection and bounded interchange                  | `packages/commands/src/commands.test.ts`, `packages/inspection/src/index.test.ts`, `packages/interchange/src/index.test.ts`                                 | Typed low-level contracts; not ProjectDocument approval or business intent          |
| Tool adapters, CLI and starter                                      | `packages/agent-tools/src/index.test.ts`, `packages/cli/src/index.test.ts`, `packages/create-dojo-video-engine/src/index.test.ts`                           | Engine interfaces only; no LLM runtime or provider credentials                      |
| Public package consumption                                          | `scripts/verify-clean-machine.mjs`; [harness consumer check](https://github.com/PansaLegrand/dojo-video-harness/blob/main/scripts/test-engine-packages.mjs) | E-T14; retained tarballs and exact dependency identities                            |

## Candidate policy

The engine supports only schema-admitted values and detected media/encoder
capabilities. Scene video/audio nodes do not promise every codec, device, input
size or arbitrary HTML/CSS behavior. Reuse existing pinned goldens without
regeneration. Use generated, redistributable media for independent timing tests;
keep actual phone/CJK/long-recording qualification explicitly pending until run.

Evidence sequence: independent checker fault tests → focused engine checks →
canonical full gate → exact consumer check → harness paired acceptance. No paid
model request is part of the engine gate.
