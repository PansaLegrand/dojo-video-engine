import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  MAX_EXTENSION_REUSE_KEY_LENGTH,
  compileExtensionDisplay,
  createExtensionRegistry,
  defineExtension,
  extensionDisplayLimits,
  extensionManifest,
  extensionResourceReuseKey,
  legacyExtensionRendererCapability,
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

function compileContext(
  requirements: Array<{
    assetId: string;
    type?: "image" | "video" | "audio" | "font" | "lottie";
    optional?: boolean;
  }> = [],
) {
  const input = scene({
    name: "com.example.grid",
    version: "2.0.0",
    params: { columns: 4 },
  });
  return {
    scene: input,
    node: input.nodes[0],
    // Scene-space border box; emitted operation coordinates remain node-local.
    box: { x: 100, y: 40, width: 320, height: 180 },
    params: { columns: 4 },
    requirements: requirements.map((requirement) => ({
      ...requirement,
      optional: requirement.optional ?? false,
    })),
    resolvedAssets: undefined,
    preparedFrame: undefined,
    frame: 12,
    localFrame: 7,
    sceneFps: 30,
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
      display: {
        kind: "legacy-opaque",
        capabilities: [
          {
            renderer: "canvas2d",
            ...legacyExtensionRendererCapability,
            realms: ["main", "worker"],
          },
        ],
      },
      paramsSchema: {
        type: "object",
        required: ["columns"],
        properties: { columns: { type: "integer", minimum: 1, maximum: 24 } },
      },
    });
  });

  it("keeps legacy definitions intact and rejects ambiguous dual output", () => {
    const legacy = testExtension();
    expect(legacy.renderers.canvas2d).toBe(adapter);

    expect(() =>
      defineExtension({
        name: "com.example.dual",
        version: "1.0.0",
        paramsSchema: z.object({}),
        deterministic: true,
        workerCompatible: true,
        renderers: { canvas2d: adapter },
        display: {
          kind: "standard",
          version: "1",
          compile: () => undefined,
        },
      }),
    ).toThrow(/either a display contract or legacy renderer adapters/);
  });

  it("validates bounded deterministic resource reuse keys", () => {
    expect(() =>
      testExtension({ reuseKey: "not-a-function" as never }),
    ).toThrow(/reuseKey must be a function/);
    expect(() => testExtension({ reuseKey: () => "unsafe" })).toThrow(
      /requires reuseSafety: "immutable"/,
    );
    expect(() => testExtension({ reuseSafety: "immutable" })).toThrow(
      /reuseSafety requires reuseKey/,
    );

    const context = {
      scene: scene({
        name: "com.example.grid",
        version: "2.0.0",
        params: { columns: 4 },
      }) as never,
      node: {
        id: "grid",
        type: "extension",
        extension: {
          name: "com.example.grid",
          version: "2.0.0",
          params: { columns: 4 },
        },
      } as never,
      params: { columns: 4 },
      requirements: [],
      assets: new Map(),
    };
    expect(
      extensionResourceReuseKey(
        testExtension({
          reuseKey: ({ params }) =>
            `grid:${(params as { columns: number }).columns}`,
          reuseSafety: "immutable",
        }),
        context,
      ),
    ).toBe("grid:4");
    expect(
      extensionManifest(
        testExtension({
          reuseKey: () => "manifest",
          reuseSafety: "immutable",
        }),
      ).reuseSafety,
    ).toBe("immutable");
    expect(
      extensionResourceReuseKey(
        testExtension({ reuseKey: () => null, reuseSafety: "immutable" }),
        context,
      ),
    ).toBeNull();
    expect(() =>
      extensionResourceReuseKey(
        testExtension({ reuseKey: () => "   ", reuseSafety: "immutable" }),
        context,
      ),
    ).toThrow(/non-empty string/);
    expect(() =>
      extensionResourceReuseKey(
        testExtension({
          reuseKey: () => "x".repeat(MAX_EXTENSION_REUSE_KEY_LENGTH + 1),
          reuseSafety: "immutable",
        }),
        context,
      ),
    ).toThrow(/at most 512/);
  });
});

