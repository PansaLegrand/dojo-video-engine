import { z, type ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  extensionDescriptorSchema,
  parseScene,
  type Scene,
  type SceneAsset,
  type SceneExtensionDescriptor,
  type SceneNode,
} from "@motionforge/schema";

export type ExtensionSceneNode = SceneNode & {
  type: "extension";
  extension: SceneExtensionDescriptor;
};

export const extensionAssetRequirementSchema = z
  .object({
    assetId: z.string().min(1),
    type: z.enum(["image", "video", "audio", "font", "lottie"]).optional(),
    optional: z.boolean().default(false),
    purpose: z.string().min(1).max(160).optional(),
  })
  .strict();

export type ExtensionAssetRequirement = z.input<
  typeof extensionAssetRequirementSchema
>;
export type NormalizedExtensionAssetRequirement = z.output<
  typeof extensionAssetRequirementSchema
>;

export type ExtensionResolveContext<P> = {
  scene: Scene;
  node: ExtensionSceneNode;
  params: P;
  requirements: readonly NormalizedExtensionAssetRequirement[];
  assets: ReadonlyMap<string, SceneAsset>;
  signal?: AbortSignal;
};

export type ExtensionPrepareContext<P, ResolvedAssets> = {
  scene: Scene;
  node: ExtensionSceneNode;
  params: P;
  resolvedAssets: ResolvedAssets;
  frame: number;
  localFrame: number;
  signal?: AbortSignal;
};

// Definitions are registered heterogeneously, so hooks use the same
// intentional bivariance pattern as event-handler APIs. Runtime safety comes
// from paramsSchema validation before any hook is called.
type ExtensionHook<Context, Result> = {
  bivarianceHack(context: Context): Result;
}["bivarianceHack"];

export type MotionForgeExtensionDefinition<
  P,
  ResolvedAssets = undefined,
  PreparedFrame = undefined,
> = {
  name: string;
  version: string;
  displayName?: string;
  description?: string;
  compatibleVersions?: readonly string[];
  paramsSchema: ZodType<P>;
  deterministic: true;
  workerCompatible: boolean;
  renderers: Readonly<Record<string, unknown>>;
  assets?: ExtensionHook<
    { scene: Scene; node: ExtensionSceneNode; params: P },
    readonly ExtensionAssetRequirement[]
  >;
  resolveAssets?: ExtensionHook<
    ExtensionResolveContext<P>,
    ResolvedAssets | Promise<ResolvedAssets>
  >;
  prepareFrame?: ExtensionHook<
    ExtensionPrepareContext<P, ResolvedAssets>,
    PreparedFrame | Promise<PreparedFrame>
  >;
  disposeAssets?: ExtensionHook<ResolvedAssets, void | Promise<void>>;
};

export type RegisteredExtensionDefinition = MotionForgeExtensionDefinition<
  unknown,
  unknown,
  unknown
>;

export type ExtensionManifest = {
  name: string;
  version: string;
  displayName?: string;
  description?: string;
  compatibleVersions: string[];
  deterministic: true;
  workerCompatible: boolean;
  renderers: string[];
  paramsSchema: ReturnType<typeof zodToJsonSchema>;
};

/** Serializable metadata hosts and agents can use for capability discovery. */
export function extensionManifest<P, ResolvedAssets, PreparedFrame>(
  definition: MotionForgeExtensionDefinition<P, ResolvedAssets, PreparedFrame>,
): ExtensionManifest {
  return {
    name: definition.name,
    version: definition.version,
    ...(definition.displayName ? { displayName: definition.displayName } : {}),
    ...(definition.description ? { description: definition.description } : {}),
    compatibleVersions: [...(definition.compatibleVersions ?? [])],
    deterministic: true,
    workerCompatible: definition.workerCompatible,
    renderers: Object.keys(definition.renderers).sort(),
    paramsSchema: zodToJsonSchema(definition.paramsSchema, {
      target: "jsonSchema7",
      $refStrategy: "none",
    }),
  };
}

