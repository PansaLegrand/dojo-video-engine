# Dojo Video Engine

[![CI](https://github.com/PansaLegrand/dojo-video-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/PansaLegrand/dojo-video-engine/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@dojo-video-engine/core)](https://www.npmjs.com/package/@dojo-video-engine/core)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Build video features with TypeScript and JSON: compose footage, text, captions,
audio and graphics into an editable Scene, preview any frame, and export MP4 in
a compatible browser. Dojo Video Engine is the MIT-licensed rendering foundation
used by DojoClip and Dojo Video Agent.

## Made with Dojo

### Creative directions

https://github.com/user-attachments/assets/99fa44aa-1e46-4594-9938-7b8cfe312223

Illustrated stories, animated data, portrait typography, cinematic titles and 3D branding.

### 3D and vector detail

https://github.com/user-attachments/assets/59f7b7d2-bb9c-442a-808c-8935aeec4de0

A miniature city, an exploded mechanical timepiece and layered kinetic vector art.

### Real-world scenarios

https://github.com/user-attachments/assets/088f91fb-d8a0-47d6-85c9-9e7665a116e9

Sports broadcast graphics, a software workflow and a colorful drink campaign.

### Lottie and animated lettering

https://github.com/user-attachments/assets/32125d51-061f-4a0f-b0ab-e15f79edb770

An original Lottie story, handwriting drawn stroke by stroke, and expressive editable text.

**[Explore the editable examples and make them yours →](examples/creative-showcase/README.md)**
The original scenes stay editable; no API keys are needed to render them.

**Want to make a video now? [Try the hosted DojoClip editor](https://dojoclip.com/en/applications/video-edit-ai).**
Use the timeline or chat, with managed accounts and online services. AI and cloud
operations follow the product's account and credit requirements.

## Choose the right starting point

| You want to…                                           | Start here                                                                       | What you run                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Add video authoring, preview or export to your own app | **This engine**                                                                  | TypeScript libraries and a validation/inspection CLI   |
| Run a local editor with a timeline and editing agent   | [Dojo Video Agent](https://github.com/PansaLegrand/dojo-video-agent#run-locally) | A local application with your own provider keys for AI |
| Edit videos without installing a developer environment | [DojoClip](https://dojoclip.com/en/applications/video-edit-ai)                   | The hosted commercial product                          |

The engine is deliberately smaller than either application. It includes Scene
validation, frame evaluation, layout, editable vector/Three.js primitives, media
playback, audio mixing and browser export. It does **not** include an editor UI,
a chat/model loop, a database, account authentication, billing, cloud storage or
provider job queues. It needs no DojoClip credentials or commercial configuration.
Your application owns project persistence, media access and any paid services.

The engine's `agent-tools` package gives an agent structured inspection, command
and evidence APIs. The calling application supplies the model and decides when
to apply edits. A Scene is render data; each application separately owns its
ProjectDocument, timeline history and application permissions.

## Quick start: a title card

Requirements: Node **20.19+** and npm. Create a small scene-authoring project using
published **1.2.3** packages:

```sh
npx @dojo-video-engine/create@1.2.3 my-video
cd my-video
npm install
npm run validate
npm run inspect
```

Edit `src/video.ts` to make a five-second portrait title:

```ts
import { bg, makeScene, seconds, title } from "@dojo-video-engine/authoring";

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [bg("#0f172a"), title("Launch day")],
});
```

Run `npm run validate` again to check the Scene, and `npm run print` to view its
JSON. This starter authors and inspects scenes; use the terminal example below
for an end-to-end MP4 render, or embed [preview/export](docs/guides/preview-export.md)
in your application. No model or API key is required.

For an existing browser application, install only the packages you need:

```sh
npm install @dojo-video-engine/authoring@1.2.3 @dojo-video-engine/player@1.2.3 @dojo-video-engine/export@1.2.3
```

## Practical examples

### Join clips, add a title and mix music

The [standalone terminal example](examples/terminal-editing/README.md) creates two
synthetic clips, trims and joins them into four seconds, adds a title for the
first two seconds, and mixes clip audio at 50% with a music tone at 20%. It writes
six preview PNGs, a contact sheet and `output/edited.mp4`, then independently
checks the decoded picture and sound with FFmpeg.

After the source setup below, run:

```sh
pnpm verify:terminal
```

This installs the example's pinned **1.2.3** registry packages in a separate
temporary project. Requirements: FFmpeg/ffprobe and Playwright Chromium; the
command installs Chromium if needed. Package/browser downloads require network
access, but there are no model calls. It also checks reopening, invalid Scene
rejection and missing assets. To use your own footage or let a coding agent edit
the project, follow the [example instructions](examples/terminal-editing/README.md).

### Make animated captions and text overlays

The [example collection](examples/README.md) includes timed word highlights,
SRT/WebVTT subtitle layouts, image overlays and picture-in-picture footage.
After source setup, render the self-contained caption scene:

```sh
pnpm --filter @dojo-video-engine/golden exec playwright install chromium
pnpm --filter @dojo-video-engine/golden run example examples/generated/tiktok-captions.json out/captions.mp4 60
```

This produces an MP4 and a preview PNG at frame 60. Caption text and timing are
supplied data; automatic transcription and translation belong to your host or
[Dojo Video Agent](https://github.com/PansaLegrand/dojo-video-agent).

### Build your own editor or coding-agent workflow

Use `authoring`/`presets` to construct scenes, `inspection`/`agent-tools` to check
and revise them, and `player`/`export` for browser output. The
[terminal authoring script](examples/terminal-editing/author.mjs) demonstrates
revising a title through the workflow SDK, rejecting a stale edit and preserving
the rest of the Scene. The terminal check above executes it against published
packages.

Keep source assets and the editable Scene to make subsequent revisions. The
terminal render script is an example integration; the public CLI provides
validation and inspection, and does not provide a render/export command. There
is no packaged Codex/Claude plugin in this repository.

## Scope and product synchronization

DojoClip and Dojo Video Agent currently consume the published **1.2.3**
engine. Shared rendering fixes belong here and reach both applications through
versioned packages. The release includes responsive editable title cards and
the existing vector/Three.js support; see the [release record](docs/releases/1.2.3.md).
Editor UI, agent tools and host behavior have their own synchronization path in
[Dojo Video Agent](https://github.com/PansaLegrand/dojo-video-agent).

The [1.3.0 source candidate](docs/releases/1.3.0.md) adds editable single-series
charts. The published 1.2.3 packages do not contain the `dataChart` macro.

The full hosted product also supplies account-based projects, managed provider
operations, storage/publication and payments. Those services are intentionally
outside this repository. Open source is a reusable foundation, not a deployment
of the commercial SaaS.

Scenes are validated data. Arbitrary HTML, React and CSS are not executed.
Preview/export uses browser rendering and codec capabilities; headless terminal
rendering still launches Chromium. Optional [Three.js layers](packages/three/README.md)
require WebGL2 and have explicit object/resource limits. Supported fixtures do
not establish support for every browser, codec, GPU or creative request.

## Develop from source

Use Node 20.19+ and the repository's pinned pnpm version:

```sh
git clone https://github.com/PansaLegrand/dojo-video-engine.git
cd dojo-video-engine
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Validate and inspect a supplied Scene without launching an application:

```sh
node packages/cli/dist/bin/dojo-video-engine.js validate examples/dojoclip-launch.json
node packages/cli/dist/bin/dojo-video-engine.js inspect examples/dojoclip-launch.json
node packages/cli/dist/bin/dojo-video-engine.js check examples/dojoclip-launch.json --sample-count 3
```

The source checkout is needed for repository examples and engine development.
Applications can consume the published packages without cloning it.

## Packages

All **17 public packages** use the `@dojo-video-engine/` scope and version together.

| Package                                 | Purpose                                                      |
| --------------------------------------- | ------------------------------------------------------------ |
| `schema`                                | Scene validation, migration, patches and JSON Schema         |
| `authoring`, `layout`, `presets`        | Typed builders, layout, motion and composition primitives    |
| `commands`, `inspection`, `agent-tools` | Reversible Scene commands, diagnostics and bounded workflows |
| `core`, `extensions`, `runtime`         | Frame evaluation, trusted extensions and resource ownership  |
| `renderer-canvas2d`                     | Canvas2D rendering and media preparation                     |
| `three`                                 | Optional editable 3D layers                                  |
| `player`, `export`                      | Playback, seeking, audio mixing and browser MP4 export       |
| `interchange`                           | Bounded host/import/export bridges                           |
| `cli`, `create`                         | Validation, inspection and the headless authoring starter    |

`packages/showcase` and `tools/golden` are private verification fixtures, not
additional end-user applications.

## Verification and documentation

Use `pnpm check:contracts` and `pnpm release:fast` for source checks. The full
release gate (`pnpm release:full`) adds browser pixels, media/audio/export,
resource, performance and package checks. `pnpm verify:clean -- --keep` tests
local tarballs in an isolated starter without publishing. No engine check needs
a paid model key. See [testing](docs/testing-strategy.md) for dependencies and
canonical environments, and the [release process](docs/release-process.md) for
publication gates.

- [Getting started](docs/guides/getting-started.md) and [examples](examples/README.md)
- [Scene format](docs/scene-format.md), [API reference](docs/api-reference.md) and [engine contracts](llms.txt)
- [Preview and export](docs/guides/preview-export.md) and [extensions](docs/extension-abi.md)
- [Graphics implementation](docs/graphics-milestone-2026-11-06.md)
- [Terminal editing evidence and limits](docs/terminal-editing-2026-11-03.md)
- [Published 1.2.3 checksums and provenance](docs/releases/1.2.3.md)
- [Readiness plan](docs/engine-readiness-plan.md) and [contributor guide](AGENTS.md)

Dated reports qualify their recorded fixtures and versions; they do not establish
current product deployment or general model quality.

## License

[MIT](LICENSE). Third-party notices are retained with their owning packages/assets.
