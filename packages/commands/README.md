# @motionforge/commands

Typed, non-recursive editing commands and a revisioned in-memory workspace for
canonical MotionForge Scenes.

```ts
import {
  applySceneCommands,
  createSceneWorkspace,
  sceneCommandJsonSchema,
} from "@motionforge/commands";

const edited = applySceneCommands(scene, [
  { kind: "text.set", id: "title", text: "A better opening" },
  { kind: "placement.set", id: "title", left: 72, top: 180 },
  { kind: "motion.preset", id: "title", preset: "fadeIn" },
]);

const workspace = createSceneWorkspace(scene);
const draft = workspace.draft([
  { kind: "media.trim", id: "clip", startSeconds: 2, endSeconds: 8 },
]);
workspace.commit(draft, draft.baseRevision);
workspace.undo(workspace.revision);

const commandSchema = sceneCommandJsonSchema();
```

The 16 command kinds cover text, style, placement, resize, align/distribute,
timing, media trim/gain, flat node add/remove/move/group, motion presets,
macros, and layout/look intents. A command never embeds a recursive Scene or
child tree. Commands validate and compile sequentially against a private Scene,
then apply as one canonical transactional `ScenePatch`.

`invertScenePatch()` generates and verifies an exact canonical inverse.
`SceneWorkspace` exposes defensive reads, draft/commit, monotonic revisions,
stale-revision rejection, bounded history, forward/inverse patches, affected
IDs, semantic diffs, undo, and redo. It is process-local: persistence,
authorization, and multi-user coordination belong to the host.

`motionPresetManifests()`, `macroManifests()`, and
`capabilityManifests()` expose deterministic built-in capability metadata with
draft-07 parameter schemas, valid examples, required assets, and output roles.

## API stability

Command kind names and required fields, compiler transactionality, workspace
revision semantics, manifest version 1, and the package root entry point are
stable for 1.x. Result objects and optional command fields may grow additively.

## License

MIT
