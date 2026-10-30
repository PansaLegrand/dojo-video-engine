# Extension ABI and trust contract

Status: public 1.x integration policy

Dojo Video Engine's extension ABI is a TypeScript, JSON-manifest, lifecycle, and
display contract. It is not a native binary ABI and it is not a remote plugin
loader. The authoritative implementation is `@dojo-video-engine/extensions`; this
document defines how hosts package, trust, negotiate, migrate, and isolate
extensions without weakening Scene v1.

## Trust boundary

A Scene stores only this data:

```json
{
  "name": "com.example.brand-grid",
  "version": "1.0.0",
  "params": { "columns": 8 }
}
```

It never stores JavaScript, module URLs, signatures, shaders, credentials, or
installation instructions. Loading a Scene cannot install or fetch executable
code. The host separately installs trusted definitions and supplies an
allowlisted registry.

Extension code has the authority of the host realm in which it runs. Zod
parameter validation and output budgets protect the engine from malformed
data; they do not sandbox malicious host-installed code. Untrusted extensions
need a separately designed process/realm sandbox and message protocol. Marking
an extension `workerCompatible` is a compatibility declaration, not a security
sandbox.

## Identity and version resolution

- `name` is a stable namespaced identifier owned by the extension publisher.
- `version` is an exact semantic version. Stored Scenes never use ranges.
- A registry rejects duplicate name/version identities.
- Dojo Video Engine never assumes SemVer compatibility. A definition may resolve an
  older exact version only by listing it in `compatibleVersions`, which asserts
  equivalent accepted parameters, behavior, lifecycle, and pixel semantics.
- The host must be able to keep multiple incompatible extension versions when
  persisted Scenes require them.

An extension package version and its descriptor version may be the same, but
they are separate contracts. The descriptor identity is what a Scene stores.

## Definition and manifest

`defineExtension()` validates a trusted definition. It declares:

- exact identity and optional explicit compatibility aliases;
- a bounded parameter schema;
- `deterministic: true`;
- `workerCompatible`;
- asset discovery and optional resolve/prepare/dispose hooks;
- either a display-list contract or legacy renderer adapters, never both;
- optional immutable cross-revision resource reuse.

`extensionManifest()` and `registry.manifests()` return discovery data, including
parameter JSON Schema and display capabilities. Manifests contain no executable
hook and are safe to expose for capability discovery after normal JSON/output
budgeting. A manifest describes an installed definition; it does not prove its
publisher or integrity.

## Display capability negotiation

Every new definition chooses one display mode.

### Standard display v1

`{kind: "standard", version: "1"}` emits the bounded renderer-neutral v1
subset: rectangles, text, and declared-asset images. Operation ids are stable
and node-scoped; geometry is local to the resolved extension border box.
Finite coordinates, supported paints, string sizes, unique ids, operation
counts, asset references, and serialized bytes are checked before execution.

Adding an optional standard-v1 operation or field is permitted only when an
older target can reject or negotiate it before hooks execute. Changing an
existing operation's meaning requires a new display version.

### Opaque capability

An opaque definition declares an exact namespaced capability id, exact SemVer,
allowed realms, and a strict payload schema. The backend must advertise that
exact capability before the extension hook runs. Opaque payloads additionally
pass bounded, plain-JSON validation and are returned as owned frozen snapshots.

A capability version is not selected by a range. An incompatible payload or
backend behavior receives a new capability version and explicit migration.

### Legacy renderer bridge

Definitions that expose legacy `renderers` remain supported for the 1.x line as
`dojo-video-engine.legacy.renderer-adapter@1.0.0`. A display-list backend must
advertise that bridge explicitly. Legacy adapters are opaque, backend-specific,
and may have conservative full-composition damage bounds; they are not
misrepresented as portable standard operations.

`preflightExtensions(..., {displayTarget})` resolves descriptor versions,
parameters, required assets, renderer/display capability, and execution realm
before hooks run. Unsupported combinations fail; they do not silently omit a
layer or switch implementation.

## Lifecycle and ownership

The lifecycle is:

```text
validate/preflight
  -> discover declared Scene assets
  -> resolve node resources
  -> prepare frame-local data
  -> compile display output or invoke the negotiated legacy adapter
  -> release resources
```

