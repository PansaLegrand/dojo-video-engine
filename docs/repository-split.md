# Repository split — 2026-10-31

The engine is now **Dojo Video Engine**, repository `dojo-video-engine` and package
namespace `@dojo-video-engine/*`. Executables, API identifiers, schema names, tool
names, environment variables, paths, and documentation use the new naming.

The GitHub repository is renamed in place so its Git history remains available.
This is a source/API naming migration, not an npm publication or a change to the
Scene v1 version number. Consumers must update imports and named identifiers
before using this source revision. Previous names are not compatibility aliases.

The editor and agent belong to
[dojo-video-harness](https://github.com/PansaLegrand/dojo-video-harness). That repo
contains the extracted manual editor, educational TypeScript agent loop, questions,
approvals, local persistence, and BYOK LLM/ASR adapters under MIT.

Removed from the engine: chat app, playground, MCP demonstration, model-agent
example/evaluation runner, app-only spikes, repository agent skill, and CLI Studio
server. The headless authoring starter and engine command/inspection/proof SDKs
remain. Browser engine tests remain under `tools/golden`.

The harness currently vendors a declared patched engine snapshot. Its names move
together with this repository; its historical source hashes identify the original
extraction, not byte identity after this migration. Replacing that snapshot with
published engine packages requires a separate tested release and patch reconciliation.

The hosted DojoClip checkout is not part of this two-repository rename. Its pinned
vendor copy remains independent; adopting the public packages is a separate migration.
