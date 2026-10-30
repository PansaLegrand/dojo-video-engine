import type { DisplayExtensionOperation } from "@dojo-video-engine/core";
import {
  defineExtension,
  type ExtensionSceneNode,
} from "@dojo-video-engine/extensions";
import type { Scene, SceneJsonValue } from "@dojo-video-engine/schema";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v3";
import {
  compileResolvedCanvas2DDisplayExtension,
  createCanvas2DOpaqueExtensionRegistry,
  executeCanvas2DDisplayExtension,
  type Canvas2DExtensionDisplayContext,
  type Canvas2DExtensionPreparedImage,
} from "./extension-display.js";

type RecordingState = {
  tx: number;
  ty: number;
  globalAlpha: number;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  clip: Rect | null;
};

type Rect = { x: number; y: number; width: number; height: number };

class RecordingCanvasContext {
  readonly pixels = new Map<string, string>();
  readonly textCalls: Array<{
    text: string;
    x: number;
    y: number;
    maxWidth?: number;
    font: string;
    fill: string;
    alpha: number;
  }> = [];
  readonly drawImageCalls: Array<Rect> = [];
  private readonly states: RecordingState[] = [];
  private path: Rect | null = null;
  tx = 0;
  ty = 0;
  globalAlpha = 1;
  fillStyle: string | CanvasGradient | CanvasPattern = "#000000";
  strokeStyle: string | CanvasGradient | CanvasPattern = "#000000";
  lineWidth = 1;
  font = "10px sans-serif";
  textAlign: CanvasTextAlign = "start";
  textBaseline: CanvasTextBaseline = "alphabetic";

  get saveDepth(): number {
    return this.states.length;
  }

  save(): void {
    this.states.push({
      tx: this.tx,
      ty: this.ty,
      globalAlpha: this.globalAlpha,
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      font: this.font,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline,
      clip: this.currentClip,
    });
  }

  restore(): void {
    const state = this.states.pop();
    if (!state) throw new Error("unbalanced restore");
    this.tx = state.tx;
    this.ty = state.ty;
    this.globalAlpha = state.globalAlpha;
    this.fillStyle = state.fillStyle;
    this.strokeStyle = state.strokeStyle;
    this.lineWidth = state.lineWidth;
    this.font = state.font;
    this.textAlign = state.textAlign;
    this.textBaseline = state.textBaseline;
    this.currentClip = state.clip;
  }

  translate(x: number, y: number): void {
    this.tx += x;
    this.ty += y;
  }

  beginPath(): void {
    this.path = null;
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.path = { x: x + this.tx, y: y + this.ty, width, height };
  }

  roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    _radii?: number | DOMPointInit | Iterable<number | DOMPointInit>,
  ): void {
    throw new Error(
      `roundRect must not be used (${x}, ${y}, ${width}, ${height})`,
    );
  }

  moveTo(): void {}

  lineTo(): void {}

  quadraticCurveTo(): void {}

  closePath(): void {
    // The recording fake only needs to prove the portable path API is used.
  }

  fill(): void {
    if (this.path) this.paint(this.path, String(this.fillStyle));
  }

  stroke(): void {
    if (this.path) this.paint(this.path, String(this.strokeStyle));
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.paint(
      { x: x + this.tx, y: y + this.ty, width, height },
      String(this.fillStyle),
    );
  }

  clip(): void {
    if (!this.path) throw new Error("clip without path");
    this.currentClip = intersect(this.currentClip, this.path);
  }

  drawImage(
    source: CanvasImageSource,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const rect = { x: x + this.tx, y: y + this.ty, width, height };
    this.drawImageCalls.push(rect);
    const color = (source as unknown as { color?: string }).color ?? "image";
    this.paint(rect, color);
  }

  fillText(text: string, x: number, y: number, maxWidth?: number): void {
    this.textCalls.push({
      text,
      x: x + this.tx,
      y: y + this.ty,
      ...(maxWidth === undefined ? {} : { maxWidth }),
      font: this.font,
      fill: String(this.fillStyle),
      alpha: this.globalAlpha,
    });
  }

  pixel(x: number, y: number): string | undefined {
    return this.pixels.get(`${x},${y}`);
  }

  private currentClip: Rect | null = null;

  private paint(rect: Rect, color: string): void {
    const clipped = intersect(this.currentClip, rect);
    if (!clipped) return;
    const left = Math.ceil(clipped.x);
    const top = Math.ceil(clipped.y);
    const right = Math.floor(clipped.x + clipped.width);
    const bottom = Math.floor(clipped.y + clipped.height);
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        this.pixels.set(`${x},${y}`, `${color}@${this.globalAlpha}`);
      }
    }
  }
}

