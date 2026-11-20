import { z } from "zod/v3";
import {
  styleSchema,
  type SceneNode,
  type SceneStyle,
} from "@dojo-video-engine/schema";
import type { MacroDefinition } from "./macros.js";
import { blueprintArt } from "./blueprint-art.generated.js";
import { comparisonChartMacro } from "./comparison-chart.js";
import { uiWalkthroughCardMacro } from "./ui-walkthrough-card.js";
import { kineticSplitMacro } from "./kinetic-split.js";

const entries = [
  [
    "orbit",
    "Orbit",
    "brand reveal",
    "The orbital sculpture assembles beside a held wordmark.",
    "#f3f1e9",
    "#152039",
    "#244eff",
    "Future Assembly",
    "Common Ground",
  ],
  [
    "littleWorlds",
    "Little Worlds",
    "spatial scene",
    "A miniature city turns under a steady camera.",
    "#e8dfed",
    "#312d43",
    "#7757ad",
    "Pocket City",
    "Urban Fieldnotes",
  ],
  [
    "precision",
    "P-01",
    "product reveal",
    "An exploded instrument opens its layers before the lockup.",
    "#142123",
    "#f0ead8",
    "#edae53",
    "Inside the dial",
    "Assembly study",
  ],
  [
    "afterHours",
    "After Hours",
    "festival",
    "Faceted colored geometry rotates into the invitation.",
    "#241638",
    "#fff3df",
    "#ff985e",
    "After Hours",
    "Studio Social",
  ],
  [
    "nightLeague",
    "Night League",
    "sports opener",
    "The original stadium pushes forward behind the event title.",
    "#152533",
    "#f2f5e4",
    "#d2ff35",
    "Night League",
    "Final Whistle",
  ],
  [
    "deepField",
    "Deep Field",
    "cinema ending",
    "A moving light tunnel frames a held closing message.",
    "#0c1226",
    "#f7ebcc",
    "#e6ad69",
    "Deep Field",
    "Into the Blue",
  ],
  [
    "letterForm",
    "Letter Form",
    "kinetic typography",
    "Letters clear a measured baseline, then hold the complete phrase.",
    "#234bfa",
    "#fff2d8",
    "#ddff77",
    "Shape\\nSound",
    "After\\nImage",
  ],
  [
    "fieldNotes",
    "Field Notes",
    "data story",
    "Two or more series reveal on one scale with an exact value table.",
    "#f3eedc",
    "#163e35",
    "#de7543",
    "Field Notes",
    "Survey Results",
  ],
  [
    "flow",
    "Flow",
    "walkthrough",
    "The pointer arrives at each supplied action before attention advances.",
    "#f4f3ec",
    "#182e2a",
    "#287653",
    "Review flow",
    "First release",
  ],
] as const;
type Id = (typeof entries)[number][0];
const ids = entries.map((r) => r[0]) as [Id, ...Id[]];
const base = z
  .object({
    id: z.string().trim().min(1).optional(),
    blueprint: z.enum(ids),
    headline: z.string().trim().min(1).max(76),
    subheadline: z.string().trim().min(1).max(150).optional(),
    brandUrl: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine((value) => {
        if (/\s/.test(value)) return false;
        try {
          const u = new URL(value.includes("://") ? value : "https://" + value);
          return (
            ["https:", "http:"].includes(u.protocol) &&
            !u.username &&
            !u.password &&
            u.hostname.includes(".")
          );
        } catch {
          return false;
        }
      }, "Supply a display URL or domain, without credentials.")
      .optional(),
    accentColor: styleSchema.shape.color,
    from: z.number().int().nonnegative().default(0),
    duration: z.number().int().positive().optional(),
    chart: comparisonChartMacro.params.optional(),
    walkthrough: uiWalkthroughCardMacro.params.optional(),
  })
  .strip()
  .superRefine((p, c) => {
    for (const [key, id] of [
      ["chart", "fieldNotes"],
      ["walkthrough", "flow"],
    ] as const) {
      if ((p[key] !== undefined) !== (p.blueprint === id))
        c.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required only for ${id}.`,
        });
    }
    if (p.blueprint === "fieldNotes" && (p.subheadline || p.brandUrl))
      c.addIssue({
        code: "custom",
        message:
          "Field Notes reserves its frame for the supplied data. Use headline and chart slots.",
      });
  });
const exampleSlots = (id: Id, headline: string) => ({
  blueprint: id,
  headline: headline.replace("\\n", "\n"),
  ...(id === "fieldNotes"
    ? {
        chart: {
          kind: "line",
          unit: "%",
          domain: { min: 0, max: 100 },
          categories: ["A", "B"],
          series: [
            { name: "East", values: [25, 60] },
            { name: "West", values: [65, 40] },
          ],
        },
      }
    : {}),
  ...(id === "flow"
    ? {
        walkthrough: {
          windowTitle: headline,
          steps: [
            { label: "Collect" },
            { label: "Review" },
            { label: "Share" },
          ],
        },
      }
    : {}),
});
export const blueprintIndex = () =>
  entries.map(([id, title, category]) => ({
    id,
    title,
    category,
    hasEditableBlueprint: true,
  }));
export function blueprintDetails(id: string) {
  const row = entries.find((r) => r[0] === id);
  if (!row) throw Error("Unknown motion blueprint.");
  const { source, sha256 } = JSON.parse(blueprintArt[id]!);
  return {
    ...blueprintIndex().find((e) => e.id === id)!,
    source: `examples/creative-showcase/${source}.json`,
    sourceSha256: sha256,
    supportedFormats: ["16:9", "9:16", "1:1"],
    fps: 30,
    durationInFrames: 180,
    invariants: [
      row[3],
      "Preserve ordered art layers and a final readable hold.",
    ],
    slots:
      id === "fieldNotes"
        ? ["headline", "chart", "accentColor"]
        : [
            "headline",
            "subheadline",
            "brandUrl",
            "accentColor",
            ...(id === "flow" ? ["walkthrough"] : []),
          ],
    bindings: {
      headline:
        id === "letterForm"
          ? "title rows"
          : id === "fieldNotes"
            ? "chart.title"
            : "headline.text",
      ...(id === "fieldNotes"
        ? {
            chart: "comparisonChart data and geometry",
            accentColor: "frame rules",
          }
        : {
            subheadline: "subhead.text",
            brandUrl: "url.text",
            accentColor: "accent.style.backgroundColor",
            ...(id === "flow"
              ? { walkthrough: "uiWalkthroughCard parameters" }
              : {}),
          }),
    },
    adaptations: row.slice(7).map((h, i) => {
      const spec = exampleSlots(row[0], h);
      if (i && spec.chart) {
        spec.chart.series = [
          { name: "Spring", values: [30, 55] },
          { name: "Autumn", values: [52, 36] },
        ];
      }
      if (i && spec.walkthrough) {
        spec.walkthrough.steps = [
          { label: "Draft" },
          { label: "Approve" },
          { label: "Ship" },
        ];
      }
      return spec;
    }),
  };
}
const box = (
  left: number,
  top: number,
  width: number,
  height: number,
): SceneStyle => ({ position: "absolute", left, top, width, height });
export const remixBlueprintMacro: MacroDefinition<z.infer<typeof base>> = {
  name: "remixBlueprint",
  description:
    "Remix original MIT showcase artwork with exact supplied copy and editable native layers. Inspect remixBlueprint/<id> for a blueprint's slots and examples.",
  usage:
    '{"macro":"remixBlueprint","blueprint":"orbit","headline":"Common Ground","subheadline":"A place to begin."}',
  params: base,
  expand(p, rt) {
    const r = entries.find((e) => e[0] === p.blueprint)!;
    const { width: w, height: h, fps } = rt.ctx,
      short = Math.min(w, h),
      portrait = h > w * 1.1;
    const duration = p.duration ?? Math.round(fps * 6);
    if (duration < Math.max(3, Math.ceil(fps)))
      throw Error("Allow at least one second for a readable remix.");
    const id = rt.uniqueId(p.id ?? p.blueprint),
      nodes: SceneNode[] = [];
    const panel = (key: string, s: SceneStyle): SceneNode => ({
      id: id + "-" + key,
      type: "div",
      style: s,
    });
    const text = (
      key: string,
      value: string,
      s: SceneStyle,
      size: number,
      face: string,
      lines: number,
    ): SceneNode => ({
      id: id + "-" + key,
      type: "text",
      text: value,
      style: {
        ...s,
        fontFamily: face,
        fontSize: size,
        fontWeight: 600,
        lineHeight: 1.06,
        textFit: "shrink",
        minFontSize: Math.max(12, short * 0.025),
        maxLines: lines,
        color: r[5],
      },
    });
    nodes.push(panel("paper", { ...box(0, 0, w, h), backgroundColor: r[4] }));
    const source = JSON.parse(blueprintArt[p.blueprint]!) as {
      nodes: SceneNode[];
    };
    const art = source.nodes;
    const sourceFrames = [
      "orbit",
      "nightLeague",
      "letterForm",
      "fieldNotes",
      "flow",
    ].includes(p.blueprint)
      ? 120
      : 360;
    const frame = (f: number) =>
      Math.round((f * (duration - 1)) / (sourceFrames - 1));
    function bind(n: SceneNode) {
      n.id = id + "-" + n.id;
      if (n.from !== undefined) n.from = frame(n.from);
      if (n.duration !== undefined)
        n.duration = Math.max(1, frame(n.duration - 1) + 1);
      for (const a of n.animations ?? [])
        if (a.kind === "keyframes") {
          const mapped = new Map<number, (typeof a.frames)[number]>();
          for (const k of a.frames) {
            const f = frame(k.frame);
            mapped.set(f, { ...k, frame: f });
          }
          a.frames = [...mapped.values()];
        }
      if (n.extension?.name === "dojo.three-scene") {
        const params = n.extension.params as Record<string, unknown>;
        params.rate =
          (Number(params.rate ?? 1) * fps * (sourceFrames - 1)) /
          (30 * (duration - 1));
      }
      n.children?.forEach(bind);
    }
    art.forEach(bind);
    const margin = w * 0.07,
      usable = w - 2 * margin;
    if (p.blueprint === "fieldNotes") {
      const params = comparisonChartMacro.params.parse({
        ...p.chart,
        title: p.headline,
        id: id + "-chart",
        from: 0,
        duration,
        palette: "linen",
      });
      nodes.push(comparisonChartMacro.expand(params, rt));
      // Original frame rules, fitted to the new page and kept clear of the data.
      art.forEach((n, i) => {
        n.style = {
          ...box(
            margin,
            i ? h * 0.976 : h * 0.018,
            usable,
            Math.max(1, short * 0.002),
          ),
          backgroundColor: p.accentColor ?? r[5],
        };
        nodes.push(n);
      });
    } else if (p.blueprint === "letterForm") {
      const scale = Math.min(w / 1280, h / 720);
      nodes.push({
        ...panel("grid", {
          ...box((w - 1280 * scale) / 2, (h - 720 * scale) / 2, 1280, 720),
          transformOrigin: "left top",
          transform: `scale(${scale})`,
        }),
        children: art,
      });
      nodes.push(
        kineticSplitMacro.expand(
          kineticSplitMacro.params.parse({
            id: id + "-title",
            text: p.headline,
            splitBy: "line",
            preset: "elasticRise",
            color: r[5],
            duration,
            from: 0,
          }),
          rt,
        ),
      );
    } else {
      const artBox = portrait
        ? box(w * 0.05, h * 0.07, w * 0.9, h * 0.47)
        : box(w * 0.48, h * 0.12, w * 0.5, h * 0.72);
      if (p.blueprint === "flow") {
        const panelParams = uiWalkthroughCardMacro.params.parse({
          ...p.walkthrough,
          ...artBox,
          id: id + "-screen",
          from: 0,
          duration,
        });
        nodes.push(uiWalkthroughCardMacro.expand(panelParams, rt));
        const mark = panel("brandmark", {
          ...box(margin, h * 0.04, 64, 40),
          transformOrigin: "left top",
          transform: `scale(${short / 720})`,
        });
        mark.children = art.map((n) => ({
          ...n,
          style: {
            ...n.style,
            left: Number(n.style?.left ?? 0) - 54,
            top: Number(n.style?.top ?? 0) - 38,
          },
        }));
        nodes.push(mark);
      } else {
        const n = art[0]!,
          sw = Number(n.style?.width ?? 1280),
          sh = Number(n.style?.height ?? 720);
        const scale = Math.min(
          Number(artBox.width) / sw,
          Number(artBox.height) / sh,
        );
        n.style = { ...n.style, ...box(0, 0, sw, sh) };
        delete n.style.inset;
        nodes.push({
          ...panel("art", {
            ...box(
              Number(artBox.left) + (Number(artBox.width) - sw * scale) / 2,
              Number(artBox.top) + (Number(artBox.height) - sh * scale) / 2,
              sw,
              sh,
            ),
            transformOrigin: "left top",
            transform: `scale(${scale})`,
          }),
          children: [n],
        });
      }
      const copyW = portrait ? usable : w * 0.39,
        top = portrait ? h * 0.56 : h * 0.24,
        height = portrait ? h * 0.17 : h * 0.28;
      const heading = text(
        "headline",
        p.headline,
        box(margin, top, copyW, height),
        short * 0.112,
        "Fraunces",
        3,
      );
      heading.animations = [
        {
          kind: "keyframes",
          property: "opacity",
          frames: [
            { frame: 0, value: 0.12 },
            {
              frame: Math.max(1, Math.floor(duration * 0.19)),
              value: 1,
              easing: "easeOut",
            },
          ],
        },
      ];
      nodes.push(heading);
      if (p.subheadline)
        nodes.push(
          text(
            "subhead",
            p.subheadline,
            box(margin, top + height + h * 0.017, copyW, h * 0.12),
            short * 0.039,
            "Space Grotesk",
            3,
          ),
        );
    }
    if (p.blueprint === "letterForm" && p.subheadline)
      nodes.push(
        text(
          "subhead",
          p.subheadline,
          box(margin, h * 0.75, usable, h * 0.09),
          short * 0.038,
          "Space Grotesk",
          2,
        ),
      );
    if (p.blueprint !== "fieldNotes") {
      nodes.push(
        panel("accent", {
          ...box(margin, h * 0.903, usable, Math.max(2, short * 0.004)),
          backgroundColor: p.accentColor ?? r[6],
        }),
      );
      if (p.brandUrl)
        nodes.push(
          text(
            "url",
            p.brandUrl,
            box(margin, h * 0.918, usable, h * 0.055),
            short * 0.032,
            "IBM Plex Mono",
            1,
          ),
        );
    }
    return {
      id,
      type: "div",
      from: p.from,
      duration,
      style: box(0, 0, w, h),
      children: nodes,
    };
  },
};
