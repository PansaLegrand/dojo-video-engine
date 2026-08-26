/**
 * Provider-neutral reference host for an iterative MotionForge editing agent.
 *
 * The host owns orchestration and safety, not model policy or engine tools.
 * A provider adapter supplies `decide`; a MotionForge registry adapter supplies
 * `tools.call`. Only the load/resync boundary accepts a recursive Scene value.
 */

export type IterativeAgentToolCaller = {
  call(name: string, input: unknown): unknown | Promise<unknown>;
};

export type IterativeAgentToolNames = {
  load: string;
  inspect: string;
  search: string;
  command: string;
  check: string;
  render: string;
  read: string;
};

export const defaultIterativeAgentToolNames: Readonly<IterativeAgentToolNames> =
  Object.freeze({
    load: "motionforge.workspace.load",
    inspect: "motionforge.workspace.inspect",
    search: "motionforge.workspace.search",
    command: "motionforge.workspace.command",
    check: "motionforge.workspace.check",
    render: "motionforge.workspace.render",
    read: "motionforge.workspace.read",
  });

export type IterativeAgentBudgets = {
  maxTurns: number;
  maxToolCalls: number;
  maxRepairs: number;
  maxResyncs: number;
  maxToolRetries: number;
  maxObservations: number;
  maxObservationLimit: number;
  maxCommandsPerTurn: number;
  maxInstructionChars: number;
  maxInitialSceneBytes: number;
  maxDecisionBytes: number;
  maxToolResultBytes: number;
};

export const defaultIterativeAgentBudgets: Readonly<IterativeAgentBudgets> =
  Object.freeze({
    maxTurns: 8,
    maxToolCalls: 32,
    maxRepairs: 3,
    maxResyncs: 3,
    maxToolRetries: 1,
    maxObservations: 4,
    maxObservationLimit: 50,
    maxCommandsPerTurn: 32,
    maxInstructionChars: 16_384,
    maxInitialSceneBytes: 2 * 1024 * 1024,
    maxDecisionBytes: 128 * 1024,
    maxToolResultBytes: 512 * 1024,
  });

export type IterativeAgentInput = {
  instruction: string;
  /** Recursive Scene input is confined to workspace load/resync. */
  scene: unknown;
  uiRevision?: string | number;
};

export type IterativeAgentUiSnapshot = {
  revision: string | number;
  scene: unknown;
};

export type IterativeAgentFailureObservation = {
  stage: "check" | "command" | "render";
  code: string;
  message: string;
  diagnostics: unknown[];
  evidence?: unknown;
};

export type IterativeAgentTurnContext = {
  instruction: string;
  mode: "continue" | "edit" | "repair";
  handle: string;
  revision: number;
  turn: number;
  inspection: unknown;
  observation?: IterativeAgentObservation;
  previousFailure?: IterativeAgentFailureObservation;
  previousEvidence?: unknown;
};

export type IterativeAgentObservationRequest =
  | {
      kind: "search";
      query?: string;
      types?: Array<
        | "audio"
        | "div"
        | "effect"
        | "extension"
        | "img"
        | "lottie"
        | "shape"
        | "text"
        | "video"
      >;
      limit?: number;
    }
  | { kind: "node"; id: string };

export type IterativeAgentObservation = {
  request: IterativeAgentObservationRequest;
  result: unknown;
};

export type IterativeAgentDecision =
  | {
      kind: "command";
      commands: unknown[];
      reason?: string;
      summary?: string;
      requireRender?: boolean;
      continueAfterSuccess?: boolean;
    }
  | { kind: "finish"; summary: string }
  | { kind: "fail"; message: string; code?: string }
  | {
      kind: "observe";
      observation: IterativeAgentObservationRequest;
      reason?: string;
    };

export type IterativeAgentDecisionMaker = (
  context: IterativeAgentTurnContext,
) => IterativeAgentDecision | Promise<IterativeAgentDecision>;

export type IterativeAgentStats = {
  turns: number;
  toolCalls: number;
  commandTransactions: number;
  commands: number;
  repairs: number;
  resyncs: number;
  retries: number;
  observations: number;
};

type AgentPhase =
  | "check"
  | "command"
  | "inspect"
  | "load"
  | "read"
  | "render"
  | "resync"
  | "search";