function intersect(left: Rect | null, right: Rect): Rect | null {
  if (!left) return { ...right };
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const farX = Math.min(left.x + left.width, right.x + right.width);
  const farY = Math.min(left.y + left.height, right.y + right.height);
  return farX <= x || farY <= y
    ? null
    : { x, y, width: farX - x, height: farY - y };
}

function context(recording = new RecordingCanvasContext()): {
  recording: RecordingCanvasContext;
  canvas: Canvas2DExtensionDisplayContext;
} {
  return {
    recording,
    canvas: recording as unknown as Canvas2DExtensionDisplayContext,
  };
}

const box = { x: 10, y: 20, width: 40, height: 30 } as const;

function baseOperation(
  operation: Record<string, unknown>,
): DisplayExtensionOperation {
  return {
    engineId: "node/grid/extension",
    nodeId: "grid",
    paintOrder: 1,
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    kind: "extension",
    ...operation,
  } as DisplayExtensionOperation;
}

function standardOperation(
  operations: readonly SceneJsonValue[],
): DisplayExtensionOperation {
  return baseOperation({
    mode: "standard",
    extension: {
      name: "com.example.grid",
      version: "2.0.0",
      params: {},
    },
    displayVersion: "1",
    operations: [...operations],
  });
}

function opaqueOperation(version = "1.0.0"): DisplayExtensionOperation {
  return baseOperation({
    mode: "opaque",
    extension: {
      name: "com.example.grid",
      version: "2.0.0",
      params: {},
    },
    capability: { id: "com.example.canvas-grid", version },
    payload: { columns: 4 },
  });
}

