# MF8 — Typed inspect/edit/check workflows

Status: complete
Decision: [RFC 0013](rfcs/0013-framework-neutral-agent-workflow.md)
Public package: `@dojo-video-engine/agent-tools`

## Outcome

MF8 turns Dojo Video Engine's independent capabilities into one coding-agent-like
loop without putting an agent framework in the engine:

```text
latest authorized/UI Scene
        │ one strict recursive load
        ▼
opaque handle @ revision
        │
        ├─ flat read / search / check
        ├─ typed reversible commands
        ├─ proof-frame plan / render artifacts
        ├─ repair at the next observed revision
        └─ trusted host snapshot + patch history
```

The Scene remains the canonical video document. The handle is process-local
working state, comparable to a coding agent's checked-out workspace. Models do
not receive or replace the complete artifact on each step.

## Tool protocol

`createAgentWorkflowSession()` accepts internal action envelopes.
`createAgentWorkflowToolRegistry()` is the ergonomic provider adapter: its
descriptors identify tools by name and omit the redundant action field.

| Tool                             | Purpose                                     | Recursive Scene input  |
| -------------------------------- | ------------------------------------------- | ---------------------- |
| `dojo-video-engine.workflow.load`      | Strict parse/preflight and create a handle  | Yes, the only boundary |
| `dojo-video-engine.workflow.read`      | Flat composition or exact-node summary      | No                     |
| `dojo-video-engine.workflow.search`    | Bounded id/text/asset/type lookup           | No                     |
| `dojo-video-engine.workflow.check`     | Validation/lint/sampled layout diagnostics  | No                     |
| `dojo-video-engine.workflow.commands`  | One transactional typed command batch       | No                     |
| `dojo-video-engine.workflow.undo/redo` | Exact workspace history transition          | No                     |
| `dojo-video-engine.workflow.evidence`  | Proof selection/plan/materialization by ref | No                     |
| `dojo-video-engine.workflow.events`    | Bounded ordered provider-neutral events     | No                     |
| `dojo-video-engine.workflow.close`     | Cancel evidence and release one handle      | No                     |
| `dojo-video-engine.workflow.dispose`   | Join and release the whole session          | No                     |

Every descriptor includes detached strict draft-07 input and output schemas.
All results are finite JSON trees with configurable value/depth limits plus
fixed string/array/property bounds. A request emits exactly one start and one
complete/error event. Listener failures cannot change the operation.

`hostSnapshot()` and `hostHistory()` are intentionally absent from tool
descriptors. They return deeply frozen defensive Scene and forward/inverse
patch evidence to trusted application code after the model loop.

## Editing and revisions

All mutations compile through `SceneWorkspace`; a batch either commits fully
or leaves the Scene/revision untouched. Mutations require `expectedRevision`.
Commit, undo, and redo advance a monotonic revision and retain affected ids,
diagnostics, semantic diff, forward patch, and verified inverse.

MF8 adds three non-recursive command kinds:

- `scene.set` for bounded width/height/fps/duration changes;
- `asset.set` for one canonical image/video/audio/font/Lottie asset;
- `asset.remove` for an unreferenced asset.

Together with flat `node.add`, they let a workflow initialize a blank
composition and manage multiple uploaded assets without a Scene replacement.
The command union now has 19 additive kinds; the original 16 branches and
defaults are unchanged.

## Proof selection and comparison

`selectProofFrames()` builds a deterministic candidate set from:

- explicit requested frames;
- the start/middle/end of changed-node windows;
- media cut-before/start/end boundaries;
- animation keyframes;
- text/caption start/middle/end windows;
- Scene markers.

Candidates retain bounded reason evidence and stable ranks. A changed duration
may produce a row that exists on only one side. `planComparisonSheet()` emits
portable still/visual-diff/contact requests without rendering.

`materializeEvidenceArtifacts()` uses an injected renderer and transactional
sink. A failed render, invalid ref, byte overflow, cancellation, write, or
commit aborts the uncommitted plan. Successful tool results contain only
allowlisted artifact references.

The included browser port:

- creates at most one prepared Canvas2D runtime for each before/after Scene in
  one materialization;
- renders stills, opaque visible channel diffs, and aspect-preserving bounded
  contact-sheet thumbnails;
- preserves caller Canvas state and joins idempotent runtime/surface cleanup;
- encodes PNG/JPEG/WebP behind dimension/pixel/byte budgets.

The memory sink scopes atomic artifacts by session and handle, returns
defensive copies to trusted hosts, and zeroes/removes bytes on handle/session
cleanup. Native Canvas objects and `Uint8Array` values never enter workflow
JSON.

## Reference iterative host

The open-source Next.js chat app now uses a hybrid at the correct boundary:

- no current Scene: bounded first-draft structured generation;
- current Scene: `inspect → decision → command → check → proof → repair`.

The model decision schema is only `command | observe | finish | fail`.
`observe` requests a bounded exact-node read or flat search when a target is
hidden beyond the initial summary. This is not the old one-shot restriction:
each command executes against observed state and the
next turn receives check/evidence failures. Simple edits normally need one
decision and skip proof when it cannot add value. Spatial, timing, animation,
media, and repair paths can request evidence.

