import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import {
  validateScene,
  type Scene,
  type SceneAsset,
  type SceneNode,
} from "@motionforge/schema";
import type {
  MediaMetricsProvider,
  TextMetricsProvider,
} from "@motionforge/core";
import { evaluateScene, layoutScene } from "@motionforge/core";
import {
  LAYOUT_CONTRACT_VERSION,
  LayoutCompileError,
  column,
  compileLayout,
  grid,
  item,
  layoutPlanJsonSchema,
  overlay,
  row,
  stack,
  tryCompileLayout,
  validateLayoutPlan,
} from "./index.js";

const exactText: TextMetricsProvider = {
  measureLine({ text, fontSize }) {
    return {
      width: Array.from(text).length * fontSize * 0.5,
      ascent: fontSize * 0.8,
      descent: fontSize * 0.2,
      measurement: "exact",
      reason: "test font",
    };
  },
};

function scene(
  width: number,
  height: number,
  nodes: SceneNode[],
  assets: Record<string, SceneAsset> = {},
): Scene {
  return {
    schemaVersion: 1,
    width,
    height,
    fps: 30,
    duration: 60,
    assets,
    nodes,
  };
}

function boxNode(id: string, width?: number, height?: number): SceneNode {
  return {
    id,
    type: "div",
    ...(width === undefined && height === undefined
      ? {}
      : {
          style: {
            ...(width === undefined ? {} : { width }),
            ...(height === undefined ? {} : { height }),
          },
        }),
  };
}

function textNode(
  id: string,
  text: string,
  direction?: "ltr" | "rtl",
): SceneNode {
  return {
    id,
    type: "text",
    text,
    style: {
      fontSize: 20,
      lineHeight: 1,
      ...(direction ? { direction } : {}),
    },
  };
}

function nodeById(input: Scene, id: string): SceneNode {
  const pending = [...input.nodes];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (node.id === id) return node;
    pending.push(...(node.children ?? []));
  }
  throw new Error(`missing ${id}`);
}

