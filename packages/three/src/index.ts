import { z } from "zod/v3";
import {
  createExtensionRegistry,
  defineExtension,
  type ExtensionRegistry,
} from "@dojo-video-engine/extensions";
import {
  createCanvas2DOpaqueExtensionRegistry,
  type Canvas2DOpaqueExtensionRegistry,
} from "@dojo-video-engine/renderer-canvas2d";
import {
  THREE_EXTENSION,
  validateThreeLayers,
  threeSceneSchema,
  type ThreeScene,
} from "./schema.js";
import type { ThreeLayerRuntime } from "./runtime.js";
export * from "./schema.js";

const capability = Object.freeze({
  id: "dojo.three-scene.draw",
  version: "1.0.0",
  realms: ["main"] as const,
});
const payloadSchema = z.object({ time: z.number().finite() }).strict();

/** Create once per host. Resources remain revision-owned; no immutable reuse. */
export function createThreeRegistryOptions(): {
  extensions: ExtensionRegistry;
  opaqueExtensionRegistry: Canvas2DOpaqueExtensionRegistry;
} {
  let live = 0;
  const owned = new Set<ThreeLayerRuntime>();
  const definition = defineExtension<
    ThreeScene,
    ThreeLayerRuntime,
    undefined,
    { time: number }
  >({
    ...THREE_EXTENSION,
    displayName: "Editable 3D scene",
    paramsSchema: threeSceneSchema,
    deterministic: true,
    workerCompatible: false,
    resolveAssets: async ({ params, scene, signal }) => {
      validateThreeLayers(scene.nodes);
      signal?.throwIfAborted();
      const { ThreeLayerRuntime } = await import("./runtime.js");
      signal?.throwIfAborted();
      if (live >= 8)
        throw new Error(
          "Too many live Three.js layers. Close another preview or export and retry.",
        );
      live++;
      let released = false;
      const release = (): void => {
        if (!released) {
          released = true;
          live--;
        }
      };
      try {
        const resource = new ThreeLayerRuntime(params, release);
        owned.add(resource);
        return resource;
      } catch (error) {
        release();
        throw error;
      }
    },
    disposeAssets: (resource) => {
      owned.delete(resource);
      resource.dispose();
    },
    display: {
      kind: "opaque",
      capability,
      payloadSchema,
      compile: ({ localFrame, sceneFps, params }) => ({
        time: params.timeOffset + (localFrame / sceneFps) * params.rate,
      }),
    },
  });
  return {
    extensions: createExtensionRegistry([definition]),
    opaqueExtensionRegistry: createCanvas2DOpaqueExtensionRegistry({
      realm: "main",
      handlers: [
        {
          capability,
          draw: ({ context, box, operation, resolvedAssets }) => {
            const resource = resolvedAssets as ThreeLayerRuntime;
            if (!owned.has(resource))
              throw new Error(
                "Three.js layer resources do not belong to this registry.",
              );
            resource.draw(
              context,
              box.width,
              box.height,
              payloadSchema.parse(operation.payload).time,
            );
          },
        },
      ],
    }),
  };
}
