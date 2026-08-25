# MF1 strict-Scene compatibility audit

Date: 2026-08-25
Status: repository audit complete; production-row audit required before downstream rollout

## Purpose

MF1 changes canonical v0/v1 parsing from implicit unknown-key stripping to
strict rejection. This record distinguishes evidence we have from persisted
data we have not inspected. It does not authorize a downstream migration.

## Upstream evidence

- 28 canonical/migratable example scenes pass strict parsing and the portable
  value grammar.
- The deterministic fuzzer passes 750 scenes / 2,250 evaluated frames.
- Strict fixtures cover unknown keys at Scene, asset/proxy/metadata, audio bus,
  node/style/safe-area, animation/keyframe, text run/style, ducking/envelope,
  shape/mask, effect params, and extension descriptor layers.
- `repairSceneInput()` proves unknown-key removal is explicit, nonmutating,
  diagnostic, and does not coerce other invalid values.
- Common previously visible Canvas color forms—legacy/modern RGB and HSL—are
  retained. Ambiguous browser-only values are rejected under
  [RFC 0010](rfcs/0010-portable-scene-values.md) and reported at their exact
  paths rather than being silently ignored.
- Zod and the configured generated JSON Schema share valid/invalid coverage for
  lengths, colors, gradients, transforms/origins, easing, and target-specific
  animation values.

## Dojo repository evidence

A read-only source audit scanned 250 TypeScript/TSX files covering Video Agent,
vendored MotionForge, Watermark, Music Visualizer, Music MV, subtitle flows,
and scripts:

- 68 `parseScene()` and 118 `validateScene()` call sites were identified;
- 27 apparent unknown-field candidates were reviewed;
- no checked-in compiled Scene literal retained an unsupported unknown field;
- `place`, `textRole`, `layout`, and `look` are intentional pre-IR authoring
  intents and must expand before strict Scene parsing;
- four invalid style literals were deliberate negative tests;
- checked-in downstream animation targets are within the MF1 target union.

The Dojo tree has no representative checked-in production Scene corpus.
Passing repository tests therefore does not prove persisted-row compatibility.

## Required downstream dry audit

Before Dojo synchronizes/enables MF1, a read-only command must stream and
validate, without rewriting:

- `VideoAgentProjectState.sceneJson`;
- `VideoAgentProjectRevision.sceneJson`;
- message Scene snapshots;
- active/recent generation request and response artifacts containing scenes.

The report groups failures by source table/artifact, schema version, issue code,
and path, and produces redacted repair previews for every distinct class. No
row is rewritten until a separately reviewed migration/quarantine plan exists.

## Other downstream gate

Scene Command v1 currently belongs to Dojo's vendored schema/tool adapter and
is not part of upstream MotionForge. An exact downstream package sync must
either wait for MotionForge MF4 command reconciliation or retain that patch as
an explicitly owned downstream adapter. MF1 must never be described as an
exact vendor sync while this delta exists.

Dojo's legacy model-patch repair also retains arbitrary operation keys through
object spreads, while MF1 patch envelopes are strict. Before synchronization,
that adapter must rebuild repaired operations from per-operation allowlists and
report removed keys. Dojo's command schema also currently rejects negative
video playback rates that MF1 supports for muted video; the command surface
must either gain typed reverse playback or record that product limitation.

## Decision

MF1 strictness is acceptable for the upstream canonical contract because the
committed corpus is clean and tolerant ingestion is explicit. Production
rollout remains blocked on the downstream dry audit above.