describe("Layout Contract v1", () => {
  it("publishes one strict Zod/draft-07 tool shape and detached constructors", () => {
    const plan = row({
      items: [item("a", { width: "hug" }), item("b", { width: "fill" })],
      gap: 12,
      align: "center",
    });
    expect(plan).toEqual({
      layoutVersion: LAYOUT_CONTRACT_VERSION,
      containerId: "$root",
      layout: { kind: "stack", axis: "row", gap: 12, align: "center" },
      items: [
        { id: "a", width: "hug" },
        { id: "b", width: "fill" },
      ],
    });
    expect(column({ items: [] }).layout).toMatchObject({
      kind: "stack",
      axis: "column",
    });
    expect(stack("row", { items: [] }).layout).toMatchObject({
      kind: "stack",
      axis: "row",
    });

    const jsonSchema = layoutPlanJsonSchema();
    const ajv = new Ajv({ strict: false });
    expect(ajv.validate(jsonSchema, plan)).toBe(true);
    (jsonSchema as { title?: string }).title = "mutated";
    expect(layoutPlanJsonSchema()).not.toHaveProperty("title", "mutated");

    const duplicate = validateLayoutPlan({
      ...plan,
      items: [{ id: "a" }, { id: "a" }],
    });
    expect(
      ajv.validate(jsonSchema, {
        ...plan,
        items: [{ id: "a" }, { id: "a" }],
      }),
    ).toBe(true); // draft-07 cannot express uniqueness by an object property
    expect(duplicate).toMatchObject({ ok: false });
    if (!duplicate.ok) {
      expect(duplicate.issues[0]?.code).toBe("duplicate_item");
      expect(duplicate.issues[0]?.message).toContain("duplicated");
    }

    expect(
      ajv.validate(jsonSchema, {
        ...plan,
        items: [{ id: "a", justifySelf: "center" }],
      }),
    ).toBe(false);
    expect(
      ajv.validate(jsonSchema, {
        layoutVersion: 1,
        containerId: "$root",
        layout: {
          kind: "grid",
          columns: [{ size: "fill" }],
          autoFlow: "column",
        },
        items: [],
      }),
    ).toBe(false);
  });

  it("distributes fill/grow and bounded shrink in stable row order", () => {
    const input = scene(300, 100, [boxNode("a"), boxNode("b")]);
    const grown = compileLayout(
      input,
      row({
        items: [
          item("a", { width: 50, height: 20 }),
          item("b", { width: "fill", height: 20 }),
        ],
        gap: 10,
      }),
    ).scene;
    expect(nodeById(grown, "a").style).toMatchObject({
      left: 0,
      top: 0,
      width: 50,
      height: 20,
    });
    expect(nodeById(grown, "b").style).toMatchObject({
      left: 60,
      top: 0,
      width: 240,
      height: 20,
    });

    const maxClamped = compileLayout(
      scene(300, 40, [boxNode("a"), boxNode("b")]),
      row({
        items: [
          item("a", { width: "fill", height: 20, maxWidth: 100 }),
          item("b", { width: "fill", height: 20 }),
        ],
      }),
    ).scene;
    expect(nodeById(maxClamped, "a").style).toMatchObject({ width: 100 });
    expect(nodeById(maxClamped, "b").style).toMatchObject({
      left: 100,
      width: 200,
    });

    const shrunk = compileLayout(
      scene(100, 40, [boxNode("a"), boxNode("b")]),
      row({
        items: [
          item("a", { width: 80, height: 20, shrink: 1 }),
          item("b", { width: 80, height: 20, shrink: 1 }),
        ],
      }),
    ).scene;
    expect(nodeById(shrunk, "a").style?.width).toBe(50);
    expect(nodeById(shrunk, "b").style).toMatchObject({ left: 50, width: 50 });
  });

  it("wraps deterministically and distributes line cross geometry", () => {
    const result = compileLayout(
      scene(120, 100, [boxNode("a"), boxNode("b"), boxNode("c")]),
      row({
        items: ["a", "b", "c"].map((id) => item(id, { width: 50, height: 20 })),
        gap: 10,
        rowGap: 5,
        wrap: "wrap",
      }),
    );
    expect(nodeById(result.scene, "a").style).toMatchObject({
      left: 0,
      top: 0,
    });
    expect(nodeById(result.scene, "b").style).toMatchObject({
      left: 60,
      top: 0,
    });
    expect(nodeById(result.scene, "c").style).toMatchObject({
      left: 0,
      top: 52.5,
    });
    expect(result.stats.lines).toBe(2);
  });

  it("solves non-dense grid tracks, explicit spans, and collisions", () => {
    const input = scene(300, 200, [boxNode("a"), boxNode("b"), boxNode("c")]);
    const plan = grid({
      columns: [{ size: "fill" }, { size: "fill" }],
      rows: [{ size: "fill" }, { size: "fill" }],
      gap: 10,
      items: [
        item("a", { width: "fill", height: "fill", grid: { columnSpan: 2 } }),
        item("b", { width: "fill", height: "fill" }),
        item("c", { width: "fill", height: "fill" }),
      ],
    });
    const result = compileLayout(input, plan);
    expect(nodeById(result.scene, "a").style).toMatchObject({
      left: 0,
      top: 0,
      width: 300,
      height: 95,
    });
    expect(nodeById(result.scene, "b").style).toMatchObject({
      left: 0,
      top: 105,
      width: 145,
      height: 95,
    });
    expect(nodeById(result.scene, "c").style).toMatchObject({
      left: 155,
      top: 105,
      width: 145,
      height: 95,
    });
    expect(result.stats.tracks).toBe(4);

    const collision = tryCompileLayout(
      input,
      grid({
        columns: [{ size: "fill" }, { size: "fill" }],
        rows: [{ size: "fill" }],
        items: [
          item("a", { grid: { row: 0, column: 0 } }),
          item("b", { grid: { row: 0, column: 0 } }),
          item("c", { grid: { row: 0, column: 1 } }),
        ],
      }),
    );
    expect(collision).toMatchObject({
      ok: false,
      errors: [{ code: "grid_collision" }],
    });

    const implicit = compileLayout(
      scene(200, 100, [boxNode("a"), boxNode("b"), boxNode("c"), boxNode("d")]),
      grid({
        columns: [{ size: "fill" }, { size: "fill" }],
        items: ["a", "b", "c", "d"].map((id) =>
          item(id, { width: "fill", height: "fill" }),
        ),
      }),
    );
    expect(nodeById(implicit.scene, "a").style).toMatchObject({
      left: 0,
      top: 0,
      width: 100,
      height: 50,
    });
    expect(nodeById(implicit.scene, "d").style).toMatchObject({
      left: 100,
      top: 50,
      width: 100,
      height: 50,
    });
  });

  it("anchors overlays and solves a stable sibling-constraint DAG", () => {
    const input = scene(300, 200, [boxNode("a"), boxNode("b"), boxNode("c")]);
    const result = compileLayout(
      input,
      overlay({
        defaultAnchor: "top-left",
        safeArea: { x: 20, y: 10 },
        items: [
          item("a", { width: 50, height: 30 }),
          item("b", {
            width: 40,
            height: 30,
            constraints: [
              { kind: "after", target: "a", axis: "x", gap: 10 },
              { kind: "align", target: "a", axis: "y", edge: "start" },
            ],
          }),
          item("c", {
            width: 10,
            height: 10,
            constraints: [
              { kind: "match", target: "b", dimension: "height" },
              { kind: "after", target: "b", axis: "x", gap: 5 },
            ],
          }),
        ],
      }),
    );
    expect(nodeById(result.scene, "a").style).toMatchObject({
      left: 20,
      top: 10,
    });
    expect(nodeById(result.scene, "b").style).toMatchObject({
      left: 80,
      top: 10,
    });
    expect(nodeById(result.scene, "c").style).toMatchObject({
      left: 125,
      top: 10,
      height: 30,
    });
    expect(result.stats.dependencyDepth).toBe(2);

    const cycle = tryCompileLayout(
      scene(300, 200, [boxNode("a"), boxNode("b")]),
      overlay({
        items: [
          item("a", {
            width: 20,
            height: 20,
            constraints: [{ kind: "after", target: "b", axis: "x" }],
          }),
          item("b", {
            width: 20,
            height: 20,
            constraints: [{ kind: "after", target: "a", axis: "x" }],
          }),
        ],
      }),
    );
    expect(cycle).toMatchObject({
      ok: false,
      errors: [{ code: "constraint_cycle" }],
    });
  });

  it("requires explicit media fallback policy and preserves provenance", () => {
    const input = scene(
      400,
      300,
      [{ id: "photo", type: "img", assetId: "photo" }],
      { photo: { id: "photo", type: "image", src: "photo.png" } },
    );
    const plan = overlay({
      items: [item("photo", { width: "hug", height: "hug" })],
    });
    expect(() => compileLayout(input, plan)).toThrowError(LayoutCompileError);
    expect(tryCompileLayout(input, plan)).toMatchObject({
      ok: false,
      errors: [{ code: "missing_intrinsic_metrics" }],
    });
    const result = compileLayout(input, plan, {
      missingMediaMetrics: {
        mode: "fallback",
        sizes: { image: { width: 160, height: 90 } },
      },
    });
    expect(nodeById(result.scene, "photo").style).toMatchObject({
      width: 160,
      height: 90,
    });
    expect(result.measurements[0]).toMatchObject({
      measurement: "estimated",
      intrinsic: { width: 160, height: 90 },
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "estimated_intrinsic_metrics" }),
      ]),
    );

    const scaled = compileLayout(
      input,
      overlay({
        items: [item("photo", { width: 320, height: "hug" })],
      }),
      {
        missingMediaMetrics: {
          mode: "fallback",
          sizes: { image: { width: 160, height: 90 } },
        },
      },
    );
    expect(nodeById(scaled.scene, "photo").style).toMatchObject({
      width: 320,
      height: 180,
    });
  });

  it("uses prepared text metrics, resolves direction, and rejects host inheritance", () => {
    const inherited = textNode("title", "hello world");
    inherited.style = { ...inherited.style, direction: "inherit" };
    const inheritedDirection = tryCompileLayout(
      scene(200, 100, [inherited]),
      overlay({ items: [item("title", { width: "hug", height: "hug" })] }),
      { textMetrics: exactText, fontFallbackPolicy: "allow-system" },
    );
    expect(inheritedDirection).toMatchObject({
      ok: false,
      errors: [{ code: "text_direction_required" }],
    });

    const result = compileLayout(
      scene(100, 100, [textNode("title", "hello world")]),
      overlay({
        items: [
          item("title", { width: 50, height: "hug", anchor: "top-left" }),
        ],
      }),
      { textMetrics: exactText, fontFallbackPolicy: "allow-system" },
    );
    expect(nodeById(result.scene, "title").style).toMatchObject({
      width: 50,
      height: 40,
    });
    expect(result.measurements[0]?.measurement).toBe("estimated");
  });

  it("recompiles one plan across aspect ratios with explicit safe areas", () => {
    const plan = overlay({
      safeArea: { x: "10%", y: "5%" },
      defaultAnchor: "bottom-right",
      items: [item("logo", { width: "20%", height: "10%" })],
    });
    for (const [width, height] of [
      [1080, 1920],
      [1080, 1080],
      [1920, 1080],
    ] satisfies Array<[number, number]>) {
      const result = compileLayout(
        scene(width, height, [boxNode("logo")]),
        plan,
      );
      const style = nodeById(result.scene, "logo").style!;
      expect(style.width).toBeCloseTo((width - width * 0.2) * 0.2);
      expect(style.height).toBeCloseTo((height - height * 0.1) * 0.1);
      expect((style.left as number) + (style.width as number)).toBeCloseTo(
        width * 0.9,
      );
      expect((style.top as number) + (style.height as number)).toBeCloseTo(
        height * 0.95,
      );
    }
  });

  it("is non-mutating, returns valid Scene v1, and rejects static-compile hazards", () => {
    const input = scene(200, 100, [boxNode("a"), boxNode("b")]);
    const snapshot = structuredClone(input);
    const result = compileLayout(
      input,
      row({
        items: [
          item("a", { width: "fill", height: 20 }),
          item("b", { width: "fill", height: 20 }),
        ],
      }),
    );
    expect(input).toEqual(snapshot);
    expect(validateScene(result.scene)).toMatchObject({ ok: true });

    const animated = scene(200, 100, [
      {
        id: "a",
        type: "div",
        animations: [
          {
            kind: "keyframes",
            property: "width",
            frames: [{ frame: 0, value: 10 }],
          },
        ],
      },
    ]);
    expect(
      tryCompileLayout(
        animated,
        overlay({ items: [item("a", { width: 20, height: 20 })] }),
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "animation_conflict" }] });

    expect(
      tryCompileLayout(input, row({ items: [item("a"), item("b")] }), {
        budgets: { maxItems: 1 },
      }),
    ).toMatchObject({ ok: false, errors: [{ code: "budget_exceeded" }] });
  });

  it("uses exact prepared media metrics without retaining provider results", () => {
    const metrics: MediaMetricsProvider = {
      measure() {
        return {
          width: 640,
          height: 360,
          measurement: "exact",
          reason: "decoded header",
        };
      },
    };
    const input = scene(
      800,
      600,
      [{ id: "clip", type: "video", assetId: "clip" }],
      { clip: { id: "clip", type: "video", src: "clip.mp4" } },
    );
    const result = compileLayout(
      input,
      overlay({ items: [item("clip", { width: "hug", height: "hug" })] }),
      { mediaMetrics: metrics },
    );
    expect(result.measurements[0]).toMatchObject({ measurement: "exact" });
    expect(nodeById(result.scene, "clip").style).toMatchObject({
      width: 640,
      height: 360,
    });
  });

  it("writes nested-container geometry in the parent's local content coordinates", () => {
    const input = scene(400, 300, [
      {
        id: "container",
        type: "div",
        style: {
          position: "absolute",
          left: 50,
          top: 40,
          width: 200,
          height: 100,
          padding: 10,
          display: "flex",
          flexDirection: "row",
          gap: 40,
        },
        children: [boxNode("child")],
      },
    ]);
    const result = compileLayout(
      input,
      overlay({
        containerId: "container",
        safeArea: 5,
        defaultAnchor: "bottom-right",
        items: [item("child", { width: 20, height: 10 })],
      }),
    );
    expect(nodeById(result.scene, "child").style).toMatchObject({
      left: 155,
      top: 65,
      width: 20,
      height: 10,
    });
    expect(nodeById(result.scene, "container").style).not.toHaveProperty(
      "display",
    );
    const resolved = layoutScene(evaluateScene(result.scene, 0));
    const childBox = resolved.boxes[0]?.children[0];
    expect(childBox).toMatchObject({ x: 215, y: 115, width: 20, height: 10 });
  });

  it("uses fixed item contributions for hug tracks and creates bounded auto rows", () => {
    const result = compileLayout(
      scene(200, 100, [boxNode("a"), boxNode("b")]),
      grid({
        columns: [{ size: "hug" }, { size: "fill" }],
        items: [
          item("a", { width: 60, height: 30 }),
          item("b", { width: "fill", height: 20 }),
        ],
      }),
    );
    expect(nodeById(result.scene, "a").style).toMatchObject({
      left: 0,
      top: 0,
      width: 60,
      height: 30,
    });
    expect(nodeById(result.scene, "b").style).toMatchObject({
      left: 60,
      top: 0,
      width: 140,
      height: 20,
    });
    expect(result.stats).toMatchObject({ tracks: 3, lines: 1 });
  });

  it("iteratively shrinks around min clamps without violating fixed bounds", () => {
    const result = compileLayout(
      scene(100, 50, [boxNode("a"), boxNode("b")]),
      row({
        items: [
          item("a", {
            width: 80,
            height: 20,
            shrink: 1,
            minWidth: 60,
          }),
          item("b", {
            width: 80,
            height: 20,
            shrink: 1,
            minWidth: 20,
          }),
        ],
      }),
    );
    expect(nodeById(result.scene, "a").style).toMatchObject({
      left: 0,
      width: 60,
    });
    expect(nodeById(result.scene, "b").style).toMatchObject({
      left: 60,
      width: 40,
    });
  });

  it("rejects multiple sibling writers and constrained out-of-bounds results", () => {
    const input = scene(100, 100, [boxNode("a"), boxNode("b")]);
    const conflict = tryCompileLayout(
      input,
      overlay({
        items: [
          item("a", { width: 20, height: 20 }),
          item("b", {
            width: 20,
            height: 20,
            constraints: [
              { kind: "after", target: "a", axis: "x" },
              { kind: "align", target: "a", axis: "x", edge: "start" },
            ],
          }),
        ],
      }),
    );
    expect(conflict).toMatchObject({
      ok: false,
      errors: [{ code: "constraint_conflict" }],
    });

    const outOfBounds = tryCompileLayout(
      input,
      overlay({
        items: [
          item("a", {
            width: 20,
            height: 20,
            anchor: "top-right",
          }),
          item("b", {
            width: 20,
            height: 20,
            constraints: [{ kind: "after", target: "a", axis: "x", gap: 1 }],
          }),
        ],
      }),
    );
    expect(outOfBounds).toMatchObject({
      ok: false,
      errors: [{ code: "constraint_unsatisfied" }],
    });
  });

  it("makes compiled numeric output identical to core's Scene-v1 layout boxes", () => {
    const result = compileLayout(
      scene(320, 180, [boxNode("left"), boxNode("right")]),
      row({
        padding: { x: 16, y: 12 },
        gap: 8,
        align: "center",
        items: [
          item("left", { width: 80, height: 40 }),
          item("right", { width: "fill", height: 60 }),
        ],
      }),
    );
    const resolved = layoutScene(evaluateScene(result.scene, 0));
    for (const measurement of result.measurements) {
      const box = resolved.boxes.find(
        (candidate) => candidate.id === measurement.id,
      );
      expect(box).toMatchObject(measurement.resolved);
    }
  });

  it("clamps stack cross fill/stretch, preserves explicit cross sizes, and propagates aspect", () => {
    const filled = compileLayout(
      scene(300, 100, [boxNode("fill"), boxNode("fixed")]),
      row({
        align: "stretch",
        items: [
          item("fill", {
            width: 40,
            height: "fill",
            minHeight: 25,
            maxHeight: 30,
          }),
          item("fixed", { width: 40, height: 20 }),
        ],
      }),
    );
    expect(nodeById(filled.scene, "fill").style).toMatchObject({ height: 30 });
    expect(nodeById(filled.scene, "fixed").style).toMatchObject({ height: 20 });

    const aspect = compileLayout(
      scene(400, 200, [boxNode("ratio")]),
      column({
        items: [
          item("ratio", {
            width: "hug",
            height: "fill",
            aspectRatio: 1,
          }),
        ],
      }),
    );
    expect(nodeById(aspect.scene, "ratio").style).toMatchObject({
      width: 200,
      height: 200,
    });

    const wrapped = compileLayout(
      scene(200, 100, [boxNode("a"), boxNode("b")]),
      row({
        wrap: "wrap",
        items: [
          item("a", { width: 120, height: "fill" }),
          item("b", { width: 120, height: "fill" }),
        ],
      }),
    );
    expect(nodeById(wrapped.scene, "a").style?.height).toBe(50);
    expect(nodeById(wrapped.scene, "b").style).toMatchObject({
      top: 50,
      height: 50,
    });
  });

  it("rejects invalid tracks, huge indices, bad spans, and ignored kind-specific fields", () => {
    const input = scene(200, 100, [boxNode("a"), boxNode("b")]);
    expect(
      tryCompileLayout(
        input,
        grid({
          columns: [{ size: "fill", min: 100, max: 20 }],
          items: [item("a"), item("b", { grid: { row: 1, column: 0 } })],
        }),
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "invalid_geometry" }] });

    expect(
      tryCompileLayout(
        input,
        grid({
          columns: [{ size: "fill" }],
          items: [item("a", { grid: { row: 4095, column: 0 } }), item("b")],
        }),
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "budget_exceeded" }] });

    expect(
      tryCompileLayout(
        input,
        grid({
          columns: [{ size: "fill" }],
          rows: [{ size: "fill" }],
          items: [
            item("a", {
              grid: { row: 0, column: 0, columnSpan: 2 },
            }),
            item("b"),
          ],
        }),
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "grid_out_of_bounds" }] });

    for (const badPlan of [
      {
        layoutVersion: 1,
        containerId: "$root",
        layout: { kind: "stack", axis: "row" },
        items: [{ id: "a", justifySelf: "center" }, { id: "b" }],
      },
      {
        layoutVersion: 1,
        containerId: "$root",
        layout: { kind: "overlay", gap: 10 },
        items: [{ id: "a", grow: 1 }, { id: "b" }],
      },
    ]) {
      expect(validateLayoutPlan(badPlan)).toMatchObject({ ok: false });
    }
  });

  it("reserves explicit grid cells before auto placement and keeps column flow budget-independent", () => {
    const input = scene(200, 100, [boxNode("auto"), boxNode("declared")]);
    const reserved = compileLayout(
      input,
      grid({
        columns: [{ size: "fill" }, { size: "fill" }],
        rows: [{ size: "fill" }],
        items: [
          item("auto", { width: "fill", height: "fill" }),
          item("declared", {
            width: "fill",
            height: "fill",
            grid: { row: 0, column: 0 },
          }),
        ],
      }),
    );
    expect(nodeById(reserved.scene, "declared").style).toMatchObject({
      left: 0,
    });
    expect(nodeById(reserved.scene, "auto").style).toMatchObject({ left: 100 });

    const columnPlan = grid({
      columns: [{ size: "fill" }, { size: "fill" }],
      rows: [{ size: "fill" }, { size: "fill" }],
      autoFlow: "column",
      items: [
        item("a", { width: "fill", height: "fill" }),
        item("b", { width: "fill", height: "fill" }),
        item("c", { width: "fill", height: "fill" }),
      ],
    });
    const columnInput = scene(200, 200, [
      boxNode("a"),
      boxNode("b"),
      boxNode("c"),
    ]);
    const tight = compileLayout(columnInput, columnPlan, {
      budgets: { maxTracks: 4 },
    });
    const loose = compileLayout(columnInput, columnPlan, {
      budgets: { maxTracks: 40 },
    });
    expect(tight.measurements.map((entry) => entry.resolved)).toEqual(
      loose.measurements.map((entry) => entry.resolved),
    );
    expect(
      tryCompileLayout(columnInput, columnPlan, {
        budgets: { maxTracks: 3 },
      }),
    ).toMatchObject({ ok: false, errors: [{ code: "budget_exceeded" }] });
  });

  it("rejects unsatisfied match equality and every kind of container escape", () => {
    const match = tryCompileLayout(
      scene(200, 100, [boxNode("a"), boxNode("b")]),
      overlay({
        items: [
          item("a", { width: 80, height: 20 }),
          item("b", {
            width: 20,
            height: 20,
            maxWidth: 40,
            constraints: [{ kind: "match", target: "a", dimension: "width" }],
          }),
        ],
      }),
    );
    expect(match).toMatchObject({
      ok: false,
      errors: [{ code: "constraint_unsatisfied" }],
    });

    const aspectSource = scene(200, 100, [boxNode("source"), boxNode("copy")]);
    const matchedWidth = compileLayout(
      aspectSource,
      overlay({
        items: [
          item("source", { width: 80, height: 40 }),
          item("copy", {
            width: "hug",
            height: "hug",
            aspectRatio: 2,
            constraints: [
              { kind: "match", target: "source", dimension: "width" },
            ],
          }),
        ],
      }),
    );
    expect(nodeById(matchedWidth.scene, "copy").style).toMatchObject({
      width: 80,
      height: 40,
    });
    const matchedHeight = compileLayout(
      aspectSource,
      overlay({
        items: [
          item("source", { width: 80, height: 40 }),
          item("copy", {
            width: "hug",
            height: "hug",
            aspectRatio: 2,
            constraints: [
              { kind: "match", target: "source", dimension: "height" },
            ],
          }),
        ],
      }),
    );
    expect(nodeById(matchedHeight.scene, "copy").style).toMatchObject({
      width: 80,
      height: 40,
    });

    for (const result of [
      tryCompileLayout(
        scene(100, 100, [boxNode("a")]),
        overlay({
          items: [item("a", { width: 200, height: "hug", aspectRatio: 1 })],
        }),
      ),
      tryCompileLayout(
        scene(100, 100, [boxNode("a")]),
        row({ items: [item("a", { width: 20, height: 200 })] }),
      ),
      tryCompileLayout(
        scene(100, 100, [boxNode("a")]),
        grid({
          columns: [{ size: "fill" }],
          rows: [{ size: "fill" }],
          items: [item("a", { width: 200, height: 20 })],
        }),
      ),
    ]) {
      expect(result).toMatchObject({
        ok: false,
        errors: [{ code: "insufficient_space" }],
      });
    }

    expect(
      tryCompileLayout(
        scene(200, 100, [boxNode("ratio")]),
        overlay({
          items: [
            item("ratio", {
              width: 100,
              height: "hug",
              aspectRatio: 2,
              maxHeight: 20,
            }),
          ],
        }),
      ),
    ).toMatchObject({
      ok: false,
      errors: [{ code: "constraint_unsatisfied" }],
    });
  });

  it("does not request media metrics for fully-derived geometry and validates option/provider failures", () => {
    const input = scene(
      320,
      180,
      [{ id: "image", type: "img", assetId: "image" }],
      { image: { id: "image", type: "image", src: "image.png" } },
    );
    const fill = compileLayout(
      input,
      overlay({
        items: [item("image", { width: "fill", height: "fill" })],
      }),
    );
    expect(nodeById(fill.scene, "image").style).toMatchObject({
      width: 320,
      height: 180,
    });
    const ratio = compileLayout(
      input,
      overlay({
        items: [
          item("image", { width: 160, height: "hug", aspectRatio: 16 / 9 }),
        ],
      }),
    );
    expect(nodeById(ratio.scene, "image").style).toMatchObject({
      width: 160,
      height: 90,
    });

    expect(
      tryCompileLayout(
        input,
        overlay({ items: [item("image", { width: "fill", height: "fill" })] }),
        { budgets: { maxItems: 10, surprise: 1 } as never },
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "invalid_geometry" }] });

    const nested = scene(200, 100, [
      {
        id: "container",
        type: "div",
        style: { width: 200, height: 100, display: "flex" },
        children: [textNode("copy", "text")],
      },
    ]);
    expect(
      tryCompileLayout(
        nested,
        overlay({
          containerId: "container",
          items: [item("copy", { width: "hug", height: "hug" })],
        }),
        {
          textMetrics: {
            measureLine() {
              throw new Error("provider exploded");
            },
          },
          fontFallbackPolicy: "allow-system",
        },
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "invalid_geometry" }] });

    expect(
      tryCompileLayout(
        input,
        overlay({ items: [item("image", { width: "hug", height: "hug" })] }),
        {
          mediaMetrics: {
            measure() {
              return {
                width: 1e308,
                height: 1e308,
                measurement: "exact",
              };
            },
          },
        },
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "invalid_geometry" }] });
  });

  it("projects planned Latin/CJK/emoji/RTL text into deterministic Scene-v1 fields", () => {
    const samples = [
      { id: "latin", value: "hello world", direction: "ltr" },
      { id: "cjk", value: "这是一个测试", direction: "ltr" },
      { id: "emoji", value: "👨‍👩‍👧‍👦🙂🙂", direction: "ltr" },
      { id: "rtl", value: "مرحبا بالعالم", direction: "rtl" },
    ] as const;
    for (const sample of samples) {
      const node = textNode(sample.id, sample.value);
      node.from = 5;
      node.duration = 20;
      node.style = {
        ...node.style,
        textFit: "wrap",
        maxLines: 4,
      };
      node.animations = [
        {
          kind: "keyframes",
          property: "opacity",
          frames: [{ frame: 0, value: 1 }],
        },
      ];
      const result = compileLayout(
        scene(120, 100, [node]),
        overlay({
          defaultAnchor: "top-left",
          items: [item(sample.id, { width: 120, height: "hug" })],
        }),
        { textMetrics: exactText, fontFallbackPolicy: "allow-system" },
      );
      const output = nodeById(result.scene, sample.id);
      expect(output).toMatchObject({ from: 5, duration: 20 });
      expect(output.animations).toHaveLength(1);
      expect(output.style).toMatchObject({
        direction: sample.direction,
        fontSize: 20,
        lineHeight: "20px",
      });
      expect(output.style).not.toHaveProperty("textFit");
      expect(output.style).not.toHaveProperty("maxLines");
      expect(output.text).toBeTypeOf("string");
      const resolved = layoutScene(evaluateScene(result.scene, 5));
      expect(resolved.boxes[0]).toMatchObject(result.measurements[0]!.resolved);
    }
  });

  it("keeps rich runs only behind the explicit legacy-unsafe policy", () => {
    const rich: SceneNode = {
      id: "rich",
      type: "text",
      runs: [
        { text: "مرحبا ", style: { color: "#fff" } },
        { text: "world", style: { color: "#f00" } },
      ],
      style: { fontSize: 20, lineHeight: 1 },
    };
    const plan = overlay({
      items: [item("rich", { width: 100, height: "hug" })],
    });
    expect(tryCompileLayout(scene(200, 100, [rich]), plan)).toMatchObject({
      ok: false,
      errors: [{ code: "rich_text_unsafe" }],
    });
    const unsafe = compileLayout(scene(200, 100, [rich]), plan, {
      textMetrics: exactText,
      richTextPolicy: "legacy-unsafe",
      fontFallbackPolicy: "allow-system",
    });
    const output = nodeById(unsafe.scene, "rich");
    expect(output.runs).toHaveLength(2);
    expect(output.text).toBeUndefined();
    expect(output.style?.direction).toBe("rtl");
    expect(unsafe.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unsafe_text_planning" }),
      ]),
    );
  });

  it("rejects planned-text metric animations and unresolved cyclic grid aspect sizing", () => {
    const animated = textNode("copy", "animated text");
    animated.animations = [
      {
        kind: "keyframes",
        property: "fontSize",
        frames: [{ frame: 0, value: 20 }],
      },
    ];
    expect(
      tryCompileLayout(
        scene(200, 100, [animated]),
        overlay({ items: [item("copy", { width: 100, height: "hug" })] }),
        { textMetrics: exactText, fontFallbackPolicy: "allow-system" },
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "animation_conflict" }] });

    expect(
      tryCompileLayout(
        scene(100, 100, [boxNode("ratio")]),
        grid({
          columns: [{ size: "hug" }],
          rows: [{ size: "fill" }],
          items: [
            item("ratio", {
              width: "hug",
              height: "fill",
              aspectRatio: 1,
            }),
          ],
        }),
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "insufficient_space" }] });
  });

  it("selects the first declared font family and exposes detached text/font evidence", () => {
    const copy = textNode("copy", "deterministic typography");
    copy.style = {
      ...copy.style,
      fontFamily: `'Missing Font', "Noto Sans SC", Alpha`,
    };
    const input = scene(300, 120, [copy], {
      "Noto Sans SC": {
        id: "Noto Sans SC",
        type: "font",
        src: "noto.woff2",
      },
      Alpha: { id: "Alpha", type: "font", src: "alpha.woff2" },
    });
    const plan = overlay({
      items: [item("copy", { width: 180, height: "hug" })],
    });
    const result = compileLayout(input, plan, { textMetrics: exactText });
    expect(nodeById(result.scene, "copy").style?.fontFamily).toBe(
      "Noto Sans SC",
    );
    expect(result.measurements[0]).toMatchObject({
      font: {
        family: "Noto Sans SC",
        assetId: "Noto Sans SC",
        measurement: "declared",
      },
      textPlan: { baseDirection: "ltr", fit: { status: "fit" } },
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "prepared_font_selected" }),
      ]),
    );
    const detached = structuredClone(result.measurements[0]!.textPlan);
    detached!.lines[0]!.text = "mutated";
    expect(result.measurements[0]!.textPlan!.lines[0]!.text).not.toBe(
      "mutated",
    );
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);

    const systemInput = scene(300, 120, [textNode("copy", "system text")]);
    const missing = tryCompileLayout(systemInput, plan, {
      textMetrics: exactText,
    });
    expect(missing).toMatchObject({
      ok: false,
      errors: [{ code: "missing_prepared_font" }],
    });
    const system = compileLayout(systemInput, plan, {
      textMetrics: exactText,
      fontFallbackPolicy: "allow-system",
    });
    expect(system.measurements[0]?.font).toMatchObject({
      assetId: null,
      measurement: "estimated",
    });
    expect(system.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "system_font_fallback" }),
      ]),
    );

    const unsafeIdNode = textNode("copy", "unsafe asset id");
    unsafeIdNode.style = {
      ...unsafeIdNode.style,
      fontFamily: `"Name, Incorporated"`,
    };
    expect(
      tryCompileLayout(
        scene(300, 120, [unsafeIdNode], {
          "Name, Incorporated": {
            id: "Name, Incorporated",
            type: "font",
            src: "unsafe.woff2",
          },
        }),
        plan,
        { textMetrics: exactText },
      ),
    ).toMatchObject({
      ok: false,
      errors: [{ code: "missing_prepared_font" }],
    });
  });

  it("final-plans fill/fixed text with vertical fit, ellipsis, and inferred RTL", () => {
    const rtl = textNode("rtl", "مرحبا بالعالم");
    const filled = compileLayout(
      scene(200, 80, [rtl]),
      overlay({
        items: [item("rtl", { width: "fill", height: "fill" })],
      }),
      { textMetrics: exactText, fontFallbackPolicy: "allow-system" },
    );
    expect(nodeById(filled.scene, "rtl").style).toMatchObject({
      width: 200,
      height: 80,
      direction: "rtl",
      textAlign: "right",
    });
    expect(filled.measurements[0]?.textPlan).toMatchObject({
      baseDirection: "rtl",
      fit: { status: "fit" },
    });

    const shrinking = textNode("copy", "aaaa aaaa", "ltr");
    shrinking.style = {
      ...shrinking.style,
      fontSize: 20,
      minFontSize: 10,
      lineHeight: 1,
      textFit: "shrink",
    };
    const shrunk = compileLayout(
      scene(100, 40, [shrinking]),
      overlay({ items: [item("copy", { width: 45, height: 10 })] }),
      { textMetrics: exactText, fontFallbackPolicy: "allow-system" },
    );
    expect(nodeById(shrunk.scene, "copy").style).toMatchObject({
      fontSize: 10,
      lineHeight: "10px",
    });
    expect(nodeById(shrunk.scene, "copy").style).not.toHaveProperty("textFit");
    expect(shrunk.measurements[0]?.textPlan?.fit).toMatchObject({
      status: "fit",
      resolvedByShrink: true,
    });

    const truncated = textNode("copy", "one two three", "ltr");
    truncated.style = {
      ...truncated.style,
      fontSize: 10,
      lineHeight: 1,
      maxLines: 1,
      textOverflow: "ellipsis",
    };
    const ellipsis = compileLayout(
      scene(100, 40, [truncated]),
      overlay({ items: [item("copy", { width: 35, height: 10 })] }),
      { textMetrics: exactText, fontFallbackPolicy: "allow-system" },
    );
    expect(nodeById(ellipsis.scene, "copy").text).toBe("one tw…");
    expect(ellipsis.measurements[0]?.textPlan?.fit).toMatchObject({
      status: "clamped",
      truncated: true,
    });
  });

  it("enforces every host-tightenable solver budget and rejects unknown budget keys", () => {
    const pair = scene(200, 100, [boxNode("a"), boxNode("b")]);
    expect(
      tryCompileLayout(
        pair,
        overlay({
          items: [
            item("a", { width: 20, height: 20 }),
            item("b", {
              width: 20,
              height: 20,
              constraints: [
                { kind: "align", target: "a", axis: "x", edge: "start" },
                { kind: "align", target: "a", axis: "y", edge: "start" },
              ],
            }),
          ],
        }),
        { budgets: { maxConstraints: 1 } },
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "budget_exceeded" }] });

    expect(
      tryCompileLayout(
        scene(200, 100, [textNode("copy", "0123456789")]),
        overlay({ items: [item("copy", { width: 100, height: 20 })] }),
        {
          textMetrics: exactText,
          fontFallbackPolicy: "allow-system",
          budgets: { maxTextCharacters: 5 },
        },
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "budget_exceeded" }] });

    expect(
      tryCompileLayout(
        pair,
        overlay({
          items: [
            item("a", { width: 20, height: 20 }),
            item("b", { width: 20, height: 20 }),
          ],
        }),
        { budgets: { maxSolverSteps: 1 } },
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "budget_exceeded" }] });

    expect(
      tryCompileLayout(
        scene(200, 100, [boxNode("a")]),
        overlay({ items: [item("a", { width: 150, height: 20 })] }),
        { budgets: { maxCoordinate: 100 } },
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "invalid_geometry" }] });

    expect(
      tryCompileLayout(
        scene(100, 100, [boxNode("a")]),
        overlay({ items: [item("a", { width: 20, height: 20 })] }),
        { budgets: { maxItems: 10, unknownBudget: 1 } as never },
      ),
    ).toMatchObject({ ok: false, errors: [{ code: "invalid_geometry" }] });
  });

  it("adapts stack, nested grid, and overlay plans across portrait/square/landscape", () => {
    const outerPlan = column({
      items: [item("panel", { width: "fill", height: "fill" })],
    });
    const innerPlan = grid({
      containerId: "panel",
      columns: [{ size: "fill" }, { size: "fill" }],
      gap: "2%",
      items: ["a", "b", "c", "d"].map((id) =>
        item(id, { width: "fill", height: "fill" }),
      ),
    });
    const overlayPlan = overlay({
      safeArea: { x: "5%", y: "5%" },
      defaultAnchor: "bottom-right",
      items: [item("badge", { width: "20%", height: "10%" })],
    });
    for (const [width, height] of [
      [360, 640],
      [480, 480],
      [640, 360],
    ] satisfies Array<[number, number]>) {
      const source = scene(width, height, [
        {
          id: "panel",
          type: "div",
          style: { width: "100%", height: "100%", display: "flex" },
          children: [boxNode("a"), boxNode("b"), boxNode("c"), boxNode("d")],
        },
      ]);
      const outer = compileLayout(source, outerPlan);
      const nested = compileLayout(outer.scene, innerPlan);
      expect(validateScene(nested.scene)).toMatchObject({ ok: true });
      for (const id of ["a", "b", "c", "d"]) {
        const style = nodeById(nested.scene, id).style!;
        expect(style.width).toBeGreaterThan(0);
        expect(style.height).toBeGreaterThan(0);
        expect(
          (style.left as number) + (style.width as number),
        ).toBeLessThanOrEqual(width);
        expect(
          (style.top as number) + (style.height as number),
        ).toBeLessThanOrEqual(height);
      }

      const overlaid = compileLayout(
        scene(width, height, [boxNode("badge")]),
        overlayPlan,
      );
      const badge = nodeById(overlaid.scene, "badge").style!;
      expect((badge.left as number) + (badge.width as number)).toBeCloseTo(
        width * 0.95,
      );
      expect((badge.top as number) + (badge.height as number)).toBeCloseTo(
        height * 0.95,
      );
    }
  });
});