- Resolved and prepared values are ephemeral and never enter Scene JSON.
- `resolveAssets` and `prepareFrame` receive cancellation when the host/runtime
  supports it. Hooks should stop promptly and avoid publishing partial state.
- `disposeAssets` is responsible for extension-owned resources and must be safe
  after partial work. Hosts/runtime adapters still guard lifecycle ordering and
  await disposal on normal, failed, superseded, and cancelled paths.
- Without `reuseKey` plus `reuseSafety: "immutable"`, resources are reacquired
  conservatively for a Scene revision.
- Reused resources may be read concurrently by multiple live revisions. They
  must be immutable or internally concurrency-safe; mutable frame state belongs
  in the prepared-frame result.
- Display compilations are revision/frame/resource-lease scoped and must not be
  cached as canonical Scene data.

## Worker contract

Worker execution requires all of the following:

- the definition declares `workerCompatible: true`;
- the selected standard ABI or exact opaque capability supports the worker
  realm;
- required assets and host services are transferable or resolvable there;
- hooks do not depend on the DOM, ambient main-thread globals, hidden mutable
  module state, locale, wall clock, or global randomness;
- cancellation, error serialization, and disposal cross the host's worker
  boundary.

When any condition is false, preflight rejects worker execution. A host may
explicitly choose an advertised main-thread or external-runtime fallback; the
engine does not silently move trusted code to a realm with different behavior.

## Failure isolation

Hosts should treat every extension hook as a named failure boundary:

1. preflight the complete Scene before invoking hooks;
2. associate errors with extension name/version, node id, phase, and capability
   without leaking credentials or private parameters;
3. roll back partially resolved resources and await disposal;
4. abort superseded work and prevent late results from entering a newer Scene
   revision;
5. fail the affected render/export transaction rather than silently omit the
   extension;
6. apply engine budgets to output even when the extension is trusted;
7. quarantine or remove a repeatedly failing definition from the host registry
   by policy, not by mutating stored Scenes.

An extension exception must not corrupt another extension's resources or the
canonical Scene. Stronger fault containment requires a process/worker protocol
owned by the host; ordinary JavaScript exception handling is not a security
boundary.

## Migration rules

- A compatible implementation fix may keep the descriptor version only when it
  preserves accepted parameters and stored-scene/render semantics. Pixel
  changes require goldens and release notes even when they fix a bug.
- Additive optional parameters with unchanged defaults may use a descriptor
  minor version. Existing exact versions remain resolvable or gain an explicit
  compatibility alias only after equivalence tests.
- Required parameters, changed defaults, removed values, different output
  meaning, or incompatible resources/capabilities require a new descriptor
  version.
- Scene migrations are explicit, deterministic, non-mutating transforms. Never
  rewrite `{name, version, params}` merely because a newer definition is
  installed.
- A migration must be reversible at the project/history level or retain the
  source document, identify affected nodes, validate the result, and have
  before/after render evidence.
- Removing an extension version from a host is a host migration event. Warn and
  migrate stored Scenes before removal; otherwise those Scenes must fail
  preflight with an actionable missing-version issue.

## Distribution and signing

Dojo Video Engine does not currently define an extension marketplace, package
signature format, certificate authority, revocation service, or remote
installer. Hosts own distribution policy.

For production use, a host should allowlist exact descriptor identities and
package versions, pin package integrity, verify registry/source provenance,
retain an SBOM and license record, restrict publisher/admin access, and support
revocation. Signature or provenance verification happens before code enters
the registry; neither `defineExtension()` nor a Scene descriptor performs it.
See [`supply-chain.md`](supply-chain.md).

## Compatibility checklist

Before publishing or enabling an extension:

- exact identity/version and ownership are documented;
- params and opaque payload schemas are strict and have adversarial tests;
- standard/opaque/legacy mode and every realm are explicit;
- deterministic inputs and seeded behavior are tested;
- assets, cancellation, concurrency, rollback, and disposal are covered;
- output and coordinate budgets fail closed;
- renderer goldens cover each supported backend and compatibility alias;
- stored-Scene migration and retirement policy are documented;
- package integrity, provenance, SBOM, licenses, and vulnerability status are
  reviewed by the host.

See [RFC 0003](rfcs/0003-extension-kernel.md),
[`@dojo-video-engine/extensions`](../packages/extensions/README.md), and the
[1.x compatibility contract](compatibility.md) for the underlying public API.
