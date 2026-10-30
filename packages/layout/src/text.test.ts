import { describe, expect, it } from "vitest";
import {
  compileDisplayList,
  evaluateScene,
  layoutScene,
  type TextMetricsProvider,
} from "@dojo-video-engine/core";
import type { Scene } from "@dojo-video-engine/schema";
import { LayoutCompileError } from "./types.js";
import {
  LAYOUT_TEXT_UNICODE_TABLE_VERSION,
  measureLayoutText,
  projectLayoutTextToSceneV1,
  resolveLayoutTextBaseDirection,
  segmentLayoutTextGraphemes,
} from "./text.js";

const exactMetrics: TextMetricsProvider = {
  measureLine({ text, fontSize }) {
    return {
      width: segmentLayoutTextGraphemes(text).length * fontSize,
      ascent: fontSize * 0.45,
      descent: fontSize * 0.45,
      measurement: "exact",
      reason: "deterministic test font",
    };
  },
};

function node(
  text: string,
  style: Parameters<typeof measureLayoutText>[0]["style"] = {},
) {
  return { id: "title", text, style };
}

describe("bundled Layout v2 grapheme segmentation", () => {
  it("keeps combining, variation, modifier, ZWJ, flag, and CRLF clusters intact", () => {
    const value = "e\u0301✈️👍🏽👩🏽‍💻👨‍👩‍👧‍👦🇺🇳\r\nZ";
    const clusters = segmentLayoutTextGraphemes(value);

    expect(clusters.map((cluster) => cluster.text)).toEqual([
      "e\u0301",
      "✈️",
      "👍🏽",
      "👩🏽‍💻",
      "👨‍👩‍👧‍👦",
      "🇺🇳",
      "\r\n",
      "Z",
    ]);
    expect(
      clusters.map(({ sourceStart, sourceEnd }) =>
        value.slice(sourceStart, sourceEnd),
      ),
    ).toEqual(clusters.map((cluster) => cluster.text));
    expect(clusters.at(-1)?.sourceEnd).toBe(value.length);
  });

  it("pairs regional indicators without swallowing the next flag", () => {
    expect(
      segmentLayoutTextGraphemes("🇫🇷🇯🇵🇨").map((cluster) => cluster.text),
    ).toEqual(["🇫🇷", "🇯🇵", "🇨"]);
  });

  it("uses pinned tables without consulting host Intl.Segmenter", () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, "Segmenter");
    Object.defineProperty(Intl, "Segmenter", {
      configurable: true,
      get() {
        throw new Error("host Segmenter must not be read");
      },
    });
    try {
      expect(LAYOUT_TEXT_UNICODE_TABLE_VERSION).toBe(
        "dojo-video-engine-layout-text-1/unicode-15.1-subset",
      );
      expect(
        segmentLayoutTextGraphemes("نَक्🚀").map((cluster) => cluster.text),
      ).toEqual(["نَ", "क्", "🚀"]);
    } finally {
      if (descriptor) Object.defineProperty(Intl, "Segmenter", descriptor);
      else delete (Intl as { Segmenter?: unknown }).Segmenter;
    }
  });
});

