import { describe, expect, it } from "vitest";
import {
  validateScene,
  type SceneAnimation,
  type SceneNode,
} from "@motionforge/schema";
import {
  isSpacelessScriptText,
  joinCaptionWords,
  mergeAnimationsByProperty,
  popIn,
} from "./index.js";
import {
  expandMacroNodeInput,
  expandMacroNodes,
  isMacroNode,
  macroNames,
  macroPromptGuide,
  type MacroContext,
} from "./macros.js";

const ctx: MacroContext = {
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 150,
};

function expectOk(result: ReturnType<typeof expandMacroNodes>) {
  if (!result.ok) {
    throw new Error(`expected ok, got errors:\n${result.errors.join("\n")}`);
  }

  return result;
}

function expectErrors(result: ReturnType<typeof expandMacroNodes>) {
  if (result.ok) {
    throw new Error("expected errors, got ok");
  }

  return result;
}

function validScene(
  nodes: unknown[],
  assets: Record<string, unknown> = {},
): void {
  const result = validateScene({
    schemaVersion: 1,
    width: ctx.width,
    height: ctx.height,
    fps: ctx.fps,
    duration: ctx.duration,
    assets,
    nodes,
  });

  if (!result.ok) {
    throw new Error(`expanded scene invalid:\n${result.errors.join("\n")}`);
  }
}

describe("macro registry", () => {
  it("registers the built-in macros", () => {
    expect(macroNames()).toEqual(
      expect.arrayContaining([
        "textOverlay",
        "imageOverlay",
        "videoOverlay",
        "audioOverlay",
        "transition",
        "subtitles",
        "countdown",
        "effectOverlay",
        "textEffect",
        "cartoonBurst",
        "emphasis",
        "bRoll",
        "lowerThird",
        "titleCard",
        "calloutArrow",
        "kineticText",
        "progressBar",
        "chapterTransition",
        "lottieOverlay",
      ]),
    );
  });

  it("produces prompt documentation with usage examples", () => {
    const guide = macroPromptGuide();

    for (const name of macroNames()) {
      expect(guide).toContain(`- ${name}:`);
      expect(guide).toContain(`{"macro":"${name}"`);
    }
  });

  it("detects macro nodes", () => {
    expect(isMacroNode({ macro: "textOverlay" })).toBe(true);
    expect(isMacroNode({ type: "div" })).toBe(false);
    expect(isMacroNode(null)).toBe(false);
  });
});

describe("textOverlay macro", () => {
  it("expands into a schema-valid node with defaults", () => {
    const result = expectOk(
      expandMacroNodes(
        [{ macro: "textOverlay", template: "lowerThird", title: "Ada" }],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    expect(node.id).toBe("lowerThird-overlay");
    expect(node.type).toBe("div");
    expect(node.duration).toBe(120);
    expect(result.diagnostics.join("\n")).toContain('macro "textOverlay"');
    validScene(result.nodes);
  });

  it("reports missing required slots with the template's slot list", () => {
    const result = expectErrors(
      expandMacroNodes(
        [{ macro: "textOverlay", template: "statCallout" }],
        ctx,
      ),
    );

    expect(result.errors.join("\n")).toContain('requires "value"');
    expect(result.errors.join("\n")).toContain("usage:");
  });

  it("drops unknown params but still enforces required slots", () => {
    // Missing required slot is still a hard, actionable error.
    const missing = expectErrors(
      expandMacroNodes([{ macro: "textOverlay", template: "titleCard" }], ctx),
    );
    expect(missing.errors.join("\n")).toContain('requires "title"');

    // But an unrecognized decoration key is stripped, not fatal: the async
    // generation path has no repair retry, so a stray key must not sink the
    // whole render.
    const ok = expectOk(
      expandMacroNodes(
        [
          {
            macro: "textOverlay",
            template: "titleCard",
            title: "Hi",
            wobblez: 3,
          },
        ],
        ctx,
      ),
    );
    validScene(ok.nodes);
  });

  it("accepts numeric strings for frame params", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "textOverlay",
            title: "Ada",
            from: "30",
            duration: "90.4",
          },
        ],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    expect(node.from).toBe(30);
    expect(node.duration).toBe(90);
  });

  it("keeps generated ids unique against existing scene ids", () => {
    const result = expectOk(
      expandMacroNodes([{ macro: "textOverlay", title: "Ada" }], {
        ...ctx,
        existingIds: ["titleCard-overlay"],
      }),
    );

    expect((result.nodes[0] as SceneNode).id).toBe("titleCard-overlay-2");
  });

  it("accepts blank optional slots and documented style overrides", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "textOverlay",
            template: "lowerThird",
            title: "Ada",
            subtitle: "",
            style: { zIndex: 25 },
            titleStyle: { color: "#f8fafc", fontSize: 84 },
          },
        ],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    expect(node.style?.zIndex).toBe(25);
    expect(node.children).toHaveLength(1);
    expect(node.children?.[0]?.style?.color).toBe("#f8fafc");
    validScene(result.nodes);
  });
});

describe("unknown macros", () => {
  it("suggests close macro names", () => {
    const result = expectErrors(
      expandMacroNodes([{ macro: "textOverlaay", title: "x" }], ctx),
    );

    expect(result.errors[0]).toContain('unknown macro "textOverlaay"');
    expect(result.errors[0]).toContain('"textOverlay"');
  });
});

