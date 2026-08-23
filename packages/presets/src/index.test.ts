import { describe, expect, it } from "vitest";
import { validateScene, type Scene, type SceneNode } from "@motionforge/schema";
import {
  audioFadeEnvelope,
  fadeUp,
  clipLayout,
  clipLayoutEntries,
  clipLayouts,
  captionTemplateEntries,
  captionTemplates,
  imageOverlay,
  imageOverlayTemplateEntries,
  imageOverlayTemplates,
  karaokeCaptions,
  audioOverlay,
  audioOverlayTemplateEntries,
  audioOverlayTemplates,
  mediaLook,
  mediaLookEntries,
  mediaLooks,
  popIn,
  parseSrt,
  parseVtt,
  resolveSafeArea,
  safeAreaBox,
  safeAreaProfiles,
  pulse,
  slideIn,
  styledCaptions,
  styledSubtitles,
  subtitleTrack,
  subtitleTemplates,
  textOverlay,
  textOverlayTemplateEntries,
  textOverlayTemplates,
  tiktokCaptions,
  transitionTemplateEntries,
  transitionTemplates,
  transitionOverlay,
  videoOverlay,
  videoOverlayTemplateEntries,
  videoOverlayTemplates,
  type CaptionWord,
  type TextOverlayTemplateKey,
} from "./index.js";

function sceneWith(...nodes: SceneNode[]): Scene {
  const assets: Scene["assets"] = {};
  const collectAssets = (items: SceneNode[]): void => {
    for (const node of items) {
      if (node.assetId) {
        const type =
          node.type === "img"
            ? "image"
            : node.type === "video"
              ? "video"
              : node.type === "audio"
                ? "audio"
                : node.type === "lottie"
                  ? "lottie"
                  : null;
        if (type) {
          assets[node.assetId] = {
            id: node.assetId,
            type,
            src: `${node.assetId}.${type}`,
          };
        }
      }
      if (node.params?.audioAssetId) {
        assets[node.params.audioAssetId] = {
          id: node.params.audioAssetId,
          type: "audio",
          src: `${node.params.audioAssetId}.audio`,
        };
      }
      if (node.params?.coverAssetId) {
        assets[node.params.coverAssetId] = {
          id: node.params.coverAssetId,
          type: "image",
          src: `${node.params.coverAssetId}.image`,
        };
      }
      collectAssets(node.children ?? []);
    }
  };
  collectAssets(nodes);

  return {
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 180,
    assets,
    nodes: [
      {
        id: "background",
        type: "div",
        style: { width: "100%", height: "100%", backgroundColor: "#101820" },
      },
      ...nodes,
    ],
  } as Scene;
}

const words: CaptionWord[] = [
  { word: "FORGE", startMs: 800, endMs: 1600 },
  { word: "MOTION", startMs: 1600, endMs: 2400 },
  { word: "IN", startMs: 2400, endMs: 3200 },
  { word: "THE", startMs: 3200, endMs: 4000 },
  { word: "BROWSER", startMs: 4000, endMs: 5000 },
];

describe("motion presets", () => {
  it("emit schema-valid, strictly increasing keyframes", () => {
    const node: SceneNode = {
      id: "box",
      type: "div",
      style: { width: 100, height: 100 },
      animations: [
        ...popIn(),
        ...fadeUp({ delay: 6 }),
        ...slideIn("left", { distance: 200 }),
        ...pulse({ peak: 1.2 }),
      ],
    };

    const result = validateScene(sceneWith(node));
    expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
  });

  it("delay holds the starting value from frame 0", () => {
    const [transform] = fadeUp({ delay: 8, durationInFrames: 10 });

    expect(transform?.frames[0]).toEqual({
      frame: 0,
      value: "translate(0px, 40px)",
    });
    expect(transform?.frames[1]?.frame).toBe(8);
    expect(transform?.frames[2]?.frame).toBe(18);
  });

  it("popIn uses transform tweens, not fontSize workarounds", () => {
    const animations = popIn({ fromScale: 0.5, durationInFrames: 8 });
    const transform = animations.find(
      (entry) => entry.property === "transform",
    );

    expect(transform?.frames[0]?.value).toBe("scale(0.5)");
    expect(transform?.frames[1]).toMatchObject({
      frame: 8,
      value: "scale(1)",
      easing: "spring(0.3)",
    });
  });
});

