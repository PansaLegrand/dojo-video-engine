# RFC 0014 — Editable vector graphics and Three.js layers

- Status: bounded first implementation qualified locally; release acceptance pending
- Date: 2026-11-06
- Scope: public engine capabilities for Dojo Video Harness and DojoClip
- The design includes follow-up scope; see [implemented subset and evidence](../graphics-milestone-2026-11-06.md) for actual APIs.

## Direction and verified starting point

Support both SVG-derived editable 2D graphics and optional Three.js 3D layers.
Keep the existing composition, timeline, audio and export pipeline. A Three.js
scene renders a transparent frame into that composition. Users should be able
to revise the generated graphic on the same timeline as their footage.

The inspected source and consumer release records identify engine 1.1.5.

| Existing owner                         | Available foundation                                                                   | Remaining work                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `packages/schema/src/index.ts`         | Shapes, SVG path/viewBox geometry, JSON-only extension descriptors                     | General SVG import and bounded 3D schema               |
| `packages/authoring`                   | `shapeLayer`, `extensionLayer`, grouping and animation                                 | Vector importer/helpers and 3D authoring helpers       |
| `packages/renderer-canvas2d`           | Vector paints, clips/masks, SVG image decoding, extension composition                  | Three.js surface rendering and capability registration |
| `packages/extensions`                  | Exact versions, validation, asset discovery, prepare/dispose, opaque display contracts | First-party 3D extension and backend handler           |
| `packages/runtime`, `player`, `export` | Prepared resources and shared frame rendering                                          | GPU resource, seeking and encoded-output qualification |

An SVG image asset is not an editable vector tree. SVG path support is not a
general SVG XML/CSS/SMIL implementation. No Three.js integration was found in
the inspected engine packages. A static drawing demo does not establish reliable
animation, editing, random-access rendering or export.

## Architecture

```text
agent / code authoring / manual controls
    -> validated host ProjectDocument commands
    -> canonical editable graphics data
    -> derived engine Scene
         -> native vector nodes
         -> Three.js extension -> transparent render surface
    -> existing composition + audio -> preview / MP4 export
```

The engine owns graphics semantics, validation, evaluation, rendering, inspection
and export. Consumers own project history, edit targets, permissions, assets and
model orchestration. Executable model output and browser/GPU objects never become
Scene JSON.

Prefer optional `@dojo-video-engine/vector` and `@dojo-video-engine/three`
packages. The former compiles to native nodes; it does not duplicate their
renderer. The latter supplies a strict descriptor, trusted runtime and opaque
Canvas2D handler. Keep Three.js out of schema/core and ordinary 2D startup bundles.
Declare package dependency directions and follow synchronized release policy.

## Editable vectors and SVG import

First expose native shapes, arbitrary bounded paths and nested groups to agents.
Allow original illustrations rather than only presets. Stable IDs such as
`bird`, `beak`, `bike` and `front-wheel` let later instructions change parts.

Add a pure SVG importer returning native nodes, an original-ID mapping and
structured diagnostics. Initial candidates are viewBox, groups, paths, basic
shapes, fill/stroke/opacity, representable gradients/transforms, simple text with
explicit fonts and representable clipping. Publish an exact support table before
acceptance. Matrix/skew transforms, gradient coordinate systems, stroke
joins/dashes, nested viewports and text layout are not automatically equivalent
to Scene semantics. Normalize only when equivalence is established; otherwise
reject with useful diagnostics. Extend primitives based on actual fixture needs.
Do not silently omit visible markup or promise complete SVG compatibility.

Use a bounded XML parser, rejecting DTD/entities, scripts, event handlers,
`foreignObject`, external resources and active document features. Bound bytes,
depth, nodes, path commands, gradient stops and reference expansion. Supporting
local `use` requires cycle detection. The existing path-character check alone is
not a complete SVG/path grammar validator.

Drive animation through engine frame keyframes on stable nodes/groups. Do not
depend on the browser's CSS/SMIL clock. Importing animated SVG requires a compiler
for an explicitly admitted animation subset; unsupported animation must not
quietly become a static first frame. Keep static SVG image import as a separate
workflow that does not claim per-part editability.

## Three.js layer

Start with a general declarative scene, not a fixed catalog of templates:

- stable-ID groups/meshes and nested transforms;
- primitives plus bounded indexed geometry for original shapes;
- a selected perspective/orthographic camera with explicit units;
- bounded materials, colors, opacity, lights and declared image textures;
- object/camera/material keyframes and seeded procedural motion through a
  closed, versioned operation vocabulary.

Use ID maps for objects, geometry and materials. Validate references, acyclicity,
finite values and aggregate resource budgets. Do not deserialize arbitrary
Three.js JSON, loaders or userData. No dynamic module URLs or raw shaders enter
the declarative layer. A proposed descriptor is `dojo.three-scene@1.0.0` with
validated `objects`, `geometries`, `materials`, `cameraId`, `animation` and `seed`.
Publish complete executable examples only when its schema exists.

Stay within the engine's existing bounded JSON envelope. Current asset types do
not include GLB/glTF: large geometry or model import needs a separately reviewed
asset/ownership extension. Do not disguise models as images or fetch URLs from
parameters.

