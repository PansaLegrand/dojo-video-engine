import { builtinModules } from "node:module";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";

/**
 * Current 1.0 package dependency contract. Target post-1.0 packages are added
 * here only when their milestone creates the package and its public boundary.
 */
export const publicPackagePolicy = {
  "@motionforge/agent-tools": {
    owner: "Framework-neutral agent tool adapters",
    allowedMotionforgeDependencies: [
      "@motionforge/export",
      "@motionforge/inspection",
      "@motionforge/extensions",
      "@motionforge/presets",
      "@motionforge/renderer-canvas2d",
      "@motionforge/schema",
    ],
  },
  "@motionforge/authoring": {
    owner: "Programmer-facing Scene authoring compilers",
    allowedMotionforgeDependencies: [
      "@motionforge/core",
      "@motionforge/presets",
      "@motionforge/schema",
    ],
  },
  "@motionforge/cli": {
    owner: "Command-line and local Studio facade",
    allowedMotionforgeDependencies: [
      "@motionforge/agent-tools",
      "@motionforge/export",
      "@motionforge/inspection",
      "@motionforge/player",
      "@motionforge/presets",
      "@motionforge/schema",
    ],
  },
  "@motionforge/core": {
    owner: "Deterministic evaluation and layout",
    allowedMotionforgeDependencies: ["@motionforge/schema"],
  },
  "create-motionforge": {
    owner: "Starter project generation",
    allowedMotionforgeDependencies: [],
  },
  "@motionforge/export": {
    owner: "Frame, audio, encoder, muxer, stream, and worker orchestration",
    allowedMotionforgeDependencies: [
      "@motionforge/core",
      "@motionforge/renderer-canvas2d",
      "@motionforge/schema",
    ],
  },
  "@motionforge/extensions": {
    owner: "Trusted versioned extension contracts",
    allowedMotionforgeDependencies: ["@motionforge/schema"],
  },
  "@motionforge/inspection": {
    owner:
      "Renderer-neutral tree, timeline, layout, hit-test, and composition diagnostics",
    allowedMotionforgeDependencies: [
      "@motionforge/core",
      "@motionforge/schema",
    ],
  },
  "@motionforge/player": {
    owner: "Real-time preview and audio-synchronized playback",
    allowedMotionforgeDependencies: [
      "@motionforge/export",
      "@motionforge/renderer-canvas2d",
      "@motionforge/schema",
    ],
  },
  "@motionforge/presets": {
    owner: "Pure preset, macro, intent, and choreography compilers",
    allowedMotionforgeDependencies: ["@motionforge/schema"],
  },
  "@motionforge/renderer-canvas2d": {
    owner: "Canvas2D reference renderer and browser-media preparation",
    allowedMotionforgeDependencies: [
      "@motionforge/core",
      "@motionforge/extensions",
      "@motionforge/schema",
    ],
  },
  "@motionforge/schema": {
    owner: "Canonical Scene documents, migration, validation, and patches",
    allowedMotionforgeDependencies: [],
  },
};

const dependencyFields = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
];
const allDependencyFields = [...dependencyFields, "devDependencies"];

