import { z } from "zod";
import type { SceneNode, SceneStyle } from "@motionforge/schema";
import {
  clipLayout,
  clipLayouts,
  mediaLook,
  mediaLooks,
  resolveSafeArea,
  type ClipLayoutKey,
  type CompositionSize,
  type MediaLookKey,
} from "./index.js";

/**
 * Layout intents: declarative node-level sugar that resolves to plain scene
 * styles at expansion time. Agents describe *where* and *what role* instead of
 * computing pixel coordinates and font sizes — the spatial math the models
 * reliably get wrong. Everything here compiles down to the same validated
 * style keys the schema already accepts; nothing new reaches the renderer.
 */

const looseNumber = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() !== "" ? Number(value) : value,
  z.number().finite(),
);

export const placeAnchors = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

export type PlaceAnchor = (typeof placeAnchors)[number];

export const placeIntentSchema = z
  .object({
    anchor: z.enum(placeAnchors),
    /** Extra pixels inside the safe area; number = both axes. */
    margin: z
      .union([
        looseNumber,
        z
          .object({ x: looseNumber.optional(), y: looseNumber.optional() })
          .strict(),
      ])
      .optional(),
    /** false = anchor against the raw composition edges (default true). */
    safeArea: z.boolean().optional(),
    offsetX: looseNumber.optional(),
    offsetY: looseNumber.optional(),
    zIndex: looseNumber.optional(),
  })
  .strict({
    message:
      'place supports only: anchor, margin, safeArea, offsetX, offsetY, zIndex. Example: {"anchor":"bottom-center","margin":32}.',
  });

export type PlaceIntent = z.infer<typeof placeIntentSchema>;

export const textRoles = [
  "display",
  "title",
  "subtitle",
  "body",
  "caption",
  "label",
] as const;

export type TextRole = (typeof textRoles)[number];

type TextRoleRamp = {
  /** Font size as a fraction of the composition's short side. */
  sizeRatio: number;
  fontWeight: number;
  lineHeight: number;
  /** Letter spacing as a fraction of the resolved font size. */
  letterSpacingRatio?: number;
  /** Shrink-to-fit floor as a fraction of the resolved font size. */
  minFontSizeRatio?: number;
};

const textRoleRamps: Record<TextRole, TextRoleRamp> = {
  display: {
    sizeRatio: 0.115,
    fontWeight: 900,
    lineHeight: 0.98,
    minFontSizeRatio: 0.4,
  },
  title: {
    sizeRatio: 0.085,
    fontWeight: 800,
    lineHeight: 1.05,
    minFontSizeRatio: 0.4,
  },
  subtitle: { sizeRatio: 0.044, fontWeight: 600, lineHeight: 1.2 },
  body: { sizeRatio: 0.036, fontWeight: 500, lineHeight: 1.35 },
  caption: { sizeRatio: 0.032, fontWeight: 600, lineHeight: 1.25 },
  label: {
    sizeRatio: 0.026,
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacingRatio: 0.14,
  },
};

/**
 * Composition-scaled typography for a semantic role. The ramp keys off the
 * short side so vertical, square, and landscape compositions all land on
 * proportionate sizes without the author knowing font math.
 */
export function textRoleStyle(
  role: TextRole,
  size: CompositionSize,
): SceneStyle {
  const ramp = textRoleRamps[role];
  const shortSide = Math.max(1, Math.min(size.width, size.height));
  const fontSize = Math.max(10, Math.round(ramp.sizeRatio * shortSide));
  const style: SceneStyle = {
    fontSize,
    fontWeight: ramp.fontWeight,
    lineHeight: ramp.lineHeight,
  };

  if (ramp.letterSpacingRatio !== undefined) {
    style.letterSpacing = Math.round(fontSize * ramp.letterSpacingRatio);
  }

  if (ramp.minFontSizeRatio !== undefined) {
    style.textFit = "shrink";
    style.minFontSize = Math.max(
      10,
      Math.round(fontSize * ramp.minFontSizeRatio),
    );
  }

  return style;
}

/**
 * Fills role typography into a style, never overriding keys the author set.
 */
export function applyTextRole(
  style: SceneStyle | undefined,
  role: TextRole,
  size: CompositionSize,
): SceneStyle {
  const roleStyle = textRoleStyle(role, size) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...roleStyle };

  for (const [key, value] of Object.entries(style ?? {})) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  return merged as SceneStyle;
}

