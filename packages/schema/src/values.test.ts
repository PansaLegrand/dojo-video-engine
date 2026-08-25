import { describe, expect, it } from "vitest";
import {
  borderValueSchema,
  colorValueSchema,
  easingValueSchema,
  filterValueSchema,
  fontFamilyValueSchema,
  fontWeightValueSchema,
  isPaintValue,
  lengthValueSchema,
  objectPositionValueSchema,
  paintValueSchema,
  parseBorderValue,
  parseColorValue,
  parseConicGradientValue,
  parseEasingValue,
  parseFilterValue,
  parseFontFamilyListValue,
  parseLinearGradientValue,
  parseObjectPositionValue,
  parseRadialGradientValue,
  parseShadowListValue,
  parseTransformOriginValue,
  parseTransformValue,
  resolveGradientStopOffsets,
  serializeBorderValue,
  serializeColorValue,
  serializeEasingValue,
  serializeFilterValue,
  serializeObjectPositionValue,
  serializePaintValue,
  serializeShadowListValue,
  serializeTransformValue,
  singleShadowValueSchema,
  shadowValueSchema,
  textStrokeValueSchema,
  transformValueSchema,
  transformOriginValueSchema,
} from "./values.js";

describe("shared color and paint grammar", () => {
  it("parses portable color forms with bounded channels", () => {
    expect(parseColorValue("#0F08")).toMatchObject({
      kind: "rgba",
      red: 0,
      green: 255,
      blue: 0,
    });
    expect(parseColorValue("rgba(255, 10, 0, 50%)")).toMatchObject({
      alpha: 0.5,
    });
    expect(parseColorValue("rgb(255 0 128 / 50%)")).toMatchObject({
      red: 255,
      green: 0,
      blue: 128,
      alpha: 0.5,
    });
    expect(parseColorValue("hsl(120, 100%, 25%)")).toMatchObject({
      red: 0,
      green: 127.5,
      blue: 0,
      alpha: 1,
    });
    expect(parseColorValue("hsla(240, 100%, 50%, 0.4)")).toMatchObject({
      red: 0,
      green: 0,
      blue: 255,
      alpha: 0.4,
    });
    expect(parseColorValue("hsl(0.5turn 100% 50% / 25%)")).toMatchObject({
      red: 0,
      green: 255,
      blue: 255,
      alpha: 0.25,
    });
    expect(parseColorValue("gold")).toEqual({
      kind: "named",
      source: "gold",
      name: "gold",
    });
    expect(parseColorValue("transparent")?.kind).toBe("named");
    expect(parseColorValue("rgb(256, 0, 0)")).toBeNull();
    expect(parseColorValue("rgba(0, 0, 0, 1.1)")).toBeNull();
    expect(parseColorValue("color(display-p3 1 0 0)")).toBeNull();
    expect(parseColorValue("not-a-css-color")).toBeNull();
  });

  it("serializes colors deterministically", () => {
    const color = parseColorValue("#0f08");
    expect(color && serializeColorValue(color)).toBe(
      "rgba(0, 255, 0, 0.533333)",
    );
    expect(colorValueSchema.safeParse("rebeccapurple").success).toBe(true);
    expect(colorValueSchema.safeParse("var(--brand)").success).toBe(false);
  });

  it("parses and serializes supported gradient families", () => {
    const linear = parseLinearGradientValue(
      "linear-gradient(to right, #000 0%, rgba(255, 255, 255, 0.5), #fff 100%)",
    );
    expect(linear).toMatchObject({ kind: "linear-gradient", angleDeg: 90 });
    expect(linear && serializePaintValue(linear)).toBe(
      "linear-gradient(90deg, rgb(0, 0, 0) 0%, rgba(255, 255, 255, 0.5), rgb(255, 255, 255) 100%)",
    );

    expect(
      parseRadialGradientValue(
        "radial-gradient(circle at 25% 75%, #fff, #000)",
      ),
    ).toMatchObject({
      kind: "radial-gradient",
      centerX: 0.25,
      centerY: 0.75,
    });
    expect(
      parseConicGradientValue(
        "conic-gradient(from 45deg at 40% 60%, red 0%, blue 100%)",
      ),
    ).toMatchObject({
      kind: "conic-gradient",
      angleDeg: 45,
      centerX: 0.4,
      centerY: 0.6,
    });
    expect(isPaintValue("linear-gradient(#000, #fff)")).toBe(true);
    expect(isPaintValue("linear-gradient(#000)")).toBe(false);
    expect(isPaintValue("linear-gradient(#not-a-color, #fff)")).toBe(false);
    expect(
      paintValueSchema.safeParse("radial-gradient(#fff, #000)").success,
    ).toBe(true);
  });

  it("resolves percentage stops and rejects nonzero pixel positions", () => {
    const gradient = parseLinearGradientValue(
      "linear-gradient(#000 60%, #888 20%, #aaa, #fff 100%)",
    );
    expect(gradient && resolveGradientStopOffsets(gradient.stops)).toEqual([
      { color: "#000", offset: 0.6 },
      { color: "#888", offset: 0.6 },
      { color: "#aaa", offset: 0.6000000000000001 },
      { color: "#fff", offset: 1 },
    ]);
    expect(
      parseLinearGradientValue("linear-gradient(#000 1px, #fff 100%)"),
    ).toBeNull();
    expect(
      parseLinearGradientValue("linear-gradient(#000 0px, #fff 100%)"),
    ).not.toBeNull();
  });
});

