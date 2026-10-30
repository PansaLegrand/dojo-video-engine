import { describe, expect, it } from "vitest";
import { Ajv } from "ajv";
import { motionPresetDefinitions } from "@dojo-video-engine/presets";
import { macroDefinitions, macroNames } from "@dojo-video-engine/presets/macros";
import {
  COMMAND_MANIFEST_VERSION,
  capabilityManifests,
  getMacroManifest,
  getMotionPresetManifest,
  macroManifests,
  motionPresetManifests,
} from "./manifests.js";

function codeUnitSorted(values: string[]): string[] {
  return [...values].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

describe("capability manifests", () => {
  it("covers every motion preset and registered macro in code-unit order", () => {
    const presets = motionPresetManifests();
    const macros = macroManifests();

    expect(presets.map(({ name }) => name)).toEqual(
      codeUnitSorted(motionPresetDefinitions.map(({ name }) => name)),
    );
    expect(macros.map(({ name }) => name)).toEqual(
      codeUnitSorted(macroNames()),
    );
    expect(capabilityManifests().map(({ name }) => name)).toEqual(
      codeUnitSorted([
        ...motionPresetDefinitions.map(({ name }) => name),
        ...macroNames(),
      ]),
    );
  });

  it("publishes draft-07 schemas and parsed examples that satisfy Zod", () => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    const presetDefinitions = new Map<
      string,
      (typeof motionPresetDefinitions)[number]
    >(
      motionPresetDefinitions.map((definition) => [
        definition.name,
        definition,
      ]),
    );
    const macroDefinitionMap = new Map(
      macroDefinitions().map((definition) => [definition.name, definition]),
    );

    for (const manifest of motionPresetManifests()) {
      expect(manifest.manifestVersion).toBe(COMMAND_MANIFEST_VERSION);
      expect(manifest.paramsSchema.$schema).toBe(
        "http://json-schema.org/draft-07/schema#",
      );
      expect(manifest.examples.length).toBeGreaterThan(0);
      const definition = presetDefinitions.get(manifest.name);
      expect(definition).toBeDefined();
      for (const example of manifest.examples) {
        expect(definition?.paramsSchema.safeParse(example).success).toBe(true);
        expect(
          ajv.validate(manifest.paramsSchema, example),
          ajv.errorsText(),
        ).toBe(true);
      }
    }

    for (const manifest of macroManifests()) {
      expect(manifest.manifestVersion).toBe(COMMAND_MANIFEST_VERSION);
      expect(manifest.paramsSchema.$schema).toBe(
        "http://json-schema.org/draft-07/schema#",
      );
      expect(manifest.examples.length).toBeGreaterThan(0);
      const definition = macroDefinitionMap.get(manifest.name);
      expect(definition).toBeDefined();
      for (const example of manifest.examples) {
        expect(example).not.toHaveProperty("macro");
        expect(definition?.params.safeParse(example).success).toBe(true);
        expect(
          ajv.validate(manifest.paramsSchema, example),
          ajv.errorsText(),
        ).toBe(true);
      }
    }
  });

  it("declares every asset parameter with allowed scene asset types", () => {
    const requirements = Object.fromEntries(
      macroManifests().map((manifest) => [
        manifest.name,
        manifest.requiredAssets,
      ]),
    );

    expect(requirements).toMatchObject({
      audioOverlay: [{ parameter: "assetId", allowedTypes: ["audio"] }],
      bRoll: [{ parameter: "assetId", allowedTypes: ["image", "video"] }],
      captions: [{ parameter: "assetId", allowedTypes: ["audio", "video"] }],
      imageOverlay: [{ parameter: "assetId", allowedTypes: ["image"] }],
      lottieOverlay: [{ parameter: "assetId", allowedTypes: ["lottie"] }],
      videoOverlay: [{ parameter: "assetId", allowedTypes: ["video"] }],
    });

    for (const manifest of macroManifests()) {
      expect(manifest.outputRoles.length).toBeGreaterThan(0);
      const properties = manifest.paramsSchema.properties as
        | Record<string, unknown>
        | undefined;
      expect(manifest.requiredAssets.length > 0).toBe(
        Object.hasOwn(properties ?? {}, "assetId"),
      );
      for (const descriptor of manifest.requiredAssets) {
        expect(descriptor.parameter).toBe("assetId");
        expect(descriptor.required).toBe(true);
        expect(descriptor.allowedTypes.length).toBeGreaterThan(0);
      }
    }
  });

  it("returns JSON-safe deep clones from collections and lookups", () => {
    const manifests = capabilityManifests();
    expect(JSON.parse(JSON.stringify(manifests))).toEqual(manifests);

    const first = manifests[0];
    expect(first).toBeDefined();
    if (first) {
      first.description = "mutated";
      first.outputRoles.push("mutated");
      first.examples[0]!.mutated = true;
    }
    expect(capabilityManifests()).not.toEqual(manifests);

    const macro = getMacroManifest("imageOverlay");
    macro.requiredAssets[0]!.allowedTypes.push("font");
    expect(
      getMacroManifest("imageOverlay").requiredAssets[0]?.allowedTypes,
    ).toEqual(["image"]);

    const preset = getMotionPresetManifest("fadeIn");
    preset.examples[0]!.durationInFrames = 1;
    expect(
      getMotionPresetManifest("fadeIn").examples[0]?.durationInFrames,
    ).toBe(24);
  });

  it("reports actionable lookup errors", () => {
    expect(() => getMacroManifest("missing")).toThrow(
      /Unknown macro manifest "missing".*"imageOverlay"/,
    );
    expect(() => getMotionPresetManifest("missing")).toThrow(
      /Unknown motion preset manifest "missing".*"fadeIn"/,
    );
  });
});
