# Roadmap

The current base-engine path to a stable v1 contract is tracked in
[`v1-roadmap.md`](v1-roadmap.md). This document retains the completed M0 and
chat/editor development history.

Each slice follows the working practice: code + tests + docs + a `progress.md` entry, landed as one commit. motionforge is an independent open-source engine first. Downstream products are reference consumers for requirements and validation, not owners of the roadmap.

## Done — weeks 1–2 (static + time-based media)

All six engine slices landed: asset pipeline + image rendering, font loading with exact-hash text goldens, v0.1.0 release prep, multi-stop/angled gradients + `overflow` clipping, frame-accurate video clips (trim + playbackRate), and audio nodes mixed into the exported MP4. The engine renders all four media types in the browser; 61 unit tests, 14 golden fixtures, and 11 in-browser integration checks are green. Outstanding from this phase: the credential-gated publish (GitHub push, `@motionforge` npm scope, `pnpm publish -r`).

## Week 3 — animation maturity + public launch

The TikTok-captions example exposed the gaps that matter for editor-grade motion. This week makes animation a first-class strength, then ships.

### Slice 8: Transform interpolation (1 day)

`transform` strings currently step. Parse `translate/scale/rotate` function lists and tween numerically between keyframes with matching function sequences (mismatched lists keep stepping, documented). Removes the last ⚠️ row in the support matrix; real scale-pops and slide-ins stop needing the `fontSize`/`width` workaround.

**Done when:** a `scale(1) → scale(1.25)` keyframe pair renders as a smooth tween in an exact golden, and the matrix has no partial rows.

### Slice 9: Easing expansion (0.5–1 day)

Add `cubic-bezier(x1, y1, x2, y2)` easing strings (validated, deterministic solver) and a parameterized deterministic spring preset. Schema change is additive: `easing` widens from the four-name enum to names + bezier strings.

**Done when:** frozen numeric unit tests cover the bezier solver and spring, and a golden uses each.

### Slice 10: `@motionforge/presets` (1–2 days)

A pure helper package that compiles intent into scene data — no runtime, no rendering:

- Motion presets: `popIn`, `fadeUp`, `slideIn(direction)`, `pulse`, with duration/easing options → keyframe arrays.
- Caption generator: ASR-style word timestamps (`{ word, startMs, endMs }[]`) → timed caption nodes in two styles: one-word-at-a-time (the TikTok example, automated) and accumulating karaoke with active-word highlight.

This is simultaneously the agent-facing animation vocabulary and the compiler that the editor's named `enter`/`exit` overlay animations will map onto.

**Done when:** the TikTok example JSON can be regenerated from ~10 lines of preset calls, and presets round-trip through `validateScene`.

### Slice 11: Publish + launch surface (1 day, needs accounts)

- Push to GitHub, green CI, reserve `@motionforge`, publish 0.2.0 (the animation slices justify the bump over the unpublished 0.1.0), tag.
- Keep the playground locally runnable and document generated examples; hosted web-app deployment was later paused by maintainer choice.
- README: embed the example frames/video.

**Done when:** `npm install @motionforge/core` works from a clean machine and the README demo artifacts are easy to inspect locally.

## Done — week 4 prep (caption-grade text)

Slice 12 landed: `textStroke` and text-fitted per-line backgrounds, with exact goldens; `tiktokCaptions()` emits measured background styles.

## The 5-week plan (complete — open-source first)

Ultimate goal: a user chats, uploads media, and gets a video — previewed and exported in the browser. motionforge is the open-source engine that makes that product _assemblable_: deterministic rendering, an agent-native scene contract, and in-browser export. Downstream products (commercial or otherwise) are consumers we learn requirements from, not work items here.

Workstreams: **A** engine, **B** player/perf, **D** agent layer, **E** launch/DX. Package publishing is owned by the maintainer and slots in when ready. Hosted web-app deployment is currently paused; local demos, docs, and generated artifacts remain the launch surface.

### Week 1 — measure the real gap, ship the skeleton ✅ complete

- ✅ **Slice 13 — the editor-adapter spike** (`docs/editor-adapter-spike.md`): two real templates convert 100% and render end-to-end; gap list classified engine/adapter/won't-support. Engine priorities reordered by measured frequency.
- ✅ **Spike-prioritized engine slice**: `filter` chains (13/20 production video overlays use them), `zIndex` sibling paint order, `border`, `boxShadow`. (`shape` node deliberately dropped — zero occurrences in real templates.)
- ✅ **`@motionforge/player`**: deterministic `FrameClock` + canvas render loop (play/pause/seek/loop, latest-frame-wins decode policy); playground now runs on it. Audio preview designed (package README), implementation week 2.
- ✅ **RFC 0001 — scene patch ops** (`docs/rfcs/0001-scene-patch-ops.md`): id-addressed transactional patch vocabulary + mechanical eval harness design (generate/edit/repair suites).
- ✅ **User-oriented docs**: `docs/guides/getting-started.md`.

