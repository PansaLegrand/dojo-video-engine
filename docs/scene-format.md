# Scene Format

The scene document is the stable contract between humans, framework adapters, agents, renderers, and exporters. Everything else in motionforge sits above or below this format.

A machine-readable JSON Schema for this format ships with the schema package at
[`packages/schema/scene.schema.json`](../packages/schema/scene.schema.json) and
is exported at runtime as `sceneJsonSchema()`. It covers canonical structure,
portable visual-value formats, and target-specific animation values. Register
`motionforgeJsonSchemaFormats` before compiling it; a validator must not ignore
unknown formats. Cross-field invariants listed below remain enforced by
`parseScene` / `validateScene`.

Scene v1 is canonical. `sceneSchema` accepts v1 only, while `parseScene()`,
`validateScene()`, and `migrateScene()` also accept valid legacy v0 documents
and normalize them to v1 without mutating the input. Unknown/future versions
fail loudly. The compatibility contract is defined in
[RFC 0002](rfcs/0002-scene-v1.md).

## Top level

```ts
type Scene = {
  schemaVersion: 1; // current format version, bumped on breaking changes
  width: number; // positive integer, pixels
  height: number; // positive integer, pixels
  fps: number; // positive integer, frames per second
  duration: number; // positive integer, total frames
  assets: Record<string, Asset>;
  markers?: Record<string, number>; // named in-range scene frames
  audioBuses?: Record<string, AudioBus>;
  nodes: SceneNode[];
};

type Asset = {
  id: string; // must equal its key in scene.assets
  type: "image" | "video" | "audio" | "font" | "lottie";
  src: string;
  sourceMode?: "auto" | "stream" | "buffer";
  proxy?: { src: string; width?: number; height?: number; bitrate?: number };
  metadata?: {
    duration?: number;
    width?: number;
    height?: number;
    byteLength?: number;
    codec?: string;
  };
};

type AudioBus = {
  gain?: number;
  pan?: number;
  limiter?: boolean;
  limiterCeiling?: number;
};
```

## Nodes

```ts
type SceneNode = {
  id: string; // unique across the whole scene
  type:
    | "div"
    | "text"
    | "img"
    | "video"
    | "audio"
    | "lottie"
    | "effect"
    | "extension"
    | "shape";
  text?: string; // required when type is "text"
  assetId?: string; // required for img, video, audio, and lottie nodes
  effect?: SceneEffectName; // required when type is "effect"
  params?: SceneEffectParams; // bounded effect parameters
  extension?: SceneExtensionDescriptor; // required when type is "extension"
  shape?: SceneShapeGeometry; // required when type is "shape"
  clip?: SceneShapeGeometry; // closed geometry; visual nodes only
  mask?: {
    shape: SceneShapeGeometry;
    inverted?: boolean;
    opacity?: number;
    feather?: number;
  };
  videoStartTime?: number; // video nodes only: source trim offset in seconds (default 0)
  playbackRate?: number; // video and lottie nodes: speed multiplier (default 1)
  audioStartTime?: number; // audio nodes only: source trim offset in seconds (default 0)
  volume?: number; // audio and video nodes: gain 0..1 (default 1)
  volumeEnvelope?: VolumeEnvelopePoint[]; // audio and video nodes: node-local gain automation
  audioBus?: string; // audio/video routing, default "master"
  pan?: number; // -1 left .. 1 right
  ducks?: {
    bus: string;
    gain: number;
    attackFrames?: number;
    releaseFrames?: number;
  };
  videoEndBehavior?: "hold" | "loop";
  loop?: boolean; // audio nodes only: repeat source through the node window
  from?: number; // start frame, relative to the parent (default 0)
  duration?: number; // frames the node is active (default: parent's duration)
  style?: SceneStyle; // curated CSS-like subset, see the matrix below
  animations?: SceneAnimation[];
  children?: SceneNode[];
};

type SceneExtensionDescriptor = {
  name: string; // stable namespaced identity
  version: string; // exact semantic version
  params: Record<string, JsonValue>; // data only; never functions or code
};

type SceneShapeGeometry =
  | { kind: "rect"; radius?: number | string }
  | { kind: "ellipse" }
  | { kind: "line"; points: [ShapePoint, ShapePoint] }
  | { kind: "polyline"; points: ShapePoint[] }
  | { kind: "polygon"; points: ShapePoint[] }
  | {
      kind: "path";
      d: string;
      viewBox: { x: number; y: number; width: number; height: number };
      fillRule?: "nonzero" | "evenodd";
    };

type ShapePoint = { x: number; y: number }; // normalized to the node box

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type VolumeEnvelopePoint = {
  frame: number; // node-local frame, strictly increasing
  value: number; // gain multiplier 0..1
  easing?: string; // same easing vocabulary as animation keyframes
};
```