describe("Canvas2D extension standard display execution", () => {
  it("draws rect and text pixels in border-box-local coordinates", () => {
    const { recording, canvas } = context();
    executeCanvas2DDisplayExtension({
      context: canvas,
      operation: standardOperation([
        {
          kind: "rect",
          id: "grid::background",
          x: 1,
          y: 2,
          width: 3,
          height: 2,
          fill: "red",
          opacity: 0.5,
        },
        {
          kind: "text",
          id: "grid::label",
          text: "Grid",
          x: 5,
          y: 7,
          maxWidth: 20,
          fontFamily: "sans-serif",
          fontSize: 12,
          fontWeight: "700",
          fill: "white",
          align: "center",
          baseline: "middle",
          opacity: 0.75,
        },
      ]),
      box,
    });

    expect(recording.pixel(11, 22)).toBe("red@0.5");
    expect(recording.pixel(10, 20)).toBeUndefined();
    expect(recording.textCalls).toEqual([
      {
        text: "Grid",
        x: 15,
        y: 27,
        maxWidth: 20,
        font: "700 12px sans-serif",
        fill: "white",
        alpha: 0.75,
      },
    ]);
    expect(recording.saveDepth).toBe(0);
    expect(recording.tx).toBe(0);
    expect(recording.ty).toBe(0);
    expect(recording.globalAlpha).toBe(1);
  });

  it("draws only declared prepared images with fit and operation clipping", () => {
    const { recording, canvas } = context();
    const photo = {
      width: 2,
      height: 4,
      color: "photo",
    } as unknown as Canvas2DExtensionPreparedImage;
    executeCanvas2DDisplayExtension({
      context: canvas,
      operation: standardOperation([
        {
          kind: "image",
          id: "grid::photo",
          assetId: "photo",
          x: 4,
          y: 3,
          width: 6,
          height: 4,
          fit: "contain",
        },
      ]),
      box,
      preparedImages: new Map([["photo", photo]]),
    });

    expect(recording.drawImageCalls).toEqual([
      { x: 16, y: 23, width: 2, height: 4 },
    ]);
    expect(recording.pixel(16, 23)).toBe("photo@1");
    expect(recording.pixel(15, 23)).toBeUndefined();
  });

  it("uses portable path operations for rounded rects", () => {
    const { canvas } = context();
    expect(() =>
      executeCanvas2DDisplayExtension({
        context: canvas,
        operation: standardOperation([
          {
            kind: "rect",
            id: "grid::rounded",
            x: 0,
            y: 0,
            width: 20,
            height: 10,
            radius: 4,
            fill: "red",
          },
        ]),
        box,
      }),
    ).not.toThrow();
  });

  it("rejects missing, invalid, and unknown display inputs without leaking state", () => {
    const { recording, canvas } = context();
    recording.globalAlpha = 0.8;
    const imageOperation = standardOperation([
      {
        kind: "image",
        id: "grid::photo",
        assetId: "photo",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      },
    ]);
    expect(() =>
      executeCanvas2DDisplayExtension({
        context: canvas,
        operation: imageOperation,
        box,
      }),
    ).toThrow(/declared prepared image "photo"/);
    expect(() =>
      executeCanvas2DDisplayExtension({
        context: canvas,
        operation: imageOperation,
        box,
        preparedImages: new Map([
          ["photo", { width: 0, height: 1 } as Canvas2DExtensionPreparedImage],
        ]),
      }),
    ).toThrow(/finite positive intrinsic dimensions/);
    expect(() =>
      executeCanvas2DDisplayExtension({
        context: canvas,
        operation: standardOperation([
          { kind: "shader", id: "grid::future" } as SceneJsonValue,
        ]),
        box,
      }),
    ).toThrow(/does not support standard extension operation kind "shader"/);
    expect(recording.saveDepth).toBe(0);
    expect(recording.tx).toBe(0);
    expect(recording.ty).toBe(0);
    expect(recording.globalAlpha).toBe(0.8);
  });
});

