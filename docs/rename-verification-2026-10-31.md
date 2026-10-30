# Engine split verification — 2026-10-31

- Engine build, typechecking, package contracts, determinism lint, schema and migration checks passed.
- 995 source unit tests passed. Emitted `dist` tests are explicitly excluded.
- Fuzzing and the 28-scene example corpus passed.
- All seven resource-lifecycle checks passed.
- Chromium golden/media/audio/export/runtime/proof checks passed.
- Chromium, Firefox, and WebKit capability probes passed.
- 720p encode/decode and bounded 1080p/4K compositing performance checks passed.
- CLI/starter smoke, all public package pack checks, and a clean external tarball
  consumer (Node/browser/worker/CLI/build) passed.
- Production dependency audit found no known vulnerabilities.
- Current source/text paths in both repositories contain no retired engine name.

The visual-primitives golden had a pre-existing mismatch. Inspection found exactly
13 changed pixels out of 230,400, with maximum channel difference 1. Only that
baseline PNG/hash was refreshed for the pinned browser; no pixel assertion was
weakened and no rendering behavior was changed to satisfy the test.

The harness passed TypeScript, 130 tests, its production build, and 15 browser
acceptance checks after the namespace/path migration. LLM/ASR responses in those
browser checks are synthetic; browser preview/export, media storage, the local
server, command/persistence paths, and MP4 decode are real.

No npm packages, paid model jobs, or hosted DojoClip deployment are part of this
GitHub publication. Historical Git revisions retain their original contents.
