import {
  createAgentWorkflowToolRegistry,
  workflowEvidenceOperationManifests,
  type AgentWorkflowToolRegistry,
  type AgentWorkflowToolRegistryOptions,
} from "@motionforge/agent-tools";

const evidenceManifestTool = {
  name: "motionforge.workflow.evidence-manifests",
  description:
    "Discover supported evidence operations and their exact parameter schemas.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      ok: { const: true },
      manifests: { type: "array" },
    },
    required: ["ok", "manifests"],
    additionalProperties: false,
  },
} as const;

export type JsonRpcId = string | number | null;
export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};
export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | {
      jsonrpc: "2.0";
      id: JsonRpcId;
      error: { code: number; message: string; data?: unknown };
    };

export type MotionforgeMcpAdapterOptions = {
  registry?: AgentWorkflowToolRegistry;
  registryOptions?: AgentWorkflowToolRegistryOptions;
  disposeRegistry?: boolean;
};

export class MotionforgeMcpAdapter {
  readonly registry: AgentWorkflowToolRegistry;
  private readonly ownsRegistry: boolean;
  private disposed = false;
  private disposal?: Promise<void>;

  constructor(options: MotionforgeMcpAdapterOptions = {}) {
    if (options.registry && options.registryOptions) {
      throw new TypeError("Provide registry or registryOptions, not both.");
    }
    this.registry =
      options.registry ??
      createAgentWorkflowToolRegistry(options.registryOptions);
    this.ownsRegistry =
      options.disposeRegistry ?? options.registry === undefined;
  }

  async handle(input: unknown): Promise<JsonRpcResponse | null> {
    const request = readRequest(input);
    if (!request.ok) return request.response;
    const { id, method, params } = request.value;
    const notification = id === undefined;
    if (method === "notifications/initialized") return null;
    if (notification) return null;
    if (this.disposed && method !== "shutdown") {
      return rpcError(id, -32000, "MotionForge MCP session is disposed.");
    }
    try {
      switch (method) {
        case "initialize": {
          const value = plainRecord(params ?? {}, "initialize params");
          const protocolVersion =
            typeof value.protocolVersion === "string" &&
            value.protocolVersion.length <= 64
              ? value.protocolVersion
              : "2024-11-05";
          return rpcResult(id, {
            protocolVersion,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "motionforge", version: "1.1.0" },
          });
        }
        case "ping":
          return rpcResult(id, {});
        case "tools/list":
          return rpcResult(id, {
            tools: [
              ...this.registry
                .list()
                .map(({ name, description, inputSchema }) => ({
                  name,
                  description,
                  inputSchema,
                })),
              evidenceManifestTool,
            ],
          });
        case "tools/call": {
          const value = plainRecord(params, "tools/call params");
          if (typeof value.name !== "string" || value.name.length > 256) {
            return rpcError(
              id,
              -32602,
              "tools/call needs a bounded tool name.",
            );
          }
          let result;
          if (value.name === evidenceManifestTool.name) {
            const args = plainRecord(
              value.arguments ?? {},
              "evidence manifest arguments",
            );
            if (Object.keys(args).length > 0) {
              return rpcError(
                id,
                -32602,
                "Evidence discovery takes no arguments.",
              );
            }
            result = {
              ok: true as const,
              manifests: workflowEvidenceOperationManifests(),
            };
          } else {
            result = await this.registry.call(
              value.name,
              value.arguments ?? {},
            );
          }
          return rpcResult(id, {
            content: [{ type: "text", text: JSON.stringify(result) }],
            structuredContent: result,
            isError: !result.ok,
          });
        }
        case "shutdown":
          await this.dispose();
          return rpcResult(id, {});
        default:
          return rpcError(id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      return rpcError(
        id,
        error instanceof TypeError ? -32602 : -32603,
        error instanceof Error
          ? error.message.slice(0, 2_048)
          : "Internal error.",
      );
    }
  }

  dispose(): Promise<void> {
    this.disposal ??= (async () => {
      try {
        if (this.ownsRegistry) {
          const result = await this.registry.dispose();
          if (!result.ok) throw new Error(result.error.message);
        }
      } finally {
        this.disposed = true;
      }
    })();
    return this.disposal;
  }
}

export function createMotionforgeMcpAdapter(
  options?: MotionforgeMcpAdapterOptions,
): MotionforgeMcpAdapter {
  return new MotionforgeMcpAdapter(options);
}

export function jsonRpcParseError(message = "Parse error."): JsonRpcResponse {
  return rpcError(null, -32700, message);
}

function readRequest(
  input: unknown,
):
  | { ok: true; value: JsonRpcRequest }
  | { ok: false; response: JsonRpcResponse } {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    return { ok: false, response: rpcError(null, -32600, "Invalid Request.") };
  }
  const value = input as Record<string, unknown>;
  const id =
    value.id === undefined ||
    value.id === null ||
    typeof value.id === "string" ||
    (typeof value.id === "number" && Number.isSafeInteger(value.id))
      ? (value.id as JsonRpcId | undefined)
      : undefined;
  if (
    value.jsonrpc !== "2.0" ||
    typeof value.method !== "string" ||
    value.method.length < 1 ||
    value.method.length > 256 ||
    (value.id !== undefined && id === undefined)
  ) {
    return { ok: false, response: rpcError(null, -32600, "Invalid Request.") };
  }
  return {
    ok: true,
    value: {
      jsonrpc: "2.0",
      ...(id === undefined ? {} : { id }),
      method: value.method,
      ...(value.params === undefined ? {} : { params: value.params }),
    },
  };
}

function plainRecord(input: unknown, label: string): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    throw new TypeError(`${label} must be an object.`);
  }
  return input as Record<string, unknown>;
}

function rpcResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  };
}
