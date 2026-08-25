# Source of truth and downstream integration

The `motionforge` repository is the authoritative source for every public
MotionForge package and scene contract.

Production applications are downstream consumers. They may contribute
requirements, fixtures, benchmarks, and candidate patches, but they must not
become independent engine forks.

## Integration policy

Preferred, in order:

1. Consume a published, exact MotionForge package version.
2. Consume an exact MotionForge commit through a workspace or package-manager
   override while a release is being prepared.
3. If source vendoring is temporarily unavoidable, sync in one direction from
   this repository into the downstream application with recorded provenance.

A downstream engine fix must be upstreamed here first or immediately
reconciled here with its tests. Do not leave two different implementations
under the same package version.

## Package boundary

The browser engine consists of:

- `@motionforge/schema`
- `@motionforge/core`
- `@motionforge/inspection`
- `@motionforge/commands`
- `@motionforge/runtime`
- `@motionforge/extensions`
- `@motionforge/renderer-canvas2d`
- `@motionforge/export`
- `@motionforge/player`
- `@motionforge/presets`
- `@motionforge/authoring`
- `@motionforge/agent-tools`

The public developer tooling is `@motionforge/cli` and
`create-motionforge`. Package and entry-point ownership is recorded in
[`public-api-ownership.md`](public-api-ownership.md); the accepted post-1.0
boundary is [RFC 0009](rfcs/0009-post-1.0-platform-architecture.md).

These packages must remain independent of application frameworks,
model-provider/agent SDKs, authentication, databases, billing, queues, storage
providers, and product UI. Adapters for those concerns belong in the consuming
application.

`pnpm check:contracts` enforces the mechanical portion of this boundary and
the synchronized-version policy, accepted internal dependency graph, source
import rules, cycle freedom, and public entry-point baseline.

## Change workflow

1. Add or update the scene/runtime contract in this repository.
2. Add unit tests and, for visible output, a pinned-browser golden fixture.
3. Run `pnpm release:full`.
4. Add a changelog entry and bump all public package versions together.
5. Publish or tag the release.
6. Upgrade downstream consumers to the exact new version.

When a downstream product needs behavior that should not become a general
engine feature, implement it as an adapter, macro pack, or extension package
instead of adding product concepts to the core schema.

## Production reconciliation record

Release 0.4.0 reconciled the reusable engine changes that had accumulated in
DojoClip's vendored copy: effect nodes, audio-reactive rendering, sequential
video decoding, player/export lifecycle improvements, agent macros, layout
intents, and their unit tests. Application-specific Video Agent code was not
copied into MotionForge.