describe("shared length grammar", () => {
  it("accepts the renderer-supported numeric, px, and percent subset", () => {
    for (const value of [10, -4.5, "10", "-4.5px", "25%", " 8px "]) {
      expect(lengthValueSchema.safeParse(value).success, String(value)).toBe(
        true,
      );
    }
    for (const value of [
      Number.POSITIVE_INFINITY,
      "3rem",
      "calc(10px)",
      "x10",
    ]) {
      expect(lengthValueSchema.safeParse(value).success, String(value)).toBe(
        false,
      );
    }
  });
});

describe("portable Canvas font descriptors", () => {
  it("accepts bounded family lists and CSS font weights", () => {
    for (const family of [
      "Inter, system-ui, Arial, sans-serif",
      "'Noto Sans SC', sans-serif",
      '"Name, With Comma", serif',
      "思源黑体, sans-serif",
    ]) {
      expect(fontFamilyValueSchema.safeParse(family).success, family).toBe(
        true,
      );
    }
    for (const family of ["", "Arial,", "Arial\nserif", "Arial; serif"]) {
      expect(fontFamilyValueSchema.safeParse(family).success, family).toBe(
        false,
      );
    }
    for (const weight of [1, 400, 550.5, 1_000, "400", "bold", "lighter"]) {
      expect(
        fontWeightValueSchema.safeParse(weight).success,
        String(weight),
      ).toBe(true);
    }
    for (const weight of [0, 1_001, Number.NaN, "banana", "0", "1001"]) {
      expect(
        fontWeightValueSchema.safeParse(weight).success,
        String(weight),
      ).toBe(false);
    }
  });

  it("parses exact ids and family lists into detached decoded entries", () => {
    expect(parseFontFamilyListValue("GoldenSans")).toEqual([
      { family: "GoldenSans", token: "GoldenSans", quoted: false },
    ]);
    expect(
      parseFontFamilyListValue(
        `  'Noto Sans SC' , "Name\\, With \\"Quote\\" and \\\\ Slash", 思源黑体, sans-serif  `,
      ),
    ).toEqual([
      {
        family: "Noto Sans SC",
        token: "'Noto Sans SC'",
        quoted: true,
      },
      {
        family: `Name, With "Quote" and \\ Slash`,
        token: `"Name\\, With \\"Quote\\" and \\\\ Slash"`,
        quoted: true,
      },
      { family: "思源黑体", token: "思源黑体", quoted: false },
      { family: "sans-serif", token: "sans-serif", quoted: false },
    ]);

    const first = parseFontFamilyListValue("Inter, serif")!;
    first[0]!.family = "mutated";
    expect(parseFontFamilyListValue("Inter, serif")?.[0]?.family).toBe("Inter");
  });

  it("bounds lists and rejects malformed or unsafe family tokens", () => {
    expect(
      parseFontFamilyListValue(
        Array.from({ length: 32 }, (_, index) => `Font${index}`).join(","),
      ),
    ).toHaveLength(32);
    for (const family of [
      Array.from({ length: 33 }, (_, index) => `Font${index}`).join(","),
      "A".repeat(1_025),
      "Arial,",
      ",Arial",
      "Arial,,serif",
      `""`,
      `"unterminated`,
      `"bad\\"`,
      `"bad\u0000name"`,
      `"bad\nname"`,
      `unquoted\\,comma`,
      `"closed"suffix`,
    ]) {
      expect(
        parseFontFamilyListValue(family),
        JSON.stringify(family),
      ).toBeNull();
      expect(fontFamilyValueSchema.safeParse(family).success).toBe(false);
    }
  });
});

