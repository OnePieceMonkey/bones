import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_EDGE, fitWithin } from "../../src/extraction/imageResize";

// Feature: expense-auditor, Property 22: Image geometry
// **Validates: Requirements 16.13**
describe("Property 22: Image geometry", () => {
  const dim = fc.integer({ min: 1, max: 20_000 });

  it("returns integers >= 1, long edge <= 1600, no enlargement, ratio within one pixel", () => {
    expect(MAX_EDGE).toBe(1600);
    fc.assert(
      fc.property(dim, dim, (w, h) => {
        const out = fitWithin(w, h);
        expect(Number.isInteger(out.width)).toBe(true);
        expect(Number.isInteger(out.height)).toBe(true);
        expect(out.width).toBeGreaterThanOrEqual(1);
        expect(out.height).toBeGreaterThanOrEqual(1);
        expect(Math.max(out.width, out.height)).toBeLessThanOrEqual(1600);
        expect(out.width).toBeLessThanOrEqual(w);
        expect(out.height).toBeLessThanOrEqual(h);
        const scale = Math.min(1, 1600 / Math.max(w, h));
        expect(Math.abs(out.width - w * scale)).toBeLessThanOrEqual(1);
        expect(Math.abs(out.height - h * scale)).toBeLessThanOrEqual(1);
      }),
      { numRuns: 500 },
    );
  });
});
