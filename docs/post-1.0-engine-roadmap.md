# MotionForge Post-1.0 Engine Platform Roadmap

Date: 2026-08-25  
Last reviewed: 2026-08-26
Status: active implementation contract; MF0 through MF8 complete

## Purpose

This roadmap defines the next MotionForge engine program after the completed
Scene v1 / MotionForge 1.0 roadmap. It does not replace the historical delivery
record in [`v1-roadmap.md`](v1-roadmap.md). It starts from the current 1.0 code
and addresses the gaps exposed by building a real conversational editor on top
of it.

The strategic position is:

> MotionForge is an independent, deterministic video document engine with a
> safe mutation surface, computed spatial inspection, and browser-first local
> rendering.

Browser rendering alone is not the moat. The durable value is a strict,
portable render artifact plus one inspectable and testable path from data to
pixels and audio.

Every milestone in this roadmap ends with tests, documentation, release-gate
evidence, and one dedicated commit. Downstream product synchronization is a
separate commit in the downstream repository.

## Engine boundary

MotionForge owns:

- canonical Scene documents, schemas, migrations, and low-level patches;
- deterministic evaluation, layout, display-list generation, and rendering;
- media preparation, technical metadata, resource policy, and lifecycle;
- audio placement, mixing, buses, envelopes, panning, ducking, and limiting;
- generic semantic scene commands usable by code, editors, or agents;
- spatial, temporal, audio-graph, and export inspection;
- browser preview and browser/worker export orchestration;
- framework-neutral adapters for CLIs and agent tool protocols.

MotionForge does not own:

- LLM providers, prompts, conversation memory, autonomous planning, or token
  policy;
- ASR, semantic media descriptions, embeddings, media retrieval, or stock
  search;
- accounts, permissions, billing, credits, databases, queues, or SaaS project
  state;
- product-specific tracks, editorial decisions, approval policy, or UI state;
- DojoClip imports, environment variables, IDs, routes, tables, or analytics;
- executable code embedded in Scene JSON.

Generic editability is an engine capability. Autonomous decision-making is a
host-product capability.

## Non-negotiable invariants

1. Scene v1 remains the canonical low-level render IR for the 1.x line.
2. Existing Scene v1 timing, defaults, and pixel semantics do not change
   silently.
3. Canonical parsing is strict. Tolerant ingestion is an explicit repair API,
   never implicit field stripping.
4. Preview, main-thread export, worker export, and any future fallback backend
   consume the same evaluated layout/display-list contract.
5. Accepted visual values have defined renderer semantics; schema-valid no-ops
   are defects.
6. Resource ownership is explicit, bounded, cancellable, and disposed on every
   success/failure path.
7. Wall-clock time, unseeded randomness, remote executable code, and hidden
   renderer state never enter evaluation.
8. New authoring or JSX layers compile to Scene data; they do not become a
   second canonical renderer contract.
9. Renderer capability differences fail preflight or produce explicit
   diagnostics; they do not silently change output.
10. Public APIs retain SemVer compatibility and compatibility re-exports through
    the documented deprecation window.

## Target package direction

The target dependency direction is one-way. In this diagram, `A -> B` means
**A may depend on B**; concrete edges land only with their owning milestone:

```text
@motionforge/core       ──> schema
@motionforge/extensions ──> schema
@motionforge/presets    ──> schema

@motionforge/inspection ──> schema + core
@motionforge/commands   ──> schema + presets
@motionforge/runtime    ──> schema + core + inspection + extensions

@motionforge/renderer-canvas2d ──> core/display list + extensions + media
@motionforge/player            ──> runtime + audio
@motionforge/export            ──> runtime + audio

@motionforge/authoring   ──> schema + core + presets
@motionforge/agent-tools ──> commands + inspection + runtime + export
@motionforge/cli         ──> public facades above
```

Media and audio lifecycle may become public packages only when the extraction
produces a useful independent contract. Implementation folders should not be
published merely to make files smaller.

The desired public concepts are:

