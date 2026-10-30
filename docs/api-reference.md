# Dojo Video Engine 1.1 public API map

This map is the human entry point for the synchronized 1.1 package set. Exact
export maps are machine-checked in
[`public-api-baseline.json`](public-api-baseline.json); ownership and
deprecation rules are in
[`public-api-ownership.md`](public-api-ownership.md).

## Documents and authoring

| Package                        | Primary APIs                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@dojo-video-engine/schema`          | `parseScene`, `validateScene`, `repairSceneInput`, `preflightScene`, `migrateScene`, `inspectScene`, `lintScene`, `applyScenePatch`, `sceneJsonSchema` |
| `@dojo-video-engine/schema/values`   | Portable color/paint/length/transform/filter/font grammars and serializers                                                                             |
| `@dojo-video-engine/authoring`       | `makeScene`, time helpers, asset helpers, caption/subtitle tracks, robust text boxes                                                                   |
| `@dojo-video-engine/layout`          | `row`, `column`, `grid`, `overlay`, `compileLayout`, text/media metrics and Layout Contract schema                                                     |
| `@dojo-video-engine/presets`         | Motion, caption, overlay, media look/layout, transition, and timeline compilers                                                                        |
| `@dojo-video-engine/presets/catalog` | Discoverable preset metadata                                                                                                                           |
| `@dojo-video-engine/presets/intents` | Stable place/text-role/media-look/clip-layout intent manifests and compilers                                                                           |
| `@dojo-video-engine/presets/macros`  | Macro manifests, discovery, and expansion                                                                                                              |

## Evaluation, editing, and inspection

| Package                    | Primary APIs                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `@dojo-video-engine/core`        | Builders, `evaluateScene`, legacy `layoutScene`, text/object-fit geometry, display-list v1 compiler                           |
| `@dojo-video-engine/inspection`  | Tree/timeline/layout inspection, hit testing, composition analysis, checks and diagnostics                                    |
| `@dojo-video-engine/commands`    | 19 strict Scene commands, command schema/manifests, compilation, inverse patches, revisioned workspace                        |
| `@dojo-video-engine/agent-tools` | Legacy stateless tools; opaque-handle workflow registry; proof selection/plans; Canvas evidence renderer; transactional sinks |

Use commands rather than whole-Scene replacement for iterative edits. Use
`createAgentWorkflowToolRegistry()` when a host needs
load → inspect/search → command → check → proof → repair. Only load accepts a
recursive Scene; trusted host snapshot/history access is deliberately outside
the model tool list.

## Runtime, rendering, and export

| Package                                  | Primary APIs                                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `@dojo-video-engine/runtime`                   | Prepared revision sessions, backend contract, events/errors, artifact writer/sink             |
| `@dojo-video-engine/renderer-canvas2d`         | Media resolution/preflight, display-list execution, `renderStill`, bounded surfaces/caches    |
| `@dojo-video-engine/renderer-canvas2d/runtime` | Prepared Canvas backend/session and compatibility borrowing                                   |
| `@dojo-video-engine/player`                    | Preview playback, seeking, audio synchronization, runtime-backed player                       |
| `@dojo-video-engine/export`                    | Capability/estimate/preflight, frame/audio pipelines, WebCodecs MP4, streams, verification    |
| `@dojo-video-engine/export/worker`             | Typed start/cancel/progress/result worker protocol and handler                                |
| `@dojo-video-engine/extensions`                | Trusted versioned extension definitions, manifests, registry, preflight, display capabilities |

Preview, main-thread export, worker export, runtime proof frames, and the legacy
facades converge on the same evaluated Scene/display-list/Canvas semantics.

## Interchange and developer tools

| Package                                          | Primary APIs                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `@dojo-video-engine/interchange`                       | Common timeline v1 import/export with loss reports; Remotion host descriptor; sanitized static HTML snapshot bridge |
| `@dojo-video-engine/cli` / `dojo-video-engine` bin           | validate, migrate, inspect, inspect-layout, check, lint, diff, capability, and print commands               |
| `@dojo-video-engine/create` / `create-dojo-video-engine` bin | Minimal external TypeScript starter generator                                                                       |

Interchange never executes React or HTML/JavaScript. Arbitrary Remotion
components and dynamic web pages remain trusted host programs; Dojo Video Engine
bridges only data or sanitized static snapshots.

## Stability rules

- Scene v1 remains the low-level render document for Dojo Video Engine 1.x.
- Existing defaults, timing, pixels/audio, command meanings, tool names, and
  required fields do not change silently.
- New optional fields, commands, diagnostics, manifests, and result evidence
  may be additive.
- Layout plans, display lists, runtime handles, prepared tokens, Canvas values,
  and artifact bytes are not Scene fields or durable interchange documents.
- Provider SDKs, databases, authorization, ASR/semantic media analysis, and
  SaaS state are host concerns.

See [`compatibility.md`](compatibility.md),
[`extension-abi.md`](extension-abi.md), and
[`migrations/1.0-to-1.1.md`](migrations/1.0-to-1.1.md) for the full contract.