describe("media look presets", () => {
  it("exposes stable media look metadata", () => {
    expect(mediaLookEntries.map(([key]) => key)).toEqual([
      "cleanProduct",
      "punchySocial",
      "cinematicWarm",
      "coolNoir",
      "retroTape",
      "softPortrait",
      "blurredBackdrop",
    ]);
    expect(mediaLooks.cinematicWarm.category).toBe("cinematic");
  });

  it("returns schema-valid styles for image and video nodes", () => {
    for (const [key] of mediaLookEntries) {
      const result = validateScene({
        schemaVersion: 1,
        width: 1080,
        height: 1920,
        fps: 30,
        duration: 90,
        assets: {
          media: { id: "media", type: "image", src: "data:image/png;base64,x" },
        },
        nodes: [
          {
            id: `media-${key}`,
            type: "img",
            assetId: "media",
            style: {
              width: "100%",
              height: "100%",
              ...mediaLook(key),
            },
          },
        ],
      });

      expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
    }
  });

  it("allows style overrides after the named look", () => {
    expect(
      mediaLook("blurredBackdrop", {
        opacity: 0.82,
        filter: "brightness(0.8) blur(12px)",
      }),
    ).toEqual({
      filter: "brightness(0.8) blur(12px)",
      opacity: 0.82,
    });
  });
});

describe("safe-area placement primitives", () => {
  it("exposes named safe-area profiles for common aspect ratios", () => {
    expect(Object.keys(safeAreaProfiles)).toEqual([
      "vertical",
      "square",
      "landscape",
    ]);
    expect(resolveSafeArea({ width: 1080, height: 1920 }, "auto")).toEqual({
      top: 144,
      right: 72,
      bottom: 163,
      left: 72,
    });
    expect(resolveSafeArea({ width: 1080, height: 1080 }, "auto")).toEqual({
      top: 72,
      right: 72,
      bottom: 72,
      left: 72,
    });
    expect(resolveSafeArea({ width: 1920, height: 1080 }, "auto")).toEqual({
      top: 65,
      right: 96,
      bottom: 65,
      left: 96,
    });
  });

  it("builds anchored boxes from safe areas", () => {
    expect(safeAreaBox({ width: 1080, height: 1920 }, "lowerThird")).toEqual({
      position: "absolute",
      left: 72,
      top: 1239,
      width: 693,
      height: 288,
    });
    expect(safeAreaBox({ width: 1920, height: 1080 }, "statCallout")).toEqual({
      position: "absolute",
      left: 1098,
      top: 324,
      width: 726,
      height: 194,
    });
    expect(
      safeAreaBox({ width: 1080, height: 1080 }, "bottom", {
        safeArea: false,
        widthRatio: 0.5,
        align: "right",
      }),
    ).toEqual({
      position: "absolute",
      left: 540,
      top: 950,
      width: 540,
      height: 130,
    });
  });

  it("allows explicit safe-area insets and offsets", () => {
    expect(
      safeAreaBox({ width: 1080, height: 1920 }, "title", {
        safeArea: { x: 96, y: 120 },
        widthRatio: 0.5,
        offsetY: 12,
      }),
    ).toEqual({
      position: "absolute",
      left: 318,
      top: 228,
      width: 444,
      height: 346,
    });
  });
});

describe("clip layout presets", () => {
  it("exposes stable clip layout metadata", () => {
    expect(clipLayoutEntries.map(([key]) => key)).toEqual([
      "fullscreen",
      "containCenter",
      "pictureInPicture",
      "splitLeft",
      "splitRight",
      "gridTopLeft",
      "gridTopRight",
      "gridBottomLeft",
      "gridBottomRight",
      "blurredBackground",
      "phoneSafeVertical",
    ]);
    expect(clipLayouts.pictureInPicture.category).toBe("pip");
  });

  it("returns schema-valid styles for media nodes", () => {
    for (const [key] of clipLayoutEntries) {
      const result = validateScene({
        schemaVersion: 1,
        width: 1080,
        height: 1920,
        fps: 30,
        duration: 90,
        assets: {
          clip: { id: "clip", type: "video", src: "clip.mp4" },
        },
        nodes: [
          {
            id: `clip-${key}`,
            type: "video",
            assetId: "clip",
            style: clipLayout(key),
          },
        ],
      });

      expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
    }
  });

  it("allows style overrides after the named layout", () => {
    expect(
      clipLayout("pictureInPicture", {
        right: 72,
        bottom: 96,
        width: 420,
      }),
    ).toMatchObject({
      right: 72,
      bottom: 96,
      width: 420,
      height: 640,
      zIndex: 20,
    });
  });
});

describe("transition overlays", () => {
  it("exposes stable transition metadata", () => {
    expect(transitionTemplateEntries.map(([key]) => key)).toEqual([
      "fade",
      "dipToBlack",
      "flash",
      "wipeLeft",
      "wipeRight",
      "zoom",
    ]);
    expect(transitionTemplates.flash.category).toBe("energy");
  });

  it("generates schema-valid overlays for every transition", () => {
    for (const [template] of transitionTemplateEntries) {
      const node = transitionOverlay(template, {
        id: `transition-${template}`,
        at: 45,
        duration: 18,
      });
      const result = validateScene(sceneWith(node));

      expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
      expect(node).toMatchObject({ from: 45, duration: 18 });
    }
  });

  it("supports color and z-index overrides", () => {
    const node = transitionOverlay("flash", {
      color: "rgba(255,255,255,0.92)",
      zIndex: 2000,
    });

    expect(node.style).toMatchObject({
      backgroundColor: "rgba(255,255,255,0.92)",
      zIndex: 2000,
    });
  });
});

