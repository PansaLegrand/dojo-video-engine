# RFC 0008 — Stable agent tool surface

- Status: Accepted
- Date: 2026-08-24
- Target release: 0.11.0

## Summary

`@motionforge/agent-tools` exposes the complete agent-native workflow as stable
data and browser-media APIs instead of requiring product-specific wrappers.

## Data tools

- validate and normalize;
- migrate to canonical Scene v1;
- inspect capabilities/resources;
- lint suspicious-but-valid data;
- apply transactional id-addressed patches;
- produce semantic scene diffs.

Diffs address arrays of nodes/assets by stable id and report ordering changes
separately, so agents do not receive noisy index cascades.

## Capability discovery

Discovery derives from runtime sources:

- schema node/style/effect catalogs;
- 38 motion preset manifests and parameter JSON Schemas;
- macro registry names and generated prompt guide;
- installed extension manifests;
- current export capabilities.

No hand-maintained duplicate capability prompt is authoritative.

## Media tools

Browser-capable hosts get still rendering, contact-sheet rendering, export
estimation/preflight, and MP4 export over the same resolver/renderer/exporter.
Callers may supply resolved assets or trusted extension registries.

## Function-calling registry

`createAgentToolRegistry()` publishes names, descriptions, and draft-07 input
JSON Schemas. `call()` executes the same direct APIs. Canvas/Blob tools return
native browser objects; data tools return structured-clone-safe JSON values.

## CLI

The CLI adds semantic `diff` and runtime `capabilities` commands alongside
validate/print/migrate/inspect/lint/dev.

## Compatibility

1. Tool names and required input fields are stable through 1.x.
2. Result objects may gain additive fields.
3. Scene mutation remains transactional and validation-backed.
4. Executable extension code is never returned through discovery.