describe("effect macros", () => {
  it("builds a categorized standalone effect layer", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "effectOverlay",
            effect: "confettiBurst",
            from: 30,
            duration: 45,
            intensity: "high",
            pulse: 0.8,
            spread: 0.7,
            colors: ["#facc15", "#38bdf8"],
            emoji: "!",
          },
        ],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    expect(node.type).toBe("effect");
    expect(node.effect).toBe("confettiBurst");
    expect(node.params?.colors).toEqual(["#facc15", "#38bdf8"]);
    expect(node.params?.pulse).toBe(0.8);
    expect(node.params?.spread).toBe(0.7);
    validScene(result.nodes);
  });

  it("keeps text effects editable by grouping an effect node with a text node", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "textEffect",
            template: "cloudPop",
            accents: ["neonAura", "speedLines"],
            text: "WOW",
            duration: 60,
            intensity: "high",
            scale: 1.4,
            softness: 0.8,
            glow: 0.6,
          },
        ],
        ctx,
      ),
    );

    const group = result.nodes[0] as SceneNode;
    expect(group.type).toBe("div");
    expect(group.children).toHaveLength(4);
    expect(group.children?.[0]).toMatchObject({
      type: "effect",
      effect: "cloudPop",
      params: {
        intensity: "high",
        scale: 1.4,
        softness: 0.8,
        glow: 0.6,
        scope: "text",
      },
    });
    expect(group.children?.[1]).toMatchObject({
      type: "effect",
      effect: "neonAura",
      params: { scope: "text", glow: 0.6 },
    });
    expect(group.children?.[2]).toMatchObject({
      type: "effect",
      effect: "speedLines",
      params: { scope: "text", spread: 0.45 },
    });
    expect(group.children?.[3]).toMatchObject({
      type: "text",
      text: "WOW",
    });
    validScene(result.nodes);
  });

  it("keeps standalone aura overlays subject-sized by default", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "effectOverlay",
            effect: "neonAura",
            duration: 30,
          },
        ],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    expect(node.style?.width).toBeLessThan(ctx.width);
    expect(node.style?.height).toBeLessThan(ctx.height);
    validScene(result.nodes);
  });

  it("normalizes natural effect macro aliases from long prompts", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "textEffect",
            template: "cloud",
            accents: ["speed", "spark"],
            text: "LAUNCH",
            direction: "diagonal-inward",
            amount: 0.8,
            size: "big",
            blurAmount: "soft",
            particles: "80",
            glowIntensity: "strong",
            scope: "around-word",
          },
        ],
        ctx,
      ),
    );

    const group = result.nodes[0] as SceneNode;
    expect(group.children?.[0]).toMatchObject({
      type: "effect",
      effect: "cloudPop",
      params: {
        direction: "diagonal",
        intensity: "high",
        scale: 1.35,
        softness: 0.8,
        particleCount: 80,
        glow: 0.8,
        scope: "text",
      },
    });
    expect(group.children?.[1]).toMatchObject({
      type: "effect",
      effect: "speedLines",
    });
    expect(group.children?.[2]).toMatchObject({
      type: "effect",
      effect: "cartoonBurst",
    });
    validScene(result.nodes);
  });

  it("lifts a node-shaped style object into flat effect params", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "effectOverlay",
            effect: "confettiBurst",
            from: 12,
            duration: 40,
            style: {
              position: "absolute",
              left: 240,
              top: 620,
              width: 600,
              height: 420,
              zIndex: 40,
            },
          },
        ],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    expect(node.type).toBe("effect");
    expect(node.style?.left).toBe(240);
    expect(node.style?.top).toBe(620);
    expect(node.style?.width).toBe(600);
    expect(node.style?.height).toBe(420);
    validScene(result.nodes);
  });

  it("drops a node-shaped animations array on a text effect", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "textEffect",
            template: "cloudPop",
            text: "NOW",
            from: 30,
            duration: 60,
            intensity: "high",
            colors: ["#ffffff", "#bae6fd"],
            style: { left: 100, top: 200 },
            animations: [{ preset: "popIn" }],
          },
        ],
        ctx,
      ),
    );

    const group = result.nodes[0] as SceneNode;
    expect(group.type).toBe("div");
    expect(group.style?.left).toBe(100);
    expect(group.style?.top).toBe(200);
    // The stray animations array must not leak onto the expanded node tree.
    expect(group.animations).toBeUndefined();
    validScene(result.nodes);
  });

  it("keeps the rest of the scene when one node fails to expand", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "textEffect",
            template: "cloudPop",
            text: "OK",
            duration: 60,
          },
          { macro: "definitelyNotAMacro", text: "boom" },
        ],
        ctx,
      ),
    );

    expect(result.nodes).toHaveLength(1);
    expect((result.nodes[0] as SceneNode).type).toBe("div");
    expect(result.diagnostics.join("\n")).toContain("Dropped 1 node");
    validScene(result.nodes);
  });

  it("still fails hard when every node is invalid", () => {
    const result = expectErrors(
      expandMacroNodes([{ macro: "definitelyNotAMacro", text: "boom" }], ctx),
    );

    expect(result.errors.join("\n")).toContain("unknown macro");
  });
});

describe("asset-referencing macros", () => {
  it("errors when the asset is missing, listing same-type assets", () => {
    const result = expectErrors(
      expandMacroNodes([{ macro: "imageOverlay", assetId: "logo" }], {
        ...ctx,
        assets: { photo: { type: "image" }, music: { type: "audio" } },
      }),
    );

    expect(result.errors[0]).toContain('"photo"');
    expect(result.errors[0]).not.toContain('"music"');
  });

  it("errors when the asset has the wrong type", () => {
    const result = expectErrors(
      expandMacroNodes([{ macro: "videoOverlay", assetId: "photo" }], {
        ...ctx,
        assets: { photo: { type: "image" } },
      }),
    );

    expect(result.errors[0]).toContain("image asset");
  });

  it("skips asset checks when ctx.assets is not provided", () => {
    const result = expectOk(
      expandMacroNodes([{ macro: "audioOverlay", assetId: "later" }], ctx),
    );

    expect((result.nodes[0] as SceneNode).type).toBe("audio");
  });
});

