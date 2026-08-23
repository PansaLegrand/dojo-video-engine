import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { StudioServerResult } from "./studio.js";
import { executeCli } from "./index.js";

const openServers: StudioServerResult[] = [];

afterEach(async () => {
  await Promise.all(openServers.splice(0).map((server) => server.close()));
});

describe("@motionforge/cli", () => {
  it("validates a JSON scene file", async () => {
    const dir = await tempDir();

    try {
      const scenePath = join(dir, "scene.json");
      await writeFile(scenePath, JSON.stringify(validScene()));

      await expect(executeCli(["validate", scenePath])).resolves.toEqual({
        exitCode: 0,
        stdout: `Valid MotionForge scene: ${scenePath}\n`,
        stderr: "",
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("migrates legacy v0 scenes and reports the migration", async () => {
    const dir = await tempDir();

    try {
      const scenePath = join(dir, "legacy.json");
      await writeFile(
        scenePath,
        JSON.stringify({ ...validScene(), schemaVersion: 0 }),
      );

      const result = await executeCli(["migrate", scenePath]);
      const migration = JSON.parse(result.stdout) as {
        fromVersion: number;
        toVersion: number;
        migrations: string[];
        scene: { schemaVersion: number };
      };

      expect(result, result.stderr).toMatchObject({ exitCode: 0, stderr: "" });
      expect(migration).toMatchObject({
        fromVersion: 0,
        toVersion: 1,
        migrations: ["scene-v0-to-v1"],
        scene: { schemaVersion: 1 },
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("lints valid but suspicious scene data", async () => {
    const dir = await tempDir();

    try {
      const scenePath = join(dir, "lint.json");
      await writeFile(
        scenePath,
        JSON.stringify({
          ...validScene(),
          assets: {
            unused: { id: "unused", type: "image", src: "unused.png" },
          },
        }),
      );

      const result = await executeCli(["lint", scenePath]);
      const lint = JSON.parse(result.stdout) as {
        issueCount: number;
        issues: Array<{ code: string }>;
      };

      expect(result, result.stderr).toMatchObject({ exitCode: 0, stderr: "" });
      expect(lint).toMatchObject({
        issueCount: 1,
        issues: [{ code: "unused_asset" }],
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("prints normalized scene JSON from a JavaScript scene module", async () => {
    const dir = await tempDir();

    try {
      const scenePath = join(dir, "video.mjs");
      await writeFile(
        scenePath,
        `export default () => (${JSON.stringify(validScene())});\n`,
      );

      const result = await executeCli(["print", scenePath]);
      const printed = JSON.parse(result.stdout) as unknown;

      expect(result, result.stderr).toMatchObject({ exitCode: 0 });
      expect(result.stderr).toBe("");
      expect(printed).toMatchObject({
        schemaVersion: 1,
        width: 1080,
        height: 1920,
        fps: 30,
        duration: 90,
        assets: {},
        nodes: [],
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("inspects scene metadata as stable JSON", async () => {
    const dir = await tempDir();

    try {
      const scenePath = join(dir, "scene.json");
      await writeFile(
        scenePath,
        JSON.stringify({
          schemaVersion: 1,
          width: 1920,
          height: 1080,
          fps: 24,
          duration: 120,
          assets: {
            music: { id: "music", type: "audio", src: "music.mp3" },
            clip: { id: "clip", type: "video", src: "clip.mp4" },
          },
          nodes: [
            {
              id: "bg",
              type: "div",
              children: [
                {
                  id: "title",
                  type: "text",
                  text: "Hello",
                  animations: [
                    {
                      kind: "keyframes",
                      property: "opacity",
                      frames: [
                        { frame: 0, value: 0 },
                        { frame: 12, value: 1 },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: "music",
              type: "audio",
              assetId: "music",
              duration: 120,
              loop: true,
              volumeEnvelope: [
                { frame: 0, value: 0 },
                { frame: 24, value: 1 },
              ],
            },
            {
              id: "celebration",
              type: "effect",
              effect: "confettiBurst",
              duration: 30,
              params: { seed: 7, intensity: "high" },
            },
          ],
        }),
      );

      const result = await executeCli(["inspect", scenePath]);
      const inspected = JSON.parse(result.stdout) as {
        width: number;
        durationSeconds: number;
        assets: Record<string, number>;
        nodes: Record<string, number>;
        capabilities: Record<string, boolean>;
      };

      expect(result, result.stderr).toMatchObject({ exitCode: 0, stderr: "" });
      expect(inspected).toMatchObject({
        schemaVersion: 1,
        width: 1920,
        height: 1080,
        fps: 24,
        durationFrames: 120,
        durationSeconds: 5,
        assets: {
          total: 2,
          audio: 1,
          video: 1,
        },
        nodes: {
          total: 4,
          root: 3,
          div: 1,
          text: 1,
          audio: 1,
          effect: 1,
        },
        capabilities: {
          hasVisuals: true,
          hasAudio: true,
          hasVideo: true,
          hasEffects: true,
          hasAnimations: true,
          hasVolumeAutomation: true,
          hasLoopedAudio: true,
          requiresBrowserExport: true,
        },
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports validation errors with a non-zero exit code", async () => {
    const dir = await tempDir();

    try {
      const scenePath = join(dir, "bad.json");
      await writeFile(
        scenePath,
        JSON.stringify({
          schemaVersion: 1,
          width: 1080,
          height: 1920,
          fps: 30,
          duration: 90,
          nodes: [{ id: "title", type: "text" }],
        }),
      );

      const result = await executeCli(["validate", scenePath]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(
        `Invalid MotionForge scene: ${scenePath}`,
      );
      expect(result.stderr).toContain("Text nodes require a `text` string.");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("loads TypeScript scene modules through the CLI loader", async () => {
    const dir = await tempDir();

    try {
      const scenePath = join(dir, "video.ts");
      await writeFile(
        scenePath,
        [
          "export default {",
          "  schemaVersion: 1,",
          "  width: 1080,",
          "  height: 1920,",
          "  fps: 30,",
          "  duration: 90,",
          "  nodes: [],",
          "};",
          "",
        ].join("\n"),
      );

      await expect(executeCli(["validate", scenePath])).resolves.toMatchObject({
        exitCode: 0,
        stderr: "",
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("explains incorrect command usage", async () => {
    await expect(executeCli(["unknown"])).resolves.toMatchObject({
      exitCode: 2,
      stdout: "",
    });
    await expect(executeCli(["validate"])).resolves.toMatchObject({
      exitCode: 2,
      stdout: "",
    });
    await expect(executeCli(["inspect"])).resolves.toMatchObject({
      exitCode: 2,
      stdout: "",
    });
  });

  it("starts a studio server for a scene module", async () => {
    const dir = await tempDir();

    try {
      const scenePath = join(dir, "scene.json");
      await writeFile(scenePath, JSON.stringify(validScene()));

      const result = await executeCli([
        "dev",
        scenePath,
        "--host",
        "127.0.0.1",
        "--port",
        "0",
      ]);

      expect(result, result.stderr).toMatchObject({ exitCode: 0 });
      expect(result.stdout).toContain("MotionForge Studio running at");
      expect(result.stdout).toContain(scenePath);
      expect(result.close).toBeTypeOf("function");

      const match = result.stdout.match(/(http:\/\/127\.0\.0\.1:\d+\/)/);
      expect(match?.[1]).toBeTruthy();
      openServers.push({
        close: result.close ?? (async () => {}),
        sceneModulePath: scenePath,
        url: match?.[1] ?? "",
      });

      const response = await fetch(`${match?.[1]}__motionforge/scene`);
      const payload = (await response.json()) as {
        ok: boolean;
        scene?: { width?: number };
      };

      expect(payload).toMatchObject({ ok: true, scene: { width: 1080 } });

      const html = await (await fetch(match?.[1] ?? "")).text();
      expect(html).toContain("/@id/__x00__virtual:motionforge-studio-client");
      expect(html).toContain("preset-family-tabs");

      const clientResponse = await fetch(
        `${match?.[1]}@id/__x00__virtual:motionforge-studio-client`,
      );
      const client = await clientResponse.text();

      expect(clientResponse.status, client).toBe(200);
      expect(client).toContain("createPlayer");
      expect(client).toContain("presetCatalog");
      expect(client).toContain("buildPresetPatchExample");
      expect(client).not.toContain('from "@motionforge/player"');
      expect(client).not.toContain('from "@motionforge/presets/catalog"');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function validScene() {
  return {
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 90,
    nodes: [],
  };
}

async function tempDir() {
  return await mkdtemp(join(tmpdir(), "motionforge-cli-"));
}
