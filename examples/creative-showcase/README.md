# Motion worth making

Nine studies with different subjects, formats and motion languages. Every film
is 12 seconds at 30 fps. Eight are landscape (1280 × 720); Type in Motion is portrait
(720 × 1280). Native text, vector shapes and 3D geometry stay editable. No external
media, model calls or API keys are required.

[![Six creative directions](../../docs/assets/showcase/gallery.gif)](../../docs/assets/showcase/gallery.mp4)

## New studies

[![Three new studies](../../docs/assets/showcase/showoff.gif)](../../docs/assets/showcase/showoff.mp4)

### Little Worlds — Miniature worlds

[![Little Worlds](../../docs/assets/showcase/city-card.png)](../../docs/assets/showcase/city.mp4)

A detailed floating city with staggered building assembly, warm windows, moving cars, a small park and an orbiting camera.

[Watch MP4](../../docs/assets/showcase/city.mp4) · [Authoring source](city.mjs) · [Scene JSON](city.json)

### Precision / P–01 — Exploded assembly

[![Precision / P–01](../../docs/assets/showcase/precision-card.png)](../../docs/assets/showcase/precision.mp4)

A mechanical timepiece separates into four layers, revealing independently moving gears, then reassembles. Native technical labels identify the components.

[Watch MP4](../../docs/assets/showcase/precision.mp4) · [Authoring source](precision.mjs) · [Scene JSON](precision.json)

### Chroma Bloom — Kinetic vector art

[![Chroma Bloom](../../docs/assets/showcase/bloom-card.png)](../../docs/assets/showcase/bloom.mp4)

Sixty gradient-filled bezier petals unfold in overlapping waves, with counter-rotating shapes and fine contour details.

[Watch MP4](../../docs/assets/showcase/bloom.mp4) · [Authoring source](bloom.mjs) · [Scene JSON](bloom.json)

## Night Train — Illustrated story

[![Night Train](../../docs/assets/showcase/journey-card.png)](../../docs/assets/showcase/journey.mp4)

Moonlit mountains, a moving train, an arched viaduct and seven layers of parallax. Adapt it for travel, storytelling or an illustrated announcement.

[Watch MP4](../../docs/assets/showcase/journey.mp4) · [Authoring source](journey.mjs) · [Scene JSON](journey.json)

## Field Notes — Data and reports

[![Field Notes](../../docs/assets/showcase/data-story-card.png)](../../docs/assets/showcase/data-story.mp4)

An editorial annual report with growing charts, animated counters and a flowing ideas-to-launches diagram. All figures are explicitly illustrative.

[Watch MP4](../../docs/assets/showcase/data-story.mp4) · [Authoring source](data-story.mjs) · [Scene JSON](data-story.json)

## Type in Motion — Portrait motion poster

[![Type in Motion](../../docs/assets/showcase/kinetic-card.png)](../../docs/assets/showcase/kinetic.mp4)

Giant letterforms, diagonal moving bands, checkerboards and sharp graphic cuts in a 720 × 1280 portrait composition. Adapt it for social posts or event promotion.

[Watch MP4](../../docs/assets/showcase/kinetic.mp4) · [Authoring source](kinetic.mjs) · [Scene JSON](kinetic.json)

## Deep Field — Cinematic titles

[![Deep Field](../../docs/assets/showcase/cinema-card.png)](../../docs/assets/showcase/cinema.mp4)

A full-frame journey through a rotating architectural light tunnel, with restrained serif titles and a widescreen composition.

[Watch MP4](../../docs/assets/showcase/cinema.mp4) · [Authoring source](cinema.mjs) · [Scene JSON](cinema.json)

## After Hours — Festive 3D

[![After Hours](../../docs/assets/showcase/festival-card.png)](../../docs/assets/showcase/festival.mp4)

A tiled disco sculpture, orbiting rings, floating confetti and three typography chapters. Adapt it for a celebration or team event.

[Watch MP4](../../docs/assets/showcase/festival.mp4) · [Authoring source](festival.mjs) · [Scene JSON](festival.json)

## Orbit — Company launch

[![Orbit](../../docs/assets/showcase/company-card.png)](../../docs/assets/showcase/company.mp4)

A fictional company launch in ivory, ink and cobalt. Sculptural 3D forms accompany a story about ideas, collaboration and a shared direction.

[Watch MP4](../../docs/assets/showcase/company.mp4) · [Authoring source](company.mjs) · [Scene JSON](company.json)

## Render and customize

From the engine repository root, after installing its locked dependencies:

```sh
corepack pnpm build
corepack pnpm --filter @dojo-video-engine/golden exec playwright install chromium
node examples/creative-showcase/render.mjs
```

The renderer uses the existing tool dependencies, Chromium, FFmpeg and ffprobe.
It writes Scene JSON beside the authors, render reports under
`docs/reports/showcase/`, MP4/GIF/PNG files
under `docs/assets/showcase/`, and review frames under ignored
`test-results/creative-showcase/`. It checks Scene/Three.js limits, exports via
the browser engine, counts every decoded video frame and fully decodes each MP4.
The GIFs are smaller 640 × 360, 12 fps previews of those actual exports.
Portrait previews are letterboxed; their MP4s retain the original portrait format.

After rendering all scenes, build the category cards and 12-second README reel:

```sh
node examples/creative-showcase/gallery.mjs            # approved six-category reel
node examples/creative-showcase/gallery.mjs --studies  # newer three-study reel
```

This optional gallery assembly uses FFmpeg with `drawtext` support. It takes
two-second excerpts for the approved reel and four-second excerpts for the newer
studies, from the actual exports; the individual films are rendered
by the engine.

For a quick visual iteration or one film:

```sh
node examples/creative-showcase/render.mjs festival --stills
node examples/creative-showcase/render.mjs company
```

Change copy, colors, timing and the 3D object hierarchy directly in the `.mjs`
author, then render again. Animation uses explicit frame/second keyframes. The
files are serializable scenes; no executable code is embedded in the Scene JSON.

To edit on a timeline, use the matching
[local harness examples](https://github.com/PansaLegrand/dojo-video-harness/tree/main/examples/creative-showcase).
They import these scenes as editable projects through the normal command API.

## Evidence and scope

These are code-authored creative examples, not a benchmark of a chat agent
generating the designs. All films are silent. ORBIT is a fictional brand and Field Notes uses illustrative
data; all
graphics are original procedural geometry under this repository's MIT license.
No stock footage, external models, textures or third-party artwork is used.
System sans-serif fonts can render differently across platforms.

The committed render reports record the Scene hash, engine/browser version,
sampled preview frames and independently decoded output dimensions/count. They
qualify these nine examples. Three.js needs WebGL2; MP4 export needs compatible
WebCodecs. Rendering resources use the existing engine 1.2.3 limits and geometry.

The root README uses one GitHub-hosted MP4 attachment of the approved six-category
reel. [The video receipt](../../docs/reports/showcase/readme-video.json) binds its stable attachment URL to the local file hash.
The newer studies remain separately available here.