describe("subtitles macro", () => {
  it("spreads segments evenly across the scene", () => {
    const result = expectOk(
      expandMacroNodes(
        [{ macro: "subtitles", segments: ["one", "two", "three"] }],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    expect(node.duration).toBe(150);
    expect(node.children).toHaveLength(3);
    expect(node.children?.[0]?.from).toBe(0);
    expect(node.children?.[1]?.from).toBe(50);
    validScene(result.nodes);
  });

  it("honors an explicit window", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "subtitles",
            segments: ["one", "two"],
            from: 30,
            duration: 60,
          },
        ],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    expect(node.from).toBe(30);
    expect(node.duration).toBe(60);
    expect(node.children?.[1]?.from).toBe(30);
    validScene(result.nodes);
  });

  it("applies style and area overrides", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "subtitles",
            segments: ["Bonjour"],
            area: { top: "80%", height: "12%" },
            style: { color: "#ff69b4", fontSize: 64 },
          },
        ],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    const text = node.children?.[0]?.children?.[0];
    expect(node.style?.top).toBe("80%");
    expect(node.style?.height).toBe("12%");
    expect(text?.style?.color).toBe("#ff69b4");
    expect(text?.style?.fontSize).toBe(64);
    validScene(result.nodes);
  });

  it("renders timed segments at exact times (translation flow)", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "subtitles",
            from: 15,
            segments: [
              { text: "Bonjour le monde", startSeconds: 0.5, endSeconds: 1.6 },
              { text: "Bienvenue", startSeconds: 2.5, endSeconds: "3.9" },
            ],
          },
        ],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    expect(node.from).toBe(15);
    // Runs to the last translated line: 3.9s at 30fps = 117 frames.
    expect(node.duration).toBe(117);
    expect(node.children?.[0]?.from).toBe(15);
    expect(node.children?.[1]?.from).toBe(75);
    validScene(result.nodes);
  });

  it("rejects a mix of timed and untimed segments", () => {
    const result = expectErrors(
      expandMacroNodes(
        [
          {
            macro: "subtitles",
            segments: [
              "plain",
              { text: "timed", startSeconds: 1, endSeconds: 2 },
            ],
          },
        ],
        ctx,
      ),
    );

    expect(result.errors.join("\n")).toContain("Mix of timed and untimed");
  });

  it("rejects segments that end before they start", () => {
    const result = expectErrors(
      expandMacroNodes(
        [
          {
            macro: "subtitles",
            segments: [{ text: "bad", startSeconds: 2, endSeconds: 1 }],
          },
        ],
        ctx,
      ),
    );

    expect(result.errors.join("\n")).toContain("greater than startSeconds");
  });
});

describe("captions macro", () => {
  const words = [
    { text: "Hello", startMs: 500, endMs: 900 },
    { text: "world,", startMs: 1000, endMs: 1400 },
    { text: "welcome", startMs: 2000, endMs: 2600 },
  ];
  const ctxWithTranscript: MacroContext = {
    ...ctx,
    transcripts: { video_1: { words } },
  };

  it("expands word-accurate captions from the stored transcript", () => {
    const result = expectOk(
      expandMacroNodes(
        [{ macro: "captions", assetId: "video_1", template: "classic" }],
        ctxWithTranscript,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    // Runs to the last spoken word: 2600ms at 30fps = 78 frames.
    expect(node.duration).toBe(78);
    expect(node.children?.length).toBeGreaterThan(0);
    validScene(result.nodes);
  });

  it("applies trimStart by shifting and dropping words", () => {
    const result = expectOk(
      expandMacroNodes(
        [{ macro: "captions", assetId: "video_1", trimStart: 1.5 }],
        ctxWithTranscript,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    // Only "welcome" (2000..2600ms → 500..1100ms after trim) survives.
    expect(node.duration).toBe(33);
    validScene(result.nodes);
  });

  it("applies karaoke style and highlight overrides", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "captions",
            assetId: "video_1",
            template: "karaoke",
            style: { color: "#ff69b4", fontSize: 72 },
            highlightStyle: { highlightColor: "#ffffff" },
          },
        ],
        ctxWithTranscript,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    const firstWord = node.children?.[0]?.children?.[0];
    expect(firstWord?.style?.color).toBe("#ff69b4");
    expect(firstWord?.style?.fontSize).toBe(72);
    expect(
      firstWord?.animations?.some(
        (animation) =>
          Array.isArray(animation.frames) &&
          animation.frames.some(
            (frame) =>
              typeof frame === "object" &&
              !Array.isArray(frame) &&
              frame.value === "#ffffff",
          ),
      ),
    ).toBe(true);
    validScene(result.nodes);
  });

  it("strips unknown decoration keys instead of failing the patch", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "captions",
            assetId: "video_1",
            template: "karaoke",
            area: { anchor: "bottom-center", margin: 32 },
            style: { color: "#ff69b4", textAlign: "center" },
            highlightStyle: { textStroke: "3px rgba(0,0,0,0.9)" },
          },
        ],
        ctxWithTranscript,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    const firstWord = node.children?.[0]?.children?.[0];
    // Supported keys still apply; unsupported decorations are dropped.
    expect(firstWord?.style?.color).toBe("#ff69b4");
    validScene(result.nodes);
  });

  it("keeps the template highlight color when highlightStyle has no color keys", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "captions",
            assetId: "video_1",
            template: "karaoke",
            highlightStyle: { scale: 2 },
          },
        ],
        ctxWithTranscript,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    const firstWord = node.children?.[0]?.children?.[0];
    // Karaoke's default active-word color must survive the alias transform.
    expect(
      firstWord?.animations?.some(
        (animation) =>
          Array.isArray(animation.frames) &&
          animation.frames.some(
            (frame) =>
              typeof frame === "object" &&
              !Array.isArray(frame) &&
              frame.value === "#ffffff",
          ),
      ),
    ).toBe(true);
    validScene(result.nodes);
  });

  it("prefers highlightStyle.color over the highlightColor alias", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "captions",
            assetId: "video_1",
            template: "karaoke",
            highlightStyle: { color: "#111111", highlightColor: "#222222" },
          },
        ],
        ctxWithTranscript,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    const firstWord = node.children?.[0]?.children?.[0];
    const frameValues = (firstWord?.animations ?? []).flatMap((animation) =>
      Array.isArray(animation.frames)
        ? animation.frames.flatMap((frame) =>
            typeof frame === "object" && !Array.isArray(frame)
              ? [frame.value]
              : [],
          )
        : [],
    );
    expect(frameValues).toContain("#111111");
    expect(frameValues).not.toContain("#222222");
    validScene(result.nodes);
  });

  it("errors when the window has no speech", () => {
    const result = expectErrors(
      expandMacroNodes(
        [{ macro: "captions", assetId: "video_1", trimStart: 10 }],
        ctxWithTranscript,
      ),
    );

    expect(result.errors[0]).toContain("no speech");
  });

  it("errors helpfully when the asset has no transcript", () => {
    const result = expectErrors(
      expandMacroNodes(
        [{ macro: "captions", assetId: "video_2" }],
        ctxWithTranscript,
      ),
    );

    expect(result.errors[0]).toContain('"video_2"');
    expect(result.errors[0]).toContain('"video_1"');
  });

  it("errors when no transcript store exists in the context", () => {
    const result = expectErrors(
      expandMacroNodes([{ macro: "captions", assetId: "video_1" }], ctx),
    );

    expect(result.errors[0]).toContain("subtitles macro");
  });
});

