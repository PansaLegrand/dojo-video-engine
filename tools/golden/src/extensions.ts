import {
  createExtensionRegistry,
  defineExtension,
} from "@dojo-video-engine/extensions";
import type { Canvas2DExtensionAdapter } from "@dojo-video-engine/renderer-canvas2d";
import { z } from "zod/v3";

const checkerAdapter: Canvas2DExtensionAdapter = {
  draw: ({ context, box, params, preparedFrame }) => {
    const { background, foreground, cellSize } = params as {
      background: string;
      foreground: string;
      cellSize: number;
    };
    const phase = preparedFrame as number;
    context.fillStyle = background;
    context.fillRect(box.x, box.y, box.width, box.height);
    context.fillStyle = foreground;

    for (let y = -cellSize + phase; y < box.height; y += cellSize) {
      for (let x = -cellSize + phase; x < box.width; x += cellSize) {
        const column = Math.floor((x - phase) / cellSize);
        const row = Math.floor((y - phase) / cellSize);
        if ((column + row) % 2 === 0) {
          context.fillRect(box.x + x, box.y + y, cellSize, cellSize);
        }
      }
    }
  },
};

const checker = defineExtension({
  name: "dev.dojo-video-engine.golden-checker",
  version: "1.0.0",
  paramsSchema: z
    .object({
      background: z.string(),
      foreground: z.string(),
      cellSize: z.number().int().min(4).max(64),
    })
    .strict(),
  deterministic: true,
  workerCompatible: true,
  renderers: { canvas2d: checkerAdapter },
  prepareFrame: ({ localFrame, params }) => localFrame % params.cellSize,
});

export const goldenExtensionRegistry = createExtensionRegistry([checker]);
