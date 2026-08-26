import { describe, expect, it } from "vitest";
import {
  authorizeIterativeAgentDecision,
  buildIterativeDecisionPrompt,
  buildIterativeDecisionSystemPrompt,
  iterativeAgentDecisionSchema,
} from "./iterative-decision";

describe("iterative model decisions", () => {
  it("accepts typed commands and rejects whole-Scene or patch-shaped replies", () => {
    expect(
      iterativeAgentDecisionSchema.safeParse({
        kind: "command",
        commands: [{ kind: "text.set", id: "title", text: "Updated" }],
        summary: "Updated the title.",
      }).success,
    ).toBe(true);
    expect(
      iterativeAgentDecisionSchema.safeParse({
        kind: "observe",
        observation: {
          kind: "search",
          query: "hidden title",
          types: ["text"],
          limit: 10,
        },
      }).success,
    ).toBe(true);
    for (const invalid of [
      { kind: "command", commands: [], scene: { schemaVersion: 1 } },
      { kind: "command", commands: [{ op: "setText", id: "title" }] },
      { kind: "finish", summary: "Done", unexpected: true },
      { kind: "observe", observation: { kind: "search" } },
      { kind: "observe", observation: { kind: "node", id: "" } },
    ]) {
      expect(iterativeAgentDecisionSchema.safeParse(invalid).success).toBe(
        false,
      );
    }
  });

  it("prompts from flat observations without embedding a complete Scene", () => {
    const prompt = buildIterativeDecisionPrompt(
      {
        instruction: "Make the title larger",
        mode: "edit",
        handle: "session:w1",
        revision: 4,
        turn: 1,
        inspection: {
          view: "summary",
          nodes: [{ id: "title", type: "text", style: { fontSize: 64 } }],
        },
      },
      [{ role: "user", content: "Earlier request" }],
    );
    expect(prompt).toContain('"revision": 4');
    expect(prompt).toContain('"id": "title"');
    expect(prompt).not.toContain('"assets":');
    expect(prompt).not.toContain('"schemaVersion":');

    const system = buildIterativeDecisionSystemPrompt([]);
    expect(system).toContain("never emit or replace a complete Scene");
    expect(system).toContain("transactionally");
    expect(system).toContain("use observe before editing");
  });

  it("authorizes asset commands against exact manifest tuples", () => {
    const media = [
      {
        id: "video-1",
        sceneAssetId: "video_1",
        type: "video" as const,
        src: "blob:https://app.test/one",
        label: "Video 1",
        aliases: ["first video"],
        fileName: "one.mp4",
        alreadyInScene: false,
      },
    ];
    expect(
      authorizeIterativeAgentDecision(
        {
          kind: "command",
          commands: [
            {
              kind: "asset.set",
              asset: {
                id: "@first video",
                type: "video",
                src: "blob:https://app.test/one",
                metadata: { duration: 999 },
              },
            },
          ],
        },
        media,
      ),
    ).toMatchObject({
      commands: [
        {
          kind: "asset.set",
          asset: {
            id: "video_1",
            type: "video",
            src: "blob:https://app.test/one",
          },
        },
      ],
    });
    for (const asset of [
      { id: "unknown", type: "video", src: "https://evil.test/a.mp4" },
      { id: "video_1", type: "video", src: "https://evil.test/a.mp4" },
      { id: "video_1", type: "audio", src: "blob:https://app.test/one" },
    ]) {
      expect(() =>
        authorizeIterativeAgentDecision(
          { kind: "command", commands: [{ kind: "asset.set", asset }] },
          media,
        ),
      ).toThrow(/unauthorized|exact authorized/);
    }
    expect(() =>
      authorizeIterativeAgentDecision(
        {
          kind: "command",
          commands: [
            {
              kind: "asset.set",
              asset: {
                id: "video_1",
                type: "video",
                src: "blob:https://app.test/one",
              },
            },
          ],
        },
        [...media, { ...media[0]!, src: "blob:https://app.test/conflict" }],
      ),
    ).toThrow(/ambiguous/);

    expect(
      authorizeIterativeAgentDecision(
        {
          kind: "command",
          commands: [
            {
              kind: "asset.set",
              asset: {
                id: "video_1",
                type: "video",
                src: "blob:https://app.test/one",
              },
            },
          ],
        },
        [
          ...media,
          {
            ...media[0]!,
            id: "video-2",
            sceneAssetId: "video_2",
            src: "blob:https://app.test/two",
            label: "Video 2",
            aliases: ["video_1"],
            fileName: "two.mp4",
          },
        ],
      ),
    ).toMatchObject({
      commands: [
        { kind: "asset.set", asset: { id: "video_1", type: "video" } },
      ],
    });
  });
});
