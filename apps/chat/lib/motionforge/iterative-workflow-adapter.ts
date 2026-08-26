import {
  createAgentWorkflowToolRegistry,
  type AgentWorkflowToolRegistry,
  type AgentWorkflowToolRegistryOptions,
  type WorkflowHostSnapshot,
  type WorkflowJsonValue,
  type WorkflowResult,
  type WorkspaceHistoryEntry,
} from "@motionforge/agent-tools";
import {
  defaultIterativeAgentToolNames,
  type IterativeAgentToolCaller,
  type IterativeAgentToolNames,
} from "./iterative-agent";

type JsonRecord = Record<string, unknown>;

export type IterativeWorkflowCheckContext = {
  handle: string;
  revision: number;
  affectedIds: string[];
  commands: unknown[];
  diagnostics: unknown[];
  workflowData: JsonRecord;
};

export type IterativeWorkflowAdapterOptions = {
  registry?: AgentWorkflowToolRegistry;
  registryOptions?: AgentWorkflowToolRegistryOptions;
  /** Defaults to true for an internally created registry, false when injected. */
  disposeRegistry?: boolean;
  hostToolNames?: Partial<IterativeAgentToolNames>;
  readLimit?: number;
  checkSampleCount?: number;
  maxDiagnostics?: number;
  evidenceOperation?: string;
  retryableCodes?: readonly string[];
  isBlockingDiagnostic?: (diagnostic: unknown) => boolean;
  renderRequired?: (context: IterativeWorkflowCheckContext) => boolean;
};

export type IterativeWorkflowCleanupWarning = {
  code: string;
  message: string;
  handle: string;
};

export class IterativeWorkflowToolError extends Error {
  readonly name = "IterativeWorkflowToolError";
  readonly staleRevision: boolean;

  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly details?: unknown,
  ) {
    super(message);
    this.staleRevision = code === "stale_revision";
  }
}

/**
 * Adapts the real MF8 workflow registry to the six compact tools consumed by
 * runIterativeAgent(). Recursive Scene values cross only `load`/`resync`.
 */
export class IterativeWorkflowAdapter implements IterativeAgentToolCaller {
  readonly registry: AgentWorkflowToolRegistry;
  readonly toolNames: IterativeAgentToolNames;
  private readonly disposeRegistry: boolean;
  private readonly readLimit: number;
  private readonly checkSampleCount: number;
  private readonly maxDiagnostics: number;
  private readonly evidenceOperation: string;
  private readonly retryableCodes: ReadonlySet<string>;
  private readonly isBlockingDiagnostic: (diagnostic: unknown) => boolean;
  private readonly renderRequiredPolicy: (
    context: IterativeWorkflowCheckContext,
  ) => boolean;
  private readonly activeHandles = new Set<string>();
  private readonly lastCommands = new Map<string, unknown[]>();
  private currentHandleValue: string | undefined;
  private disposed = false;
  private disposal: Promise<void> | undefined;

  constructor(options: IterativeWorkflowAdapterOptions = {}) {
    if (options.registry && options.registryOptions) {
      throw new TypeError("Provide registry or registryOptions, not both.");
    }
    this.registry =
      options.registry ??
      createAgentWorkflowToolRegistry(options.registryOptions);
    this.disposeRegistry =
      options.disposeRegistry ?? options.registry === undefined;
    this.toolNames = resolveHostToolNames(options.hostToolNames);
    this.readLimit = boundedInteger(
      options.readLimit,
      100,
      1,
      200,
      "readLimit",
    );
    this.checkSampleCount = boundedInteger(
      options.checkSampleCount,
      3,
      1,
      32,
      "checkSampleCount",
    );
    this.maxDiagnostics = boundedInteger(
      options.maxDiagnostics,
      100,
      1,
      500,
      "maxDiagnostics",
    );
    this.evidenceOperation = boundedOperation(
      options.evidenceOperation ?? "proof.comparison.render",
    );
    this.retryableCodes = new Set(
      options.retryableCodes ?? ["evidence_failed", "workspace_failed"],
    );
    this.isBlockingDiagnostic =
      options.isBlockingDiagnostic ?? defaultBlockingDiagnostic;
    this.renderRequiredPolicy = options.renderRequired ?? defaultRenderRequired;
  }

