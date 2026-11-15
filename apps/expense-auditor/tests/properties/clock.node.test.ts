import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { makeClock } from "../../src/pipeline/ports";

// Feature: expense-auditor, Property 12: Clock strictly increases
// **Validates: Requirements 10.6**
describe("Property 12: Clock strictly increases", () => {
  it("returns strictly increasing Dates for any time source sequence", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 4_000_000_000_000 }), { minLength: 1, maxLength: 60 }),
        (times) => {
          let i = 0;
          const clock = makeClock(() => times[i++ % times.length]!);
          const out = times.map(() => clock().getTime());
          for (let k = 1; k < out.length; k++) {
            expect(out[k]!).toBeGreaterThan(out[k - 1]!);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
