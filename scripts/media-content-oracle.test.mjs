import { describe, it, expect } from "vitest";
import {
  verifyColorFrames,
  verifyTone,
  verifyAudioTimeline,
} from "./media-content-oracle.mjs";
describe("independent decoded media oracle", () => {
  it("detects audio shifted relative to the declared video clock", () => {
    const pcm = Float32Array.from({ length: 96000 }, (_, i) => {
      const source = 0.5 + i / 48000,
        index = Math.min(2, Math.floor(source));
      return (
        [0.25, 0.5, 0.125][index] *
        0.5 *
        Math.sin(2 * Math.PI * [440, 880, 220][index] * source)
      );
    });
    expect(
      verifyAudioTimeline(pcm, { frames: 60, sourceOffset: 0.5 }),
    ).toBeGreaterThan(45);
    const shifted = new Float32Array(pcm.length);
    shifted.set(pcm.subarray(0, pcm.length - 4800), 4800);
    expect(() =>
      verifyAudioTimeline(shifted, { frames: 60, sourceOffset: 0.5 }),
    ).toThrow();
  });
  it("rejects wrong frames and missing tail content", () => {
    const data = Buffer.from(
      Array.from({ length: 90 }, (_, n) => [
        n < 30 ? 255 : 0,
        n >= 30 && n < 60 ? 255 : 0,
        n >= 60 ? 255 : 0,
      ]).flat(),
    );
    expect(() =>
      verifyColorFrames(data, { width: 1, height: 1, frames: 90 }),
    ).not.toThrow();
    const wrong = Buffer.from(data);
    wrong.set([0, 0, 255], 15 * 3);
    expect(() =>
      verifyColorFrames(wrong, { width: 1, height: 1, frames: 90 }),
    ).toThrow(/Wrong source/);
    expect(() =>
      verifyColorFrames(data.subarray(0, -3), {
        width: 1,
        height: 1,
        frames: 90,
      }),
    ).toThrow(/count/);
  });
  it("rejects wrong gain, frequency and absent samples independently of the mixer", () => {
    const tone = (frequency, amplitude) =>
      Float32Array.from(
        { length: 48000 },
        (_, i) => amplitude * Math.sin((2 * Math.PI * frequency * i) / 48000),
      );
    const request = { start: 0.1, end: 0.3, frequency: 440, amplitude: 0.25 };
    expect(() => verifyTone(tone(440, 0.25), request)).not.toThrow();
    expect(() => verifyTone(tone(440, 0.5), request)).toThrow(/gain/);
    expect(() => verifyTone(tone(880, 0.25), request)).toThrow(/frequency/);
    expect(() => verifyTone(new Float32Array(100), request)).toThrow(/Missing/);
  });
});
