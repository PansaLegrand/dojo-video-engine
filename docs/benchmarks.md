# Export benchmarks

Measured with `pnpm --filter @motionforge/golden run benchmark [width height fps seconds]` — headless pinned Chromium, Apple Silicon, AVC encode via WebCodecs, synthesized full-motion footage (animated gradient + moving box) so the encoder sees real per-frame change. Stage 1 is pure render+encode; stages 2–3 round-trip the footage through video nodes (decode + composite + encode — the real workload).

Run `pnpm resource:smoke` for the cheap long-scene resource gate. It does not encode media; it asserts 10-minute audio chunk coverage, looped-bed source range splitting, volume-envelope chunk offsets, and many-node evaluate/layout behavior.

## 1.0 pinned performance gate (2026-08-24)

1280×720 @30 fps, 2 seconds, pinned Chromium:

| Stage                               | ms/frame  | JS heap after stage |
| ----------------------------------- | --------- | ------------------- |
| render + encode                     | 6.27–6.32 | 12 MiB              |
| 1 video node + caption              | 6.04–6.38 | 16 MiB              |
| 2 video nodes (full + PiP @2× rate) | 6.15–6.76 | 20 MiB              |

The enforced budgets are 100 ms/frame and 256 MiB. Run `pnpm performance:gate`.

## 1920×1080 @ 30 fps (2026-06-11)

| Stage                               | 10 s (300 f)  | 30 s (900 f)  |
| ----------------------------------- | ------------- | ------------- |
| render + encode, no decode          | 10.0 ms/frame | 7.5 ms/frame  |
| 1 video node + styled caption       | 21.0 ms/frame | 16.8 ms/frame |
| 2 video nodes (full + PiP @2× rate) | 37.0 ms/frame | 29.0 ms/frame |
| JS heap after heaviest stage        | 35 MiB        | 46 MiB        |

A 30-second 1080p export with **two simultaneous decoders finishes in 26 s — faster than realtime**. Per-frame cost _improves_ with scene length (warm-up amortizes), and heap stays flat from 300 to 900 frames: no leak, no growth cliff.

## 1080×1920 (vertical) @ 30 fps, 10 s

Same profile as landscape: 7.5 / 19.2 / 33.6 ms per frame, ≤ 40 MiB heap.

## Local media reality check (2026-06-17)

The chat app now treats large uploaded files as a product readiness state, not as a silent implementation detail.

Current local-media path:

- Upload/probe uses browser object URLs and media elements (`<img>`, `<video>`, `<audio>`) to read dimensions, durations, and thumbnails.
- Preview/export resolves renderable scene assets through `resolveAssets()`.
- HTTP(S) video/audio uses bounded range-backed `UrlSource`; local `blob:`/data sources remain buffer-backed. Declared proxies and source modes let hosts choose explicitly.

Readiness thresholds:

| Asset size   | UI behavior                                             | Product interpretation                                                                                 |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `< 100 MB`   | Normal ready/error state                                | Expected to work in supported desktop browsers if the codec/container decodes.                         |
| `100-499 MB` | Asset remains usable, marked `large`                    | Preview/export can be memory-heavy because the whole source is loaded as a blob.                       |
| `>= 500 MB`  | Asset remains usable, marked `large` with stronger copy | Browser memory pressure is likely enough that users should try a shorter proxy if decode/export fails. |

Manual device QA still needs real phone clips in this matrix:

| Fixture                   | Upload/probe         | Preview | Sequence + trim | Export  | Notes                                                                        |
| ------------------------- | -------------------- | ------- | --------------- | ------- | ---------------------------------------------------------------------------- |
| 100 MB iPhone/Android MP4 | pending real fixture | pending | pending         | pending | Should validate the warning boundary and normal desktop behavior.            |
| 250 MB iPhone/Android MP4 | pending real fixture | pending | pending         | pending | Expected to expose source-load latency before frame-loop cost.               |
| 500 MB iPhone/Android MP4 | pending real fixture | pending | pending         | pending | Expected to determine whether streaming must move from deferred to required. |

Streaming-source decision: **implemented for HTTP(S)** with a bounded cache.
Local browser object URLs remain buffer-backed because browsers do not expose a
portable random-access file path through a blob URL; use proxies for very large
local sources.

## Conclusions

1. **Worker export is an orchestration boundary, not a second renderer.** It keeps UI responsive and uses the same measured pipeline; it is not parallel frame rendering.
2. **HTTP source memory is bounded.** Local blob sources still scale with source size, while reachable loading, proxies, and decoder/image/cache budgets make the boundary explicit.
3. **Export audio is chunked.** `exportVideo()` mixes audio in windows (`audioChunkSeconds`, default 10 s), so the final AAC path does not require one whole-scene PCM buffer. Golden browser checks force 0.4 s chunks and verify decoded RMS windows.
4. **Preview audio is chunked.** The default backend mixes only the bounded chunk around the current play/seek position and schedules later chunks on demand.
5. **Looped beds are range-split, not duplicated.** `loop: true` audio nodes split source ranges on demand, so long beds do not need manually duplicated nodes. `pnpm resource:smoke` checks a 10-minute looped bed.

Re-run after any renderer/export change that touches the frame loop; paste new rows above with the date.
