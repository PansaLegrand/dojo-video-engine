> Historical record. The editor, UI demos, and model-agent examples have been retired from this engine repository. Current application development: [Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).

# Subtitle Overlay Roadmap

**Status:** implementation started 2026-06-18

Dojo Video Engine already ships subtitle primitives: word-timed TikTok captions, karaoke captions, `styledCaptions()`, a subtitle template catalog, text stroke/background rendering, robust text fit semantics, and safe-area placement helpers. The next goal is production subtitle overlays: programmers and agents should be able to import real subtitle text, produce readable timed caption tracks, and preview stress cases without hand-authoring every node.

This theme stays base-layer first. Chat, Studio, and Playground should consume the same subtitle scene data and helper APIs rather than carrying app-specific subtitle logic.

## Product Rule

Subtitle overlays must stay data-first:

- subtitle timing is represented as ordinary scene `from`/`duration` windows
- subtitle text remains ordinary text nodes with robust style keys
- SRT/VTT parsing is pure and deterministic
- templates compile to scene nodes, not renderer-only behavior
- word-timed and segment-timed workflows share compatible style semantics
- examples include long and multilingual captions, not only short demo lines

## Current Baseline

Already shipped:

- `tiktokCaptions()` for one-word-at-a-time ASR captions
- `karaokeCaptions()` for active-word full-line captions
- `styledCaptions()` and `styledSubtitles()` with named subtitle templates
- subtitle template gallery under `examples/generated/presets`
- robust text style keys: `maxLines`, `textOverflow`, `textFit`, `minFontSize`
- shared safe-area primitives for vertical, square, and landscape scenes

Known gaps:

- no segment-level `subtitleTrack()` for SRT/VTT-style subtitles
- no SRT parser
- no WebVTT parser
- no authoring guide path for pasted transcript/subtitle files
- word-timed caption templates do not yet expose a clean segment-timed API
- no subtitle-specific stress gallery for long, multilingual, multiline subtitle tracks

## Slice SX1 - Segment Subtitle Track ✅

**Goal:** programmers can create production-safe subtitles from sentence/line segments, without ASR word timing.

Targets:

- `@dojo-video-engine/presets`
- docs/tests

Done:

- `SubtitleSegment` data shape exists
- `subtitleTrack()` emits a schema-valid timed container from segments
- default placement uses safe-area bottom subtitles for portrait, square, and landscape
- track exposes template/style/fit/maxLines/minFontSize options
- tests cover timing, safe-area placement, long text behavior, and validation

## Slice SX2 - SRT And VTT Parsing ✅

**Goal:** common subtitle files can be turned into `SubtitleSegment[]` with deterministic errors.

Targets:

- `@dojo-video-engine/presets`
- docs/tests

Done:

- `parseSrt()` parses indexes, comma millisecond separators, multiline cues, and whitespace
- `parseVtt()` parses `WEBVTT`, dot millisecond separators, cue settings, multiline cues, and comments/notes
- parsers reject malformed ranges with helpful messages
- parsed segments feed directly into `subtitleTrack()`

## Slice SX3 - Authoring And Docs Workflow ✅

**Goal:** Dojo Video Engine developers can discover the simplest subtitle workflow from the authoring layer.

Targets:

- `packages/authoring`
- docs/guides
- examples

Done:

- authoring re-exports segment subtitle helpers
- docs show paste-SRT, paste-VTT, manual segments, and word-timed ASR paths
- examples explain where transcript/subtitle assets belong
- generated nodes validate through `@dojo-video-engine/schema`

## Slice SX4 - Template Robustness Upgrade ✅

**Goal:** named subtitle templates behave safely for segment-timed captions and long user text.

Targets:

- `@dojo-video-engine/presets`
- preset catalog/showcase docs

Done:

- segment subtitle tracks can use existing caption templates
- line captions use robust bounded text defaults
- template overrides still win
- preset patch/examples remain valid

## Slice SX5 - Subtitle Stress Gallery ✅

**Goal:** subtitle regressions become visible before they reach chat/editor users.

Targets:

- `@dojo-video-engine/showcase`
- examples
- golden harness
- docs assets

Done:

- generated stress scene covers SRT-style multiline captions, WebVTT-style cue text, long Latin, CJK, emoji, URLs, and fast cue changes
- generated JSON and poster image are committed
- docs explain how to refresh/render the gallery

## Acceptance Criteria

- A programmer can paste subtitle segments or an SRT/VTT file and get a readable video subtitle track.
- Chat can say “add subtitles from this transcript” without inventing low-level scene nodes.
- Studio and Playground can preview subtitle tracks as ordinary scene data.
- Subtitle templates remain stable names that compile to deterministic nodes.
- Long and multilingual subtitle examples are covered by automated validation and visual artifacts.
