import type {
  DisplayContentOperation,
  DisplayGroup,
  DisplayMediaOperation,
  DisplayTextOperation,
} from "@dojo-video-engine/core";
import { describe, expect, it, vi } from "vitest";
import {
  Canvas2DStaticDisplayCache,
  StaticDisplayCache,
  fingerprintStaticDisplayGroup,
  isStaticDisplayGroup,
  type StaticDisplayFingerprint,
  type StaticDisplayResourceReference,
} from "./display-cache.js";
import type { DetachedScratchSurface } from "./surface-pool.js";

class FakeCacheCanvas {
  width: number;
  height: number;
  readonly drawImage = vi.fn();
  readonly clearRect = vi.fn();
  readonly putImageData = vi.fn();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(): CanvasRenderingContext2D {
    return {
      drawImage: this.drawImage,
      clearRect: this.clearRect,
      putImageData: this.putImageData,
    } as unknown as CanvasRenderingContext2D;
  }
}

function detached(
  surface: FakeCacheCanvas,
  requested = { width: 10, height: 8 },
  bucket = { width: 64, height: 64 },
): DetachedScratchSurface {
  return {
    surface: surface as unknown as OffscreenCanvas,
    context: surface.getContext(),
    requested,
    bucket,
    purpose: "test",
    bytes: bucket.width * bucket.height * 4,
  };
}

const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } as const;

function contentFor(
  type: DisplayGroup["nodeType"],
  assetId = "image",
): DisplayContentOperation | null {
  if (type === "img") {
    return {
      kind: "media",
      engineId: "node/root/media",
      nodeId: "root",
      paintOrder: 0,
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      resource: { kind: "image", assetId },
      clip: {
        kind: "rounded-rect",
        rect: { x: 0, y: 0, width: 100, height: 100 },
        radii: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
        fillRule: "nonzero",
        open: false,
      },
      objectFit: "cover",
      objectPosition: "50% 50%",
      intrinsic: null,
      fittedBox: null,
      sampling: { kind: "smooth", quality: "high" },
    } satisfies DisplayMediaOperation;
  }
  if (type === "text") {
    return {
      kind: "text",
      engineId: "node/root/text",
      nodeId: "root",
      paintOrder: 0,
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      value: "Hello",
      font: {
        family: "Inter",
        size: 24,
        weight: 700,
        style: "normal",
      },
      direction: "ltr",
      align: "left",
      baseline: "middle",
      lineHeight: 29,
      letterSpacing: 0,
      fill: "#fff",
      stroke: null,
      shadow: null,
      lines: [],
    } satisfies DisplayTextOperation;
  }
  if (type === "shape") {
    return {
      kind: "shape",
      engineId: "node/root/shape",
      nodeId: "root",
      paintOrder: 0,
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      geometry: {
        kind: "ellipse",
        rect: { x: 0, y: 0, width: 100, height: 100 },
        fillRule: "nonzero",
        open: false,
      },
      fill: { kind: "color", source: "#fff" },
      stroke: null,
    };
  }
  return null;
}

function displayGroup(
  type: DisplayGroup["nodeType"] = "div",
  options: {
    id?: string;
    children?: DisplayGroup[];
    content?: DisplayContentOperation | null;
    assetId?: string;
  } = {},
): DisplayGroup {
  const id = options.id ?? "root";
  const children = options.children ?? [];
  return {
    kind: "group",
    engineId: `node/${id}`,
    nodeId: id,
    nodeType: type,
    node: {
      id,
      type,
      ...(type === "text" ? { text: "Hello" } : {}),
      ...(type === "img" || type === "audio"
        ? { assetId: options.assetId ?? "image" }
        : {}),
      from: 8,
      duration: 30,
      style: {},
      localFrame: 12,
      animations: [],
      children: children.map((child) => child.node),
    },
    paintOrder: 0,
    depth: 0,
    box: { x: 0, y: 0, width: 100, height: 100 },
    contentBox: { x: 0, y: 0, width: 100, height: 100 },
    transform: { ...identity },
    worldTransform: { ...identity },
    transformedBounds: { x: 0, y: 0, width: 100, height: 100 },
    composite: {
      opacity: 1,
      blendMode: "source-over",
      filter: null,
      isolation: false,
      strategy: "direct",
    },
    clip: null,
    overflowClip: null,
    mask: null,
    background: null,
    content:
      options.content === undefined
        ? contentFor(type, options.assetId)
        : options.content,
    border: null,
    children,
  };
}

function fakeFingerprint(
  key: string,
  signature: string,
): StaticDisplayFingerprint {
  return { version: 1, key, signature };
}