describe("tiktokCaptions", () => {
  // The acceptance test from the roadmap: the TikTok example's caption track,
  // regenerated from a handful of lines instead of ~300 lines of JSON.
  const captions = tiktokCaptions(words, {
    fps: 30,
    highlightIndices: [1, 4],
    area: { top: 760, height: 360 },
  });

  it("produces a schema-valid caption track", () => {
    const result = validateScene(sceneWith(captions));
    expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
  });

  it("maps millisecond timing onto frames", () => {
    const children = captions.children ?? [];

    expect(children).toHaveLength(5);
    // 800ms at 30fps -> frame 24; held until the next word at 1600ms -> 24 frames.
    expect(children[0]).toMatchObject({ from: 24, duration: 24 });
    // Last word runs to its own endMs: 4000ms -> 120, 5000ms -> 150.
    expect(children[4]).toMatchObject({ from: 120, duration: 30 });
  });

  it("adds fitted backgrounds and strokes to highlighted words", () => {
    const children = captions.children ?? [];
    const highlighted = children[1]?.children?.[0];
    const plain = children[0]?.children?.[0];

    expect(highlighted?.id).toBe("caption-w1-text");
    expect(highlighted?.style?.color).toBe("#ffd166");
    expect(highlighted?.style?.textStroke).toBe("8px #000000");
    expect(highlighted?.style?.textBackgroundColor).toBe(
      "rgba(255, 209, 102, 0.16)",
    );
    expect(highlighted?.style?.textBackgroundPaddingX).toBe(56);
    expect(highlighted?.style?.textBackgroundPaddingY).toBe(25);
    expect(highlighted?.style?.textBackgroundRadius).toBe(36);
    expect(plain?.id).toBe("caption-w0-text");
    expect(plain?.style?.color).toBe("#ffffff");
    expect(plain?.style?.textStroke).toBe("8px #000000");
    expect(plain?.style?.textBackgroundColor).toBeUndefined();
  });
});

describe("karaokeCaptions", () => {
  const line = karaokeCaptions(words, { fps: 30 });

  it("produces a schema-valid line spanning the spoken range", () => {
    const result = validateScene(sceneWith(line));

    expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
    expect(line.from).toBe(24);
    expect(line.duration).toBe(126);
  });

  it("ramps each word to the highlight color during its span", () => {
    const second = line.children?.[1];
    const colors = second?.animations?.[0]?.frames ?? [];

    // Word 1: 1600ms -> line-local frame 24, end 2400ms -> 48.
    expect(colors.map((frame) => [frame.frame, frame.value])).toEqual([
      [0, "#ffffff"],
      [22, "#ffffff"],
      [24, "#ffd166"],
      [48, "#ffd166"],
      [50, "#ffffff"],
    ]);
    expect(second?.style?.textStroke).toBe("8px #000000");
  });
});

