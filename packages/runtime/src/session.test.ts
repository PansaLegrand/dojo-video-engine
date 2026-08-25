import { describe, expect, it } from "vitest";
import {
  RuntimeError,
  createSceneRuntime,
  serializeRuntimeError,
  type ArtifactSinkWriter,
  type BackendUpdateTransaction,
  type FrameArtifactSink,
  type PreparedSceneBackend,
  type RuntimeEvent,
  type RuntimeOperationContext,
} from "./index.js";

type FakeState = { id: number; label: string; disposed: boolean };
type FakeFrame = { stateId: number; frame: number };
type FakeTarget = { draws: Array<{ stateId: number; frame: number }> };
type Receipt = { uri: string; bytes: number };

const scene = (label = "one", width = 320) => ({
  schemaVersion: 1,
  width,
  height: 180,
  fps: 30,
  duration: 30,
  assets: {},
  nodes: [{ id: "title", type: "text", text: label }],
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fakeBackend() {
  let nextState = 1;
  const disposed: number[] = [];
  const prepared: number[] = [];
  const rolledBack: number[] = [];
  const contexts: RuntimeOperationContext[] = [];
  let updateHook:
    | ((
        current: FakeState,
        nextLabel: string,
        context: RuntimeOperationContext,
      ) => Promise<BackendUpdateTransaction<FakeState>>)
    | undefined;
  let prepareHook:
    | ((context: RuntimeOperationContext) => Promise<FakeState>)
    | undefined;
  let frameHook:
    | ((
        state: FakeState,
        frame: number,
        context: RuntimeOperationContext,
      ) => Promise<FakeFrame>)
    | undefined;

  const backend: PreparedSceneBackend<FakeState, FakeFrame, FakeTarget> = {
    id: "fake",
    capabilities: {
      renderFrames: true,
      frameImageMimeTypes: ["image/png"],
      audioResources: false,
      worker: true,
    },
    preflight: () => ({ ok: true, issues: [] }),
    prepare: async (value, context) => {
      contexts.push(context);
      if (prepareHook) return prepareHook(context);
      const state = {
        id: nextState++,
        label: value.nodes[0]?.text ?? "",
        disposed: false,
      };
      prepared.push(state.id);
      return state;
    },
    prepareUpdate: async (current, _previous, next, context) => {
      const label = next.nodes[0]?.text ?? "";
      if (updateHook) return updateHook(current, label, context);
      const candidate = {
        id: nextState++,
        label,
        disposed: false,
      };
      prepared.push(candidate.id);
      let terminal: string | undefined;
      return {
        summary: {
          reused: ["shared"],
          loaded: [label],
          replaced: [current.label],
          removed: [],
        },
        commit: () => {
          if (terminal) throw new Error(`already ${terminal}`);
          terminal = "committed";
          return {
            session: candidate,
            cleanup: backend.dispose(current),
          };
        },
        rollback: async () => {
          if (terminal === "rolled-back") return;
          if (terminal) throw new Error(`already ${terminal}`);
          terminal = "rolled-back";
          rolledBack.push(candidate.id);
          await backend.dispose(candidate);
        },
      };
    },
    prepareFrame: async (state, _scene, frame, context) => {
      contexts.push(context);
      if (frameHook) return frameHook(state, frame, context);
      return { stateId: state.id, frame };
    },
    renderFrame: (state, _scene, frame, preparedFrame, target) => {
      if (preparedFrame.stateId !== state.id)
        throw new Error("stale fake frame");
      target.draws.push({ stateId: state.id, frame });
    },
    encodeFrameImage: async (_state, value, _frame, _prepared, options) => ({
      width: value.width,
      height: value.height,
      mimeType: options.mimeType,
      colorSpace: "srgb",
      chunks: [new Uint8Array([1, 2]), new Uint8Array([3])],
    }),
    metrics: () => ({}),
    dispose: async (state) => {
      if (state.disposed) throw new Error(`state ${state.id} disposed twice`);
      state.disposed = true;
      disposed.push(state.id);
    },
  };
  return {
    backend,
    disposed,
    prepared,
    rolledBack,
    contexts,
    setUpdateHook: (hook: typeof updateHook) => {
      updateHook = hook;
    },
    setPrepareHook: (hook: typeof prepareHook) => {
      prepareHook = hook;
    },
    setFrameHook: (hook: typeof frameHook) => {
      frameHook = hook;
    },
    nextState: () => nextState++,
  };
}

function sink(
  options: {
    writeFailure?: Error;
    commitFailure?: Error;
    commitGate?: Promise<void>;
    abortFailure?: Error;
    beginGate?: Promise<void>;
    writeGate?: Promise<void>;
  } = {},
) {
  const calls: string[] = [];
  const chunks: number[][] = [];
  let descriptor: unknown;
  const value: FrameArtifactSink<Receipt> = {
    begin: async (nextDescriptor) => {
      calls.push("begin");
      descriptor = nextDescriptor;
      await options.beginGate;
      const writer: ArtifactSinkWriter<Receipt> = {
        write: async (chunk) => {
          calls.push("write");
          await options.writeGate;
          if (options.writeFailure) throw options.writeFailure;
          chunks.push([...chunk]);
        },
        commit: async () => {
          calls.push("commit");
          await options.commitGate;
          if (options.commitFailure) throw options.commitFailure;
          return { uri: "memory://frame", bytes: chunks.flat().length };
        },
        abort: async () => {
          calls.push("abort");
          if (options.abortFailure) throw options.abortFailure;
        },
      };
      return writer;
    },
  };
  return { value, calls, chunks, descriptor: () => descriptor };
}

describe("PreparedSceneSession", () => {
  it("normalizes a pre-aborted creation into the runtime error taxonomy", async () => {
    const fake = fakeBackend();
    const controller = new AbortController();
    controller.abort(new DOMException("already stopped", "AbortError"));
    await expect(
      createSceneRuntime({
        scene: scene(),
        backend: fake.backend,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      code: "aborted",
      phase: "parse",
      context: { operationId: expect.any(String) },
    });
    expect(fake.prepared).toEqual([]);
  });

  it("rejects repeated initialization without replacing or leaking prepared state", async () => {
    const fake = fakeBackend();
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
    });
    await expect(runtime.initialize(scene("second"))).rejects.toMatchObject({
      code: "stale_operation",
      phase: "prepare",
    });
    expect(fake.prepared).toEqual([1]);
    expect(runtime.scene.nodes[0]?.text).toBe("one");
    await runtime.disposeAsync();
    expect(fake.disposed).toEqual([1]);
  });

  it("disposes preparation that completes after creation is aborted", async () => {
    const fake = fakeBackend();
    const gate = deferred<FakeState>();
    fake.setPrepareHook(async () => gate.promise);
    const controller = new AbortController();
    const creation = createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
      signal: controller.signal,
    });
    for (let index = 0; index < 20 && fake.contexts.length < 1; index += 1) {
      await Promise.resolve();
    }
    controller.abort(new DOMException("stop", "AbortError"));
    gate.resolve({ id: 99, label: "late", disposed: false });
    await expect(creation).rejects.toMatchObject({ code: "aborted" });
    expect(fake.disposed).toEqual([99]);
  });

  it("keeps cleanup failures inside the stable runtime taxonomy", async () => {
    const fake = fakeBackend();
    const gate = deferred<FakeState>();
    fake.setPrepareHook(async () => gate.promise);
    fake.backend.dispose = async () => {
      throw new Error("cleanup exploded");
    };
    const controller = new AbortController();
    const creation = createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
      signal: controller.signal,
    });
    for (let index = 0; index < 20 && fake.contexts.length < 1; index += 1) {
      await Promise.resolve();
    }
    controller.abort(new DOMException("primary abort", "AbortError"));
    gate.resolve({ id: 100, label: "late", disposed: false });
    await expect(creation).rejects.toMatchObject({
      code: "dispose_failed",
      phase: "dispose",
      backendId: "fake",
      context: {
        details: {
          primary: { code: "aborted" },
          cleanup: { code: "dispose_failed" },
        },
      },
    });
  });

  it("prepares, renders, emits deterministic events, and isolates observers", async () => {
    const fake = fakeBackend();
    const events: RuntimeEvent[] = [];
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
      sessionId: "test-session",
      onEvent: (event) => {
        events.push(event);
        if (event.kind === "progress") throw new Error("observer only");
      },
    });
    runtime.onEvent(() => {
      throw new Error("observer failure");
    });
    const target: FakeTarget = { draws: [] };
    await runtime.renderFrame(2, target);
    expect(target.draws).toEqual([{ stateId: 1, frame: 2 }]);
    expect(events.map((event) => event.sequence)).toEqual(
      events.map((_, index) => index + 1),
    );
    expect(events.some((event) => event.phase === "frame-prepare")).toBe(true);
    expect(events.some((event) => event.phase === "frame-render")).toBe(true);
    expect(JSON.parse(JSON.stringify(events))).toEqual(events);
    await runtime.disposeAsync();
    expect(fake.disposed).toEqual([1]);
    await runtime.disposeAsync();
    expect(fake.disposed).toEqual([1]);
  });

  it("updates transactionally, rejects stale revisions, and invalidates tokens", async () => {
    const fake = fakeBackend();
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
    });
    const token = await runtime.prepareFrame(0);
    expect(token).not.toHaveProperty("data");
    const preparedTarget: FakeTarget = { draws: [] };
    await runtime.renderPrepared(token, preparedTarget);
    expect(preparedTarget.draws).toEqual([{ stateId: 1, frame: 0 }]);
    const update = await runtime.updateScene(scene("two"), {
      expectedRevision: 0,
    });
    expect(update).toEqual({
      revision: 1,
      summary: {
        reused: ["shared"],
        loaded: ["two"],
        replaced: ["one"],
        removed: [],
      },
    });
    expect(fake.disposed).toEqual([1]);
    expect(() =>
      runtime.updateScene(scene("bad-stale"), { expectedRevision: 0 }),
    ).toThrow(/Expected Scene revision 0/);
    await expect(
      runtime.renderPrepared(token, { draws: [] }),
    ).rejects.toMatchObject({ code: "stale_operation" });
    await runtime.disposeAsync();
    expect(fake.disposed).toEqual([1, 2]);
  });

  it("publishes capabilities returned by the committed update preflight", async () => {
    const fake = fakeBackend();
    fake.backend.preflight = (value) => ({
      ok: true,
      issues: [],
      capabilities: {
        ...fake.backend.capabilities,
        worker: value.width > 320,
      },
    });
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
    });
    expect(runtime.capabilities.worker).toBe(false);
    await runtime.updateScene(scene("wide", 640));
    expect(runtime.capabilities.worker).toBe(true);
    await runtime.disposeAsync();
  });

  it("makes the latest concurrent update win and rolls stale candidates back", async () => {
    const fake = fakeBackend();
    const firstGate = deferred<BackendUpdateTransaction<FakeState>>();
    let calls = 0;
    fake.setUpdateHook(async (current, label) => {
      calls += 1;
      if (calls === 1) return firstGate.promise;
      const candidate: FakeState = {
        id: fake.nextState(),
        label,
        disposed: false,
      };
      let rolled = false;
      return {
        summary: { reused: [], loaded: [label], replaced: [], removed: [] },
        commit: () => ({
          session: candidate,
          cleanup: fake.backend.dispose(current),
        }),
        rollback: async () => {
          if (rolled) return;
          rolled = true;
          fake.rolledBack.push(candidate.id);
          await fake.backend.dispose(candidate);
        },
      };
    });
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
    });
    const first = runtime.updateScene(scene("first"));
    for (let index = 0; index < 20 && calls === 0; index += 1) {
      await Promise.resolve();
    }
    expect(calls).toBe(1);
    const second = runtime.updateScene(scene("second"));
    const staleCandidate: FakeState = {
      id: fake.nextState(),
      label: "first",
      disposed: false,
    };
    let staleRolled = false;
    firstGate.resolve({
      summary: { reused: [], loaded: ["first"], replaced: [], removed: [] },
      commit: () => ({ session: staleCandidate }),
      rollback: async () => {
        if (staleRolled) return;
        staleRolled = true;
        fake.rolledBack.push(staleCandidate.id);
        await fake.backend.dispose(staleCandidate);
      },
    });
    await expect(first).rejects.toMatchObject({ code: "aborted" });
    await expect(second).resolves.toMatchObject({ revision: 1 });
    expect(runtime.scene.nodes[0]?.text).toBe("second");
    expect(fake.rolledBack).toContain(staleCandidate.id);
    await runtime.disposeAsync();
  });

  it("returns a committed update when a newer intent starts during cleanup", async () => {
    const fake = fakeBackend();
    const cleanupGate = deferred<void>();
    let firstUpdate = true;
    fake.setUpdateHook(async (current, label) => {
      const candidate: FakeState = {
        id: fake.nextState(),
        label,
        disposed: false,
      };
      return {
        summary: { reused: [], loaded: [label], replaced: [], removed: [] },
        commit: () => ({
          session: candidate,
          cleanup: firstUpdate
            ? cleanupGate.promise.then(() => fake.backend.dispose(current))
            : fake.backend.dispose(current),
        }),
        rollback: async () => fake.backend.dispose(candidate),
      };
    });
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
    });
    const committed = runtime.updateScene(scene("committed"));
    for (let index = 0; index < 50 && runtime.revision === 0; index += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    expect(runtime.revision).toBe(1);
    firstUpdate = false;
    const newer = runtime.updateScene(scene("newer"));
    cleanupGate.resolve();
    await expect(committed).resolves.toMatchObject({ revision: 1 });
    await expect(newer).resolves.toMatchObject({ revision: 2 });
    expect(runtime.scene.nodes[0]?.text).toBe("newer");
    await runtime.disposeAsync();
  });

  it("keeps the old revision usable after update preparation failure", async () => {
    const fake = fakeBackend();
    fake.setUpdateHook(async () => {
      throw new Error("candidate failed");
    });
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
    });
    await expect(runtime.updateScene(scene("broken"))).rejects.toMatchObject({
      code: "update_failed",
    });
    expect(runtime.revision).toBe(0);
    const target: FakeTarget = { draws: [] };
    await runtime.renderFrame(0, target);
    expect(target.draws).toEqual([{ stateId: 1, frame: 0 }]);
    await runtime.disposeAsync();
  });

  it("aborts noncooperative frame work and joins it before disposal", async () => {
    const fake = fakeBackend();
    const gate = deferred<FakeFrame>();
    fake.setFrameHook(async () => gate.promise);
    const events: RuntimeEvent[] = [];
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
      onEvent: (event) => events.push(event),
    });
    const frame = runtime.prepareFrame(1);
    await Promise.resolve();
    const disposal = runtime.disposeAsync();
    expect(fake.disposed).toEqual([]);
    gate.resolve({ stateId: 1, frame: 1 });
    await expect(frame).rejects.toMatchObject({ code: "aborted" });
    await disposal;
    expect(fake.disposed).toEqual([1]);
    const finalSequence = events.at(-1)?.sequence;
    expect(events.at(-1)).toMatchObject({ phase: "dispose", kind: "complete" });
    await Promise.resolve();
    expect(events.at(-1)?.sequence).toBe(finalSequence);
  });

  it("rejects foreign tokens and invalid frames with stable errors", async () => {
    const firstFake = fakeBackend();
    const secondFake = fakeBackend();
    const first = await createSceneRuntime({
      scene: scene(),
      backend: firstFake.backend,
    });
    const secondEvents: RuntimeEvent[] = [];
    const second = await createSceneRuntime({
      scene: scene(),
      backend: secondFake.backend,
      onEvent: (event) => secondEvents.push(event),
    });
    const token = await first.prepareFrame(0);
    await expect(
      second.renderPrepared(token, { draws: [] }),
    ).rejects.toMatchObject({
      code: "stale_operation",
      phase: "frame-render",
      context: { operationId: expect.any(String) },
    });
    expect(secondEvents.at(-1)).toMatchObject({
      phase: "frame-render",
      kind: "error",
      code: "stale_operation",
    });
    expect(() => first.prepareFrame(30)).toThrow(/Frame must be an integer/);
    const serialized = serializeRuntimeError(
      new RuntimeError("no", "stale_revision", "update", "fake", {
        revision: 2,
      }),
    );
    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(
      new RuntimeError("cycle", "update_failed", "update", "fake", {
        details: cycle,
      }).toJSON(),
    ).toMatchObject({
      details: { serializationError: expect.any(String) },
    });
    await first.disposeAsync();
    await second.disposeAsync();
  });
});

