# create-motionforge

Starter project generator for MotionForge.

## Usage

```sh
pnpm create motionforge hello-video
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

Stable for 0.x integrations:

- CLI usage through package managers: `npm create motionforge@latest <name>` or `pnpm create motionforge <name>`.
- Generated project contract: `src/video.ts`, `public/assets`, `package.json` scripts for `dev`, `validate`, `print`, `migrate`, `inspect`, `lint`, and `build`.
- Programmatic generator entry points: `createMotionforgeProject()`, `helpText()`, `CreateMotionforgeOptions`, and `CreateMotionforgeResult`.

Experimental before 1.0:

- Template contents may evolve as the authoring API and Studio improve. Generated projects should remain small and data-first.
- Dependency version ranges may change before package publishing is fully settled.

Internal/not public:

- Template assembly helpers and files outside the package root export are implementation details.

## License

MIT
