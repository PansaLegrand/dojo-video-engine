> Historical record. The editor, UI demos, and model-agent examples have been retired from this engine repository. Current application development: [Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).

# M0 Roadmap

M0 proves the thesis with the smallest useful engine.

## Acceptance Criteria

- A scene validates through `@dojo-video-engine/schema`.
- The builder API serializes to that exact scene format.
- Animation values are resolved as pure functions of `frame`.
- The Canvas2D renderer draws the same scene used by preview.
- The playground can scrub frames.
- A basic browser export API exists behind capability checks.
- Each implementation slice updates [progress.md](progress.md) and lands with tests or a documented test gap.

## Sequence

1. ✅ Scene schema and actionable validation.
2. ✅ Builder API and round-trip tests.
3. ✅ Animation evaluator with frozen numeric tests.
4. ✅ Simple layout pass for absolute/flex-centered scenes.
5. ✅ Canvas2D reference renderer.
6. ✅ Playground still-frame preview.
7. ✅ Deterministic frame sequence loop for export.
8. ✅ WebCodecs/mediabunny export (`exportVideo()`, playground Export MP4 button, browser smoke test).

**M0 is closed.** All acceptance criteria re-verified on 2026-06-11: scenes validate through `@dojo-video-engine/schema` (with JSON Schema export), the builder serializes deterministically, animations resolve as pure functions of `frame` (numbers and colors), the Canvas2D renderer draws the same scene as preview (proven by golden hashes shared between paths), the playground scrubs and exports, `exportVideo()` works behind capability checks, and every slice landed with tests and a `progress.md` entry. The next milestone is [the post-M0 roadmap](roadmap.md).

## Deferred

- React adapter.
- GSAP adapter.
- CanvasKit.
- Tauri desktop.
- MCP server.
- Real video decode.
- Full typography stack.
