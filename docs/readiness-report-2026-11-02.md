# Engine readiness execution — 2026-11-02

Status: tested verification increments; the full roadmap is not declared complete.
Scope: the engine half of user-reviewed editing. Public runtime APIs remain 1.1.1;
this work adds test infrastructure and evidence, so no new npm version is needed.

## Delivered

- Capability inventory and coverage mapping: `docs/readiness-capabilities.md`.
- Independent FFmpeg-generated H.264/AAC fixtures, with a source frame ID encoded
  into every frame and known tone/gain changes. Neither expected source identities
  nor audio measurements use the engine evaluator/mixer.
- Constant and variable frame rates (measured 33/67 ms source timestamp intervals).
- Trim, split and 2x playback checks: 6 exports, 330 fully decoded output frames,
  24 preview-frame identities and 294 timeline audio measurement windows.
- Oracle fault tests reject a wrong individual frame within the same color region,
  missing tail content, wrong gain/frequency, missing samples and shifted audio.
- Hash-bound source/Scene/output artifacts under ignored `test-results/media/`.
  The media check is included in the full release gate and its CI evidence upload.

## Verification

`pnpm release:full` and `pnpm verify:clean` passed after the initial media gate was
integrated. Subsequent VFR/frame-marker increments passed their focused fault and
browser/export checks; the final clean media run identifies source commit
`c60a1fa3c85e75e1ec8684fa33c483a990589400`.

[CI for 3cd2909](https://github.com/PansaLegrand/dojo-video-engine/actions/runs/41328311940)
passed the complete macOS engine gate and the Linux contract/cross-browser/clean
consumer job. Release candidates explicitly prepare FFmpeg/ffprobe as well.

[Machine-readable measurements](reports/readiness-media-2026-11-02.json) record
the exact source commit, browser/FFmpeg versions, tolerances, source hashes,
individual preview IDs and export/audio measurements. The source/exports/portable
Scenes remain in `test-results/media/2026-11-01T16-36-36-498Z/` on the execution
machine; rerun `pnpm verify:media` to generate a fresh evidence set.

An initial audio checker used FFmpeg's implicit stereo-to-mono downmix and thereby
introduced its own gain change. The checker now measures a channel explicitly;
the tolerance was not loosened. Fixture/loader setup failures were corrected
before acceptance and retained locally. No renderer defect was hidden by updating
goldens or weakening comparisons.

## Remaining scope

These controlled fixtures do not qualify arbitrary physical phone recordings,
all CJK/font combinations, long-form/high-resolution projects, every audio channel
layout, or universal browser export. Those real-media and human-review rows remain
open in the plan. Existing resource, performance and cross-browser gates remain
required; the new content oracle complements them.

The harness has separate intent/approval/UI and live-model gates; later Gateway
and [workflow/music reports](https://github.com/PansaLegrand/dojo-video-harness/blob/main/docs/basic-workflows-and-music-2026-11-03.md) record their progress.
Kie's provider availability is not an engine rendering result. Keep the public
runtime version pinned until an actual runtime/API fix requires a new release.
