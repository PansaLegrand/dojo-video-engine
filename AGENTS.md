# Coding agent guide — Dojo Video Engine

## Orientation

This is an MIT-licensed TypeScript/ESM video engine monorepo. It owns structured
Scene data, authoring, validation, evaluation, inspection, Canvas2D rendering,
playback and browser export. Public packages use `@dojo-video-engine/*`.

The editor UI, model loop, provider credentials and durable application approvals
belong to [Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).
`packages/agent-tools` contains provider-neutral engine adapters, not a model
runtime. Do not reintroduce retired editor/playground/model-agent applications.

Start with:

1. [README.md](README.md) for installation and the repository boundary.
2. [The engine readiness plan](docs/engine-readiness-plan.md) for the current
   user-reviewed-editing milestone, numbered work packages and acceptance gates.
3. [llms.txt](llms.txt) and [Scene format](docs/scene-format.md) for engine semantics.
4. [CONTRIBUTING.md](CONTRIBUTING.md) and [testing strategy](docs/testing-strategy.md)
   before changing implementation or fixtures.

Plans describe work, not completed evidence. Verify current code, package metadata
and tests before relying on dated reports. A planning checkbox is complete only
when its required implementation and evidence exist.

## Architecture and where to work

```text
authoring / presets / layout → validated Scene
Scene + frame → evaluation → layout / display list → Canvas2D
prepared media + shared renderer / mixer → player or export
```

| Location                                                    | Responsibility                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `packages/schema`                                           | Canonical Scene schema, parsing, migration, patches and generated JSON Schema    |
| `packages/core`                                             | Frame evaluation, layout, display-list and text primitives                       |
| `packages/commands`, `packages/inspection`                  | Low-level Scene commands/workspaces and structural/spatial/timing diagnostics    |
| `packages/authoring`, `packages/layout`, `packages/presets` | Pure authoring compilers, layout plans, macros, motion and caption vocabulary    |
| `packages/extensions`, `packages/runtime`                   | Trusted extension contracts and prepared-session/resource ownership              |
| `packages/renderer-canvas2d`                                | Canvas rendering, assets, media preparation and caches                           |
| `packages/player`, `packages/export`                        | Playback/seeking, audio synchronization, encoding, muxing, workers and streaming |
| `packages/agent-tools`, `packages/interchange`              | Framework-neutral tool adapters and bounded interchange bridges                  |
| `packages/cli`, `packages/create-dojo-video-engine`         | Node-based validation/inspection CLI and headless starter                        |
| `packages/showcase`, `tools/golden`, `fixtures`             | Private scene fixtures and engine verification infrastructure                    |
| `scripts/public-package-policy.mjs`                         | Public package set and allowed dependency directions                             |
| `scripts/*release*.mjs`, `.github/workflows`                | Release gates, retained package bundles and publication workflows                |

The harness's ProjectDocument, semantic edits, scope/approval and project undo
are separate from engine Scene workspaces. For a consumer defect, first preserve
the compiled Scene and asset identities. An incorrect Scene is a consumer/compiler
problem; a correct Scene rendered incorrectly is an engine reproduction.

## Development commands

