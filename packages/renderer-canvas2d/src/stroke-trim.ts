import { svgPathProperties } from "svg-path-properties";
import type { SceneShapeGeometry } from "@dojo-video-engine/schema";

type Rect = { x: number; y: number; width: number; height: number };
type Radii = {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
};
type Segment = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  start: number;
  end: number;
  move: boolean;
};
type Metric = { segments: Segment[]; length: number };
const cache = new Map<string, Metric>();

function pathData(g: SceneShapeGeometry, w: number, h: number, r: Radii) {
  if (g.kind === "path") return g.d;
  if (g.kind === "ellipse")
    return `M0 ${h / 2} A${w / 2} ${h / 2} 0 1 1 ${w} ${h / 2} A${w / 2} ${h / 2} 0 1 1 0 ${h / 2}Z`;
  if (g.kind === "rect") {
    const { topLeft: a, topRight: b, bottomRight: c, bottomLeft: d } = r;
    return `M${a} 0 H${w - b} A${b} ${b} 0 0 1 ${w} ${b} V${h - c} A${c} ${c} 0 0 1 ${w - c} ${h} H${d} A${d} ${d} 0 0 1 0 ${h - d} V${a} A${a} ${a} 0 0 1 ${a} 0 Z`;
  }
  return (
    g.points
      .map((p, i) => (i ? "L" : "M") + p.x * w + " " + p.y * h)
      .join(" ") + (g.kind === "polygon" ? "Z" : "")
  );
}

function measure(
  g: SceneShapeGeometry,
  w: number,
  h: number,
  r: Radii,
): Metric {
  const d = pathData(g, w, h, r),
    v = g.kind === "path" ? g.viewBox : { x: 0, y: 0, width: w, height: h };
  const key = JSON.stringify([d, v, w, h]);
  const existing = cache.get(key);
  if (existing) return existing;
  if (d.length > 16_384)
    throw Error("Trimmed paths support up to 16 KiB of path data.");
  const path = new svgPathProperties(d),
    parts = path.getParts();
  if (parts.length > 512)
    throw Error("Trimmed paths support up to 512 segments.");
  const segments: Segment[] = [];
  let length = 0,
    prevX = NaN,
    prevY = NaN;
  const sx = w / v.width,
    sy = h / v.height,
    total = path.getTotalLength();
  for (const part of parts) {
    if (!part.length) continue;
    // Measure distances after viewBox fitting; keep separate subpaths disconnected.
    let x = (part.start.x - v.x) * sx,
      y = (part.start.y - v.y) * sy;
    let move =
      Math.abs(x - prevX) + Math.abs(y - prevY) > 1e-7 || !segments.length;
    const straight =
      Math.abs(
        part.length -
          Math.hypot(part.end.x - part.start.x, part.end.y - part.start.y),
      ) <= 1e-8;
    const steps = straight
      ? 1
      : Math.max(
          2,
          Math.min(
            1 + Math.ceil((3072 * part.length) / total),
            Math.ceil((part.length * Math.max(sx, sy)) / 2),
          ),
        );
    for (let i = 1; i <= steps; i++) {
      const p =
        i === steps
          ? part.end
          : part.getPointAtLength((part.length * i) / steps);
      const nextX = (p.x - v.x) * sx,
        nextY = (p.y - v.y) * sy,
        dx = nextX - x,
        dy = nextY - y;
      const end = length + Math.hypot(dx, dy);
      if (!Number.isFinite(end))
        throw Error("Trimmed path geometry must have finite length.");
      if (end > length) {
        segments.push({ x, y, dx, dy, start: length, end, move });
        length = end;
        move = false;
      }
      x = nextX;
      y = nextY;
    }
    prevX = x;
    prevY = y;
  }
  const result = { segments, length };
  if (cache.size >= 16) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}

/** Build just the visible stroke. Fill and existing dash styling remain independent. */
export function trimmedStroke(
  g: SceneShapeGeometry,
  box: Rect,
  radii: Radii,
  start: number,
  end: number,
  offset: number,
) {
  const path = new Path2D();
  if (end <= start || box.width <= 0 || box.height <= 0) return path;
  const metric = measure(g, box.width, box.height, radii);
  const remainder = (start + offset) % 1;
  const a = remainder < 0 ? remainder + 1 : remainder;
  const b = a + (end - start);
  function interval(lo: number, hi: number) {
    const from = lo * metric.length,
      to = hi * metric.length;
    let first = true;
    for (const s of metric.segments) {
      if (s.end <= from) continue;
      if (s.start >= to) break;
      const at = Math.max(from - s.start, 0) / (s.end - s.start),
        until = Math.min(to - s.start, s.end - s.start) / (s.end - s.start);
      if (first || s.move)
        path.moveTo(box.x + s.x + s.dx * at, box.y + s.y + s.dy * at);
      path.lineTo(box.x + s.x + s.dx * until, box.y + s.y + s.dy * until);
      first = false;
    }
  }
  interval(a, Math.min(b, 1));
  if (b > 1) interval(0, b - 1);
  return path;
}
