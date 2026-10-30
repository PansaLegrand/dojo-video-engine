import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Scene } from "@dojo-video-engine/schema";

type SceneExport = Scene | (() => Scene | Promise<Scene>) | Promise<Scene>;

export async function loadSceneModule(modulePath: string): Promise<unknown> {
  const absolutePath = resolve(modulePath);
  const extension = extname(absolutePath);

  if (extension === ".json") {
    return JSON.parse(await readFile(absolutePath, "utf8")) as unknown;
  }

  if (isTypeScriptExtension(extension)) {
    await import("tsx/esm");
  }

  const imported = (await import(
    `${pathToFileURL(absolutePath).href}?t=${Date.now()}`
  )) as {
    default?: SceneExport;
    scene?: SceneExport;
  };
  const exported = imported.default ?? imported.scene;

  if (exported === undefined) {
    throw new Error(
      `Scene module "${modulePath}" must export a default scene or named "scene".`,
    );
  }

  const value = typeof exported === "function" ? exported() : exported;
  return await value;
}

function isTypeScriptExtension(extension: string) {
  return extension === ".ts" || extension === ".mts" || extension === ".cts";
}
