# MF7 — Layout v2 authoring semantics

Status: complete
Contract: Layout Contract v1
Canonical render target: Scene v1
Decision: [RFC 0012](rfcs/0012-layout-v2-authoring.md)

## Decision and layer boundary

MF7 adds `@dojo-video-engine/layout`, a bounded semantic authoring compiler for
responsive video composition. The milestone is called Layout v2 because it is
the second authoring model; the first shipped data contract is explicitly
`layoutVersion: 1` and has its own compatibility lifecycle.

The compiler does not change `@dojo-video-engine/core`'s existing Scene-v1 layout
semantics and does not add fields to Scene v1:

```text
source Scene v1 + LayoutPlan v1 + target size + prepared metrics
                              │
                              ▼
                        compileLayout()
                              │
                              ▼
       target-specific Scene v1 projection with numeric geometry/text
                              │
                              ▼
              evaluate → layoutScene → display list → render
```

Scene v1 remains the only engine render/storage document. Products that want
later responsive reauthoring must retain the original source Scene plus its
LayoutPlan(s) and recompile them for a new target. A compiled projection must
not be the sole editable source: `hug`, `fill`, tracks, anchors, and constraints
have deliberately compiled away.

## Flat public contract

A plan targets `$root` or one existing container and references its direct
visual children by id. It is flat and non-recursive so a function tool does not
need to emit another Scene tree:

```ts
import { compileLayout, grid, item } from "@dojo-video-engine/layout";

const plan = grid({
  containerId: "cards",
  columns: [{ size: "fill" }, { size: "fill" }],
  gap: "3%",
  items: [
    item("card-a", { width: "fill", height: "fill" }),
    item("card-b", { width: "fill", height: "fill" }),
  ],
});

const result = compileLayout(sourceScene, plan, {
  textMetrics,
  mediaMetrics,
  missingMediaMetrics: { mode: "error" },
  fontFallbackPolicy: "require-prepared",
});
```

Every direct visual child must be listed exactly once. Audio children are not
layout items and remain untouched. Plan order drives stack flow and non-dense
grid auto-placement; it never changes Scene source/paint order.

The draft-07 value from `layoutPlanJsonSchema()` contains the generated
structural shape plus layout-kind conditions. Draft-07 cannot express unique
object-property values, so tool hosts must still call `validateLayoutPlan()`;
that boundary supplies semantic issue codes such as `duplicate_item` and
`field_not_consumed`.

## Public APIs

`@dojo-video-engine/layout` exports:

- `layoutPlanSchema`, `layoutPlanJsonSchema()`, and `validateLayoutPlan()`;
- `compileLayout()` and nonthrowing `tryCompileLayout()`;
- `LayoutCompileError`, structured diagnostics, measurements, stats, policies,
  and budget types;
- ergonomic `item()`, `stack()`, `row()`, `column()`, `grid()`, and `overlay()`
  constructors;
- the deterministic text planner/projection types and helpers, including
  `measureLayoutText()` and `projectLayoutTextToSceneV1()`.

`compileLayout()` is pure and returns a detached valid Scene, normalized plan,
resolved target box, per-item measurements, diagnostics, and usage stats. A
planned text measurement retains source cluster ranges, line/ellipsis
ownership, fit status, resolved direction, field provenance, and selected font
evidence so an editor or agent can explain the projection.

## Semantic vocabulary

### Stack, row, and column

`stack` is the canonical one-dimensional primitive; `row()` and `column()` are
axis-specific sugar. It supports:

- main/cross gaps and independent row/column gaps;
- stable source-order wrapping;
- start/center/end, stretch, space-between, space-around, and space-evenly;
- weighted grow/shrink with iterative min/max water-filling;
- fixed pixels, percentages, `hug`, `fill`, margins, and hard aspect ratios.

Wrapped stacks default cross-line distribution to `stretch`. An explicit
distribution that leaves a fill-only line with zero cross size is rejected.

### Grid

Grid supports fixed/percentage/hug/fill tracks, gaps, explicit zero-based
cells, row/column spans, and row/column non-dense auto-flow. Explicit cells
reserve complete spans before auto-placement. Implicit rows are fill tracks;
column auto-flow requires explicit rows so changing a guard budget cannot
change geometry. Stretch affects `fill` and omitted/auto item sizes, never an
explicit fixed size.

Track min/max conflicts, collisions, out-of-range spans, unresolved cyclic
aspect/track sizing, and any item escaping its assigned cell are errors. Dense
packing, subgrid, and CSS track expressions are deliberately absent.

### Overlay and sibling constraints

Overlay provides nine anchors inside optional safe-area/padding insets. Items
may add signed offsets and bounded sibling constraints:

- `align` one axis at start, center, or end;
- `before` / `after` on x or y with a gap;
- `match` width or height.

Constraints form a stable topologically sorted DAG. Unknown targets, cycles,
multiple writers, min/max-blocked equality, aspect conflicts, and constrained
out-of-bounds results fail instead of being approximated.

## Intrinsic media, text, and font policy

Core's synchronous prepared `MediaMetricsProvider` and `TextMetricsProvider`
remain the shared boundary. Provider inputs are defensive; results record
field-level `exact`, `declared`, or `estimated` provenance.

Media geometry with both axes determined by fixed/fill values or an explicit
aspect ratio does not request intrinsic metadata. When intrinsic dimensions
are required, the default is an actionable error. A host may instead provide
explicit type-specific image/video/Lottie fallback dimensions; no hidden
square or 16:9 guess exists.

