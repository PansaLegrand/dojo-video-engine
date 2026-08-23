# @motionforge/cli

Command-line validation and inspection tools for MotionForge scene modules.

## Install

```sh
npm install -D @motionforge/cli
```

## Usage

```sh
motionforge validate src/video.ts
motionforge print src/video.ts
motionforge migrate src/video.ts
motionforge inspect src/video.ts
motionforge lint src/video.ts
motionforge dev src/video.ts
```

The module may export a scene object directly, a function returning a scene, or a promise resolving to either.

```ts
import { bg, makeScene, seconds, title } from "@motionforge/authoring";

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [bg("#0f172a"), title("Hello")],
});
```

`validate` exits `0` when the scene is valid and `1` when validation fails. `print` validates first, then writes formatted scene JSON to stdout.

`migrate` writes a migration result containing the canonical v1 scene, source
and target versions, and applied migration ids. `lint` writes machine-readable
warnings for valid-but-suspicious timing, visibility, audio, animation, and
unused-asset conditions.

`inspect` validates first, then writes machine-readable scene metadata:

```json
{
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "durationFrames": 150,
  "durationSeconds": 5,
  "assets": {
    "total": 1,
    "image": 1,
    "video": 0,
    "audio": 0,
    "font": 0,
    "lottie": 0
  },
  "nodes": {
    "total": 3,
    "root": 3,
    "div": 1,
    "text": 1,
    "img": 1,
    "video": 0,
    "audio": 0,
    "lottie": 0,
    "effect": 0,
    "extension": 0,
    "shape": 0
  },
  "effects": {},
  "extensions": {},
  "capabilities": {
    "hasVisuals": true,
    "hasAudio": false,
    "hasEffects": false,
    "hasExtensions": false,
    "hasShapes": false,
    "hasVectorPaths": false,
    "hasClipping": false,
    "hasMasks": false,
    "hasSoftMasks": false,
    "hasBlendModes": false,
    "hasIsolatedGroups": false,
    "hasRichText": false,
    "requiresBrowserExport": true
  }
}
```

`dev` starts MotionForge Studio for the scene module. The studio validates the source, renders it on Canvas2D, exposes a frame scrubber and JSON inspector, and enables browser MP4 export when WebCodecs is available.

## API Stability

Stable for 0.x integrations:

- CLI commands: `motionforge validate`, `motionforge print`, `motionforge migrate`, `motionforge inspect`, `motionforge lint`, and `motionforge dev`.
- Programmatic helpers: `executeCli()`, `runCli()`, `inspectScene()`, `CliResult`, `CliIo`, and `SceneInspection`.
- Scene module loading contract: JSON files, JS/ESM modules, TypeScript modules through `tsx`, default export or named `scene`, and scene-returning functions/promises.

Experimental before 1.0:

- Studio UI served by `motionforge dev` is part of the developer workflow, but its HTML/CSS/client internals are not stable.
- `inspect` output may gain additive fields; existing field names are intended to stay stable through 0.x.

Internal/not public:

- `createStudioServer()` and Vite virtual-module internals are exported only within package source today; do not rely on deep imports.
- Files outside the package root export and CLI binary are implementation details.

## License

MIT
