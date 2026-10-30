# RFC 0010 — Portable Scene v1 value grammar

- Status: Accepted
- Date: 2026-08-25
- Target milestone: MF1
- Behavior change: Reject schema-valid values that had no portable renderer
  semantics; preserve previously visible standard Canvas color forms

## Decision

Scene v1 visual strings are a bounded, renderer-owned language rather than an
open-ended CSS escape hatch. A value is canonical only when Dojo Video Engine can
parse it into typed data, serialize it deterministically, evaluate it for an
animation target, and give it the same paint meaning in preview and export.

The public grammar and parsers live at `@dojo-video-engine/schema/values`. Scene
validation, animation validation, the evaluator, Canvas2D renderer, builders,
patches, and authoring helpers consume that one implementation. Hosts must not
pre-validate against a different CSS parser.

## Lengths

Portable lengths are finite numbers or finite numeric strings with an optional
`px` or `%` suffix. A bare string number has pixel semantics. Layout properties
that require a nonnegative or positive value add that field-specific bound.
Viewport units, font-relative units, `calc()`, variables, and expressions are
not Scene v1 values.

## Colors

Portable colors are:

- the CSS named-color table, including `transparent`;
- `#rgb`, `#rgba`, `#rrggbb`, and `#rrggbbaa` hexadecimal forms;
- legacy comma-separated `rgb()`/`rgba()` and `hsl()`/`hsla()` forms;
- modern space-separated RGB/HSL forms with an optional `/` alpha channel;
- numeric or percentage RGB channels, percentage HSL saturation/lightness,
  hue angles in degrees, radians, gradians, or turns, and numeric/percentage
  alpha.

Parsers normalize functional HSL into sRGB channel data. Serialization emits a
deterministic sRGB spelling. CSS Color 4 wide-gamut forms—including
`color(display-p3 ...)`, `lab()`, `lch()`, `oklab()`, and `oklch()`—are
intentionally rejected in Scene v1. Supporting them requires a color-space,
clamping, interpolation, browser-capability, export, and golden-image RFC; a
host must convert them to canonical sRGB before ingestion.

## Paint and gradients

Paint is a portable color or one of:

- `linear-gradient([<deg>|to <side>,] <stops>)`;
- `radial-gradient([circle at <x%> <y%>,] <stops>)`;
- `conic-gradient([from <deg>] [at <x%> <y%>], <stops>)`.

Each gradient has at least two and at most 64 color stops. Stop positions are
percentages or the zero-length spelling `0px`; nonzero pixel stops are rejected
because their resolution depends on gradient geometry and must never be
silently discarded. Omitted stops are distributed deterministically and final
offsets are monotonically clamped to the Canvas range.

Conic gradients carry an explicit Canvas2D capability requirement. A renderer
without `createConicGradient()` fails preflight rather than accepting a value
that will fail during paint.

## Transforms and origins

Scene v1 transforms are `none` or an ordered list of:

- `translate(<px-or-%>[, <px-or-%>])`;
- `scale(<number>[, <number>])`;
- `rotate(<number>[deg])`.

Transform origins contain one horizontal component
(`left | center | right | <px-or-%>`) and an optional vertical component
(`top | center | bottom | <px-or-%>`). The omitted vertical component is
`center`. Matrix, 3D, skew, perspective, and arbitrary CSS transforms are not
part of Scene v1.

Media `objectPosition` accepts one or two pixel/percentage or
`left`/`center`/`right`/`top`/`bottom` components. Horizontal-first and
vertical-keyword-first spellings normalize to explicit x/y components; invalid
tokens are rejected rather than falling back invisibly to center.

## Filters

Filters are `none` or an ordered chain of `brightness`, `contrast`, `saturate`,
`grayscale`, `sepia`, `invert`, `opacity`, `hue-rotate(<deg>)`, and
`blur(<nonnegative-px>)`. The first seven accept a nonnegative number or
percentage. A scene using a non-`none` filter carries an explicit Canvas2D
`context.filter` capability requirement; unsupported environments fail
preflight.

## Borders, shadows, and text stroke

