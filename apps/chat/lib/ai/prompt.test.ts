import { describe, expect, it } from "vitest";
import { buildMotionforgeSystemPrompt } from "./prompt";

describe("buildMotionforgeSystemPrompt", () => {
  it("includes uploaded media manifest and rules", () => {
    const prompt = buildMotionforgeSystemPrompt(null, [
      {
        id: "video-1",
        sceneAssetId: "video_1",
        type: "video",
        src: "blob:video-1",
        label: "Video 1",
        aliases: ["video one"],
        fileName: "clip.mp4",
        durationSeconds: 8,
        width: 1920,
        height: 1080,
        alreadyInScene: false,
      },
    ]);

    expect(prompt).toContain("Uploaded media rules");
    expect(prompt).toContain('"sceneAssetId": "video_1"');
    expect(prompt).toContain("Use videoStartTime in seconds");
    expect(prompt).toContain("setNodeProps");
    expect(prompt).toContain('whose assetId is "video_1"');
  });

  it("spells out the canonical scene and animation shape", () => {
    const prompt = buildMotionforgeSystemPrompt(null);

    expect(prompt).toContain('"schemaVersion": 1');
    expect(prompt).toContain("horizontal/16:9 = 1920x1080 or 1280x720");
    expect(prompt).toContain("Do not use scene.meta");
    expect(prompt).toContain('even when empty: "assets": {}');
    expect(prompt).toContain("Use frames, not keyframes");
    expect(prompt).toContain("Use retime for node from/duration");
    expect(prompt).toContain("Do not use offset/time/progress keys");
    expect(prompt).toContain("Do not use radial-gradient");
    expect(prompt).toContain("Do not use drop-shadow()");
    expect(prompt).toContain("Animation frame numbers are node-local");
    expect(prompt).toContain("Do not use translateX(), translateY()");
    expect(prompt).toContain("Never set opacity:0");
  });

  it("teaches visual vocabulary, creative recipes, and unsupported substitutes", () => {
    const prompt = buildMotionforgeSystemPrompt(null);

    expect(prompt).toContain("MotionForge visual vocabulary");
    expect(prompt).toContain("titleCard, lowerThird, quoteCard");
    expect(prompt).toContain("logoBug, watermark, sticker");
    expect(prompt).toContain("pictureInPicture, reactionCam, screenDemo");
    expect(prompt).toContain("Countdown recipe");
    expect(prompt).toContain("prefer full-bleed video composition");
    expect(prompt).toContain("Do not add a large rounded rectangle");
    expect(prompt).toContain("not a giant enclosing frame or card");
    expect(prompt).toContain("stars around the font");
    expect(prompt).toContain("Unsupported features and safe substitutes");
    expect(prompt).toContain("Do not output HTML, SVG, React");
    expect(prompt).toContain("feGaussianBlur");
    expect(prompt).toContain(
      "use div nodes with width/height/backgroundColor/borderRadius/border",
    );
  });
});
