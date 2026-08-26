// Live-only eval runner. Offline release gates import/test report and scoring
// helpers; they never execute this file or contact a paid endpoint.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAgentWorkflowToolRegistry,
  createWorkflowEvidenceAdapter,
  workflowToolDescriptors,
  type WorkflowToolDescriptor,
} from "@motionforge/agent-tools";
import type { Scene } from "@motionforge/schema";
import { cases, type EvalCase } from "./cases.js";
import {
  createEvalReport,
  hashEvalCaseCorpus,
  hashEvalPrompt,
  hashEvalToolManifest,
  mergeEvalTokenUsageSamples,
  normalizeOpenAIUsage,
  serializeEvalReport,
  type EvalCaseReport,
  type EvalTokenUsage,
  type EvalWorkflowProtocol,
  type EvalWorkflowBudgets,
} from "./report.js";
import { scoreReply } from "./score.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const llmsTxt = readFileSync(resolve(rootDir, "llms.txt"), "utf8");
const corpusMaterial = [
  readFileSync(resolve(rootDir, "tools/agent-eval/src/cases.ts"), "utf8"),
  readFileSync(resolve(rootDir, "tools/agent-eval/src/score.ts"), "utf8"),
].join("\n\u0000\n");
const args = process.argv.slice(2);
const modeArg = argument("--mode") ?? "legacy";
const mode =
  modeArg === "legacy"
    ? "legacy-one-shot"
    : modeArg === "workflow"
      ? "workflow-iterative"
      : null;
if (!mode) {
  console.error("--mode must be legacy or workflow.");
  process.exit(2);
}

const live = process.env["EVAL_LIVE"] === "1";
const baseUrl = process.env["EVAL_BASE_URL"];
const apiKey = process.env["EVAL_API_KEY"];
const provider = process.env["EVAL_PROVIDER"];
const model = process.env["EVAL_MODEL"];
const modelVersion = process.env["EVAL_MODEL_VERSION"];
const modelSnapshot = process.env["EVAL_MODEL_SNAPSHOT"];
if (
  !live ||
  !baseUrl ||
  !apiKey ||
  !provider ||
  !model ||
  (!modelVersion && !modelSnapshot)
) {
  console.error(
    "Live evals require EVAL_LIVE=1, EVAL_BASE_URL, EVAL_API_KEY, " +
      "EVAL_PROVIDER, EVAL_MODEL, and EVAL_MODEL_VERSION or EVAL_MODEL_SNAPSHOT.\n" +
      "Offline release gates run only deterministic scorer/report tests and make no paid calls.",
  );
  process.exit(2);
}

const temperature = finiteEnvNumber("EVAL_TEMPERATURE", 0, 0, 2);
const trialCount = integerEnvNumber("EVAL_TRIALS", 1, 1, 100);
const suiteFilter = argument("--suite");
const caseFilter = argument("--case");
const selected = cases.filter(
  (entry) =>
    (!suiteFilter || entry.suite === suiteFilter) &&
    (!caseFilter || entry.id === caseFilter),
);
if (selected.length === 0) {
  console.error("No eval cases matched the supplied filters.");
  process.exit(2);
}

const workflowBudgets: EvalWorkflowBudgets = {
  maxHandles: 8,
  maxEvents: 512,
  maxResultValues: 20_000,
  maxResultDepth: 8,
  historyLimit: 100,
  maxToolSteps: integerEnvNumber("EVAL_MAX_TOOL_STEPS", 12, 1, 128),
  maxToolCallsPerResponse: integerEnvNumber(
    "EVAL_MAX_TOOL_CALLS_PER_RESPONSE",
    8,
    1,
    128,
  ),
  maxToolCalls: integerEnvNumber("EVAL_MAX_TOOL_CALLS", 48, 1, 1_024),
  requestTimeoutMs: integerEnvNumber(
    "EVAL_REQUEST_TIMEOUT_MS",
    120_000,
    250,
    3_600_000,
  ),
  maxOutputTokens: integerEnvNumber(
    "EVAL_MAX_OUTPUT_TOKENS",
    8_000,
    1,
    1_000_000,
  ),
  scene: {
    maxNodes: 10_000,
    maxDepth: 64,
    maxAssets: 1_000,
    maxFrames: 216_000,
  },
};

