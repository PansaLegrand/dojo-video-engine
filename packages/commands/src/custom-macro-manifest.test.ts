import { describe, expect, it } from "vitest";
import { z } from "zod";
import { registerMacro } from "@motionforge/presets/macros";

describe("runtime custom macro isolation", () => {
  it("keeps built-in manifests independent of host-only macro semantics", async () => {
    registerMacro({
      name: "testRuntimeCustomMacro",
      description: "Host-only custom macro used by the isolation regression.",
      usage: '{"macro":"testRuntimeCustomMacro","text":"hello"}',
      params: z.object({ text: z.string() }).strict(),
      expand: (params) => ({
        id: "custom-host-output",
        type: "text",
        text: params.text,
      }),
    });

    const { macroManifests } = await import("./manifests.js");
    expect(
      macroManifests().some(
        (manifest) => manifest.name === "testRuntimeCustomMacro",
      ),
    ).toBe(false);
  });
});
