# RFC 0002 — Scene v1 compatibility and migration contract

- Status: Accepted
- Date: 2026-08-23
- Target release: 0.5.0

## Summary

Scene v1 is Dojo Video Engine's first canonical compatibility contract. New builders,
authoring helpers, examples, and generated scenes emit `schemaVersion: 1`.
Legacy v0 documents remain accepted through deterministic migration.

The v1 data shape initially matches the final 0.4 v0 shape. The version change
freezes semantics rather than introducing visual changes.

## Public behavior

### `sceneSchema`

`sceneSchema` describes only canonical v1. Use it when a tool must require
already-current data.

### `parseScene(input)` and `validateScene(input)`

Both accept:

- canonical v1 scenes;
- legacy v0 scenes that pass the legacy structure and cross-field invariants.

Successful v0 input is returned as a new v1 object. The input is never mutated.
Repeated parsing of the same object is cached and returns the same canonical
object identity.

Future or unknown versions fail with an error naming the supported canonical
version and available migration source versions. Dojo Video Engine never guesses how
to interpret a future document.

### `migrateScene(input)`

Returns:

```ts
type SceneMigrationResult = {
  scene: Scene; // canonical v1
  fromVersion: 0 | 1;
  toVersion: 1;
  migrations: readonly string[];
};
```

The v0 migration performs validation, copies the normalized document, and
changes only `schemaVersion` to 1. It records `scene-v0-to-v1`. Migrating v1 is
an idempotent no-op.

## Referential validation

Scene v1 validates asset references before rendering:

- `img` → image asset;
- `video` → video asset;
- `audio` → audio asset;
- `lottie` → Lottie asset;
- `params.audioAssetId` → audio asset;
- `params.coverAssetId` → image asset.

Missing and mistyped references name the owner, asset id, expected type, and
fix. This changes a prior late renderer failure into an early scene-validation
failure.

## Compatibility rules

Within Scene v1:

1. New optional fields and new enum members may be added in minor releases.
2. Existing field meaning, timing, units, defaults, and render semantics may
   not change silently.
3. Removing or renaming a field, changing its type/default, or changing timing
   semantics requires a new schema version and migration.
4. Renderer bug fixes that intentionally change pixels require goldens,
   changelog documentation, and an explicit release note.
5. Unknown fields remain rejected. Forward compatibility is provided by
   migrations, not by silently ignoring data.

## JSON Schema

`sceneJsonSchema()` and `scene.schema.json` describe canonical v1.
`legacySceneV0JsonSchema()` exists for ingestion tools. The release lint builds
the schema package and compares generated JSON with the committed artifact.

## Inspection and preflight

- `inspectScene()` exposes stable asset/node/effect counts and declared feature
  requirements.
- `lintScene()` reports valid-but-suspicious timing, visibility, audio, animation,
  and unused-asset conditions.
- `preflightCanvas2D()` combines the scene feature inspection with runtime
  Canvas, decoder, font, and Lottie requirements before asset loading.

These APIs keep validation, editorial warnings, and environment capability
checks separate: validation is a correctness gate; lint issues are warnings;
renderer preflight describes whether the current runtime can execute the scene.

## Rejected alternatives

### Keep growing version 0

Rejected because downstream storage cannot distinguish historical semantics,
and future migrations would have no trustworthy starting point.

### Make v0 invalid immediately

Rejected because persisted scenes, examples, and downstream applications need a
safe upgrade path. Canonical output can advance without a flag day.

### Accept future versions by ignoring unknown fields

Rejected because silent data loss violates deterministic rendering and agent
edit safety.
