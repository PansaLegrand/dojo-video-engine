# @motionforge/extensions

Versioned deterministic extension contracts for MotionForge Scene v1.

Extensions let trusted host applications add renderer capabilities while scene
documents remain JSON-only, validated, portable, and safe for agent editing.

```ts
import { z } from "zod";
import {
  createExtensionRegistry,
  defineExtension,
  extensionManifest,
  preflightExtensions,
} from "@motionforge/extensions";

const grid = defineExtension({
  name: "com.example.grid",
  version: "1.0.0",
  displayName: "Brand grid",
  description: "Draws a deterministic branded grid.",
  paramsSchema: z.object({ color: z.string(), columns: z.number().int() }),
  deterministic: true,
  workerCompatible: true,
  renderers: {
    canvas2d: { draw: () => undefined },
  },
});

const registry = createExtensionRegistry([grid]);
const manifest = extensionManifest(grid); // includes params JSON Schema
const result = preflightExtensions(scene, registry, {
  renderer: "canvas2d",
  worker: false,
});
```

The scene stores only `{name, version, params}`. Executable extension code is
installed by the host and never accepted from scene JSON.

See [RFC 0003](../../docs/rfcs/0003-extension-kernel.md) for versioning,
assets, lifecycle, security, and determinism rules.

## API stability

Stable for 1.x integrations:

- `defineExtension()` and `createExtensionRegistry()`.
- `extensionManifest()` and `registry.manifests()` for serializable capability
  discovery, including parameter JSON Schema.
- Exact-version resolution with explicit `compatibleVersions` aliases.
- `preflightExtensions()` and typed preflight issues.
- Asset discovery, resolution, per-frame preparation, disposal, and renderer
  adapter contracts.

Evolving additively in 1.x:

- Renderer adapter payload shapes are owned by each renderer package and may
  grow additively.
- Extension resource caching strategies live in renderers and may evolve while
  lifecycle ordering remains stable.

## License

MIT