### Video timing

A video node maps its node-local frame to a source timestamp in **seconds** (source footage has its own timebase, independent of scene fps):

```txt
sourceTime = videoStartTime + (localFrame / scene.fps) * playbackRate
```

The renderer draws the last source frame at or before that timestamp. When the scene outlasts the clip, the last frame holds. `videoStartTime` and `playbackRate` validate only on video nodes.

Video nodes with a soundtrack contribute it to the export: the clip's audio plays in the node's window at `volume` (default 1), optionally multiplied by `volumeEnvelope`, and trimmed by `videoStartTime` — picture and sound trim together. `playbackRate` retimes the sound like a varispeed deck (pitch shifts; there is no time-stretch). Silent clips contribute nothing. `audioStartTime` stays audio-only.

### Lottie

A `lottie` node draws a [Lottie](https://airbnb.io/lottie/) vector animation (a `lottie` asset: the animation's JSON document) with the same `objectFit`/`objectPosition` semantics as images and video. Frame mapping mirrors video and is frame-exact and deterministic:

```txt
lottieFrame = clamp((localFrame / scene.fps) * playbackRate * doc.fr, 0, doc.op - doc.ip - 1)
```

Scenes outlasting the animation hold its last frame. Two guards enforce the determinism contract at asset load: documents containing **expressions** (embedded JavaScript; may call `Date`/`random`) or **image layers / external images** are rejected with the reason — the current adapter renders self-contained vector documents only. Rendering lottie assets requires the optional peer dependency `lottie-web` (scenes without lottie assets never load it).

### Effects

An `effect` node is a bounded deterministic procedural layer. It uses normal
node timing, layout, transforms, opacity, filters, z-index, animation, parent
clipping, and selection semantics:

```json
{
  "id": "celebration",
  "type": "effect",
  "effect": "confettiBurst",
  "from": 60,
  "duration": 45,
  "style": {
    "position": "absolute",
    "inset": 0
  },
  "params": {
    "seed": 42,
    "intensity": "high",
    "colors": ["#facc15", "#38bdf8", "#fb7185"]
  }
}
```

General effects: `cartoonBurst`, `confettiBurst`, `cloudPop`, `speedLines`,
`neonAura`, and `scribbleCircle`.

Audio-reactive effects: `spectrumBars`, `cassetteVuMeter`, `waveformLine`,
`mirrorBars`, `circularSpectrum`, `neonWaveform`, `pulseRings`,
`particleGalaxy`, `albumCoverPulse`, `audioBlob`, `starfieldTunnel`,
`equalizerGrid`, `liquidGradient`, `kaleidoscope`, `vinylRecord`,
`audioTerrain`, `lightningArc`, and `minimalLineArt`. These require
`params.audioAssetId` referencing an audio asset. Asset resolution analyzes
only audio assets used by active effect definitions and caches a compact,
deterministic spectrum for preview and export.

To follow a trimmed or retimed clip, set `params.audioStartTime` to its source
offset in seconds and `params.audioPlaybackRate` to its positive playback rate
(at most 16). Both default to 0 seconds and 1 respectively. For example,
`{ "audioAssetId": "music", "audioStartTime": 10, "audioPlaybackRate": 2 }`
samples source second 11 at effect-local second 0.5. The effect's `from` moves
it on the composition without changing that mapping. Parent clipping is
respected. Analysis covers the required source window, with bounded FFT padding;
it does not decode the entire prefix before a late trim point. Multiple effects
on one asset share the union of their source windows. Their transient mono PCM
and retained spectrum must fit `maxAudioAnalysisCacheBytes`. Source times beyond
the file end yield a silent response. These controls retime the visualizer only;
the audible media node must carry its own matching trim/rate.

Effect parameters are intentionally bounded and schema-validated. Supported
controls include intensity, seed, colors, particle count, direction, density,
stroke/radius, wobble/pulse/scale/spread/softness/glow, text/frame scope,
audio and cover asset ids, bar count, sensitivity, and smoothing. Unknown
parameters fail validation rather than silently changing renderer behavior.

### Extensions

An `extension` node lets a trusted host add a renderer capability without
putting executable code in the scene:

```json
{
  "id": "brand-grid",
  "type": "extension",
  "extension": {
    "name": "com.example.brand-grid",
    "version": "1.0.0",
    "params": { "color": "#22d3ee", "columns": 8 }
  },
  "style": { "position": "absolute", "inset": 0 }
}
```

The descriptor contains JSON only. The application installs the matching
trusted definition in an `ExtensionRegistry` and passes it to preview/export.
The definition validates params, declares renderer and worker support, may
discover typed scene assets, resolves resources once, optionally prepares
node-local frame data, and draws through a renderer-owned adapter. Missing or
incompatible definitions fail during preflight; a renderer never silently
skips an extension node.

Exact versions preserve old scene pixels. A newer implementation may serve an
older descriptor only when it explicitly lists that exact version in
`compatibleVersions`. See [RFC 0003](rfcs/0003-extension-kernel.md) and the
[`@motionforge/extensions`](../packages/extensions) package.

### Shapes, clips, and masks

A `shape` node draws serializable vector geometry through the normal layout,
timing, animation, transform, filter, and z-index pipeline. Rectangles,
ellipses, normalized lines/polylines/polygons, and SVG path data with an
explicit viewBox are supported. Shape paint uses `fill`, `stroke`,
`strokeWidth`, `strokeLineCap`, `strokeLineJoin`, and `strokeDash`.

Point coordinates map against the laid-out box: `(0, 0)` is top-left and
`(1, 1)` is bottom-right. SVG path data accepts path commands and numbers, not
arbitrary SVG markup, URLs, or executable code.

Closed geometry may also appear as `clip` on any visual node. `mask` is an
opaque vector mask; `inverted: true` preserves the node box outside the mask,
while bounded `opacity` and `feather` enable soft alpha edges. Both apply
before background/content/border/descendant drawing. Open line/polyline
geometry is rejected for clipping and masking.

`blendMode` exposes a bounded Canvas compositing set. It is per-draw Canvas
compositing inherited by descendant draws, not an isolated CSS stacking group.
Set `isolation: true` to stage the subtree and apply opacity/blend once as a
group. Comma-separated `boxShadow` entries stage independent shadow layers.
See [RFC 0004](rfcs/0004-visual-primitives.md) for exact semantics and deferred
grayscale masks/group isolation.

### Audio

Audio nodes place sound on the timeline with the same `from`/`duration` frame semantics as every other node — they are not visual, so `style`, `children`, and `animations` are rejected on them. During export, every audible node is decoded, trimmed by `audioStartTime`, scaled by `volume`, multiplied by `volumeEnvelope` when present, optionally repeated with `loop: true`, and mixed (overlaps sum, the final mix clamps) into one stereo 48 kHz track muxed into the MP4. An audio node trimmed past the end of its clip contributes silence unless `loop` is true. Video nodes with their own soundtrack join this mix automatically (see the video section).

Audio/video nodes route to `audioBus` (`master` by default) and may pan or duck
another bus with frame-based attack/release. Bus gain/pan/limiting is applied
before the deterministic master peak limiter. Reverse video is visual-only and
must be muted; `videoEndBehavior` chooses freeze (`hold`) or source looping.

`volumeEnvelope` points are sampled in node-local frames, after ancestor clipping. A chunk that begins halfway through an audio node samples the envelope halfway through the node too, so fades and future ducking automation remain stable when nodes are trimmed by parent windows.

`loop` is audio-only. It wraps source playback after `audioStartTime` through the audio node's active window. The gain envelope does not restart on each wrap; it continues on the node-local timeline, which is usually what music beds and ambience need.

### Timing model

Time is measured in integer frames, never wall-clock seconds.

- A node is active for frames in `[from, from + duration)`, measured in its parent's local timeline. Outside that range the node and its entire subtree are not evaluated.
- Children run on a local clock: a child's `from` is relative to the frame its parent became active. A child with `from: 10` inside a parent with `from: 20` first appears at scene frame 30.
- `duration` defaults to the parent's duration (the scene's `duration` at the root).
- `evaluateScene(scene, frame)` clamps `frame` to `[0, scene.duration - 1]`.

