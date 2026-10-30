import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createDojoVideoEngineProject } from "./index.js";

describe("create-dojo-video-engine", () => {
  it("creates a minimal starter project", async () => {
    const dir = await tempDir();

    try {
      const result = await createDojoVideoEngineProject("Hello Video", {
        cwd: dir,
      });

      expect(result.projectName).toBe("hello-video");
      expect(result.files).toEqual([
        "package.json",
        "tsconfig.json",
        "public/assets/logo.svg",
        "src/video.ts",
      ]);

      const packageJson = JSON.parse(
        await readFile(join(result.projectDir, "package.json"), "utf8"),
      ) as {
        name: string;
        scripts: Record<string, string>;
        dependencies: Record<string, string>;
        packageManager: string;
      };

      expect(packageJson.name).toBe("hello-video");
      expect(packageJson.packageManager).toBe("pnpm@10.34.5");
      expect(packageJson.scripts).toMatchObject({
        validate: "dojo-video-engine validate src/video.ts",
        print: "dojo-video-engine print src/video.ts",
        migrate: "dojo-video-engine migrate src/video.ts",
        inspect: "dojo-video-engine inspect src/video.ts",
        lint: "dojo-video-engine lint src/video.ts",
      });
      const ownPackage = JSON.parse(
        await readFile(new URL("../package.json", import.meta.url), "utf8"),
      ) as { version: string };
      expect(packageJson.dependencies).toMatchObject({
        "@dojo-video-engine/authoring": `^${ownPackage.version}`,
        "@dojo-video-engine/cli": `^${ownPackage.version}`,
      });

      await expect(
        readFile(join(result.projectDir, "src/video.ts"), "utf8"),
      ).resolves.toContain("makeScene");
      await expect(
        readFile(join(result.projectDir, "src/video.ts"), "utf8"),
      ).resolves.toContain('publicAsset("assets/logo.svg")');
      await expect(
        readFile(join(result.projectDir, "public/assets/logo.svg"), "utf8"),
      ).resolves.toContain("<svg");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("refuses to write into a non-empty directory unless forced", async () => {
    const dir = await tempDir();

    try {
      const projectDir = join(dir, "existing");
      await createDojoVideoEngineProject("existing", { cwd: dir });
      await writeFile(join(projectDir, "custom.txt"), "do not overwrite");

      await expect(
        createDojoVideoEngineProject("existing", { cwd: dir }),
      ).rejects.toThrow("not empty");

      await expect(
        createDojoVideoEngineProject("existing", { cwd: dir, force: true }),
      ).resolves.toMatchObject({
        projectName: "existing",
        projectDir,
      });
      await expect(
        readFile(join(projectDir, "custom.txt"), "utf8"),
      ).resolves.toBe("do not overwrite");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

async function tempDir() {
  return await mkdtemp(join(tmpdir(), "create-dojo-video-engine-"));
}