describe("shared transform grammar", () => {
  it("normalizes the renderer-supported transform subset", () => {
    const parsed = parseTransformValue(
      "translate(25%, -10) scale(1.25) rotate(-45deg)",
    );
    expect(parsed).toEqual({
      kind: "transform-list",
      functions: [
        {
          kind: "translate",
          x: { value: 25, unit: "%" },
          y: { value: -10, unit: "px" },
        },
        { kind: "scale", x: 1.25, y: 1.25 },
        { kind: "rotate", degrees: -45 },
      ],
    });
    expect(parsed && serializeTransformValue(parsed)).toBe(
      "translate(25%, -10px) scale(1.25, 1.25) rotate(-45deg)",
    );
  });

  it("rejects unsupported functions, units, and trailing syntax", () => {
    expect(parseTransformValue("matrix(1, 0, 0, 1, 0, 0)")).toBeNull();
    expect(parseTransformValue("translate(1em, 2px)")).toBeNull();
    expect(parseTransformValue("scale(1px)")).toBeNull();
    expect(parseTransformValue("rotate(1turn)")).toBeNull();
    expect(parseTransformValue("translate(1px) garbage")).toBeNull();
    expect(transformValueSchema.safeParse("none").success).toBe(true);
    expect(transformValueSchema.safeParse("").success).toBe(false);
  });

  it("validates the renderer's explicit transform-origin axes", () => {
    expect(parseTransformOriginValue("left 25%")).toEqual({
      x: { kind: "keyword", value: "left" },
      y: { kind: "length", value: { value: 25, unit: "%" } },
    });
    expect(parseTransformOriginValue("10px")).toEqual({
      x: { kind: "length", value: { value: 10, unit: "px" } },
      y: { kind: "keyword", value: "center" },
    });
    expect(transformOriginValueSchema.safeParse("right bottom").success).toBe(
      true,
    );
    expect(transformOriginValueSchema.safeParse("top left").success).toBe(
      false,
    );
    expect(transformOriginValueSchema.safeParse("banana center").success).toBe(
      false,
    );
  });

  it("normalizes bounded object-position axes and keyword order", () => {
    const expected = {
      x: { kind: "keyword", value: "right" },
      y: { kind: "keyword", value: "bottom" },
    } as const;
    expect(parseObjectPositionValue("right bottom")).toEqual(expected);
    expect(parseObjectPositionValue("bottom right")).toEqual(expected);
    const positioned = parseObjectPositionValue("25% 10px");
    expect(positioned && serializeObjectPositionValue(positioned)).toBe(
      "25% 10px",
    );
    expect(objectPositionValueSchema.safeParse("top").success).toBe(true);
    expect(objectPositionValueSchema.safeParse("banana center").success).toBe(
      false,
    );
    expect(objectPositionValueSchema.safeParse("left right").success).toBe(
      false,
    );
  });
});