describe("caption template catalog", () => {
  it("exposes community subtitle templates with stable metadata", () => {
    expect(captionTemplateEntries.map(([key]) => key)).toEqual([
      "classic",
      "minimalBar",
      "handwritten",
      "retro",
      "cinematic",
      "storyteller",
      "hustle",
      "spotlight",
      "karaoke",
      "neon",
      "future",
      "terminal",
      "colorShift",
    ]);
    expect(subtitleTemplates).toBe(captionTemplates);
  });

  it("generates schema-valid styled captions for every template", () => {
    for (const [key] of captionTemplateEntries) {
      const captions = styledCaptions(words, {
        fps: 30,
        template: key,
        idPrefix: `community-${key}`,
      });
      const result = validateScene(sceneWith(captions));

      expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
    }
  });

  it("segments static subtitle templates into readable line captions", () => {
    const captions = styledSubtitles(words, {
      fps: 30,
      template: "classic",
      maxWordsPerSegment: 2,
      idPrefix: "classic-demo",
    });

    expect(captions.children).toHaveLength(3);
    expect(captions.children?.[0]).toMatchObject({ from: 24, duration: 48 });
    expect(captions.children?.[0]?.children?.[0]?.text).toBe("FORGE MOTION");
    expect(captions.children?.[2]?.children?.[0]?.text).toBe("BROWSER");
  });

  it("adds animated active-word backgrounds for karaoke-style templates", () => {
    const captions = styledCaptions(words, {
      fps: 30,
      template: "karaoke",
      idPrefix: "karaoke-demo",
    });
    const firstSegment = captions.children?.[0];
    const firstWord = firstSegment?.children?.[0];

    expect(firstSegment?.type).toBe("div");
    expect(firstWord?.type).toBe("text");
    expect(firstWord?.style?.textBackgroundColor).toBe("rgba(236, 72, 153, 0)");
    expect(
      firstWord?.animations?.some((entry) => entry.property === "color"),
    ).toBe(true);
    expect(
      firstWord?.animations?.some(
        (entry) => entry.property === "textBackgroundColor",
      ),
    ).toBe(true);
  });

  it("highlights color-shift captions with pink text and no word background", () => {
    const captions = styledCaptions(words, {
      fps: 30,
      template: "colorShift",
      idPrefix: "color-shift-demo",
    });
    const firstWord = captions.children?.[0]?.children?.[0];
    const colorAnimation = firstWord?.animations?.find(
      (entry) => entry.property === "color",
    );

    expect(firstWord?.style?.color).toBe("#ffffff");
    expect(firstWord?.style?.textBackgroundColor).toBeUndefined();
    expect(
      colorAnimation?.frames.some((frame) => frame.value === "#ff4fa3"),
    ).toBe(true);
    expect(
      firstWord?.animations?.some(
        (entry) => entry.property === "textBackgroundColor",
      ),
    ).toBe(false);
  });

  it("keeps one-word punch templates compatible with tiktok-style timing", () => {
    const captions = styledCaptions(words, {
      fps: 30,
      template: "hustle",
      idPrefix: "hustle-demo",
    });
    const children = captions.children ?? [];
    const firstText = children[0]?.children?.[0];

    expect(children).toHaveLength(words.length);
    expect(children[0]).toMatchObject({ from: 24, duration: 24 });
    expect(firstText?.style?.textBackgroundColor).toBe("#ff3b30");
    expect(
      firstText?.animations?.some((entry) => entry.property === "transform"),
    ).toBe(true);
  });

  it("builds schema-valid segment subtitle tracks", () => {
    const track = subtitleTrack(
      [
        {
          text: "First subtitle line",
          startSeconds: 0.5,
          endSeconds: 1.7,
        },
        {
          text: "Second subtitle line\nwith an explicit break",
          startMs: 1800,
          endMs: 3200,
        },
      ],
      {
        fps: 30,
        idPrefix: "manual-subtitles",
        template: "minimalBar",
      },
    );

    expect(validateScene(sceneWith(track))).toMatchObject({ ok: true });
    expect(track).toMatchObject({
      id: "manual-subtitles",
      style: {
        position: "absolute",
        left: 0,
        width: "100%",
        top: "72%",
        height: "16%",
      },
    });
    expect(track.children?.[0]).toMatchObject({ from: 15, duration: 36 });
    expect(track.children?.[1]).toMatchObject({ from: 54, duration: 42 });
    expect(track.children?.[1]?.children?.[0]).toMatchObject({
      id: "manual-subtitles-s1-text",
      text: "Second subtitle line\nwith an explicit break",
      style: {
        overflow: "hidden",
        textFit: "shrink",
        textOverflow: "ellipsis",
        maxLines: 2,
        minFontSize: 34,
        textBackgroundColor: "rgba(17,24,39,0.74)",
      },
    });
  });

  it("places subtitle tracks in composition safe areas", () => {
    const track = subtitleTrack(
      [
        {
          text: "Safe lower subtitle",
          startMs: 0,
          endMs: 1000,
        },
      ],
      {
        fps: 30,
        composition: { width: 1080, height: 1920 },
        safeArea: "vertical",
      },
    );

    expect(validateScene(sceneWith(track))).toMatchObject({ ok: true });
    expect(track.style).toMatchObject({
      position: "absolute",
      left: 72,
      top: 1316,
      width: 936,
      height: 230,
    });
  });

  it("lets subtitle track style and motion overrides win", () => {
    const track = subtitleTrack(
      [{ text: "Manual subtitle", startMs: 0, endMs: 1000 }],
      {
        fps: 30,
        area: { top: 800, height: 180 },
        style: { fontSize: 44, color: "#fde68a" },
        maxLines: 3,
        minFontSize: 22,
        textFit: "wrap",
        textOverflow: "clip",
        enter: false,
      },
    );
    const text = track.children?.[0]?.children?.[0];

    expect(validateScene(sceneWith(track))).toMatchObject({ ok: true });
    expect(track.style).toMatchObject({ top: 800, height: 180 });
    expect(text?.animations).toEqual([]);
    expect(text?.style).toMatchObject({
      fontSize: 44,
      color: "#fde68a",
      maxLines: 3,
      minFontSize: 22,
      textFit: "wrap",
      textOverflow: "clip",
    });
  });

  it("keeps every subtitle template bounded for long segment text", () => {
    for (const [template] of captionTemplateEntries) {
      const track = subtitleTrack(
        [
          {
            text: "A long subtitle line that may come from chat, transcripts, or pasted SRT files and must stay inside the subtitle band without bleeding into the video frame.",
            startMs: 0,
            endMs: 2200,
          },
        ],
        {
          fps: 30,
          idPrefix: `bounded-${template}`,
          template,
          composition: { width: 1080, height: 1920 },
        },
      );
      const text = track.children?.[0]?.children?.[0];

      expect(validateScene(sceneWith(track))).toMatchObject({ ok: true });
      expect(track.style).toMatchObject({
        left: 72,
        top: 1316,
        width: 936,
        height: 230,
      });
      expect(text?.style).toMatchObject({
        width: "100%",
        height: "100%",
        overflow: "hidden",
        textFit: "shrink",
        textOverflow: "ellipsis",
        maxLines: 2,
      });
      expect(text?.style?.minFontSize).toEqual(expect.any(Number));
    }
  });

  it("rejects malformed subtitle segments", () => {
    expect(() =>
      subtitleTrack([{ text: "oops", startMs: 1200, endMs: 900 }], {
        fps: 30,
      }),
    ).toThrow("end after");
    expect(() =>
      subtitleTrack(
        [{ text: "oops", startMs: 0, startSeconds: 0, endMs: 1000 }],
        { fps: 30 },
      ),
    ).toThrow("both startMs and startSeconds");
  });

  it("parses SRT cues into subtitle segments", () => {
    const segments = parseSrt(`1
00:00:00,500 --> 00:00:02,100
First subtitle line

2
00:00:02,400 --> 00:00:04,250
Second subtitle line
with an explicit break
`);

    expect(segments).toEqual([
      { text: "First subtitle line", startMs: 500, endMs: 2100 },
      {
        text: "Second subtitle line\nwith an explicit break",
        startMs: 2400,
        endMs: 4250,
      },
    ]);
    expect(
      validateScene(sceneWith(subtitleTrack(segments, { fps: 30 }))),
    ).toMatchObject({ ok: true });
  });

  it("parses WebVTT cues and ignores cue settings and notes", () => {
    const segments = parseVtt(`WEBVTT

NOTE generated by a speech tool

intro
00:00:00.000 --> 00:00:01.250 align:center position:50%
Hello from VTT

00:00:01.500 --> 00:00:03.000
Second cue
`);

    expect(segments).toEqual([
      { text: "Hello from VTT", startMs: 0, endMs: 1250 },
      { text: "Second cue", startMs: 1500, endMs: 3000 },
    ]);
  });

  it("rejects malformed subtitle files", () => {
    expect(() =>
      parseSrt(`1
00:00:02,000 --> 00:00:01,000
Backwards`),
    ).toThrow("end after");
    expect(() =>
      parseVtt("00:00:00.000 --> 00:00:01.000\nMissing header"),
    ).toThrow("WEBVTT");
    expect(() =>
      parseSrt(`1
00:00:60,000 --> 00:00:61,000
Bad clock`),
    ).toThrow("invalid minutes or seconds");
  });
});

