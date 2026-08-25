import { describe, expect, it } from "vitest";
import {
  defaultSceneComplexityLimits,
  parseScene,
  preflightScene,
  type Scene,
} from "./index.js";

describe("Scene complexity preflight", () => {
  it("reports deterministic usage and returns the canonical Scene", () => {
    const input = complexityScene();
    const result = preflightScene(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scene).toEqual(parseScene(input));
    expect(result.limits).toEqual(defaultSceneComplexityLimits);
    expect(result.usage).toMatchObject({
      width: 100,
      height: 80,
      canvasPixels: 8_000,
      frames: 20,
      nodes: 3,
      maxDepth: 2,
      assets: 2,
      shapePoints: 3,
      animations: 2,
      keyframes: 5,
    });
    expect(result.usage.pathDataCharacters).toBeGreaterThan(3);
  });

  it("reports every exceeded host policy without changing canonical validity", () => {
    const input = complexityScene();
    expect(() => parseScene(input)).not.toThrow();

    const result = preflightScene(input, {
      maxCanvasPixels: 7_999,
      maxDimension: 99,
      maxFrames: 19,
      maxNodes: 1,
      maxDepth: 1,
      maxAssets: 1,
      maxPathDataCharacters: 3,
      maxShapePoints: 2,
      maxAnimations: 1,
      maxKeyframes: 4,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.code).sort()).toEqual(
      [
        "animation_count_exceeded",
        "asset_count_exceeded",
        "canvas_dimension_exceeded",
        "canvas_pixels_exceeded",
        "frame_count_exceeded",
        "keyframe_count_exceeded",
        "node_count_exceeded",
        "node_depth_exceeded",
        "path_data_exceeded",
        "scene_shape_points_exceeded",
      ].sort(),
    );
  });

  it("bounds traversal and rejects excessive raw depth before canonical recursion", () => {
    const root: Record<string, unknown> = { id: "node-0", type: "div" };
    let cursor = root;
    for (let depth = 1; depth < 80; depth += 1) {
      const child: Record<string, unknown> = {
        id: `node-${depth}`,
        type: "div",
      };
      cursor.children = [child];
      cursor = child;
    }
    const input = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      assets: {},
      nodes: [root],
    };

    const result = preflightScene(input, {
      maxDepth: 32,
      maxNodes: 5_000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "node_depth_exceeded", actual: 33 }),
    );
  });

  it("rejects cyclic/shared object graphs as non-JSON trees", () => {
    const node: Record<string, unknown> = { id: "node", type: "div" };
    node.children = [node];
    const result = preflightScene({
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      assets: {},
      nodes: [node],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "non_tree_document_reference" }),
    );
  });

  it("bounds deeply nested extension params before recursive Zod validation", () => {
    let params: Record<string, unknown> = { leaf: true };
    for (let depth = 0; depth < 5_000; depth += 1) {
      params = { nested: params };
    }
    const input = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      assets: {},
      nodes: [
        {
          id: "extension",
          type: "extension",
          extension: { name: "example.deep", version: "1.0.0", params },
        },
      ],
    };

    expect(() => preflightScene(input)).not.toThrow();
    const result = preflightScene(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "document_depth_exceeded",
        actual: defaultSceneComplexityLimits.maxDocumentDepth + 1,
      }),
    ]);
  });

  it("applies one global document and animation inspection budget", () => {
    const animation = {
      kind: "keyframes" as const,
      property: "opacity" as const,
      frames: [
        { frame: 0, value: 0 },
        { frame: 1, value: 1 },
      ],
    };
    const input = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      assets: {},
      nodes: Array.from({ length: 4 }, (_, index) => ({
        id: `node-${index}`,
        type: "div" as const,
        animations: Array.from({ length: 4 }, () => structuredClone(animation)),
      })),
    };
    const result = preflightScene(input, {
      maxAnimations: 2,
      maxKeyframes: 100,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.usage.animations).toBe(3);
    expect(result.usage.keyframes).toBe(6);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "animation_count_exceeded" }),
    );
  });

  it("separates canonical validation failures from complexity policy", () => {
    const result = preflightScene({
      schemaVersion: 1,
      width: "100",
      height: 100,
      fps: 30,
      duration: 30,
      assets: {},
      nodes: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "scene_invalid", path: [] }),
    ]);
    expect(result.issues[0]?.message).toContain("width");
  });

  it("rejects invalid host limit configuration", () => {
    expect(() => preflightScene(complexityScene(), { maxNodes: 0 })).toThrow(
      "maxNodes must be a positive safe integer",
    );
    expect(() =>
      preflightScene(complexityScene(), { maxDocumentDepth: 5_000 }),
    ).toThrow("cannot exceed the hard ingestion ceiling 256");
    expect(() =>
      preflightScene(complexityScene(), { maxDocumentValues: 1_000_001 }),
    ).toThrow("cannot exceed the hard ingestion ceiling 1000000");
  });
});

function complexityScene(): Scene {
  return {
    schemaVersion: 1,
    width: 100,
    height: 80,
    fps: 30,
    duration: 20,
    assets: {
      unusedImage: { id: "unusedImage", type: "image", src: "image.png" },
      unusedAudio: { id: "unusedAudio", type: "audio", src: "audio.wav" },
    },
    nodes: [
      {
        id: "shape",
        type: "shape",
        shape: {
          kind: "path",
          d: "M0 0 L10 10 Z",
          viewBox: { x: 0, y: 0, width: 10, height: 10 },
        },
        clip: {
          kind: "polygon",
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0.5, y: 1 },
          ],
        },
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [
              { frame: 0, value: 0 },
              { frame: 10, value: 1 },
            ],
          },
        ],
        children: [
          {
            id: "child",
            type: "div",
            animations: [
              {
                kind: "keyframes",
                property: "opacity",
                frames: [
                  { frame: 0, value: 0 },
                  { frame: 5, value: 1 },
                ],
              },
            ],
          },
          {
            id: "audio",
            type: "audio",
            assetId: "unusedAudio",
            volumeEnvelope: [{ frame: 0, value: 1 }],
          },
        ],
      },
    ],
  };
}
