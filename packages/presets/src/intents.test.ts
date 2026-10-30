import { describe, expect, it } from "vitest";
import {
  styleSchema,
  validateScene,
  type SceneNode,
  type SceneStyle,
} from "@dojo-video-engine/schema";
import {
  clipLayout,
  clipLayoutEntries,
  mediaLook,
  mediaLookEntries,
  safeAreaBox,
  type CompositionSize,
  type SafeAreaAnchor,
} from "./index.js";
import {
  LAYOUT_COMPILER_MANIFEST_VERSION,
  applyTextRole,
  compileLayoutIntent,
  getLayoutCompilerManifest,
  layoutCompilerManifests,
  placeAnchors,
  resolvePlaceIntent,
  textRoles,
  type CompileLayoutIntentContext,
  type CompileLayoutIntentResult,
  type LayoutCompilerManifest,
  type PlaceIntent,
} from "./intents.js";

const sizes: CompositionSize[] = [
  { width: 1080, height: 1920 },
  { width: 1080, height: 1080 },
  { width: 1920, height: 1080 },
];

const safeAreaAnchors: SafeAreaAnchor[] = [
  "center",
  "top",
  "bottom",
  "title",
  "subtitle",
  "lowerThird",
  "statCallout",
];

function expectOk(result: CompileLayoutIntentResult) {
  if (!result.ok) {
    throw new Error(
      `Expected layout compilation to succeed:\n${result.errors
        .map((entry) => `${entry.code} ${entry.path}: ${entry.message}`)
        .join("\n")}`,
    );
  }
  return result;
}

function expectErrors(result: CompileLayoutIntentResult) {
  if (result.ok) {
    throw new Error("Expected layout compilation to fail.");
  }
  return result.errors;
}

function styleValue(result: CompileLayoutIntentResult): SceneStyle {
  const compiled = expectOk(result);
  if (compiled.value.kind !== "style") {
    throw new Error(`Expected style, got ${compiled.value.kind}.`);
  }
  return compiled.value.style;
}

function nodeValue(result: CompileLayoutIntentResult): SceneNode {
  const compiled = expectOk(result);
  if (compiled.value.kind !== "node-wrapper") {
    throw new Error(`Expected node wrapper, got ${compiled.value.kind}.`);
  }
  return compiled.value.node;
}

function contextFor(manifest: LayoutCompilerManifest) {
  const context: CompileLayoutIntentContext = {};
  if (manifest.requiredContext.includes("composition")) {
    context.composition = sizes[0];
  }
  if (manifest.requiredContext.includes("node")) {
    context.node = {
      id: "target",
      type: "text",
      text: "Manifest example",
      from: 12,
      duration: 60,
    };
  }
  if (manifest.requiredContext.includes("wrapperId")) {
    context.wrapperId = "target-place";
  }
  context.targetType = manifest.appliesTo[0];
  return context;
}

function validateCompiled(result: CompileLayoutIntentResult): void {
  const compiled = expectOk(result);
  if (compiled.value.kind === "style") {
    expect(styleSchema.safeParse(compiled.value.style).success).toBe(true);
    return;
  }

  const validation = validateScene({
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 180,
    assets: {},
    nodes: [compiled.value.node],
  });
  expect(validation.ok ? "ok" : validation.errors.join("\n")).toBe("ok");
}

describe("layout compiler manifests", () => {
  it("publishes every legacy intent under a stable namespaced id", () => {
    const manifests = layoutCompilerManifests();
    const expectedIds = [
      "place",
      "safe-area/box",
      ...textRoles.map((role) => `text-role/${role}`),
      ...mediaLookEntries.map(([key]) => `media-look/${key}`),
      ...clipLayoutEntries.map(([key]) => `clip-layout/${key}`),
    ].sort();

    expect(manifests.map(({ id }) => id)).toEqual(expectedIds);
    expect(manifests).toHaveLength(26);
    expect(
      manifests.every(
        ({ manifestVersion }) =>
          manifestVersion === LAYOUT_COMPILER_MANIFEST_VERSION,
      ),
    ).toBe(true);
  });

  it("is JSON-safe, deeply frozen, detached, and rich enough for discovery", () => {
    const first = layoutCompilerManifests();
    const before = JSON.parse(JSON.stringify(first));

    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(
      first.every(
        (entry) =>
          Object.isFrozen(entry) &&
          Object.isFrozen(entry.paramsSchema) &&
          Object.isFrozen(entry.examples) &&
          Object.isFrozen(entry.output) &&
          Object.isFrozen(entry.output.roles) &&
          Object.isFrozen(entry.output.ownedStyleKeys),
      ),
    ).toBe(true);

    expect(() => (first as LayoutCompilerManifest[]).push(first[0]!)).toThrow();
    expect(layoutCompilerManifests()).toEqual(before);

    const one = getLayoutCompilerManifest("clip-layout/fullscreen");
    const two = getLayoutCompilerManifest("clip-layout/fullscreen");
    expect(one).toEqual(two);
    expect(one).not.toBe(two);
    expect(Object.isFrozen(one)).toBe(true);
    expect(getLayoutCompilerManifest("missing")).toBeUndefined();
  });

  it("publishes draft-07 schemas, examples, compatibility, and output roles", () => {
    for (const manifest of layoutCompilerManifests()) {
      expect(manifest.paramsSchema.$schema).toBe(
        "http://json-schema.org/draft-07/schema#",
      );
      expect(manifest.examples.length).toBeGreaterThan(0);
      expect(manifest.appliesTo.length).toBeGreaterThan(0);
      expect(manifest.output.roles.length).toBeGreaterThan(0);
      expect(manifest.output.canonicalTarget).toBe("scene-v1");
      expect(manifest.output.ownedStyleKeys).toEqual(
        [...manifest.output.ownedStyleKeys].sort(),
      );

      for (const params of manifest.examples) {
        const result = compileLayoutIntent({
          id: manifest.id,
          params,
          context: contextFor(manifest),
        });
        validateCompiled(result);
      }
    }
  });

  it("describes the five output-role families explicitly", () => {
    expect(getLayoutCompilerManifest("place")?.output.roles).toEqual([
      "layout",
      "placement",
    ]);
    expect(getLayoutCompilerManifest("safe-area/box")?.output.roles).toEqual([
      "layout",
      "safe-area",
    ]);
    expect(getLayoutCompilerManifest("text-role/title")?.output.roles).toEqual([
      "text",
      "typography",
    ]);
    expect(
      getLayoutCompilerManifest("media-look/cinematicWarm")?.output.roles,
    ).toEqual(["media", "visual-treatment"]);
    expect(
      getLayoutCompilerManifest("clip-layout/pictureInPicture")?.output.roles,
    ).toEqual(["layout", "visual-media"]);
  });
});

