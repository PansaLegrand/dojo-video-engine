# Terminal editing with a coding agent

This is a standalone consumer example using published engine **1.1.3** packages.
A coding agent can edit the Scene and invoke these scripts from its shell. There
is no nested LLM loop, editor UI, API key, MCP server or provider SDK. Rendering
uses a local headless Chromium process; it is not browser-free Node rendering.

## Run the checked example

Requirements: Node 20.19+, pnpm 10.34.5, FFmpeg/ffprobe and Playwright Chromium.
Copy this directory outside the engine repository so it installs independently:

```sh
cp -R examples/terminal-editing /tmp/my-dojo-video
cd /tmp/my-dojo-video
pnpm install --ignore-workspace --frozen-lockfile
pnpm exec playwright install --only-shell chromium
pnpm fixtures
pnpm author
pnpm validate
pnpm inspect
pnpm render
pnpm verify
```

Use a new destination if `/tmp/my-dojo-video` already exists. On Windows, copy
the directory with your shell/file manager to a new project folder instead.
The recorded acceptance environment is macOS arm64; Windows/Linux execution of
this example remains unqualified.

`fixtures` makes synthetic clips and a music tone using FFmpeg. `author` trims
clip A to source seconds 1–3 and B to 0.5–2.5, joins them into four seconds,
adds two seconds of title text, and mixes clip audio at 50% with music at 20%.
It revises the title through the workflow SDK, rejects a stale edit, and asserts
that all other canonical Scene fields survive unchanged.

`render` validates `scene.json`, saves six preview PNGs and a contact sheet, and
exports `output/edited.mp4`. `verify` independently decodes every frame and
checks clip colors/order/trim boundaries, title presence and ending, preview
colors, both source audio tones, music gain and Scene/output/source hashes.
Its expected values describe this fixture only; it is not a generic quality grader.

From the engine checkout, `pnpm verify:terminal` runs the same example in a new
temporary directory, reopens/rerenders the saved Scene in a fresh process, and
checks invalid Scene and missing-asset failures. It retains the directory and
evidence even on failure. This is an opt-in registry consumer check, not part of
the source release gate in registry mode. The full source release gate separately
uses `--pack-source`, installing current tarballs with no media override.

## Ask a coding agent to edit

Open the copied project with your coding agent and give it an instruction such as:

> Read this README and author.mjs. Join the two clips with the documented trims,
> add a readable title for the first two seconds, and mix the existing music at
> 20%. Validate and inspect the Scene, render preview frames, inspect the images
> if your client supports image input, then export the MP4 and run verification.
> Keep the original media and report limitations or failed checks.

The sample `author.mjs` implements that concrete edit; the agent may change it or
use the public Scene/command APIs for a different instruction. Do not rerun the
fixture-specific verification script as proof of an unrelated edit's correctness.
For other projects, put local media in `public/` and reference `/filename.mp4`,
`/filename.wav`, etc. `pnpm render other-scene.json other-output` accepts a saved
Scene. Reopening it does not require an in-memory workflow handle.

The example permits flat local asset names, no proxies or external requests,
at most 1800 frames and 1920 pixels per dimension, 64 MiB per output, and a
120-second render deadline. These are example host limits, not engine limits.
It is a trusted local development host, not a network service for untrusted projects.
Large projects need a streaming sink; this bounded example exports a Blob.

## Dependency compatibility

Keep the included lockfile. Engine 1.1.3 pins Mediabunny **1.50.3** directly,
matching both consumers; this example needs no override. The initial 1.1.2 test
resolved an incompatible newer muxer and required a temporary 1.46.0 override.
That failure led to the upstream fix and a candidate-tarball export check in the
full release gate. See [the release record](../../docs/releases/1.1.3.md).

The scripts use only public package imports, with no source aliases, sibling
harness checkout or private app services. Vite hosts the browser modules and
Playwright launches Chromium; neither enters the browser engine packages.

This demonstrates coding-agent-driven shell execution, not a shipped Codex or
Claude Code plugin. Separate clean-session tests for those clients, autonomous
visual judgment, real-footage breadth and provider-backed speech/music generation
remain outside this example. The harness owns shared ProjectDocument history and
approvals; editing these standalone Scenes does not edit a harness project.
