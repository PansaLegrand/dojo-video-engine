import { describe, expect, it, vi } from "vitest";
import {
  __verifyExportBlobWithInspector,
  exportVerificationSamplingPolicy,
  unverifiedExportForSink,
  verifyExportBlob,
  verifyExportWithSink,
  type ExportVerificationExpectation,
  type ExportVerificationInspector,
  type ExportVerificationResult,
} from "./verification.js";

const expectation: ExportVerificationExpectation = {
  width: 320,
  height: 180,
  durationSeconds: 10,
  hasAudio: true,
  fps: 30,
};

const blob = new Blob(["not-a-real-mp4"], { type: "video/mp4" });

describe("verifyExportBlob", () => {
  it("rejects an obviously malformed MP4 before opening decoder state", async () => {
    const result = await verifyExportBlob(blob, expectation, "container");
    expect(result.status).toBe("failed");
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "container_unreadable" }),
    ]);
  });

  it("disposes an ftyp-prefixed corrupt input without an unhandled rejection", async () => {
    const bytes = new Uint8Array([
      0, 0, 0, 12, 0x66, 0x74, 0x79, 0x70, 0x62, 0x61, 0x64, 0x21,
    ]);
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const result = await verifyExportBlob(
        new Blob([bytes], { type: "video/mp4" }),
        expectation,
        "container",
      );
      expect(result.status).toBe("failed");
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("returns a stable unverified result without opening media in none mode", async () => {
    const createInspector = vi.fn(() => inspector(metadata()));
    const result = await __verifyExportBlobWithInspector(
      blob,
      expectation,
      "none",
      undefined,
      createInspector,
    );

    expect(result.status).toBe("unverified");
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "verification_disabled" }),
    ]);
    expect(result.checks.map((check) => check.id)).toHaveLength(11);
    expect(createInspector).not.toHaveBeenCalled();
  });

  it("reports a malformed Blob as failed instead of leaking or throwing", async () => {
    const dispose = vi.fn();
    const result = await __verifyExportBlobWithInspector(
      blob,
      expectation,
      "container",
      undefined,
      () => ({
        inspect: async () => {
          throw new Error("Input has an unsupported or unrecognizable format.");
        },
        dispose,
      }),
    );

    expect(result.status).toBe("failed");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "container_unreadable" }),
      ]),
    );
    expect(check(result, "resources_disposed").status).toBe("passed");
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("accepts one-frame duration and bounded codec padding but rejects larger drift", async () => {
    const frame = 1 / expectation.fps;
    const atBoundary = await verifyWith(
      metadata({
        videoDurationSeconds: expectation.durationSeconds + frame,
        audioDurationSeconds: expectation.durationSeconds + frame * 2,
      }),
    );

    expect(atBoundary.status).toBe("verified");
    expect(check(atBoundary, "video_duration_match").status).toBe("passed");
    expect(check(atBoundary, "audio_video_sync").status).toBe("passed");

    const outsideBoundary = await verifyWith(
      metadata({
        videoDurationSeconds: expectation.durationSeconds + frame + 0.001,
        audioDurationSeconds: expectation.durationSeconds + 0.2,
      }),
    );
    expect(outsideBoundary.status).toBe("failed");
    expect(outsideBoundary.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "video_duration_mismatch",
        "audio_video_sync_mismatch",
      ]),
    );
  });

  it("evaluates bounded sampled video and audible audio evidence", async () => {
    const result = await __verifyExportBlobWithInspector(
      blob,
      expectation,
      "sampled",
      undefined,
      () =>
        inspector(
          metadata({
            decodedVideoFrames:
              exportVerificationSamplingPolicy.sampledVideoFrames,
            pixelAccessAvailable: true,
            hasNonblankVideoFrame: true,
            decodedAudioSamples:
              exportVerificationSamplingPolicy.sampledAudioSamples,
            hasAudibleAudio: true,
          }),
        ),
    );

    expect(result.status).toBe("verified");
    expect(check(result, "video_frame_nonblank").status).toBe("passed");
    expect(check(result, "audio_audible").status).toBe("passed");
  });

  it("turns abort into diagnostics and still disposes the inspector", async () => {
    const controller = new AbortController();
    const dispose = vi.fn();
    const result = await __verifyExportBlobWithInspector(
      blob,
      expectation,
      "sampled",
      controller.signal,
      () => ({
        inspect: async () => {
          controller.abort(new DOMException("stop verification", "AbortError"));
          throw controller.signal.reason;
        },
        dispose,
      }),
    );

    expect(result.status).toBe("failed");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "verification_aborted" }),
      ]),
    );
    expect(dispose).toHaveBeenCalledOnce();
    expect(check(result, "resources_disposed").status).toBe("passed");
  });

  it("reports inspector disposal failure", async () => {
    const result = await __verifyExportBlobWithInspector(
      blob,
      expectation,
      "container",
      undefined,
      () => ({
        inspect: async () => metadata(),
        dispose: () => {
          throw new Error("dispose failed");
        },
      }),
    );

    expect(result.status).toBe("failed");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "resource_disposal_failed" }),
      ]),
    );
  });
});

