# @motionforge/export

Browser-native video export for [motionforge](https://github.com/PansaLegrand/motionforge) scenes: the same deterministic Canvas2D renderer that drives preview feeds WebCodecs frame by frame, and [mediabunny](https://github.com/Vanilagy/mediabunny) muxes the result to MP4 — entirely in the browser, no server.

## Install

```sh
npm install @motionforge/export
```

## Usage

```ts
import { detectExportCapability, exportVideo } from "@motionforge/export";

if (!detectExportCapability().videoEncoder) {
  // Gate export UI: this browser has no WebCodecs encoder.
}

const { blob, codec, totalFrames } = await exportVideo({
  scene,
  onProgress: ({ frameIndex, totalFrames }) => {
    console.log(`encoding ${frameIndex + 1}/${totalFrames}`);
  },
});
// blob is a video/mp4 Blob ready to download or upload.
```

Options: `startFrame`/`endFrame` export a sub-range, `signal` aborts cleanly, `bitrate` takes bits/s or a mediabunny `Quality` preset, `codecs` restricts codec choice (by default the first MP4-compatible codec this browser can encode is used — AVC where available, falling back to VP9/AV1 in Chromium-only builds), `extensions` supplies trusted versioned definitions (`worker: true` enforces worker-compatible definitions), and `assets` accepts pre-resolved assets from `resolveAssets()` — when omitted, `exportVideo()` resolves the scene's assets itself before the frame loop.

Audio is mixed into the MP4 in windows (`audioChunkSeconds`, default 10 s), so long exports avoid one whole-scene PCM buffer. Decoded source clips are still opened through the explicit asset resolver; call `disposeAssets(assets)` when reusing/resolving assets yourself.

## Lower-level frame loop

`renderFrameSequence()` is the deterministic bridge `exportVideo()` is built on — use it to feed frames into your own encoder or pipeline:

```ts
import { renderFrameSequence } from "@motionforge/export";

await renderFrameSequence({
  scene,
  context,
  onFrame: ({ frame, timestampUs, sceneTimestampUs }) => {
    // timestampUs is export-relative; sceneTimestampUs is scene-relative.
  },
});
```

## API Stability

Stable for 0.x integrations:

- Browser export surface: `detectExportCapability()` and `exportVideo()`.
- Frame-loop surface: `renderFrameSequence()` plus `RenderFrameSequenceOptions`, `RenderFrameSequenceProgress`, `RenderedSequenceFrame`, and `RenderFrameSequenceResult`.
- User-facing result/option types: `ExportVideoOptions`, `ExportVideoResult`, and `ExportCapability`.

Experimental before 1.0:

- Audio math helpers (`collectAudioPlacements()`, `mixSceneAudio()`, `mixAudioSegments()`, `audioChunkRanges()`, `evaluateVolumeEnvelope()`, `loopedSourceRanges()`) are exported for tests, player preview, and custom pipelines, but may be reorganized once longer-scene audio work settles.
- `AudioPlacement`, `AudioSegment`, and `LoopedSourceRange` are low-level data shapes rather than authoring contracts.

Internal/not public:

- MP4 muxing details, codec selection internals, and mediabunny object wiring are implementation details. Gate UI on `detectExportCapability()` instead of assuming a codec.
- Files outside the package root export are implementation details.

## License

MIT