export type IterativeAgentEvent =
  | {
      sequence: number;
      type: "run.started";
      instruction: string;
    }
  | {
      sequence: number;
      type: "phase.started";
      phase: AgentPhase;
      revision?: number;
    }
  | {
      sequence: number;
      type: "tool.started";
      phase: AgentPhase;
      tool: string;
      attempt: number;
    }
  | {
      sequence: number;
      type: "tool.succeeded";
      phase: AgentPhase;
      tool: string;
      attempt: number;
    }
  | {
      sequence: number;
      type: "tool.failed";
      phase: AgentPhase;
      tool: string;
      attempt: number;
      code: string;
      message: string;
      retryable: boolean;
    }
  | {
      sequence: number;
      type: "tool.retrying";
      phase: AgentPhase;
      tool: string;
      attempt: number;
    }
  | {
      sequence: number;
      type: "workspace.loaded" | "workspace.resynced";
      handle: string;
      revision: number;
      reason?: "stale_revision" | "ui_revision";
    }
  | {
      sequence: number;
      type: "decision.received";
      kind: IterativeAgentDecision["kind"];
      mode: IterativeAgentTurnContext["mode"];
      turn: number;
    }
  | {
      sequence: number;
      type: "decision.discarded";
      reason: "ui_revision";
      turn: number;
    }
  | {
      sequence: number;
      type: "revision.changed";
      before: number;
      after: number;
      affectedIds: string[];
    }
  | {
      sequence: number;
      type: "repair.requested";
      stage: IterativeAgentFailureObservation["stage"];
      code: string;
      repairsUsed: number;
    }
  | {
      sequence: number;
      type: "observation.requested";
      kind: IterativeAgentObservationRequest["kind"];
      observationsUsed: number;
    }
  | {
      sequence: number;
      type: "observation.received";
      kind: IterativeAgentObservationRequest["kind"];
      revision: number;
    }
  | {
      sequence: number;
      type: "run.completed";
      handle: string;
      revision: number;
      summary: string;
    }
  | {
      sequence: number;
      type: "run.failed";
      code: string;
      message: string;
      phase?: AgentPhase;
    };

type UnsequencedAgentEvent = IterativeAgentEvent extends infer Event
  ? Event extends { sequence: number }
    ? Omit<Event, "sequence">
    : never
  : never;

export type IterativeAgentDependencies = {
  tools: IterativeAgentToolCaller;
  decide: IterativeAgentDecisionMaker;
  /** Optional bridge to the live editor's current Scene/revision. */
  readUiSnapshot?: () =>
    | IterativeAgentUiSnapshot
    | null
    | Promise<IterativeAgentUiSnapshot | null>;
  onEvent?: (event: IterativeAgentEvent) => void;
};

export type IterativeAgentOptions = {
  budgets?: Partial<IterativeAgentBudgets>;
  toolNames?: Partial<IterativeAgentToolNames>;
  signal?: AbortSignal;
};

export type IterativeAgentSuccess = {
  ok: true;
  status: "completed";
  handle: string;
  revision: number;
  summary: string;
  affectedIds: string[];
  evidence?: unknown;
  events: IterativeAgentEvent[];
  stats: IterativeAgentStats;
};

export type IterativeAgentFailure = {
  ok: false;
  status: "failed";
  code: string;
  message: string;
  phase?: AgentPhase;
  handle?: string;
  revision?: number;
  events: IterativeAgentEvent[];
  stats: IterativeAgentStats;
};

export type IterativeAgentResult =
  | IterativeAgentSuccess
  | IterativeAgentFailure;

type WorkspaceRef = { handle: string; revision: number };
type CheckResult = {
  ok: boolean;
  diagnostics: unknown[];
  renderRequired: boolean;
};
type RenderResult = {
  ok: boolean;
  diagnostics: unknown[];
  evidence?: unknown;
};
type CommandResult = WorkspaceRef & {
  affectedIds: string[];
  changed: boolean;
  summary?: string;
};

class AgentHostError extends Error {
  readonly name = "AgentHostError";

  constructor(
    readonly code: string,
    message: string,
    readonly phase?: AgentPhase,
    readonly retryable = false,
  ) {
    super(message);
  }
}

/** Runs one bounded iterative edit against a handle-based tool caller. */
export async function runIterativeAgent(
  input: IterativeAgentInput,
  dependencies: IterativeAgentDependencies,
  options: IterativeAgentOptions = {},
): Promise<IterativeAgentResult> {
  const host = new IterativeAgentHost(input, dependencies, options);
  return host.run();
}

class IterativeAgentHost {
  private budgets = defaultIterativeAgentBudgets as IterativeAgentBudgets;
  private toolNames = defaultIterativeAgentToolNames as IterativeAgentToolNames;
  private workspace: WorkspaceRef | undefined;
  private uiRevision: string | number | undefined;
  private readonly events: IterativeAgentEvent[] = [];
  private readonly stats: IterativeAgentStats = {
    turns: 0,
    toolCalls: 0,
    commandTransactions: 0,
    commands: 0,
    repairs: 0,
    resyncs: 0,
    retries: 0,
    observations: 0,
  };
  private sequence = 0;

  constructor(
    private readonly input: IterativeAgentInput,
    private readonly dependencies: IterativeAgentDependencies,
    private readonly options: IterativeAgentOptions,
  ) {}

