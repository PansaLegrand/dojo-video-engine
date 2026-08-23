import { describe, expect, it } from "vitest";
import {
  canonicalEffectParamKey,
  normalizeEffectColorsValue,
  normalizeEffectDirectionValue,
  normalizeEffectLevelValue,
  normalizeEffectParamValue,
  normalizeEffectScaleValue,
  normalizeEffectUnitValue,
} from "./effect-params.js";

describe("shared effect param normalization", () => {
  it("resolves aliases to canonical keys", () => {
    expect(canonicalEffectParamKey("largeness")).toBe("scale");
    expect(canonicalEffectParamKey("aura")).toBe("glow");
    expect(canonicalEffectParamKey("particle_count")).toBe("particleCount");
    expect(canonicalEffectParamKey("intensity")).toBe("intensity");
    expect(canonicalEffectParamKey("unknownKey")).toBe("unknownKey");
  });

  it("normalizes level words and numbers to low/medium/high", () => {
    expect(normalizeEffectLevelValue("strong")).toBe("high");
    expect(normalizeEffectLevelValue("subtle")).toBe("low");
    expect(normalizeEffectLevelValue("moderate")).toBe("medium");
    expect(normalizeEffectLevelValue(0.9)).toBe("high");
    expect(normalizeEffectLevelValue("0.1")).toBe("low");
    expect(normalizeEffectLevelValue("")).toBe("");
  });

  it("normalizes scale words to numbers", () => {
    expect(normalizeEffectScaleValue("huge")).toBe(1.75);
    expect(normalizeEffectScaleValue("1.2")).toBe(1.2);
    expect(normalizeEffectScaleValue(2)).toBe(2);
  });

  it("normalizes unit values from words and booleans", () => {
    expect(normalizeEffectUnitValue(true)).toBe(0.75);
    expect(normalizeEffectUnitValue(false)).toBe(0);
    expect(normalizeEffectUnitValue("strong")).toBe(0.8);
    expect(normalizeEffectUnitValue("0.4")).toBe(0.4);
  });

  it("normalizes direction synonyms including inside/outside", () => {
    expect(normalizeEffectDirectionValue("inward")).toBe("in");
    expect(normalizeEffectDirectionValue("inside")).toBe("in");
    expect(normalizeEffectDirectionValue("outside")).toBe("out");
    expect(normalizeEffectDirectionValue("diagonally")).toBe("diagonal");
    expect(normalizeEffectDirectionValue("left")).toBe("left");
  });

  it("normalizes colors and drops empty lists", () => {
    expect(normalizeEffectColorsValue(" #fff ")).toEqual(["#fff"]);
    expect(normalizeEffectColorsValue(["#fff", " ", "#000"])).toEqual([
      "#fff",
      "#000",
    ]);
    expect(normalizeEffectColorsValue("")).toBeUndefined();
    expect(normalizeEffectColorsValue([])).toBeUndefined();
  });

  it("coerces numeric strings for numeric keys via the dispatcher", () => {
    expect(normalizeEffectParamValue("particleCount", "24")).toBe(24);
    expect(normalizeEffectParamValue("seed", "7")).toBe(7);
    expect(normalizeEffectParamValue("emoji", "🎉")).toBe("🎉");
  });
});