### Week 2 — close the measured gaps, make preview real (engine side ✅)

- ✅ **A**: video nodes contribute their clip audio to exports (`volume` on video nodes; placements track head clipping; `playbackRate` retimes audio varispeed-style, RMS-verified through two AAC passes).
- ✅ **B**: player audio preview — `WebAudioPreview` plays the exact export mix (`mixSceneAudio` now public) through one cached buffer + `AudioBufferSourceNode`; audio is the master clock (frame clock re-anchors on drift); injectable `AudioPreview` keeps tests deterministic.
- ✅ **D**: `applyScenePatch`/`scenePatchSchema` implemented per RFC 0001 (ten transactional id-addressed ops, closest-id hints, full revalidation); `llms.txt` teaches patching over re-emission.
- Editor-adapter productionization: **dropped from this plan** (2026-06-11 re-scope) — integration work belongs to downstream consumers, on their schedule. The spike doc remains the reference for anyone writing such an adapter.
- ◻ **D**: eval harness runner (generate suite) — moved to week 3.
- ◻ **E**: docs site skeleton — moved to week 5; `docs/guides/getting-started.md` is the seed content.

### Week 3 — make the agent loop tangible ✅ complete

- ✅ **D**: playground **agent console** — paste a scene document or a patch op list into the playground, apply it live (`validateScene`/`applyScenePatch`), see the preview update, read the validator's errors. This is the chat loop minus the LLM: it proves the contract, demos it to strangers, and dogfoods the patch API in a UI.
- ✅ **D**: eval harness runner (`tools/agent-eval`, not shipped): generate + edit suites scored mechanically per RFC 0001; provider-agnostic (any chat endpoint via env), cases and assertions are the asset.
- ✅ **E**: robustness — exact golden fixtures now have committed baseline PNGs; hash mismatches write ignored `received` and red-highlight `diff` PNG artifacts next to the golden snapshots.

### Week 4 — capability depth (in progress)

- ✅ **A**: Lottie node spike — green light (`docs/lottie-spike.md`): pixel-deterministic frame-seek at ~3 ms, integration design recorded (video pattern, optional peer dependency, expression/clamp guards). Implementation is the next A slice.
- ✅ **A**: audio showcase scene — **Audio Sync Pulse**, the playground's first audible demo (synthesized WAV data URL, beat-locked keyframes, AAC export verified). Maintainer eared check pending.
- ✅ **B**: 1080p benchmark (`docs/benchmarks.md`): two-decoder export beats realtime (29 ms/frame), heap flat — **worker-parallel export stays parked**. Memory boundary is BlobSource full-file fetch, not the pipeline.
- ✅ **B**: chunked audio mixing — export audio now mixes in 10 s windows (flat memory at any scene length); golden checks run the chunked path with 0.4 s windows.
- ✅ **A (presets)**: `timeline()`/`stagger()` choreography — the GSAP vocabulary as a pure keyframe compiler with `compileToPatch()`; GSAP itself ruled out (license + runtime philosophy).
- ✅ **A**: `lottie` node implemented per the spike design — optional lottie-web peer dependency, expression/image-layer rejection, clamped frame-exact seek, exact golden with natural + 2× rate nodes. Export and player needed zero changes.
- ◻ **A**: GSAP-to-keyframes baking spike (build-time only) — stretch.

### Week 5 — harden and launch surface ✅ complete (publish steps are the maintainer's)

- ✅ Playwright E2E (`pnpm e2e`): ten checks across player controls, agent console, audio and lottie scenes.
- ✅ Determinism lint in `pnpm lint` (wall-clock/randomness banned in render packages, justified allowlist).
- ✅ Lottie Sticker showcase (seventh scene) demos the headline feature in playground + README.
- ✅ 0.3.0 release prep: changelog, six packages bumped (player joins the versioned set), badge, `npm pack` dry-runs clean.
- ◻ Maintainer: GitHub push + CI, `@motionforge` npm scope + `pnpm publish -r`, tag `v0.3.0`, eared audio check.
- Docs site: deferred by choice — the guides + README are launch-sufficient; pick a platform (VitePress et al) post-launch.

## Phase 2 — the agent loop (current — chat + edit coexistence)

North-star demo: upload a clip → type "add TikTok-style subtitles and a title that pops in" → captions appear, preview plays with sound → the user hides chat and adjusts timing/position manually → Export MP4. No server anywhere.

The reference app direction is recorded in [`docs/chat-edit-app-plan.md`](chat-edit-app-plan.md): chat creates and transforms, manual tools refine and finish, and both surfaces mutate the canonical scene through RFC 0001 patch ops.

