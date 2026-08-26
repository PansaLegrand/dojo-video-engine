import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("MotionForge agent distribution assets", () => {
  it("ships a focused skill whose repository links resolve", async () => {
    const skillUrl = new URL(
      "../../../skills/motionforge/SKILL.md",
      import.meta.url,
    );
    const text = await readFile(skillUrl, "utf8");
    expect(text).toContain("name: motionforge");
    expect(text).toContain("motionforge.workflow.check");
    expect(text).toContain("proof.comparison.render");
    expect(text).toContain("Asset sources are host-authorized");
    expect(text).toContain("DojoClip dependency");
    for (const match of text.matchAll(/\]\((\.\.\/\.\.\/[^)]+)\)/g)) {
      await expect(
        access(fileURLToPath(new URL(match[1]!, skillUrl))),
      ).resolves.toBeUndefined();
    }
  });

  it("imports extension and macro starters and validates their outputs", async () => {
    const extension = await import(
      new URL("../../../examples/extension-starter.mjs", import.meta.url).href
    );
    expect(extension.brandGridManifest).toMatchObject({
      name: "example.brand-grid",
      version: "1.0.0",
    });
    expect(extension.brandGridRegistry.manifests()).toHaveLength(1);

    const macro = await import(
      new URL("../../../examples/macro-starter.mjs", import.meta.url).href
    );
    const expanded = macro.expandCallout("Evidence ready");
    expect(expanded).toMatchObject({
      ok: true,
      nodes: [{ type: "text", text: "Evidence ready" }],
    });
  });

  it("runs the failed-command/check repair example and returns evidence refs", async () => {
    const example = await import(
      new URL("../../../examples/agent-workflow-repair.mjs", import.meta.url)
        .href
    );
    const result = await example.runRepairEvidenceExample();
    expect(result.failedCommand).toMatchObject({
      ok: false,
      error: { code: "command_failed" },
    });
    expect(result.failedCheck).toMatchObject({
      ok: false,
      error: { code: "invalid_frame" },
    });
    expect(result.checked).toMatchObject({ ok: true });
    expect(result.snapshot.scene.nodes[0]).toMatchObject({
      id: "title",
      text: "After repair",
    });
    expect(result.refs.length).toBeGreaterThan(0);
    expect(
      result.refs.every(
        (ref: { uri?: unknown }) =>
          typeof ref.uri === "string" && ref.uri.startsWith("memory://"),
      ),
    ).toBe(true);
  });
});
