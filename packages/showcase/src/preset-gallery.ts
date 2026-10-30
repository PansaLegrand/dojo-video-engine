import {
  captionTemplateEntries,
  clipLayout,
  clipLayoutEntries,
  mediaLook,
  mediaLookEntries,
  styledCaptions,
  textOverlay,
  textOverlayTemplateEntries,
  transitionOverlay,
  transitionTemplateEntries,
  type ClipLayoutKey,
  type TextOverlayTemplateKey,
  type TransitionTemplateKey,
} from "@dojo-video-engine/presets";
import {
  type Scene,
  type SceneNode,
  type SceneStyle,
} from "@dojo-video-engine/schema";

export type PresetGalleryScene = {
  id: string;
  title: string;
  family: "subtitles" | "text" | "media" | "layout" | "transition";
  description: string;
  proves: string[];
  posterFrame: number;
  scene: Scene;
};

export const presetGalleryScenes: PresetGalleryScene[] = [
  subtitleGalleryScene(),
  textOverlayGalleryScene(),
  mediaLookGalleryScene(),
  clipLayoutGalleryScene(),
  transitionGalleryScene(),
];

export function findPresetGalleryScene(
  family: string,
): PresetGalleryScene | undefined {
  return presetGalleryScenes.find((entry) => entry.family === family);
}

function baseScene(title: string, nodes: SceneNode[]): Scene {
  return {
    schemaVersion: 1,
    width: 1600,
    height: 900,
    fps: 30,
    duration: 120,
    assets: {},
    nodes: [
      {
        id: "background",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #171717 0%, #222426 52%, #1f1b18 100%)",
        },
      },
      {
        id: "gallery-title",
        type: "text",
        text: title,
        style: {
          position: "absolute",
          left: 64,
          top: 42,
          width: 760,
          height: 54,
          fontFamily: "Inter, system-ui, Arial, sans-serif",
          fontSize: 38,
          fontWeight: 900,
          color: "#ffffff",
          textAlign: "left",
        },
      },
      ...nodes,
    ],
  } satisfies Scene;
}

function subtitleGalleryScene(): PresetGalleryScene {
  const words = [
    { word: "STYLE", startMs: 0, endMs: 1000 },
    { word: "FAST", startMs: 1000, endMs: 2200 },
  ];

  return {
    id: "preset-subtitles",
    title: "Subtitle Templates",
    family: "subtitles",
    description: "All subtitle template names rendered in one gallery scene.",
    proves: [
      "caption metadata",
      "styledCaptions()",
      "text stroke",
      "karaoke variants",
    ],
    posterFrame: 45,
    scene: baseScene(
      "Subtitle Templates",
      captionTemplateEntries.map(([template], index) => {
        const row = Math.floor(index / 4);
        const col = index % 4;
        const captions = styledCaptions(words, {
          fps: 30,
          template,
          idPrefix: `sub-${template}`,
          area: { top: 44, height: 94 },
          maxWordsPerSegment: 2,
          style: {
            fontSize: 38,
            letterSpacing: 0,
            textStroke: "2px rgba(2,6,23,0.84)",
            textBackgroundPaddingX: 18,
            textBackgroundPaddingY: 8,
          },
          highlightStyle: {
            textBackgroundPaddingX: 12,
            textBackgroundPaddingY: 4,
            textBackgroundRadius: 8,
          },
        });

        return {
          id: `card-${template}`,
          type: "div",
          style: cardStyle(64 + col * 382, 132 + row * 184, 336, 154),
          children: [
            labelNode(`label-${template}`, template, 18, 14),
            ...offsetChildren(captions, 0),
          ],
        };
      }),
    ),
  };
}

