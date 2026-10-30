import { describe, expect, it } from "vitest";
import { parseScene, type SceneNodeInput } from "@dojo-video-engine/schema";
import { compileDisplayList, evaluateScene, layoutScene } from "./index.js";

function text(node: Partial<SceneNodeInput>) {
  const scene = parseScene({
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 1,
    assets: {},
    nodes: [
      {
        id: "text",
        type: "text",
        text: "One two three",
        style: {
          position: "absolute",
          left: 20,
          top: 20,
          width: 200,
          height: 100,
          fontSize: 20,
        },
        ...node,
      },
    ],
  });
  const measureTextLine = (value: string) =>
    value === "fi" ? 15 : Array.from(value).length * 10;
  const layout = layoutScene(evaluateScene(scene, 0), { measureTextLine });
  const content = compileDisplayList(layout, { measureTextLine }).groups[0]!
    .content;
  if (content?.kind !== "text") throw new Error("Expected text operation");
  return { content, box: layout.boxes[0]! };
}

describe("shaped text layout intent", () => {
  it("wraps and places glyphs inside padding while keeping the outer box", () => {
    const { content, box } = text({
      style: {
        left: 20,
        top: 20,
        width: 200,
        height: 100,
        padding: 24,
        fontSize: 20,
      },
    });
    expect(box.width).toBe(200);
    expect(content.bounds).toEqual({ x: 44, y: 44, width: 152, height: 52 });
    expect(content.lines[0]!.x).toBe(44);
    expect(content.lines[0]!.maxWidth).toBe(152);
  });
  it("includes fixed padding in intrinsic text height", () => {
    const { box } = text({
      text: "Short",
      style: { width: 200, fontSize: 20, padding: 10, lineHeight: 1 },
    });
    expect(box.height).toBe(40);
    expect(box.content?.height).toBe(20);
  });
  it("uses cumulative shaped advances rather than summing isolated glyph widths", () => {
    const { content } = text({
      text: undefined,
      runs: [{ text: "f" }, { text: "i", style: { color: "#ffff00" } }],
    });
    expect(content.lines[0]!.runs.map((run) => run.width)).toEqual([10, 5]);
  });
  it("places logical RTL runs from the line's right edge", () => {
    const { content } = text({
      text: undefined,
      runs: [{ text: "مرحبا" }, { text: " عالم", style: { color: "#ffff00" } }],
      style: { width: 200, height: 100, direction: "rtl" },
    });
    expect(content.lines[0]!.runs[0]!.x).toBeGreaterThan(
      content.lines[0]!.runs[1]!.x,
    );
  });

  it("keeps an English island in natural order inside an RTL paragraph", () => {
    const { content } = text({
      text: undefined,
      runs: [
        { text: "مرحبا " },
        { text: "hello", style: { color: "#ffff00" } },
        { text: " world" },
      ],
      style: { width: 300, height: 100, direction: "rtl" },
    });
    const runs = content.lines[0]!.runs;
    expect(runs.find((run) => run.text.includes("hello"))!.x).toBeLessThan(
      runs.find((run) => run.text.includes("world"))!.x,
    );
    expect(runs.find((run) => run.text.includes("مرحبا"))!.x).toBeGreaterThan(
      runs.find((run) => run.text.includes("world"))!.x,
    );
  });

  it("lets a rich span disable a node's inherited stroke explicitly", () => {
    const { content } = text({
      text: undefined,
      runs: [
        { text: "Plain", style: { textStroke: "none" } },
        { text: " Outlined" },
      ],
      style: {
        width: 300,
        height: 100,
        textStroke: "3px #000000",
        textShadow: "none",
      },
    });
    expect(content.lines[0]!.runs[0]!.stroke).toBeNull();
    expect(content.lines[0]!.runs[1]!.stroke?.width).toBe(3);
    expect(content.shadow).toBeNull();
  });

  it("inherits fitted active-plate geometry without moving or reflowing glyphs", () => {
    const runs = [
      { text: "Active", style: { textBackgroundColor: "#ff00ff" } },
      { text: " rest" },
    ];
    const plain = text({
      text: undefined,
      runs,
      style: { width: 300, height: 100, fontSize: 20 },
    }).content;
    const padded = text({
      text: undefined,
      runs,
      style: {
        width: 300,
        height: 100,
        fontSize: 20,
        textBackgroundPaddingX: 14,
        textBackgroundPaddingY: 8,
        textBackgroundRadius: 999,
      },
    }).content;
    expect(padded.lines[0]!.background).toBeNull();
    expect(padded.lines[0]!.runs[0]!.background).toEqual({
      color: "#ff00ff",
      paddingX: 14,
      paddingY: 8,
      radius: 999,
    });
    expect(padded.lines[0]!.runs[1]!.background).toBeNull();
    expect(padded.lines[0]!.runs.map((run) => [run.x, run.width])).toEqual(
      plain.lines[0]!.runs.map((run) => [run.x, run.width]),
    );
  });

  it("lets a run override inherited plate padding and corners", () => {
    const { content } = text({
      text: undefined,
      runs: [
        {
          text: "Active",
          style: {
            textBackgroundColor: "#ff00ff",
            textBackgroundPaddingX: 24,
            textBackgroundPaddingY: 12,
            textBackgroundRadius: 20,
          },
        },
      ],
      style: {
        width: 300,
        height: 100,
        textBackgroundPadding: 5,
        textBackgroundRadius: 999,
      },
    });
    expect(content.lines[0]!.runs[0]!.background).toEqual({
      color: "#ff00ff",
      paddingX: 24,
      paddingY: 12,
      radius: 20,
    });
  });
});