The default Next.js Node route uses `proof.comparison.plan`, because it has no
headless Canvas and must not describe geometry as pixel verification. The
public browser port and pinned golden run the full render operation; a product
may attach the same port client-side or supply its own server renderer.

Every request begins with the current browser Scene, so Inspector, timeline,
manual asset, undo, and redo changes are visible. The provider prompt receives
flat inspection data rather than the recursive document. The provider SDK,
model choice, timeout, conversation policy, and local fallback remain in the
app, outside public Dojo Video Engine packages.

A client project epoch plus monotonic workspace revision prevent an in-flight
response from overwriting newer manual or asset-shelf changes—or applying an
old instruction to a new session/template. Same-epoch edits retry once from
the latest snapshot; epoch changes and still-stale replies are discarded. The server echoes
the exact base epoch/revision, and model-proposed `asset.set` commands are rewritten
only from an authorized manifest alias to the exact canonical id/type/src
tuple; unknown, ambiguous, or mismatched sources fail before workspace tools.

The provider-neutral host and real-registry bridge are tested separately from
the model adapter. Tests cover fast edit, blocking-check repair, rendered-proof
repair, retry-safe reads, stale-revision recovery, concurrent UI resync with
decision discard, handle replacement cleanup, strict tool errors, budgets,
abort, and whole-Scene rejection after load.

## Optional live evaluation

The private eval runner keeps the historical one-shot baseline and adds an MF8
workflow mode using the exact public tool descriptors. Network access requires
`EVAL_LIVE=1` plus endpoint credentials and provider/model version metadata.
Offline release commands cannot contact an endpoint or write a report.

Report v1 requires:

- provider, model id, version and/or snapshot, UTC date, temperature;
- SHA-256 of exact initial prompt material and provider-safe tool manifest;
- workflow budgets and trial count;
- per-response/total tool-call limits, request timeout, output-token cap, and
  protocol trace (inspect before mutation plus a check at final revision);
- a case-corpus/scorer hash in addition to prompt/tool hashes;
- per-case success, failure evidence, latency, and reported token usage;
- deterministic success-rate, latency-percentile, and token aggregates.

Missing usage fields remain absent rather than estimated. Live-model results
are diagnostic evidence, never a deterministic release dependency.

## Compatibility and limits

- Existing stateless `createAgentToolRegistry()` tools remain stable.
- Workflow APIs are additive root exports from `@dojo-video-engine/agent-tools`.
- Handles are neither durable ids nor authorization credentials.
- Evidence checks geometry and rendered differences; it does not claim to
  understand video meaning or aesthetic quality.
- Product semantic media analysis, ASR, embeddings, asset retrieval, durable
  projects, permissions, and collaboration remain downstream concerns.
- Provider SDKs do not enter public package dependencies.

## Focused verification

Before the final release gate:

| Command                                       | Evidence                                                     |
| --------------------------------------------- | ------------------------------------------------------------ |
| `pnpm --filter @dojo-video-engine/commands test`    | 67 tests                                                     |
| `pnpm --filter @dojo-video-engine/agent-tools test` | 49 tests                                                     |
| `pnpm --filter @dojo-video-engine/chat test`        | 129 tests                                                    |
| `pnpm --filter @dojo-video-engine/agent-eval test`  | 15 tests; offline only                                       |
| `pnpm golden:test`                            | workflow before/after/diff/contact pixels and cleanup passed |

The pinned browser workflow loads one Scene, applies a typed command, renders
ten portable artifacts through two prepared runtimes, decodes a 480×270
comparison sheet and a non-empty visible diff, verifies that no Scene appears
in the tool result, then proves two-of-two runtime disposal and zero retained
artifact bytes.

Final evidence on 2026-08-26:

- `pnpm release:full` passed 1,110 workspace unit tests, 750 generated Scenes /
  2,250 evaluated frames, the 28-Scene corpus, all seven resource checks, all
  established pixel/media/audio/export/runtime/layout goldens, the new real
  handle-workflow proof suite, Chromium/Firefox/WebKit probes, all 10
  playground E2E checks, CLI/starter smoke, and dry-run packing for all 15
  public packages;
- the browser workflow loaded once, committed at revision 1, returned no Scene
  in 6,797 characters of portable tool JSON, materialized ten scoped PNG refs,
  decoded a 480×270 comparison sheet and a 13,299-changed-pixel visual diff,
  then disposed two-of-two runtimes with zero retained refs/bytes;
- the 720p performance gate peaked at 6.52 ms/frame and 33 MiB JS heap.
  Cache-hit compositing measured 1.90 ms/frame at 1080p and 1.92 ms/frame at
  4K with unchanged cache-disabled exact-pixel oracles;
- all focused adversarial audits closed with no release blocker. The public
  agent-tools tarball contains 23 files and is 78.5 kB compressed / 465.8 kB
  unpacked; its workflow declaration was reduced to 35.6 kB;
- `pnpm verify:clean` packed all 15 packages, installed the generated starter
  outside the monorepo, imported packed runtime entry points, and passed
  validate/migrate/inspect/lint/build.
