import { z } from "zod/v3";
import { styleSchema } from "@dojo-video-engine/schema";
import type {
  SceneNode,
  SceneStyle,
  SceneShapeGeometry,
  SceneAnimation,
} from "@dojo-video-engine/schema";
import type { MacroDefinition } from "./macros.js";
import { chartText } from "./data-chart.js";

const finite = z.number().finite();
const params = z
  .object({
    id: z.string().trim().min(1).optional(),
    kind: z.enum(["bar", "line"]),
    title: z
      .string()
      .trim()
      .min(1)
      .max(72)
      .regex(/^[^\r\n\u2028\u2029]+$/u)
      .optional(),
    unit: chartText,
    fontFamily: styleSchema.shape.fontFamily,
    domain: z.object({ min: finite, max: finite }),
    categories: z.array(chartText).min(2).max(8),
    series: z
      .array(
        z.object({ name: chartText, values: z.array(finite).min(2).max(8) }),
      )
      .min(2)
      .max(4),
    palette: z.enum(["linen", "night"]).default("linen"),
    from: z.number().int().nonnegative().default(0),
    duration: z.number().int().positive().optional(),
  })
  .strip()
  .superRefine((p, c) => {
    const issue = (path: (string | number)[], message: string) =>
      c.addIssue({ code: "custom", path, message });
    const { min, max } = p.domain;
    if (!(min < max && Number.isFinite(max - min)))
      issue(["domain"], "Use a finite increasing domain shared by all series.");
    if (p.kind === "bar" && (min > 0 || max < 0))
      issue(["domain"], "Grouped bars require zero in the domain.");
    if (new Set(p.categories).size !== p.categories.length)
      issue(["categories"], "Use distinct category labels.");
    if (new Set(p.series.map((s) => s.name)).size !== p.series.length)
      issue(["series"], "Use distinct series names.");
    p.series.forEach((s, i) => {
      if (s.values.length !== p.categories.length)
        issue(
          ["series", i, "values"],
          "Supply one value per category, in the same order.",
        );
      s.values.forEach((v, j) => {
        if (v < min || v > max)
          issue(
            ["series", i, "values", j],
            "Value falls outside the shared domain.",
          );
      });
    });
  });

