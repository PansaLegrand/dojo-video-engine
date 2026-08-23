# @motionforge/renderer-canvas2d

Deterministic Canvas2D still-frame renderer for [motionforge](https://github.com/PansaLegrand/motionforge) scenes. The same renderer drives preview and export, so what you scrub is what you ship.

## Install

```sh
npm install @motionforge/renderer-canvas2d
```

## Usage

```ts
import { renderStill, resolveAssets } from "@motionforge/renderer-canvas2d";

const canvas = document.createElement("canvas");
canvas.width = scene.width;
canvas.height = scene.height;

// Asset loading is the only async phase: fetch + decode once per scene.
const assets = await resolveAssets(scene);

const context = canvas.getContext("2d");
renderStill(context, scene, /* frame */ 30, { assets });
```

Works with both `CanvasRenderingContext2D` and `OffscreenCanvasRenderingContext2D`.

Rendering is pure given `(scene, frame, assets)`: the same inputs always produce the same pixels. Scenes that draw `img` nodes throw an actionable error if assets were not resolved — a frame never renders with silently missing media. `img` nodes honor `objectFit` (`fill`, `contain`, `cover`, `none`, `scale-down`), `objectPosition`, and `borderRadius` clipping.

Font assets load through the same call and register under their asset id: declare `{ id: "Inter-Bold", type: "font", src: "..." }` and style text with `fontFamily: "Inter-Bold"`. Embed fonts whenever pixel-exact text matters; unregistered families fall back through the canvas font stack.

### Procedural and audio-reactive effects

`effect` nodes render deterministic procedural visuals without expanding a
scene into hundreds of particle nodes. General effects need no assets;
audio-reactive effects declare `params.audioAssetId`, and `resolveAssets()`
analyzes only the referenced audio into a compact cached spectrum.

Effects obey normal node layout, timing, transforms, opacity, filters,
z-index, parent clipping, and animations. Random-looking output is derived
from the node's bounded seed, never from `Math.random()`.

The pinned-browser `effect-showcase` golden fixture covers the six general
effects. Audio-spectrum math and all effect dispatch paths are unit-tested.

### Versioned extensions

Pass a trusted `ExtensionRegistry` with
`resolveAssets(scene, { extensions: registry })` for scenes containing
`extension` nodes. Resolution preflights identity, exact version, params,
assets, renderer support, and optional worker support before any extension
hook runs. `prepareFrame()` stages per-frame extension data, `renderStill()`
invokes the Canvas2D adapter, and `disposeAssets()` releases node resources.

Adapters receive resolved layout geometry and node-local time through
`Canvas2DExtensionDrawContext`. Scene JSON never carries a draw function.

### Visual primitives

`shape` nodes draw rectangles, ellipses, normalized polylines/polygons, and
SVG path data mapped through an explicit viewBox. Fill/stroke paint supports
solid, linear, circular-radial, and conic gradients. Closed geometry can clip
or alpha-mask any visual subtree; masks may be inverted, opacity-scaled, and
feathered. Per-corner radii and bounded blend modes use the same preview/export
Canvas state. `isolation` stages descendants for one group composite, and rich
text runs provide metric-stable inline paint.

### Runtime preflight

Call `preflightCanvas2D(scene, environment, { extensions, worker })` before
resolving assets when the host may run in browsers, workers, or server-like
environments. It combines declared scene features with Canvas,
image/video/audio decoder, font, current DOM-Lottie, and extension-registry
requirements and returns typed issues without fetching media.

### Bounded media resolution

`resolveAssets()` loads reachable assets only. HTTP audio/video uses bounded
range-backed sources; data/blob or explicit `buffer` sources remain blob-based.
Options select declared proxies, source/image/decoder budgets, and opt-in
waveform analysis. `estimateMediaResources()` reports reachable/declared assets,
proxy coverage, image decode estimates, and peak simultaneous video decoders.

## API Stability

Stable for 1.x integrations:

- `resolveAssets(scene, options)`, `prepareFrame(scene, frame, assets)`, `renderStill(context, scene, frame, options)`, and `disposeAssets(assets)`.
- `RenderOptions` and `ResolvedAssets` as the handoff shape between preview, export, and custom render loops.
- `videoSourceTime()` and `lottieSourceFrame()` for tools that need to mirror source-time labels.
- Deterministic `effect` node rendering and cached audio-spectrum analysis.
- `preflightCanvas2D()` plus `Canvas2DPreflightResult` for runtime, Path2D, DOMMatrix, and extension capability checks.
- `ResolveAssetsOptions`, `Canvas2DExtensionAdapter`, and `Canvas2DExtensionDrawContext` for trusted extension hosts.
- `MediaResourceBudget`, `estimateMediaResources()`, `collectReachableAssetIds()`, waveform/cache types, and resource usage reporting.
- `parseLinearGradient()`, `parseRadialGradient()`, `parseConicGradient()`, and `shapePointInBox()` for deterministic editor/renderer mirrors.

Evolving additively in 1.x:

- Concrete decoded clip shapes may gain additive metadata as streaming/pooling evolves; existing 1.x fields remain supported.
- `validateLottieDocument()` is public for preflight tools, but the rejection rules may tighten as Lottie support expands.

Internal/not public:

- Asset resolver internals, mediabunny sinks, and lottie-web player objects should not be manipulated directly unless you own the full render pipeline.
- Files outside the package root export are implementation details.

## License

MIT
