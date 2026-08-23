# RFC 0001: Scene patch operations

**Status:** implemented (`@motionforge/schema` — `applyScenePatch`, `scenePatchSchema`, `sceneOpSchema`, `closestIds`; see `packages/schema/src/patch.ts`)
**Owner:** agent-layer workstream
**Consumers:** chat-driven editing (a chat UI), any tool that edits scenes incrementally

## Problem

Agents currently author whole scene documents. That works for generation but not for editing: an LLM asked to "make the title bigger" should not re-emit a 400-line scene (slow, token-expensive, and risks unrelated mutations slipping in). The scene format was designed for this moment — node ids are validated-unique precisely so tools can patch and diff reliably. What's missing is the patch vocabulary.

## Design

A patch is an ordered list of operations addressed by **node id** (never by array index — ids are stable under reordering; indexes are not). Application is **transactional**: every op validates against the evolving document, then the final document revalidates with `parseScene`; any failure rejects the whole patch with the failing op's index and an actionable message. A rejected patch leaves the input scene untouched (apply is copy-on-write; the input is never mutated).

```ts
type ScenePatch = SceneOp[];

type SceneOp =
  | { op: "setStyle"; id: string; style: Partial<SceneStyle> } // merge; null value deletes a key
  | { op: "setText"; id: string; text: string } // text nodes only
  | { op: "retime"; id: string; from?: number; duration?: number } // either or both
  | { op: "setAnimations"; id: string; animations: SceneAnimation[] } // whole-list replace
  | { op: "insertNode"; node: SceneNode; parentId?: string; beforeId?: string }
  | { op: "removeNode"; id: string } // subtree removal
  | { op: "moveNode"; id: string; parentId?: string; beforeId?: string }
  | { op: "setAsset"; asset: SceneAsset } // add or replace by asset.id
  | { op: "removeAsset"; id: string } // rejects while nodes reference it
  | {
      op: "setSceneMeta";
      width?: number;
      height?: number;
      fps?: number;
      duration?: number;
    };

// @motionforge/schema (new exports)
function applyScenePatch(
  scene: unknown,
  patch: ScenePatch,
):
  | { ok: true; scene: Scene }
  | { ok: false; errors: Array<{ opIndex: number; message: string }> };
const scenePatchSchema: z.ZodType<ScenePatch>; // + JSON Schema artifact for tool definitions
```

Decisions and rationale:

- **Merge semantics for `setStyle`, replace semantics for `setAnimations`.** Style edits are usually one or two keys ("make it red"); animations are usually authored as a unit (a preset's output) and partial keyframe surgery invites invalid frame orderings. An LLM that wants to tweak one keyframe re-emits that node's animation list — still small.
- **No generic JSON-Pointer paths.** RFC 6902 (`/nodes/3/children/0/style/...`) is index-addressed and lets a patch express states the schema can't validate incrementally. A closed op vocabulary keeps every op meaningful in scene terms, trivially diffable in UI ("changed style of `title`"), and maps 1:1 to editor actions (the editor's `changeOverlay` becomes `setStyle`/`retime`).
- **`setText` is separate from a hypothetical `setNode`** so the common caption-fix path is a one-liner and node type changes stay impossible by construction.
- **Asset removal is guarded**, not cascading: removing an asset that nodes still reference is an error naming those node ids. Cascades hide mistakes from agents; errors teach them.
- **Determinism:** `applyScenePatch` is pure. Same scene + same patch → same result. No clocks, no randomness, no id generation (inserted nodes must carry ids; duplicate ids are rejected by final validation — agents are told to namespace, e.g. `caption-7`).

### Error model

Errors follow the validator's house style — path, problem, fix:

```txt
op 2 (setStyle "titel"): No node with id "titel". Closest existing ids: "title", "title-bg". Node ids are case-sensitive.
op 4 (insertNode): Node id "title" already exists. Choose a unique id; existing ids can be listed from the scene document.
op 0 (retime "intro"): duration must be a positive integer (got 0). To hide a node, removeNode it instead.
```

The "closest existing ids" hint matters: misspelled ids are the predicted top LLM failure mode, and the correction loop should converge in one round trip.

### Versioning

A patch targets a canonical `schemaVersion: 1` scene. Legacy input must first
pass through `parseScene()` / `migrateScene()`. A future stored-patch envelope
may add an explicit schema-version guard; the current transactional operation
array remains intentionally minimal.

## Eval harness (design)

Lives in `tools/agent-eval` (not shipped). Three task suites, each scored mechanically — no LLM judging:

1. **Generate** — prompt + `llms.txt` → scene JSON. Score: `validateScene` pass rate; secondary, scene renders without throwing and a per-task structural assertion (e.g. "has a text node containing 'SALE'", "duration == 150").
2. **Edit** — scene + instruction → patch. Score: `applyScenePatch` ok-rate; assertion on the result (e.g. fontSize strictly increased, untouched nodes deep-equal — the _don't-break-the-rest_ check whole-document editing can't give).
3. **Repair** — invalid scene + validator errors → patch fixing them. Scores the error-message quality as much as the model.

Each case: `{ id, suite, input, prompt, assert(scene): string[] }`. Runner reports pass/fail per case with token counts, so prompt and `llms.txt` changes are measurable ("validation failure rate dropped from 18% to 6%"). Provider-agnostic: any chat endpoint; cases and assertions are the asset.

## Out of scope

- Operational-transform/CRDT concurrent editing (patches apply to a known document revision; the editor's existing last-write-wins persistence is unchanged).
- Undo/redo (an applied patch's inverse is computable later; not needed for the chat loop).
- An MCP server wrapping these ops — week 3+, after the ops exist.
