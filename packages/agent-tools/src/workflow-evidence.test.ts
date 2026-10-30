import { describe, expect, it } from "vitest";
import type { Scene } from "@dojo-video-engine/schema";
import {
  createAgentWorkflowToolRegistry,
  workflowResultSchema,
  type WorkflowJsonValue,
  type WorkflowResult,
} from "./workflow.js";
import {
  createWorkflowEvidenceAdapter,
  workflowEvidenceOperationManifests,
  type WorkflowEvidenceController,
} from "./workflow-evidence.js";
import { createMemoryEvidenceArtifactStore } from "./browser-evidence.js";
import type {
  EvidenceArtifactRef,
  EvidenceArtifactRenderer,
  EvidenceArtifactSink,
  EvidenceArtifactSinkWriter,
} from "./evidence.js";

function sourceScene(): Scene {
  return {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 60,
    assets: {},
    nodes: [
      {
        id: "title",
        type: "text",
        text: "Original",
        from: 10,
        duration: 20,
        style: { width: 200, height: 40 },
      },
    ],
  };
}

type Success = Extract<WorkflowResult, { ok: true }>;

function success(result: WorkflowResult): Success {
  expect(workflowResultSchema.safeParse(result).success).toBe(true);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function dataRecord(value: WorkflowJsonValue | undefined) {
  expect(value).toBeTypeOf("object");
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, any>;
}

async function loadedEditedRegistry(adapter: WorkflowEvidenceController) {
  const registry = createAgentWorkflowToolRegistry({
    sessionOptions: { sessionId: "EvidenceFlow", evidence: adapter },
  });
  const loaded = success(
    await registry.call("dojo-video-engine.workflow.load", { scene: sourceScene() }),
  );
  const handle = loaded.handle!;
  const applied = success(
    await registry.call("dojo-video-engine.workflow.commands", {
      handle,
      expectedRevision: 0,
      commands: [{ kind: "text.set", id: "title", text: "Edited" }],
    }),
  );
  expect(applied.revision).toBe(1);
  return { registry, handle };
}

function memoryPorts(
  options: { failRender?: boolean; wait?: Promise<never> } = {},
) {
  const state = {
    writes: [] as string[],
    aborts: 0,
    commits: 0,
    beforeText: "",
    afterText: "",
  };
  const renderer: EvidenceArtifactRenderer = {
    async render(request, context) {
      state.beforeText = context.before.nodes[0]?.text ?? "";
      state.afterText = context.after.nodes[0]?.text ?? "";
      if (options.failRender) throw new Error("renderer failed");
      if (options.wait) return options.wait;
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
          state.writes.push(request.id);
          const ref: EvidenceArtifactRef = {
            id: request.id,
            kind: request.kind,
            uri: `memory://${request.id}`,
            mimeType: artifact.mimeType,
            byteLength: artifact.bytes.byteLength,
            width: artifact.width,
            height: artifact.height,
          };
          return ref;
        },
        async commit() {
          state.commits += 1;
        },
        async abort() {
          state.aborts += 1;
        },
      };
      return writer;
    },
  };
  return { renderer, sink, state };
}

function evidenceResult(result: Success): Record<string, any> {
  return dataRecord(dataRecord(result.data).result as WorkflowJsonValue);
}

function containsSceneObject(value: unknown): boolean {
  const pending = [value];
  while (pending.length > 0) {
    const next = pending.pop();
    if (!next || typeof next !== "object") continue;
    if (
      !Array.isArray(next) &&
      Object.hasOwn(next, "schemaVersion") &&
      Object.hasOwn(next, "nodes")
    ) {
      return true;
    }
    pending.push(...Object.values(next));
  }
  return false;
}

