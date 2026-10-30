import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Scene } from "@dojo-video-engine/schema";
import type { ResolvedAssets } from "@dojo-video-engine/renderer-canvas2d";
// This suite isolates scheduling/ownership; real codec timing and container
// repair have their own numerical, metadata and decoded-browser checks.
vi.mock("./aac-encoder-timing.js", () => ({
  measureAacEncoderTiming: async () => ({
    primingSamples: 0,
    timestampLeadSamples: 0,
    encoderConfig: {},
  }),
  audioEncoderConfigKey: () => "fixture",
}));
vi.mock("./mp4-aac-target.js", async (original) => ({
  ...(await original<typeof import("./mp4-aac-target.js")>()),
  repairAacBlob: async (blob: Blob) => blob,
}));

const observed = vi.hoisted(() => ({
  events: [] as string[],
  samples: [] as Array<{ timestamp: number; data: Float32Array }>,
  videoAdd: undefined as (() => Promise<void>) | undefined,
  audioAdd: undefined as (() => Promise<void>) | undefined,
  assets: undefined as unknown,
}));
vi.mock("mediabunny", async (importOriginal) => ({
  ...(await importOriginal<typeof import("mediabunny")>()),
  getFirstEncodableVideoCodec: async () => "avc",
  getFirstEncodableAudioCodec: async () => "aac",
  BufferTarget: class {
    buffer = new ArrayBuffer(32);
  },
  CanvasSource: class {
    async add(timestamp: number) {
      observed.events.push(`video:${timestamp}`);
      await observed.videoAdd?.();
    }
  },
  AudioSample: class {
    data: Float32Array;
    timestamp: number;
    constructor(options: { data: Float32Array; timestamp: number }) {
      this.data = options.data;
      this.timestamp = options.timestamp;
    }
    close() {
      observed.events.push(`close-audio:${this.timestamp}`);
    }
  },
  AudioSampleSource: class {
    async add(sample: { data: Float32Array; timestamp: number }) {
      observed.samples.push(sample);
      observed.events.push(`audio:${sample.timestamp}`);
      await observed.audioAdd?.();
    }
  },
  Output: class {
    addVideoTrack() {}
    addAudioTrack() {}
    async start() {
      observed.events.push("start");
    }
    async finalize() {
      observed.events.push("finalize");
    }
    async cancel() {
      observed.events.push("cancel");
    }
  },
}));
vi.mock("@dojo-video-engine/renderer-canvas2d", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@dojo-video-engine/renderer-canvas2d")
  >()),
  prepareFrame: async () => undefined,
  renderStill: () => {},
  resolveAssets: async () => observed.assets,
  disposeAssetsAsync: async () => {
    observed.events.push("dispose-assets");
  },
}));
import { exportVideo } from "./index.js";

function fixture() {
  let visits = 0;
  const planVisits: number[] = [];
  const audioNode = {
    id: "tone",
    type: "audio" as const,
    assetId: "tone",
    duration: 6,
  };
  Object.defineProperty(audioNode, "children", {
    get: () => {
      visits++;
      return [];
    },
  });
  const scene: Scene = {
    schemaVersion: 1,
    width: 16,
    height: 16,
    fps: 2,
    duration: 6,
    assets: { tone: { id: "tone", type: "audio", src: "tone.wav" } },
    nodes: [audioNode],
  };
  const sink = {
    async *samples(start: number, end: number) {
      observed.events.push(`decode:${start}`);
      planVisits.push(visits);
      yield {
        timestamp: start,
        numberOfFrames: Math.round((end - start) * 48000),
        numberOfChannels: 1,
        copyTo(target: Float32Array) {
          target.fill(0.25);
        },
        close() {
          observed.events.push(`close-pcm:${start}`);
        },
      };
    },
  };
  const assets = {
    audio: new Map([
      [
        "tone",
        {
          input: {},
          duration: 3,
          sampleRate: 48000,
          numberOfChannels: 1,
          sink,
        },
      ],
    ]),
    videos: new Map(),
    images: new Map(),
    fonts: new Map(),
    videoFrames: new Map(),
    lotties: new Map(),
    lottieFrames: new Map(),
  } as unknown as ResolvedAssets;
  observed.assets = assets;
  return { scene, assets, sink, planVisits };
}

