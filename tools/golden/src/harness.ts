import { exportVideo } from "@motionforge/export";
import {
  disposeAssets,
  prepareFrame,
  renderStill,
  resolveAssets,
} from "@motionforge/renderer-canvas2d";
import type { Scene } from "@motionforge/schema";
import {
  ALL_FORMATS,
  AudioBufferSink,
  BlobSource,
  CanvasSink,
  Input,
} from "mediabunny";

export type RenderedFrame = {
  width: number;
  height: number;
  rgba: number[];
};

export type ExportedVideo = {
  size: number;
  mimeType: string;
  codec: string;
  totalFrames: number;
  /** First 12 bytes of the file; bytes 4-8 spell "ftyp" for valid MP4. */
  header: number[];
};

export type VideoCheck = {
  label: string;
  pass: boolean;
  detail: string;
};

export type ExportedVideoFile = {
  base64: string;
  size: number;
  codec: string;
  audioCodec: string | null;
  totalFrames: number;
};

declare global {
  interface Window {
    renderGoldenFrame: (scene: Scene, frame: number) => Promise<RenderedFrame>;
    renderGoldenExport: (scene: Scene) => Promise<ExportedVideo>;
    renderGoldenExportFile: (scene: Scene) => Promise<ExportedVideoFile>;
    renderGoldenFramePng: (scene: Scene, frame: number) => Promise<string>;
    renderGoldenDiffPng: (
      expected: RenderedFrame,
      received: RenderedFrame,
    ) => Promise<string>;
    runGoldenBenchmark: (options: {
      width: number;
      height: number;
      fps: number;
      seconds: number;
    }) => Promise<BenchmarkResult>;
    runGoldenVideoChecks: () => Promise<VideoCheck[]>;
    runGoldenAudioChecks: () => Promise<VideoCheck[]>;
  }
}

window.renderGoldenFrame = async (
  scene: Scene,
  frame: number,
): Promise<RenderedFrame> => {
  const canvas = document.createElement("canvas");
  canvas.width = scene.width;
  canvas.height = scene.height;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas2D is unavailable in the golden harness.");
  }

  const assets = await resolveAssets(scene);
  await prepareFrame(scene, frame, assets);
  renderStill(context, scene, frame, { assets });

  const image = context.getImageData(0, 0, scene.width, scene.height);

  return {
    width: scene.width,
    height: scene.height,
    rgba: Array.from(image.data),
  };
};

/**
 * End-to-end video-clip check, fully in-browser:
 * 1. Synthesize a source clip with exportVideo (red for 1s, blue for 1s).
 * 2. Composite it through video nodes with trim/playbackRate and verify the
 *    previewed pixels show the right source frames.
 * 3. Export the composite scene to MP4, decode it back, and verify the
 *    exported pixels match the preview.
 * Colors are checked with tolerance because both encodes are lossy.
 */
