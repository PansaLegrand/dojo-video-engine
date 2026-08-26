# @motionforge/create

Starter project generator for MotionForge.

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
pnpm dlx @motionforge/create hello-video
cd hello-video
pnpm install
pnpm validate
pnpm lint
pnpm dev
```

The generated project uses `@motionforge/authoring` for scene source and `@motionforge/cli` for validation, scene printing, Studio preview, and browser MP4 export.

The starter intentionally keeps the authored project small:

```txt
src/video.ts
public/assets/logo.svg
package.json
tsconfig.json
```

Run `pnpm dev` to open MotionForge Studio for `src/video.ts`.

Add images, video, audio, fonts, or Lottie JSON under `public/assets`. Reference them in source with `publicAsset("assets/file.ext")`; the generated scene JSON stores the fetchable URL `/assets/file.ext`.

## API Stability

Stable for 1.x integrations:

- After verified registry publication, CLI usage through package managers is
  `npx @motionforge/create@latest <name>` or
  `pnpm dlx @motionforge/create <name>`; the installed bin remains
  `create-motionforge`. Before publication, use the retained-tarball command
  above.
- Generated project contract: `src/video.ts`, `public/assets`, `package.json` scripts for `dev`, `validate`, `print`, `migrate`, `inspect`, `lint`, and `build`.
- Programmatic generator entry points: `createMotionforgeProject()`, `helpText()`, `CreateMotionforgeOptions`, and `CreateMotionforgeResult`.

Evolving additively in 1.x:

- Template contents may evolve as the authoring API and Studio improve. Generated projects should remain small and data-first.
- Dependency ranges follow public package SemVer while templates evolve additively.

Internal/not public:

- Template assembly helpers and files outside the package root export are implementation details.

## License

MIT
