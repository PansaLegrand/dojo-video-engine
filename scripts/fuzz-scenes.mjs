#!/usr/bin/env node
import {
  applyScenePatch,
  migrateScene,
  validateScene,
} from "../packages/schema/dist/index.js";
import { evaluateScene, layoutScene } from "../packages/core/dist/index.js";

let state = 0x5eed1234;
const random = () => {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 0xffffffff;
};
const integer = (min, max) => min + Math.floor(random() * (max - min + 1));
const color = () => `#${integer(0, 0xffffff).toString(16).padStart(6, "0")}`;

const iterations = Number(process.env.DOJO_VIDEO_ENGINE_FUZZ_ITERATIONS ?? 750);
let evaluatedFrames = 0;

for (let iteration = 0; iteration < iterations; iteration += 1) {
  const duration = integer(10, 240);
  const nodes = Array.from({ length: integer(1, 14) }, (_, index) => {
    const type = ["div", "text", "shape"][integer(0, 2)];
    const from = integer(0, Math.max(0, duration - 2));
    const nodeDuration = integer(1, Math.max(1, duration - from));
    const base = {
      id: `node-${iteration}-${index}`,
      type,
      from,
      duration: nodeDuration,
      style: {
        position: "absolute",
        left: integer(-20, 200),
        top: integer(-20, 120),
        width: integer(4, 160),
        height: integer(4, 100),
        opacity: Number(random().toFixed(4)),
        backgroundColor: color(),
      },
      animations:
        random() > 0.45
          ? [
              {
                kind: "keyframes",
                property: "opacity",
                frames: [
                  { frame: 0, value: 0 },
                  {
                    frame: Math.max(1, nodeDuration - 1),
                    value: 1,
                    easing: random() > 0.5 ? "easeOut" : "linear",
                  },
                ],
                ...(random() > 0.8
                  ? { repeat: integer(0, 3), yoyo: true }
                  : {}),
              },
            ]
          : [],
    };
    if (type === "text") {
      return { ...base, text: `Fuzz ${iteration}:${index}` };
    }
    if (type === "shape") {
      return {
        ...base,
        shape:
          random() > 0.5
            ? { kind: "ellipse" }
            : { kind: "rect", radius: integer(0, 24) },
        style: { ...base.style, fill: color() },
      };
    }
    return base;
  });
  const scene = {
    schemaVersion: 1,
    width: integer(160, 1920),
    height: integer(90, 1080),
    fps: [24, 25, 30, 60][integer(0, 3)],
    duration,
    markers: { intro: 0, outro: duration - 1 },
    assets: {},
    nodes,
  };
  const snapshot = structuredClone(scene);
  const validated = validateScene(scene);
  if (!validated.ok) {
    throw new Error(
      `fuzz scene ${iteration} failed validation: ${validated.errors.join("; ")}`,
    );
  }
  const migrated = migrateScene(validated.scene);
  if (migrated.scene !== validated.scene || migrated.migrations.length !== 0) {
    throw new Error(`fuzz scene ${iteration} was not idempotent`);
  }
  for (const frame of [0, integer(0, duration - 1), duration - 1]) {
    const resolved = evaluateScene(validated.scene, frame);
    const layout = layoutScene(resolved);
    if (layout.boxes.length !== resolved.nodes.length) {
      throw new Error(`fuzz scene ${iteration} layout lost root nodes`);
    }
    evaluatedFrames += 1;
  }
  const target = nodes[integer(0, nodes.length - 1)];
  const patch = [
    {
      op: "setStyle",
      id: target.id,
      style: { opacity: Number(random().toFixed(4)) },
    },
    { op: "setMarker", name: "fuzz", frame: integer(0, duration - 1) },
  ];
  const patched = applyScenePatch(validated.scene, patch);
  if (!patched.ok) {
    throw new Error(
      `fuzz patch ${iteration} failed: ${patched.errors[0]?.message}`,
    );
  }
  if (JSON.stringify(scene) !== JSON.stringify(snapshot)) {
    throw new Error(`fuzz scene ${iteration} mutated its input`);
  }
}

if (validateScene({ schemaVersion: 999 }).ok) {
  throw new Error("future schema version unexpectedly validated");
}

console.log(
  `scene fuzz ok (${iterations} scenes, ${evaluatedFrames} evaluated frames, seed 0x5eed1234)`,
);