describe("legacy intent compatibility", () => {
  it("keeps every place anchor exact across portrait, square, and landscape", () => {
    for (const size of sizes) {
      for (const anchor of placeAnchors) {
        const node: SceneNode = {
          id: `label-${anchor}`,
          type: "text",
          text: "Hello",
          from: 12,
          duration: 60,
          style: { color: "#ffffff", fontSize: 42 },
        };
        const place: PlaceIntent = {
          anchor,
          margin: { x: 11, y: 17 },
          offsetX: 3,
          offsetY: -4,
          zIndex: 8,
        };
        const expected = resolvePlaceIntent({
          node,
          place,
          size,
          wrapperId: `${node.id}-place`,
        });
        const actual = nodeValue(
          compileLayoutIntent({
            id: "place",
            params: place,
            context: {
              composition: size,
              node,
              wrapperId: `${node.id}-place`,
              targetType: "text",
            },
          }),
        );

        expect(actual).toEqual(expected);
        expect(actual.style?.left).toBeGreaterThanOrEqual(0);
        expect(actual.style?.top).toBeGreaterThanOrEqual(0);
        expect(
          (actual.style?.left as number) + (actual.style?.width as number),
        ).toBeLessThanOrEqual(size.width);
        expect(
          (actual.style?.top as number) + (actual.style?.height as number),
        ).toBeLessThanOrEqual(size.height);
      }
    }
  });

  it("keeps every safe-area anchor exact and bounded across aspect ratios", () => {
    for (const size of sizes) {
      for (const anchor of safeAreaAnchors) {
        const expected = safeAreaBox(size, anchor);
        const actual = styleValue(
          compileLayoutIntent({
            id: "safe-area/box",
            params: { anchor },
            context: { composition: size, targetType: "text" },
          }),
        );

        expect(actual).toEqual(expected);
        expect(actual.left).toBeGreaterThanOrEqual(0);
        expect(actual.top).toBeGreaterThanOrEqual(0);
        expect(
          (actual.left as number) + (actual.width as number),
        ).toBeLessThanOrEqual(size.width);
        expect(
          (actual.top as number) + (actual.height as number),
        ).toBeLessThanOrEqual(size.height);
      }
    }
  });

  it("keeps all text-role values and author override precedence exact", () => {
    for (const size of sizes) {
      for (const role of textRoles) {
        const overrides: SceneStyle = {
          color: "#f8fafc",
          fontWeight: 555,
        };
        expect(
          styleValue(
            compileLayoutIntent({
              id: `text-role/${role}`,
              params: {},
              context: {
                composition: size,
                style: overrides,
                targetType: "text",
              },
            }),
          ),
        ).toEqual(applyTextRole(overrides, role, size));
      }
    }
  });

  it("keeps every media look exact over the aspect-ratio matrix", () => {
    const overrides: SceneStyle = { opacity: 0.83 };
    for (const size of sizes) {
      for (const [key] of mediaLookEntries) {
        expect(
          styleValue(
            compileLayoutIntent({
              id: `media-look/${key}`,
              params: {},
              context: {
                composition: size,
                style: overrides,
                targetType: "video",
              },
            }),
          ),
        ).toEqual(mediaLook(key, overrides));
      }
    }
  });

  it("keeps every clip layout exact over the aspect-ratio matrix", () => {
    const overrides: SceneStyle = { opacity: 0.91 };
    for (const size of sizes) {
      for (const [key] of clipLayoutEntries) {
        expect(
          styleValue(
            compileLayoutIntent({
              id: `clip-layout/${key}`,
              params: {},
              context: {
                composition: size,
                style: overrides,
                targetType: "video",
              },
            }),
          ),
        ).toEqual(clipLayout(key, overrides));
      }
    }
  });

  it("pins representative legacy output objects", () => {
    const placed = nodeValue(
      compileLayoutIntent({
        id: "place",
        params: { anchor: "bottom-center", margin: 32 },
        context: {
          composition: { width: 1080, height: 1920 },
          node: {
            id: "headline",
            type: "text",
            text: "Hello",
            from: 12,
            duration: 60,
          },
          wrapperId: "headline-place",
        },
      }),
    );
    expect(placed).toEqual({
      id: "headline-place",
      type: "div",
      from: 12,
      duration: 60,
      style: {
        position: "absolute",
        left: 104,
        top: 176,
        width: 872,
        height: 1549,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        alignItems: "center",
      },
      children: [{ id: "headline", type: "text", text: "Hello" }],
    });
    expect(
      styleValue(
        compileLayoutIntent({
          id: "clip-layout/pictureInPicture",
          params: {},
        }),
      ),
    ).toEqual({
      position: "absolute",
      right: 48,
      bottom: 48,
      width: 360,
      height: 640,
      objectFit: "cover",
      objectPosition: "center center",
      borderRadius: 24,
      border: "3px solid rgba(255,255,255,0.88)",
      boxShadow: "0px 20px 52px rgba(0,0,0,0.36)",
      overflow: "hidden",
      zIndex: 20,
    });
  });
});

