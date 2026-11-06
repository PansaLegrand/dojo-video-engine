# @dojo-video-engine/three

Optional editable 3D layers for the Canvas2D video compositor. Source milestone;
publication and consumer adoption must be verified separately.

```ts
import { createThreeRegistryOptions } from "@dojo-video-engine/three";
import { parseThreeScene } from "@dojo-video-engine/three/schema";
import { createCanvas2DSceneRuntime } from "@dojo-video-engine/renderer-canvas2d/runtime";

const graphics = createThreeRegistryOptions();
// Supply the same registries to exportVideo({scene, ...graphics}) as preview.
const runtime = await createCanvas2DSceneRuntime({ scene, resolve: graphics });
await runtime.renderFrame(0, canvas.getContext("2d"));
await runtime.disposeAsync();
```

Scene nodes use `extension: {name: "dojo.three-scene", version: "1.0.0", params}`.
Call `parseThreeScene()` for the canonical parameter schema. The `/schema`
entry is DOM/GPU-free. The runtime dynamically imports Three.js only when a
layer resolves; importing the definition does not initialize WebGL.

Parameters contain one camera, named materials and a named object hierarchy.
Objects are groups or meshes (box, sphere, cylinder, torus, raw triangles).
Transforms use x/y/z vectors; rotations are degrees and spin is degrees/second.
Keyframes use absolute source seconds and linear interpolation. A keyframed
channel overrides spin on that axis. `timeOffset + localFrame / fps * rate`
defines source time, allowing host trims/splits without restarting animation.
Camera orbit is absolute and reconstructible on any seek. Material colors use
the engine's color parser, including alpha multiplied by material opacity.

Use `validateThreeLayers()` at the host's document boundary after every edit.
Limits: four layers per scene, 128 objects, 32 materials, a conservative 100,000
vertex budget, 128KB params, and 4096-pixel dimensions/8,294,400 pixels per render
surface. A host registry permits eight live revision resources to cover preview,
replacement and export. Keep registries host-scoped. No immutable mutable-scene
reuse is attempted.

Requires main-thread WebGL2; worker execution is rejected. Context loss and
resource failures fail rendering/export explicitly. Transparent frames compose
with existing layers, masks, opacity and audio. Separate layers do not share
depth. Textures, external models, shaders, arbitrary code, physics, shadows and
post-processing are outside this first implementation. Different GPUs are not
promised byte-identical pixels.

Three.js 0.187.0 is MIT, browser-native, and has no production dependencies. It
owns only this optional rendering package and can be removed without affecting
2D rendering. Its GPU resources are explicitly disposed; UUID randomness inside
Three.js is not persisted or used for animation, IDs or frame evaluation.
Measure lazy chunk size and frame/resource budgets before a release claim.
