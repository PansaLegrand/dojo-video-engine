# Get started with Dojo Video Engine

For the complete local editor and chat agent, start with
[Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).
This guide is for headless engine development and embedding.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm verify:clean -- --keep
```

The final command preserves a temporary installed authoring project that consumes
local tarballs. It proves the renamed packages work outside this repository.
Registry commands are conditional on a separately verified npm release.

A scene module can export JSON data, a function returning it, or a Promise. Use
`@dojo-video-engine/authoring` for TypeScript builders, and `@dojo-video-engine/schema`
for validation. The generated headless starter provides `validate`, `print`,
`migrate`, `inspect`, `lint`, and `build` scripts. There is no editor or Studio server
in the engine repository.

```ts
import { bg, makeScene, seconds, title } from '@dojo-video-engine/authoring';
export default makeScene({
  size: 'landscape', fps: 30, duration: seconds(3),
  children: [bg('#102030'), title('Hello, Dojo')],
});
```

```sh
node packages/cli/dist/bin/dojo-video-engine.js validate examples/dojoclip-launch.json
node packages/cli/dist/bin/dojo-video-engine.js inspect examples/dojoclip-launch.json
```

To embed preview/export, use the player/renderer/export packages in your host.
Your host owns media resolution policy, canvas/worker setup, and user interaction.
See [preview/export](preview-export.md), [authoring](authoring-api.md), and
[scene format](../scene-format.md).
