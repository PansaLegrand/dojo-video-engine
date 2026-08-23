# Contributing to motionforge

Thanks for helping build a deterministic, browser-native video scene engine. This document covers the development workflow and the coding standards the codebase follows.

## Prerequisites

- Node.js >= 18 (CI runs 20)
- pnpm 10 (`corepack enable` respects the pinned `packageManager`)
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

CI runs the same steps in the same order. A change is done when all of them pass.

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

Packages are versioned together and published from CI. Before the first release: pick a real version (`0.1.0`), add a changelog entry, and run `npm pack --dry-run` in each package to inspect the tarball.