describe("Layout v2 base direction", () => {
  it("uses explicit direction or deterministic first-strong text", () => {
    expect(resolveLayoutTextBaseDirection("— مرحبا", undefined)).toBe("rtl");
    expect(resolveLayoutTextBaseDirection("— hello مرحبا", undefined)).toBe(
      "ltr",
    );
    expect(resolveLayoutTextBaseDirection("🚀 123", undefined)).toBe("ltr");
    expect(resolveLayoutTextBaseDirection("hello", "rtl")).toBe("rtl");
    expect(resolveLayoutTextBaseDirection("، ١٢ hello مرحبا", undefined)).toBe(
      "ltr",
    );
  });

  it("maps inferred RTL start alignment to a physical right edge", () => {
    const measured = measureLayoutText(node("مرحبا", { fontSize: 10 }), {
      availableWidth: 100,
      provider: exactMetrics,
    });

    expect(measured.baseDirection).toBe("rtl");
    expect(measured.physicalAlign).toBe("right");
    expect(measured.lines[0]?.inkBounds.x).toBe(50);
  });

  it("rejects host-inherited direction unless explicitly opted into warning mode", () => {
    expect(() =>
      measureLayoutText(node("مرحبا", { direction: "inherit" }), {
        provider: exactMetrics,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "text_direction_required" }),
    );

    const unsafe = measureLayoutText(node("مرحبا", { direction: "inherit" }), {
      provider: exactMetrics,
      inheritDirectionPolicy: "legacy-unsafe",
    });
    expect(unsafe.baseDirection).toBe("rtl");
    expect(unsafe.diagnostics).toEqual([
      expect.objectContaining({ code: "unsafe_legacy_direction" }),
    ]);
  });
});

describe("Layout v2 deterministic wrapping", () => {
  it("wraps Latin words and retains UTF-16 source grapheme ranges", () => {
    const measured = measureLayoutText(
      node("one two three", { fontSize: 10, lineHeight: 1 }),
      { availableWidth: 70, provider: exactMetrics },
    );

    expect(measured.lines.map((line) => line.text)).toEqual([
      "one two",
      "three",
    ]);
    expect(
      measured.lines.map((line) => [line.sourceStart, line.sourceEnd]),
    ).toEqual([
      [0, 7],
      [8, 13],
    ]);
    expect(measured.fit).toMatchObject({ status: "fit", truncated: false });
  });

  it("packs mixed Latin and CJK instead of wasting the remaining line", () => {
    const measured = measureLayoutText(
      node("Hi 中文测试", { fontSize: 10, lineHeight: 1 }),
      { availableWidth: 50, provider: exactMetrics },
    );

    expect(measured.lines.map((line) => line.text)).toEqual([
      "Hi 中文",
      "测试",
    ]);
  });

  it("keeps closing punctuation off line starts and opening punctuation off line ends", () => {
    const closing = measureLayoutText(
      node("你好，世界", { fontSize: 10, lineHeight: 1 }),
      { availableWidth: 30, provider: exactMetrics },
    );
    expect(closing.lines.map((line) => line.text)).toEqual(["你好，", "世界"]);
    expect(closing.lines.every((line) => !line.text.startsWith("，"))).toBe(
      true,
    );

    const opening = measureLayoutText(
      node("你好（世界）", { fontSize: 10, lineHeight: 1 }),
      { availableWidth: 30, provider: exactMetrics },
    );
    expect(opening.lines.every((line) => !line.text.endsWith("（"))).toBe(true);
    expect(opening.lines.every((line) => !line.text.startsWith("）"))).toBe(
      true,
    );
  });

  it("preserves explicit CRLF empty lines", () => {
    const measured = measureLayoutText(
      node("A\r\n\r\nB", { fontSize: 10, lineHeight: 1 }),
      { availableWidth: 100, provider: exactMetrics },
    );
    expect(measured.lines.map((line) => line.text)).toEqual(["A", "", "B"]);
    expect(measured.lines[1]).toMatchObject({ sourceStart: 3, sourceEnd: 3 });
  });

  it("never breaks an emoji or combining cluster", () => {
    const measured = measureLayoutText(
      node("👩🏽‍💻🇺🇳e\u0301👍🏽", { fontSize: 10, lineHeight: 1 }),
      { availableWidth: 10, provider: exactMetrics },
    );
    expect(measured.lines.map((line) => line.text)).toEqual([
      "👩🏽‍💻",
      "🇺🇳",
      "e\u0301",
      "👍🏽",
    ]);
  });

  it("keeps NBSP and narrow NBSP chains nonbreaking", () => {
    for (const value of ["A\u00a0B", "A\u202fB", "A\u00a0\u202fB"]) {
      const measured = measureLayoutText(
        node(value, { fontSize: 10, lineHeight: 1 }),
        { availableWidth: 20, provider: exactMetrics },
      );
      expect(
        measured.lines.map((line) => line.text),
        value,
      ).toEqual([value]);
      expect(measured.fit.status, value).toBe("impossible");
    }
  });

  it("treats Unicode line and paragraph separators as explicit paragraphs", () => {
    const measured = measureLayoutText(
      node("A\u2028B\u2029C", { fontSize: 10, lineHeight: 1 }),
      { availableWidth: 100, provider: exactMetrics },
    );
    expect(measured.lines.map((line) => line.text)).toEqual(["A", "B", "C"]);
    expect(
      projectLayoutTextToSceneV1(
        node("A\u2028B\u2029C", { fontSize: 10, lineHeight: 1 }),
        measured,
      ).text,
    ).toBe("A\nB\nC");
  });
});

