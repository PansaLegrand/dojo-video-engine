import { describe, expect, it } from "vitest";
import {
  validateScene,
  type Scene,
  type SceneAnimation,
} from "@motionforge/schema";
import {
  applyInstructionLocally,
  createSceneFromInstruction,
  extractJsonFromText,
  normalizeModelOutput,
} from "./local-agent";

function nodeById(scene: Scene, id: string) {
  return scene.nodes.find((node) => node.id === id);
}

function animationStart(
  animations: SceneAnimation[] | undefined,
  property: string,
): number {
  const frames =
    animations?.find((animation) => animation.property === property)?.frames ??
    [];
  const [first, second] = frames;

  if (first && second && first.frame === 0 && first.value === second.value) {
    return second.frame;
  }

  return first?.frame ?? -1;
}

describe("local motionforge agent", () => {
  it("creates schema-valid first draft scenes", () => {
    const scene = createSceneFromInstruction(
      "Make a vertical product launch teaser for a new AI video app.",
    );

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(scene.width).toBe(1080);
    expect(scene.height).toBe(1920);
    expect(nodeById(scene, "title")?.text).toContain("Vertical product");
  });

  it("creates native caption-template tracks for named subtitle prompts", () => {
    const scene = createSceneFromInstruction(
      "Make a vertical video with neon karaoke subtitles.",
    );
    const caption = nodeById(scene, "caption");
    const firstSegment = caption?.children?.[0];
    const firstWord = firstSegment?.children?.[0];

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(caption?.type).toBe("div");
    expect(firstWord?.type).toBe("text");
    expect(
      firstWord?.animations?.some((entry) => entry.property === "color"),
    ).toBe(true);
    expect(firstWord?.style?.textStroke).toBe("3px rgba(3,7,18,0.82)");
  });

  it("creates a subtitle template gallery preview from the examples prompt", () => {
    const scene = createSceneFromInstruction(
      "Show a subtitle template gallery previewing all caption styles.",
    );
    const title = nodeById(scene, "title");
    const neonCard = nodeById(scene, "template-neon");
    const spotlightCard = nodeById(scene, "template-spotlight");

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(title?.text).toBe("Subtitle Templates");
    expect(
      scene.nodes.filter((node) => node.id.startsWith("template-")),
    ).toHaveLength(13);
    expect(neonCard?.children?.[1]?.id).toBe("template-neon-sample");
    expect(spotlightCard?.children?.[1]?.children).toHaveLength(4);
  });

  it("uses preset timeline choreography for the first draft", () => {
    const scene = createSceneFromInstruction(
      "Create a kinetic typography scene saying SHIP THE DEMO.",
    );
    const panel = nodeById(scene, "accent-panel");
    const eyebrow = nodeById(scene, "eyebrow");
    const title = nodeById(scene, "title");
    const subtitle = nodeById(scene, "subtitle");
    const caption = nodeById(scene, "caption");

    expect(animationStart(panel?.animations, "transform")).toBe(0);
    expect(animationStart(eyebrow?.animations, "opacity")).toBe(6);
    expect(animationStart(title?.animations, "transform")).toBe(12);
    expect(animationStart(subtitle?.animations, "transform")).toBe(30);
    expect(animationStart(caption?.animations, "transform")).toBe(40);
    expect(
      title?.animations?.some((animation) =>
        animation.frames.some((frame) => frame.easing?.startsWith("spring(")),
      ),
    ).toBe(true);
  });

  it("applies follow-up instructions as patches", () => {
    const scene = createSceneFromInstruction("Make a calm founder update.");
    const result = applyInstructionLocally(scene, "Make the title bigger.");

    expect(result.mode).toBe("patch");
    expect(result.patch).toEqual([
      {
        op: "setStyle",
        id: "title",
        style: { fontSize: 105 },
      },
    ]);
    expect(nodeById(result.scene, "title")?.style?.fontSize).toBe(105);
  });

  it("inserts community subtitle templates as native scene nodes", () => {
    const scene = createSceneFromInstruction("Make a calm founder update.");
    const result = applyInstructionLocally(
      scene,
      "Add terminal subtitle captions near the bottom.",
    );
    const inserted = nodeById(result.scene, "terminal-captions");

    expect(result.mode).toBe("patch");
    expect(result.patch?.[0]).toMatchObject({
      op: "insertNode",
      node: { id: "terminal-captions", type: "div" },
    });
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
    expect(inserted?.children?.[0]?.children?.[0]?.style?.fontFamily).toContain(
      "Courier New",
    );
  });

  it("inserts image overlay presets for existing scene image assets", () => {
    const scene: Scene = {
      ...createSceneFromInstruction("Make a calm founder update."),
      assets: {
        logo: { id: "logo", type: "image", src: "logo.png" },
      },
    };
    const result = applyInstructionLocally(
      scene,
      "Put the logo in the top-right corner as a logo bug.",
    );
    const inserted = nodeById(result.scene, "logoBug-overlay");

    expect(result.mode).toBe("patch");
    expect(result.patch).toHaveLength(1);
    expect(result.patch?.[0]).toMatchObject({
      op: "insertNode",
      node: {
        id: "logoBug-overlay",
        type: "div",
        duration: scene.duration,
        children: [
          { id: "logoBug-overlay-image", type: "img", assetId: "logo" },
        ],
      },
    });
    expect(inserted?.style).toMatchObject({
      left: 858,
      top: 144,
      width: 150,
      height: 145,
      opacity: 0.92,
    });
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });

  it("uses uploaded image mentions for first-draft image overlays", () => {
    const result = applyInstructionLocally(
      null,
      "Add @Logo as a subtle watermark in the bottom-right corner.",
      [
        {
          id: "logo-upload",
          sceneAssetId: "image_1",
          type: "image",
          src: "blob:logo",
          label: "Logo",
          aliases: ["logo"],
          fileName: "logo.png",
          width: 512,
          height: 256,
          alreadyInScene: false,
        },
      ],
    );
    const inserted = nodeById(result.scene, "watermark-overlay");

    expect(result.mode).toBe("scene");
    expect(result.patch).toMatchObject([
      {
        op: "setAsset",
        asset: { id: "image_1", type: "image", src: "blob:logo" },
      },
      {
        op: "insertNode",
        node: {
          id: "watermark-overlay",
          type: "div",
          children: [{ id: "watermark-overlay-image", assetId: "image_1" }],
        },
      },
    ]);
    expect(result.scene.assets.image_1).toMatchObject({
      id: "image_1",
      type: "image",
      src: "blob:logo",
    });
    expect(inserted?.style).toMatchObject({
      left: 821,
      top: 1628,
      width: 187,
      height: 129,
      opacity: 0.42,
    });
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });

  it("inserts video overlay presets for existing scene video assets", () => {
    const scene: Scene = {
      ...createSceneFromInstruction("Make a calm founder update."),
      assets: {
        clip: { id: "clip", type: "video", src: "clip.mp4" },
      },
    };
    const result = applyInstructionLocally(
      scene,
      "Put the clip in the top-right as picture-in-picture.",
    );
    const inserted = nodeById(result.scene, "pictureInPicture-overlay");

    expect(result.mode).toBe("patch");
    expect(result.patch).toHaveLength(1);
    expect(result.patch?.[0]).toMatchObject({
      op: "insertNode",
      node: {
        id: "pictureInPicture-overlay",
        type: "video",
        assetId: "clip",
        volume: 0,
        duration: scene.duration,
      },
    });
    expect(inserted?.style).toMatchObject({
      left: 708,
      top: 144,
      width: 300,
      height: 290,
      borderRadius: 24,
      objectFit: "cover",
    });
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });

  it("uses uploaded video mentions for first-draft video overlays", () => {
    const result = applyInstructionLocally(
      null,
      "Add @Video 1 as a muted b-roll strip near the bottom.",
      [
        {
          id: "video-1",
          sceneAssetId: "video_1",
          type: "video",
          src: "blob:video-1",
          label: "Video 1",
          aliases: ["video one", "first video"],
          fileName: "clip.mp4",
          durationSeconds: 8,
          width: 1280,
          height: 720,
          alreadyInScene: false,
        },
      ],
    );
    const inserted = nodeById(result.scene, "brollStrip-overlay");

    expect(result.mode).toBe("scene");
    expect(result.patch).toMatchObject([
      {
        op: "setAsset",
        asset: { id: "video_1", type: "video", src: "blob:video-1" },
      },
      {
        op: "insertNode",
        node: {
          id: "brollStrip-overlay",
          type: "video",
          assetId: "video_1",
          volume: 0,
        },
      },
    ]);
    expect(result.scene.assets.video_1).toMatchObject({
      id: "video_1",
      type: "video",
      src: "blob:video-1",
    });
    expect(inserted?.style).toMatchObject({
      left: 138,
      top: 1499,
      width: 805,
      height: 258,
      borderRadius: 22,
      objectFit: "cover",
    });
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });

  it("inserts audio overlay presets for existing scene audio assets", () => {
    const scene: Scene = {
      ...createSceneFromInstruction("Make a calm founder update."),
      assets: {
        music: { id: "music", type: "audio", src: "music.mp3" },
      },
    };
    const result = applyInstructionLocally(
      scene,
      "Add looping quiet background music under the whole scene, fade in for 1s and fade out for 2s.",
    );
    const inserted = nodeById(result.scene, "backgroundMusic-overlay");

    expect(result.mode).toBe("patch");
    expect(result.patch).toHaveLength(1);
    expect(result.patch?.[0]).toMatchObject({
      op: "insertNode",
      node: {
        id: "backgroundMusic-overlay",
        type: "audio",
        assetId: "music",
        duration: scene.duration,
        volume: 0.22,
        loop: true,
        volumeEnvelope: [
          { frame: 0, value: 0 },
          { frame: 30, value: 1, easing: "easeOut" },
          { frame: scene.duration - 61, value: 1 },
          { frame: scene.duration - 1, value: 0, easing: "easeIn" },
        ],
      },
    });
    expect(inserted).toMatchObject({
      type: "audio",
      assetId: "music",
      from: 0,
      duration: scene.duration,
      volume: 0.22,
      loop: true,
      volumeEnvelope: [
        { frame: 0, value: 0 },
        { frame: 30, value: 1, easing: "easeOut" },
        { frame: scene.duration - 61, value: 1 },
        { frame: scene.duration - 1, value: 0, easing: "easeIn" },
      ],
    });
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });

  it("uses uploaded audio mentions for first-draft audio overlays", () => {
    const result = applyInstructionLocally(
      null,
      "Play @Ping at 3s as a notification ping.",
      [
        {
          id: "ping",
          sceneAssetId: "audio_1",
          type: "audio",
          src: "blob:ping",
          label: "Ping",
          aliases: ["notification"],
          fileName: "ping.wav",
          durationSeconds: 1,
          alreadyInScene: false,
        },
      ],
    );
    const inserted = nodeById(result.scene, "notificationPing-overlay");

    expect(result.mode).toBe("scene");
    expect(result.patch).toMatchObject([
      {
        op: "setAsset",
        asset: { id: "audio_1", type: "audio", src: "blob:ping" },
      },
      {
        op: "insertNode",
        node: {
          id: "notificationPing-overlay",
          type: "audio",
          assetId: "audio_1",
          from: 90,
          duration: 30,
          volume: 0.65,
        },
      },
    ]);
    expect(result.scene.assets.audio_1).toMatchObject({
      id: "audio_1",
      type: "audio",
      src: "blob:ping",
    });
    expect(inserted).toMatchObject({
      type: "audio",
      assetId: "audio_1",
      from: 90,
      duration: 30,
      volume: 0.65,
    });
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });

  it("compiles local media instructions when uploaded assets are available", () => {
    const result = applyInstructionLocally(
      null,
      'Put video one first from 5 to 10 seconds, then video two full, write text "I love this" on top.',
      [
        {
          id: "video-1",
          sceneAssetId: "video_1",
          type: "video",
          src: "blob:video-1",
          label: "Video 1",
          aliases: ["video one", "first video"],
          fileName: "first.mp4",
          durationSeconds: 20,
          width: 1920,
          height: 1080,
          alreadyInScene: false,
        },
        {
          id: "video-2",
          sceneAssetId: "video_2",
          type: "video",
          src: "blob:video-2",
          label: "Video 2",
          aliases: ["video two", "second video"],
          fileName: "second.mp4",
          durationSeconds: 12,
          width: 1920,
          height: 1080,
          alreadyInScene: false,
        },
      ],
    );

    expect(result.mode).toBe("scene");
    expect(result.patch?.[0]).toEqual({ op: "setSceneMeta", duration: 510 });
    expect(result.scene.nodes.map((node) => node.id)).toEqual([
      "video-1-node",
      "video-2-node",
      "video-2-text",
    ]);
    expect(result.mediaPlan?.steps.map((step) => step.nodeId)).toEqual([
      "video-1-node",
      "video-2-node",
      "video-2-text",
    ]);
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });

  it("repairs model media patches using the uploaded asset manifest", () => {
    const result = normalizeModelOutput(
      {
        patch: [
          {
            op: "insertNode",
            node: {
              id: "model-clip",
              type: "video",
              assetId: "video-1",
              from: 0,
              duration: 90,
              videoStartTime: 2,
              style: { width: 1280, height: 720 },
            },
          },
        ],
        summary: "Added uploaded video.",
      },
      {
        schemaVersion: 1,
        width: 1280,
        height: 720,
        fps: 30,
        duration: 90,
        assets: {},
        nodes: [],
      },
      [
        {
          id: "video-1",
          sceneAssetId: "video_1",
          type: "video",
          src: "blob:video-1",
          label: "Video 1",
          aliases: ["video one", "first video"],
          fileName: "first.mp4",
          durationSeconds: 8,
          width: 1280,
          height: 720,
          alreadyInScene: false,
        },
      ],
    );

    expect(result.patch).toMatchObject([
      { op: "setAsset", asset: { id: "video_1", src: "blob:video-1" } },
      { op: "insertNode", node: { id: "model-clip", assetId: "video_1" } },
    ]);
    expect(result.diagnostics.join("\n")).toContain("Repaired node assetId");
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });

  it("uses explicit unknown-key repair at the model Scene boundary", () => {
    const result = normalizeModelOutput(
      {
        scene: {
          schemaVersion: 1,
          width: 320,
          height: 180,
          fps: 30,
          duration: 30,
          assets: {},
          unknownTop: true,
          nodes: [
            {
              id: "title",
              type: "text",
              text: "Hello",
              unknownNode: true,
            },
          ],
        },
        summary: "Generated a title.",
      },
      null,
    );

    expect(result.mode).toBe("scene");
    expect(result.scene).not.toHaveProperty("unknownTop");
    expect(result.scene.nodes[0]).not.toHaveProperty("unknownNode");
    expect(result.diagnostics.join("\n")).toContain(
      'removed unknown key "unknownTop"',
    );
    expect(result.diagnostics.join("\n")).toContain(
      'removed unknown key "unknownNode"',
    );
  });

  it("repairs model patch ops that put timing inside setNodeProps", () => {
    const scene: Scene = {
      schemaVersion: 1,
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 300,
      assets: {},
      nodes: [
        {
          id: "show-time",
          type: "text",
          text: "16:00",
          from: 0,
          duration: 120,
        },
      ],
    };
    const result = normalizeModelOutput(
      {
        patch: [
          { op: "setNodeProps", props: { duration: 30 } },
          {
            op: "setNodeProps",
            id: "show-time",
            props: { from: 150, duration: 60 },
          },
        ],
        summary: "Updated event timing.",
      },
      scene,
    );

    expect(result.patch).toMatchObject([
      { op: "retime", id: "show-time", from: 150, duration: 60 },
    ]);
    expect(result.scene.nodes[0]).toMatchObject({
      id: "show-time",
      from: 150,
      duration: 60,
    });
    expect(result.diagnostics.join("\n")).toContain(
      "Dropped setNodeProps op because it has no node id",
    );
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });

  it("normalizes common model scene dialect drift", () => {
    const result = normalizeModelOutput(
      {
        scene: {
          meta: { width: 1080, height: 1920, fps: 30, duration: 180 },
          assets: [],
          nodes: [
            {
              id: "count_5",
              type: "text",
              text: "5",
              from: 30,
              duration: 30,
              style: {
                opacity: 0,
                transform: "translateY(20px) scale(0.2) rotate(-10deg)",
              },
              animations: [
                {
                  property: "opacity",
                  keyframes: [
                    { frame: 30, value: 0 },
                    { frame: 35, value: 1 },
                  ],
                },
                {
                  property: "transform",
                  keyframes: [
                    {
                      frame: 30,
                      value: "translateY(60px) scale(0.15) rotate(-18deg)",
                    },
                    {
                      frame: 35,
                      value: "translateY(0px) scale(1.25) rotate(-9deg)",
                    },
                  ],
                },
              ],
            },
          ],
        },
        summary: "Generated countdown.",
      },
      null,
    );

    expect(result.scene).toMatchObject({
      schemaVersion: 1,
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 180,
      assets: {},
    });
    expect(result.scene.nodes[0]?.animations?.[0]).toMatchObject({
      kind: "keyframes",
      property: "opacity",
      frames: [
        { frame: 0, value: 0 },
        { frame: 5, value: 1 },
      ],
    });
    expect(result.scene.nodes[0]?.style?.transform).toBe(
      "translate(0px, 20px) scale(0.2) rotate(-10deg)",
    );
    expect(result.scene.nodes[0]?.animations?.[1]).toMatchObject({
      kind: "keyframes",
      property: "transform",
      frames: [
        {
          frame: 0,
          value: "translate(0px, 60px) scale(0.15) rotate(-18deg)",
        },
        {
          frame: 5,
          value: "translate(0px, 0px) scale(1.25) rotate(-9deg)",
        },
      ],
    });
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });

  it("repairs web animation style keyframes from model scenes", () => {
    const result = normalizeModelOutput(
      {
        scene: {
          schemaVersion: 1,
          width: 1080,
          height: 1920,
          fps: 30,
          duration: 270,
          assets: {},
          nodes: [
            {
              id: "step-card",
              type: "div",
              from: 90,
              duration: 90,
              style: {
                position: "absolute",
                left: 90,
                top: 620,
                width: 900,
                height: 360,
                backgroundColor: "#ffffff",
              },
              animations: [
                {
                  kind: "keyframes",
                  property: "opacity",
                  frames: [
                    { offset: 0, opacity: 0 },
                    { offset: 1, opacity: 1 },
                  ],
                },
                {
                  property: "transform",
                  frames: [
                    {
                      time: 0,
                      value: { translateY: 40, scale: 0.92 },
                    },
                    {
                      time: 1,
                      value: { translateY: 0, scale: 1 },
                      easing: "ease-out",
                    },
                  ],
                },
              ],
            },
          ],
        },
        summary: "Generated tutorial.",
      },
      null,
    );

    expect(result.scene.nodes[0]?.animations?.[0]?.frames).toEqual([
      { frame: 0, value: 0 },
      { frame: 89, value: 1 },
    ]);
    expect(result.scene.nodes[0]?.animations?.[1]?.frames).toEqual([
      {
        frame: 0,
        value: "translate(0px, 40px) scale(0.92)",
      },
      {
        frame: 89,
        value: "translate(0px, 0px) scale(1)",
        easing: "easeOut",
      },
    ]);
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });

  it("drops unsupported style keys from model scenes", () => {
    const result = normalizeModelOutput(
      {
        scene: {
          schemaVersion: 1,
          width: 1080,
          height: 1920,
          fps: 30,
          duration: 300,
          assets: {},
          nodes: [
            {
              id: "event-cta",
              type: "text",
              text: "Get Tickets",
              style: {
                position: "absolute",
                left: 96,
                top: 1460,
                color: "#ffffff",
                fontSize: 68,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                backdropFilter: "blur(12px)",
                backgroundImage: "radial-gradient(circle, #fff, #000)",
                background: "radial-gradient(circle, #fff, #000)",
                filter: "url(#glow) drop-shadow(0px 0px 12px #fff)",
                transform: "translateX(20px)",
              },
            },
          ],
        },
        summary: "Generated invite.",
      },
      null,
    );

    expect(result.scene.nodes[0]?.style).toMatchObject({
      position: "absolute",
      left: 96,
      top: 1460,
      color: "#ffffff",
      fontSize: 68,
      transform: "translate(20px, 0px)",
    });
    expect(result.scene.nodes[0]?.style).not.toHaveProperty("textTransform");
    expect(result.scene.nodes[0]?.style).not.toHaveProperty("whiteSpace");
    expect(result.scene.nodes[0]?.style).not.toHaveProperty("backdropFilter");
    expect(result.scene.nodes[0]?.style).not.toHaveProperty("backgroundImage");
    expect(result.scene.nodes[0]?.style).not.toHaveProperty("background");
    expect(result.scene.nodes[0]?.style).not.toHaveProperty("filter");
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });

  it("normalizes unsupported model style enum values", () => {
    const result = normalizeModelOutput(
      {
        scene: {
          schemaVersion: 1,
          width: 1080,
          height: 1920,
          fps: 30,
          duration: 300,
          assets: {},
          nodes: [
            {
              id: "event-row",
              type: "div",
              style: {
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-evenly",
                flexDirection: "row-reverse",
                position: "fixed",
                overflow: "clip",
                textAlign: "justify",
                fontStyle: "oblique",
              },
            },
          ],
        },
        summary: "Generated invite.",
      },
      null,
    );

    expect(result.scene.nodes[0]?.style).toMatchObject({
      alignItems: "center",
      justifyContent: "space-between",
      flexDirection: "row",
      position: "absolute",
      overflow: "hidden",
      textAlign: "center",
      fontStyle: "italic",
    });
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });

  it("adds context to malformed JSON parse errors", () => {
    expect(() =>
      extractJsonFromText('{"patch":[{"op":"setText"} {"op":"setText"}]}'),
    ).toThrow(/Model JSON near position/);
  });

  it("repairs permanently invisible model text nodes", () => {
    const result = normalizeModelOutput(
      {
        scene: {
          schemaVersion: 1,
          width: 1080,
          height: 1920,
          fps: 30,
          duration: 30,
          assets: {},
          nodes: [
            {
              id: "num_5",
              type: "text",
              text: "5",
              from: 0,
              duration: 30,
              style: {
                opacity: 0,
                fontSize: 520,
                color: "#FFC84A",
              },
              animations: [],
            },
          ],
        },
      },
      null,
    );

    expect(result.scene.nodes[0]?.style?.opacity).toBe(1);
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });
});
