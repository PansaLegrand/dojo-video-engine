import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { expandMacroNodeInput } from "@dojo-video-engine/presets/macros";
import { applyScenePatch, parseScene } from "@dojo-video-engine/schema";

const harness = fileURLToPath(new URL(".", import.meta.url));
const proof = join(harness, "../../test-results/charts");
await mkdir(proof, { recursive: true });
const output = await mkdtemp(join(proof, "run-"));
const fps = 24;
const duration = 36;

function decode(bytes, width, height) {
  return execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      "pipe:0",
      "-vf",
      `scale=${width}:${height}`,
      "-fps_mode",
      "passthrough",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "pipe:1",
    ],
    { input: bytes, maxBuffer: width * height * 3 * (duration + 1) },
  );
}

function expand(width, height, input) {
  const context = { width, height, fps, duration };
  const expanded = expandMacroNodeInput(input, context);
  assert(expanded.ok, JSON.stringify(expanded));
  return parseScene({
    schemaVersion: 1,
    ...context,
    assets: {},
    nodes: expanded.nodes,
  });
}

function allNodes(nodes) {
  return nodes.flatMap((node) => [node, ...allNodes(node.children ?? [])]);
}

async function render(page, name, scene, inspect) {
  await writeFile(
    join(output, name + ".scene.json"),
    JSON.stringify(scene, null, 2),
  );
  const width = scene.width / 2,
    height = scene.height / 2;
  const frames = [duration - 1, 0, 3, 7, 12, 18];
  const preview = {};
  for (const frame of frames) {
    const result = await page.evaluate(
      ({ scene, frame }) => window.renderGoldenFramePng(scene, frame),
      { scene, frame },
    );
    const png = Buffer.from(result, "base64");
    await writeFile(join(output, name + "-frame-" + frame + ".png"), png);
    preview[frame] = inspect(decode(png, width, height), width, height, frame);
  }
  const exported = await page.evaluate(
    (scene) => window.renderGoldenExportFile(scene),
    scene,
  );
  assert.equal(exported.totalFrames, duration);
  const video = Buffer.from(exported.base64, "base64");
  const videoPath = join(output, name + ".mp4");
  await writeFile(videoPath, video);
  const stream = JSON.parse(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,r_frame_rate",
      "-of",
      "json",
      videoPath,
    ]),
  ).streams[0];
  assert.deepEqual(
    [stream.width, stream.height, stream.r_frame_rate],
    [scene.width, scene.height, fps + "/1"],
  );
  const rgb = decode(video, width, height),
    stride = width * height * 3;
  assert.equal(rgb.length, stride * duration);
  const decoded = Array.from({ length: duration }, (_, frame) =>
    inspect(
      rgb.subarray(frame * stride, (frame + 1) * stride),
      width,
      height,
      frame,
    ),
  );
  return { preview, decoded, codec: exported.codec };
}

function chartProbe(kind, values) {
  let axis, slots, settled;
  return (rgb, width, height, frame) => {
    const linePixelsPerColumn = new Array(width).fill(0);
    const tips = [],
      markers = [],
      line = [];
    if (!axis) {
      assert.equal(frame, duration - 1);
      let best = 0;
      for (let y = 0; y < height; y++) {
        let left = width,
          right = 0,
          count = 0;
        for (let x = 0; x < width; x++) {
          const at = (y * width + x) * 3;
          if (
            Math.abs(rgb[at] - 148) > 40 ||
            Math.abs(rgb[at + 1] - 163) > 40 ||
            Math.abs(rgb[at + 2] - 184) > 40
          )
            continue;
          left = Math.min(x, left);
          right = x;
          count++;
        }
        if (count > best) {
          best = count;
          axis = { left, right, y };
        }
      }
      assert(best > width * 0.15, "zero axis must be visible");
      slots = values.map((_, index) =>
        Math.round(
          axis.left +
            ((axis.right - axis.left) * (index + 0.5)) / values.length,
        ),
      );
    }
    const centerYs = slots.map(() => []),
      barYs = slots.map(() => []);
    let ink = 0,
      lineEnd = null;
    for (let y = 0; y < height; y++) {
      for (let x = axis.left; x <= axis.right; x++) {
        const at = (y * width + x) * 3;
        const red = rgb[at],
          green = rgb[at + 1],
          blue = rgb[at + 2];
        if (green > red + 65 && green > blue + 50) {
          const slot = slots.findIndex((center) => Math.abs(center - x) <= 6);
          assert(
            slot >= 0,
            "marker drifted from its data column at frame " + frame,
          );
          centerYs[slot].push(y);
        }
        if (blue < red + 85 || green < red + 55 || blue <= green) continue;
        ink++;
        if (kind === "bar") {
          const slot = slots.indexOf(x);
          if (slot >= 0) barYs[slot].push(y);
        } else {
          lineEnd = Math.max(lineEnd ?? 0, x);
          linePixelsPerColumn[x]++;
          line.push([x, y]);
        }
      }
    }
    for (let i = 0; i < values.length; i++) {
      const rows = kind === "bar" ? barYs[i] : centerYs[i];
      if (kind === "bar" && rows.length) {
        const positive = values[i] > 0;
        assert(
          Math.abs((positive ? rows.at(-1) : rows[0]) - axis.y) <= 3,
          "bar separated from zero at frame " + frame,
        );
        tips.push(positive ? rows[0] : rows.at(-1));
      } else tips.push(rows.length ? (rows[0] + rows.at(-1)) / 2 : null);
      if (centerYs[i].length) markers.push(i);
    }
    if (!settled) {
      settled = tips.map((value) => value ?? axis.y);
      const scale = (axis.y - settled[0]) / values[0];
      assert(scale > 0.35, "readable chart scale");
      for (let i = 0; i < values.length; i++) {
        assert(
          Math.abs(axis.y - scale * values[i] - settled[i]) <= 4,
          "incorrect numerical relationship for column " + i,
        );
        if (values[i] !== 0 || kind === "line") assert.notEqual(tips[i], null);
      }
    }
    if (kind === "line") {
      for (const i of markers) {
        assert(
          Math.abs(tips[i] - settled[i]) <= 4,
          "marker y shifted during reveal at frame " + frame,
        );
        assert(
          slots[i] <= (lineEnd ?? slots[0]) + 8,
          "marker revealed ahead of line at frame " + frame,
        );
      }
      for (const [x, y] of line) {
        const index = Math.max(
          0,
          Math.min(
            values.length - 2,
            slots.findLastIndex((center) => center <= x),
          ),
        );
        const dx = slots[index + 1] - slots[index],
          dy = settled[index + 1] - settled[index];
        const distance =
          Math.abs(dy * (x - slots[index]) - dx * (y - settled[index])) /
          Math.hypot(dx, dy);
        assert(
          distance <= 4,
          "line missed its plotted points at frame " + frame,
        );
      }
      if (frame === duration - 1) {
        assert.equal(markers.length, values.length);
        for (let x = slots[0] + 6; x < slots.at(-1) - 6; x++)
          if (slots.every((center) => Math.abs(x - center) > 6))
            assert(
              linePixelsPerColumn[x] > 0,
              "settled line disconnected at x=" + x,
            );
      }
    } else {
      assert.equal(tips[values.indexOf(0)], null, "zero bar shows data ink");
    }
    return {
      ink,
      lineEnd,
      markers,
      lengths: tips.map((y) => (y === null ? 0 : Math.abs(axis.y - y))),
    };
  };
}

