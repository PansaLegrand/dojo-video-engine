import { sampleScene } from "@motionforge/core";
import {
  imageOverlay,
  karaokeCaptions,
  parseSrt,
  parseVtt,
  subtitleTrack,
  tiktokCaptions,
  videoOverlay,
  type CaptionWord,
} from "@motionforge/presets";
import { parseScene, type Scene, type SceneNode } from "@motionforge/schema";
export {
  findPresetGalleryScene,
  presetGalleryScenes,
  type PresetGalleryScene,
} from "./preset-gallery.js";

export type ShowcaseScene = {
  id: string;
  title: string;
  description: string;
  proves: string[];
  scene: Scene;
  posterFrame: number;
};

const captionWords: CaptionWord[] = [
  { word: "FORGE", startMs: 800, endMs: 1600 },
  { word: "MOTION", startMs: 1600, endMs: 2400 },
  { word: "IN", startMs: 2400, endMs: 3200 },
  { word: "THE", startMs: 3200, endMs: 4000 },
  { word: "BROWSER", startMs: 4000, endMs: 5000 },
];

const karaokeWords: CaptionWord[] = [
  { word: "JSON", startMs: 500, endMs: 1100 },
  { word: "BECOMES", startMs: 1100, endMs: 1850 },
  { word: "VIDEO", startMs: 1850, endMs: 2600 },
  { word: "IN", startMs: 2600, endMs: 3050 },
  { word: "BROWSER", startMs: 3050, endMs: 4100 },
];

export function introScene(): Scene {
  return sampleScene();
}

export function tiktokCaptionScene(): Scene {
  return parseScene({
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 150,
    assets: {},
    nodes: [
      {
        id: "background",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #101820 0%, #244f46 100%)",
        },
        children: [],
      },
      {
        id: "glass-panel",
        type: "div",
        style: {
          position: "absolute",
          left: 90,
          right: 90,
          top: 540,
          height: 760,
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 100%)",
          borderRadius: 42,
        },
        children: [],
      },
      tiktokCaptions(captionWords, {
        fps: 30,
        highlightIndices: [1, 4],
        area: { top: 760, height: 360 },
      }),
      {
        id: "progress-track",
        type: "div",
        style: {
          position: "absolute",
          left: 120,
          right: 120,
          top: 1320,
          height: 14,
          backgroundColor: "rgba(255,255,255,0.22)",
          borderRadius: 12,
          overflow: "hidden",
        },
        children: [
          {
            id: "progress-fill",
            type: "div",
            style: {
              width: "100%",
              height: "100%",
              backgroundColor: "#ffd166",
              transform: "translate(-100%, 0px)",
            },
            animations: [
              {
                kind: "keyframes",
                property: "transform",
                frames: [
                  { frame: 0, value: "translate(-100%, 0px)" },
                  {
                    frame: 149,
                    value: "translate(0%, 0px)",
                    easing: "linear",
                  },
                ],
              },
            ],
            children: [],
          },
        ],
      },
    ],
  });
}

export function karaokeCaptionScene(): Scene {
  return parseScene({
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 135,
    assets: {},
    nodes: [
      {
        id: "background",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #17202a 0%, #4e342e 100%)",
        },
        children: [],
      },
      {
        id: "stage",
        type: "div",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 560,
          height: 520,
          background:
            "linear-gradient(135deg, rgba(78,205,196,0.22) 0%, rgba(255,209,102,0.14) 100%)",
          borderRadius: 36,
        },
        animations: [
          {
            kind: "keyframes",
            property: "transform",
            frames: [
              { frame: 0, value: "scale(0.96)" },
              { frame: 18, value: "scale(1)", easing: "spring(0.2)" },
            ],
          },
        ],
        children: [],
      },
      {
        id: "title",
        type: "text",
        text: "KARAOKE CAPTIONS",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 430,
          height: 90,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 46,
          fontWeight: 800,
          letterSpacing: 3,
          color: "#4ecdc4",
          textAlign: "center",
        },
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [
              { frame: 0, value: 0 },
              { frame: 16, value: 1, easing: "easeOut" },
            ],
          },
        ],
        children: [],
      },
      karaokeCaptions(karaokeWords, {
        fps: 30,
        area: { top: 760, height: 170 },
        rampFrames: 3,
        style: {
          fontSize: 54,
          fontWeight: 850,
          color: "#ffffff",
          highlightColor: "#ffd166",
          textStroke: "5px #000000",
          textShadow: "0 10 32 rgba(0,0,0,0.45)",
        },
      }),
    ],
  });
}