Every plain text item receives a final plan against its resolved width and
height, including fixed/fill boxes. The planner uses bundled cluster,
first-strong direction, wrapping, punctuation, shrink, truncation, and
ellipsis rules rather than host `Intl`. Projection writes explicit lines,
direction, physical alignment, font size, and px line height into Scene v1 and
removes fields that would make Scene v1 refit it differently. Latin, CJK,
combining marks, emoji/ZWJ, and RTL are covered.

The segmenter covers combining marks, emoji modifiers/ZWJ, flags, and CRLF,
but is not advertised as complete UAX #29: modern Indic conjunct chains
without explicit ZWJ and decomposed Hangul Jamo should use precomposed/shaped
input.

The default font policy is `require-prepared`: the first authored family that
matches a declared font asset is selected, a prepared metrics provider is
required, and the exact asset id is compiled into `fontFamily`. That id must
round-trip as one unambiguous family; spaces work, comma/quote escapes do not.
`allow-system` is explicit, emits a warning, and degrades font/overall evidence
to estimated. Rich runs require the explicit `legacy-unsafe` policy and remain
marked non-exact because Scene v1 independent run painting cannot promise full
kerning/Arabic/ZWJ shaping parity.

## Determinism, errors, and budgets

All successful output is verified as a finite, plain, non-shared JSON tree.
Generated coordinates are quantized safely; huge provider metrics and
non-finite values fail before serialization. Layout-owned geometry/text
animations are rejected because this compiler produces one target/frame
snapshot rather than a retained runtime constraint graph.

Default host-tightenable compiler budgets are:

| Budget               | Default    |
| -------------------- | ---------- |
| items                | 1,024      |
| tracks               | 128        |
| sibling constraints  | 4,096      |
| text code units      | 1,000,000  |
| solver steps         | 100,000    |
| coordinate magnitude | 10,000,000 |

The structural schema also caps one plan at 4,096 items, 64 declared tracks
per axis, eight constraints per item, and grid indices at 4,095. Unknown budget
keys are rejected. `tryCompileLayout()` converts expected failures to stable
codes/paths/details; provider or legacy container-layout failures never leak as
unstructured exceptions.

## Intent compiler interoperability

`@dojo-video-engine/presets/intents` is the discovery layer for established
single-node authoring sugar. Its stable manifest ids cover:

- `place` and `safe-area/box`;
- `text-role/display|title|subtitle|body|caption|label`;
- every `media-look/*` and `clip-layout/*` preset.

Use `layoutCompilerManifests()` and `getLayoutCompilerManifest()` for detached
JSON-safe discovery, then `compileLayoutIntent()` for a nonthrowing compilation
to a Scene-v1 style or wrapper. These intents preserve existing preset output
and complement `@dojo-video-engine/layout`: intents style/place one node, while a
LayoutPlan solves relationships among all direct siblings.

## Compatibility and non-goals

- Existing Scene v1 documents never enter this compiler implicitly; legacy
  `layoutScene()` and existing pixels remain unchanged.
- Output is ordinary Scene v1 consumed by inspection, runtime, Canvas, player,
  export, workers, commands, and agent tools without a renderer branch.
- There is no DOM/CSS/React execution, arbitrary equation solver, dense grid,
  general CSS cascade, second renderer, or JSX requirement.
- A future Scene v2 is required only if semantic constraints must live in the
  canonical render document and reevaluate for per-frame animation, late
  metrics, or target-size changes. MF7 reserves no hidden Scene fields.

## Verification evidence

Focused evidence recorded before the final release gate:

| Command                                             | Evidence                    |
| --------------------------------------------------- | --------------------------- |
| `pnpm --filter @dojo-video-engine/layout test`            | 59 tests passed             |
| `pnpm --filter @dojo-video-engine/presets test`           | 191 tests passed            |
| `pnpm --filter @dojo-video-engine/schema test`            | 102 tests passed            |
| `pnpm --filter @dojo-video-engine/core test`              | 75 tests passed             |
| `pnpm --filter @dojo-video-engine/renderer-canvas2d test` | 223 tests passed            |
| `pnpm check:contracts`                              | 15 public packages verified |
| `npm pack --dry-run` in `packages/layout`           | 23 files; 68.8 kB tarball   |

The layout suite includes all compiler budgets, nonmutation, strict JSON,
provider failures, portrait/square/landscape, nested stack→grid, legacy box
parity, grid/constraint adversarial cases, media fallbacks, and deterministic
Latin/CJK/emoji/RTL projection. The pinned browser golden gate additionally
checks semantic compilation and legacy Scene-v1 isolation; its target matrix,
paint assertions, and byte-exact oracle are recorded in the
[MF7 browser evidence note](mf7-layout-browser-evidence.md).

Final evidence on 2026-08-26:

- `pnpm release:full` passed 1,037 workspace unit tests, 750 generated Scenes /
  2,250 evaluated frames, the 28-Scene corpus, all seven resource checks, the
  complete pinned-Chromium pixel/media/audio/export/runtime/tool/layout suite,
  Chromium/Firefox/WebKit probes, all 10 playground E2E checks, CLI/starter
  smoke, and dry-run packing for all 15 public packages;
- Layout v2's browser matrix passed portrait, square, and landscape with ten
  bounded boxes and five planned multilingual text tracks per target. The
  legacy Scene-v1 oracle remained source-JSON and RGBA byte-exact;
- the 720p encode/decode gate peaked at 5.97 ms/frame and 31 MiB JS heap.
  Cache-hit compositing measured 2.01 ms/frame at 1080p and 1.72 ms/frame at
  4K, with the established cache-disabled exact-pixel oracles still passing;
- `pnpm verify:clean` packed every public package, installed the generated
  starter outside the monorepo, imported the packed runtime entry points, and
  passed validate/migrate/inspect/lint/build.
