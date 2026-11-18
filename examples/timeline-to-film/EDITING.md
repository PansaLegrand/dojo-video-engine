# Open an editable copy

Start [Dojo Video Agent](https://github.com/PansaLegrand/dojo-video-agent)
locally using its `npm run launch` command. No model account is needed for
manual edits or export. Unzip this project, then run this command **from the
folder containing the two Scene JSON files** with Node 20.19 or newer:

```sh
node import.mjs both
```

Each line printed includes an `editorUrl`. Open either URL in desktop Chromium.
The importer creates two fresh independent projects. Use `cut-a` or `cut-b`
instead of `both` to import only one, or supply your running editor's local
origin, e.g. `node import.mjs cut-b http://127.0.0.1:4315`. Running the
importer again creates new copies and leaves your edits untouched.

- **Change the ending:** select the **Signature** timeline item, choose
  **closing-wordmark** under **Graphic layer**, then edit **Text**. Undo is
  available in the editor.
- **Inspect the transition:** select **Lower falls continuous**. This is a
  single native video item with animated position and size; the small image
  and the full-screen shot come from the same source clock. The side shots,
  playhead, type and ambience are separate editable layers.
- **Change the timing in source:** edit the handoff timing in `author.mjs`,
  run `node author.mjs` in this folder to regenerate the two Scenes, and import
  them as fresh projects. To keep edits to the JSON itself, skip regeneration.
- **Export:** click **Export video**. The browser renders the current project;
  no server-side renderer or paid provider is used.

The importer uses only the running loopback editor's project, source and
revision-checked command APIs. Each media file is hashed and copied into the
local editor's project storage. You can close and reopen the tab without
relinking it. Keep the ZIP as the portable source for other machines. Footage
credits and the typeface license are in `assets/`.