describe("bounded export audio pipeline", () => {
  beforeEach(() => {
    observed.events.length = 0;
    observed.samples.length = 0;
    observed.videoAdd = undefined;
    observed.audioAdd = undefined;
    for (const name of [
      "VideoEncoder",
      "VideoFrame",
      "AudioDecoder",
      "VideoDecoder",
    ])
      vi.stubGlobal(name, class {});
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return {};
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("overlaps independent audio, appends in order, and traverses placements only once across chunks", async () => {
    const f = fixture();
    await exportVideo({ ...f, audioChunkSeconds: 1, verification: "none" });
    expect(observed.samples.map((sample) => sample.timestamp)).toEqual([
      0, 1, 2,
    ]);
    expect(observed.events).toContain("decode:-0.1");
    expect(observed.events.indexOf("decode:-0.1")).toBeLessThan(
      observed.events.indexOf("video:0"),
    );
    expect(observed.events.indexOf("audio:0")).toBeLessThan(
      observed.events.indexOf("video:1"),
    );
    expect(observed.events.indexOf("close-audio:0")).toBeLessThan(
      // The next one-second output chunk warms its decoder from 0.9s.
      observed.events.indexOf("decode:0.9"),
    );
    expect(f.planVisits).toHaveLength(3);
    expect(new Set(f.planVisits).size).toBe(1);
    expect(
      observed.samples.every(
        (sample) => sample.data.length === 96000 && sample.data[0] === 0.25,
      ),
    ).toBe(true);
  });

  it("keeps shared video/audio Input reads serial", async () => {
    const f = fixture();
    const input = f.assets.audio.get("tone")!.input;
    f.assets.videos.set("video", { input } as never);
    await exportVideo({ ...f, audioChunkSeconds: 1, verification: "none" });
    expect(observed.events).toContain("decode:-0.1");
    expect(observed.events.indexOf("decode:-0.1")).toBeGreaterThan(
      observed.events.indexOf("video:2.5"),
    );
    expect(observed.samples.map((sample) => sample.timestamp)).toEqual([
      0, 1, 2,
    ]);
  });

  it("retains at most one prepared chunk while an audio append is backpressured", async () => {
    const f = fixture();
    let release!: () => void;
    observed.audioAdd = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const exporting = exportVideo({
      ...f,
      audioChunkSeconds: 1,
      verification: "none",
    });
    await vi.waitFor(() => expect(observed.samples).toHaveLength(1));
    expect(
      observed.events.filter((event) => event.startsWith("decode:")),
    ).toEqual(["decode:-0.1"]);
    expect(observed.events).not.toContain("video:1");
    observed.audioAdd = undefined;
    release();
    await exporting;
    expect(observed.samples).toHaveLength(3);
  });

  it("appends silent windows without shifting later audio", async () => {
    const f = fixture();
    f.scene.nodes = [
      { ...f.scene.nodes[0]!, duration: 2 },
      { ...f.scene.nodes[0]!, id: "tail", from: 4, duration: 2 },
    ];
    await exportVideo({ ...f, audioChunkSeconds: 1, verification: "none" });
    expect(observed.samples.map((sample) => sample.timestamp)).toEqual([
      0, 1, 2,
    ]);
    expect(observed.samples.map((sample) => sample.data[0])).toEqual([
      0.25, 0, 0.25,
    ]);
  });

  it("drains cancelled pending decoding before disposing owned assets", async () => {
    const f = fixture();
    const controller = new AbortController();
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.sink.samples = async function* () {
      observed.events.push("decode:pending");
      await ready;
      yield {
        timestamp: 0,
        numberOfFrames: 1,
        numberOfChannels: 1,
        copyTo() {},
        close() {
          observed.events.push("close-pending-pcm");
        },
      };
    };
    observed.videoAdd = async () => {
      controller.abort(new Error("stop export"));
    };
    const exporting = exportVideo({
      scene: f.scene,
      audioChunkSeconds: 1,
      verification: "none",
      signal: controller.signal,
    });
    const rejected = expect(exporting).rejects.toThrow("stop export");
    await vi.waitFor(() => expect(observed.events).toContain("cancel"));
    expect(observed.events).not.toContain("dispose-assets");
    release();
    await rejected;
    expect(observed.events.indexOf("close-pending-pcm")).toBeLessThan(
      observed.events.indexOf("dispose-assets"),
    );
    expect(observed.events).not.toContain("finalize");
  });

  it("propagates pending audio failure and cancels output without appending a partial chunk", async () => {
    const f = fixture();
    f.sink.samples = async function* () {
      throw new Error("bad audio packet");
    };
    await expect(
      exportVideo({ ...f, audioChunkSeconds: 1, verification: "none" }),
    ).rejects.toThrow("bad audio packet");
    expect(observed.events).toContain("cancel");
    expect(observed.events).not.toContain("finalize");
    expect(observed.samples).toHaveLength(0);
  });
});
