# MF2 media lifecycle and capability contract

Date: 2026-08-26
Status: implemented

## Scope

MF2 makes browser media an explicit, bounded lease rather than incidental
renderer state. It does not add a cloud renderer or semantic media analysis.
The host continues to own authentication, signed URLs, derived proxies,
storage, and fallback infrastructure.

## Public lifecycle

```ts
const assets = await resolveAssets(scene, {
  signal,
  assetPolicy,
  budget,
});

try {
  const resolved = await prepareFrame(scene, frame, assets, { signal });
  renderStill(context, scene, frame, { assets, resolvedScene: resolved });
} finally {
  await disposeAssetsAsync(assets);
}
```

- Resolution is transactional. All started media and extension tasks settle,
  then a failed or cancelled transaction rolls back every acquired image,
  font lease, media input, Lottie player, cursor, and extension resource.
- `disposeAssetsAsync()` is idempotent, aggregates cleanup errors, stops decode
  cursors before closing their Inputs, and is the authoritative ownership API.
  `disposeAssets()` remains as a 1.x-compatible best-effort void facade.
- Preparation is serialized per `ResolvedAssets` lease. Frame maps commit only
  after the complete frame succeeds and inactive staging state is pruned.
  Independent leases may prepare concurrently.
- A resolved source manifest rejects reuse after an asset id changes source.
  Hosts can preserve compatibility across signed-URL rotation by supplying a
  stable `metadata.contentHash` or `AssetPolicy.contentKey`.

## Host-owned AssetPolicy

`AssetPolicy` is injected into `resolveAssets()` and is shared by direct and
range-backed media reads. Its callbacks cover:

- derived proxy selection and explicit proxy opt-out;
- scheme, origin, host, and application-specific authorization;
- credentials, headers, and a custom Fetch implementation;
- one bounded signed-URL refresh after HTTP 401/403;
- MIME/response validation and stable content identity;
- declared, header, Content-Range, streamed, and cumulative range byte limits;
- AbortSignal propagation without provider-specific code in Dojo Video Engine.

Default policy preserves the 1.0 source behavior while the engine's
`maxAssetBytes` budget still provides a finite buffered-asset ceiling. Agent-
authored or privileged-headless scenes should always receive a restrictive
host policy.

## Bounded caches

- The built-in audio-analysis cache is a byte-bounded LRU, coalesces concurrent
  identical analysis, drops failed pending work, and keys results by stable
  content identity plus algorithm, mode, fps, and duration.
- Font caches coalesce concurrent loads and return reference-counted leases.
  Unused faces are removed from their `FontFaceSet` when bounded eviction is
  needed. The built-in process cache has fixed 32-face / 64 MiB ceilings;
  `maxFontCacheEntries` also caps reachable fonts in one resolution. A host
  that needs another resident ceiling injects one explicit `fontCache`.
- Source range caches, decoded image memory, per-asset bytes, font entries,
  audio-analysis bytes, Lottie readiness, and simultaneous video decoders are
  all governed by `MediaResourceBudget`.

## Capability and export contract

- Canvas preflight uses reachable assets instead of unused declarations.
- `metadata.hasAudio` makes embedded-video soundtracks request AudioDecoder
  during preflight; an undeclared soundtrack is checked immediately after
  media probing and before encoder start.
- Main-thread and worker preflight share the same Canvas, decoder, extension,
  OffscreenCanvas, and encoder diagnostics. Duplicate active worker export ids
  fail instead of replacing cancellation ownership.
- Internally resolved export assets are disposed through an asynchronous
  `finally` path on setup failure, render failure, cancellation, verification,
  and success. Caller-supplied assets remain caller-owned.
- `exportVideoWithFallback()` calls a host callback only when browser preflight
  fails. Dojo Video Engine neither selects nor operates a remote renderer.

Blob export defaults to `verification: "container"`. Verification rereads the
finished MP4, validates tracks, dimensions, one-frame duration tolerance,
audio presence, and A/V duration sync with at most four 1024-sample encoder
priming/padding frames. `sampled` and `full` add bounded frame
and audio decoding, nonblank pixels, and audible-signal checks; `full` is
capped at 120 representative video frames and 32 audio windows. `none` is
explicitly unverified. Streaming/custom sinks never trigger hidden buffering:
without a host `verificationSink` they return `unverified`.

## Compatibility and limits

- Scene v1 stays canonical. MF2 only adds strict optional technical metadata:
  MIME, content identity, rational source frame rate, VFR flag, and embedded
  audio facts.
- Integer composition time remains unchanged. VFR and 30000/1001 sources map
  through decoded presentation timestamps expressed in source seconds.
- Existing `disposeAssets()` and three-argument `prepareFrame()` calls remain
  valid. New callers should await `disposeAssetsAsync()` and pass cancellation
  explicitly.
- Pixel/audio verification is intentionally sampled and browser-codec
  dependent. It cannot prove that a tiny or very brief detail exists between
  samples. Cross-browser goldens remain the stronger renderer regression gate.
- An extension that ignores its AbortSignal and never settles can delay
  transactional rollback; extension trust and timeout isolation continue in
  the extension-governance workstream.

## Verification matrix

Focused deterministic coverage includes partial failure, cancellation,
dispose ordering/idempotency, per-lease frame serialization, stale source
identity, proxy/refresh/auth/MIME/byte policy, pending read abort, analysis/font
cache bounds and coalescing, Lottie failure/abort/timeout listener cleanup,
VFR/NTSC timestamp mapping, embedded-video audio capability, export ownership,
worker id collisions, player seek serialization/construction rollback, audio
decode cancellation, malformed verification input, sink verification, and
verification resource disposal.

The milestone exit command `pnpm release:full` passed. Focused totals were 119
renderer/media, 47 export, and 23 player tests. The gate also passed all
workspace suites/types/contracts/builds, 750-scene fuzzing, the 28-scene
corpus, seven long-resource checks, verified video/audio/tool goldens, all
three browser probes, 10 E2E checks, performance at or below 6.1 ms/frame and
26 MiB heap, CLI/starter smoke, and all package dry-runs. `pnpm verify:clean`
also packed the publishable workspace, installed the generated starter outside
the monorepo, and passed validate/migrate/inspect/lint/build against the packed
artifacts.