describe("workflow evidence adapter integration", () => {
  it("publishes strict discoverable manifests for every stable operation", () => {
    const manifests = workflowEvidenceOperationManifests();
    expect(manifests.map(({ operation }) => operation)).toEqual([
      "proof.frames",
      "proof.comparison.plan",
      "proof.comparison.render",
    ]);
    expect(
      manifests.every(
        ({ paramsSchema }) =>
          paramsSchema.$schema === "http://json-schema.org/draft-07/schema#" &&
          paramsSchema.additionalProperties === false,
      ),
    ).toBe(true);
    (manifests[0]!.paramsSchema as Record<string, unknown>).title = "mutated";
    expect(
      workflowEvidenceOperationManifests()[0]?.paramsSchema,
    ).not.toHaveProperty("title", "mutated");
  });

  it("drives load → commands → proof frames with automatic history reasons", async () => {
    const adapter = createWorkflowEvidenceAdapter();
    const { registry, handle } = await loadedEditedRegistry(adapter);
    const proof = success(
      await registry.call("dojo-video-engine.workflow.evidence", {
        handle,
        expectedRevision: 1,
        operation: "proof.frames",
        params: { explicitFrames: [3] },
      }),
    );
    const result = evidenceResult(proof);
    expect(result).toMatchObject({
      ok: true,
      kind: "dojo-video-engine.proof-frame-selection",
    });
    expect(
      result.frames.some((frame: any) =>
        frame.reasons.some(
          (reason: any) =>
            reason.code === "scene-change" && reason.sourceId === "title",
        ),
      ),
    ).toBe(true);
    expect(result.frames.find((frame: any) => frame.frame === 3).rank).toBe(1);
    expect(containsSceneObject(result)).toBe(false);
  });

  it("plans and renders portable comparison refs through injected ports", async () => {
    const ports = memoryPorts();
    const adapter = createWorkflowEvidenceAdapter(ports);
    const { registry, handle } = await loadedEditedRegistry(adapter);
    const planned = success(
      await registry.call("dojo-video-engine.workflow.evidence", {
        handle,
        expectedRevision: 1,
        operation: "proof.comparison.plan",
        params: { explicitFrames: [3], title: "Proof" },
      }),
    );
    const planResult = evidenceResult(planned);
    expect(planResult).toMatchObject({
      ok: true,
      kind: "dojo-video-engine.workflow-proof-comparison",
      plan: { title: "Proof", artifacts: expect.any(Array) },
    });
    expect(containsSceneObject(planResult)).toBe(false);

    const rendered = success(
      await registry.call("dojo-video-engine.workflow.evidence", {
        handle,
        expectedRevision: 1,
        operation: "proof.comparison.render",
        params: { explicitFrames: [3] },
      }),
    );
    const renderResult = evidenceResult(rendered);
    expect(renderResult).toMatchObject({
      ok: true,
      kind: "dojo-video-engine.workflow-proof-render",
      artifacts: {
        kind: "dojo-video-engine.evidence-artifacts",
        artifacts: expect.arrayContaining([
          expect.objectContaining({
            uri: expect.stringMatching(/^memory:\/\//),
          }),
        ]),
      },
    });
    expect(ports.state).toMatchObject({
      commits: 1,
      aborts: 0,
      beforeText: "Original",
      afterText: "Edited",
    });
    expect(containsSceneObject(renderResult)).toBe(false);
    expect(JSON.parse(JSON.stringify(renderResult))).toEqual(renderResult);
  });

  it("requires ports only for render and maps strict/failing operations", async () => {
    const noPorts = createWorkflowEvidenceAdapter();
    const { registry, handle } = await loadedEditedRegistry(noPorts);
    const frames = success(
      await registry.call("dojo-video-engine.workflow.evidence", {
        handle,
        expectedRevision: 1,
        operation: "proof.frames",
      }),
    );
    expect(evidenceResult(frames)).toMatchObject({ ok: true });

    for (const [operation, params] of [
      ["proof.comparison.render", {}],
      ["proof.frames", { surprise: true }],
      ["proof.unknown", {}],
    ] as const) {
      const output = success(
        await registry.call("dojo-video-engine.workflow.evidence", {
          handle,
          expectedRevision: 1,
          operation,
          params,
        }),
      );
      expect(evidenceResult(output)).toMatchObject({
        ok: false,
        kind: "dojo-video-engine.evidence.failure",
        errors: [{ code: "invalid_request" }],
      });
    }

    const failingPorts = memoryPorts({ failRender: true });
    const failingAdapter = createWorkflowEvidenceAdapter(failingPorts);
    const failing = await loadedEditedRegistry(failingAdapter);
    const output = success(
      await failing.registry.call("dojo-video-engine.workflow.evidence", {
        handle: failing.handle,
        expectedRevision: 1,
        operation: "proof.comparison.render",
      }),
    );
    expect(evidenceResult(output)).toMatchObject({
      ok: false,
      errors: [{ code: "artifact_render_failed" }],
    });
    expect(failingPorts.state.aborts).toBe(1);
  });

  it("cancels active render work and runs handle/session cleanup callbacks", async () => {
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const never = new Promise<never>(() => undefined);
    const ports = memoryPorts({ wait: never });
    const renderer: EvidenceArtifactRenderer = {
      async render(request, context) {
        started();
        return ports.renderer.render(request, context);
      },
    };
    const cleanup: string[] = [];
    const adapter = createWorkflowEvidenceAdapter({
      renderer,
      sink: ports.sink,
      onDisposeHandle({ handle }) {
        cleanup.push(`handle:${handle}`);
      },
      onDisposeSession({ sessionId }) {
        cleanup.push(`session:${sessionId}`);
      },
    });
    const { registry, handle } = await loadedEditedRegistry(adapter);
    const renderPromise = registry.call("dojo-video-engine.workflow.evidence", {
      handle,
      expectedRevision: 1,
      operation: "proof.comparison.render",
    });
    await startedPromise;
    adapter.cancelHandle({ sessionId: "EvidenceFlow", handle });
    const cancelled = success(await renderPromise);
    expect(evidenceResult(cancelled)).toMatchObject({
      ok: false,
      errors: [{ code: "aborted" }],
    });
    expect(ports.state.aborts).toBe(1);

    const closed = success(
      await registry.call("dojo-video-engine.workflow.close", {
        handle,
        expectedRevision: 1,
      }),
    );
    expect(closed.data).toMatchObject({ closed: true });
    success(await registry.dispose());
    expect(cleanup).toEqual([`handle:${handle}`, "session:EvidenceFlow"]);
  });

  it("lets the workflow surface cleanup callback failures without retaining handles", async () => {
    const adapter = createWorkflowEvidenceAdapter({
      onDisposeHandle() {
        throw new Error("cleanup failed");
      },
    });
    const { registry, handle } = await loadedEditedRegistry(adapter);
    const closed = await registry.call("dojo-video-engine.workflow.close", {
      handle,
      expectedRevision: 1,
    });
    expect(closed).toMatchObject({
      ok: false,
      error: { code: "cleanup_failed" },
    });
    const read = await registry.call("dojo-video-engine.workflow.read", {
      handle,
      view: "summary",
    });
    expect(read).toMatchObject({
      ok: false,
      error: { code: "unknown_handle" },
    });
  });

  it("scopes one memory store across two handles and cleans only the closed handle", async () => {
    const store = createMemoryEvidenceArtifactStore({ storeId: "workflow" });
    const ports = memoryPorts();
    const adapter = createWorkflowEvidenceAdapter({
      renderer: ports.renderer,
      sinkForRequest: (request) => store.sinkForRequest(request),
      ...store.workflowCleanup,
    });
    const registry = createAgentWorkflowToolRegistry({
      sessionOptions: { sessionId: "MultiEvidence", evidence: adapter },
    });
    const first = success(
      await registry.call("dojo-video-engine.workflow.load", {
        scene: sourceScene(),
      }),
    ).handle!;
    const second = success(
      await registry.call("dojo-video-engine.workflow.load", {
        scene: sourceScene(),
      }),
    ).handle!;
    for (const handle of [first, second]) {
      success(
        await registry.call("dojo-video-engine.workflow.evidence", {
          handle,
          expectedRevision: 0,
          operation: "proof.comparison.render",
          params: { explicitFrames: [0] },
        }),
      );
    }
    expect(
      store.list({ sessionId: "MultiEvidence", handle: first }).length,
    ).toBeGreaterThan(0);
    expect(
      store.list({ sessionId: "MultiEvidence", handle: second }).length,
    ).toBeGreaterThan(0);
    success(
      await registry.call("dojo-video-engine.workflow.close", {
        handle: first,
        expectedRevision: 0,
      }),
    );
    expect(
      store.list({ sessionId: "MultiEvidence", handle: first }),
    ).toHaveLength(0);
    expect(
      store.list({ sessionId: "MultiEvidence", handle: second }).length,
    ).toBeGreaterThan(0);
    success(await registry.dispose());
    expect(store.stats().entries).toBe(0);
  });
});
