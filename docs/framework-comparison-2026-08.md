# Dojo Video Engine, Remotion, and HyperFrames — equivalent-task comparison

Date reviewed: 2026-08-26

This is a source-backed architectural comparison, not a claim that one
framework wins every video task. The projects optimize for different authored
artifacts.

Primary sources reviewed:

- Remotion client rendering and `renderMediaOnWeb()`:
  <https://www.remotion.dev/docs/client-side-rendering> and
  <https://www.remotion.dev/docs/web-renderer/render-media-on-web>
- Remotion's current web renderer implementation:
  <https://github.com/remotion-dev/remotion/blob/main/packages/web-renderer/src/render-media-on-web.tsx>
- HyperFrames introduction, deterministic rendering, and CLI:
  <https://hyperframes.app/docs/1-startup/1-introduction>,
  <https://hyperframes.app/docs/2-concepts/4-determinism>, and
  <https://hyperframes.video/docs/workflow/cli-reference>
- HyperFrames open-source repository:
  <https://github.com/heygen-com/hyperframes>

## Corrected premise

Browser rendering is not a unique Dojo Video Engine advantage. Remotion now exposes
a client-side WebCodecs renderer with browser capability checks, progress,
audio/video/container options, cancellation, browser filesystem or in-memory
output, and an experimental native HTML-in-Canvas path. HyperFrames previews
in the browser but its documented production renderer seeks an HTML page in
headless Chrome through `beginFrame` and encodes with FFmpeg.

Dojo Video Engine's differentiator is therefore narrower and more defensible:

> a strict portable video document plus typed reversible editing, computed
> inspection, prepared browser runtime, proof artifacts, and in-browser export
> that do not require executing author-provided React/HTML/JavaScript.

## Artifact and trust model

| Dimension            | Dojo Video Engine                                                                 | Remotion                                                                     | HyperFrames                                                      |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Primary artifact     | Strict Scene v1 JSON/data                                                   | React/TypeScript composition                                                 | HTML/CSS/data attributes plus optional JavaScript/frame adapters |
| Layout power         | Curated Canvas styles plus opt-in semantic stack/grid compiler              | React and the browser layout/platform                                        | Browser HTML/CSS layout/platform                                 |
| Executable authoring | No executable code in Scene                                                 | Yes, trusted React/JS application                                            | Yes, trusted HTML/JS; examples use GSAP and scripts              |
| Mutation model       | 19 typed flat commands → canonical patch; exact inverse/undo                | Source-code edits and application state                                      | Source HTML/code edits and CLI/Studio state                      |
| Agent observation    | Flat handle reads/search, geometry/audio checks, proof refs                 | Coding agent reads source/build/runtime output                               | Coding agent reads HTML plus JSON CLI/lint/inspect output        |
| Browser export       | Canvas runtime + WebCodecs/Mediabunny                                       | `@remotion/web-renderer` + WebCodecs/Mediabunny                              | Documented production path is Chrome capture + FFmpeg            |
| Determinism boundary | Scene/frame/display-list/runtime contracts; pinned browser for exact pixels | Composition/frame and renderer contracts; arbitrary app code remains trusted | Seekable frame adapter + pinned Chrome/FFmpeg/Docker recommended |

Remotion and HyperFrames intentionally expose far more of the web platform.
They are better choices when arbitrary DOM layout, React components, shaders,
or existing web animation libraries are the core requirement. Dojo Video Engine is
better suited to an untrusted or heavily validated editor where every stored
operation must be inspectable, reversible, bounded, and renderable without
executing generated code.

## Equivalent tasks

### 1. Compose video, title, and music

- **Remotion:** write a React composition using media components and normal
  component/CSS layout; render through server/browser tooling.
- **HyperFrames:** write timed `<video>`, text, and `<audio>` elements with
  `data-start`, `data-duration`, and track attributes; animate through a
  seekable adapter such as GSAP.
- **Dojo Video Engine:** register three assets/nodes through `asset.set` and flat
  node commands or author Scene data directly; audio/video placement and gain
  remain canonical fields.

Dojo Video Engine uses more explicit data. The other two offer more layout/animation
freedom.

### 2. User moves a title in the UI, then asks an agent to enlarge it

- **Code-first frameworks:** the host/coding agent must reconcile source,
  editor state, and the current preview convention.
- **Dojo Video Engine:** the host loads the latest UI Scene under a project
  epoch/revision; the agent reads the exact title, commits `resize.set` or
  `style.set`, and a stale response cannot overwrite a newer UI revision.

This is Dojo Video Engine's strongest equivalent-task advantage: one mutation
contract is shared by manual UI, scripts, and agents.

### 3. Inspect a 120-node composition and repair a hidden media clip

- **Remotion:** a coding agent searches source and uses application-specific
  diagnostics/tests.
- **HyperFrames:** an agent searches HTML and can use CLI `lint`, `inspect`,
  stable exit codes, and JSON output.
- **Dojo Video Engine:** the initial flat read is bounded; an `observe` decision uses
  exact node read/search, then commands, `check`, and proof evidence operate at
  one revision without returning the Scene.

HyperFrames' agent-friendly CLI is a close analogue. Dojo Video Engine adds a safe
in-process edit transaction and artifact references; HyperFrames gives the
agent the expressiveness and familiarity of HTML.

### 4. Prove a visual edit without returning native browser objects

- **Remotion/HyperFrames:** hosts can render frames/screenshots and construct
  their own comparison harnesses.
- **Dojo Video Engine:** proof frames are selected from changes/cuts/keyframes/text,
  then prepared before/after runtimes emit scoped still/visual-diff/contact
  references through a transactional sink. Canvas and bytes remain host-only.

This is a packaged Dojo Video Engine workflow, not an assertion that its visual
judgment is stronger. It detects/communicates changed pixels; it does not
understand aesthetics or media meaning.

## Interoperability boundary

Dojo Video Engine does not attempt to import arbitrary React or executable HTML.
That would execute an untrusted program and cannot preserve semantics in Scene
v1. The 1.1 interchange package instead provides:

- a versioned common flat timeline bridge with explicit loss reports;
- a Remotion host descriptor that lets trusted React code consume a Scene or
  evaluated frame without pretending to translate arbitrary components;
- a sanitized static HTML snapshot bridge limited to explicit boxes, text,
  and images, rejecting scripts, events, dynamic layout, and unknown CSS.

## Conclusion

Continue the Canvas2D + JSON path, but do not market it as “browser rendering
that Remotion cannot do.” Market the complete safe-edit loop:

```text
strict data → reversible command → spatial/audio check
            → prepared browser proof → browser/worker export
```

Use Remotion or HyperFrames interoperability when trusted code/web layout is
the right authoring environment. Dojo Video Engine shines when the video must remain
a portable, non-executable, agent-and-editor-owned document.
