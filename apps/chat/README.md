# motionforge chat

Next.js chat app for generating, previewing, patching, and exporting motionforge scene JSON.

## Run

From the repo root:

```sh
pnpm dev
```

This starts the chat app at `http://localhost:5174`. The older Vite playground is still available with:

```sh
pnpm dev:playground
```

## LLM Configuration

The app works without model credentials by using a local deterministic fallback. For model-backed generation, copy the example env file:

```sh
cp apps/chat/.env.example apps/chat/.env.local
```

Vercel AI Gateway is the default provider:

```sh
MOTIONFORGE_LLM_PROVIDER=gateway
AI_GATEWAY_API_KEY=...
MOTIONFORGE_CHAT_MODEL=openai/gpt-4.1-mini
```

To use an OpenAI-compatible provider:

```sh
MOTIONFORGE_LLM_PROVIDER=openai-compatible
MOTIONFORGE_OPENAI_COMPATIBLE_BASE_URL=https://api.openai.com/v1
MOTIONFORGE_OPENAI_COMPATIBLE_API_KEY=...
MOTIONFORGE_OPENAI_COMPATIBLE_NAME=custom
MOTIONFORGE_CHAT_MODEL=gpt-4.1-mini
```

## How The Chat Loop Works

The app uses a hybrid loop with one canonical Scene contract:

- With no Scene yet, first-draft generation remains one bounded structured
  response. This is the shortest path for creating a new artifact.
- Once a Scene exists, editing uses the MF8 revisioned workflow:
  `load → inspect → command → check → proof → optional repair`.
- Without credentials, or after a model failure, the deterministic local
  compiler remains the fallback.

For an existing video, the browser sends the latest Scene snapshot—including
manual Inspector, timeline, undo, or redo changes—on every request. The server
loads it once into an opaque workspace handle. Model observations contain flat
node summaries, ids, timing, diagnostics, and revisions; they do not repeat
the recursive Scene.

The browser attaches a project epoch plus monotonic workspace revision to every request. If the
Scene or asset shelf changes while a response is in flight, that response is
never applied: the app retries once from the latest Scene and otherwise
discards it; a new session/template always invalidates the old instruction
without retry. Model-proposed `asset.set` commands are authorized against the
exact uploaded-media manifest tuple; unknown ids, invented sources, and
type/source mismatches are rejected.

The model returns one small typed decision at a time:

```json
{
  "kind": "command",
  "commands": [
    { "kind": "text.set", "id": "title", "text": "Launch in 3 days" },
    { "kind": "style.set", "id": "title", "style": { "fontSize": 112 } }
  ],
  "summary": "Updated and enlarged the title."
}
```

If the initial flat summary is truncated or omits the named target, the model
can return an `observe` decision for an exact node read or bounded search. It
cannot request the complete Scene.

Commands apply transactionally at an exact revision. The host runs bounded
composition checks and chooses proof frames from changed nodes, cuts,
keyframes, captions, and markers. Visual edits can produce before/after/visual-diff
plans; a failed check becomes the next repair observation. Simple edits usually
finish after one command/check pass.

The default Next.js Node route plans proof frames but does not claim pixel
judgment: its final visual confirmation is the browser preview. The public
browser evidence port and golden harness exercise real prepared-runtime
before/after/visual-diff/contact pixels; a deployed host can attach that port through
the same workflow evidence interface.

`scene.set`, `asset.set`, and `asset.remove` allow iterative workflows to
change composition metadata and manage multiple uploaded assets without
replacing the Scene. Node edits remain flat and id-addressed.

After completion, trusted host accessors read the final canonical Scene and
forward/inverse patch history. The browser preview and MP4 export consume that
same Scene. Workflow handles are request-local, not database or authorization
identifiers.

First-draft structured output is still validated as a complete Scene:

```json
{
  "scene": {
    "schemaVersion": 1,
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "duration": 150,
    "assets": {},
    "nodes": []
  },
  "summary": "Created a 5 second launch teaser."
}
```

## Chat Command Cookbook

The chat input is natural language first. There are no required slash commands today. The most reliable pattern is:

```txt
verb + asset/layer reference + timing + style/content
```

For uploaded media, use the asset labels shown in the Assets panel (`Video 1`, `Image 1`, `Audio 1`) or click an asset chip to insert an explicit mention such as `@Video 1`. Mentions can include source ranges:

```txt
@Video 1[00:05-00:10]
@Video 1[5-10]
@beach.mp4[12-18]
```

The local fallback supports the core media sequence flow and several first-draft/edit commands. With an LLM configured, the same examples are sent with the current scene and uploaded-media manifest, so the model can produce broader patch ops.

### First Drafts

Use these when there is no scene yet:

| Goal                   | Prompt                                                                       |
| ---------------------- | ---------------------------------------------------------------------------- |
| Product teaser         | `Make a 5 second vertical product launch teaser for a new AI video app.`     |
| Kinetic typography     | `Create a kinetic typography scene saying SHIP THE DEMO with punchy motion.` |
| Founder update         | `Turn this into a calm founder update with a clean title and three points.`  |
| Subtitle gallery       | `Show a subtitle template gallery previewing all caption styles.`            |
| Karaoke subtitle style | `Make a vertical video with neon karaoke subtitles.`                         |

### Uploaded Video And Image Commands

Upload media first in the Assets panel. The app assigns stable names like `Video 1`, `Video 2`, and `Image 1`.

