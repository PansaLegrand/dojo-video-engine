# RFC 0003 — Versioned deterministic extension kernel

- Status: Accepted
- Date: 2026-08-23
- Target release: 0.6.0

The current 1.x host trust, capability, worker, migration, failure-isolation,
and signing/distribution policy is maintained in
[`../extension-abi.md`](../extension-abi.md).

## Summary

MotionForge extensions add trusted runtime capabilities without allowing scene
documents or agents to carry executable code. A scene names a versioned
extension and supplies bounded JSON parameters; the host supplies the matching
installed definition and renderer adapter.

## Scene contract

An extension is a normal timed/layout node:

```json
{
  "id": "brand-grid",
  "type": "extension",
  "extension": {
    "name": "com.example.brand-grid",
    "version": "1.0.0",
    "params": {
      "color": "#22d3ee",
      "columns": 8
    }
  },
  "from": 0,
  "duration": 120,
  "style": {
    "position": "absolute",
    "inset": 0
  }
}
```

The descriptor is data only. `name` is a stable namespaced identifier;
`version` is an exact semantic version; `params` is a JSON object validated by
the installed definition. Unknown extension fields are rejected by Scene v1.

Exact versions make stored scenes reproducible. A definition may explicitly
list older exact versions in `compatibleVersions`; MotionForge does not infer
SemVer compatibility or silently choose a newer implementation.

## Trusted definition contract

`@motionforge/extensions` provides `defineExtension()` and
`createExtensionRegistry()`.

A definition declares:

- stable `name` and `version`;
- `compatibleVersions` when one implementation intentionally preserves older
  pixel semantics;
- a Zod-compatible parameter schema;
- `deterministic: true`;
- `workerCompatible`;
- supported renderer adapter ids;
- optional asset discovery and asynchronous asset-resolution hooks;
- optional per-frame preparation;
- renderer-specific adapters such as `canvas2d` draw.

The registry rejects duplicate name/version pairs and definitions that do not
declare deterministic behavior.

## Asset lifecycle

An extension may derive typed asset requirements from validated params. During
preflight, missing or mistyped assets are reported before resolution.

Runtime lifecycle:

```txt
Scene node + registry
  -> validate params/version/renderer/worker support
  -> discover typed scene assets
  -> resolve extension assets once per scene/node
  -> prepare optional node-local frame data
  -> draw through the selected renderer adapter
  -> dispose resolved resources
```

Resolved and prepared values are runtime-only and never enter the scene JSON.
The renderer owns lifecycle ordering and disposal.

## Preflight

`preflightExtensions()` returns every extension-node result plus typed issues:

- extension not installed;
- incompatible version;
- invalid parameters;
- missing or mistyped asset;
- renderer unsupported;
- worker execution unsupported.

Renderers must preflight before calling any extension hook. A partially
supported scene never silently omits an extension layer.

## Determinism and security

1. Scene JSON never contains JavaScript, module URLs, shader source, or dynamic
   imports.
2. Extension code is installed and trusted by the host application.
3. Random-looking behavior must derive from explicit parameters such as a
   seed, node-local frame, and scene data.
4. Definitions must not read wall-clock time, global randomness, locale, or
   mutable hidden state during frame preparation/draw.
5. Published extensions require unit tests and renderer goldens.
6. Hosts may allowlist extension names before loading a scene from an
   untrusted source.

## Built-in effects

The 0.6 kernel proves the contract with an end-to-end test extension. Existing
built-in effects remain schema-native during this release so adoption does not
change pixels or downstream scenes. Moving stylistic effects into official
packs is a later, separately versioned migration after the kernel is stable.

## Rejected alternatives

### Arbitrary custom draw functions in scene data

Rejected because they cannot be safely validated, migrated, diffed, or
executed when scenes come from agents or untrusted projects.

### One global unversioned registry name

Rejected because changing installed code would silently change pixels for old
stored scenes.

### Treat every extension as a new core node enum member

Rejected because that recreates the hard-coded renderer growth this kernel is
designed to avoid.