describe("Layout v2 fitting and provenance", () => {
  it("quantizes shrink fitting and chooses the largest fitting size", () => {
    const measured = measureLayoutText(
      node("aaaa aaaa", {
        fontSize: 20,
        minFontSize: 10,
        lineHeight: 1,
        textFit: "shrink",
      }),
      {
        availableWidth: 90,
        availableHeight: 20,
        provider: exactMetrics,
        fontSizeQuantum: 0.5,
      },
    );

    expect(measured.fontSize).toBe(10);
    expect(measured.lines.map((line) => line.text)).toEqual(["aaaa aaaa"]);
    expect(measured.fit).toMatchObject({
      status: "fit",
      resolvedByShrink: true,
    });
  });

  it("reports an atomic grapheme that cannot fit at min size as impossible", () => {
    const measured = measureLayoutText(
      node("👩🏽‍💻", {
        fontSize: 20,
        minFontSize: 10,
        lineHeight: 1,
        textFit: "shrink",
      }),
      {
        availableWidth: 5,
        availableHeight: 20,
        provider: exactMetrics,
      },
    );

    expect(measured.fontSize).toBe(10);
    expect(measured.lines[0]?.text).toBe("👩🏽‍💻");
    expect(measured.fit).toMatchObject({
      status: "impossible",
      horizontalOverflow: true,
    });
  });

  it("owns a synthetic ellipsis by the final retained source grapheme", () => {
    const measured = measureLayoutText(
      node("one two three", {
        fontSize: 10,
        lineHeight: 1,
        maxLines: 1,
        textOverflow: "ellipsis",
      }),
      { availableWidth: 70, provider: exactMetrics },
    );
    const ellipsis = measured.lines[0]?.graphemes.at(-1);

    expect(measured.lines[0]?.text).toBe("one tw…");
    expect(measured.fit).toMatchObject({ status: "clamped", truncated: true });
    expect(ellipsis).toEqual({
      text: "…",
      sourceStart: null,
      sourceEnd: null,
      synthetic: "ellipsis",
      ownerSourceStart: 5,
      ownerSourceEnd: 6,
    });
  });

  it("emits middle-baseline line and ink metrics with field provenance", () => {
    const measured = measureLayoutText(
      node("abc", {
        fontSize: 20,
        lineHeight: 1.5,
        textAlign: "center",
      }),
      { availableWidth: 100, provider: exactMetrics },
    );
    expect(measured.lines[0]).toMatchObject({
      width: 60,
      ascent: 9,
      descent: 9,
      baselineY: 15,
      lineBox: { x: 0, y: 0, width: 100, height: 30 },
      inkBounds: { x: 20, y: 6, width: 60, height: 18 },
      measurement: "exact",
      fieldMeasurements: {
        width: { measurement: "exact" },
        ascent: { measurement: "exact" },
        descent: { measurement: "exact" },
      },
    });
  });

  it("uses explicit estimated vertical provenance for width-only providers", () => {
    const measured = measureLayoutText(node("abc", { fontSize: 10 }), {
      provider: { measureLine: ({ text }) => ({ width: text.length * 10 }) },
    });
    expect(measured.lines[0]).toMatchObject({
      ascent: 5,
      descent: 5,
      measurement: "estimated",
      fieldMeasurements: {
        ascent: { measurement: "estimated" },
        descent: { measurement: "estimated" },
      },
    });
  });
});

