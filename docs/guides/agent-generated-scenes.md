# Agent-Generated Scenes

MotionForge is designed so LLMs and coding agents can generate and edit videos without controlling a browser or guessing a hidden runtime.

## The Contract

Agents should treat the scene document as the canonical artifact:

```txt
prompt -> scene JSON -> explicit repair (if allowed) -> validate -> preview/export
```

For follow-up edits:

```txt
instruction -> scene patch ops -> applyScenePatch -> validate -> preview/export
```

Read:

- [`llms.txt`](../../llms.txt) for the compact agent contract
- [Scene Format](../scene-format.md) for the full schema and style matrix
- [Preset Catalog](preset-catalog.md) for stable style names
- [RFC 0001 Scene Patch Ops](../rfcs/0001-scene-patch-ops.md) for edit operations

## CLI Loop

Agents working in a filesystem should generate a scene module and run:

```sh
motionforge validate src/video.ts
motionforge print src/video.ts
motionforge lint src/video.ts
motionforge inspect src/video.ts
motionforge dev src/video.ts
```

Validation errors are intentionally actionable. They name the path, the issue, and usually the repair.

Canonical Scene parsing is strict and never drops unknown keys. A host that
chooses tolerant model ingestion should call `repairSceneInput()` explicitly,
surface its removal diagnostics, and reject the result if any other validation
error remains. Do not use tolerant ingestion for already-stored canonical
documents.

Example:

```txt
nodes.0.children.1.id: Duplicate node id "title". Node ids must be unique across the scene so tools can patch and diff nodes reliably.
```

## Editing Existing Scenes

Use patch ops rather than re-emitting the whole scene for follow-up edits. Patch ops are id-addressed and transactional:

```json
[
  {
    "op": "setText",
    "id": "headline",
    "text": "Launch Week"
  },
  {
    "op": "setStyle",
    "id": "headline",
    "style": { "top": 720, "fontSize": 92 }
  }
]
```

If an id is wrong, `applyScenePatch()` returns closest-id hints. That is easier for a model to repair than a visual mismatch.

## Media Instructions

For project files, use the public asset convention:

```ts
const clip = videoAsset("clip", publicAsset("assets/clip.mp4"));
```

The generated scene asset is explicit:

```json
{
  "clip": {
    "id": "clip",
    "type": "video",
    "src": "/assets/clip.mp4"
  }
}
```

Do not invent files. Only reference files the user placed in `public/assets` or URLs they supplied.

## Text And Subtitle Instructions

When text can come from prompts, transcripts, CMS rows, or user files, prefer the authoring helpers that already set safe bounds:

```ts
textBox("A prompt-generated title that may be longer than expected", {
  placement: "title",
  maxLines: 2,
});
```

Use segment subtitles for SRT, WebVTT, and transcript cues:

```ts
const segments = parseSrt(srtText);
subtitleTrack(segments, {
  template: "minimalBar",
  maxLines: 2,
});
```

Use `parseVtt()` for WebVTT files and `captionTrack(words, { template })` for ASR word timings. The emitted scene is still ordinary timed `div` and `text` nodes, so patch loops and validators can inspect or edit it directly.

## Practical Prompting Rules

- Use `@motionforge/authoring` for new programmer-facing scene modules.
- Prefer stable preset names from the preset catalog over raw style invention.
- Prefer `textBox()` for unknown-length overlay copy, `subtitleTrack()` for SRT/VTT/segment cues, and `captionTrack()` for word-timed ASR captions.
- Prefer `seconds()` in source, but remember emitted scene JSON uses integer frames.
- Keep ids semantic and stable: `headline`, `clip-main`, `music-bed`.
- Use `publicAsset()` for local files and absolute URLs for remote files.
- Validate before claiming a scene works.
- On validation failure, repair the smallest part of the scene or patch.