  get currentHandle(): string | undefined {
    return this.currentHandleValue;
  }

  async call(name: string, input: unknown): Promise<unknown> {
    this.assertAlive();
    if (name === this.toolNames.load) return this.load(input);
    if (name === this.toolNames.inspect) return this.inspect(input);
    if (name === this.toolNames.search) return this.search(input);
    if (name === this.toolNames.command) return this.applyCommands(input);
    if (name === this.toolNames.check) return this.check(input);
    if (name === this.toolNames.render) return this.render(input);
    if (name === this.toolNames.read) return this.read(input);
    throw new IterativeWorkflowToolError(
      "unknown_tool",
      `Unknown iterative workflow bridge tool ${JSON.stringify(name)}.`,
      false,
    );
  }

  /** Trusted host-only canonical snapshot; never exposed as an agent tool. */
  async snapshot(handle?: string): Promise<Readonly<WorkflowHostSnapshot>> {
    this.assertAlive();
    return this.registry.hostSnapshot(handle ?? this.requireCurrentHandle());
  }

  /** Trusted host-only committed forward/inverse patch history. */
  async history(handle?: string): Promise<readonly WorkspaceHistoryEntry[]> {
    this.assertAlive();
    return this.registry.hostHistory(handle ?? this.requireCurrentHandle());
  }

  /** Idempotently closes every remaining handle/evidence resource. */
  dispose(): Promise<void> {
    this.disposal ??= this.disposeNow();
    return this.disposal;
  }

  private async load(input: unknown): Promise<JsonRecord> {
    const request = plainRecord(input, "load input");
    const mode = request.mode;
    if (mode !== "load" && mode !== "resync") {
      throw protocolError("Load mode must be load or resync.");
    }
    if (!("scene" in request)) {
      throw protocolError("Load input must contain the latest Scene.");
    }
    const previousHandle =
      mode === "resync" && typeof request.previousHandle === "string"
        ? request.previousHandle
        : undefined;
    const previousRevision =
      mode === "resync"
        ? optionalRevision(request.previousRevision)
        : undefined;

    // Publish the replacement first. A failed load leaves the old workspace
    // intact; cleanup of the old handle can never invalidate the new one.
    const loaded = await this.invoke("motionforge.workflow.load", {
      scene: request.scene,
    });
    const next = envelopeWorkspace(loaded, "load");
    this.activeHandles.add(next.handle);
    this.currentHandleValue = next.handle;

    let cleanupWarning: IterativeWorkflowCleanupWarning | undefined;
    if (previousHandle && previousHandle !== next.handle) {
      cleanupWarning = await this.closeSuperseded(
        previousHandle,
        previousRevision,
      );
    }
    return {
      ...next,
      ...(cleanupWarning ? { cleanupWarning } : {}),
    };
  }

  private async inspect(input: unknown): Promise<JsonRecord> {
    const request = handleRevisionInput(input, "inspect");
    const envelope = await this.invoke("motionforge.workflow.read", {
      handle: request.handle,
      expectedRevision: request.revision,
      view: "summary",
      limit: this.readLimit,
    });
    const workspace = envelopeWorkspace(envelope, "inspect");
    return {
      ...workspace,
      ...plainData(envelope.data, "inspect data"),
    };
  }

  private async applyCommands(input: unknown): Promise<JsonRecord> {
    const request = plainRecord(input, "command input");
    const handle = requiredString(request.handle, "command handle");
    const expectedRevision = requiredRevision(
      request.expectedRevision,
      "expectedRevision",
    );
    if (!Array.isArray(request.commands) || request.commands.length === 0) {
      throw protocolError(
        "Command input must contain a non-empty commands array.",
      );
    }
    const commands = structuredClone(request.commands);
    const envelope = await this.invoke("motionforge.workflow.commands", {
      handle,
      expectedRevision,
      commands,
    });
    const workspace = envelopeWorkspace(envelope, "commands");
    const data = plainData(envelope.data, "command data");
    const history = optionalRecord(data.history);
    const affectedIds = boundedStringArray(history?.affectedIds, 4_096);
    this.lastCommands.set(handle, commands);
    return {
      ...workspace,
      changed: data.changed !== false,
      affectedIds,
      summary: `Applied ${commands.length} command${commands.length === 1 ? "" : "s"}.`,
    };
  }