export function defineExtension<
  P,
  ResolvedAssets = undefined,
  PreparedFrame = undefined,
>(
  definition: MotionForgeExtensionDefinition<P, ResolvedAssets, PreparedFrame>,
): MotionForgeExtensionDefinition<P, ResolvedAssets, PreparedFrame> {
  const runtimeDefinition = asRegisteredDefinition(definition);
  const identity = extensionDescriptorSchema.safeParse({
    name: runtimeDefinition.name,
    version: runtimeDefinition.version,
    params: {},
  });
  if (!identity.success) {
    throw new Error(
      `Invalid extension identity: ${identity.error.issues
        .map((issue) => issue.message)
        .join("; ")}`,
    );
  }
  if (runtimeDefinition.deterministic !== true) {
    throw new Error(
      `Extension "${runtimeDefinition.name}" must be deterministic.`,
    );
  }
  if (Object.keys(runtimeDefinition.renderers).length === 0) {
    throw new Error(
      `Extension "${runtimeDefinition.name}" must declare at least one renderer adapter.`,
    );
  }
  if (
    runtimeDefinition.displayName !== undefined &&
    (typeof runtimeDefinition.displayName !== "string" ||
      runtimeDefinition.displayName.trim().length === 0 ||
      runtimeDefinition.displayName.length > 80)
  ) {
    throw new Error(
      `Extension "${runtimeDefinition.name}" displayName must be a non-empty string of at most 80 characters.`,
    );
  }
  if (
    runtimeDefinition.description !== undefined &&
    (typeof runtimeDefinition.description !== "string" ||
      runtimeDefinition.description.trim().length === 0 ||
      runtimeDefinition.description.length > 500)
  ) {
    throw new Error(
      `Extension "${runtimeDefinition.name}" description must be a non-empty string of at most 500 characters.`,
    );
  }

  if (
    runtimeDefinition.compatibleVersions !== undefined &&
    !Array.isArray(runtimeDefinition.compatibleVersions)
  ) {
    throw new Error(
      `Extension "${runtimeDefinition.name}" compatibleVersions must be an array.`,
    );
  }

  const compatible = new Set<string>();
  for (const version of runtimeDefinition.compatibleVersions ?? []) {
    const parsed = extensionDescriptorSchema.safeParse({
      name: runtimeDefinition.name,
      version,
      params: {},
    });
    if (!parsed.success) {
      throw new Error(
        `Extension "${runtimeDefinition.name}" has invalid compatible version ${JSON.stringify(version)}.`,
      );
    }
    if (version === runtimeDefinition.version || compatible.has(version)) {
      throw new Error(
        `Extension "${runtimeDefinition.name}" repeats compatible version ${JSON.stringify(version)}.`,
      );
    }
    compatible.add(version);
  }

  return definition;
}

export class ExtensionRegistry {
  readonly #definitions = new Map<string, RegisteredExtensionDefinition>();

  constructor(
    definitions: readonly MotionForgeExtensionDefinition<
      unknown,
      unknown,
      unknown
    >[] = [],
  ) {
    definitions.forEach((definition) =>
      this.register(asRegisteredDefinition(definition)),
    );
  }

