# MF5 prepared Scene runtime contract and evidence

Date: 2026-08-26  
Milestone: MF5 — reusable prepared Scene runtime

MF5 adds one renderer-neutral owner for a prepared Scene revision. The runtime
does not replace Scene JSON, frame evaluation, Canvas rendering, player audio,
or export orchestration. It coordinates their lifetime so an editor can make
many small changes without decoding every unchanged resource again.

## Public boundary

`@dojo-video-engine/runtime` owns:

- strict Scene loading and backend preflight;
- monotonic revisions and latest-intent generations;
- transactional `updateScene()` publication and rollback;
- prepared-frame tokens that cannot cross a session, revision, or generation;
- serialized compatibility scopes for legacy consumers of backend state;
- portable phase events, stable error codes, cancellation, and idempotent
  asynchronous disposal;
- bounded, transactional frame-image artifact delivery to a host sink.

`@dojo-video-engine/renderer-canvas2d/runtime` supplies the reference backend,
`createCanvas2DSceneRuntime()`, resolved text/media metrics, and
`withCanvas2DResolvedAssets()`. The base runtime has no DOM, Canvas, encoder,
storage, application, or model-provider dependency.

Scene remains the canonical artifact. Prepared sessions, decoded media,
metrics caches, prepared-frame tokens, and artifact writers are ephemeral and
must not be persisted.

## Update and ownership semantics

An update prepares a provisional backend state against the current committed
state. Only its synchronous transaction `commit()` may publish that state. A
stale, aborted, failed, or superseded update rolls the provisional state back;
it cannot overwrite a newer revision.

Canvas media leases use a compatibility key that includes source/content,
resource policy, proxy/source mode, budgets, and relevant cache ownership.
Unchanged image, font, video, audio, Lottie, waveform, spectrum, and extension
resources retain the same decoded owner. Replaced resources release after the
new revision commits, and the underlying resource is disposed only after its
final lease. Partial preparation failure rolls every retained provisional
reference back.

Opaque extensions are conservative by default. An extension opts into reuse
with a bounded synchronous `reuseKey()` and is reused only when its definition,
Canvas adapter, requested version, worker mode, complete requirements, and
required resolved-asset identities also agree. Extensions without that hook
are reacquired.

The resource update summary reports built-in asset ids and
`extension-node:<nodeId>` entries as reused, loaded, replaced, or removed.

## Frames, compatibility, and audio

`prepareFrame()` returns an opaque token tied to the session, revision,
generation, and frame. A later preparation, legacy staging scope, Scene
update, or disposal invalidates stale Canvas tokens. Runtime rendering uses an
owned staging surface so a failed nested draw cannot corrupt a host target;
the final composite clears prior pixels, uses neutral draw state, and restores
the caller state.

`capabilities.audioResources` means the prepared backend state contains the
same audio-bearing media that existing preview/mix/export APIs consume. It is
not a renderer-neutral PCM-rendering claim. Player and export compatibility
helpers borrow Canvas assets for their complete operation/lifetime and never
dispose runtime-owned resources. An update aborts an active borrow before it
can replace those resources.

## Metrics

Core owns generic text and media intrinsic-metrics contracts. Every measured
field records `exact`, `declared`, or `estimated` provenance and an optional
reason. Providers receive frozen defensive inputs and cannot mutate the
canonical Scene. Bounded providers use deterministic LRU eviction and do not
retain unbounded keys. Inspection and Canvas runtime metrics consume the same
normalization rules.

## Events, failures, and artifacts

Every operation emits a start event and exactly one complete or error event.
Events are ordered per session and listener failures cannot affect engine
behavior. Progress details are reduced to bounded plain JSON; cyclic, shared,
non-finite, non-plain, excessively deep, or oversized data becomes a bounded
`serializationError` object.

`RuntimeError` exposes stable code, phase, backend, revision/frame context,
retryability, bounded JSON details, and a safe cause summary. Cleanup failures
remain inside the same taxonomy and preserve serialized primary and cleanup
evidence.

A frame artifact is written through a host-owned transaction:
`begin` → awaited chunks → one `commit` or `abort`. Descriptor and receipt data
are bounded JSON; DOM objects and bytes never enter Scene data. Abort and size
checks cover Canvas encoding and `Blob.arrayBuffer()`, including late-settling
browser promises. Once a sink commit succeeds, its receipt wins concurrent
update cancellation; an invalid committed receipt is reported without an
impossible abort claim.

## Compatibility limits

- The compatibility asset scope is serialized. Do not retain its Scene or
  resolved assets after the callback/player/export operation settles.
- Canvas extension reuse is explicit; Dojo Video Engine cannot infer the lifetime of
  arbitrary opaque state.
- Frame-image artifacts currently support the Canvas backend's declared PNG,
  JPEG, and WebP encoders. Video muxing stays in `@dojo-video-engine/export`.
- MF5 deliberately does not introduce a display list, new layout vocabulary,
  second renderer, durable session store, or collaborative revision service.

## Verification

The milestone gate includes:

- runtime unit coverage for initialization/cleanup, stale revisions,
  latest-intent update races, token ownership, commit/rollback/disposal races,
  event portability, strict receipts, artifact cancellation, and sink failure;
- Canvas coverage for native and extension lease reuse, replacement and
  rollback, headless factories, metrics provenance/cache isolation, stale
  staging, neutral target compositing, encode cancellation, and exception-safe
  Canvas state;
- player/export compatibility tests plus pinned-Chromium frame and audio
  parity checks using runtime-borrowed assets;
- package contracts, full release gates, and packed external imports of both
  new public entry points.

Run the focused checks with:

```sh
pnpm --filter @dojo-video-engine/runtime test
pnpm --filter @dojo-video-engine/renderer-canvas2d test
pnpm --filter @dojo-video-engine/player test
pnpm --filter @dojo-video-engine/export test
pnpm golden:test
pnpm release:full
pnpm verify:clean
```

Final evidence on 2026-08-26: the full gate passed 864 unit tests,
750 generated Scenes / 2,250 evaluated frames, 28 corpus Scenes, seven resource
checks, the complete browser pixel/media/audio/tool suite, Chromium/Firefox/
WebKit probes, 10 playground E2E checks, and the 1280×720 performance gate at a
worst stage of 6.22 ms/frame and 30 MiB heap. All 14 public packages packed;
the clean external starter imported and executed both runtime entry points and
passed validate, migrate, inspect, lint, and build.
