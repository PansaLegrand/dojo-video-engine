# @dojo-video-engine/create

Starter project generator for Dojo Video Engine.

## Usage

Until the scoped package is visibly published and verified on npm, run the
repository's exact-tarball clean installer. The bare generator emits registry
dependencies, so invoking it alone is not a prepublication install path:

```sh
pnpm install
pnpm build
pnpm verify:clean -- --keep
# Continue in the printed preserved starter directory.
```

After registry publication:

```sh
pnpm dlx @dojo-video-engine/create hello-video
cd hello-video
pnpm install
pnpm validate
pnpm lint
```

The generated project uses `@dojo-video-engine/authoring` for scene source and `@dojo-video-engine/cli` for validation, scene printing, and headless inspection.

The starter intentionally keeps the authored project small:

```txt
src/video.ts
public/assets/logo.svg
package.json
tsconfig.json
```


Add images, video, audio, fonts, or Lottie JSON under `public/assets`. Reference them in source with `publicAsset("assets/file.ext")`; the generated scene JSON stores the fetchable URL `/assets/file.ext`.

## API Stability

Stable for 1.x integrations:

- After verified registry publication, CLI usage through package managers is
  `npx @dojo-video-engine/create@latest <name>` or
  `pnpm dlx @dojo-video-engine/create <name>`; the installed bin remains
  `create-dojo-video-engine`. Before publication, use the retained-tarball command
  above.
- Generated project contract: `src/video.ts`, `public/assets`, `package.json` scripts for `dev`, `validate`, `print`, `migrate`, `inspect`, `lint`, and `build`.
- Programmatic generator entry points: `createDojoVideoEngineProject()`, `helpText()`, `CreateDojoVideoEngineOptions`, and `CreateDojoVideoEngineResult`.

Evolving additively in 1.x:

- Template contents may evolve as the authoring API improves. Generated projects should remain small and data-first.
- Dependency ranges follow public package SemVer while templates evolve additively.

Internal/not public:

- Template assembly helpers and files outside the package root export are implementation details.

## License

MIT

This generator creates a headless authoring project. For the visual editor and agent, use [Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).
