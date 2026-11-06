import { SaxesParser } from "saxes";
import {
  sceneNodeSchema,
  type SceneNodeInput,
  type SceneStyle,
} from "@dojo-video-engine/schema";

export type SvgImportResult = {
  node: SceneNodeInput;
  ids: Record<string, string>;
  width: number;
  height: number;
};
export class SvgImportError extends Error {
  readonly code = "SVG_UNSUPPORTED_OR_INVALID";
  constructor(message: string) {
    super(message);
    this.name = "SvgImportError";
  }
}
type Element = {
  name: string;
  attributes: Record<string, string>;
  children: Element[];
};
const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const paintAttributes = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "fill-rule",
];
const allowed: Record<string, readonly string[]> = {
  svg: ["xmlns", "viewBox", "width", "height"],
  g: [],
  path: ["d"],
  rect: ["x", "y", "width", "height"],
  circle: ["cx", "cy", "r"],
  ellipse: ["cx", "cy", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
  polygon: ["points"],
  polyline: ["points"],
  title: [],
  desc: [],
};

/** Strict editable SVG subset. Unsupported visible features fail, never disappear. */
export function importSvgGraphic(
  source: string,
  options: { id: string; from?: number; duration: number },
): SvgImportResult {
  if (
    typeof source !== "string" ||
    new TextEncoder().encode(source).length > 128_000
  )
    throw new SvgImportError("SVG must be at most 128KB.");
  if (!/^[A-Za-z][A-Za-z0-9:_-]{0,95}$/.test(options.id))
    throw new SvgImportError(
      "Use a graphic ID beginning with a letter, at most 96 characters.",
    );
  const roots: Element[] = [],
    stack: Element[] = [];
  let count = 0;
  const parser = new SaxesParser({ xmlns: false });
  parser.on("doctype", () => {
    throw new SvgImportError("SVG DTDs and entities are unsupported.");
  });
  parser.on("processinginstruction", () => {
    throw new SvgImportError("SVG processing instructions are unsupported.");
  });
  parser.on("error", (error) => {
    throw new SvgImportError(`Invalid SVG XML: ${error.message}`);
  });
  parser.on("opentag", (tag) => {
    const fields = allowed[tag.name];
    if (!fields)
      throw new SvgImportError(
        `Unsupported SVG element <${tag.name}>. Use groups, paths or basic shapes.`,
      );
    if (++count > 512 || stack.length >= 24)
      throw new SvgImportError(
        "SVG exceeds 512 elements or 24 nesting levels.",
      );
    const parent = stack[stack.length - 1];
    if (parent && !["svg", "g"].includes(parent.name))
      throw new SvgImportError(
        `Elements cannot be nested inside <${parent.name}>.`,
      );
    if (tag.name === "svg" && parent)
      throw new SvgImportError("Nested SVG viewports are unsupported.");
    const attributes: Record<string, string> = {};
    for (const [key, value] of Object.entries(tag.attributes)) {
      if (
        ![...fields, ...paintAttributes, "id", "opacity", "transform"].includes(
          key,
        )
      )
        throw new SvgImportError(
          `Unsupported SVG attribute ${key} on <${tag.name}>. Convert styles to supported presentation attributes.`,
        );
      attributes[key] = value;
    }
    const element: Element = { name: tag.name, attributes, children: [] };
    (parent ? parent.children : roots).push(element);
    stack.push(element);
  });
  parser.on("closetag", () => {
    stack.pop();
  });
  parser.on("text", (text) => {
    const parent = stack[stack.length - 1];
    if (text.trim() && !["title", "desc"].includes(parent?.name ?? ""))
      throw new SvgImportError(
        "SVG text requires a native text node; convert text separately.",
      );
  });
  parser.on("cdata", () => {
    throw new SvgImportError("SVG CDATA is unsupported.");
  });
  parser.write(source).close();
  const root = roots[0];
  if (roots.length !== 1 || root?.name !== "svg")
    throw new SvgImportError("Provide one SVG root element.");
  if (
    root.attributes.xmlns &&
    root.attributes.xmlns !== "http://www.w3.org/2000/svg"
  )
    throw new SvgImportError("Invalid SVG namespace.");
  const view = root.attributes.viewBox
    ? numbers(root.attributes.viewBox)
    : [
        0,
        0,
        numeric(root.attributes.width, "width"),
        numeric(root.attributes.height, "height"),
      ];
  const [x, y, width, height] = view;
  if (
    view.length !== 4 ||
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    width <= 0 ||
    height <= 0 ||
    width > 4096 ||
    height > 4096
  )
    throw new SvgImportError(
      "SVG needs a finite positive viewBox up to 4096 × 4096.",
    );
  if (x !== 0 || y !== 0)
    throw new SvgImportError(
      "This SVG subset requires a viewBox starting at 0 0; translate the artwork before importing.",
    );
  // Different intrinsic dimensions imply an additional viewport mapping: reject until qualified.
  if (
    (root.attributes.width &&
      numeric(root.attributes.width, "width") !== width) ||
    (root.attributes.height &&
      numeric(root.attributes.height, "height") !== height)
  )
    throw new SvgImportError(
      "SVG width/height must match its viewBox; use the timeline item's scale to resize.",
    );
  const ids: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;
  let sequence = 0;
  const compile = (
    element: Element,
    inherited: Record<string, string>,
    isRoot = false,
  ): SceneNodeInput | null => {
    if (["title", "desc"].includes(element.name)) return null;
    const attrs = element.attributes;
    const original = attrs.id;
    if (
      original &&
      (Object.hasOwn(ids, original) ||
        !/^[A-Za-z][A-Za-z0-9:_-]{0,63}$/.test(original))
    )
      throw new SvgImportError(
        "SVG IDs must be unique and use letters, digits, colon, underscore or hyphen.",
      );
    const nodeId = isRoot
      ? options.id
      : original
        ? `${options.id}:svg:id:${original}`
        : `${options.id}:svg:auto:${++sequence}`;
    if (original) ids[original] = nodeId;
    const paint = { ...inherited };
    for (const key of paintAttributes)
      if (attrs[key] !== undefined) paint[key] = attrs[key];
    const style: SceneStyle = {
      position: "absolute",
      left: 0,
      top: 0,
      width,
      height,
      transformOrigin: "0px 0px",
    };
    if (attrs.opacity !== undefined) {
      const opacity = numeric(attrs.opacity, "opacity");
      if (opacity < 0 || opacity > 1)
        throw new SvgImportError("SVG opacity must be between zero and one.");
      style.opacity = opacity;
    }
    if (attrs.transform) style.transform = transform(attrs.transform);
    if (element.name === "svg" || element.name === "g") {
      if (isRoot) style.overflow = "hidden";
      if (attrs.opacity !== undefined) style.isolation = true;
      const children = element.children
        .map((child) => compile(child, paint))
        .filter((node): node is SceneNodeInput => node !== null);
      return {
        id: nodeId,
        type: "div",
        ...(isRoot
          ? { from: options.from ?? 0, duration: options.duration }
          : {}),
        style,
        children,
      };
    }
    style.fill =
      paint.fill === "none" ? "transparent" : (paint.fill ?? "black");
    style.stroke =
      paint.stroke === "none" ? "transparent" : (paint.stroke ?? "transparent");
    style.strokeWidth =
      paint["stroke-width"] === undefined
        ? 1
        : numeric(paint["stroke-width"], "stroke-width");
    if (paint["stroke-linecap"]) {
      const cap = paint["stroke-linecap"];
      if (cap !== "butt" && cap !== "round" && cap !== "square")
        throw new SvgImportError("Unsupported SVG stroke-linecap.");
      style.strokeLineCap = cap;
    }
    if (paint["stroke-linejoin"]) {
      const join = paint["stroke-linejoin"];
      if (join !== "miter" && join !== "round" && join !== "bevel")
        throw new SvgImportError("Unsupported SVG stroke-linejoin.");
      style.strokeLineJoin = join;
    }
    const fillRule = paint["fill-rule"] ?? "nonzero";
    if (fillRule !== "evenodd" && fillRule !== "nonzero")
      throw new SvgImportError("Unsupported SVG fill-rule.");
    const d = pathFor(element);
    validatePath(d);
    return {
      id: nodeId,
      type: "shape",
      style,
      shape: { kind: "path", d, viewBox: { x, y, width, height }, fillRule },
    };
  };
  try {
    const node = sceneNodeSchema.parse(compile(root, {}, true));
    return { node, ids, width, height };
  } catch (error) {
    if (error instanceof SvgImportError) throw error;
    throw new SvgImportError(
      `SVG cannot be represented as editable graphics: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function numeric(
  value: string | undefined,
  name: string,
  fallback?: number,
): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (value === undefined || !numberPattern.test(value.trim()))
    throw new SvgImportError(`SVG ${name} requires a finite unitless number.`);
  const result = Number(value);
  if (!Number.isFinite(result) || Math.abs(result) > 100_000)
    throw new SvgImportError(`SVG ${name} exceeds its coordinate limit.`);
  return result;
}
function numbers(value: string): number[] {
  return value
    .trim()
    .split(/[\s,]+/)
    .map((part) => numeric(part, "coordinate"));
}
function pathFor(element: Element): string {
  const a = element.attributes,
    n = (key: string, fallback = 0) => numeric(a[key], key, fallback);
  switch (element.name) {
    case "path":
      return a.d ?? "";
    case "rect": {
      const x = n("x"),
        y = n("y"),
        w = n("width"),
        h = n("height");
      if (w <= 0 || h <= 0)
        throw new SvgImportError("SVG rectangles need positive dimensions.");
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
    }
    case "circle":
    case "ellipse": {
      const x = n("cx"),
        y = n("cy"),
        rx = n(element.name === "circle" ? "r" : "rx"),
        ry = element.name === "circle" ? rx : n("ry");
      if (rx <= 0 || ry <= 0)
        throw new SvgImportError("SVG ellipses need positive radii.");
      return `M ${x - rx} ${y} A ${rx} ${ry} 0 1 0 ${x + rx} ${y} A ${rx} ${ry} 0 1 0 ${x - rx} ${y} Z`;
    }
    case "line":
      return `M ${n("x1")} ${n("y1")} L ${n("x2")} ${n("y2")}`;
    case "polygon":
    case "polyline": {
      const points = numbers(a.points ?? "");
      if (
        points.length < (element.name === "polygon" ? 6 : 4) ||
        points.length % 2 ||
        points.length > 2048
      )
        throw new SvgImportError("SVG points require bounded x/y pairs.");
      return `M ${points.slice(0, 2).join(" ")} L ${points.slice(2).join(" ")} ${element.name === "polygon" ? "Z" : ""}`;
    }
    default:
      throw new SvgImportError(`Unsupported SVG shape ${element.name}.`);
  }
}
function transform(value: string): string {
  const result: string[] = [];
  let consumed = 0;
  const pattern = /(translate|scale|rotate)\s*\(([^()]*)\)/g;
  for (const match of value.matchAll(pattern)) {
    if (value.slice(consumed, match.index).trim())
      throw new SvgImportError(
        "Unsupported SVG transform; use translate, scale or rotate.",
      );
    consumed = (match.index ?? 0) + match[0].length;
    const args = numbers(match[2] ?? "");
    const [a, b, c] = args;
    if (a === undefined) throw new SvgImportError("Empty SVG transform.");
    if (match[1] === "translate" && args.length <= 2)
      result.push(`translate(${a}px,${b ?? 0}px)`);
    else if (match[1] === "scale" && args.length <= 2)
      result.push(`scale(${a},${b ?? a})`);
    else if (
      match[1] === "rotate" &&
      (args.length === 1 || args.length === 3)
    ) {
      if (b !== undefined && c !== undefined)
        result.push(
          `translate(${b}px,${c}px)`,
          `rotate(${a}deg)`,
          `translate(${-b}px,${-c}px)`,
        );
      else result.push(`rotate(${a}deg)`);
    } else throw new SvgImportError("Invalid SVG transform arguments.");
  }
  if (value.slice(consumed).trim() || !result.length)
    throw new SvgImportError("Unsupported SVG transform.");
  return result.join(" ");
}
function validatePath(value: string): void {
  const tokens =
    value.match(/[A-Za-z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? [];
  const remainder = value
    .replace(/[A-Za-z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g, "")
    .replace(/[\s,]/g, "");
  if (remainder || !/^[mM]$/.test(tokens[0] ?? "") || tokens.length > 16_384)
    throw new SvgImportError("Invalid or oversized SVG path.");
  const sizes: Record<string, number> = {
    M: 2,
    L: 2,
    H: 1,
    V: 1,
    C: 6,
    S: 4,
    Q: 4,
    T: 2,
    A: 7,
    Z: 0,
  };
  let i = 0;
  while (i < tokens.length) {
    const command = tokens[i++]?.toUpperCase() ?? "",
      size = sizes[command];
    if (size === undefined)
      throw new SvgImportError("Unsupported SVG path command.");
    let count = 0;
    while (i < tokens.length && !/^[A-Za-z]$/.test(tokens[i] ?? "")) {
      const n = numeric(tokens[i++], "path coordinate");
      if (command === "A" && [3, 4].includes(count % 7) && n !== 0 && n !== 1)
        throw new SvgImportError("SVG arc flags must be zero or one.");
      if (command === "A" && [0, 1].includes(count % 7) && n < 0)
        throw new SvgImportError("SVG arc radii must be nonnegative.");
      count++;
    }
    if (size === 0 ? count !== 0 : count === 0 || count % size !== 0)
      throw new SvgImportError(
        "SVG path command has the wrong number of coordinates.",
      );
  }
}