describe("shared filter grammar", () => {
  it("parses unit-correct Canvas filters and round-trips them", () => {
    const parsed = parseFilterValue(
      "brightness(125%) hue-rotate(-30deg) blur(4px) opacity(0.8)",
    );
    expect(parsed).toMatchObject({ kind: "filter-list" });
    expect(parsed && serializeFilterValue(parsed)).toBe(
      "brightness(125%) hue-rotate(-30deg) blur(4px) opacity(0.8)",
    );
    expect(filterValueSchema.safeParse("none").success).toBe(true);
  });

  it("rejects cross-function units and negative scalar filters", () => {
    expect(parseFilterValue("blur(2%)")).toBeNull();
    expect(parseFilterValue("hue-rotate(30)")).toBeNull();
    expect(parseFilterValue("brightness(-1)")).toBeNull();
    expect(parseFilterValue("drop-shadow(0 0 4px red)")).toBeNull();
  });
});

describe("shared border and shadow grammars", () => {
  it("parses solid borders, including deliberate zero-width borders", () => {
    const border = parseBorderValue("2px solid rgba(10, 20, 30, 0.5)");
    expect(border).toMatchObject({ width: 2, style: "solid" });
    expect(border && serializeBorderValue(border)).toBe(
      "2px solid rgba(10, 20, 30, 0.5)",
    );
    expect(parseBorderValue("0 solid transparent")).toMatchObject({ width: 0 });
    expect(parseBorderValue("2px dashed #fff")).toBeNull();
    expect(parseBorderValue("-1px solid #fff")).toBeNull();
    expect(borderValueSchema.safeParse("1px #fff").success).toBe(true);
  });

  it("parses bounded comma-separated shadow lists", () => {
    const shadows = parseShadowListValue(
      "0 8px 20px rgba(0,0,0,0.45), -4px 0 10px gold",
    );
    expect(shadows).toMatchObject([
      { offsetX: 0, offsetY: 8, blur: 20 },
      { offsetX: -4, offsetY: 0, blur: 10 },
    ]);
    expect(shadows && serializeShadowListValue(shadows)).toBe(
      "0px 8px 20px rgba(0, 0, 0, 0.45), -4px 0px 10px gold",
    );
    expect(parseShadowListValue("inset 0 1px #fff")).toBeNull();
    expect(parseShadowListValue("0 1px 2px 3px #000")).toBeNull();
    expect(parseShadowListValue("0 1px -2px #000")).toBeNull();
    expect(shadowValueSchema.safeParse("0 1px #000").success).toBe(true);
    expect(singleShadowValueSchema.safeParse("0 1px #000").success).toBe(true);
    expect(
      singleShadowValueSchema.safeParse("0 1px #000, 0 2px #fff").success,
    ).toBe(false);
    expect(textStrokeValueSchema.safeParse("4px #000").success).toBe(true);
    expect(textStrokeValueSchema.safeParse("10% #000").success).toBe(true);
    expect(textStrokeValueSchema.safeParse("0 solid #000").success).toBe(false);
  });
});

describe("shared easing grammar", () => {
  it("parses and serializes named, bezier, and spring easing", () => {
    expect(parseEasingValue("easeInOut")).toEqual({
      kind: "named",
      name: "easeInOut",
    });
    const bezier = parseEasingValue("cubic-bezier(0.42, 0, 0.58, 1)");
    expect(bezier && serializeEasingValue(bezier)).toBe(
      "cubic-bezier(0.42, 0, 0.58, 1)",
    );
    const spring = parseEasingValue("spring");
    expect(spring).toEqual({ kind: "spring", bounce: 0.25 });
    expect(spring && serializeEasingValue(spring)).toBe("spring(0.25)");
    expect(easingValueSchema.safeParse("linear").success).toBe(true);
  });

  it("rejects non-monotonic bezier x controls and unstable springs", () => {
    expect(parseEasingValue("cubic-bezier(-0.1, 0, 0.5, 1)")).toBeNull();
    expect(parseEasingValue("cubic-bezier(0.1, 0, 1.1, 1)")).toBeNull();
    expect(parseEasingValue("spring(-0.1)")).toBeNull();
    expect(parseEasingValue("spring(1)")).toBeNull();
  });
});
