import {
  inspectScene,
  lintScene,
  migrateScene,
  validateScene,
} from "@motionforge/schema";
import { diffScenes, discoverCapabilities } from "@motionforge/agent-tools";
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
  motionforge migrate <scene-module>
  motionforge inspect <scene-module>
  motionforge lint <scene-module>
  motionforge diff <before-scene-module> <after-scene-module>
  motionforge capabilities
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

  if (command === "capabilities") {
    if (modulePath || rest.length > 0) {
      return {
        exitCode: 2,
        stdout: "",
        stderr: "Usage: motionforge capabilities\n",
      };
    }
    return {
      exitCode: 0,
      stdout: `${JSON.stringify(discoverCapabilities(), null, 2)}\n`,
      stderr: "",
    };
  }

  if (command === "diff") {
    const afterPath = rest[0];
    if (!modulePath || !afterPath || rest.length !== 1) {
      return {
        exitCode: 2,
        stdout: "",
        stderr:
          "Usage: motionforge diff <before-scene-module> <after-scene-module>\n",
      };
    }
    try {
      const before = await loadSceneModule(modulePath);
      const after = await loadSceneModule(afterPath);
      return {
        exitCode: 0,
        stdout: `${JSON.stringify(diffScenes(before, after), null, 2)}\n`,
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

  if (
    command !== "validate" &&
    command !== "print" &&
    command !== "migrate" &&
    command !== "inspect" &&
    command !== "lint"
  ) {
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

    if (command === "migrate") {
      return {
        exitCode: 0,
        stdout: `${JSON.stringify(migrateScene(sceneInput), null, 2)}\n`,
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

    if (command === "lint") {
      const lint = lintScene(result.scene);
      return {
        exitCode: 0,
        stdout: `${JSON.stringify(
          {
            schemaVersion: result.scene.schemaVersion,
            issueCount: lint.ok ? lint.issues.length : 0,
            issues: lint.ok ? lint.issues : [],
          },
          null,
          2,
        )}\n`,
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

export { inspectScene, type SceneInspection } from "@motionforge/schema";
