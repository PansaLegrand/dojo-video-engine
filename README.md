# Dojo Video Engine

[![CI](https://github.com/PansaLegrand/dojo-video-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/PansaLegrand/dojo-video-engine/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@dojo-video-engine/core)](https://www.npmjs.com/package/@dojo-video-engine/core)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A deterministic, browser-native video engine. Author structured scenes in
TypeScript or JSON, evaluate any frame, preview with Canvas2D, and export MP4
through WebCodecs and Mediabunny.

**Looking for the video editor or editing agent? Use
[Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).**
The harness owns the manual editor, chat, tools, skills, approvals, local project
persistence, and bring-your-own LLM/ASR keys. Further UI and agent development
belongs there. This repository owns the rendering engine and its headless APIs.

## Repository boundary

| Repository                                                               | Responsibility                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [dojo-video-engine](https://github.com/PansaLegrand/dojo-video-engine)   | Scene schema, authoring, commands, inspection, rendering, playback, export |
| [dojo-video-harness](https://github.com/PansaLegrand/dojo-video-harness) | Runnable local editor, editing agent, user decisions, provider adapters    |

The old reference applications, playground, model-agent demonstrations, MCP demo,
CLI Studio UI, and app-specific evaluation runner have been removed. Browser
fixtures under `tools/golden` remain internal engine verification infrastructure.
`agent-tools` remains a provider-neutral SDK for inspection, commands, and proof
artifacts; it contains no model loop, credentials, or application UI.

## Use the published engine

All **17 packages** are published together at **1.2.3** on npm under the MIT license.
For example, add scene authoring, playback, and export to an existing project:

```sh
npm install @dojo-video-engine/authoring@1.2.3 @dojo-video-engine/player@1.2.3 @dojo-video-engine/export@1.2.3
```

Or create a standalone scene-authoring project with Node 20.19+ and npm:

```sh
npx @dojo-video-engine/create@1.2.3 my-video
cd my-video
npm install
npm run validate
npm run inspect
```

This starter provides TypeScript scenes and headless validation/inspection. For
the visual editor, timeline, and chat, use
[Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness#run-locally).
Neither installation path requires cloning the engine repository.

## Edit videos from a terminal or coding agent

Use Dojo as the rendering/editing toolkit underneath your own coding agent:
author a TypeScript/JSON Scene, validate and inspect it, render preview frames,
then export an MP4. The agent supplies the conversation and planning; the engine
needs no LLM provider or separate model loop. A graphical editor is optional.

The [standalone terminal example](examples/terminal-editing/README.md) exercises
published packages with two trimmed clips, a revised title, mixed audio, preview
images and a verified four-second MP4. It includes a small headless-Chromium
render script and the engine's exact media dependency. Run its isolated acceptance check with
Node 20.19+, pinned pnpm and FFmpeg/ffprobe:

```sh
pnpm verify:terminal
```

The check installs registry packages in a temporary project and retains the MP4,
contact sheet and independent decoded-media report. It requires package/browser
downloads but no model calls or API keys. See the example for commands to run in
your own project and an instruction to give a coding agent.

**Scope:** terminal-driven rendering uses a browser runtime behind the scenes.
The public CLI handles validation/inspection; rendering/export in this example
comes from its scripts, not a new public CLI command. No installable Codex/Claude
plugin is shipped, and separate client acceptance remains untested. Engine 1.2.3
pins its qualified media runtime, so no consumer override is needed.
[Test evidence and limitations](docs/terminal-editing-2026-11-03.md).

See the [publication artifacts and workflow](https://github.com/PansaLegrand/dojo-video-engine/actions/runs/42578789788)
and [1.2.3 release record](docs/releases/1.2.3.md) for exact package checksums,
provenance, dependency inventory, audit evidence, and qualification limits.

## Develop from source

Use Node 20.19+ and the repository's pinned pnpm version.

```sh
git clone https://github.com/PansaLegrand/dojo-video-engine.git
cd dojo-video-engine
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Validate or inspect a scene without running an application:

```sh
node packages/cli/dist/bin/dojo-video-engine.js validate examples/dojoclip-launch.json
node packages/cli/dist/bin/dojo-video-engine.js inspect examples/dojoclip-launch.json
node packages/cli/dist/bin/dojo-video-engine.js check examples/dojoclip-launch.json --sample-count 3
```

Package imports use `@dojo-video-engine/*`. To verify a local engine change as
consumable tarballs without publishing it:

```sh
pnpm verify:clean -- --keep
```

This packs and installs the public packages into a temporary headless authoring
project and checks Node, browser, worker, CLI, and build entry points. The
`@dojo-video-engine/create` package generates a headless scene project, not a UI.

## Author a scene

```ts
import { bg, makeScene, seconds, title } from "@dojo-video-engine/authoring";

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [bg("#0f172a"), title("Hello, Dojo")],
});
```

Scenes remain validated data. The engine evaluates animation at a requested
frame; media resources are prepared asynchronously and disposed explicitly.
Preview and export share the rendering contract. Supported style/layout and
codec capabilities are explicit; arbitrary HTML, React, and CSS are not executed.

## Packages

| Package                                 | Purpose                                                                |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `schema`                                | Scene validation, migration, patches, JSON Schema                      |
| `authoring`, `layout`, `presets`        | Typed scene builders, layout, motion and composition primitives        |
| `commands`, `inspection`, `agent-tools` | Reversible commands, geometry/time inspection, bounded proof workflows |
| `core`, `extensions`, `runtime`         | Frame evaluation, trusted extensions, reusable resource lifecycle      |
| `renderer-canvas2d`                     | Canvas2D rendering and media preparation                               |
| `player`, `export`                      | Playback, seeking, audio mixing, browser MP4 export                    |
| `interchange`                           | Explicitly bounded host/import/export bridges                          |
| `cli`, `create`                         | Headless validation, inspection, authoring starter                     |

Each public package is scoped under `@dojo-video-engine/`. `packages/showcase`
contains private engine scene fixtures used by examples and rendering tests.

## Verification

```sh
pnpm check:contracts
pnpm release:fast
pnpm --filter @dojo-video-engine/golden exec playwright install chromium firefox webkit
pnpm release:full
pnpm verify:clean
```

The full gate includes deterministic unit tests, schema/migration checks, fuzzing,
scene corpus checks, resource lifecycle checks, browser pixels/media/audio/export,
cross-browser probes, performance budgets, and package smoke checks. It does not
contact a paid model provider. Exact pixel assertions require the pinned browser,
fonts, and rendering environment; see [testing](docs/testing-strategy.md).

The [readiness evidence](docs/readiness-report-2026-11-02.md) adds an independent
FFmpeg content oracle: six CFR/VFR exports, 330 decoded frame identities, 24 preview
markers, and 294 audio windows. Run `pnpm verify:media` with FFmpeg and ffprobe on
PATH. This qualifies the documented fixtures; it is not a claim that every codec,
browser, effect, or editing workflow has been qualified.

The harness's [basic workflow and music acceptance](https://github.com/PansaLegrand/dojo-video-harness/blob/main/docs/basic-workflows-and-music-2026-11-03.md)
exercises engine 1.1.1 through actual clip concatenation, image overlay, captions,
background-audio mixing and revision-bound browser export. Provider preparation
and approval remain harness responsibilities; no engine runtime change was needed.

Applications should consume exact published versions and retain their lockfile.
Engine fixes belong in this repository; keep product persistence, provider calls,
approvals, and billing in host adapters. Run the application's own preview/export
and command acceptance checks after each engine update.

## Documentation

- [Coding agent repository guide](AGENTS.md)
- [Getting started](docs/guides/getting-started.md)
- [Scene format](docs/scene-format.md)
- [API reference](docs/api-reference.md)
- [Engine contracts](llms.txt)
- [Preview and export](docs/guides/preview-export.md)
- [Extensions](docs/extension-abi.md)
- [Editable vectors and Three.js design](docs/rfcs/0014-vector-and-three-layers.md)
- [Graphics implementation and local evidence](docs/graphics-milestone-2026-11-06.md)
- [Repository split and migration](docs/repository-split.md)
- [Published 1.2.3 release](docs/releases/1.2.3.md)
- [Engine readiness plan](docs/engine-readiness-plan.md)
- [Release process](docs/release-process.md)

Historical plans/reports are labeled as such and do not establish current release
acceptance. For application examples, the editor UI, agent harness, or provider
integration, continue in [Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).

## License

[MIT](LICENSE). Third-party notices are retained with their owning packages/assets.
