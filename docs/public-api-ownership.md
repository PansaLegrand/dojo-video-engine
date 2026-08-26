# MotionForge public API ownership and deprecation baseline

Status: accepted with RFC 0009  
Baseline: MotionForge 1.0.0 / post-1.0 milestone MF8

This document classifies the public package entry points that existed at the
start of the post-1.0 engine program. The machine-readable export-map snapshot
is [`public-api-baseline.json`](public-api-baseline.json); `pnpm
check:contracts` fails when a public package or entry point changes without a
deliberate baseline update.

An exported symbol is public even when it was sparsely documented. Files below
an unexported `src/` or `dist/` path are private implementation details. The
MF0 machine baseline intentionally covers package entry points and bins, not
individual TypeScript symbols. Symbol compatibility remains a SemVer policy
and is protected by types/tests until a separate declaration/API-report gate is
introduced; MF0 must not be described as mechanically classifying every symbol.

## Ownership

| Package / entry point                    | Owner                                                                                                  | Stability and permitted evolution                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `@motionforge/schema`                    | Canonical Scene documents, validation, migration, inspection, lint, JSON Schema, and low-level patches | Stable. Document semantics require Scene versioning/migration; additive result fields are permitted.                                         |
| `@motionforge/schema/values`             | Portable visual value grammars, parsed forms, validators, and deterministic serializers                | Stable entry point added in MF1. New optional grammar forms are additive; changing accepted existing semantics needs compatibility evidence. |
| `@motionforge/core`                      | Scene builders, frame evaluation, layout, text helpers, and ephemeral display-list v1                  | Stable. Existing timing/layout defaults cannot change silently; display-list required fields and capabilities are versioned.                 |
| `@motionforge/inspection`                | Renderer-neutral tree, timeline, layout, hit testing, sampled checks, and geometry diagnostics         | Stable entry point added in MF3. Result objects may grow additively; geometry remains explicitly qualified as exact, declared, or estimated. |
| `@motionforge/layout`                    | Bounded semantic layout plans, intrinsic planning, diagnostics, and Scene v1 compilation               | Stable entry point added in MF7. Existing plan versions and compiler defaults are versioned; new optional fields are additive.               |
| `@motionforge/runtime`                   | Prepared Scene revisions, backend transactions, lifecycle events/errors, metrics, and artifact sinks   | Stable entry point added in MF5. Required backend/sink fields, revision/token semantics, phases, and error codes follow the 1.x policy.      |
| `@motionforge/extensions`                | Trusted extension definitions, manifests, registries, version/display resolution, and preflight        | Stable. Standard display v1 and exact opaque capability contracts are versioned; legacy renderer adapters remain supported for 1.x.          |
| `@motionforge/renderer-canvas2d`         | Display-list Canvas execution, browser media, pooled/cache policy, preflight, and disposal             | Stable. Compile/execute, pool/cache ownership, and legacy rendering remain compatible; decoded resource shapes are advanced.                 |
| `@motionforge/renderer-canvas2d/runtime` | Prepared-runtime Canvas2D backend, assembly, intrinsic metrics, and serialized legacy asset scope      | Stable entry point added in MF5. Backend capabilities and result metadata may grow additively; borrowed resources remain scope-bound.        |
| `@motionforge/export`                    | Frame/audio export orchestration, encoding, muxing, estimation, preflight, and streaming               | Stable. New optional controls and additive result metadata are permitted.                                                                    |
| `@motionforge/export/worker`             | Serializable worker request/event protocol and worker client/handler                                   | Stable names and required fields; event/result objects may gain additive fields.                                                             |
| `@motionforge/player`                    | Playback clock, Canvas preview, seeking, looping, and audio synchronization                            | Stable. New optional player hooks are additive.                                                                                              |
| `@motionforge/presets`                   | Pure motion, caption, overlay, media, timeline, and authoring compilers                                | Stable compiler names and outputs under the documented 1.x policy. New catalog entries are additive.                                         |
| `@motionforge/presets/catalog`           | Preset discovery metadata and patch examples                                                           | Stable entry point; catalog items may gain additive metadata.                                                                                |
| `@motionforge/presets/intents`           | Versioned JSON-facing layout-intent manifests and Scene v1 compatibility compilers                     | Stable entry point added in MF7. Existing manifest ids, schemas, result codes, and legacy compiler outputs follow the 1.x policy.            |
| `@motionforge/presets/macros`            | JSON-facing macro registry, manifests/guides, and expansion                                            | Stable macro names once published; new macros and optional parameters are additive.                                                          |
| `@motionforge/authoring`                 | Seconds-first TypeScript authoring helpers that compile to Scene data                                  | Stable. Helpers may gain optional parameters; emitted existing defaults remain compatible.                                                   |
| `@motionforge/agent-tools`               | Stateless adapters plus handle workflows, proof planning, browser evidence, sinks, and export tools    | Stable legacy and workflow tool names/required inputs. Contract versions and result fields follow the 1.x additive policy.                   |
| `@motionforge/cli` and `motionforge`     | CLI loading, validation, inspection, local Studio, and export facade                                   | Stable command names and successful exit semantics. New commands/options are additive.                                                       |
| `@motionforge/commands`                  | Typed non-recursive Scene commands, compilation, reversibility, manifests, and in-memory workspace     | Stable entry point added in MF4. Command kinds and required fields are versioned; result/history objects may grow additively.                |
| `create-motionforge` and its bin         | Starter generation                                                                                     | Stable command and generated-project contract; templates may advance with compatible package releases.                                       |

## Current deprecation baseline

No 1.0 public package entry point is deprecated at MF0.

Renderer/media resource shapes described as advanced are not individually
enumerated by MF0. They remain public when exported, but consumers should
prefer lifecycle functions over constructing or mutating decoded resource
values directly.

## Deprecation policy

1. A public API cannot disappear from a minor or patch release.
2. Deprecation requires an `@deprecated` declaration where TypeScript exposes
   the symbol, a changelog entry, replacement guidance, and a migration test.
3. A moved API keeps a compatibility re-export for the remainder of 1.x.
4. A public entry-point removal requires the next package major version.
5. A Scene field or semantic removal additionally requires a new Scene version
   and deterministic migration; a package-major bump alone is insufficient.
6. Deep `src/*` and `dist/*` imports have never been public and receive no
   compatibility guarantee.
7. Adding a public package or entry point requires updating the ownership table,
   the machine baseline, the accepted dependency policy, package tests, and the
   clean-install gate in the same milestone.

## Ownership change procedure

Moving implementation does not move public ownership automatically. The
milestone that introduces a replacement must:

1. record the new dependency direction in an accepted RFC;
2. add the new package/entry point to `public-api-baseline.json`;
3. keep the old import working through a compatibility re-export;
4. prove old and new imports produce equivalent behavior;
5. identify the earliest major version in which the old import may be removed.