describe("extension display contract", () => {
  it("compiles bounded node-local standard operations with stable owned ids", () => {
    const definition = defineExtension({
      name: "com.example.grid",
      version: "2.0.0",
      paramsSchema: z.object({ columns: z.number().int() }),
      deterministic: true,
      workerCompatible: true,
      assets: () => [{ assetId: "texture", type: "image" }],
      display: {
        kind: "standard",
        version: "1",
        compile: (_context, output) => {
          output.rect("background", {
            x: 0,
            y: 0,
            width: 320,
            height: 180,
            fill: "#112233",
          });
          output.text("label", {
            text: "Grid",
            x: 12,
            y: 18,
            fontFamily: "sans-serif",
            fontSize: 24,
            fill: "rgba(255, 255, 255, 0.9)",
          });
          output.image("texture", {
            assetId: "texture",
            x: 20,
            y: 30,
            width: 80,
            height: 60,
            fit: "cover",
          });
        },
      },
    });

    expect(definition.renderers).toEqual({});
    const result = compileExtensionDisplay(
      definition,
      compileContext([{ assetId: "texture", type: "image" }]) as never,
    );
    expect(result).toMatchObject({
      kind: "standard",
      version: "1",
      operations: [
        { kind: "rect", id: "grid::background", x: 0, y: 0 },
        { kind: "text", id: "grid::label", x: 12, y: 18 },
        {
          kind: "image",
          id: "grid::texture",
          assetId: "texture",
          x: 20,
          y: 30,
        },
      ],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(
      result.kind === "standard" && Object.isFrozen(result.operations),
    ).toBe(true);
    expect(
      result.kind === "standard" && Object.isFrozen(result.operations[0]),
    ).toBe(true);
    expect(extensionManifest(definition).display).toEqual({
      kind: "standard",
      version: "1",
    });
  });

  it("rejects invalid standard paint, ids, assets, values, and operation floods", () => {
    const compile = (callback: (output: any) => void) => {
      const definition = defineExtension({
        name: "com.example.grid",
        version: "2.0.0",
        paramsSchema: z.object({ columns: z.number().int() }),
        deterministic: true,
        workerCompatible: true,
        display: {
          kind: "standard",
          version: "1",
          compile: (_context, output) => callback(output),
        },
      });
      return () =>
        compileExtensionDisplay(definition, compileContext() as never);
    };

    expect(() =>
      compile((output) =>
        output.rect("bad color", {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          fill: "not a color !!!",
        }),
      )(),
    ).toThrow(/local ids/);
    expect(() =>
      compile((output) =>
        output.rect("paint", {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          fill: "not a color !!!",
        }),
      )(),
    ).toThrow(/Invalid extension display operation/);
    expect(() =>
      compile((output) =>
        output.image("photo", {
          assetId: "undeclared",
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        }),
      )(),
    ).toThrow(/undeclared asset/);
    expect(() =>
      compile((output) =>
        output.rect("nan", {
          x: Number.NaN,
          y: 0,
          width: 1,
          height: 1,
          fill: "#000",
        }),
      )(),
    ).toThrow(/Expected number|finite/);
    expect(() =>
      compile((output) => {
        output.rect("same", {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          fill: "#000",
        });
        output.rect("same", {
          x: 1,
          y: 1,
          width: 1,
          height: 1,
          fill: "#fff",
        });
      })(),
    ).toThrow(/Duplicate/);
    expect(() =>
      compile((output) => {
        for (
          let index = 0;
          index <= extensionDisplayLimits.maxOperations;
          index += 1
        ) {
          output.rect(`r/${index}`, {
            x: index,
            y: 0,
            width: 1,
            height: 1,
            fill: "#000",
          });
        }
      })(),
    ).toThrow(/operation budget/);
    expect(() =>
      compile((output) => {
        for (let index = 0; index < 600; index += 1) {
          output.text(`t/${index}`, {
            text: "x".repeat(1_000),
            x: 0,
            y: index,
            fontFamily: "sans-serif",
            fontSize: 12,
            fill: "#000",
          });
        }
      })(),
    ).toThrow(/standard display output exceeds/);
  });

  it("requires synchronous compilation and seals escaped builders", () => {
    let escaped: { rect(id: string, input: unknown): void } | undefined;
    const definition = defineExtension({
      name: "com.example.grid",
      version: "2.0.0",
      paramsSchema: z.object({ columns: z.number().int() }),
      deterministic: true,
      workerCompatible: true,
      display: {
        kind: "standard",
        version: "1",
        compile: (_context, output) => {
          escaped = output as never;
        },
      },
    });
    compileExtensionDisplay(definition, compileContext() as never);
    expect(() =>
      escaped?.rect("late", {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        fill: "#000",
      }),
    ).toThrow(/sealed/);

    const asynchronous = defineExtension({
      name: "com.example.async",
      version: "1.0.0",
      paramsSchema: z.object({}),
      deterministic: true,
      workerCompatible: true,
      display: {
        kind: "standard",
        version: "1",
        compile: (() => Promise.resolve()) as never,
      },
    });
    expect(() =>
      compileExtensionDisplay(asynchronous, compileContext() as never),
    ).toThrow(/must be synchronous/);
  });

  it("validates, clones, and freezes versioned opaque JSON payloads", () => {
    const source = { radius: 12, colors: ["#fff", "#000"] };
    const definition = defineExtension({
      name: "com.example.grid",
      version: "2.0.0",
      paramsSchema: z.object({ columns: z.number().int() }),
      deterministic: true,
      workerCompatible: true,
      display: {
        kind: "opaque",
        capability: {
          id: "com.example.grid.paint",
          version: "1.3.0",
          realms: ["main", "worker"],
        },
        payloadSchema: z
          .object({
            radius: z.number(),
            colors: z.array(z.string()),
          })
          .strict(),
        compile: () => source,
      },
    });

    const result = compileExtensionDisplay(
      definition,
      compileContext() as never,
    );
    expect(result).toEqual({
      kind: "opaque",
      capability: { id: "com.example.grid.paint", version: "1.3.0" },
      payload: source,
    });
    expect(result.kind === "opaque" && result.payload).not.toBe(source);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.kind === "opaque" && Object.isFrozen(result.payload)).toBe(
      true,
    );
    source.radius = 99;
    source.colors.push("#f00");
    expect(result.kind === "opaque" && result.payload).toEqual({
      radius: 12,
      colors: ["#fff", "#000"],
    });
    expect(extensionManifest(definition).display).toMatchObject({
      kind: "opaque",
      capability: {
        id: "com.example.grid.paint",
        version: "1.3.0",
        realms: ["main", "worker"],
      },
      payloadSchema: { type: "object" },
    });
  });

  it("rejects invalid opaque identities, realms, schemas, and non-JSON output", () => {
    const base = {
      name: "com.example.opaque",
      version: "1.0.0",
      paramsSchema: z.object({}),
      deterministic: true as const,
      workerCompatible: true,
    };
    expect(() =>
      defineExtension({
        ...base,
        display: {
          kind: "opaque",
          capability: {
            id: "bad capability!",
            version: "latest",
            realms: ["main"],
          },
          payloadSchema: z.any(),
          compile: () => ({}),
        },
      } as never),
    ).toThrow(/namespaced id and exact semantic version/);
    expect(() =>
      defineExtension({
        ...base,
        display: {
          kind: "opaque",
          capability: {
            id: "com.example.paint",
            version: "1.0.0",
            realms: ["main", "main"],
          },
          payloadSchema: z.any(),
          compile: () => ({}),
        },
      } as never),
    ).toThrow(/realms must be unique/);
    expect(() =>
      defineExtension({
        ...base,
        workerCompatible: false,
        display: {
          kind: "opaque",
          capability: {
            id: "com.example.paint",
            version: "1.0.0",
            realms: ["worker"],
          },
          payloadSchema: z.any(),
          compile: () => ({}),
        },
      } as never),
    ).toThrow(/worker capability/);

    const schemaMismatch = defineExtension({
      ...base,
      display: {
        kind: "opaque",
        capability: {
          id: "com.example.paint",
          version: "1.0.0",
          realms: ["main"],
        },
        payloadSchema: z.object({ count: z.number() }).strict(),
        compile: (() => ({ count: "wrong" })) as never,
      },
    });
    expect(() =>
      compileExtensionDisplay(schemaMismatch, compileContext() as never),
    ).toThrow(/invalid opaque payload/);

    const nonJson = (value: unknown) =>
      defineExtension({
        ...base,
        display: {
          kind: "opaque",
          capability: {
            id: "com.example.paint",
            version: "1.0.0",
            realms: ["main"],
          },
          payloadSchema: z.any(),
          compile: () => value as never,
        },
      });
    expect(() =>
      compileExtensionDisplay(nonJson(new Date()), compileContext() as never),
    ).toThrow(/plain JSON objects/);
    const shared = { value: 1 };
    expect(() =>
      compileExtensionDisplay(
        nonJson({ left: shared, right: shared }),
        compileContext() as never,
      ),
    ).toThrow(/cyclic or shared references/);
    expect(() =>
      compileExtensionDisplay(
        nonJson("x".repeat(extensionDisplayLimits.maxStringLength + 1)),
        compileContext() as never,
      ),
    ).toThrow(/string longer/);
    const sparse: unknown[] = [];
    sparse.length = 2;
    sparse[0] = "present";
    expect(() =>
      compileExtensionDisplay(nonJson(sparse), compileContext() as never),
    ).toThrow(/cannot be sparse/);
  });
});

describe("portable compile input ownership", () => {
  it("deep-clones and freezes JSON inputs while preserving trusted native seams", () => {
    const nativeAssets = { touched: false };
    const nativeFrame = new Map<string, unknown>();
    const context = {
      ...compileContext([{ assetId: "texture", type: "image" }]),
      resolvedAssets: nativeAssets,
      preparedFrame: nativeFrame,
    };
    const originalWidth = context.scene.width;
    const originalParams = { ...context.params };
    const definition = defineExtension({
      name: "com.example.owned-input",
      version: "1.0.0",
      paramsSchema: z.object({ columns: z.number() }),
      deterministic: true,
      workerCompatible: true,
      display: {
        kind: "standard",
        version: "1",
        compile: (received) => {
          expect(Object.isFrozen(received)).toBe(true);
          expect(Object.isFrozen(received.scene)).toBe(true);
          expect(Object.isFrozen(received.scene.nodes)).toBe(true);
          expect(Object.isFrozen(received.node)).toBe(true);
          expect(Object.isFrozen(received.params)).toBe(true);
          expect(Object.isFrozen(received.requirements)).toBe(true);
          expect(Reflect.set(received.scene, "width", 999)).toBe(false);
          expect(Reflect.set(received.params as object, "columns", 99)).toBe(
            false,
          );
          expect(received.resolvedAssets).toBe(nativeAssets);
          expect(received.preparedFrame).toBe(nativeFrame);
          nativeAssets.touched = true;
        },
      },
    });
    compileExtensionDisplay(definition, context as never);
    expect(context.scene.width).toBe(originalWidth);
    expect(context.params).toEqual(originalParams);
    expect(nativeAssets.touched).toBe(true);
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

    const legacy = preflightExtensions(
      scene({
        name: "com.example.grid",
        version: "2.0.0",
        params: { columns: 8 },
      }),
      registry,
      { renderer: "canvas2d", worker: true },
    );
    expect(legacy.nodes[0]?.displayDecision).toEqual({
      kind: "legacy-opaque",
      renderer: "canvas2d",
      capability: legacyExtensionRendererCapability,
      realm: "worker",
    });
    expect(legacy.nodes[0]?.rendererAdapter).toBe(adapter);
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

  it("negotiates standard and exact opaque display capabilities", () => {
    const standard = defineExtension({
      name: "com.example.grid",
      version: "2.0.0",
      paramsSchema: z.object({ columns: z.number().int() }),
      deterministic: true,
      workerCompatible: true,
      display: {
        kind: "standard",
        version: "1",
        compile: () => undefined,
      },
    });
    const standardResult = preflightExtensions(
      scene({
        name: "com.example.grid",
        version: "2.0.0",
        params: { columns: 8 },
      }),
      createExtensionRegistry([standard]),
      {
        displayTarget: {
          version: "1",
          backendId: "canvas2d",
          realm: "worker",
          capabilities: [],
        },
      },
    );
    expect(standardResult).toMatchObject({ ok: true, issues: [] });
    expect(standardResult.nodes[0]).toMatchObject({
      rendererAdapter: undefined,
      displayDecision: { kind: "standard", version: "1" },
    });
    expect(
      preflightExtensions(
        scene({
          name: "com.example.grid",
          version: "2.0.0",
          params: { columns: 8 },
        }),
        createExtensionRegistry([standard]),
        {
          displayTarget: {
            version: "2",
            backendId: "canvas2d",
            realm: "main",
            capabilities: [],
          },
        },
      ).issues[0]?.code,
    ).toBe("extension_display_version_unsupported");

    const opaque = defineExtension({
      name: "com.example.grid",
      version: "2.0.0",
      paramsSchema: z.object({ columns: z.number().int() }),
      deterministic: true,
      workerCompatible: true,
      display: {
        kind: "opaque",
        capability: {
          id: "com.example.grid.paint",
          version: "3.1.0",
          realms: ["main", "worker"],
        },
        payloadSchema: z.object({}),
        compile: () => ({}),
      },
    });
    const preflightOpaque = (
      capabilities: Array<{
        id: string;
        version: string;
        realms: Array<"main" | "worker">;
      }>,
      realm: "main" | "worker" = "worker",
    ) =>
      preflightExtensions(
        scene({
          name: "com.example.grid",
          version: "2.0.0",
          params: { columns: 8 },
        }),
        createExtensionRegistry([opaque]),
        {
          displayTarget: {
            version: "1",
            backendId: "canvas2d",
            realm,
            capabilities,
          },
        },
      );

    expect(preflightOpaque([]).issues[0]?.code).toBe(
      "extension_display_capability_missing",
    );
    expect(
      preflightOpaque([
        {
          id: "com.example.grid.paint",
          version: "3.0.0",
          realms: ["worker"],
        },
      ]).issues[0]?.code,
    ).toBe("extension_display_capability_version_unsupported");
    expect(
      preflightOpaque([
        {
          id: "com.example.grid.paint",
          version: "3.1.0",
          realms: ["main"],
        },
      ]).issues[0]?.code,
    ).toBe("extension_display_realm_unsupported");
    const supported = preflightOpaque([
      {
        id: "com.example.grid.paint",
        version: "3.1.0",
        realms: ["main", "worker"],
      },
    ]);
    expect(supported).toMatchObject({ ok: true, issues: [] });
    expect(supported.nodes[0]?.displayDecision).toEqual({
      kind: "opaque",
      capability: { id: "com.example.grid.paint", version: "3.1.0" },
      realm: "worker",
    });
  });

  it("requires an explicit legacy bridge capability on display-list targets", () => {
    const registry = createExtensionRegistry([testExtension()]);
    const run = (
      capabilities: Array<{
        id: string;
        version: string;
        realms: Array<"main" | "worker">;
      }>,
    ) =>
      preflightExtensions(
        scene({
          name: "com.example.grid",
          version: "2.0.0",
          params: { columns: 8 },
        }),
        registry,
        {
          displayTarget: {
            version: "1",
            backendId: "canvas2d",
            realm: "main",
            capabilities,
          },
        },
      );

    expect(run([]).issues[0]?.code).toBe(
      "extension_display_capability_missing",
    );
    const supported = run([
      { ...legacyExtensionRendererCapability, realms: ["main"] },
    ]);
    expect(supported).toMatchObject({ ok: true, issues: [] });
    expect(supported.nodes[0]?.displayDecision).toMatchObject({
      kind: "legacy-opaque",
      renderer: "canvas2d",
    });
    expect(supported.nodes[0]?.rendererAdapter).toBe(adapter);
  });
});
