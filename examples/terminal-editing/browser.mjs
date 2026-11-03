import {
  renderSceneStill,
  renderContactSheet,
} from "@dojo-video-engine/agent-tools";
import { exportVideo } from "@dojo-video-engine/export";

const png = (canvas) =>
  canvas.convertToBlob
    ? canvas.convertToBlob({ type: "image/png" })
    : new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
async function save(name, blob) {
  const response = await fetch(`/__output/${name}`, {
    method: "POST",
    body: blob,
  });
  if (!response.ok)
    throw new Error(`Could not save ${name}: ${response.status}`);
}
window.runTerminalRender = async (scene, frames) => {
  for (const frame of frames) {
    await save(
      `frame-${frame}.png`,
      await png(await renderSceneStill({ scene, frame })),
    );
  }
  await save(
    "contact-sheet.png",
    await png(
      await renderContactSheet({ scene, frames, columns: 3, cellWidth: 320 }),
    ),
  );
  const result = await exportVideo({
    scene,
    verification: "sampled",
    requireAudibleAudio: true,
    onProgress: (progress) =>
      console.log(`export ${progress.frameIndex}/${progress.totalFrames}`),
  });
  await save("edited.mp4", result.blob);
  return {
    codec: result.codec,
    totalFrames: result.totalFrames,
    verification: result.verification,
  };
};
