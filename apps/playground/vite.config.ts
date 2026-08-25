import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const workspacePackage = (name: string) =>
  fileURLToPath(
    new URL(`../../packages/${name}/src/index.ts`, import.meta.url),
  );

export default defineConfig({
  // Relative asset URLs so the build works at any static-host mount path.
  base: "./",
  resolve: {
    alias: {
      "@motionforge/core": workspacePackage("core"),
      "@motionforge/export": workspacePackage("export"),
      "@motionforge/player": workspacePackage("player"),
      "@motionforge/presets/catalog": fileURLToPath(
        new URL("../../packages/presets/src/catalog.ts", import.meta.url),
      ),
      "@motionforge/presets": workspacePackage("presets"),
      "@motionforge/renderer-canvas2d/runtime": fileURLToPath(
        new URL(
          "../../packages/renderer-canvas2d/src/runtime.ts",
          import.meta.url,
        ),
      ),
      "@motionforge/renderer-canvas2d": workspacePackage("renderer-canvas2d"),
      "@motionforge/runtime": workspacePackage("runtime"),
      "@motionforge/schema/values": fileURLToPath(
        new URL("../../packages/schema/src/values.ts", import.meta.url),
      ),
      "@motionforge/schema": workspacePackage("schema"),
      "@motionforge/showcase": workspacePackage("showcase"),
    },
  },
  test: {
    // The playground is exercised by the golden harness and Playwright E2E,
    // not unit tests; keep `pnpm -r test` green.
    passWithNoTests: true,
  },
});