```ts
parseScene(input): Scene;
repairSceneInput(input): RepairResult;

evaluateScene(scene, frame): ResolvedScene;
resolveLayout(resolved, metrics): LayoutSnapshot;
compileDisplayList(layout): DisplayList;

createSceneWorkspace(scene, options): SceneWorkspace;
createSceneRuntime(options): Promise<SceneRuntime>;

inspectTree(scene): TreeInspection;
inspectTimeline(scene): TimelineInspection;
inspectLayout(scene, frame): FrameInspection;
analyzeComposition(scene, frames): CompositionDiagnostics;
```

## Cross-cutting production contract

The milestones below must collectively cover these concerns; none may be left
as an undocumented product responsibility.

### Time and synchronization

- Scene v1 retains its integer-fps composition grid during 1.x;
- variable-frame-rate and rational-rate source timestamps, including NTSC
  media, map deterministically onto that grid;
- any persistent rational composition timebase requires an explicit Scene v2
  RFC and migration rather than an additive change hidden in runtime code;
- source time, node-local time, Scene frame time, and audio sample time kept
  distinct;
- trim, reverse, rate conversion, envelopes, buses, and A/V drift tests;
- explicit policy for pitch-changing varispeed versus future time-stretch.

### Browser and media capability

- tested codec/container/browser capability matrix;
- Worker, OffscreenCanvas, WebCodecs, Web Audio, background-tab, and mobile
  restrictions;
- proxy, streaming, memory, decoder, and canvas-size budgets;
- explicit host fallback interface when local export is unavailable;
- no hidden dependency on a third-party renderer.

### Typography and color management

- embedded-font path for reproducible output;
- CJK, emoji, bidirectional text, line breaking, and text-fit fixtures;
- documented sRGB/P3/HDR input and tone-mapping policy.

### Media fidelity

- EXIF orientation, pixel aspect ratio, alpha, channel layouts, and resampling;
- proxy-to-source replacement preserves crop, timing, and orientation;
- explicit policy for browser/OS-dependent text rasterization, color
  management, and tolerance-based versus exact cross-platform comparisons.

### Security

- URL scheme/origin policy, CORS/tainted-canvas handling, MIME and byte limits;
- hostile/decompression-bomb media protection and complexity limits;
- trusted extension registry and CSP-compatible integration;
- no arbitrary code or module URL stored in Scene JSON.

### Output verification

- decode completed exports and verify duration, dimensions, tracks, seekability,
  representative nonblank frames, audible expected audio, and A/V sync;
- expose `verification: "none" | "container" | "sampled" | "full"` and a
  `verified | unverified | failed` result;
- streaming sinks that cannot be reread return `unverified` unless the host
  supplies a verification-capable sink; verification never forces hidden full
  buffering that defeats streaming.

### Export sinks and recovery

- explicit backpressure and partial-write behavior for Blob, WritableStream,
  and host-provided sinks;
- in-memory output ceilings, storage-quota/File-System-Access absence, tab
  reload/crash behavior, and recoverable large-output policy;
- cancellation and disposal behavior defined for every sink phase.

### Failure taxonomy and observability

- stable error codes and phase-tagged progress for parse, repair, preflight,
  resolve, evaluate, render, audio, encode, mux, verify, and dispose;
- runtime, worker, CLI, and tool adapters preserve the same codes;
- observability callbacks remain vendor-neutral and opt-in.

### Extensions and supply chain

- stable extension ABI with schema/version negotiation, capability declaration,
  worker support, migration, trust/signing policy, and failure isolation;
- explicit behavior when a required extension is missing or incompatible;
- dependency/license and codec-patent review, SBOM, package provenance/signing,
  vulnerability policy, and reproducible release artifacts.

## Milestones

### MF0 — Architecture and contract baseline

Commit:

```text
docs: define post-1.0 engine boundaries
```

Deliver:

- this roadmap plus accepted
  [RFC 0009](rfcs/0009-post-1.0-platform-architecture.md);
- the public package/entry-point
  [ownership and deprecation baseline](public-api-ownership.md);
- target dependency DAG and deprecation policy;
- automated forbidden-import and dependency-cycle checks;
- current package export-map snapshot;
- a downstream synchronization contract.

Non-goals:

- no package moves;
- no Scene or pixel changes;
- no product/agent behavior changes.

Exit gate:

- current `pnpm release:full` remains green;
- architectural boundary tests fail on a controlled negative fixture created
  outside normally scanned source paths;
- every current public package entry point and bin is classified and covered;
  MF0 does not claim a machine-checked symbol-level API report.