function launchMetricCard(
  id: string,
  label: string,
  value: string,
  left: number,
  top: number,
  color: string,
  delay: number,
): SceneNode {
  return {
    id,
    type: "div",
    style: {
      position: "absolute",
      left,
      top,
      width: 372,
      height: 160,
      background:
        "linear-gradient(135deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 100%)",
      border: `2px solid ${color}`,
      borderRadius: 22,
      boxShadow: "0 20 48 rgba(0,0,0,0.28)",
      opacity: 0,
      transform: "translate(0px, 38px)",
    },
    animations: [
      {
        kind: "keyframes",
        property: "opacity",
        frames: [
          { frame: 0, value: 0 },
          { frame: delay, value: 0 },
          { frame: delay + 14, value: 1, easing: "easeOut" },
        ],
      },
      {
        kind: "keyframes",
        property: "transform",
        frames: [
          { frame: 0, value: "translate(0px, 38px)" },
          { frame: delay, value: "translate(0px, 38px)" },
          {
            frame: delay + 18,
            value: "translate(0px, 0px)",
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        ],
      },
    ],
    children: [
      {
        id: `${id}-label`,
        type: "text",
        text: label,
        style: {
          position: "absolute",
          left: 28,
          top: 24,
          width: 316,
          height: 34,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: 2,
          color,
          textAlign: "left",
        },
      },
      {
        id: `${id}-value`,
        type: "text",
        text: value,
        style: {
          position: "absolute",
          left: 28,
          top: 66,
          width: 316,
          height: 58,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 44,
          fontWeight: 850,
          color: "#ffffff",
          textAlign: "left",
          textShadow: "0 8 28 rgba(0,0,0,0.45)",
        },
      },
    ],
  };
}

function launchScanLine(
  id: string,
  top: number,
  delay: number,
  color: string,
): SceneNode {
  return {
    id,
    type: "div",
    style: {
      position: "absolute",
      left: -260,
      top,
      width: 220,
      height: 4,
      backgroundColor: color,
      opacity: 0,
      borderRadius: 4,
      transform: "translate(0px, 0px)",
    },
    animations: [
      {
        kind: "keyframes",
        property: "opacity",
        frames: [
          { frame: 0, value: 0 },
          { frame: delay, value: 0 },
          { frame: delay + 10, value: 0.82, easing: "easeOut" },
          { frame: delay + 64, value: 0, easing: "easeIn" },
        ],
      },
      {
        kind: "keyframes",
        property: "transform",
        frames: [
          { frame: 0, value: "translate(0px, 0px)" },
          { frame: delay, value: "translate(0px, 0px)" },
          {
            frame: delay + 64,
            value: "translate(1600px, 0px)",
            easing: "linear",
          },
        ],
      },
    ],
  };
}

function countdownText(label: string, index: number): SceneNode {
  return {
    id: `countdown-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    type: "text",
    text: label,
    from: 96 + index * 28,
    duration: label === "GO" ? 56 : 28,
    style: {
      position: "absolute",
      left: 120,
      top: 676,
      width: 840,
      height: 260,
      fontFamily: "system-ui, Arial, sans-serif",
      fontSize: label === "GO" ? 176 : 148,
      fontWeight: 900,
      color: label === "GO" ? "#66f5d7" : "#ffffff",
      textAlign: "center",
      textStroke: "5px rgba(0,0,0,0.55)",
      textShadow: "0 18 58 rgba(0,0,0,0.55)",
      transform: "scale(0.82)",
    },
    animations: [
      {
        kind: "keyframes",
        property: "transform",
        frames: [
          { frame: 0, value: "scale(0.82)" },
          { frame: 10, value: "scale(1)", easing: "spring(0.28)" },
        ],
      },
      {
        kind: "keyframes",
        property: "opacity",
        frames: [
          { frame: 0, value: 0 },
          { frame: 6, value: 1, easing: "easeOut" },
          { frame: label === "GO" ? 48 : 23, value: 1 },
          { frame: label === "GO" ? 55 : 27, value: 0, easing: "easeIn" },
        ],
      },
    ],
  };
}

export function launchInfoDisplayScene(): Scene {
  return parseScene({
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 240,
    assets: {},
    nodes: [
      {
        id: "launch-background",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(180deg, #10131b 0%, #233945 48%, #2c1f3f 100%)",
        },
      },
      {
        id: "launch-grid",
        type: "div",
        style: {
          position: "absolute",
          left: 84,
          top: 180,
          width: 912,
          height: 1320,
          border: "2px solid rgba(102,245,215,0.25)",
          borderRadius: 34,
          overflow: "hidden",
          background:
            "linear-gradient(90deg, rgba(102,245,215,0.08) 0%, rgba(255,209,102,0.05) 54%, rgba(255,87,122,0.08) 100%)",
        },
        children: [
          launchScanLine(
            "launch-scanline-a",
            180,
            18,
            "rgba(102,245,215,0.92)",
          ),
          launchScanLine(
            "launch-scanline-b",
            520,
            86,
            "rgba(255,209,102,0.86)",
          ),
          launchScanLine(
            "launch-scanline-c",
            900,
            142,
            "rgba(255,87,122,0.82)",
          ),
        ],
      },
      {
        id: "launch-kicker",
        type: "text",
        text: "PROMPT TO VIDEO",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 260,
          height: 46,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: 4,
          color: "#66f5d7",
          textAlign: "center",
        },
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [
              { frame: 0, value: 0 },
              { frame: 18, value: 1, easing: "easeOut" },
            ],
          },
        ],
      },
      {
        id: "launch-title",
        type: "text",
        text: "Launch Info Display",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 316,
          height: 108,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 82,
          fontWeight: 900,
          color: "#ffffff",
          textAlign: "center",
          textShadow: "0 16 42 rgba(0,0,0,0.48)",
          transform: "translate(0px, 32px)",
        },
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [
              { frame: 0, value: 0 },
              { frame: 24, value: 1, easing: "easeOut" },
            ],
          },
          {
            kind: "keyframes",
            property: "transform",
            frames: [
              { frame: 0, value: "translate(0px, 32px)" },
              {
                frame: 26,
                value: "translate(0px, 0px)",
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              },
            ],
          },
        ],
      },
      launchMetricCard(
        "launch-card-window",
        "WINDOW",
        "07:30 UTC",
        132,
        486,
        "rgba(102,245,215,0.86)",
        34,
      ),
      launchMetricCard(
        "launch-card-payload",
        "PAYLOAD",
        "MOTIONFORGE",
        576,
        486,
        "rgba(255,209,102,0.9)",
        46,
      ),
      launchMetricCard(
        "launch-card-status",
        "STATUS",
        "Nominal",
        132,
        1050,
        "rgba(255,87,122,0.82)",
        72,
      ),
      launchMetricCard(
        "launch-card-target",
        "TARGET",
        "Public Beta",
        576,
        1050,
        "rgba(143,173,255,0.92)",
        84,
      ),
      ...["T-03", "T-02", "T-01", "GO"].map((label, index) =>
        countdownText(label, index),
      ),
      {
        id: "launch-progress-track",
        type: "div",
        style: {
          position: "absolute",
          left: 132,
          right: 132,
          top: 1300,
          height: 18,
          backgroundColor: "rgba(255,255,255,0.16)",
          borderRadius: 12,
          overflow: "hidden",
        },
        children: [
          {
            id: "launch-progress-fill",
            type: "div",
            style: {
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(90deg, #66f5d7 0%, #ffd166 54%, #ff577a 100%)",
              transform: "translate(-100%, 0px)",
            },
            animations: [
              {
                kind: "keyframes",
                property: "transform",
                frames: [
                  { frame: 0, value: "translate(-100%, 0px)" },
                  {
                    frame: 210,
                    value: "translate(0%, 0px)",
                    easing: "linear",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "launch-footer",
        type: "text",
        text: "A single prompt becomes timed text, panels, countdown, and motion.",
        style: {
          position: "absolute",
          left: 120,
          right: 120,
          top: 1384,
          height: 92,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 34,
          fontWeight: 700,
          lineHeight: 1.18,
          color: "#d9fff7",
          textAlign: "center",
        },
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [
              { frame: 0, value: 0 },
              { frame: 128, value: 0 },
              { frame: 148, value: 1, easing: "easeOut" },
            ],
          },
        ],
      },
    ],
  });
}

export function timedTextOverlayScene(): Scene {
  return parseScene({
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 450,
    assets: {},
    nodes: [
      {
        id: "timed-background",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(180deg, #18191f 0%, #253947 52%, #17191f 100%)",
        },
      },
      {
        id: "timed-frame",
        type: "div",
        style: {
          position: "absolute",
          left: 72,
          right: 72,
          top: 148,
          bottom: 148,
          border: "2px solid rgba(255,255,255,0.18)",
          borderRadius: 32,
        },
      },
      {
        id: "timed-center-panel",
        type: "div",
        style: {
          position: "absolute",
          left: 144,
          right: 144,
          top: 650,
          height: 520,
          background:
            "linear-gradient(135deg, rgba(102,245,215,0.16) 0%, rgba(255,209,102,0.12) 46%, rgba(255,87,122,0.13) 100%)",
          border: "2px solid rgba(255,255,255,0.16)",
          borderRadius: 28,
          boxShadow: "0 26 70 rgba(0,0,0,0.32)",
        },
      },
      {
        id: "timed-top-text",
        type: "text",
        text: "motionforge.dev",
        from: 0,
        duration: 150,
        style: {
          position: "absolute",
          left: 0,
          top: 74,
          width: "100%",
          height: 118,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 76,
          fontWeight: 900,
          color: "#ff3030",
          textAlign: "center",
          textStroke: "4px rgba(55,0,0,0.72)",
          textShadow: "0 12 34 rgba(0,0,0,0.45)",
        },
      },
      {
        id: "dojo-top-rule",
        type: "div",
        from: 0,
        duration: 150,
        style: {
          position: "absolute",
          left: 360,
          top: 204,
          width: 360,
          height: 6,
          backgroundColor: "#ff3030",
          borderRadius: 5,
          transform: "scale(0.2)",
        },
        animations: [
          {
            kind: "keyframes",
            property: "transform",
            frames: [
              { frame: 0, value: "scale(0.2)" },
              { frame: 18, value: "scale(1)", easing: "easeOut" },
            ],
          },
        ],
      },
      {
        id: "timed-prompt-copy",
        type: "text",
        text: "first 5 seconds: top center\nending 10 seconds: right bottom",
        style: {
          position: "absolute",
          left: 190,
          right: 190,
          top: 804,
          height: 180,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 38,
          fontWeight: 760,
          lineHeight: 1.28,
          color: "#ffffff",
          textAlign: "center",
          textBackgroundColor: "rgba(0,0,0,0.22)",
          textBackgroundPaddingX: 28,
          textBackgroundPaddingY: 12,
          textBackgroundRadius: 18,
        },
      },
      {
        id: "coming-soon-text",
        type: "text",
        text: "Coming soon...",
        from: 150,
        duration: 300,
        style: {
          position: "absolute",
          right: 70,
          bottom: 92,
          width: 520,
          height: 78,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 38,
          fontWeight: 850,
          color: "#ffe45c",
          textAlign: "right",
          textShadow: "0 10 28 rgba(0,0,0,0.54)",
        },
      },
      {
        id: "coming-soon-accent",
        type: "div",
        from: 150,
        duration: 300,
        style: {
          position: "absolute",
          right: 72,
          bottom: 82,
          width: 260,
          height: 5,
          backgroundColor: "#ffe45c",
          borderRadius: 5,
          transform: "translate(260px, 0px)",
        },
        animations: [
          {
            kind: "keyframes",
            property: "transform",
            frames: [
              { frame: 0, value: "translate(260px, 0px)" },
              {
                frame: 16,
                value: "translate(0px, 0px)",
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              },
            ],
          },
        ],
      },
      {
        id: "timed-progress-track",
        type: "div",
        style: {
          position: "absolute",
          left: 120,
          right: 120,
          bottom: 188,
          height: 10,
          backgroundColor: "rgba(255,255,255,0.18)",
          borderRadius: 8,
          overflow: "hidden",
        },
        children: [
          {
            id: "timed-progress-fill",
            type: "div",
            style: {
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, #ff3030 0%, #ffe45c 100%)",
              transform: "translate(-100%, 0px)",
            },
            animations: [
              {
                kind: "keyframes",
                property: "transform",
                frames: [
                  { frame: 0, value: "translate(-100%, 0px)" },
                  {
                    frame: 449,
                    value: "translate(0%, 0px)",
                    easing: "linear",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
}

function stressTextCard(
  id: string,
  label: string,
  value: string,
  left: number,
  top: number,
  width: number,
  height: number,
  accent: string,
  maxLines: number,
): SceneNode {
  return {
    id,
    type: "div",
    style: {
      position: "absolute",
      left,
      top,
      width,
      height,
      padding: 24,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      backgroundColor: "rgba(15,23,42,0.82)",
      border: `2px solid ${accent}`,
      borderRadius: 22,
      boxShadow: "0 22 54 rgba(0,0,0,0.28)",
      overflow: "hidden",
    },
    children: [
      {
        id: `${id}-label`,
        type: "text",
        text: label,
        style: {
          width: "100%",
          height: 30,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: 2,
          color: accent,
          textAlign: "left",
          overflow: "hidden",
          textFit: "truncate",
          textOverflow: "ellipsis",
          maxLines: 1,
          minFontSize: 14,
        },
      },
      {
        id: `${id}-value`,
        type: "text",
        text: value,
        style: {
          width: "100%",
          height: Math.max(72, height - 90),
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 34,
          fontWeight: 820,
          lineHeight: 1.12,
          color: "#f8fafc",
          textAlign: "left",
          overflow: "hidden",
          textFit: "shrink",
          textOverflow: "ellipsis",
          maxLines,
          minFontSize: 18,
        },
      },
    ],
  };
}

export function textStressGalleryScene(): Scene {
  return parseScene({
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 90,
    assets: {},
    nodes: [
      {
        id: "stress-background",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(180deg, #101820 0%, #1e293b 48%, #172554 100%)",
        },
      },
      {
        id: "stress-title",
        type: "text",
        text: "Text Stress Gallery",
        style: {
          position: "absolute",
          left: 72,
          right: 72,
          top: 82,
          height: 86,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 62,
          fontWeight: 900,
          color: "#ffffff",
          textAlign: "center",
          textShadow: "0 14 38 rgba(0,0,0,0.45)",
          overflow: "hidden",
          textFit: "shrink",
          textOverflow: "ellipsis",
          maxLines: 1,
          minFontSize: 34,
        },
      },
      {
        id: "stress-subtitle",
        type: "text",
        text: "Long Latin, URLs, CJK, emoji, single-token overflow, and multiline captions in one validated scene.",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 174,
          height: 78,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1.2,
          color: "#cbd5e1",
          textAlign: "center",
          overflow: "hidden",
          textFit: "shrink",
          textOverflow: "ellipsis",
          maxLines: 2,
          minFontSize: 18,
        },
      },
      stressTextCard(
        "stress-long-latin",
        "LONG LATIN",
        "This paragraph is intentionally verbose so unknown user copy can wrap, shrink, and clamp without bleeding into adjacent overlays or resizing the card.",
        72,
        300,
        444,
        292,
        "#38bdf8",
        4,
      ),
      stressTextCard(
        "stress-url",
        "URL / PATH",
        "https://example.com/products/motionforge/releases/2026/very-long-share-link?utm_source=chat_instruction&clip=final_render",
        564,
        300,
        444,
        292,
        "#facc15",
        3,
      ),
      stressTextCard(
        "stress-cjk",
        "CJK",
        "这是一段很长的中文说明文字，用来确认没有空格的句子也可以稳定换行、缩小并保持在安全区域内。",
        72,
        630,
        444,
        292,
        "#34d399",
        4,
      ),
      stressTextCard(
        "stress-emoji",
        "EMOJI",
        "Launch day is live 🚀✨🎬 — keep the headline readable even with emoji clusters, flags 🇫🇷🇯🇵, and expressive punctuation!!!",
        564,
        630,
        444,
        292,
        "#fb7185",
        4,
      ),
      stressTextCard(
        "stress-long-token",
        "LONG SINGLE TOKEN",
        "SupercalifragilisticexpialidociousPneumonoultramicroscopicsilicovolcanoconiosisWithoutSpaces",
        72,
        960,
        444,
        292,
        "#a78bfa",
        3,
      ),
      stressTextCard(
        "stress-multiline",
        "MULTILINE CAPTION",
        "Line one keeps its explicit break.\nLine two is longer and should shrink without overlap.\nLine three is clamped if space runs out.",
        564,
        960,
        444,
        292,
        "#f97316",
        3,
      ),
      {
        id: "stress-footer",
        type: "text",
        text: "Refresh: pnpm showcase:generate then render examples/generated/text-stress-gallery.json with @motionforge/golden.",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 1328,
          height: 82,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 25,
          fontWeight: 740,
          lineHeight: 1.22,
          color: "#dbeafe",
          textAlign: "center",
          overflow: "hidden",
          textFit: "shrink",
          textOverflow: "ellipsis",
          maxLines: 2,
          minFontSize: 16,
        },
      },
    ],
  });
}

function subtitleStressInfoPanel(): SceneNode {
  const rows = [
    ["SRT", "multiline cues"],
    ["VTT", "cue settings + notes"],
    ["LONG", "Latin + URL overflow"],
    ["CJK", "no-space wrapping"],
    ["EMOJI", "clusters + flags"],
    ["FAST", "rapid cue changes"],
  ];

  return {
    id: "subtitle-stress-panel",
    type: "div",
    style: {
      position: "absolute",
      left: 72,
      top: 304,
      width: 936,
      height: 760,
      padding: 32,
      display: "flex",
      flexDirection: "column",
      gap: 18,
      backgroundColor: "rgba(15,23,42,0.76)",
      border: "2px solid rgba(125,211,252,0.46)",
      borderRadius: 26,
      boxShadow: "0 28 70 rgba(2,6,23,0.42)",
      overflow: "hidden",
    },
    children: rows.map(([label, value], index) => ({
      id: `subtitle-stress-row-${index}`,
      type: "div",
      style: {
        width: "100%",
        height: 88,
        display: "flex",
        alignItems: "center",
        gap: 20,
        backgroundColor:
          index % 2 === 0 ? "rgba(255,255,255,0.08)" : "rgba(56,189,248,0.1)",
        borderRadius: 16,
        padding: 18,
        overflow: "hidden",
      },
      children: [
        {
          id: `subtitle-stress-row-${index}-label`,
          type: "text",
          text: label,
          style: {
            width: 150,
            height: "100%",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: 2,
            color: "#7dd3fc",
            textAlign: "left",
            overflow: "hidden",
            textFit: "truncate",
            textOverflow: "ellipsis",
            maxLines: 1,
            minFontSize: 18,
          },
        },
        {
          id: `subtitle-stress-row-${index}-value`,
          type: "text",
          text: value,
          style: {
            width: 680,
            height: "100%",
            fontFamily: "system-ui, Arial, sans-serif",
            fontSize: 34,
            fontWeight: 780,
            lineHeight: 1.1,
            color: "#f8fafc",
            textAlign: "left",
            overflow: "hidden",
            textFit: "shrink",
            textOverflow: "ellipsis",
            maxLines: 2,
            minFontSize: 20,
          },
        },
      ],
    })),
  };
}

export function subtitleStressGalleryScene(): Scene {
  const srtTrack = subtitleTrack(
    parseSrt(`1
00:00:00,000 --> 00:00:02,800
SRT multiline cue:
first line stays visible
second line is intentionally longer

2
00:00:02,800 --> 00:00:05,400
Long Latin subtitle text should shrink, clamp, and keep its ending readable inside the safe subtitle band without crossing into the proof panel.`),
    {
      fps: 30,
      idPrefix: "subtitle-stress-srt",
      template: "minimalBar",
      composition: { width: 1080, height: 1920 },
      maxLines: 3,
    },
  );
  const vttTrack = subtitleTrack(
    parseVtt(`WEBVTT

NOTE Generated by an external captioning tool

intro
00:00:05.400 --> 00:00:07.900 align:center position:50%
WebVTT cue settings are ignored while the cue text stays deterministic.

00:00:07.900 --> 00:00:10.200
https://motionforge.dev/docs/examples/generated/subtitle-stress-gallery.json?source=subtitle-overlay-roadmap&case=url`),
    {
      fps: 30,
      idPrefix: "subtitle-stress-vtt",
      template: "future",
      composition: { width: 1080, height: 1920 },
      maxLines: 2,
    },
  );
  const manualTrack = subtitleTrack(
    [
      {
        text: "这是一段没有空格的中文字幕，用来确认 CJK 文本可以稳定换行并保持在安全区域内。",
        startSeconds: 10.2,
        endSeconds: 12.7,
      },
      {
        text: "Emoji clusters stay calm 🚀✨🎬 with flags 🇫🇷🇯🇵 and expressive punctuation!!!",
        startSeconds: 12.7,
        endSeconds: 14.9,
      },
      { text: "FAST 1", startSeconds: 14.9, endSeconds: 15.35 },
      { text: "FAST 2", startSeconds: 15.35, endSeconds: 15.8 },
      { text: "FAST 3", startSeconds: 15.8, endSeconds: 16.25 },
      {
        text: "Final cue: every subtitle here is just schema-valid scene data.",
        startSeconds: 16.25,
        endSeconds: 18,
      },
    ],
    {
      fps: 30,
      idPrefix: "subtitle-stress-manual",
      template: "spotlight",
      composition: { width: 1080, height: 1920 },
      maxLines: 2,
    },
  );

  return parseScene({
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 540,
    assets: {},
    nodes: [
      {
        id: "subtitle-stress-background",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(180deg, #0b1220 0%, #172033 48%, #102a43 100%)",
        },
      },
      {
        id: "subtitle-stress-title",
        type: "text",
        text: "Subtitle Stress Gallery",
        style: {
          position: "absolute",
          left: 72,
          right: 72,
          top: 78,
          height: 86,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 62,
          fontWeight: 900,
          color: "#ffffff",
          textAlign: "center",
          textShadow: "0 14 38 rgba(0,0,0,0.45)",
          overflow: "hidden",
          textFit: "shrink",
          textOverflow: "ellipsis",
          maxLines: 1,
          minFontSize: 34,
        },
      },
      {
        id: "subtitle-stress-subtitle",
        type: "text",
        text: "SRT, WebVTT, long Latin, URLs, CJK, emoji, and fast cue changes compiled into ordinary timed subtitle nodes.",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 174,
          height: 90,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 28,
          fontWeight: 720,
          lineHeight: 1.2,
          color: "#bae6fd",
          textAlign: "center",
          overflow: "hidden",
          textFit: "shrink",
          textOverflow: "ellipsis",
          maxLines: 2,
          minFontSize: 18,
        },
      },
      subtitleStressInfoPanel(),
      {
        id: "subtitle-stress-footer",
        type: "text",
        text: "Refresh: pnpm showcase:generate then render examples/generated/subtitle-stress-gallery.json with @motionforge/golden.",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 1118,
          height: 72,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 24,
          fontWeight: 720,
          lineHeight: 1.18,
          color: "#dbeafe",
          textAlign: "center",
          overflow: "hidden",
          textFit: "shrink",
          textOverflow: "ellipsis",
          maxLines: 2,
          minFontSize: 16,
        },
      },
      srtTrack,
      vttTrack,
      manualTrack,
    ],
  });
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function imageOverlayAssetSvg(kind: string): string {
  if (kind === "logo") {
    return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#07111f"/>
  <path d="M130 348V164h56l70 88 70-88h56v184h-62V258l-50 64h-28l-50-64v90z" fill="#66f5d7"/>
  <circle cx="392" cy="128" r="42" fill="#ffd166"/>
</svg>`);
  }

  if (kind === "watermark") {
    return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="300" viewBox="0 0 960 300">
  <rect width="960" height="300" rx="96" fill="rgba(255,255,255,0.92)"/>
  <circle cx="138" cy="150" r="76" fill="#111827"/>
  <path d="M94 178l44-92 44 92h-36l-8-20h-38l-8 20z" fill="#66f5d7"/>
  <text x="250" y="172" font-family="Inter, Arial, sans-serif" font-size="86" font-weight="900" fill="#111827">MOTIONFORGE</text>
</svg>`);
  }

  if (kind === "sticker") {
    return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="460" viewBox="0 0 640 460">
  <path d="M122 132c24-70 110-98 188-62 94-58 228-8 238 103 90 38 68 170-24 194-24 74-137 80-201 38-77 54-194 18-206-66-92-21-89-158 5-207z" fill="#fff7ed"/>
  <path d="M134 136c22-58 100-80 172-42 86-59 207-10 217 91 84 33 60 146-22 163-20 64-123 68-178 27-67 50-173 14-182-61-76-18-80-134-7-178z" fill="#fb7185"/>
  <text x="113" y="248" font-family="Inter, Arial, sans-serif" font-size="92" font-weight="900" fill="#ffffff" transform="rotate(-7 320 230)">SHIP IT</text>
  <circle cx="474" cy="126" r="26" fill="#ffd166"/>
</svg>`);
  }

  if (kind === "product") {
    return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="960" viewBox="0 0 1600 960">
  <defs>
    <linearGradient id="screen" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#f8fafc"/>
      <stop offset="0.52" stop-color="#dbeafe"/>
      <stop offset="1" stop-color="#ccfbf1"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="960" rx="72" fill="#0f172a"/>
  <rect x="70" y="70" width="1460" height="820" rx="46" fill="url(#screen)"/>
  <rect x="146" y="150" width="440" height="86" rx="24" fill="#111827"/>
  <rect x="146" y="292" width="1020" height="48" rx="24" fill="#38bdf8"/>
  <rect x="146" y="386" width="840" height="48" rx="24" fill="#34d399"/>
  <rect x="146" y="480" width="1120" height="48" rx="24" fill="#fb7185"/>
  <rect x="146" y="634" width="1308" height="166" rx="36" fill="rgba(15,23,42,0.12)"/>
  <circle cx="1340" cy="198" r="78" fill="#ffd166"/>
</svg>`);
  }

  if (kind === "portrait") {
    return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="960" viewBox="0 0 640 960">
  <rect width="640" height="960" fill="#102a43"/>
  <circle cx="320" cy="292" r="132" fill="#fde68a"/>
  <path d="M166 846c18-198 96-298 154-298s136 100 154 298z" fill="#66f5d7"/>
  <path d="M184 282c22-122 84-178 136-178s114 56 136 178c-68-42-204-42-272 0z" fill="#111827"/>
  <rect x="126" y="664" width="388" height="88" rx="44" fill="#ffffff" opacity="0.26"/>
</svg>`);
  }

  return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="360" viewBox="0 0 720 360">
  <rect width="720" height="360" rx="180" fill="#ffd166"/>
  <rect x="54" y="54" width="612" height="252" rx="126" fill="#111827"/>
  <text x="360" y="214" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="88" font-weight="900" fill="#ffd166">BETA</text>
</svg>`);
}

