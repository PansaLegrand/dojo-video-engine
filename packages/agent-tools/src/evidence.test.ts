import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import type { Scene, SceneNode } from "@motionforge/schema";
import {
  comparisonSheetPlanJsonSchema,
  comparisonSheetPlanRequestJsonSchema,
  comparisonSheetPlanResultJsonSchema,
  evidenceArtifactRequestJsonSchema,
  evidenceArtifactResultJsonSchema,
  materializeEvidenceArtifacts,
  planComparisonSheet,
  proofFrameSelectionJsonSchema,
  proofFrameSelectionRequestJsonSchema,
  proofFrameSelectionResultJsonSchema,
  selectProofFrames,
  type ComparisonSheetPlan,
  type EvidenceArtifactRef,
  type EvidenceArtifactRenderer,
  type EvidenceArtifactSink,
  type EvidenceArtifactSinkWriter,
  type EvidenceRenderedArtifact,
  type ProofFrameSelection,
} from "./evidence.js";

function evidenceScene(duration = 60): Scene {
  return {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration,
    assets: {
      clip: { id: "clip", type: "video", src: "clip.mp4" },
    },
    markers: { beat: 20 },
    nodes: [
      {
        id: "clip-node",
        type: "video",
        assetId: "clip",
        from: 10,
        duration: 30,
        volume: 0,
      },
      {
        id: "caption",
        type: "text",
        text: "Proof this caption window",
        from: 15,
        duration: 20,
        style: { fontSize: 24 },
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [
              { frame: 0, value: 0 },
              { frame: 5, value: 1 },
              { frame: 10, value: 0.5 },
            ],
          },
        ],
      },
    ],
  };
}

function expectSelection(value: ReturnType<typeof selectProofFrames>) {
  if (!value.ok) {
    throw new Error(value.errors.map((error) => error.message).join("\n"));
  }
  return value;
}

function expectPlan(value: ReturnType<typeof planComparisonSheet>) {
  if (!value.ok) {
    throw new Error(value.errors.map((error) => error.message).join("\n"));
  }
  return value;
}

function proofSelection(frames = [0, 10]): ProofFrameSelection {
  return {
    ok: true,
    kind: "motionforge.proof-frame-selection",
    version: 1,
    beforeDuration: 30,
    afterDuration: 60,
    timelineDuration: 60,
    candidatesConsidered: frames.length,
    droppedCandidates: 0,
    frames: frames.map((frame, index) => ({
      frame,
      rank: index + 1,
      score: 1_001,
      reasons: [{ code: "explicit", label: `Explicit proof frame ${frame}` }],
    })),
  };
}

function comparisonPlan(frames = [0, 10]): ComparisonSheetPlan {
  return expectPlan(planComparisonSheet({ selection: proofSelection(frames) }));
}

