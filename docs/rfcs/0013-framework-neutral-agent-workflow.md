# RFC 0013 — Framework-neutral agent workflow

- Status: Accepted
- Date: 2026-08-26
- Target milestone: MF8
- Provider dependency in public packages: None

## Decision

MotionForge publishes a deterministic, provider-neutral editing workflow over
the existing command workspace, inspection, prepared runtime, export, and
artifact contracts. It does not publish an autonomous agent or depend on an
LLM SDK.

One strict load operation accepts a recursive Scene and returns a
session-scoped opaque handle. Every iterative operation after load uses that
handle, an expected revision where mutation or evidence consistency requires
one, and bounded non-recursive inputs. A model never needs to resend the Scene
to read, search, edit, check, undo, redo, or request proof.

## Why handles, not repeated Scene arguments

Repeated whole-Scene function arguments recreate the original one-shot
failure mode: large context, stale UI state, accidental replacement, and no
transaction boundary. A handle gives the host one authoritative in-memory
workspace for a run while preserving MotionForge's canonical Scene document as
the durable artifact.

Handles are deliberately process/session local. They are not database ids,
authorization tokens, collaboration revisions, or durable project state. A
SaaS host owns those concerns and reloads its latest authorized Scene at the
boundary of each agent run.

## Public workflow

The workflow contract provides:

```text
load Scene → handle@revision
  → read/search flat summaries
  → commands.apply(expectedRevision)
  → check
  → evidence plan/render
  → repair with another command transaction when needed
  → undo/redo or close
```

`createAgentWorkflowSession()` is the direct action-envelope API.
`createAgentWorkflowToolRegistry()` exposes function-calling names whose
inputs omit the redundant internal action discriminator. Every tool publishes
detached draft-07 input and output schemas. Tool results are finite JSON trees
with hard depth/value/string/array/property limits and exactly one start plus
one terminal event.

Trusted hosts have separate frozen snapshot/history accessors. They can return
or persist the final Scene and canonical forward/inverse patches; those values
are intentionally absent from model-visible iterative results.

## Revision and UI synchronization

Commands compile and commit through `SceneWorkspace`. A successful
transaction advances the monotonic revision, records affected ids and a
semantic diff, and remains exactly undoable. Stale expected revisions fail
without mutation.

An editor begins every request from the latest UI Scene. A long-lived host may
also resynchronize during a run: it loads the newer UI snapshot, publishes the
replacement handle, discards decisions made against the old revision, then
closes the superseded handle. The engine does not invent merge semantics.

## Evidence

Proof selection is deterministic authoring evidence, not a vision judgment.
Candidates come from explicit frames, changed-node windows, media cuts,
animation keyframes, text/caption windows, and markers. Ranking, deduplication,
reasons, comparison rows, and artifact counts are bounded.

Evidence materialization uses two injected ports:

- a renderer produces still, visible channel-diff, and comparison-sheet bytes;
- a transactional sink commits portable artifact references or aborts the
  whole plan.

The browser Canvas2D port renders through prepared Scene runtimes and releases
them deterministically. Native Canvas objects and byte arrays never enter tool
JSON. The memory sink is byte/entry bounded, returns defensive copies, scopes
artifacts by session/handle, and erases aborted/disposed data.

## Reference host

The open-source chat app demonstrates the provider boundary. First-draft
generation may retain its compact one-shot path. Editing an existing Scene
uses a bounded provider-neutral loop:

```text
inspect → typed decision → command → check → proof → optional repair
```

The provider returns only a small `command | observe | finish | fail` decision.
`observe` performs a bounded exact-node read or flat search when the initial
summary is truncated; it still cannot request the Scene. The host executes
tools and supplies the next observation. This is equivalent to a
coding agent's fixed tool schemas: the schema constrains each action, while the
model may take multiple observed steps instead of guessing one final artifact.

Simple edits use the same path and normally finish after one command/check.
Complex spatial, timing, animation, or media work may request proof and repair.
Local deterministic editing remains the failure fallback, not a second Scene
mutation contract.

## Events, errors, and cleanup

The workflow emits an ordered provider-neutral event stream. Listener failures
cannot change engine behavior. Stable errors distinguish invalid requests,
bounded Scene rejection, unknown/cross-session handles, unknown nodes, invalid
frames, stale revisions, command failures, evidence failures, result budgets,
cleanup failures, and disposed sessions.

Requests serialize per session. Closing a handle and disposing a session join
evidence cancellation and cleanup. A cleanup error is reported after handles
are made unusable, preventing a half-closed workspace from being reused.

## Evaluation policy

Deterministic release gates use offline simulated planners, mechanical Scene
assertions, and browser/runtime evidence. Optional live-model runs are separate
and require explicit opt-in. A versioned report records provider, model
version/snapshot, UTC date, temperature, exact prompt hash, exact tool-manifest
hash, workflow budgets, trials, per-case success/latency/token usage, and
deterministic aggregates. Missing token data is left absent rather than
estimated.

## Non-goals

- no provider SDK, prompt policy, conversation database, or autonomous loop in
  a public engine package;
- no durable/collaborative workspace claim;
- no paid model call in deterministic tests;
- no pixel-understanding claim from geometric checks or RGBA diffs;
- no recursive Scene or native browser value in iterative tool results;
- no requirement that simple edits use a different mutation implementation.

## Compatibility

Existing stateless `createAgentToolRegistry()` tools remain available for 1.x.
The workflow registry and evidence APIs are additive root exports. Existing
Scene, command, renderer, runtime, export, and pixel/audio semantics do not
change. New command kinds are additive members of the versioned command union.
