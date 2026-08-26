import { describe, expect, it } from "vitest";
import { Ajv } from "ajv";
import {
  createAgentWorkflowToolRegistry,
  createAgentWorkflowSession,
  workflowActionInputSchema,
  workflowCheckInputSchema,
  workflowEvidenceInputSchema,
  workflowReadInputSchema,
  workflowRequestJsonSchema,
  workflowRequestSchema,
  workflowResultJsonSchema,
  workflowResultSchema,
  workflowSearchInputSchema,
  workflowToolDescriptors,
  type WorkflowEvidenceAdapter,
  type WorkflowJsonValue,
  type WorkflowResult,
} from "./workflow.js";

const scene = {
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
      text: "Original title",
      style: { width: 200, height: 40, direction: "ltr" },
    },
    { id: "card", type: "div", style: { width: 100, height: 80 } },
  ],
};

type SuccessResult = Extract<WorkflowResult, { ok: true }>;
type FailureResult = Extract<WorkflowResult, { ok: false }>;

function success(result: WorkflowResult): SuccessResult {
  expect(workflowResultSchema.safeParse(result).success).toBe(true);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function failure(result: WorkflowResult, code?: string): FailureResult {
  expect(workflowResultSchema.safeParse(result).success).toBe(true);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected failure");
  if (code) expect(result.error.code).toBe(code);
  return result;
}

function record(value: WorkflowJsonValue | undefined): Record<string, any> {
  expect(value).toBeTypeOf("object");
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, any>;
}

describe("MF8 workflow schemas", () => {
  it("publishes strict per-tool descriptors and isolates recursive input to load", () => {
    expect(
      workflowRequestSchema.safeParse({ action: "workspace.load", scene })
        .success,
    ).toBe(true);
    expect(
      workflowActionInputSchema.safeParse({
        action: "workspace.read",
        handle: "session:w1",
        scene,
      }).success,
    ).toBe(false);
    expect(
      workflowActionInputSchema.safeParse({
        action: "commands.apply",
        handle: "session:w1",
        expectedRevision: 0,
        commands: [
          {
            kind: "node.add",
            node: {
              id: "nested",
              type: "div",
              children: [{ id: "forbidden", type: "div" }],
            },
          },
        ],
      }).success,
    ).toBe(false);

    const descriptors = workflowToolDescriptors();
    expect(descriptors).toHaveLength(11);
    expect(descriptors.map(({ name }) => name)).toEqual([
      "motionforge.workflow.load",
      "motionforge.workflow.read",
      "motionforge.workflow.search",
      "motionforge.workflow.check",
      "motionforge.workflow.commands",
      "motionforge.workflow.undo",
      "motionforge.workflow.redo",
      "motionforge.workflow.evidence",
      "motionforge.workflow.close",
      "motionforge.workflow.events",
      "motionforge.workflow.dispose",
    ]);
    expect(descriptors[0]).toMatchObject({
      inputSchema: { $ref: expect.any(String) },
      outputSchema: { $ref: expect.any(String) },
    });
    (descriptors[0]!.inputSchema as Record<string, unknown>).title = "mutated";
    expect(workflowToolDescriptors()[0]?.inputSchema).not.toHaveProperty(
      "title",
      "mutated",
    );
    expect(workflowRequestJsonSchema()).toHaveProperty("definitions");
    expect(workflowResultJsonSchema()).toHaveProperty("definitions");

    const ajv = new Ajv({ strict: false, allErrors: true });
    const loadDescriptor = descriptors[0]!;
    const readDescriptor = descriptors[1]!;
    const validateLoad = ajv.compile(loadDescriptor.inputSchema);
    const validateRead = ajv.compile(readDescriptor.inputSchema);
    expect(validateLoad({ scene })).toBe(true);
    expect(validateLoad({ action: "workspace.load", scene })).toBe(false);
    expect(validateLoad({ scene, unexpected: true })).toBe(false);
    expect(validateRead({ handle: "SchemaSession:w1", view: "summary" })).toBe(
      true,
    );
    expect(validateRead({ view: "summary" })).toBe(false);
    expect(
      validateRead({
        handle: "SchemaSession:w1",
        view: "summary",
        unexpected: true,
      }),
    ).toBe(false);
    const searchDescriptor = descriptors.find(
      ({ name }) => name === "motionforge.workflow.search",
    )!;
    const checkDescriptor = descriptors.find(
      ({ name }) => name === "motionforge.workflow.check",
    )!;
    const evidenceDescriptor = descriptors.find(
      ({ name }) => name === "motionforge.workflow.evidence",
    )!;
    const parity: Array<{
      name: string;
      zod: boolean;
      ajv: boolean;
      expected: boolean;
    }> = [
      {
        name: "node read needs id",
        zod: workflowReadInputSchema.safeParse({
          action: "workspace.read",
          handle: "SchemaSession:w1",
          view: "node",
        }).success,
        ajv: validateRead({ handle: "SchemaSession:w1", view: "node" }),
        expected: false,
      },
      {
        name: "summary read rejects id",
        zod: workflowReadInputSchema.safeParse({
          action: "workspace.read",
          handle: "SchemaSession:w1",
          view: "summary",
          id: "title",
        }).success,
        ajv: validateRead({
          handle: "SchemaSession:w1",
          view: "summary",
          id: "title",
        }),
        expected: false,
      },
      {
        name: "search needs query or types",
        zod: workflowSearchInputSchema.safeParse({
          action: "workspace.search",
          handle: "SchemaSession:w1",
        }).success,
        ajv: ajv.compile(searchDescriptor.inputSchema)({
          handle: "SchemaSession:w1",
        }),
        expected: false,
      },
      {
        name: "search rejects whitespace query",
        zod: workflowSearchInputSchema.safeParse({
          action: "workspace.search",
          handle: "SchemaSession:w1",
          query: "   ",
        }).success,
        ajv: ajv.compile(searchDescriptor.inputSchema)({
          handle: "SchemaSession:w1",
          query: "   ",
        }),
        expected: false,
      },
      {
        name: "check chooses frames or sample count",
        zod: workflowCheckInputSchema.safeParse({
          action: "workspace.check",
          handle: "SchemaSession:w1",
          frames: [0],
          sampleCount: 1,
        }).success,
        ajv: ajv.compile(checkDescriptor.inputSchema)({
          handle: "SchemaSession:w1",
          frames: [0],
          sampleCount: 1,
        }),
        expected: false,
      },
      {
        name: "bounded evidence properties",
        zod: workflowEvidenceInputSchema.safeParse({
          action: "evidence.run",
          handle: "SchemaSession:w1",
          expectedRevision: 0,
          operation: "proof.test",
          params: Object.fromEntries(
            Array.from({ length: 129 }, (_, index) => [`key${index}`, index]),
          ),
        }).success,
        ajv: ajv.compile(evidenceDescriptor.inputSchema)({
          handle: "SchemaSession:w1",
          expectedRevision: 0,
          operation: "proof.test",
          params: Object.fromEntries(
            Array.from({ length: 129 }, (_, index) => [`key${index}`, index]),
          ),
        }),
        expected: false,
      },
    ];
    for (const item of parity) {
      expect(item.zod, `${item.name} (Zod)`).toBe(item.expected);
      expect(item.ajv, `${item.name} (Ajv)`).toBe(item.expected);
    }
    const validateOutput = ajv.compile(loadDescriptor.outputSchema);
    expect(
      validateOutput({
        ok: true,
        sessionId: "SchemaSession",
        operationId: "op-1",
        action: "workspace.load",
        handle: "SchemaSession:w1",
        revision: 0,
        data: { loaded: true },
        events: [
          {
            sequence: 1,
            sessionId: "SchemaSession",
            operationId: "op-1",
            action: "workspace.load",
            phase: "start",
          },
          {
            sequence: 2,
            sessionId: "SchemaSession",
            operationId: "op-1",
            action: "workspace.load",
            phase: "complete",
          },
        ],
      }),
    ).toBe(true);
  });

  it("accepts every returned envelope through the exported strict result schema", async () => {
    const session = createAgentWorkflowSession({ sessionId: "SchemaSession" });
    const loaded = await session.execute({ action: "workspace.load", scene });
    expect(workflowResultSchema.safeParse(loaded).success).toBe(true);
    const invalid = await session.execute({ action: "unknown.action" });
    expect(workflowResultSchema.safeParse(invalid).success).toBe(true);
  });

  it("offers ergonomic name/input calls and trusted host snapshots outside tools", async () => {
    const registry = createAgentWorkflowToolRegistry({
      sessionOptions: { sessionId: "RegistrySession" },
    });
    const loaded = success(
      await registry.call("motionforge.workflow.load", { scene }),
    );
    const handle = loaded.handle!;
    const applied = success(
      await registry.call("motionforge.workflow.commands", {
        handle,
        expectedRevision: 0,
        commands: [{ kind: "text.set", id: "title", text: "Host result" }],
      }),
    );
    expect(applied.revision).toBe(1);

    const snapshot = await registry.hostSnapshot(handle);
    expect(snapshot.scene.nodes[0]).toMatchObject({
      id: "title",
      text: "Host result",
    });
    expect(snapshot.history).toHaveLength(1);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.scene)).toBe(true);
    const history = await registry.hostHistory(handle);
    expect(history[0]).toMatchObject({
      kind: "commit",
      forwardPatch: expect.any(Array),
      inversePatch: expect.any(Array),
    });
    expect(Object.isFrozen(history)).toBe(true);

    failure(
      await registry.call("motionforge.workflow.read", {
        action: "workspace.read",
        handle,
      }),
      "invalid_request",
    );
    failure(
      await registry.call("motionforge.workflow.missing", {}),
      "invalid_request",
    );
  });

  it("turns hostile Proxies/getters into bounded invalid requests", async () => {
    const session = createAgentWorkflowSession({ sessionId: "HostileSession" });
    const proxy = new Proxy(
      {},
      {
        get() {
          throw new Error("getter boom");
        },
      },
    );
    const directPromise = session.execute(proxy);
    await expect(directPromise).resolves.toBeDefined();
    failure(await directPromise, "invalid_request");

    const registry = createAgentWorkflowToolRegistry({ session });
    const hostile: Record<string, unknown> = {};
    Object.defineProperty(hostile, "scene", {
      enumerable: true,
      get() {
        throw new Error("spread boom");
      },
    });
    let call: Promise<WorkflowResult> | undefined;
    expect(() => {
      call = registry.call("motionforge.workflow.load", hostile);
    }).not.toThrow();
    failure(await call!, "invalid_request");
  });
});