Use Node 20.19+ for the workspace and the exact pnpm version in `package.json`.
Preserve `pnpm-lock.yaml`; do not introduce an npm lockfile here. Build before
workspace typechecking because TypeScript project references use emitted declarations.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
```

For focused changes, use the owning package, for example
`pnpm --filter @dojo-video-engine/export test`. Format changed files with
`pnpm exec prettier --write <files>`; avoid unrelated formatting churn.

| Change                                 | Relevant verification                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Documentation only                     | Verify paths/commands, format changed Markdown, `git diff --check`                                 |
| Schema or public API                   | Negative/compatibility tests, `pnpm check:contracts`, `pnpm check:schema`, `pnpm check:migrations` |
| Rendering or media behavior            | Owning-package tests and `pnpm golden:test`; add independent media/timing assertions               |
| Resource ownership, caching or workers | Lifecycle/worker tests, `pnpm resource:smoke`; performance gate when behavior/cost changes         |
| Browser capability behavior            | `pnpm cross-browser` plus the declared canonical golden environment                                |
| Release candidate or package boundary  | `pnpm release:full`, `pnpm verify:clean`, and the applicable release runbook checks                |

Install browser binaries when required:
`pnpm --filter @dojo-video-engine/golden exec playwright install chromium firefox webkit`.
The full release gate already aggregates build, unit/contracts, fuzz/corpus,
resource, golden, cross-browser, performance and package smoke checks. Run checks
proportional to the change; do not repeatedly run completed gates without cause.
Pure unit tests stay hermetic; browser/filesystem behavior belongs in integration
infrastructure. No engine check needs a paid LLM/ASR key.

## Invariants to preserve

- Scene is serializable data. Keep browser objects, caches, decoded media and
  executable modules out of Scene JSON, serialized display lists and tool results.
- Evaluation is deterministic for its declared inputs. Do not introduce wall-clock
  time, unseeded randomness, locale-dependent output or hidden mutable evaluation
  state. Playback clocks and asynchronous resource preparation remain explicit.
- Timeline and keyframe positions use integer frames and documented local clocks;
  source-media offsets may use documented seconds. Respect half-open node windows
  and source/scene clock distinctions; never silently change time units.
- Validate input and preserve transactional failure semantics. Unknown fields,
  invalid references or unsupported features must produce useful diagnostics.
- Preview and export share rendering/mixing contracts. Preserve original audio
  identity when visual proxies are used, source offsets, rate behavior and encoder
  timing/padding rules. Export decoding alone does not prove correct content.
- Prepared assets have explicit ownership and disposal. Preserve cancellation,
  worker boundaries, bounded caches and cleanup. Cached and uncached output must
  satisfy the same rendering contract.
- Browser-engine packages must not acquire Node-only or application-framework
  dependencies. Use public package entry points, not cross-package `src`/`dist`
  imports. Follow the package policy rather than guessing dependency direction.
- Keep strict TypeScript settings. Follow the contribution rules for explicit
  public types and narrowing; do not weaken validation with `any` or assertions.
- Preserve Scene/API compatibility. Review [public API ownership](docs/public-api-ownership.md)
  and the declared schema/version before changing an exported contract. Regenerate
  generated schemas through their scripts; do not patch generated artifacts by hand.

Use the canonical pinned browser/font/OS environment in the testing strategy for
committed goldens. Inspect differences before an intentional baseline update;
never loosen tolerances or regenerate snapshots merely to make failures disappear.
Cross-browser capability results do not imply universal pixel identity.

## Packages, releases and handoff

Public packages version together; the root workspace is private. Source version
numbers and green CI do not prove npm availability or provenance. Follow
[the release process](docs/release-process.md) for an authorized release: retain
tested tarball bytes, verify consumers/integrity, and use the tag-bound OIDC workflow.
Do not move immutable release tags or replace an existing package version.

Workspace dependency rewriting requires the repository's pnpm packaging path.
Do not publish directly from a source package with unresolved `workspace:*` specs.
The starter package is **`@dojo-video-engine/create`**; `create-dojo-video-engine`
is its executable name, not the unscoped npm package to publish.

Engine fixes belong here. Give consumers the exact version, integrity, compatibility
notes and reproducer; the harness updates its manifest, lockfile and engine release
record together. Do not maintain a downstream renderer source fork.

## Working discipline

Respect the user's task scope and preserve unrelated edits. Inspect `git status`
before changing or staging files. Never commit credentials, recovery codes,
environment-file contents, signed/private asset URLs or unlicensed media/fonts.
Do not assume generated release output is ignored; inspect it before staging.

Report what changed, relevant checks and limitations. Distinguish source checks,
package publication, consumer integration and live application behavior. Keep this
guide current when ownership or commands change; `AGENT.md` forwards here.
