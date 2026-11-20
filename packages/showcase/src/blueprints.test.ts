import { describe, it, expect } from "vitest";
import { parseScene } from "@dojo-video-engine/schema";
import {
  compileDisplayList,
  layoutScene,
  evaluateScene,
} from "@dojo-video-engine/core";
import {
  macroDefinitions,
  expandMacroNodes,
} from "@dojo-video-engine/presets/macros";
const library = macroDefinitions().find((m) => m.name === "remixBlueprint")!;
describe("versioned MIT blueprint adaptations", () => {
  for (const b of library.blueprints!()) {
    it(
      "fits both " +
        b.title +
        " briefs across four project formats and frame rates",
      () => {
        const detail = library.describeBlueprint!(b.id);
        for (const [width, height, fps] of [
          [1280, 720, 30],
          [1920, 1080, 24],
          [720, 1280, 60],
          [720, 720, 25],
        ] as const)
          for (const slots of detail.adaptations) {
            const ctx = { width, height, fps, duration: fps * 8 };
            const result = expandMacroNodes(
              [
                {
                  macro: "remixBlueprint",
                  ...slots,
                  id: "remix",
                  from: fps,
                  duration: fps * 6,
                },
              ],
              ctx,
            );
            if (!result.ok) throw Error(result.errors.join());
            const scene = parseScene({
              schemaVersion: 1,
              ...ctx,
              nodes: result.nodes,
            });
            const root = scene.nodes[0]!;
            expect(root.from).toBe(fps);
            expect(root.duration).toBe(fps * 6);
            expect(
              compileDisplayList(layoutScene(evaluateScene(scene, 0))).groups
                .length,
            ).toBe(0);
            for (const f of [fps * 3, fps * 7 - 1]) {
              const display = compileDisplayList(
                layoutScene(evaluateScene(scene, f)),
              );
              const groups = display.groups.flatMap(
                function all(g): typeof display.groups {
                  return [g, ...g.children.flatMap(all)];
                },
              );
              const painted = groups
                .filter((g) => g.content?.kind === "text")
                .map((g) => g.node.text)
                .join("")
                .replace(/\s/g, "");
              expect(painted).toContain(slots.headline.replace(/\s/g, ""));
              for (const g of groups.filter(
                (g) => g.content?.kind === "text",
              )) {
                const r = g.transformedBounds;
                expect(r.x).toBeGreaterThanOrEqual(-1);
                expect(r.y).toBeGreaterThanOrEqual(-1);
                expect(r.x + r.width).toBeLessThanOrEqual(width + 1);
                expect(r.y + r.height).toBeLessThanOrEqual(height + 1);
              }
            }
          }
      },
    );
  }
});
