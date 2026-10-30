import { describe, expect, it } from "vitest";
import { validateScene } from "@dojo-video-engine/schema";
import { presetGalleryScenes, showcaseScenes } from "./index.js";

describe("showcase scenes", () => {
  it("are schema-valid with stable ids", () => {
    expect(showcaseScenes.map((entry) => entry.id)).toEqual([
      "intro",
      "tiktok-captions",
      "karaoke-captions",
      "launch-info-display",
      "timed-text-overlay",
      "text-stress-gallery",
      "subtitle-stress-gallery",
      "image-overlay-stress-gallery",
      "video-overlay-stress-gallery",
      "audio-sync-pulse",
      "lottie-sticker",
    ]);

    for (const entry of showcaseScenes) {
      const result = validateScene(entry.scene);
      expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
      expect(entry.posterFrame).toBeGreaterThanOrEqual(0);
      expect(entry.posterFrame).toBeLessThan(entry.scene.duration);
    }
  });

  it("uses measured caption backgrounds in the TikTok showcase", () => {
    const tiktok = showcaseScenes.find(
      (entry) => entry.id === "tiktok-captions",
    );
    const caption = tiktok?.scene.nodes.find((node) => node.id === "caption");
    const highlighted = caption?.children?.[1]?.children?.[0];

    expect(highlighted?.id).toBe("caption-w1-text");
    expect(highlighted?.style?.textBackgroundColor).toBe(
      "rgba(255, 209, 102, 0.16)",
    );
    expect(highlighted?.style?.textStroke).toBe("8px #000000");
  });

  it("translates the timed text prompt into exact overlay windows", () => {
    const timed = showcaseScenes.find(
      (entry) => entry.id === "timed-text-overlay",
    );
    const topText = timed?.scene.nodes.find(
      (node) => node.id === "timed-top-text",
    );
    const bottomText = timed?.scene.nodes.find(
      (node) => node.id === "coming-soon-text",
    );

    expect(timed?.scene.fps).toBe(30);
    expect(timed?.scene.duration).toBe(450);

    expect(topText?.text).toBe("dojo-video-engine.dev");
    expect(topText?.from).toBe(0);
    expect(topText?.duration).toBe(150);
    expect(topText?.style?.top).toBe(74);
    expect(topText?.style?.textAlign).toBe("center");
    expect(topText?.style?.color).toBe("#ff3030");

    expect(bottomText?.text).toBe("Coming soon...");
    expect(bottomText?.from).toBe(150);
    expect(bottomText?.duration).toBe(300);
    expect(bottomText?.style?.right).toBe(70);
    expect(bottomText?.style?.bottom).toBe(92);
    expect(bottomText?.style?.textAlign).toBe("right");
    expect(bottomText?.style?.color).toBe("#ffe45c");
  });

  it("includes text stress coverage cases", () => {
    const entry = showcaseScenes.find(
      (scene) => scene.id === "text-stress-gallery",
    );

    expect(entry).toBeDefined();
    expect(validateScene(entry!.scene)).toMatchObject({ ok: true });
    expect(entry!.scene.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "stress-long-latin",
        "stress-url",
        "stress-cjk",
        "stress-emoji",
        "stress-long-token",
        "stress-multiline",
      ]),
    );
    expect(JSON.stringify(entry!.scene)).toContain(
      "Supercalifragilisticexpialidocious",
    );
    expect(JSON.stringify(entry!.scene)).toContain(
      "这是一段很长的中文说明文字",
    );
    expect(JSON.stringify(entry!.scene)).toContain("🚀");
  });

  it("includes subtitle stress coverage cases", () => {
    const entry = showcaseScenes.find(
      (scene) => scene.id === "subtitle-stress-gallery",
    );
    const ids = entry!.scene.nodes.map((node) => node.id);
    const serialized = JSON.stringify(entry!.scene);
    const srtTrack = entry!.scene.nodes.find(
      (node) => node.id === "subtitle-stress-srt",
    );
    const vttTrack = entry!.scene.nodes.find(
      (node) => node.id === "subtitle-stress-vtt",
    );
    const manualTrack = entry!.scene.nodes.find(
      (node) => node.id === "subtitle-stress-manual",
    );

    expect(entry).toBeDefined();
    expect(validateScene(entry!.scene)).toMatchObject({ ok: true });
    expect(ids).toEqual(
      expect.arrayContaining([
        "subtitle-stress-srt",
        "subtitle-stress-vtt",
        "subtitle-stress-manual",
      ]),
    );
    expect(srtTrack?.children).toHaveLength(2);
    expect(vttTrack?.children).toHaveLength(2);
    expect(manualTrack?.children).toHaveLength(6);
    expect(serialized).toContain("SRT multiline cue");
    expect(serialized).toContain("WebVTT cue settings");
    expect(serialized).toContain("https://dojo-video-engine.dev");
    expect(serialized).toContain("这是一段没有空格的中文字幕");
    expect(serialized).toContain("🚀");
    expect(serialized).toContain("FAST 3");
  });

  it("includes image overlay stress coverage cases", () => {
    const entry = showcaseScenes.find(
      (scene) => scene.id === "image-overlay-stress-gallery",
    );
    const ids = entry!.scene.nodes.map((node) => node.id);
    const imageOverlayNodes = entry!.scene.nodes.filter(
      (node) =>
        node.type === "div" &&
        node.children?.some((child) => child.type === "img"),
    );

    expect(entry).toBeDefined();
    expect(validateScene(entry!.scene)).toMatchObject({ ok: true });
    expect(Object.values(entry!.scene.assets).map((asset) => asset.type)).toEqual([
      "image",
      "image",
      "image",
      "image",
      "image",
      "image",
    ]);
    expect(ids).toEqual(
      expect.arrayContaining([
        "image-stress-logo-bug",
        "image-stress-watermark",
        "image-stress-sticker",
        "image-stress-product-shot",
        "image-stress-avatar-badge",
        "image-stress-corner-badge",
      ]),
    );
    expect(imageOverlayNodes).toHaveLength(6);
    expect(entry!.scene.assets["image-sticker-transparent"]?.src).toContain(
      "data:image/svg+xml",
    );
    expect(
      entry!.scene.nodes.find((node) => node.id === "image-stress-watermark")
        ?.style?.opacity,
    ).toBe(0.42);
  });

  it("includes video overlay stress coverage cases", () => {
    const entry = showcaseScenes.find(
      (scene) => scene.id === "video-overlay-stress-gallery",
    );
    const ids = entry!.scene.nodes.map((node) => node.id);
    const videoOverlayNodes = entry!.scene.nodes.filter(
      (node) => node.type === "video",
    );
    const pip = entry!.scene.nodes.find(
      (node) => node.id === "video-stress-pip",
    );
    const reaction = entry!.scene.nodes.find(
      (node) => node.id === "video-stress-reaction-cam",
    );
    const screenDemo = entry!.scene.nodes.find(
      (node) => node.id === "video-stress-screen-demo",
    );
    const backgroundLoop = entry!.scene.nodes.find(
      (node) => node.id === "video-stress-background-loop",
    );
    const broll = entry!.scene.nodes.find(
      (node) => node.id === "video-stress-broll-strip",
    );

    expect(entry).toBeDefined();
    expect(validateScene(entry!.scene)).toMatchObject({ ok: true });
    expect(Object.values(entry!.scene.assets).map((asset) => asset.type)).toEqual([
      "video",
    ]);
    expect(entry!.scene.assets["video-overlay-source"]?.src).toContain(
      "data:video/mp4;base64,",
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "video-stress-background-loop",
        "video-stress-pip",
        "video-stress-reaction-cam",
        "video-stress-screen-demo",
        "video-stress-broll-strip",
        "video-stress-video-badge",
      ]),
    );
    expect(videoOverlayNodes).toHaveLength(6);
    expect(pip).toMatchObject({
      type: "video",
      videoStartTime: 1,
      playbackRate: 1.25,
      volume: 0,
    });
    expect(reaction).toMatchObject({
      type: "video",
      videoStartTime: 1.5,
      playbackRate: 0.9,
      volume: 0.45,
    });
    expect(screenDemo?.style?.objectFit).toBe("contain");
    expect(backgroundLoop).toMatchObject({
      type: "video",
      playbackRate: 0.65,
      volume: 0,
    });
    expect(broll).toMatchObject({
      type: "video",
      videoStartTime: 0.75,
      playbackRate: 1.5,
      volume: 0,
    });
    expect(broll?.style?.objectPosition).toBe("left center");
  });
});

describe("preset gallery scenes", () => {
  it("are schema-valid with stable families", () => {
    expect(
      presetGalleryScenes.map((entry) => [
        entry.id,
        entry.family,
        entry.posterFrame,
      ]),
    ).toEqual([
      ["preset-subtitles", "subtitles", 45],
      ["preset-text-overlays", "text", 45],
      ["preset-media-looks", "media", 45],
      ["preset-clip-layouts", "layout", 45],
      ["preset-transitions", "transition", 30],
    ]);

    for (const entry of presetGalleryScenes) {
      const result = validateScene(entry.scene);
      expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
      expect(entry.posterFrame).toBeGreaterThanOrEqual(0);
      expect(entry.posterFrame).toBeLessThan(entry.scene.duration);
    }
  });
});