const server = await createServer({
  root: harness,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage(),
    report = { browser: browser.version(), charts: {} };
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(
    () => typeof window.renderGoldenExportFile === "function",
  );
  for (const kind of ["line", "bar"]) {
    const values = kind === "line" ? [-30, 58, 12, 74] : [-40, 20, 0, 80];
    const data = values.map((value, index) => ({
      label: ["Jan", "Feb", "Mar", "Apr"][index],
      value,
    }));
    const portrait = kind === "line";
    let scene = expand(portrait ? 720 : 1280, portrait ? 1280 : 720, {
      macro: "dataChart",
      id: "growth",
      kind,
      domain: { min: -50, max: 100 },
      unit: "%",
      data,
    });
    if (portrait) {
      const markers = allNodes(scene.nodes).filter(
        (node) => node.shape?.kind === "ellipse",
      );
      assert.equal(markers.length, data.length);
      const category = allNodes(scene.nodes).find(
        (node) => node.text === "Jan",
      );
      const edit = applyScenePatch(scene, [
        { op: "setText", id: category.id, text: "January" },
        ...markers.map((node) => ({
          op: "setStyle",
          id: node.id,
          style: { fill: "#24ff55" },
        })),
      ]);
      assert(edit.ok, JSON.stringify(edit.errors));
      assert.equal(
        allNodes(scene.nodes).find((node) => node.id === category.id).text,
        "Jan",
      );
      scene = parseScene(JSON.parse(JSON.stringify(edit.scene)));
      assert.equal(
        allNodes(scene.nodes).find((node) => node.id === category.id).text,
        "January",
      );
    }
    const result = await render(page, kind, scene, chartProbe(kind, values));
    const { decoded } = result;
    const last = decoded.at(-1);
    assert(
      last.ink > 200 && decoded[0].ink < last.ink * 0.1,
      "visible entrance and readable final state",
    );
    if (kind === "line") {
      assert(
        decoded.some(
          ({ markers }) => markers.length > 0 && markers.length < values.length,
        ),
        "line reveals its markers progressively",
      );
      assert(
        decoded.some(({ lineEnd }) => lineEnd && lineEnd < last.lineEnd - 20),
        "line reveal must progress",
      );
    } else {
      for (let frame = 1; frame < duration; frame++)
        for (let i = 0; i < values.length; i++) {
          assert(
            decoded[frame].lengths[i] >= decoded[frame - 1].lengths[i] - 2,
            "bar must grow away from zero",
          );
          assert(
            Math.abs(
              decoded[frame].lengths[i] -
                decoded[frame].lengths[3] * Math.abs(values[i] / values[3]),
            ) <= 2,
            "intermediate bar lengths must share the same data scale",
          );
        }
      assert(
        decoded.some(
          ({ lengths }) =>
            lengths[3] > 5 && lengths[3] < last.lengths[3] * 0.85,
        ),
        "bar must have intermediate proportional heights",
      );
    }
    report.charts[kind] = result;
  }
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log("Chart browser previews and decoded exports passed:", output);
} finally {
  await browser?.close();
  await server.close();
}
