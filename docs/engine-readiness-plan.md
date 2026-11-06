# Engine readiness plan for user-reviewed video editing

Date: 2026-11-01

Last reviewed: 2026-11-02

Status: executing; see [the execution ledger](readiness-progress.md) and
[2026-11-02 evidence](readiness-report-2026-11-02.md). Unchecked work remains open.

## 1. Objective and boundary

Prove that a valid, supported Scene produces the intended preview and exported
media, with correct timing, source selection, audio, and resource cleanup. This
is the engine half of the current workflow:

`request → validated proposal → human comparison → approved edit → export`

The companion is [the harness readiness plan](https://github.com/PansaLegrand/dojo-video-harness/blob/main/docs/harness-readiness-plan.md).
It owns whether the proposal matches the user's request and whether approval,
application, persistence, and undo behave correctly.

This milestone does not require autonomous model-driven render/inspect/revise,
a new agent framework, new generation providers, or expansion to other domains.
Engine checks require no paid LLM or ASR credentials.

| Responsibility                                                                | Owner                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------- |
| Scene schema, evaluation, low-level Scene commands, inspection                | Engine                                            |
| Canvas2D rendering, media preparation, player, audio mixing, export           | Engine                                            |
| ProjectDocument commands, source-clock semantics and compilation to Scene     | Harness command kernel                            |
| User intent, target/scope selection, model context and skills                 | Harness                                           |
| Approved project revision, receipts, questions, cancellation and project undo | Harness host                                      |
| Match compiled Scene and media bindings to the approved project               | Harness integration, supported by engine evidence |

Engine Scene workspaces have their own low-level contracts. They do not replace
the harness's authoritative ProjectDocument or authorize project commits.

## 2. Starting point and evidence limits

The published package set is 1.2.1; see [its release record](releases/1.2.1.md).
Existing checks cover unit behavior, schema/contracts, fuzzing, a scene corpus,
pixel/media goldens, resource lifecycle, cross-browser probes, performance and
clean consumers. See [engine verification](testing-strategy.md).

These are reusable checks, not proof that every proposed case below is already
covered. Start by mapping each case to an executable test and retained evidence.
Do not create duplicate tests when an existing behavior test already establishes
the required invariant. Historical reports are not current candidate acceptance.

## 3. Freeze the acceptance contract first

E-01 produces a capability matrix with one row per supported rendering/media
operation and relevant environment. Record:

- capability ID, public entry point and owning package;
- supported node/asset types and parameter bounds;
- input codec/container, dimensions, duration, frame rate and sample rate limits;
- expected preview, inspection and export behavior;
- unsupported-input behavior and stable diagnostic;
- fixture IDs, test IDs, applicable tolerances and required environment;
- result: `accepted`, `accepted-with-limit`, `not-accepted`, or `not-tested`.

Freeze candidate commit, synchronized package version, lockfile, Node/pnpm,
browser versions, OS/architecture, font hashes and fixture manifest before the
qualification run. Add reference hardware/resource budgets where measured.
Limits and tolerances must be agreed before results are inspected.

Keep the current exact-pixel environment: macOS 26 arm64 and pinned Playwright
Chromium. Other platforms use declared semantic/media tolerances. Do not silently
weaken pixel assertions to accommodate a different platform.

## 4. Fixture collection

Create or extend versioned fixtures in the existing engine test infrastructure.
The manifest and assets are planned deliverables, not new paths or commands that
already exist. Record ID, source/license, SHA-256, generation recipe when synthetic,
container/codec, dimensions, duration, frame timestamps, sample rate, channels,
expected result, supported environment and tolerance policy.

| ID   | Fixture                                                        | Purpose                                                                 |
| ---- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| F-01 | Short numbered/color-marked video at known timestamps          | First/last frame, trim, split continuity, seeks and rate changes        |
| F-02 | Known tones, impulses and distinct channels                    | Gain, mute, mixing, source boundaries and audio/video synchronization   |
| F-03 | Text, CJK/Latin fonts, images, masks and supported animation   | Layout bounds, font readiness, alpha, layering and sampled animation    |
| F-04 | Rights-cleared speech plus background music                    | Representative viewing/listening and mixed-media output                 |
| F-05 | Phone recording with variable frame rate and rotation metadata | Source-time interpretation and orientation handling                     |
| F-06 | Multi-clip portrait/landscape composition                      | Aspect ratios, overlapping layers, admitted transitions and composition |
| F-07 | Longer recording and increasing admitted input sizes           | Sustained synchronization, seek behavior, memory and cancellation       |
| F-08 | Missing, malformed, unsupported or out-of-bounds assets        | Admission checks and actionable failure behavior                        |

Choose F-07 sizes against the declared support envelope; this is not a promise of
unrestricted long-form or 4K/HDR support. Include boundary-plus-one inputs to test
rejection. Share fixture IDs/checksums with the harness; it can wrap these assets
in project documents without maintaining a conflicting media truth.

## 5. What to test and how

Every row requires a normal case, relevant boundary case and failure case.

| Test ID | Area                         | Method and pass condition                                                                                                                                                | Primary locations                                         |
| ------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| E-T01   | Scene validation             | Invalid IDs/references, non-finite numbers and out-of-bounds values fail before side effects; valid supported Scenes remain accepted                                     | `packages/schema`, `packages/commands`                    |
| E-T02   | Evaluation and layout        | Assert known frame values, dimensions, transforms, layering and text bounds independently of the implementation under test                                               | `packages/core`, `packages/inspection`                    |
| E-T03   | Text/fonts/images            | Exercise Latin/CJK, multiline text, font loading/failure and image fit; inspect overflow and retained font/asset identity                                                | `packages/renderer-canvas2d`, `tools/golden`              |
| E-T04   | Source timing                | Check numbered source frames at start/end, nonzero source offset, rate changes and supported loop/reverse behavior; verify exact expected mappings                       | Renderer, player and export tests                         |
| E-T05   | Seek and cache behavior      | Compare direct seek with sequential playback at the same frame; replace sources/revisions and verify no stale frame or wrong audio reuse                                 | `packages/player`, renderer media lifecycle               |
| E-T06   | Audio operations             | Decode F-02 output; measure expected gain/mute, channel identity, mix boundaries and supported automation; test 44.1/48 kHz paths                                        | `packages/export`, `packages/player`                      |
| E-T07   | A/V timing                   | Locate matching visual/audio markers near the beginning and end of F-04/F-07; reject cumulative drift beyond the frozen tolerance                                        | Audio pipeline/AAC timing tests and browser harness       |
| E-T08   | Preview/export agreement     | Compare sampled preview frames with decoded export frames for the same Scene hash and assets; verify intended content and timing                                         | `tools/golden`, `packages/export`                         |
| E-T09   | Export structure             | Decode the entire output; verify dimensions, codec/container, duration, frame timestamps and expected audio tracks                                                       | Export verification and independent FFmpeg/ffprobe checks |
| E-T10   | Cancellation/disposal        | Cancel during loading, preparation, encoding and worker work; repeatedly create/dispose sessions; prove resources are released and no completion is misreported          | Worker, player and resource smoke tests                   |
| E-T11   | Asset and capability failure | Missing font/media, decode failure, unsupported encoder and rejected size limits produce usable diagnostics; no successful artifact is claimed                           | Renderer lifecycle, capability and export tests           |
| E-T12   | Performance/resource bounds  | Measure first frame, seek, render/export duration and retained resources on fixed fixtures/hardware; apply existing budgets and freeze any new ones before qualification | `tools/golden/src/performance-gate.ts`, resource smoke    |
| E-T13   | Browser/platform behavior    | Keep pinned exact goldens; separately check Chromium/Firefox/WebKit capabilities and expected unsupported paths                                                          | `tools/golden/src/cross-browser.ts`                       |
| E-T14   | Published consumer contract  | Install retained tarballs outside the workspace; exercise Node, browser, worker, CLI, TypeScript and the harness's package-consumer path                                 | `scripts/verify-clean-machine.mjs`, harness consumer test |

Do not advertise a feature merely because a schema accepts it. It must execute
correctly in its declared environment, or return an explicit unsupported result.

### Independent oracles and tolerances

- **Scene values:** exact expected identities, frame positions and source mappings.
  Do not calculate every expected value through the same evaluator being tested.
- **Decoded video:** numbered/marked fixtures must place boundaries within one
  output frame of the independently specified expected timestamp. Check the
  first and last intended content, not just reported container duration.
- **Decoded audio:** explicitly compensate for documented encoder delay/padding;
  set the marker tolerance in samples or codec-frame units before the run. Do not
  use padding as a blanket exception for missing content or accumulated drift.
- **Gain:** freeze a dB tolerance on controlled signals and separately verify mute,
  channel behavior and unintended clipping. Record the measurement window.
- **Visuals:** exact comparisons in the pinned environment; declared semantic
  tolerances elsewhere. Human review checks the representative real-media cases.
- **Resources:** apply established budgets. New workload budgets require a recorded
  baseline and a pre-run decision, not a threshold selected after a failing result.

Validate the checkers themselves with deliberately wrong frames, audio offsets,
missing tracks and stale assets. Each injected defect must be detected with the
expected failure class before the checker is used as release evidence.

## 6. Ordered work packages

Checkboxes track execution. Completion requires a linked commit/test/report, not
only an implementation claim. Owners are functional responsibilities, not named
staffing assignments.

| Work item | Owner                                   | Deliverable and completion condition                                                                           | Depends on |
| --------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------- |
| E-01      | Engine maintainer                       | Capability/support matrix and current-test mapping; every in-scope row has expected behavior and an owner      | None       |
| E-02      | Engine test maintainer                  | F-01–F-08 manifest, controlled expected values, tolerance policy and checker fault tests                       | E-01       |
| E-03      | Owning package maintainers              | Fill actual E-T01–E-T11 coverage gaps; retain executable regressions for observed defects                      | E-02       |
| E-04      | Engine test maintainer                  | Resource/performance and environment evidence for E-T12/E-T13; explicit limits for unqualified combinations    | E-02, E-03 |
| E-05      | Release maintainer + harness maintainer | Exact-byte bundle and clean-consumer results, followed by harness integration evidence on the same package set | E-03, E-04 |
| E-06      | Engine maintainer + reviewer            | Per-capability acceptance report, known limits and handoff; all mandatory rows resolved                        | E-05       |

- [x] E-01 complete — initial capability/coverage inventory; see execution ledger
- [ ] E-02 complete
- [ ] E-03 complete
- [ ] E-04 complete
- [ ] E-05 complete
- [ ] E-06 complete

## 7. Execution sequence and existing commands

The commands below are existing entry points, not instructions to run them while
writing this plan. New fixture/checker cases must first be wired into the relevant
gate. Merely rerunning the current gate does not implement E-01–E-06.

```sh
pnpm install --frozen-lockfile
pnpm build
```

After a fix, run the owning package's focused behavior tests. On the frozen
candidate, install the pinned browsers and run the aggregate gate once:

```sh
pnpm --filter @dojo-video-engine/golden exec playwright install chromium firefox webkit
pnpm release:full
pnpm verify:clean
```

`release:full` already includes build, unit/contracts, fuzz/corpus, resources,
goldens, cross-browser, performance and package smoke checks. Do not repeatedly
rerun those gates without a new change, failure or unresolved concern.

For an engine change requiring a new package release, follow
[the release process](release-process.md): retain one tested bundle, verify its
integrity and install it in clean consumers. The harness's existing
`npm run test:engine-packages -- --pack-dir <bundle-directory>` exercises a clean
consumer of those tarballs. Its candidate must be committed and clean.

An already-published unchanged engine can be qualified without a new npm version.
Keep package publication, consumer verification and agent quality as separate
evidence. Never move a signed tag or republish different bytes at an existing version.

## 8. Evidence and acceptance

Retain a unique evidence directory outside tracked source, or in a deliberately
ignored test-output path. The directory must contain the candidate identity,
fixture manifest/hash, environment, commands/results, tolerances, failed-case
reproductions, sampled preview frames, exported files and decoded measurements.
Keep all failures and later runs; publish only a reviewed, redistributable summary.

Acceptance requires:

1. Every mandatory in-scope case passes on the frozen candidate.
2. No wrong source/frame, lost intended media, unaccounted A/V drift, stale cache,
   resource-lifecycle failure or incorrect success result remains unresolved.
3. All resource and performance requirements meet their predeclared bounds.
4. Unsupported combinations fail as specified and are not marketed as supported.
5. Retained package integrity and external consumer checks pass.
6. A reviewer watches/listens to the representative outputs and records findings.

Do not lower golden/timing tolerances or remove a failing case to obtain a pass.
Either fix the defect or explicitly narrow the claimed support envelope before
freezing a new candidate and rerunning the affected gates.

The result is a per-capability verdict, not a universal claim of device support,
editorial quality or live model competence.

## 9. Handoff and fault ownership

Give the harness maintainer: engine version/source commit, exact package integrity,
Scene schema version, fixture IDs/hashes, supported environments, limits,
diagnostics, accepted tolerances and evidence locations.

For a cross-repository failure, preserve the approved project hash, compiled Scene
hash, asset/source identities, expected result and observed output. Reproduce the
same Scene through a minimal engine consumer:

- Correct project but incorrect compiled Scene: harness compiler/source-clock fix.
- Correct Scene but incorrect render/export: engine fix, followed by a versioned
  dependency update and harness regression.
- Correct output but confusing comparison/publication UI: harness host/UI fix.
- Wrong interpretation or target: harness agent/context/capability fix.

The harness updates exact dependencies, lockfile and engine provenance together.
Do not copy an engine fix into a new vendored renderer fork. Engine acceptance
can proceed independently of live GPT testing; final application acceptance
requires both reports for the same engine/harness candidate pair.