### MF1 — Canonical contract integrity

Commit:

```text
fix(schema): enforce canonical scene semantics
```

Deliver:

- strict top-level, node, animation, keyframe, envelope, and nested-object
  parsing;
- explicit `repairSceneInput()` for tolerant ingestion;
- typed animation targets and target-specific value validation;
- shared transform, filter, paint, border, shadow, and easing grammars;
- schema/patch/builder/authoring feature-parity corrections;
- an RFC defining the portable supported value grammar, including named/color
  syntax, gradients, transforms, borders, shadows, filters, and the explicit
  P3/CSS Color 4 policy, recorded as
  [`RFC 0010`](rfcs/0010-portable-scene-values.md);
- configurable `preflightScene(scene, limits)` execution policy for full
  document values/depth, pixels, frames, nodes, assets, paths, animations, and
  keyframes; host limits do not change canonical Scene validity;
- compatibility audit of real example/downstream scenes, reporting every key
  currently stripped and providing repair/migration diagnostics before strict
  parsing is enabled by default;
- the evidence/remaining downstream gate recorded in
  [`mf1-compatibility-audit.md`](mf1-compatibility-audit.md);
- corrected generated JSON Schema and documentation.

Non-goals:

- no new layout primitives;
- no attempt to repair invalid canonical documents silently.

Exit gate:

- no canonical field is silently discarded;
- every accepted animation/style value has defined evaluation/paint semantics;
- Zod and generated JSON Schema agree on a shared valid/invalid corpus;
- sampled stored/downstream scenes show zero silent data loss and have an
  explicit compatibility release note;
- existing valid-scene goldens remain identical unless a documented bug-fix
  fixture proves the intentional pixel change.

Tests:

- unknown keys at every nesting level;
- animation target/value matrix;
- grammar property/fuzz tests;
- builder/authoring/patch parity matrix;
- mutation-based invalid/deep-tree fuzzing.

### MF2 — Media lifecycle and capability correctness

Commit:

```text
fix(runtime): make media ownership bounded and transactional
```

Deliver:

- owned export resources disposed through asynchronous `finally` paths;
- transactional cleanup after partial preparation failure;
- bounded font/audio-analysis/source caches;
- injected host-owned `AssetPolicy` callbacks for schemes, origins,
  credentials, signed-URL refresh, MIME, bytes, cancellation, and derived
  proxy resolution; MotionForge contains no provider-specific signing or proxy
  generation;
- embedded-video soundtrack included in audio capability preflight;
- tested main-thread/worker capability negotiation;
- explicit server/headless fallback contract owned by the host;
- output decode-and-verify modes and verification-capable sink contract.

Non-goals:

- MotionForge does not operate a cloud renderer;
- no semantic media analysis.

Exit gate:

- repeated prepare/export/dispose returns to baseline resource counts;
- failed/cancelled asset loads strand no resources;
- unsupported browser/media combinations fail before frame encoding whenever
  capability/source metadata permits, and otherwise before final success;
- successful exports pass post-encode structural/media verification.

Tests:

- repeated-export leak test;
- mixed-asset partial failure and cancellation;
- long/large/proxy media;
- VFR/NTSC-source mapping onto the integer composition grid and A/V sync;
- codec/container/browser matrix;
- malformed and oversized input policy fixtures.

### MF3 — Spatial and temporal inspection

Commit:

```text
feat: add renderer-neutral composition inspection
```

Deliver:

- `@motionforge/inspection`;
- tree, timeline, layout, hit-test, and sampled-composition APIs;
- stable per-node parent/depth/type, local and absolute active windows, plus an
  optional semantic role only when supplied explicitly by authoring/host
  context;
- layout/content/transformed/clip bounds and z-order;
- text line, fit, overflow, direction, and font metrics through a
  `TextMetricsProvider`;
- media object-fit/crop/intrinsic geometry through a `MediaMetricsProvider`;
- each measurement labeled `exact`, `declared`, or `estimated`;
- deterministic diagnostics for outside-frame, zero-size, unsafe edge,
  geometric overlap, possible occlusion, subtitle collision, excessive crop,
  and flex overflow, including confidence/reason fields;
- CLI `inspect-layout` and a single JSON `check` envelope;

Non-goals:

