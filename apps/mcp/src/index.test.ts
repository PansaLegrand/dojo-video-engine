import { describe, expect, it } from "vitest";
import {
  createAgentWorkflowToolRegistry,
  workflowEvidenceOperationManifests,
  workflowToolDescriptors,
} from "@motionforge/agent-tools";
import { createMotionforgeMcpAdapter } from "./index.js";

const scene = {
  schemaVersion: 1,
  width: 320,
  height: 180,
  fps: 30,
  duration: 30,
  assets: {},
  nodes: [{ id: "title", type: "text", text: "MCP" }],
};

describe("MotionForge MCP JSON-RPC adapter", () => {
  it("lists the exact workflow descriptors and calls them without schema drift", async () => {
    const adapter = createMotionforgeMcpAdapter({
      registryOptions: { sessionOptions: { sessionId: "McpList" } },
    });
    const listed = await adapter.handle({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    expect((listed as any).result.tools.slice(0, -1)).toEqual(
      workflowToolDescriptors().map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    );
    expect((listed as any).result.tools.at(-1)).toMatchObject({
      name: "motionforge.workflow.evidence-manifests",
      outputSchema: expect.any(Object),
    });

    const manifests = await adapter.handle({
      jsonrpc: "2.0",
      id: "manifests",
      method: "tools/call",
      params: {
        name: "motionforge.workflow.evidence-manifests",
        arguments: {},
      },
    });
    expect((manifests as any).result.structuredContent).toEqual({
      ok: true,
      manifests: workflowEvidenceOperationManifests(),
    });

    const loaded = await adapter.handle({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "motionforge.workflow.load",
        arguments: { scene },
      },
    });
    expect(loaded).toMatchObject({
      result: {
        isError: false,
        structuredContent: {
          ok: true,
          handle: expect.any(String),
          revision: 0,
        },
      },
    });
    expect(() =>
      JSON.parse((loaded as any).result.content[0].text),
    ).not.toThrow();
    await adapter.dispose();
  });

  it("preserves workflow failures as tool errors and JSON-RPC protocol errors", async () => {
    const adapter = createMotionforgeMcpAdapter();
    const failed = await adapter.handle({
      jsonrpc: "2.0",
      id: "bad-tool",
      method: "tools/call",
      params: {
        name: "motionforge.workflow.read",
        arguments: { handle: "missing", view: "summary" },
      },
    });
    expect(failed).toMatchObject({
      result: {
        isError: true,
        structuredContent: { ok: false, error: { code: "unknown_handle" } },
      },
    });
    expect(
      await adapter.handle({ jsonrpc: "2.0", id: 3, method: "missing" }),
    ).toMatchObject({ error: { code: -32601 } });
    expect(await adapter.handle({ nope: true })).toMatchObject({
      error: { code: -32600 },
    });
    await adapter.dispose();
  });

  it("negotiates initialize, ignores notifications, and disposes owned sessions", async () => {
    const registry = createAgentWorkflowToolRegistry({
      sessionOptions: { sessionId: "McpCleanup" },
    });
    const adapter = createMotionforgeMcpAdapter({
      registry,
      disposeRegistry: true,
    });
    expect(
      await adapter.handle({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05" },
      }),
    ).toMatchObject({
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
      },
    });
    expect(
      await adapter.handle({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    ).toBeNull();
    expect(
      await adapter.handle({ jsonrpc: "2.0", id: 2, method: "shutdown" }),
    ).toMatchObject({ result: {} });
    const disposed = await registry.call("motionforge.workflow.load", {
      scene,
    });
    expect(disposed).toMatchObject({
      ok: false,
      error: { code: "session_disposed" },
    });
    await adapter.dispose();
  });
});