describe("MF8 handle workflow", () => {
  it("loads once, reads/searches/checks, edits with revisions, and undo/redoes", async () => {
    const observed: Array<{ sequence: number; phase: string; action: string }> =
      [];
    const session = createAgentWorkflowSession({ sessionId: "FlowSession" });
    session.onEvent((event) => {
      observed.push({
        sequence: event.sequence,
        phase: event.phase,
        action: event.action,
      });
    });
    session.onEvent(() => {
      throw new Error("observer failure must be isolated");
    });

    const loaded = success(
      await session.execute({ action: "workspace.load", scene }),
    );
    const handle = loaded.handle!;
    expect(handle).toMatch(/^FlowSession:w\d+$/);
    expect(loaded.revision).toBe(0);
    expect(record(loaded.data).summary).toMatchObject({
      width: 320,
      height: 180,
      rootNodes: 2,
    });

    const summary = success(
      await session.execute({
        action: "workspace.read",
        handle,
        view: "summary",
      }),
    );
    expect(summary.revision).toBe(0);
    expect(record(summary.data)).toMatchObject({
      view: "summary",
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: "title", type: "text" }),
      ]),
    });
    expect(record(summary.data)).not.toHaveProperty("scene");

    const searched = success(
      await session.execute({
        action: "workspace.search",
        handle,
        query: "original",
      }),
    );
    expect(record(searched.data)).toMatchObject({
      total: 1,
      matches: [expect.objectContaining({ id: "title" })],
    });

    const checked = success(
      await session.execute({
        action: "workspace.check",
        handle,
        frames: [0, 30],
      }),
    );
    expect(record(checked.data)).toMatchObject({
      kind: "motionforge.check",
      version: 1,
      validation: { ok: true, errors: [] },
    });
    failure(
      await session.execute({
        action: "workspace.check",
        handle,
        frames: [60],
      }),
      "invalid_frame",
    );
    failure(
      await session.execute({
        action: "workspace.read",
        handle,
        view: "node",
        id: "missing-node",
      }),
      "unknown_node",
    );

    const applied = success(
      await session.execute({
        action: "commands.apply",
        handle,
        expectedRevision: 0,
        commands: [{ kind: "text.set", id: "title", text: "Edited" }],
      }),
    );
    expect(applied.revision).toBe(1);
    expect(record(applied.data).history).toMatchObject({
      revisionBefore: 0,
      revisionAfter: 1,
      affectedIds: ["title"],
    });

    const stale = failure(
      await session.execute({
        action: "commands.apply",
        handle,
        expectedRevision: 0,
        commands: [{ kind: "text.set", id: "title", text: "Stale" }],
      }),
      "stale_revision",
    );
    expect(stale.revision).toBe(1);

    const node = success(
      await session.execute({
        action: "workspace.read",
        handle,
        view: "node",
        id: "title",
        expectedRevision: 1,
      }),
    );
    expect(record(node.data).node).toMatchObject({ text: "Edited" });

    const undone = success(
      await session.execute({
        action: "workspace.undo",
        handle,
        expectedRevision: 1,
      }),
    );
    expect(undone.revision).toBe(2);
    const afterUndo = success(
      await session.execute({
        action: "workspace.read",
        handle,
        view: "node",
        id: "title",
      }),
    );
    expect(record(afterUndo.data).node).toMatchObject({
      text: "Original title",
    });

    const redone = success(
      await session.execute({
        action: "workspace.redo",
        handle,
        expectedRevision: 2,
      }),
    );
    expect(redone.revision).toBe(3);

    expect(observed.map(({ sequence }) => sequence)).toEqual(
      observed.map((_, index) => index + 1),
    );
    for (let index = 0; index < observed.length; index += 2) {
      expect(observed[index]?.phase).toBe("start");
      expect(["complete", "error"]).toContain(observed[index + 1]?.phase);
      expect(observed[index]?.action).toBe(observed[index + 1]?.action);
    }
  });

  it("keeps failed command batches transactional", async () => {
    const session = createAgentWorkflowSession({
      sessionId: "RollbackSession",
    });
    const loaded = success(
      await session.execute({ action: "workspace.load", scene }),
    );
    const handle = loaded.handle!;
    failure(
      await session.execute({
        action: "commands.apply",
        handle,
        expectedRevision: 0,
        commands: [
          { kind: "text.set", id: "title", text: "Should roll back" },
          { kind: "text.set", id: "missing", text: "Fails" },
        ],
      }),
      "command_failed",
    );
    const read = success(
      await session.execute({
        action: "workspace.read",
        handle,
        view: "node",
        id: "title",
      }),
    );
    expect(read.revision).toBe(0);
    expect(record(read.data).node).toMatchObject({ text: "Original title" });
  });

  it("reads bounded editable media/timing/animation state and safe asset metadata", async () => {
    const mediaScene = {
      ...scene,
      audioBuses: { dialogue: {}, music: {} },
      assets: {
        clip: {
          id: "clip",
          type: "video",
          src: "https://secret.example/clip.mp4?token=never-return",
          metadata: {
            duration: 12,
            width: 1280,
            height: 720,
            codec: "avc1",
            hasAudio: true,
          },
        },
      },
      nodes: [
        {
          id: "clip-node",
          type: "video",
          assetId: "clip",
          from: 5,
          duration: 120,
          videoStartTime: 1.5,
          playbackRate: 1.25,
          volume: 0.7,
          volumeEnvelope: [
            { frame: 0, value: 0 },
            { frame: 10, value: 1, easing: "easeOut" },
          ],
          audioBus: "dialogue",
          pan: -0.2,
          ducks: { bus: "music", gain: 0.3, attackFrames: 3 },
          videoEndBehavior: "loop",
          animations: [
            {
              kind: "keyframes",
              property: "opacity",
              frames: [
                { frame: 0, value: 0 },
                { frame: 12, value: 1 },
              ],
            },
          ],
          style: { width: 320, height: 180 },
        },
      ],
    };
    const session = createAgentWorkflowSession({
      sessionId: "MediaReadSession",
    });
    const handle = success(
      await session.execute({ action: "workspace.load", scene: mediaScene }),
    ).handle!;
    const node = record(
      success(
        await session.execute({
          action: "workspace.read",
          handle,
          view: "node",
          id: "clip-node",
        }),
      ).data,
    ).node;
    expect(node).toMatchObject({
      from: 5,
      duration: 120,
      videoStartTime: 1.5,
      playbackRate: 1.25,
      volume: 0.7,
      audioBus: "dialogue",
      pan: -0.2,
      ducks: { bus: "music", gain: 0.3, attackFrames: 3 },
      videoEndBehavior: "loop",
      volumeEnvelopePoints: 2,
      animationTracksTotal: 1,
      animationTracks: [
        expect.objectContaining({ property: "opacity", keyframesTotal: 2 }),
      ],
    });
    const summary = record(
      success(
        await session.execute({
          action: "workspace.read",
          handle,
          view: "summary",
        }),
      ).data,
    );
    expect(summary.assetCatalog).toEqual([
      {
        id: "clip",
        idTruncated: false,
        type: "video",
        metadata: expect.objectContaining({
          duration: 12,
          width: 1280,
          height: 720,
          codec: "avc1",
          hasAudio: true,
        }),
      },
    ]);
    expect(JSON.stringify(summary)).not.toContain("secret.example");
    expect(JSON.stringify(summary)).not.toContain("token=");
  });

  it("injects defensive before/after Scene and last transaction evidence", async () => {
    let captured: any;
    const session = createAgentWorkflowSession({
      sessionId: "ComparisonSession",
      evidence: {
        run(request) {
          captured = request;
          request.beforeScene.nodes[0]!.id = "mutated-before-clone";
          request.afterScene.nodes[0]!.id = "mutated-after-clone";
          return { compared: true };
        },
      },
    });
    const handle = success(
      await session.execute({ action: "workspace.load", scene }),
    ).handle!;
    success(
      await session.execute({
        action: "commands.apply",
        handle,
        expectedRevision: 0,
        commands: [{ kind: "text.set", id: "title", text: "After edit" }],
      }),
    );
    success(
      await session.execute({
        action: "evidence.run",
        handle,
        expectedRevision: 1,
        operation: "comparison.sheet",
      }),
    );
    expect(captured.beforeScene.nodes[0]).toMatchObject({
      id: "mutated-before-clone",
      text: "Original title",
    });
    expect(captured.scene.nodes[0]).toMatchObject({
      id: "title",
      text: "After edit",
    });
    expect(captured.history).toMatchObject({
      kind: "commit",
      revisionBefore: 0,
      revisionAfter: 1,
      semanticDiff: { equal: false },
    });
    const snapshot = await session.hostSnapshot(handle);
    expect(snapshot.scene.nodes[0]).toMatchObject({
      id: "title",
      text: "After edit",
    });
  });

  it("rejects recursive/cyclic ingestion only at load and all later Scene fields", async () => {
    const session = createAgentWorkflowSession({
      sessionId: "BoundarySession",
    });
    const cyclic: Record<string, unknown> = { ...scene };
    cyclic.self = cyclic;
    const rejected = failure(
      await session.execute({ action: "workspace.load", scene: cyclic }),
      "scene_rejected",
    );
    expect(record(rejected.error.details).issues[0]).toMatchObject({
      code: expect.stringMatching(/non_tree|scene_invalid/),
    });

    const loaded = success(
      await session.execute({ action: "workspace.load", scene }),
    );
    failure(
      await session.execute({
        action: "workspace.read",
        handle: loaded.handle,
        view: "summary",
        scene,
      }),
      "invalid_request",
    );
    failure(
      await session.execute({
        action: "commands.apply",
        handle: loaded.handle,
        expectedRevision: 0,
        commands: [
          {
            kind: "node.add",
            node: {
              id: "nested",
              type: "div",
              children: [{ id: "forbidden", type: "div" }],
            },
          },
        ],
      }),
      "invalid_request",
    );
  });

  it("distinguishes unknown and cross-session handles", async () => {
    const first = createAgentWorkflowSession({ sessionId: "FirstSession" });
    const second = createAgentWorkflowSession({ sessionId: "SecondSession" });
    const handle = success(
      await first.execute({ action: "workspace.load", scene }),
    ).handle!;
    failure(
      await second.execute({
        action: "workspace.read",
        handle,
        view: "summary",
      }),
      "cross_session_handle",
    );
    failure(
      await first.execute({
        action: "workspace.read",
        handle: "FirstSession:w999",
        view: "summary",
      }),
      "unknown_handle",
    );
  });
});