- no vision-model dependency;
- geometric overlap is not automatically treated as a defect when explicitly
  allowed by author intent.

Exit gate:

- a host can answer "where is node X at frame Y and what may overlap or clip
  it?" without product-specific layout code;
- every diagnostic contains node ID, frame/time, bounds, source path, and a
  suggested remediation class;
- pixel-aware occlusion, effective contrast, and render artifacts remain later
  runtime/tool responsibilities rather than claims of pure geometry inspection.

### MF4 — Typed commands and revisioned workspace

Commit:

```text
feat: add typed scene commands and workspace
```

Deliver:

- `@motionforge/commands` with a discriminated, non-recursive JSON Schema;
- text, style, placement, resize, align/distribute, timing, media trim/gain,
  add/remove/move/group, preset, macro, and layout-intent commands;
- compilation to canonical ScenePatch;
- in-memory revisioned workspace with draft/commit, inverse patches, undo/redo,
  affected IDs, semantic diff, and stale-revision rejection;
- macro/preset manifests with parameter JSON Schema, examples, required assets,
  and output roles.

Non-goals:

- no durable database or multi-user collaboration;
- workspace revision/history is session-local; persistence, authorization, and
  distributed concurrency remain host responsibilities;
- no ASR-aware, ripple-edit, or product timeline commands.

Exit gate:

- editors, scripts, and agents use the same public mutation vocabulary;
- every command can be inspected, applied transactionally, reversed, and
  represented without a recursive Scene payload;
- untouched nodes remain identical.

### MF5 — Reusable prepared Scene runtime

Commit:

```text
feat(runtime): add reusable prepared scene sessions
```

Deliver:

- `@motionforge/runtime` prepared Scene session;
- backend capability/preflight/session interface;
- incremental `updateScene()` with unchanged resource reuse;
- generic text/media intrinsic-metrics providers shared by layout and
  inspection;
- portable frame-image artifact generation through a host artifact sink;
- unified cancellation, phase events, error codes, and asynchronous disposal;
- compatibility facades for existing player/export/renderer entry points.

Non-goals:

- no renderer modularization in the same commit;
- no new layout vocabulary;
- no second renderer.

Exit gate:

- unchanged assets are not reloaded after an unrelated edit;
- replaced assets dispose exactly once;
- stale in-flight preparation cannot overwrite a newer Scene revision;
- player/export/runtime frames and audio remain equivalent;
- abort, sink failure, and disposal races are covered.

### MF6 — Renderer-neutral display list and Canvas modularization

Commit:

```text
refactor(canvas2d): render through a reusable display list
```

Deliver:

- renderer-neutral display list containing geometry, paint, text layout,
  media references, clips/masks, composites, and stable IDs;
- an explicit extension decision: an extension either compiles to standard
  display operations or emits a versioned opaque operation resolved by a
  capability-declaring backend;
- display lists are ephemeral, noncanonical runtime artifacts and are never a
  stored replacement for Scene data;
- Canvas2D backend modularized behind compatibility facades;
- bounded scratch-surface pool, box-bounded isolation/masks, and static
  subtree/text caching;
- renderer conformance suite for any future backend.

Non-goals:

- no second renderer is required for milestone completion;
- WebGPU remains optional and evidence-driven.

Exit gate:

- preview/export/worker pixels and audio remain equivalent;
- compositing-heavy 1080p/4K fixtures remain within published memory and time
  budgets.

### MF7 — Layout v2 authoring semantics

Implementation status: complete. The accepted decision is
[RFC 0012](rfcs/0012-layout-v2-authoring.md); the exact contract and release
evidence are recorded in [the MF7 delivery note](mf7-layout-v2.md).

Commit:

```text
feat(layout): add semantic stack grid and constraints
```

Deliver:

- an accepted RFC deciding which layout intents compile away and which, if
  any, require a future Scene version; Scene v1 semantics never change
  implicitly;
- stack, row, column, grid, gap, wrapping, grow/shrink, fill/hug, and overlay;
- intrinsic image/video dimensions through a metrics provider with explicit
  missing-metadata fallbacks;
- safe-area anchors, alignment/distribution, and bounded sibling-relative
  constraints;
- deterministic text fitting across supported writing systems;
- promotion of existing place/text-role/look/layout intents into stable,
  manifest-driven public compilers;
