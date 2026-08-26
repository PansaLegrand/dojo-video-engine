---
name: motionforge
description: Inspect, edit, verify, and produce evidence for MotionForge Scene videos through revisioned workflow tools. Use for MotionForge scene, media, audio, extension, macro, or agent-editing tasks; not for unrelated DojoClip application work.
---

# MotionForge agent workflow

Treat the Scene as the canonical video artifact and the workflow handle as a
temporary editing session. Do not replace or resend the whole Scene after
`motionforge.workflow.load`.

## Edit loop

1. Call `motionforge.workflow.read` for the flat workspace summary. If it is truncated or the target is absent,
   use exact-node read or search; never guess an id.
2. Apply the smallest `motionforge.workflow.commands` batch with the exact current
   revision.
3. Run `motionforge.workflow.check` at the committed revision.
4. For spatial, timing, animation, media, or quality-sensitive changes, request
   `proof.comparison.plan` or `proof.comparison.render` through
   `motionforge.workflow.evidence`.
5. If a command, check, or proof fails, inspect the failure, repair with another
   bounded command transaction, and check again.
6. Read trusted host snapshot/history only in host code, then close the handle
   or dispose the session.

Simple text-copy and gain-only edits normally need one command plus check. Use
proof selectively; evidence references are portable JSON, never pixel bytes or
native Canvas objects.

## Discovery and stable manifests

Use exported manifests rather than copying schemas:

- `workflowToolDescriptors()` for exact tool names and draft-07 schemas;
- `workflowEvidenceOperationManifests()` for proof operation parameters;
- `sceneCommandJsonSchema()` and command manifests for edit vocabulary;
- macro and motion-preset manifests for stable named authoring intents;
- extension manifests for installed, trusted host capabilities.

MCP-only hosts call `motionforge.workflow.evidence-manifests` for the same
operation catalog.

## Safety and revision rules

- Recursive Scene ingestion occurs only at load/resync.
- Supply `expectedRevision` for mutation, check consistency, undo/redo, close,
  and evidence.
- Treat stale revisions as a signal to reread/resync, not to retry blindly.
- Respect tool, result, history, raster, artifact, and repair budgets. Stop when
  a budget or authorization boundary is reached.
- Asset sources are host-authorized. Use `asset.set` only with the exact
  canonical id/type/src supplied by the host manifest; never invent a URL.
- Extensions are executable host code and must be allowlisted/installed. Scene
  JSON stores only extension name/version/params.
- Dispose handles, prepared runtimes, sinks, stores, and the workflow session
  deterministically, including failure paths.

## Media and audio

For multiple assets, inspect/search existing nodes and asset ids before adding
or sequencing nodes. Register authorized assets before `node.add`; use
`media.trim` for source ranges and `timing.set` for Scene placement. Preserve
unmentioned layers.

Use `media.gain` for video/audio gain, pan, and bus routing. Use typed audio
nodes/macros for beds, voiceover, ambience, cues, looping, envelopes, and
ducking. Transcript-aware caption macros require host-provided ASR timing; do
not fabricate semantic timestamps.

## Starters

- [Repair plus evidence](../../examples/agent-workflow-repair.mjs)
- [Portable extension](../../examples/extension-starter.mjs)
- [Typed macro](../../examples/macro-starter.mjs)
- [Framework-neutral workflow RFC](../../docs/rfcs/0013-framework-neutral-agent-workflow.md)

## Install this skill

Keep the skill inside the repository so its checked examples and RFC links stay
valid. Point the agent host at the absolute `skills/motionforge/SKILL.md` path,
or symlink the whole `skills/motionforge` directory into the host's skill
directory. Copying only `SKILL.md` breaks the repository-relative starter
links; when a host requires a standalone copy, copy the referenced `examples`
and `docs/rfcs` resources too or rewrite those links explicitly.

MotionForge packages and this skill are provider-neutral. Do not add a model
SDK, DojoClip dependency, database assumption, or SaaS authorization policy to
the engine workflow.