  async run(): Promise<IterativeAgentResult> {
    try {
      this.budgets = resolveBudgets(this.options.budgets);
      this.toolNames = resolveToolNames(this.options.toolNames);
      validateDependencies(this.dependencies);
      const instruction = readInstruction(
        this.input.instruction,
        this.budgets.maxInstructionChars,
      );
      assertJsonValue(
        this.input.scene,
        this.budgets.maxInitialSceneBytes,
        "initial Scene",
      );
      this.uiRevision = readUiRevision(this.input.uiRevision);
      this.emit({ type: "run.started", instruction });

      this.phase("load");
      this.workspace = parseWorkspaceRef(
        await this.callTool(
          "load",
          {
            mode: "load",
            scene: cloneJson(this.input.scene),
            ...(this.uiRevision === undefined
              ? {}
              : { uiRevision: this.uiRevision }),
          },
          false,
        ),
        "load",
      );
      this.emit({
        type: "workspace.loaded",
        handle: this.workspace.handle,
        revision: this.workspace.revision,
      });

      let mode: IterativeAgentTurnContext["mode"] = "edit";
      let previousFailure: IterativeAgentFailureObservation | undefined;
      let previousEvidence: unknown;
      let lastAffectedIds: string[] = [];
      let inspection: unknown;
      let pendingObservation: IterativeAgentObservation | undefined;

      for (;;) {
        if (await this.resyncFromUiIfNeeded("before_inspect")) {
          inspection = undefined;
          pendingObservation = undefined;
        }
        const workspace = this.requireWorkspace();
        if (inspection === undefined) {
          this.phase("inspect");
          inspection = await this.callTool(
            "inspect",
            {
              handle: workspace.handle,
              revision: workspace.revision,
              instruction,
              ...(previousFailure ? { previousFailure } : {}),
            },
            true,
          );
        }

        this.takeTurn();
        const deliveredObservation = pendingObservation;
        pendingObservation = undefined;
        const context: IterativeAgentTurnContext = {
          instruction,
          mode,
          handle: workspace.handle,
          revision: workspace.revision,
          turn: this.stats.turns,
          inspection: cloneJson(inspection),
          ...(deliveredObservation
            ? { observation: cloneJson(deliveredObservation) }
            : {}),
          ...(previousFailure
            ? { previousFailure: cloneJson(previousFailure) }
            : {}),
          ...(previousEvidence === undefined
            ? {}
            : { previousEvidence: cloneJson(previousEvidence) }),
        };
        const decision = await this.readDecision(context);
        this.emit({
          type: "decision.received",
          kind: decision.kind,
          mode,
          turn: this.stats.turns,
        });

        if (decision.kind === "finish") {
          if (previousFailure) {
            throw new AgentHostError(
              "unresolved_failure",
              `Agent cannot finish while ${previousFailure.stage} diagnostics remain unresolved.`,
            );
          }
          return this.complete(
            decision.summary,
            lastAffectedIds,
            previousEvidence,
          );
        }
        if (decision.kind === "fail") {
          throw new AgentHostError(
            decision.code ?? "agent_declined",
            decision.message,
          );
        }

        if (decision.kind === "observe") {
          this.takeObservation();
          if (await this.resyncFromUiIfNeeded("before_observation")) {
            this.emit({
              type: "decision.discarded",
              reason: "ui_revision",
              turn: this.stats.turns,
            });
            inspection = undefined;
            pendingObservation = undefined;
            mode = "edit";
            previousFailure = undefined;
            previousEvidence = undefined;
            continue;
          }
          this.emit({
            type: "observation.requested",
            kind: decision.observation.kind,
            observationsUsed: this.stats.observations,
          });
          this.phase("search");
          const result = await this.callTool(
            "search",
            {
              handle: this.requireWorkspace().handle,
              revision: this.requireWorkspace().revision,
              observation: cloneJson(decision.observation),
            },
            true,
          );
          pendingObservation = {
            request: cloneJson(decision.observation),
            result: cloneJson(result),
          };
          this.emit({
            type: "observation.received",
            kind: decision.observation.kind,
            revision: this.requireWorkspace().revision,
          });
          continue;
        }

        if (await this.resyncFromUiIfNeeded("before_command")) {
          this.emit({
            type: "decision.discarded",
            reason: "ui_revision",
            turn: this.stats.turns,
          });
          mode = "edit";
          previousFailure = undefined;
          previousEvidence = undefined;
          inspection = undefined;
          pendingObservation = undefined;
          continue;
        }

        if (mode === "repair") this.takeRepair();
        const before = this.requireWorkspace().revision;
        let commandResult: CommandResult;
        try {
          this.phase("command");
          commandResult = parseCommandResult(
            await this.callTool(
              "command",
              {
                handle: this.requireWorkspace().handle,
                expectedRevision: before,
                commands: cloneJson(decision.commands),
                ...(decision.reason ? { reason: decision.reason } : {}),
              },
              false,
            ),
            before,
          );
        } catch (error) {
          const normalized = normalizeError(error, "command");
          if (normalized.code === "stale_revision") {
            await this.recoverStaleRevision();
            mode = "edit";
            previousFailure = undefined;
            previousEvidence = undefined;
            inspection = undefined;
            pendingObservation = undefined;
            continue;
          }
          throw normalized;
        }
        this.workspace = {
          handle: commandResult.handle,
          revision: commandResult.revision,
        };
        this.stats.commandTransactions += 1;
        this.stats.commands += decision.commands.length;
        inspection = undefined;
        pendingObservation = undefined;
        lastAffectedIds = commandResult.affectedIds;
        this.emit({
          type: "revision.changed",
          before,
          after: commandResult.revision,
          affectedIds: [...lastAffectedIds],
        });

        if (await this.resyncFromUiIfNeeded("after_command")) {
          mode = "edit";
          previousFailure = undefined;
          previousEvidence = undefined;
          inspection = undefined;
          continue;
        }

        this.phase("check");
        const check = parseCheckResult(
          await this.callTool(
            "check",
            {
              handle: commandResult.handle,
              revision: commandResult.revision,
              affectedIds: [...lastAffectedIds],
            },
            true,
          ),
        );
        if (!check.ok) {
          previousFailure = {
            stage: "check",
            code: "check_failed",
            message: "Workspace checks reported blocking diagnostics.",
            diagnostics: check.diagnostics,
          };
          previousEvidence = undefined;
          this.requestRepair(previousFailure);
          mode = "repair";
          inspection = undefined;
          continue;
        }

        const shouldRender =
          decision.requireRender === true ||
          check.renderRequired ||
          previousFailure?.stage === "render";
        let evidence: unknown;
        if (shouldRender) {
          if (await this.resyncFromUiIfNeeded("before_render")) {
            mode = "edit";
            previousFailure = undefined;
            previousEvidence = undefined;
            inspection = undefined;
            continue;
          }
          this.phase("render");
          const rendered = parseRenderResult(
            await this.callTool(
              "render",
              {
                handle: commandResult.handle,
                revision: commandResult.revision,
                affectedIds: [...lastAffectedIds],
                purpose: mode === "repair" ? "repair-proof" : "edit-proof",
              },
              true,
            ),
          );
          evidence = rendered.evidence;
          if (!rendered.ok) {
            previousFailure = {
              stage: "render",
              code: "render_evidence_failed",
              message: "Rendered evidence did not satisfy the edit check.",
              diagnostics: rendered.diagnostics,
              ...(evidence === undefined
                ? {}
                : { evidence: cloneJson(evidence) }),
            };
            previousEvidence = evidence;
            this.requestRepair(previousFailure);
            mode = "repair";
            inspection = undefined;
            continue;
          }
        }

        previousFailure = undefined;
        previousEvidence = evidence;
        if (decision.continueAfterSuccess) {
          mode = "continue";
          inspection = undefined;
          continue;
        }
        return this.complete(
          decision.summary ??
            commandResult.summary ??
            `Applied ${decision.commands.length} command${decision.commands.length === 1 ? "" : "s"}.`,
          lastAffectedIds,
          evidence,
        );
      }
    } catch (error) {
      return this.fail(error);
    }
  }