describe("text overlay template catalog", () => {
  const examples: Record<
    TextOverlayTemplateKey,
    Parameters<typeof textOverlay>[0]
  > = {
    announcementBanner: {
      template: "announcementBanner",
      id: "sale-banner",
      title: "New Drop",
      subtitle: "Available Friday",
      kicker: "Limited",
      from: 12,
      duration: 90,
    },
    chapterTitle: {
      template: "chapterTitle",
      id: "chapter",
      title: "Act Two",
      subtitle: "The build begins",
      kicker: "02",
    },
    lowerThird: {
      template: "lowerThird",
      id: "speaker",
      title: "Ada Lovelace",
      subtitle: "Programmer",
      kicker: "Interview",
    },
    quoteCard: {
      template: "quoteCard",
      id: "quote",
      body: "The engine is data, not a screenshot.",
      attribution: "MotionForge",
    },
    socialHook: {
      template: "socialHook",
      id: "hook",
      title: "Stop hand-editing captions",
      subtitle: "Use scene data instead.",
    },
    statCallout: {
      template: "statCallout",
      id: "stat",
      value: "4.8x",
      label: "faster exports",
      subtitle: "Browser-native pipeline",
    },
    titleCard: {
      template: "titleCard",
      id: "intro",
      title: "MotionForge",
      subtitle: "Programmatic video as scene data",
      kicker: "Open source",
    },
  };

  it("exposes stable text overlay metadata", () => {
    expect(textOverlayTemplateEntries.map(([key]) => key)).toEqual([
      "titleCard",
      "lowerThird",
      "quoteCard",
      "statCallout",
      "announcementBanner",
      "socialHook",
      "chapterTitle",
    ]);
    expect(textOverlayTemplates.lowerThird.required).toEqual(["title"]);
  });

  it("generates schema-valid overlays for every template", () => {
    for (const [key] of textOverlayTemplateEntries) {
      const overlay = textOverlay(examples[key]);
      const result = validateScene(sceneWith(overlay));

      expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
    }
  });

  it("applies timing, container style, slot style, and entrance overrides", () => {
    const overlay = textOverlay({
      template: "lowerThird",
      id: "custom-lower-third",
      title: "Grace Hopper",
      subtitle: "Compiler pioneer",
      from: 30,
      duration: 75,
      accentColor: "#22c55e",
      enter: false,
      style: { left: 120, bottom: 180, width: 700 },
      titleStyle: { fontSize: 64, color: "#f8fafc" },
    });

    expect(validateScene(sceneWith(overlay))).toMatchObject({ ok: true });
    expect(overlay).toMatchObject({
      id: "custom-lower-third",
      from: 30,
      duration: 75,
      animations: [],
      style: {
        left: 120,
        bottom: 180,
        width: 700,
        border: "2px solid #22c55e",
      },
    });
    expect(overlay.children?.[0]?.id).toBe("custom-lower-third-title");
    expect(overlay.children?.[0]?.style).toMatchObject({
      fontSize: 64,
      color: "#f8fafc",
    });
  });

  it("lets text overlay templates opt into safe-area anchors", () => {
    const overlay = textOverlay({
      template: "lowerThird",
      id: "safe-speaker",
      title: "Margaret Hamilton",
      subtitle: "Software engineer",
      composition: { width: 1080, height: 1920 },
    });

    expect(validateScene(sceneWith(overlay))).toMatchObject({ ok: true });
    expect(overlay.style).toMatchObject({
      position: "absolute",
      left: 72,
      top: 1239,
      width: 693,
      height: 288,
      padding: 28,
    });
  });

  it("adds robust text fit defaults to user-facing overlay slots", () => {
    const overlay = textOverlay({
      template: "quoteCard",
      id: "robust-quote",
      body: "A generated quote can run much longer than the nice hand-authored sample and still stay bounded.",
      attribution: "MotionForge",
    });
    const body = overlay.children?.find(
      (child) => child.id === "robust-quote-body",
    );
    const attribution = overlay.children?.find(
      (child) => child.id === "robust-quote-attribution",
    );

    expect(validateScene(sceneWith(overlay))).toMatchObject({ ok: true });
    expect(body?.style).toMatchObject({
      overflow: "hidden",
      textFit: "shrink",
      textOverflow: "ellipsis",
      maxLines: 4,
      minFontSize: 33,
    });
    expect(attribution?.style).toMatchObject({
      maxLines: 1,
      minFontSize: 16,
    });
  });

  it("lets slot style overrides replace robust defaults", () => {
    const overlay = textOverlay({
      template: "socialHook",
      id: "manual-hook",
      title: "Stop hand-editing captions",
      titleStyle: {
        textFit: "wrap",
        textOverflow: "clip",
        maxLines: 3,
        minFontSize: 40,
      },
    });

    expect(validateScene(sceneWith(overlay))).toMatchObject({ ok: true });
    expect(overlay.children?.[0]?.style).toMatchObject({
      textFit: "wrap",
      textOverflow: "clip",
      maxLines: 3,
      minFontSize: 40,
    });
  });

  it("rejects missing required text slots", () => {
    expect(() => textOverlay({ template: "quoteCard" })).toThrow(
      "requires body",
    );
  });
});

