# MF6 display-list and Canvas backend contract

Date: 2026-08-26

MF6 inserts an explicit renderer-neutral paint contract between resolved layout
and Canvas execution. Scene v1 remains the only canonical video document;
display lists are defensive, frame-specific, ephemeral runtime artifacts.

The accepted design is recorded in [RFC 0011](rfcs/0011-display-list.md).

## Render path

The compatibility renderer now follows one path:

```text
Scene
  → evaluateScene(frame)
  → layoutScene(exact metrics)
  → compileDisplayList(layout)
  → executeCanvas2DDisplayList(list, prepared resources)
  → pixels
```

`compileCanvas2DDisplayList()` and `executeCanvas2DDisplayList()` expose the
last two steps for hosts and future backend conformance. `renderStill()` keeps
its 1.x signature and assembles them. Preview, player, main-thread export,
worker export, prepared runtime, and browser evidence continue to use the same
Canvas painters and audio mixer.

The list is a tree because Scene compositing is hierarchical. Every group has
a stable engine-owned ID, source node ID, defensive hierarchy-shallow resolved
node snapshot, layout/content bounds, local/world transform, transformed
bounds, explicit composite/clip/mask/isolation intent, and ordered background,
content, border, and z-sorted child phases. Children live only in the display
group tree, preventing quadratic nested snapshots.

Normalized content covers prepared text lines/runs, images/video/Lottie
references, fitted media geometry, shape geometry/paint, and semantic effect
operations. Canvas paints compiler-owned text layout rather than remeasuring
and rewrapping it on the execution target. Native decoded objects, Canvas
objects, callbacks, and extension resources never enter the list.

Compilation is deterministic, non-mutating, JSON-safe, and budgeted by node,
operation, hierarchy depth, text, opaque bytes, and JSON depth/value count.
Duplicate node IDs, non-finite values, sparse arrays, accessors, symbols,
non-enumerable properties, native objects, cycles/shared references, unknown
extension targets, and oversized payloads fail before execution.

## Extension decision

An extension makes one explicit choice:

- `standard` display-list v1 emits bounded node-local `rect`, `text`, and
  declared-image operations through an engine-owned builder; or
- `opaque` emits schema-validated bounded JSON for an exact capability,
  version, and main/worker realm.

Existing Canvas adapters remain supported for 1.x as explicit
`legacy-opaque` operations. They are not mislabeled as portable primitives.
Canvas preflight advertises the built-in legacy bridge and installed exact
opaque handlers from the same registry used for execution. A missing version,
wrong realm, absent handler, stale prepared frame, or undeclared image is an
error; operations are never silently skipped.

Cross-revision extension resource reuse is opt-in and limited to definitions
that explicitly promise immutable/concurrency-safe resolved state. Per-frame
mutable values belong in the value returned by `prepareFrame()`.

## Bounded Canvas surfaces

All temporary Canvas allocation—nested isolation, soft masks, pixelation, and
multi-shadow staging—uses `ScratchSurfacePool`. The pool has checked RGBA byte,
surface-count, and dimension ceilings; exact-dimension bucket reuse and idle
LRU eviction; no eviction of live leases; exact requested source rectangles;
and idempotent or poisoned release. Disposal drops references and shrinks every
retained backing store to 1×1.

Isolation bounds conservatively union transformed descendant ink, stroke,
border, text/background, filter, shadow, and mask-feather margins before
intersecting the composition. Built-in opaque effects and legacy/unknown
extension drawing fall back to full-composition bounds because tighter bounds
cannot be proved. An invalid/non-finite bound also falls back rather than
cropping pixels.

Prepared Canvas sessions own a persistent pool per revision unless the host
supplies one. Commit, rollback, preparation failure, artifact failure, and
final disposal release owned pools exactly once; host pools remain host-owned.
Runtime-backed player and export operations borrow the exact pool with the
prepared media revision. Pool objects are excluded from worker messages.

## Static and text caches

`Canvas2DStaticDisplayCache` raster-caches only subtrees that are both proven
static and already require offscreen isolation/soft-mask compositing. Ordinary
direct blend/filter semantics are never changed merely to make them cacheable.
Video, Lottie, effects, all extensions, animations, and any dynamic descendant
bypass raster caching.

Cache fingerprints include a canonical deep signature, bounded lookup digest,
integer raster bounds, and prepared image/font content identity. Digest
collisions cannot become hits. The cache is byte/entry/key bounded, LRU,
disposes evicted canvases, rejects oversized entries without retaining them,
and is revision/session owned under the same rules as scratch storage.

The structural `TextMeasureCache = Map<string, number>` input remains 1.x
compatible. Dojo Video Engine's player/export/runtime use a separate bounded LRU
implementation whose keys include font, direction, letter spacing, and text;
oversized keys bypass retention.

## Conformance and limits

- Canvas remains the only required MF6 backend. A second renderer is not an
  exit dependency.
- A future backend must consume display-list v1, reject missing capabilities,
  keep prepared native resources outside JSON, and pass the shared structural
  and browser evidence suite.
- Semantic effect operations and legacy opaque extensions may migrate to
  standard operations later without changing Scene data.
- Display lists are not a save format, interchange timeline, migration target,
  or substitute for Scene commands/workspaces.
- Raster caching is an optimization. Disabling it must preserve identical
  pixels and audio.

## Verification commands

```sh
pnpm --filter @dojo-video-engine/core test
pnpm --filter @dojo-video-engine/extensions test
pnpm --filter @dojo-video-engine/renderer-canvas2d test
pnpm golden:test
pnpm performance:gate
pnpm release:full
pnpm verify:clean
```

Final evidence on 2026-08-26:

- 962 workspace unit tests passed, including 75 core, 15 extension, 223
  Canvas/runtime, 29 player, and 53 export tests;
- the reusable pinned-Chromium conformance runner passed all nine DisplayList
  v1 fixtures, with exact RGBA for every pixel-capable case and exact
  standard/opaque/legacy capability decisions;
- all established pixel, video, audio, export, runtime, and tool goldens stayed
  unchanged; Chromium, Firefox, WebKit, and all 10 playground E2E checks
  passed;
- the existing 720p encode/decode gate peaked at 6.15 ms/frame and 29 MiB JS
  heap;
- cache-hit compositing measured 1.85 ms/frame at 1080p and 1.72 ms/frame at
  4K. Static cache residency was 14.44 MiB and 57.66 MiB; exact-bucket scratch
  peaks were 63.86 MiB and 258.83 MiB. Fresh and replenished cache-disabled
  oracles matched cached RGBA byte-for-byte, with zero cache adoption failures,
  scratch failures, or evictions;
- 750 generated Scenes / 2,250 evaluated frames, 28 corpus Scenes, and seven
  long-resource checks passed;
- all 14 public packages passed dry-run packing. The packed clean-install
  starter imported/executed both runtime entry points and passed validate,
  migrate, inspect, lint, and build.