describe("proof-frame evidence selection", () => {
  it("selects explicit, cut, keyframe, marker, and text-window proof frames", () => {
    const scene = evidenceScene();
    const first = expectSelection(
      selectProofFrames({
        before: scene,
        after: scene,
        explicitFrames: [2, 2],
      }),
    );
    const second = expectSelection(
      selectProofFrames({
        before: scene,
        after: scene,
        explicitFrames: [2, 2],
      }),
    );

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.frames.map(({ frame }) => frame)).toEqual(
      [...first.frames.map(({ frame }) => frame)].sort((a, b) => a - b),
    );
    const codes = new Set(
      first.frames.flatMap(({ reasons }) => reasons.map(({ code }) => code)),
    );
    for (const code of [
      "explicit",
      "cut-before",
      "cut-start",
      "cut-end",
      "animation-keyframe",
      "marker",
      "text-start",
      "text-middle",
      "text-end",
    ] as const) {
      expect(codes.has(code), code).toBe(true);
    }
    const explicit = first.frames.find(({ frame }) => frame === 2)!;
    expect(
      explicit.reasons.filter(({ code }) => code === "explicit"),
    ).toHaveLength(1);
    expect(explicit.rank).toBe(1);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it("ranks supplied and automatically derived scene changes by node timing", () => {
    const before = evidenceScene();
    const after = structuredClone(before);
    after.nodes[1]!.text = "Changed caption";
    const automatic = expectSelection(selectProofFrames({ before, after }));
    expect(
      automatic.frames.some(({ reasons }) =>
        reasons.some(
          ({ code, sourceId }) =>
            code === "scene-change" && sourceId === "caption",
        ),
      ),
    ).toBe(true);

    const supplied = expectSelection(
      selectProofFrames({
        before,
        after,
        changes: [
          { kind: "change", path: ["nodes", "caption", "text"] },
          { kind: "change", path: ["nodes", "caption", "text"] },
        ],
        budgets: { maxReasonsPerFrame: 2 },
      }),
    );
    for (const frame of supplied.frames) {
      expect(frame.reasons.length).toBeLessThanOrEqual(2);
      expect(
        new Set(frame.reasons.map((reason) => JSON.stringify(reason))).size,
      ).toBe(frame.reasons.length);
    }
  });

  it("rejects invalid frames, strict keys, and every bounded input class", () => {
    const scene = evidenceScene();
    expect(
      selectProofFrames({ before: scene, after: scene, explicitFrames: [60] }),
    ).toMatchObject({ ok: false, errors: [{ code: "invalid_frame" }] });
    expect(
      selectProofFrames({ before: scene, after: scene, surprise: true }),
    ).toMatchObject({ ok: false, errors: [{ code: "invalid_request" }] });
    expect(
      selectProofFrames({
        before: scene,
        after: scene,
        changes: Array.from({ length: 6 }, () => ({
          kind: "change",
          path: ["nodes", "caption"],
        })),
        budgets: { maxChanges: 5 },
      }),
    ).toMatchObject({ ok: false, errors: [{ code: "budget_exceeded" }] });

    const manyNodes = evidenceScene();
    manyNodes.nodes = Array.from({ length: 6 }, (_, index) => ({
      id: `node-${index}`,
      type: "div",
    }));
    expect(
      selectProofFrames({
        before: manyNodes,
        after: manyNodes,
        budgets: { maxSceneNodes: 5 },
      }),
    ).toMatchObject({ ok: false, errors: [{ code: "budget_exceeded" }] });

    const animated = evidenceScene();
    animated.nodes[1]!.animations = [
      {
        kind: "keyframes",
        property: "opacity",
        frames: Array.from({ length: 10 }, (_, frame) => ({
          frame,
          value: frame / 10,
        })),
      },
    ];
    expect(
      selectProofFrames({
        before: animated,
        after: animated,
        budgets: { maxCandidates: 3 },
      }),
    ).toMatchObject({ ok: false, errors: [{ code: "budget_exceeded" }] });

    expect(
      selectProofFrames({
        before: evidenceScene(),
        after: evidenceScene(),
        budgets: { maxComparedValues: 5 },
      }),
    ).toMatchObject({ ok: false, errors: [{ code: "budget_exceeded" }] });
  });

  it("keeps nested absolute timing origins when ancestors begin before zero", () => {
    const nested = evidenceScene();
    nested.nodes = [
      {
        id: "parent",
        type: "div",
        from: -5,
        duration: 30,
        children: [
          {
            id: "nested-clip",
            type: "video",
            assetId: "clip",
            from: 10,
            duration: 10,
            volume: 0,
          },
        ],
      },
    ];
    const selected = expectSelection(
      selectProofFrames({ before: nested, after: nested }),
    );
    expect(selected.frames.find(({ frame }) => frame === 5)?.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "cut-start",
          sourceId: "nested-clip",
        }),
      ]),
    );
  });

  it("publishes detached strict draft-07 request/result schemas with Ajv parity", () => {
    const ajv = new Ajv({ strict: false });
    const proof = proofFrameSelectionRequestJsonSchema();
    const proofResult = proofFrameSelectionResultJsonSchema();
    const comparison = comparisonSheetPlanRequestJsonSchema();
    const comparisonResult = comparisonSheetPlanResultJsonSchema();
    const artifactRequest = evidenceArtifactRequestJsonSchema();
    const artifactResult = evidenceArtifactResultJsonSchema();
    for (const schema of [
      proof,
      proofResult,
      comparison,
      comparisonResult,
      artifactRequest,
      artifactResult,
    ]) {
      expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    }
    expect(proof).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    expect(comparison).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    expect(
      ajv.validate(proof, {
        before: evidenceScene(),
        after: evidenceScene(),
      }),
    ).toBe(true);
    expect(
      ajv.validate(proof, {
        before: evidenceScene(),
        after: evidenceScene(),
        surprise: true,
      }),
    ).toBe(false);
    const selection = proofSelection([0]);
    const plan = comparisonPlan([0]);
    expect(ajv.validate(proofResult, selection)).toBe(true);
    expect(ajv.validate(comparison, { selection })).toBe(true);
    expect(ajv.validate(comparisonResult, plan)).toBe(true);
    expect(ajv.validate(artifactRequest, plan.artifacts[0])).toBe(true);
    const artifactEnvelope = {
      ok: true,
      kind: "motionforge.evidence-artifacts",
      version: 1,
      planId: plan.id,
      totalBytes: 3,
      artifacts: [
        {
          id: plan.artifacts[0]!.id,
          kind: plan.artifacts[0]!.kind,
          uri: `memory://${plan.artifacts[0]!.id}`,
          mimeType: "image/png",
          byteLength: 3,
          width: 2,
          height: 2,
        },
      ],
    };
    expect(ajv.validate(artifactResult, artifactEnvelope)).toBe(true);
    expect(
      ajv.validate(artifactResult, {
        ...artifactEnvelope,
        artifacts: [
          { ...artifactEnvelope.artifacts[0], uri: "javascript:alert(1)" },
        ],
      }),
    ).toBe(false);
    proof.title = "mutated";
    expect(proofFrameSelectionRequestJsonSchema()).not.toHaveProperty(
      "title",
      "mutated",
    );
    expect(proofFrameSelectionJsonSchema()).toEqual(
      proofFrameSelectionRequestJsonSchema(),
    );
    expect(comparisonSheetPlanJsonSchema()).toEqual(
      comparisonSheetPlanRequestJsonSchema(),
    );
  });
});