describe("image overlay template catalog", () => {
  it("exposes stable image overlay metadata", () => {
    expect(imageOverlayTemplateEntries.map(([key]) => key)).toEqual([
      "logoBug",
      "watermark",
      "sticker",
      "productShot",
      "cornerBadge",
      "avatarBadge",
    ]);
    expect(imageOverlayTemplates.productShot.category).toBe("product");
  });

  it("generates schema-valid overlays for every template", () => {
    for (const [template] of imageOverlayTemplateEntries) {
      const overlay = imageOverlay({
        template,
        assetId: "brand-image",
        composition: { width: 1080, height: 1920 },
      });
      const result = validateScene({
        ...sceneWith(overlay),
        assets: {
          "brand-image": {
            id: "brand-image",
            type: "image",
            src: "data:image/png;base64,x",
          },
        },
      });

      expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
      expect(overlay.children?.[0]).toMatchObject({
        type: "img",
        assetId: "brand-image",
        style: {
          width: "100%",
          height: "100%",
        },
      });
    }
  });

  it("places image overlays with composition safe areas", () => {
    const overlay = imageOverlay({
      template: "logoBug",
      id: "brand-corner",
      assetId: "logo",
      composition: { width: 1080, height: 1920 },
    });

    expect(overlay).toMatchObject({
      id: "brand-corner",
      type: "div",
      style: {
        position: "absolute",
        left: 858,
        top: 144,
        width: 150,
        height: 145,
        opacity: 0.92,
      },
    });
    expect(overlay.children?.[0]).toMatchObject({
      id: "brand-corner-image",
      type: "img",
      assetId: "logo",
      style: {
        objectFit: "contain",
        objectPosition: "center center",
      },
    });
  });

  it("lets image overlay placement and style overrides win", () => {
    const overlay = imageOverlay({
      template: "productShot",
      id: "manual-product",
      assetId: "product",
      from: 12,
      duration: 48,
      placement: "bottomLeft",
      composition: { width: 1920, height: 1080 },
      opacity: 0.7,
      borderRadius: 16,
      shadow: "0px 8px 24px rgba(0,0,0,0.24)",
      objectFit: "cover",
      objectPosition: "top center",
      enter: false,
      style: { left: 128, top: 220, width: 640, height: 420 },
      imageStyle: { backgroundColor: "#111827" },
    });

    expect(overlay).toMatchObject({
      id: "manual-product",
      from: 12,
      duration: 48,
      animations: [],
      style: {
        left: 128,
        top: 220,
        width: 640,
        height: 420,
        opacity: 0.7,
        borderRadius: 16,
        boxShadow: "0px 8px 24px rgba(0,0,0,0.24)",
      },
    });
    expect(overlay.children?.[0]?.style).toMatchObject({
      objectFit: "cover",
      objectPosition: "top center",
      backgroundColor: "#111827",
    });
  });

  it("rejects empty image overlay asset ids", () => {
    expect(() => imageOverlay({ assetId: " " })).toThrow("assetId");
  });
});

