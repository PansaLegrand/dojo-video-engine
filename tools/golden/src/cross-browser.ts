import { resolve } from "node:path";
import { chromium, firefox, webkit, type BrowserType } from "playwright";
import { createServer } from "vite";
import type { Scene } from "@motionforge/schema";

const rootDir = resolve(import.meta.dirname, "../../..");
const harnessDir = resolve(rootDir, "tools/golden");
const server = await createServer({
  root: harnessDir,
  logLevel: "error",
  resolve: {
    alias: {
      "@motionforge/presets/macros": resolve(
        rootDir,
        "packages/presets/src/macros.ts",
      ),
      "@motionforge/schema/values": resolve(
        rootDir,
        "packages/schema/src/values.ts",
      ),
      "@motionforge/renderer-canvas2d/runtime": resolve(
        rootDir,
        "packages/renderer-canvas2d/src/runtime.ts",
      ),
      "@motionforge/runtime": resolve(rootDir, "packages/runtime/src/index.ts"),
      ...Object.fromEntries(
        [
          "agent-tools",
          "schema",
          "core",
          "layout",
          "presets",
          "showcase",
          "renderer-canvas2d",
          "export",
          "player",
        ].map((name) => [
          `@motionforge/${name}`,
          resolve(rootDir, `packages/${name}/src/index.ts`),
        ]),
      ),
    },
  },
  server: { host: "127.0.0.1", port: 0, strictPort: false },
});

const scene: Scene = {
  schemaVersion: 1,
  width: 200,
  height: 120,
  fps: 30,
  duration: 2,
  assets: {},
  nodes: [
    {
      id: "background",
      type: "div",
      style: {
        width: "100%",
        height: "100%",
        background:
          "radial-gradient(circle at 35% 30%, #67e8f9, #1d4ed8 60%, #172554)",
      },
    },
    {
      id: "path",
      type: "shape",
      shape: {
        kind: "path",
        d: "M50 2 L61 36 L98 36 L68 57 L79 92 L50 71 L21 92 L32 57 L2 36 L39 36 Z",
        viewBox: { x: 0, y: 0, width: 100, height: 100 },
      },
      style: {
        position: "absolute",
        left: 60,
        top: 20,
        width: 80,
        height: 80,
        fill: "#fbbf24",
        stroke: "#ffffff",
        strokeWidth: 3,
      },
    },
  ],
};

await server.listen();
try {
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("Cross-browser server exposed no URL.");
  const browsers: Array<[string, BrowserType]> = [
    ["chromium", chromium],
    ["firefox", firefox],
    ["webkit", webkit],
  ];
  for (const [name, browserType] of browsers) {
    const browser = await browserType.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      await page.goto(url, { waitUntil: "load" });
      const rendered = await page.evaluate(
        ({ sceneJson }) => window.renderGoldenFrame(JSON.parse(sceneJson), 0),
        { sceneJson: JSON.stringify(scene) },
      );
      let opaque = 0;
      const colors = new Set<string>();
      for (let index = 0; index < rendered.rgba.length; index += 4) {
        if ((rendered.rgba[index + 3] ?? 0) > 0) opaque += 1;
        if (index % 160 === 0) {
          colors.add(
            `${rendered.rgba[index]},${rendered.rgba[index + 1]},${rendered.rgba[index + 2]}`,
          );
        }
      }
      if (
        rendered.width !== scene.width ||
        rendered.height !== scene.height ||
        opaque < scene.width * scene.height * 0.95 ||
        colors.size < 4 ||
        consoleErrors.length > 0
      ) {
        throw new Error(
          `${name} probe failed: ${JSON.stringify({ opaque, colors: colors.size, consoleErrors })}`,
        );
      }
      console.log(`cross-browser ${name} ok (${opaque} opaque pixels)`);
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}
