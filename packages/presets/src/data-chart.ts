import { z } from "zod/v3";
import {
  styleSchema,
  type SceneNode,
  type SceneStyle,
} from "@dojo-video-engine/schema";
import type { MacroDefinition } from "./macros.js";

const finite = z.number().finite();
export const chartText = z
  .string()
  .regex(
    /^[^\r\n\v\f\u0085\u2028\u2029]*$/,
    "Chart labels and units must use a single line.",
  )
  .trim()
  .min(1)
  .max(32);
const chartParams = z
  .object({
    id: z.string().trim().min(1).optional(),
    kind: z.enum(["bar", "line"]),
    domain: z.object({ min: finite, max: finite }),
    unit: chartText,
    palette: z
      .object({
        background: styleSchema.shape.backgroundColor,
        text: styleSchema.shape.color,
        marks: styleSchema.shape.color,
        axis: styleSchema.shape.color,
      })
      .strict()
      .optional(),
    data: z
      .array(z.object({ label: chartText, value: finite }))
      .min(2)
      .max(8),
    from: z.number().int().nonnegative().optional(),
    duration: z.number().int().positive().optional(),
  })
  .superRefine(({ domain, data, kind }, context) => {
    if (!(domain.min < domain.max && Number.isFinite(domain.max - domain.min)))
      context.addIssue({
        code: "custom",
        path: ["domain"],
        message: "Choose an increasing domain with a finite span.",
      });
    if (kind === "bar" && (domain.min > 0 || domain.max < 0))
      context.addIssue({
        code: "custom",
        path: ["domain"],
        message: "A bar chart domain must include its zero baseline.",
      });
    data.forEach(({ value }, index) => {
      if (value < domain.min || value > domain.max)
        context.addIssue({
          code: "custom",
          path: ["data", index, "value"],
          message: "Value is outside the stated domain.",
        });
    });
  });

export const dataChartMacro: MacroDefinition<z.infer<typeof chartParams>> = {
  name: "dataChart",
  description:
    "Editable bar or line chart for 2–8 supplied category/value pairs. Requires kind, explicit domain {min,max} and unit. Bars start at zero; all marks share one scale during reveal. Use palette {background,text,marks,axis} to apply requested colors to the visible chart.",
  usage:
    '{"macro":"dataChart","kind":"line","domain":{"min":0,"max":100},"unit":"%","data":[{"label":"Q1","value":25},{"label":"Q2","value":75}],"palette":{"background":"#f4f0df","text":"#173f32","marks":"#245a45","axis":"#879b8d"}}',
  params: chartParams,
  expand: (
    {
      id: preferred,
      from = 0,
      duration,
      kind,
      domain,
      unit,
      data,
      palette = {},
    },
    runtime,
  ) => {
    const id = runtime.uniqueId(preferred ?? "data-chart");
    const { width, height, fps } = runtime.ctx;
    const window = duration ?? Math.max(1, runtime.ctx.duration - from);
    const short = Math.min(width, height);
    const left = width * 0.08,
      top = height * 0.23;
    const plotWidth = width * 0.84,
      plotHeight = height * 0.48;
    const slot = plotWidth / data.length,
      radius = short * 0.009;
    const ordinate = (value: number) =>
      (domain.max - value) / (domain.max - domain.min);
    const points = data.map(({ value }, index) => ({
      x: (index + 0.5) / data.length,
      y: ordinate(value),
    }));
    const box = (
      left: number,
      top: number,
      width: number,
      height: number,
    ): SceneStyle => ({
      position: "absolute",
      left,
      top,
      width,
      height,
    });
    const label = (
      key: string,
      text: string,
      x: number,
      y: number,
      available: number,
      size: number,
    ): SceneNode => {
      const fontSize = Math.min(
        size,
        (available * 0.94) / Math.max(1, Array.from(text).length),
      );
      if (fontSize < short * 0.024)
        throw new Error(
          `Chart label "${text}" cannot fit legibly. Use fewer categories, shorter labels or a wider chart.`,
        );
      return {
        id: id + "-" + key,
        type: "text",
        text,
        style: {
          ...box(x, y, available, height * 0.095),
          fontSize,
          color: palette.text ?? "#f1f5f9",
          textAlign: "center",
        },
      };
    };
    const baseline =
      top +
      plotHeight * ordinate(Math.max(domain.min, Math.min(0, domain.max)));
    const children: SceneNode[] = [
      {
        id: id + "-axis",
        type: "div",
        style: {
          ...box(left, baseline, plotWidth, short * 0.003),
          backgroundColor: palette.axis ?? "#94a3b8",
        },
      },
      label(
        "domain",
        domain.min + " – " + domain.max + " (" + unit + ")",
        left,
        height * 0.09,
        plotWidth,
        short * 0.05,
      ),
    ];
    const marks: SceneNode[] = [];
    const reveal = Math.min(window - 1, Math.max(1, Math.round(fps * 0.4)));
    const grow = (
      property: "width" | "height" | "top",
      start: number,
      end: number,
    ) => ({
      kind: "keyframes" as const,
      property,
      frames: [
        { frame: 0, value: start },
        { frame: reveal, value: end },
      ],
    });
    if (kind === "line")
      marks.push({
        id: id + "-line",
        type: "shape",
        shape: { kind: "polyline", points },
        style: {
          ...box(left, top, plotWidth, plotHeight),
          stroke: palette.marks ?? "#38bdf8",
          strokeWidth: short * 0.006,
          fill: "transparent",
          strokeLineJoin: "round",
        },
      });
    data.forEach(({ label: category, value }, index) => {
      const point = points[index]!;
      const x = left + plotWidth * point.x,
        y = top + plotHeight * point.y;
      const suffix = String(index + 1);
      if (kind === "bar")
        marks.push({
          id: id + "-bar-" + suffix,
          type: "shape",
          shape: { kind: "rect" },
          style: {
            ...box(
              x - slot * 0.27,
              Math.min(y, baseline),
              slot * 0.54,
              Math.abs(y - baseline),
            ),
            fill: palette.marks ?? "#38bdf8",
          },
          ...(reveal > 0
            ? {
                animations: [
                  grow("height", 0, Math.abs(y - baseline)),
                  grow("top", baseline, Math.min(y, baseline)),
                ],
              }
            : {}),
        });
      else
        marks.push({
          id: id + "-marker-" + suffix,
          type: "shape",
          shape: { kind: "ellipse" },
          style: {
            ...box(x - radius, y - radius, radius * 2, radius * 2),
            fill: palette.marks ?? "#38bdf8",
          },
        });
      children.push(
        label(
          "label-" + suffix,
          category,
          x - slot / 2,
          height * 0.76,
          slot,
          short * 0.04,
        ),
        label(
          "value-" + suffix,
          String(value),
          x - slot / 2,
          height * 0.86,
          slot,
          short * 0.045,
        ),
      );
    });
    children.push({
      id: id + "-marks",
      type: "div",
      style: { ...box(0, 0, width, height), overflow: "hidden" },
      children: marks,
      ...(kind === "line" && reveal > 0
        ? {
            animations: [
              grow(
                "width",
                left + slot / 2 - radius,
                left + plotWidth - slot / 2 + radius + 1,
              ),
            ],
          }
        : {}),
    });
    return {
      id,
      type: "div",
      from,
      duration: window,
      style: {
        ...box(0, 0, width, height),
        backgroundColor: palette.background ?? "#0f172a",
      },
      children,
    };
  },
};
