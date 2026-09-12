import { describe, expect, it } from "vitest";
import { Ajv } from "ajv";
import {
  assetSchema,
  fontAssetIdsForFamily,
  fontFamilyNames,
  inspectScene,
  parseScene,
  registerMotionforgeJsonSchemaFormats,
  sceneJsonSchema,
} from "./index.js";

describe("font-face asset descriptors", () => {
  it("keeps descriptor and explicit no-paint JSON validation aligned with Zod", () => {
    const validate = registerMotionforgeJsonSchemaFormats(
      new Ajv({ strict: false }),
    ).compile(sceneJsonSchema());
    for (const [fontWeight, valid] of [
      ["100 900", true],
      ["900 100", false],
    ] as const) {
      const input = {
        schemaVersion: 1,
        width: 100,
        height: 100,
        fps: 30,
        duration: 1,
        assets: {
          f: {
            id: "f",
            type: "font",
            src: "f.woff2",
            metadata: { fontWeight },
          },
        },
        nodes: [
          {
            id: "text",
            type: "text",
            text: "Hello",
            style: { fontFamily: "f", textStroke: "none", textShadow: "none" },
          },
        ],
      };
      expect(validate(input)).toBe(valid);
      if (valid) expect(() => parseScene(input)).not.toThrow();
      else expect(() => parseScene(input)).toThrow();
    }
  });
  it("validates fixed and variable weights without accepting malformed ranges", () => {
    for (const fontWeight of [400, "100 900", "normal", "bold"])
      expect(
        assetSchema.parse({
          id: "f",
          type: "font",
          src: "font.woff2",
          metadata: {
            fontFamily: "Named Family",
            fontWeight,
            fontStyle: "italic",
          },
        }).metadata?.fontWeight,
      ).toBe(fontWeight);
    for (const fontWeight of [
      0,
      1001,
      "900 100",
      "100 900 1000",
      "weight(700)",
    ])
      expect(
        assetSchema.safeParse({
          id: "f",
          type: "font",
          src: "font.woff2",
          metadata: { fontWeight },
        }).success,
      ).toBe(false);
  });

  it("finds all faces in declared fallback families and preserves the id fallback", () => {
    const scene = parseScene({
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {
        regular: {
          id: "regular",
          type: "font",
          src: "a.woff2",
          metadata: { fontFamily: "Arabic Family", fontWeight: 400 },
        },
        bold: {
          id: "bold",
          type: "font",
          src: "b.woff2",
          metadata: { fontFamily: "Arabic Family", fontWeight: 700 },
        },
        Inter: { id: "Inter", type: "font", src: "c.woff2" },
      },
      nodes: [
        {
          id: "text",
          type: "text",
          text: "Text",
          style: { fontFamily: '"Arabic Family", Inter, sans-serif' },
        },
      ],
    });
    expect(fontFamilyNames('"Arabic Family", Inter, sans-serif')).toEqual([
      "Arabic Family",
      "Inter",
      "sans-serif",
    ]);
    expect(
      fontAssetIdsForFamily(scene.assets, scene.nodes[0]!.style!.fontFamily!),
    ).toEqual(["regular", "bold", "Inter"]);
    expect(inspectScene(scene).media.reachableAssets).toBe(3);
  });
});