### Length values

Style properties that take lengths accept:

- a number — device pixels (`64`)
- `"64px"` — same
- `"50%"` — relative to the parent dimension on that axis

## Style support matrix

Validation and renderer semantics are kept in lockstep: a Scene v1 style value
must not validate as a planned no-op. The matrix below is the source of truth
for what happens at each stage. **Validated** means the schema accepts it;
**Layout** means it affects box geometry; **Render** means it affects pixels.

| Property                                         | Validated | Layout | Render | Notes                                                                                                                                                                                       |
| ------------------------------------------------ | :-------: | :----: | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`, `height`                                |    ✅     |   ✅   |   —    | number, `px`, or `%`                                                                                                                                                                        |
| `aspectRatio`                                    |    ✅     |   ✅   |   —    | positive number or `width/height` string; derives an unspecified dimension                                                                                                                  |
| `safeArea`                                       |    ✅     |   ✅   |   —    | top/right/bottom/left insets constrain the node against its containing block                                                                                                                |
| `position`                                       |    ✅     |   ✅   |   —    | `relative` (default) or `absolute`                                                                                                                                                          |
| `left`, `top`, `right`, `bottom`                 |    ✅     |   ✅   |   —    | `right`/`bottom` only apply with `position: absolute`                                                                                                                                       |
| `inset`                                          |    ✅     |   ✅   |   —    | fallback for `left`/`top` and implied size                                                                                                                                                  |
| `padding`, `paddingTop/Right/Bottom/Left`        |    ✅     |   ✅   |   —    | per-side values override the shorthand                                                                                                                                                      |
| `display: "flex"`                                |    ✅     |   ✅   |   —    | the only non-default display                                                                                                                                                                |
| `flexDirection`                                  |    ✅     |   ✅   |   —    | `row` (default) or `column`                                                                                                                                                                 |
| `gap`                                            |    ✅     |   ✅   |   —    | main-axis gap between flex children                                                                                                                                                         |
| `justifyContent`                                 |    ✅     |   ✅   |   —    | `flex-start` (default), `center`, `flex-end`, `space-between` (distributes leftover space on top of `gap`)                                                                                  |
| `alignItems`                                     |    ✅     |   ✅   |   —    | `flex-start` (default), `center`, `flex-end`, `stretch` (fills the cross axis for children without an explicit size)                                                                        |
| `backgroundColor`                                |    ✅     |   —    |   ✅   | portable named/hex and legacy or modern space/slash `rgb()`/`rgba()`/`hsl()`/`hsla()` color                                                                                                 |
| `background`                                     |    ✅     |   —    |   ✅   | solid, linear, circular radial, or conic gradients; percentage stops/centers and degree angles                                                                                              |
| `fill`, `stroke`, `strokeWidth`, `stroke*`       |    ✅     |   —    |   ✅   | shape paint, line cap/join, and bounded dash arrays; fill/stroke accept supported gradients                                                                                                 |
| `borderRadius`, per-corner radius fields         |    ✅     |   —    |   ✅   | corner overrides apply to background, media, overflow, border, and rectangle shapes                                                                                                         |
| `overflow`                                       |    ✅     |   —    |   ✅   | `visible` (default) or `hidden` — clips the node's content and subtree to the border box, following `borderRadius`                                                                          |
| `opacity`                                        |    ✅     |   —    |   ✅   | `0`–`1`, multiplies down the subtree                                                                                                                                                        |
| `blendMode`                                      |    ✅     |   —    |   ✅   | bounded Canvas composite operations; inherited by descendant draw calls, without isolated-group semantics                                                                                   |
| `isolation`                                      |    ✅     |   —    |   ✅   | stages the subtree and applies node opacity/blend once to the group                                                                                                                         |
| `transform`                                      |    ✅     |   —    |   ✅   | `translate()`, `scale()`, `rotate()` lists; pivot via `transformOrigin`; keyframes with matching function sequences tween                                                                   |
| `fontSize`                                       |    ✅     |   ✅   |   ✅   | also drives intrinsic text size in flex layout                                                                                                                                              |
| `fontFamily`, `fontWeight`                       |    ✅     |   —    |   ✅   | bounded family lists and CSS keyword or numeric `1..1000` weights; font assets register under their asset id                                                                                |
| `color`                                          |    ✅     |   —    |   ✅   | text fill                                                                                                                                                                                   |
| `textAlign`                                      |    ✅     |   —    |   ✅   | `left` (default), `center`, `right`                                                                                                                                                         |
| `direction`                                      |    ✅     |   —    |   ✅   | explicit `ltr`, `rtl`, or inherited Canvas bidi direction                                                                                                                                   |
| `textShadow`                                     |    ✅     |   —    |   ✅   | single `x y blur color` shadow                                                                                                                                                              |
| `textStroke`                                     |    ✅     |   —    |   ✅   | single `<width> <color>` outline; width accepts number, `px`, or `%` of `fontSize`; stroke paints before fill                                                                               |
| `textBackgroundColor`                            |    ✅     |   —    |   ✅   | fitted per-line text background, measured after wrapping and before stroke/fill                                                                                                             |
| `textBackgroundPadding*`, `textBackgroundRadius` |    ✅     |   —    |   ✅   | `textBackgroundPadding`, `X`, `Y`, and radius accept number, `px`, or `%` of `fontSize`                                                                                                     |
| `fontStyle`                                      |    ✅     |   —    |   ✅   | `normal` (default) or `italic`                                                                                                                                                              |
| `lineHeight`                                     |    ✅     |   ✅   |   ✅   | unitless number = multiplier of `fontSize` (CSS semantics); `px`/`%` lengths also accepted; default `1.25`                                                                                  |
| `letterSpacing`                                  |    ✅     |   —    |   ✅   | number or `px`; preflight rejects Canvas runtimes without the `letterSpacing` API                                                                                                           |
| `margin`, `marginTop/Right/Bottom/Left`          |    ✅     |   ✅   |   —    | per-side values override the shorthand and participate in auto size/anchoring                                                                                                               |
| `minWidth`, `minHeight`, `maxWidth`, `maxHeight` |    ✅     |   ✅   |   —    | clamp the resolved size; `min` wins over `max` (CSS semantics)                                                                                                                              |
| `transformOrigin`                                |    ✅     |   —    |   ✅   | `left`/`center`/`right`, `top`/`center`/`bottom`, `px`, or `%` per axis; default center                                                                                                     |
| `objectFit`                                      |    ✅     |   —    |   ✅   | `fill` (default), `contain`, `cover`, `none`, `scale-down`; applies to `img` and `video` nodes                                                                                              |
| `objectPosition`                                 |    ✅     |   —    |   ✅   | keywords (`left`/`center`/`right`, `top`/`center`/`bottom`), `%` (CSS alignment semantics), or `px` per axis                                                                                |
| `border`                                         |    ✅     |   —    |   ✅   | `<width> [solid] <color>`; strokes inside the border box, follows `borderRadius`; only solid lines                                                                                          |
| `boxShadow`                                      |    ✅     |   —    |   ✅   | one or more comma-separated `<x> <y> [blur] <color>` shadows; no `inset`/spread                                                                                                             |
| `filter`                                         |    ✅     |   —    |   ✅   | chain of `brightness`/`contrast`/`saturate`/`grayscale`/`sepia`/`invert`/`opacity` (number or `%`), `hue-rotate(deg)`, `blur(px)`; preflight rejects Canvas runtimes without filter support |
| `zIndex`                                         |    ✅     |   —    |   ✅   | integer; reorders painting among siblings (ascending, document order ties); never affects layout                                                                                            |
| `maxLines`, `minFontSize`                        |    ✅     |   ✅   |   ✅   | bound text layout and the minimum size used by shrink fitting                                                                                                                               |
| `textFit`, `textOverflow`                        |    ✅     |   ✅   |   ✅   | `wrap`, `shrink`, or `truncate`; overflow may clip or append an ellipsis                                                                                                                    |
| `imageRendering`, `pixelSize`                    |    ✅     |   —    |   ✅   | normal or deliberately pixelated image/video/Lottie rendering with a bounded low-resolution staging size                                                                                    |

✅ implemented · — not applicable

### Text behavior

`text` nodes render multi-line:

- `runs` may replace `text` with inline color, opacity, stroke, and background
  spans. Run styling is deliberately metric-stable, so wrapping and intrinsic
  layout stay identical to the concatenated plain text.
- Explicit `\n` in `text` always starts a new line; consecutive `\n` produce empty lines.
- Words wrap when a line would exceed the node's box width, measured with the resolved font (including `letterSpacing`). Runs of whitespace collapse to single spaces, like HTML text.
- A single word wider than the box gets its own line and is horizontally condensed to fit rather than overflowing.
- Lines are spaced by `lineHeight` and the whole line block is centered vertically in the node's box. `textAlign` positions each line horizontally.
- **Auto height is intrinsic**: a text node without an explicit `height` is exactly as tall as its wrapped line count × `lineHeight`, measured with the same font metrics the renderer paints with. Top-anchored text starts at `top`; bottom-anchored text sits its own height above `bottom`. Only absolute nodes with _both_ `top` and `bottom` set take the inset-constrained height instead. Percent `fontSize` has no stable basis before the box exists — use absolute font sizes on auto-height text.

#### International text

- **Spaceless scripts wrap.** Chinese/Japanese (and any run without spaces, e.g. long URLs) break by grapheme cluster when a run exceeds the box width — emoji and combining marks are never split. Japanese kinsoku rules (no line-initial 。、) are not applied; a known simplification.
- **RTL and Arabic work via canvas text shaping**: cursive joining and right-to-left ordering are automatic per line, and Arabic wraps on its spaces. Use `textAlign: "right"` for RTL blocks. **Avoid `letterSpacing` on Arabic/cursive scripts** — spacing is applied between glyphs and breaks joining.
- Mixed-direction lines (Latin + Arabic in one string) follow the canvas bidi algorithm.
- **Fonts**: any script renders with system-font fallback out of the box; for deterministic cross-machine output, register a `font` asset covering the script (e.g. a Noto Sans SC/JP/KR or Noto Naskh woff2). CJK fonts are large — prefer subsetted files.
- `textStroke` uses a compact shorthand such as `"6px #000000"` or `"10% rgba(0,0,0,0.8)"`. Invalid or non-positive strokes are ignored rather than failing the render.
- `textBackgroundColor` draws one rounded fitted background per rendered line. `textBackgroundPadding` sets both axes; `textBackgroundPaddingX`/`textBackgroundPaddingY` override per axis; `textBackgroundRadius` rounds each line background. Backgrounds paint before `textStroke` and fill.
- Layout and render share one line-breaking implementation: the renderer passes its canvas measurement into layout, so intrinsic text boxes (auto height, flex sizing) wrap exactly like the painted text. Outside a renderer (plain-Node `layoutScene` without a `measureTextLine` option), a character-count heuristic stands in for real metrics.

Anything not in this table is rejected at validation time with an actionable message. Silent visual drift is treated as a bug; if you find a property behaving differently than this table says, file an issue.

## Assets and resolution

Asset loading is the engine's only asynchronous phase, and it is explicit:

```ts
import {
  prepareFrame,
  renderStill,
  resolveAssets,
} from "@motionforge/renderer-canvas2d";

