import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createExtensionRegistry,
  defineExtension,
  extensionManifest,
  preflightExtensions,
} from "./index.js";

const adapter = { draw: () => undefined };

function testExtension(
  overrides: Partial<Parameters<typeof defineExtension>[0]> = {},
) {
  return defineExtension({
    name: "com.example.grid",
    version: "2.0.0",
    displayName: "Brand grid",
    description: "Draws a deterministic branded grid.",
    compatibleVersions: ["1.0.0"],
    paramsSchema: z.object({ columns: z.number().int().min(1).max(24) }),
    deterministic: true,
    workerCompatible: true,
    renderers: { canvas2d: adapter },
    ...overrides,
  });
}

function scene(descriptor: {
  name: string;
  version: string;
  params: Record<string, unknown>;
}) {
  return {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 30,
    assets: {
      texture: { id: "texture", type: "image", src: "texture.png" },
    },
    nodes: [{ id: "grid", type: "extension", extension: descriptor }],
  };
}

describe("extension registry", () => {
  it("resolves exact and explicitly compatible versions", () => {
    const definition = testExtension();
    const registry = createExtensionRegistry([definition]);

    expect(registry.resolve("com.example.grid", "2.0.0")).toBe(definition);
    expect(registry.resolve("com.example.grid", "1.0.0")).toBe(definition);
    expect(registry.resolve("com.example.grid", "1.1.0")).toBeNull();
  });

  it("rejects duplicate identities and invalid compatibility declarations", () => {
    expect(() =>
      createExtensionRegistry([testExtension(), testExtension()]),
    ).toThrow(/already registered/);
    expect(() => testExtension({ compatibleVersions: ["2.0.0"] })).toThrow(
      /repeats compatible version/,
    );
  });

  it("exports deterministic discovery metadata and parameter JSON Schema", () => {
    const manifest = extensionManifest(testExtension());

    expect(manifest).toMatchObject({
      name: "com.example.grid",
      version: "2.0.0",
      displayName: "Brand grid",
      description: "Draws a deterministic branded grid.",
      compatibleVersions: ["1.0.0"],
      deterministic: true,
      workerCompatible: true,
      renderers: ["canvas2d"],
      paramsSchema: {
        type: "object",
        required: ["columns"],
        properties: { columns: { type: "integer", minimum: 1, maximum: 24 } },
      },
    });
  });
});

describe("extension preflight", () => {
  it("validates parameters, renderer, worker, version, and installation", () => {
    const registry = createExtensionRegistry([testExtension()]);

    expect(
      preflightExtensions(
        scene({
          name: "com.example.grid",
          version: "2.0.0",
          params: { columns: 0 },
        }),
        registry,
        { renderer: "canvas2d" },
      ).issues[0]?.code,
    ).toBe("extension_params_invalid");

    expect(
      preflightExtensions(
        scene({
          name: "com.example.grid",
          version: "2.0.0",
          params: { columns: 8 },
        }),
        registry,
        { renderer: "webgl" },
      ).issues[0]?.code,
    ).toBe("extension_renderer_unsupported");

    const mainThreadOnly = createExtensionRegistry([
      testExtension({ workerCompatible: false }),
    ]);
    expect(
      preflightExtensions(
        scene({
          name: "com.example.grid",
          version: "2.0.0",
          params: { columns: 8 },
        }),
        mainThreadOnly,
        { renderer: "canvas2d", worker: true },
      ).issues[0]?.code,
    ).toBe("extension_worker_unsupported");

    const incompatible = preflightExtensions(
      scene({
        name: "com.example.grid",
        version: "3.0.0",
        params: { columns: 8 },
      }),
      registry,
      { renderer: "canvas2d" },
    );
    expect(incompatible.issues[0]?.code).toBe("extension_version_incompatible");

    const absent = preflightExtensions(
      scene({
        name: "com.example.unknown",
        version: "1.0.0",
        params: {},
      }),
      registry,
      { renderer: "canvas2d" },
    );
    expect(absent.issues[0]?.code).toBe("extension_not_installed");
  });

  it("discovers typed assets before resolution", () => {
    const registry = createExtensionRegistry([
      testExtension({
        assets: ({ params }) => [
          {
            assetId: String((params as { assetId?: string }).assetId),
            type: "image",
            purpose: "grid texture",
          },
        ],
        paramsSchema: z.object({ assetId: z.string() }),
      }),
    ]);

    const success = preflightExtensions(
      scene({
        name: "com.example.grid",
        version: "2.0.0",
        params: { assetId: "texture" },
      }),
      registry,
      { renderer: "canvas2d" },
    );
    expect(success).toMatchObject({ ok: true, issues: [] });
    expect(success.nodes[0]?.requirements).toEqual([
      {
        assetId: "texture",
        type: "image",
        optional: false,
        purpose: "grid texture",
      },
    ]);

    const missing = preflightExtensions(
      scene({
        name: "com.example.grid",
        version: "2.0.0",
        params: { assetId: "missing" },
      }),
      registry,
      { renderer: "canvas2d" },
    );
    expect(missing.issues[0]?.code).toBe("extension_asset_missing");
  });
});
