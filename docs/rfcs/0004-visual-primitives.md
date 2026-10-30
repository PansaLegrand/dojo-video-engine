# RFC 0004 — Serializable visual primitives

- Status: Accepted
- Date: 2026-08-24
- Target release: 0.7.0

## Summary

Dojo Video Engine adds a small vector vocabulary that composes into many design
families without adding a named core effect for each look. Geometry, clipping,
masking, paint, and compositing remain Scene v1 data and use the same timing,
layout, animation, preview, and export path as other nodes.

## Shape nodes

A `shape` node carries one geometry descriptor:

- `rect`, with an optional pixel/percentage radius;
- `ellipse`;
- `line`, with exactly two normalized points;
- `polyline` and `polygon`, with bounded normalized point arrays;
- `path`, with SVG path data and an explicit viewBox.

Point coordinates are relative to the laid-out node box: `(0, 0)` is its top
left and `(1, 1)` is its bottom right. Values outside that range are allowed in
a bounded `[-16, 16]` range for overshoot and off-box control points.

SVG path strings accept only path commands, numeric coordinates, separators,
and signs. URLs, CSS, JavaScript, event handlers, XML, and arbitrary SVG markup
are not part of the scene contract. The viewBox deterministically maps path
coordinates into the node box.

## Paint and strokes

Shape style adds `fill`, `stroke`, `strokeWidth`, `strokeLineCap`,
`strokeLineJoin`, and `strokeDash`. Closed shapes default to black fill; open
geometry defaults to a one-pixel black stroke. Explicit style is recommended.

Solid colors and the supported gradient subset are valid fill/stroke paints:

- existing linear gradients;
- circular radial gradients with an optional percentage center;
- conic gradients with an optional degree start angle and percentage center.

Unsupported gradient grammar is treated as an ordinary Canvas color value and
therefore paints nothing rather than being interpreted approximately. Agent
documentation lists the accepted forms.

## Clips and masks

Every visual node may carry closed `clip` geometry and an optional vector
`mask`. Clips intersect the current clip region before the node background,
content, border, and descendants draw. A mask is an opaque binary vector mask;
`inverted: true` keeps the node box outside the mask geometry.

Line and polyline geometry are rejected for clips/masks because open paths do
not define a stable inside. Grayscale/gradient alpha masks and feathering need
an isolated offscreen compositing pass and are intentionally deferred.

## Compositing

`style.blendMode` exposes a bounded Canvas compositing set including multiply,
screen, overlay, lighten/darken, difference, exclusion, HSL modes, and lighter.
The operation applies through the node's saved Canvas state, so its paint and
descendant draw calls blend deterministically with already-painted siblings.
This is per-draw Canvas compositing, not an isolated CSS stacking group.

## Layout additions

The same release adds:

- per-side margin and padding overrides;
- `aspectRatio` as a positive number or `width/height` string;
- per-corner border radii used consistently by backgrounds, media clipping,
  overflow clipping, borders, and rectangle shapes.

Shorthand values remain the fallback for unspecified sides/corners, preserving
existing scene pixels.

## Capability and runtime preflight

Inspection reports shape, SVG path, clip, mask, and blend usage. Canvas2D
preflight requires `Path2D` for vector geometry and `DOMMatrix` when a scene
maps SVG path viewBoxes. Missing APIs fail before rendering.

## Determinism and compatibility

1. Geometry is bounded data; no callbacks or raw SVG documents enter a scene.
2. Existing Scene v1 documents retain their previous layout and pixels because
   new fields are optional and shorthand fallback behavior is unchanged.
3. Legacy v0 remains frozen and rejects shape/clip/mask fields.
4. All primitives render through the shared Canvas2D preview/export path.
5. A combined exact-pixel golden covers geometry, path transforms, gradients,
   clipping, inverted masking, strokes, corner radii, and blend modes.

## Additional delivered primitives

- comma-separated box shadows render as independent staged shadow layers;
- `isolation: true` composites a node subtree once before applying its opacity
  and blend mode;
- vector masks support bounded opacity and feathering through deterministic
  offscreen alpha composition;
- `safeArea` insets constrain a node against any containing block;
- text nodes may use metric-stable inline runs for color, opacity, stroke, and
  fitted run backgrounds, plus explicit LTR/RTL direction.

## Deferred work

- bitmap/luminance masks and arbitrary grayscale mask sources;
- shadow spread/inset grammar;
- per-run font metrics (font family/weight/size) and vertical text shaping;
- path morphing and boolean path operations.

These should build on the primitive contract without changing stored geometry
semantics.
