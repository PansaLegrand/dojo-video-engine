import { describe, it, expect } from "vitest";
import { parseScene } from "@dojo-video-engine/schema";
import {
  evaluateScene,
  layoutScene,
  compileDisplayList,
  type DisplayGroup,
} from "@dojo-video-engine/core";
import { expandMacroNodes } from "@dojo-video-engine/presets/macros";

const ctx = { width: 720, height: 1280, fps: 24, duration: 120 };
const base = {
  macro: "radialGroup",
  id: "wheel",
  count: 4,
  radius: 120,
  centerX: 320,
  centerY: 440,
  itemWidth: 12,
  itemHeight: 20,
  from: 7,
  duration: 73,
  staggerFrames: 0,
};
function scene(extra = {}) {
  const result = expandMacroNodes([{ ...base, ...extra }], ctx);
  if (!result.ok) throw Error(result.errors.join("\n"));
  return parseScene({
    schemaVersion: 1,
    ...ctx,
    assets: {},
    nodes: result.nodes,
  });
}
function marks(s: ReturnType<typeof scene>, f: number) {
  return (
    compileDisplayList(layoutScene(evaluateScene(s, f))).groups[0]?.children ??
    []
  );
}
const center = (g: DisplayGroup) => [
  g.transformedBounds.x + g.transformedBounds.width / 2,
  g.transformedBounds.y + g.transformedBounds.height / 2,
];
const radius = (g: DisplayGroup) =>
  Math.hypot(center(g)[0]! - 320, center(g)[1]! - 440);
describe("radialGroup native motion", () => {
  it.each([2, 7, 64])(
    "places %i distinct marks on a closed ring with a stable hold",
    (count) => {
      const s = scene({ count, unknownHint: true }),
        held = marks(s, 50),
        final = marks(s, 79);
      expect(held.length).toBe(count);
      expect(final.map((g) => g.transformedBounds)).toEqual(
        held.map((g) => g.transformedBounds),
      );
      for (const [i, g] of final.entries()) {
        const angle = (2 * Math.PI * i) / count,
          [x, y] = center(g);
        expect(x).toBeCloseTo(320 + 120 * Math.sin(angle), 6);
        expect(y).toBeCloseTo(440 - 120 * Math.cos(angle), 6);
        expect(g.nodeId).toBe("wheel-mark-" + (i + 1));
        expect(g.composite.opacity).toBe(1);
      }
      expect(marks(s, 6)).toHaveLength(0);
      expect(marks(s, 80)).toHaveLength(0);
    },
  );
  it("includes both endpoints of a counterclockwise arc and uses child-local stagger clocks", () => {
    const s = scene({
      count: 3,
      startAngleDeg: 90,
      spreadDeg: -180,
      staggerFrames: 5,
      itemShape: "path",
      fill: "linear-gradient(90deg, #ff0000 0%, #ffcc22 100%)",
    });
    expect(marks(s, 11)).toHaveLength(1);
    expect(marks(s, 12)).toHaveLength(2);
    expect(marks(s, 12)[1]!.composite.opacity).toBe(0);
    const final = marks(s, 79);
    for (const [i, coord] of [
      [0, [440, 440]],
      [1, [320, 320]],
      [2, [200, 440]],
    ] as const) {
      expect(center(final[i]!)[0]).toBeCloseTo(coord[0]);
      expect(center(final[i]!)[1]).toBeCloseTo(coord[1]);
      expect(final[i]!.content?.kind).toBe("shape");
    }
  });
  it("orbits around the supplied center at a constant radius, including negative turns", () => {
    for (const sign of [1, -1]) {
      const s = scene({ motion: "orbit", orbitDegrees: sign * 360 });
      const quarter = marks(s, 25)[0]!;
      expect(center(quarter)[0]).toBeCloseTo(320 + sign * 120);
      expect(center(quarter)[1]).toBeCloseTo(440);
      for (const f of [7, 20, 43, 66, 79])
        expect(radius(marks(s, f)[0]!)).toBeCloseTo(120);
    }
  });
  it("distinguishes a pulse in place from a dispersing burst", () => {
    const pulse = scene({ motion: "pulse" }),
      burst = scene({ motion: "burst" });
    expect(marks(pulse, 43)[0]!.transformedBounds.width).toBeGreaterThan(
      marks(pulse, 7)[0]!.transformedBounds.width,
    );
    expect(center(marks(pulse, 43)[0]!)).toEqual(center(marks(pulse, 79)[0]!));
    expect(radius(marks(burst, 7)[0]!)).toBeLessThan(
      radius(marks(burst, 43)[0]!),
    );
    expect(marks(burst, 27)[0]!.composite.opacity).toBe(1);
    expect(marks(burst, 79)[0]!.composite.opacity).toBe(0);
  });
  it("stagger shifts equal pulse and burst envelopes without shortening later marks", () => {
    const pulse = scene({ motion: "pulse", count: 2, staggerFrames: 9 });
    // Both are already on the ring. The second waits at its starting scale.
    expect(marks(pulse, 7)).toHaveLength(2);
    expect(marks(pulse, 7)[1]!.transformedBounds.width).toBeCloseTo(
      marks(pulse, 15)[1]!.transformedBounds.width,
    );
    for (const local of [0, 15, 31, 62]) {
      expect(marks(pulse, 7 + local)[0]!.transformedBounds.width).toBeCloseTo(
        marks(pulse, 16 + local)[1]!.transformedBounds.width,
      );
    }
    const burst = scene({ motion: "burst", count: 2, staggerFrames: 9 });
    for (const local of [0, 15, 31, 63]) {
      const a = marks(burst, 7 + local)[0]!,
        b = marks(burst, 16 + local)[1]!;
      expect(a.composite.opacity).toBeCloseTo(b.composite.opacity);
      expect(radius(a)).toBeCloseTo(radius(b));
    }
  });

  it.each([
    { count: 1 },
    { count: 65 },
    { radius: 0 },
    { spreadDeg: 0 },
    { spreadDeg: 365 },
    { motion: "burst", duration: 2 },
    { staggerFrames: 25 },
  ])("rejects invalid radial requests %j", (bad) =>
    expect(() => scene(bad)).toThrow(),
  );
  it("resolves ID collisions against existing marks", () => {
    const result = expandMacroNodes([base], {
      ...ctx,
      existingIds: ["wheel-mark-1"],
    });
    if (!result.ok) throw Error(result.errors.join());
    expect(JSON.stringify(result.nodes)).not.toContain('"id":"wheel-mark-1"');
  });
});