The next media-aware editor direction is recorded in [`docs/media-assets-chat-roadmap.md`](media-assets-chat-roadmap.md): uploaded videos/images/audio become first-class assets, chat can reference them with `@` mentions and stable aliases, and media instructions compile into visible patch-backed scene operations.

The next open-source developer experience direction is recorded in [`docs/dx-roadmap.md`](dx-roadmap.md): seconds-first authoring helpers, CLI validation/printing, a project starter, and a developer studio so programmers can write MotionForge videos with Remotion-level first-run clarity while keeping the data-first scene contract.

The next preset/template direction is recorded in [`docs/preset-template-roadmap.md`](preset-template-roadmap.md): richer subtitle, text overlay, media-look, clip-layout, and transition presets so programmers and agents can express useful video style through stable names that compile to normal scene data.

The next preset discovery direction is recorded in [`docs/preset-explorer-roadmap.md`](preset-explorer-roadmap.md): bring the visual preset catalog into the programmer loop through a playground explorer first, then shared gallery preview and Studio adoption.

The next text robustness direction is recorded in [`docs/text-overlay-robustness-roadmap.md`](text-overlay-robustness-roadmap.md): bounded lines, ellipsis, shrink-to-fit, authoring helpers, safe-area placement, preset upgrades, and stress goldens for production-safe text overlays.

The next subtitle overlay direction is recorded in [`docs/subtitle-overlay-roadmap.md`](subtitle-overlay-roadmap.md): segment subtitle tracks, SRT/VTT parsing, authoring docs, robust template semantics, and subtitle stress galleries for production subtitle workflows.

The next image overlay direction is recorded in [`docs/image-overlay-roadmap.md`](image-overlay-roadmap.md): logo, watermark, sticker, product-shot, corner-badge, and avatar overlays with safe-area placement, authoring helpers, patch examples, and stress galleries.

The next video overlay direction is recorded in [`docs/video-overlay-roadmap.md`](video-overlay-roadmap.md): picture-in-picture, reaction-cam, screen-demo, background-loop, b-roll-strip, and video-badge overlays with trims, muted audio defaults, patch examples, and stress galleries.

The next audio overlay direction is recorded in [`docs/audio-overlay-roadmap.md`](audio-overlay-roadmap.md): background music, voiceover, ambience, sound effects, beat accents, notification cues, then truthful engine support for fades, looping, and ducking.

The core engine release-candidate direction is recorded in [`docs/core-engine-rc-roadmap.md`](core-engine-rc-roadmap.md): CLI inspection, public API audit, golden RC matrix, release gates, clean-machine verification, and long-scene/resource confidence.

Decisions recorded 2026-06-12:

