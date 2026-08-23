# MotionForge base-engine v1 roadmap

## North star

MotionForge is the deterministic, serializable, agent-native video runtime:
scenes are portable data, every edit is validated, and preview/export consume
the same renderer contract.

The project does not need to reproduce the whole browser. It should become the
best foundation for generated, editable, template-driven 2D video.

## Product rules

1. The scene document remains canonical.
2. New authoring layers compile to scene data; they do not create parallel
   render contracts.
3. Visible behavior is deterministic and golden-tested.
4. High-level presets demonstrate primitives; they do not substitute for
   missing engine architecture.
5. Browser export is the default, not the only possible deployment target.
6. Downstream applications consume MotionForge; they do not own engine forks.

## Milestones

| Milestone            | Outcome                                                                        | Status                                       |
| -------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- |
| 0. Source of truth   | Reconcile the production engine, synchronize versions, enforce boundaries      | Committed in 0.4; downstream upgrade pending |
| 1. Scene v1          | Stable schema, migrations, compatibility and preflight contracts               | Committed in 0.5                             |
| 2. Extension kernel  | Versioned, schema-backed deterministic renderer extensions                     | Committed in 0.6                             |
| 3. Visual primitives | Shape/path, clip/mask, compositing, richer layout and text                     | Committed in 0.7                             |
| 4. Animation system  | Serializable sequences, repeat/yoyo, stagger, motion paths and curated presets | Committed in 0.8                             |
| 5. Media and audio   | Lazy/streaming sources, proxies, decoder budgets, richer audio graph           | Complete in 0.9 working tree                 |
| 6. Export runtime    | Worker export, cancellation, streaming output and cloud adapter                | Planned                                      |
| 7. Agent tools       | Inspect, lint, patch, diff, contact sheet, capability and migration tools      | Planned                                      |
| 8. 1.0 hardening     | Cross-browser, fuzz, performance, package and migration release gates          | Planned                                      |

## Milestone 0 — authoritative open-source engine

Delivered in the 0.4 working tree:

- reconciled effect nodes, audio-reactive rendering, sequential video decode,
  player/export lifecycle improvements, macros and their unit tests;
- added NodeNext/public-package integration fixes found by the reconciliation;
- synchronized all nine public packages at 0.4.0;
- added package version, changelog and dependency-boundary checks;
- added a seeded pixel golden for the six general procedural effects;
- updated current engine, macro, scene-format and Remotion-positioning docs;
- documented one-way downstream integration policy.

Remaining downstream action is deliberately separate: upgrade DojoClip to a
tagged/published MotionForge release or an exact commit after its own protected
application QA. The reconciliation does not modify the SaaS repository.

## Milestone 1 — Scene v1

Delivered in the 0.5 working tree:

- accepted RFC 0002 for `schemaVersion: 1` and compatibility guarantees;
- deterministic, cached, non-mutating `migrateScene()` from v0;
- strict canonical v1 schema with backward-compatible parse/validate APIs;
- typed asset and effect reference validation before resolution;
- shared `inspectScene()` and `lintScene()` APIs;
- Canvas2D environment preflight for Canvas, decoder, font, and Lottie needs;
- generated JSON Schema parity and paired v0/v1 migration fixture gates;
- canonical v1 examples, fixtures, prompts, builders, starter, and docs;
- CLI `migrate` and `lint` commands.

Exit criteria:

- [x] old scenes migrate without visual change;
- [x] stored v1 scenes remain loadable across minor releases;
- [x] breaking changes require a new schema version and migration;
- [x] malformed references fail before preview/export begins.

## Milestone 2 — extension kernel

Delivered in the 0.6 working tree:

- accepted RFC 0003 for the data/code trust boundary and lifecycle;
- stable names, exact versions, and explicit compatibility aliases;
- Zod parameter schemas plus generated JSON Schema discovery manifests;
- JSON-only Scene v1 extension descriptors, builder and patch support;
- typed asset discovery, async resolution, per-frame preparation, drawing,
  and disposal through the Canvas2D renderer;
- worker and renderer capability declarations;
- typed preflight errors for missing/incompatible definitions, invalid params
  or assets, and unsupported renderer/worker combinations;
