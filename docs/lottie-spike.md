# Lottie node spike — findings and integration design

**Date:** 2026-06-11 · **Status:** complete — **implemented** (lottie asset/node types shipped per this design) · **Spike code:** `tools/spike-lottie` (throwaway — this document is the deliverable)
**Question:** can Lottie animations render as deterministic, frame-exact pixels inside dojo-video-engine's pure `(scene, frame)` contract?

## Verdict: yes — green-light the `lottie` node

lottie-web's canvas renderer, driven with `autoplay: false` + `goToAndStop(frame, true)` into a context we own, behaves exactly like our video decode path:

| Check                                | Result                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Same frame → same pixels, repeated   | ✅ identical hashes                                                                              |
| Same frame after seeking _backwards_ | ✅ identical (no internal-state leakage)                                                         |
| Distinct frames differ               | ✅                                                                                               |
| Cross-process/run pixel determinism  | ✅ identical PNG sha across two full browser launches                                            |
| Seek cost (200×200 shape layer)      | ~3 ms/frame — same order as our video staging                                                    |
| Out-of-range frames                  | ⚠️ **no clamp** — frame 999 ≠ last frame; the integration must clamp like `videoSourceTime` does |

## Integration design (follow-up slice, not this spike)

Follow the video-node pattern exactly — Lottie is "footage with a JSON codec":

- **Schema:** asset type `"lottie"` (src → Lottie JSON document); node type `lottie` with `assetId`, optional `playbackRate`, drawn with `objectFit`/`objectPosition` like other media. Frame mapping mirrors video: `lottieFrame = clamp((localFrame / scene.fps) × playbackRate × lottie.fr, ip, op − 1)` — scenes outlasting the animation hold the last frame.
- **Renderer:** `resolveAssets()` fetches + parses the JSON and instantiates one offscreen lottie-web canvas player per asset; `prepareFrame()` seeks and stages the canvas (the async phase); `renderStill()` draws the staged canvas synchronously. `disposeAssetsAsync()` awaits transactional teardown and calls `animation.destroy()`.
- **Dependency policy:** lottie-web (~310 KB min, MIT) must **not** become a hard dependency of `@dojo-video-engine/renderer-canvas2d`. Make it an optional peer dependency, dynamically imported inside `resolveAssets()` only when the scene contains a lottie asset, with an actionable error otherwise: _"Scene uses lottie asset X; install lottie-web (optional peer dependency) to render it."_ Scenes without Lottie pay zero bytes.

## Determinism caveats to enforce

1. **Clamp frames** before `goToAndStop` (verified non-clamping above).
2. **Reject expressions.** Lottie files can embed JS expressions which may call `Date`/`Math.random` — both banned by the determinism contract. Validation should reject documents containing expression fields (`"x": "var $bm_..."`-style strings) loudly rather than render nondeterministically. Most design-tool exports (LottieFiles stickers, icon packs) contain none.
3. **Image-layer Lotties** reference external bitmaps; v0 should accept only self-contained vector documents (assets array entries with `p`/`u` image paths → reject with a message). Revisit if real files demand it.
4. Worker/OffscreenCanvas compatibility is unverified — lottie-web touches `document` in places. Fine for now: the playground and export both run on the main thread.

## Why this matters

Stickers, animated icons, and motion-design flourishes are the visual vocabulary short-form video lives on, and LottieFiles is the largest free library of them. One node type makes every one of those assets a timeline citizen — and they stay JSON end to end, which agents can reference by URL without us inventing an animation format.
