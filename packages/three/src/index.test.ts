import { expect, it } from "vitest";
import { preflightExtensions } from "@dojo-video-engine/extensions";
import { createThreeRegistryOptions, THREE_EXTENSION } from "./index.js";
const fixture = {
  camera: {
    kind: "perspective",
    position: { x: 0, y: 0, z: 7 },
    target: { x: 0, y: 0, z: 0 },
  },
  materials: { red: { color: "red" } },
  objects: {
    cube: {
      kind: "mesh",
      materialId: "red",
      geometry: { kind: "box", width: 1, height: 1, depth: 1 },
    },
  },
};
it("registers exact display capabilities without WebGL or DOM initialization", () => {
  const options = createThreeRegistryOptions();
  const scene = {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 30,
    nodes: [
      {
        id: "model",
        type: "extension",
        extension: { ...THREE_EXTENSION, params: fixture },
      },
    ],
  };
  expect(
    preflightExtensions(scene, options.extensions, {
      displayTarget: options.opaqueExtensionRegistry.displayTarget(),
    }).ok,
  ).toBe(true);
  expect(
    preflightExtensions(scene, options.extensions, {
      worker: true,
      renderer: "canvas2d",
    }).ok,
  ).toBe(false);
});