- player and export registry forwarding through the shared rendering path;
- unit coverage plus a pinned-browser pixel golden for the full lifecycle.

Exit criteria:

- [x] models emit extension identity and bounded JSON, never executable source;
- [x] missing or incompatible host code fails before any extension hook runs;
- [x] preview and export consume the same resolved extension resources;
- [x] extension pixels are deterministic and golden-tested;
- [x] extension metadata is discoverable without executing scene-provided code.

Moving existing stylistic effects into official packs remains a later,
separately versioned migration. The kernel is proven without changing current
effect pixels or invalidating existing scenes.

## Milestone 3 — visual primitives

Prioritize primitives that unlock many design families:

- [x] shape and bounded SVG/path nodes;
- [x] binary vector masks and path/shape clipping;
- [x] Canvas compositing and blend modes;
- [x] radial and conic gradients;
- [x] per-side spacing and per-corner radii;
- [x] aspect-ratio constraints;
- [x] multiple shadows and isolated group compositing;
- [x] engine-level safe-area constraints;
- [x] metric-stable rich text runs and explicit LTR/RTL direction.

RFC 0004 defines the completed contract. One combined exact-pixel browser
fixture covers geometry, paths, gradients, clips, soft/inverse masks, group
isolation, multiple shadows, inline text runs, strokes, radii, and blend modes.
Bitmap/luminance masks, per-run font metrics, and shadow spread/inset remain
later additive refinements rather than milestone blockers.

## Milestone 4 — animation system

Delivered in the 0.8 working tree:

- finite/infinite repeat and yoyo playback;
- named scene markers with builder, patch, inspection, and timeline support;
- sequence, stagger, overlap/gap, and marker choreography compilers;
- distance-weighted motion paths with optional tangent orientation;
- animated mask opacity/feather/radius and seeded numeric signals;
- numeric interpolation for matching filter chains;
- 38 curated motion presets with parameter schemas, thumbnail metadata,
  reduced-motion variants, catalog integration, and one browser contact-sheet
  golden;
- preset names and choreography instructions compile away before rendering.

RFC 0005 defines the playback, compiler, accessibility, and determinism
contract.

## Milestone 5 — media and audio

Delivered in the 0.9 working tree:

- reachable-only asset resolution across nodes/effects/fonts/extensions;
- HTTP range sources, explicit source modes, proxies, and metadata;
- decoded-image/source-cache/video-decoder budgets plus resource estimates;
- video hold/loop and muted reverse visuals with capability reporting;
- opt-in cached streaming waveforms and shared audio-reactive analysis;
- audio buses, node/bus pan, crossfades, ducking, loudness measurement, and
  deterministic peak limiting;
- bounded chunked Web Audio preview around the current play/seek position;
- browser MP4 assertions for video loop/reverse and audible bus pan/ducking.

RFC 0006 defines the resource, source-selection, audio-graph, and determinism
contract.

## Milestone 6 — export runtime

Move the standard export path into a Web Worker, add cancellation and progress,
support streaming output targets, and expose an estimate/preflight report. A
reference headless worker should consume the same scene/renderer contract for
mobile or unsupported-browser fallback.

## Milestone 7 — agent tools

Publish stable tools for scene inspection, capability discovery, validation,
linting, patching, diffing, migration, still rendering, contact sheets, and
export. Agents should discover the macro/extension catalog from runtime
metadata rather than receiving a hand-maintained monolithic prompt.

## Milestone 8 — 1.0 release gate

Require unit, property/fuzz, pixel-golden, media round-trip, cross-browser,
determinism, resource, performance, clean-install, package and agent-evaluation
gates. Publish SemVer compatibility, migrations, reproducible benchmarks and a
curated example corpus before declaring Scene v1 stable.

## Near-term allocation

Until Scene v1 and the extension contract are stable:

- 50% engine architecture and primitives;
- 25% media performance and reliability;
- 15% authoring, tooling and open-source developer experience;
- 10% polished presets and showcases.

After the 1.0 contract stabilizes, preset and ecosystem investment can increase
without turning each new visual treatment into core renderer maintenance.
