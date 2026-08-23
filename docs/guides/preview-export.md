# Preview And Export

MotionForge uses one render path for preview and export. A frame in Studio and the same frame in an exported MP4 come from the same Canvas2D renderer.

## CLI Studio

```sh
motionforge dev src/video.ts
```

Studio provides:

- Canvas preview
- play/pause
- frame scrubber
- source reload
- validation feedback
- generated JSON inspector
- browser MP4 export when WebCodecs is available

Use validation, lint, and canonical printing in CI or scripts:

```sh
motionforge validate src/video.ts
motionforge lint src/video.ts
motionforge print src/video.ts > scene.json
```

## Player API

Use `@motionforge/player` when embedding preview in your own app:

```ts
import { createPlayer } from "@motionforge/player";

const canvas = document.querySelector("canvas")!;
const context = canvas.getContext("2d")!;

canvas.width = scene.width;
canvas.height = scene.height;

const player = await createPlayer({ context, scene, loop: true });

player.on("frame", (frame) => {
  slider.value = String(frame);
});

await player.seek(45);
player.play();
```

Call `player.dispose()` when replacing the scene or unmounting the canvas.

## Export API

```ts
import { detectExportCapability, exportVideo } from "@motionforge/export";

const capability = detectExportCapability();

if (!capability.videoEncoder) {
  throw new Error("MP4 export needs a browser with WebCodecs VideoEncoder.");
}

const { blob } = await exportVideo({
  scene,
  onProgress: ({ frameIndex, totalFrames }) => {
    console.log(`encoding ${frameIndex + 1}/${totalFrames}`);
  },
});

const url = URL.createObjectURL(blob);
```

Useful options:

- `startFrame` / `endFrame` for sub-ranges
- `bitrate` for quality control
- `signal` for aborting
- `assets` to reuse assets you already resolved for preview

## Direct Renderer

Use lower-level rendering for custom pipelines:

```ts
import {
  prepareFrame,
  renderStill,
  resolveAssets,
} from "@motionforge/renderer-canvas2d";

const assets = await resolveAssets(scene);
await prepareFrame(scene, frame, assets);
renderStill(context, scene, frame, { assets });
```

`prepareFrame()` is required before drawing scenes with video or Lottie nodes.

## Browser Caveats

- MP4 export depends on WebCodecs encoder support. Desktop Chrome and Edge are the best current targets.
- Safari may preview scenes but not offer the same export capability.
- Audio preview depends on browser autoplay/user-gesture rules. Export remains the source of truth.