const palettes = {
  linen: {
    paper: "#f6f1e4",
    ink: "#26293d",
    muted: "#545769",
    grid: "#d6d1c5",
    base: "#777783",
    colors: ["#3049a1", "#bc4a28", "#216e62", "#804879"],
  },
  night: {
    paper: "#15262f",
    ink: "#fbf3db",
    muted: "#bccbc8",
    grid: "#384c52",
    base: "#819395",
    colors: ["#92c5ff", "#ffac79", "#83d6b6", "#dda5df"],
  },
} as const;
const box = (
  left: number,
  top: number,
  width: number,
  height: number,
): SceneStyle => ({ position: "absolute", left, top, width, height });
function symbol(index: number): SceneShapeGeometry {
  if (index === 0) return { kind: "ellipse" };
  if (index === 1)
    return {
      kind: "polygon",
      points: [
        { x: 0.5, y: 0 },
        { x: 1, y: 0.5 },
        { x: 0.5, y: 1 },
        { x: 0, y: 0.5 },
      ],
    };
  if (index === 2) return { kind: "rect" };
  return {
    kind: "polygon",
    points: [
      { x: 0.5, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
  };
}
export const comparisonChartMacro: MacroDefinition<z.infer<typeof params>> = {
  name: "comparisonChart",
  description:
    "Compare 2–4 named series across 2–8 ordered categories on one explicit domain and unit. Use grouped bars for amounts or lines for trends. Named legend rows contain the exact supplied values. Choose linen or night. Bars need a zero baseline.",
  usage:
    '{"macro":"comparisonChart","kind":"line","unit":"%","domain":{"min":0,"max":100},"categories":["Q1","Q2"],"series":[{"name":"North","values":[35,62]},{"name":"South","values":[54,41]}]}',
  params,
  expand(p, runtime) {
    const { width: w, height: h, fps } = runtime.ctx,
      short = Math.min(w, h),
      c = palettes[p.palette];
    const id = runtime.uniqueId(p.id ?? "comparison-chart"),
      duration = p.duration ?? runtime.ctx.duration - p.from;
    if (duration < 1)
      throw Error(
        "Supply a positive chart duration or move the start inside the timeline.",
      );
    const reveal = Math.min(
      duration - 1,
      Math.max(1, Math.min(Math.round(duration * 0.51), Math.round(fps * 3.4))),
    );
    const grow = (
      property: SceneAnimation["property"],
      start: number,
      end: number,
    ): SceneAnimation[] =>
      reveal
        ? [
            {
              kind: "keyframes",
              property,
              frames: [
                { frame: 0, value: start },
                { frame: reveal, value: end, easing: "easeInOut" },
              ],
            },
          ]
        : [];
    const margin = w * 0.055,
      left = w * 0.218,
      plotW = w - margin - left,
      slot = plotW / p.categories.length;
    const top = h * (p.title ? 0.244 : 0.158),
      rowH = Math.min(short * 0.066, h * 0.068);
    const bottom = h * 0.93 - rowH * (p.series.length + 1) - short * 0.022,
      plotH = bottom - top;
    const x = (j: number) => left + (j + 0.5) * slot;
    const ordinate = (value: number) =>
      (p.domain.max - value) / (p.domain.max - p.domain.min);
    const y = (value: number) => top + plotH * ordinate(value);
    const baseline = y(Math.min(p.domain.max, Math.max(0, p.domain.min)));
    const floor = Math.max(8, Math.min(16, short / 18));
    const label = (
      key: string,
      text: string,
      style: SceneStyle,
      size: number,
      align: "left" | "center" | "right" = "left",
      family = "IBM Plex Mono",
      maxLines = 1,
    ): SceneNode => ({
      id: id + "-" + key,
      type: "text",
      text,
      style: {
        ...style,
        fontFamily: p.fontFamily ?? family,
        fontWeight: family === "Fraunces" ? 600 : 500,
        color: c.ink,
        fontSize: Math.max(floor, size),
        textAlign: align,
        lineHeight: 1.05,
        textFit: "shrink",
        minFontSize: floor,
        maxLines,
      },
    });
    const rule = (
      key: string,
      xx: number,
      yy: number,
      ww: number,
      color: string,
      thickness = 1,
    ): SceneNode => ({
      id: id + "-" + key,
      type: "div",
      style: { ...box(xx, yy, ww, thickness), backgroundColor: color },
    });
    const children: SceneNode[] = [];
    if (p.title)
      children.push(
        label(
          "title",
          p.title,
          box(margin, h * 0.035, w - 2 * margin, h * 0.114),
          short * 0.096,
          "left",
          "Fraunces",
        ),
      );
    children.push(
      label(
        "unit",
        p.unit,
        box(margin, p.title ? h * 0.153 : h * 0.05, w - 2 * margin, h * 0.055),
        short * 0.034,
      ),
    );
    for (let i = 0; i <= 4; i++)
      children.push(
        rule("grid-" + i, left, top + (plotH * i) / 4, plotW, c.grid),
      );
    if (p.domain.min <= 0 && p.domain.max >= 0)
      children.push(
        rule("zero", left, baseline, plotW, c.base, Math.max(1, short * 0.003)),
      );
    const tickH = Math.max(floor * 1.3, short * 0.042);
    const ticks = [p.domain.max, p.domain.min];
    if (baseline - top > tickH + 2 && bottom - baseline > tickH + 2)
      ticks.push(0);
    // Label simple intermediate ticks when they fit. Never round a tick onto
    // a different ordinate or crowd out a domain endpoint or the zero baseline.
    for (const fraction of [0.5, 0.25, 0.75]) {
      const value = p.domain.min + (p.domain.max - p.domain.min) * fraction;
      if (
        String(value).length <= 8 &&
        ticks.every((other) => Math.abs(y(value) - y(other)) > tickH + 2)
      )
        ticks.push(value);
    }
    ticks.forEach((v, i) =>
      children.push(
        label(
          "tick-" + i,
          String(v),
          box(margin, y(v) - tickH / 2, left - margin - short * 0.025, tickH),
          short * 0.032,
          "right",
        ),
      ),
    );
    const rowTop = bottom + short * 0.022;
    p.categories.forEach((category, j) =>
      children.push(
        label(
          "category-" + (j + 1),
          category,
          box(left + j * slot, rowTop, slot, rowH),
          short * 0.035,
          "center",
          "IBM Plex Mono",
          2,
        ),
      ),
    );
    const traces: SceneNode[] = [],
      marks: SceneNode[] = [];
    p.series.forEach((series, i) => {
      const color = c.colors[i]!,
        prefix = "series-" + (i + 1);
      const yy = rowTop + (i + 1) * rowH,
        diameter = short * 0.026;
      children.push(rule("divider-" + i, margin, yy, w - 2 * margin, c.grid));
      children.push({
        id: id + "-" + prefix + "-key",
        type: "shape",
        shape: symbol(i),
        style: {
          ...box(margin, yy + (rowH - diameter) / 2, diameter, diameter),
          fill: color,
        },
      });
      const nameX = margin + diameter + short * 0.015;
      children.push(
        label(
          prefix + "-name",
          series.name,
          box(nameX, yy, left - nameX - short * 0.008, rowH),
          short * 0.038,
          "left",
          "Space Grotesk",
          2,
        ),
      );
      if (p.kind === "line")
        traces.push({
          id: id + "-" + prefix + "-line",
          type: "shape",
          shape: {
            kind: "polyline",
            points: series.values.map((v, j) => ({
              x: (j + 0.5) / p.categories.length,
              y: ordinate(v),
            })),
          },
          style: {
            ...box(left, top, plotW, plotH),
            fill: "transparent",
            stroke: color,
            strokeWidth: short * 0.006,
            strokeLineJoin: "round",
          },
        });
      series.values.forEach((v, j) => {
        const key = id + "-" + prefix + "-mark-" + (j + 1),
          end = y(v);
        children.push(
          label(
            prefix + "-value-" + (j + 1),
            String(v),
            box(left + j * slot, yy, slot, rowH),
            short * 0.037,
            "center",
          ),
        );
        if (p.kind === "bar") {
          const band = (slot * 0.76) / p.series.length,
            bw = band * 0.85,
            t = Math.min(end, baseline),
            hh = Math.abs(baseline - end);
          marks.push({
            id: key,
            type: "shape",
            shape: { kind: "rect" },
            style: {
              ...box(x(j) - slot * 0.38 + (i + 0.5) * band - bw / 2, t, bw, hh),
              fill: color,
            },
            animations: [...grow("top", baseline, t), ...grow("height", 0, hh)],
          });
        } else {
          const d = Math.min(slot * 0.3, short * (0.028 - i * 0.002));
          marks.push({
            id: key,
            type: "shape",
            shape: symbol(i),
            style: {
              ...box(x(j) - d / 2, end - d / 2, d, d),
              fill: color,
              stroke: c.paper,
              strokeWidth: 1.5,
            },
          });
        }
      });
    });
    const clipRight =
      x(p.categories.length - 1) + Math.min(slot * 0.15, short * 0.014) + 2;
    children.push({
      id: id + "-marks",
      type: "div",
      style: { ...box(0, 0, w, h), overflow: "hidden" },
      animations:
        p.kind === "line"
          ? grow(
              "width",
              x(0) - Math.min(slot * 0.15, short * 0.014) - 2,
              clipRight,
            )
          : [],
      children: [...traces, ...marks],
    });
    return {
      id,
      type: "div",
      from: p.from,
      duration,
      style: { ...box(0, 0, w, h), backgroundColor: c.paper },
      children,
    };
  },
};