  register<P, ResolvedAssets, PreparedFrame>(
    definition: MotionForgeExtensionDefinition<
      P,
      ResolvedAssets,
      PreparedFrame
    >,
  ): this {
    const checked = defineExtension(definition);
    const key = extensionKey(checked.name, checked.version);
    if (this.#definitions.has(key)) {
      throw new Error(`Extension ${key} is already registered.`);
    }
    this.#definitions.set(
      key,
      checked as unknown as RegisteredExtensionDefinition,
    );
    return this;
  }

  list(): RegisteredExtensionDefinition[] {
    return Array.from(this.#definitions.values()).sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        left.version.localeCompare(right.version),
    );
  }

  manifests(): ExtensionManifest[] {
    return this.list().map(extensionManifest);
  }

  versions(name: string): string[] {
    return this.list()
      .filter((definition) => definition.name === name)
      .map((definition) => definition.version);
  }

  resolve(
    name: string,
    requiredVersion: string,
  ): RegisteredExtensionDefinition | null {
    const exact = this.#definitions.get(extensionKey(name, requiredVersion));
    if (exact) return exact;

    const compatible = this.list().filter(
      (definition) =>
        definition.name === name &&
        definition.compatibleVersions?.includes(requiredVersion),
    );
    if (compatible.length > 1) {
      throw new Error(
        `Extension ${name}@${requiredVersion} is ambiguously provided by ${compatible
          .map((definition) => definition.version)
          .join(", ")}.`,
      );
    }
    return compatible[0] ?? null;
  }
}

export function createExtensionRegistry(
  definitions: readonly MotionForgeExtensionDefinition<
    unknown,
    unknown,
    unknown
  >[] = [],
): ExtensionRegistry {
  return new ExtensionRegistry(definitions);
}

function asRegisteredDefinition(value: unknown): RegisteredExtensionDefinition {
  if (typeof value !== "object" || value === null) {
    throw new Error("An extension definition must be an object.");
  }
  const candidate = value as Record<string, unknown>;
  const paramsSchema = candidate.paramsSchema as
    | { safeParse?: unknown }
    | undefined;
  if (
    typeof candidate.name !== "string" ||
    typeof candidate.version !== "string" ||
    typeof candidate.renderers !== "object" ||
    candidate.renderers === null ||
    typeof paramsSchema?.safeParse !== "function"
  ) {
    throw new Error(
      "An extension definition requires name, version, paramsSchema, and renderers.",
    );
  }
  return value as RegisteredExtensionDefinition;
}

export type ExtensionPreflightIssue = {
  severity: "error";
  code:
    | "extension_asset_invalid"
    | "extension_asset_missing"
    | "extension_asset_type_mismatch"
    | "extension_not_installed"
    | "extension_params_invalid"
    | "extension_renderer_unsupported"
    | "extension_version_incompatible"
    | "extension_worker_unsupported";
  nodeId: string;
  extensionName: string;
  message: string;
};

export type ResolvedExtensionNode = {
  node: ExtensionSceneNode;
  definition: RegisteredExtensionDefinition;
  params: unknown;
  requirements: NormalizedExtensionAssetRequirement[];
  rendererAdapter: unknown;
};

export type ExtensionPreflightResult = {
  ok: boolean;
  nodes: ResolvedExtensionNode[];
  issues: ExtensionPreflightIssue[];
};

export function preflightExtensions(
  sceneInput: unknown,
  registry: ExtensionRegistry,
  options: { renderer: string; worker?: boolean },
): ExtensionPreflightResult {
  const scene = parseScene(sceneInput);
  const issues: ExtensionPreflightIssue[] = [];
  const nodes: ResolvedExtensionNode[] = [];
  const visit = (items: Scene["nodes"]): void => {
    for (const node of items) {
      if (node.type === "extension" && node.extension) {
        const extensionNode = node as ExtensionSceneNode;
        preflightNode(scene, extensionNode, registry, options, nodes, issues);
      }
      visit(node.children ?? []);
    }
  };
  visit(scene.nodes);
  return { ok: issues.length === 0, nodes, issues };
}

