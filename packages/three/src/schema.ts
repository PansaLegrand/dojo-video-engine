import { z } from "zod/v3";
import {
  colorValueSchema,
  type SceneNodeInput,
} from "@dojo-video-engine/schema";

export const THREE_EXTENSION = Object.freeze({
  name: "dojo.three-scene",
  version: "1.0.0",
});
export const THREE_LIMITS = Object.freeze({
  objects: 128,
  materials: 32,
  vertices: 100_000,
  pixels: 8_294_400,
  layers: 4,
});
const id = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/)
  .refine(
    (value) => !["constructor", "prototype", "__proto__"].includes(value),
    "Reserved object ID.",
  );
const scalar = z.number().finite().min(-10_000).max(10_000);
const vector = z.object({ x: scalar, y: scalar, z: scalar }).strict();
const size = z.number().finite().positive().max(1000);
const geometry = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("box"), width: size, height: size, depth: size })
    .strict(),
  z.object({ kind: z.literal("sphere"), radius: size }).strict(),
  z
    .object({
      kind: z.literal("cylinder"),
      radiusTop: z.number().min(0).max(1000),
      radiusBottom: size,
      height: size,
    })
    .strict(),
  z.object({ kind: z.literal("torus"), radius: size, tube: size }).strict(),
  z
    .object({
      kind: z.literal("triangles"),
      positions: z.array(scalar).min(9).max(12_000),
    })
    .strict(),
]);
const keyframe = z
  .object({ time: z.number().finite().min(0).max(86_400), value: scalar })
  .strict();
const track = z
  .array(keyframe)
  .min(1)
  .max(128)
  .refine(
    (points) =>
      points.every((p, i) => i === 0 || p.time > (points[i - 1]?.time ?? 0)),
    "Keyframe seconds must be strictly increasing.",
  );
const channels = z
  .object({
    "position.x": track.optional(),
    "position.y": track.optional(),
    "position.z": track.optional(),
    "rotation.x": track.optional(),
    "rotation.y": track.optional(),
    "rotation.z": track.optional(),
    "scale.x": track.optional(),
    "scale.y": track.optional(),
    "scale.z": track.optional(),
  })
  .strict();