describe("multilingual captions", () => {
  it("joins CJK tokens without spaces and keeps Latin spacing", () => {
    expect(joinCaptionWords(["你", "好", "世", "界"])).toBe("你好世界");
    expect(joinCaptionWords(["Hello", "world", "!"])).toBe("Hello world!");
    expect(joinCaptionWords(["我", "喜欢", "GSAP", "动画"])).toBe(
      "我喜欢 GSAP 动画",
    );
    expect(joinCaptionWords(["こんにちは", "世界"])).toBe("こんにちは世界");
    expect(joinCaptionWords(["안녕하세요", "여러분"])).toBe(
      "안녕하세요 여러분",
    );
    expect(joinCaptionWords(["مرحبا", "بالعالم"])).toBe("مرحبا بالعالم");
  });

  it("detects spaceless-script text", () => {
    expect(isSpacelessScriptText("你好世界这是一个测试")).toBe(true);
    expect(isSpacelessScriptText("Hello world this is a test")).toBe(false);
    expect(isSpacelessScriptText("안녕하세요 여러분")).toBe(false);
  });

  it("renders Chinese captions without inter-character spaces", () => {
    const words = "今天我们来聊聊动画".split("").map((char, index) => ({
      text: char,
      startMs: index * 300,
      endMs: index * 300 + 280,
    }));
    const result = expectOk(
      expandMacroNodes([{ macro: "captions", assetId: "v" }], {
        ...ctx,
        transcripts: { v: { words } },
      }),
    );

    const node = result.nodes[0] as SceneNode;
    const texts: string[] = [];
    const collect = (n: SceneNode) => {
      if (n.type === "text" && n.text) texts.push(n.text);
      (n.children ?? []).forEach(collect);
    };
    collect(node);

    expect(texts.join("")).toContain("今天我们来聊聊动画");
    expect(texts.some((text) => / /.test(text))).toBe(false);
    // 9 single-character tokens fit one 14-token CJK line, not two 8-token lines.
    expect(texts).toHaveLength(1);
    validScene(result.nodes);
  });
});