function preflightNode(
  scene: Scene,
  node: ExtensionSceneNode,
  registry: ExtensionRegistry,
  options: { renderer: string; worker?: boolean },
  resolvedNodes: ResolvedExtensionNode[],
  issues: ExtensionPreflightIssue[],
): void {
  const descriptor = node.extension;
  let definition: RegisteredExtensionDefinition | null;
  try {
    definition = registry.resolve(descriptor.name, descriptor.version);
  } catch (error) {
    issues.push(
      issue(
        node,
        "extension_version_incompatible",
        error instanceof Error ? error.message : String(error),
      ),
    );
    return;
  }

  if (!definition) {
    const installedVersions = registry.versions(descriptor.name);
    issues.push(
      issue(
        node,
        installedVersions.length === 0
          ? "extension_not_installed"
          : "extension_version_incompatible",
        installedVersions.length === 0
          ? `Extension ${descriptor.name}@${descriptor.version} is not installed.`
          : `Extension ${descriptor.name}@${descriptor.version} is incompatible with installed version(s): ${installedVersions.join(", ")}.`,
      ),
    );
    return;
  }

  const parsedParams = definition.paramsSchema.safeParse(descriptor.params);
  if (!parsedParams.success) {
    issues.push(
      issue(
        node,
        "extension_params_invalid",
        `Extension ${descriptor.name}@${descriptor.version} params are invalid: ${parsedParams.error.issues
          .map(
            (entry) => `${entry.path.join(".") || "params"}: ${entry.message}`,
          )
          .join("; ")}`,
      ),
    );
    return;
  }

  const rendererAdapter = definition.renderers[options.renderer];
  if (!rendererAdapter) {
    issues.push(
      issue(
        node,
        "extension_renderer_unsupported",
        `Extension ${descriptor.name}@${definition.version} does not support renderer ${JSON.stringify(options.renderer)}.`,
      ),
    );
    return;
  }
  if (options.worker && !definition.workerCompatible) {
    issues.push(
      issue(
        node,
        "extension_worker_unsupported",
        `Extension ${descriptor.name}@${definition.version} cannot run in a worker.`,
      ),
    );
    return;
  }

  let requirements: NormalizedExtensionAssetRequirement[] = [];
  try {
    const rawRequirements =
      definition.assets?.({
        scene,
        node,
        params: parsedParams.data,
      }) ?? [];
    const parsedRequirements = z
      .array(extensionAssetRequirementSchema)
      .safeParse(rawRequirements);
    if (!parsedRequirements.success) {
      issues.push(
        issue(
          node,
          "extension_asset_invalid",
          `Extension ${descriptor.name}@${definition.version} returned invalid asset requirements: ${parsedRequirements.error.issues
            .map((entry) => entry.message)
            .join("; ")}`,
        ),
      );
      return;
    }
    requirements = parsedRequirements.data;
  } catch (error) {
    issues.push(
      issue(
        node,
        "extension_asset_invalid",
        `Extension ${descriptor.name}@${definition.version} asset discovery failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return;
  }

  for (const requirement of requirements) {
    const asset = scene.assets[requirement.assetId];
    if (!asset && !requirement.optional) {
      issues.push(
        issue(
          node,
          "extension_asset_missing",
          `Extension ${descriptor.name}@${definition.version} requires missing asset "${requirement.assetId}"${requirement.purpose ? ` for ${requirement.purpose}` : ""}.`,
        ),
      );
      continue;
    }
    if (asset && requirement.type && asset.type !== requirement.type) {
      issues.push(
        issue(
          node,
          "extension_asset_type_mismatch",
          `Extension ${descriptor.name}@${definition.version} requires asset "${requirement.assetId}" to be ${requirement.type}, but it is ${asset.type}.`,
        ),
      );
    }
  }
  if (issues.some((entry) => entry.nodeId === node.id)) return;

  resolvedNodes.push({
    node,
    definition,
    params: parsedParams.data,
    requirements,
    rendererAdapter,
  });
}

function issue(
  node: ExtensionSceneNode,
  code: ExtensionPreflightIssue["code"],
  message: string,
): ExtensionPreflightIssue {
  return {
    severity: "error",
    code,
    nodeId: node.id,
    extensionName: node.extension.name,
    message,
  };
}

export function extensionKey(name: string, version: string): string {
  return `${name}@${version}`;
}