  private async readDecision(
    context: IterativeAgentTurnContext,
  ): Promise<IterativeAgentDecision> {
    this.throwIfAborted();
    let raw: unknown;
    try {
      raw = await this.dependencies.decide(cloneJson(context));
    } catch (error) {
      throw new AgentHostError(
        "decision_failed",
        error instanceof Error ? error.message : String(error),
      );
    }
    assertJsonValue(raw, this.budgets.maxDecisionBytes, "agent decision");
    return parseDecision(
      raw,
      this.budgets.maxCommandsPerTurn,
      this.budgets.maxObservationLimit,
    );
  }

  private async callTool(
    phase: keyof IterativeAgentToolNames,
    input: unknown,
    retrySafe: boolean,
  ): Promise<unknown> {
    assertJsonValue(
      input,
      phase === "load"
        ? this.budgets.maxInitialSceneBytes + 4_096
        : this.budgets.maxDecisionBytes,
      `${phase} tool input`,
    );
    const tool = this.toolNames[phase];
    let attempt = 1;
    for (;;) {
      this.throwIfAborted();
      this.takeToolCall();
      this.emit({ type: "tool.started", phase, tool, attempt });
      try {
        const output = await this.dependencies.tools.call(
          tool,
          cloneJson(input),
        );
        assertJsonValue(
          output,
          this.budgets.maxToolResultBytes,
          `${tool} result`,
        );
        this.emit({ type: "tool.succeeded", phase, tool, attempt });
        return cloneJson(output);
      } catch (error) {
        const normalized = normalizeError(error, phase);
        this.emit({
          type: "tool.failed",
          phase,
          tool,
          attempt,
          code: normalized.code,
          message: normalized.message,
          retryable: normalized.retryable,
        });
        if (
          retrySafe &&
          normalized.retryable &&
          attempt <= this.budgets.maxToolRetries
        ) {
          this.stats.retries += 1;
          this.emit({ type: "tool.retrying", phase, tool, attempt });
          attempt += 1;
          continue;
        }
        throw normalized;
      }
    }
  }

  private async resyncFromUiIfNeeded(
    _boundary:
      | "after_command"
      | "before_command"
      | "before_inspect"
      | "before_observation"
      | "before_render",
  ): Promise<boolean> {
    if (!this.dependencies.readUiSnapshot) return false;
    this.throwIfAborted();
    let snapshot: IterativeAgentUiSnapshot | null;
    try {
      snapshot = await this.dependencies.readUiSnapshot();
    } catch (error) {
      throw new AgentHostError(
        "ui_sync_failed",
        error instanceof Error ? error.message : String(error),
        "resync",
      );
    }
    if (!snapshot) return false;
    const revision = readUiRevision(snapshot.revision);
    if (revisionKey(revision) === revisionKey(this.uiRevision)) return false;
    this.takeResync();
    assertJsonValue(
      snapshot.scene,
      this.budgets.maxInitialSceneBytes,
      "UI Scene snapshot",
    );
    this.phase("resync");
    const previous = this.requireWorkspace();
    const next = parseWorkspaceRef(
      await this.callTool(
        "load",
        {
          mode: "resync",
          scene: cloneJson(snapshot.scene),
          uiRevision: revision,
          previousHandle: previous.handle,
          previousRevision: previous.revision,
        },
        false,
      ),
      "resync",
    );
    this.workspace = next;
    this.uiRevision = revision;
    this.emit({
      type: "workspace.resynced",
      handle: next.handle,
      revision: next.revision,
      reason: "ui_revision",
    });
    return true;
  }

