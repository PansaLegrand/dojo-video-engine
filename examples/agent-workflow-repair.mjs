import {
  createAgentWorkflowToolRegistry,
  createMemoryEvidenceArtifactStore,
  createWorkflowEvidenceAdapter,
} from "@motionforge/agent-tools";

export async function runRepairEvidenceExample() {
  const store = createMemoryEvidenceArtifactStore({
    storeId: "repair-example",
  });
  const evidence = createWorkflowEvidenceAdapter({
    renderer: {
      async render(request) {
        return {
          mimeType: "image/png",
          width: 1,
          height: 1,
          bytes: new Uint8Array([request.id.length % 255, 1, 2, 255]),
        };
      },
    },
    sinkForRequest: (request) => store.sinkForRequest(request),
    ...store.workflowCleanup,
  });
  const registry = createAgentWorkflowToolRegistry({
    sessionOptions: { sessionId: "RepairExample", evidence },
  });
  try {
    const loaded = await registry.call("motionforge.workflow.load", {
      scene: {
        schemaVersion: 1,
        width: 320,
        height: 180,
        fps: 30,
        duration: 30,
        assets: {},
        nodes: [{ id: "title", type: "text", text: "Before" }],
      },
    });
    if (!loaded.ok || !loaded.handle) throw new Error("load failed");
    const handle = loaded.handle;

    const failedCommand = await registry.call("motionforge.workflow.commands", {
      handle,
      expectedRevision: 0,
      commands: [{ kind: "text.set", id: "missing", text: "Invalid" }],
    });
    const repaired = await registry.call("motionforge.workflow.commands", {
      handle,
      expectedRevision: 0,
      commands: [{ kind: "text.set", id: "title", text: "After repair" }],
    });
    if (!repaired.ok) throw new Error(repaired.error.message);

    const failedCheck = await registry.call("motionforge.workflow.check", {
      handle,
      expectedRevision: 1,
      frames: [30],
    });
    const checked = await registry.call("motionforge.workflow.check", {
      handle,
      expectedRevision: 1,
      frames: [0],
    });
    const proof = await registry.call("motionforge.workflow.evidence", {
      handle,
      expectedRevision: 1,
      operation: "proof.comparison.render",
      params: { title: "Repair proof", includeVisualDiff: true },
    });
    if (!proof.ok) throw new Error(proof.error.message);
    const result = proof.data?.result;
    return {
      failedCommand,
      failedCheck,
      checked,
      proof: result,
      refs: result?.ok ? result.artifacts.artifacts : [],
      snapshot: await registry.hostSnapshot(handle),
    };
  } finally {
    await registry.dispose();
    await store.dispose();
  }
}
