import { createCanvas2DSceneRuntime } from "@dojo-video-engine/renderer-canvas2d/runtime";
import { createThreeRegistryOptions } from "@dojo-video-engine/three";
import { exportVideo } from "@dojo-video-engine/export";

const base64 = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
};

window.renderShowcase = async ({ scene, frames, stillsOnly }) => {
  const graphics = createThreeRegistryOptions();
  const canvas = document.createElement("canvas");
  canvas.width = scene.width;
  canvas.height = scene.height;
  document.body.replaceChildren(canvas);
  const context = canvas.getContext("2d");
  const runtime = await createCanvas2DSceneRuntime({
    scene,
    resolve: graphics,
  });
  const stills = [];
  try {
    for (const frame of frames) {
      await runtime.renderFrame(frame, context);
      stills.push({ frame, png: canvas.toDataURL("image/png").split(",")[1] });
    }
  } finally {
    await runtime.disposeAsync();
  }
  if (stillsOnly) return { stills };
  const output = await exportVideo({
    scene,
    ...graphics,
    verification: "sampled",
    onProgress: ({ frameIndex, totalFrames }) => {
      if (frameIndex % 60 === 0)
        console.log(`Rendering ${frameIndex}/${totalFrames}`);
    },
  });
  return {
    stills,
    mp4: await base64(output.blob),
    codec: output.codec,
    totalFrames: output.totalFrames,
    verification: output.verification,
  };
};
