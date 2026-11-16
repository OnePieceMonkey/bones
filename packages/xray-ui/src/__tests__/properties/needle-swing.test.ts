import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { needleSwing } from "../../model/needleSwing";
import { SWEEP } from "../../model/gauge";

const angle = fc.double({ min: SWEEP.min, max: SWEEP.max, noNaN: true });
const EPS = 1e-9;

describe("needleSwing", () => {
  it("Property 15: needle swing overshoots by 1 to 8 degrees", () => {
    // Feature: visual-polish, Property 15: Needle swing overshoots by 1 to 8 degrees
    // Validates: Requirements 14.5
    fc.assert(
      fc.property(angle, angle, (from, to) => {
        const s = needleSwing(from, to);
        expect(s.from).toBe(from);
        expect(s.to).toBe(to);
        if (from === to) {
          expect(s.over).toBe(to);
          return;
        }
        const dir = Math.sign(to - from);
        const beyond = (s.over - to) * dir;
        expect(beyond).toBeGreaterThanOrEqual(1 - EPS);
        expect(beyond).toBeLessThanOrEqual(8 + EPS);
      }),
      { numRuns: 300 },
    );
  });

  it("uses 10 % of the travel inside the clamp", () => {
    expect(needleSwing(-60, 60)).toEqual({ from: -60, over: 68, to: 60 });
    expect(needleSwing(0, 50).over).toBeCloseTo(55);
    expect(needleSwing(30, -30).over).toBeCloseTo(-36);
  });

  it("clamps tiny travel to 1 degree and has no overshoot without travel", () => {
    expect(needleSwing(10, 10.5).over).toBeCloseTo(11.5);
    expect(needleSwing(-60, -60)).toEqual({ from: -60, over: -60, to: -60 });
  });
});
