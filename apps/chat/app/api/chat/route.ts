import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { gateway, generateText, Output, type LanguageModel } from "ai";
import { NextResponse } from "next/server";
import { createWorkflowEvidenceAdapter } from "@motionforge/agent-tools";
import { validateScene, type Scene } from "@motionforge/schema";
import {
  applyInstructionLocally,
  extractJsonFromText,
  normalizeModelOutput,
  type MotionforgeAgentResult,
} from "@/lib/motionforge/local-agent";
import { buildMotionforgeSystemPrompt } from "@/lib/ai/prompt";
import {
  authorizeIterativeAgentDecision,
  buildIterativeDecisionPrompt,
  buildIterativeDecisionSystemPrompt,
  iterativeAgentDecisionSchema,
} from "@/lib/ai/iterative-decision";
import { runIterativeAgent } from "@/lib/motionforge/iterative-agent";
import { createIterativeWorkflowAdapter } from "@/lib/motionforge/iterative-workflow-adapter";
import {
  formatMediaAssetManifestForPrompt,
  readChatMediaAssetManifest,
} from "@/lib/media/manifest";
import type { ChatMediaAssetManifestItem } from "@/lib/media/assets";

export const runtime = "nodejs";
const DEBUG = process.env.MOTIONFORGE_DEBUG === "1";
const DEFAULT_MODEL_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_MODEL_MAX_OUTPUT_TOKENS = 12_000;
// const DEFAULT_GATEWAY_MODEL = "openai/gpt-4.1-mini";
// const DEFAULT_OPENAI_COMPATIBLE_MODEL = "gpt-4.1-mini";
const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.4";
const DEFAULT_OPENAI_COMPATIBLE_MODEL = "gpt-5.4";

