import { describe, expect, it } from "vitest";
import {
  createBoundedTextMetricsProvider,
  evaluateScene,
  layoutScene,
} from "@dojo-video-engine/core";
import {
  analyzeComposition,
  checkScene,
  hitTest,
  inspectLayout,
  inspectTimeline,
  inspectTree,
  type MediaMetricsProvider,
  type TextMetricsProvider,
} from "./index.js";

const timingScene = {
  schemaVersion: 1,
  width: 200,
  height: 100,
  fps: 10,
  duration: 20,
  assets: {
    clip: {
      id: "clip",
      type: "video",
      src: "clip.mp4",
      metadata: { duration: 9, width: 400, height: 100 },
    },
  },
  nodes: [
    {
      id: "parent",
      type: "div",
      from: 2,
      duration: 10,
      children: [
        {
          id: "clip-node",
          type: "video",
          assetId: "clip",
          from: 3,
          duration: 20,
          videoStartTime: 1,
          playbackRate: 2,
        },
      ],
    },
  ],
} as const;

describe("tree and timeline inspection", () => {
  it("emits stable hierarchy, source paths, and clipped half-open windows", () => {
    const tree = inspectTree(timingScene, {
      semanticRoles: { "clip-node": "primary-media" },
    });
    expect(tree.nodes).toEqual([
      expect.objectContaining({
        id: "parent",
        parentId: null,
        depth: 0,
        documentOrder: 0,
        sourcePath: ["nodes", 0],
        absoluteWindow: { start: 2, endExclusive: 12, duration: 10 },
        activeWindow: { start: 2, endExclusive: 12, duration: 10 },
      }),
      expect.objectContaining({
        id: "clip-node",
        parentId: "parent",
        depth: 1,
        documentOrder: 1,
        sourcePath: ["nodes", 0, "children", 0],
        semanticRole: "primary-media",
        localWindow: { start: 3, endExclusive: 23, duration: 20 },
        absoluteWindow: { start: 5, endExclusive: 25, duration: 20 },
        activeWindow: { start: 5, endExclusive: 12, duration: 7 },
        clippedByAncestor: true,
      }),
    ]);
  });

  it("reports source-time formulas and declared media duration", () => {
    const row = inspectTimeline(timingScene).nodes.find(
      (node) => node.id === "clip-node",
    );
    expect(row?.source).toEqual({
      assetId: "clip",
      kind: "video",
      offset: 1,
      rate: 2,
      loop: false,
      endBehavior: "hold",
      sourceStart: 1,
      sourceEndUnclamped: 2.4,
      intrinsicDuration: 9,
      measurement: "declared",
      reason: "Scene asset metadata",
    });
  });

  it("merges partial exact metrics with declared duration/frame rate provenance", () => {
    const scene = structuredClone(timingScene) as any;
    scene.assets.clip.metadata.frameRate = {
      numerator: 30_000,
      denominator: 1001,
    };
    const partial: MediaMetricsProvider = {
      measure: () => ({
        width: 1920,
        height: 1080,
        measurement: "exact",
        reason: "decoded video track",
      }),
    };
    const source = inspectTimeline(scene, { mediaMetrics: partial }).nodes.find(
      (node) => node.id === "clip-node",
    )?.source;
    expect(source).toMatchObject({
      intrinsicDuration: 9,
      frameRate: { numerator: 30_000, denominator: 1001 },
      measurement: "declared",
      reason: "Scene asset metadata",
    });
    const media = inspectLayout(scene, 5, { mediaMetrics: partial }).nodes.find(
      (node) => node.id === "clip-node",
    )?.media;
    expect(media).toMatchObject({
      intrinsic: {
        width: 1920,
        height: 1080,
        durationSeconds: 9,
        frameRate: { numerator: 30_000, denominator: 1001 },
      },
      measurement: "exact",
      reason: "decoded video track",
    });
  });
});

const visualScene = {
  schemaVersion: 1,
  width: 200,
  height: 100,
  fps: 10,
  duration: 20,
  assets: {
    image: { id: "image", type: "image", src: "image.png" },
  },
  nodes: [
    {
      id: "media",
      type: "img",
      assetId: "image",
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        objectFit: "cover",
        zIndex: 0,
      },
    },
    {
      id: "title",
      type: "text",
      text: "HELLO WORLD",
      style: {
        position: "absolute",
        left: 20,
        top: 20,
        width: 100,
        height: 30,
        padding: 5,
        fontSize: 10,
        zIndex: 1,
        transform: "translate(10px, 0px)",
      },
    },
    {
      id: "subtitle",
      type: "text",
      text: "Caption",
      style: {
        position: "absolute",
        left: 20,
        top: 75,
        width: 160,
        height: 20,
        fontSize: 10,
        zIndex: 2,
      },
    },
  ],
} as const;

