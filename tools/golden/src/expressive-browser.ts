import { parseScene, type SceneNodeInput } from "@dojo-video-engine/schema";
import { createCanvas2DSceneRuntime } from "@dojo-video-engine/renderer-canvas2d/runtime";
import { exportVideo } from "@dojo-video-engine/export";
import {
  createThreeRegistryOptions,
  THREE_EXTENSION,
} from "@dojo-video-engine/three";

const rect = (left: number, top: number, width: number, height: number) => ({
  position: "absolute" as const,
  left,
  top,
  width,
  height,
});
function binary(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
export async function expressiveProof() {
  const width = 480,
    height = 270,
    fps = 24,
    duration = 48;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const img = document.createElement("canvas");
  img.width = img.height = 64;
  const c = img.getContext("2d")!;
  ["#ff0020", "#00ff20", "#2040ff", "#fff000"].forEach((color, i) => {
    c.fillStyle = color;
    c.fillRect((i % 2) * 32, Math.floor(i / 2) * 32, 32, 32);
  });
  const nodes: SceneNodeInput[] = [
    {
      id: "background",
      type: "video",
      from: 0,
      duration,
      assetId: "film",
      style: rect(0, 0, width, height),
    },
    {
      id: "stripes",
      type: "div",
      style: rect(8, 8, 140, 96),
      children: Array.from({ length: 28 }, (_, i) => ({
        id: "stripe-" + i,
        type: "div",
        style: {
          ...rect(i * 5, 0, 5, 96),
          backgroundColor: i % 2 ? "#ffffff" : "#000000",
        },
      })),
    },
    {
      id: "glass",
      type: "div",
      style: {
        ...rect(20, 26, 114, 52),
        backdropFilter: "blur(5px) brightness(0.8)",
        borderRadius: 10,
      },
    },
    {
      id: "slant",
      type: "div",
      style: {
        ...rect(36, 121, 38, 38),
        transformOrigin: "left top",
        transform: "skewX(30deg)",
        backgroundColor: "#ff9400",
      },
    },
    {
      id: "trace",
      type: "shape",
      shape: {
        kind: "path",
        viewBox: { x: 0, y: 0, width: 200, height: 40 },
        d: "M0 20 C35 -2 65 42 100 20 M115 20 L200 20",
      },
      style: {
        ...rect(15, 192, 180, 40),
        fill: "transparent",
        stroke: "#ec00ff",
        strokeWidth: 5,
        trimEnd: 0,
      },
      animations: [
        {
          kind: "keyframes",
          property: "trimEnd",
          frames: [
            { frame: 0, value: 0 },
            { frame: 47, value: 1 },
          ],
        },
      ],
    },
    {
      id: "screen",
      type: "extension",
      style: rect(192, 7, 286, 252),
      extension: {
        ...THREE_EXTENSION,
        params: {
          camera: {
            kind: "orthographic",
            position: { x: 0, y: 0, z: 5 },
            target: { x: 0, y: 0, z: 0 },
            size: 4,
          },
          materials: {
            ui: { color: "#fff", unlit: true, mapAssetId: "texture" },
          },
          objects: {
            card: {
              kind: "mesh",
              geometry: { kind: "plane", width: 2.7, height: 2.3 },
              materialId: "ui",
              rotation: { x: 0, y: -15, z: 0 },
              keyframes: {
                "position.x": [
                  { time: 0, value: -0.6 },
                  { time: 2, value: 0.6, easing: "easeIn" },
                ],
              },
            },
          },
        },
      },
    },
  ];
  const scene = parseScene({
    schemaVersion: 1,
    width,
    height,
    fps,
    duration,
    assets: {
      texture: { id: "texture", type: "image", src: img.toDataURL() },
      film: { id: "film", type: "video", src: "/expressive-proof.mp4" },
    },
    nodes,
  });
  const registry = createThreeRegistryOptions(),
    runtime = await createCanvas2DSceneRuntime({ scene, resolve: registry });
  const seen = new Map<number, string>();
  try {
    for (const f of [0, 24, 47, 12, 24, 0]) {
      await runtime.renderFrame(f, ctx);
      const png = canvas.toDataURL();
      if (seen.has(f) && seen.get(f) !== png)
        throw Error("Backward seek changed frame " + f);
      seen.set(f, png);
    }
  } finally {
    await runtime.disposeAsync();
  }
  const output = await exportVideo({ scene, ...registry });
  return {
    frames: Object.fromEntries(seen),
    mp4: binary(new Uint8Array(await output.blob.arrayBuffer())),
    totalFrames: scene.duration,
  };
}