describe("isStaticDisplayGroup", () => {
  it("accepts only proven static visual node kinds", () => {
    for (const type of ["div", "text", "img", "shape", "audio"] as const) {
      expect(isStaticDisplayGroup(displayGroup(type))).toBe(true);
    }

    for (const type of ["video", "lottie", "effect", "extension"] as const) {
      expect(isStaticDisplayGroup(displayGroup(type))).toBe(false);
    }
  });

  it("rejects animations and time-dependent descendants in either tree", () => {
    const animated = displayGroup("text");
    animated.node.animations = [
      {
        kind: "keyframes",
        property: "opacity",
        frames: [{ frame: 0, value: 0 }],
      },
    ];
    expect(isStaticDisplayGroup(animated)).toBe(false);

    const hiddenDynamicNode = displayGroup("div");
    hiddenDynamicNode.node.children.push(displayGroup("video").node);
    expect(isStaticDisplayGroup(hiddenDynamicNode)).toBe(false);

    const dynamicChild = displayGroup("div", {
      children: [displayGroup("lottie", { id: "child" })],
    });
    expect(isStaticDisplayGroup(dynamicChild)).toBe(false);
  });

  it("rejects prepared media and malformed visual content", () => {
    const image = displayGroup("img");
    (image.content as DisplayMediaOperation).resource = {
      kind: "prepared-video",
      assetId: "video",
      nodeId: "root",
      sceneFrame: 12,
    };
    expect(isStaticDisplayGroup(image)).toBe(false);
    expect(
      isStaticDisplayGroup(
        displayGroup("audio", { content: contentFor("text") }),
      ),
    ).toBe(false);
  });
});

describe("fingerprintStaticDisplayGroup", () => {
  it("is deterministic and excludes only node activation timing", () => {
    const first = displayGroup("text");
    const second = displayGroup("text");
    second.node.from = 100;
    second.node.duration = 900;
    second.node.localFrame = 500;

    const firstFingerprint = fingerprintStaticDisplayGroup(first);
    const secondFingerprint = fingerprintStaticDisplayGroup(second);
    expect(firstFingerprint).toEqual(secondFingerprint);
    expect(Object.isFrozen(firstFingerprint)).toBe(true);

    (second.content as DisplayTextOperation).fill = "#f00";
    expect(fingerprintStaticDisplayGroup(second)).not.toEqual(firstFingerprint);
  });

  it("incorporates host image and font identities in deterministic order", () => {
    const group = displayGroup("div", {
      children: [
        displayGroup("text", { id: "label" }),
        displayGroup("img", { id: "photo", assetId: "hero" }),
      ],
    });
    const references: string[] = [];
    const initial = fingerprintStaticDisplayGroup(group, {
      resourceIdentity(reference) {
        expect(Object.isFrozen(reference)).toBe(true);
        references.push(
          `${reference.kind}:${"assetId" in reference ? reference.assetId : reference.family}`,
        );
        return reference.kind === "image" ? "image-sha-a" : "font-epoch-a";
      },
    });
    expect(references).toEqual(["image:hero", "font:Inter"]);

    const changedImage = fingerprintStaticDisplayGroup(group, {
      resourceIdentity: (reference) =>
        reference.kind === "image" ? "image-sha-b" : "font-epoch-a",
    });
    const changedFont = fingerprintStaticDisplayGroup(group, {
      resourceIdentity: (reference) =>
        reference.kind === "image" ? "image-sha-a" : "font-epoch-b",
    });
    expect(changedImage.key).not.toBe(initial.key);
    expect(changedFont.key).not.toBe(initial.key);
  });

  it("snapshots inputs and invalidates a later mutation", () => {
    const group = displayGroup("img", { assetId: "hero" });
    const before = fingerprintStaticDisplayGroup(group);
    (group.content as DisplayMediaOperation).sampling = {
      kind: "pixelated",
      pixelSize: 3,
    };

    expect(before.signature).toContain('"kind":"smooth"');
    expect(before.signature).not.toContain("pixelated");
    expect(fingerprintStaticDisplayGroup(group).key).not.toBe(before.key);
  });

  it("refuses to fingerprint a dynamic group", () => {
    expect(() => fingerprintStaticDisplayGroup(displayGroup("video"))).toThrow(
      /proven visually static/,
    );
  });
});

