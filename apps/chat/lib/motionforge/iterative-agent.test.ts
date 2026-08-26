import { describe, expect, it } from "vitest";
import {
  applyScenePatch,
  parseScene,
  type Scene,
  type ScenePatch,
} from "@motionforge/schema";
import {
  defaultIterativeAgentToolNames,
  runIterativeAgent,
  type IterativeAgentToolCaller,
  type IterativeAgentTurnContext,
} from "./iterative-agent";

type ToolCall = { name: string; input: Record<string, unknown> };

class FakeHandleTools implements IterativeAgentToolCaller {
  readonly calls: ToolCall[] = [];
  scene: Scene;
  revision = 0;
  failInspectOnce = false;
  staleCommandOnce = false;
  renderCount = 0;
  checkResult: (scene: Scene) => Record<string, unknown> = () => ({
    ok: true,
    diagnostics: [],
    renderRequired: false,
  });
  renderResult: (scene: Scene, count: number) => Record<string, unknown> =
    () => ({
      ok: true,
      diagnostics: [],
      evidence: { frames: [0] },
    });

  constructor(scene: Scene) {
    this.scene = structuredClone(scene);
  }

  call(name: string, inputValue: unknown): unknown {
    const input = inputValue as Record<string, unknown>;
    this.calls.push({ name, input: structuredClone(input) });

    if (name === defaultIterativeAgentToolNames.load) {
      this.scene = parseScene(input.scene);
      this.revision = input.mode === "resync" ? this.revision + 1 : 0;
      return { handle: "workspace-1", revision: this.revision };
    }
    if (name === defaultIterativeAgentToolNames.inspect) {
      if (this.failInspectOnce) {
        this.failInspectOnce = false;
        throw Object.assign(new Error("temporary inspector outage"), {
          code: "temporary_unavailable",
          retryable: true,
        });
      }
      return {
        revision: this.revision,
        title: this.scene.nodes.find((node) => node.id === "title")?.text,
        nodeIds: this.scene.nodes.map((node) => node.id),
      };
    }
    if (name === defaultIterativeAgentToolNames.search) {
      const observation = input.observation as Record<string, unknown>;
      return observation.kind === "node"
        ? { node: { id: observation.id, type: "text", text: "Observed" } }
        : {
            total: 1,
            matches: [{ id: "title", type: "text", text: title(this.scene) }],
          };
    }
    if (name === defaultIterativeAgentToolNames.command) {
      if (this.staleCommandOnce) {
        this.staleCommandOnce = false;
        throw Object.assign(new Error("workspace revision changed"), {
          code: "stale_revision",
        });
      }
      if (input.expectedRevision !== this.revision) {
        throw Object.assign(new Error("stale revision"), {
          code: "stale_revision",
        });
      }
      const patch = commandsToPatch(input.commands);
      const applied = applyScenePatch(this.scene, patch);
      if (!applied.ok) {
        throw new Error(
          applied.errors.map((error) => error.message).join("\n"),
        );
      }
      this.scene = applied.scene;
      this.revision += 1;
      return {
        handle: "workspace-1",
        revision: this.revision,
        changed: true,
        affectedIds: patch.flatMap((op) => ("id" in op ? [op.id] : [])),
      };
    }
    if (name === defaultIterativeAgentToolNames.check) {
      return this.checkResult(this.scene);
    }
    if (name === defaultIterativeAgentToolNames.render) {
      this.renderCount += 1;
      return this.renderResult(this.scene, this.renderCount);
    }
    if (name === defaultIterativeAgentToolNames.read) {
      return { handle: "workspace-1", revision: this.revision };
    }
    throw new Error(`Unexpected tool ${name}`);
  }
}