describe("Canvas2D opaque extension registry", () => {
  it("advertises and dispatches an exact capability in its validated realm", () => {
    const { recording, canvas } = context();
    const resolvedAssets = new Map([["native", Symbol("resource")]]);
    const preparedFrame = new Date(0);
    const draw = vi.fn(
      ({
        context: target,
        localBox,
        realm,
        resolvedAssets: receivedAssets,
        preparedFrame: receivedFrame,
      }) => {
        expect(localBox).toEqual({ x: 0, y: 0, width: 40, height: 30 });
        expect(realm).toBe("worker");
        expect(receivedAssets).toBe(resolvedAssets);
        expect(receivedFrame).toBe(preparedFrame);
        target.fillStyle = "opaque";
        target.fillRect(1, 2, 2, 2);
      },
    );
    const registry = createCanvas2DOpaqueExtensionRegistry({
      realm: "worker",
      handlers: [
        {
          capability: {
            id: "com.example.canvas-grid",
            version: "1.0.0",
            realms: ["main", "worker"],
          },
          draw,
        },
      ],
    });

    expect(registry.displayTarget()).toEqual({
      version: "1",
      backendId: "canvas2d",
      realm: "worker",
      capabilities: [
        {
          id: "com.example.canvas-grid",
          version: "1.0.0",
          realms: ["main", "worker"],
        },
      ],
    });
    executeCanvas2DDisplayExtension({
      context: canvas,
      operation: opaqueOperation(),
      box,
      opaqueRegistry: registry,
      resolvedAssets,
      preparedFrame,
    });
    expect(draw).toHaveBeenCalledOnce();
    expect(recording.pixel(11, 22)).toBe("opaque@1");
    expect(recording.saveDepth).toBe(0);
  });

  it("rejects missing, wrong-version, wrong-realm, duplicate, and invalid handlers", () => {
    const { canvas } = context();
    const registry = createCanvas2DOpaqueExtensionRegistry({
      realm: "main",
      handlers: [
        {
          capability: {
            id: "com.example.canvas-grid",
            version: "1.0.0",
            realms: ["main"],
          },
          draw: () => undefined,
        },
      ],
    });
    expect(() =>
      executeCanvas2DDisplayExtension({
        context: canvas,
        operation: opaqueOperation(),
        box,
      }),
    ).toThrow(/no registry was supplied/);
    expect(() =>
      executeCanvas2DDisplayExtension({
        context: canvas,
        operation: opaqueOperation("2.0.0"),
        box,
        opaqueRegistry: registry,
      }),
    ).toThrow(/registered version\(s\): 1.0.0/);
    expect(() =>
      createCanvas2DOpaqueExtensionRegistry({
        realm: "worker",
        handlers: [
          {
            capability: {
              id: "com.example.canvas-grid",
              version: "1.0.0",
              realms: ["main"],
            },
            draw: () => undefined,
          },
        ],
      }),
    ).toThrow(/does not support the registry realm worker/);
    expect(() =>
      createCanvas2DOpaqueExtensionRegistry({
        realm: "main",
        handlers: [
          ...registry.capabilities.map((capability) => ({
            capability,
            draw: () => undefined,
          })),
          {
            capability: registry.capabilities[0]!,
            draw: () => undefined,
          },
        ],
      }),
    ).toThrow(/Duplicate/);
    expect(() =>
      createCanvas2DOpaqueExtensionRegistry({
        realm: "main",
        handlers: [
          {
            capability: {
              id: "com.example.canvas-grid",
              version: "latest",
              realms: ["main"],
            },
            draw: () => undefined,
          },
        ],
      }),
    ).toThrow(/exact semantic version/);
  });

  it("restores Canvas state when opaque and legacy callbacks fail", () => {
    const { recording, canvas } = context();
    recording.globalAlpha = 0.6;
    const registry = createCanvas2DOpaqueExtensionRegistry({
      realm: "main",
      handlers: [
        {
          capability: {
            id: "com.example.canvas-grid",
            version: "1.0.0",
            realms: ["main"],
          },
          draw: ({ context: target }) => {
            target.globalAlpha = 0.1;
            throw new Error("opaque failed");
          },
        },
      ],
    });
    expect(() =>
      executeCanvas2DDisplayExtension({
        context: canvas,
        operation: opaqueOperation(),
        box,
        opaqueRegistry: registry,
      }),
    ).toThrow("opaque failed");
    expect(recording.globalAlpha).toBe(0.6);
    expect(recording.tx).toBe(0);
    expect(recording.saveDepth).toBe(0);

    const legacy = baseOperation({
      mode: "legacy-opaque",
      extension: {
        name: "com.example.legacy",
        version: "1.0.0",
        params: {},
      },
      capability: {
        id: "dojo-video-engine.legacy.renderer-adapter",
        version: "1.0.0",
      },
    });
    expect(() =>
      executeCanvas2DDisplayExtension({
        context: canvas,
        operation: legacy,
        box,
        legacyDraw: ({ context: target }) => {
          target.globalAlpha = 0.2;
          throw new Error("legacy failed");
        },
      }),
    ).toThrow("legacy failed");
    expect(recording.globalAlpha).toBe(0.6);
    expect(recording.saveDepth).toBe(0);
    expect(() =>
      executeCanvas2DDisplayExtension({
        context: canvas,
        operation: legacy,
        box,
      }),
    ).toThrow(/no caller-supplied draw callback/);
  });

  it("rejects promise-returning opaque and legacy draw handlers", () => {
    const { canvas } = context();
    const registry = createCanvas2DOpaqueExtensionRegistry({
      realm: "main",
      handlers: [
        {
          capability: {
            id: "com.example.canvas-grid",
            version: "1.0.0",
            realms: ["main"],
          },
          draw: async () => undefined,
        },
      ],
    });
    expect(() =>
      executeCanvas2DDisplayExtension({
        context: canvas,
        operation: opaqueOperation(),
        box,
        opaqueRegistry: registry,
      }),
    ).toThrow(/must be synchronous/);
    expect(() =>
      executeCanvas2DDisplayExtension({
        context: canvas,
        operation: baseOperation({
          mode: "legacy-opaque",
          extension: {
            name: "com.example.legacy",
            version: "1.0.0",
            params: {},
          },
          capability: {
            id: "dojo-video-engine.legacy.renderer-adapter",
            version: "1.0.0",
          },
        }),
        box,
        legacyDraw: async () => undefined,
      }),
    ).toThrow(/must be synchronous/);
  });
});