describe("StaticDisplayCache", () => {
  it("tracks exact UTF-8 metadata and value bytes", () => {
    const cache = new StaticDisplayCache<string>({
      maxBytes: 100,
      maxEntries: 2,
      maxKeyBytes: 20,
    });
    const fingerprint = fakeFingerprint("é", "🙂");
    expect(cache.set(fingerprint, "value", 7)).toBe(true);
    expect(cache.stats()).toMatchObject({
      entries: 1,
      bytes: 13,
      valueBytes: 7,
      keyBytes: 6,
    });
    expect(cache.get(fingerprint)).toBe("value");
  });

  it("evicts least-recently-used values and disposes each retained value once", () => {
    const dispose = vi.fn();
    const cache = new StaticDisplayCache<string>({
      maxBytes: 10,
      maxEntries: 2,
      maxKeyBytes: 4,
      dispose,
    });
    const a = fakeFingerprint("a", "A");
    const b = fakeFingerprint("b", "B");
    const c = fakeFingerprint("c", "C");
    expect(cache.set(a, "A", 2)).toBe(true);
    expect(cache.set(b, "B", 2)).toBe(true);
    expect(cache.get(a)).toBe("A");
    expect(cache.set(c, "C", 2)).toBe(true);

    expect(cache.get(b)).toBeUndefined();
    expect(dispose).toHaveBeenCalledWith("B", "evict");
    expect(cache.delete(a)).toBe(true);
    expect(dispose).toHaveBeenCalledWith("A", "delete");
    cache.clear();
    expect(dispose).toHaveBeenCalledWith("C", "clear");
    expect(dispose).toHaveBeenCalledTimes(3);
    expect(cache.stats()).toMatchObject({ entries: 0, bytes: 0, evictions: 1 });
  });

  it("deep-checks signatures and never serves a digest collision", () => {
    const dispose = vi.fn();
    const cache = new StaticDisplayCache<string>({
      maxBytes: 100,
      maxEntries: 2,
      maxKeyBytes: 30,
      dispose,
    });
    const first = fakeFingerprint("same", "signature-one");
    const collision = fakeFingerprint("same", "signature-two");
    cache.set(first, "first", 1);

    expect(cache.get(collision)).toBeUndefined();
    expect(cache.delete(collision)).toBe(false);
    expect(cache.get(first)).toBe("first");
    cache.set(collision, "second", 1);
    expect(cache.get(first)).toBeUndefined();
    expect(cache.get(collision)).toBe("second");
    expect(dispose).toHaveBeenCalledWith("first", "collision");
    expect(cache.stats().collisions).toBe(4);
  });

  it("replaces matching entries without retaining mutable fingerprint objects", () => {
    const dispose = vi.fn();
    const cache = new StaticDisplayCache<object>({
      maxBytes: 100,
      maxEntries: 2,
      maxKeyBytes: 20,
      dispose,
    });
    const mutable = fakeFingerprint("key", "signature") as {
      version: 1;
      key: string;
      signature: string;
    };
    const first = {};
    cache.set(mutable, first, 1);
    mutable.key = "changed";
    mutable.signature = "changed";

    const original = fakeFingerprint("key", "signature");
    expect(cache.get(original)).toBe(first);
    const second = {};
    cache.set(original, second, 2);
    expect(dispose).toHaveBeenCalledWith(first, "replace");
    expect(cache.get(original)).toBe(second);
  });

  it("bypasses oversized values and key material without taking ownership", () => {
    const dispose = vi.fn();
    const cache = new StaticDisplayCache<string>({
      maxBytes: 8,
      maxEntries: 1,
      maxKeyBytes: 4,
      dispose,
    });
    expect(cache.set(fakeFingerprint("é", "🙂"), "key-too-large", 0)).toBe(
      false,
    );
    expect(cache.set(fakeFingerprint("a", "b"), "value-too-large", 7)).toBe(
      false,
    );
    expect(cache.stats()).toMatchObject({ entries: 0, bytes: 0, bypasses: 2 });
    expect(dispose).not.toHaveBeenCalled();
  });

  it("cleans every entry when a disposer fails and rejects disposer reentry", () => {
    const failure = new Error("dispose failed");
    let cache: StaticDisplayCache<string>;
    const dispose = vi.fn((value: string) => {
      expect(() => cache.get(fakeFingerprint("a", "A"))).toThrow(/reenter/);
      if (value === "A") throw failure;
    });
    cache = new StaticDisplayCache<string>({
      maxBytes: 20,
      maxEntries: 2,
      maxKeyBytes: 4,
      dispose,
    });
    cache.set(fakeFingerprint("a", "A"), "A", 1);
    cache.set(fakeFingerprint("b", "B"), "B", 1);

    expect(() => cache.clear()).toThrow(failure);
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(cache.stats()).toMatchObject({ entries: 0, bytes: 0, clears: 1 });
  });

  it("validates budgets, value sizes, and fingerprint metadata", () => {
    expect(
      () =>
        new StaticDisplayCache({
          maxBytes: -1,
          maxEntries: 1,
          maxKeyBytes: 1,
        }),
    ).toThrow(/maxBytes/);
    const cache = new StaticDisplayCache<string>({
      maxBytes: 10,
      maxEntries: 1,
      maxKeyBytes: 4,
    });
    expect(() => cache.set(fakeFingerprint("a", "b"), "x", 0.5)).toThrow(
      /valueBytes/,
    );
    expect(() => cache.get({ version: 1, key: "", signature: "" })).toThrow(
      /Invalid static display fingerprint/,
    );
  });
});

