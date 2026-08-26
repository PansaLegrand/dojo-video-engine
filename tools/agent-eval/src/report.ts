import { createHash } from "node:crypto";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const EVAL_REPORT_VERSION = 1 as const;

const boundedId = z.string().min(1).max(191);
const boundedLabel = z.string().min(1).max(512);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const nonnegativeInteger = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

export const evalTokenUsageSchema = z
  .object({
    input: nonnegativeInteger.optional(),
    output: nonnegativeInteger.optional(),
    total: nonnegativeInteger.optional(),
  })
  .strict()
  .refine(
    (usage) =>
      usage.input !== undefined ||
      usage.output !== undefined ||
      usage.total !== undefined,
    "Token usage must contain at least one available count.",
  )
  .superRefine((usage, ctx) => {
    if (
      usage.total !== undefined &&
      usage.input !== undefined &&
      usage.total < usage.input
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["total"],
        message: "Total tokens cannot be less than input tokens.",
      });
    }
    if (
      usage.total !== undefined &&
      usage.output !== undefined &&
      usage.total < usage.output
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["total"],
        message: "Total tokens cannot be less than output tokens.",
      });
    }
    if (
      usage.input !== undefined &&
      usage.output !== undefined &&
      usage.total !== undefined &&
      usage.total !== usage.input + usage.output
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["total"],
        message:
          "Total tokens must equal input plus output when all are reported.",
      });
    }
  });

export type EvalTokenUsage = z.infer<typeof evalTokenUsageSchema>;

export const evalWorkflowBudgetsSchema = z
  .object({
    maxHandles: z.number().int().min(1).max(256),
    maxEvents: z.number().int().min(4).max(10_000),
    maxResultValues: z.number().int().min(100).max(1_000_000),
    maxResultDepth: z.number().int().min(4).max(8),
    historyLimit: z.number().int().min(1).max(10_000),
    maxToolSteps: z.number().int().min(1).max(128),
    maxToolCallsPerResponse: z.number().int().min(1).max(128),
    maxToolCalls: z.number().int().min(1).max(1_024),
    requestTimeoutMs: z.number().int().min(250).max(3_600_000),
    maxOutputTokens: z.number().int().min(1).max(1_000_000),
    scene: z
      .object({
        maxNodes: z.number().int().min(1).max(100_000),
        maxDepth: z.number().int().min(1).max(256),
        maxAssets: z.number().int().min(1).max(100_000),
        maxFrames: z.number().int().min(1).max(1_000_000_000),
      })
      .strict(),
  })
  .strict();

export type EvalWorkflowBudgets = z.infer<typeof evalWorkflowBudgetsSchema>;

export const evalWorkflowProtocolSchema = z
  .object({
    modelTurns: nonnegativeInteger,
    toolCalls: nonnegativeInteger,
    inspectedBeforeMutation: z.boolean(),
    finalCheckAtCommittedRevision: z.boolean(),
    evidenceRequested: z.boolean(),
  })
  .strict();

export type EvalWorkflowProtocol = z.infer<typeof evalWorkflowProtocolSchema>;

export const evalCaseReportSchema = z
  .object({
    caseId: boundedId,
    suite: z.enum(["generate", "edit"]),
    trial: z.number().int().min(1).max(100),
    success: z.boolean(),
    latencyMs: z.number().int().nonnegative().max(86_400_000),
    tokens: evalTokenUsageSchema.optional(),
    workflow: evalWorkflowProtocolSchema.optional(),
    failures: z.array(z.string().min(1).max(2_048)).max(64),
  })
  .strict();

export type EvalCaseReport = z.infer<typeof evalCaseReportSchema>;

const latencyAggregateSchema = z
  .object({
    totalMs: nonnegativeInteger,
    minMs: nonnegativeInteger,
    maxMs: nonnegativeInteger,
    meanMs: z.number().finite().nonnegative(),
    p50Ms: nonnegativeInteger,
    p95Ms: nonnegativeInteger,
  })
  .strict();

