# @dojo-video-engine/create

Starter project generator for Dojo Video Engine.

## Usage

With Node 20.19+, create a project from published engine **1.2.3**:

```sh
npx @dojo-video-engine/create@1.2.3 hello-video
cd hello-video
npm install
npm run validate
npm run inspect
```

To test unpublished engine changes from a source checkout, run
`pnpm install --frozen-lockfile`, `pnpm build`, then `pnpm verify:clean -- --keep`.
Continue in the printed preserved starter directory. This installs local tarballs
without publishing them.

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

- CLI usage through package managers is `npx @dojo-video-engine/create@1.2.3 <name>`
  or `pnpm dlx @dojo-video-engine/create@1.2.3 <name>`; the installed bin remains
  `create-dojo-video-engine`. Use the local-tarball check above for unpublished changes.
- Generated project contract: `src/video.ts`, `public/assets`, `package.json` scripts for `validate`, `print`, `migrate`, `inspect`, `lint`, and `build`.
- Programmatic generator entry points: `createDojoVideoEngineProject()`, `helpText()`, `CreateDojoVideoEngineOptions`, and `CreateDojoVideoEngineResult`.

Evolving additively in 1.x:

- Template contents may evolve as the authoring API improves. Generated projects should remain small and data-first.
- Dependency ranges follow public package SemVer while templates evolve additively.

Internal/not public:

- Template assembly helpers and files outside the package root export are implementation details.

## License

MIT

This generator creates a headless authoring project. For the visual editor and agent, use [Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).

For the hosted timeline and chat editor, [try DojoClip](https://dojoclip.com/en/applications/video-edit-ai).
