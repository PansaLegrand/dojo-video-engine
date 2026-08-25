# RFC 0012 — Layout v2 authoring semantics

- Status: Accepted
- Date: 2026-08-26
- Target milestone: MF7
- Behavior change: None for existing Scene documents

## Decision

MotionForge adds a versioned, compile-time Layout Contract in the independent
`@motionforge/layout` package. Contract v1 is the first contract shipped by the
Layout v2 milestone. It is a flat, non-recursive plan referencing existing
direct Scene child IDs. It compiles completely to numeric absolute geometry on
an otherwise ordinary Scene v1.

Scene v1 remains the only canonical render and storage document. A layout plan
is authoring input like a command or macro: hosts may retain it as source or
history, but the engine never requires it to preview, render, export, migrate,
or inspect the compiled Scene. Existing `@motionforge/core` `layoutScene()` and
Scene-v1 flex/default semantics do not change.

Compilation is a target-size projection. Products that offer responsive
reauthoring must retain the original source Scene plus LayoutPlan(s) and
recompile them; the compiled Scene must not become the sole editable source,
because semantic sizing, tracks, and constraints are intentionally absent.
This host authoring source does not become a second engine render format.

## Why a package

Semantic solving is independently useful to TypeScript authors, function
tools, editors, presets, and future adapters. Putting it in core would mix a
new JSON authoring grammar and schema-generation dependency into the stable
per-frame evaluator. Putting it in presets would make generic geometry depend
on an opinionated visual catalog. The package therefore owns:

- Layout Contract schemas, draft-07 JSON Schema, validation, and constructors;
- deterministic stack/grid/overlay solving and bounded diagnostics;
- intrinsic text/media planning over core metric-provider interfaces;
- compilation to validated Scene v1 and measurement/provenance traces.

Core continues to own evaluation, legacy Scene-v1 layout, text/display-list
paint planning, and metric contracts. Schema owns Scene documents. Presets and
authoring may consume/re-export layout helpers later without moving ownership.

## Contract v1

One plan targets `$root` or one Scene node and lists every direct visual child
exactly once. Audio is not a layout item. Plan order controls flow and non-dense
grid placement; Scene source order remains paint order.

The primitives are:

- `stack` with `row` or `column` axis; `row()`/`column()` are sugar;
- main/cross gaps, wrap/no-wrap, alignment, and six distribution modes;
- fixed/percentage/`fill`/`hug` sizing, weighted grow/shrink, min/max, aspect
  ratio, and margins;
- non-dense grid auto-flow, fixed/hug/fill tracks, explicit cells, and spans;
- overlay with nine safe-area anchors and bounded `align`, `before`, `after`,
  and `match` constraints between siblings;
- explicit safe-area and padding insets resolved against the target box.

No general constraint algebra, CSS cascade, DOM, React execution, dense grid,
subgrid, floats, or arbitrary expression language is introduced.

## Solving and errors

Inputs are validated and detached. Text/media intrinsic measurements are
synchronous views over prepared resources and retain field provenance. Missing
media dimensions require either an error policy or explicit type fallback;
there is no silent 16:9 or square guess.

Stacks use stable source-order line packing, iterative bounded shrink, weighted
grow, then distribution. Wrapped stacks default cross-line distribution to
stretch; an explicit distribution that leaves fill-only lines at zero is an
error. Grids reserve explicit cells before stable non-dense auto placement,
require explicit rows for column auto-flow, and use fill-sized implicit rows.
They reject collisions, out-of-range spans, cyclic aspect/track sizing, and
items that escape their assigned cell. Overlay constraints use stable
topological order and reject unknown
targets, cycles, multiple writers, and unsatisfied bounded results.

Compiler-owned geometry becomes finite numeric Scene style. Layout-owned
animations are rejected because a static compile cannot truthfully reevaluate
them. Stable errors include a code, path, bounded JSON details, and message;
successful results include detached diagnostics, measurements, and usage stats.

## Text and writing systems

Layout-v2 intrinsic text planning is separate from the legacy Scene-v1 wrapper
so improvements cannot alter existing pixels. Explicit `ltr`/`rtl` wins; an
omitted direction is resolved by a bundled first-strong scan and host-dependent
`inherit` is rejected. Plain Latin, spaceless CJK, combining marks, supported
emoji/ZWJ/flag clusters, and RTL text are bounded by the same prepared provider
and budgets. The bundled segmenter is intentionally not complete UAX #29 for
modern Indic conjunct chains without explicit ZWJ or decomposed Hangul Jamo;
authors should prefer precomposed/shaped input there. Rich
independently-painted runs are not assumed to preserve kerning, Arabic shaping,
or ZWJ sequences; intrinsic rich fitting is rejected by default until a
shaped-run contract exists.

Deterministic text planning requires the first authored family that matches a
declared font asset plus a prepared metrics provider. The compiler writes that
exact single-family-safe asset id into Scene v1; spaces are allowed, while ids
whose comma/quote syntax cannot round-trip as one family are rejected. Hosts may explicitly allow
system fallback, but the result carries estimated font provenance and a
portability warning. Successful measurement evidence retains the detached text
plan and its source ranges, lines, fit status, direction, and ellipsis
ownership.

## Versioning and the future Scene boundary

Contract v1 may gain optional fields under normal package compatibility rules.
Changing an existing solve default or required field needs a new Layout
Contract version.

A future Scene v2 is required only if MotionForge decides to retain semantic
layout in the canonical render document and reevaluate it after target-size,
font/media-metric, or per-frame animation changes. That future decision needs a
Scene migration and renderer/runtime contract. MF7 does not reserve hidden
Scene fields or smuggle source plans into metadata.

## Compatibility gates

- compiling is non-mutating and returns a valid Scene v1;
- legacy scenes run through unchanged core layout/pixel baselines;
- the same source plan adapts to portrait, square, and landscape targets;
- Latin, CJK, emoji, and RTL fixtures stay bounded with explicit provenance;
- grids, wrapping, grow/shrink, safe areas, constraints, cycles, metrics
  fallbacks, animation conflicts, and every budget have deterministic tests;
- package contracts, packing, clean install, and the full existing release gate
  remain green.
