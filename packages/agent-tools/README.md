# @motionforge/agent-tools

Stable data and browser-media tools for agent-native MotionForge workflows.

```ts
import {
  createAgentToolRegistry,
  diffScenes,
  discoverCapabilities,
  renderContactSheet,
} from "@motionforge/agent-tools";

const tools = createAgentToolRegistry();
const changes = diffScenes(before, after);
const capabilities = discoverCapabilities();
const sheet = await renderContactSheet({ scene, frames: [0, 30, 60] });
```

The package exposes validation, migration, inspection, lint, patch, semantic
diff, capability discovery, export preflight/estimation, still rendering,
contact sheets, and MP4 export. Tool descriptors include JSON Schema inputs for
function-calling agents.

Executable extension code remains host-installed; discovery publishes only
manifests and bounded parameter schemas.

## License

MIT
