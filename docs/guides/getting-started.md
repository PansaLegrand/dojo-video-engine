# Get started with Dojo Video Engine

For the complete local editor and chat agent, start with
[Dojo Video Agent](https://github.com/PansaLegrand/dojo-video-agent).
This guide is for headless engine development and embedding.

Use Node 20.19+ to create a project with published engine **1.2.3**:

```sh
npx @dojo-video-engine/create@1.2.3 my-video
cd my-video
npm install
npm run validate
npm run inspect
```

For engine development, clone this repository, use its pinned pnpm version and run
`pnpm install --frozen-lockfile` followed by `pnpm build`. The separate
`pnpm verify:clean -- --keep` command verifies local tarballs and preserves an
isolated starter; it is useful when checking changes before publication.

A scene module can export JSON data, a function returning it, or a Promise. Use
`@dojo-video-engine/authoring` for TypeScript builders, and `@dojo-video-engine/schema`
for validation. The generated headless starter provides `validate`, `print`,
`migrate`, `inspect`, `lint`, and `build` scripts. There is no editor or Studio server
in the engine repository.

```ts
import { bg, makeScene, seconds, title } from "@dojo-video-engine/authoring";
export default makeScene({
  size: "landscape",
  fps: 30,
  duration: seconds(3),
  children: [bg("#102030"), title("Hello, Dojo")],
});
```

From an engine source checkout after building:

```sh
node packages/cli/dist/bin/dojo-video-engine.js validate examples/dojoclip-launch.json
node packages/cli/dist/bin/dojo-video-engine.js inspect examples/dojoclip-launch.json
```

To embed preview/export, use the player/renderer/export packages in your host.
Your host owns media resolution policy, canvas/worker setup, and user interaction.
See [preview/export](preview-export.md), [authoring](authoring-api.md), and
[scene format](../scene-format.md).

For a complete MP4 example, follow [terminal editing](../../examples/terminal-editing/README.md).
To edit without installing developer tools, [try DojoClip](https://dojoclip.com/en/applications/video-edit-ai).
