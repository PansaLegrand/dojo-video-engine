import { describe, expect, it } from "vitest";
import type { Scene } from "@motionforge/schema";
import {
  collectEditorLayerDescendantIds,
  deriveEditorLayers,
  displayLayerType,
  findEditorLayer,
} from "./layers";

describe("deriveEditorLayers", () => {
  it("flattens scene nodes into document-order editor layers", () => {
    const scene: Scene = {
      schemaVersion: 1,
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 120,
      assets: {
        clip: { id: "clip", type: "video", src: "clip.mp4" },
      },
      nodes: [
        {
          id: "stage",
          type: "div",
          from: 10,
          duration: 80,
          style: { zIndex: -1 },
          children: [
            {
              id: "title",
              type: "text",
              text: "  A launch title with  extra whitespace  ",
              from: 5,
              duration: 30,
              style: {
                position: "absolute",
                left: 64,
                top: "120px",
                width: "80%",
                height: "180",
                zIndex: 5,
                opacity: 0.72,
                color: "#f97316",
                fontSize: 72,
                fontWeight: 850,
                textAlign: "center",
                textStroke: "4px #111827",
              },
            },
          ],
        },
        {
          id: "clip-node",
          type: "video",
          assetId: "clip",
          from: 20,
          duration: 50,
          videoStartTime: 1.5,
          playbackRate: 1.25,
          volume: 0.6,
          style: {
            objectFit: "contain",
            objectPosition: "50% 25%",
          },
        },
      ],
    };

    const layers = deriveEditorLayers(scene);

    expect(layers.map((layer) => layer.id)).toEqual([
      "stage",
      "title",
      "clip-node",
    ]);
    expect(layers[0]).toMatchObject({
      id: "stage",
      depth: 0,
      from: 10,
      duration: 80,
      end: 90,
      zIndex: -1,
      childCount: 1,
      descendantCount: 1,
      paintIndex: 0,
    });
    expect(layers[1]).toMatchObject({
      id: "title",
      parentId: "stage",
      depth: 1,
      parentFrom: 10,
      label: "A launch title with extra whitespace",
      localFrom: 5,
      from: 15,
      duration: 30,
      end: 45,
      zIndex: 5,
      childCount: 0,
      descendantCount: 0,
      opacity: 0.72,
      text: "  A launch title with  extra whitespace  ",
      color: "#f97316",
      fontSize: 72,
      fontWeight: 850,
      textAlign: "center",
      textStroke: "4px #111827",
      bounds: {
        left: 64,
        top: 120,
        height: 180,
      },
    });
    expect(layers[1]?.bounds?.width).toBeUndefined();
    expect(layers[2]).toMatchObject({
      id: "clip-node",
      type: "video",
      label: "video · clip",
      assetId: "clip",
      assetType: "video",
      assetSrc: "clip.mp4",
      videoStartTime: 1.5,
      playbackRate: 1.25,
      volume: 0.6,
      objectFit: "contain",
      objectPosition: "50% 25%",
      from: 20,
      duration: 50,
      paintIndex: 2,
    });
  });

  it("clips derived layer duration to the parent visible range", () => {
    const scene: Scene = {
      schemaVersion: 1,
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 100,
      assets: {},
      nodes: [
        {
          id: "group",
          type: "div",
          from: 40,
          duration: 30,
          children: [
            {
              id: "late-child",
              type: "text",
              text: "Late",
              from: 20,
            },
          ],
        },
      ],
    };

    const child = findEditorLayer(deriveEditorLayers(scene), "late-child");

    expect(child).toMatchObject({
      from: 60,
      localDuration: 30,
      duration: 10,
      end: 70,
    });
  });

  it("collects descendants from the flattened tree", () => {
    const scene: Scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 25,
      duration: 25,
      assets: {},
      nodes: [
        {
          id: "card",
          type: "div",
          children: [
            {
              id: "label",
              type: "text",
              text: "Label",
            },
            {
              id: "nested",
              type: "div",
              children: [{ id: "nested-label", type: "text", text: "Nested" }],
            },
          ],
        },
        { id: "outside", type: "text", text: "Outside" },
      ],
    };
    const layers = deriveEditorLayers(scene);

    expect(findEditorLayer(layers, "card")).toMatchObject({
      childCount: 2,
      descendantCount: 3,
    });
    expect([...collectEditorLayerDescendantIds(layers, "card")]).toEqual([
      "label",
      "nested",
      "nested-label",
    ]);
    expect([...collectEditorLayerDescendantIds(layers, "nested")]).toEqual([
      "nested-label",
    ]);
    expect([...collectEditorLayerDescendantIds(layers, "outside")]).toEqual([]);
  });
});

describe("editor layer helpers", () => {
  it("finds layers and formats image node types for display", () => {
    const scene: Scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 25,
      duration: 25,
      assets: {},
      nodes: [{ id: "photo", type: "img", assetId: "photo-asset" }],
    };
    const layers = deriveEditorLayers(scene);

    expect(findEditorLayer(layers, "photo")?.id).toBe("photo");
    expect(findEditorLayer(layers, "missing")).toBeNull();
    expect(displayLayerType("img")).toBe("image");
    expect(displayLayerType("lottie")).toBe("lottie");
  });
});
