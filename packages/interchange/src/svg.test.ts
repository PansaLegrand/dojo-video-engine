import { describe, expect, it } from "vitest";
import { importSvgGraphic } from "./svg.js";
const options = { id: "drawing", duration: 150 };
const wrap = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">${body}</svg>`;
describe("editable SVG import", () => {
  it("keeps nested groups, inherited paint and part identities as native nodes", () => {
    const result = importSvgGraphic(
      wrap(
        '<g id="bike" fill="red" transform="translate(10,20)"><circle id="wheel" cx="50" cy="60" r="20"/><path d="M 0 0 L 30 0 L 15 20 Z"/></g>',
      ),
      options,
    );
    expect(result.node.type).toBe("div");
    expect(result.ids).toEqual({
      bike: "drawing:svg:id:bike",
      wheel: "drawing:svg:id:wheel",
    });
    const group = result.node.children?.[0];
    expect(group?.style?.transform).toBe("translate(10px,20px)");
    expect(group?.children?.[0]?.style?.fill).toBe("red");
    expect(result).toEqual(
      importSvgGraphic(
        wrap(
          '<g id="bike" fill="red" transform="translate(10,20)"><circle id="wheel" cx="50" cy="60" r="20"/><path d="M 0 0 L 30 0 L 15 20 Z"/></g>',
        ),
        options,
      ),
    );
  });
  it("supports numeric paths, shapes and rotated groups without executing markup", () => {
    const result = importSvgGraphic(
      wrap(
        '<g transform="rotate(90 10 20)"><path d="M1e1 -2 L 30 5z"/><rect width="20" height="10"/><line x2="20" y2="10"/><ellipse rx="10" ry="5"/><polygon points="0,0 20,0 0,20"/><polyline points="0,0 20,20"/></g>',
      ),
      options,
    );
    expect(result.node.children?.[0]?.children).toHaveLength(6);
  });
  it.each([
    "<script>alert(1)</script>",
    "<foreignObject/>",
    '<image href="https://example.com/a.png"/>',
    '<path d="M0 0 L5"/>',
    '<path d="M0 0 A1 1 0 3 0 10 10"/>',
    '<rect width="10" height="10" onclick="x"/>',
    '<rect width="10" height="10" style="fill:red"/>',
    '<g transform="matrix(1 0 0 1 0 0)"/>',
    '<use href="#a"/>',
    "<animate/>",
    "<defs/>",
    '<g id="a"/><g id="a"/>',
    '<path d="M0 0L2 2" fill="url(https://example.com)"/>',
    "<text>Hello</text>",
    '<g opacity="2"/>',
    '<path d="M0 0" stroke-width="-1"/>',
  ])("rejects unsupported or invalid content %#", (body) => {
    expect(() => importSvgGraphic(wrap(body), options)).toThrow();
  });
  it("rejects entities, malformed XML, nesting and byte overflows", () => {
    expect(() =>
      importSvgGraphic('<!DOCTYPE svg [<!ENTITY x "y">]>' + wrap(""), options),
    ).toThrow(/DTD/);
    expect(() => importSvgGraphic(wrap("<g>"), options)).toThrow();
    expect(() =>
      importSvgGraphic(wrap("<g>".repeat(30) + "</g>".repeat(30)), options),
    ).toThrow(/nesting/);
    expect(() => importSvgGraphic(" ".repeat(128001), options)).toThrow(
      /128KB/,
    );
    expect(() =>
      importSvgGraphic('<svg viewBox="10 20 100 100"/>', options),
    ).toThrow(/0 0/);
  });
});

it("retains named part IDs when anonymous decoration is inserted before them", () => {
  const before = importSvgGraphic(wrap('<circle id="wheel" r="10"/>'), options);
  const after = importSvgGraphic(
    wrap('<rect width="2" height="2"/><circle id="wheel" r="10"/>'),
    options,
  );
  expect(before.ids.wheel).toBe(after.ids.wheel);
});
