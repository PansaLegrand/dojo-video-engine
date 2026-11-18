# Yellowstone · the timeline becomes the film

Two hand-authored eight-second cuts for DojoClip. Three National Park Service
shots settle onto a timeline. As the playhead reaches Lower Falls, the view
pushes into that clip until only the film remains. The waterfall never cuts
away or restarts. Its location sound rises as the picture opens.

| Cut       | Full-size preview                                                   | Handoff                                                                                     |
| --------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A · Snap  | [Play Snap](../../docs/assets/showcase/timeline-to-film/snap.mp4)   | Frame 79 to 97: a quick 0.60-second push, followed by a longer hold on the falls.           |
| B · Glide | [Play Glide](../../docs/assets/showcase/timeline-to-film/glide.mp4) | Frame 79 to 126: a 1.57-second move that lets the eye follow the playhead into the picture. |

Both exports are 1280×720 at 30 fps with H.264 video and AAC audio. The
wordmark settles at the same moment in both versions. The shots, typography,
color and closing hold are shared; the camera curve, move length and
corresponding sound fade differ.

## Make a revision

Follow [Open an editable copy](EDITING.md) to bring either cut into the local
Dojo Video Agent editor. Both [cut A](cut-a.json) and [cut B](cut-b.json) are
native scenes. Select a text layer to change its copy, or edit the
two timing definitions in [author.mjs](author.mjs) and regenerate the scenes.

From the engine checkout with its development dependencies and Chromium installed:

```sh
pnpm build
node examples/timeline-to-film/author.mjs
node examples/timeline-to-film/render.mjs
```

The renderer also accepts `--packages /path/to/node_modules` for an existing
installation of the engine packages. This pair was exported using the published
1.2.3 engine. Output files, stream checks and frame sheets are written under
`test-results/timeline-to-film/`. The concept does not require a model,
network media, or an unpublished renderer feature.

## Credits

Footage and location sound: **National Park Service, Yellowstone National Park**.
See [sources and excerpt times](assets/FOOTAGE.md). The editable closing
wordmark uses the same Archivo family, 800 weight and tracking as the product
header. The bundled Latin font is distributed under the [SIL Open Font
License](assets/Archivo-OFL.txt); the DojoClip name identifies the product.
