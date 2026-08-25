# MF4 typed commands and workspace contract

Status: implemented  
Milestone: MF4 — typed commands and revisioned workspace

MF4 creates one deterministic edit vocabulary above low-level ScenePatch. A
human editor, script, or agent can describe intent with the same bounded,
non-recursive commands; MotionForge compiles those commands into canonical
transactional patches and can reverse committed changes.

## Layers

```text
typed SceneCommand[]
  -> validate and compile against one Scene revision
  -> canonical ScenePatch + affected node IDs + diagnostics
  -> transactional apply
  -> forward/inverse patches + semantic diff
  -> revisioned in-memory workspace history
```

Scene remains the canonical stored artifact. Commands describe an edit and
workspace history describes a local editing session; neither is a second video
document format.

## Command boundary

`@motionforge/commands` owns a strict discriminated command union and its
non-recursive draft-07 JSON Schema. It covers:

- text and style changes;
- placement, resize, alignment, and distribution;
- node timing plus media trim and gain;
- flat node add, remove, move, and grouping;
- motion presets and macro insertion;
- stable layout intents.

A command never embeds a recursive Scene or child tree. Adding a node is flat;
subsequent add/move/group commands construct hierarchy by ID. Macro parameters
may contain their bounded documented values, but expansion produces canonical
Scene nodes only inside the compiler.

Compilation is pure. It validates the input Scene and complete command batch,
does not mutate either, rejects unsupported/nonnumeric geometry instead of
guessing, and returns either all errors or one canonical ScenePatch. Patch
application retains schema validation as the final authority.

## Reversibility and revisions

The workspace is session-local and optimistic:

- `draft` previews commands against an expected base revision without changing
  workspace state;
- `commit` rejects stale revisions, applies atomically, increments the revision,
  and records forward/inverse patches, affected IDs, and semantic diff;
- `undo` and `redo` are transactional revisions, not hidden mutable rewinds;
- a new commit after undo clears the redo branch;
- reads and history are defensive JSON-safe snapshots.

Inverse patches preserve node parent/sibling position and complete removed
subtrees, optional fields, assets, markers, audio buses, and Scene metadata.
Applying a forward patch followed by its inverse must reproduce the original
canonical Scene exactly.

This is deliberately not durable storage, authorization, multi-user
collaboration, OT, or CRDT infrastructure. Hosts own persistence and access
control and pass an expected revision on every state-changing operation.

## Capability manifests

Motion preset and macro manifests are JSON-safe and versioned. Each contains a
draft-07 parameter schema, valid examples, explicit required-asset descriptors,
and output semantic roles. Manifests are deterministic discovery data; they do
not expose mutable registries or executable provider/model code.

## Completion evidence

The milestone gate covers every command kind, schema non-recursion, macro and
preset examples, exact forward/inverse round trips for every ScenePatch kind,
stale draft rejection, undo/redo branch behavior, failed transactions, stable
semantic diffs, unaffected node equality, package contracts, packed external
installation, and the full renderer/export compatibility suite.
