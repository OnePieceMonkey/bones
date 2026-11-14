// Feature: xray-ui, Property 7: Hash-derived visuals are deterministic and bounded
// **Validates: Requirements 2.8, 5.3, 10.2**
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { SPLINTER_COUNT, crackPath, splinters } from "../../model/hash";

const NUM_RUNS = 200;

describe("Property 7: Hash-derived visuals are deterministic and bounded", () => {
  it("splinters(ruleId) is deterministic with bounded values", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (ruleId) => {
        const a = splinters(ruleId);
        const b = splinters(ruleId);
        expect(a).toEqual(b);
        expect(a).toHaveLength(SPLINTER_COUNT);
        for (const s of a) {
          expect(s.length).toBeGreaterThanOrEqual(10);
          expect(s.length).toBeLessThanOrEqual(24);
          expect(s.size).toBeGreaterThanOrEqual(3);
          expect(s.size).toBeLessThanOrEqual(6);
          expect(s.angleDeg).toBeGreaterThanOrEqual(0);
          expect(s.angleDeg).toBeLessThanOrEqual(359);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("crackPath(seed, w, h) is deterministic and stays inside [0,w]x[0,h]", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 40 }),
        fc.integer({ min: 1, max: 2000 }),
        fc.integer({ min: 1, max: 2000 }),
        (seed, w, h) => {
          const a = crackPath(seed, w, h);
          expect(crackPath(seed, w, h)).toBe(a);
          const nums = (a.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
          expect(nums.length).toBeGreaterThan(0);
          expect(nums.length % 2).toBe(0);
          for (let i = 0; i < nums.length; i += 2) {
            const x = nums[i] as number;
            const y = nums[i + 1] as number;
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(w);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(h);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