type ChatRequest = {
  instruction?: unknown;
  scene?: unknown;
  clientRevision?: unknown;
  clientEpoch?: unknown;
  mediaAssets?: unknown;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

type ChatResponse =
  | {
      ok: true;
      result: MotionforgeAgentResult;
      baseRevision: number;
      baseEpoch: number;
    }
  | { ok: false; error: string; fallback?: MotionforgeAgentResult };

export async function POST(request: Request) {
  let body: ChatRequest;

  let cleanupModelRequest: (() => void) | undefined;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return json({ ok: false, error: "Request body must be JSON." }, 400);
  }

  const instruction =
    typeof body.instruction === "string" ? body.instruction.trim() : "";

  if (!instruction) {
    return json({ ok: false, error: "Instruction is required." }, 400);
  }

  const currentScene = readScene(body.scene);
  const baseRevision = readClientRevision(body.clientRevision);
  const baseEpoch = readClientRevision(body.clientEpoch);
  const mediaAssets = readChatMediaAssetManifest(body.mediaAssets);
  const localFallback = applyInstructionLocally(
    currentScene,
    instruction,
    mediaAssets,
  );

  const llm = readLlmModel();

  if (!llm.ok) {
    return json({
      ok: true,
      baseRevision,
      baseEpoch,
      result: {
        ...localFallback,
        summary: `${localFallback.summary} ${llm.message}`.replace(/\s+/g, " "),
      },
    });
  }

  try {
    const timeoutMs = readModelTimeoutMs();
    const maxOutputTokens = readModelMaxOutputTokens();
    const controller = new AbortController();
    const abortFromRequest = () => controller.abort(request.signal.reason);
    let listeningForAbort = false;
    if (request.signal.aborted) controller.abort(request.signal.reason);
    else {
      request.signal.addEventListener("abort", abortFromRequest, {
        once: true,
      });
      listeningForAbort = true;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    cleanupModelRequest = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (listeningForAbort) {
        request.signal.removeEventListener("abort", abortFromRequest);
      }
    };
    if (controller.signal.aborted) throw abortReason(controller.signal);

    if (currentScene) {
      timeoutId = setTimeout(() => {
        controller.abort(`Model request timed out after ${timeoutMs}ms.`);
      }, timeoutMs);
      const iterative = await runIterativeModelEdit({
        model: llm.model,
        instruction,
        scene: currentScene,
        uiRevision: baseRevision,
        mediaAssets,
        history: readHistory(body.history),
        signal: controller.signal,
        maxOutputTokens,
      });
      return json({
        ok: true,
        baseRevision,
        baseEpoch,
        result: { ...iterative, source: "model" },
      });
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort(`Model request timed out after ${timeoutMs}ms.`);
        reject(new Error(`Model request timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    });

    const modelPromise = generateText({
      model: llm.model,
      system: buildMotionforgeSystemPrompt(currentScene, mediaAssets),
      prompt: buildUserPrompt(instruction, currentScene, mediaAssets),
      output: Output.json({
        name: "MotionforgeAgentResult",
        description:
          "A JSON object containing either a complete motionforge scene plus summary, or a scene patch plus summary.",
      }),
      temperature: 0.2,
      maxOutputTokens,
      abortSignal: controller.signal,
    });

    const result = await Promise.race([
      raceWithAbort(modelPromise, controller.signal),
      timeoutPromise,
    ]);

    const structuredOutput = readStructuredOutput(result);

    debugLog("model result", {
      instruction,
      provider: llm.provider,
      modelId: llm.modelId,
      text: result.text,
      output: structuredOutput.ok ? structuredOutput.output : undefined,
      outputError: structuredOutput.ok ? undefined : structuredOutput.error,
    });

    const payload = structuredOutput.ok
      ? structuredOutput.output
      : extractJsonFromText(result.text);
    debugLog("parsed model payload", payload);
    const normalized = normalizeModelOutput(payload, currentScene, mediaAssets);

    return json({
      ok: true,
      baseRevision,
      baseEpoch,
      result: {
        ...normalized,
        source: "model",
      },
    });
  } catch (error) {
    const modelError = serializeError(error);
    debugLog("model path failed", {
      instruction,
      error: modelError,
    });

    return json({
      ok: true,
      baseRevision,
      baseEpoch,
      result: {
        ...localFallback,
        summary: `${localFallback.summary} Model path failed, so the local fallback handled this turn.`,
        diagnostics: [
          ...localFallback.diagnostics,
          formatModelErrorForUser(modelError),
        ],
      },
    });
  } finally {
    cleanupModelRequest?.();
  }
}

function readClientRevision(input: unknown): number {
  return Number.isSafeInteger(input) && (input as number) >= 0
    ? (input as number)
    : 0;
}

async function runIterativeModelEdit(options: {
  model: LanguageModel;
  instruction: string;
  scene: Scene;
  uiRevision: number;
  mediaAssets: ChatMediaAssetManifestItem[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
  signal: AbortSignal;
  maxOutputTokens: number;
}): Promise<Omit<MotionforgeAgentResult, "source">> {
  const evidence = createWorkflowEvidenceAdapter();
  const adapter = createIterativeWorkflowAdapter({
    registryOptions: { sessionOptions: { evidence } },
    // The server host can plan exact proof frames without manufacturing a
    // headless Canvas. Browser clients render the returned canonical Scene.
    evidenceOperation: "proof.comparison.plan",
  });

  try {
    const result = await runIterativeAgent(
      {
        instruction: options.instruction,
        scene: options.scene,
        uiRevision: options.uiRevision,
      },
      {
        tools: adapter,
        decide: async (context) => {
          const decision = await raceWithAbort(
            generateText({
              model: options.model,
              system: buildIterativeDecisionSystemPrompt(options.mediaAssets),
              prompt: buildIterativeDecisionPrompt(context, options.history),
              output: Output.object({
                schema: iterativeAgentDecisionSchema,
                name: "MotionforgeIterativeDecision",
                description:
                  "One typed command, finish, or fail decision for a revisioned MotionForge workspace.",
              }),
              temperature: 0.2,
              maxOutputTokens: Math.min(options.maxOutputTokens, 8_000),
              abortSignal: options.signal,
            }),
            options.signal,
          );
          debugLog("iterative decision", {
            turn: context.turn,
            mode: context.mode,
            revision: context.revision,
            decision: decision.output,
          });
          return authorizeIterativeAgentDecision(
            decision.output,
            options.mediaAssets,
          );
        },
      },
      {
        signal: options.signal,
        toolNames: adapter.toolNames,
      },
    );

    if (!result.ok) {
      const error = new Error(
        `Iterative edit failed (${result.code}): ${result.message} ` +
          `[${result.stats.turns} turn(s), ${result.stats.toolCalls} tool call(s), ${result.stats.repairs} repair(s)].`,
      ) as Error & { code: string; data: unknown };
      error.code = result.code;
      error.data = {
        stats: result.stats,
        events: result.events.slice(-12),
      };
      throw error;
    }

    const [snapshot, history] = await Promise.all([
      adapter.snapshot(result.handle),
      adapter.history(result.handle),
    ]);
    const diagnostics = result.events
      .filter((event) => event.type === "tool.failed")
      .slice(-8)
      .map((event) =>
        `${event.phase} ${event.code}: ${event.message}`.slice(0, 1_024),
      );
    if (result.evidence !== undefined) {
      diagnostics.push("Deterministic before/after proof frames were planned.");
    }
    diagnostics.push(
      `Iterative workflow: ${result.stats.turns} turn(s), ${result.stats.toolCalls} tool call(s), ${result.stats.repairs} repair(s).`,
    );
    return {
      mode: "patch",
      scene: snapshot.scene,
      patch: history.flatMap((entry) => entry.forwardPatch),
      summary: result.summary,
      diagnostics,
    };
  } finally {
    await adapter.dispose();
  }
}

function raceWithAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    promise.catch(() => undefined);
    return Promise.reject(abortReason(signal));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function abortReason(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  const error = new Error(
    typeof signal.reason === "string"
      ? signal.reason
      : "Model request aborted.",
  );
  error.name = "AbortError";
  return error;
}

function readHistory(
  value: ChatRequest["history"],
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-8)
    .flatMap((entry) =>
      entry &&
      (entry.role === "user" || entry.role === "assistant") &&
      typeof entry.content === "string"
        ? [{ role: entry.role, content: entry.content.slice(0, 4_096) }]
        : [],
    );
}

function readScene(input: unknown): Scene | null {
  if (input === null || input === undefined) {
    return null;
  }

  const result = validateScene(input);
  return result.ok ? result.scene : null;
}

function buildUserPrompt(
  instruction: string,
  currentScene: Scene | null,
  mediaAssets: ChatMediaAssetManifestItem[],
) {
  const sceneText = currentScene
    ? `\n\nCurrent scene JSON:\n${JSON.stringify(currentScene)}`
    : "";
  const mediaText = mediaAssets.length
    ? `\n\nUploaded media manifest:\n${formatMediaAssetManifestForPrompt(mediaAssets)}`
    : "";

  return `User instruction:\n${instruction}${mediaText}${sceneText}`;
}

function json(response: ChatResponse, status = 200) {
  return NextResponse.json(response, { status });
}

function debugLog(label: string, payload: unknown) {
  if (!DEBUG) {
    return;
  }

  console.log(`[motionforge/chat] ${label}`);
  console.dir(payload, { depth: null, colors: true });
}

type SerializedError = {
  name?: string;
  message: string;
  stack?: string;
  statusCode?: number;
  type?: string;
  reason?: string;
  generationId?: string;
  isRetryable?: boolean;
  url?: string;
  responseBody?: string;
  response?: unknown;
  data?: unknown;
  validationError?: SerializedError;
  cause?: SerializedError | string;
  lastError?: SerializedError | string;
  errors?: Array<SerializedError | string>;
};

function serializeError(error: unknown, depth = 0): SerializedError | string {
  if (depth > 4) {
    return "[error nesting truncated]";
  }

  if (error instanceof Error) {
    const record = error as Error & Record<string, unknown>;
    const serialized: SerializedError = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    for (const key of [
      "statusCode",
      "type",
      "reason",
      "generationId",
      "isRetryable",
      "url",
      "responseBody",
    ] as const) {
      const value = record[key];
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        (serialized as Record<string, unknown>)[key] = value;
      }
    }

    for (const key of ["response", "data"] as const) {
      const value = record[key];
      if (value !== undefined) {
        serialized[key] = value;
      }
    }

    const validationError = record.validationError;
    if (validationError !== undefined) {
      serialized.validationError = serializeError(
        validationError,
        depth + 1,
      ) as SerializedError;
    }

    const cause = record.cause;
    if (cause !== undefined) {
      serialized.cause = serializeError(cause, depth + 1);
    }

    const lastError = record.lastError;
    if (lastError !== undefined) {
      serialized.lastError = serializeError(lastError, depth + 1);
    }

    const errors = record.errors;
    if (Array.isArray(errors)) {
      serialized.errors = errors.map((entry) =>
        serializeError(entry, depth + 1),
      );
    }

    return serialized;
  }

  if (typeof error === "string") {
    return error;
  }

  return {
    message: stringifyUnknown(error),
  };
}

function formatModelErrorForUser(error: SerializedError | string): string {
  if (typeof error === "string") {
    return error;
  }

  const last =
    typeof error.lastError === "object" ? error.lastError : undefined;
  const primary = last ?? error;
  const parts = [
    primary.name,
    primary.type,
    primary.statusCode === undefined
      ? undefined
      : `status ${primary.statusCode}`,
    primary.message,
    primary.generationId ? `generation ${primary.generationId}` : undefined,
  ].filter(Boolean);

  return parts.join(": ");
}

function stringifyUnknown(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function readModelTimeoutMs() {
  const raw = process.env.MOTIONFORGE_CHAT_TIMEOUT_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_MODEL_TIMEOUT_MS;

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MODEL_TIMEOUT_MS;
}

function readModelMaxOutputTokens() {
  const raw = process.env.MOTIONFORGE_CHAT_MAX_OUTPUT_TOKENS?.trim();
  const parsed = raw
    ? Number.parseInt(raw, 10)
    : DEFAULT_MODEL_MAX_OUTPUT_TOKENS;

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MODEL_MAX_OUTPUT_TOKENS;
}

function readStructuredOutput(
  result: Awaited<ReturnType<typeof generateText>>,
): { ok: true; output: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, output: result.output };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function readLlmModel():
  | { ok: true; provider: string; modelId: string; model: LanguageModel }
  | { ok: false; message: string } {
  const provider = process.env.MOTIONFORGE_LLM_PROVIDER?.trim() || "gateway";

  if (provider === "gateway") {
    if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
      return {
        ok: false,
        message:
          "Add AI_GATEWAY_API_KEY to use Vercel AI Gateway, or set MOTIONFORGE_LLM_PROVIDER=openai-compatible with a base URL.",
      };
    }

    const modelId =
      process.env.MOTIONFORGE_CHAT_MODEL?.trim() || DEFAULT_GATEWAY_MODEL;

    return {
      ok: true,
      provider,
      modelId,
      model: gateway(modelId),
    };
  }

  if (provider === "openai-compatible") {
    const baseURL = process.env.MOTIONFORGE_OPENAI_COMPATIBLE_BASE_URL?.trim();

    if (!baseURL) {
      return {
        ok: false,
        message:
          "Set MOTIONFORGE_OPENAI_COMPATIBLE_BASE_URL in apps/chat/.env.local to use your own OpenAI-compatible provider.",
      };
    }

    const customProvider = createOpenAICompatible({
      name:
        process.env.MOTIONFORGE_OPENAI_COMPATIBLE_NAME?.trim() ||
        "motionforge-custom",
      baseURL,
      apiKey:
        process.env.MOTIONFORGE_OPENAI_COMPATIBLE_API_KEY?.trim() ||
        process.env.OPENAI_API_KEY?.trim(),
    });
    const modelId =
      process.env.MOTIONFORGE_CHAT_MODEL?.trim() ||
      DEFAULT_OPENAI_COMPATIBLE_MODEL;

    return {
      ok: true,
      provider,
      modelId,
      model: customProvider(modelId),
    };
  }

  return {
    ok: false,
    message:
      "MOTIONFORGE_LLM_PROVIDER must be either gateway or openai-compatible.",
  };
}