window.runGoldenVideoChecks = async (): Promise<VideoCheck[]> => {
  const checks: VideoCheck[] = [];
  const fps = 30;

  const sourceScene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps,
    duration: 60,
    assets: {},
    nodes: [
      {
        id: "red",
        type: "div",
        from: 0,
        duration: 30,
        style: { width: "100%", height: "100%", backgroundColor: "#ff0000" },
        children: [],
      },
      {
        id: "blue",
        type: "div",
        from: 30,
        duration: 30,
        style: { width: "100%", height: "100%", backgroundColor: "#0000ff" },
        children: [],
      },
    ],
  };

  const clipStart = performance.now();
  const { blob: clipBlob } = await exportVideo({ scene: sourceScene });
  const clipMs = performance.now() - clipStart;
  const clipUrl = URL.createObjectURL(clipBlob);

  const compositeScene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps,
    duration: 30,
    assets: {
      clip: { id: "clip", type: "video", src: clipUrl },
    },
    nodes: [
      {
        id: "background",
        type: "div",
        from: 0,
        duration: 30,
        style: { width: "100%", height: "100%", backgroundColor: "#101820" },
        children: [],
      },
      {
        id: "trimmed",
        type: "video",
        assetId: "clip",
        videoStartTime: 1.5,
        from: 0,
        duration: 30,
        style: {
          position: "absolute",
          left: 10,
          top: 40,
          width: 140,
          height: 100,
          objectFit: "fill",
        },
        children: [],
      },
      {
        id: "rated",
        type: "video",
        assetId: "clip",
        videoStartTime: 0.5,
        playbackRate: 2,
        from: 0,
        duration: 30,
        style: {
          position: "absolute",
          left: 170,
          top: 40,
          width: 140,
          height: 100,
          objectFit: "fill",
        },
        children: [],
      },
    ],
  };

  const assets = await resolveAssets(compositeScene);

  const readCenter = (
    pixels: Uint8ClampedArray | number[],
    width: number,
    x: number,
    y: number,
  ): [number, number, number] => {
    const offset = (y * width + x) * 4;
    return [
      Number(pixels[offset]),
      Number(pixels[offset + 1]),
      Number(pixels[offset + 2]),
    ];
  };

  const isRed = ([r, g, b]: [number, number, number]): boolean =>
    r > 180 && g < 80 && b < 80;
  const isBlue = ([r, g, b]: [number, number, number]): boolean =>
    b > 180 && r < 80 && g < 80;

  const renderComposite = async (frame: number): Promise<Uint8ClampedArray> => {
    const canvas = document.createElement("canvas");
    canvas.width = compositeScene.width;
    canvas.height = compositeScene.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("Canvas2D unavailable");
    }

    await prepareFrame(compositeScene, frame, assets);
    renderStill(context, compositeScene, frame, { assets });
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  };

  // Scene frame 0: trimmed node shows source t=1.5s (blue half);
  // rated node shows 0.5 + 0*2 = 0.5s (red half).
  const frame0 = await renderComposite(0);
  const trimmedAt0 = readCenter(frame0, 320, 80, 90);
  const ratedAt0 = readCenter(frame0, 320, 240, 90);
  checks.push({
    label: "trim: videoStartTime 1.5s shows the blue source half at frame 0",
    pass: isBlue(trimmedAt0),
    detail: `rgb(${trimmedAt0.join(", ")})`,
  });
  checks.push({
    label: "rate: 0.5s + 0x2 shows the red source half at frame 0",
    pass: isRed(ratedAt0),
    detail: `rgb(${ratedAt0.join(", ")})`,
  });

  // Scene frame 15 (0.5s): rated node shows 0.5 + 0.5*2 = 1.5s (blue half).
  const frame15 = await renderComposite(15);
  const ratedAt15 = readCenter(frame15, 320, 240, 90);
  checks.push({
    label: "rate: playbackRate 2 reaches the blue source half by frame 15",
    pass: isBlue(ratedAt15),
    detail: `rgb(${ratedAt15.join(", ")})`,
  });

  // Export the composite and decode frame 0 back from the file.
  const exportStart = performance.now();
  const { blob: compositeBlob } = await exportVideo({
    scene: compositeScene,
    assets,
  });
  const exportMs = performance.now() - exportStart;

  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(compositeBlob),
  });
  const track = await input.getPrimaryVideoTrack();

  if (!track) {
    throw new Error("exported composite has no video track");
  }

  const sink = new CanvasSink(track);
  const wrapped = await sink.getCanvas(0);

  if (!wrapped) {
    throw new Error("exported composite has no frame at t=0");
  }

  const decodeCanvas = document.createElement("canvas");
  decodeCanvas.width = wrapped.canvas.width;
  decodeCanvas.height = wrapped.canvas.height;
  const decodeContext = decodeCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!decodeContext) {
    throw new Error("Canvas2D unavailable for decode");
  }

  decodeContext.drawImage(wrapped.canvas, 0, 0);
  const exported = decodeContext.getImageData(
    0,
    0,
    decodeCanvas.width,
    decodeCanvas.height,
  ).data;
  const exportedTrimmed = readCenter(exported, decodeCanvas.width, 80, 90);
  const exportedRated = readCenter(exported, decodeCanvas.width, 240, 90);

  checks.push({
    label: "export round-trip: exported frame 0 matches preview (trimmed node)",
    pass: isBlue(exportedTrimmed),
    detail: `rgb(${exportedTrimmed.join(", ")})`,
  });
  checks.push({
    label: "export round-trip: exported frame 0 matches preview (rated node)",
    pass: isRed(exportedRated),
    detail: `rgb(${exportedRated.join(", ")})`,
  });
  checks.push({
    label: "timing baseline",
    pass: true,
    detail: `source clip (60f): ${clipMs.toFixed(0)}ms, composite export (30f, 2 video nodes): ${exportMs.toFixed(0)}ms`,
  });

  input.dispose();
  disposeAssets(assets);
  URL.revokeObjectURL(clipUrl);

  return checks;
};