function imageStressProofCard(
  id: string,
  label: string,
  detail: string,
  left: number,
  top: number,
  accent: string,
  zIndex?: number,
): SceneNode {
  return {
    id,
    type: "div",
    style: {
      position: "absolute",
      left,
      top,
      width: 448,
      height: 154,
      padding: 22,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      backgroundColor: "rgba(15,23,42,0.76)",
      border: `2px solid ${accent}`,
      borderRadius: 22,
      boxShadow: "0 18px 46px rgba(2,6,23,0.28)",
      overflow: "hidden",
      ...(zIndex === undefined ? {} : { zIndex }),
    },
    children: [
      {
        id: `${id}-label`,
        type: "text",
        text: label,
        style: {
          width: "100%",
          height: 30,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: 2,
          color: accent,
          textAlign: "left",
          overflow: "hidden",
          textFit: "truncate",
          textOverflow: "ellipsis",
          maxLines: 1,
          minFontSize: 14,
        },
      },
      {
        id: `${id}-detail`,
        type: "text",
        text: detail,
        style: {
          width: "100%",
          height: 70,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 27,
          fontWeight: 780,
          lineHeight: 1.1,
          color: "#f8fafc",
          textAlign: "left",
          overflow: "hidden",
          textFit: "shrink",
          textOverflow: "ellipsis",
          maxLines: 2,
          minFontSize: 17,
        },
      },
    ],
  };
}

