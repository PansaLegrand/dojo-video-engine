# agent-eval

Mechanical eval harness for LLM scene **generation** and **editing**. Private
tooling — never published and never invoked against a live model by the
deterministic release gate.

The judge is not a model: replies are scored by `validateScene` / `applyScenePatch` plus per-case structural assertions (e.g. "title fontSize doubled **and** every untouched node is byte-identical"). That makes scores reproducible and turns `llms.txt`/prompt changes into measurable deltas.

## Two baselines

- `--mode legacy` keeps the RFC 0001 one-shot baseline: generation returns one
  Scene JSON document and editing returns one ScenePatch array. Keep it for
  longitudinal comparison; it is not the MF8 architecture.
- `--mode workflow` evaluates the MF8 iterative handle runtime. The host loads
  a Scene once, the model receives flat read/search/check/command/undo/redo
  tools, and the mechanical judge scores the final trusted-host snapshot.

Both modes emit the same versioned report envelope, including provider/model
identity, model version or snapshot, exact selected-case prompt hash, exact
sent tool-manifest hash, temperature, workflow budgets, trial count, UTC date,
per-case success/latency/token usage, and deterministic aggregates.

## Live run

Live execution requires an explicit opt-in plus credentials. Merely running
the package's test/release command cannot contact an endpoint:

```sh
EVAL_LIVE=1 \
EVAL_BASE_URL=https://your-endpoint/v1 \
EVAL_API_KEY=… \
EVAL_PROVIDER=your-provider \
EVAL_MODEL=… \
EVAL_MODEL_SNAPSHOT=2026-08-01 \
pnpm --filter @motionforge/agent-eval run eval -- --mode workflow

# Retain the historical baseline explicitly:
pnpm --filter @motionforge/agent-eval run eval -- --mode legacy --suite edit
```

Use `EVAL_MODEL_VERSION` instead of or alongside `EVAL_MODEL_SNAPSHOT` when the
provider publishes a version rather than a dated snapshot. Optional controls:

- `EVAL_TRIALS` (default `1`);
- `EVAL_TEMPERATURE` (default `0`);
- `EVAL_MAX_TOOL_STEPS` (default `12`);
- `EVAL_MAX_TOOL_CALLS_PER_RESPONSE` (default `8`);
- `EVAL_MAX_TOOL_CALLS` (default `48`);
- `EVAL_REQUEST_TIMEOUT_MS` (default `120000`);
- `EVAL_MAX_OUTPUT_TOKENS` (default `8000`);
- `EVAL_REPORT_PATH` to save the JSON report in addition to stdout;
- `--suite generate|edit` and `--case <id>` filters.

Any OpenAI-compatible chat-completions endpoint with function tools works.
Usage fields from either `prompt_tokens`/`completion_tokens` or
`input_tokens`/`output_tokens` are normalized when supplied; unavailable token
counts remain absent rather than being estimated. Aggregates report coverage
separately for input, output, and total; a field is summed across a multi-turn
case only when every model call reported it. Inconsistent supplied totals are
rejected rather than repaired.

## Suites

- **generate** — legacy mode scores prompt → Scene JSON; workflow mode starts
  from one loaded blank Scene and scores the final handle snapshot. Both use
  canonical validation plus duration/canvas/node/style assertions.
- **edit** — legacy mode scores one ScenePatch; workflow mode scores iterative
  commands against one loaded Scene. Both include the _don't-break-the-rest_
  assertion that whole-document generation cannot guarantee.

A **repair** suite (invalid scene + validator errors → fixing patch) is designed in RFC 0001 and lands when the first two have baselines.

## Reports and hashes

The prompt hash covers the exact initial system/user message material for every
selected case/trial. Workflow mode hashes the exact provider-safe function
definitions sent to the endpoint; legacy mode hashes the actual empty tool
list. A separate corpus hash covers the exact case and mechanical scorer source.
Report aggregation sorts by case id/trial and uses fixed nearest-rank
latency percentiles, so identical inputs produce byte-stable report structure
apart from observed live latency/date/usage.

`EVAL_REPORT_PATH` is honored only after `EVAL_LIVE=1` and all required live
metadata/credentials pass validation. Without live opt-in the runner exits
before constructing a request or writing a report.

Workflow cases also record model turns, total tool calls, whether read/search
preceded the first mutation, whether the final committed revision was checked,
and whether evidence was requested. Missing inspection or a final check is a
case failure; evidence remains a separately reported signal because copy-only
edits do not require rendered proof.

## Offline release evidence

`pnpm --filter @motionforge/agent-eval test` runs only pure scorer, workflow,
hash, schema, boundedness, usage-normalization, and aggregation tests. It makes
no network calls and needs no credentials. Add cases in `src/cases.ts`; every
case needs at least one passing and one failing reply covered in
`src/score.test.ts`.