const textMetrics: TextMetricsProvider = {
  measureLine: ({ text, fontSize }) => ({
    width: text.length * fontSize,
    ascent: fontSize * 0.75,
    descent: fontSize * 0.25,
    measurement: "exact",
    reason: "test font metrics",
  }),
};

const mediaMetrics: MediaMetricsProvider = {
  measure: () => ({
    width: 400,
    height: 100,
    durationSeconds: 4,
    measurement: "exact",
    reason: "test media probe",
  }),
};

describe("layout and hit testing", () => {
  it("reports content/transformed/text/media geometry with provenance", () => {
    const layout = inspectLayout(visualScene, 0, {
      textMetrics,
      mediaMetrics,
      semanticRoles: { subtitle: "subtitle" },
    });
    const title = layout.nodes.find((node) => node.id === "title");
    const media = layout.nodes.find((node) => node.id === "media");
    expect(title).toMatchObject({
      paintOrder: 1,
      zIndex: 1,
      contentBounds: { x: 25, y: 25, width: 90, height: 20 },
      transformedBounds: { x: 30, y: 20, width: 100, height: 30 },
      text: {
        measurement: "exact",
        reason: "test font metrics",
        direction: "inherit",
      },
    });
    expect(media?.media).toMatchObject({
      intrinsic: { width: 400, height: 100, durationSeconds: 4 },
      objectFit: "cover",
      cropFraction: 0.75,
      measurement: "exact",
    });
    expect(JSON.parse(JSON.stringify(layout))).toEqual(layout);
  });

  it("uses the same bounded text provider for core and inspection layout", () => {
    let calls = 0;
    const shared = createBoundedTextMetricsProvider(
      {
        measureLine: ({ text, fontSize }) => {
          calls += 1;
          return {
            width: text.length * fontSize,
            ascent: fontSize * 0.75,
            descent: fontSize * 0.25,
            measurement: "exact",
            reason: "shared prepared font",
          };
        },
      },
      { maxEntries: 64 },
    );
    const autoHeightScene = structuredClone(visualScene) as any;
    delete autoHeightScene.nodes[1].style.height;
    const core = layoutScene(evaluateScene(autoHeightScene, 0), {
      textMetrics: shared,
    });
    const inspected = inspectLayout(autoHeightScene, 0, {
      textMetrics: shared,
    });
    const coreTitle = core.boxes.find((box) => box.id === "title");
    const inspectedTitle = inspected.nodes.find((node) => node.id === "title");
    expect(inspectedTitle?.layoutBounds).toMatchObject({
      x: coreTitle?.x,
      y: coreTitle?.y,
      width: coreTitle?.width,
      height: coreTitle?.height,
    });
    expect(inspectedTitle?.text?.measurement).toBe("exact");
    expect(shared.cacheStats().hits).toBeGreaterThan(0);
    expect(calls).toBeLessThan(
      shared.cacheStats().hits + shared.cacheStats().misses,
    );
  });

  it("returns topmost hits first and respects transforms", () => {
    const hit = hitTest(visualScene, 0, { x: 40, y: 25 }, { textMetrics });
    expect(hit.hits.map((entry) => entry.nodeId).slice(0, 2)).toEqual([
      "title",
      "media",
    ]);
    expect(hit.hits[0]?.localPoint).toEqual({ x: 10, y: 5 });
  });

  it("clamps direct frame inspection but rejects invalid sampled frames", () => {
    expect(inspectLayout(visualScene, 99).clamped).toBe(true);
    expect(() => analyzeComposition(visualScene, [20])).toThrow(/outside/);
    expect(() => analyzeComposition(visualScene, { sampleCount: 101 })).toThrow(
      /sampleCount/,
    );
    expect(() =>
      analyzeComposition(visualScene, { frames: [0], sampleCount: 1 }),
    ).toThrow(/either frames or sampleCount/);
    expect(() =>
      analyzeComposition(
        visualScene,
        Array.from({ length: 101 }, () => 0),
      ),
    ).toThrow(/100/);
  });

  it("keeps document-order ties and composes nested transforms", () => {
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 10,
      duration: 2,
      assets: {},
      nodes: [
        {
          id: "parent",
          type: "div",
          style: {
            position: "absolute",
            width: 50,
            height: 50,
            transform: "translate(10px, 0px)",
          },
          children: [
            {
              id: "child-a",
              type: "div",
              style: {
                position: "absolute",
                width: 20,
                height: 20,
                zIndex: 3,
                transform: "translate(5px, 0px)",
              },
            },
            {
              id: "child-b",
              type: "div",
              style: {
                position: "absolute",
                width: 20,
                height: 20,
                zIndex: 3,
              },
            },
          ],
        },
      ],
    } as const;
    const layout = inspectLayout(scene, 0);
    expect(
      layout.nodes.find((node) => node.id === "child-a")?.transformedBounds.x,
    ).toBe(15);
    expect(
      hitTest(scene, 0, { x: 16, y: 10 })
        .hits.map((hit) => hit.nodeId)
        .slice(0, 2),
    ).toEqual(["child-b", "child-a"]);
  });

  it("rejects points outside closed clip and mask geometry", () => {
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 10,
      duration: 2,
      assets: {},
      nodes: [
        {
          id: "clipped",
          type: "div",
          style: { width: 100, height: 100 },
          clip: { kind: "ellipse" },
          mask: {
            shape: {
              kind: "polygon",
              points: [
                { x: 0.2, y: 0.2 },
                { x: 0.8, y: 0.2 },
                { x: 0.5, y: 0.8 },
              ],
            },
          },
        },
      ],
    } as const;
    // Inside both conservative AABBs, but outside the triangular mask.
    expect(hitTest(scene, 0, { x: 25, y: 75 }).hits).toEqual([]);
    const clipOnly = structuredClone(scene) as any;
    delete clipOnly.nodes[0].mask;
    // Inside the ellipse AABB, but outside the ellipse itself.
    expect(hitTest(clipOnly, 0, { x: 5, y: 5 }).hits).toEqual([]);
    expect(hitTest(scene, 0, { x: 50, y: 50 }).hits[0]?.nodeId).toBe("clipped");
  });

  it("honors rounded overflow, rounded clips, and animated mask geometry", () => {
    const rounded = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 10,
      duration: 2,
      assets: {},
      nodes: [
        {
          id: "parent",
          type: "div",
          style: {
            width: 100,
            height: 100,
            overflow: "hidden",
            borderRadius: 50,
          },
          children: [
            {
              id: "child",
              type: "div",
              style: { width: 100, height: 100 },
            },
          ],
        },
        {
          id: "rounded-clip",
          type: "div",
          style: { width: 100, height: 100, zIndex: 2 },
          clip: { kind: "rect", radius: 50 },
        },
      ],
    } as const;
    expect(
      inspectLayout(rounded, 0).nodes.find((node) => node.id === "child")
        ?.clipBounds.measurement,
    ).toBe("estimated");
    expect(hitTest(rounded, 0, { x: 2, y: 2 }).hits).toEqual([]);
    expect(
      hitTest(rounded, 0, { x: 50, y: 50 }).hits.map((hit) => hit.nodeId),
    ).toEqual(["rounded-clip", "child", "parent"]);

    const animatedMask = {
      ...rounded,
      nodes: [
        {
          id: "animated-mask",
          type: "div",
          style: { width: 100, height: 100 },
          mask: { shape: { kind: "rect", radius: 0 } },
          animations: [
            {
              kind: "keyframes",
              property: "mask.radius",
              frames: [
                { frame: 0, value: 0 },
                { frame: 1, value: 50 },
              ],
            },
          ],
        },
      ],
    } as const;
    expect(hitTest(animatedMask, 0, { x: 2, y: 2 }).hits).toHaveLength(1);
    expect(hitTest(animatedMask, 1, { x: 2, y: 2 }).hits).toEqual([]);
  });

  it("filters effective ancestor and mask transparency", () => {
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 10,
      duration: 2,
      assets: {},
      nodes: [
        { id: "base", type: "div", style: { width: 100, height: 100 } },
        {
          id: "zero-mask",
          type: "div",
          style: { width: 100, height: 100, zIndex: 1 },
          mask: { shape: { kind: "rect" }, opacity: 0 },
        },
        {
          id: "inverse-mask",
          type: "div",
          style: { width: 100, height: 100, zIndex: 2 },
          mask: { shape: { kind: "rect" }, inverted: true },
        },
        {
          id: "transparent-parent",
          type: "div",
          style: { width: 100, height: 100, opacity: 0, zIndex: 3 },
          children: [
            {
              id: "hidden-child",
              type: "div",
              style: { width: 100, height: 100 },
            },
          ],
        },
      ],
    } as const;
    expect(
      hitTest(scene, 0, { x: 50, y: 50 }).hits.map((hit) => hit.nodeId),
    ).toEqual(["base"]);
    const diagnostics = inspectLayout(scene, 0).diagnostics;
    expect(
      diagnostics.some(
        (entry) =>
          [entry.nodeId, ...entry.relatedNodeIds].some((id) =>
            ["zero-mask", "inverse-mask", "hidden-child"].includes(id),
          ) && ["geometric_overlap", "possible_occlusion"].includes(entry.code),
      ),
    ).toBe(false);
  });

  it("does not invert conservative SVG-path positives into false negatives", () => {
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 10,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "inverse-path",
          type: "div",
          style: { width: 100, height: 100 },
          mask: {
            inverted: true,
            shape: {
              kind: "path",
              d: "M 20 20 L 80 20 L 50 80 Z",
              viewBox: { x: 0, y: 0, width: 100, height: 100 },
            },
          },
        },
      ],
    } as const;
    expect(hitTest(scene, 0, { x: 5, y: 5 }).hits[0]).toMatchObject({
      nodeId: "inverse-path",
      measurement: "estimated",
    });
  });

  it("returns explicitly estimated line-stroke hits", () => {
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 10,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "line",
          type: "shape",
          shape: {
            kind: "line",
            points: [
              { x: 0.1, y: 0.5 },
              { x: 0.9, y: 0.5 },
            ],
          },
          style: { width: 100, height: 100, strokeWidth: 10 },
        },
      ],
    } as const;
    expect(hitTest(scene, 0, { x: 50, y: 54 }).hits[0]).toMatchObject({
      nodeId: "line",
      measurement: "estimated",
    });
    expect(hitTest(scene, 0, { x: 50, y: 60 }).hits).toEqual([]);
  });

  it("keeps text subgeometry in world coordinates and qualifies synthesized metrics", () => {
    const widthOnly: TextMetricsProvider = {
      measureLine: ({ text, fontSize }) => ({
        width: text.length * fontSize,
        measurement: "exact",
        reason: "width-only provider",
      }),
    };
    const layout = inspectLayout(visualScene, 0, { textMetrics: widthOnly });
    const text = layout.nodes.find((node) => node.id === "title")?.text;
    expect(text?.lines[0]?.bounds.x).toBe(30);
    expect(text?.measurement).toBe("estimated");
    expect(text?.lines[0]?.reason).toMatch(/ascent\/descent/);
  });

  it("positions condensed center/right text bounds from drawn width", () => {
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 10,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "center",
          type: "text",
          text: "X",
          style: {
            position: "absolute",
            left: 20,
            top: 0,
            width: 50,
            height: 20,
            textAlign: "center",
          },
        },
        {
          id: "right",
          type: "text",
          text: "X",
          style: {
            position: "absolute",
            left: 20,
            top: 30,
            width: 50,
            height: 20,
            textAlign: "right",
          },
        },
      ],
    } as const;
    const layout = inspectLayout(scene, 0, {
      textMetrics: {
        measureLine: () => ({
          width: 100,
          ascent: 8,
          descent: 2,
          measurement: "exact",
        }),
      },
    });
    expect(
      layout.nodes.find((node) => node.id === "center")?.text?.lines[0]?.bounds,
    ).toMatchObject({ x: 20, width: 50 });
    expect(
      layout.nodes.find((node) => node.id === "right")?.text?.lines[0]?.bounds,
    ).toMatchObject({ x: 20, width: 50 });
  });

  it("qualifies rotated text and media world-space bounds", () => {
    const scene = structuredClone(visualScene) as any;
    scene.nodes[0].style.transform = "rotate(30deg)";
    scene.nodes[1].style.transform = "rotate(30deg)";
    const layout = inspectLayout(scene, 0, { textMetrics, mediaMetrics });
    expect(
      layout.nodes.find((node) => node.id === "title")?.text,
    ).toMatchObject({
      measurement: "estimated",
      lines: expect.arrayContaining([
        expect.objectContaining({
          measurement: "estimated",
          reason: expect.stringMatching(/rotated text/),
        }),
      ]),
    });
    expect(
      layout.nodes.find((node) => node.id === "media")?.media,
    ).toMatchObject({
      measurement: "estimated",
      reason: expect.stringMatching(/rotated media/),
    });
  });

  it("rejects non-finite direct inputs and provider output", () => {
    expect(() => inspectLayout(visualScene, Number.NaN)).toThrow(/finite/);
    expect(() => hitTest(visualScene, 0, { x: Number.NaN, y: 0 })).toThrow(
      /finite/,
    );
    expect(() =>
      inspectLayout(visualScene, 0, {
        textMetrics: { measureLine: () => ({ width: Number.NaN }) },
      }),
    ).toThrow(/invalid width/);
    expect(() =>
      inspectLayout(visualScene, 0, {
        textMetrics: {
          measureLine: () =>
            ({
              width: 10,
              ascent: 8,
              descent: 2,
              measurement: "unsupported",
            }) as any,
        },
      }),
    ).toThrow(/invalid measurement label/);
    expect(() =>
      inspectLayout(visualScene, 0, {
        mediaMetrics: {
          measure: () => ({ width: -1, height: 100 }),
        },
      }),
    ).toThrow(/invalid width/);
  });

  it("labels exact, declared, and estimated measurements", () => {
    const exact = inspectLayout(visualScene, 0, { textMetrics, mediaMetrics });
    expect(
      exact.nodes.find((node) => node.id === "title")?.text?.measurement,
    ).toBe("exact");
    expect(
      exact.nodes.find((node) => node.id === "media")?.media?.measurement,
    ).toBe("exact");
    const declared = inspectLayout(
      {
        ...visualScene,
        assets: {
          image: {
            ...visualScene.assets.image,
            metadata: { width: 320, height: 180 },
          },
        },
      },
      0,
    );
    expect(
      declared.nodes.find((node) => node.id === "media")?.media?.measurement,
    ).toBe("declared");
    const estimated = inspectLayout(visualScene, 0);
    expect(
      estimated.nodes.find((node) => node.id === "title")?.text?.measurement,
    ).toBe("estimated");
    expect(
      estimated.nodes.find((node) => node.id === "media")?.media?.measurement,
    ).toBe("estimated");
  });

  it("reports text overflow, direction, and font metrics", () => {
    const scene = structuredClone(visualScene) as any;
    const title = scene.nodes[1];
    title.text = "ONE TWO THREE FOUR";
    title.style.width = 45;
    title.style.height = 10;
    title.style.maxLines = 1;
    title.style.textOverflow = "ellipsis";
    title.style.direction = "rtl";
    title.style.fontFamily = "Inspection Sans";
    const text = inspectLayout(scene, 0, { textMetrics }).nodes.find(
      (node) => node.id === "title",
    )?.text;
    expect(text).toMatchObject({
      direction: "rtl",
      fontFamily: "Inspection Sans",
      overflow: "vertical",
      truncated: true,
      measurement: "exact",
    });
    expect(text?.lines[0]).toMatchObject({ ascent: 7.5, descent: 2.5 });
  });
});

