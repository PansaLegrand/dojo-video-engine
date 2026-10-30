import { describe, expect, it, vi } from "vitest";
import { parseScene } from "@dojo-video-engine/schema";
import { disposeAssetsAsync, FontAssetCache, resolveAssets } from "./index.js";

describe("font descriptor lifecycle", () => {
  it("loads family/weight/style and invalidates same-byte reuse after descriptor edits", async () => {
    class Face {
      constructor(
        readonly family: string,
        readonly source: ArrayBuffer,
        readonly descriptors: FontFaceDescriptors,
      ) {}
      async load() {
        return this;
      }
    }
    const fontSet = { add: vi.fn(), delete: vi.fn(() => true) };
    const cache = new FontAssetCache<Face>({ maxEntries: 4, fontSet });
    vi.stubGlobal("FontFace", Face);
    vi.stubGlobal("fonts", fontSet);
    try {
      const firstScene = parseScene({
        schemaVersion: 1,
        width: 100,
        height: 100,
        fps: 30,
        duration: 1,
        assets: {
          font: {
            id: "font",
            type: "font",
            src: "data:font/woff2;base64,AA==",
            metadata: { fontFamily: "Named Family", fontWeight: 400 },
          },
        },
        nodes: [
          {
            id: "text",
            type: "text",
            text: "Text",
            style: { fontFamily: "Named Family" },
          },
        ],
      });
      const first = await resolveAssets(firstScene, {
        fontCache: cache as never,
      });
      const changed = parseScene({
        ...firstScene,
        assets: {
          font: {
            ...firstScene.assets.font,
            metadata: {
              fontFamily: "Named Family",
              fontWeight: "100 900",
              fontStyle: "italic",
            },
          },
        },
      });
      const next = await resolveAssets(changed, {
        fontCache: cache as never,
        reuseFrom: { scene: firstScene, assets: first },
      });
      expect(next.fonts.get("font")).not.toBe(first.fonts.get("font"));
      expect(next.fonts.get("font")).toMatchObject({
        family: "Named Family",
        descriptors: { weight: "100 900", style: "italic" },
      });
      await disposeAssetsAsync(first);
      await disposeAssetsAsync(next);
      expect(cache.stats.activeLeases).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