  private async search(input: unknown): Promise<JsonRecord> {
    const request = handleRevisionInput(input, "search");
    const observation = plainRecord(
      plainRecord(input, "search input").observation,
      "search observation",
    );
    if (observation.kind === "node") {
      const envelope = await this.invoke("motionforge.workflow.read", {
        handle: request.handle,
        expectedRevision: request.revision,
        view: "node",
        id: requiredString(observation.id, "observation node id"),
      });
      return {
        ...envelopeWorkspace(envelope, "node observation"),
        ...plainData(envelope.data, "node observation data"),
      };
    }
    if (observation.kind !== "search") {
      throw protocolError("Observation kind must be search or node.");
    }
    const query =
      observation.query === undefined
        ? undefined
        : requiredString(observation.query, "observation query");
    const types = boundedStringArray(observation.types, 9);
    if (query === undefined && types.length === 0) {
      throw protocolError("Search observation needs query, types, or both.");
    }
    const limit = boundedInteger(
      typeof observation.limit === "number" ? observation.limit : undefined,
      20,
      1,
      200,
      "observation limit",
    );
    const envelope = await this.invoke("motionforge.workflow.search", {
      handle: request.handle,
      expectedRevision: request.revision,
      ...(query === undefined ? {} : { query }),
      ...(types.length === 0 ? {} : { types }),
      limit,
    });
    return {
      ...envelopeWorkspace(envelope, "search observation"),
      ...plainData(envelope.data, "search observation data"),
    };
  }

  private async check(input: unknown): Promise<JsonRecord> {
    const request = handleRevisionInput(input, "check");
    const affectedIds = boundedStringArray(
      plainRecord(input, "check input").affectedIds,
      4_096,
    );
    const envelope = await this.invoke("motionforge.workflow.check", {
      handle: request.handle,
      expectedRevision: request.revision,
      sampleCount: this.checkSampleCount,
      maxDiagnostics: this.maxDiagnostics,
    });
    const workspace = envelopeWorkspace(envelope, "check");
    const data = plainData(envelope.data, "check data");
    const diagnostics = [
      ...boundedArray(data.lint, this.maxDiagnostics),
      ...boundedArray(data.diagnostics, this.maxDiagnostics),
    ].slice(0, this.maxDiagnostics);
    const commands = structuredClone(
      this.lastCommands.get(request.handle) ?? [],
    );
    const context: IterativeWorkflowCheckContext = {
      handle: workspace.handle,
      revision: workspace.revision,
      affectedIds,
      commands,
      diagnostics: structuredClone(diagnostics),
      workflowData: structuredClone(data),
    };
    return {
      ...workspace,
      ok:
        data.ok === true &&
        !diagnostics.some((diagnostic) =>
          this.isBlockingDiagnostic(structuredClone(diagnostic)),
        ),
      diagnostics,
      renderRequired: this.renderRequiredPolicy(structuredClone(context)),
    };
  }

  private async render(input: unknown): Promise<JsonRecord> {
    const request = handleRevisionInput(input, "render");
    const raw = plainRecord(input, "render input");
    boundedStringArray(raw.affectedIds, 4_096);
    const purpose =
      typeof raw.purpose === "string" ? raw.purpose.slice(0, 96) : "edit-proof";
    const envelope = await this.invoke("motionforge.workflow.evidence", {
      handle: request.handle,
      expectedRevision: request.revision,
      operation: this.evidenceOperation,
      // The evidence controller derives changed IDs from trusted last history.
      params: { title: purpose, includeVisualDiff: true },
    });
    const workspace = envelopeWorkspace(envelope, "render");
    const data = plainData(envelope.data, "evidence data");
    const evidence = data.result;
    const evidenceRecord = optionalRecord(evidence);
    const diagnostics = [
      ...boundedArray(evidenceRecord?.diagnostics, this.maxDiagnostics),
      ...boundedArray(evidenceRecord?.errors, this.maxDiagnostics),
    ].slice(0, this.maxDiagnostics);
    return {
      ...workspace,
      ok: evidenceRecord?.ok === false ? false : true,
      diagnostics,
      evidence: evidence as WorkflowJsonValue,
    };
  }

