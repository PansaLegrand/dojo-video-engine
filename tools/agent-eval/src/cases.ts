import type { Scene } from "@motionforge/schema";

export type EvalMediaAsset = {
  id: string;
  sceneAssetId: string;
  type: "image" | "video" | "audio";
  src: string;
  label: string;
  aliases: string[];
  fileName: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  alreadyInScene: boolean;
};

/**
 * Eval cases per RFC 0001. Scoring is mechanical: the validator/patch API is
 * the judge, plus per-case structural assertions. An assertion returns a
 * list of failure strings (empty = pass).
 */

export type GenerateCase = {
  id: string;
  suite: "generate";
  /** User-style prompt; the runner prepends llms.txt as the system prompt. */
  prompt: string;
  assert: (scene: Scene) => string[];
};

export type EditCase = {
  id: string;
  suite: "edit";
  scene: Scene;
  mediaAssets?: EvalMediaAsset[];
  /** Edit instruction; the model must answer with a patch op list. */
  prompt: string;
  assert: (before: Scene, after: Scene) => string[];
};

export type EvalCase = GenerateCase | EditCase;

// ---------------------------------------------------------------------------

function findText(scene: Scene, includes: string) {
  const all: Scene["nodes"] = [];
  const visit = (nodes: Scene["nodes"]) => {
    for (const node of nodes) {
      all.push(node);
      visit(node.children ?? []);
    }
  };
  visit(scene.nodes);
  return all.find(
    (n) => n.text && n.text.toLowerCase().includes(includes.toLowerCase()),
  );
}

const editBase: Scene = {
  schemaVersion: 1,
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 120,
  assets: {},
  nodes: [
    {
      id: "bg",
      type: "div",
      from: 0,
      duration: 120,
      style: { width: "100%", height: "100%", backgroundColor: "#101820" },
      animations: [],
      children: [],
    },
    {
      id: "title",
      type: "text",
      text: "Summer Sale",
      from: 0,
      duration: 120,
      style: {
        position: "absolute",
        left: 64,
        right: 64,
        top: 700,
        fontSize: 64,
        color: "#ffffff",
        textAlign: "center",
      },
      animations: [],
      children: [],
    },
    {
      id: "subtitle",
      type: "text",
      text: "Up to 50% off",
      from: 30,
      duration: 90,
      style: {
        position: "absolute",
        left: 64,
        right: 64,
        top: 820,
        fontSize: 36,
        color: "#ffd166",
        textAlign: "center",
      },
      animations: [],
      children: [],
    },
  ],
} as Scene;

const mediaEditBase: Scene = {
  schemaVersion: 1,
  width: 1280,
  height: 720,
  fps: 30,
  duration: 90,
  assets: {},
  nodes: [],
};

const mediaAssets: EvalMediaAsset[] = [
  {
    id: "video-1",
    sceneAssetId: "video_1",
    type: "video",
    src: "https://example.test/video-1.mp4",
    label: "Video 1",
    aliases: ["video one", "first video"],
    fileName: "first.mp4",
    durationSeconds: 20,
    width: 1280,
    height: 720,
    alreadyInScene: false,
  },
  {
    id: "video-2",
    sceneAssetId: "video_2",
    type: "video",
    src: "https://example.test/video-2.mp4",
    label: "Video 2",
    aliases: ["video two", "second video"],
    fileName: "second.mp4",
    durationSeconds: 12,
    width: 1280,
    height: 720,
    alreadyInScene: false,
  },
  {
    id: "image-1",
    sceneAssetId: "image_1",
    type: "image",
    src: "https://example.test/logo.png",
    label: "Image 1",
    aliases: ["logo image", "logo"],
    fileName: "logo.png",
    width: 800,
    height: 800,
    alreadyInScene: false,
  },
  {
    id: "audio-1",
    sceneAssetId: "audio_1",
    type: "audio",
    src: "https://example.test/music.mp3",
    label: "Audio 1",
    aliases: ["music bed", "background music"],
    fileName: "music.mp3",
    durationSeconds: 30,
    alreadyInScene: false,
  },
];

function nodeById(scene: Scene, id: string) {
  return scene.nodes.find((node) => node.id === id);
}

