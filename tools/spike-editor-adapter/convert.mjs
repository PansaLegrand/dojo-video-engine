// THROWAWAY SPIKE — a row-based timeline-editor overlay format → motionforge scene.
// Deliverable is the gap report, not this code. Do not productionize in place;
// the real adapter is a follow-up package informed by docs/editor-adapter-spike.md.
//
// Usage: node tools/spike-editor-adapter/convert.mjs <editor-template.json> <out-scene.json> [--report <out-report.json>]

import { readFileSync, writeFileSync } from "node:fs";
import { validateScene } from "../../packages/schema/dist/index.js";

const [, , inPath, outPath, ...rest] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node convert.mjs <editor-template.json> <out-scene.json> [--report <path>]");
  process.exit(1);
}
const reportPath = rest[0] === "--report" ? rest[1] : undefined;

const FPS = 30; // the editor editor default
const REM = 16;

/** Gap collector: every the editor property the converter cannot map faithfully. */
const gaps = [];
function gap(overlay, property, value, classification, note) {
  gaps.push({
    overlayId: overlay.id,
    overlayType: overlay.type,
    property,
    value: typeof value === "string" ? value.slice(0, 120) : value,
    classification, // "engine" | "adapter" | "wont-support"
    note,
  });
}

// ---------- unit normalization ----------