describe("provider-neutral iterative MotionForge host", () => {
  it("uses the simple edit fast path without render or whole-Scene replacement", async () => {
    const original = baseScene();
    const tools = new FakeHandleTools(original);
    const result = await runIterativeAgent(
      { instruction: "Rename the title", scene: original, uiRevision: 0 },
      {
        tools,
        decide: ({ inspection, mode }) => {
          expect(mode).toBe("edit");
          expect(inspection).toMatchObject({ title: "Original" });
          return {
            kind: "command",
            commands: [{ kind: "text.set", id: "title", text: "Renamed" }],
            summary: "Renamed the title.",
          };
        },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      revision: 1,
      summary: "Renamed the title.",
      stats: {
        turns: 1,
        toolCalls: 4,
        commandTransactions: 1,
        commands: 1,
        repairs: 0,
      },
    });
    expect(tools.calls.map((call) => call.name)).toEqual([
      defaultIterativeAgentToolNames.load,
      defaultIterativeAgentToolNames.inspect,
      defaultIterativeAgentToolNames.command,
      defaultIterativeAgentToolNames.check,
    ]);
    expect(tools.calls[0]?.input).toHaveProperty("scene");
    expect(tools.calls.slice(1).every((call) => !("scene" in call.input))).toBe(
      true,
    );
    expect(title(tools.scene)).toBe("Renamed");
    expect(tools.scene.nodes.find((node) => node.id === "background")).toEqual(
      original.nodes.find((node) => node.id === "background"),
    );
    expect(title(original)).toBe("Original");
  });

  it("delivers one bounded observation before editing without repeating base inspect", async () => {
    const tools = new FakeHandleTools(baseScene());
    let turns = 0;
    const result = await runIterativeAgent(
      { instruction: "Find and rename the hidden target", scene: baseScene() },
      {
        tools,
        decide(context) {
          turns += 1;
          if (turns === 1) {
            expect(context.observation).toBeUndefined();
            return {
              kind: "observe",
              observation: { kind: "search", query: "title", limit: 5 },
            };
          }
          expect(context.observation).toMatchObject({
            request: { kind: "search", query: "title" },
            result: { matches: [{ id: "title" }] },
          });
          return {
            kind: "command",
            commands: [{ kind: "text.set", id: "title", text: "Observed" }],
          };
        },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      stats: { turns: 2, observations: 1, toolCalls: 5 },
    });
    expect(tools.calls.map((call) => call.name)).toEqual([
      defaultIterativeAgentToolNames.load,
      defaultIterativeAgentToolNames.inspect,
      defaultIterativeAgentToolNames.search,
      defaultIterativeAgentToolNames.command,
      defaultIterativeAgentToolNames.check,
    ]);
    expect(title(tools.scene)).toBe("Observed");
  });

  it("repairs failed render evidence through another inspect-command-check-render loop", async () => {
    const tools = new FakeHandleTools(baseScene());
    tools.checkResult = () => ({
      ok: true,
      diagnostics: [],
      renderRequired: true,
    });
    tools.renderResult = (scene, count) => {
      const fontSize = scene.nodes.find((node) => node.id === "title")?.style
        ?.fontSize;
      return count === 1
        ? {
            ok: false,
            diagnostics: ["title exceeds its safe area"],
            evidence: { kind: "contact-sheet", frames: [0, 15] },
          }
        : {
            ok: fontSize === 64,
            diagnostics: [],
            evidence: { kind: "contact-sheet", frames: [0, 15], pass: true },
          };
    };
    const contexts: IterativeAgentTurnContext[] = [];
    const result = await runIterativeAgent(
      {
        instruction: "Make the title prominent but keep it safe",
        scene: baseScene(),
      },
      {
        tools,
        decide: (context) => {
          contexts.push(context);
          return context.mode === "repair"
            ? {
                kind: "command",
                commands: [
                  { kind: "style.set", id: "title", style: { fontSize: 64 } },
                ],
                requireRender: true,
                summary: "Repaired the title fit.",
              }
            : {
                kind: "command",
                commands: [
                  { kind: "style.set", id: "title", style: { fontSize: 200 } },
                ],
                requireRender: true,
              };
        },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      revision: 2,
      summary: "Repaired the title fit.",
      evidence: { pass: true },
      stats: { turns: 2, repairs: 1, commandTransactions: 2 },
    });
    expect(contexts[1]).toMatchObject({
      mode: "repair",
      previousFailure: {
        stage: "render",
        code: "render_evidence_failed",
        diagnostics: ["title exceeds its safe area"],
      },
    });
    expect(tools.calls.map((call) => call.name)).toEqual([
      defaultIterativeAgentToolNames.load,
      defaultIterativeAgentToolNames.inspect,
      defaultIterativeAgentToolNames.command,
      defaultIterativeAgentToolNames.check,
      defaultIterativeAgentToolNames.render,
      defaultIterativeAgentToolNames.inspect,
      defaultIterativeAgentToolNames.command,
      defaultIterativeAgentToolNames.check,
      defaultIterativeAgentToolNames.render,
    ]);
    expect(titleFontSize(tools.scene)).toBe(64);
    expect(
      result.events.some((event) => event.type === "repair.requested"),
    ).toBe(true);
    expect(result.events.map((event) => event.sequence)).toEqual(
      result.events.map((_event, index) => index + 1),
    );
  });

  it("discards a stale decision and reloads when the UI revision changes", async () => {
    const original = baseScene();
    const manual = sceneWithTitle("Manual UI edit");
    const tools = new FakeHandleTools(original);
    let snapshotReads = 0;
    let decisions = 0;
    const result = await runIterativeAgent(
      { instruction: "Set an agent title", scene: original, uiRevision: 0 },
      {
        tools,
        readUiSnapshot: () => {
          snapshotReads += 1;
          return snapshotReads === 1
            ? { revision: 0, scene: original }
            : { revision: 1, scene: manual };
        },
        decide: ({ inspection }) => {
          decisions += 1;
          return {
            kind: "command",
            commands: [
              {
                kind: "text.set",
                id: "title",
                text:
                  decisions === 1
                    ? "Discarded stale proposal"
                    : `Synced from ${String((inspection as { title?: string }).title)}`,
              },
            ],
          };
        },
      },
    );

    expect(result).toMatchObject({ ok: true, stats: { turns: 2, resyncs: 1 } });
    expect(title(tools.scene)).toBe("Synced from Manual UI edit");
    expect(title(tools.scene)).not.toBe("Discarded stale proposal");
    expect(
      result.events.some((event) => event.type === "decision.discarded"),
    ).toBe(true);
    const loadCalls = tools.calls.filter(
      (call) => call.name === defaultIterativeAgentToolNames.load,
    );
    expect(loadCalls).toHaveLength(2);
    expect(loadCalls[1]?.input).toMatchObject({
      mode: "resync",
      previousHandle: "workspace-1",
      uiRevision: 1,
    });
    expect(
      tools.calls
        .filter((call) => call.name !== defaultIterativeAgentToolNames.load)
        .every((call) => !("scene" in call.input)),
    ).toBe(true);
  });

  it("retries safe transient failures but never exceeds the tool budget", async () => {
    const tools = new FakeHandleTools(baseScene());
    tools.failInspectOnce = true;
    const recovered = await runIterativeAgent(
      { instruction: "Rename", scene: baseScene() },
      {
        tools,
        decide: () => ({
          kind: "command",
          commands: [{ kind: "text.set", id: "title", text: "Recovered" }],
        }),
      },
    );
    expect(recovered).toMatchObject({
      ok: true,
      stats: { retries: 1, toolCalls: 5 },
    });
    expect(
      recovered.events.some((event) => event.type === "tool.retrying"),
    ).toBe(true);

    const boundedTools = new FakeHandleTools(baseScene());
    const bounded = await runIterativeAgent(
      { instruction: "Rename", scene: baseScene() },
      {
        tools: boundedTools,
        decide: () => ({
          kind: "command",
          commands: [{ kind: "text.set", id: "title", text: "Never applied" }],
        }),
      },
      { budgets: { maxToolCalls: 2 } },
    );
    expect(bounded).toMatchObject({
      ok: false,
      code: "tool_budget_exceeded",
      stats: { toolCalls: 2, commandTransactions: 0 },
    });
    expect(title(boundedTools.scene)).toBe("Original");
  });

  it("recovers a stale workspace revision through read and re-inspection", async () => {
    const tools = new FakeHandleTools(baseScene());
    tools.staleCommandOnce = true;
    let decisions = 0;
    const result = await runIterativeAgent(
      { instruction: "Rename safely", scene: baseScene() },
      {
        tools,
        decide: () => {
          decisions += 1;
          return {
            kind: "command",
            commands: [
              {
                kind: "text.set",
                id: "title",
                text: decisions === 1 ? "First proposal" : "Fresh proposal",
              },
            ],
          };
        },
      },
    );
    expect(result).toMatchObject({ ok: true, stats: { turns: 2, resyncs: 1 } });
    expect(title(tools.scene)).toBe("Fresh proposal");
    expect(tools.calls.map((call) => call.name)).toContain(
      defaultIterativeAgentToolNames.read,
    );
    expect(
      result.events.some(
        (event) =>
          event.type === "workspace.resynced" &&
          event.reason === "stale_revision",
      ),
    ).toBe(true);
  });

  it("rejects whole-Scene replacement decisions after the load boundary", async () => {
    const result = await runIterativeAgent(
      { instruction: "Replace everything", scene: baseScene() },
      {
        tools: new FakeHandleTools(baseScene()),
        decide: () => ({
          kind: "command",
          commands: [{ kind: "scene.replace", scene: baseScene() }],
        }),
      },
    );
    expect(result).toMatchObject({
      ok: false,
      code: "whole_scene_replacement_forbidden",
      stats: { commandTransactions: 0 },
    });
  });

  it("keeps configuration strict and cannot finish over blocking checks", async () => {
    const invalid = await runIterativeAgent(
      { instruction: "Edit", scene: baseScene() },
      {
        tools: new FakeHandleTools(baseScene()),
        decide: () => ({ kind: "finish", summary: "Done" }),
      },
      { budgets: { maxTurns: 2, unknownBudget: 1 } as never },
    );
    expect(invalid).toMatchObject({ ok: false, code: "invalid_options" });

    const tools = new FakeHandleTools(baseScene());
    tools.checkResult = () => ({ ok: false, diagnostics: ["unsafe edge"] });
    const unresolved = await runIterativeAgent(
      { instruction: "Make an unsafe edit", scene: baseScene() },
      {
        tools,
        decide: ({ mode }) =>
          mode === "repair"
            ? { kind: "finish", summary: "Ignore the failure" }
            : {
                kind: "command",
                commands: [
                  { kind: "style.set", id: "title", style: { left: -100 } },
                ],
              },
      },
    );
    expect(unresolved).toMatchObject({
      ok: false,
      code: "unresolved_failure",
      stats: { turns: 2, commandTransactions: 1 },
    });
  });
});

