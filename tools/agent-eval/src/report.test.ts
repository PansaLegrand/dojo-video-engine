import { describe, expect, it } from "vitest";
import { Ajv } from "ajv";
import { workflowToolDescriptors } from "@motionforge/agent-tools";
import {
  EVAL_REPORT_VERSION,
  aggregateEvalCases,
  createEvalReport,
  evalReportJsonSchema,
  evalReportSchema,
  hashEvalPrompt,
  hashEvalCaseCorpus,
  hashEvalToolManifest,
  mergeEvalTokenUsageSamples,
  normalizeOpenAIUsage,
  serializeEvalReport,
  type EvalCaseReport,
  type EvalWorkflowBudgets,
} from "./report.js";

const budgets: EvalWorkflowBudgets = {
  maxHandles: 8,
  maxEvents: 512,
  maxResultValues: 20_000,
  maxResultDepth: 8,
  historyLimit: 100,
  maxToolSteps: 12,
  maxToolCallsPerResponse: 8,
  maxToolCalls: 48,
  requestTimeoutMs: 120_000,
  maxOutputTokens: 8_000,
  scene: {
    maxNodes: 10_000,
    maxDepth: 64,
    maxAssets: 1_000,
    maxFrames: 216_000,
  },
};

const cases: EvalCaseReport[] = [
  {
    caseId: "case-b",
    suite: "edit",
    trial: 1,
    success: false,
    latencyMs: 1_000,
    failures: ["failed"],
    workflow: protocol(false),
  },
  {
    caseId: "case-a",
    suite: "generate",
    trial: 2,
    success: true,
    latencyMs: 400,
    tokens: { input: 20, output: 10, total: 30 },
    failures: [],
    workflow: protocol(true),
  },
  {
    caseId: "case-a",
    suite: "generate",
    trial: 1,
    success: true,
    latencyMs: 100,
    tokens: { input: 10, output: 5, total: 15 },
    failures: [],
    workflow: protocol(true),
  },
  {
    caseId: "case-c",
    suite: "edit",
    trial: 1,
    success: false,
    latencyMs: 200,
    failures: ["wrong node"],
    workflow: protocol(false),
  },
];

function protocol(success: boolean) {
  return {
    modelTurns: 2,
    toolCalls: 3,
    inspectedBeforeMutation: success,
    finalCheckAtCommittedRevision: success,
    evidenceRequested: false,
  };
}

function input() {
  return {
    mode: "workflow-iterative" as const,
    utcDate: "2026-08-26",
    provider: "openai-compatible-test",
    model: { id: "model-x", snapshot: "2026-08-01" },
    promptHash: hashEvalPrompt("actual prompt"),
    toolManifestHash: hashEvalToolManifest([{ name: "tool", schema: {} }]),
    caseCorpusHash: hashEvalCaseCorpus("cases+scorer"),
    temperature: 0,
    workflowBudgets: budgets,
    trialCount: 2,
    cases,
  };
}