| Goal                       | Prompt                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Add one clip               | `Use @Video 1.`                                                                                                                     |
| Trim one clip              | `Use @Video 1[00:05-00:10].`                                                                                                        |
| Sequence two clips         | `Put video one first from 5 to 10 seconds, then video two full.`                                                                    |
| Sequence with overlay text | `Put video one first, only keep it from 5 to 10 seconds, then video two full. Write text "I love this" on top of the second video.` |
| Use filenames              | `Use @beach.mp4[3-8] then @city.mp4.`                                                                                               |
| Mix images and video       | `Use @Image 1 first, then @Video 1, and write "Launch day" in the center.`                                                          |
| Add background music       | `Add @Audio 1 as looping quiet background music with a 1s fade in and 1s fade out.`                                                 |
| Add a cue sound            | `Play @Ping at 3s as a notification ping.`                                                                                          |

Current local behavior for media sequence commands:

- Visual media (`video` and `image`) is sequenced full-frame with `objectFit: "cover"`.
- A video source range becomes `videoStartTime` plus node `duration`.
- Images default to 5 seconds.
- Quoted text becomes a text overlay on the targeted clip, usually the second clip when the prompt says `second video`.
- The assistant shows an operation plan; clicking a plan row selects the generated layer.

Audio assets are visible in the asset shelf and can be inserted manually or by chat. The deterministic local compiler recognizes common sound-design requests such as quiet background music, voiceover, ambience, sound effects, beat accents, notification pings, start times, volume hints, loop/repeat phrasing, and fade-in/fade-out phrasing. Fades compile to validated `volumeEnvelope` data on ordinary audio nodes.

### Follow-Up Edit Commands

Use these after a scene exists:

| Goal                          | Prompt                                                    |
| ----------------------------- | --------------------------------------------------------- |
| Change title text             | `Change the title to "Launch in 3 days".`                 |
| Make title larger             | `Make the title bigger.`                                  |
| Add title motion              | `Add a spring pop-in animation to the title.`             |
| Change palette                | `Change the color palette to bold coral and teal.`        |
| Make timing shorter           | `Make it faster.`                                         |
| Make timing longer            | `Make it slower.`                                         |
| Add captions                  | `Add TikTok-style caption text near the bottom.`          |
| Add a specific subtitle style | `Use terminal-style subtitles for the caption track.`     |
| Add karaoke captions          | `Add neon karaoke subtitles with active word highlights.` |

### Practical End-To-End Cases

**Case 1: Two phone clips into a short edit**

1. Upload two videos.
2. Confirm the Assets panel shows `Video 1` and `Video 2` as `ready`.
3. Send:

```txt
Put video one first, only keep it from 5 to 10 seconds, then video two full.
Write text "I love this" on top of the second video.
```

Expected result: a sequence with `Video 1` trimmed to source seconds 5-10, `Video 2` appended after it, and a top text overlay during `Video 2`.

**Case 2: Explicit mentions when names are ambiguous**

```txt
Use @Video 1[00:02-00:04] then @Video 2. Write "Before / After" in the center.
```

Expected result: the app does not need to infer which file is which; the mention tokens map directly to the uploaded asset manifest.

**Case 3: Generate, then refine manually and by chat**

```txt
Make a 5 second vertical product launch teaser for a new AI video app.
```

Then:

```txt
Make the title bigger and add a spring pop-in animation.
```

Then use the Inspector or timeline to adjust exact positions, source starts, volume, and timing. Chat and manual edits both produce validated scene patches against the same scene document.

**Case 4: Add a music bed with fades**

Upload an audio file, then send:

```txt
Add @Audio 1 as looping quiet background music with a 1s fade in and 1s fade out.
```

Expected result: the audio asset is added as a looped `backgroundMusic` audio overlay for the scene duration, with conservative volume and a `volumeEnvelope` for the fades.

## How This Compares To Other Agentic Design Tools

Most agentic design and app-building products use the same broad loop:

1. The user describes a desired artifact or edit.
2. The system sends the current artifact as context.
3. The model returns either a new artifact or an edit to the existing artifact.
4. The app validates, builds, renders, or previews that result.
5. The user follows up, and the next prompt becomes another edit against the current artifact.

The main difference is the artifact format. motionforge uses a JSON scene document and JSON patch ops. Tools like [v0](https://vercel.com/blog/announcing-v0-generative-ui), Bolt, Lovable, or coding agents tend to use source files, code diffs, and build/test loops. Tools in the Open Design or tldraw "make real" family often use HTML, CSS, canvas state, or another design document as the artifact.

The first-draft path remains intentionally short:

```txt
Prompt -> JSON scene or JSON patch -> schema validation -> deterministic preview/export
```

Editing now uses the code-like loop:

```txt
Prompt -> plan -> edit files/artifacts -> run validation/render checks -> repair -> preview/export
```

Structured JSON remains the canonical video document because it is
deterministic, validateable, reversible, and portable. The agentic runtime now
sits around that document: it observes flat tool results, applies typed
commands, checks, renders evidence, and repairs. Provider SDK code stays in the
reference host; `@motionforge/agent-tools` itself is provider-neutral.

## Relevant Files

- `app/api/chat/route.ts` - provider selection, model call, JSON parsing, fallback handling.
- `lib/ai/iterative-decision.ts` - strict command/observe/finish/fail decision schema and observation prompt.
- `lib/motionforge/iterative-agent.ts` - bounded inspect/edit/check/proof/repair state machine.
- `lib/motionforge/iterative-workflow-adapter.ts` - bridge to the real handle registry.
- `lib/ai/prompt.ts` - system prompt and model output contract.
- `lib/motionforge/local-agent.ts` - local fallback generation, patch creation, model output normalization.
- `components/motionforge-chat-app.tsx` - chat UI, preview player, JSON view, MP4 export.