describe("MF8 workflow budgets, evidence, and cleanup", () => {
  it("enforces handle/scene/result budgets and strict callback serialization", async () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const evidence: WorkflowEvidenceAdapter = {
      run({ operation }) {
        if (operation === "cycle") return cyclic;
        if (operation === "nonfinite") return { value: Number.NaN };
        if (operation === "large") return Array.from({ length: 101 }, () => 1);
        return { artifactId: "ok" };
      },
    };
    const session = createAgentWorkflowSession({
      sessionId: "BudgetSession",
      maxHandles: 1,
      maxResultValues: 100,
      sceneLimits: { maxNodes: 2 },
      evidence,
    });
    const loaded = success(
      await session.execute({ action: "workspace.load", scene }),
    );
    const handle = loaded.handle!;
    failure(
      await session.execute({ action: "workspace.load", scene }),
      "handle_limit",
    );

    const tooManyNodes = {
      ...scene,
      nodes: [
        ...scene.nodes,
        { id: "third", type: "div", style: { width: 1, height: 1 } },
      ],
    };
    const separate = createAgentWorkflowSession({
      sessionId: "SceneBudgetSession",
      sceneLimits: { maxNodes: 2 },
    });
    failure(
      await separate.execute({
        action: "workspace.load",
        scene: tooManyNodes,
      }),
      "scene_rejected",
    );

    for (const [operation, code] of [
      ["cycle", "non_json_result"],
      ["nonfinite", "non_json_result"],
      ["large", "result_budget"],
    ] as const) {
      failure(
        await session.execute({
          action: "evidence.run",
          handle,
          expectedRevision: 0,
          operation,
        }),
        code,
      );
    }
    const valid = success(
      await session.execute({
        action: "evidence.run",
        handle,
        expectedRevision: 0,
        operation: "valid",
      }),
    );
    expect(record(valid.data)).toMatchObject({
      operation: "valid",
      result: { artifactId: "ok" },
    });
  });

  it("preflights every command candidate before publishing a revision", async () => {
    const session = createAgentWorkflowSession({
      sessionId: "MutationPolicySession",
      sceneLimits: {
        maxDimension: 1_000,
        maxCanvasPixels: 1_000_000,
        maxNodes: 2,
        maxAssets: 1,
      },
    });
    const handle = success(
      await session.execute({ action: "workspace.load", scene }),
    ).handle!;
    for (const commands of [
      [{ kind: "scene.set", width: 1_001 }],
      [{ kind: "node.add", node: { id: "third", type: "div" } }],
    ]) {
      const rejected = failure(
        await session.execute({
          action: "commands.apply",
          handle,
          expectedRevision: 0,
          commands,
        }),
        "scene_rejected",
      );
      expect(rejected.revision).toBe(0);
    }
    const snapshot = await session.hostSnapshot(handle);
    expect(snapshot.revision).toBe(0);
    expect(snapshot.scene).toMatchObject({ width: 320, height: 180 });
    expect(snapshot.scene.nodes).toHaveLength(2);

    success(
      await session.execute({
        action: "commands.apply",
        handle,
        expectedRevision: 0,
        commands: [
          {
            kind: "asset.set",
            asset: { id: "one", type: "image", src: "one.png" },
          },
        ],
      }),
    );
    const tooManyAssets = failure(
      await session.execute({
        action: "commands.apply",
        handle,
        expectedRevision: 1,
        commands: [
          {
            kind: "asset.set",
            asset: { id: "two", type: "image", src: "two.png" },
          },
        ],
      }),
      "scene_rejected",
    );
    expect(tooManyAssets.revision).toBe(1);
    expect(
      Object.keys((await session.hostSnapshot(handle)).scene.assets),
    ).toEqual(["one"]);
    const longId = "x".repeat(192);
    const invalidIdentity = failure(
      await session.execute({
        action: "commands.apply",
        handle,
        expectedRevision: 1,
        commands: [
          {
            kind: "asset.set",
            asset: { id: longId, type: "image", src: "long.png" },
          },
        ],
      }),
      "invalid_request",
    );
    expect(invalidIdentity.ok).toBe(false);
    expect(
      Object.hasOwn((await session.hostSnapshot(handle)).scene.assets, longId),
    ).toBe(false);
  });

  it("pre-serializes bounded affected-id summaries before large subtree commits", async () => {
    const children = Array.from({ length: 600 }, (_, index) => ({
      id: `${String(index).padStart(3, "0")}-${"x".repeat(220)}`,
      type: "div" as const,
    }));
    const large = {
      ...scene,
      nodes: [{ id: "group", type: "div", children }],
    };
    const session = createAgentWorkflowSession({
      sessionId: "SummaryBoundSession",
      sceneLimits: { maxNodes: 1_000 },
    });
    const handle = success(
      await session.execute({ action: "workspace.load", scene: large }),
    ).handle!;
    const removed = success(
      await session.execute({
        action: "commands.apply",
        handle,
        expectedRevision: 0,
        commands: [{ kind: "node.remove", id: "group" }],
      }),
    );
    expect(removed.revision).toBe(1);
    expect(record(removed.data).history).toMatchObject({
      affectedIds: expect.any(Array),
      affectedIdsTotal: 601,
      affectedIdsTruncated: true,
    });
    expect(record(removed.data).history.affectedIds).toHaveLength(200);
    expect((await session.hostSnapshot(handle)).scene.nodes).toEqual([]);
  });

  it("keeps a bounded readable event stream", async () => {
    const session = createAgentWorkflowSession({
      sessionId: "EventSession",
      maxEvents: 4,
    });
    const handle = success(
      await session.execute({ action: "workspace.load", scene }),
    ).handle!;
    await session.execute({
      action: "workspace.read",
      handle,
      view: "summary",
    });
    await session.execute({
      action: "workspace.search",
      handle,
      types: ["text"],
    });
    const events = success(
      await session.execute({ action: "events.read", afterSequence: 0 }),
    );
    const rows = record(events.data).events as Array<Record<string, unknown>>;
    expect(rows.length).toBeLessThanOrEqual(4);
    expect(rows.map(({ sequence }) => sequence)).toEqual(
      [...rows.map(({ sequence }) => sequence as number)].sort((a, b) => a - b),
    );
    expect(record(events.data).latestSequence).toBeGreaterThan(0);
  });

  it("closes and disposes resources in deterministic handle order", async () => {
    const trace: string[] = [];
    const evidence: WorkflowEvidenceAdapter = {
      run({ handle, operation, scene: cloned }) {
        trace.push(`run:${handle}:${operation}`);
        cloned.nodes[0]!.id = "mutated-clone";
        return { ok: true };
      },
      disposeHandle({ handle }) {
        trace.push(`close:${handle}`);
      },
      dispose() {
        trace.push("dispose:session");
      },
    };
    const session = createAgentWorkflowSession({
      sessionId: "DisposeSession",
      evidence,
    });
    const first = success(
      await session.execute({ action: "workspace.load", scene }),
    ).handle!;
    const second = success(
      await session.execute({ action: "workspace.load", scene }),
    ).handle!;

    success(
      await session.execute({
        action: "evidence.run",
        handle: second,
        expectedRevision: 0,
        operation: "proof",
      }),
    );
    success(
      await session.execute({
        action: "workspace.close",
        handle: first,
        expectedRevision: 0,
      }),
    );
    const disposed = success(await session.dispose());
    expect(record(disposed.data)).toMatchObject({
      disposed: true,
      alreadyDisposed: false,
      handlesClosed: 1,
    });
    expect(trace).toEqual([
      `run:${second}:proof`,
      `close:${first}`,
      `close:${second}`,
      "dispose:session",
    ]);
    expect(record(success(await session.dispose()).data)).toMatchObject({
      alreadyDisposed: true,
    });
    failure(
      await session.execute({
        action: "workspace.read",
        handle: second,
        view: "summary",
      }),
      "session_disposed",
    );
  });

  it("reports cleanup failure after releasing every handle", async () => {
    const trace: string[] = [];
    const session = createAgentWorkflowSession({
      sessionId: "CleanupFailureSession",
      evidence: {
        run() {
          return null;
        },
        disposeHandle({ handle }) {
          trace.push(handle);
          if (trace.length === 1) throw new Error("first cleanup failed");
        },
      },
    });
    const first = success(
      await session.execute({ action: "workspace.load", scene }),
    ).handle!;
    const second = success(
      await session.execute({ action: "workspace.load", scene }),
    ).handle!;
    failure(await session.dispose(), "cleanup_failed");
    expect(trace).toEqual([first, second]);
    expect(record(success(await session.dispose()).data)).toMatchObject({
      alreadyDisposed: true,
    });
  });

  it("returns a valid cleanup error after a close has deleted the handle", async () => {
    const session = createAgentWorkflowSession({
      sessionId: "CloseFailureSession",
      evidence: {
        run() {
          return null;
        },
        disposeHandle() {
          throw new Error("close cleanup failed");
        },
      },
    });
    const handle = success(
      await session.execute({ action: "workspace.load", scene }),
    ).handle!;
    const closed = failure(
      await session.execute({
        action: "workspace.close",
        handle,
        expectedRevision: 0,
      }),
      "cleanup_failed",
    );
    expect(workflowResultSchema.safeParse(closed).success).toBe(true);
    failure(
      await session.execute({
        action: "workspace.read",
        handle,
        view: "summary",
      }),
      "unknown_handle",
    );
  });
});