describe("MF8 eval report", () => {
  it("requires complete live reproducibility metadata and strict keys", () => {
    const valid = createEvalReport(input());
    expect(valid.reportVersion).toBe(EVAL_REPORT_VERSION);

    for (const mutate of [
      (value: any) => delete value.provider,
      (value: any) => delete value.model.id,
      (value: any) => delete value.model.snapshot,
      (value: any) => delete value.promptHash,
      (value: any) => delete value.toolManifestHash,
      (value: any) => delete value.utcDate,
      (value: any) => (value.unexpected = true),
    ]) {
      const candidate = structuredClone(valid) as any;
      mutate(candidate);
      expect(evalReportSchema.safeParse(candidate).success).toBe(false);
    }
    expect(
      evalReportSchema.safeParse({
        ...valid,
        model: { id: "model-without-version-or-snapshot" },
      }).success,
    ).toBe(false);
    expect(
      evalReportSchema.safeParse({ ...valid, utcDate: "2026-02-30" }).success,
    ).toBe(false);
    expect(
      evalReportSchema.safeParse({
        ...valid,
        aggregate: { ...valid.aggregate, successes: 999 },
      }).success,
    ).toBe(false);
    expect(
      evalReportSchema.safeParse({
        ...valid,
        cases: [...valid.cases, valid.cases[0]],
        aggregate: aggregateEvalCases([...valid.cases, valid.cases[0]!]),
      }).success,
    ).toBe(false);
  });

  it("sorts cases and computes stable success, latency, and token aggregates", () => {
    const report = createEvalReport(input());
    expect(
      report.cases.map(({ caseId, trial }) => `${caseId}:${trial}`),
    ).toEqual(["case-a:1", "case-a:2", "case-b:1", "case-c:1"]);
    expect(report.aggregate).toEqual({
      cases: 4,
      successes: 2,
      failures: 2,
      successRate: 0.5,
      latency: {
        totalMs: 1_700,
        minMs: 100,
        maxMs: 1_000,
        meanMs: 425,
        p50Ms: 200,
        p95Ms: 1_000,
      },
      tokens: {
        anyReportedCases: 2,
        completeCases: 2,
        input: { reportedCases: 2, total: 30 },
        output: { reportedCases: 2, total: 15 },
        total: { reportedCases: 2, total: 45 },
      },
    });
    expect(aggregateEvalCases(cases)).toEqual(report.aggregate);
    expect(() => aggregateEvalCases([])).toThrow(/empty/);
  });

  it("hashes exact prompt bytes and stable JSON tool manifests", () => {
    expect(hashEvalPrompt("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
    expect(hashEvalPrompt("hello\n")).not.toBe(hashEvalPrompt("hello"));
    expect(hashEvalCaseCorpus("one")).not.toBe(hashEvalCaseCorpus("two"));
    expect(hashEvalToolManifest([{ b: 2, a: 1 }])).toBe(
      hashEvalToolManifest([{ a: 1, b: 2 }]),
    );
    expect(hashEvalToolManifest([{ a: 2, b: 1 }])).not.toBe(
      hashEvalToolManifest([{ a: 1, b: 2 }]),
    );
    const shared = { value: 1 };
    expect(() => hashEvalToolManifest([shared, shared])).toThrow(/shared/);
    expect(() => hashEvalToolManifest({ value: Number.NaN })).toThrow(/finite/);
    const actualManifest = workflowToolDescriptors().map((descriptor) => ({
      name: descriptor.name,
      description: descriptor.description,
      inputSchema: descriptor.inputSchema,
    }));
    expect(hashEvalToolManifest(actualManifest)).toBe(
      hashEvalToolManifest(structuredClone(actualManifest)),
    );
  });

  it("captures available OpenAI-compatible usage without fabricating metadata", () => {
    expect(
      normalizeOpenAIUsage({
        prompt_tokens: 10,
        completion_tokens: 4,
        total_tokens: 14,
      }),
    ).toEqual({ input: 10, output: 4, total: 14 });
    expect(normalizeOpenAIUsage({ input_tokens: 8, output_tokens: 3 })).toEqual(
      {
        input: 8,
        output: 3,
        total: 11,
      },
    );
    expect(normalizeOpenAIUsage(undefined)).toBeUndefined();
    expect(normalizeOpenAIUsage({ prompt_tokens: -1 })).toBeUndefined();
    expect(
      normalizeOpenAIUsage({
        prompt_tokens: 10,
        completion_tokens: 4,
        total_tokens: 99,
      }),
    ).toBeUndefined();
    expect(
      mergeEvalTokenUsageSamples([
        { input: 10, output: 4, total: 14 },
        { input: 8, output: 3 },
      ]),
    ).toEqual({ input: 18, output: 7 });
  });

  it("bounds every report field and emits detached draft-07/schema-safe JSON", () => {
    const report = createEvalReport(input());
    const serialized = serializeEvalReport(report);
    expect(serialized.endsWith("\n")).toBe(true);
    expect(JSON.parse(serialized)).toEqual(report);
    expect(evalReportSchema.safeParse(JSON.parse(serialized)).success).toBe(
      true,
    );

    const schema = evalReportJsonSchema();
    expect(schema).toMatchObject({
      $ref: expect.any(String),
      definitions: expect.any(Object),
    });
    const root = (schema.definitions as Record<string, any>)[
      "MotionForgeAgentEvalReportV1"
    ];
    expect(root.properties.model.anyOf).toEqual([
      { required: ["version"] },
      { required: ["snapshot"] },
    ]);
    (schema as Record<string, unknown>).title = "mutated";
    expect(evalReportJsonSchema()).not.toHaveProperty("title", "mutated");
    const validate = new Ajv({ strict: false }).compile(evalReportJsonSchema());
    expect(validate(report), JSON.stringify(validate.errors)).toBe(true);

    expect(
      evalReportSchema.safeParse({
        ...report,
        cases: [
          {
            ...report.cases[0],
            failures: Array.from({ length: 65 }, () => "failure"),
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      evalReportSchema.safeParse({
        ...report,
        promptHash: "not-a-hash",
      }).success,
    ).toBe(false);
    expect(() => createEvalReport({ ...input(), trialCount: 1 })).toThrow(
      /exceeds trialCount/,
    );
  });
});