const forbiddenImports = [
  { pattern: /^@\//, reason: "application path aliases" },
  { pattern: /^@clerk(?:\/|$)/, reason: "authentication providers" },
  { pattern: /^@prisma(?:\/|$)/, reason: "database clients" },
  { pattern: /^@stripe(?:\/|$)/, reason: "billing providers" },
  { pattern: /^next(?:\/|$)/, reason: "application frameworks" },
  { pattern: /^react(?:\/|$)/, reason: "runtime UI frameworks" },
  { pattern: /^stripe(?:\/|$)/, reason: "billing providers" },
  { pattern: /^@ai-sdk(?:\/|$)/, reason: "model-provider SDKs" },
  { pattern: /^ai(?:\/|$)/, reason: "model-provider SDKs" },
  { pattern: /^openai(?:\/|$)/, reason: "model-provider SDKs" },
  { pattern: /^@anthropic-ai(?:\/|$)/, reason: "model-provider SDKs" },
  { pattern: /^langchain(?:\/|$)/, reason: "agent frameworks" },
  { pattern: /^@langchain(?:\/|$)/, reason: "agent frameworks" },
  { pattern: /^@aws-sdk(?:\/|$)/, reason: "cloud provider SDKs" },
  { pattern: /^aws-sdk(?:\/|$)/, reason: "cloud provider SDKs" },
  { pattern: /^@google-cloud(?:\/|$)/, reason: "cloud provider SDKs" },
  { pattern: /^@azure(?:\/|$)/, reason: "cloud provider SDKs" },
  { pattern: /^bullmq(?:\/|$)/, reason: "application queues" },
  { pattern: /^ioredis(?:\/|$)/, reason: "application queues/data stores" },
  {
    pattern: /^(?:pg|postgres|mongodb|mongoose)(?:\/|$)/,
    reason: "database clients",
  },
  { pattern: /^(?:drizzle-orm|typeorm)(?:\/|$)/, reason: "database clients" },
  { pattern: /^firebase(?:\/|$)/, reason: "application data providers" },
];

const downstreamSourceMarkers = [
  { pattern: /\/Users\//, label: "an absolute local path" },
  { pattern: /dojo-video-web/i, label: "the downstream repository name" },
  { pattern: /DojoClip/, label: "a downstream product name" },
];
const nodeBuiltins = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
);

export function validateWorkspaceGraph(packages) {
  const errors = [];
  const byName = new Map(packages.map((entry) => [entry.manifest.name, entry]));
  const publicPackages = packages.filter((entry) => !entry.manifest.private);
  const publicNames = new Set(
    publicPackages.map((entry) => entry.manifest.name),
  );
  const policyNames = new Set(Object.keys(publicPackagePolicy));

  for (const name of publicNames) {
    if (!policyNames.has(name)) {
      errors.push(
        `${name} is public but has no entry in scripts/package-contracts.mjs. Classify its owner and allowed internal dependencies before publishing it.`,
      );
    }
  }

  for (const name of policyNames) {
    if (!publicNames.has(name)) {
      errors.push(
        `${name} is in the public package policy but is not a current public workspace package.`,
      );
    }
  }

  const graph = new Map();
  for (const { manifest } of publicPackages) {
    const policy = publicPackagePolicy[manifest.name];
    const allowed = new Set(policy?.allowedMotionforgeDependencies ?? []);
    const internal = new Set();

    for (const field of allDependencyFields) {
      for (const [dependency, version] of Object.entries(
        manifest[field] ?? {},
      )) {
        if (
          isInternalPackageName(dependency, byName, policyNames) &&
          version !== "workspace:*"
        ) {
          errors.push(
            `${manifest.name} ${field}.${dependency} must use workspace:*, found ${version}.`,
          );
        }
      }
    }

    for (const field of dependencyFields) {
      for (const [dependency, version] of Object.entries(
        manifest[field] ?? {},
      )) {
        if (!isInternalPackageName(dependency, byName, policyNames)) continue;
        internal.add(dependency);

        const target = byName.get(dependency);
        if (!target) {
          errors.push(
            `${manifest.name} declares missing workspace package ${dependency}.`,
          );
        } else if (target.manifest.private) {
          errors.push(
            `${manifest.name} cannot depend on private workspace package ${dependency}.`,
          );
        }

        if (!allowed.has(dependency)) {
          errors.push(
            `${manifest.name} is not allowed to depend on ${dependency}; update the accepted architecture contract before changing this edge.`,
          );
        }
      }
    }

    graph.set(manifest.name, internal);
  }

  for (const cycle of findDependencyCycles(graph)) {
    errors.push(`Public package dependency cycle: ${cycle.join(" -> ")}.`);
  }

  return errors;
}

export function validateSourceContract({
  source,
  sourceFile,
  packageDir,
  manifest,
  packageManifests,
}) {
  const errors = [];
  const displayPath = relative(process.cwd(), sourceFile);
  const normalizedSourceFile = sourceFile.replaceAll("\\", "/");
  const isTestSource = /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/.test(
    normalizedSourceFile,
  );
  const declaredDependencies = new Set(
    (isTestSource ? allDependencyFields : dependencyFields).flatMap((field) =>
      Object.keys(manifest[field] ?? {}),
    ),
  );

  for (const marker of downstreamSourceMarkers) {
    if (marker.pattern.test(source)) {
      errors.push(`${displayPath} contains ${marker.label}.`);
    }
  }

  for (const specifier of sourceModuleSpecifiers(source, sourceFile)) {
    const forbidden = forbiddenImports.find((entry) =>
      entry.pattern.test(specifier),
    );
    if (forbidden) {
      errors.push(
        `${displayPath} imports forbidden ${forbidden.reason} dependency ${JSON.stringify(specifier)}.`,
      );
      continue;
    }

    if (specifier.startsWith(".")) {
      const target = resolve(dirname(sourceFile), specifier);
      if (!isInside(packageDir, target)) {
        errors.push(
          `${displayPath} crosses its package boundary through relative import ${JSON.stringify(specifier)}. Use a declared public package entry point.`,
        );
      }
      continue;
    }

    if (nodeBuiltins.has(specifier)) continue;

    const dependencyName = packageNameForSpecifier(specifier, packageManifests);
    if (!dependencyName) continue;

    if (dependencyName === manifest.name) {
      const exportKey = motionforgeExportKey(specifier, dependencyName);
      if (!Object.hasOwn(manifest.exports ?? {}, exportKey)) {
        errors.push(
          `${displayPath} imports non-public self entry point ${JSON.stringify(specifier)}; ${manifest.name} does not export ${JSON.stringify(exportKey)}.`,
        );
      }
      continue;
    }

    if (!declaredDependencies.has(dependencyName)) {
      errors.push(
        `${displayPath} imports undeclared runtime dependency ${JSON.stringify(specifier)}. Declare ${dependencyName} in an allowed dependency field.`,
      );
      continue;
    }

    const targetManifest = packageManifests.get(dependencyName);
    if (!targetManifest) continue;
    const exportKey = motionforgeExportKey(specifier, dependencyName);
    if (!Object.hasOwn(targetManifest.exports ?? {}, exportKey)) {
      errors.push(
        `${displayPath} imports non-public entry point ${JSON.stringify(specifier)}; ${dependencyName} does not export ${JSON.stringify(exportKey)}.`,
      );
    }
  }

  return errors;
}

function sourceModuleSpecifiers(source, sourceFile) {
  const scriptKind = /\.[jt]sx$/.test(sourceFile)
    ? ts.ScriptKind.TSX
    : /\.[cm]?js$/.test(sourceFile)
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const file = ts.createSourceFile(
    sourceFile,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const specifiers = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      specifiers.push(node.moduleReference.expression.text);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      specifiers.push(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return specifiers;
}

export function validateEntrypointBaseline(packages, baseline) {
  const errors = [];
  if (baseline?.schemaVersion !== 1 || !baseline.packages) {
    return ["docs/public-api-baseline.json must use schemaVersion 1."];
  }

  const publicPackages = packages.filter((entry) => !entry.manifest.private);
  const currentNames = new Set(
    publicPackages.map((entry) => entry.manifest.name),
  );
  const baselineNames = new Set(Object.keys(baseline.packages));

  for (const { manifest } of publicPackages) {
    const entry = baseline.packages[manifest.name];
    if (!entry) {
      errors.push(
        `${manifest.name} has no public API ownership baseline. Add one before publishing the package.`,
      );
      continue;
    }
    if (typeof entry.owner !== "string" || entry.owner.trim() === "") {
      errors.push(`${manifest.name} public API baseline has no owner.`);
    }
    if (!new Set(["stable", "advanced", "deprecated"]).has(entry.stability)) {
      errors.push(
        `${manifest.name} public API baseline has invalid stability ${JSON.stringify(entry.stability)}.`,
      );
    }

    const currentSurface = normalizePublicSurface(manifest);
    const recordedSurface = {
      exports: entry.exports ?? {},
      bin: entry.bin ?? null,
    };
    if (JSON.stringify(currentSurface) !== JSON.stringify(recordedSurface)) {
      errors.push(
        `${manifest.name} public entry points changed. Update docs/public-api-baseline.json and the deprecation/compatibility record deliberately.`,
      );
    }
  }

  for (const name of baselineNames) {
    if (!currentNames.has(name)) {
      errors.push(
        `${name} remains in docs/public-api-baseline.json but is not a current public package.`,
      );
    }
  }

  return errors;
}

export function normalizePublicSurface(manifest) {
  return {
    exports: structuredClone(manifest.exports ?? {}),
    bin: structuredClone(manifest.bin ?? null),
  };
}

function findDependencyCycles(graph) {
  const cycles = [];
  const visited = new Set();
  const active = [];
  const activeSet = new Set();

  const visit = (name) => {
    if (activeSet.has(name)) {
      const index = active.indexOf(name);
      cycles.push([...active.slice(index), name]);
      return;
    }
    if (visited.has(name)) return;
    visited.add(name);
    active.push(name);
    activeSet.add(name);
    for (const dependency of graph.get(name) ?? []) {
      if (graph.has(dependency)) visit(dependency);
    }
    active.pop();
    activeSet.delete(name);
  };

  for (const name of graph.keys()) visit(name);
  return cycles;
}

function packageNameForSpecifier(specifier, packageManifests) {
  return (
    Array.from(packageManifests.keys())
      .filter((name) => specifier === name || specifier.startsWith(`${name}/`))
      .sort((left, right) => right.length - left.length)[0] ??
    specifier.match(/^(@[^/]+\/[^/]+)/)?.[1] ??
    specifier.split("/")[0] ??
    null
  );
}

function motionforgeExportKey(specifier, packageName) {
  const suffix = specifier.slice(packageName.length);
  return suffix === "" ? "." : `.${suffix}`;
}

function isInside(parent, target) {
  const rel = relative(resolve(parent), resolve(target));
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..");
}

function isInternalPackageName(name, packageManifests, policyNames) {
  return (
    packageManifests.has(name) ||
    policyNames.has(name) ||
    name.startsWith("@motionforge/")
  );
}
