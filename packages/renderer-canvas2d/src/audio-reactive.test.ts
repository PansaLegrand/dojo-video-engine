import { describe, expect, it } from "vitest";
import { parseScene } from "@motionforge/schema";
import {
  audioReactiveSourceTime,
  collectAudioReactiveSourceRanges,
  audioReactiveAnalysisWindow,
} from "./audio-reactive.js";

describe("audio-reactive source timing", () => {
  it("maps effect-local frames to trimmed and retimed source seconds", () => {
    expect(audioReactiveSourceTime({}, 45, 30)).toBe(1.5);
    expect(
      audioReactiveSourceTime(
        { audioStartTime: 10, audioPlaybackRate: 2 },
        45,
        30,
      ),
    ).toBe(13);
    expect(
      audioReactiveSourceTime(
        { audioStartTime: 5, audioPlaybackRate: 0.5 },
        60,
        30,
      ),
    ).toBe(6);
  });

  it("unions requested source ranges after parent clipping without using scene placement as source time", () => {
    const scene = parseScene({
      schemaVersion: 1,
      width: 320,
      height: 180,
      fps: 30,
      duration: 300,
      assets: { music: { id: "music", type: "audio", src: "music.wav" } },
      nodes: [
        {
          id: "group",
          type: "div",
          from: 30,
          duration: 90,
          children: [
            {
              id: "early",
              type: "effect",
              effect: "spectrumBars",
              from: -30,
              duration: 90,
              params: {
                audioAssetId: "music",
                audioStartTime: 10,
                audioPlaybackRate: 2,
              },
            },
          ],
        },
        {
          id: "later",
          type: "effect",
          effect: "waveformLine",
          from: 270,
          duration: 90,
          params: { audioAssetId: "music", audioStartTime: 20 },
        },
        {
          id: "outside",
          type: "effect",
          effect: "spectrumBars",
          from: 301,
          duration: 30,
          params: { audioAssetId: "music", audioStartTime: 9000 },
        },
      ],
    });
    expect(collectAudioReactiveSourceRanges(scene).get("music")).toEqual({
      start: 12,
      end: 21,
    });
  });

  it("keeps late source offsets windowed and aligned to the absolute spectrum grid", () => {
    const window = audioReactiveAnalysisWindow(
      { start: 3600, end: 3601 },
      4000,
      15,
    );
    expect(window.start).toBeCloseTo(3599.9333333333334);
    expect(window.end).toBeCloseTo(3601.0666666666666);
    expect(window.end - window.start).toBeLessThan(1.2);
    expect(audioReactiveAnalysisWindow({ start: 20, end: 25 }, 10, 15)).toEqual(
      { start: 10, end: 10 },
    );
  });
});
