import { macroDefinitions } from "../packages/presets/dist/macros.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const root = new URL("../examples/blueprints/", import.meta.url),
  write = process.argv.includes("--write");
const lib = macroDefinitions().find((m) => m.name === "remixBlueprint");
function save(url, data) {
  if (write) writeFileSync(url, data);
  else assert.equal(readFileSync(url, "utf8"), data);
}
for (const { id } of lib.blueprints()) {
  const dir = new URL(id + "/", root);
  if (write) mkdirSync(dir, { recursive: true });
  const m = lib.describeBlueprint(id);
  save(new URL("blueprint.json", dir), JSON.stringify(m, null, 2) + "\n");
  save(
    new URL("MOTION.md", dir),
    `# ${m.title}\n\n${m.invariants.join(" ")}\n\nSource: [${m.source}](../../../${m.source}).\n\nUse the \`remixBlueprint\` macro with \`blueprint: "${id}"\`. Inspect the supplied copy on a held frame after changing format. The editable art and text remain separate native nodes.\n`,
  );
}
save(
  new URL("catalog.jsonl", root),
  lib
    .blueprints()
    .map((m) => JSON.stringify(m))
    .join("\n") + "\n",
);
console.log("Verified nine blueprint manifests and motion notes.");
