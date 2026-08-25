import { describe, expect, it, vi } from "vitest";
import {
  AudioAnalysisCache,
  FontAssetCache,
  createBoundedAssetFetch,
  fetchAssetBounded,
  prepareAssetRequest,
  readResponseBytes,
  type MediaAssetLike,
} from "./media-lifecycle.js";

const asset: MediaAssetLike = {
  id: "clip",
  type: "video",
  src: "https://origin.example/video.mp4",
};

function response(
  body: BodyInit | null,
  init: ResponseInit & { contentLength?: number } = {},
): Response {
  const { contentLength, ...responseInit } = init;
  const headers = new Headers(responseInit.headers);
  if (contentLength !== undefined)
    headers.set("content-length", String(contentLength));
  return new Response(body, { ...responseInit, headers });
}

describe("media asset policy", () => {
  it("resolves a derived proxy and applies host authorization, headers, and credentials", async () => {
    const authorize = vi.fn();
    const prepared = await prepareAssetRequest(asset, {
      preferProxy: true,
      signal: new AbortController().signal,
      policy: {
        resolveProxy: async (current) => `${current.src}?proxy=derived`,
        allowedSchemes: ["https"],
        allowedHosts: ["origin.example"],
        headers: { Authorization: "Bearer token" },
        credentials: "include",
        contentKey: () => "sha256:stable-clip",
        authorizeSource: authorize,
      },
    });

    expect(prepared.source).toBe(
      "https://origin.example/video.mp4?proxy=derived",
    );
    expect(prepared.sourceKind).toBe("derived-proxy");
    expect(new Headers(prepared.init.headers).get("authorization")).toBe(
      "Bearer token",
    );
    expect(prepared.init.credentials).toBe("include");
    expect(prepared.contentKey).toBe("sha256:stable-clip");
    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({ source: prepared.source }),
    );
  });

  it("records an explicit proxy opt-out as the primary source", async () => {
    const prepared = await prepareAssetRequest(
      { ...asset, proxy: { src: "https://proxy.example/video.mp4" } },
      {
        preferProxy: true,
        policy: { resolveProxy: () => null },
      },
    );
    expect(prepared).toMatchObject({
      source: asset.src,
      sourceKind: "primary",
    });
  });

  it("disables automatic redirect following for allowlisted sources", async () => {
    let forbiddenRequests = 0;
    await expect(
      fetchAssetBounded(asset, {
        requestInit: { redirect: "follow" },
        policy: {
          allowedHosts: ["origin.example"],
          fetch: async (input, init) => {
            if (String(input).includes("evil.example")) forbiddenRequests += 1;
            expect(init?.redirect).toBe("error");
            throw new TypeError("redirect blocked before follow");
          },
        },
      }),
    ).rejects.toThrow("redirect blocked before follow");
    expect(forbiddenRequests).toBe(0);
  });

  it("also disables automatic redirects for callback-only authorization", async () => {
    await expect(
      fetchAssetBounded(asset, {
        policy: {
          authorizeSource: () => true,
          fetch: async (_input, init) => {
            expect(init?.redirect).toBe("error");
            throw new TypeError("callback policy blocked redirect following");
          },
        },
      }),
    ).rejects.toThrow("callback policy blocked redirect following");
  });

  it("preserves declared sources by default and rejects unauthorized schemes/origins", async () => {
    await expect(prepareAssetRequest(asset)).resolves.toMatchObject({
      source: asset.src,
    });
    await expect(
      prepareAssetRequest(asset, { policy: { allowedSchemes: ["blob"] } }),
    ).rejects.toThrow(/scheme/);
    await expect(
      prepareAssetRequest(asset, {
        policy: { allowedOrigins: ["https://other.example"] },
      }),
    ).rejects.toThrow(/origin/);
    await expect(
      prepareAssetRequest(asset, { policy: { authorizeSource: () => false } }),
    ).rejects.toThrow(/authorization/);
    await expect(
      prepareAssetRequest(
        { ...asset, src: `${asset.src}?token=must-not-leak` },
        { policy: { allowedSchemes: ["blob"] } },
      ),
    ).rejects.not.toThrow(/must-not-leak/);
  });

  it("refreshes a signed URL once after an authorization response", async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return calls.length === 1
        ? response("expired", { status: 403 })
        : response("ok", { status: 200 });
    });
    const result = await fetchAssetBounded(asset, {
      policy: {
        fetch: fetchFn,
        refreshSignedUrl: () => "https://signed.example/video.mp4?token=fresh",
      },
    });

    expect(await result.text()).toBe("ok");
    expect(calls).toEqual([
      asset.src,
      "https://signed.example/video.mp4?token=fresh",
    ]);
  });

  it("lets refreshed source credentials replace stale request credentials", async () => {
    const authorizations: Array<string | null> = [];
    await fetchAssetBounded(asset, {
      requestInit: { headers: { Authorization: "old" } },
      policy: {
        fetch: async (_input, init) => {
          authorizations.push(new Headers(init?.headers).get("authorization"));
          return authorizations.length === 1
            ? response("expired", { status: 403 })
            : response("ok", { status: 200 });
        },
        refreshSignedUrl: () => ({
          src: "https://signed.example/video.mp4",
          headers: { Authorization: "new" },
        }),
      },
    });
    expect(authorizations).toEqual(["old", "new"]);
  });

  it("validates MIME and declared/header/stream byte limits", async () => {
    const mimeFetch = vi.fn(async () =>
      response("1234", {
        status: 200,
        headers: { "content-type": "application/json" },
        contentLength: 4,
      }),
    );
    await expect(
      fetchAssetBounded(asset, {
        policy: { fetch: mimeFetch, allowedMimeTypes: ["video/mp4"] },
      }),
    ).rejects.toThrow(/MIME/);

    const fetchFn = vi.fn(async () =>
      response("1234", {
        status: 200,
        headers: { "content-type": "video/mp4" },
        contentLength: 4,
      }),
    );
    await expect(
      fetchAssetBounded(asset, {
        policy: {
          fetch: fetchFn,
          maxBytes: 3,
          allowedMimeTypes: ["video/mp4"],
        },
      }),
    ).rejects.toThrow(/Declared size|MIME|limit/);

    await expect(
      prepareAssetRequest(
        { ...asset, metadata: { byteLength: 9 } },
        {
          policy: { maxBytes: 8 },
        },
      ),
    ).rejects.toThrow(/Declared size/);

    await expect(
      readResponseBytes(
        response("12", {
          status: 206,
          headers: { "content-range": "bytes 0-1/20" },
        }),
        { maxBytes: 10 },
      ),
    ).rejects.toThrow(/total size/);

    const streamed = response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.enqueue(new Uint8Array([4, 5, 6]));
          controller.close();
        },
      }),
      { status: 200 },
    );
    await expect(readResponseBytes(streamed, { maxBytes: 5 })).rejects.toThrow(
      /limit/,
    );
  });

  it("cancels bodies rejected by MIME and redirect policy", async () => {
    const mimeCancel = vi.fn();
    const mimeResponse = response(
      new ReadableStream<Uint8Array>({ cancel: mimeCancel }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
    await expect(
      fetchAssetBounded(asset, {
        policy: {
          fetch: async () => mimeResponse,
          allowedMimeTypes: ["video/mp4"],
        },
      }),
    ).rejects.toThrow(/MIME/);
    expect(mimeCancel).toHaveBeenCalledOnce();

    const redirectCancel = vi.fn();
    const redirected = response(
      new ReadableStream<Uint8Array>({ cancel: redirectCancel }),
      { status: 200 },
    );
    Object.defineProperty(redirected, "url", {
      value: "https://evil.example/video.mp4",
    });
    await expect(
      fetchAssetBounded(asset, {
        policy: {
          fetch: async () => redirected,
          allowedHosts: ["origin.example"],
        },
      }),
    ).rejects.toThrow(/host/);
    expect(redirectCancel).toHaveBeenCalledOnce();
  });

  it("propagates cancellation while reading a response", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    await expect(
      readResponseBytes(response("body"), { signal: controller.signal }),
    ).rejects.toThrow("cancelled");
  });

  it("cancels a pending stream read immediately when aborted", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const streamed = response(
      new ReadableStream<Uint8Array>({
        pull: () => new Promise(() => undefined),
        cancel,
      }),
      { status: 200 },
    );
    const reading = readResponseBytes(streamed, { signal: controller.signal });
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
    controller.abort(new Error("cancel pending read"));

    await expect(reading).rejects.toThrow("cancel pending read");
    expect(cancel).toHaveBeenCalled();
  });

  it("rejects promptly when a custom fetch ignores cancellation", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    let finishFetch!: (response: Response) => void;
    const loading = fetchAssetBounded(asset, {
      signal: controller.signal,
      policy: {
        fetch: () =>
          new Promise<Response>((resolve) => {
            finishFetch = resolve;
          }),
      },
    });
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
    controller.abort(new Error("cancel custom fetch"));
    await expect(loading).rejects.toThrow("cancel custom fetch");
    finishFetch(
      response(new ReadableStream<Uint8Array>({ cancel }), { status: 200 }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("bounds a range-reader fetch wrapper cumulatively per asset", async () => {
    const fetchFn = vi.fn(async () =>
      response(new Uint8Array([1, 2, 3]), { status: 200 }),
    );
    const boundedFetch = createBoundedAssetFetch(asset, {
      policy: { fetch: fetchFn, maxBytes: 5 },
    });
    const first = await boundedFetch("https://origin.example/video.mp4", {});
    expect(await readResponseBytes(first)).toHaveLength(3);
    const second = await boundedFetch("https://origin.example/video.mp4", {});
    await expect(readResponseBytes(second)).rejects.toThrow(/limit/);
  });

  it("preserves Request range headers and credentials for range readers", async () => {
    const observed: Array<{
      range: string | null;
      credentials?: RequestCredentials;
    }> = [];
    const boundedFetch = createBoundedAssetFetch(asset, {
      policy: {
        fetch: async (_input, init) => {
          observed.push({
            range: new Headers(init?.headers).get("range"),
            credentials: init?.credentials,
          });
          return response("x", { status: 200 });
        },
      },
    });
    await boundedFetch(
      new Request(asset.src, {
        headers: { Range: "bytes=0-0" },
        credentials: "include",
      }),
    );
    expect(observed).toEqual([{ range: "bytes=0-0", credentials: "include" }]);
  });

  it("aborts a wrapped body whose underlying read ignores cancellation", async () => {
    const controller = new AbortController();
    const result = await fetchAssetBounded(asset, {
      signal: controller.signal,
      policy: {
        fetch: async () =>
          response(
            new ReadableStream<Uint8Array>({
              pull: () => new Promise(() => undefined),
            }),
            { status: 200 },
          ),
      },
    });
    const reading = readResponseBytes(result);
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
    controller.abort(new Error("cancel wrapped body"));
    await expect(reading).rejects.toThrow("cancel wrapped body");
  });

  it("uses a Request signal to cancel a non-cooperative range fetch", async () => {
    const controller = new AbortController();
    const boundedFetch = createBoundedAssetFetch(asset, {
      policy: { fetch: () => new Promise<Response>(() => undefined) },
    });
    const loading = boundedFetch(
      new Request(asset.src, { signal: controller.signal }),
    );
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
    controller.abort(new Error("cancel request signal"));
    await expect(loading).rejects.toThrow("cancel request signal");
  });
});

describe("AudioAnalysisCache", () => {
  it("evicts least-recently-used entries by measured bytes and exposes stats", () => {
    const cache = new AudioAnalysisCache<string>(6, (value) => value.length);
    cache.set("a", "aaa");
    cache.set("b", "bb");
    expect(cache.get("a")).toBe("aaa");
    cache.set("c", "ccc");

    expect(cache.has("b")).toBe(false);
    expect(cache.has("a")).toBe(true);
    expect(cache.stats).toMatchObject({
      entries: 2,
      bytes: 6,
      hits: 1,
      evictions: 1,
      maxBytes: 6,
    });
  });

  it("does not retain a value larger than the budget", () => {
    const cache = new AudioAnalysisCache<string>(2, (value) => value.length);
    cache.set("large", "123");
    expect(cache.size).toBe(0);
    expect(cache.get("large")).toBeUndefined();
    expect(cache.stats.misses).toBe(1);
  });

  it("coalesces concurrent analysis loads and does not poison retries", async () => {
    const cache = new AudioAnalysisCache<string>(20, (value) => value.length);
    let resolve!: (value: string) => void;
    const loader = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    const first = cache.getOrCreate("same", loader);
    const second = cache.getOrCreate("same", loader);
    await Promise.resolve();
    resolve("analysis");
    await expect(Promise.all([first, second])).resolves.toEqual([
      "analysis",
      "analysis",
    ]);
    expect(loader).toHaveBeenCalledOnce();

    await expect(
      cache.getOrCreate("failed", async () => {
        throw new Error("failed once");
      }),
    ).rejects.toThrow("failed once");
    await expect(
      cache.getOrCreate("failed", async () => "retry"),
    ).resolves.toBe("retry");
  });

  it("bounds distinct pending analysis loads", async () => {
    const cache = new AudioAnalysisCache<string>(20, undefined, 1);
    let finish!: (value: string) => void;
    const first = cache.getOrCreate(
      "one",
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    await Promise.resolve();
    await expect(cache.getOrCreate("two", async () => "two")).rejects.toThrow(
      /pending limit/,
    );
    expect(cache.stats).toMatchObject({ pending: 1, maxPending: 1 });
    finish("one");
    await first;
  });
});

describe("FontAssetCache", () => {
  it("deduplicates concurrent loads, reference-counts leases, and evicts unused faces", async () => {
    const added: string[] = [];
    const removed: string[] = [];
    const fontSet = {
      add: (face: string) => void added.push(face),
      delete: (face: string) => {
        removed.push(face);
        return true;
      },
    };
    const cache = new FontAssetCache<string>({
      maxEntries: 1,
      maxBytes: 10,
      fontSet,
      byteSize: (face) => face.length,
    });
    let resolve!: (face: string) => void;
    const loading = new Promise<string>((done) => {
      resolve = done;
    });
    const loader = vi.fn(() => loading);
    const firstPromise = cache.acquire("inter", loader);
    const secondPromise = cache.acquire("inter", () => "wrong");
    resolve("inter-face");
    const first = await firstPromise;
    const second = await secondPromise;

    expect(first.face).toBe("inter-face");
    expect(second.face).toBe(first.face);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(added).toEqual(["inter-face"]);
    expect(cache.stats.activeLeases).toBe(2);

    first.release();
    first.release();
    expect(cache.stats.activeLeases).toBe(1);
    second.release();
    second.release();

    const other = await cache.acquire("roboto", async () => "roboto-face", 5);
    expect(removed).toEqual(["inter-face"]);
    expect(cache.stats.evictions).toBe(1);
    other.release();
  });

  it("refuses a new face when all bounded entries are still leased", async () => {
    const cache = new FontAssetCache<string>({ maxEntries: 1 });
    const lease = await cache.acquire("one", () => "one");
    await expect(cache.acquire("two", () => "two")).rejects.toThrow(/capacity/);
    expect(cache.stats).toMatchObject({ activeLeases: 1, pending: 0 });
    lease.release();
    expect(cache.stats.activeLeases).toBe(0);
    const retry = await cache.acquire("two", () => "two");
    retry.release();
    expect(cache.stats).toMatchObject({ activeLeases: 0, entries: 1 });
  });

  it("reserves capacity before starting distinct pending font loads", async () => {
    const cache = new FontAssetCache<string>({ maxEntries: 1 });
    let finish!: (value: string) => void;
    const first = cache.acquire(
      "one",
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    await Promise.resolve();
    await expect(cache.acquire("two", async () => "two")).rejects.toThrow(
      /capacity/,
    );
    expect(cache.stats).toMatchObject({ pending: 1, activeLeases: 1 });
    finish("one");
    const lease = await first;
    lease.release();
    expect(cache.stats.activeLeases).toBe(0);
  });
});