Use an exact opaque display capability. Standard display v1 has rect/text/image
operations, not 3D geometry. Keep prepared GPU surfaces outside JSON; composite
them in the resolved layer box with engine transforms, opacity, clipping, masks
and blend order. Objects inside a layer share camera/depth/lighting. Separate
3D timeline items compose in 2D; they do not share depth or cast shadows onto
footage automatically.

## Frame, resource and editing contract

Evaluate every frame from declared data and local time. No wall clock, accumulated
RAF deltas, unseeded randomness or hidden simulation state. Three.js
`AnimationMixer.setTime()` can seek admitted tracks; procedural motion must also
reconstruct state during backward, repeated and out-of-order seeks. Physics
would require a separate fixed-step replay/checkpoint design.

Consumers must define animation source offset/rate for trims/splits, or bake
equivalent keyframe changes. Moving changes placement; head trimming preserves
remaining animation phase; splitting preserves continuity; stretching/retiming
is explicit. Test against existing graphic behavior rather than changing it
incidentally. This may require coordinated command-kernel changes in both hosts.

Resolve assets before frame production and render at explicit dimensions. Pin
Three.js and color space, tone mapping, alpha, antialiasing, shadow and pixel-ratio
settings. Do not use devicePixelRatio implicitly for export. Qualify transparent
edges and color against the compositor. Consume/copy each GPU frame before a
later render overwrites its surface.

Preview/export need separate mutable instances or serialized leases. The ABI
allows concurrent revisions: never mark mutable scenes, mixers or renderers as
immutable reusable resources. Share only qualified immutable resources. Bound
aggregate GPU contexts, vertices, textures, active layers and render-target pixels
before allocation. Dispose resources on success, cancellation, partial failure,
replacement and teardown; test repeated edit/export cycles.

Start with explicitly declared main-thread WebGL2 support if necessary, with
cancellation between bounded frames. Worker/OffscreenCanvas support requires
separate qualification. Missing WebGL2, context loss, unsupported realms and
allocation failure must produce errors, never successful blank exports.

Determinism means repeatable frame semantics. Do not promise bit-identical GPU
pixels across devices. Pin a reference browser/GPU and declare cross-platform
tolerances before evaluating results.

## LLM-generated code

A coding agent can generate SVG or use authoring helpers to produce validated
scene data. These paths allow original compositions without evaluating model
JavaScript inside the editor. Do not equate declarative authoring with templates.

Raw Three.js/React/HTML code clips are a possible later mode. They require a
separate isolated-origin/process design: no ambient host/network credentials or
storage, a declared asset bridge, pinned dependencies, resource limits,
termination and deterministic frame/parameter messaging. A worker alone is not
that security boundary. Their editing promise would be exposed parameters and
source revisions, not automatic per-object editing of arbitrary code.

## Delivery and acceptance

| Stage | Deliverable                                 | Evidence                                                                                 |
| ----- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| V1    | Native vector authoring and stable part IDs | Original illustration; targeted edits; animated parts                                    |
| V2    | Bounded SVG importer                        | Fixture fidelity; unsupported/hostile input diagnostics; stable IDs                      |
| T1    | Optional Three.js extension                 | Original multi-object scene; camera movement; alpha over video; random-access frames     |
| H1    | Both consumers integrated                   | Capability discovery; edits; undo/reload; preview and decoded MP4                        |
| R1    | Release/adoption                            | Verified immutable packages; both consumer locks/provenance; commercial worker agreement |

T1 can use native fixtures while V2 is developed; it does not require a complete
SVG importer. H1 requires both layers in both consumers.

Share three acceptance scenes: an animated 2D cycling pelican with independent
wheels/legs; a simple 3D cycling pelican with camera orbit; and a product/logo
animation over speech footage, captions and audio. Primitive-based art can test
runtime mechanics; human review separately judges creative quality.

Test first/middle/last and shuffled/backward/repeated frames; move/trim/split/rate;
targeted corrections; undo/reload; concurrent preview/export; resolution changes;
decoded MP4 content and audio; cancellation, missing assets and resource limits.
Cover 1:1, 16:9 and 9:16. Measure startup, seek latency, frame cost, memory, GPU
resources and bundle impact on named hardware. Freeze numeric budgets before
acceptance; this proposal contains no measured performance result.

Run relevant schema/contracts/golden/resource/browser gates. Scripted tests prove
mechanics; bounded live-agent trials, retained failures and human review establish
creative reliability. One screenshot is insufficient for either release gate.

## Sources and contracts

- [Original SVG pelican experiment](https://simonwillison.net/2024/Oct/25/pelicans-on-a-bicycle/).
- [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html).
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).
- [Three.js SVGLoader](https://threejs.org/docs/pages/SVGLoader.html): a geometry bridge, not proof of full SVG fidelity.
- [SVG image-context behavior](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image).
- [Extension ABI and trust](../extension-abi.md); [portable Scene values](0010-portable-scene-values.md).

Sources checked 2026-11-06. Specific model comparisons from social posts are not
used as engineering evidence or acceptance criteria.