- **Lead artifact is the chat app** ("one sentence → video") — it is the highest-buzz demo and _is_ the launch video. Built in **Next.js** (maintainer's framework), as a fully client-side app (static export; BYO Anthropic key kept in the browser, calling the API directly via the CORS opt-in header) so "no server anywhere" stays literally true.
- **Agent distribution ships as an Agent Skill (SKILL.md) first, not an MCP server.** Skills don't replace MCP — they're instructions + scripts for filesystem/bash agents (Claude Code), while MCP is a tool protocol for any client — but for an npm library the skill is the cheaper, more current packaging: the agent installs the packages and runs scripts directly. A thin MCP server can wrap the same scripts later if demand shows; both share one script layer.
- **Client-side ASR (whisper via transformers.js) is deferred to the next cycle.** The caption presets already accept word timings, so the chat app ships with a paste-transcript path; ASR becomes the second marketing wave, spiked before commitment like Lottie was.

### Week 1 — publish + baseline (gates everything public)

- Maintainer publish steps: GitHub push + green CI, claim the `@motionforge` npm scope (note: unscoped `motionforge` is taken by an unrelated package — scoped names only, check it before announcing), `pnpm publish -r` 0.3.0, tag, eared audio check. Web-app publishing remains intentionally disabled until the maintainer opts back in.
- Clean-machine verification: `npm install` all six packages outside the monorepo, render a frame, export an MP4; fix install/docs gaps found.
- **Eval baseline**: run `tools/agent-eval` generate + edit suites against 1–2 real models; commit the numbers. Add the designed repair suite (invalid scene + validator errors → fixing patch).
- **Engine: intrinsic text auto-height** — metrics-provider abstraction so flex intrinsic sizing measures text with the same font metrics render uses (replaces the character-count heuristic, the sharpest documented edge for LLM-generated scenes).

**Done when:** packages install from a clean machine; baseline eval numbers are committed; a text-auto-height golden passes.

### Week 2 — `apps/chat` skeleton (Next.js)

- Scaffold the client-only Next.js app: chat pane beside a `@motionforge/player` preview; local-storage BYO key; `llms.txt`-derived system prompt.
- Conversation protocol: model emits a full scene on the first turn, **patch ops on every later turn** (dogfoods RFC 0001 as the edit vocabulary).
- Auto-repair loop: validation errors are fed back to the model (bounded retries), surfaced in the UI as a visible "fixing…" step — the eval harness's repair suite, live.

**Done when:** on localhost, a typed sentence becomes a valid scene playing with audio, and a follow-up instruction lands as a patch, not a re-emission.

### Week 3 — real media + export in the chat app

- Client-side uploads: image/video/audio become object-URL scene assets; the prompt context lists available assets (id, type, duration, dimensions) so the model can reference them.
- One-click MP4 export with progress UI.
- **Large-file reality check**: real phone footage (100–500 MB) through upload → preview → export; if `BlobSource` full-file fetch hurts, scope the streaming-source spike.
- Captions without ASR: paste a transcript / word timings → `tiktokCaptions()`/`karaokeCaptions()` through chat.
- Tune prompts against eval failures; re-run; record the delta.

**Done when:** the north-star demo runs end to end with a pasted transcript standing in for ASR.

### Week 4 — precision edit layer

- ✅ Evolve the app from chat-only into chat + edit coexistence: collapsible chat, preview remains central, and manual panels appear without changing the canonical document model.
- ✅ Scene projection: derive flat editor layers from the scene for layer list, inspector, and timeline rows.
- ✅ README showcase loader: examples can load real README scene JSON into the editor, which gives manual-edit development realistic documents.
- ✅ Manual patching v0: select a layer, edit text/timing/position/size/opacity/text styling in an inspector, and apply every change through `applyScenePatch`.
- ✅ Visible last-patch/error feedback for developer inspection.
- ✅ Add undo/redo.
- ✅ Extend inspector coverage for color, font size, font weight, alignment, and stroke controls.
- Borrow product patterns from the Dojo editor deliberately: layer rows, timeline block language, inspector ergonomics, caption workflows. Do not port its Remotion/Pixi render path or app-specific project/auth/data contexts.

**Done when:** a user can generate a draft in chat, hide chat, select a layer, manually adjust it, undo the adjustment, and export the resulting scene.

### Week 5 — compact timeline + public launch surface

- ✅ First-touch quality foundation: local first-draft generation is backed by `timeline()` + presets so fallback scenes use designed entrance motion instead of hand-built default keyframes.
- ✅ Starter template examples: the Examples dialog can load preset-backed first drafts directly, while prompt chips remain available for chat-input examples.
- ✅ Honest capability/empty states: export readiness copy now explains no scene, preview loading/error, missing WebCodecs, and JSON fallback.
- ✅ Usable narrow-viewport layout: the editor stacks rail, active panel, preview, and compact timeline below `lg`, with no horizontal overflow in mobile smoke.
- ✅ Compact timeline scrub: click/drag the timeline surface to move the playhead frame.
- ✅ Compact timeline block retiming: drag a timeline block horizontally to preview and commit a patch-backed `retime` update.
- ✅ Compact timeline duration handles: drag a block's right edge to preview and commit a patch-backed duration update.
- ✅ Compact timeline split at playhead: split selected leaf layers into two adjacent patch-backed nodes.
- ✅ Preview selection feedback: selecting a layer draws its canvas-space outline/label in the clip area, with hidden-at-playhead feedback when timing excludes the current frame.
- ✅ Preview direct manipulation: drag a selected bounded layer in the clip area to commit a patch-backed `left`/`top` move.
- Preview resize handles: drag selected-layer handles in the clip area to commit patch-backed size changes.
- Compact timeline editing: snap to neighboring blocks.
- Selection-aware chat: selected node ids and selected time ranges are sent with follow-up prompts so chat can refine exactly what the user is looking at.
- Record the demo video + GIFs from a local build, write the launch post, ship it (HN/X). The eval number is the credibility line under the demo; public hosting can be added later without changing the engine path.

**Done when:** a demo video exists, and the demo shows chat generation followed by manual precision edits.

### Week 6 — agent distribution + launch fallout

- **motionforge Agent Skill**: SKILL.md + scripts — `validate-scene`, `render-frame` (PNG, so the agent _sees_ its work), `export-mp4` — installable in Claude Code. The self-correction GIF (render → notice clipped title → patch → re-render) is the second marketing wave.
- Thin MCP server wrapping the same scripts **only if demand shows** in launch feedback.
- Launch fallout: issue triage, good-first-issues, docs gaps reported by real users.

**Done when:** a fresh Claude Code session with the skill installed produces and visually verifies a video with no chat app involved.

## Explicitly deferred (updated 2026-06-12)

Client-side ASR (next cycle, spike first), full traditional NLE scope, docs-site platform choice, React/JSX authoring adapter, editor-product integrations, CanvasKit renderer, Tauri desktop, streaming video sources (unless real media testing forces the spike), visualizer overlays, CRDT/concurrent editing.