  private async recoverStaleRevision(): Promise<void> {
    this.takeResync();
    const previous = this.requireWorkspace();
    this.phase("resync");
    const current = parseWorkspaceRef(
      await this.callTool("read", { handle: previous.handle }, true),
      "read",
    );
    if (current.revision < previous.revision) {
      throw new AgentHostError(
        "invalid_tool_result",
        `Workspace read revision ${current.revision} is older than ${previous.revision}.`,
        "read",
      );
    }
    this.workspace = current;
    this.emit({
      type: "workspace.resynced",
      handle: current.handle,
      revision: current.revision,
      reason: "stale_revision",
    });
  }

  private phase(phase: AgentPhase): void {
    this.emit({
      type: "phase.started",
      phase,
      ...(this.workspace ? { revision: this.workspace.revision } : {}),
    });
  }

  private requestRepair(failure: IterativeAgentFailureObservation): void {
    if (this.stats.repairs >= this.budgets.maxRepairs) {
      throw new AgentHostError(
        "repair_budget_exceeded",
        `Repair budget ${this.budgets.maxRepairs} is exhausted.`,
      );
    }
    this.emit({
      type: "repair.requested",
      stage: failure.stage,
      code: failure.code,
      repairsUsed: this.stats.repairs,
    });
  }

  private takeRepair(): void {
    if (this.stats.repairs >= this.budgets.maxRepairs) {
      throw new AgentHostError(
        "repair_budget_exceeded",
        `Repair budget ${this.budgets.maxRepairs} is exhausted.`,
      );
    }
    this.stats.repairs += 1;
  }

  private takeResync(): void {
    if (this.stats.resyncs >= this.budgets.maxResyncs) {
      throw new AgentHostError(
        "resync_budget_exceeded",
        `Revision resync budget ${this.budgets.maxResyncs} is exhausted.`,
        "resync",
      );
    }
    this.stats.resyncs += 1;
  }

  private takeTurn(): void {
    if (this.stats.turns >= this.budgets.maxTurns) {
      throw new AgentHostError(
        "turn_budget_exceeded",
        `Agent turn budget ${this.budgets.maxTurns} is exhausted.`,
      );
    }
    this.stats.turns += 1;
  }

  private takeObservation(): void {
    if (this.stats.observations >= this.budgets.maxObservations) {
      throw new AgentHostError(
        "observation_budget_exceeded",
        `Agent observation budget ${this.budgets.maxObservations} is exhausted.`,
      );
    }
    this.stats.observations += 1;
  }

  private takeToolCall(): void {
    if (this.stats.toolCalls >= this.budgets.maxToolCalls) {
      throw new AgentHostError(
        "tool_budget_exceeded",
        `Agent tool-call budget ${this.budgets.maxToolCalls} is exhausted.`,
      );
    }
    this.stats.toolCalls += 1;
  }

  private complete(
    summary: string,
    affectedIds: string[],
    evidence: unknown,
  ): IterativeAgentSuccess {
    const workspace = this.requireWorkspace();
    const normalizedSummary = boundedString(summary, 8_192, "summary");
    this.emit({
      type: "run.completed",
      handle: workspace.handle,
      revision: workspace.revision,
      summary: normalizedSummary,
    });
    return {
      ok: true,
      status: "completed",
      handle: workspace.handle,
      revision: workspace.revision,
      summary: normalizedSummary,
      affectedIds: [...affectedIds],
      ...(evidence === undefined ? {} : { evidence: cloneJson(evidence) }),
      events: this.snapshotEvents(),
      stats: { ...this.stats },
    };
  }

  private fail(error: unknown): IterativeAgentFailure {
    const normalized = normalizeError(error);
    this.emit({
      type: "run.failed",
      code: normalized.code,
      message: normalized.message,
      ...(normalized.phase ? { phase: normalized.phase } : {}),
    });
    return {
      ok: false,
      status: "failed",
      code: normalized.code,
      message: normalized.message,
      ...(normalized.phase ? { phase: normalized.phase } : {}),
      ...(this.workspace
        ? {
            handle: this.workspace.handle,
            revision: this.workspace.revision,
          }
        : {}),
      events: this.snapshotEvents(),
      stats: { ...this.stats },
    };
  }

  private requireWorkspace(): WorkspaceRef {
    if (!this.workspace) {
      throw new AgentHostError(
        "workspace_unavailable",
        "The iterative workspace has not been loaded.",
      );
    }
    return this.workspace;
  }

  private throwIfAborted(): void {
    if (this.options.signal?.aborted) {
      throw new AgentHostError(
        "aborted",
        "The iterative agent run was aborted.",
      );
    }
  }

  private emit(event: UnsequencedAgentEvent): void {
    const sequenced = {
      ...event,
      sequence: ++this.sequence,
    } as IterativeAgentEvent;
    this.events.push(sequenced);
    try {
      this.dependencies.onEvent?.(cloneJson(sequenced));
    } catch {
      // Observers are not part of the deterministic state transition.
    }
  }