describe("deterministic diagnostics and check envelope", () => {
  it("uses explicit roles, skips allowed/ancestor overlap, and labels confidence", () => {
    const options = {
      textMetrics,
      mediaMetrics,
      semanticRoles: { subtitle: "subtitle" },
      unsafeInsets: 10,
      safeAreaRoles: ["subtitle"],
    };
    const first = inspectLayout(visualScene, 0, options);
    const codes = new Set(first.diagnostics.map((entry) => entry.code));
    expect(codes).toEqual(
      new Set([
        "excessive_crop",
        "geometric_overlap",
        "possible_occlusion",
        "unsafe_edge",
      ]),
    );
    expect(
      first.diagnostics.every(
        (entry) =>
          entry.nodeId &&
          entry.sourcePath.length > 0 &&
          ["high", "medium", "low"].includes(entry.confidence) &&
          entry.reason.length > 0,
      ),
    ).toBe(true);
    const allowed = inspectLayout(visualScene, 0, {
      ...options,
      allowedOverlaps: [["title", "media"]],
    });
    expect(
      allowed.diagnostics.some(
        (entry) =>
          entry.relatedNodeIds.includes("media") && entry.nodeId === "title",
      ),
    ).toBe(false);
  });

  it("requires explicit safe-area policy and downgrades conservative overlap evidence", () => {
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 10,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "background",
          type: "div",
          style: { width: 100, height: 100 },
          clip: { kind: "ellipse" },
        },
        {
          id: "copy",
          type: "text",
          text: "Copy",
          style: { width: 60, height: 20 },
        },
      ],
    } as const;
    const unprotected = inspectLayout(scene, 0, {
      semanticRoles: { background: "full-bleed-media" },
      unsafeInsets: 10,
      safeAreaRoles: ["subtitle"],
    });
    expect(
      unprotected.diagnostics.some((entry) => entry.code === "unsafe_edge"),
    ).toBe(false);
    const protectedLayout = inspectLayout(scene, 0, {
      semanticRoles: { background: "full-bleed-media" },
      unsafeInsets: 10,
      safeAreaRoles: ["full-bleed-media"],
    });
    expect(
      protectedLayout.diagnostics.some((entry) => entry.code === "unsafe_edge"),
    ).toBe(true);
    const overlap = unprotected.diagnostics.find(
      (entry) => entry.code === "geometric_overlap",
    );
    expect(overlap).toMatchObject({ confidence: "low", confidenceScore: 0.5 });
    expect(overlap?.reason).toMatch(/conservative estimated bounds/);
  });

  it("emits subtitle collision only for an explicit subtitle role", () => {
    const scene = structuredClone(visualScene) as any;
    scene.nodes[2].style.top = 25;
    scene.nodes[1].style.zIndex = 3;
    const withoutRole = inspectLayout(scene, 0, { textMetrics });
    expect(
      withoutRole.diagnostics.some(
        (entry) => entry.code === "subtitle_collision",
      ),
    ).toBe(false);
    const withRole = inspectLayout(scene, 0, {
      textMetrics,
      semanticRoles: { subtitle: "subtitle" },
    });
    expect(
      withRole.diagnostics.some((entry) => entry.code === "subtitle_collision"),
    ).toBe(true);
  });

  it("covers zero-size, outside-frame, and flex-overflow diagnostics", () => {
    const scene = {
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 10,
      duration: 2,
      assets: {},
      nodes: [
        {
          id: "zero",
          type: "div",
          style: { position: "absolute", width: 0, height: 10 },
        },
        {
          id: "outside",
          type: "div",
          style: {
            position: "absolute",
            left: 150,
            width: 20,
            height: 20,
          },
        },
        {
          id: "flex",
          type: "div",
          style: { display: "flex", width: 50, height: 20 },
          children: [
            { id: "one", type: "div", style: { width: 40, height: 20 } },
            { id: "two", type: "div", style: { width: 40, height: 20 } },
          ],
        },
      ],
    } as const;
    const codes = new Set(
      inspectLayout(scene, 0).diagnostics.map((diagnostic) => diagnostic.code),
    );
    expect(codes.has("zero_size")).toBe(true);
    expect(codes.has("outside_frame")).toBe(true);
    expect(codes.has("flex_overflow")).toBe(true);
  });

  it("returns one JSON check envelope for valid warnings and invalid input", () => {
    const valid = checkScene(visualScene, {
      frames: [0],
      textMetrics,
      mediaMetrics,
      semanticRoles: { subtitle: "subtitle" },
    });
    expect(valid).toMatchObject({
      kind: "dojo-video-engine.check",
      version: 1,
      ok: true,
      validation: { ok: true, errors: [] },
      structural: { width: 200, height: 100 },
    });
    const invalid = checkScene({ schemaVersion: 1 });
    expect(invalid).toMatchObject({
      kind: "dojo-video-engine.check",
      version: 1,
      ok: false,
      validation: { ok: false },
      structural: null,
      tree: null,
    });
    expect(JSON.parse(JSON.stringify(invalid))).toEqual(invalid);
  });

  it("is deterministic and does not mutate the Scene", () => {
    const scene = structuredClone(visualScene);
    const before = JSON.stringify(scene);
    const first = analyzeComposition(scene, { frames: [0, 10] });
    const second = analyzeComposition(scene, { frames: [0, 10] });
    expect(second).toEqual(first);
    expect(JSON.stringify(scene)).toBe(before);
  });
});