const VIDEO_OVERLAY_SOURCE_MP4_BASE64 = [
  "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",
  "7wewAAAACmHgCMARnIDvB7A=",
].join("");

export function videoOverlaySourceDataUrl(): string {
  return `data:video/mp4;base64,${VIDEO_OVERLAY_SOURCE_MP4_BASE64}`;
}

export function imageOverlayStressGalleryScene(): Scene {
  const width = 1080;
  const height = 1920;
  const fps = 30;
  const duration = 120;

  return parseScene({
    schemaVersion: 1,
    width,
    height,
    fps,
    duration,
    assets: {
      "image-logo-square": {
        id: "image-logo-square",
        type: "image",
        src: imageOverlayAssetSvg("logo"),
      },
      "image-watermark-wide": {
        id: "image-watermark-wide",
        type: "image",
        src: imageOverlayAssetSvg("watermark"),
      },
      "image-sticker-transparent": {
        id: "image-sticker-transparent",
        type: "image",
        src: imageOverlayAssetSvg("sticker"),
      },
      "image-product-wide": {
        id: "image-product-wide",
        type: "image",
        src: imageOverlayAssetSvg("product"),
      },
      "image-portrait-tall": {
        id: "image-portrait-tall",
        type: "image",
        src: imageOverlayAssetSvg("portrait"),
      },
      "image-badge-oversized": {
        id: "image-badge-oversized",
        type: "image",
        src: imageOverlayAssetSvg("badge"),
      },
    },
    nodes: [
      {
        id: "image-stress-background",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(180deg, #08111f 0%, #102a43 45%, #172033 100%)",
        },
      },
      {
        id: "image-stress-stage",
        type: "div",
        style: {
          position: "absolute",
          left: 72,
          top: 296,
          width: 936,
          height: 960,
          border: "2px solid rgba(125,211,252,0.32)",
          borderRadius: 32,
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)",
          boxShadow: "0 30px 80px rgba(2,6,23,0.38)",
          overflow: "hidden",
        },
      },
      {
        id: "image-stress-title",
        type: "text",
        text: "Image Overlay Stress Gallery",
        style: {
          position: "absolute",
          left: 72,
          right: 72,
          top: 76,
          height: 86,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 58,
          fontWeight: 900,
          color: "#ffffff",
          textAlign: "center",
          textShadow: "0 14px 38px rgba(0,0,0,0.45)",
          overflow: "hidden",
          textFit: "shrink",
          textOverflow: "ellipsis",
          maxLines: 1,
          minFontSize: 34,
        },
      },
      {
        id: "image-stress-subtitle",
        type: "text",
        text: "Safe-area logos, watermarks, transparent stickers, product shots, circular avatars, and oversized badges as ordinary image nodes.",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 168,
          height: 88,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 28,
          fontWeight: 720,
          lineHeight: 1.18,
          color: "#bae6fd",
          textAlign: "center",
          overflow: "hidden",
          textFit: "shrink",
          textOverflow: "ellipsis",
          maxLines: 2,
          minFontSize: 18,
        },
      },
      imageStressProofCard(
        "image-stress-card-logo",
        "LOGO BUG",
        "square asset, safe-area top-right",
        96,
        1328,
        "#66f5d7",
      ),
      imageStressProofCard(
        "image-stress-card-product",
        "PRODUCT SHOT",
        "wide source, contained center crop",
        536,
        1328,
        "#ffd166",
      ),
      imageStressProofCard(
        "image-stress-card-avatar",
        "AVATAR + BADGE",
        "tall portrait and oversized pill crop",
        96,
        1510,
        "#fb7185",
      ),
      imageStressProofCard(
        "image-stress-card-sticker",
        "TRANSPARENT STICKER",
        "SVG alpha, opacity, object-fit rules",
        536,
        1510,
        "#a78bfa",
      ),
      {
        id: "image-stress-footer",
        type: "text",
        text: "Refresh: pnpm showcase:generate then render examples/generated/image-overlay-stress-gallery.json with @motionforge/golden.",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 1704,
          height: 70,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 24,
          fontWeight: 720,
          lineHeight: 1.18,
          color: "#dbeafe",
          textAlign: "center",
          overflow: "hidden",
          textFit: "shrink",
          textOverflow: "ellipsis",
          maxLines: 2,
          minFontSize: 16,
        },
      },
      imageOverlay({
        id: "image-stress-logo-bug",
        template: "logoBug",
        assetId: "image-logo-square",
        composition: { width, height },
        from: 0,
        duration,
        enter: false,
        style: {
          left: 782,
          top: 336,
          width: 150,
          height: 150,
        },
      }),
      imageOverlay({
        id: "image-stress-watermark",
        template: "watermark",
        assetId: "image-watermark-wide",
        composition: { width, height },
        from: 0,
        duration,
        enter: false,
        style: {
          left: 736,
          top: 1142,
          width: 224,
          height: 84,
        },
      }),
      imageOverlay({
        id: "image-stress-sticker",
        template: "sticker",
        assetId: "image-sticker-transparent",
        composition: { width, height },
        placement: "topLeft",
        from: 0,
        duration,
        enter: false,
        style: {
          left: 112,
          top: 340,
          width: 210,
          height: 150,
        },
      }),
      imageOverlay({
        id: "image-stress-product-shot",
        template: "productShot",
        assetId: "image-product-wide",
        composition: { width, height },
        from: 0,
        duration,
        enter: false,
        style: {
          left: 236,
          top: 566,
          width: 608,
          height: 372,
        },
      }),
      imageOverlay({
        id: "image-stress-avatar-badge",
        template: "avatarBadge",
        assetId: "image-portrait-tall",
        composition: { width, height },
        placement: "lowerThird",
        from: 0,
        duration,
        enter: false,
        style: {
          left: 128,
          top: 1050,
          width: 180,
          height: 180,
        },
      }),
      imageOverlay({
        id: "image-stress-corner-badge",
        template: "cornerBadge",
        assetId: "image-badge-oversized",
        composition: { width, height },
        placement: "bottomLeft",
        from: 0,
        duration,
        enter: false,
        style: {
          left: 122,
          top: 1136,
          width: 236,
          height: 112,
        },
        imageStyle: {
          objectFit: "cover",
          objectPosition: "center center",
        },
      }),
    ],
  });
}