describe("verifyExportWithSink", () => {
  it("passes custom sink request metadata through unchanged", async () => {
    const expected = resultFixture();
    const sink = vi.fn(async () => expected);
    const request = {
      mode: "container" as const,
      expectation,
      metadata: {
        source: "custom" as const,
        byteLength: 1234,
        mimeType: "video/mp4",
        label: "rereadable-file-handle",
        attributes: { region: "local" },
      },
    };

    await expect(verifyExportWithSink(sink, request)).resolves.toBe(expected);
    expect(sink).toHaveBeenCalledWith(request);
  });

  it("keeps non-rereadable custom sinks explicitly unverified", () => {
    const result = unverifiedExportForSink(expectation, "container", {
      source: "custom",
      byteLength: null,
      mimeType: "video/mp4",
    });
    expect(result.status).toBe("unverified");
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "verification_sink_unavailable" }),
    ]);
  });
});

type FakeInspection = {
  hasVideo: boolean;
  width: number;
  height: number;
  videoDurationSeconds: number;
  hasAudio: boolean;
  audioDurationSeconds: number;
  decodedVideoFrames: number;
  pixelAccessAvailable: boolean;
  hasNonblankVideoFrame: boolean;
  decodedAudioSamples: number;
  hasAudibleAudio: boolean;
};

function metadata(overrides: Partial<FakeInspection> = {}): FakeInspection {
  return {
    hasVideo: true,
    width: expectation.width,
    height: expectation.height,
    videoDurationSeconds: expectation.durationSeconds,
    hasAudio: true,
    audioDurationSeconds: expectation.durationSeconds,
    decodedVideoFrames: 0,
    pixelAccessAvailable: false,
    hasNonblankVideoFrame: false,
    decodedAudioSamples: 0,
    hasAudibleAudio: false,
    ...overrides,
  };
}

function inspector(
  value: ReturnType<typeof metadata>,
): ExportVerificationInspector {
  return {
    inspect: async () => value,
    dispose: () => undefined,
  };
}

async function verifyWith(value: ReturnType<typeof metadata>) {
  return __verifyExportBlobWithInspector(
    blob,
    expectation,
    "container",
    undefined,
    () => inspector(value),
  );
}

function check(result: ExportVerificationResult, id: string) {
  const found = result.checks.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing verification check ${id}.`);
  return found;
}

function resultFixture(): ExportVerificationResult {
  return {
    mode: "container",
    status: "verified",
    expectation,
    requestMetadata: {
      source: "custom",
      byteLength: 1234,
      mimeType: "video/mp4",
    },
    checks: [],
    issues: [],
  };
}
