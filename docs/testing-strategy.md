# Engine verification

Build first: package typechecks rely on generated project-reference declarations.

- `pnpm test`: engine, command, authoring, lifecycle, inspection, and CLI unit tests.
- `pnpm check:contracts`: package ownership, exports, dependency, and source boundaries.
- `pnpm check:schema` / `pnpm check:migrations`: generated schema and versioned scene fixtures.
- `pnpm fuzz:scene` / `pnpm corpus:check`: bounded scene mutation and example corpus validation.
- `pnpm golden:test`: pinned-Chromium frame goldens plus real media/audio/export and proof checks.
- `pnpm resource:smoke`: media lifecycle and resource release.
- `pnpm cross-browser`: renderer capability/tolerance probes on Chromium, Firefox, and WebKit.
- `pnpm performance:gate`: bounded render/encode/decode and compositing budgets.
- `pnpm release:fast` / `pnpm release:full`: aggregate release gates and package smoke tests.
- `pnpm verify:clean`: all public tarballs installed into an external headless consumer,
  including Node, browser, worker, CLI, and TypeScript builds.

The browser harness is engine test infrastructure, not a second editor application.
UI interaction, provider contracts, and editing-agent acceptance live in
[Dojo Video Harness](https://github.com/PansaLegrand/dojo-video-harness).

No engine gate requires paid LLM/ASR credentials. Exact pixels depend on the pinned
browser/font/color environment; other browsers are checked through semantic probes.
Inspect actual differences before changing a golden. Do not equate these local
checks with production, physical-mobile, or universal-device acceptance.