describe("layout compiler failure contract", () => {
  it("returns stable paths and spelling suggestions", () => {
    const unknown = expectErrors(
      compileLayoutIntent({
        id: "clip-layout/pictureInPictur",
        params: {},
      }),
    );
    expect(unknown[0]).toMatchObject({
      code: "unknown_intent",
      path: "id",
      suggestions: expect.arrayContaining(["clip-layout/pictureInPicture"]),
    });

    const invalidAnchor = expectErrors(
      compileLayoutIntent({
        id: "place",
        params: { anchor: "botom-center" },
        context: {
          composition: sizes[0],
          node: { id: "x", type: "text", text: "x" },
          wrapperId: "x-place",
        },
      }),
    );
    expect(invalidAnchor[0]).toMatchObject({
      code: "invalid_params",
      path: "params.anchor",
      suggestions: expect.arrayContaining(["bottom-center"]),
    });
  });

  it("reports all missing context and incompatible targets without throwing", () => {
    const missing = expectErrors(
      compileLayoutIntent({
        id: "place",
        params: { anchor: "center" },
      }),
    );
    expect(missing.map(({ code }) => code)).toEqual([
      "missing_context",
      "missing_context",
      "missing_context",
    ]);
    expect(missing.map(({ path }) => path)).toEqual([
      "context.composition",
      "context.node",
      "context.wrapperId",
    ]);

    const target = expectErrors(
      compileLayoutIntent({
        id: "text-role/title",
        params: {},
        context: { composition: sizes[0], targetType: "video" },
      }),
    );
    expect(target[0]).toEqual({
      code: "unsupported_target",
      path: "context.targetType",
      message: 'text-role/title does not apply to "video" nodes.',
      suggestions: ["text"],
    });
  });

  it("rejects non-JSON values, non-finite numbers, and unknown keys", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(
      expectErrors(
        compileLayoutIntent({ id: "clip-layout/fullscreen", params: cyclic }),
      )[0]?.code,
    ).toBe("non_json_value");

    expect(
      expectErrors(
        compileLayoutIntent({
          id: "media-look/cleanProduct",
          params: {},
          context: { style: { opacity: Number.NaN } },
        }),
      )[0],
    ).toMatchObject({
      code: "non_json_value",
      path: "context.style.opacity",
    });

    expect(
      expectErrors(
        compileLayoutIntent({
          id: "media-look/cleanProduct",
          params: {},
          surprise: true,
        }),
      )[0],
    ).toMatchObject({ code: "invalid_request", path: "surprise" });
  });

  it("does not mutate inputs and returns output detached from caller data", () => {
    const style: SceneStyle = { opacity: 0.72 };
    const request = {
      id: "media-look/cinematicWarm",
      params: {},
      context: { style, targetType: "video" as const },
    };
    const before = JSON.parse(JSON.stringify(request));
    const compiled = styleValue(compileLayoutIntent(request));
    expect(request).toEqual(before);

    style.opacity = 0.2;
    expect(compiled.opacity).toBe(0.72);

    const node: SceneNode = {
      id: "detached",
      type: "text",
      text: "Before",
    };
    const placed = nodeValue(
      compileLayoutIntent({
        id: "place",
        params: { anchor: "center" },
        context: {
          composition: sizes[0],
          node,
          wrapperId: "detached-place",
        },
      }),
    );
    node.text = "After";
    expect(placed.children?.[0]?.text).toBe("Before");
  });
});