const assets = await resolveAssets(scene); // fetches + decodes scene.assets
await prepareFrame(scene, frame, assets); // stages video frames (no-op without video)
renderStill(context, scene, frame, { assets }); // pure given (scene, frame, assets)
```

- `resolveAssets(scene)` fetches and decodes every `image` asset (data URLs and remote URLs alike) and loads every `font` asset. Call it once per scene, or whenever `scene.assets` changes; `exportVideo()` calls it internally when you don't pass `assets`.
- **Font assets register under their asset id**: an asset `{ id: "Inter-Bold", type: "font", src: "..." }` is referenced from styles as `fontFamily: "Inter-Bold"`. Faces register with default descriptors, so name assets per family+weight and reference them without `fontWeight` rather than relying on synthetic bolding. If a font asset is absent or fails to load, resolution rejects; text styled with an unregistered family silently falls back to the next family in the stack (standard canvas behavior), so embed fonts whenever pixel-exact text matters.
- **Video assets** open through mediabunny for frame-accurate decoding (no `<video>` element seeking). Because decoding is asynchronous and rendering is synchronous, video frames are staged per scene frame: `await prepareFrame(scene, frame, assets)` decodes what every active video node needs, then `renderStill` draws synchronously. `renderFrameSequence`/`exportVideo` call it automatically. Rendering a video node without a staged frame — or with one staged for a different scene frame — **throws**.
- Rendering a scene that draws an `img` node without resolved assets **throws** with the asset id and the fix — a frame never renders with silently missing media.
- A failed fetch or decode rejects with the asset id and src; there is no placeholder fallback by design.
- **Audio assets** open the same way (mediabunny decode); the export mixer pulls PCM from them. Player/Studio preview uses the same mixer path on a best-effort browser audio clock, while the exported file remains the source of truth for final audio.
- Await `disposeAssetsAsync(assets)` when done with a scene so cursors stop
  before video/audio Inputs close. `disposeAssets()` remains a best-effort void
  compatibility facade.
- Resolution is reachable-only. HTTP audio/video uses bounded range requests;
  proxy selection and source/image/decoder budgets are explicit host options.
  Optional waveform analysis streams into a bounded cached peak array.

## Animations

```ts
type SceneAnimation = {
  kind: "keyframes";
  property: SceneAnimationTarget; // a supported target, e.g. "opacity"
  frames: Array<{
    frame: number; // node-local frame, integer >= 0
    value: number | string;
    // "linear" | "easeIn" | "easeOut" | "easeInOut"
    // | "cubic-bezier(x1, y1, x2, y2)"  (x1, x2 in [0, 1])
    // | "spring" | "spring(bounce)"      (bounce in [0, 1); 0 = no overshoot)
    easing?: string;
  }>;
  repeat?: number | "infinite"; // additional cycles
  yoyo?: boolean; // alternate direction on repeated cycles
};
```

- Keyframe `frame` values are local to the node's own timeline (frame 0 = the node's `from`) and must be **strictly increasing** — validation rejects unsorted or duplicate frames.
- Targets are a schema enum, not arbitrary strings. Supported groups are
  numeric/length layout and typography properties; portable paint/color,
  border/shadow, transform, and filter properties; and `mask.opacity`,
  `mask.feather`, and rectangle `mask.radius`. Layout-mode/identity fields such
  as `display`, `position`, `objectFit`, asset IDs, and media trims are not
  animation targets. Use patches/commands for those edits.
- Every keyframe value is validated against its target before evaluation (for
  example, opacity requires `0..1`, transform requires a supported transform
  string, and colors use the portable color grammar).
- Numeric values interpolate; `easing` on a keyframe shapes the segment _arriving at_ that keyframe (quadratic ease curves).
- String values that both parse as portable colors (`#rgb`, `#rrggbb`, alpha
  hex, and legacy or modern `rgb()`/`rgba()`/`hsl()`/`hsla()`) interpolate
  per-channel in RGBA space, emitting `rgba(...)` strings. Named colors,
  gradients, and other strings step.
