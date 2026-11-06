# Editable graphics: first local milestone

Date: 2026-11-06. Status: implemented and locally qualified as an unpublished
source candidate. Public release, consumer dependency updates and deployment
remain pending.

## Implemented subset

- `@dojo-video-engine/interchange/svg`: bounded XML import into native groups and
  SVG paths, with stable named part IDs and an original-ID map. Supports basic
  shapes, solid paint, transforms, root viewport clipping and isolated group
  opacity. Named parts retain IDs when unrelated decoration is inserted.
- `@dojo-video-engine/three` and `/schema`: optional trusted Three.js definition,
  exact opaque handler, DOM-free validation/evaluation, named objects/materials,
  groups, primitive/raw-triangle geometry, lighting, perspective/orthographic
  cameras, absolute-time orbit/spin/keyframes and source offset/rate.
- Shared Canvas2D composition/export, lazy Three.js loading, revision-owned GPU
  resources, disposal, layer/vertex/surface limits and explicit WebGL2 failures.
- Extension schemas accept normalized defaults. Compile snapshots omit explicit
  undefined optional object fields without mutating source; arrays and opaque
  outputs retain strict JSON checks. A consumer browser regression found and
  qualified this compatibility repair.

See package READMEs for exact limits. SVG viewBox starts at 0 0; CSS, text,
gradients/defs, references, SMIL and filters are rejected. This 3D subset has no
textures/models, arbitrary code/shaders, physics, shadows or post-processing.
Separate layers do not share depth. Main-thread WebGL2 is required.

## Consumers and reproduction

Both hosts implement `insertSvg`, vector/3D guidance, validated part edits and
per-command 3D validation. SVG names become IDs such as `bird:svg:id:beak`.
Head trim/split advances 3D source time; movement preserves phase. Inspector
controls expose vector paint and 3D object/material/camera/spin. Product UI is
synchronized to harness through the existing transformer. The harness also
exposes schema inspection and read-only SVG/3D preparation tools.

Commercial native runtime 0.1.4 contains the offline compiler and advertises
`native-editable-graphics-v1`; the web requires this worker capability. Provider
jobs, billing and canonical publication remain host responsibilities.

From the engine checkout, after normal dependency installation/build prerequisites:

```sh
node scripts/graphics-candidate.mjs --consumer ../dojo-video-web
node scripts/graphics-candidate.mjs --consumer ../dojo-video-harness
node scripts/verify-graphics.mjs
```

The candidate helper builds/packs the three changed packages, records SHA-256
digests and the base commit, installs in a temporary npm project with scripts
disabled, then copies package distributions into the explicitly named consumer.
Previous packages are retained for rollback. It never aliases sibling TypeScript
sources or publishes packages. Dependencies are Three.js 0.187.0, saxes 6.0.0 and
xmlchars 2.2.0. The npm lockfile and published-release provenance are untouched.

These tarballs retain source baseline number 1.1.5 and are explicitly labelled
**unpublished candidates**, not replacements for registry 1.1.5 bytes. Running
`npm ci` restores the published baseline and removes the candidate. Consumer
source changes must not be pushed as an installable release until a new
synchronized engine minor version is published and both consumers' exact
dependencies, locks and provenance are updated. Never overwrite a release tag
or npm version. The sibling checkout is only a local qualification dependency.

## Evidence and limits

- Engine `pnpm release:full` and `pnpm verify:clean` passed, including build,
  type checking, unit/schema/migration/contracts, corpus/fuzz/resource/goldens,
  independent media/terminal checks, cross-browser/performance and clean packed
  consumer installation with the new SVG and Three.js entry points.
- `verify-graphics.mjs`: nine checks, including independent browser SVG
  rasterization of overlapping group opacity (under 3% differing pixels, channel
  tolerance 2), shuffled/repeated seeks, visible 2D/3D geometry, concurrent
  preview/export, missing-WebGL2 errors and independently decoded 60-frame MP4
  plus audio. Artifacts: `test-results/graphics/`.
- Harness full check: 371 tests and production build; the complete browser suite
  passed 56 checks. Actual editor proof covers
  direct chat, camera controls, phase-preserving trim, Undo, reload, narrow layout
  and decoded MP4 with original audio.
- Web full check: 5,204 tests passed, 233 normally skipped integration tests.
  Unified graphics browser proof covers replay, camera controls, Undo, export
  and Chinese narrow reload. An isolated production build passed after a
  temporary cache-disabled retry for disk exhaustion.
- Worker build and packaged native replay/capability tests passed with runtime
  0.1.4. No deployed endpoint or paid provider was used.

Fixtures are authored test scenes, not live-model quality benchmarks. The
pelicans demonstrate code-rendered composition, not general autonomous animation.
Physical mobile, cross-GPU pixel equivalence, broad performance, live-provider
quality and human creative acceptance remain unqualified. Publication still requires a new synchronized version, immutable release bytes,
clean committed source and the authorized tag-bound release workflow.