describe("comparison-sheet planning", () => {
  it("plans deterministic before/after/diff rows and an aggregate sheet", () => {
    const plan = comparisonPlan([0, 10, 45]);
    expect(plan.columns).toBe(3);
    expect(plan.rows).toHaveLength(3);
    expect(plan.rows[2]).toMatchObject({
      frame: 45,
      beforeFrame: null,
      afterFrame: 45,
      artifactIds: { after: "still-after-00000045" },
    });
    expect(plan.rows[2]?.artifactIds).not.toHaveProperty("visualDiff");
    expect(plan.artifacts.at(-1)).toEqual({
      id: "comparison-sheet",
      kind: "contact-sheet",
      rowIds: ["row-00000000", "row-00000010", "row-00000045"],
      columns: 3,
    });
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
    expect(
      planComparisonSheet({ selection: proofSelection([0]), nope: true }),
    ).toMatchObject({
      ok: false,
      errors: [{ code: "invalid_comparison_plan" }],
    });
  });

  it("supports a two-column plan without diff artifacts", () => {
    const plan = expectPlan(
      planComparisonSheet({
        selection: proofSelection([0, 10]),
        includeVisualDiff: false,
        title: "Review",
      }),
    );
    expect(plan.columns).toBe(2);
    expect(plan.artifacts.some(({ kind }) => kind === "visual-diff")).toBe(
      false,
    );
    expect(plan.title).toBe("Review");
  });

  it("rejects duplicate frames, ranks, and colliding reasons before artifact ids", () => {
    const duplicateFrames = proofSelection([0, 0]);
    expect(planComparisonSheet({ selection: duplicateFrames })).toMatchObject({
      ok: false,
      errors: [{ code: "invalid_comparison_plan" }],
    });

    const duplicateReasons = proofSelection([0]);
    duplicateReasons.frames[0]!.reasons.push(
      structuredClone(duplicateReasons.frames[0]!.reasons[0]!),
    );
    expect(planComparisonSheet({ selection: duplicateReasons })).toMatchObject({
      ok: false,
      errors: [{ code: "invalid_comparison_plan" }],
    });

    const duplicateRanks = proofSelection([0, 10]);
    duplicateRanks.frames[1]!.rank = duplicateRanks.frames[0]!.rank;
    expect(planComparisonSheet({ selection: duplicateRanks })).toMatchObject({
      ok: false,
      errors: [{ code: "invalid_comparison_plan" }],
    });
  });
});

