import { describe, expect, it } from "vitest";
import {
  evaluateThreeTransform,
  parseThreeScene,
  sampleThreeTrack,
  validateThreeLayers,
  THREE_EXTENSION,
} from "./schema.js";
export const fixture = {
  camera: {
    kind: "perspective",
    position: { x: 0, y: 1, z: 7 },
    target: { x: 0, y: 0, z: 0 },
  },
  materials: { body: { color: "#ff0000", unlit: true } },
  objects: {
    wheel: {
      kind: "mesh",
      geometry: { kind: "torus", radius: 1, tube: 0.15 },
      materialId: "body",
      spin: { x: 0, y: 90, z: 0 },
    },
  },
};
describe("declarative 3D scenes", () => {
  it("reconstructs motion in arbitrary time order without mutating source", () => {
    const scene = parseThreeScene(fixture),
      object = scene.objects.wheel;
    if (!object) throw new Error("fixture missing");
    expect(
      [2, 0, 1, 2].map(
        (time) => evaluateThreeTransform(object, time).rotation.y,
      ),
    ).toEqual([180, 0, 90, 180]);
    expect(object.rotation).toBeUndefined();
  });
  it("interpolates and clamps keyframes in source seconds", () => {
    const points = [
      { time: 0, value: 5 },
      { time: 2, value: 9 },
    ];
    expect([-1, 0, 1, 2, 3].map((t) => sampleThreeTrack(points, t))).toEqual([
      5, 5, 7, 9, 9,
    ]);
  });
  it.each([
    { materials: { body: { color: "red", shader: "evil" } } },
    { objects: { wheel: { ...fixture.objects.wheel, parentId: "wheel" } } },
    { objects: { wheel: { ...fixture.objects.wheel, parentId: "absent" } } },
    { objects: { wheel: { ...fixture.objects.wheel, materialId: "absent" } } },
    {
      objects: {
        wheel: {
          ...fixture.objects.wheel,
          geometry: { kind: "triangles", positions: Array(10).fill(0) },
        },
      },
    },
    { rate: Infinity },
    { rate: 0 },
    { camera: { ...fixture.camera, position: fixture.camera.target } },
    {
      objects: {
        wheel: {
          ...fixture.objects.wheel,
          keyframes: {
            "rotation.x": [
              { time: 1, value: 0 },
              { time: 1, value: 90 },
            ],
          },
        },
      },
    },
  ])("rejects malformed/unsupported state %#", (patch) => {
    expect(() => parseThreeScene({ ...fixture, ...patch })).toThrow();
  });
  it("validates version and total layers before runtime allocation", () => {
    const node = {
      id: "three",
      type: "extension" as const,
      extension: { ...THREE_EXTENSION, params: fixture },
    };
    expect(() => validateThreeLayers([node])).not.toThrow();
    expect(() => validateThreeLayers(Array(5).fill(node))).toThrow(/four/);
    expect(() =>
      validateThreeLayers([
        { ...node, extension: { ...node.extension, version: "2.0.0" } },
      ]),
    ).toThrow(/version/);
  });
});
