# RFC 0005 — Serializable animation system

- Status: Accepted
- Date: 2026-08-24
- Target release: 0.8.0

## Summary

Dojo Video Engine animation remains ordinary scene data. The engine adds only the
playback semantics that cannot compile away—repeat/yoyo and named markers.
Higher-level sequence, stagger, motion-path, seeded-signal, mask-reveal, and
named preset intent compiles into normal keyframe tracks before storage/render.

## Keyframe playback

Every keyframe animation may declare:

- `repeat`: 0–1000 additional cycles or `"infinite"`;
- `yoyo`: alternate direction on every repeated cycle.

The mapping from node-local frame to cycle-local frame is pure. Finite playback
holds its correct terminal endpoint; infinite playback remains bounded by the
owning node/scene duration. Existing tracks without these fields are pixel
identical.

Matching filter chains now interpolate numeric arguments, complementing the
existing number, color, and transform interpolation paths.

## Named scene markers

Scene v1 may store `markers: Record<string, frame>`. Names are stable bounded
identifiers and frames must lie inside scene duration. Core builders, patches,
inspection, and timeline compilation preserve markers as data.

## Compilers

`@dojo-video-engine/presets` provides pure compilers:

- timeline `.sequence()`, `.stagger()`, and named `.marker()` positioning;
- distance-weighted `motionPath()` with optional tangent orientation;
- deterministic numeric `seededSignal()` tracks;
- `maskReveal()` for opacity/feather animation;
- `compileMotionPreset()` for the curated registry.

These outputs contain keyframes only. Preset names, callbacks, random-number
generators, and sequencing instructions never enter the scene document.

## Curated registry

The 0.8 registry contains 38 entrance, exit, emphasis, and ambient presets.
Each definition includes:

- stable name, label, description, and category;
- bounded Zod parameter schema;
- thumbnail metadata;
- full-motion compiler;
- reduced-motion compiler that removes spatial motion.

One pinned-browser contact-sheet golden renders every preset at the same frame,
providing visual discovery coverage and a deterministic regression surface.

## Determinism and accessibility

1. Seeded signals use an explicit integer seed and pure PRNG state.
2. Motion paths use finite numeric points and distance-weighted frame mapping.
3. Infinite repeat cannot outlive the owning node/scene.
4. Reduced-motion variants use opacity-only tracks with bounded duration.
5. Preview and export evaluate the same tracks through `evaluateScene()`.
