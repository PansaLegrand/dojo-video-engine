# RFC 0007 — Worker and streaming export runtime

- Status: Accepted
- Date: 2026-08-24
- Target release: 0.10.0

## Summary

MotionForge export is one renderer/audio pipeline with multiple orchestration
and output adapters: buffered main-thread export, worker export, positional
stream output, and headless message handling.

## Preflight and estimation

`estimateExport()` reports frame count, duration, raw RGBA work, approximate
encoded bytes, audio presence, and media resource estimates.

`preflightExport()` combines encoder/worker/OffscreenCanvas capability with
Canvas renderer and media-budget preflight. Errors block export; warnings such
as unavailable Worker preserve a valid main-thread fallback.

## Output targets

`exportVideo()` remains the backwards-compatible Blob API.
`exportVideoToStream()` writes Mediabunny positional chunks to a caller-owned
`WritableStream`, propagating backpressure without retaining the final file in
MotionForge memory. The browser smoke reconstructs a streamed MP4 and validates
its `ftyp` header.

## Worker protocol

`@motionforge/export/worker` provides:

- serializable start/cancel requests;
- progress/complete/error events keyed by request id;
- `ExportWorkerClient` for application code;
- `createExportWorkerHandler()` and `installExportWorker()` for dedicated Web
  Workers or headless/cloud message adapters.

Extension code is installed inside the worker host and is never cloned through
the request. Worker export forces renderer worker-compatibility preflight.

## Cancellation and progress

Each worker job owns an AbortController. Cancellation flows through asset
resolution, frame sequencing, and muxer cancellation. Progress uses the same
frame/timestamp payload as main-thread export and is throttled by the existing
`progressIntervalMs` option.

## Determinism

1. Every adapter calls the same `renderFrameSequence`, asset resolver, audio
   mixer, Canvas source, and MP4 muxer.
2. Output targets change storage/backpressure only, never frames or timestamps.
3. Worker messages carry canonical Scene v1 plus serializable export options.
4. Headless hosts implement the same request/event protocol and capability
   checks instead of maintaining a server-only renderer fork.
