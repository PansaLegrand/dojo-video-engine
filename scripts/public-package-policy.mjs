/**
 * Current 1.0 package dependency contract. Target post-1.0 packages are added
 * here only when their milestone creates the package and its public boundary.
 */
export const publicPackagePolicy = {
  "@dojo-video-engine/three": {
    owner: "Bounded declarative Three.js layers and optional GPU runtime",
    allowedDojoVideoEngineDependencies: [
      "@dojo-video-engine/schema",
      "@dojo-video-engine/extensions",
      "@dojo-video-engine/renderer-canvas2d",
    ],
  },
  "@dojo-video-engine/agent-tools": {
    owner: "Framework-neutral agent tool adapters",
    allowedDojoVideoEngineDependencies: [
      "@dojo-video-engine/commands",
      "@dojo-video-engine/export",
      "@dojo-video-engine/inspection",
      "@dojo-video-engine/extensions",
      "@dojo-video-engine/presets",
      "@dojo-video-engine/renderer-canvas2d",
      "@dojo-video-engine/schema",
    ],
  },
  "@dojo-video-engine/authoring": {
    owner: "Programmer-facing Scene authoring compilers",
    allowedDojoVideoEngineDependencies: [
      "@dojo-video-engine/core",
      "@dojo-video-engine/presets",
      "@dojo-video-engine/schema",
    ],
  },
  "@dojo-video-engine/cli": {
    owner: "Headless command-line validation and inspection",
    allowedDojoVideoEngineDependencies: [
      "@dojo-video-engine/agent-tools",
      "@dojo-video-engine/export",
      "@dojo-video-engine/inspection",
      "@dojo-video-engine/player",
      "@dojo-video-engine/presets",
      "@dojo-video-engine/schema",
    ],
  },
  "@dojo-video-engine/commands": {
    owner: "Typed Scene commands and revisioned in-memory workspaces",
    allowedDojoVideoEngineDependencies: [
      "@dojo-video-engine/presets",
      "@dojo-video-engine/schema",
    ],
  },
  "@dojo-video-engine/core": {
    owner: "Deterministic evaluation and layout",
    allowedDojoVideoEngineDependencies: ["@dojo-video-engine/schema"],
  },
  "@dojo-video-engine/create": {
    owner: "Starter project generation",
    allowedDojoVideoEngineDependencies: [],
  },
  "@dojo-video-engine/export": {
    owner: "Frame, audio, encoder, muxer, stream, and worker orchestration",
    allowedDojoVideoEngineDependencies: [
      "@dojo-video-engine/core",
      "@dojo-video-engine/renderer-canvas2d",
      "@dojo-video-engine/schema",
    ],
  },
  "@dojo-video-engine/extensions": {
    owner: "Trusted versioned extension contracts",
    allowedDojoVideoEngineDependencies: ["@dojo-video-engine/schema"],
  },
  "@dojo-video-engine/inspection": {
    owner:
      "Renderer-neutral tree, timeline, layout, hit-test, and composition diagnostics",
    allowedDojoVideoEngineDependencies: [
      "@dojo-video-engine/core",
      "@dojo-video-engine/schema",
    ],
  },
  "@dojo-video-engine/interchange": {
    owner: "Bounded timeline and trusted-host interchange bridges",
    allowedDojoVideoEngineDependencies: ["@dojo-video-engine/schema"],
  },
  "@dojo-video-engine/layout": {
    owner: "Bounded semantic layout authoring and Scene v1 compilation",
    allowedDojoVideoEngineDependencies: [
      "@dojo-video-engine/core",
      "@dojo-video-engine/schema",
    ],
  },
  "@dojo-video-engine/player": {
    owner: "Real-time preview and audio-synchronized playback",
    allowedDojoVideoEngineDependencies: [
      "@dojo-video-engine/export",
      "@dojo-video-engine/renderer-canvas2d",
      "@dojo-video-engine/schema",
    ],
  },
  "@dojo-video-engine/presets": {
    owner: "Pure preset, macro, intent, and choreography compilers",
    allowedDojoVideoEngineDependencies: ["@dojo-video-engine/schema"],
  },
  "@dojo-video-engine/renderer-canvas2d": {
    owner: "Canvas2D reference renderer and browser-media preparation",
    allowedDojoVideoEngineDependencies: [
      "@dojo-video-engine/core",
      "@dojo-video-engine/extensions",
      "@dojo-video-engine/runtime",
      "@dojo-video-engine/schema",
    ],
  },
  "@dojo-video-engine/runtime": {
    owner:
      "Prepared Scene sessions, backend lifecycle, events, and artifact sinks",
    allowedDojoVideoEngineDependencies: [
      "@dojo-video-engine/core",
      "@dojo-video-engine/extensions",
      "@dojo-video-engine/inspection",
      "@dojo-video-engine/schema",
    ],
  },
  "@dojo-video-engine/schema": {
    owner: "Canonical Scene documents, migration, validation, and patches",
    allowedDojoVideoEngineDependencies: [],
  },
};

/** One source of truth for release/clean-install package coverage. */
export const publicPackageDirectories = Object.keys(publicPackagePolicy)
  .map((name) =>
    name === "@dojo-video-engine/create"
      ? "packages/create-dojo-video-engine"
      : `packages/${name.slice("@dojo-video-engine/".length)}`,
  )
  .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
