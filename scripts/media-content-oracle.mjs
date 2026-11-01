/** Independent media measurements. No engine evaluator, mixer or timing helpers. */
export function verifyColorFrames(
  rgb,
  { width, height, frames, sourceOffset = 0, rate = 1, fps = 30 },
) {
  const stride = width * height * 3;
  if (rgb.length !== stride * frames)
    throw new Error(
      `Decoded frame count differs: ${rgb.length / stride}, expected ${frames}`,
    );
  for (let frame = 0; frame < frames; frame++) {
    const p =
      frame * stride +
      (Math.floor(height / 2) * width + Math.floor(width / 2)) * 3;
    const values = [rgb[p], rgb[p + 1], rgb[p + 2]];
    const actual = values.indexOf(Math.max(...values));
    const allowed = [-1, 0, 1].map((delta) =>
      Math.min(
        2,
        Math.floor(
          sourceOffset +
            (Math.max(0, Math.min(frames - 1, frame + delta)) / fps) * rate,
        ),
      ),
    );
    if (Math.max(...values) < 180 || !allowed.includes(actual))
      throw new Error(`Wrong source color at output frame ${frame}: ${values}`);
  }
}

export function readFrameMarker(
  pixels,
  { width = 160, height = 90, channels = 3, frame = 0 } = {},
) {
  let marker = 0;
  for (let bit = 0; bit < 7; bit++) {
    const at =
      frame * width * height * channels +
      (8 * width + 15 + 20 * bit) * channels;
    const value = (pixels[at] + pixels[at + 1] + pixels[at + 2]) / 3;
    if (value > 200) marker |= 1 << bit;
    else if (!(value < 50)) throw new Error("Frame marker is unreadable");
  }
  return marker;
}
export function verifyFrameMarkers(
  pixels,
  { frames, fps = 30, sourceOffset = 0, rate = 1, sourcePts },
) {
  const expected = (time) =>
    sourcePts
      ? Math.round((sourcePts.findLast((t) => t <= time + 1e-5) ?? 0) * 30)
      : Math.floor(time * 30 + 1e-5);
  for (let frame = 0; frame < frames; frame++) {
    const actual = readFrameMarker(pixels, { frame });
    const allowed = [-1, 0, 1].map((delta) =>
      expected(
        sourceOffset +
          (Math.max(0, Math.min(frames - 1, frame + delta)) / fps) * rate,
      ),
    );
    if (!allowed.includes(actual))
      throw new Error(
        `Source frame marker mismatch at ${frame}: ${actual}, expected one of ${allowed}`,
      );
  }
}
export function measureTone(pcm, sampleRate, start, end, frequency) {
  const low = Math.round(start * sampleRate),
    high = Math.round(end * sampleRate);
  if (low < 0 || high > pcm.length || high <= low)
    throw new Error("Missing audio measurement window");
  let energy = 0,
    real = 0,
    imaginary = 0;
  for (let i = low; i < high; i++) {
    const sample = pcm[i];
    if (!Number.isFinite(sample)) throw new Error("Invalid decoded audio");
    energy += sample * sample;
    real += sample * Math.cos((2 * Math.PI * frequency * i) / sampleRate);
    imaginary += sample * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  const count = high - low,
    rms = Math.sqrt(energy / count),
    amplitude = (2 * Math.hypot(real, imaginary)) / count;
  return { rms, frequencyRatio: rms ? amplitude / (Math.SQRT2 * rms) : 0 };
}
export function verifyTone(
  pcm,
  { sampleRate = 48000, start, end, frequency, amplitude },
) {
  const measured = measureTone(pcm, sampleRate, start, end, frequency);
  const gainErrorDb = 20 * Math.log10(measured.rms / (amplitude / Math.SQRT2));
  if (
    !Number.isFinite(gainErrorDb) ||
    Math.abs(gainErrorDb) > 0.75 ||
    measured.frequencyRatio < 0.9
  )
    throw new Error(
      `Audio content mismatch: gain ${gainErrorDb.toFixed(3)} dB, frequency ratio ${measured.frequencyRatio.toFixed(3)}`,
    );
  return { ...measured, gainErrorDb };
}

/** Check windows throughout the timeline, excluding a one-frame boundary margin. */
export function verifyAudioTimeline(
  pcm,
  {
    frames,
    fps = 30,
    sourceOffset = 0,
    rate = 1,
    volume = 0.5,
    sampleRate = 48000,
  },
) {
  let windows = 0;
  const frequencies = [440, 880, 220],
    amplitudes = [0.25, 0.5, 0.125];
  for (let frame = 1; frame < frames - 1; frame++) {
    const at = (frame + 0.5) / fps,
      source = sourceOffset + at * rate;
    if ([1, 2].some((boundary) => Math.abs(source - boundary) <= rate / fps))
      continue;
    const segment = Math.min(2, Math.floor(source));
    verifyTone(pcm, {
      sampleRate,
      start: at - 0.01,
      end: at + 0.01,
      frequency: frequencies[segment] * rate,
      amplitude: amplitudes[segment] * volume,
    });
    windows++;
  }
  return windows;
}
