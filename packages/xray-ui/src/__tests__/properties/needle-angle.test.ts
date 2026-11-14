// Feature: xray-ui, Property 6: Needle angle is monotone and bounded
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { needleAngle, SWEEP } from "../../model/gauge";

describe("Property 6: needle angle", () => {
  it("is monotone non-decreasing and within SWEEP bounds on [0,1]", () => {
    // **Validates: Requirements 7.10, 7.11**
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          const alo = needleAngle(lo);
          const ahi = needleAngle(hi);
          expect(alo).toBeLessThanOrEqual(ahi);
          for (const v of [alo, ahi]) {
            expect(v).toBeGreaterThanOrEqual(SWEEP.min);
            expect(v).toBeLessThanOrEqual(SWEEP.max);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("maps null to the rest position (SWEEP.min)", () => {
    // **Validates: Requirements 7.10, 7.11**
    expect(needleAngle(null)).toBe(SWEEP.min);
    expect(needleAngle(0)).toBe(SWEEP.min);
    expect(needleAngle(1)).toBe(SWEEP.max);
  });
});