- optional JSX adapter recorded as a stretch deliverable after the data/API
  semantics pass their gates.

Non-goals:

- no attempt to implement the whole CSS platform;
- no React execution during frame rendering;
- JSX is not an exit dependency.

Exit gate:

- portrait, square, and landscape fixtures adapt without hand-authored pixel
  coordinates;
- long Latin, CJK, emoji, and RTL copy remains bounded;
- existing Scene v1 documents retain their prior layout/pixels;
- authoring/storage/migration semantics are decided before implementation.

### MF8 — Framework-neutral tool workflow and evidence

Implementation status: complete. The accepted decision is
[RFC 0013](rfcs/0013-framework-neutral-agent-workflow.md); the exact contract
and release evidence are recorded in
[the MF8 delivery note](mf8-agent-workflow.md).

Commit:

```text
feat(agent-tools): expose typed inspect-edit-check workflows
```

Deliver:

- agent tools rebuilt over workspace, inspection, runtime, and export;
- recursive Scene ingestion isolated behind one load/validation boundary;
- subsequent iterative tools use non-recursive workspace handles and typed
  commands rather than repeating Scene arguments;
- workspace load/read/search/apply/check/render/undo flow;
- artifact sink abstraction for frames/contact sheets/diffs;
- before/after comparison sheets and automatic proof-frame selection from
  cuts, keyframes, captions, and Scene changes;
- provider-neutral event stream and bounded tool results;
- a reference host app upgraded from one-shot JSON to iterative
  inspect/repair.

Non-goals:

- no provider SDK or autonomous agent belongs in the published engine;
- an example host may use an optional provider, but no provider dependency
  enters public packages or deterministic release gates;
- deterministic release tests do not require paid model calls.

Exit gate:

- every tool input/result is JSON-schema-described and serializable;
- the reference workflow performs inspect → command → check → render →
  repair without replacing the whole Scene;
- optional live-model evaluations are recorded separately from the release
  gate with model/provider/version, prompt/tool-manifest hash, temperature,
  budgets, trial count, date, success, latency, and token metadata.

### MF9 — Open-source release, interoperability, and governance

Commit:

```text
release: publish the post-1.0 engine platform
```

Deliver:

- exact package versions, tags, changelog, migration notes, and npm packages;
- clean-install ESM/browser/worker examples;
- API reference and extension/macro starters;
- compatibility, performance, browser, and evaluation reports;
- MotionForge Agent Skill and optional thin MCP adapter over the same tools;
- documented import/export bridges for common timeline data and a clearly
  scoped Remotion/HTML interoperability path;
- contribution, security-reporting, compatibility, extension-ABI, supply-chain,
  vulnerability, and governance policy;
- equivalent-task comparisons with current Remotion/HyperFrames plus
  clean-room external-user install/API feedback.

Exit gate:

- a clean external project can install, validate, inspect, preview, and export;
- tag/package/schema/tool versions agree;
- public examples demonstrate repair and evidence, not only finished videos;
- MotionForge remains useful without DojoClip or any model provider.

## Test and release policy

Every milestone runs:

```sh
pnpm release:fast
```

New contract gates become named scripts before their corresponding milestone
is complete:

```sh
pnpm check:schema-parity
pnpm check:api-parity
pnpm check:resource-lifecycle
pnpm check:renderer-conformance
```

Schema, layout, media, renderer, worker, or export milestones also run:

```sh
pnpm release:full
pnpm verify:clean
```

Release-candidate evidence additionally includes:

- current automated three-browser probes and a separately labeled
  mobile/background-tab manual evidence matrix until real-device CI exists;
- long and multi-asset media fixtures;
- CJK/emoji/RTL/font fixtures;
- VFR, rational-rate, audio-channel, and A/V sync fixtures;
- color/orientation/alpha/HDR-policy fixtures;
- hostile/oversized resource-policy fixtures;
- decoded-output verification;
- actual-model evaluation on a versioned task corpus, reported but not required
  for deterministic unit-test reproducibility.

Before MF0 is approved, maintainers record quantitative budgets by device tier
for at least 720p/1080p/4K, short/long duration, node/layer count, source media
size, memory, frame time, export ratio, and cancellation latency. A milestone
cannot satisfy a performance gate merely by saying output stayed within an
unspecified "published budget."