type SinkState = {
  writes: string[];
  committed: boolean;
  aborts: number;
  beginCalls: number;
};

function fakeRenderer(
  overrides: {
    failId?: string;
    bytes?: number;
    wait?: Promise<never>;
  } = {},
): EvidenceArtifactRenderer {
  return {
    async render(request) {
      if (request.id === overrides.failId) throw new Error("render exploded");
      if (overrides.wait) return overrides.wait;
      return {
        mimeType: "image/png",
        width: 2,
        height: 2,
        bytes: new Uint8Array(overrides.bytes ?? 3).fill(request.id.length),
      };
    },
  };
}

function fakeSink(
  options: {
    failWrite?: number;
    invalidRef?: boolean;
    failAbort?: boolean;
    uri?: string;
  } = {},
): { sink: EvidenceArtifactSink; state: SinkState } {
  const state: SinkState = {
    writes: [],
    committed: false,
    aborts: 0,
    beginCalls: 0,
  };
  const sink: EvidenceArtifactSink = {
    async begin() {
      state.beginCalls += 1;
      const writer: EvidenceArtifactSinkWriter = {
        async write(request, artifact) {
          state.writes.push(request.id);
          if (state.writes.length === options.failWrite) {
            throw new Error("sink exploded");
          }
          const ref: EvidenceArtifactRef = {
            id: options.invalidRef ? "wrong" : request.id,
            kind: request.kind,
            uri: options.uri ?? `memory://${request.id}`,
            mimeType: artifact.mimeType,
            byteLength: artifact.bytes.byteLength,
            width: artifact.width,
            height: artifact.height,
          };
          return ref;
        },
        async commit() {
          state.committed = true;
        },
        async abort() {
          state.aborts += 1;
          if (options.failAbort) throw new Error("abort exploded");
        },
      };
      return writer;
    },
  };
  return { sink, state };
}