window.renderGoldenExport = async (scene: Scene): Promise<ExportedVideo> => {
  const { blob, codec, totalFrames } = await exportVideo({ scene });
  const bytes = new Uint8Array(await blob.arrayBuffer());

  return {
    size: bytes.length,
    mimeType: blob.type,
    codec,
    totalFrames,
    header: Array.from(bytes.slice(0, 12)),
  };
};

/** Builds a mono 16-bit PCM WAV containing a sine tone. */
function buildToneWav(
  seconds: number,
  frequency: number,
  sampleRate = 48_000,
  amplitude = 0.5,
): Blob {
  const samples = Math.round(seconds * sampleRate);
  const view = new DataView(new ArrayBuffer(44 + samples * 2));
  const writeAscii = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, samples * 2, true);

  for (let index = 0; index < samples; index += 1) {
    const value =
      Math.sin((2 * Math.PI * frequency * index) / sampleRate) * amplitude;
    view.setInt16(44 + index * 2, Math.round(value * 32767), true);
  }

  return new Blob([view.buffer], { type: "audio/wav" });
}

async function rmsOver(
  sink: AudioBufferSink,
  start: number,
  end: number,
): Promise<number> {
  let sumSquares = 0;
  let count = 0;

  for await (const wrapped of sink.buffers(start, end)) {
    const data = wrapped.buffer.getChannelData(0);

    for (let index = 0; index < data.length; index += 1) {
      const at = wrapped.timestamp + index / wrapped.buffer.sampleRate;

      if (at >= start && at < end) {
        sumSquares += (data[index] ?? 0) ** 2;
        count += 1;
      }
    }
  }

  return count === 0 ? 0 : Math.sqrt(sumSquares / count);
}

/**
 * End-to-end audio check: a 1s sine WAV placed at scene frame 15 (0.5s) with
 * volume 0.8 exports into the MP4's audio track — silent before 0.5s, tone
 * after, verified by decoding the exported file and measuring RMS windows.
 */
