# MF7 browser layout evidence

Status: passing in the Playwright-pinned Chromium golden gate
Command: `pnpm golden:test`

MF7 adds a browser-side `runGoldenLayoutV2Checks()` gate in
`tools/golden/src/harness.ts`. It imports the public `@motionforge/layout`
package and reuses one coordinate-free semantic source plus three plans at
portrait, square, and landscape sizes.

The browser gate proves:

- root overlay placement plus stack and grid plans compiled inside nested
  containers;
- no source child carries hand-authored `left`, `top`, `width`, or `height`;
- all compiled Scenes pass strict Scene v1 validation;
- every reported rectangle is finite and remains inside its target content
  box;
- long Latin, CJK, emoji, and RTL text has a non-impossible text plan, selected
  declared font asset, deterministic prepared metrics, and explicit RTL base
  direction where required;
- the real Canvas2D asset/prepare/render path produces opaque, varied, bright
  painted pixels at every target shape;
- compiling and painting Layout v2 scenes has no global effect on an ordinary
  legacy Scene v1: its source JSON and every rendered RGBA byte are identical
  before and after the Layout v2 work.

The successful target evidence currently records ten bounded semantic boxes
and five planned text tracks per composition. This is assertion-based browser
evidence rather than a new stored layout format or a replacement for existing
pixel goldens. The complete golden suite still runs all legacy hashes,
renderer conformance, export, video, audio, runtime, and agent-tool checks in
the same command.
