import { describe, expect, it } from "vitest";
import { previewAudioChunkRange } from "./audio.js";

describe("chunked audio preview", () => {
  it("bounds a long scene to the chunk around the seek position", () => {
    const scene = { fps: 30, duration: 30 * 60 * 20 };
    expect(previewAudioChunkRange(scene, 12 * 60 + 7, 30)).toEqual({
      chunkStart: 720,
      startFrame: 21_600,
      endFrame: 22_499,
    });
  });

  it("clamps the final chunk to scene duration", () => {
    expect(previewAudioChunkRange({ fps: 30, duration: 1000 }, 32, 30)).toEqual(
      {
        chunkStart: 30,
        startFrame: 900,
        endFrame: 999,
      },
    );
  });
});
