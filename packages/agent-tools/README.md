# @motionforge/agent-tools

Stable data and browser-media tools for agent-native MotionForge workflows.

```ts
import {
  checkScene,
  compileSceneCommands,
  createAgentToolRegistry,
  createSceneWorkspace,
  diffScenes,
  discoverCapabilities,
  inspectLayout,
  renderContactSheet,
} from "@motionforge/agent-tools";

const tools = createAgentToolRegistry();
const workspace = createSceneWorkspace(scene);
const compiled = compileSceneCommands(scene, commands);
const changes = diffScenes(before, after);
const capabilities = discoverCapabilities();
const layout = inspectLayout(scene, 45);
const check = checkScene(scene, { sampleCount: 5 });
const sheet = await renderContactSheet({ scene, frames: [0, 30, 60] });
```

The package exposes validation, migration, structural inspection, renderer-
neutral tree/timeline/layout inspection, hit testing, bounded composition
checks, typed command compilation/application, revisioned workspace helpers,
lint, patch, semantic diff, capability discovery, export
preflight/estimation, still rendering, contact sheets, and MP4 export. Tool
descriptors include strict bounded JSON Schema inputs for function-calling
agents, including required Scene fields and mutually exclusive sampling modes.
Semantic roles, protected safe-area roles, and allowed-overlap pairs are
accepted only when the host supplies them explicitly; tools never infer intent
from node IDs or text.

Executable extension code remains host-installed; discovery publishes only
manifests and bounded parameter schemas.

## API stability

Tool names, required inputs, direct function exports, and semantic diff paths
are stable for 1.x. Results and capability manifests may gain additive fields.

## License

MIT
