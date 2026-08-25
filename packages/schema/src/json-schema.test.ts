import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import {
  motionforgeJsonSchemaFormatNames,
  registerMotionforgeJsonSchemaFormats,
  sceneJsonSchema,
  sceneSchema,
} from "./index.js";

describe("generated Scene JSON Schema parity", () => {
  it("publishes and registers the portable-value format vocabulary", () => {
    const schema = sceneJsonSchema();
    expect(schema["x-motionforge-format-vocabulary"]).toEqual(
      motionforgeJsonSchemaFormatNames,
    );

    const registered: string[] = [];
    registerMotionforgeJsonSchemaFormats({
      addFormat(name) {
        registered.push(name);
      },
    });
    expect(registered).toEqual(motionforgeJsonSchemaFormatNames);
  });

  it("agrees with canonical Zod validation on shared value and animation cases", () => {
    const ajv = registerMotionforgeJsonSchemaFormats(
      new Ajv({ allErrors: true, strict: false }),
    );
    const validateJsonSchema = ajv.compile(sceneJsonSchema());

    const cases: Array<{
      name: string;
      valid: boolean;
      scene: Record<string, unknown>;
    }> = [
      {
        name: "portable visual values",
        valid: true,
        scene: sceneWith({
          style: {
            width: "50%",
            background:
              "linear-gradient(90deg, hsl(120, 100%, 50%) 0%, rgb(0 0 255 / 50%) 100%)",
            transform: "translate(10px, 20%) rotate(8deg) scale(1.1)",
            transformOrigin: "left 25%",
            objectPosition: "bottom right",
            filter: "brightness(110%) blur(2px)",
            border: "2px solid rgba(0, 0, 0, 0.5)",
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: "700",
            boxShadow: "0 2px 8px #0008",
            textShadow: "0 0 #000",
            textStroke: "1px white",
          },
        }),
      },
      {
        name: "restored scalar animation target",
        valid: true,
        scene: sceneWith({
          animations: [
            {
              kind: "keyframes",
              property: "objectFit",
              frames: [
                { frame: 0, value: "contain" },
                { frame: 10, value: "cover", easing: "easeInOut" },
              ],
            },
          ],
        }),
      },
      {
        name: "CSS Color 4 is outside Scene v1",
        valid: false,
        scene: sceneWith({ style: { color: "color(display-p3 1 0 0)" } }),
      },
      {
        name: "nonzero pixel gradient stops are not discarded",
        valid: false,
        scene: sceneWith({
          style: { background: "linear-gradient(red 1px, blue 100%)" },
        }),
      },
      {
        name: "unsupported transform function",
        valid: false,
        scene: sceneWith({ style: { transform: "skewX(10deg)" } }),
      },
      {
        name: "invalid transform origin",
        valid: false,
        scene: sceneWith({ style: { transformOrigin: "middle strange" } }),
      },
      {
        name: "invalid object position",
        valid: false,
        scene: sceneWith({ style: { objectPosition: "banana strange" } }),
      },
      {
        name: "unsupported length unit",
        valid: false,
        scene: sceneWith({ style: { width: "10rem" } }),
      },
      {
        name: "invalid font weight",
        valid: false,
        scene: sceneWith({ style: { fontWeight: "banana" } }),
      },
      {
        name: "invalid font family",
        valid: false,
        scene: sceneWith({ style: { fontFamily: "Arial; serif" } }),
      },
      {
        name: "zero aspect-ratio component",
        valid: false,
        scene: sceneWith({ style: { aspectRatio: "0/1" } }),
      },
      {
        name: "target-incompatible animation value",
        valid: false,
        scene: sceneWith({
          animations: [
            {
              kind: "keyframes",
              property: "opacity",
              frames: [{ frame: 0, value: "visible" }],
            },
          ],
        }),
      },
      {
        name: "target-incompatible scalar enum",
        valid: false,
        scene: sceneWith({
          animations: [
            {
              kind: "keyframes",
              property: "objectFit",
              frames: [{ frame: 0, value: "stretch-inside" }],
            },
          ],
        }),
      },
      {
        name: "unsupported easing",
        valid: false,
        scene: sceneWith({
          animations: [
            {
              kind: "keyframes",
              property: "opacity",
              frames: [{ frame: 0, value: 0, easing: "steps(2)" }],
            },
          ],
        }),
      },
    ];

    for (const fixture of cases) {
      const zodValid = sceneSchema.safeParse(fixture.scene).success;
      const jsonSchemaValid = validateJsonSchema(fixture.scene);
      expect(zodValid, `${fixture.name}: Zod`).toBe(fixture.valid);
      expect(
        jsonSchemaValid,
        `${fixture.name}: JSON Schema ${JSON.stringify(validateJsonSchema.errors)}`,
      ).toBe(fixture.valid);
    }
  });
});

function sceneWith(node: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: 1,
    width: 320,
    height: 180,
    fps: 30,
    duration: 30,
    assets: {},
    nodes: [{ id: "node", type: "div", ...node }],
  };
}