  private snapshotEvents(): IterativeAgentEvent[] {
    return this.events.map((event) => cloneJson(event));
  }
}

function parseDecision(
  input: unknown,
  maxCommands: number,
  maxObservationLimit: number,
): IterativeAgentDecision {
  const value = record(input, "agent decision");
  if (value.kind === "finish") {
    return {
      kind: "finish",
      summary: boundedString(value.summary, 8_192, "finish summary"),
    };
  }
  if (value.kind === "fail") {
    return {
      kind: "fail",
      message: boundedString(value.message, 8_192, "failure message"),
      ...(typeof value.code === "string"
        ? { code: boundedString(value.code, 128, "failure code") }
        : {}),
    };
  }
  if (value.kind === "observe") {
    return {
      kind: "observe",
      observation: parseObservationRequest(
        value.observation,
        maxObservationLimit,
      ),
      ...(typeof value.reason === "string"
        ? { reason: boundedString(value.reason, 8_192, "observation reason") }
        : {}),
    };
  }
  if (value.kind !== "command") {
    throw new AgentHostError(
      "invalid_decision",
      "Agent decision kind must be command, observe, finish, or fail.",
    );
  }
  if (
    !Array.isArray(value.commands) ||
    value.commands.length < 1 ||
    value.commands.length > maxCommands
  ) {
    throw new AgentHostError(
      "invalid_decision",
      `Command decision must contain 1-${maxCommands} commands.`,
    );
  }
  value.commands.forEach((command, index) => {
    const candidate = record(command, `commands.${index}`);
    if (
      "scene" in candidate ||
      "schemaVersion" in candidate ||
      candidate.kind === "scene.replace" ||
      candidate.op === "replaceScene" ||
      containsWholeScene(candidate)
    ) {
      throw new AgentHostError(
        "whole_scene_replacement_forbidden",
        `commands.${index} attempts to replace the loaded Scene instead of editing by handle.`,
      );
    }
  });
  return {
    kind: "command",
    commands: cloneJson(value.commands),
    ...(typeof value.reason === "string"
      ? { reason: boundedString(value.reason, 8_192, "command reason") }
      : {}),
    ...(typeof value.summary === "string"
      ? { summary: boundedString(value.summary, 8_192, "command summary") }
      : {}),
    ...(typeof value.requireRender === "boolean"
      ? { requireRender: value.requireRender }
      : {}),
    ...(typeof value.continueAfterSuccess === "boolean"
      ? { continueAfterSuccess: value.continueAfterSuccess }
      : {}),
  };
}

const observationNodeTypes = [
  "audio",
  "div",
  "effect",
  "extension",
  "img",
  "lottie",
  "shape",
  "text",
  "video",
] as const;

function parseObservationRequest(
  input: unknown,
  maxLimit: number,
): IterativeAgentObservationRequest {
  const value = record(input, "observation request");
  if (value.kind === "node") {
    return {
      kind: "node",
      id: boundedString(value.id, 191, "observation node id"),
    };
  }
  if (value.kind !== "search") {
    throw new AgentHostError(
      "invalid_decision",
      "Observation kind must be search or node.",
    );
  }
  const query =
    value.query === undefined
      ? undefined
      : boundedString(value.query, 512, "observation query");
  let types: Array<(typeof observationNodeTypes)[number]> = [];
  if (value.types !== undefined) {
    if (!Array.isArray(value.types) || value.types.length > 9) {
      throw new AgentHostError(
        "invalid_decision",
        "Observation types must be an array with at most 9 entries.",
      );
    }
    types = value.types.map((entry) => {
      if (
        typeof entry !== "string" ||
        !(observationNodeTypes as readonly string[]).includes(entry)
      ) {
        throw new AgentHostError(
          "invalid_decision",
          `Unsupported observation node type ${JSON.stringify(entry)}.`,
        );
      }
      return entry as (typeof observationNodeTypes)[number];
    });
    if (new Set(types).size !== types.length) {
      throw new AgentHostError(
        "invalid_decision",
        "Observation node types must be unique.",
      );
    }
  }
  if (query === undefined && types.length === 0) {
    throw new AgentHostError(
      "invalid_decision",
      "Search observation needs a query, node types, or both.",
    );
  }
  const limit =
    value.limit === undefined
      ? Math.min(20, maxLimit)
      : readBoundedInteger(value.limit, 1, maxLimit, "observation limit");
  return {
    kind: "search",
    ...(query === undefined ? {} : { query }),
    ...(types.length === 0 ? {} : { types }),
    limit,
  };
}

function containsWholeScene(value: unknown, depth = 0): boolean {
  if (depth > 16 || typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) {
    return value.some((entry) => containsWholeScene(entry, depth + 1));
  }
  const candidate = value as Record<string, unknown>;
  if (
    "schemaVersion" in candidate &&
    "width" in candidate &&
    "height" in candidate &&
    "fps" in candidate &&
    "duration" in candidate &&
    "assets" in candidate &&
    "nodes" in candidate
  ) {
    return true;
  }
  return Object.values(candidate).some((entry) =>
    containsWholeScene(entry, depth + 1),
  );
}