describe("evidence artifact materialization", () => {
  it("rejects missing/reordered terminal sheets and mismatched row artifact links", async () => {
    const base = comparisonPlan([0]);
    const noContact = structuredClone(base);
    noContact.artifacts.pop();
    const contactFirst = structuredClone(base);
    contactFirst.artifacts.unshift(contactFirst.artifacts.pop()!);
    const mismatch = structuredClone(base);
    mismatch.rows[0]!.artifactIds.before = mismatch.rows[0]!.artifactIds.after;
    for (const plan of [noContact, contactFirst, mismatch]) {
      const memory = fakeSink();
      const result = await materializeEvidenceArtifacts({
        before: evidenceScene(30),
        after: evidenceScene(60),
        plan,
        renderer: fakeRenderer(),
        sink: memory.sink,
      });
      expect(result).toMatchObject({
        ok: false,
        errors: [{ code: "invalid_comparison_plan" }],
      });
      expect(memory.state.beginCalls).toBe(0);
    }
  });

  it("renders and transactionally persists portable artifact references", async () => {
    const plan = comparisonPlan([0, 10]);
    const memory = fakeSink();
    const result = await materializeEvidenceArtifacts({
      before: evidenceScene(30),
      after: evidenceScene(60),
      plan,
      renderer: fakeRenderer(),
      sink: memory.sink,
    });
    expect(result).toMatchObject({
      ok: true,
      kind: "motionforge.evidence-artifacts",
      planId: plan.id,
      totalBytes: plan.artifacts.length * 3,
    });
    if (!result.ok) return;
    expect(result.artifacts).toHaveLength(plan.artifacts.length);
    expect(memory.state).toMatchObject({ committed: true, aborts: 0 });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(
      result.artifacts.every(
        (artifact) =>
          typeof artifact.uri === "string" && !("bytes" in artifact),
      ),
    ).toBe(true);
  });

  it("aborts the sink on renderer, sink, invalid-ref, and size failures", async () => {
    const plan = comparisonPlan([0]);
    for (const scenario of [
      {
        renderer: fakeRenderer({ failId: plan.artifacts[0]!.id }),
        memory: fakeSink(),
        code: "artifact_render_failed",
      },
      {
        renderer: fakeRenderer(),
        memory: fakeSink({ failWrite: 2 }),
        code: "artifact_sink_failed",
      },
      {
        renderer: fakeRenderer(),
        memory: fakeSink({ invalidRef: true }),
        code: "invalid_artifact",
      },
      {
        renderer: fakeRenderer(),
        memory: fakeSink({ uri: "javascript:alert(1)" }),
        code: "invalid_artifact",
      },
      {
        renderer: fakeRenderer({ bytes: 4 }),
        memory: fakeSink(),
        code: "artifact_too_large",
        budgets: { maxArtifactBytes: 3 },
      },
    ] as const) {
      const result = await materializeEvidenceArtifacts({
        before: evidenceScene(30),
        after: evidenceScene(60),
        plan,
        renderer: scenario.renderer,
        sink: scenario.memory.sink,
        budgets: scenario.budgets,
      });
      expect(result).toMatchObject({
        ok: false,
        errors: [{ code: scenario.code }],
      });
      expect(scenario.memory.state.aborts).toBe(1);
      expect(scenario.memory.state.committed).toBe(false);
    }
  });

  it("handles preflight and in-flight cancellation without partial refs", async () => {
    const plan = comparisonPlan([0]);
    const pre = new AbortController();
    pre.abort();
    const preMemory = fakeSink();
    const preResult = await materializeEvidenceArtifacts({
      before: evidenceScene(30),
      after: evidenceScene(60),
      plan,
      renderer: fakeRenderer(),
      sink: preMemory.sink,
      signal: pre.signal,
    });
    expect(preResult).toMatchObject({
      ok: false,
      errors: [{ code: "aborted" }],
    });
    expect(preMemory.state.beginCalls).toBe(0);

    const active = new AbortController();
    const activeMemory = fakeSink();
    const resultPromise = materializeEvidenceArtifacts({
      before: evidenceScene(30),
      after: evidenceScene(60),
      plan,
      renderer: fakeRenderer({ wait: new Promise<never>(() => undefined) }),
      sink: activeMemory.sink,
      signal: active.signal,
    });
    await Promise.resolve();
    active.abort();
    const activeResult = await resultPromise;
    expect(activeResult).toMatchObject({
      ok: false,
      errors: [{ code: "aborted" }],
    });
    expect(activeMemory.state.aborts).toBe(1);
    expect(activeMemory.state.committed).toBe(false);

    let resolveLate!: (writer: EvidenceArtifactSinkWriter) => void;
    let lateAborts = 0;
    const lateSink: EvidenceArtifactSink = {
      begin() {
        return new Promise<EvidenceArtifactSinkWriter>((resolve) => {
          resolveLate = resolve;
        });
      },
    };
    const lateController = new AbortController();
    const lateResultPromise = materializeEvidenceArtifacts({
      before: evidenceScene(30),
      after: evidenceScene(60),
      plan,
      renderer: fakeRenderer(),
      sink: lateSink,
      signal: lateController.signal,
    });
    await Promise.resolve();
    lateController.abort();
    const lateResult = await lateResultPromise;
    expect(lateResult).toMatchObject({
      ok: false,
      errors: [{ code: "aborted" }],
    });
    resolveLate({
      async write() {
        throw new Error("late writer must never write");
      },
      async commit() {
        throw new Error("late writer must never commit");
      },
      async abort() {
        lateAborts += 1;
      },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(lateAborts).toBe(1);
  });

  it("keeps the primary failure portable when sink cleanup also fails", async () => {
    const plan = comparisonPlan([0]);
    const memory = fakeSink({ failWrite: 1, failAbort: true });
    const result = await materializeEvidenceArtifacts({
      before: evidenceScene(30),
      after: evidenceScene(60),
      plan,
      renderer: fakeRenderer(),
      sink: memory.sink,
    });
    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          code: "artifact_sink_failed",
          message: expect.stringContaining("sink abort failed"),
        },
      ],
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);

    const beginFailure = await materializeEvidenceArtifacts({
      before: evidenceScene(30),
      after: evidenceScene(60),
      plan,
      renderer: fakeRenderer(),
      sink: {
        async begin() {
          throw new Error("begin exploded");
        },
      },
    });
    expect(beginFailure).toMatchObject({
      ok: false,
      errors: [{ code: "artifact_sink_failed" }],
    });
  });
});