- **Transform strings tween** when both keyframes are `translate`/`scale`/`rotate` lists with matching function sequences and matching units per slot (`scale(1) → scale(1.4)`, `translate(0px, -40px) → translate(0px, 40px)`). Mismatched sequences or unit conflicts (e.g. `px` → `%`) step instead, like CSS.
- Matching filter chains interpolate numeric arguments; mismatched functions or units step.
- `spring` easings may overshoot past the target value mid-tween (that is the point); the final keyframe value is always exact.
- Other string values step: the value changes exactly at the next keyframe's frame.
- Before the first keyframe the first value holds; after the last keyframe the last value holds.
- `repeat` replays the track; `yoyo` reverses every alternate cycle. Infinite repeat remains bounded by node/scene duration.
- `mask.opacity`, `mask.feather`, and rectangle `mask.radius` animate mask data rather than style.
- The animated value overrides the node's static `style` value for that property at that frame.

## Validation invariants

Beyond per-field types, `parseScene` / `validateScene` enforce:

- Node `id`s are unique across the entire scene tree (they are the handle for patching and diffing).
- Marker names are bounded identifiers and marker frames lie inside scene duration.
- Every key in `scene.assets` equals that asset's `id`.
- `text` nodes require a `text` string.
- `img` and `video` nodes require an `assetId` pointing at `scene.assets`.
- `lottie` nodes require a Lottie asset; effect nodes require a supported
  effect name; extension nodes require a name, exact version, and JSON params;
  shape nodes require bounded geometry. Clips and masks must be closed.