export function videoOverlayStressGalleryScene(): Scene {
  const width = 1080;
  const height = 1920;
  const fps = 30;
  const duration = 120;
  const assetId = "video-overlay-source";

  return parseScene({
    schemaVersion: 1,
    width,
    height,
    fps,
    duration,
    assets: {
      [assetId]: {
        id: assetId,
        type: "video",
        src: videoOverlaySourceDataUrl(),
      },
    },
    nodes: [
      {
        id: "video-stress-background",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(180deg, #101820 0%, #244f46 48%, #1f2937 100%)",
        },
      },
      videoOverlay({
        id: "video-stress-background-loop",
        template: "backgroundLoop",
        assetId,
        composition: { width, height },
        from: 0,
        duration,
        trimStart: 0,
        playbackRate: 0.65,
        volume: 0,
        enter: false,
        opacity: 0.22,
        style: {
          left: 0,
          top: 0,
          width,
          height,
          borderRadius: 0,
          zIndex: 1,
        },
      }),
      {
        id: "video-stress-background-wash",
        type: "div",
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(180deg, rgba(16,24,32,0.58) 0%, rgba(31,41,55,0.7) 100%)",
          zIndex: 2,
        },
      },
      {
        id: "video-stress-stage",
        type: "div",
        style: {
          position: "absolute",
          left: 72,
          top: 304,
          width: 936,
          height: 980,
          border: "2px solid rgba(102,245,215,0.34)",
          borderRadius: 32,
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.035) 100%)",
          boxShadow: "0 30px 80px rgba(2,6,23,0.42)",
          overflow: "hidden",
          zIndex: 3,
        },
      },
      {
        id: "video-stress-title",
        type: "text",
        text: "Video Overlay Stress Gallery",
        style: {
          position: "absolute",
          left: 72,
          right: 72,
          top: 76,
          height: 86,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 58,
          fontWeight: 900,
          color: "#ffffff",
          textAlign: "center",
          textShadow: "0 14px 38px rgba(0,0,0,0.45)",
          overflow: "hidden",
          textFit: "shrink",
          textOverflow: "ellipsis",
          maxLines: 1,
          minFontSize: 34,
          zIndex: 8,
        },
      },
      {
        id: "video-stress-subtitle",
        type: "text",
        text: "Picture-in-picture, reaction cam, screen demo, muted background loop, b-roll strip, and video badge as ordinary video nodes.",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 168,
          height: 88,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 28,
          fontWeight: 720,
          lineHeight: 1.18,
          color: "#ccfbf1",
          textAlign: "center",
          overflow: "hidden",
          textFit: "shrink",
          textOverflow: "ellipsis",
          maxLines: 2,
          minFontSize: 18,
          zIndex: 8,
        },
      },
      imageStressProofCard(
        "video-stress-card-pip",
        "PIP",
        "muted top-right crop, trim 1s, 1.25x",
        96,
        1328,
        "#66f5d7",
        8,
      ),
      imageStressProofCard(
        "video-stress-card-screen",
        "SCREEN DEMO",
        "contained app surface with object-fit",
        536,
        1328,
        "#ffd166",
        8,
      ),
      imageStressProofCard(
        "video-stress-card-reaction",
        "REACTION AUDIO",
        "rounded speaker clip keeps volume 0.45",
        96,
        1510,
        "#fb7185",
        8,
      ),
      imageStressProofCard(
        "video-stress-card-broll",
        "B-ROLL + BADGE",
        "wide strip, badge crop, and silent defaults",
        536,
        1510,
        "#a78bfa",
        8,
      ),
      {
        id: "video-stress-footer",
        type: "text",
        text: "Render examples/generated/video-overlay-stress-gallery.json with @motionforge/golden.",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 1704,
          height: 70,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 24,
          fontWeight: 720,
          lineHeight: 1.18,
          color: "#dbeafe",
          textAlign: "center",
          overflow: "hidden",
          textFit: "shrink",
          textOverflow: "ellipsis",
          maxLines: 2,
          minFontSize: 16,
          zIndex: 8,
        },
      },
      videoOverlay({
        id: "video-stress-screen-demo",
        template: "screenDemo",
        assetId,
        composition: { width, height },
        from: 0,
        duration,
        trimStart: 0.25,
        playbackRate: 1,
        volume: 0,
        enter: false,
        objectFit: "contain",
        style: {
          left: 174,
          top: 510,
          width: 732,
          height: 412,
          border: "2px solid rgba(255,255,255,0.24)",
          borderRadius: 30,
          backgroundColor: "rgba(15,23,42,0.76)",
          zIndex: 4,
        },
      }),
      videoOverlay({
        id: "video-stress-pip",
        template: "pictureInPicture",
        assetId,
        composition: { width, height },
        from: 0,
        duration,
        trimStart: 1,
        playbackRate: 1.25,
        volume: 0,
        enter: false,
        style: {
          left: 700,
          top: 342,
          width: 244,
          height: 154,
          border: "3px solid rgba(255,255,255,0.86)",
          borderRadius: 24,
          zIndex: 6,
        },
      }),
      videoOverlay({
        id: "video-stress-reaction-cam",
        template: "reactionCam",
        assetId,
        composition: { width, height },
        from: 0,
        duration,
        trimStart: 1.5,
        playbackRate: 0.9,
        volume: 0.45,
        enter: false,
        style: {
          left: 732,
          top: 1000,
          width: 190,
          height: 190,
          border: "5px solid rgba(255,255,255,0.92)",
          borderRadius: 999,
          zIndex: 6,
        },
      }),
      videoOverlay({
        id: "video-stress-broll-strip",
        template: "brollStrip",
        assetId,
        composition: { width, height },
        from: 0,
        duration,
        trimStart: 0.75,
        playbackRate: 1.5,
        volume: 0,
        enter: false,
        objectPosition: "left center",
        style: {
          left: 154,
          top: 1088,
          width: 694,
          height: 138,
          border: "2px solid rgba(255,209,102,0.54)",
          borderRadius: 22,
          zIndex: 5,
        },
      }),
      videoOverlay({
        id: "video-stress-video-badge",
        template: "videoBadge",
        assetId,
        composition: { width, height },
        from: 0,
        duration,
        trimStart: 2,
        playbackRate: 1,
        volume: 0,
        enter: false,
        style: {
          left: 120,
          top: 354,
          width: 184,
          height: 108,
          border: "3px solid rgba(102,245,215,0.9)",
          borderRadius: 999,
          zIndex: 6,
        },
      }),
    ],
  });
}

