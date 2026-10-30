# RFC 0011 — Ephemeral display list v1

- Status: Accepted for MF6 implementation
- Date: 2026-08-26
- Target milestone: MF6
- Canonical document change: None

## Decision

`Scene` v1 remains Dojo Video Engine's only canonical, persistable render document.
After frame evaluation and layout, `compileDisplayList()` creates a defensive,
JSON-safe `dojo-video-engine.display-list` v1 artifact for that frame. The artifact is
ephemeral paint intent: it can be cached inside a prepared runtime, inspected,
or consumed by a renderer, but it is not a storage or migration format.

The display list is a tree rather than a flat primitive array. Scene v1
compositing depends on balanced inherited state: ancestor transforms, opacity,
blend mode, filters, clips, and overflow affect descendants, while backgrounds,
own content, borders, and child groups have a fixed order. A tree represents
those semantics without implicit save/restore instructions that could become
unbalanced.

## Public contract

`@dojo-video-engine/core` owns the neutral types and compiler:

```ts
const list = compileDisplayList(layoutScene(evaluateScene(scene, frame)), {
  textMetrics,
  mediaMetrics,
  extensionCompilations,
  budgets,
});
```

Each `DisplayGroup` carries:

- a deterministic engine ID plus the source node ID and stable paint order;
- a defensive resolved-node snapshot and LayoutBox-equivalent box/content tree;
- local and accumulated affine transforms and transformed bounds;
- explicit opacity, blend, filter, isolation, clip, overflow, and mask intent;
- ordered background, own-content, border, and z-sorted child phases.

Standard content operations cover text with prepared lines/runs, referenced
image/video/Lottie media, serializable shapes, and normalized paint. Built-in
procedural effects remain a versioned semantic operation for MF6 instead of
being dishonestly described as a few primitive draws.

## Extensions and capabilities

An existing extension with only its Canvas2D draw adapter compiles to an
explicit `legacy-opaque` operation and requires
`dojo-video-engine.legacy.renderer-adapter@1.0.0`. A host extension bridge may instead
supply:

- a versioned standard-operation payload; or
- a versioned opaque payload with an explicit backend capability.

Opaque values are JSON-only and byte/depth/node bounded. Native resources and
callbacks never enter the list. Backends must reject missing capabilities at
preflight; they must not silently skip an operation.

The built-in effect operation follows the same honesty rule. Individual effects
may migrate to standard operations later without changing Scene data.

## Determinism and safety

Compilation:

- rejects duplicate node IDs and LayoutBox/node identity mismatches;
- uses stable z-index ordering with document-order ties;
- assigns IDs from node IDs and semantic roles, not traversal counters;
- canonicalizes JSON object keys and rejects cycles, native objects,
  non-finite numbers, functions, and other non-JSON values;
- never mutates or retains input layout/node/payload objects;
- enforces independent node, operation, depth, text, opaque-byte, and JSON-tree
  budgets.

Text and intrinsic media measurements use the shared MF5 provider contracts.
Measurement provenance is retained where it affects emitted text/media intent.

## Canvas migration seam

The Canvas2D renderer keeps resource resolution and frame preparation. Its
compatibility `renderStill()` facade becomes:

```text
evaluate -> layout with Canvas metrics -> compile display list -> Canvas execute
```

The executor receives prepared resources separately; the display list contains
only stable resource references. Existing procedural-effect and legacy-extension
painters are invoked only from their explicit capability operations.

Canvas modularization must preserve the current phase order and inherited state.
It may use box-bounded scratch surfaces only when conservative bounds are known.
Legacy Canvas extensions can draw outside their node box, so their safe fallback
is the full composition unless the extension declares tighter bounds.

## Non-goals

- no Scene schema change or second canonical IR;
- no second renderer in MF6;
- no promise that every effect or legacy extension is a primitive operation;
- no native Canvas, DOM, decoded-media, or font objects in the display list;
- no raster caching that changes non-isolated blend/filter semantics.

Pixel conformance is established by running the existing Canvas path and the
display-list Canvas path against the same browser golden corpus before the old
internal path is removed.
