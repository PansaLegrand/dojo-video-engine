# MotionForge 1.x compatibility contract

## Scene documents

- Scene v1 is stable for the full 1.x line.
- Existing field meaning, timing, units, defaults, and rendered semantics do
  not change silently.
- New optional fields and enum members may be added in minor releases.
- Removing/renaming fields or changing defaults/timing requires a new scene
  schema version plus deterministic migration.
- Legacy v0 remains accepted through the documented v0 → v1 migration.
- Unknown fields and future schema versions fail loudly.

## Packages

- Public root exports follow SemVer from 1.0 onward.
- New exports and optional options are minor changes.
- Removing exports, narrowing accepted input, or changing result meaning is a
  major change.
- Deep `src/*` / `dist/*` imports are never public API.
- Renderer-internal decoded resource shapes remain advanced APIs and may gain
  additive fields; lifecycle ordering and public entry points are stable.

## Rendering

- Given the same canonical scene, frame, trusted extension versions, assets,
  fonts, and browser engine version, rendering is deterministic.
- Intentional renderer bug fixes that change pixels require release notes and
  updated goldens.
- Preview/export/worker/stream/headless adapters use the same renderer and
  audio mixer.

## Extensions and presets

- Stored extension descriptors use exact versions. Compatibility aliases are
  explicit and must preserve pixel semantics.
- Scene JSON never carries executable extension code.
- Preset/macro names are authoring metadata and compile away before storage.
- Registry manifests and parameter JSON Schemas may gain additive metadata.

## Agent tools

- Published tool names and required input fields are stable in 1.x.
- Structured results may gain additive fields.
- Patches remain transactional and id-addressed.
- Capability discovery is derived from runtime registries, not static prompt
  copies.

## Runtime support

- Chromium, Firefox, and WebKit must pass the renderer probe gate.
- WebCodecs MP4 export is capability-gated; unsupported browsers may use the
  worker/headless protocol with an external compatible runtime.
- Node 18+ is supported for data/build/tool APIs; browser media APIs require
  their documented Canvas/WebCodecs/Web Audio capabilities.