const tokenFieldAggregateSchema = z
  .object({
    reportedCases: nonnegativeInteger,
    total: nonnegativeInteger,
  })
  .strict();

const tokenAggregateSchema = z
  .object({
    anyReportedCases: nonnegativeInteger,
    completeCases: nonnegativeInteger,
    input: tokenFieldAggregateSchema,
    output: tokenFieldAggregateSchema,
    total: tokenFieldAggregateSchema,
  })
  .strict();

export const evalAggregateSchema = z
  .object({
    cases: nonnegativeInteger,
    successes: nonnegativeInteger,
    failures: nonnegativeInteger,
    successRate: z.number().finite().min(0).max(1),
    latency: latencyAggregateSchema,
    tokens: tokenAggregateSchema,
  })
  .strict();

export type EvalAggregate = z.infer<typeof evalAggregateSchema>;

const modelSchema = z
  .object({
    id: boundedLabel,
    version: boundedLabel.optional(),
    snapshot: boundedLabel.optional(),
  })
  .strict()
  .refine(
    (model) => model.version !== undefined || model.snapshot !== undefined,
    "Model metadata requires version, snapshot, or both.",
  );

export const evalReportSchema = z
  .object({
    reportVersion: z.literal(EVAL_REPORT_VERSION),
    mode: z.enum(["legacy-one-shot", "workflow-iterative"]),
    utcDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isUtcDate, "utcDate must be a real UTC calendar date."),
    provider: boundedLabel,
    model: modelSchema,
    promptHash: sha256Schema,
    toolManifestHash: sha256Schema,
    caseCorpusHash: sha256Schema,
    temperature: z.number().finite().min(0).max(2),
    workflowBudgets: evalWorkflowBudgetsSchema,
    trialCount: z.number().int().min(1).max(100),
    cases: z.array(evalCaseReportSchema).min(1).max(10_000),
    aggregate: evalAggregateSchema,
  })
  .strict()
  .superRefine((report, ctx) => {
    const seen = new Set<string>();
    for (let index = 0; index < report.cases.length; index += 1) {
      const entry = report.cases[index]!;
      const key = `${entry.suite}\u0000${entry.caseId}\u0000${entry.trial}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cases", index],
          message: "Case suite/id/trial tuples must be unique.",
        });
      }
      seen.add(key);
      if (entry.trial > report.trialCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cases", index, "trial"],
          message: `Trial ${entry.trial} exceeds trialCount ${report.trialCount}.`,
        });
      }
      if (
        report.mode === "workflow-iterative" &&
        entry.workflow === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cases", index, "workflow"],
          message: "Workflow reports require per-case protocol traces.",
        });
      }
      if (report.mode === "legacy-one-shot" && entry.workflow !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cases", index, "workflow"],
          message: "Legacy reports must not claim workflow protocol traces.",
        });
      }
    }
    if (
      report.cases.length > 0 &&
      report.cases.every(
        (entry) => evalCaseReportSchema.safeParse(entry).success,
      )
    ) {
      const expected = aggregateEvalCases(report.cases);
      if (JSON.stringify(expected) !== JSON.stringify(report.aggregate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["aggregate"],
          message: "Aggregate does not match deterministic case aggregation.",
        });
      }
    }
  });

export type EvalReport = z.infer<typeof evalReportSchema>;

export type CreateEvalReportInput = Omit<
  EvalReport,
  "reportVersion" | "cases" | "aggregate"
> & {
  cases: readonly EvalCaseReport[];
};

/** Stable code-unit/case/trial ordering and deterministic numeric aggregate. */
export function createEvalReport(input: CreateEvalReportInput): EvalReport {
  const cases = input.cases
    .map((entry) => evalCaseReportSchema.parse(entry))
    .sort((left, right) => {
      const id = compareCodeUnits(left.caseId, right.caseId);
      if (id !== 0) return id;
      if (left.trial !== right.trial) return left.trial - right.trial;
      return compareCodeUnits(left.suite, right.suite);
    });
  if (cases.length === 0) {
    throw new TypeError("Eval reports require at least one case result.");
  }
  for (const entry of cases) {
    if (entry.trial > input.trialCount) {
      throw new TypeError(
        `Case ${JSON.stringify(entry.caseId)} trial ${entry.trial} exceeds trialCount ${input.trialCount}.`,
      );
    }
  }
  return evalReportSchema.parse({
    reportVersion: EVAL_REPORT_VERSION,
    ...structuredClone(input),
    cases,
    aggregate: aggregateEvalCases(cases),
  });
}

export function aggregateEvalCases(
  casesInput: readonly EvalCaseReport[],
): EvalAggregate {
  if (casesInput.length === 0) {
    throw new TypeError("Cannot aggregate an empty eval case list.");
  }
  const cases = casesInput.map((entry) => evalCaseReportSchema.parse(entry));
  const latencies = cases
    .map(({ latencyMs }) => latencyMs)
    .sort((a, b) => a - b);
  const successes = cases.filter(({ success }) => success).length;
  const tokenCases = cases.filter(({ tokens }) => tokens !== undefined);
  const tokenField = (field: keyof EvalTokenUsage) => {
    const reported = tokenCases.filter(
      (entry) => entry.tokens?.[field] !== undefined,
    );
    return {
      reportedCases: reported.length,
      total: reported.reduce(
        (sum, entry) => sum + (entry.tokens?.[field] ?? 0),
        0,
      ),
    };
  };
  return evalAggregateSchema.parse({
    cases: cases.length,
    successes,
    failures: cases.length - successes,
    successRate: round(successes / cases.length),
    latency: {
      totalMs: latencies.reduce((sum, value) => sum + value, 0),
      minMs: latencies[0]!,
      maxMs: latencies.at(-1)!,
      meanMs: round(
        latencies.reduce((sum, value) => sum + value, 0) / latencies.length,
      ),
      p50Ms: nearestRank(latencies, 0.5),
      p95Ms: nearestRank(latencies, 0.95),
    },
    tokens: {
      anyReportedCases: tokenCases.length,
      completeCases: tokenCases.filter(
        (entry) =>
          entry.tokens?.input !== undefined &&
          entry.tokens.output !== undefined &&
          entry.tokens.total !== undefined,
      ).length,
      input: tokenField("input"),
      output: tokenField("output"),
      total: tokenField("total"),
    },
  });
}

/** Exact UTF-8 SHA-256 for the prompt material actually sent by a runner. */
export function hashEvalPrompt(promptMaterial: string): string {
  return sha256(promptMaterial);
}

/** Stable-key JSON SHA-256 for the exact tool definitions sent to a model. */
export function hashEvalToolManifest(manifest: unknown): string {
  return sha256(stableJson(manifest));
}

/** Exact hash of the selected case corpus and mechanical scorer source. */
export function hashEvalCaseCorpus(corpusMaterial: string): string {
  return sha256(corpusMaterial);
}

/** Normalizes OpenAI chat/responses-compatible usage without inventing counts. */
export function normalizeOpenAIUsage(
  input: unknown,
): EvalTokenUsage | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return undefined;
  const value = input as Record<string, unknown>;
  const read = (...keys: string[]): number | undefined => {
    for (const key of keys) {
      const candidate = value[key];
      if (Number.isSafeInteger(candidate) && (candidate as number) >= 0) {
        return candidate as number;
      }
    }
    return undefined;
  };
  const usage: EvalTokenUsage = {
    ...(read("prompt_tokens", "input_tokens") === undefined
      ? {}
      : { input: read("prompt_tokens", "input_tokens") }),
    ...(read("completion_tokens", "output_tokens") === undefined
      ? {}
      : { output: read("completion_tokens", "output_tokens") }),
    ...(read("total_tokens") === undefined
      ? {}
      : { total: read("total_tokens") }),
  };
  if (Object.keys(usage).length === 0) return undefined;
  if (
    usage.total === undefined &&
    usage.input !== undefined &&
    usage.output !== undefined
  ) {
    usage.total = usage.input + usage.output;
  }
  const parsed = evalTokenUsageSchema.safeParse(usage);
  return parsed.success ? parsed.data : undefined;
}

/** Keeps a token field only when every model call reported that field. */
export function mergeEvalTokenUsageSamples(
  samples: readonly (EvalTokenUsage | undefined)[],
): EvalTokenUsage | undefined {
  if (samples.length === 0) return undefined;
  const result: EvalTokenUsage = {};
  for (const field of ["input", "output", "total"] as const) {
    if (samples.every((sample) => sample?.[field] !== undefined)) {
      const total = samples.reduce(
        (sum, sample) => sum + (sample?.[field] ?? 0),
        0,
      );
      if (!Number.isSafeInteger(total)) return undefined;
      result[field] = total;
    }
  }
  const parsed = evalTokenUsageSchema.safeParse(result);
  return parsed.success ? parsed.data : undefined;
}

/** Deterministic JSON for files/diffs; input is revalidated and detached. */
export function serializeEvalReport(reportInput: unknown): string {
  const report = evalReportSchema.parse(reportInput);
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function evalReportJsonSchema(): Record<string, unknown> {
  const schema = zodToJsonSchema(evalReportSchema, {
    name: "MotionForgeAgentEvalReportV1",
    target: "jsonSchema7",
    $refStrategy: "none",
  }) as Record<string, unknown>;
  const root = (
    schema.definitions as Record<string, Record<string, any>> | undefined
  )?.MotionForgeAgentEvalReportV1;
  const model = root?.properties?.model as Record<string, unknown> | undefined;
  if (model) {
    model.anyOf = [{ required: ["version"] }, { required: ["snapshot"] }];
  }
  const tokens = root?.properties?.cases?.items?.properties?.tokens as
    | Record<string, unknown>
    | undefined;
  if (tokens) {
    tokens.anyOf = [
      { required: ["input"] },
      { required: ["output"] },
      { required: ["total"] },
    ];
  }
  return structuredClone(schema);
}

function nearestRank(sorted: readonly number[], percentile: number): number {
  const index = Math.max(0, Math.ceil(percentile * sorted.length) - 1);
  return sorted[index]!;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isUtcDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function stableJson(input: unknown): string {
  const seen = new WeakSet<object>();
  let values = 0;
  const visit = (value: unknown, depth: number): string => {
    values += 1;
    if (values > 100_000)
      throw new TypeError("Hash input exceeds 100000 values.");
    if (depth > 64) throw new TypeError("Hash input exceeds depth 64.");
    if (value === null || typeof value === "boolean")
      return JSON.stringify(value);
    if (typeof value === "string") {
      if (value.length > 2_000_000)
        throw new TypeError("Hash input string is too long.");
      return JSON.stringify(value);
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value))
        throw new TypeError("Hash input numbers must be finite.");
      return JSON.stringify(value);
    }
    if (typeof value !== "object") {
      throw new TypeError(`Hash input contains non-JSON ${typeof value}.`);
    }
    if (seen.has(value))
      throw new TypeError(
        "Hash input must not contain cycles or shared references.",
      );
    seen.add(value);
    if (Array.isArray(value)) {
      if (value.length > 10_000)
        throw new TypeError("Hash input array is too long.");
      return `[${value.map((entry) => visit(entry, depth + 1)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Hash input objects must be plain JSON objects.");
    }
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => compareCodeUnits(left, right),
    );
    return `{${entries
      .map(([key, child]) => {
        if (child === undefined)
          throw new TypeError("Hash input cannot contain undefined.");
        return `${JSON.stringify(key)}:${visit(child, depth + 1)}`;
      })
      .join(",")}}`;
  };
  return visit(input, 0);
}
