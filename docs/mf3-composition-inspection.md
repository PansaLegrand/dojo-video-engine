# MF3 composition inspection contract and evidence

Status: implemented  
Milestone: MF3 — spatial and temporal inspection

MF3 adds a renderer-neutral answer to a basic editing question: where is a
node at a particular frame, when is it active, and what geometry may overlap,
clip, or hide it? The implementation is the public
`@motionforge/inspection` package. It depends only on schema and core and does
not create a canvas, decode media, call a model, or import product code.

## Public surface

- `inspectTree(scene, options?)` flattens the canonical hierarchy with stable
  parent, depth, document order, source path, and local/absolute/ancestor-
  clipped half-open frame windows.
- `inspectTimeline(scene, options?)` adds absolute seconds and declared or
  measured media-source timing.
- `inspectLayout(scene, frame, options?)` returns active border, content,
  transformed, and effective clip bounds; transform matrices; paint/z order;
  text lines; media fit/crop; and diagnostics.
- `hitTest(scene, frame, point, options?)` returns topmost-first geometry hits
  with inverse-transformed local points and conservative-path labels.
- `analyzeComposition(scene, options?)` samples at most 100 explicit or
  generated frames and merges deterministic diagnostics.
- `checkScene(scene, options?)` always returns one JSON-safe, versioned
  validation/structural/lint/tree/timeline/composition envelope. Invalid
  Scenes are data, not an unparsable exception result.

The CLI exposes `motionforge inspect-layout <scene> --frame N` and
`motionforge check <scene> [--frames ... | --sample-count N]`. The agent tool
registry exposes the same bounded operations without replacing the existing
structural `motionforge.inspect` tool.

## Measurement and intent rules

Every reported measured rectangle or intrinsic metric is labeled:

- `exact` when supplied by deterministic engine geometry or a host metrics
  provider;
- `declared` when it comes from canonical asset metadata;
- `estimated` when inspection must use a portable text/media/path fallback.

Hosts can provide synchronous `TextMetricsProvider` and
`MediaMetricsProvider` implementations. Browser hosts may back them with
loaded fonts and decoded media; Node hosts can use known project metadata.
No asynchronous fetching or hidden resource ownership occurs in inspection.

Semantic roles are never guessed from node IDs or copy. Subtitle diagnostics
require explicit `semanticRoles`; safe-edge diagnostics additionally require
the host to list protected `safeAreaRoles`, so full-bleed media is not treated
as a defect merely because it has a role. Deliberate overlap is suppressed only
for explicit, unordered `allowedOverlaps` pairs.

## Geometry ownership

Core owns resolved content rectangles, affine-transform math, and
object-fit/object-position geometry. Canvas2D retains its public
`computeObjectFit()` function as a compatibility wrapper over the core
implementation. This prevents inspection and rendering from developing two
coordinate systems. Existing Canvas2D object-fit tests and pixel gates remain
the renderer evidence.

`LayoutBox.content` is populated by `layoutScene()` but remains optional in the
public TypeScript type so existing 1.x consumer fixtures that construct a
`LayoutBox` literal continue to compile. `getLayoutContentRect()` provides the
compatibility fallback.

## Diagnostic scope

The deterministic diagnostic set is:

- outside frame;
- zero-size bounds;
- configured unsafe-edge crossing for an explicit semantic role;
- geometric overlap without declared overlap intent;
- possible paint-order occlusion;
- explicit subtitle collision;
- excessive object-fit crop;
- flex content overflow.

Every diagnostic carries the primary node ID, related IDs, sampled frame and
seconds, measured bounds, canonical source path, severity, confidence label
and optional score, a reason, and a remediation class.

These are geometry claims, not pixel claims. In particular, possible
occlusion does not assert that opaque pixels cover content, and rotated bounds,
non-rectangular paths, rounded corners, soft, feathered, or inverted constraints
may be conservative and therefore lower diagnostic confidence. Fully transparent
ancestor/mask chains are excluded from default hits and overlap diagnostics.
Pixel artifacts,
effective contrast, decoded orientation/color, and visual saliency belong to
later runtime evidence tools.

## Verification

MF3 unit coverage includes nested timing/source paths, z/document order,
nested transforms and inverse hits, overflow/clip/mask behavior, explicit
semantic intent, exact/declared/estimated text and media metrics, bounded frame
sampling, deterministic JSON serialization, non-mutation, all diagnostic
payload fields, invalid check envelopes, CLI option/exit behavior, agent tool
schemas, and renderer object-fit parity.

The milestone exit gate is:

```text
canonical Scene
  -> renderer-neutral tree/timeline/layout inspection
  -> bounded deterministic diagnostics
  -> CLI and agent JSON envelopes
```

Full release and packed clean-install results are recorded in the roadmap
implementation log after the milestone commit.