The determinism report distinguishes:

- exact pixels within the pinned browser/OS/font/color environment;
- tolerance-based conformance across browser engines, GPU paths, and operating
  systems;
- features that are capability-gated or unsupported rather than silently
  approximated.

## Downstream synchronization contract

MotionForge is upstream. A downstream product must never become the hidden
source of engine behavior.

For every downstream upgrade:

1. land and verify the MotionForge commit first;
2. publish or record the exact upstream commit/package versions;
3. synchronize in one downstream-only commit;
4. record provenance in DojoClip's existing
   `packages/motionforge/UPSTREAM.json` (or an explicitly versioned successor);
5. run the downstream engine-consumer matrix, not only the Video Agent tests;
6. keep old Scene readers and runtime compatibility until stored projects are
   migrated safely;
7. report downstream-only adaptations explicitly and upstream generally useful
   fixes immediately.

For DojoClip specifically, the consumer matrix includes Video Agent, Video
Watermark, Music Visualizer, Music MV, and standalone subtitle workflows.

## Definition of completion

This roadmap is complete only when MotionForge can truthfully demonstrate:

```text
strict document
  → typed reversible edit
  → computed spatial/audio inspection
  → deterministic preview
  → verified browser/worker export
  → portable evidence and diagnostics
```

More animation packs are valuable only after this loop is reliable and
discoverable. Until then, new presets are a small supporting workstream rather
than the engine priority.

## Implementation log

- 2026-08-25 — MF0 complete: accepted RFC 0009; recorded package/entry-point
  ownership and the 1.0 export/bin baseline; centralized the current dependency
  policy; and enforced cycle freedom, approved internal edges, `workspace:*`,
  public-to-private isolation, declared external dependencies, exported/self
  subpaths, relative escapes, product/framework/provider/data dependencies,
  CJS/import-type/JS-family sources, the unscoped starter package, and Windows
  test paths. Ten controlled contract fixtures passed. `pnpm release:full`
  passed 595 unit tests, 750-scene fuzzing, 28-scene corpus validation, resource
  checks, pixel/media/audio/tool goldens, Chromium/Firefox/WebKit probes,
  performance, 10 browser E2E checks, builds, CLI/starter smoke, and all package
  dry-runs. No Scene, renderer, export, package entry point, or pixel/audio
  behavior changed.
- 2026-08-25 — MF1 complete: canonical Scene v1 parsing became strict across
  document, node, style, animation, keyframe, envelope, and nested values;
  tolerant ingestion moved to explicit repair, renderer-supported value
  grammars and animation targets were aligned, preflight budgets and generated
  schema were added, and the downstream compatibility audit was recorded in
  `mf1-compatibility-audit.md`. Commit `0807144` passed the full release and
  clean-machine gates without silently changing existing valid-scene output.
- 2026-08-26 — MF2 complete: media resolution is transactional and cancellable;
  async teardown is idempotent; source/font/analysis/decoder resources are
  bounded; host `AssetPolicy`, stable content identity, reachable-media and
  embedded-audio preflight, worker id ownership, player rollback, explicit
  host fallback, and bounded output verification are implemented. The exact
  public contract and remaining sampling/extension limits are recorded in
  `mf2-media-lifecycle.md`. The final full release gate passed 119 focused
  renderer/media tests, 47 export tests, 23 player tests, all workspace
  suites/types/contracts/builds, 750-scene fuzzing, the 28-scene corpus, seven
  long-resource checks, verified video/audio/tool goldens, Chromium/Firefox/
  WebKit probes, all 10 E2E checks, performance at or below 6.1 ms/frame and
  26 MiB heap, CLI/starter smoke, and every public package dry-run.
  `pnpm verify:clean` also packed the publishable workspace, installed the
  generated starter outside the monorepo, and passed validate/migrate/inspect/
  lint/build against the packed artifacts.
