# Terminal editing consumer qualification

Date: 2026-11-03. Last reviewed: 2026-11-03.
Status: bounded registry-consumer workflow passed with the documented dependency pin.

## What was exercised

A coding agent in this session authored and executed a standalone terminal
consumer outside the engine repository. It installed published engine 1.1.2
packages, without workspace/source aliases or the visual harness. The reproducible
files are in `examples/terminal-editing/`; `pnpm verify:terminal` repeats the check
in a new directory and retains evidence. The source baseline was
`88cd00abf5285baf0543ff84101ee50cd96c86d2`, plus this example/documentation change.

The edit combines source seconds 1–3 of clip A with 0.5–2.5 of clip B, adds a
two-second title, preserves both source audio tracks at 50% gain, and mixes a
four-second background tone at 20%. A workflow command revises the title; an
attempt with the old revision fails, and the complete remaining canonical Scene
is asserted unchanged. The CLI validates/checks the Scene, then a local
Playwright/Vite host calls the public still/contact-sheet/export APIs.

## Evidence

[Retained machine-readable result](reports/terminal-editing-2026-11-03.json)
records output/source/lockfile hashes, audio measurements, stale-edit rejection,
fresh-process reopening, and both negative checks.

- Node 20.19.5, pnpm 10.34.5, macOS arm64, Playwright 1.60.0 Chromium
  148.0.7778.96, FFmpeg 8.0.
- Published Dojo packages 1.1.2, Mediabunny overridden to **1.46.0**, and a
  retained standalone pnpm lockfile. No engine runtime or published bytes changed.
- The output is 640×360, 30 fps, 120 frames / 4 seconds, AVC with AAC audio.
- FFmpeg independently decodes all 120 frames. Expected color segments establish
  order and nonzero source trims, allowing one frame around cut boundaries.
  An injected untrimmed red-frame result is rejected by the color oracle.
- Six preview frames agree with the expected color segments. White title pixels
  appear during the first clip and disappear for the second. The contact sheet
  was visually inspected for readable, bounded title placement and clip sequence.
- Independent tone measurements in four windows establish 440 Hz audio during
  clip A and 880 Hz during B, with no significant opposite-clip tone leakage.
  Expected clip amplitude is 0.0625; measured values were approximately
  0.06225–0.06285. The 220 Hz music amplitude was 0.02497–0.02500 against 0.025.
  These checks use a fixed 1 dB amplitude tolerance.
- Engine sampled export verification passed, including required audible audio.
  The independent report binds the saved Scene, sources, dependency lockfile and
  MP4 by SHA-256.
- The acceptance runner also reopens the saved Scene in a fresh render process
  and checks malformed Scene and missing local asset rejection.

Artifacts are retained in the temporary directory printed by the runner:
`output/edited.mp4`, `contact-sheet.png`, six frame PNGs, `render-report.json`,
`verification.json`, and `negative-checks.json`. Synthetic media is generated
from the committed FFmpeg recipe; no customer media or credentials are involved.
This session also retained a local copy under the ignored
`test-results/terminal-editing-2026-11-03/` directory.

## Failures found and disposition

1. **Canonicalization in the example assertion.** The initial assertion compared
   raw input nodes with canonical output (which adds default fields). The example
   now compares complete canonical snapshots before and after the one allowed
   text change. This was a test setup error, not unwanted engine mutation.
2. **Fresh dependency resolution breaks AAC export.** Without the override,
   published `mediabunny: ^1.46.0` resolved to 1.65.1. Preview succeeded but
   export failed with `AacTimingError: AAC output has unsupported sample tables`.
   Using the engine repository's locked 1.46.0 dependency resolved the failure.
   The example pins it explicitly. Newer muxer compatibility and narrowing the
   published engine dependency range require a separate tested engine release;
   this example does not claim to fix unrestricted 1.1.2 installations.
3. **Unspecified fixture color space.** Initial FFmpeg clips lacked explicit
   color metadata and decoded differently in the browser (green approximately
   216 versus the independent decoder's 254). The fixture now explicitly converts
   BT.601-generated color to BT.709 and tags primaries/transfer/matrix. The
   original 25-level RGB tolerance was preserved; output was not accepted by
   relaxing the check. Untagged real footage remains a separate qualification case.

## Scope of the feature claim

This establishes a useful **terminal-driven Scene editing/rendering example**.
The coding agent supplies planning; the engine remains provider-neutral and
contains no additional model loop. Headless Chromium is still the render runtime.
The sample host is local, bounded and intended for trusted projects.

It does not establish a shipped MCP/skill plugin, a new public render/export CLI,
separate clean Codex CLI or Claude Code client acceptance, general autonomous
visual judgment, arbitrary real-footage support, or Windows/Linux acceptance.
Speech recognition and music generation were not called. The music here is an
existing local audio asset. ProjectDocument approvals/history remain harness
responsibilities and are not replaced by standalone Scene files.
