import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { INTRO, introSchedule } from "../../model/introSchedule";

describe("introSchedule", () => {
  it("Property 10: intro schedule order and duration", () => {
    // Feature: visual-polish, Property 10: Intro schedule order and duration
    // Validates: Requirements 12.1, 12.2
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }), (flags) => {
        const { starts, endMs } = introSchedule(flags);
        expect(starts).toHaveLength(flags.length);
        expect(starts[0]).toBe(INTRO.LIGHT_FROM);
        for (let i = 1; i < starts.length; i++) {
          expect(starts[i]!).toBeGreaterThan(starts[i - 1]!);
          expect(starts[i]! - starts[i - 1]!).toBeLessThanOrEqual(INTRO.MAX_STEP);
        }
        expect(starts[starts.length - 1]!).toBeLessThanOrEqual(INTRO.LIGHT_FROM + INTRO.LIGHT_WINDOW);
        expect(endMs).toBeLessThanOrEqual(INTRO.MAX_END);
        expect(endMs).toBeGreaterThan(starts[starts.length - 1]!);
        // Deterministic.
        expect(introSchedule(flags)).toEqual({ starts, endMs });
      }),
      { numRuns: 200 },
    );
  });

  it("returns an empty schedule for no hotspots", () => {
    expect(introSchedule([])).toEqual({ starts: [], endMs: 0 });
  });

  it("n = 1: starts at 1500, ends at 2700 when fractured", () => {
    expect(introSchedule([true])).toEqual({ starts: [1500], endMs: 2700 });
    expect(introSchedule([false]).endMs).toBe(1900);
  });

  it("n = 5: step 200", () => {
    const { starts, endMs } = introSchedule([false, false, false, true, false]);
    expect(starts).toEqual([1500, 1700, 1900, 2100, 2300]);
    expect(endMs).toBe(3300);
  });

  it("n = 20: step 42, last fractured ends at 3498", () => {
    const flags = Array.from({ length: 20 }, (_, i) => i === 19);
    const { starts, endMs } = introSchedule(flags);
    expect(starts[1]! - starts[0]!).toBe(42);
    expect(starts[19]).toBe(2298);
    expect(endMs).toBe(3498);
  });
});
