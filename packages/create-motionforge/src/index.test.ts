import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createMotionforgeProject } from "./index.js";

describe("create-motionforge", () => {
  it("creates a minimal starter project", async () => {
    const dir = await tempDir();

    try {
      const result = await createMotionforgeProject("Hello Video", {
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
      };

      expect(packageJson.name).toBe("hello-video");
      expect(packageJson.scripts).toMatchObject({
        dev: "motionforge dev src/video.ts",
        validate: "motionforge validate src/video.ts",
        print: "motionforge print src/video.ts",
        migrate: "motionforge migrate src/video.ts",
        inspect: "motionforge inspect src/video.ts",
        lint: "motionforge lint src/video.ts",
      });
      const ownPackage = JSON.parse(
        await readFile(new URL("../package.json", import.meta.url), "utf8"),
      ) as { version: string };
      expect(packageJson.dependencies).toMatchObject({
        "@motionforge/authoring": `^${ownPackage.version}`,
        "@motionforge/cli": `^${ownPackage.version}`,
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
      await createMotionforgeProject("existing", { cwd: dir });
      await writeFile(join(projectDir, "custom.txt"), "do not overwrite");

      await expect(
        createMotionforgeProject("existing", { cwd: dir }),
      ).rejects.toThrow("not empty");

      await expect(
        createMotionforgeProject("existing", { cwd: dir, force: true }),
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
  return await mkdtemp(join(tmpdir(), "create-motionforge-"));
}
