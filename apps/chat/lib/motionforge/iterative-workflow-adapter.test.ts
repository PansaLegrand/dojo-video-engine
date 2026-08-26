import { describe, expect, it } from "vitest";
import {
  createAgentWorkflowToolRegistry,
  createWorkflowEvidenceAdapter,
  type AgentWorkflowToolRegistry,
  type EvidenceArtifactRenderer,
  type EvidenceArtifactSink,
  type EvidenceArtifactSinkWriter,
  type WorkflowEvidenceRequest,
  type WorkflowResult,
} from "@motionforge/agent-tools";
import { parseScene, type Scene } from "@motionforge/schema";
import {
  defaultIterativeAgentToolNames,
  runIterativeAgent,
  type IterativeAgentTurnContext,
} from "./iterative-agent";
import {
  createIterativeWorkflowAdapter,
  IterativeWorkflowToolError,
} from "./iterative-workflow-adapter";

type RegistryCall = {
  name: string;
  input: Record<string, unknown>;
  result?: WorkflowResult;
};

describe("real MF8 workflow bridge", () => {
  it("runs a simple edit end to end and exposes trusted snapshot/history", async () => {
    const registry = createAgentWorkflowToolRegistry({
      sessionOptions: { sessionId: "ChatSimple" },
    });
    const calls = spyRegistry(registry);
    const adapter = createIterativeWorkflowAdapter({ registry });
    const original = baseScene();
    const result = await runIterativeAgent(
      { instruction: "Rename the title", scene: original },
      {
        tools: adapter,
        decide: ({ inspection }) => {
          expect(inspection).toMatchObject({
            nodes: expect.arrayContaining([
              expect.objectContaining({ id: "title", text: "Original" }),
            ]),
          });
          return {
            kind: "command",
            commands: [{ kind: "text.set", id: "title", text: "Bridged" }],
            summary: "Renamed through the workflow bridge.",
          };
        },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      revision: 1,
      summary: "Renamed through the workflow bridge.",
      affectedIds: ["title"],
      stats: { toolCalls: 4, repairs: 0 },
    });
    if (!result.ok) throw new Error(result.message);
    const snapshot = await adapter.snapshot(result.handle);
    expect(title(snapshot.scene)).toBe("Bridged");
    expect(title(original)).toBe("Original");
    const history = await adapter.history(result.handle);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      kind: "commit",
      revisionBefore: 0,
      revisionAfter: 1,
      forwardPatch: [{ op: "setNodeProps", id: "title" }],
    });
    expect(calls.map((call) => call.name)).toEqual([
      "motionforge.workflow.load",
      "motionforge.workflow.read",
      "motionforge.workflow.commands",
      "motionforge.workflow.check",
    ]);
    expect(calls[0]?.input).toHaveProperty("scene");
    expect(calls.slice(1).every((call) => !("scene" in call.input))).toBe(true);
    expect(
      calls.some((call) => call.name === "motionforge.workflow.evidence"),
    ).toBe(false);

    await adapter.dispose();
    await adapter.dispose();
    await expect(adapter.snapshot()).rejects.toMatchObject({
      code: "adapter_disposed",
    });
    const stillUsable = await registry.call("motionforge.workflow.load", {
      scene: sceneWithTitle("Registry still alive"),
    });
    expect(stillUsable).toMatchObject({ ok: true, revision: 0 });
    await registry.dispose();
  });

  it("finds and edits a target hidden beyond the 100-node flat inspection", async () => {
    const adapter = createIterativeWorkflowAdapter({
      registryOptions: { sessionOptions: { sessionId: "ChatHiddenTarget" } },
      readLimit: 100,
    });
    const calls = spyRegistry(adapter.registry);
    let turns = 0;
    const result = await runIterativeAgent(
      { instruction: "Rename hidden-target", scene: largeScene() },
      {
        tools: adapter,
        decide(context) {
          turns += 1;
          if (turns === 1) {
            expect(context.inspection).toMatchObject({
              truncated: true,
              nodes: expect.not.arrayContaining([
                expect.objectContaining({ id: "hidden-target" }),
              ]),
            });
            return {
              kind: "observe",
              observation: {
                kind: "search",
                query: "hidden-target",
                types: ["text"],
                limit: 5,
              },
            };
          }
          expect(context.observation).toMatchObject({
            result: {
              total: 1,
              matches: [expect.objectContaining({ id: "hidden-target" })],
            },
          });
          return {
            kind: "command",
            commands: [
              {
                kind: "text.set",
                id: "hidden-target",
                text: "Found and edited",
              },
            ],
          };
        },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      stats: { observations: 1, turns: 2 },
    });
    expect(
      (await adapter.snapshot()).scene.nodes.find(
        (node) => node.id === "hidden-target",
      )?.text,
    ).toBe("Found and edited");
    expect(calls.map((call) => call.name)).toEqual([
      "motionforge.workflow.load",
      "motionforge.workflow.read",
      "motionforge.workflow.search",
      "motionforge.workflow.commands",
      "motionforge.workflow.check",
    ]);
    expect(calls.slice(1).every((call) => !("scene" in call.input))).toBe(true);
    await adapter.dispose();
  });

  it("uses real evidence envelopes for a multi-step render repair", async () => {
    const evidenceRequests: WorkflowEvidenceRequest[] = [];
    const disposedHandles: string[] = [];
    let disposedSessions = 0;
    const adapter = createIterativeWorkflowAdapter({
      registryOptions: {
        sessionOptions: {
          sessionId: "ChatRepair",
          evidence: {
            run(request) {
              evidenceRequests.push(request);
              const color = titleColor(request.scene);
              return color === "#ff0000"
                ? {
                    ok: false,
                    diagnostics: ["red title fails visual evidence"],
                    frames: [0],
                  }
                : { ok: true, diagnostics: [], frames: [0], pass: true };
            },
            disposeHandle({ handle }) {
              disposedHandles.push(handle);
            },
            dispose() {
              disposedSessions += 1;
            },
          },
        },
      },
    });
    const contexts: IterativeAgentTurnContext[] = [];
    const result = await runIterativeAgent(
      { instruction: "Use an evidence-safe title color", scene: baseScene() },
      {
        tools: adapter,
        decide(context) {
          contexts.push(context);
          return context.mode === "repair"
            ? {
                kind: "command",
                commands: [
                  {
                    kind: "style.set",
                    id: "title",
                    style: { color: "#00ff00" },
                  },
                ],
                summary: "Repaired the visual evidence.",
              }
            : {
                kind: "command",
                commands: [
                  {
                    kind: "style.set",
                    id: "title",
                    style: { color: "#ff0000" },
                  },
                ],
              };
        },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      revision: 2,
      summary: "Repaired the visual evidence.",
      evidence: { ok: true, pass: true },
      stats: { repairs: 1, commandTransactions: 2 },
    });
    expect(contexts[1]).toMatchObject({
      mode: "repair",
      previousFailure: {
        stage: "render",
        diagnostics: ["red title fails visual evidence"],
      },
    });
    expect(evidenceRequests).toHaveLength(2);
    expect(evidenceRequests[0]).toMatchObject({
      operation: "proof.comparison.render",
      revision: 1,
      history: { kind: "commit", revisionAfter: 1 },
    });
    const snapshot = await adapter.snapshot();
    expect(titleColor(snapshot.scene)).toBe("#00ff00");
    expect(await adapter.history()).toHaveLength(2);

    const finalHandle = adapter.currentHandle!;
    await adapter.dispose();
    expect(disposedHandles).toEqual([finalHandle]);
    expect(disposedSessions).toBe(1);
  });

  it("maps default render calls to the strict real workflow-evidence operation", async () => {
    const renderer: EvidenceArtifactRenderer = {
      async render(request) {
        return {
          mimeType: "image/png",
          width: 2,
          height: 2,
          bytes: new Uint8Array([request.id.length, 1, 2]),
        };
      },
    };
    const sink: EvidenceArtifactSink = {
      async begin() {
        const writer: EvidenceArtifactSinkWriter = {
          async write(request, artifact) {
            return {
              id: request.id,
              kind: request.kind,
              uri: `memory://${request.id}`,
              mimeType: artifact.mimeType,
              byteLength: artifact.bytes.byteLength,
              width: artifact.width,
              height: artifact.height,
            };
          },
          async commit() {},
          async abort() {},
        };
        return writer;
      },
    };
    const adapter = createIterativeWorkflowAdapter({
      registryOptions: {
        sessionOptions: {
          sessionId: "ChatRealEvidence",
          evidence: createWorkflowEvidenceAdapter({ renderer, sink }),
        },
      },
    });
    const calls = spyRegistry(adapter.registry);
    const result = await runIterativeAgent(
      { instruction: "Move the title", scene: baseScene() },
      {
        tools: adapter,
        decide: () => ({
          kind: "command",
          commands: [{ kind: "placement.set", id: "title", left: 12, top: 24 }],
        }),
      },
    );

    expect(result).toMatchObject({
      ok: true,
      evidence: {
        ok: true,
        kind: "motionforge.workflow-proof-render",
        artifacts: {
          artifacts: expect.arrayContaining([
            expect.objectContaining({
              uri: expect.stringMatching(/^memory:\/\//),
            }),
          ]),
        },
      },
    });
    expect(
      calls.find((call) => call.name === "motionforge.workflow.evidence")
        ?.input,
    ).toEqual({
      handle: adapter.currentHandle,
      expectedRevision: 1,
      operation: "proof.comparison.render",
      params: { title: "edit-proof", includeVisualDiff: true },
    });
    await adapter.dispose();
  });

  it("resyncs the latest UI Scene, closes the old handle, and never resends Scene later", async () => {
    const registry = createAgentWorkflowToolRegistry({
      sessionOptions: { sessionId: "ChatResync" },
    });
    const calls = spyRegistry(registry);
    const adapter = createIterativeWorkflowAdapter({ registry });
    const original = baseScene();
    const manual = sceneWithTitle("Manual UI title");
    let reads = 0;
    let decisions = 0;
    const result = await runIterativeAgent(
      { instruction: "Sync and rename", scene: original, uiRevision: 0 },
      {
        tools: adapter,
        readUiSnapshot() {
          reads += 1;
          return reads === 1
            ? { revision: 0, scene: original }
            : { revision: 1, scene: manual };
        },
        decide({ inspection }) {
          decisions += 1;
          const nodes = (
            inspection as { nodes: Array<{ id: string; text?: string }> }
          ).nodes;
          const current = nodes.find((node) => node.id === "title")?.text;
          return {
            kind: "command",
            commands: [
              {
                kind: "text.set",
                id: "title",
                text:
                  decisions === 1
                    ? "Discard me"
                    : `Agent saw ${String(current)}`,
              },
            ],
          };
        },
      },
    );

    expect(result).toMatchObject({ ok: true, stats: { resyncs: 1, turns: 2 } });
    expect(title((await adapter.snapshot()).scene)).toBe(
      "Agent saw Manual UI title",
    );
    const loads = calls.filter(
      (call) => call.name === "motionforge.workflow.load",
    );
    const closes = calls.filter(
      (call) => call.name === "motionforge.workflow.close",
    );
    expect(loads).toHaveLength(2);
    expect(closes).toHaveLength(1);
    const oldHandle = loads[0]?.result?.handle;
    const newHandle = loads[1]?.result?.handle;
    expect(closes[0]?.input).toMatchObject({ handle: oldHandle });
    expect(adapter.currentHandle).toBe(newHandle);
    await expect(
      registry.hostSnapshot(String(oldHandle)),
    ).rejects.toMatchObject({
      code: "unknown_handle",
    });
    await expect(
      registry.hostSnapshot(String(newHandle)),
    ).resolves.toMatchObject({
      handle: newHandle,
    });
    expect(
      calls
        .filter((call) => call.name !== "motionforge.workflow.load")
        .every((call) => !("scene" in call.input)),
    ).toBe(true);
    await adapter.dispose();
    await registry.dispose();
  });

  it("keeps a newly loaded resync handle when old-handle cleanup reports failure", async () => {
    let cleanupCalls = 0;
    const adapter = createIterativeWorkflowAdapter({
      registryOptions: {
        sessionOptions: {
          sessionId: "ChatCleanup",
          evidence: {
            run: () => ({ ok: true }),
            disposeHandle() {
              cleanupCalls += 1;
              throw new Error("cleanup unavailable");
            },
          },
        },
      },
    });
    const first = (await adapter.call(defaultIterativeAgentToolNames.load, {
      mode: "load",
      scene: baseScene(),
    })) as { handle: string; revision: number };
    const replacement = (await adapter.call(
      defaultIterativeAgentToolNames.load,
      {
        mode: "resync",
        scene: sceneWithTitle("Replacement"),
        previousHandle: first.handle,
        previousRevision: first.revision,
      },
    )) as {
      handle: string;
      revision: number;
      cleanupWarning: { code: string; handle: string };
    };

    expect(replacement.handle).not.toBe(first.handle);
    expect(replacement.cleanupWarning).toEqual({
      code: "cleanup_failed",
      handle: first.handle,
      message: expect.stringContaining("cleanup unavailable"),
    });
    expect(title((await adapter.snapshot(replacement.handle)).scene)).toBe(
      "Replacement",
    );
    await expect(
      adapter.registry.hostSnapshot(first.handle),
    ).rejects.toMatchObject({ code: "unknown_handle" });
    expect(cleanupCalls).toBe(1);
    await expect(adapter.dispose()).rejects.toMatchObject({
      code: "cleanup_failed",
    });
  });

  it("turns workflow failure envelopes into stable throwable tool errors", async () => {
    const adapter = createIterativeWorkflowAdapter({
      registryOptions: { sessionOptions: { sessionId: "ChatErrors" } },
    });
    const loaded = (await adapter.call(defaultIterativeAgentToolNames.load, {
      mode: "load",
      scene: baseScene(),
    })) as { handle: string; revision: number };

    await expect(
      adapter.call(defaultIterativeAgentToolNames.command, {
        handle: loaded.handle,
        expectedRevision: loaded.revision,
        commands: [{ kind: "text.set", id: "missing", text: "No" }],
      }),
    ).rejects.toMatchObject({
      name: "IterativeWorkflowToolError",
      code: "command_failed",
      retryable: false,
      staleRevision: false,
    });
    await expect(
      adapter.call(defaultIterativeAgentToolNames.command, {
        handle: loaded.handle,
        expectedRevision: 99,
        commands: [{ kind: "text.set", id: "title", text: "Stale" }],
      }),
    ).rejects.toMatchObject({
      code: "stale_revision",
      retryable: false,
      staleRevision: true,
    });
    await adapter.dispose();
  });
});