describe("resolved Canvas2D extension display compilation", () => {
  const node: ExtensionSceneNode = {
    id: "grid",
    type: "extension",
    extension: {
      name: "com.example.grid",
      version: "2.0.0",
      params: { columns: 4 },
    },
  };
  const scene: Scene = {
    schemaVersion: 1,
    width: 100,
    height: 100,
    fps: 30,
    duration: 60,
    assets: {},
    nodes: [node],
  };

  it("compiles standard and opaque contracts into core inputs", () => {
    const standard = defineExtension({
      name: "com.example.grid",
      version: "2.0.0",
      paramsSchema: z.object({ columns: z.number() }),
      deterministic: true,
      workerCompatible: true,
      display: {
        kind: "standard",
        version: "1",
        compile: (compileContext, output) => {
          output.rect("background", {
            x: 0,
            y: 0,
            width: compileContext.box.width,
            height: compileContext.box.height,
            fill: "#123456",
          });
        },
      },
    });
    const standardInput = compileResolvedCanvas2DDisplayExtension({
      scene,
      node,
      box,
      runtime: {
        definition: standard,
        params: { columns: 4 },
        requirements: [],
        resolvedAssets: undefined,
        displayDecision: { kind: "standard", version: "1" },
      },
      preparedFrame: undefined,
      frame: 12,
      localFrame: 7,
      sceneFps: 30,
    });
    expect(standardInput).toMatchObject({
      kind: "standard",
      version: "1",
      operations: [
        {
          kind: "rect",
          id: "grid::background",
          width: 40,
          height: 30,
        },
      ],
    });

    const opaque = defineExtension({
      name: "com.example.grid",
      version: "2.0.0",
      paramsSchema: z.object({ columns: z.number() }),
      deterministic: true,
      workerCompatible: true,
      display: {
        kind: "opaque",
        capability: {
          id: "com.example.canvas-grid",
          version: "1.0.0",
          realms: ["main"],
        },
        payloadSchema: z.object({ columns: z.number() }),
        compile: ({ params }) => params,
      },
    });
    expect(
      compileResolvedCanvas2DDisplayExtension({
        scene,
        node,
        box,
        runtime: {
          definition: opaque,
          params: { columns: 4 },
          requirements: [],
          resolvedAssets: undefined,
          displayDecision: {
            kind: "opaque",
            capability: {
              id: "com.example.canvas-grid",
              version: "1.0.0",
            },
            realm: "main",
          },
        },
        preparedFrame: undefined,
        frame: 12,
        localFrame: 7,
        sceneFps: 30,
      }),
    ).toEqual({
      kind: "opaque",
      capability: { id: "com.example.canvas-grid", version: "1.0.0" },
      payload: { columns: 4 },
    });
  });

  it("keeps legacy compilation on the explicit compatibility path", () => {
    const legacy = defineExtension({
      name: "com.example.grid",
      version: "2.0.0",
      paramsSchema: z.object({ columns: z.number() }),
      deterministic: true,
      workerCompatible: true,
      renderers: { canvas2d: { draw: () => undefined } },
    });
    expect(() =>
      compileResolvedCanvas2DDisplayExtension({
        scene,
        node,
        box,
        runtime: {
          definition: legacy,
          params: { columns: 4 },
          requirements: [],
          resolvedAssets: undefined,
          displayDecision: {
            kind: "legacy-opaque",
            renderer: "canvas2d",
            capability: {
              id: "dojo-video-engine.legacy.renderer-adapter",
              version: "1.0.0",
            },
            realm: "main",
          },
        },
        preparedFrame: undefined,
        frame: 12,
        localFrame: 7,
        sceneFps: 30,
      }),
    ).toThrow(/cannot compile a portable display payload/);
  });
});
