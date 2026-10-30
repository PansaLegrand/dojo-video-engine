# Runtime reconciliation — 2026-10-31

The public engine now owns the renderer, playback, and export patches previously
carried by the harness's vendored source. The source was compared against the
current engine checkout, preserving existing package APIs and restoring NodeNext
`.js` import suffixes for built-package consumers.

Included changes:

- Picture-only proxies retain separately owned original audio.
- Export scratch/static caches and text resources are bounded and reused.
- Asset preparation caps concurrent creators and uses native Blob response bodies.
- Preview audio schedules bounded current/next chunks; seek/cancel releases both.
- Silent host-owned preview rendering has explicit cancellation and ownership.
- Audio mixing preserves bounded preroll, envelope keyframe boundaries, and pipeline ownership.
- AAC exports measure the encoder's priming and repair presentation/tail metadata
  before verification or stream close, preserving encoded media bytes.

The engine gained the matching AAC, envelope, preroll, pipeline, cache, proxy-audio,
asset-preparation, and player regression coverage. No UI or model-agent code moved
into the engine. The old Scene Command v1 facade is not part of this public API.

`pnpm release:full` passed locally: build/type checks, unit tests, package contracts,
schema/migration/determinism checks, scene fuzz/corpus, resource lifecycle, exact
browser pixels, audio/media/export, Chromium/Firefox/WebKit probes, performance,
and package smoke/pack checks. Existing golden pixel baselines were unchanged.
This is local candidate evidence. Registry publication and packaged harness
acceptance are recorded separately after those steps complete.