  private async read(input: unknown): Promise<JsonRecord> {
    const request = plainRecord(input, "read input");
    const handle = requiredString(request.handle, "read handle");
    const envelope = await this.invoke("motionforge.workflow.read", {
      handle,
      view: "summary",
      limit: 1,
    });
    return envelopeWorkspace(envelope, "read");
  }

  private async closeSuperseded(
    handle: string,
    revision: number | undefined,
  ): Promise<IterativeWorkflowCleanupWarning | undefined> {
    let expectedRevision = revision;
    if (expectedRevision === undefined) {
      try {
        expectedRevision = (await this.registry.hostSnapshot(handle)).revision;
      } catch (cause) {
        const error = normalizeThrown(cause, this.retryableCodes);
        if (error.code === "unknown_handle") {
          this.activeHandles.delete(handle);
          this.lastCommands.delete(handle);
          return undefined;
        }
        return cleanupWarning(handle, error);
      }
    }
    try {
      await this.invoke("motionforge.workflow.close", {
        handle,
        expectedRevision,
      });
      this.activeHandles.delete(handle);
      this.lastCommands.delete(handle);
      return undefined;
    } catch (cause) {
      let error = normalizeThrown(cause, this.retryableCodes);
      if (error.code === "stale_revision") {
        try {
          const latest = await this.registry.hostSnapshot(handle);
          await this.invoke("motionforge.workflow.close", {
            handle,
            expectedRevision: latest.revision,
          });
          this.activeHandles.delete(handle);
          this.lastCommands.delete(handle);
          return undefined;
        } catch (retryCause) {
          error = normalizeThrown(retryCause, this.retryableCodes);
        }
      }
      // close() deletes the handle even when evidence cleanup reports failure.
      if (error.code === "cleanup_failed" || error.code === "unknown_handle") {
        this.activeHandles.delete(handle);
        this.lastCommands.delete(handle);
      }
      return cleanupWarning(handle, error);
    }
  }

  private async invoke(name: string, input: unknown) {
    let result: WorkflowResult;
    try {
      result = await this.registry.call(name, input);
    } catch (cause) {
      throw normalizeThrown(cause, this.retryableCodes);
    }
    if (!result.ok) {
      throw new IterativeWorkflowToolError(
        result.error.code,
        result.error.message,
        this.retryableCodes.has(result.error.code),
        result.error.details,
      );
    }
    return result;
  }

  private async disposeNow(): Promise<void> {
    try {
      if (this.disposeRegistry) {
        await this.invoke("motionforge.workflow.dispose", {});
      } else {
        const failures: IterativeWorkflowCleanupWarning[] = [];
        for (const handle of [...this.activeHandles]) {
          try {
            const snapshot = await this.registry.hostSnapshot(handle);
            await this.invoke("motionforge.workflow.close", {
              handle,
              expectedRevision: snapshot.revision,
            });
          } catch (cause) {
            failures.push(
              cleanupWarning(
                handle,
                normalizeThrown(cause, this.retryableCodes),
              ),
            );
          }
        }
        if (failures.length > 0) {
          throw new IterativeWorkflowToolError(
            "cleanup_failed",
            `Failed to close ${failures.length} workflow handle${failures.length === 1 ? "" : "s"}.`,
            false,
            failures,
          );
        }
      }
    } finally {
      this.activeHandles.clear();
      this.lastCommands.clear();
      this.currentHandleValue = undefined;
      this.disposed = true;
    }
  }

  private assertAlive(): void {
    if (this.disposed) {
      throw new IterativeWorkflowToolError(
        "adapter_disposed",
        "Iterative workflow adapter is disposed.",
        false,
      );
    }
  }

  private requireCurrentHandle(): string {
    this.assertAlive();
    if (!this.currentHandleValue) {
      throw new IterativeWorkflowToolError(
        "workspace_unavailable",
        "No workflow workspace has been loaded.",
        false,
      );
    }
    return this.currentHandleValue;
  }
}

export function createIterativeWorkflowAdapter(
  options?: IterativeWorkflowAdapterOptions,
): IterativeWorkflowAdapter {
  return new IterativeWorkflowAdapter(options);
}

function envelopeWorkspace(
  envelope: Extract<WorkflowResult, { ok: true }>,
  label: string,
): { handle: string; revision: number } {
  return {
    handle: requiredString(envelope.handle, `${label} handle`),
    revision: requiredRevision(envelope.revision, `${label} revision`),
  };
}