function textOverlayGalleryScene(): PresetGalleryScene {
  const examples: Record<TextOverlayTemplateKey, Record<string, string>> = {
    titleCard: {
      title: "Launch Week",
      subtitle: "Built with scene data",
      kicker: "DojoVideoEngine",
    },
    lowerThird: {
      title: "Ada Lovelace",
      subtitle: "Programmer",
      kicker: "Interview",
    },
    quoteCard: { body: "The scene is data.", attribution: "DojoVideoEngine" },
    statCallout: { value: "4.8x", label: "faster", subtitle: "browser export" },
    announcementBanner: {
      title: "New Drop",
      subtitle: "Friday",
      kicker: "Now Live",
    },
    socialHook: {
      title: "Stop guessing styles",
      subtitle: "Use preset names.",
    },
    chapterTitle: {
      title: "Act Two",
      subtitle: "The build begins",
      kicker: "02",
    },
  };

  return {
    id: "preset-text-overlays",
    title: "Text Overlay Templates",
    family: "text",
    description:
      "Production-shaped text overlay templates in one preview scene.",
    proves: [
      "textOverlay()",
      "required slots",
      "accent colors",
      "ordinary nodes",
    ],
    posterFrame: 45,
    scene: baseScene(
      "Text Overlay Templates",
      textOverlayTemplateEntries.map(([template], index) => {
        const row = Math.floor(index / 4);
        const col = index % 4;
        const width = 342;
        const height = 300;
        const overlay = textOverlay({
          template,
          id: `overlay-${template}`,
          enter: false,
          accentColor: accent(index),
          style: compactOverlayFrame(width, height, template),
          titleStyle: compactTextStyle(template === "socialHook" ? 26 : 30),
          subtitleStyle: compactTextStyle(16, "rgba(226,232,240,0.86)"),
          bodyStyle: compactTextStyle(25, "#0f172a"),
          valueStyle: compactTextStyle(44, accent(index)),
          labelStyle: compactTextStyle(18),
          attributionStyle: compactTextStyle(14, "#475569"),
          kickerStyle: {
            ...compactTextStyle(
              12,
              template === "announcementBanner"
                ? "rgba(255,255,255,0.86)"
                : accent(index),
            ),
            letterSpacing: 0,
          },
          ...examples[template],
        });

        return {
          id: `card-${template}`,
          type: "div",
          style: cardStyle(62 + col * 384, 140 + row * 340, width, height),
          children: [labelNode(`label-${template}`, template, 20, 18), overlay],
        };
      }),
    ),
  };
}

function mediaLookGalleryScene(): PresetGalleryScene {
  return {
    id: "preset-media-looks",
    title: "Media Looks",
    family: "media",
    description:
      "Named media look filters applied to identical color swatches.",
    proves: ["mediaLook()", "filter styles", "metadata", "style composition"],
    posterFrame: 45,
    scene: baseScene(
      "Media Looks",
      mediaLookEntries.map(([key], index) => {
        const row = Math.floor(index / 4);
        const col = index % 4;

        return {
          id: `look-${key}`,
          type: "div",
          style: cardStyle(74 + col * 374, 150 + row * 310, 314, 246),
          children: [
            {
              id: `look-${key}-media`,
              type: "div",
              style: {
                position: "absolute",
                left: 18,
                top: 52,
                width: 278,
                height: 150,
                borderRadius: 8,
                background: mediaGradient(index),
                boxShadow: "0px 12px 34px rgba(0,0,0,0.22)",
                ...mediaLook(key),
              },
            },
            labelNode(`label-${key}`, key, 20, 18),
          ],
        };
      }),
    ),
  };
}

function clipLayoutGalleryScene(): PresetGalleryScene {
  return {
    id: "preset-clip-layouts",
    title: "Clip Layouts",
    family: "layout",
    description: "Clip layout presets shown as miniature media placement maps.",
    proves: ["clipLayout()", "layout metadata", "pip", "split/grid styles"],
    posterFrame: 45,
    scene: baseScene(
      "Clip Layouts",
      clipLayoutEntries.map(([key], index) => {
        const row = Math.floor(index / 4);
        const col = index % 4;

        return {
          id: `layout-${key}`,
          type: "div",
          style: cardStyle(74 + col * 374, 140 + row * 246, 314, 190),
          children: [
            {
              id: `layout-${key}-frame`,
              type: "div",
              style: {
                position: "absolute",
                left: 20,
                top: 50,
                width: 274,
                height: 104,
                borderRadius: 8,
                backgroundColor: "rgba(15,23,42,0.72)",
                overflow: "hidden",
                border: "1px solid rgba(148,163,184,0.32)",
              },
              children: [
                {
                  id: `layout-${key}-media`,
                  type: "div",
                  style: clipLayoutPreviewStyle(key, index),
                },
              ],
            },
            labelNode(`label-${key}`, key, 20, 18),
          ],
        };
      }),
    ),
  };
}

function transitionGalleryScene(): PresetGalleryScene {
  return {
    id: "preset-transitions",
    title: "Transition Overlays",
    family: "transition",
    description: "Transition overlays paused at their midpoint.",
    proves: ["transitionOverlay()", "opacity keyframes", "wipes", "zoom pulse"],
    posterFrame: 30,
    scene: baseScene(
      "Transition Overlays",
      transitionTemplateEntries.map(([template], index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const transition = transitionOverlay(template, {
          id: `transition-${template}`,
          at: 0,
          duration: 60,
          color: transitionColor(template),
        });

        return {
          id: `card-${template}`,
          type: "div",
          style: cardStyle(102 + col * 494, 170 + row * 292, 410, 220),
          children: [
            {
              id: `transition-${template}-base`,
              type: "div",
              style: {
                position: "absolute",
                left: 22,
                top: 54,
                width: 366,
                height: 124,
                borderRadius: 8,
                background: mediaGradient(index),
                overflow: "hidden",
              },
              children: [
                {
                  ...transition,
                  style: {
                    ...transition.style,
                    borderRadius: 8,
                  },
                },
              ],
            },
            labelNode(`label-${template}`, template, 24, 18),
          ],
        };
      }),
    ),
  };
}