describe("Canvas2DStaticDisplayCache", () => {
  it("adopts the exact antialiased backing store, hits, evicts, and shrinks", () => {
    const cache = new Canvas2DStaticDisplayCache({
      maxBytes: 100_000,
      maxEntries: 1,
      maxKeyBytes: 100_000,
    });
    const first = displayGroup("div", { id: "first" });
    const second = displayGroup("div", { id: "second" });
    const bounds = { x: 4, y: 6, width: 10, height: 8 };
    const firstSurface = new FakeCacheCanvas(64, 64) as FakeCacheCanvas & {
      edgeRgba: readonly number[];
    };
    firstSurface.edgeRgba = Object.freeze([173, 68, 40, 127]);
    const secondSurface = new FakeCacheCanvas(64, 64);
    expect(cache.adopt(first, bounds, detached(firstSurface))).toBe(true);
    expect(cache.get(first, bounds)).toBe(firstSurface);
    expect(firstSurface.edgeRgba).toEqual([173, 68, 40, 127]);
    expect(firstSurface.drawImage).not.toHaveBeenCalled();
    expect(firstSurface.putImageData).not.toHaveBeenCalled();
    expect(cache.adopt(second, bounds, detached(secondSurface))).toBe(true);
    expect(firstSurface).toMatchObject({ width: 1, height: 1 });
    expect(cache.stats()).toMatchObject({ hits: 1, evictions: 1, entries: 1 });
    cache.dispose();
    expect(secondSurface).toMatchObject({ width: 1, height: 1 });
    expect(cache.stats().disposed).toBe(true);
  });

  it("shrinks dynamic, oversized, and malformed adoptions without retaining", () => {
    const cache = new Canvas2DStaticDisplayCache({
      maxBytes: 100,
      maxEntries: 2,
      maxKeyBytes: 100_000,
      maxDimension: 20,
    });
    const dynamic = new FakeCacheCanvas(64, 64);
    expect(
      cache.adopt(
        displayGroup("effect"),
        { x: 0, y: 0, width: 10, height: 8 },
        detached(dynamic),
      ),
    ).toBe(false);
    const oversized = new FakeCacheCanvas(64, 64);
    expect(
      cache.adopt(
        displayGroup("div"),
        { x: 0, y: 0, width: 21, height: 2 },
        detached(
          oversized,
          { width: 21, height: 2 },
          { width: 64, height: 64 },
        ),
      ),
    ).toBe(false);
    const malformed = new FakeCacheCanvas(64, 64);
    const malformedLease = {
      ...detached(malformed),
      bytes: 1,
    };
    expect(
      cache.adopt(
        displayGroup("div"),
        { x: 0, y: 0, width: 10, height: 8 },
        malformedLease,
      ),
    ).toBe(false);
    expect(dynamic).toMatchObject({ width: 1, height: 1 });
    expect(oversized).toMatchObject({ width: 1, height: 1 });
    expect(malformed).toMatchObject({ width: 1, height: 1 });
    expect(cache.stats()).toMatchObject({
      entries: 0,
      localBypasses: 3,
    });
  });

  it("invalidates same-id image and font rasters by prepared identity", () => {
    const cache = new Canvas2DStaticDisplayCache({
      maxBytes: 100_000,
      maxEntries: 4,
      maxKeyBytes: 100_000,
    });
    const group = displayGroup("div", {
      children: [
        displayGroup("img", { id: "photo", assetId: "hero" }),
        displayGroup("text", { id: "label" }),
      ],
    });
    const bounds = { x: 0, y: 0, width: 10, height: 10 };
    const identity =
      (image: string, font: string) =>
      (reference: StaticDisplayResourceReference) =>
        reference.kind === "image" ? image : font;
    expect(
      cache.adopt(
        group,
        bounds,
        detached(new FakeCacheCanvas(64, 64), { width: 10, height: 10 }),
        {
          resourceIdentity: identity("image-a", "font-a"),
        },
      ),
    ).toBe(true);
    expect(
      cache.get(group, bounds, {
        resourceIdentity: identity("image-b", "font-a"),
      }),
    ).toBeUndefined();
    expect(
      cache.get(group, bounds, {
        resourceIdentity: identity("image-a", "font-b"),
      }),
    ).toBeUndefined();
    expect(
      cache.get(group, bounds, {
        resourceIdentity: identity("image-a", "font-a"),
      }),
    ).toBeDefined();
  });
});