describe("video overlay template catalog", () => {
  it("exposes stable video overlay metadata", () => {
    expect(videoOverlayTemplateEntries.map(([key]) => key)).toEqual([
      "pictureInPicture",
      "reactionCam",
      "screenDemo",
      "backgroundLoop",
      "brollStrip",
      "videoBadge",
    ]);
    expect(videoOverlayTemplates.screenDemo.category).toBe("demo");
    expect(videoOverlayTemplates.pictureInPicture.muted).toBe(true);
  });

  it("generates schema-valid video overlays for every template", () => {
    for (const [template] of videoOverlayTemplateEntries) {
      const overlay = videoOverlay({
        template,
        assetId: "clip",
        composition: { width: 1080, height: 1920 },
      });
      const result = validateScene({
        ...sceneWith(overlay),
        assets: {
          clip: {
            id: "clip",
            type: "video",
            src: "clip.mp4",
          },
        },
      });

      expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
      expect(overlay).toMatchObject({
        type: "video",
        assetId: "clip",
        style: {
          position: "absolute",
          objectPosition: "center center",
        },
      });
    }
  });

  it("places video overlays with composition safe areas and muted defaults", () => {
    const overlay = videoOverlay({
      template: "pictureInPicture",
      id: "demo-pip",
      assetId: "clip",
      composition: { width: 1080, height: 1920 },
    });

    expect(overlay).toMatchObject({
      id: "demo-pip",
      type: "video",
      assetId: "clip",
      volume: 0,
      style: {
        position: "absolute",
        left: 708,
        top: 144,
        width: 300,
        height: 290,
        borderRadius: 24,
        objectFit: "cover",
      },
    });
  });

  it("keeps reaction cam audio on unless the caller mutes it", () => {
    const overlay = videoOverlay({
      template: "reactionCam",
      assetId: "camera",
      composition: { width: 1080, height: 1920 },
    });
    const muted = videoOverlay({
      template: "reactionCam",
      assetId: "camera",
      muted: true,
      composition: { width: 1080, height: 1920 },
    });

    expect(overlay.volume).toBeUndefined();
    expect(muted.volume).toBe(0);
  });

  it("lets video overlay timing, source, and style overrides win", () => {
    const overlay = videoOverlay({
      template: "screenDemo",
      id: "manual-demo",
      assetId: "screen",
      from: 12,
      duration: 96,
      trimStart: 4.5,
      playbackRate: 1.25,
      volume: 0.35,
      placement: "bottomLeft",
      composition: { width: 1920, height: 1080 },
      opacity: 0.86,
      borderRadius: 18,
      shadow: "0px 8px 24px rgba(0,0,0,0.24)",
      objectFit: "cover",
      objectPosition: "top center",
      enter: false,
      style: { left: 128, top: 220, width: 640, height: 420 },
      videoStyle: { backgroundColor: "#111827" },
    });

    expect(overlay).toMatchObject({
      id: "manual-demo",
      from: 12,
      duration: 96,
      videoStartTime: 4.5,
      playbackRate: 1.25,
      volume: 0.35,
      animations: [],
      style: {
        left: 128,
        top: 220,
        width: 640,
        height: 420,
        opacity: 0.86,
        borderRadius: 18,
        boxShadow: "0px 8px 24px rgba(0,0,0,0.24)",
        objectFit: "cover",
        objectPosition: "top center",
        backgroundColor: "#111827",
      },
    });
  });

  it("rejects empty video overlay asset ids", () => {
    expect(() => videoOverlay({ assetId: " " })).toThrow("assetId");
  });
});