- Audio-reactive effects require `params.audioAssetId`.
- Unknown properties are rejected at every canonical object layer (Scene, asset,
  node, style, animation/keyframe, envelope, geometry, extension descriptor,
  audio bus, and nested descriptors); canonical parsing never silently strips
  them.

`parseScene(input)` throws `SceneValidationError` (with structured `issues`); `validateScene(input)` returns `{ ok: true, scene }` or `{ ok: false, errors: string[] }` with messages like:

```txt
nodes.0.children.1.id: Duplicate node id "title". Node ids must be unique across the scene so tools can patch and diff nodes reliably.
nodes.0.style: Unsupported style property. MotionForge Scene v1 supports a curated CSS-like subset; move unsupported behavior into supported transforms, layout, or extension nodes.
```

For intentionally tolerant model/import boundaries, `repairSceneInput(input)`
works on a clone, removes only unknown keys, and returns one structured
`unknown_key_removed` diagnostic per removal. It does not coerce invalid values,
fill missing fields, accept future versions, mutate the input, or make a later
`parseScene(input)` call tolerant.

Host execution policy is separate from canonical validation:

```ts
const result = preflightScene(scene, {
  maxCanvasPixels: 3840 * 2160,
  maxNodes: 2_000,
  maxFrames: 18_000,
});
```