function parseWorkspaceRef(input: unknown, label: string): WorkspaceRef {
  const value = record(input, `${label} result`);
  const handle = boundedString(value.handle, 512, `${label} handle`);
  const revision = readRevision(value.revision, `${label} revision`);
  return { handle, revision };
}

function parseCommandResult(input: unknown, before: number): CommandResult {
  const value = record(input, "command result");
  const workspace = parseWorkspaceRef(value, "command");
  const changed = value.changed !== false;
  if (
    workspace.revision < before ||
    (changed && workspace.revision === before)
  ) {
    throw new AgentHostError(
      "invalid_tool_result",
      `Command revision ${workspace.revision} does not advance expected revision ${before}.`,
      "command",
    );
  }
  const affectedIds = readStringArray(value.affectedIds, "affectedIds", 4_096);
  return {
    ...workspace,
    changed,
    affectedIds,
    ...(typeof value.summary === "string"
      ? { summary: boundedString(value.summary, 8_192, "command summary") }
      : {}),
  };
}

function parseCheckResult(input: unknown): CheckResult {
  const value = record(input, "check result");
  if (typeof value.ok !== "boolean") {
    throw new AgentHostError(
      "invalid_tool_result",
      "Check result must contain boolean ok.",
      "check",
    );
  }
  return {
    ok: value.ok,
    diagnostics: readArray(value.diagnostics, "check diagnostics", 4_096),
    renderRequired: value.renderRequired === true,
  };
}

function parseRenderResult(input: unknown): RenderResult {
  const value = record(input, "render result");
  if (typeof value.ok !== "boolean") {
    throw new AgentHostError(
      "invalid_tool_result",
      "Render result must contain boolean ok.",
      "render",
    );
  }
  return {
    ok: value.ok,
    diagnostics: readArray(value.diagnostics, "render diagnostics", 4_096),
    ...(value.evidence === undefined
      ? {}
      : { evidence: cloneJson(value.evidence) }),
  };
}

function resolveBudgets(
  input: Partial<IterativeAgentBudgets> | undefined,
): IterativeAgentBudgets {
  const ceilings: IterativeAgentBudgets = {
    maxTurns: 64,
    maxToolCalls: 256,
    maxRepairs: 16,
    maxResyncs: 16,
    maxToolRetries: 8,
    maxObservations: 32,
    maxObservationLimit: 200,
    maxCommandsPerTurn: 128,
    maxInstructionChars: 64 * 1024,
    maxInitialSceneBytes: 8 * 1024 * 1024,
    maxDecisionBytes: 1024 * 1024,
    maxToolResultBytes: 4 * 1024 * 1024,
  };
  const allowed = new Set(Object.keys(defaultIterativeAgentBudgets));
  const supplied = strictOptionsRecord(input, "iterative-agent budgets");
  const unknown = Reflect.ownKeys(supplied)
    .filter((key) => typeof key !== "string" || !allowed.has(key))
    .map(String);
  if (unknown.length > 0) {
    throw new AgentHostError(
      "invalid_options",
      `Unknown iterative-agent budgets: ${unknown.sort().join(", ")}.`,
    );
  }
  const result = {
    ...defaultIterativeAgentBudgets,
    ...input,
  } as IterativeAgentBudgets;
  for (const [key, value] of Object.entries(result) as Array<
    [keyof IterativeAgentBudgets, number]
  >) {
    const permitsZero = key === "maxToolRetries";
    if (
      !Number.isSafeInteger(value) ||
      (permitsZero ? value < 0 : value < 1) ||
      value > ceilings[key]
    ) {
      throw new AgentHostError(
        "invalid_options",
        `${key} must be a ${permitsZero ? "non-negative" : "positive"} safe integer no greater than ${ceilings[key]}.`,
      );
    }
  }
  return result;
}

function resolveToolNames(
  input: Partial<IterativeAgentToolNames> | undefined,
): IterativeAgentToolNames {
  const allowed = new Set(Object.keys(defaultIterativeAgentToolNames));
  const supplied = strictOptionsRecord(input, "iterative-agent tool names");
  const unknown = Reflect.ownKeys(supplied)
    .filter((key) => typeof key !== "string" || !allowed.has(key))
    .map(String);
  if (unknown.length > 0) {
    throw new AgentHostError(
      "invalid_options",
      `Unknown iterative-agent tool names: ${unknown.sort().join(", ")}.`,
    );
  }
  const result = {
    ...defaultIterativeAgentToolNames,
    ...input,
  } as IterativeAgentToolNames;
  const names = Object.values(result).map((name) =>
    boundedString(name, 256, "tool name"),
  );
  if (new Set(names).size !== names.length) {
    throw new AgentHostError(
      "invalid_options",
      "Iterative-agent tool names must be unique.",
    );
  }
  return result;
}

function strictOptionsRecord(
  input: unknown,
  label: string,
): Record<string, unknown> {
  if (input === undefined) return {};
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    (Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null)
  ) {
    throw new AgentHostError(
      "invalid_options",
      `${label} must be a plain strict object.`,
    );
  }
  return input as Record<string, unknown>;
}