function commandsToPatch(input: unknown): ScenePatch {
  if (!Array.isArray(input)) throw new Error("commands must be an array");
  return input.map((entry) => {
    const command = entry as Record<string, unknown>;
    if (command.kind === "text.set") {
      return {
        op: "setText" as const,
        id: String(command.id),
        text: String(command.text),
      };
    }
    if (command.kind === "style.set") {
      return {
        op: "setStyle" as const,
        id: String(command.id),
        style: command.style as ScenePatch[number] extends infer _Never
          ? Record<string, unknown>
          : never,
      } as ScenePatch[number];
    }
    throw new Error(`Unsupported fake command ${String(command.kind)}`);
  });
}

function baseScene(): Scene {
  return parseScene({
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 30,
    assets: {},
    nodes: [
      {
        id: "background",
        type: "div",
        style: { width: "100%", height: "100%", backgroundColor: "#101820" },
      },
      {
        id: "title",
        type: "text",
        text: "Original",
        style: { width: 240, height: 80, fontSize: 80 },
      },
    ],
  });
}

function sceneWithTitle(value: string): Scene {
  const scene = baseScene();
  const result = applyScenePatch(scene, [
    { op: "setText", id: "title", text: value },
  ]);
  if (!result.ok) throw new Error("fixture patch failed");
  return result.scene;
}

function title(scene: Scene): string | undefined {
  return scene.nodes.find((node) => node.id === "title")?.text;
}

function titleFontSize(scene: Scene): number | string | undefined {
  return scene.nodes.find((node) => node.id === "title")?.style?.fontSize;
}