window.runGoldenAudioChecks = async (): Promise<VideoCheck[]> => {
  const checks: VideoCheck[] = [];
  const toneUrl = URL.createObjectURL(buildToneWav(1.0, 440));

  const scene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 45,
    assets: {
      tone: { id: "tone", type: "audio", src: toneUrl },
    },
    nodes: [
      {
        id: "background",
        type: "div",
        from: 0,
        duration: 45,
        style: { width: "100%", height: "100%", backgroundColor: "#101820" },
        children: [],
      },
      {
        id: "track",
        type: "audio",
        assetId: "tone",
        from: 15,
        duration: 30,
        volume: 0.8,
      },
    ],
  };

  const assets = await resolveAssets(scene);
  const exportStart = performance.now();
  // 0.4s chunks force the chunked mix path (4 windows over 1.5s, with the
  // tone start crossing a chunk boundary); the RMS/alignment checks below
  // then validate chunk concatenation, not just the mix math.
  const { blob, audioCodec } = await exportVideo({
    scene,
    assets,
    audioChunkSeconds: 0.4,
  });
  const exportMs = performance.now() - exportStart;

  checks.push({
    label: "audio: export negotiates an MP4 audio codec",
    pass: audioCodec !== null,
    detail: String(audioCodec),
  });

  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(blob),
  });
  const track = await input.getPrimaryAudioTrack();

  checks.push({
    label: "audio: exported MP4 contains an audio track",
    pass: track !== null,
    detail: track
      ? `${track.numberOfChannels}ch @ ${track.sampleRate}Hz`
      : "no track",
  });

  if (track) {
    const duration = await input.computeDuration([track]);
    checks.push({
      label: "audio: track covers the scene duration (1.5s)",
      pass: Math.abs(duration - 1.5) < 0.15,
      detail: `${duration.toFixed(3)}s`,
    });

    const sink = new AudioBufferSink(track);

    // Margins around the 0.5s boundary absorb encoder priming/padding.
    const silentRms = await rmsOver(sink, 0.05, 0.4);
    const toneRms = await rmsOver(sink, 0.6, 1.4);

    checks.push({
      label: "audio: silent before the node starts at frame 15",
      pass: silentRms < 0.02,
      detail: `rms ${silentRms.toFixed(4)}`,
    });
    checks.push({
      label: "audio: tone plays after frame 15 (0.5 amp x 0.8 volume)",
      // Expected RMS of a 0.4-amplitude sine is ~0.283.
      pass: toneRms > 0.15 && toneRms < 0.4,
      detail: `rms ${toneRms.toFixed(4)}`,
    });
  }

  checks.push({
    label: "audio: timing baseline",
    pass: true,
    detail: `45-frame export with mixed audio: ${exportMs.toFixed(0)}ms`,
  });

  input.dispose();
  disposeAssets(assets);

  // --- video nodes contribute their own clip audio ------------------------
  // Synthesize a 1s source MP4 whose soundtrack is the tone, place it as a
  // *video* node at frame 15 with volume 0.8, and verify the composite's
  // audio: silent head, tone in the clip's window. The video node is the
  // only audio source in the composite scene.
  const sourceScene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 30,
    assets: { tone: { id: "tone", type: "audio", src: toneUrl } },
    nodes: [
      {
        id: "bg",
        type: "div",
        from: 0,
        duration: 30,
        style: { width: "100%", height: "100%", backgroundColor: "#aa2200" },
        children: [],
      },
      { id: "sound", type: "audio", assetId: "tone", from: 0, duration: 30 },
    ],
  };

  const sourceAssets = await resolveAssets(sourceScene);
  const { blob: clipBlob } = await exportVideo({
    scene: sourceScene,
    assets: sourceAssets,
  });
  disposeAssets(sourceAssets);
  const clipUrl = URL.createObjectURL(clipBlob);

  const compositeScene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 45,
    assets: { clip: { id: "clip", type: "video", src: clipUrl } },
    nodes: [
      {
        id: "bg",
        type: "div",
        from: 0,
        duration: 45,
        style: { width: "100%", height: "100%", backgroundColor: "#101820" },
        children: [],
      },
      {
        id: "shot",
        type: "video",
        assetId: "clip",
        from: 15,
        duration: 30,
        volume: 0.8,
        style: { width: "100%", height: "100%" },
        children: [],
      },
    ],
  };

  const compositeAssets = await resolveAssets(compositeScene);
  const { blob: compositeBlob, audioCodec: compositeAudioCodec } =
    await exportVideo({ scene: compositeScene, assets: compositeAssets });

  checks.push({
    label: "audio: video node's clip soundtrack reaches the export",
    pass: compositeAudioCodec !== null,
    detail: String(compositeAudioCodec),
  });

  const compositeInput = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(compositeBlob),
  });
  const compositeTrack = await compositeInput.getPrimaryAudioTrack();

  if (compositeTrack) {
    const sink = new AudioBufferSink(compositeTrack);

    const headRms = await rmsOver(sink, 0.05, 0.4);
    const clipRms = await rmsOver(sink, 0.6, 1.4);

    checks.push({
      label: "audio: silent before the video node starts",
      pass: headRms < 0.02,
      detail: `rms ${headRms.toFixed(4)}`,
    });
    checks.push({
      label:
        "audio: video clip audio plays in its window (0.5 amp x 0.8 volume)",
      // Source tone (0.5 amp) x volume 0.8 ≈ rms 0.283 through two AAC passes.
      pass: clipRms > 0.15 && clipRms < 0.4,
      detail: `rms ${clipRms.toFixed(4)}`,
    });
  } else {
    checks.push({
      label: "audio: silent before the video node starts",
      pass: false,
      detail: "no audio track in composite export",
    });
  }

  compositeInput.dispose();
  disposeAssets(compositeAssets);
  URL.revokeObjectURL(clipUrl);

  // --- audio automation and looped beds -----------------------------------
  // Keep the three tones separated so decoded RMS windows can prove static
  // volume, envelope gain, and source wrapping independently.
  const automationScene: Scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 120,
    assets: { tone: { id: "tone", type: "audio", src: toneUrl } },
    nodes: [
      {
        id: "bg",
        type: "div",
        from: 0,
        duration: 120,
        style: { width: "100%", height: "100%", backgroundColor: "#101820" },
        children: [],
      },
      {
        id: "static",
        type: "audio",
        assetId: "tone",
        from: 0,
        duration: 24,
        volume: 0.8,
      },
      {
        id: "fade",
        type: "audio",
        assetId: "tone",
        from: 36,
        duration: 30,
        volume: 0.8,
        volumeEnvelope: [
          { frame: 0, value: 0 },
          { frame: 30, value: 1, easing: "linear" },
        ],
      },
      {
        id: "loop",
        type: "audio",
        assetId: "tone",
        from: 78,
        duration: 42,
        volume: 0.8,
        loop: true,
      },
    ],
  };

  const automationAssets = await resolveAssets(automationScene);
  const { blob: automationBlob, audioCodec: automationAudioCodec } =
    await exportVideo({
      scene: automationScene,
      assets: automationAssets,
      audioChunkSeconds: 0.35,
    });

  checks.push({
    label: "audio: automation/loop scene exports an audio codec",
    pass: automationAudioCodec !== null,
    detail: String(automationAudioCodec),
  });

  const automationInput = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(automationBlob),
  });
  const automationTrack = await automationInput.getPrimaryAudioTrack();

  if (automationTrack) {
    const sink = new AudioBufferSink(automationTrack);
    const staticRms = await rmsOver(sink, 0.12, 0.65);
    const fadeEarlyRms = await rmsOver(sink, 1.28, 1.45);
    const fadeLateRms = await rmsOver(sink, 1.85, 2.12);
    const loopWrappedRms = await rmsOver(sink, 3.75, 3.95);

    checks.push({
      label: "audio: static volume remains audible",
      pass: staticRms > 0.15 && staticRms < 0.4,
      detail: `rms ${staticRms.toFixed(4)}`,
    });
    checks.push({
      label: "audio: volumeEnvelope starts quieter than the static bed",
      pass: fadeEarlyRms > 0.015 && fadeEarlyRms < staticRms * 0.6,
      detail: `rms ${fadeEarlyRms.toFixed(4)} vs static ${staticRms.toFixed(4)}`,
    });
    checks.push({
      label: "audio: volumeEnvelope reaches full audible level",
      pass: fadeLateRms > staticRms * 0.6 && fadeLateRms < staticRms * 1.25,
      detail: `rms ${fadeLateRms.toFixed(4)} vs static ${staticRms.toFixed(4)}`,
    });
    checks.push({
      label: "audio: looped source continues after the 1s WAV wraps",
      pass: loopWrappedRms > 0.15 && loopWrappedRms < 0.4,
      detail: `rms ${loopWrappedRms.toFixed(4)}`,
    });
  } else {
    checks.push({
      label: "audio: static volume remains audible",
      pass: false,
      detail: "no audio track in automation export",
    });
  }

  automationInput.dispose();
  disposeAssets(automationAssets);
  URL.revokeObjectURL(toneUrl);

  return checks;
};

