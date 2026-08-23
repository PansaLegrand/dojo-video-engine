import { describe, expect, it } from "vitest";
import type { Scene } from "@motionforge/schema";
import {
  ExportWorkerClient,
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