describe("audio overlay template catalog", () => {
  it("exposes stable audio overlay metadata", () => {
    expect(audioOverlayTemplateEntries.map(([key]) => key)).toEqual([
      "backgroundMusic",
      "voiceover",
      "soundEffect",
      "beatAccent",
      "ambientBed",
      "notificationPing",
    ]);
    expect(audioOverlayTemplates.backgroundMusic.category).toBe("music");
    expect(audioOverlayTemplates.voiceover.defaultVolume).toBe(1);
  });

  it("generates schema-valid audio overlays for every template", () => {
    for (const [template] of audioOverlayTemplateEntries) {
      const overlay = audioOverlay({
        template,
        assetId: "music",
      });
      const result = validateScene({
        ...sceneWith(overlay),
        assets: {
          music: {
            id: "music",
            type: "audio",
            src: "music.mp3",
          },
        },
      });

      expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
      expect(overlay).toMatchObject({
        type: "audio",
        assetId: "music",
        style: {},
        animations: [],
        children: [],
      });
    }
  });

  it("uses conservative role defaults", () => {
    const music = audioOverlay({
      template: "backgroundMusic",
      id: "music-bed",
      assetId: "track",
    });
    const effect = audioOverlay({
      template: "soundEffect",
      id: "whoosh",
      assetId: "hit",
    });
    const beat = audioOverlay({
      template: "beatAccent",
      id: "beat-hit",
      assetId: "hit",
    });

    expect(music).toMatchObject({
      id: "music-bed",
      type: "audio",
      volume: 0.28,
      duration: undefined,
    });
    expect(effect).toMatchObject({
      volume: 0.85,
      duration: 45,
    });
    expect(beat).toMatchObject({
      volume: 0.7,
      duration: 18,
    });
  });

  it("lets audio overlay timing, source, mute, and volume overrides win", () => {
    const overlay = audioOverlay({
      template: "ambientBed",
      id: "manual-ambience",
      assetId: "room",
      from: 24,
      duration: 120,
      trimStart: 3.5,
      volume: 0.4,
      loop: true,
    });
    const muted = audioOverlay({
      template: "voiceover",
      assetId: "voice",
      muted: true,
    });

    expect(overlay).toMatchObject({
      id: "manual-ambience",
      from: 24,
      duration: 120,
      audioStartTime: 3.5,
      volume: 0.4,
      loop: true,
    });
    expect(muted.volume).toBe(0);
  });

  it("compiles audio overlay fades to volume envelopes", () => {
    const overlay = audioOverlay({
      template: "backgroundMusic",
      id: "music-bed",
      assetId: "track",
      duration: 150,
      fadeInDuration: 30,
      fadeOutDuration: 45,
    });

    expect(overlay.volumeEnvelope).toEqual([
      { frame: 0, value: 0 },
      { frame: 30, value: 1, easing: "easeOut" },
      { frame: 105, value: 1 },
      { frame: 150, value: 0, easing: "easeIn" },
    ]);
    expect(validateScene(sceneWith(overlay)).ok).toBe(true);
  });

  it("lets explicit audio overlay volume envelopes override generated fades", () => {
    const overlay = audioOverlay({
      assetId: "track",
      duration: 90,
      fadeInDuration: 30,
      volumeEnvelope: [
        { frame: 0, value: 0.2 },
        { frame: 10, value: 0.8, easing: "linear" },
      ],
    });

    expect(overlay.volumeEnvelope).toEqual([
      { frame: 0, value: 0.2 },
      { frame: 10, value: 0.8, easing: "linear" },
    ]);
  });

  it("validates audio fade envelope inputs", () => {
    expect(audioFadeEnvelope({ duration: 100, fadeInDuration: 12 })).toEqual([
      { frame: 0, value: 0 },
      { frame: 12, value: 1, easing: "easeOut" },
    ]);
    expect(() => audioFadeEnvelope({ fadeOutDuration: 12 })).toThrow(
      "requires duration",
    );
    expect(() =>
      audioFadeEnvelope({
        duration: 30,
        fadeInDuration: 20,
        fadeOutDuration: 20,
      }),
    ).toThrow("overlap");
    expect(() => audioFadeEnvelope({ fadeInDuration: 1.5 })).toThrow(
      "non-negative integer",
    );
  });

  it("rejects empty audio overlay asset ids", () => {
    expect(() => audioOverlay({ assetId: " " })).toThrow("assetId");
  });
});
