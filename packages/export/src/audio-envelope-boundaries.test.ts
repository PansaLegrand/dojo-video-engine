import { describe, expect, it } from "vitest";
import { mixAudioSegments } from "./index.js";

describe("volume envelope keyframe boundaries", () => {
  it.each([
    { sampleRate: 48000, fps: 30, offset: 0 },
    { sampleRate: 44100, fps: 24, offset: 0 },
    { sampleRate: 48000, fps: 30, offset: 0.025 },
  ])(
    "keeps piecewise-linear gains exact at integer/fractional sample knots: %j",
    ({ sampleRate, fps, offset }) => {
      const length = Math.round(sampleRate * 0.1);
      const actual = mixAudioSegments(
        [
          {
            channels: [new Float32Array(length).fill(1)],
            sampleRate,
            startTime: 0,
            volume: 0.4,
            envelopeFps: fps,
            envelopeStartTime: offset,
            volumeEnvelope: [
              { frame: 0, value: 0 },
              { frame: 1, value: 1 },
              { frame: 2, value: 0.5 },
            ],
          },
        ],
        0.1,
        sampleRate,
        1,
      )[0]!;
      let maxError = 0;
      for (let index = 0; index < length; index++) {
        const frame = (offset + index / sampleRate) * fps;
        const gain =
          frame <= 1 ? frame : frame <= 2 ? 1 - (frame - 1) * 0.5 : 0.5;
        maxError = Math.max(
          maxError,
          Math.abs(actual[index]! - Math.fround(0.4 * gain)),
        );
      }
      expect(actual).toHaveLength(length);
      expect(maxError).toBeLessThan(0.0000001);
    },
  );
});
