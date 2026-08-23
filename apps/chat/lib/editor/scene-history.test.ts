import { describe, expect, it } from "vitest";
import type { Scene } from "@motionforge/schema";
import {
  createSceneHistory,
  recordSceneHistory,
  redoSceneHistory,
  undoSceneHistory,
} from "./scene-history";

function scene(id: string): Scene {
  return {
    schemaVersion: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 60,
    assets: {},
    nodes: [
      {
        id,
        type: "text",
        text: id,
      },
    ],
  };
}

describe("scene history", () => {
  it("records current scenes and clears redo history", () => {
    const first = scene("first");
    const second = scene("second");
    const history = {
      past: [first],
      future: [second],
    };

    expect(recordSceneHistory(history, second)).toEqual({
      past: [first, second],
      future: [],
    });
  });

  it("undoes and redoes around the current scene", () => {
    const first = scene("first");
    const second = scene("second");
    const third = scene("third");
    const history = {
      past: [first, second],
      future: [],
    };

    const undone = undoSceneHistory(third, history);

    expect(undone).toEqual({
      changed: true,
      scene: second,
      history: {
        past: [first],
        future: [third],
      },
    });

    if (!undone.changed) {
      return;
    }

    expect(redoSceneHistory(undone.scene, undone.history)).toEqual({
      changed: true,
      scene: third,
      history: {
        past: [first, second],
        future: [],
      },
    });
  });

  it("does nothing without a scene or available history", () => {
    expect(undoSceneHistory(scene("current"), createSceneHistory())).toEqual({
      changed: false,
    });
    expect(redoSceneHistory(scene("current"), createSceneHistory())).toEqual({
      changed: false,
    });
    expect(undoSceneHistory(null, { past: [scene("old")], future: [] })).toEqual(
      { changed: false },
    );
  });

  it("caps recorded past entries", () => {
    const entries = [scene("one"), scene("two"), scene("three")];
    const history = entries.reduce(
      (current, entry) => recordSceneHistory(current, entry, 2),
      createSceneHistory(),
    );

    expect(history.past.map((item) => item.nodes[0]?.id)).toEqual([
      "two",
      "three",
    ]);
  });
});