function readMargins(margin: PlaceIntent["margin"]): { x: number; y: number } {
  if (typeof margin === "number") {
    return { x: Math.round(margin), y: Math.round(margin) };
  }

  return {
    x: Math.round(margin?.x ?? 0),
    y: Math.round(margin?.y ?? 0),
  };
}

/**
 * Resolves a place intent into an absolutely positioned flex wrapper that
 * spans the (safe-area inset) composition and aligns the child with flexbox.
 * Flex alignment sidesteps the unsolvable part of anchor math: the child's
 * intrinsic size (wrapped text, contain-fit images) is unknown until layout,
 * so we never have to guess it. The child's `from`/`duration` hoist onto the
 * wrapper; child timing and animations stay node-local and unchanged.
 */
export function resolvePlaceIntent(params: {
  node: SceneNode;
  place: PlaceIntent;
  size: CompositionSize;
  wrapperId: string;
}): SceneNode {
  const { node, place, size, wrapperId } = params;
  const insets = resolveSafeArea(
    size,
    place.safeArea === false ? false : "auto",
  );
  const margins = readMargins(place.margin);
  const left = insets.left + margins.x;
  const top = insets.top + margins.y;
  const width = Math.max(1, size.width - left - (insets.right + margins.x));
  const height = Math.max(1, size.height - top - (insets.bottom + margins.y));
  const [vertical, horizontal] = splitAnchor(place.anchor);

  const wrapperStyle: SceneStyle = {
    position: "absolute",
    left,
    top,
    width,
    height,
    display: "flex",
    flexDirection: "column",
    justifyContent:
      vertical === "top"
        ? "flex-start"
        : vertical === "bottom"
          ? "flex-end"
          : "center",
    alignItems:
      horizontal === "left"
        ? "flex-start"
        : horizontal === "right"
          ? "flex-end"
          : "center",
  };

  if (place.zIndex !== undefined) {
    wrapperStyle.zIndex = Math.round(place.zIndex);
  }

  const offsetX = Math.round(place.offsetX ?? 0);
  const offsetY = Math.round(place.offsetY ?? 0);

  if (offsetX !== 0 || offsetY !== 0) {
    wrapperStyle.transform = `translate(${offsetX}px, ${offsetY}px)`;
  }

  const child: SceneNode = { ...node };
  const from = child.from;
  const duration = child.duration;
  delete child.from;
  delete child.duration;

  return {
    id: wrapperId,
    type: "div",
    ...(from !== undefined ? { from } : {}),
    ...(duration !== undefined ? { duration } : {}),
    style: wrapperStyle,
    children: [child],
  };
}

function splitAnchor(
  anchor: PlaceAnchor,
): ["top" | "center" | "bottom", "left" | "center" | "right"] {
  if (anchor === "center") {
    return ["center", "center"];
  }

  const [vertical, horizontal] = anchor.split("-") as [
    "top" | "center" | "bottom",
    "left" | "center" | "right",
  ];

  return [vertical, horizontal];
}

export type MediaIntentError = { key: "look" | "layout"; message: string };

/**
 * Resolves `look` (media color/filter treatment) and `layout` (clip
 * positioning) shorthand keys into style merges. The node's own style wins on
 * conflicts, so authors can take a preset and adjust one property.
 */
export function resolveMediaIntents(params: {
  style: SceneStyle | undefined;
  look?: string;
  layout?: string;
}): { style: SceneStyle } | { errors: MediaIntentError[] } {
  const errors: MediaIntentError[] = [];
  let base: Record<string, unknown> = {};

  if (params.layout !== undefined) {
    if (params.layout in clipLayouts) {
      base = { ...base, ...clipLayout(params.layout as ClipLayoutKey) };
    } else {
      errors.push({
        key: "layout",
        message: `Unknown layout "${params.layout}". Available layouts: ${Object.keys(clipLayouts).join(", ")}.`,
      });
    }
  }

  if (params.look !== undefined) {
    if (params.look in mediaLooks) {
      base = { ...base, ...mediaLook(params.look as MediaLookKey) };
    } else {
      errors.push({
        key: "look",
        message: `Unknown look "${params.look}". Available looks: ${Object.keys(mediaLooks).join(", ")}.`,
      });
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(params.style ?? {})) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  return { style: merged as SceneStyle };
}
