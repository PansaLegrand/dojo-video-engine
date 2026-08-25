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

Dedicated workers decode through Mediabunny `AudioSampleSink` and copy planar
PCM directly; export does not depend on Web Audio's `AudioBuffer` global.
`mixSceneAudio()` remains the deliberate main-thread wrapper used by player
preview when an `AudioBuffer` is wanted.

Named audio buses support gain, pan, limiting, and node-driven ducking. Public
`measureAudioLoudness()` and `limitAudioPeak()` helpers expose the same
deterministic peak/RMS path used by export. Final export uses original media by
default; set `preferProxy` only for explicit draft exports.

## Worker and streaming export

Use `estimateExport()` / `preflightExport()` before starting expensive work.
`exportVideoToStream(options, writable)` writes positional chunks with
backpressure instead of retaining a final Blob.

`@motionforge/export/worker` exports `ExportWorkerClient`,
`installExportWorker()`, and `createExportWorkerHandler()`. The same protocol
can back a dedicated browser worker or a headless/cloud message adapter; worker
hosts install trusted extensions locally.

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

Stable for 1.x integrations:

- Browser export surface: `detectExportCapability()` and `exportVideo()`.
- Planning/targets: `estimateExport()`, `preflightExport()`, and `exportVideoToStream()`.
- Frame-loop surface: `renderFrameSequence()` plus `RenderFrameSequenceOptions`, `RenderFrameSequenceProgress`, `RenderedSequenceFrame`, and `RenderFrameSequenceResult`.
- User-facing result/option types: `ExportVideoOptions`, `ExportVideoResult`, and `ExportCapability`.

Evolving additively in 1.x:

- Audio math helpers may gain additive bus/streaming helpers; existing 1.x exports remain supported.
- `AudioPlacement`, `AudioSegment`, and `LoopedSourceRange` are low-level data shapes rather than authoring contracts.

Internal/not public:

- MP4 muxing details, codec selection internals, and mediabunny object wiring are implementation details. Gate UI on `detectExportCapability()` instead of assuming a codec.
- Files outside the package root export are implementation details.

## License

MIT
