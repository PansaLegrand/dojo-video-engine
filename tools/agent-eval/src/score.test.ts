import { describe, expect, it } from "vitest";
import { cases, type EditCase, type GenerateCase } from "./cases.js";
import { extractJson, scoreReply } from "./score.js";

const byId = <T extends { id: string }>(id: string) =>
  cases.find((c) => c.id === id) as unknown as T;

describe("extractJson", () => {
  it("parses fenced, bare, and prose-wrapped JSON", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('[{"op":"removeNode","id":"x"}]')).toEqual([
      { op: "removeNode", id: "x" },
    ]);
    expect(extractJson('Sure! Here is the patch:\n[{"a":1}]\nHope that helps.')).toEqual([
      { a: 1 },
    ]);
    expect(extractJson("no json here")).toBeUndefined();
  });
});

describe("scoreReply — generate suite", () => {
  const genCase = byId<GenerateCase>("gen-minimal-title");

  it("passes a correct scene", () => {
    const scene = {
      schemaVersion: 1,
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 90,
      assets: {},
      nodes: [
        { id: "bg", type: "div", style: { width: "100%", height: "100%", backgroundColor: "#101820" } },
        {
          id: "title",
          type: "text",
          text: "HELLO WORLD",
          style: { position: "absolute", left: 64, right: 64, top: 900, fontSize: 72, color: "#ffffff", textAlign: "center" },
          animations: [
            { kind: "keyframes", property: "opacity", frames: [{ frame: 0, value: 0 }, { frame: 12, value: 1 }] },
          ],
        },
      ],
    };

    const result = scoreReply(genCase, JSON.stringify(scene));
    expect(result.failures).toEqual([]);
    expect(result.pass).toBe(true);
  });

  it("fails an invalid scene with validator messages", () => {
    const result = scoreReply(genCase, '{"schemaVersion": 1,"width":1080}');
    expect(result.pass).toBe(false);
    expect(result.failures.join("\n")).toContain("validateScene");
  });

  it("fails a valid scene that misses the assertion", () => {
    const scene = {
      schemaVersion: 1,
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 60, // wrong: case wants 90
      nodes: [],
    };
    const result = scoreReply(genCase, JSON.stringify(scene));
    expect(result.pass).toBe(false);
    expect(result.failures.join("\n")).toContain("duration 60");
  });
});

describe("scoreReply — edit suite", () => {
  const editCase = byId<EditCase>("edit-bigger-title");

  it("passes a correct patch and enforces untouched-node identity", () => {
    const patch = [{ op: "setStyle", id: "title", style: { fontSize: 128 } }];
    const result = scoreReply(editCase, "```json\n" + JSON.stringify(patch) + "\n```");
    expect(result.failures).toEqual([]);
    expect(result.pass).toBe(true);
  });

  it("fails a patch that edits the wrong node", () => {
    const patch = [{ op: "setStyle", id: "subtitle", style: { fontSize: 128 } }];
    const result = scoreReply(editCase, JSON.stringify(patch));
    expect(result.pass).toBe(false);
    expect(result.failures.join("\n")).toContain("subtitle changed");
  });

  it("surfaces applyScenePatch errors (misspelled id)", () => {
    const patch = [{ op: "setStyle", id: "titel", style: { fontSize: 128 } }];
    const result = scoreReply(editCase, JSON.stringify(patch));
    expect(result.pass).toBe(false);
    expect(result.failures.join("\n")).toContain('Closest existing ids');
  });

  it("removal case checks both removal and collateral damage", () => {
    const removal = byId<EditCase>("edit-remove-subtitle");
    const good = scoreReply(removal, '[{"op":"removeNode","id":"subtitle"}]');
    expect(good.pass).toBe(true);

    const tooMuch = scoreReply(
      removal,
      '[{"op":"removeNode","id":"subtitle"},{"op":"removeNode","id":"title"}]',
    );
    expect(tooMuch.pass).toBe(false);
    expect(tooMuch.failures.join("\n")).toContain("title was removed too");
  });

  it("scores media sequence patches after manifest-based repair", () => {
    const media = byId<EditCase>("media-two-video-sequence");
    const patch = [
      {
        op: "insertNode",
        node: {
          id: "first",
          type: "video",
          assetId: "video-1",
          from: 0,
          duration: 150,
          videoStartTime: 5,
          style: { width: 1280, height: 720, objectFit: "cover" },
        },
      },
      {
        op: "insertNode",
        node: {
          id: "second",
          type: "video",
          assetId: "video-2",
          from: 150,
          duration: 360,
          videoStartTime: 0,
          style: { width: 1280, height: 720, objectFit: "cover" },
        },
      },
      {
        op: "insertNode",
        node: {
          id: "overlay",
          type: "text",
          text: "I love this",
          from: 150,
          duration: 360,
          style: { position: "absolute", top: 60, color: "#ffffff" },
        },
      },
    ];

    const result = scoreReply(media, JSON.stringify(patch));
    expect(result.failures).toEqual([]);
    expect(result.pass).toBe(true);
  });

  it("fails media patches that reference unresolved uploaded assets", () => {
    const media = byId<EditCase>("media-two-video-sequence");
    const result = scoreReply(
      media,
      JSON.stringify([
        {
          op: "insertNode",
          node: { id: "missing", type: "video", assetId: "video-99" },
        },
      ]),
    );

    expect(result.pass).toBe(false);
    expect(result.failures.join("\n")).toContain("repairMediaPatch");
  });
});