describe("frame artifact sink", () => {
  it("writes chunks with backpressure and returns a JSON-safe receipt", async () => {
    const fake = fakeBackend();
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
      sessionId: "artifact-session",
    });
    const memory = sink();
    const result = await runtime.writeFrameArtifact(3, memory.value);
    expect(memory.calls).toEqual(["begin", "write", "write", "commit"]);
    expect(memory.chunks).toEqual([[1, 2], [3]]);
    expect(result).toMatchObject({
      descriptor: {
        sessionId: "artifact-session",
        revision: 0,
        frame: 3,
        sceneTimestampUs: 100_000,
        mimeType: "image/png",
        byteLength: 3,
        operationKey: expect.stringMatching(/q=default$/),
      },
      receipt: { uri: "memory://frame", bytes: 3 },
    });
    await runtime.disposeAsync();
  });

  it("lets a resolved sink commit win over a concurrent update intent", async () => {
    const fake = fakeBackend();
    const commitGate = deferred<void>();
    const memory = sink({ commitGate: commitGate.promise });
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
    });
    const artifact = runtime.writeFrameArtifact(0, memory.value, {
      quality: 0.8,
    });
    for (
      let index = 0;
      index < 50 && !memory.calls.includes("commit");
      index += 1
    ) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    expect(memory.calls).toContain("commit");
    const update = runtime.updateScene(scene("after-artifact"));
    commitGate.resolve();
    await expect(artifact).resolves.toMatchObject({
      descriptor: {
        revision: 0,
        operationKey: expect.stringMatching(/q=0.8$/),
      },
    });
    await expect(update).resolves.toMatchObject({ revision: 1 });
    expect(memory.calls).not.toContain("abort");
    await runtime.disposeAsync();
  });

  it("rejects lossy committed receipts and reports committed state", async () => {
    const fake = fakeBackend();
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
    });
    let aborts = 0;
    const invalidSink: FrameArtifactSink<Record<string, unknown>> = {
      begin: async () => ({
        write: async () => {},
        commit: async () => ({ value: Number.NaN, date: new Date() }),
        abort: async () => {
          aborts += 1;
        },
      }),
    };
    await expect(
      runtime.writeFrameArtifact(0, invalidSink),
    ).rejects.toMatchObject({
      code: "artifact_sink_failed",
      phase: "artifact-write",
      context: { details: { committed: true } },
    });
    expect(aborts).toBe(0);
    await runtime.disposeAsync();
  });

  it("protects artifact provenance from sink mutation", async () => {
    const fake = fakeBackend();
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
    });
    const mutatingSink: FrameArtifactSink<Receipt> = {
      begin: async (descriptor) => {
        try {
          (descriptor as { frame: number }).frame = 29;
        } catch {
          // Frozen descriptors intentionally reject mutation in strict mode.
        }
        return {
          write: async () => {},
          commit: async () => ({ uri: "memory://safe", bytes: 3 }),
          abort: async () => {},
        };
      },
    };
    await expect(
      runtime.writeFrameArtifact(0, mutatingSink),
    ).resolves.toMatchObject({
      descriptor: { frame: 0, revision: 0 },
    });
    await runtime.disposeAsync();
  });

  it("aborts exactly once on write, commit, and size failures", async () => {
    for (const memory of [
      sink({ writeFailure: new Error("write failed") }),
      sink({ commitFailure: new Error("commit failed") }),
    ]) {
      const fake = fakeBackend();
      const runtime = await createSceneRuntime({
        scene: scene(),
        backend: fake.backend,
      });
      await expect(
        runtime.writeFrameArtifact(0, memory.value),
      ).rejects.toMatchObject({
        code: "artifact_sink_failed",
      });
      expect(memory.calls.filter((call) => call === "abort")).toHaveLength(1);
      await runtime.disposeAsync();
    }

    const fake = fakeBackend();
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
    });
    const memory = sink();
    await expect(
      runtime.writeFrameArtifact(0, memory.value, { maxBytes: 2 }),
    ).rejects.toMatchObject({ code: "artifact_too_large" });
    expect(memory.calls.at(-1)).toBe("abort");
    await runtime.disposeAsync();
  });

  it("preserves primary and abort errors together", async () => {
    const fake = fakeBackend();
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
    });
    const memory = sink({
      writeFailure: new Error("primary"),
      abortFailure: new Error("cleanup"),
    });
    try {
      await runtime.writeFrameArtifact(0, memory.value);
      throw new Error("expected artifact failure");
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeError);
      expect((error as RuntimeError).context.cause).toBeInstanceOf(
        AggregateError,
      );
    }
    expect(memory.calls.filter((call) => call === "abort")).toHaveLength(1);
    await runtime.disposeAsync();
  });

  it("aborts a begin/write resolved after a newer update and never commits", async () => {
    for (const phase of ["begin", "write"] as const) {
      const fake = fakeBackend();
      const gate = deferred<void>();
      const memory = sink(
        phase === "begin"
          ? { beginGate: gate.promise }
          : { writeGate: gate.promise },
      );
      const runtime = await createSceneRuntime({
        scene: scene(),
        backend: fake.backend,
      });
      const artifact = runtime.writeFrameArtifact(0, memory.value);
      for (
        let index = 0;
        index < 50 && !memory.calls.includes(phase);
        index += 1
      ) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      expect(memory.calls, phase).toContain(phase);
      const update = runtime.updateScene(scene("new"));
      gate.resolve();
      await expect(artifact).rejects.toMatchObject({ code: "aborted" });
      await update;
      expect(memory.calls).not.toContain("commit");
      expect(memory.calls.filter((call) => call === "abort")).toHaveLength(1);
      await runtime.disposeAsync();
    }
  });

  it("ignores backend progress emitted after its phase terminal", async () => {
    const fake = fakeBackend();
    const events: RuntimeEvent[] = [];
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
      onEvent: (event) => events.push(event),
    });
    await runtime.prepareFrame(0);
    const before = events.length;
    fake.contexts.at(-1)?.emitProgress("frame-prepare", {
      current: 1,
      total: 1,
      unit: "frames",
    });
    expect(events).toHaveLength(before);
    await runtime.disposeAsync();
  });

  it("bounds progress metadata and keeps every delivered event portable JSON", async () => {
    const fake = fakeBackend();
    const events: RuntimeEvent[] = [];
    fake.setFrameHook(async (state, frame, context) => {
      const cyclic: Record<string, unknown> = {};
      cyclic.self = cyclic;
      context.emitProgress("frame-prepare", {
        current: Number.NaN,
        total: 3,
        unit: "invalid" as never,
        details: cyclic,
        kind: "forged" as never,
        operationId: "forged" as never,
      } as never);
      context.emitProgress("frame-prepare", {
        current: 2,
        total: 3,
        unit: "frames",
        details: { when: new Date() },
      });
      context.emitProgress("frame-prepare", {
        details: { payload: "x".repeat(40_000) },
      });
      return { stateId: state.id, frame };
    });
    const runtime = await createSceneRuntime({
      scene: scene(),
      backend: fake.backend,
      onEvent: (event) => events.push(event),
    });
    await runtime.prepareFrame(0);

    const progress = events.filter((event) => event.kind === "progress");
    expect(progress).toHaveLength(3);
    expect(progress[0]).toMatchObject({
      kind: "progress",
      phase: "frame-prepare",
      total: 3,
      details: { serializationError: expect.stringMatching(/cyclic/) },
    });
    expect(progress[0]).not.toHaveProperty("current");
    expect(progress[0]).not.toHaveProperty("unit");
    expect(progress[0]?.operationId).not.toBe("forged");
    expect(progress[1]?.details).toEqual({
      serializationError: expect.stringMatching(/non-plain object/),
    });
    expect(progress[2]?.details).toEqual({
      serializationError: expect.stringMatching(/8192 characters/),
    });
    for (const event of events) {
      expect(JSON.parse(JSON.stringify(event))).toEqual(event);
    }
    await runtime.disposeAsync();
  });
});