describe("countdown macro", () => {
  it("builds one beat per number plus the finale", () => {
    const result = expectOk(
      expandMacroNodes(
        [{ macro: "countdown", start: 5, end: 1, finale: "GO!" }],
        { ...ctx, duration: 300 },
      ),
    );

    const node = result.nodes[0] as SceneNode;
    expect(node.children).toHaveLength(6);
    expect(node.duration).toBe(180);
    expect(node.children?.[5]?.text).toBe("GO!");
    expect(node.children?.[1]?.from).toBe(30);
    validScene(result.nodes);
  });

  it("accepts a total duration and treats a blank finale as omitted", () => {
    const result = expectOk(
      expandMacroNodes(
        [{ macro: "countdown", start: 3, end: 1, duration: 75, finale: "" }],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    expect(node.children).toHaveLength(3);
    expect(node.duration).toBe(75);
    expect(node.children?.map((child) => child.from)).toEqual([0, 25, 50]);
    expect(node.children?.map((child) => child.duration)).toEqual([25, 25, 25]);
    validScene(result.nodes);
  });

  it("suggests a setSceneMeta op when the scene is too short", () => {
    const result = expectOk(
      expandMacroNodes([{ macro: "countdown", start: 10 }], ctx),
    );

    expect(result.diagnostics.join("\n")).toContain("setSceneMeta");
  });

  it("rejects countdowns that count up", () => {
    const result = expectErrors(
      expandMacroNodes([{ macro: "countdown", start: 3, end: 5 }], ctx),
    );

    expect(result.errors.join("\n")).toContain("counts down");
  });
});

describe("transition macro", () => {
  it("defaults to a mid-scene position", () => {
    const result = expectOk(
      expandMacroNodes([{ macro: "transition", template: "dipToBlack" }], ctx),
    );

    const node = result.nodes[0] as SceneNode;
    expect(node.from).toBe(66);
    validScene(result.nodes);
  });
});

describe("place intent", () => {
  it("wraps the node in a safe-area flex wrapper and hoists timing", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            id: "headline",
            type: "text",
            text: "Hello",
            from: 12,
            duration: 60,
            place: { anchor: "bottom-center", margin: 24 },
          },
        ],
        ctx,
      ),
    );

    const wrapper = result.nodes[0] as SceneNode;
    expect(wrapper.id).toBe("headline-place");
    expect(wrapper.from).toBe(12);
    expect(wrapper.duration).toBe(60);
    expect(wrapper.style?.position).toBe("absolute");
    expect(wrapper.style?.justifyContent).toBe("flex-end");
    expect(wrapper.style?.alignItems).toBe("center");

    const child = wrapper.children?.[0];
    expect(child?.id).toBe("headline");
    expect(child?.from).toBeUndefined();
    validScene(result.nodes);
  });

  it("anchors against raw edges when safeArea is false", () => {
    const withSafeArea = expectOk(
      expandMacroNodes(
        [{ id: "a", type: "text", text: "x", place: { anchor: "top-left" } }],
        ctx,
      ),
    );
    const withoutSafeArea = expectOk(
      expandMacroNodes(
        [
          {
            id: "a",
            type: "text",
            text: "x",
            place: { anchor: "top-left", safeArea: false },
          },
        ],
        ctx,
      ),
    );

    const safeLeft = (withSafeArea.nodes[0] as SceneNode).style?.left as number;
    const rawLeft = (withoutSafeArea.nodes[0] as SceneNode).style
      ?.left as number;
    expect(safeLeft).toBeGreaterThan(0);
    expect(rawLeft).toBe(0);
  });

  it("rejects place on nested nodes", () => {
    const result = expectErrors(
      expandMacroNodes(
        [
          {
            id: "parent",
            type: "div",
            children: [
              {
                id: "child",
                type: "text",
                text: "x",
                place: { anchor: "center" },
              },
            ],
          },
        ],
        ctx,
      ),
    );

    expect(result.errors[0]).toContain("scene root");
  });

  it("rejects unknown place keys", () => {
    const result = expectErrors(
      expandMacroNodes(
        [
          {
            id: "a",
            type: "text",
            text: "x",
            place: { anchor: "center", align: "left" },
          },
        ],
        ctx,
      ),
    );

    expect(result.errors.join("\n")).toContain("place supports only");
  });
});

describe("textRole intent", () => {
  it("fills composition-scaled typography without overriding the author", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            id: "t",
            type: "text",
            text: "Hi",
            textRole: "title",
            style: { color: "#fff", fontWeight: 500 },
          },
        ],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    expect(node.style?.fontSize).toBe(Math.round(0.085 * 1080));
    expect(node.style?.fontWeight).toBe(500);
    expect(node.style?.color).toBe("#fff");
    expect(node.style?.textFit).toBe("shrink");
    expect((node as Record<string, unknown>).textRole).toBeUndefined();
    validScene(result.nodes);
  });

  it("rejects textRole on non-text nodes", () => {
    const result = expectErrors(
      expandMacroNodes([{ id: "d", type: "div", textRole: "title" }], ctx),
    );

    expect(result.errors[0]).toContain("text nodes");
  });

  it("lists roles for unknown values", () => {
    const result = expectErrors(
      expandMacroNodes(
        [{ id: "t", type: "text", text: "x", textRole: "headline" }],
        ctx,
      ),
    );

    expect(result.errors[0]).toContain("display, title, subtitle");
  });
});

describe("look and layout intents", () => {
  it("merges media looks and clip layouts with node style winning", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            id: "clip",
            type: "video",
            assetId: "v",
            look: "cinematicWarm",
            layout: "pictureInPicture",
            style: { borderRadius: 12 },
          },
        ],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    expect(node.style?.filter).toContain("brightness");
    expect(node.style?.position).toBe("absolute");
    expect(node.style?.borderRadius).toBe(12);
    expect((node as Record<string, unknown>).look).toBeUndefined();
    validScene(result.nodes, {
      v: { id: "v", type: "video", src: "clip.mp4" },
    });
  });

  it("lists available presets for unknown keys", () => {
    const result = expectErrors(
      expandMacroNodes(
        [{ id: "clip", type: "video", assetId: "v", look: "warm" }],
        ctx,
      ),
    );

    expect(result.errors[0]).toContain("cinematicWarm");
  });
});

