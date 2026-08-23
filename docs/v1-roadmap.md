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

| Milestone            | Outcome                                                                        | Status                                                                    |
| -------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| 0. Source of truth   | Reconcile the production engine, synchronize versions, enforce boundaries      | Open-source side complete in 0.4 working tree; downstream upgrade pending |
| 1. Scene v1          | Stable schema, migrations, compatibility and preflight contracts               | Next                                                                      |
| 2. Extension kernel  | Versioned, schema-backed deterministic renderer extensions                     | Planned                                                                   |
| 3. Visual primitives | Shape/path, clip/mask, compositing, richer layout and text                     | Planned                                                                   |
| 4. Animation system  | Serializable sequences, repeat/yoyo, stagger, motion paths and curated presets | Planned                                                                   |
| 5. Media and audio   | Lazy/streaming sources, proxies, decoder budgets, richer audio graph           | Planned                                                                   |
| 6. Export runtime    | Worker export, cancellation, streaming output and cloud adapter                | Planned                                                                   |
| 7. Agent tools       | Inspect, lint, patch, diff, contact sheet, capability and migration tools      | Planned                                                                   |
| 8. 1.0 hardening     | Cross-browser, fuzz, performance, package and migration release gates          | Planned                                                                   |

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

Deliverables:

- an RFC for `schemaVersion: 1` and compatibility guarantees;
- deterministic `migrateScene()` from v0;
- formal asset, timing, parent clipping, animation and patch semantics;
- `inspectScene()`, `lintScene()` and render-capability preflight;
- validation of all asset/effect references before asset resolution;
- generated JSON Schema parity enforced in CI;
- a fixture corpus proving v0 → v1 → parse round trips.

Exit criteria:

- old scenes migrate without visual change;
- stored v1 scenes remain loadable across minor releases;
- breaking changes require a new schema version and migration;
- malformed references fail before preview/export begins.

## Milestone 2 — extension kernel

Define a versioned extension contract with:

- a stable name and version;
- a parameter schema and generated JSON Schema;
- asset discovery/resolution hooks;
- optional per-frame preparation;
- deterministic draw behavior;
- worker and renderer capability declarations;
- preflight errors for missing or incompatible extensions.

Move stylistic effects into official extension packs once the contract proves
it can preserve current scene determinism. Models emit extension names and
bounded JSON parameters, never executable source.

## Milestone 3 — visual primitives

Prioritize primitives that unlock many design families:

- shape and SVG/path nodes;
- alpha masks and path/shape clipping;
- Canvas compositing and blend modes;
- radial/conic gradients and multiple shadows;
- per-side spacing and per-corner radii;
- aspect-ratio and safe-area constraints;
- rich text runs and stronger RTL/CJK behavior.

## Milestone 4 — animation system

Add serializable repeat, yoyo, stagger, sequence, named markers, motion paths,
animated masks, and seeded procedural signals. Publish 30–40 carefully designed
animation presets with parameter schemas, thumbnails, reduced-motion variants,
and goldens. Preset names must compile away before rendering.

## Milestone 5 — media and audio

Add reachable-asset loading, streaming/range sources, proxy metadata, explicit
decoder-memory budgets, video loop/freeze/reverse capability reporting,
waveform caching, audio buses, pan, crossfades, ducking, loudness measurement,
and peak limiting. Long projects must not require every whole source file and
the entire preview mix in memory.

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