- 2026-08-26 — MF3 complete: added the public renderer-neutral
  `@motionforge/inspection` package with tree, timeline, per-frame layout,
  topmost-first hit testing, bounded composition sampling, and unified check
  envelopes. Core now owns shared content, affine transform, rounded-corner,
  and object-fit geometry while the Canvas2D compatibility API and pixels stay
  unchanged. Text/media metrics carry exact/declared/estimated provenance;
  diagnostics cover outside/zero/safe-edge/overlap/possible-occlusion/subtitle/
  crop/flex cases with explicit host intent, confidence, source paths, and
  remediation classes. CLI `inspect-layout`/`check` and five strict bounded
  agent tools expose the same contract. Adversarial coverage includes nested
  timing/transforms/clips, animated/soft/inverted masks, ancestor transparency,
  rounded geometry, line strokes, RTL/text fitting, local coordinates,
  non-finite/provider failures, conservative confidence, and JSON Schema
  strictness. The final full gate passed 735 unit tests, 750-scene/2,250-frame
  fuzzing, the 28-scene corpus, seven resource checks, unchanged pixel/media/
  audio/tool goldens, Chromium/Firefox/WebKit, all 10 E2E checks, and performance
  at or below 5.96 ms/frame and 26 MiB heap. All 12 public packages, including
  inspection, passed dry-run packing; `pnpm verify:clean` packed them, installed
  a generated external starter, and passed validate/migrate/inspect/lint/build.
- 2026-08-26 — MF4 complete: added `@motionforge/commands` with 16 strict,
  bounded, non-recursive command kinds and Zod/draft-07/Ajv structural parity;
  canonical compilation covers text/style/placement/resize/align/distribute,
  timing, forward/reverse media trim, gain, flat add/remove/move/group, motion
  presets, macros, and layout/look intents. Exact verified inverse patches and
  a bounded in-memory workspace provide draft/commit, monotonic revisions,
  stale-write rejection, semantic diffs, affected IDs, undo/redo, and defensive
  history. Versioned motion/macro manifests include validated schemas/examples,
  required assets, and output roles; the agent registry exposes the identical
  command schema through `motionforge.commands.apply`. Adversarial review covered
  rich text, source ordering/reparenting, repeat/yoyo preservation, layout-owned
  style clearing, absolute/center geometry, nested opaque-data and animation
  budgets, custom macro isolation, duplicate-ID semantic arrays, and all 13
  ScenePatch inverse categories. Independent randomized evidence passed 1,000
  mixed-patch inverse and 1,685 commit/undo/redo round trips. The full gate
  passed 799 unit tests, 750-scene/2,250-frame fuzzing, the 28-scene corpus,
  seven resource checks, unchanged pixel/media/audio/tool goldens, all three
  browsers, 10 E2E checks, and performance at or below 6.41 ms/frame and 28 MiB
  heap. All 13 policy-derived public packages passed dry-run packing, and the
  packed clean-install starter passed validate/migrate/inspect/lint/build.
- 2026-08-26 — MF5 complete: added the renderer-neutral
  `@motionforge/runtime` prepared-session package and the public
  `@motionforge/renderer-canvas2d/runtime` backend. Revisioned latest-intent
  updates are transactional; stale preparation cannot publish; native and
  explicitly keyed extension resources retain final-owner leases across
  unrelated edits; replacement, rollback, cancellation, artifact-sink, and
  asynchronous cleanup races have stable portable errors/events. Core,
  inspection, and Canvas now share defensive intrinsic text/media metrics with
  field-level exact/declared/estimated provenance. Player and export facades
  borrow one exact prepared revision for their full lifetime/operation without
  taking resource ownership. The pinned Chromium gate proved 20,480 RGBA bytes
  exact across legacy/runtime/player/export paths, including opaque-to-
  transparent replacement under poisoned caller state, and 19,200 mixed
  Float32 samples bit-exact. The final full gate passed 864 unit tests,
  750-scene/2,250-frame fuzzing, the 28-scene corpus, seven long-resource
  checks, all existing and new pixel/media/audio/tool goldens, Chromium/
  Firefox/WebKit, all 10 E2E checks, and performance at or below 6.22 ms/frame
  and 30 MiB heap. All 14 policy-derived public packages passed dry-run
  packing. The packed clean-install starter imported and executed both runtime
  entry points, then passed validate/migrate/inspect/lint/build.