function spyRegistry(registry: AgentWorkflowToolRegistry): RegistryCall[] {
  const calls: RegistryCall[] = [];
  const original = registry.call.bind(registry);
  registry.call = async (name: string, input: unknown) => {
    const call: RegistryCall = {
      name,
      input: structuredClone(input as Record<string, unknown>),
    };
    calls.push(call);
    call.result = await original(name, input);
    return call.result;
  };
  return calls;
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
        style: { width: 240, height: 80, fontSize: 48, color: "#ffffff" },
      },
    ],
  });
}

function sceneWithTitle(value: string): Scene {
  const scene = baseScene();
  scene.nodes[1]!.text = value;
  return parseScene(scene);
}

function largeScene(): Scene {
  return parseScene({
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 30,
    assets: {},
    nodes: [
      ...Array.from({ length: 120 }, (_, index) => ({
        id: `node-${String(index).padStart(3, "0")}`,
        type: "text" as const,
        text: `Visible ${index}`,
        style: { fontSize: 12 },
      })),
      {
        id: "hidden-target",
        type: "text" as const,
        text: "Hidden target",
        style: { fontSize: 12 },
      },
    ],
  });
}

function title(scene: Scene): string | undefined {
  return scene.nodes.find((node) => node.id === "title")?.text;
}

function titleColor(scene: Scene): string | undefined {
  return scene.nodes.find((node) => node.id === "title")?.style?.color;
}