describe("media motion params", () => {
  it("placement overrides the template position", () => {
    const expand = (placement: string) =>
      expectOk(
        expandMacroNodes(
          [
            {
              macro: "imageOverlay",
              template: "sticker",
              assetId: "a",
              placement,
            },
          ],
          ctx,
        ),
      ).nodes[0] as SceneNode;

    const topLeft = expand("topLeft");
    const bottomRight = expand("bottomRight");
    expect(topLeft.style?.left).not.toBe(bottomRight.style?.left);
    expect(topLeft.style?.top).not.toBe(bottomRight.style?.top);
  });

  it("enter picks the entrance preset and none disables it", () => {
    const withPop = expectOk(
      expandMacroNodes(
        [{ macro: "videoOverlay", assetId: "v", enter: "popIn" }],
        ctx,
      ),
    ).nodes[0] as SceneNode;
    const withNone = expectOk(
      expandMacroNodes(
        [{ macro: "videoOverlay", assetId: "v", enter: "none" }],
        ctx,
      ),
    ).nodes[0] as SceneNode;

    const popTransform = withPop.animations?.find(
      (animation) => animation.property === "transform",
    );
    expect(String(popTransform?.frames[0]?.value)).toContain("scale");
    expect(withNone.animations).toEqual([]);
  });

  it("exit fades out at the end and merges with the entrance track", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "imageOverlay",
            assetId: "a",
            duration: 90,
            enter: "fadeIn",
            exit: "fadeOut",
          },
        ],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    const opacityTracks = (node.animations ?? []).filter(
      (animation) => animation.property === "opacity",
    );

    // One merged track: 0 at frame 0 (enter kept) and 0 at the final frame.
    expect(opacityTracks).toHaveLength(1);
    const frames = opacityTracks[0]?.frames ?? [];
    expect(frames[0]).toMatchObject({ frame: 0, value: 0 });
    expect(frames[frames.length - 1]).toMatchObject({ frame: 89, value: 0 });
    validScene(result.nodes, {
      a: { id: "a", type: "image", src: "a.png" },
    });
  });

  it("look applies a filter treatment", () => {
    const video = expectOk(
      expandMacroNodes(
        [{ macro: "videoOverlay", assetId: "v", look: "cinematicWarm" }],
        ctx,
      ),
    ).nodes[0] as SceneNode;
    const image = expectOk(
      expandMacroNodes(
        [{ macro: "imageOverlay", assetId: "a", look: "coolNoir" }],
        ctx,
      ),
    ).nodes[0] as SceneNode;

    expect(video.style?.filter).toContain("brightness");
    expect(image.children?.[0]?.style?.filter).toContain("brightness");
  });

  it("textOverlay accepts enter and exit too", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "textOverlay",
            title: "Bye",
            duration: 60,
            enter: "popIn",
            exit: "popOut",
          },
        ],
        ctx,
      ),
    );

    const node = result.nodes[0] as SceneNode;
    const transform = (node.animations ?? []).filter(
      (animation) => animation.property === "transform",
    );
    expect(transform).toHaveLength(1);
    expect(
      String(transform[0]?.frames[transform[0].frames.length - 1]?.value),
    ).toContain("0.85");
    validScene(result.nodes);
  });
});

describe("mergeAnimationsByProperty", () => {
  it("merges an entrance and an anchored exit into one valid track", () => {
    const enter = popIn();
    const exit: SceneAnimation = {
      kind: "keyframes",
      property: "opacity",
      frames: [
        { frame: 0, value: 1 },
        { frame: 78, value: 1 },
        { frame: 89, value: 0, easing: "easeIn" },
      ],
    };

    const merged = mergeAnimationsByProperty([...enter, exit]);
    const opacity = merged.find((entry) => entry.property === "opacity");

    expect(merged.filter((entry) => entry.property === "opacity")).toHaveLength(
      1,
    );
    expect(opacity?.frames[0]).toMatchObject({ frame: 0, value: 0 });
    expect(opacity?.frames[opacity.frames.length - 1]).toMatchObject({
      frame: 89,
      value: 0,
    });

    // Strictly increasing frames — the schema invariant.
    const frames = opacity?.frames ?? [];
    for (let index = 1; index < frames.length; index += 1) {
      expect(frames[index]!.frame).toBeGreaterThan(frames[index - 1]!.frame);
    }
  });

  it("leaves single tracks and distinct properties untouched", () => {
    const tracks = popIn();
    expect(mergeAnimationsByProperty(tracks)).toEqual(tracks);
  });

  it("lets the later track win on true overlaps", () => {
    const first: SceneAnimation = {
      kind: "keyframes",
      property: "opacity",
      frames: [
        { frame: 0, value: 0 },
        { frame: 20, value: 1 },
      ],
    };
    const second: SceneAnimation = {
      kind: "keyframes",
      property: "opacity",
      frames: [
        { frame: 10, value: 0.5 },
        { frame: 30, value: 0 },
      ],
    };

    const merged = mergeAnimationsByProperty([first, second]);
    expect(merged[0]?.frames).toEqual([
      { frame: 0, value: 0 },
      { frame: 10, value: 0.5 },
      { frame: 30, value: 0 },
    ]);
  });
});

describe("walker", () => {
  it("expands macros nested inside children", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            id: "wrap",
            type: "div",
            children: [{ macro: "textOverlay", title: "Nested" }],
          },
        ],
        ctx,
      ),
    );

    const child = (result.nodes[0] as SceneNode).children?.[0];
    expect(child?.id).toBe("titleCard-overlay");
    validScene(result.nodes);
  });

  it("collects every error instead of stopping at the first", () => {
    const result = expectErrors(
      expandMacroNodes(
        [
          { macro: "nope" },
          { macro: "textOverlay", template: "statCallout" },
          { id: "t", type: "text", text: "x", textRole: "huge" },
        ],
        ctx,
      ),
    );

    expect(result.errors.join("\n")).toContain("unknown macro");
    expect(result.errors.join("\n")).toContain('requires "value"');
    expect(result.errors.join("\n")).toContain("huge");
  });

  it("gates place by root position in single-node mode", () => {
    const node = {
      id: "x",
      type: "text",
      text: "hi",
      place: { anchor: "center" },
    };

    const atRoot = expandMacroNodeInput(node, ctx, { atRoot: true });
    expect(atRoot.ok).toBe(true);

    const nested = expandMacroNodeInput(node, ctx, { atRoot: false });
    expect(nested.ok).toBe(false);
  });
});

