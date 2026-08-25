import {
  inspectScene,
  lintScene,
  migrateScene,
  validateScene,
} from "@motionforge/schema";
import { diffScenes, discoverCapabilities } from "@motionforge/agent-tools";
import { checkScene, inspectLayout } from "@motionforge/inspection";
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
  motionforge inspect-layout <scene-module> --frame <frame>
  motionforge lint <scene-module>
  motionforge check <scene-module> [--frames <frame,...> | --sample-count <count>]
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

  if (command === "inspect-layout" || command === "check") {
    return executeCompositionInspectionCommand(command, modulePath, rest);
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

async function executeCompositionInspectionCommand(
  command: "inspect-layout" | "check",
  modulePath: string | undefined,
  args: string[],
): Promise<CliResult> {
  if (!modulePath) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `${inspectionUsage(command)}\n`,
    };
  }

  const parsedOptions = parseInspectionOptions(command, args);
  if (!parsedOptions.ok) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `${parsedOptions.error}\n${inspectionUsage(command)}\n`,
    };
  }

  try {
    const sceneInput = await loadSceneModule(modulePath);
    const validation = validateScene(sceneInput);
    if (command === "check") {
      if (validation.ok) {
        const rangeError = validateInspectionFrames(
          validation.scene.duration,
          parsedOptions.frames,
        );
        if (rangeError) {
          return {
            exitCode: 2,
            stdout: "",
            stderr: `${rangeError}\n${inspectionUsage(command)}\n`,
          };
        }
      }
      const checked = checkScene(sceneInput, {
        ...(parsedOptions.frames ? { frames: parsedOptions.frames } : {}),
        ...(parsedOptions.sampleCount !== undefined
          ? { sampleCount: parsedOptions.sampleCount }
          : {}),
      });
      return {
        // Warnings remain useful report data; validation or future
        // error-severity diagnostics make the command fail.
        exitCode: checked.summary.errors > 0 ? 1 : 0,
        stdout: `${JSON.stringify(checked, null, 2)}\n`,
        stderr: "",
      };
    }

    if (!validation.ok) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: formatValidationErrors(modulePath, validation.errors),
      };
    }

    const rangeError = validateInspectionFrames(
      validation.scene.duration,
      parsedOptions.frames,
    );
    if (rangeError) {
      return {
        exitCode: 2,
        stdout: "",
        stderr: `${rangeError}\n${inspectionUsage(command)}\n`,
      };
    }

    const frame = parsedOptions.frames?.[0];
    if (frame === undefined) {
      return {
        exitCode: 2,
        stdout: "",
        stderr: `${inspectionUsage(command)}\n`,
      };
    }
    return {
      exitCode: 0,
      stdout: `${JSON.stringify(inspectLayout(validation.scene, frame), null, 2)}\n`,
      stderr: "",
    };
  } catch (error) {
    if (command === "check") {
      const message = error instanceof Error ? error.message : String(error);
      return {
        exitCode: 1,
        stdout: `${JSON.stringify(
          {
            kind: "motionforge.check",
            version: 1,
            ok: false,
            validation: { ok: false, errors: [message] },
            structural: null,
            lint: { issues: [] },
            tree: null,
            timeline: null,
            composition: null,
            summary: {
              nodes: 0,
              activeWindows: 0,
              diagnostics: 0,
              warnings: 0,
              errors: 1,
            },
          },
          null,
          2,
        )}\n`,
        stderr: "",
      };
    }
    return {
      exitCode: 1,
      stdout: "",
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
}

type InspectionCliOptions = {
  frames?: number[];
  sampleCount?: number;
};

function parseInspectionOptions(
  command: "inspect-layout" | "check",
  args: string[],
): ({ ok: true } & InspectionCliOptions) | { ok: false; error: string } {
  let frames: number[] | undefined;
  let sampleCount: number | undefined;
  const seen = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg !== "--frame" && arg !== "--frames" && arg !== "--sample-count") {
      return { ok: false, error: `Unknown ${command} option "${arg ?? ""}".` };
    }
    if (seen.has(arg)) {
      return { ok: false, error: `Duplicate ${command} option "${arg}".` };
    }
    seen.add(arg);
    const raw = args[index + 1];
    if (!raw || raw.startsWith("--")) {
      return { ok: false, error: `${arg} requires a value.` };
    }
    index += 1;

    if (arg === "--sample-count") {
      if (command !== "check") {
        return {
          ok: false,
          error: `${arg} is only valid for motionforge check.`,
        };
      }
      sampleCount = Number(raw);
      if (
        !Number.isInteger(sampleCount) ||
        sampleCount < 1 ||
        sampleCount > 100
      ) {
        return {
          ok: false,
          error: "--sample-count must be an integer from 1 through 100.",
        };
      }
      continue;
    }

    if (arg === "--frame") {
      if (command !== "inspect-layout") {
        return { ok: false, error: `${arg} is only valid for inspect-layout.` };
      }
      const frame = Number(raw);
      if (!Number.isInteger(frame) || frame < 0) {
        return { ok: false, error: "--frame must be a non-negative integer." };
      }
      frames = [frame];
      continue;
    }

    if (command !== "check") {
      return {
        ok: false,
        error: `${arg} is only valid for motionforge check.`,
      };
    }
    const parts = raw.split(",");
    if (
      parts.length === 0 ||
      parts.length > 100 ||
      parts.some((part) => part.trim() === "")
    ) {
      return { ok: false, error: "--frames requires 1 through 100 frames." };
    }
    const parsed = parts.map((part) => Number(part.trim()));
    if (parsed.some((frame) => !Number.isInteger(frame) || frame < 0)) {
      return {
        ok: false,
        error: "--frames must be comma-separated non-negative integers.",
      };
    }
    frames = parsed;
  }

  if (command === "inspect-layout" && !frames) {
    return { ok: false, error: "inspect-layout requires --frame." };
  }
  if (frames && sampleCount !== undefined) {
    return {
      ok: false,
      error: "Use either --frames or --sample-count, not both.",
    };
  }
  return {
    ok: true,
    ...(frames ? { frames } : {}),
    ...(sampleCount !== undefined ? { sampleCount } : {}),
  };
}

function validateInspectionFrames(
  duration: number,
  frames: readonly number[] | undefined,
): string | null {
  const invalid = frames?.find((frame) => frame >= duration);
  return invalid === undefined
    ? null
    : `Frame ${invalid} is outside the scene range 0-${duration - 1}.`;
}

function inspectionUsage(command: "inspect-layout" | "check"): string {
  return command === "inspect-layout"
    ? "Usage: motionforge inspect-layout <scene-module> --frame <frame>"
    : "Usage: motionforge check <scene-module> [--frames <frame,...> | --sample-count <count>]";
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
