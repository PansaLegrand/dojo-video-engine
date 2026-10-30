> Historical record. The editor, UI demos, and model-agent examples have been retired from this engine repository. Current application development: [Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).

# Text Overlay Robustness Roadmap

**Status:** implementation started 2026-06-18

Dojo Video Engine already has a real text stack: schema-backed text styles, renderer-aligned measurement, grapheme-aware wrapping, CJK/emoji tests, auto-height text boxes, subtitle templates, and text overlay presets. The next goal is production robustness: normal long user text should remain readable, bounded, and predictable without every app inventing local fixes.

This theme targets the base layer first. Chat, Playground, and Studio should benefit by consuming the same scene/style semantics and authoring helpers.

## Product Rule

Text robustness must stay data-first:

- text behavior is represented in scene style data, not hidden app state
- layout and rendering use the same line-breaking and measurement rules
- unsupported behavior fails validation or falls back visibly, not silently
- presets remain ordinary scene nodes/styles that apps and agents can patch
- examples cover worst-case text, not only short marketing copy

## Current Baseline

Already shipped:

- text wrapping with explicit newline preservation
- grapheme-aware breaking for long spaceless runs
- CJK and emoji wrapping tests
- auto-height text boxes based on measured wrapped lines
- text stroke, shadow, fitted text backgrounds, and line backgrounds
- text overlay templates for title cards, lower thirds, quotes, stats, banners, hooks, and chapters

Known gaps:

- no `maxLines` or ellipsis/truncation semantics
- no shrink-to-fit behavior for bounded text boxes
- no explicit fit policy (`wrap`, `shrink`, `truncate`) in scene data
- no authoring-level `textBox()` convenience for safe, bounded text
- no safe-area presets for common overlay placements
- limited golden/example coverage for very long text overlays

## Slice TX1 - Bounded Lines And Ellipsis ✅

**Goal:** long text can be clamped predictably without overflowing normal overlay boxes.

Targets:

- `packages/schema`
- `packages/core`
- `packages/renderer-canvas2d`
- docs/tests

Done:

- text style supports `maxLines`
- text style supports `textOverflow: "clip" | "ellipsis"`
- layout intrinsic height respects `maxLines`
- renderer draws no more than `maxLines`
- ellipsis is measured and appended to the final visible line when possible
- unit tests cover Latin, long words, CJK, and tiny boxes

## Slice TX2 - Shrink-To-Fit Text ✅

**Goal:** bounded titles and callouts can reduce font size until they fit their width/height constraints.

Targets:

- `packages/schema`
- `packages/core`
- `packages/renderer-canvas2d`

Done:

- text style supports `textFit: "wrap" | "shrink" | "truncate"`
- shrink mode respects `minFontSize`
- layout and renderer agree on the resolved font size
- tests cover width-only, height-constrained, and impossible-fit cases

## Slice TX3 - Authoring Text Box Helper ✅

**Goal:** programmers can create robust text overlays without memorizing low-level style keys.

Targets:

- `packages/authoring`
- docs/guides

Done:

- `textBox()` or equivalent helper emits bounded text nodes with robust defaults
- helper exposes fit, maxLines, minFontSize, placement, and safe-area options
- generated nodes validate through `@dojo-video-engine/schema`
- docs show common title, lower-third, subtitle, and stat-callout cases

## Slice TX4 - Safe-Area Placement Primitives ✅

**Goal:** overlay placement can avoid edges and platform UI without hand-coded pixel math.

Targets:

- `packages/authoring`
- `@dojo-video-engine/presets`

Done:

- named safe areas exist for vertical, square, and landscape compositions
- text overlay presets can opt into safe-area anchors
- tests cover 9:16, 1:1, and 16:9 scene dimensions

## Slice TX5 - Robust Preset Upgrade ✅

**Goal:** existing text overlay presets use the new fit semantics where they are most likely to receive user-generated long copy.

Targets:

- `@dojo-video-engine/presets`
- preset gallery/showcase docs

Done:

- title, quote, stat, banner, hook, and lower-third templates have bounded text behavior
- preset patch examples remain valid
- generated preset gallery scenes still validate and render

## Slice TX6 - Golden Stress Gallery ✅

**Goal:** text regressions become visible before they reach apps.

Targets:

- examples
- golden harness
- docs assets

Done:

- generated text stress scenes cover long Latin, URLs, CJK, emoji, long single words, and multiline captions
- generated JSON is committed for the core stress cases and can be rendered through the golden example harness
- docs explain how to refresh the gallery

## Acceptance Criteria

- A programmer can put unknown user text into a bounded overlay and get predictable output.
- Chat can request text overlays without app-specific fallback sizing logic.
- Studio and Playground can preview the same robust behavior from scene data.
- Long text examples are part of automated verification, not manual hope.
