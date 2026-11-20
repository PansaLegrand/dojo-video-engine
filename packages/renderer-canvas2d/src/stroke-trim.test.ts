import { afterEach, expect, it, vi } from "vitest";
import { trimmedStroke } from "./stroke-trim.js";
class Recorder {
  ops: number[][] = [];
  moveTo(x: number, y: number) {
    this.ops.push([0, x, y]);
  }
  lineTo(x: number, y: number) {
    this.ops.push([1, x, y]);
  }
}
afterEach(() => vi.unstubAllGlobals());
const box = { x: 0, y: 0, width: 120, height: 100 },
  r = { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
it("trims compound paths by fitted length, never bridges gaps, and seeks without accumulated state", () => {
  vi.stubGlobal("Path2D", Recorder);
  const g = {
    kind: "path" as const,
    d: "M0 0 L40 0 M60 0 L120 0",
    viewBox: box,
  };
  const run = (a: number, b: number, offset = 0) =>
    (trimmedStroke(g, box, r, a, b, offset) as unknown as Recorder).ops;
  expect(run(0.2, 0.7)).toEqual([
    [0, 20, 0],
    [1, 40, 0],
    [0, 60, 0],
    [1, 90, 0],
  ]);
  expect(run(0, 0.5, 0.8)).toEqual([
    [0, 100, 0],
    [1, 120, 0],
    [0, 0, 0],
    [1, expect.closeTo(30), 0],
  ]);
  expect(run(0.2, 0.7)).toEqual(run(0.2, 0.7));
  expect(run(0.8, 0.2)).toEqual([]);
});
