import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

export type CreateDojoVideoEngineOptions = {
  cwd?: string;
  force?: boolean;
};

export type CreateDojoVideoEngineResult = {
  projectName: string;
  projectDir: string;
  files: string[];
};

const packageVersion = await readOwnPackageVersion();

async function readOwnPackageVersion(): Promise<string> {
  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version?: unknown };

  if (typeof manifest.version !== "string" || !manifest.version) {
    throw new Error("@dojo-video-engine/create package.json has no valid version.");
  }

  return manifest.version;
}

export async function createDojoVideoEngineProject(
  targetDir: string,
  options: CreateDojoVideoEngineOptions = {},
): Promise<CreateDojoVideoEngineResult> {
  const cwd = options.cwd ?? process.cwd();
  const projectDir = resolve(cwd, targetDir);
  const projectName = sanitizePackageName(basename(projectDir));

  await ensureWritableProjectDir(projectDir, options.force ?? false);

  const files = projectFiles(projectName);

  for (const [filePath, contents] of files) {
    const absolutePath = join(projectDir, filePath);
    await mkdir(resolve(absolutePath, ".."), { recursive: true });
    await writeFile(absolutePath, contents);
  }

  return {
    projectName,
    projectDir,
    files: files.map(([filePath]) => filePath),
  };
}

export function helpText() {
  return `@dojo-video-engine/create (bin: create-dojo-video-engine)

Usage:
  pnpm dlx @dojo-video-engine/create <project-name>
  npx @dojo-video-engine/create@latest <project-name>

Options:
  --force    Write into a non-empty directory.
`;
}

export async function runCreateDojoVideoEngineCli(argv: string[]) {
  const targetDir = argv.find((arg) => !arg.startsWith("-"));
  const force = argv.includes("--force");

  if (!targetDir || argv.includes("--help") || argv.includes("-h")) {
    const exitCode = targetDir ? 0 : 2;
    const stream = exitCode === 0 ? process.stdout : process.stderr;
    stream.write(helpText());
    return exitCode;
  }

  try {
    const result = await createDojoVideoEngineProject(targetDir, { force });
    process.stdout.write(formatSuccess(result));
    return 0;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}

function projectFiles(projectName: string): Array<[string, string]> {
  return [
    ["package.json", packageJson(projectName)],
    ["tsconfig.json", tsconfigJson()],
    ["public/assets/logo.svg", logoSvg()],
    ["src/video.ts", videoTs()],
  ];
}

async function ensureWritableProjectDir(projectDir: string, force: boolean) {
  await mkdir(projectDir, { recursive: true });
  const entries = await readdir(projectDir);

  if (entries.length > 0 && !force) {
    throw new Error(
      `Directory "${projectDir}" is not empty. Choose a new directory or pass --force.`,
    );
  }

  const info = await stat(projectDir);

  if (!info.isDirectory()) {
    throw new Error(`Target "${projectDir}" is not a directory.`);
  }
}

function sanitizePackageName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "dojo-video-engine-video"
  );
}

function formatSuccess(result: CreateDojoVideoEngineResult) {
  return [
    `Created DojoVideoEngine project in ${result.projectDir}`,
    "",
    "Next steps:",
    `  cd ${result.projectDir}`,
    "  pnpm install",
    "  pnpm validate",
    "  pnpm inspect",
    "Editor and chat: https://github.com/PansaLegrand/dojo-video-harness",
    "",
  ].join("\n");
}

function packageJson(projectName: string) {
  return `${JSON.stringify(
    {
      name: projectName,
      version: "0.0.0",
      private: true,
      type: "module",
      packageManager: "pnpm@10.34.5",
      scripts: {
        validate: "dojo-video-engine validate src/video.ts",
        print: "dojo-video-engine print src/video.ts",
        migrate: "dojo-video-engine migrate src/video.ts",
        inspect: "dojo-video-engine inspect src/video.ts",
        lint: "dojo-video-engine lint src/video.ts",
        build: "tsc -p tsconfig.json && dojo-video-engine validate src/video.ts",
      },
      dependencies: {
        "@dojo-video-engine/authoring": `^${packageVersion}`,
        "@dojo-video-engine/cli": `^${packageVersion}`,
      },
      devDependencies: {
        typescript: "^5.8.3",
      },
    },
    null,
    2,
  )}\n`;
}

function tsconfigJson() {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ["src"],
    },
    null,
    2,
  )}\n`;
}

function videoTs() {
  return `import {
  bg,
  fadeUp,
  image,
  imageAsset,
  makeScene,
  publicAsset,
  seconds,
  textBlock,
  title,
} from "@dojo-video-engine/authoring";

const logo = imageAsset("logo", publicAsset("assets/logo.svg"));

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [
    bg("#0f172a"),
    image(logo, {
      id: "logo",
      at: seconds(0.2),
      duration: seconds(4.6),
      style: {
        left: 432,
        top: 360,
        width: 216,
        height: 216,
        objectFit: "contain",
      },
      enter: fadeUp({ durationInFrames: 10 }),
    }),
    title("Hello DojoVideoEngine", {
      at: seconds(0.8),
      duration: seconds(3.5),
      enter: fadeUp(),
    }),
    textBlock("Write deterministic video as TypeScript data.", {
      at: seconds(1.4),
      duration: seconds(3),
      enter: fadeUp({ delay: 6 }),
    }),
  ],
});
`;
}

function logoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="DojoVideoEngine starter logo">
  <rect width="512" height="512" rx="96" fill="#f8fafc"/>
  <circle cx="256" cy="256" r="164" fill="#111827"/>
  <path d="M166 320 256 142l90 178h-58l-32-74-32 74h-58Z" fill="#14b8a6"/>
  <path d="M210 372h92l-46-80-46 80Z" fill="#f59e0b"/>
</svg>
`;
}
