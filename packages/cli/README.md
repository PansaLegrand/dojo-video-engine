# @dojo-video-engine/cli

Command-line validation and inspection tools for Dojo Video Engine scene modules.

## Install

The registry command below applies only after this exact version is visible on
npm. For the repository source candidate, use `pnpm verify:clean -- --keep` at
the repository root to get an installed local-tarball starter.

```sh
npm install -D @dojo-video-engine/cli
```

## Usage

```sh
dojo-video-engine validate src/video.ts
dojo-video-engine print src/video.ts
dojo-video-engine migrate src/video.ts
dojo-video-engine inspect src/video.ts
dojo-video-engine inspect-layout src/video.ts --frame 45
dojo-video-engine lint src/video.ts
dojo-video-engine check src/video.ts --frames 0,45,89
dojo-video-engine diff before.ts after.ts
dojo-video-engine capabilities
```

The module may export a scene object directly, a function returning a scene, or a promise resolving to either.

```ts
import { bg, makeScene, seconds, title } from "@dojo-video-engine/authoring";

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

`diff` produces the stable id-aware semantic diff from
`@dojo-video-engine/agent-tools`. `capabilities` prints runtime-derived schema,
motion-preset, macro, extension, and export capability metadata.

`inspect-layout` returns renderer-neutral border/content/transformed/clip
bounds, paint order, text/media metrics, and deterministic diagnostics for one
in-range frame. `check` emits one versioned JSON envelope containing
validation, structural inspection, lint, tree, timeline, bounded frame
samples, and diagnostics. Invalid scenes still produce a parseable envelope
and exit `1`; valid scenes with warnings exit `0`. Use either an explicit
comma-separated `--frames` list or `--sample-count` (both are capped at 100).

For the visual editor and agent, use [Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).

## API Stability

Stable for 1.x integrations:

- CLI commands: `dojo-video-engine validate`, `dojo-video-engine print`, `dojo-video-engine migrate`, `dojo-video-engine inspect`, `dojo-video-engine inspect-layout`, `dojo-video-engine lint`, `dojo-video-engine check`, `dojo-video-engine diff`, `dojo-video-engine capabilities`.
- Programmatic helpers: `executeCli()`, `runCli()`, `inspectScene()`, `CliResult`, `CliIo`, and `SceneInspection`.
- Scene module loading contract: JSON files, JS/ESM modules, TypeScript modules through `tsx`, default export or named `scene`, and scene-returning functions/promises.

Evolving additively in 1.x:

- `inspect` output may gain additive fields; existing field names are intended to stay stable through 1.x.

Internal/not public:

- Files outside the package root export and CLI binary are implementation details.

## License

MIT