- Borders contain one nonnegative pixel width, an optional `solid` keyword,
  and one portable color. Other border styles are rejected.
- Shadows contain signed pixel x/y offsets, an optional nonnegative pixel blur,
  and a portable color. Box shadows may be a bounded comma-separated list;
  text shadows contain exactly one shadow. Spread and `inset` are rejected.
- Text stroke contains one positive pixel/percentage width followed by one
  portable color.

Unitless shadow lengths retain their historical pixel meaning. Every accepted
shadow is parsed through the same shared parser used by the renderer.

## Typography descriptors

Font families are bounded comma-separated Canvas family lists using quoted or
portable Unicode identifier names. Empty entries, control characters, and CSS
declaration syntax are rejected. Font weight accepts the CSS keywords
`normal`, `bold`, `bolder`, and `lighter`, or finite numeric/numeric-string
weights from 1 through 1000. Invalid descriptors fail before Canvas assignment
so a rejected font can never retain order-dependent stale context state.

## Easing and animation targets

Easing accepts `linear`, `easeIn`, `easeOut`, `easeInOut`, bounded
`cubic-bezier(...)`, and `spring`/`spring(<bounce>)`. Numeric-compatible values
interpolate; compatible colors, transforms, and filters use their typed
interpolators; other valid scalar strings step at the keyframe boundary.

Animation targets are a closed list of Scene scalar style fields plus the
supported mask fields. Each keyframe value must validate against its target's
field schema. Structured values such as `safeArea` and `strokeDash`, and the
boolean `isolation` field, are not representable by the Scene v1 keyframe value
union and therefore are not animation targets.

## JSON Schema vocabulary

The generated JSON Schema carries the same target list and portable-value
constraints. Where draft-07 cannot express parser semantics compactly,
Dojo Video Engine publishes named `dojo-video-engine-*` string formats and a registry of
format predicates. A conforming validator registers that vocabulary before
compiling `scene.schema.json`; unknown formats must not be ignored. A shared
valid/invalid corpus runs through both Zod and the configured JSON-Schema
validator.

## Capability and failure policy

Canonical validity is independent of a host's resource budget. Separately,
`preflightScene()` bounds document complexity, and renderer preflight reports
required browser features before resource resolution or frame rendering.
Missing capabilities are errors with actionable issue codes, never silent
fallbacks. This includes filter, conic-gradient, and nonzero text
`letterSpacing` support. Hosts may choose a different conforming backend after
preflight. Host policies may tighten but never raise the absolute iterative
parser-safety ceilings applied before recursive canonical validation.

## Compatibility and migration

Dojo Video Engine 1.0 described several style fields as arbitrary Canvas/CSS strings,
but values outside the implemented portable subset could be ignored, depend on
browser parsing, retain stale Canvas state, or fail only during export. That
acceptance is classified as a Scene v1 validation defect because it never had
stable cross-path semantics.

MF1 preserves common values that were visibly effective—standard named/hex,
legacy and modern RGB, and legacy and modern HSL colors—and rejects ambiguous
values explicitly. `repairSceneInput()` records removed unknown keys and
returns exact invalid-value paths; it never guesses a replacement visual.
Before enabling MF1 in a persisted downstream product, the host must audit all
stored scenes, report every rejected value, convert it deliberately, and prove
zero silent data loss. If that audit finds a widely used value with stable
preview/export behavior, it must be added to this grammar with parser,
serializer, evaluator, renderer, JSON-Schema, and golden coverage before sync.

## Alternatives rejected

### Accept every browser CSS string

Rejected because acceptance and pixels would depend on browser version,
Canvas implementation, worker context, and export environment, and invalid
assignments can preserve hidden prior Canvas state.

### Store parsed visual objects in Scene v1

Rejected as a breaking document change. Parsers expose typed objects
ephemerally; a future Scene version may choose structured values with an
explicit migration.

### Add Display-P3 now

Rejected until color management is defined end to end. Accepting the spelling
without defining conversion and export metadata would be an accepted no-op or
cross-browser pixel divergence.
