# Dojo Video Engine 1.x compatibility contract

This contract applies to the 1.x source/API line and to externally published
1.x versions once their tag, registry package set, and provenance are verified.
A version in a working-tree manifest or changelog is not by itself a publication
receipt. See [the release process](release-process.md) and the
[1.0 → 1.1 migration note](migrations/1.0-to-1.1.md).

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
- Public entry-point ownership, the MF0 export-map snapshot, and the 1.x
  deprecation/re-export policy are recorded in
  [public-api-ownership.md](public-api-ownership.md).
- Public packages version together. Mixing Dojo Video Engine packages from different
  minor lines in one runtime is unsupported unless a package explicitly
  documents that combination.
- The starter generator package identity from 1.1 onward is
  `@dojo-video-engine/create`; `create-dojo-video-engine` remains the executable name. The
  unrelated unscoped npm package is not part of Dojo Video Engine.

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
- Standard display versions and opaque capability versions are negotiated
  explicitly. Trust, worker, migration, isolation, and distribution rules are
  in [extension-abi.md](extension-abi.md).

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
- Individual public package `engines` fields define their minimum Node runtime.
  The complete repository development/CLI toolchain currently requires Node
  20.19 or newer because of its production build tooling; an engine library may
  retain a lower minimum only when all of its dependencies and tests support
  it. npm trusted publication uses the newer Node/npm versions required by npm
  and is not evidence that runtime consumers require that release-job version.
- Browser media APIs require their documented Canvas/WebCodecs/Web Audio
  capabilities.
- Technical acceptance of an end-of-life Node/browser version is not a security
  support promise. See [SECURITY.md](../SECURITY.md).

## Deprecation and security

- The deprecation notice/re-export policy is in
  [public-api-ownership.md](public-api-ownership.md) and governed by
  [GOVERNANCE.md](../GOVERNANCE.md).
- Security support windows and safe-rejection exceptions are in
  [SECURITY.md](../SECURITY.md).
- Release evidence, rollback, partial publication, and advisory handling follow
  [release-process.md](release-process.md).
