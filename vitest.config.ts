import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@dojo-video-engine/schema/values": fileURLToPath(
        new URL("./packages/schema/src/values.ts", import.meta.url),
      ),
      "@dojo-video-engine/schema": fileURLToPath(
        new URL("./packages/schema/src/index.ts", import.meta.url),
      ),
      "@dojo-video-engine/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url),
      ),
      "@dojo-video-engine/renderer-canvas2d/runtime": fileURLToPath(
        new URL("./packages/renderer-canvas2d/src/runtime.ts", import.meta.url),
      ),
      "@dojo-video-engine/renderer-canvas2d": fileURLToPath(
        new URL("./packages/renderer-canvas2d/src/index.ts", import.meta.url),
      ),
      "@dojo-video-engine/runtime": fileURLToPath(
        new URL("./packages/runtime/src/index.ts", import.meta.url),
      ),
      "@dojo-video-engine/export": fileURLToPath(
        new URL("./packages/export/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    passWithNoTests: true,
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