const transform = {
  parentId: id.optional(),
  position: vector.optional(),
  rotation: vector.optional(),
  scale: z.object({ x: size, y: size, z: size }).strict().optional(),
  spin: vector.optional(),
  keyframes: channels.optional(),
};
const object = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("group"), ...transform }).strict(),
  z
    .object({ kind: z.literal("mesh"), ...transform, geometry, materialId: id })
    .strict(),
]);
const camera = z
  .object({
    kind: z.enum(["perspective", "orthographic"]),
    position: vector,
    target: vector,
    fov: z.number().min(1).max(150).default(45),
    size: size.default(6),
    orbit: z
      .object({ degreesPerSecond: scalar, phase: scalar.default(0) })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      Math.hypot(
        value.position.x - value.target.x,
        value.position.y - value.target.y,
        value.position.z - value.target.z,
      ) > 0.01,
    "Camera position must differ from its target.",
  );
const material = z
  .object({
    color: colorValueSchema,
    unlit: z.boolean().default(false),
    opacity: z.number().min(0).max(1).default(1),
    roughness: z.number().min(0).max(1).default(0.6),
    metalness: z.number().min(0).max(1).default(0),
  })
  .strict();

export const threeSceneSchema = z
  .object({
    camera,
    objects: z
      .record(id, object)
      .refine(
        (value) =>
          Object.keys(value).length > 0 &&
          Object.keys(value).length <= THREE_LIMITS.objects,
        "Use 1–128 objects.",
      ),
    materials: z
      .record(id, material)
      .refine(
        (value) =>
          Object.keys(value).length > 0 &&
          Object.keys(value).length <= THREE_LIMITS.materials,
        "Use 1–32 materials.",
      ),
    lighting: z
      .object({
        ambient: z.number().min(0).max(5),
        intensity: z.number().min(0).max(10),
        position: vector,
      })
      .strict()
      .default({ ambient: 1, intensity: 3, position: { x: 4, y: 6, z: 8 } }),
    timeOffset: z.number().finite().min(-86_400).max(86_400).default(0),
    rate: z.number().finite().min(0.01).max(16).default(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    let vertices = 0;
    for (const [name, entry] of Object.entries(value.objects)) {
      const report = (message: string) =>
        ctx.addIssue({ code: "custom", path: ["objects", name], message });
      const visited = new Set([name]);
      let parent = entry.parentId;
      while (parent) {
        if (visited.has(parent)) {
          report("Object parents must not form a cycle.");
          break;
        }
        visited.add(parent);
        const ancestor = value.objects[parent];
        if (!ancestor) {
          report(`Missing parent ${parent}.`);
          break;
        }
        parent = ancestor.parentId;
      }
      if (entry.kind === "mesh") {
        if (!value.materials[entry.materialId])
          report(`Missing material ${entry.materialId}.`);
        if (entry.geometry.kind === "triangles") {
          if (entry.geometry.positions.length % 9)
            report("Triangle positions need nine numbers per triangle.");
          vertices += entry.geometry.positions.length / 3;
        } else vertices += entry.geometry.kind === "box" ? 24 : 1200;
      }
    }
    if (vertices > THREE_LIMITS.vertices)
      ctx.addIssue({
        code: "custom",
        message: "3D geometry exceeds the 100,000 vertex budget.",
      });
    if (JSON.stringify(value).length > 128_000)
      ctx.addIssue({
        code: "custom",
        message: "3D parameters exceed 128KB; simplify the scene.",
      });
  });
export type ThreeScene = z.infer<typeof threeSceneSchema>;
export type ThreeObject = ThreeScene["objects"][string];
export type ThreeVector = z.infer<typeof vector>;

/** Pure data validation, safe in hosts without DOM/WebGL. */
export function parseThreeScene(input: unknown): ThreeScene {
  return threeSceneSchema.parse(input);
}

/** Validate known layers after every command; unknown extensions remain host-owned. */
export function validateThreeLayers(nodes: readonly SceneNodeInput[]): void {
  let count = 0;
  const visit = (node: SceneNodeInput): void => {
    if (node.extension?.name === THREE_EXTENSION.name) {
      if (node.extension.version !== THREE_EXTENSION.version)
        throw new Error(
          "Unsupported dojo.three-scene version; install the matching engine.",
        );
      parseThreeScene(node.extension.params);
      if (++count > THREE_LIMITS.layers)
        throw new Error("A scene supports at most four Three.js layers.");
    }
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
}

/** Linear tracks use absolute source seconds; no accumulated playback state. */
export function sampleThreeTrack(
  points: readonly z.infer<typeof keyframe>[],
  time: number,
): number {
  const first = points[0];
  if (!first) throw new Error("An animation track must contain a keyframe.");
  if (time <= first.time) return first.value;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (a && b && time <= b.time)
      return (
        a.value + ((b.value - a.value) * (time - a.time)) / (b.time - a.time)
      );
  }
  return points[points.length - 1]?.value ?? first.value;
}

export function evaluateThreeTransform(
  object: ThreeObject,
  time: number,
): { position: ThreeVector; rotation: ThreeVector; scale: ThreeVector } {
  const result = {
    position: { x: 0, y: 0, z: 0, ...object.position },
    rotation: { x: 0, y: 0, z: 0, ...object.rotation },
    scale: { x: 1, y: 1, z: 1, ...object.scale },
  };
  for (const axis of ["x", "y", "z"] as const) {
    result.rotation[axis] += (object.spin?.[axis] ?? 0) * time;
    for (const property of ["position", "rotation", "scale"] as const) {
      const frames = object.keyframes?.[`${property}.${axis}`];
      if (frames) result[property][axis] = sampleThreeTrack(frames, time);
    }
  }
  return result;
}
