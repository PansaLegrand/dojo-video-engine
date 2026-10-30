import { afterEach, describe, expect, it, vi } from "vitest";
import { disposeAssetsAsync, resolveAssets, FontAssetCache } from "./index.js";
import * as policy from "./media-lifecycle.js";

function imageScene(count = 1) {
  return {
    schemaVersion: 1 as const,
    width: 32,
    height: 32,
    fps: 30,
    duration: 1,
    assets: Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        `image-${index}`,
        {
          id: `image-${index}`,
          type: "image" as const,
          src: `https://assets.test/${index}.png`,
        },
      ]),
    ),
    nodes: Array.from({ length: count }, (_, index) => ({
      id: `node-${index}`,
      type: "img" as const,
      assetId: `image-${index}`,
    })),
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("bounded asset preparation", () => {
  it("consumes a policy-bounded native Blob without joining a whole-file byte array", async () => {
    const bytes = vi
      .spyOn(policy, "readResponseBytes")
      .mockRejectedValue(new Error("full-file JS byte read"));
    const blobs = vi.spyOn(Response.prototype, "blob");
    const decoded: Blob[] = [];
    vi.stubGlobal("createImageBitmap", async (blob: Blob) => {
      decoded.push(blob);
      return { width: 1, height: 1, close: vi.fn() };
    });
    const fetch = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "image/png" },
        }),
    );
    const scene = imageScene();
    const assets = await resolveAssets(scene, {
      assetPolicy: {
        fetch,
        allowedOrigins: ["https://assets.test"],
        allowedMimeTypes: ["image/png"],
        maxBytes: 3,
      },
    });
    expect(bytes).not.toHaveBeenCalled();
    expect(blobs).toHaveBeenCalledOnce();
    expect(decoded[0]?.type).toBe("image/png");
    expect(decoded[0]?.size).toBe(3);
    expect([...new Uint8Array(await decoded[0]!.arrayBuffer())]).toEqual([
      1, 2, 3,
    ]);
    await disposeAssetsAsync(assets);
  });

  it("still rejects oversized streamed bodies before decoding and cancels their reader", async () => {
    const cancelled = vi.fn();
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    let chunk = 0;
    const fetch = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              if (chunk++ < 2) controller.enqueue(new Uint8Array(3));
            },
            cancel: cancelled,
          }),
          { headers: { "content-type": "image/png" } },
        ),
    );
    await expect(
      resolveAssets(imageScene(), { assetPolicy: { fetch, maxBytes: 4 } }),
    ).rejects.toThrow("4-byte media limit");
    expect(decode).not.toHaveBeenCalled();
    expect(cancelled).toHaveBeenCalled();
  });

  it("starts at most four image creators and completes queued resources without leaks", async () => {
    let active = 0,
      peak = 0;
    const releases: Array<() => void> = [];
    const images: Array<{
      width: number;
      height: number;
      close: ReturnType<typeof vi.fn>;
    }> = [];
    const decode = vi.fn(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active--;
      const image = { width: 1, height: 1, close: vi.fn() };
      images.push(image);
      return image;
    });
    vi.stubGlobal("createImageBitmap", decode);
    const resolving = resolveAssets(imageScene(8), {
      assetPolicy: {
        fetch: async () =>
          new Response(new Uint8Array([1]), {
            headers: { "content-type": "image/png" },
          }),
      },
    });
    await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(4));
    releases.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(8));
    releases.splice(0).forEach((release) => release());
    const assets = await resolving;
    expect(peak).toBe(4);
    expect(assets.images.size).toBe(8);
    await disposeAssetsAsync(assets);
    expect(images.every((image) => image.close.mock.calls.length === 1)).toBe(
      true,
    );
  });

  it("does not start queued creators after one fails and closes already-started images", async () => {
    const releases: Array<() => void> = [];
    const images: Array<{
      width: number;
      height: number;
      close: ReturnType<typeof vi.fn>;
    }> = [];
    let rejectFirst!: (error: Error) => void;
    const decode = vi.fn(async () => {
      const index = decode.mock.calls.length;
      if (index === 1)
        return new Promise<never>((_resolve, reject) => {
          rejectFirst = reject;
        });
      await new Promise<void>((resolve) => releases.push(resolve));
      const image = { width: 1, height: 1, close: vi.fn() };
      images.push(image);
      return image;
    });
    vi.stubGlobal("createImageBitmap", decode);
    const pending = resolveAssets(imageScene(8), {
      assetPolicy: { fetch: async () => new Response(new Uint8Array([1])) },
    });
    const failure = expect(pending).rejects.toThrow(
      'Failed to load image asset "image-0"',
    );
    await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(4));
    rejectFirst(new Error("image corrupt"));
    await Promise.resolve();
    await Promise.resolve();
    releases.splice(0).forEach((release) => release());
    await failure;
    expect(decode).toHaveBeenCalledTimes(4);
    expect(images).toHaveLength(3);
    expect(images.every((image) => image.close.mock.calls.length === 1)).toBe(
      true,
    );
  });

  it("cancels stalled Blob reads and skips queued fetches", async () => {
    const controller = new AbortController(),
      cancel = vi.fn(),
      decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    const fetch = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(stream) {
              stream.enqueue(new Uint8Array([1]));
            },
            cancel,
          }),
        ),
    );
    const pending = resolveAssets(imageScene(9), {
      signal: controller.signal,
      assetPolicy: { fetch },
    });
    const rejected = expect(pending).rejects.toThrow("cancel assets");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    controller.abort(new Error("cancel assets"));
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(decode).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(4);
  });

  it("leaves shared font-cache aliases outside creator slots", async () => {
    const gates: Array<() => void> = [];
    let active = 0,
      peak = 0;
    class Font {
      constructor(readonly family: string) {}
      async load() {
        active++;
        peak = Math.max(peak, active);
        await new Promise<void>((resolve) => gates.push(resolve));
        active--;
        return this;
      }
    }
    const fontSet = { add: vi.fn(), delete: vi.fn() };
    vi.stubGlobal("FontFace", Font);
    vi.stubGlobal("fonts", fontSet);
    const cache = new FontAssetCache({ maxEntries: 12, fontSet });
    const assets = Object.fromEntries(
      Array.from({ length: 6 }, (_, index) => [
        `font-${index}`,
        {
          id: `font-${index}`,
          type: "font" as const,
          src: "data:font/woff2;base64,AA==",
        },
      ]),
    );
    const scene = {
      schemaVersion: 1 as const,
      width: 32,
      height: 32,
      fps: 30,
      duration: 1,
      assets,
      nodes: Object.keys(assets).map((id) => ({
        id: `text-${id}`,
        type: "text" as const,
        text: "Text",
        style: { fontFamily: id },
      })),
    };
    const first = resolveAssets(scene, { fontCache: cache as never });
    await vi.waitFor(() => expect(gates).toHaveLength(4));
    const alias = resolveAssets(scene, { fontCache: cache as never });
    gates.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(gates).toHaveLength(2));
    gates.splice(0).forEach((release) => release());
    const [one, two] = await Promise.all([first, alias]);
    expect(peak).toBe(4);
    for (const id of Object.keys(assets))
      expect(one.fonts.get(id)).toBe(two.fonts.get(id));
    await disposeAssetsAsync(one);
    expect(cache.stats.activeLeases).toBe(6);
    await disposeAssetsAsync(two);
    expect(cache.stats.activeLeases).toBe(0);
  });
});