export const cases: EvalCase[] = [
  {
    id: "gen-minimal-title",
    suite: "generate",
    prompt:
      'Create a 3-second 1080x1920 30fps scene: dark background, centered white text "HELLO WORLD" that fades in over the first 12 frames.',
    assert: (scene) => {
      const failures: string[] = [];
      if (scene.duration !== 90) failures.push(`duration ${scene.duration}, wanted 90`);
      if (scene.width !== 1080 || scene.height !== 1920) failures.push("wrong canvas size");
      const text = findText(scene, "hello world");
      if (!text) failures.push('no text node containing "HELLO WORLD"');
      return failures;
    },
  },
  {
    id: "gen-two-scenes-sequence",
    suite: "generate",
    prompt:
      "Create a 6-second 1280x720 30fps scene with two full-screen colored sections shown one after the other: a red div for the first 3 seconds, then a blue div for the last 3 seconds.",
    assert: (scene) => {
      const failures: string[] = [];
      if (scene.duration !== 180) failures.push(`duration ${scene.duration}, wanted 180`);
      const starts = scene.nodes.map((n) => n.from ?? 0);
      if (!starts.includes(90)) failures.push("no node starting at frame 90");
      return failures;
    },
  },
  {
    id: "gen-caption-style",
    suite: "generate",
    prompt:
      'Create a 2-second 1080x1920 30fps scene with a single caption-style text node "LET\'S GO" near the bottom: bold, white fill, black text stroke, and a fitted background pill.',
    assert: (scene) => {
      const failures: string[] = [];
      const text = findText(scene, "go");
      if (!text) return ['no text node containing "GO"'];
      const style = (text as { style?: Record<string, unknown> }).style ?? {};
      if (!style["textStroke"]) failures.push("no textStroke on the caption");
      if (!style["textBackgroundColor"]) failures.push("no textBackgroundColor pill");
      return failures;
    },
  },
  {
    id: "edit-bigger-title",
    suite: "edit",
    scene: editBase,
    prompt: "Make the title text twice as big.",
    assert: (before, after) => {
      const failures: string[] = [];
      const title = after.nodes.find((n) => n.id === "title");
      const fontSize = title?.style?.fontSize;
      if (fontSize !== 128) failures.push(`title fontSize ${String(fontSize)}, wanted 128`);
      const subtitle = after.nodes.find((n) => n.id === "subtitle");
      if (JSON.stringify(subtitle) !== JSON.stringify(before.nodes.find((n) => n.id === "subtitle"))) {
        failures.push("subtitle changed — untouched nodes must stay identical");
      }
      return failures;
    },
  },
  {
    id: "edit-retime-subtitle",
    suite: "edit",
    scene: editBase,
    prompt: "Show the subtitle from the very beginning instead of frame 30, keeping its end where it is.",
    assert: (_before, after) => {
      const failures: string[] = [];
      const subtitle = after.nodes.find((n) => n.id === "subtitle");
      if ((subtitle?.from ?? -1) !== 0) failures.push(`subtitle.from ${subtitle?.from}, wanted 0`);
      if ((subtitle?.duration ?? -1) !== 120) failures.push(`subtitle.duration ${subtitle?.duration}, wanted 120`);
      return failures;
    },
  },
  {
    id: "edit-pop-in-animation",
    suite: "edit",
    scene: editBase,
    prompt:
      "Give the title a pop-in entrance: scale from 0.8 to 1 with a spring easing over the first 12 frames, and fade its opacity from 0 to 1 over the same frames.",
    assert: (_before, after) => {
      const failures: string[] = [];
      const title = after.nodes.find((n) => n.id === "title");
      const animations = title?.animations ?? [];
      const props = animations.map((a) => a.property);
      if (!props.includes("transform")) failures.push("no transform animation on title");
      if (!props.includes("opacity")) failures.push("no opacity animation on title");
      return failures;
    },
  },
  {
    id: "edit-remove-subtitle",
    suite: "edit",
    scene: editBase,
    prompt: "Remove the subtitle entirely.",
    assert: (_before, after) => {
      const failures: string[] = [];
      if (after.nodes.some((n) => n.id === "subtitle")) failures.push("subtitle still present");
      if (!after.nodes.some((n) => n.id === "title")) failures.push("title was removed too");
      return failures;
    },
  },
  {
    id: "media-two-video-sequence",
    suite: "edit",
    scene: mediaEditBase,
    mediaAssets,
    prompt:
      'Uploaded media is available. Put Video 1 first from source 5 to 10 seconds, then Video 2 full. Add text "I love this" at the top during Video 2.',
    assert: (_before, after) => {
      const failures: string[] = [];
      const first = after.nodes.find(
        (node) => node.type === "video" && node.assetId === "video_1",
      );
      const second = after.nodes.find(
        (node) => node.type === "video" && node.assetId === "video_2",
      );
      const text = findText(after, "I love this");

      if (!after.assets["video_1"]) failures.push("missing video_1 asset");
      if (!after.assets["video_2"]) failures.push("missing video_2 asset");
      if (!first) failures.push("missing Video 1 node");
      if (!second) failures.push("missing Video 2 node");
      if ((first?.videoStartTime ?? -1) !== 5) failures.push("Video 1 source start is not 5s");
      if ((first?.duration ?? -1) !== 150) failures.push("Video 1 duration is not 150 frames");
      if ((first?.from ?? -1) !== 0) failures.push("Video 1 does not start at frame 0");
      if ((second?.from ?? -1) !== 150) failures.push("Video 2 does not start after Video 1");
      if (!text) failures.push('missing text "I love this"');
      if (text && (text.from ?? 0) < 150) failures.push("text does not start during Video 2");

      return failures;
    },
  },
  {
    id: "media-image-background-text",
    suite: "edit",
    scene: mediaEditBase,
    mediaAssets,
    prompt:
      'Use Image 1 as a full-frame background for 4 seconds and add centered text "Launch day".',
    assert: (_before, after) => {
      const failures: string[] = [];
      const image = after.nodes.find(
        (node) => node.type === "img" && node.assetId === "image_1",
      );
      const text = findText(after, "Launch day");

      if (!after.assets["image_1"]) failures.push("missing image_1 asset");
      if (!image) failures.push("missing image node");
      if ((image?.duration ?? -1) !== 120) failures.push("image duration is not 120 frames");
      if (image?.style?.objectFit !== "cover") failures.push("image is not full-frame cover");
      if (!text) failures.push('missing text "Launch day"');

      return failures;
    },
  },
  {
    id: "media-audio-bed",
    suite: "edit",
    scene: {
      ...mediaEditBase,
      duration: 180,
      nodes: [
        {
          id: "title",
          type: "text",
          text: "Existing scene",
          from: 0,
          duration: 180,
          style: { fontSize: 64, color: "#ffffff" },
        },
      ],
    },
    mediaAssets,
    prompt:
      "Add Audio 1 as quiet background music under the full 6-second scene at volume 0.35.",
    assert: (_before, after) => {
      const failures: string[] = [];
      const audio = after.nodes.find(
        (node) => node.type === "audio" && node.assetId === "audio_1",
      );

      if (!after.assets["audio_1"]) failures.push("missing audio_1 asset");
      if (!audio) failures.push("missing audio node");
      if ((audio?.from ?? -1) !== 0) failures.push("audio does not start at frame 0");
      if ((audio?.duration ?? -1) !== 180) failures.push("audio does not span 180 frames");
      if ((audio?.volume ?? -1) !== 0.35) failures.push("audio volume is not 0.35");
      if (!nodeById(after, "title")) failures.push("existing title was removed");

      return failures;
    },
  },
  {
    id: "media-ambiguous-logo-replacement",
    suite: "edit",
    scene: {
      ...mediaEditBase,
      assets: {
        current_logo: {
          id: "current_logo",
          type: "image",
          src: "https://example.test/old-logo.png",
        },
      },
      nodes: [
        {
          id: "logo",
          type: "img",
          assetId: "current_logo",
          from: 0,
          duration: 90,
          style: {
            position: "absolute",
            left: 440,
            top: 160,
            width: 400,
            height: 400,
            objectFit: "contain",
          },
        },
      ],
    },
    mediaAssets,
    prompt:
      "Replace the logo with the uploaded logo image. Keep the same timing and placement.",
    assert: (before, after) => {
      const failures: string[] = [];
      const beforeLogo = nodeById(before, "logo");
      const logo = nodeById(after, "logo");

      if (!after.assets["image_1"]) failures.push("missing image_1 asset");
      if (!logo) failures.push("logo node was removed");
      if (logo?.assetId !== "image_1") failures.push("logo was not repointed to image_1");
      if ((logo?.from ?? -1) !== beforeLogo?.from) failures.push("logo timing changed");
      if ((logo?.duration ?? -1) !== beforeLogo?.duration) failures.push("logo duration changed");
      if (JSON.stringify(logo?.style) !== JSON.stringify(beforeLogo?.style)) {
        failures.push("logo placement/style changed");
      }

      return failures;
    },
  },
];
