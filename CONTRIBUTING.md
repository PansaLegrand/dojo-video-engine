# Contributing to motionforge

Thanks for helping build a deterministic, browser-native video scene engine.
This document covers development and review. Participation is also governed by
the [Code of Conduct](CODE_OF_CONDUCT.md), [governance](GOVERNANCE.md), and
[security policy](SECURITY.md).

## Prerequisites

- Node.js >= 20.19 for the complete workspace toolchain (public package
  `engines` may document a narrower runtime boundary)
- the exact pnpm version pinned by `packageManager` (`corepack enable` respects
  it); the pin must remain on a security-supported release
- One-time, for golden tests: `pnpm --filter @motionforge/golden exec playwright install chromium`

## Development workflow

```sh
pnpm install
pnpm build        # build first: typecheck relies on project-reference outputs
pnpm typecheck
pnpm test         # unit tests (vitest)
pnpm golden:test  # pixel-level rendering tests (Playwright + Chromium)
pnpm format       # prettier
```

CI runs `pnpm release:full` and `pnpm verify:clean`, which include and extend
these local checks. A change is done when the checks proportional to its risk
pass and their evidence is recorded.

## Golden rendering tests

Golden tests render fixture scenes in the Playwright-pinned Chromium and hash the raw RGBA pixels (`tools/golden`). They are the contract that preview and export stay deterministic.

- If you intentionally change rendering output, inspect the result visually first, then run `pnpm golden:update` and commit the updated snapshots in `fixtures/goldens/` with an explanation in the PR.
- Never use locally installed Chrome for snapshots you commit — different browser builds hash differently. `GOLDEN_CHROME_PATH` exists for debugging only.
- Exact-hash fixtures must avoid platform-dependent output (fonts/glyphs). Text rendering is covered by probe fixtures that assert on pixel properties instead of exact hashes.

## Coding standards

### Determinism is the product

- The render path (`scene JSON + frame -> resolved scene -> layout -> canvas`) must be a pure function of its inputs. No `Date.now()`, `Math.random()`, locale-dependent formatting, or hidden module state anywhere in `schema`, `core`, or renderer packages.
- Builder APIs must emit identical JSON for identical programs. Auto-generated node ids are assigned in document order per scene, never from global counters.

### TypeScript

- `strict` and `noUncheckedIndexedAccess` stay on; do not weaken `tsconfig.base.json`.
- No `any`, no non-null assertions (`!`) in library code; narrow with checks instead.
- Public API types are explicit — exported functions declare parameter and return types rather than relying on inference.
- Library packages are ESM-only (`"type": "module"`). Imports between packages go through the `@motionforge/*` entry points, never deep paths.

### Package layout

- Public packages live in `packages/*`; `apps/*` and `tools/*` are private. The browser-engine packages (`schema`, `core`, `renderer-*`, `export`, `player`, `presets`, and `authoring`) may not depend on Node-only or application-framework APIs. The CLI and starter packages are intentionally Node-based entry points.
- Dependency direction: `schema` ← `core` ← `renderer-*`, `export`. The schema package depends on nothing but zod.
- Every publishable package ships `dist` only (with tests and buildinfo excluded), plus its own `README.md` and `LICENSE`.
- The standalone repository is authoritative. Read [`docs/source-of-truth.md`](docs/source-of-truth.md) before integrating changes from a downstream application.
- `pnpm check:contracts` enforces synchronized public package versions and browser-engine dependency boundaries.
- Trusted extensions follow [`docs/extension-abi.md`](docs/extension-abi.md);
  Scene JSON never installs executable code.

### Dependencies and third-party material

- Explain every new production dependency's owner, license, maintenance,
  transitive/runtime cost, browser/worker/determinism impact, and removal path.
- Review `pnpm-lock.yaml` changes; do not hide unrelated dependency updates in
  a feature pull request.
- Identify third-party source, media, fonts, fixtures, and generated material
  with its license. Contributors must have the right to submit their work under
  this repository's MIT license.
- Follow [`docs/supply-chain.md`](docs/supply-chain.md) for advisory, license,
  SBOM, provenance, codec, and release requirements.

### Tests

- Every meaningful code slice lands with tests, or a note in `docs/progress.md` explaining the gap.
- Unit tests live next to the source as `*.test.ts` and must not touch the network or filesystem.
- Rendering behavior changes need a golden fixture (exact hash for geometry/paint, probes for text).
- Validation rules in `schema` get a negative test demonstrating the error message users will see.

### Errors and messages

- Validation errors must say what is wrong _and_ what to do instead (see the unsupported-style-property message). Agents and humans both read these.
- Throw `Error` subclasses with structured data (`SceneValidationError.issues`) rather than bare strings when callers may want to inspect the failure.

### Style

- Prettier is the only formatter; run `pnpm format` before committing. No manual alignment.
- Comments explain constraints and invariants, not what the next line does.

## Releases

Public packages version together. The existing CI workflow verifies source but
does **not** publish packages, create tags, generate an SBOM, or prove registry
provenance. A manifest version or changelog heading is therefore a source
baseline until the external release record is complete.

Release managers follow [`docs/release-process.md`](docs/release-process.md).
The 1.1 candidate uses the scoped starter package `@motionforge/create`; the
unscoped npm package `create-motionforge` belongs to another project, although
the MotionForge executable remains named `create-motionforge`.

Use `pnpm pack`/`pnpm publish` semantics for workspace packages. Direct
`npm pack` or `npm publish` from a package source directory can leave
`workspace:*` dependencies unresolved. Do not tag or publish from a contributor
pull request, fork, dirty checkout, or local developer machine.

## RFCs, conduct, and private reports

Material public-contract, architecture, release, or governance changes use the
RFC process in [`GOVERNANCE.md`](GOVERNANCE.md). Report suspected
vulnerabilities privately under [`SECURITY.md`](SECURITY.md); do not put exploit
details or secrets in an issue. Conduct concerns follow
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
