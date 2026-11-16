import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { placeRuleBox, GAP } from "../../model/ruleBoxPlacement";

const EPS = 1e-9;
const int = (min: number, max: number) => fc.integer({ min, max });

const scene = fc
  .record({
    width: int(200, 2000),
    height: int(200, 1200),
  })
  .chain((lb) =>
    fc.record({
      lightbox: fc.constant({ left: 0, top: 0, ...lb }),
      center: fc.record({ x: int(0, lb.width), y: int(0, lb.height) }),
      box: fc.record({ width: int(10, lb.width - 1), height: int(10, lb.height - 1) }),
    }),
  );

describe("placeRuleBox", () => {
  it("Property 8: rule box placement stays inside the lightbox and joins the bone", () => {
    // Feature: visual-polish, Property 8: Rule box placement stays inside the lightbox and joins the bone
    // Validates: Requirements 11.2, 11.5
    fc.assert(
      fc.property(scene, ({ lightbox, center, box }) => {
        const p = placeRuleBox(lightbox, center, box);
        expect(p.left).toBeGreaterThanOrEqual(0);
        expect(p.top).toBeGreaterThanOrEqual(0);
        expect(p.left + box.width).toBeLessThanOrEqual(lightbox.width + EPS);
        expect(p.top + box.height).toBeLessThanOrEqual(lightbox.height + EPS);

        const freeLeft = center.x;
        const freeRight = lightbox.width - center.x;
        const need = box.width + GAP;
        const preferred = freeRight >= freeLeft ? "right" : "left";
        const free = { left: freeLeft, right: freeRight };
        const other = preferred === "right" ? "left" : "right";
        const expected =
          free[preferred] >= need ? preferred : free[other] >= need ? other : preferred;
        expect(p.side).toBe(expected);

        // Line ends at the hotspot centre and starts on the box rectangle,
        // at the point nearest to the centre.
        expect(p.line.x2).toBe(center.x);
        expect(p.line.y2).toBe(center.y);
        expect(p.line.x1).toBeGreaterThanOrEqual(p.left - EPS);
        expect(p.line.x1).toBeLessThanOrEqual(p.left + box.width + EPS);
        expect(p.line.y1).toBeGreaterThanOrEqual(p.top - EPS);
        expect(p.line.y1).toBeLessThanOrEqual(p.top + box.height + EPS);
        const nx = Math.min(Math.max(center.x, p.left), p.left + box.width);
        const ny = Math.min(Math.max(center.y, p.top), p.top + box.height);
        expect(p.line.x1).toBeCloseTo(nx, 9);
        expect(p.line.y1).toBeCloseTo(ny, 9);
      }),
      { numRuns: 300 },
    );
  });

  const lb = { left: 0, top: 0, width: 1000, height: 600 };

  it("puts the box on the right with a 24 px gap when the left has less space", () => {
    const p = placeRuleBox(lb, { x: 200, y: 300 }, { width: 220, height: 100 });
    expect(p.side).toBe("right");
    expect(p.left).toBe(224);
    expect(p.top).toBe(250);
    expect(p.line).toEqual({ x1: 224, y1: 300, x2: 200, y2: 300 });
  });

  it("puts the box on the left when the right has less space", () => {
    const p = placeRuleBox(lb, { x: 800, y: 300 }, { width: 220, height: 100 });
    expect(p.side).toBe("left");
    expect(p.left).toBe(556);
  });

  it("keeps the preferred side and clamps when neither side fits", () => {
    const p = placeRuleBox(lb, { x: 500, y: 300 }, { width: 480, height: 100 });
    expect(p.side).toBe("right");
    expect(p.left).toBe(520);
  });

  it("clamps vertically at the top and bottom edges", () => {
    expect(placeRuleBox(lb, { x: 200, y: 10 }, { width: 100, height: 100 }).top).toBe(0);
    expect(placeRuleBox(lb, { x: 200, y: 590 }, { width: 100, height: 100 }).top).toBe(500);
  });
});
