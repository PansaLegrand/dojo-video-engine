import { importSvgGraphic } from "@dojo-video-engine/interchange/svg";
import {
  createThreeRegistryOptions,
  THREE_EXTENSION,
} from "@dojo-video-engine/three";
import { createCanvas2DSceneRuntime } from "@dojo-video-engine/renderer-canvas2d/runtime";
import { exportVideo } from "@dojo-video-engine/export";
import { parseScene, type SceneNodeInput } from "@dojo-video-engine/schema";

declare global {
  interface Window {
    runGraphicsProof: () => Promise<{
      png: string;
      mp4: string;
      checks: string[];
      scene: unknown;
    }>;
  }
}

window.runGraphicsProof = async () => {
  const checks: string[] = [];
  const assert = (ok: boolean, message: string): void => {
    if (!ok) throw new Error(message);
    checks.push(message);
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 220">
  <g id="bike" fill="none" stroke="#ff5252" stroke-width="6"><path d="M55 165 L100 105 L135 165 L55 165 L165 110 L190 165 M100 105 L165 110"/></g>
  <g id="wheel" fill="none" stroke="#69dcff" stroke-width="4"><circle cx="55" cy="165" r="34"/><path d="M21 165 H89 M55 131 V199"/></g>
  <g fill="none" stroke="#69dcff" stroke-width="4"><circle cx="190" cy="165" r="34"/><path d="M156 165 H224 M190 131 V199"/></g>
  <g id="bird" fill="#ffffff"><ellipse cx="111" cy="85" rx="43" ry="27"/><path d="M120 73 Q125 20 153 25 L166 42 Q137 40 140 83 Z"/><circle cx="155" cy="35" r="17"/></g>
  <path id="beak" fill="#ffc04d" d="M165 31 L238 42 L165 51 Q176 75 195 59 L238 42 Z"/><circle cx="158" cy="30" r="3" fill="#15213d"/>
  <path fill="none" stroke="#ffc04d" stroke-width="5" d="M115 104 L104 131 L135 155 M130 102 L143 125 L135 155"/>
  </svg>`;
  const imported = importSvgGraphic(svg, {
    id: "pelican-vector",
    duration: 60,
  });
  imported.node.style = { ...imported.node.style, left: 5, top: 100 };
  const wheel = imported.node.children?.find(
    (node) => node.id === imported.ids.wheel,
  );
  if (!wheel) throw new Error("Missing imported wheel");
  wheel.style = { ...wheel.style, transformOrigin: "55px 165px" };
  wheel.animations = [
    {
      kind: "keyframes",
      property: "transform",
      frames: [
        { frame: 0, value: "rotate(0deg)" },
        { frame: 59, value: "rotate(360deg)" },
      ],
    },
  ];
  const three: SceneNodeInput = {
    id: "pelican-three",
    type: "extension",
    from: 0,
    duration: 60,
    style: {
      position: "absolute",
      left: 270,
      top: 15,
      width: 360,
      height: 320,
    },
    extension: {
      ...THREE_EXTENSION,
      params: {
        camera: {
          kind: "perspective",
          position: { x: 0, y: 1.4, z: 7 },
          target: { x: 0, y: 0.4, z: 0 },
          orbit: { degreesPerSecond: 35 },
        },
        materials: {
          bird: { color: "#ffffff" },
          beak: { color: "#ffb52e" },
          bike: { color: "#ff334e" },
          tire: { color: "#32caff" },
        },
        objects: {
          bird: {
            kind: "mesh",
            geometry: { kind: "sphere", radius: 0.7 },
            materialId: "bird",
            position: { x: 0, y: 0.7, z: 0 },
            scale: { x: 1.3, y: 0.65, z: 0.7 },
          },
          neck: {
            kind: "mesh",
            geometry: {
              kind: "cylinder",
              radiusTop: 0.17,
              radiusBottom: 0.23,
              height: 0.9,
            },
            materialId: "bird",
            position: { x: 0.5, y: 1.25, z: 0 },
            rotation: { x: 0, y: 0, z: -15 },
          },
          head: {
            kind: "mesh",
            geometry: { kind: "sphere", radius: 0.28 },
            materialId: "bird",
            position: { x: 0.65, y: 1.75, z: 0 },
          },
          beak: {
            kind: "mesh",
            geometry: {
              kind: "cylinder",
              radiusTop: 0.02,
              radiusBottom: 0.15,
              height: 1,
            },
            materialId: "beak",
            position: { x: 1.2, y: 1.7, z: 0 },
            rotation: { x: 0, y: 0, z: -90 },
          },
          frame: {
            kind: "mesh",
            geometry: {
              kind: "triangles",
              positions: [-1, -0.5, 0, 0, 0.5, 0, 1, -0.5, 0],
            },
            materialId: "bike",
          },
          rearWheel: {
            kind: "mesh",
            geometry: { kind: "torus", radius: 0.55, tube: 0.07 },
            materialId: "tire",
            position: { x: -1, y: -0.5, z: 0 },
            spin: { x: 0, y: 0, z: -180 },
          },
          frontWheel: {
            kind: "mesh",
            geometry: { kind: "torus", radius: 0.55, tube: 0.07 },
            materialId: "tire",
            position: { x: 1, y: -0.5, z: 0 },
            spin: { x: 0, y: 0, z: -180 },
          },
        },
      },
    },
  };
  const scene = parseScene({
    schemaVersion: 1,
    width: 640,
    height: 360,
    fps: 30,
    duration: 60,
    assets: {
      footage: { id: "footage", type: "video", src: "/graphics-source.mp4" },
    },
    nodes: [
      {
        id: "footage",
        type: "video",
        assetId: "footage",
        from: 0,
        duration: 60,
        style: { position: "absolute", inset: 0 },
      },
      imported.node,
      three,
    ],
  });
  const graphics = createThreeRegistryOptions();
  const canvas = document.querySelector<HTMLCanvasElement>("#preview");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) throw new Error("No canvas");
  const referenceSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g opacity="0.5"><rect x="10" y="10" width="60" height="60" fill="red"/><rect x="30" y="30" width="60" height="60" fill="blue"/></g></svg>';
  const referenceCanvas = document.createElement("canvas");
  referenceCanvas.width = referenceCanvas.height = 100;
  const referenceContext = referenceCanvas.getContext("2d");
  if (!referenceContext) throw new Error("No reference canvas");
  const svgImage = new Image();
  svgImage.src = `data:image/svg+xml,${encodeURIComponent(referenceSvg)}`;
  await svgImage.decode();
  referenceContext.drawImage(svgImage, 0, 0);
  const referencePixels = referenceContext.getImageData(0, 0, 100, 100).data;
  const importedReference = importSvgGraphic(referenceSvg, {
    id: "reference",
    duration: 1,
  });
  const svgRuntime = await createCanvas2DSceneRuntime({
    scene: parseScene({
      schemaVersion: 1,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      nodes: [importedReference.node],
    }),
  });
  try {
    await svgRuntime.renderFrame(0, referenceContext);
    const actual = referenceContext.getImageData(0, 0, 100, 100).data;
    let differing = 0;
    for (let i = 0; i < actual.length; i += 4)
      if (
        [0, 1, 2, 3].some(
          (c) =>
            Math.abs((actual[i + c] ?? 0) - (referencePixels[i + c] ?? 0)) > 2,
        )
      )
        differing++;
    assert(
      differing < 300,
      "Editable SVG matches independent SVG rasterization, including overlapping group opacity (under 3% pixels)",
    );
  } finally {
    await svgRuntime.disposeAsync();
  }
  const runtime = await createCanvas2DSceneRuntime({
    scene,
    resolve: graphics,
  });
  const frames = new Map<number, string>();
  try {
    for (const frame of [0, 30, 59, 0, 30]) {
      await runtime.renderFrame(frame, context);
      const data = canvas.toDataURL();
      if (frames.has(frame))
        assert(
          data === frames.get(frame),
          `Frame ${frame} is identical after backward seeking`,
        );
      frames.set(frame, data);
    }
    assert(
      frames.get(0) !== frames.get(30),
      "Animation changes visible pixels",
    );
    const pixels = context.getImageData(0, 0, 640, 360).data;
    let vectorPixels = 0,
      threePixels = 0;
    for (let y = 0; y < 360; y++)
      for (let x = 0; x < 640; x++) {
        const i = (y * 640 + x) * 4;
        if ((pixels[i] ?? 0) > 150 || (pixels[i + 1] ?? 0) > 150) {
          if (x < 270) vectorPixels++;
          else threePixels++;
        }
      }
    assert(
      vectorPixels > 1500 && threePixels > 1500,
      "Both editable layers produce visible geometry over footage",
    );
    // Export while the preview owns a live revision: resources must be independent.
    const output = await exportVideo({ scene, ...graphics });
    assert(output.blob.size > 1000, "Mixed-media MP4 export produced bytes");
    await runtime.renderFrame(0, context);
    assert(
      canvas.toDataURL() === frames.get(0),
      "Concurrent export preserves preview resources",
    );
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = new Proxy(originalGetContext, {
      apply(target, receiver, args) {
        return args[0] === "webgl2"
          ? null
          : Reflect.apply(target, receiver, args);
      },
    });
    let failedRuntime:
      | Awaited<ReturnType<typeof createCanvas2DSceneRuntime>>
      | undefined;
    try {
      failedRuntime = await createCanvas2DSceneRuntime({
        scene,
        resolve: graphics,
      });
      let rejected = false;
      try {
        await failedRuntime.renderFrame(0, context);
      } catch (error) {
        rejected = error instanceof Error && error.message.includes("WebGL2");
      }
      assert(
        rejected,
        "Missing WebGL2 fails with an actionable error instead of a blank success",
      );
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      await failedRuntime?.disposeAsync();
    }
    await runtime.renderFrame(0, context);
    const buffer = new Uint8Array(await output.blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buffer.length; i += 8192)
      binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
    return {
      png: canvas.toDataURL().split(",")[1] ?? "",
      mp4: btoa(binary),
      checks,
      scene,
    };
  } finally {
    await runtime.disposeAsync();
  }
};
