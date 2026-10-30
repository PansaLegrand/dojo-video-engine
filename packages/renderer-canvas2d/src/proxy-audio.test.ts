import { afterEach, describe, expect, it, vi } from "vitest";
import { parseScene } from "@dojo-video-engine/schema";
import { disposeAssetsAsync, resolveAssets } from "./index.js";

const state = vi.hoisted(() => ({
  inputs: [] as any[],
  proxyHasAudio: false,
  originalHasAudio: true,
  failAudio: false,
  holdAudio: false,
}));
vi.mock("mediabunny", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mediabunny")>();
  return {
    ...actual,
    BlobSource: class {
      constructor(readonly blob: Blob) {}
    },
    AudioSampleSink: class {
      constructor(readonly track: { name: string }) {}
    },
    Input: class {
      disposed = false;
      role: string;
      rejectAudio?: (error: Error) => void;
      videoReads = 0;
      audioReads = 0;
      dispose = vi.fn(() => {
        this.disposed = true;
        this.rejectAudio?.(new Error("Disposed"));
      });
      constructor(options: { source: { blob: Blob } }) {
        this.role = options.source.blob.size === 5 ? "proxy" : "original";
        state.inputs.push(this);
      }
      async getPrimaryVideoTrack() {
        this.videoReads++;
        return {
          displayWidth: this.role === "proxy" ? 960 : 3840,
          displayHeight: this.role === "proxy" ? 540 : 2160,
        };
      }
      async getPrimaryAudioTrack() {
        this.audioReads++;
        if (this.role === "original" && state.failAudio)
          throw new Error("Original audio unavailable");
        if (this.role === "original" && state.holdAudio)
          await new Promise((_, reject) => {
            this.rejectAudio = reject;
          });
        return (
          this.role === "proxy" ? state.proxyHasAudio : state.originalHasAudio
        )
          ? {
              name: this.role + "-audio",
              sampleRate: 48000,
              numberOfChannels: 2,
            }
          : null;
      }
      async computeDuration() {
        return 2;
      }
    },
  };
});
afterEach(() => {
  state.inputs = [];
  state.proxyHasAudio = false;
  state.originalHasAudio = true;
  state.failAudio = false;
  state.holdAudio = false;
  vi.unstubAllGlobals();
});
function fixture() {
  const fetch = vi.fn(
    async (input: RequestInfo | URL) =>
      new Response(String(input).includes("proxy") ? "proxy" : "original", {
        headers: { "content-type": "video/mp4" },
      }),
  );
  const scene = parseScene({
    schemaVersion: 1,
    width: 3840,
    height: 2160,
    fps: 30,
    duration: 60,
    assets: {
      movie: {
        id: "movie",
        type: "video",
        src: "https://media.test/original.mp4",
        sourceMode: "buffer",
        proxy: { src: "https://media.test/proxy.mp4", width: 960, height: 540 },
        metadata: { hasAudio: true, contentHash: "stable-original-content" },
      },
    },
    nodes: [{ id: "movie", type: "video", assetId: "movie", duration: 60 }],
  });
  return { scene, policy: { fetch, allowedOrigins: ["https://media.test"] } };
}
describe("opt-in original audio for picture proxies", () => {
  it("keeps legacy proxy audio behavior unless explicitly selected", async () => {
    state.proxyHasAudio = true;
    const f = fixture();
    const assets = await resolveAssets(f.scene, {
      preferProxy: true,
      assetPolicy: f.policy,
    });
    expect(state.inputs).toHaveLength(1);
    expect(assets.videos.get("movie")?.audioInput).toBeUndefined();
    expect(
      (
        assets.videos.get("movie")?.audio?.sink as unknown as {
          track: { name: string };
        }
      ).track.name,
    ).toBe("proxy-audio");
    await disposeAssetsAsync(assets);
    expect(state.inputs[0].dispose).toHaveBeenCalledOnce();
  });
  it("borrows original sound without querying its video track and retains both Inputs until the final lease", async () => {
    const f = fixture(),
      options = {
        preferProxy: true,
        videoProxyAudio: "original" as const,
        assetPolicy: f.policy,
      };
    const first = await resolveAssets(f.scene, options);
    const second = await resolveAssets(
      { ...f.scene, duration: 90 },
      { ...options, reuseFrom: { scene: f.scene, assets: first } },
    );
    expect(state.inputs).toHaveLength(2);
    expect(state.inputs[1].videoReads).toBe(0);
    expect(state.inputs[0].audioReads).toBe(0);
    expect(first.videos.get("movie")).toBe(second.videos.get("movie"));
    expect(first.videos.get("movie")?.audioInput).toBe(state.inputs[1]);
    expect(
      (
        first.videos.get("movie")?.audio?.sink as unknown as {
          track: { name: string };
        }
      ).track.name,
    ).toBe("original-audio");
    await disposeAssetsAsync(first);
    expect(state.inputs.every((input) => !input.disposed)).toBe(true);
    await disposeAssetsAsync(second);
    await disposeAssetsAsync(second);
    expect(
      state.inputs.every((input) => input.dispose.mock.calls.length === 1),
    ).toBe(true);
  });
  it.each(["original", "proxy"])(
    "invalidates reuse when the %s descriptor changes despite a stable content hash",
    async (changed) => {
      const f = fixture(),
        options = {
          preferProxy: true,
          videoProxyAudio: "original" as const,
          assetPolicy: f.policy,
        };
      const first = await resolveAssets(f.scene, options);
      const asset = f.scene.assets.movie!;
      const next = {
        ...f.scene,
        assets: {
          movie: {
            ...asset,
            ...(changed === "original"
              ? { src: "https://media.test/original-next.mp4" }
              : {
                  proxy: {
                    ...asset.proxy!,
                    src: "https://media.test/proxy-next.mp4",
                  },
                }),
          },
        },
      };
      const second = await resolveAssets(next, {
        ...options,
        reuseFrom: { scene: f.scene, assets: first },
      });
      expect(second.videos.get("movie")).not.toBe(first.videos.get("movie"));
      expect(state.inputs).toHaveLength(4);
      await disposeAssetsAsync(first);
      expect(state.inputs.slice(0, 2).every((input) => input.disposed)).toBe(
        true,
      );
      expect(state.inputs.slice(2).every((input) => !input.disposed)).toBe(
        true,
      );
      await disposeAssetsAsync(second);
      expect(
        state.inputs.every((input) => input.dispose.mock.calls.length === 1),
      ).toBe(true);
    },
  );
  it("closes both Inputs if original-audio preparation fails", async () => {
    const f = fixture();
    state.failAudio = true;
    await expect(
      resolveAssets(f.scene, {
        preferProxy: true,
        videoProxyAudio: "original",
        assetPolicy: f.policy,
      }),
    ).rejects.toThrow("Original audio unavailable");
    expect(state.inputs).toHaveLength(2);
    expect(
      state.inputs.every((input) => input.dispose.mock.calls.length === 1),
    ).toBe(true);
  });
  it("cancels both Inputs during pending original-audio preparation", async () => {
    const f = fixture(),
      controller = new AbortController();
    state.holdAudio = true;
    const pending = resolveAssets(f.scene, {
      preferProxy: true,
      videoProxyAudio: "original",
      assetPolicy: f.policy,
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(state.inputs[1]?.audioReads).toBe(1));
    controller.abort();
    await expect(pending).rejects.toBeDefined();
    expect(
      state.inputs.every((input) => input.dispose.mock.calls.length === 1),
    ).toBe(true);
  });
  it("does not open a primary soundtrack input for confirmed silent originals", async () => {
    const f = fixture();
    state.proxyHasAudio = true;
    const assets = await resolveAssets(
      {
        ...f.scene,
        assets: {
          movie: { ...f.scene.assets.movie!, metadata: { hasAudio: false } },
        },
      },
      { preferProxy: true, videoProxyAudio: "original", assetPolicy: f.policy },
    );
    expect(state.inputs).toHaveLength(1);
    expect(state.inputs[0].audioReads).toBe(0);
    expect(assets.videos.get("movie")?.audio).toBeUndefined();
    await disposeAssetsAsync(assets);
  });
  it("leaves original-media resolution unchanged when proxies are not selected", async () => {
    const f = fixture();
    const assets = await resolveAssets(f.scene, {
      preferProxy: false,
      videoProxyAudio: "original",
      assetPolicy: f.policy,
    });
    expect(state.inputs).toHaveLength(1);
    expect(state.inputs[0].role).toBe("original");
    expect(state.inputs[0].videoReads).toBe(1);
    expect(assets.videos.get("movie")?.audioInput).toBeUndefined();
    await disposeAssetsAsync(assets);
  });
});
