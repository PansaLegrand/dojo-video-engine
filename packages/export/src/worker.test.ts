import { describe, expect, it } from "vitest";
import type { Scene } from "@motionforge/schema";
import {
  ExportWorkerClient,
  createExportWorkerHandler,
  type ExportWorkerEvent,
  type ExportWorkerRequest,
  type WorkerLike,
} from "./worker.js";

const scene: Scene = {
  schemaVersion: 1,
  width: 16,
  height: 16,
  fps: 30,
  duration: 2,
  assets: {},
  nodes: [],
};

class FakeWorker implements WorkerLike {
  messages: ExportWorkerRequest[] = [];
  listeners = new Set<(event: MessageEvent<ExportWorkerEvent>) => void>();

  postMessage(message: ExportWorkerRequest): void {
    this.messages.push(message);
  }

  addEventListener(
    _type: "message",
    listener: (event: MessageEvent<ExportWorkerEvent>) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: "message",
    listener: (event: MessageEvent<ExportWorkerEvent>) => void,
  ): void {
    this.listeners.delete(listener);
  }

  emit(data: ExportWorkerEvent): void {
    this.listeners.forEach((listener) => listener({ data } as MessageEvent));
  }
}

describe("ExportWorkerClient", () => {
  it("routes progress and completion by request id", async () => {
    const worker = new FakeWorker();
    const progress: number[] = [];
    const task = new ExportWorkerClient(worker).export(scene, {
      onProgress: (event) => progress.push(event.frame),
    });
    expect(worker.messages[0]).toMatchObject({
      type: "motionforge.export.start",
      id: task.id,
    });
    worker.emit({
      type: "motionforge.export.progress",
      id: task.id,
      progress: {
        frame: 1,
        frameIndex: 1,
        totalFrames: 2,
        timestampUs: 33_333,
        sceneTimestampUs: 33_333,
      },
    });
    const expected = {
      blob: new Blob(),
      codec: "avc" as const,
      audioCodec: null,
      totalFrames: 2,
    };
    worker.emit({
      type: "motionforge.export.complete",
      id: task.id,
      result: expected,
    });
    await expect(task.result).resolves.toEqual(expected);
    expect(progress).toEqual([1]);
  });

  it("sends cancellation for unsettled work", () => {
    const worker = new FakeWorker();
    const task = new ExportWorkerClient(worker).export(scene);
    task.cancel();
    expect(worker.messages.at(-1)).toEqual({
      type: "motionforge.export.cancel",
      id: task.id,
    });
  });
});

describe("createExportWorkerHandler", () => {
  it("rejects a duplicate active request id without replacing cancellation ownership", async () => {
    const events: ExportWorkerEvent[] = [];
    const handler = createExportWorkerHandler({
      postMessage: (event) => events.push(event),
    });
    const request = {
      type: "motionforge.export.start" as const,
      id: "same-id",
      scene,
    };

    const first = handler(request);
    await handler(request);
    await first;

    expect(events).toContainEqual({
      type: "motionforge.export.error",
      id: "same-id",
      error: {
        name: "DuplicateExportRequestError",
        message:
          'An export with id "same-id" is already active. Request ids must be unique until terminal completion.',
      },
    });
  });
});