function px(value, { fontSize } = {}) {
  if (value == null || value === "" || value === "none") return undefined;
  if (typeof value === "number") return value;
  const s = String(value).trim();
  if (s.endsWith("rem")) return parseFloat(s) * REM;
  if (s.endsWith("em")) return parseFloat(s) * (fontSize ?? REM);
  if (s.endsWith("px")) return parseFloat(s);
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function cleanColor(value) {
  if (!value || value === "transparent" || value === "none") return undefined;
  return value;
}

// the editor font classes ("font-bungee-inline") → CSS family names.
// The editor loads these via @fontsource; motionforge needs font *assets* (woff2 URLs).
// For the spike we map to the family name and let canvas fall back to system fonts.
const FONT_CLASS_TO_FAMILY = {
  "font-bungee-inline": "Bungee Inline",
  "font-inter": "Inter",
  "font-ibm-plex-mono": "IBM Plex Mono",
  "font-league-spartan": "League Spartan",
  "font-merriweather": "Merriweather",
};

// ---------- enter/exit animation mapping ----------
// the editor animation templates are 15-frame ramps evaluated per frame.
// We compile each name into motionforge keyframes on the node's local timeline.

const ENTER_LEN = 15;

function enterKeyframes(name, overlay) {
  switch (name) {
    case undefined:
    case "none":
      return [];
    case "fade":
    case "fadeIn":
      return [
        { property: "opacity", frames: [{ frame: 0, value: 0 }, { frame: ENTER_LEN, value: 1 }] },
      ];
    case "scale":
      return [
        { property: "opacity", frames: [{ frame: 0, value: 0 }, { frame: ENTER_LEN, value: 1 }] },
        { property: "transform", frames: [{ frame: 0, value: "scale(0.001)" }, { frame: ENTER_LEN, value: "scale(1)" }] },
      ];
    case "slideRight":
      return [
        { property: "opacity", frames: [{ frame: 0, value: 0 }, { frame: ENTER_LEN, value: 1 }] },
        // the editor uses translateX(-100%) — percent translate; motionforge translate is px.
        // Approximate with the overlay's own width in px.
        { property: "transform", frames: [{ frame: 0, value: `translate(${-overlay.width}px, 0px)` }, { frame: ENTER_LEN, value: "translate(0px, 0px)" }] },
      ];
    case "snapRotate":
      return [
        { property: "opacity", frames: [{ frame: 0, value: 0 }, { frame: 10, value: 1 }] },
        {
          property: "transform",
          frames: [
            { frame: 0, value: "rotate(-10deg) scale(0.8)" },
            { frame: 8, value: "rotate(5deg) scale(0.9066)" },
            { frame: 12, value: "rotate(-2deg) scale(0.96)" },
            { frame: 15, value: "rotate(0deg) scale(1)" },
          ],
        },
      ];
    default:
      return null; // unknown — caller records the gap
  }
}

function exitKeyframes(name, overlay) {
  const d = overlay.durationInFrames;
  const start = Math.max(0, d - ENTER_LEN);
  switch (name) {
    case undefined:
    case "none":
      return [];
    case "fade":
    case "fadeOut":
      return [
        { property: "opacity", frames: [{ frame: start, value: 1 }, { frame: d, value: 0 }] },
      ];
    case "scale":
      return [
        { property: "opacity", frames: [{ frame: start, value: 1 }, { frame: d, value: 0 }] },
        { property: "transform", frames: [{ frame: start, value: "scale(1)" }, { frame: d, value: "scale(0.001)" }] },
      ];
    default:
      return null;
  }
}

/** Merge enter+exit keyframe lists for one property into single animations. */
function buildAnimations(overlay) {
  const anim = overlay.styles?.animation;
  if (!anim) return [];
  const byProp = new Map();
  for (const [phase, name] of [["enter", anim.enter], ["exit", anim.exit]]) {
    const make = phase === "enter" ? enterKeyframes : exitKeyframes;
    const kfs = make(name, overlay);
    if (kfs === null) {
      gap(overlay, `animation.${phase}`, name, "adapter", "unknown animation template name; needs a preset mapping");
      continue;
    }
    for (const { property, frames } of kfs) {
      if (!byProp.has(property)) byProp.set(property, []);
      byProp.get(property).push(...frames);
    }
  }
  const animations = [];
  for (const [property, frames] of byProp) {
    frames.sort((a, b) => a.frame - b.frame);
    // strictly-increasing contract: drop duplicate frames (enter end == exit start on short overlays)
    const dedup = frames.filter((f, i) => i === 0 || f.frame > frames[i - 1].frame);
    if (dedup.length >= 2) animations.push({ kind: "keyframes", property, frames: dedup });
  }
  return animations;
}

// ---------- per-overlay conversion ----------

const assets = {};
function addAsset(overlay, type) {
  const id = `asset-${overlay.type}-${overlay.id}`;
  assets[id] = { id, type, src: overlay.src };
  return id;
}

function baseStyle(overlay) {
  const style = {
    position: "absolute",
    left: overlay.left,
    top: overlay.top,
    width: overlay.width,
    height: overlay.height,
  };
  if (overlay.rotation) {
    style.transform = `rotate(${overlay.rotation}deg)`; // the editor: transformOrigin center center (motionforge default)
  }
  const st = overlay.styles ?? {};
  if (st.opacity != null && st.opacity !== 1) style.opacity = st.opacity;
  if (st.transform && st.transform !== "none") {
    gap(overlay, "styles.transform", st.transform, "adapter", "static transform string must merge with rotation + animations");
  }
  return style;
}

/** the editor wraps media in a padded colored box via padding+paddingBackgroundColor. */
function wrapPadded(overlay, node) {
  const st = overlay.styles ?? {};
  const pad = px(st.padding);
  const bg = cleanColor(st.paddingBackgroundColor);
  if (!pad || !bg) return node;
  const outer = {
    id: `${node.id}-pad`,
    type: "div",
    from: node.from,
    duration: node.duration,
    style: { ...node.style, backgroundColor: bg, padding: pad },
    children: [
      {
        ...node,
        from: 0,
        duration: undefined,
        style: { width: "100%", height: "100%", ...pickMediaStyle(node.style) },
        animations: undefined,
      },
    ],
    animations: node.animations,
  };
  // inner node keeps only media-relevant styles
  return outer;
}

function pickMediaStyle(style) {
  const keep = {};
  for (const k of ["objectFit", "objectPosition", "borderRadius"]) if (style[k] != null) keep[k] = style[k];
  return keep;
}

function convertText(overlay) {
  const st = overlay.styles ?? {};
  const fontSize = px(st.fontSize) ?? 16;
  const style = {
    ...baseStyle(overlay),
    fontSize,
    color: cleanColor(st.color) ?? "#ffffff",
  };
  const bg = cleanColor(st.backgroundColor);
  if (bg) style.backgroundColor = bg;
  if (st.fontWeight) style.fontWeight = Number(st.fontWeight) || st.fontWeight;
  if (st.fontStyle && st.fontStyle !== "normal") style.fontStyle = st.fontStyle;
  if (st.textAlign) style.textAlign = st.textAlign;
  if (st.textShadow) style.textShadow = st.textShadow;
  if (st.lineHeight) style.lineHeight = Number(st.lineHeight) || px(st.lineHeight, { fontSize });
  const ls = px(st.letterSpacing, { fontSize });
  if (ls) style.letterSpacing = ls;
  if (st.fontFamily) {
    const family = FONT_CLASS_TO_FAMILY[st.fontFamily] ?? st.fontFamily;
    style.fontFamily = family;
    gap(overlay, "styles.fontFamily", st.fontFamily, "adapter", "needs a font-asset manifest (family → woff2 URL) registered in scene.assets; spike falls back to system fonts");
  }
  if (st.textDecoration && st.textDecoration !== "none") {
    gap(overlay, "styles.textDecoration", st.textDecoration, "engine", "underline/line-through not in style schema");
  }
  if (st.textTransform) {
    gap(overlay, "styles.textTransform", st.textTransform, "adapter", "apply uppercase/lowercase to the text string at convert time");
  }
  return {
    id: `ov-${overlay.id}`,
    type: "text",
    text: applyTextTransform(overlay.content ?? "", st.textTransform),
    from: overlay.from,
    duration: overlay.durationInFrames,
    style,
    animations: buildAnimations(overlay),
  };
}

function applyTextTransform(text, tt) {
  if (tt === "uppercase") return text.toUpperCase();
  if (tt === "lowercase") return text.toLowerCase();
  return text;
}

function convertMedia(overlay) {
  const st = overlay.styles ?? {};
  const isVideo = overlay.type === "video";
  const assetId = addAsset(overlay, isVideo ? "video" : "image");
  const style = { ...baseStyle(overlay) };
  if (st.objectFit) style.objectFit = st.objectFit;
  if (st.objectPosition) style.objectPosition = st.objectPosition;
  if (st.borderRadius) style.borderRadius = px(st.borderRadius);
  if (st.filter) {
    gap(overlay, "styles.filter", st.filter, "engine", "CSS filter chain (brightness/contrast/saturate/sepia/hue-rotate/grayscale) — used by most the editor video templates");
  }
  if (st.boxShadow) gap(overlay, "styles.boxShadow", st.boxShadow, "engine", "box shadows not in style schema");
  if (st.border) gap(overlay, "styles.border", st.border, "engine", "borders not in style schema");
  if (st.backdropFilter) gap(overlay, "styles.backdropFilter", st.backdropFilter, "wont-support", "no DOM backdrop in canvas rendering");
  const node = {
    id: `ov-${overlay.id}`,
    type: isVideo ? "video" : "img",
    assetId,
    from: overlay.from,
    duration: overlay.durationInFrames,
    style,
    animations: buildAnimations(overlay),
  };
  if (isVideo) {
    if (overlay.videoStartTime) node.videoStartTime = overlay.videoStartTime;
    if (overlay.speed && overlay.speed !== 1) node.playbackRate = overlay.speed;
    if (st.volume != null) {
      gap(overlay, "styles.volume", st.volume, "engine", "video nodes do not contribute audio; needs video-audio support or a paired audio node");
    }
  }
  return wrapPadded(overlay, node);
}

function convertSound(overlay) {
  const assetId = addAsset(overlay, "audio");
  const node = {
    id: `ov-${overlay.id}`,
    type: "audio",
    assetId,
    from: overlay.from,
    duration: overlay.durationInFrames,
  };
  if (overlay.startFromSound) node.audioStartTime = overlay.startFromSound;
  const vol = overlay.styles?.volume;
  if (vol != null) node.volume = vol;
  return node;
}

function convertOverlay(overlay) {
  switch (overlay.type) {
    case "text":
      return convertText(overlay);
    case "video":
    case "image":
      return convertMedia(overlay);
    case "sound":
      return convertSound(overlay);
    case "caption":
      gap(overlay, "type", "caption", "adapter", "map captions[] word timings onto @motionforge/presets caption generators");
      return null;
    case "shape":
    case "sticker":
      gap(overlay, "type", overlay.type, "engine", "no shape/sticker node type yet");
      return null;
    case "visualizer":
      gap(overlay, "type", "visualizer", "wont-support", "audio-reactive rendering out of scope for now");
      return null;
    default:
      gap(overlay, "type", overlay.type, "adapter", "unknown overlay type");
      return null;
  }
}

// ---------- main ----------

const template = JSON.parse(readFileSync(inPath, "utf8"));
const overlays = template.overlays ?? template.composition_data?.overlays ?? [];

// Canvas: CompositionData carries width/height; TemplateOverlay only an aspect ratio.
const width = template.width ?? template.aspectRatio?.width ?? 1280;
const height = template.height ?? template.aspectRatio?.height ?? 720;
const duration =
  template.durationInFrames ??
  template.duration ??
  Math.max(...overlays.map((o) => o.from + o.durationInFrames));

// the editor paint order: container zIndex = 100 - row*10 (higher row = behind).
// motionforge paints in node order, so sort back-to-front.
const ordered = [...overlays].sort(
  (a, b) => (100 - (a.row ?? 0) * 10) - (100 - (b.row ?? 0) * 10)
);

const nodes = ordered.map(convertOverlay).filter(Boolean);

const scene = {
  schemaVersion: 1,
  width,
  height,
  fps: template.fps ?? FPS,
  duration,
  assets,
  nodes: [
    { id: "canvas-bg", type: "div", style: { width: "100%", height: "100%", backgroundColor: template.backgroundColor ?? "#111827" } },
    ...nodes,
  ],
};

const result = validateScene(scene);
if (!result.ok) {
  console.error("⚠️  converted scene FAILS validation:");
  for (const e of result.errors) console.error("  -", e.path, e.message ?? e);
  for (const e of result.errors) {
    gaps.push({ property: `validation:${e.path}`, value: String(e.message ?? e).slice(0, 160), classification: "adapter", note: "converter emitted invalid scene data" });
  }
} else {
  console.log("✅ converted scene validates");
}

writeFileSync(outPath, JSON.stringify(scene, null, 2));
console.log(`scene  → ${outPath} (${nodes.length}/${overlays.length} overlays converted)`);

const summary = {};
for (const g of gaps) {
  const key = `${g.classification} :: ${g.property}`;
  summary[key] = (summary[key] ?? 0) + 1;
}
console.log("\nGap summary:");
for (const [k, n] of Object.entries(summary).sort()) console.log(`  ${String(n).padStart(2)}× ${k}`);

if (reportPath) {
  writeFileSync(reportPath, JSON.stringify({ template: template.name ?? inPath, gaps }, null, 2));
  console.log(`report → ${reportPath}`);
}
