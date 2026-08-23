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

The chat app is currently a JSON scene plus JSON patch loop. It does not use MCP, AI SDK tool calls, or function calling yet. The model is asked to return strict JSON, and the app validates or applies that JSON with motionforge's schema utilities.

1. The user types a prompt in the chat UI.
2. The browser sends `POST /api/chat` with the prompt, the current scene JSON, and recent chat history.
3. The API route chooses the LLM provider from `.env.local`.
4. If no model is configured, or the model path fails, the route uses the local deterministic fallback.
5. The model receives a system prompt describing the motionforge scene contract.
6. On the first turn, the model should return a complete scene:

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

7. On follow-up turns, the model should return patch ops against the existing scene:

```json
{
  "patch": [
    {
      "op": "setStyle",
      "id": "title",
      "style": {
        "fontSize": 112
      }
    }
  ],
  "summary": "Made the title larger."
}
```

8. The route parses the model text as JSON.
9. If the JSON contains `scene`, the app validates it with the motionforge scene schema.
10. If the JSON contains `patch`, the app applies it with `applyScenePatch`.
11. The resulting scene JSON becomes the new source of truth.
12. The preview player reloads that scene into the Canvas2D player.
13. MP4 export uses the same scene JSON and renderer path.

The important current limitation: follow-up memory is mostly the current scene JSON. The UI sends recent chat history, but the API prompt currently relies on the current scene and the latest instruction. That is enough for direct scene edits, but conversation-aware references should become a future improvement.

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

So the motionforge loop today is intentionally simple:

```txt
Prompt -> JSON scene or JSON patch -> schema validation -> deterministic preview/export
```

A more code-like agentic loop usually looks like this:

```txt
Prompt -> plan -> edit files/artifacts -> run validation/render checks -> repair -> preview/export
```

Structured JSON is the right starting point for this app because it is deterministic, easy to validate, easy to patch, and safer for an open-source local app. If structured responses stop being enough, the next step is not to abandon the scene schema, but to add a stronger agentic layer around it: planning, tool calls, MCP integrations, asset lookup, screenshot comparison, render scoring, and repair loops. In that future version, the JSON scene can remain the canonical video document while the agent becomes more capable at producing and improving it.

## Relevant Files

- `app/api/chat/route.ts` - provider selection, model call, JSON parsing, fallback handling.
- `lib/ai/prompt.ts` - system prompt and model output contract.
- `lib/motionforge/local-agent.ts` - local fallback generation, patch creation, model output normalization.
- `components/motionforge-chat-app.tsx` - chat UI, preview player, JSON view, MP4 export.
