# Kīlauea · a reference-guided editing study

[Watch the film](../../docs/assets/showcase/timeline-remix/kilauea.mp4) ·
[Editable scene](kilauea.json)

The brief: “Make an eight-second DojoClip film with these three Kīlauea
clips. Use Glide as the motion reference. Give the volcano footage its own
visual identity and end on DojoClip.”

The editor received the [Glide reference film](../../docs/assets/showcase/timeline-to-film/glide.mp4)
and a frame sheet. It could inspect the new footage but did not receive
Glide's scene JSON or authoring code. The wide caldera, fountain and spatter
are USGS camera recordings from two monitoring dates. The source clips are
silent. See [footage credits](assets/FOOTAGE.md) and the
[Archivo font license](assets/Archivo-OFL.txt).

## The cut

A charcoal board, cream lettering and three ember-colored accents replace the
paper and serif treatment of Yellowstone. Follow the central fountain: at
3.2 seconds its caption is still in view; by 3.6 the side shots have become
slivers; by about 4.1 the same plume fills the screen. The wordmark becomes
fully readable around 6.8 seconds and stays on the moving image.

The handoff is the strongest beat. The opening could make better use of the
playhead: the middle panel is already underlined while the cursor is still on
the first shot. A next cut could bring in the orange underline **when the
playhead reaches Fountain**, immediately before the push. The included MP4
retains the agent's first approved cut without that subsequent direction.

## How this trial worked

An independent Codex editor served as the model for Dojo's local `runAgent`
loop (local v14, kit 0.2.10), using a file relay. It could inspect the videos
externally and used JavaScript to serialize its native command arguments.
It listed the assets, inspected the graphics schema, read the motion-design
skill, inspected the project, then called `review_edit` five times and
`propose_edit` once. The four rejected reviews concerned item/node identity,
two text-box intersections, and a masthead moving off the canvas. The maker
repaired its draft. No reviewer edited the accepted command list.

The guarded apply matched the reviewed document hash; duplicate application
did not add another revision. Only after native review did the team assess
rendered pixels. The eight editable items produced a 240-frame, 1280×720
H.264 export on engine **1.2.3**. The editor import also preserved editability:
changing the closing wordmark, Undo, reload and a second full export passed.
The portable Scene includes the compiler's additional background layer.

This is one externally driven trial. It did not call Kie, run the commercial
worker, or measure how often a hosted model would make the same choices.

## Open your own copy

Start the local [Dojo Video Agent](https://github.com/PansaLegrand/dojo-video-agent)
editor. From the engine repository root:

```sh
node examples/timeline-to-film/import.mjs examples/timeline-remix/kilauea.json
```

Open the printed editor URL. The source files are copied into a fresh local
project. To render the scene directly from an engine checkout:

```sh
pnpm build
node examples/timeline-to-film/render.mjs --scene examples/timeline-remix/kilauea.json --out test-results/kilauea
```