const workflowDescriptors = workflowToolDescriptors().filter((descriptor) =>
  [
    "motionforge.workflow.read",
    "motionforge.workflow.search",
    "motionforge.workflow.check",
    "motionforge.workflow.commands",
    "motionforge.workflow.undo",
    "motionforge.workflow.redo",
    "motionforge.workflow.evidence",
  ].includes(descriptor.name),
);
const providerTools =
  mode === "workflow-iterative" ? workflowDescriptors.map(providerTool) : [];
const providerNameToWorkflow = new Map(
  workflowDescriptors.map((descriptor) => [
    providerToolName(descriptor.name),
    descriptor.name,
  ]),
);
const promptMaterial = selected.flatMap((evalCase, caseIndex) =>
  Array.from({ length: trialCount }, (_, trialIndex) => {
    const trial = trialIndex + 1;
    return {
      caseId: evalCase.id,
      trial,
      messages:
        mode === "legacy-one-shot"
          ? buildLegacyMessages(evalCase)
          : buildWorkflowMessages(
              evalCase,
              `${sessionId(caseIndex, trial)}:w1`,
            ),
    };
  }),
);

const caseReports: EvalCaseReport[] = [];
let passed = 0;
for (let caseIndex = 0; caseIndex < selected.length; caseIndex += 1) {
  const evalCase = selected[caseIndex]!;
  for (let trial = 1; trial <= trialCount; trial += 1) {
    const started = performance.now();
    let tokens: EvalTokenUsage | undefined;
    let workflowProtocol: EvalWorkflowProtocol | undefined;
    let outcome: { pass: boolean; failures: string[] };
    try {
      if (mode === "legacy-one-shot") {
        const completion = await complete(buildLegacyMessages(evalCase));
        tokens = completion.usage;
        outcome = scoreReply(evalCase, completion.content);
      } else {
        const workflow = await runWorkflowTrial(evalCase, caseIndex, trial);
        tokens = workflow.tokens;
        workflowProtocol = workflow.protocol;
        outcome = workflow.outcome;
      }
    } catch (error) {
      outcome = {
        pass: false,
        failures: [`request failed: ${safeMessage(error)}`],
      };
      if (mode === "workflow-iterative") {
        workflowProtocol = {
          modelTurns: 0,
          toolCalls: 0,
          inspectedBeforeMutation: false,
          finalCheckAtCommittedRevision: false,
          evidenceRequested: false,
        };
      }
    }
    const latencyMs = Math.max(0, Math.round(performance.now() - started));
    passed += outcome.pass ? 1 : 0;
    caseReports.push({
      caseId: evalCase.id,
      suite: evalCase.suite,
      trial,
      success: outcome.pass,
      latencyMs,
      ...(tokens ? { tokens } : {}),
      ...(workflowProtocol ? { workflow: workflowProtocol } : {}),
      failures: outcome.failures
        .slice(0, 64)
        .map((failure) => failure.slice(0, 2_048)),
    });
    console.log(
      `${outcome.pass ? "ok " : "FAIL"} [${evalCase.suite}] ${evalCase.id} trial ${trial}`,
    );
    for (const failure of outcome.failures) console.log(`     - ${failure}`);
  }
}

const report = createEvalReport({
  mode,
  utcDate: new Date().toISOString().slice(0, 10),
  provider,
  model: {
    id: model,
    ...(modelVersion ? { version: modelVersion } : {}),
    ...(modelSnapshot ? { snapshot: modelSnapshot } : {}),
  },
  promptHash: hashEvalPrompt(JSON.stringify(promptMaterial)),
  toolManifestHash: hashEvalToolManifest(providerTools),
  caseCorpusHash: hashEvalCaseCorpus(corpusMaterial),
  temperature,
  workflowBudgets,
  trialCount,
  cases: caseReports,
});
const serialized = serializeEvalReport(report);
console.log(`\n${passed}/${caseReports.length} passed\n`);
console.log(serialized);
const reportPath = process.env["EVAL_REPORT_PATH"];
if (reportPath) {
  const absolute = resolve(process.cwd(), reportPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, serialized, "utf8");
  console.error(`Saved eval report to ${absolute}`);
}
process.exit(passed === caseReports.length ? 0 : 1);

type Message = Record<string, unknown> & { role: string };
type ProviderToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

