import { validateScene, type Scene } from "@motionforge/schema";
import { loadSceneModule } from "./loader.js";
import { createStudioServer, type StudioServerOptions } from "./studio.js";

export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  close?: () => Promise<void>;
};

export type CliIo = {
  stdout: (value: string) => void;
  stderr: (value: string) => void;
};

const helpText = `motionforge

Usage:
  motionforge validate <scene-module>
  motionforge print <scene-module>
  motionforge inspect <scene-module>
  motionforge dev <scene-module> [--host <host>] [--port <port>]

Scene modules may be .json, .js, .mjs, .cjs, .ts, .mts, or .cts files.
The default export may be a Scene, a function returning a Scene, or a Promise.
`;

export async function runCli(
  argv: string[],
  io: CliIo = {
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  },
): Promise<number> {
  const result = await executeCli(argv);

  if (result.stdout) {
    io.stdout(result.stdout);
  }

  if (result.stderr) {
    io.stderr(result.stderr);
  }

  return result.exitCode;
}

export async function executeCli(argv: string[]): Promise<CliResult> {
  const [command, modulePath, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    return { exitCode: 0, stdout: helpText, stderr: "" };
  }

  if (command === "dev") {
    return await executeDevCommand(modulePath, rest);
  }

  if (command !== "validate" && command !== "print" && command !== "inspect") {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `Unknown command "${command}".\n\n${helpText}`,
    };
  }

  if (!modulePath || rest.length > 0) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `Usage error: expected exactly one scene module path.\n\n${helpText}`,
    };
  }

  try {
    const sceneInput = await loadSceneModule(modulePath);
    const result = validateScene(sceneInput);

    if (!result.ok) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: formatValidationErrors(modulePath, result.errors),
      };
    }

    if (command === "print") {
      return {
        exitCode: 0,
        stdout: `${JSON.stringify(result.scene, null, 2)}\n`,
        stderr: "",
      };
    }

    if (command === "inspect") {
      return {
        exitCode: 0,
        stdout: `${JSON.stringify(inspectScene(result.scene), null, 2)}\n`,
        stderr: "",
      };
    }

    return {
      exitCode: 0,
      stdout: `Valid MotionForge scene: ${modulePath}\n`,
      stderr: "",
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
}

async function executeDevCommand(
  modulePath: string | undefined,
  args: string[],
): Promise<CliResult> {
  if (!modulePath) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `Usage error: expected a scene module path.\n\n${helpText}`,
    };
  }

  const options = parseDevOptions(args);

  if (!options.ok) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `${options.error}\n\n${helpText}`,
    };
  }

  try {
    const server = await createStudioServer({
      sceneModulePath: modulePath,
      host: options.host,
      port: options.port,
    });

    return {
      exitCode: 0,
      stdout: `MotionForge Studio running at ${server.url}\nScene: ${server.sceneModulePath}\n`,
      stderr: "",
      close: server.close,
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
}

function parseDevOptions(args: string[]):
  | ({ ok: true } & Pick<StudioServerOptions, "host" | "port">)
  | {
      ok: false;
      error: string;
    } {
  let host: string | undefined;
  let port: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--host") {
      host = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--port") {
      const rawPort = args[index + 1];
      port = rawPort ? Number.parseInt(rawPort, 10) : Number.NaN;
      index += 1;

      if (!Number.isInteger(port) || port < 0) {
        return { ok: false, error: "--port must be a non-negative integer." };
      }

      continue;
    }

    return { ok: false, error: `Unknown dev option "${arg ?? ""}".` };
  }

  return { ok: true, host, port };
}

function formatValidationErrors(modulePath: string, errors: string[]) {
  return [
    `Invalid MotionForge scene: ${modulePath}`,
    ...errors.map((error) => `- ${error}`),
    "",
  ].join("\n");
}

export type SceneInspection = {
  schemaVersion: number;
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  durationSeconds: number;
  assets: {
    total: number;
    image: number;
    video: number;
    audio: number;
    font: number;
    lottie: number;
  };
  nodes: {
    total: number;
    root: number;
    div: number;
    text: number;
    img: number;
    video: number;
    audio: number;
    lottie: number;
    effect: number;
  };
  capabilities: {
    hasVisuals: boolean;
    hasAudio: boolean;
    hasVideo: boolean;
    hasLottie: boolean;
    hasEffects: boolean;
    hasAnimations: boolean;
    hasVolumeAutomation: boolean;
    hasLoopedAudio: boolean;
    requiresBrowserExport: true;
  };
};

export function inspectScene(scene: Scene): SceneInspection {
  const assets: SceneInspection["assets"] = {
    total: 0,
    image: 0,
    video: 0,
    audio: 0,
    font: 0,
    lottie: 0,
  };
  const nodes: SceneInspection["nodes"] = {
    total: 0,
    root: scene.nodes.length,
    div: 0,
    text: 0,
    img: 0,
    video: 0,
    audio: 0,
    lottie: 0,
    effect: 0,
  };
  let hasAnimations = false;
  let hasVolumeAutomation = false;
  let hasLoopedAudio = false;

  for (const asset of Object.values(scene.assets)) {
    assets.total += 1;
    assets[asset.type] += 1;
  }

  const visit = (sceneNodes: Scene["nodes"]) => {
    for (const node of sceneNodes) {
      nodes.total += 1;
      nodes[node.type] += 1;

      if ((node.animations ?? []).length > 0) {
        hasAnimations = true;
      }

      if (node.volumeEnvelope !== undefined) {
        hasVolumeAutomation = true;
      }

      if (node.type === "audio" && node.loop === true) {
        hasLoopedAudio = true;
      }

      visit(node.children ?? []);
    }
  };

  visit(scene.nodes);

  return {
    schemaVersion: scene.schemaVersion,
    width: scene.width,
    height: scene.height,
    fps: scene.fps,
    durationFrames: scene.duration,
    durationSeconds: scene.duration / scene.fps,
    assets,
    nodes,
    capabilities: {
      hasVisuals:
        nodes.div +
          nodes.text +
          nodes.img +
          nodes.video +
          nodes.lottie +
          nodes.effect >
        0,
      hasAudio: nodes.audio > 0 || nodes.video > 0 || assets.audio > 0,
      hasVideo: nodes.video > 0 || assets.video > 0,
      hasLottie: nodes.lottie > 0 || assets.lottie > 0,
      hasEffects: nodes.effect > 0,
      hasAnimations,
      hasVolumeAutomation,
      hasLoopedAudio,
      requiresBrowserExport: true,
    },
  };
}
