import { describe, expect, it } from "vitest";
import { effectParamsSchema, sceneJsonSchema } from "./index.js";

describe("audio-reactive source controls", () => {
  it("accepts source offsets and positive rate without changing omitted defaults", () => {
    expect(effectParamsSchema.parse({ audioAssetId: "music" })).toEqual({
      audioAssetId: "music",
    });
    expect(
      effectParamsSchema.parse({
        audioAssetId: "music",
        audioStartTime: 12.5,
        audioPlaybackRate: 0.25,
      }),
    ).toMatchObject({ audioStartTime: 12.5, audioPlaybackRate: 0.25 });
    const schema = JSON.stringify(sceneJsonSchema());
    expect(schema).toContain('"audioStartTime"');
    expect(schema).toContain('"audioPlaybackRate"');
  });

  it("rejects invalid source time and unsupported rates", () => {
    for (const audioStartTime of [-1, Infinity, NaN])
      expect(effectParamsSchema.safeParse({ audioStartTime }).success).toBe(
        false,
      );
    for (const audioPlaybackRate of [0, -1, 17, Infinity, NaN])
      expect(effectParamsSchema.safeParse({ audioPlaybackRate }).success).toBe(
        false,
      );
  });
});
