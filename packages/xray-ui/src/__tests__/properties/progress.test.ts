import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { progressShare, resultLine } from "../../model/progress";
import { resultLabel } from "../../model/format";
import type { DecisionResult } from "../../types";

const cents = fc.integer({ min: 0, max: 10_000_000 });

describe("progressShare", () => {
  it("Property 6: progress share is bounded and monotonic", () => {
    // Feature: visual-polish, Property 6: Progress share is bounded and monotonic
    // Validates: Requirements 8.6, 8.7
    fc.assert(
      fc.property(cents, cents, cents, (a, b, claimed) => {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        const sLo = progressShare(lo, claimed);
        const sHi = progressShare(hi, claimed);
        for (const s of [sLo, sHi]) {
          expect(Number.isNaN(s)).toBe(false);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(1);
        }
        expect(sHi).toBeGreaterThanOrEqual(sLo);
        if (claimed === 0) expect(sHi).toBe(0);
        if (claimed > 0 && hi <= claimed) expect(sHi).toBe(hi / claimed);
      }),
      { numRuns: 200 },
    );
  });

  it("returns 0 for non-integer or negative claimed amounts", () => {
    expect(progressShare(100, 0)).toBe(0);
    expect(progressShare(100, -5)).toBe(0);
    expect(progressShare(100, 1.5)).toBe(0);
    expect(progressShare(100, Number.NaN)).toBe(0);
  });
});

describe("resultLine", () => {
  it("Property 7: result line format", () => {
    // Feature: visual-polish, Property 7: Result line format
    // Validates: Requirements 8.5
    const results = fc.constantFrom<DecisionResult>("approved", "partially_approved", "rejected");
    fc.assert(
      fc.property(results, fc.integer({ min: -1_000_000, max: 100_000_000 }), (result, c) => {
        const format = (path: string, value: unknown) => `<${path}:${String(value)}>`;
        expect(resultLine(result, c, format)).toBe(`${resultLabel(result)} ${format("amountCents", c)}`);
      }),
      { numRuns: 100 },
    );
  });

  it("renders PARTIALLY APPROVED $41.50", () => {
    const format = (_p: string, v: unknown) => `$${((v as number) / 100).toFixed(2)}`;
    expect(resultLine("partially_approved", 4150, format)).toBe("PARTIALLY APPROVED $41.50");
  });
});
