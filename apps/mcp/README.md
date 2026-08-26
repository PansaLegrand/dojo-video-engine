# MotionForge MCP adapter

Private reference adapter over the exact `createAgentWorkflowToolRegistry()`
descriptors and call envelopes. It adds no model/provider dependency and does
not redefine MotionForge tool schemas.

Build and run the newline-delimited JSON-RPC stdio host:

```sh
pnpm build
node apps/mcp/dist/stdio.js
# Equivalent convenience command with protocol-clean stdout:
pnpm --silent mcp
```

Do not configure a strict stdio client with plain `pnpm mcp`: pnpm lifecycle
banners share stdout unless `--silent` is supplied. Building only the private
MCP workspace from a fresh checkout is also insufficient until its public
workspace dependencies have been built; the root build establishes that order.

Supported methods are `initialize`, `ping`, `tools/list`, `tools/call`, and
`shutdown`; `notifications/initialized` is accepted without a response.
`tools/list` includes exact input schemas. It deliberately omits the repeated
universal workflow output schema to keep discovery bounded; every call still
returns that checked `{ ok, ... }` envelope, and JavaScript hosts can read it
once from `workflowToolDescriptors()`. The additional
`motionforge.workflow.evidence-manifests` discovery tool returns the supported
proof operations and their exact parameter schemas before an agent calls the
generic evidence tool.
`tools/call` returns the workflow envelope as both structured content and a
JSON text content item. Workflow failures set `isError: true` but remain exact
portable MotionForge envelopes. EOF and `shutdown` deterministically dispose
the session and all workspace/evidence resources.

The host is transport-neutral: embed `createMotionforgeMcpAdapter()` in another
JSON-RPC transport when stdio is not appropriate.
