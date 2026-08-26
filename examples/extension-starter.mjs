import { z } from "zod";
import {
  createExtensionRegistry,
  defineExtension,
  extensionManifest,
} from "@motionforge/extensions";

export const brandGridExtension = defineExtension({
  name: "example.brand-grid",
  version: "1.0.0",
  description: "Portable deterministic brand-grid starter.",
  paramsSchema: z
    .object({ color: z.string(), columns: z.number().int().min(1).max(12) })
    .strict(),
  deterministic: true,
  workerCompatible: true,
  display: {
    kind: "standard",
    version: "1",
    compile({ box, params }, output) {
      const width = box.width / params.columns;
      for (let column = 0; column < params.columns; column += 1) {
        output.rect(`column-${column}`, {
          x: column * width,
          y: 0,
          width: 1,
          height: box.height,
          fill: params.color,
        });
      }
    },
  },
});

export const brandGridRegistry = createExtensionRegistry([brandGridExtension]);
export const brandGridManifest = extensionManifest(brandGridExtension);