function plainData(input: unknown, label: string): JsonRecord {
  return input === undefined ? {} : plainRecord(input, label);
}

function handleRevisionInput(
  input: unknown,
  label: string,
): { handle: string; revision: number } {
  const value = plainRecord(input, `${label} input`);
  return {
    handle: requiredString(value.handle, `${label} handle`),
    revision: requiredRevision(value.revision, `${label} revision`),
  };
}

function requiredString(input: unknown, label: string): string {
  if (typeof input !== "string" || input.length < 1 || input.length > 512) {
    throw protocolError(`${label} must be a bounded non-empty string.`);
  }
  return input;
}

function requiredRevision(input: unknown, label: string): number {
  if (!Number.isSafeInteger(input) || (input as number) < 0) {
    throw protocolError(`${label} must be a non-negative safe integer.`);
  }
  return input as number;
}

function optionalRevision(input: unknown): number | undefined {
  return input === undefined
    ? undefined
    : requiredRevision(input, "previousRevision");
}

function plainRecord(input: unknown, label: string): JsonRecord {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    throw protocolError(`${label} must be a plain object.`);
  }
  return input as JsonRecord;
}

function optionalRecord(input: unknown): JsonRecord | undefined {
  return typeof input === "object" &&
    input !== null &&
    !Array.isArray(input) &&
    Object.getPrototypeOf(input) === Object.prototype
    ? (input as JsonRecord)
    : undefined;
}

function boundedArray(input: unknown, max: number): unknown[] {
  return Array.isArray(input) ? structuredClone(input.slice(0, max)) : [];
}

function boundedStringArray(input: unknown, max: number): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, max)
    .flatMap((entry) =>
      typeof entry === "string" && entry.length > 0 && entry.length <= 512
        ? [entry]
        : [],
    );
}

function defaultBlockingDiagnostic(input: unknown): boolean {
  const diagnostic = optionalRecord(input);
  return diagnostic?.severity === "error";
}

function defaultRenderRequired(
  context: IterativeWorkflowCheckContext,
): boolean {
  const noEvidenceKinds = new Set(["media.gain", "text.set"]);
  return context.commands.some((command) => {
    const value = optionalRecord(command);
    return typeof value?.kind !== "string" || !noEvidenceKinds.has(value.kind);
  });
}

function resolveHostToolNames(
  input: Partial<IterativeAgentToolNames> | undefined,
): IterativeAgentToolNames {
  const result = { ...defaultIterativeAgentToolNames, ...input };
  const names = Object.values(result);
  if (
    names.some(
      (name) =>
        typeof name !== "string" || name.length < 1 || name.length > 256,
    ) ||
    new Set(names).size !== names.length
  ) {
    throw new TypeError("Host tool names must be unique bounded strings.");
  }
  return result;
}

function boundedInteger(
  input: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  const value = input ?? fallback;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(
      `${label} must be an integer in [${minimum}, ${maximum}].`,
    );
  }
  return value;
}

function boundedOperation(input: string): string {
  if (!/^[A-Za-z][A-Za-z0-9._/-]{0,95}$/.test(input)) {
    throw new TypeError("evidenceOperation must be a bounded operation id.");
  }
  return input;
}

function protocolError(message: string): IterativeWorkflowToolError {
  return new IterativeWorkflowToolError(
    "workflow_protocol_error",
    message,
    false,
  );
}

function normalizeThrown(
  cause: unknown,
  retryableCodes: ReadonlySet<string>,
): IterativeWorkflowToolError {
  if (cause instanceof IterativeWorkflowToolError) return cause;
  if (cause instanceof Error) {
    const candidate = cause as Error & { code?: unknown; details?: unknown };
    const code =
      typeof candidate.code === "string" && candidate.code
        ? candidate.code
        : "workflow_call_failed";
    return new IterativeWorkflowToolError(
      code,
      cause.message || "Workflow call failed.",
      retryableCodes.has(code),
      candidate.details,
    );
  }
  return new IterativeWorkflowToolError(
    "workflow_call_failed",
    typeof cause === "string" ? cause : "Workflow call failed.",
    true,
  );
}

function cleanupWarning(
  handle: string,
  error: IterativeWorkflowToolError,
): IterativeWorkflowCleanupWarning {
  return { handle, code: error.code, message: error.message };
}