/**
 * Synthesizes the audio-sync demo track as a WAV data URL: four beeps on a
 * 120 BPM grid (the last a fifth higher), 8 kHz mono 16-bit. Pure — the same
 * bytes every run, so the scene stays deterministic end-to-end.
 */
export function beatTrackDataUrl(): string {
  const rate = 8000;
  const seconds = 2;
  const samples = rate * seconds;
  const beats = [0, 0.5, 1, 1.5];
  const pcm = new Int16Array(samples);

  for (let i = 0; i < samples; i += 1) {
    const t = i / rate;
    let value = 0;

    beats.forEach((beat, index) => {
      const dt = t - beat;

      if (dt >= 0 && dt < 0.18) {
        const freq = index < 3 ? 880 : 1320;
        value += 0.6 * Math.exp(-dt * 22) * Math.sin(2 * Math.PI * freq * dt);
      }
    });

    pcm[i] = Math.round(Math.max(-1, Math.min(1, value)) * 32767);
  }

  const data = new Uint8Array(44 + pcm.length * 2);
  const view = new DataView(data.buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      data[offset + i] = text.charCodeAt(i);
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeAscii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  new Int16Array(data.buffer, 44).set(pcm);

  let binary = "";
  for (let i = 0; i < data.length; i += 1) {
    binary += String.fromCharCode(data[i] ?? 0);
  }

  return `data:audio/wav;base64,${btoa(binary)}`;
}

export function audioSyncPulseScene(): Scene {
  // One pulse animation: a fast 1-frame rise into each beat, then an eased
  // decay — the visual must land exactly on the audible beat (frames 0, 15,
  // 30, 45 at 30 fps over the 120 BPM track).
  const pulse = (peak: number): SceneNode["animations"] => [
    {
      kind: "keyframes",
      property: "transform",
      frames: [
        { frame: 0, value: `scale(${peak})` },
        { frame: 6, value: "scale(1)", easing: "easeOut" },
        { frame: 14, value: "scale(1)" },
        { frame: 15, value: `scale(${peak})` },
        { frame: 21, value: "scale(1)", easing: "easeOut" },
        { frame: 29, value: "scale(1)" },
        { frame: 30, value: `scale(${peak})` },
        { frame: 36, value: "scale(1)", easing: "easeOut" },
        { frame: 44, value: "scale(1)" },
        { frame: 45, value: `scale(${peak + 0.15})` },
        { frame: 52, value: "scale(1)", easing: "easeOut" },
      ],
    },
  ];

  const beatDot = (index: number): SceneNode => ({
    id: `beat-dot-${index + 1}`,
    type: "div",
    from: 0,
    duration: 60,
    style: {
      position: "absolute",
      left: 240 + index * 70,
      top: 560,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#22303d",
    },
    animations: [
      {
        kind: "keyframes",
        property: "backgroundColor",
        frames: [
          ...(index === 0
            ? []
            : [{ frame: index * 15 - 1, value: "#22303d" }]),
          { frame: index * 15, value: index === 3 ? "#ffd166" : "#66f5d7" },
          { frame: index * 15 + 10, value: "#22303d", easing: "easeOut" },
        ],
      },
    ],
    children: [],
  });

  return parseScene({
    schemaVersion: 1,
    width: 720,
    height: 720,
    fps: 30,
    duration: 60,
    assets: {
      beats: { id: "beats", type: "audio", src: beatTrackDataUrl() },
    },
    nodes: [
      {
        id: "background",
        type: "div",
        from: 0,
        duration: 60,
        style: {
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #0b1118 0%, #16222e 100%)",
        },
        children: [],
      },
      {
        id: "pulse-ring",
        type: "div",
        from: 0,
        duration: 60,
        style: {
          position: "absolute",
          left: 210,
          top: 170,
          width: 300,
          height: 300,
          borderRadius: 150,
          border: "10px solid #66f5d7",
          backgroundColor: "rgba(102, 245, 215, 0.08)",
        },
        animations: pulse(1.22),
        children: [],
      },
      {
        id: "pulse-core",
        type: "div",
        from: 0,
        duration: 60,
        style: {
          position: "absolute",
          left: 305,
          top: 265,
          width: 110,
          height: 110,
          borderRadius: 55,
          backgroundColor: "#66f5d7",
          boxShadow: "0 0 60 rgba(102, 245, 215, 0.9)",
        },
        animations: pulse(1.35),
        children: [],
      },
      {
        id: "sync-caption",
        type: "text",
        text: "PREVIEW AND EXPORT SHARE THIS MIX",
        from: 0,
        duration: 60,
        style: {
          position: "absolute",
          left: 60,
          right: 60,
          top: 622,
          // Absolute text needs an explicit height: auto height fills the
          // parent and the vertically-centered line block lands off-box.
          height: 36,
          fontSize: 24,
          color: "#9fb3c8",
          textAlign: "center",
          letterSpacing: 2,
        },
        children: [],
      },
      ...[0, 1, 2, 3].map(beatDot),
      {
        id: "beat-audio",
        type: "audio",
        assetId: "beats",
        from: 0,
        duration: 60,
      },
    ],
  });
}

/**
 * A hand-written, self-contained Lottie document: a pulsing teal ring behind
 * a spinning gold star. 90 frames @ 30 fps, 400x400 — vectors only, no
 * expressions, exactly what the determinism guards accept.
 */
export function lottieBadgeDataUrl(): string {
  const doc = {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: 90,
    w: 400,
    h: 400,
    nm: "badge",
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: "star",
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: {
            a: 1,
            k: [
              { t: 0, s: [0], e: [360], i: { x: [0.4], y: [0.4] }, o: { x: [0.6], y: [0.6] } },
              { t: 90, s: [360] },
            ],
          },
          p: { a: 0, k: [200, 200, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        ao: 0,
        shapes: [
          {
            ty: "gr",
            nm: "star-group",
            it: [
              {
                ty: "sr",
                nm: "star-shape",
                sy: 1,
                d: 1,
                pt: { a: 0, k: 5 },
                p: { a: 0, k: [0, 0] },
                r: { a: 0, k: 0 },
                ir: { a: 0, k: 45 },
                is: { a: 0, k: 0 },
                or: { a: 0, k: 100 },
                os: { a: 0, k: 0 },
              },
              { ty: "fl", nm: "fill", c: { a: 0, k: [1, 0.82, 0.4, 1] }, o: { a: 0, k: 100 } },
              { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
            ],
          },
        ],
        ip: 0,
        op: 90,
        st: 0,
      },
      {
        ddd: 0,
        ind: 2,
        ty: 4,
        nm: "ring",
        sr: 1,
        ks: {
          o: { a: 0, k: 60 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [200, 200, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: {
            a: 1,
            k: [
              { t: 0, s: [80, 80, 100], e: [110, 110, 100], i: { x: [0.4], y: [0.4] }, o: { x: [0.6], y: [0.6] } },
              { t: 45, s: [110, 110, 100], e: [80, 80, 100], i: { x: [0.4], y: [0.4] }, o: { x: [0.6], y: [0.6] } },
              { t: 90, s: [80, 80, 100] },
            ],
          },
        },
        ao: 0,
        shapes: [
          {
            ty: "gr",
            nm: "ring-group",
            it: [
              { ty: "el", nm: "circle", d: 1, s: { a: 0, k: [320, 320] }, p: { a: 0, k: [0, 0] } },
              { ty: "st", nm: "stroke", c: { a: 0, k: [0.4, 0.96, 0.84, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 16 }, lc: 2, lj: 2 },
              { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
            ],
          },
        ],
        ip: 0,
        op: 90,
        st: 0,
      },
    ],
  };

  return `data:application/json,${encodeURIComponent(JSON.stringify(doc))}`;
}

export function lottieStickerScene(): Scene {
  return parseScene({
    schemaVersion: 1,
    width: 720,
    height: 720,
    fps: 30,
    duration: 90,
    assets: {
      badge: { id: "badge", type: "lottie", src: lottieBadgeDataUrl() },
    },
    nodes: [
      {
        id: "background",
        type: "div",
        from: 0,
        duration: 90,
        style: {
          width: "100%",
          height: "100%",
          background: "linear-gradient(160deg, #101820 0%, #1d2c3a 100%)",
        },
        children: [],
      },
      {
        id: "badge-main",
        type: "lottie",
        assetId: "badge",
        from: 0,
        duration: 90,
        style: {
          position: "absolute",
          left: 180,
          top: 120,
          width: 360,
          height: 360,
          objectFit: "contain",
        },
        children: [],
      },
      {
        id: "badge-echo",
        type: "lottie",
        assetId: "badge",
        playbackRate: 2,
        from: 0,
        duration: 90,
        style: {
          position: "absolute",
          left: 60,
          top: 480,
          width: 140,
          height: 140,
          objectFit: "contain",
          opacity: 0.55,
        },
        children: [],
      },
      {
        id: "lottie-caption",
        type: "text",
        text: "LOTTIE FILES AS TIMELINE CITIZENS",
        from: 0,
        duration: 90,
        style: {
          position: "absolute",
          left: 60,
          right: 60,
          top: 622,
          height: 36,
          fontSize: 24,
          color: "#9fb3c8",
          textAlign: "center",
          letterSpacing: 2,
        },
        children: [],
      },
    ],
  });
}

export const showcaseScenes: ShowcaseScene[] = [
  {
    id: "intro",
    title: "Engine Intro",
    description:
      "A compact JSON scene with gradients, image assets, text, and opacity keyframes.",
    proves: ["Canvas2D preview", "image assets", "keyframes", "MP4 export"],
    scene: introScene(),
    posterFrame: 40,
  },
  {
    id: "tiktok-captions",
    title: "TikTok Captions",
    description:
      "ASR word timestamps compiled into one-word captions with spring pops, strokes, and measured highlight pills.",
    proves: [
      "caption presets",
      "transform tweens",
      "text stroke",
      "fitted text backgrounds",
    ],
    scene: tiktokCaptionScene(),
    posterFrame: 60,
  },
  {
    id: "karaoke-captions",
    title: "Karaoke Captions",
    description:
      "A full-line caption preset where each word color-ramp follows its spoken timestamp.",
    proves: [
      "ASR timing",
      "color interpolation",
      "spring easing",
      "multi-word layout",
    ],
    scene: karaokeCaptionScene(),
    posterFrame: 78,
  },
  {
    id: "launch-info-display",
    title: "Launch Info Display",
    description:
      "A prompt-to-video style launch screen with animated panels, scan lines, a progress bar, and countdown timing.",
    proves: [
      "prompt-shaped scenes",
      "timed panels",
      "transform tweens",
      "progress motion",
    ],
    scene: launchInfoDisplayScene(),
    posterFrame: 132,
  },
  {
    id: "timed-text-overlay",
    title: "Timed Text Overlay",
    description:
      "A written timing prompt translated into exact scene nodes: first 5 seconds top-center text, final 10 seconds bottom-right text.",
    proves: [
      "text overlays",
      "frame-accurate timing",
      "absolute placement",
      "color styling",
    ],
    scene: timedTextOverlayScene(),
    posterFrame: 210,
  },
  {
    id: "text-stress-gallery",
    title: "Text Stress Gallery",
    description:
      "A single scene that stresses bounded text layout with long Latin, URLs, CJK, emoji, long single tokens, and multiline captions.",
    proves: [
      "textFit shrink",
      "maxLines ellipsis",
      "CJK and emoji text",
      "long-token wrapping",
    ],
    scene: textStressGalleryScene(),
    posterFrame: 30,
  },
  {
    id: "subtitle-stress-gallery",
    title: "Subtitle Stress Gallery",
    description:
      "A timed subtitle stress scene covering SRT, WebVTT, long Latin, URLs, CJK, emoji, and fast cue changes.",
    proves: [
      "SRT and WebVTT parsing",
      "bounded subtitle tracks",
      "multilingual subtitle text",
      "fast cue timing",
    ],
    scene: subtitleStressGalleryScene(),
    posterFrame: 90,
  },
  {
    id: "image-overlay-stress-gallery",
    title: "Image Overlay Stress Gallery",
    description:
      "A self-contained image overlay scene covering logos, watermarks, transparent stickers, product shots, avatars, and oversized badges.",
    proves: [
      "image overlay presets",
      "safe-area placement",
      "object fit and crop",
      "SVG image assets",
    ],
    scene: imageOverlayStressGalleryScene(),
    posterFrame: 45,
  },
  {
    id: "video-overlay-stress-gallery",
    title: "Video Overlay Stress Gallery",
    description:
      "A self-contained video overlay scene covering picture-in-picture, reaction cam, screen demo, background loop, b-roll strip, and video badge presets.",
    proves: [
      "video overlay presets",
      "trim and playback rate",
      "muted and audible volume",
      "object fit and rounded crop",
    ],
    scene: videoOverlayStressGalleryScene(),
    posterFrame: 45,
  },
  {
    id: "audio-sync-pulse",
    title: "Audio Sync Pulse",
    description:
      "A synthesized four-beat track with visuals locked to the audible beats — hear it in preview, keep it in the export.",
    proves: [
      "audio preview",
      "beat-locked keyframes",
      "WAV data URLs",
      "AAC export mix",
    ],
    scene: audioSyncPulseScene(),
    posterFrame: 15,
  },
  {
    id: "lottie-sticker",
    title: "Lottie Sticker",
    description:
      "A self-contained vector Lottie document (spinning star, pulsing ring) seeked frame-exactly — the same asset twice at different playback rates.",
    proves: [
      "lottie node",
      "frame-exact seek",
      "playbackRate",
      "deterministic vectors",
    ],
    scene: lottieStickerScene(),
    posterFrame: 30,
  },
];

export function findShowcaseScene(id: string): ShowcaseScene | undefined {
  return showcaseScenes.find((entry) => entry.id === id);
}
