import { describe, expect, it } from "vitest";
import {
  BlobSource,
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacket,
  EncodedPacketSink,
  Input,
  Mp4OutputFormat,
  Output,
  ALL_FORMATS,
} from "mediabunny";
import { estimateAacPriming } from "./aac-encoder-timing.js";
import { repairAacBlob, createAacTimingStream } from "./mp4-aac-target.js";
import { repairAacMoov } from "./mp4-aac-timing.js";

const sampleRate = 48000,
  primingSamples = 2112;
const metadata = {
  decoderConfig: {
    codec: "mp4a.40.2",
    sampleRate,
    numberOfChannels: 2,
    description: new Uint8Array([0x11, 0x90]),
  },
};
async function fixture(
  sampleCount: number,
  fastStart: false | "in-memory" = false,
) {
  let moov!: { data: Uint8Array; position: number };
  const target = new BufferTarget(),
    output = new Output({
      target,
      format: new Mp4OutputFormat({
        fastStart,
        onMoov: (data, position) => {
          moov = { data, position };
        },
      }),
    });
  const source = new EncodedAudioPacketSource("aac");
  output.addAudioTrack(source);
  await output.start();
  const packets = Math.ceil((sampleCount + primingSamples + 2048) / 1024);
  for (let i = 0; i < packets; i++)
    await source.add(
      new EncodedPacket(
        new Uint8Array(20 + (i % 3)).fill(i % 256),
        "key",
        (i * 1024) / sampleRate,
        1024 / sampleRate,
      ),
      i ? undefined : metadata,
    );
  await output.finalize();
  return {
    blob: new Blob([target.buffer!], { type: "video/mp4" }),
    moov,
    packets,
    timing: { sampleRate, primingSamples, sampleCount },
  };
}
async function boxes(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()),
    view = new DataView(bytes.buffer),
    result = [];
  for (let at = 0; at < bytes.length; ) {
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8)),
      size =
        view.getUint32(at) === 1
          ? Number(view.getBigUint64(at + 8))
          : view.getUint32(at) || bytes.length - at;
    result.push({ type, at, bytes: bytes.slice(at, at + size) });
    at += size;
  }
  return result;
}

describe("bounded AAC priming estimation", () => {
  const reference = Float32Array.from(
    { length: 16384 },
    (_, i) => Math.sin(i * 0.03 + i * i * 0.000003) * 0.2,
  );
  it.each([0, 1024, 2112, 4096])(
    "finds %i samples without a platform-specific constant",
    (delay) => {
      const decoded = new Float32Array(reference.length + 6000);
      decoded.set(reference, delay);
      expect(
        estimateAacPriming(reference, decoded, sampleRate, 5000).primingSamples,
      ).toBe(delay);
    },
  );
  it("refuses silence, short probes and delays beyond its bound", () => {
    expect(() =>
      estimateAacPriming(reference, new Float32Array(100), sampleRate, 5000),
    ).toThrow();
    expect(() =>
      estimateAacPriming(
        new Float32Array(16384),
        new Float32Array(23000),
        sampleRate,
        5000,
      ),
    ).toThrow();
    const beyond = new Float32Array(23000);
    beyond.set(reference, 5000);
    expect(() =>
      estimateAacPriming(reference, beyond, sampleRate, 5000),
    ).toThrow();
  });
});

describe("MP4 AAC timing metadata", () => {
  it.each([false, "in-memory"] as const)(
    "preserves every mdat byte and resolves exact sample clocks with fastStart=%s",
    async (fastStart) => {
      for (const sampleCount of [800, 1600, 145600, 144000]) {
        const f = await fixture(sampleCount, fastStart),
          repaired = await repairAacBlob(f.blob, f.timing);
        expect(
          (await boxes(repaired)).find((box) => box.type === "mdat")!.bytes,
        ).toEqual(
          (await boxes(f.blob)).find((box) => box.type === "mdat")!.bytes,
        );
        const input = new Input({
          source: new BlobSource(repaired),
          formats: ALL_FORMATS,
        });
        try {
          const track = await input.getPrimaryAudioTrack();
          expect(await track!.getFirstTimestamp()).toBeCloseTo(
            -primingSamples / sampleRate,
            12,
          );
          expect(await track!.computeDuration()).toBeCloseTo(
            sampleCount / sampleRate,
            10,
          );
          expect(
            (await new EncodedPacketSink(track!).getFirstPacket())!.data,
          ).toEqual(new Uint8Array(20));
        } finally {
          input.dispose();
        }
      }
    },
  );
  it("rejects malformed, fragmented, undersized and over-budget metadata", async () => {
    const f = await fixture(48000);
    expect(() =>
      repairAacMoov(f.moov.data, f.moov.position, {
        ...f.timing,
        sampleCount: 9999999,
      }),
    ).toThrow(/cover/);
    expect(() =>
      repairAacMoov(f.moov.data, f.moov.position, f.timing, 8),
    ).toThrow(/budget/);
    expect(() =>
      repairAacMoov(f.moov.data.subarray(0, 20), f.moov.position, f.timing),
    ).toThrow();
    const fragmented = new Uint8Array(16);
    new DataView(fragmented.buffer).setUint32(0, 16);
    fragmented.set(new TextEncoder().encode("moov"), 4);
    new DataView(fragmented.buffer).setUint32(8, 8);
    fragmented.set(new TextEncoder().encode("mvex"), 12);
    expect(() => repairAacMoov(fragmented, 0, f.timing)).toThrow(/Fragmented/);
  });
  it("repairs streamed metadata before close and never reopens a destination", async () => {
    const f = await fixture(145600),
      writes: Array<{ position: number; data: Uint8Array }> = [];
    let closed = 0,
      aborted = 0;
    const relay = createAacTimingStream(
      new WritableStream({
        write(chunk) {
          writes.push({ position: chunk.position, data: chunk.data.slice() });
        },
        close() {
          closed++;
        },
        abort() {
          aborted++;
        },
      }),
    );
    relay.setTiming(f.timing);
    relay.onMoov(f.moov.data, f.moov.position);
    const writer = relay.writable.getWriter();
    await writer.write({
      type: "write",
      position: 0,
      data: new Uint8Array(await f.blob.arrayBuffer()),
    });
    await writer.close();
    writer.releaseLock();
    expect(closed).toBe(1);
    expect(aborted).toBe(0);
    expect(writes).toHaveLength(2);
    expect(writes[1]!.position).toBe(f.moov.position);
    const bytes = new Uint8Array(
      Math.max(...writes.map((write) => write.position + write.data.length)),
    );
    for (const write of writes) bytes.set(write.data, write.position);
    expect(bytes).toEqual(
      new Uint8Array(
        await (await repairAacBlob(f.blob, f.timing)).arrayBuffer(),
      ),
    );
  });
  it("aborts unsupported or cancelled streams without committing", async () => {
    for (const cancel of [false, true]) {
      let closes = 0,
        aborts = 0;
      const controller = new AbortController();
      const relay = createAacTimingStream(
        new WritableStream({
          write() {},
          close() {
            closes++;
          },
          abort() {
            aborts++;
          },
        }),
        controller.signal,
      );
      relay.setTiming({ sampleRate, primingSamples, sampleCount: 800 });
      if (cancel) controller.abort();
      const writer = relay.writable.getWriter();
      await expect(writer.close()).rejects.toBeDefined();
      writer.releaseLock();
      await relay.abort();
      expect(closes).toBe(0);
      expect(aborts).toBe(1);
    }
  });
});