- 2026-08-26 — MF6 complete: accepted RFC 0011 and added core's ephemeral,
  JSON-safe display-list v1 with stable hierarchy/operation identities,
  geometry, paint, compiler-owned text layout, media references, explicit
  capabilities, defensive snapshots, and structural budgets. `renderStill()`
  now assembles evaluate → layout → compile → Canvas execute while retaining
  its 1.x API and clamped/fractional-frame behavior. Extensions explicitly
  choose standard rect/text/image operations, exact versioned opaque handlers,
  or the preserved legacy Canvas bridge; immutable reuse, worker realms, and
  native-resource separation are enforced. Canvas scratch allocation is
  pooled, exact-bucket, byte/surface bounded, box-cropped, and ownership-safe
  across isolation, soft masks, pixelation, and shadows. Proven-static isolated
  subtrees use byte-bounded, resource-aware, collision-checked rasters that
  survive compatible runtime revisions without adding a pixel copy. A reusable
  nine-fixture backend conformance suite passed every structural/capability
  case and exact-RGBA fixture. The full gate passed 962 unit tests,
  750-scene/2,250-frame fuzzing, 28 corpus Scenes, seven resource checks, all
  existing pixel/video/audio/export/runtime/tool goldens, Chromium/Firefox/
  WebKit, and all 10 E2E checks. The existing 720p gate peaked at 6.15 ms/frame
  and 29 MiB heap; cache-hit compositing measured 1.85 ms/frame at 1080p and
  1.72 ms/frame at 4K with 14.44/57.66 MiB static residency and
  63.86/258.83 MiB exact-bucket scratch peaks. Cached, fresh, and replenished
  cache-disabled pixels were byte-identical. All 14 public packages packed,
  and the external packed starter passed runtime imports plus
  validate/migrate/inspect/lint/build.
- 2026-08-26 — MF7 complete: accepted RFC 0012 and added the public
  `@motionforge/layout` package with a
  flat, bounded Layout Contract v1 that compiles stack/row/column, wrapping,
  grid, overlay, fill/hug, grow/shrink, safe-area, aspect, and sibling
  constraints into ordinary Scene v1. Prepared media/text metrics, explicit
  fallback/font policies, deterministic text projection, strict JSON evidence,
  stable failures, and every solver budget are covered. The public
  `@motionforge/presets/intents` entry point now exposes versioned manifests and
  nonthrowing compilation for place, safe-area, text-role, media-look, and
  clip-layout intent. The full gate passed 1,037 unit tests, 750 generated
  Scenes / 2,250 evaluated frames, 28 corpus Scenes, seven resource checks,
  unchanged legacy pixel/media/audio/export/runtime/tool goldens, the new
  three-aspect Layout v2 browser matrix, Chromium/Firefox/WebKit, and all 10 E2E
  checks. The 720p gate peaked at 5.97 ms/frame and 31 MiB heap; cache-hit
  compositing measured 2.01 ms/frame at 1080p and 1.72 ms/frame at 4K with
  exact cache-disabled pixels. All 15 public packages packed, and the external
  packed starter imported runtime entry points and passed
  validate/migrate/inspect/lint/build.
- 2026-08-26 — MF8 complete: added the provider-neutral handle workflow with
  one recursive Scene load,
  flat read/search/check, 19 typed commands, monotonic revisions, undo/redo,
  bounded schema-described results, ordered events, and deterministic cleanup.
  Proof selection now derives frames from changes, cuts, keyframes, captions,
  and markers; comparison plans materialize through transactional renderer/sink
  ports. The prepared Canvas browser port and scoped memory sink passed real
  before/after/diff/contact-sheet pixel and lifecycle evidence. The reference
  chat edits existing Scenes through an inspect-command-check-proof-repair loop
  starting from the latest UI state; provider code remains app-only. Focused
  suites passed 68 commands, 49 agent-tools, 129 chat, and 15 offline eval
  tests. The full gate passed 1,110 unit tests, 750 generated Scenes / 2,250
  frames, 28 corpus Scenes, seven resource checks, existing goldens plus real
  handle-workflow proof pixels, all three browsers, and 10 E2E checks. The 720p
  gate peaked at 6.52 ms/frame and 33 MiB heap; compositing measured 1.90
  ms/frame at 1080p and 1.92 ms/frame at 4K with exact cache-disabled pixels.
  All 15 public packages packed, and the clean external starter passed packed
  runtime imports plus validate/migrate/inspect/lint/build.