function validateDependencies(dependencies: IterativeAgentDependencies): void {
  if (!dependencies?.tools || typeof dependencies.tools.call !== "function") {
    throw new AgentHostError(
      "invalid_options",
      "Iterative agent needs an injected tools.call function.",
    );
  }
  if (typeof dependencies.decide !== "function") {
    throw new AgentHostError(
      "invalid_options",
      "Iterative agent needs an injected decision function.",
    );
  }
}

function readInstruction(input: unknown, maxChars: number): string {
  if (typeof input !== "string") {
    throw new AgentHostError("invalid_input", "Instruction must be a string.");
  }
  const value = input.trim();
  if (!value || value.length > maxChars) {
    throw new AgentHostError(
      "invalid_input",
      `Instruction must contain 1-${maxChars} characters.`,
    );
  }
  return value;
}

function readRevision(input: unknown, label: string): number {
  if (!Number.isSafeInteger(input) || (input as number) < 0) {
    throw new AgentHostError(
      "invalid_tool_result",
      `${label} must be a non-negative safe integer.`,
    );
  }
  return input as number;
}

function readBoundedInteger(
  input: unknown,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (
    !Number.isSafeInteger(input) ||
    (input as number) < minimum ||
    (input as number) > maximum
  ) {
    throw new AgentHostError(
      "invalid_decision",
      `${label} must be an integer in [${minimum}, ${maximum}].`,
    );
  }
  return input as number;
}

function readUiRevision(input: unknown): string | number | undefined {
  if (input === undefined) return undefined;
  if (
    (typeof input === "string" && input.length > 0 && input.length <= 512) ||
    (typeof input === "number" && Number.isSafeInteger(input) && input >= 0)
  ) {
    return input;
  }
  throw new AgentHostError(
    "invalid_input",
    "UI revision must be a bounded non-empty string or non-negative safe integer.",
    "resync",
  );
}

function revisionKey(input: string | number | undefined): string {
  return `${typeof input}:${String(input)}`;
}

function readStringArray(input: unknown, label: string, max: number): string[] {
  return readArray(input, label, max).map((value, index) =>
    boundedString(value, 512, `${label}.${index}`),
  );
}

function readArray(input: unknown, label: string, max: number): unknown[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > max) {
    throw new AgentHostError(
      "invalid_tool_result",
      `${label} must be an array with at most ${max} entries.`,
    );
  }
  return cloneJson(input);
}

function record(input: unknown, label: string): Record<string, unknown> {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    throw new AgentHostError(
      "invalid_tool_result",
      `${label} must be a plain object.`,
    );
  }
  return input as Record<string, unknown>;
}

function boundedString(input: unknown, max: number, label: string): string {
  if (typeof input !== "string") {
    throw new AgentHostError(
      "invalid_tool_result",
      `${label} must be a string.`,
    );
  }
  const value = input.trim();
  if (!value || value.length > max) {
    throw new AgentHostError(
      "invalid_tool_result",
      `${label} must contain 1-${max} characters.`,
    );
  }
  return value;
}

function normalizeError(error: unknown, phase?: AgentPhase): AgentHostError {
  if (error instanceof AgentHostError) return error;
  if (error instanceof Error) {
    const candidate = error as Error & {
      code?: unknown;
      retryable?: unknown;
      staleRevision?: unknown;
    };
    const code =
      candidate.staleRevision === true
        ? "stale_revision"
        : typeof candidate.code === "string" && candidate.code
          ? candidate.code
          : "tool_failed";
    return new AgentHostError(
      code,
      error.message || "Tool call failed.",
      phase,
      candidate.retryable === true,
    );
  }
  return new AgentHostError(
    "tool_failed",
    typeof error === "string" ? error : "Tool call failed.",
    phase,
  );
}

function assertJsonValue(
  value: unknown,
  maxBytes: number,
  label: string,
): void {
  const seen = new Set<object>();
  let nodes = 0;
  const visit = (entry: unknown, depth: number): void => {
    nodes += 1;
    if (nodes > 100_000 || depth > 64) {
      throw new AgentHostError(
        "result_budget_exceeded",
        `${label} exceeds JSON structure budgets.`,
      );
    }
    if (
      entry === null ||
      typeof entry === "string" ||
      typeof entry === "boolean"
    ) {
      return;
    }
    if (typeof entry === "number") {
      if (!Number.isFinite(entry)) {
        throw new AgentHostError(
          "invalid_json",
          `${label} contains a non-finite number.`,
        );
      }
      return;
    }
    if (typeof entry !== "object") {
      throw new AgentHostError(
        "invalid_json",
        `${label} contains a non-JSON value.`,
      );
    }
    if (seen.has(entry)) {
      throw new AgentHostError("invalid_json", `${label} contains a cycle.`);
    }
    seen.add(entry);
    if (Array.isArray(entry)) {
      entry.forEach((item) => visit(item, depth + 1));
    } else {
      if (Object.getPrototypeOf(entry) !== Object.prototype) {
        throw new AgentHostError(
          "invalid_json",
          `${label} contains a non-plain object.`,
        );
      }
      Object.values(entry).forEach((item) => visit(item, depth + 1));
    }
    seen.delete(entry);
  };
  visit(value, 0);
  const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (bytes > maxBytes) {
    throw new AgentHostError(
      "result_budget_exceeded",
      `${label} is ${bytes} bytes, exceeding the ${maxBytes}-byte budget.`,
    );
  }
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}