/** Exports a scene to MP4 and returns the file as base64 (for saving to disk). */
window.renderGoldenExportFile = async (scene: Scene) => {
  const assets = await resolveAssets(scene);
  const { blob, codec, audioCodec, totalFrames } = await exportVideo({
    scene,
    assets,
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  disposeAssets(assets);

  return {
    base64: btoa(binary),
    size: bytes.length,
    codec,
    audioCodec,
    totalFrames,
  };
};

/** Renders one frame and returns it as a base64 PNG (for saving to disk). */
window.renderGoldenFramePng = async (
  scene: Scene,
  frame: number,
): Promise<string> => {
  const canvas = document.createElement("canvas");
  canvas.width = scene.width;
  canvas.height = scene.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas2D unavailable");
  }

  const assets = await resolveAssets(scene);
  await prepareFrame(scene, frame, assets);
  renderStill(context, scene, frame, { assets });
  disposeAssets(assets);
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
};

window.renderGoldenDiffPng = async (
  expected: RenderedFrame,
  received: RenderedFrame,
): Promise<string> => {
  if (
    expected.width !== received.width ||
    expected.height !== received.height
  ) {
    throw new Error(
      `Cannot diff frames with different sizes: expected ${expected.width}x${expected.height}, received ${received.width}x${received.height}`,
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = received.width;
  canvas.height = received.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas2D unavailable for diff artifact");
  }

  const image = context.createImageData(received.width, received.height);

  for (let index = 0; index < received.rgba.length; index += 4) {
    const dr = Math.abs(
      (expected.rgba[index] ?? 0) - (received.rgba[index] ?? 0),
    );
    const dg = Math.abs(
      (expected.rgba[index + 1] ?? 0) - (received.rgba[index + 1] ?? 0),
    );
    const db = Math.abs(
      (expected.rgba[index + 2] ?? 0) - (received.rgba[index + 2] ?? 0),
    );
    const da = Math.abs(
      (expected.rgba[index + 3] ?? 0) - (received.rgba[index + 3] ?? 0),
    );
    const changed = dr + dg + db + da > 0;

    if (changed) {
      image.data[index] = 255;
      image.data[index + 1] = 64;
      image.data[index + 2] = 64;
      image.data[index + 3] = 255;
    } else {
      image.data[index] = Math.round((received.rgba[index] ?? 0) * 0.25);
      image.data[index + 1] = Math.round(
        (received.rgba[index + 1] ?? 0) * 0.25,
      );
      image.data[index + 2] = Math.round(
        (received.rgba[index + 2] ?? 0) * 0.25,
      );
      image.data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
};

export type BenchmarkStage = {
  label: string;
  frames: number;
  totalMs: number;
  msPerFrame: number;
  outputKiB: number;
};

export type BenchmarkResult = {
  stages: BenchmarkStage[];
  /** Chromium-only JS heap snapshots in MiB, taken after each stage. */
  heapMiB: Array<{ label: string; usedMiB: number | null }>;
};

/**
 * Production-size performance benchmark: synthesizes footage at the target
 * resolution with exportVideo (stage 1 — pure render+encode), then exports
 * composites that decode it back through video nodes (stages 2 and 3 —
 * decode + composite + encode, the real workload).
 */
window.runGoldenBenchmark = async ({ width, height, fps, seconds }) => {
  const frames = Math.round(seconds * fps);
  const stages: BenchmarkStage[] = [];
  const heapMiB: BenchmarkResult["heapMiB"] = [];

  const heap = (label: string) => {
    const memory = (
      performance as unknown as { memory?: { usedJSHeapSize: number } }
    ).memory;
    heapMiB.push({
      label,
      usedMiB: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
    });
  };

  const measure = async (label: string, scene: Scene): Promise<Blob> => {
    const assets = await resolveAssets(scene);
    const start = performance.now();
    const { blob } = await exportVideo({ scene, assets });
    const totalMs = performance.now() - start;
    disposeAssets(assets);
    stages.push({
      label,
      frames: scene.duration,
      totalMs: Math.round(totalMs),
      msPerFrame: Number((totalMs / scene.duration).toFixed(2)),
      outputKiB: Math.round(blob.size / 1024),
    });
    heap(label);
    return blob;
  };

  // Stage 1 — synthesize "footage": full-frame animated gradient + a moving
  // box + text, so the encoder sees real per-frame change at every pixel row.
  const sourceScene: Scene = {
    schemaVersion: 1,
    width,
    height,
    fps,
    duration: frames,
    assets: {},
    nodes: [
      {
        id: "bg",
        type: "div",
        from: 0,
        duration: frames,
        style: {
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #16222e 0%, #66f5d7 100%)",
        },
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [
              { frame: 0, value: 0.6 },
              { frame: Math.max(1, frames - 1), value: 1 },
            ],
          },
        ],
        children: [],
      },
      {
        id: "mover",
        type: "div",
        from: 0,
        duration: frames,
        style: {
          position: "absolute",
          left: 0,
          top: Math.round(height * 0.4),
          width: Math.round(width * 0.2),
          height: Math.round(height * 0.2),
          backgroundColor: "#ef476f",
          borderRadius: 24,
        },
        animations: [
          {
            kind: "keyframes",
            property: "transform",
            frames: [
              { frame: 0, value: "translate(0px, 0px)" },
              {
                frame: Math.max(1, frames - 1),
                value: `translate(${Math.round(width * 0.8)}px, 0px)`,
              },
            ],
          },
        ],
        children: [],
      },
    ],
  };

  const sourceBlob = await measure(
    `render+encode ${width}x${height} (no decode)`,
    sourceScene,
  );
  const sourceUrl = URL.createObjectURL(sourceBlob);

  // Stage 2 — one full-frame video node + caption (decode + composite + encode).
  const oneVideo: Scene = {
    schemaVersion: 1,
    width,
    height,
    fps,
    duration: frames,
    assets: { clip: { id: "clip", type: "video", src: sourceUrl } },
    nodes: [
      {
        id: "shot",
        type: "video",
        assetId: "clip",
        from: 0,
        duration: frames,
        style: { width: "100%", height: "100%" },
        children: [],
      },
      {
        id: "caption",
        type: "text",
        text: "BENCHMARK CAPTION",
        from: 0,
        duration: frames,
        style: {
          position: "absolute",
          left: 0,
          width: "100%",
          top: Math.round(height * 0.82),
          height: Math.round(height * 0.08),
          fontSize: Math.round(height * 0.05),
          fontWeight: 800,
          color: "#ffffff",
          textAlign: "center",
          textStroke: "6px #000000",
        },
        children: [],
      },
    ],
  };

  await measure("1 video node + caption", oneVideo);

  // Stage 3 — two simultaneous decoders: full-frame + picture-in-picture at 2x rate.
  const twoVideos: Scene = {
    ...oneVideo,
    assets: {
      clip: { id: "clip", type: "video", src: sourceUrl },
      pip: { id: "pip", type: "video", src: sourceUrl },
    },
    nodes: [
      ...oneVideo.nodes,
      {
        id: "pip-shot",
        type: "video",
        assetId: "pip",
        playbackRate: 2,
        from: 0,
        duration: frames,
        style: {
          position: "absolute",
          left: Math.round(width * 0.65),
          top: Math.round(height * 0.06),
          width: Math.round(width * 0.3),
          height: Math.round(height * 0.3),
          borderRadius: 18,
          objectFit: "cover",
        },
        children: [],
      },
    ],
  };

  await measure("2 video nodes (full + PiP @2x)", twoVideos);

  URL.revokeObjectURL(sourceUrl);
  return { stages, heapMiB };
};