describe("emphasis macro", () => {
  it("expands the default scribble look with a ~5s hold", () => {
    const result = expectOk(
      expandMacroNodes(
        [{ macro: "emphasis", text: "3 MILLION", from: 30 }],
        ctx,
      ),
    );
    const node = result.nodes[0] as SceneNode;

    expect(node.type).toBe("div");
    expect(node.from).toBe(30);
    // 5s at 30fps clamped by the 150-frame scene: 150 - 30 = 120.
    expect(node.duration).toBe(120);
    expect(node.style?.top).toBe(Math.round(1920 * 0.14));
    expect(node.style?.width).toBe(Math.round(1080 * 0.76));

    const effects = (node.children ?? []).filter(
      (child) => child.type === "effect",
    );
    expect(effects.map((child) => child.effect)).toEqual([
      "scribbleCircle",
      "neonAura",
    ]);
    const text = (node.children ?? []).find((child) => child.type === "text");
    expect(text?.text).toBe("3 MILLION");
  });

  it("maps looks, position, and calm tempo", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "emphasis",
            text: "glow",
            look: "glow",
            position: "bottom",
            tempo: "calm",
            duration: 60,
          },
        ],
        ctx,
      ),
    );
    const node = result.nodes[0] as SceneNode;

    expect(node.style?.top).toBe(Math.round(1920 * 0.68));
    const effects = (node.children ?? []).filter(
      (child) => child.type === "effect",
    );
    expect(effects.map((child) => child.effect)).toEqual(["neonAura"]);
    expect(effects[0]?.params?.intensity).toBe("medium");
    expect(effects[0]?.params?.glow).toBe(0.7);
  });

  it("expands validly inside a real scene", () => {
    const result = expectOk(
      expandMacroNodes(
        [{ macro: "emphasis", text: "valid", from: 0, duration: 90 }],
        ctx,
      ),
    );
    const validation = validateScene({
      schemaVersion: 1,
      width: ctx.width,
      height: ctx.height,
      fps: ctx.fps,
      duration: ctx.duration,
      assets: {},
      nodes: result.nodes,
    });
    expect(validation.ok).toBe(true);
  });

  it("rejects unknown looks", () => {
    const result = expectErrors(
      expandMacroNodes(
        [{ macro: "emphasis", text: "x", look: "sparkle" }],
        ctx,
      ),
    );
    expect(result.errors.join(" ")).toContain("look");
  });
});

describe("designed motion-graphic macros", () => {
  it("expands lowerThird as a designed text overlay", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "lowerThird",
            title: "Ada Lovelace",
            subtitle: "Analyst",
            palette: "mint",
            align: "right",
            duration: 90,
          },
        ],
        ctx,
      ),
    );
    const node = result.nodes[0] as SceneNode;

    expect(node.id).toBe("lower-third");
    expect(node.type).toBe("div");
    expect(node.children?.some((child) => child.text === "Ada Lovelace")).toBe(
      true,
    );
    expect(
      node.animations?.some((animation) => animation.property === "opacity"),
    ).toBe(true);
    validScene(result.nodes);
  });

  it("expands titleCard with palette-aware title styling", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "titleCard",
            title: "The Launch",
            subtitle: "Week one recap",
            look: "bold",
            palette: "sunrise",
            duration: 90,
          },
        ],
        ctx,
      ),
    );
    const node = result.nodes[0] as SceneNode;
    const title = node.children?.find((child) => child.id.endsWith("-title"));

    expect(node.id).toBe("title-card");
    expect(title?.text).toBe("The Launch");
    expect(title?.style?.fontSize).toBe(128);
    validScene(result.nodes);
  });

  it("expands calloutArrow into an annotation group", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "calloutArrow",
            text: "New dashboard",
            corner: "topRight",
            duration: 75,
          },
        ],
        ctx,
      ),
    );
    const node = result.nodes[0] as SceneNode;

    expect(node.type).toBe("div");
    expect(node.children?.map((child) => child.id)).toEqual([
      "callout-arrow-line",
      "callout-arrow-head",
      "callout-arrow-label",
    ]);
    validScene(result.nodes);
  });

  it("expands kineticText into staggered editable word nodes", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "kineticText",
            text: "SHIP IT TODAY",
            look: "wordPop",
            tempo: "energetic",
            duration: 90,
          },
        ],
        ctx,
      ),
    );
    const node = result.nodes[0] as SceneNode;

    expect(node.children?.map((child) => child.text)).toEqual([
      "SHIP",
      "IT",
      "TODAY",
    ]);
    expect(
      node.children?.[1]?.animations?.[0]?.frames[1]?.frame,
    ).toBeGreaterThan(0);
    validScene(result.nodes);
  });

  it("expands progressBar with an animated fill", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "progressBar",
            label: "Funded",
            value: "72%",
            percent: 72,
            duration: 90,
          },
        ],
        ctx,
      ),
    );
    const node = result.nodes[0] as SceneNode;
    const track = node.children?.find(
      (child) => child.id === "progress-bar-track",
    );
    const fill = track?.children?.[0];

    expect(fill?.style?.width).toBe("72%");
    expect(fill?.animations?.[0]?.property).toBe("transform");
    validScene(result.nodes);
  });

  it("expands chapterTransition as a full-frame transition card", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "chapterTransition",
            chapter: "02",
            title: "The Build",
            subtitle: "Prototype to launch",
            duration: 75,
          },
        ],
        ctx,
      ),
    );
    const node = result.nodes[0] as SceneNode;

    expect(node.style?.inset).toBe(0);
    expect(node.children?.some((child) => child.text === "The Build")).toBe(
      true,
    );
    validScene(result.nodes);
  });
});