`preflightScene()` scans raw scene-like input iteratively under bounded
traversal, rejects non-tree object graphs, then returns the canonical Scene only
when both validation and the host's explicit pixel/dimension/frame/asset/node/
depth/path/shape/animation/keyframe limits pass. A whole-document value/depth
guard covers recursive extension parameters before Zod validation. These limits
do not change Scene v1 validity or portability. Host policy may tighten but
cannot raise the exported `sceneIngestionHardLimits` parser-safety ceilings;
strict parsing applies those ceilings before recursive Zod validation too.

## Complete example

A 4-second, 30 fps vertical scene: gradient background, centered title that fades in and out.

```json
{
  "schemaVersion": 1,
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "duration": 120,
  "assets": {},
  "nodes": [
    {
      "id": "background",
      "type": "div",
      "from": 0,
      "duration": 120,
      "style": {
        "width": "100%",
        "height": "100%",
        "background": "linear-gradient(180deg, #101820 0%, #244f46 100%)"
      },
      "children": []
    },
    {
      "id": "title-wrap",
      "type": "div",
      "from": 0,
      "duration": 120,
      "style": {
        "position": "absolute",
        "left": 64,
        "right": 64,
        "bottom": 160,
        "height": 180,
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center"
      },
      "children": [
        {
          "id": "title",
          "type": "text",
          "text": "Forge motion in the browser",
          "from": 0,
          "duration": 120,
          "style": {
            "fontFamily": "Inter, system-ui, sans-serif",
            "fontSize": 76,
            "fontWeight": 800,
            "color": "#ffffff",
            "textAlign": "center"
          },
          "animations": [
            {
              "kind": "keyframes",
              "property": "opacity",
              "frames": [
                { "frame": 0, "value": 0 },
                { "frame": 12, "value": 1, "easing": "easeOut" },
                { "frame": 100, "value": 1 },
                { "frame": 119, "value": 0, "easing": "easeIn" }
              ]
            }
          ],
          "children": []
        }
      ]
    }
  ]
}
```

