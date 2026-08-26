# MotionForge Developer Experience Roadmap

**Status:** implementation plan started 2026-06-17

MotionForge should be an open-source base layer for programmers, not only a reference chat editor. The next milestone is to make authoring a video feel as direct as Remotion's first ten minutes while preserving MotionForge's core difference: the canonical output is validated, serializable scene data.

## Positioning

Remotion's authoring promise is clear:

```txt
write React -> preview in Studio -> render video
```

MotionForge's authoring promise should be equally clear:

```txt
write deterministic TypeScript scene data -> preview in Studio -> render video in the browser or CLI
```

The project should not imitate React composition unless we intentionally build an adapter later. The primary authoring surface should be plain TypeScript that emits a MotionForge `Scene`:

```ts
import { makeScene, bg, title, seconds, fadeUp } from "@motionforge/authoring";

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [
    bg("#0f172a"),
    title("Hello MotionForge", {
      at: seconds(1),
      duration: seconds(3),
      enter: fadeUp(),
    }),
  ],
});
```

The generated value is still plain scene JSON. Users can validate it, diff it, patch it, store it, hand it to an agent, preview it, or export it.

## Product Rule

Developer DX must reduce boilerplate without hiding the scene contract.

Good:

- seconds-first helpers that compile to integer frames
- layout helpers that compile to supported `SceneStyle`
- asset helpers that emit `scene.assets` entries and nodes
- CLI/studio tools that validate and show the generated scene JSON

Avoid:

- runtime-only behavior that cannot be serialized
- unrestricted CSS or DOM APIs that the renderer cannot implement deterministically
- magic project state that prevents a scene from being reproduced from source

## North-Star Developer Flow

```sh
pnpm dlx @motionforge/create hello-video
cd hello-video
pnpm dev
```

The generated project opens a developer studio with a preview, frame scrubber, composition picker, and JSON inspector.

The user edits `src/video.ts`:

```ts
import { makeScene, bg, title, textBlock, seconds, slideIn } from "@motionforge/authoring";

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [
    bg("#111827"),
    title("Launch Week", {
      at: seconds(0.5),
      enter: slideIn("up"),
    }),
    textBlock("Three updates. One clean video.", {
      at: seconds(1.2),
      enter: slideIn("up", { delay: 6 }),
    }),
  ],
});
```

Then exports from Studio, or from a browser app using `@motionforge/export`:

```ts
import { exportVideo } from "@motionforge/export";

const { blob } = await exportVideo({ scene });
```

## Implementation Slices

Each slice should land with focused tests, docs, and a `docs/progress.md` entry.

### Slice DX1 - Seconds-First Authoring Package ✅

**Goal:** A programmer can write a polished scene with minimal TypeScript and without hand-computing frames.

Code targets:

- new `packages/authoring`
- `tsconfig.base.json`
- root `README.md`
- `docs/progress.md`

Tasks:

- Add `@motionforge/authoring`.
- Export `seconds(value)`, `frames(value)`, `time(value, unit)`, and `toFrames(value, fps)`.
- Export `makeScene()` with `size`, `fps`, `duration`, `assets`, and `children`.
- Export simple node helpers:
  - `bg(color)`
  - `box(options)`
  - `title(text, options)`
  - `textBlock(text, options)`
  - `image(assetId, options)`
  - `videoClip(assetId, options)`
  - `audioTrack(assetId, options)`
- Accept authoring options in seconds or frames, then compile to a normal MotionForge `Scene`.
- Re-export core motion presets that are safe for authoring (`fadeUp`, `popIn`, `slideIn`, `pulse`) so examples need one import.

Done when:

- A test builds a portrait scene using seconds-based timing and validates the resulting scene.
- A test proves source trim options compile to `videoStartTime` / `audioStartTime`.
- README shows the new authoring API as the first programmer example.

### Slice DX2 - Minimal CLI ✅

**Goal:** A programmer can validate and inspect a scene module from the terminal.

Code targets:

- new `packages/cli`
- package bin `motionforge`
- root `README.md`

Commands shipped:

```sh
motionforge validate src/video.ts
motionforge print src/video.ts
```

Tasks:

- Load ESM/TypeScript scene modules in Node.
- Accept a default export that is either a `Scene` or a function returning a `Scene`.
- Validate with `@motionforge/schema`.
- Print friendly validation errors.
- Defer `still` until the Node canvas dependency story is acceptable; this slice ships `validate` and `print` first.

Done when:

- `motionforge validate` exits `0` for a valid scene and non-zero for invalid scene data.
- `motionforge print` writes formatted scene JSON.
- Docs explain browser-only export vs CLI validation clearly.

### Slice DX3 - Create MotionForge Starter ✅

**Goal:** The first command creates a working project.

Code targets:

- scoped `@motionforge/create` in `packages/create-motionforge`
- starter template files

Tasks:

- `pnpm dlx @motionforge/create my-video` / `npx @motionforge/create@latest my-video`
- Generate a minimal TypeScript project with:
  - `src/video.ts`
  - package scripts: `dev`, `validate`, `print`, `build`
- Use `@motionforge/authoring` in the starter.
- Keep v1 initially text-only; DX5 adds the first local asset convention.

Done when:

- The generator creates the expected project files, scripts, and public npm dependency ranges.
- The template uses `@motionforge/authoring` for source and `@motionforge/cli` for validation, Studio preview, scene inspection, and browser MP4 export.
- Full install/preview validation is finalized after package publishing or local package packing, because unpublished workspace packages use `workspace:*` internally.

### Slice DX4 - Developer Studio App ✅

**Goal:** Programmers get a Remotion Studio-like loop without changing the data-first model.

Code targets:

- `packages/cli`

Tasks:

- Add `motionforge dev <scene-module>`.
- Load a local scene module and validate it through the same CLI loader.
- Serve a CLI-hosted Studio through Vite.
- Canvas preview with play/pause/seek.
- Frame display and scrubber.
- JSON inspector.
- Validation feedback from the scene endpoint.
- Export button when WebCodecs is available.
- Keep the starter project pointed at `motionforge dev src/video.ts`.

Done when:

- `motionforge dev` opens the studio for the current project.
- The Studio can reload the scene module on demand without restarting the server.
- The served client resolves MotionForge runtime packages through the CLI package, so generated projects only need `@motionforge/cli` and `@motionforge/authoring`.

### Slice DX5 - Asset Path Story ✅

**Goal:** Programmer-authored videos can use local assets without hand-writing object URLs or data URLs.

Tasks:

- Define `public/assets` as the starter and Studio convention for local files.
- Add `publicAsset()` so source code can use `publicAsset("assets/clip.mp4")` while emitted scene JSON stores `/assets/clip.mp4`.
- Add typed helpers: `imageAsset()`, `videoAsset()`, `audioAsset()`, and `defineAssets()`.
- Allow `image()`, `videoClip()`, and `audioTrack()` to accept either an asset id or a typed asset object; asset objects are auto-collected into `scene.assets`.
- Keep emitted scene JSON portable and explicit: asset ids plus fetchable `src` strings.
- Document large-file limits and streaming-source roadmap.

Done when:

- A starter project uses a local image from `public/assets`.
- Docs show the same pattern for images, video, and audio.
- Preview/export use the same browser-fetchable asset URLs.

### Slice DX6 - Documentation Path ✅

**Goal:** Docs teach programmers before they encounter the chat app.

Docs:

- 5-minute quickstart: [`docs/guides/getting-started.md`](guides/getting-started.md).
- Authoring API guide: [`docs/guides/authoring-api.md`](guides/authoring-api.md).
- Animation guide: [`docs/guides/animation.md`](guides/animation.md).
- Media guide: [`docs/guides/media.md`](guides/media.md).
- Preview/export guide: [`docs/guides/preview-export.md`](guides/preview-export.md).
- MotionForge vs Remotion: [`docs/guides/motionforge-vs-remotion.md`](guides/motionforge-vs-remotion.md).
- Agent-generated scenes: [`docs/guides/agent-generated-scenes.md`](guides/agent-generated-scenes.md).

Done when:

- A new programmer can build and render a short animated scene by following docs only.

## Acceptance Criteria For The DX Milestone

- `pnpm dlx @motionforge/create my-video` produces a working project.
- The default project source is under 50 lines and reads clearly.
- `motionforge validate` catches errors with actionable messages.
- `motionforge dev` previews the scene.
- Browser export produces MP4, with capability caveats documented.
- The root README leads with the authoring path before the chat/editor product.
- The chat app remains a reference consumer, not the primary OSS entry point.

Note: a dedicated `motionforge render` command remains deferred until the Node/headless rendering dependency story is intentionally solved.

## Explicitly Deferred

- React/JSX adapter.
- Cloud rendering.
- Full DOM/CSS compatibility.
- Server render farm.
- Multi-composition bundling beyond simple local modules.
- Asset streaming, unless real media testing forces it earlier.