describe("lottieOverlay macro", () => {
  const lottieCtx: MacroContext = {
    ...ctx,
    assets: {
      sparkle: { type: "lottie" },
      logo: { type: "image" },
    },
  };

  it("places a lottie asset with placement and playback controls", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "lottieOverlay",
            assetId: "sparkle",
            placement: "topRight",
            size: 240,
            playbackRate: 1.5,
            tone: "bright",
            duration: 90,
          },
        ],
        lottieCtx,
      ),
    );
    const node = result.nodes[0] as SceneNode;

    expect(node.type).toBe("lottie");
    expect(node.assetId).toBe("sparkle");
    expect(node.playbackRate).toBe(1.5);
    expect(node.style?.width).toBe(240);
    expect(node.style?.filter).toContain("brightness");
    validScene(result.nodes, {
      sparkle: { id: "sparkle", type: "lottie", src: "sparkle.json" },
    });
  });

  it("rejects non-lottie assets", () => {
    const result = expectErrors(
      expandMacroNodes(
        [{ macro: "lottieOverlay", assetId: "logo" }],
        lottieCtx,
      ),
    );

    expect(result.errors.join(" ")).toContain("needs a lottie asset");
  });
});

describe("bRoll macro", () => {
  const brollCtx: MacroContext = {
    ...ctx,
    assets: {
      beach: { type: "image" },
      demo: { type: "video" },
      song: { type: "audio" },
    },
  };

  it("expands full-frame image B-roll with Ken Burns by default", () => {
    const result = expectOk(
      expandMacroNodes(
        [{ macro: "bRoll", assetId: "beach", from: 30, duration: 90 }],
        brollCtx,
      ),
    );
    const node = result.nodes[0] as SceneNode;

    expect(node.type).toBe("div");
    expect(node.from).toBe(30);
    expect(node.duration).toBe(90);
    expect(node.style?.inset).toBe(0);

    const media = node.children?.[0];
    expect(media?.type).toBe("img");
    expect(media?.style?.objectFit).toBe("cover");
    const kenBurns = media?.animations?.find(
      (animation) => animation.property === "transform",
    );
    expect(kenBurns?.frames[0]?.value).toContain("scale(1.05)");
    expect(kenBurns?.frames[1]?.frame).toBe(90);
  });

  it("mutes full-frame video B-roll by default and honors trim", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "bRoll",
            assetId: "demo",
            duration: 60,
            trimStart: 3,
            kenBurns: true,
          },
        ],
        brollCtx,
      ),
    );
    const media = (result.nodes[0] as SceneNode).children?.[0];

    expect(media?.type).toBe("video");
    expect(media?.volume).toBe(0);
    expect(media?.videoStartTime).toBe(3);
    // Ken Burns applies to stills only.
    expect(
      media?.animations?.some(
        (animation) => animation.property === "transform",
      ),
    ).toBe(false);
  });

  it("delegates pip mode to the corner overlay macros", () => {
    const result = expectOk(
      expandMacroNodes(
        [{ macro: "bRoll", assetId: "demo", mode: "pip", duration: 60 }],
        brollCtx,
      ),
    );
    const node = result.nodes[0] as SceneNode;
    // videoOverlay pictureInPicture returns the video node itself: corner
    // box, muted, pop-in.
    expect(node.type).toBe("video");
    expect(node.duration).toBe(60);
    expect(node.volume).toBe(0);
    expect(node.style?.borderRadius).toBe(24);
  });

  it("rejects audio assets and unknown assets", () => {
    const audio = expectErrors(
      expandMacroNodes([{ macro: "bRoll", assetId: "song" }], brollCtx),
    );
    expect(audio.errors.join(" ")).toContain("image or video");

    const unknown = expectErrors(
      expandMacroNodes([{ macro: "bRoll", assetId: "nope" }], brollCtx),
    );
    expect(unknown.errors.join(" ")).toContain("not in scene.assets");
  });

  it("expands validly inside a real scene", () => {
    const result = expectOk(
      expandMacroNodes(
        [{ macro: "bRoll", assetId: "beach", from: 0, duration: 60 }],
        brollCtx,
      ),
    );
    const validation = validateScene({
      schemaVersion: 1,
      width: ctx.width,
      height: ctx.height,
      fps: ctx.fps,
      duration: ctx.duration,
      assets: {
        beach: { id: "beach", type: "image", src: "asset:beach" },
      },
      nodes: result.nodes,
    });
    expect(validation.ok).toBe(true);
  });
});

describe("macro default zIndex bands", () => {
  it("gives overlay macros a zIndex so later-inserted base media cannot bury them", () => {
    const overlays: Array<[Record<string, unknown>, number]> = [
      [{ macro: "textOverlay", template: "titleCard", title: "Hi" }, 40],
      [{ macro: "lowerThird", title: "Anna", subtitle: "Producer" }, 44],
    ];

    for (const [input, expected] of overlays) {
      const result = expectOk(expandMacroNodes([input], ctx));
      const node = result.nodes[0] as SceneNode;
      expect(node.style?.zIndex, JSON.stringify(input)).toBe(expected);
    }
  });

  it("keeps an explicit style zIndex over the default", () => {
    const result = expectOk(
      expandMacroNodes(
        [
          {
            macro: "textOverlay",
            template: "titleCard",
            title: "Hi",
            style: { zIndex: 7 },
          },
        ],
        ctx,
      ),
    );
    expect((result.nodes[0] as SceneNode).style?.zIndex).toBe(7);
  });
});