describe("Layout v2 Scene v1 projection", () => {
  it("projects resolved lines and neutralizes fields that would re-fit", () => {
    const input = node("one two three", {
      width: 70,
      height: 20,
      fontSize: 10,
      minFontSize: 8,
      lineHeight: 1,
      maxLines: 1,
      textFit: "shrink",
      textOverflow: "ellipsis",
    });
    const measured = measureLayoutText(input, {
      availableWidth: 70,
      availableHeight: 20,
      provider: exactMetrics,
    });
    const projection = projectLayoutTextToSceneV1(input, measured);

    expect(projection).toMatchObject({
      id: "title",
      text: measured.lines.map((line) => line.text).join("\n"),
      style: {
        direction: measured.baseDirection,
        textAlign: measured.physicalAlign,
        fontSize: measured.fontSize,
        lineHeight: `${measured.lineHeight}px`,
      },
    });
    expect(projection.style).not.toHaveProperty("maxLines");
    expect(projection.style).not.toHaveProperty("minFontSize");
    expect(projection.style).not.toHaveProperty("textFit");
    expect(projection.style).not.toHaveProperty("textOverflow");
    expect(input.style).toMatchObject({
      maxLines: 1,
      minFontSize: 8,
      textFit: "shrink",
      textOverflow: "ellipsis",
    });
  });

  it("produces the planned Latin/CJK/emoji/RTL display lines with supplied metrics", () => {
    const cases = [
      "one two three",
      "Hi 中文测试段落",
      "👩🏽‍💻🇺🇳e\u0301👍🏽",
      "مرحبا بالعالم",
    ];
    for (const [index, value] of cases.entries()) {
      const input = {
        id: `case-${index}`,
        text: value,
        style: {
          width: 60,
          height: 100,
          fontSize: 10,
          lineHeight: 1,
          maxLines: 5,
          textOverflow: "ellipsis" as const,
        },
      };
      const measured = measureLayoutText(input, {
        availableWidth: 60,
        availableHeight: 100,
        provider: exactMetrics,
      });
      const projection = projectLayoutTextToSceneV1(input, measured);
      const scene: Scene = {
        schemaVersion: 1,
        width: 100,
        height: 120,
        fps: 30,
        duration: 1,
        assets: {},
        nodes: [{ ...projection, type: "text" }],
      };
      const display = compileDisplayList(
        layoutScene(evaluateScene(scene, 0), { textMetrics: exactMetrics }),
        { textMetrics: exactMetrics },
      );
      const content = display.groups[0]?.content;
      expect(content?.kind).toBe("text");
      if (content?.kind !== "text") throw new Error("missing text display");
      expect(
        content.lines.map((line) => line.text),
        value,
      ).toEqual(measured.lines.map((line) => line.text));
      expect(content.font.size).toBe(measured.fontSize);
      expect(content.lineHeight).toBe(measured.lineHeight);
      expect(content.direction).toBe(measured.baseDirection);
      expect(content.align).toBe(measured.physicalAlign);
    }
  });

  it("rejects mismatched, rich, and impossible plans by default", () => {
    const input = node("x", { fontSize: 10, textFit: "shrink" });
    const impossible = measureLayoutText(input, {
      availableWidth: 1,
      provider: exactMetrics,
    });
    expect(() => projectLayoutTextToSceneV1(input, impossible)).toThrowError(
      expect.objectContaining({ code: "constraint_unsatisfied" }),
    );
    expect(() =>
      projectLayoutTextToSceneV1({ ...input, id: "other" }, impossible, {
        allowImpossible: true,
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_geometry" }));

    const rich = {
      id: "rich",
      runs: [{ text: "A" }, { text: "V" }],
      style: { direction: "ltr" as const },
    };
    const measured = measureLayoutText(rich, {
      provider: exactMetrics,
      richTextPolicy: "legacy-unsafe",
    });
    expect(() => projectLayoutTextToSceneV1(rich, measured)).toThrowError(
      expect.objectContaining({ code: "rich_text_unsafe" }),
    );
  });
});

describe("Layout v2 safety and budgets", () => {
  it("rejects rich runs or emits an explicit unsafe diagnostic", () => {
    const rich = {
      id: "rich",
      runs: [{ text: "A" }, { text: "V" }],
      style: { direction: "ltr" as const },
    };
    expect(() =>
      measureLayoutText(rich, { provider: exactMetrics }),
    ).toThrowError(expect.objectContaining({ code: "rich_text_unsafe" }));
    const unsafe = measureLayoutText(rich, {
      provider: exactMetrics,
      richTextPolicy: "legacy-unsafe",
    });
    expect(unsafe.value).toBe("AV");
    expect(unsafe.diagnostics).toEqual([
      expect.objectContaining({ code: "unsafe_legacy_rich_text" }),
    ]);
  });

  it("passes frozen defensive style input to the shared metrics provider", () => {
    const input = node("abc", { fontFamily: "Test Sans", fontSize: 10 });
    const before = structuredClone(input);
    measureLayoutText(input, {
      provider: {
        measureLine(metricInput) {
          expect(Object.isFrozen(metricInput)).toBe(true);
          expect(Object.isFrozen(metricInput.style)).toBe(true);
          expect(() => {
            (metricInput.style as { fontFamily?: string }).fontFamily = "bad";
          }).toThrow();
          return { width: metricInput.text.length * metricInput.fontSize };
        },
      },
    });
    expect(input).toEqual(before);
  });

  it("enforces grapheme, line, and metric-call budgets with stable errors", () => {
    expect(() =>
      measureLayoutText(node("abc"), { budgets: { maxGraphemes: 2 } }),
    ).toThrowError(expect.objectContaining({ code: "budget_exceeded" }));
    expect(() =>
      measureLayoutText(node("a b c", { fontSize: 10 }), {
        availableWidth: 10,
        provider: exactMetrics,
        budgets: { maxMeasureCalls: 1 },
      }),
    ).toThrowError(expect.objectContaining({ code: "budget_exceeded" }));
    expect(() =>
      measureLayoutText(node("a\nb\nc", { fontSize: 10 }), {
        provider: exactMetrics,
        budgets: { maxLines: 2 },
      }),
    ).toThrowError(expect.objectContaining({ code: "budget_exceeded" }));
    expect(() =>
      measureLayoutText(node("abcd"), {
        budgets: { maxTextCodeUnits: 3 },
      }),
    ).toThrowError(expect.objectContaining({ code: "budget_exceeded" }));
  });

  it("rejects unknown or unsafe budget values instead of accepting open options", () => {
    expect(() =>
      measureLayoutText(node("abc"), {
        budgets: { maxGraphemes: 10, typoBudget: 1 } as never,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_geometry",
        message: expect.stringContaining("unsupported keys"),
      }),
    );
    expect(() =>
      measureLayoutText(node("abc"), {
        budgets: { maxMeasureCalls: Number.MAX_SAFE_INTEGER },
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_geometry" }));
  });

  it("fails every exhausted break or shrink search instead of returning altered geometry", () => {
    expect(() =>
      measureLayoutText(node("abcdefghij", { fontSize: 10 }), {
        availableWidth: 30,
        provider: exactMetrics,
        budgets: { maxBreakSearchPasses: 1 },
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "budget_exceeded",
        message: expect.stringContaining("break search passes"),
      }),
    );
    expect(() =>
      measureLayoutText(
        node("abc", {
          fontSize: 20,
          minFontSize: 10,
          lineHeight: 1,
          textFit: "shrink",
        }),
        {
          availableWidth: 100,
          availableHeight: 15,
          provider: exactMetrics,
          budgets: { maxBreakSearchPasses: 1 },
        },
      ),
    ).toThrowError(expect.objectContaining({ code: "budget_exceeded" }));
  });

  it("rejects hostile provider and output geometry before it becomes non-JSON", () => {
    expect(() =>
      measureLayoutText(node("x", { fontSize: 10 }), {
        provider: {
          measureLine: () => ({
            width: 1e308,
            ascent: 1,
            descent: 1,
          }),
        },
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_geometry" }));
    expect(() =>
      measureLayoutText(node("x", { fontSize: 10 }), {
        provider: {
          measureLine: () => ({
            width: 10,
            ascent: 9_000_000,
            descent: 9_000_000,
          }),
        },
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_geometry" }));
    expect(() =>
      measureLayoutText(node("x"), { availableWidth: 1e308 }),
    ).toThrowError(expect.objectContaining({ code: "invalid_geometry" }));
  });

  it("bounds the font quantum and keeps the largest supported tick JSON-safe", () => {
    for (const options of [
      { fontSizeQuantum: 0.0000001 },
      { fontSizeQuantum: Number.MIN_VALUE },
    ]) {
      expect(() =>
        measureLayoutText(node("x", { fontSize: 10 }), options),
      ).toThrowError(expect.objectContaining({ code: "invalid_geometry" }));
    }
    expect(() =>
      measureLayoutText(node("x", { fontSize: 0.0000001 }), {
        fontSizeQuantum: 0.000001,
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_geometry" }));
    const largest = measureLayoutText(
      node("x", { fontSize: 1_000_000, minFontSize: 1_000_000 }),
      { provider: exactMetrics, fontSizeQuantum: 0.000001 },
    );
    expect(largest.fontSize).toBe(1_000_000);
    expect(JSON.parse(JSON.stringify(largest))).toEqual(largest);
  });

  it("keeps measure-call growth linear for long spaceless CJK", () => {
    const text = "字".repeat(2_000);
    const measured = measureLayoutText(
      node(text, { fontSize: 10, lineHeight: 1 }),
      {
        availableWidth: 100,
        provider: exactMetrics,
        budgets: { maxMeasureCalls: 8_000 },
      },
    );

    expect(measured.lineCount).toBe(200);
    expect(measured.measureCalls).toBeLessThanOrEqual(4_100);
  });

  it("keeps long Latin token breaking bounded instead of rescanning remainders", () => {
    const text = "a".repeat(8_000);
    const measured = measureLayoutText(
      node(text, { fontSize: 10, lineHeight: 1 }),
      {
        availableWidth: 100,
        provider: exactMetrics,
        budgets: { maxMeasureCalls: 12_000 },
      },
    );

    expect(measured.lineCount).toBe(800);
    expect(measured.measureCalls).toBeLessThanOrEqual(8_100);
  });

  it("returns byte-stable JSON and only JSON-safe data", () => {
    const input = node("Hello 世界 🚀", {
      fontSize: 10,
      maxLines: 2,
      textOverflow: "ellipsis",
    });
    const options = { availableWidth: 50, provider: exactMetrics };
    const first = measureLayoutText(input, options);
    const second = measureLayoutText(input, options);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it("uses LayoutCompileError for invalid geometry", () => {
    try {
      measureLayoutText(node("x", { fontSize: "50%" }), {
        provider: exactMetrics,
      });
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(LayoutCompileError);
      expect(error).toMatchObject({ code: "invalid_geometry" });
    }
  });
});