function buildLegacyMessages(evalCase: EvalCase): Message[] {
  if (evalCase.suite === "generate") {
    return [
      {
        role: "system",
        content: `${llmsTxt}\n\nAnswer with ONLY the scene JSON document. No prose.`,
      },
      { role: "user", content: evalCase.prompt },
    ];
  }
  return [
    {
      role: "system",
      content: `${llmsTxt}\n\nYou edit scenes by answering with ONLY a JSON array of patch ops (see the patches API). No prose. For uploaded media, use only assets from the manifest and emit setAsset before insertNode when needed.`,
    },
    {
      role: "user",
      content: `Current scene:\n\`\`\`json\n${JSON.stringify(evalCase.scene)}\n\`\`\`\n\nUploaded media manifest:\n\`\`\`json\n${JSON.stringify(evalCase.mediaAssets ?? [])}\n\`\`\`\n\nInstruction: ${evalCase.prompt}`,
    },
  ];
}

function buildWorkflowMessages(evalCase: EvalCase, handle: string): Message[] {
  return [
    {
      role: "system",
      content: `${llmsTxt}\n\nUse only the supplied MotionForge workflow tools to inspect and edit the loaded workspace. Never resend or replace the full Scene. Use expectedRevision on mutations, check your work, and finish with a short summary when the instruction is satisfied.`,
    },
    {
      role: "user",
      content: `Workspace handle: ${handle}\nSuite: ${evalCase.suite}\nUploaded media manifest: ${JSON.stringify(evalCase.suite === "edit" ? (evalCase.mediaAssets ?? []) : [])}\nInstruction: ${evalCase.prompt}`,
    },
  ];
}

