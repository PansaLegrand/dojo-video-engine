# @motionforge/core

Scene builder API, keyframe animation evaluator, and layout pass for [motionforge](https://github.com/PansaLegrand/motionforge), a deterministic, browser-native video scene engine.

## Install

```sh
npm install @motionforge/core
```

## Usage

```ts
import {
  composition,
  div,
  text,
  evaluateScene,
  layoutScene,
} from "@motionforge/core";

const scene = composition({ width: 1080, height: 1920, fps: 30, duration: 120 })
  .children(
    div({
      id: "bg",
      style: { width: "100%", height: "100%", backgroundColor: "#101820" },
    }),
    text("Hello", { style: { fontSize: 76, color: "#fff" } }).animate(
      "opacity",
      [
        { frame: 0, value: 0 },
        { frame: 12, value: 1, easing: "easeOut" },
      ],
    ),
  )
  .toJSON();

// Pure evaluation: scene JSON + frame number -> resolved styles -> layout boxes.
const resolved = evaluateScene(scene, 30);
const layout = layoutScene(resolved);
```

The same builder program always emits the same scene JSON, so scenes can be diffed, patched, and snapshot-tested.

## API Stability

Stable for 0.x integrations:

- Builder API: `composition()`, `div()`, `text()`, `richText()`, `img()`, `video()`, `audio()`, `lottie()`, `effect()`, `extension()`, `shape()`, `SceneBuilder`, `NodeBuilder`, and their option types.
- Evaluation and layout: `evaluateScene()`, `layoutScene()`, `ResolvedScene`, `ResolvedNode`, `LayoutScene`, and `LayoutBox`.
- Keyframe evaluation and deterministic easing: `evaluateKeyframes()`, `applyEasing()`, `cubicBezierEasing()`, and `springEasing()`.
- Text measurement helpers used by renderers/editors: `wrapTextLines()`, `prepareTextLines()`, and `prepareTextLayout()`.
- Per-side spacing, composable `safeArea` insets, and `aspectRatio` layout, including `parseAspectRatio()` for tools that mirror inspector geometry.

Experimental before 1.0:

- Low-level parser helpers such as `parseTransform()` and `parseColor()` are exported for tests and custom tooling, but may be replaced by narrower renderer-facing APIs.
- `sampleScene()` is a demo helper, not a compatibility contract.

Internal/not public:

- The core package does not render pixels or decode media. Use `@motionforge/renderer-canvas2d`, `@motionforge/player`, or `@motionforge/export` for those jobs.
- Files outside the package root export are implementation details.

## License

MIT
