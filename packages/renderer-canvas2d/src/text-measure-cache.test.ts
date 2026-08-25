import { describe, expect, it } from "vitest";
import {
  BoundedTextMeasureCache,
  type TextMeasureCache,
} from "./text-measure-cache.js";

describe("BoundedTextMeasureCache", () => {
  it("retains exact widths with bounded LRU promotion and eviction", () => {
    const cache = new BoundedTextMeasureCache({
      maxEntries: 2,
      maxKeyBytes: 32,
    });
    cache.set("a", 1).set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.get("c")).toBe(3);
    expect(cache.stats()).toMatchObject({
      entries: 2,
      hits: 2,
      evictions: 1,
    });
  });

  it("bypasses oversized UTF-8 keys and keeps plain Map inputs compatible", () => {
    const cache = new BoundedTextMeasureCache({
      maxEntries: 2,
      maxKeyBytes: 4,
    });
    cache.set("🙂🙂", 12);
    expect(cache.size).toBe(0);
    expect(cache.stats().bypasses).toBe(1);

    const acceptsStructuralCache = (value: TextMeasureCache) => value;
    expect(acceptsStructuralCache(new Map()).size).toBe(0);
  });
});