async function runWorkflowTrial(
  evalCase: EvalCase,
  caseIndex: number,
  trial: number,
): Promise<{
  outcome: { pass: boolean; failures: string[] };
  tokens?: EvalTokenUsage;
  protocol: EvalWorkflowProtocol;
}> {
  const registry = createAgentWorkflowToolRegistry({
    sessionOptions: {
      sessionId: sessionId(caseIndex, trial),
      maxHandles: workflowBudgets.maxHandles,
      maxEvents: workflowBudgets.maxEvents,
      maxResultValues: workflowBudgets.maxResultValues,
      maxResultDepth: workflowBudgets.maxResultDepth,
      historyLimit: workflowBudgets.historyLimit,
      evidence: createWorkflowEvidenceAdapter(),
      sceneLimits: {
        maxNodes: workflowBudgets.scene.maxNodes,
        maxDepth: workflowBudgets.scene.maxDepth,
        maxAssets: workflowBudgets.scene.maxAssets,
        maxFrames: workflowBudgets.scene.maxFrames,
      },
    },
  });
  const initial = evalCase.suite === "edit" ? evalCase.scene : blankScene();
  const loaded = await registry.call("motionforge.workflow.load", {
    scene: initial,
  });
  if (!loaded.ok || !loaded.handle) {
    await registry.dispose();
    return {
      outcome: {
        pass: false,
        failures: [
          `workflow load failed: ${loaded.ok ? "missing handle" : loaded.error.message}`,
        ],
      },
      protocol: {
        modelTurns: 0,
        toolCalls: 0,
        inspectedBeforeMutation: false,
        finalCheckAtCommittedRevision: false,
        evidenceRequested: false,
      },
    };
  }
  const messages = buildWorkflowMessages(evalCase, loaded.handle);
  const usageSamples: Array<EvalTokenUsage | undefined> = [];
  let exhausted = true;
  let modelTurns = 0;
  let toolCalls = 0;
  let inspected = false;
  let mutationAttemptedBeforeInspection = false;
  let lastCheckRevision: number | undefined;
  let evidenceRequested = false;
  try {
    for (let step = 0; step < workflowBudgets.maxToolSteps; step += 1) {
      const completion = await complete(messages, providerTools);
      modelTurns += 1;
      usageSamples.push(completion.usage);
      if (
        completion.toolCalls.length > workflowBudgets.maxToolCallsPerResponse
      ) {
        throw new Error(
          `provider returned ${completion.toolCalls.length} tool calls; per-response limit is ${workflowBudgets.maxToolCallsPerResponse}`,
        );
      }
      if (
        toolCalls + completion.toolCalls.length >
        workflowBudgets.maxToolCalls
      ) {
        throw new Error(
          `workflow tool-call limit ${workflowBudgets.maxToolCalls} exceeded`,
        );
      }
      toolCalls += completion.toolCalls.length;
      messages.push({
        role: "assistant",
        content: completion.content || null,
        ...(completion.toolCalls.length > 0
          ? { tool_calls: completion.toolCalls }
          : {}),
      });
      if (completion.toolCalls.length === 0) {
        exhausted = false;
        break;
      }
      for (const toolCall of completion.toolCalls) {
        const workflowName = providerNameToWorkflow.get(toolCall.function.name);
        let input: unknown = {};
        try {
          input = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          input = { invalidArguments: toolCall.function.arguments };
        }
        const result = workflowName
          ? await registry.call(workflowName, input)
          : await registry.call("motionforge.workflow.unknown", input);
        const isMutation =
          workflowName === "motionforge.workflow.commands" ||
          workflowName === "motionforge.workflow.undo" ||
          workflowName === "motionforge.workflow.redo";
        if (isMutation && !inspected) mutationAttemptedBeforeInspection = true;
        if (
          workflowName === "motionforge.workflow.read" ||
          workflowName === "motionforge.workflow.search"
        ) {
          inspected = true;
        }
        if (workflowName === "motionforge.workflow.evidence") {
          evidenceRequested = true;
        }
        if (result.ok && result.revision !== undefined) {
          if (workflowName === "motionforge.workflow.check") {
            lastCheckRevision = result.revision;
          }
        }
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }
    const snapshot = await registry.hostSnapshot(loaded.handle);
    const failures = scoreWorkflowScene(evalCase, snapshot.scene);
    if (exhausted) failures.push("workflow exhausted the tool-step budget");
    if (mutationAttemptedBeforeInspection) {
      failures.push("workflow mutated before read/search inspection");
    }
    if (lastCheckRevision !== snapshot.revision) {
      failures.push(
        `workflow did not check final revision ${snapshot.revision}`,
      );
    }
    return {
      outcome: { pass: failures.length === 0, failures },
      tokens: mergeEvalTokenUsageSamples(usageSamples),
      protocol: {
        modelTurns,
        toolCalls,
        inspectedBeforeMutation: !mutationAttemptedBeforeInspection,
        finalCheckAtCommittedRevision: lastCheckRevision === snapshot.revision,
        evidenceRequested,
      },
    };
  } finally {
    await registry.dispose();
  }
}

function scoreWorkflowScene(evalCase: EvalCase, after: Scene): string[] {
  return evalCase.suite === "generate"
    ? evalCase.assert(after)
    : evalCase.assert(evalCase.scene, after);
}

function blankScene(): Scene {
  return {
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 90,
    assets: {},
    nodes: [],
  };
}

async function complete(
  messages: Message[],
  tools: unknown[] = [],
): Promise<{
  content: string;
  toolCalls: ProviderToolCall[];
  usage?: EvalTokenUsage;
}> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(workflowBudgets.requestTimeoutMs),
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: workflowBudgets.maxOutputTokens,
      ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(
      `${response.status} ${(await response.text()).slice(0, 2_048)}`,
    );
  }
  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: ProviderToolCall[];
      };
    }>;
    usage?: unknown;
  };
  const usage = normalizeOpenAIUsage(data.usage);
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    toolCalls: data.choices?.[0]?.message?.tool_calls ?? [],
    ...(usage ? { usage } : {}),
  };
}

function providerTool(descriptor: WorkflowToolDescriptor) {
  return {
    type: "function" as const,
    function: {
      name: providerToolName(descriptor.name),
      description: descriptor.description,
      parameters: descriptor.inputSchema,
    },
  };
}

function providerToolName(name: string): string {
  return name.replaceAll(".", "__");
}

function sessionId(caseIndex: number, trial: number): string {
  return `EvalCase${caseIndex + 1}Trial${trial}`;
}

function argument(name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function integerEnvNumber(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    console.error(`${name} must be an integer from ${min} through ${max}.`);
    process.exit(2);
  }
  return value;
}

function finiteEnvNumber(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    console.error(
      `${name} must be a finite number from ${min} through ${max}.`,
    );
    process.exit(2);
  }
  return value;
}

function safeMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() !== ""
    ? error.message.slice(0, 2_048)
    : "unknown error";
}