function cardStyle(
  left: number,
  top: number,
  width: number,
  height: number,
): SceneStyle {
  return {
    position: "absolute",
    left,
    top,
    width,
    height,
    backgroundColor: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 8,
    boxShadow: "0px 18px 48px rgba(0,0,0,0.24)",
    overflow: "hidden",
  };
}

function labelNode(
  id: string,
  text: string,
  left: number,
  top: number,
): SceneNode {
  return {
    id,
    type: "text",
    text,
    style: {
      position: "absolute",
      left,
      top,
      width: "80%",
      height: 28,
      fontFamily: "Inter, system-ui, Arial, sans-serif",
      fontSize: 19,
      fontWeight: 900,
      color: "#e2e8f0",
      letterSpacing: 0,
    },
  };
}

function compactOverlayFrame(
  width: number,
  height: number,
  template: TextOverlayTemplateKey,
): SceneStyle {
  const tall = template === "quoteCard" || template === "statCallout";

  return {
    position: "absolute",
    left: 18,
    right: undefined,
    top: 58,
    bottom: undefined,
    width: width - 36,
    height: height - 78,
    minHeight: height - 78,
    padding: tall ? 18 : 16,
    gap: 8,
    borderRadius: 8,
  };
}

function compactTextStyle(fontSize: number, color = "#ffffff"): SceneStyle {
  return {
    fontFamily: "Inter, system-ui, Arial, sans-serif",
    fontSize,
    fontWeight: 900,
    lineHeight: 1.04,
    color,
    textAlign: "center",
    textShadow: "0px 6px 20px rgba(0,0,0,0.22)",
  };
}

function offsetChildren(node: SceneNode, top: number): SceneNode[] {
  return [
    {
      ...node,
      style: {
        ...(node.style ?? {}),
        position: "absolute",
        left: 0,
        top,
        width: "100%",
        height: "100%",
      },
    },
  ];
}

function clipLayoutPreviewStyle(key: ClipLayoutKey, index: number): SceneStyle {
  const base: SceneStyle = {
    background: mediaGradient(index),
    borderRadius: 0,
  };

  const overrides = {
    fullscreen: {},
    containCenter: {
      left: 18,
      top: 16,
      width: 238,
      height: 72,
      borderRadius: 8,
    },
    pictureInPicture: {
      left: 174,
      top: 18,
      width: 78,
      height: 72,
      borderRadius: 8,
      border: "2px solid rgba(255,255,255,0.78)",
      boxShadow: "0px 10px 24px rgba(0,0,0,0.28)",
    },
    splitLeft: {},
    splitRight: {
      left: "50%",
    },
    gridTopLeft: {},
    gridTopRight: {},
    gridBottomLeft: {},
    gridBottomRight: {},
    blurredBackground: {
      left: -18,
      top: -12,
      width: 310,
      height: 128,
      filter: "brightness(0.72) saturate(1.05) blur(8px)",
    },
    phoneSafeVertical: {
      left: 94,
      top: 0,
      width: 86,
      height: "100%",
      borderRadius: 8,
    },
  } satisfies Record<ClipLayoutKey, SceneStyle>;

  const style = clipLayout(key, {
    ...base,
    ...overrides[key],
  });

  delete style.right;
  delete style.bottom;
  delete style.zIndex;

  if (key !== "blurredBackground") {
    delete style.filter;
  }

  if (key !== "pictureInPicture") {
    delete style.border;
    delete style.boxShadow;
  }

  return style;
}

function transitionColor(template: TransitionTemplateKey): string {
  return {
    fade: "rgba(15,23,42,0.72)",
    dipToBlack: "rgba(0,0,0,1)",
    flash: "rgba(255,255,255,0.92)",
    wipeLeft: "rgba(168,85,247,0.94)",
    wipeRight: "rgba(14,165,233,0.94)",
    zoom: "rgba(245,158,11,0.72)",
  }[template];
}

function accent(index: number): string {
  return [
    "#38bdf8",
    "#f59e0b",
    "#22c55e",
    "#f472b6",
    "#a78bfa",
    "#facc15",
    "#14b8a6",
  ][index % 7] as string;
}

function mediaGradient(index: number): string {
  const gradients = [
    "linear-gradient(135deg, #22d3ee 0%, #2563eb 46%, #111827 100%)",
    "linear-gradient(135deg, #fb7185 0%, #f59e0b 48%, #312e81 100%)",
    "linear-gradient(135deg, #34d399 0%, #0f766e 50%, #0f172a 100%)",
    "linear-gradient(135deg, #f472b6 0%, #7c3aed 52%, #020617 100%)",
  ];

  return gradients[index % gradients.length] as string;
}
