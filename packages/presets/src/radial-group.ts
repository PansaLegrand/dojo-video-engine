import { z } from "zod/v3";
import {
  styleSchema,
  type SceneAnimation,
  type SceneNode,
  type SceneShapeGeometry,
} from "@dojo-video-engine/schema";
import type { MacroDefinition } from "./macros.js";

const params = z
  .object({
    id: z.string().trim().min(1).optional(),
    count: z.number().int().min(2).max(64),
    radius: z.number().finite().positive().max(8192).optional(),
    centerX: z.number().finite().optional(),
    centerY: z.number().finite().optional(),
    startAngleDeg: z.number().finite().default(0),
    spreadDeg: z
      .number()
      .min(-360)
      .max(360)
      .refine((value) => value !== 0, "Use a nonzero sweep.")
      .default(360),
    itemShape: z.enum(["ellipse", "rect", "path"]).default("ellipse"),
    itemWidth: z.number().positive().max(8192).optional(),
    itemHeight: z.number().positive().max(8192).optional(),
    fill: styleSchema.shape.fill,
    motion: z.enum(["bloom", "orbit", "pulse", "burst"]).default("bloom"),
    orbitDegrees: z.number().min(-720).max(720).default(360),
    staggerFrames: z.number().int().nonnegative().optional(),
    from: z.number().int().nonnegative().default(0),
    duration: z.number().int().positive().optional(),
  })
  .strip();

type Frames = Extract<SceneAnimation, { kind: "keyframes" }>["frames"];
const keys = (
  property: SceneAnimation["property"],
  frames: Frames,
): SceneAnimation => ({ kind: "keyframes", property, frames });
const petal: SceneShapeGeometry = {
  kind: "path",
  viewBox: { x: 0, y: 0, width: 100, height: 100 },
  d: "M 50 100 C 19 80 4 55 11 32 C 15 17 33 5 53 0 C 73 11 91 29 91 46 C 91 69 72 88 50 100 Z",
};

export const radialGroupMacro: MacroDefinition<z.infer<typeof params>> = {
  name: "radialGroup",
  description:
    "Repeat 2–64 editable shapes on a ring or arc. Radius and center coordinates are canvas pixels. Angles run clockwise from twelve o'clock. Bloom opens and holds, orbit revolves, pulse swells and settles, burst flies outward and fades. The path is a curved petal.",
  usage:
    '{"macro":"radialGroup","count":18,"radius":140,"itemShape":"path","fill":"#d95436","motion":"bloom","staggerFrames":2,"duration":96}',
  params,
  expand(p, runtime) {
    const { width, height, fps } = runtime.ctx;
    const duration = p.duration ?? runtime.ctx.duration - p.from;
    const last = duration - 1;
    const step =
      p.staggerFrames ??
      (p.motion === "orbit"
        ? 0
        : Math.min(
            Math.max(1, Math.round(fps * 0.045)),
            Math.floor(last / (2 * p.count)),
          ));
    const available = last - step * (p.count - 1);
    // A pulse and a burst need three distinct poses; a bloom/orbit needs two.
    if (available < (p.motion === "pulse" || p.motion === "burst" ? 2 : 1))
      throw Error(
        "The last radial item has too few frames for its motion. Extend duration or reduce staggerFrames.",
      );
    const radius = p.radius ?? Math.min(width, height) * 0.3;
    const itemWidth =
      p.itemWidth ?? Math.min(radius * 0.25, (Math.PI * radius) / p.count);
    const itemHeight =
      p.itemHeight ?? (p.itemShape === "ellipse" ? itemWidth : radius * 0.55);
    const reach = radius + Math.hypot(itemWidth, itemHeight) / 2;
    const id = runtime.uniqueId(p.id ?? "radial-group");
    const closed = Math.abs(p.spreadDeg) === 360;
    const geometry: SceneShapeGeometry =
      p.itemShape === "path" ? petal : { kind: p.itemShape };
    const children = Array.from({ length: p.count }, (_, i): SceneNode => {
      const angle =
        (p.startAngleDeg % 360) +
        (p.spreadDeg * i) / (closed ? p.count : p.count - 1);
      const rad = (angle * Math.PI) / 180;
      const dx = radius * Math.sin(rad),
        dy = -radius * Math.cos(rad);
      const left = reach + dx - itemWidth / 2,
        top = reach + dy - itemHeight / 2;
      const delay = i * step;
      const from = p.motion === "pulse" ? 0 : delay;
      const entrance = Math.min(available, Math.max(1, Math.round(fps * 0.7)));
      const transform = (scale: number) =>
        `rotate(${angle}deg) scale(${scale})`;
      const animations: SceneAnimation[] = [];
      if (p.motion === "burst" || p.motion === "bloom") {
        const end = p.motion === "burst" ? available : entrance;
        const start = p.motion === "burst" ? 0.06 : 0.48;
        for (const [property, offset, final] of [
          ["left", dx, left],
          ["top", dy, top],
        ] as const)
          animations.push(
            keys(property, [
              { frame: 0, value: final - offset * (1 - start) },
              { frame: end, value: final, easing: "easeOut" },
            ]),
          );
      }
      if (p.motion === "pulse") {
        const peak = delay + Math.floor(available / 2);
        animations.push(
          keys("transform", [
            { frame: 0, value: transform(0.64) },
            ...(delay ? [{ frame: delay, value: transform(0.64) }] : []),
            { frame: peak, value: transform(1), easing: "easeInOut" },
            {
              frame: delay + available,
              value: transform(0.64),
              easing: "easeInOut",
            },
          ]),
        );
      } else {
        animations.push(
          keys("transform", [
            { frame: 0, value: transform(0.2) },
            { frame: entrance, value: transform(1), easing: "easeOut" },
          ]),
        );
      }
      if (p.motion === "burst") {
        const peak = Math.max(
          1,
          Math.min(available - 1, Math.round(available * 0.28)),
        );
        animations.push(
          keys("opacity", [
            { frame: 0, value: 0 },
            { frame: peak, value: 1, easing: "easeOut" },
            { frame: available, value: 0, easing: "easeIn" },
          ]),
        );
      } else if (p.motion !== "pulse") {
        animations.push(
          keys("opacity", [
            { frame: 0, value: 0 },
            { frame: entrance, value: 1, easing: "easeOut" },
          ]),
        );
      }
      return {
        id: `${id}-mark-${i + 1}`,
        type: "shape",
        shape: structuredClone(geometry),
        from,
        duration: duration - from,
        style: {
          position: "absolute",
          left,
          top,
          width: itemWidth,
          height: itemHeight,
          fill: p.fill ?? "#ec6547",
          transform: transform(1),
        },
        animations,
      };
    });
    return {
      id,
      type: "div",
      from: p.from,
      duration,
      style: {
        position: "absolute",
        left: (p.centerX ?? width / 2) - reach,
        top: (p.centerY ?? height / 2) - reach,
        width: 2 * reach,
        height: 2 * reach,
        zIndex: 40,
      },
      children,
      ...(p.motion === "orbit"
        ? {
            animations: [
              keys("transform", [
                { frame: 0, value: "rotate(0deg)" },
                {
                  frame: last,
                  value: `rotate(${p.orbitDegrees}deg)`,
                  easing: "linear",
                },
              ]),
            ],
          }
        : {}),
    };
  },
};