## Versioning

`schemaVersion: 1` is the current canonical contract. `parseScene()`,
`validateScene()`, and `migrateScene()` accept valid legacy v0 documents and
normalize them to v1 without mutating the input. Breaking format changes bump
the version and ship with a documented deterministic migration. See
[RFC 0002](rfcs/0002-scene-v1.md).

### Prepared fonts and shaped rich captions

Font assets may declare `metadata.fontFamily`, `metadata.fontWeight`, and
`metadata.fontStyle`. Family defaults to the asset id; weight/style default to
`normal`. Use a fixed numeric weight (for example 700) or a variable range string
(for example `"100 900"`). Multiple asset ids can register fixed-weight faces
under one family. All faces referenced by a font-family fallback list are
prepared, and descriptor changes invalidate prepared-resource and raster caches.

Text padding constrains the glyph content box, wrapping, and intrinsic height.
Rich text paints complete shaped lines through style spans, preserving Arabic
joining and Latin ligatures across paint boundaries. Unicode visual ordering
comes from pinned `bidi-js` 1.0.3 (MIT; see `packages/core/THIRD_PARTY.md`), so
LTR word islands and numbers keep their order inside RTL captions. Explicit
`textStroke: "none"` disables an inherited rich-run outline; `textShadow: "none"`
disables a node text shadow.

Run `node scripts/verify-text-layout.mjs --variable-font /path/to/variable.woff2`
for the real-browser padding, Arabic/Latin shaping, mixed-direction DOM-range,
and variable-weight reference checks. Reports record source hashes and browser
version. Without `--variable-font`, font-weight checks are omitted explicitly.

`textFit: "shrink"` fits the complete wrapped text against width, height and
`maxLines` before returning a layout. It never uses a line-clipped prefix as
proof of fit. When `minFontSize` cannot satisfy the bounds, it throws
`TextFitError` (`TEXT_DOES_NOT_FIT`) with the failed constraints. Enlarge the
box, lower the minimum size or raise the line limit. Intentional word removal
requires `textFit: "truncate"`; its existing single-line/ellipsis behavior is
unchanged. `textOverflow: "ellipsis"` alone does not permit shrink to discard
caption words.

Active rich-text plates retain `textBackgroundPadding`, `textBackgroundPaddingX`,
`textBackgroundPaddingY` and `textBackgroundRadius`. A run with its own
`textBackgroundColor` inherits these paint controls from the text node and may
override them in its run style. They expand plate ink only, without changing
wrapping or glyph positions. Plate ink is included in isolated-layer bounds,
and all plates are painted before text so padded highlights do not cover
neighboring glyphs. Run `node scripts/verify-run-backgrounds.mjs` for real pixel
and decoded-export checks of padding, rounding, overrides and isolation.
