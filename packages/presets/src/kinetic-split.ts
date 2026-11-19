import { z } from "zod/v3";
import {
  styleSchema,
  type SceneAnimation,
  type SceneNode,
} from "@dojo-video-engine/schema";
import { fadeUp, popIn } from "./index.js";
import type { MacroDefinition } from "./macros.js";

const params = z
  .object({
    id: z.string().trim().min(1).optional(),
    text: z.string().trim().min(1).max(400),
    splitBy: z.enum(["word", "char", "line"]).default("word"),
    preset: z
      .enum(["maskSlide", "elasticRise", "trackingExpand", "cascadePop"])
      .default("maskSlide"),
    from: z.number().int().nonnegative().default(0),
    duration: z.number().int().positive().optional(),
    staggerFrames: z.number().int().nonnegative().optional(),
    holdFrames: z.number().int().positive().optional(),
    fontFamily: styleSchema.shape.fontFamily,
    fontSize: z.number().finite().positive().optional(),
    color: styleSchema.shape.color,
    stroke: styleSchema.shape.textStroke,
    align: z.enum(["left", "center", "right"]).default("center"),
  })
  .strip();

export const kineticSplitMacro: MacroDefinition<z.infer<typeof params>> = {
  name: "kineticSplit",
  description:
    "Reveal an editable title by word, grapheme (char) or authored line. Newlines set the rows. Choose maskSlide, elasticRise, trackingExpand or cascadePop. The complete lockup holds to the end. fontSize is a maximum. Use line for mixed-direction lettering.",
  usage:
    '{"macro":"kineticSplit","text":"PHASE\\nSHIFT","splitBy":"char","preset":"maskSlide","staggerFrames":3,"holdFrames":18,"duration":72}',
  params,
  expand(p, runtime) {
    const { width, height, fps } = runtime.ctx;
    const duration = p.duration ?? runtime.ctx.duration - p.from;
    const lines = p.text.replace(/\r\n?/g, "\n").split("\n");
    if (lines.length > 8) throw Error("Use at most eight title lines.");
    if (
      p.splitBy !== "line" &&
      /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(p.text)
    )
      throw Error(
        "Use splitBy:line to preserve bidirectional ordering and connected lettering.",
      );
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    const graphemes = (s: string) =>
      Array.from(segmenter.segment(s), (part) => part.segment);
    const rows = lines.map((line) => {
      const clean = line.trim().replace(/\s+/gu, " ");
      if (!clean) return [];
      if (p.splitBy === "line") return [clean];
      return p.splitBy === "char" ? graphemes(clean) : clean.split(" ");
    });
    const count = rows.flat().filter((token) => token !== " ").length;
    if (!count || count > 64)
      throw Error(
        "Choose a title with 1–64 reveal units, or use word or line splitting.",
      );
    const hold =
      p.holdFrames ??
      Math.max(1, Math.min(Math.round(fps * 0.65), Math.floor(duration / 3)));
    // The settlement frame itself counts as the first full reading frame.
    const available = duration - hold;
    const every =
      p.staggerFrames ??
      Math.min(
        Math.max(1, Math.round(fps * 0.075)),
        Math.floor((available - 1) / Math.max(1, count - 1)),
      );
    const enter = Math.min(
      Math.max(2, Math.round(fps * 0.46)),
      available - (count - 1) * every,
    );
    if (
      available < 1 ||
      (p.staggerFrames === undefined && count > 1 && every < 1) ||
      enter < 1
    )
      throw Error(
        `The ${duration}-frame title cannot fit ${count} entrances and a ${hold}-frame hold. Extend duration or reduce staggerFrames/holdFrames.`,
      );

    const safeWidth = width * 0.84;
    const gapEm =
      p.splitBy === "word" ? 0.27 : p.preset === "trackingExpand" ? 0.065 : 0;
    const tracking =
      p.preset === "trackingExpand" && p.splitBy !== "char" ? 0.055 : 0;
    const longest = Math.max(
      ...rows.map(
        (row) =>
          row.reduce(
            (sum, token) =>
              sum +
              graphemes(token).reduce(
                (n, c) => n + (c === " " ? 0.34 : 1.05) + tracking,
                0,
              ),
            0,
          ) +
          Math.max(0, row.length - 1) * gapEm,
      ),
    );
    const size = Math.min(
      p.fontSize ?? Math.min(width, height) * 0.19,
      safeWidth / longest,
      (height * 0.78) / (rows.length * 1.34),
    );
    if (size < 12)
      throw Error(
        "The title needs a minimum 12px font. Increase fontSize, add line breaks or enlarge the canvas.",
      );
    const lineHeight = size * 1.34;
    const id = runtime.uniqueId(p.id ?? "kinetic-split");
    let unit = 0;
    const children: SceneNode[] = rows.map((row, index) => {
      const lastBeat =
        enter +
        (unit + Math.max(0, row.filter((t) => t !== " ").length - 1)) * every;
      const rowAnimations: SceneAnimation[] =
        p.preset === "trackingExpand" && row.length > 1
          ? [
              {
                kind: "keyframes",
                property: "gap",
                frames: [
                  { frame: 0, value: 0 },
                  { frame: lastBeat, value: gapEm * size, easing: "easeOut" },
                ],
              },
            ]
          : [];
      return {
        id: `${id}-row-${index + 1}`,
        type: "div",
        style: {
          position: "absolute",
          left: 0,
          top: index * lineHeight,
          width: safeWidth,
          height: lineHeight,
          display: "flex",
          flexDirection: "row",
          justifyContent:
            p.align === "left"
              ? "flex-start"
              : p.align === "right"
                ? "flex-end"
                : "center",
          alignItems: "center",
          gap: gapEm * size,
          overflow: p.preset === "maskSlide" ? "hidden" : "visible",
        },
        animations: rowAnimations,
        children: row.map((token, column): SceneNode => {
          if (token === " ")
            return {
              id: `${id}-space-${index}-${column}`,
              type: "div",
              style: { width: size * 0.34, height: 1 },
            };
          const delay = unit++ * every;
          const timing = { delay, durationInFrames: enter };
          const animations =
            p.preset === "cascadePop"
              ? popIn({ ...timing, fromScale: 0.68 })
              : fadeUp({
                  ...timing,
                  distance:
                    p.preset === "maskSlide"
                      ? lineHeight
                      : p.preset === "trackingExpand"
                        ? 0
                        : size * 0.35,
                  easing:
                    p.preset === "elasticRise" ? "spring(0.35)" : "easeOut",
                });
          if (p.preset === "trackingExpand" && p.splitBy !== "char") {
            animations.push({
              kind: "keyframes",
              property: "letterSpacing",
              frames: [
                ...(delay ? [{ frame: 0, value: 0 }] : []),
                { frame: delay, value: 0 },
                {
                  frame: delay + enter,
                  value: size * tracking,
                  easing: "easeOut",
                },
              ],
            });
          }
          return {
            id: `${id}-unit-${unit}`,
            type: "text",
            text: token,
            style: {
              ...(p.splitBy === "line" &&
              /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(
                token.match(/\p{Letter}/u)?.[0] ?? "",
              )
                ? { direction: "rtl" as const }
                : {}),
              fontFamily: p.fontFamily ?? "Space Grotesk",
              fontSize: size,
              fontWeight: 700,
              color: p.color ?? "#fff3da",
              lineHeight: 1.1,
              ...(p.stroke ? { textStroke: p.stroke } : {}),
            },
            animations,
          };
        }),
      };
    });
    return {
      id,
      type: "div",
      from: p.from,
      duration,
      style: {
        position: "absolute",
        left: (width - safeWidth) / 2,
        top: (height - lineHeight * rows.length) / 2,
        width: safeWidth,
        height: lineHeight * rows.length,
        zIndex: 50,
      },
      children,
    };
  },
};
