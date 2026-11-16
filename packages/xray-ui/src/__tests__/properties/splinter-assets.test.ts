import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { SPLINTER_FILE_COUNT, splinterAssets } from "../../model/splinterAssets";
import { SPLINTER_COUNT } from "../../model/hash";
import { hotspotState } from "../../model/hotspotState";

describe("splinterAssets", () => {
  it("Property 4: splinter file choice is deterministic and distinct", () => {
    // Feature: visual-polish, Property 4: Splinter file choice is deterministic and distinct
    // Validates: Requirements 10.10, 10.15
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (ruleId) => {
        const a = splinterAssets(ruleId);
        expect(splinterAssets(ruleId)).toEqual(a);
        expect(a).toHaveLength(SPLINTER_COUNT);
        expect(new Set(a).size).toBe(SPLINTER_COUNT);
        for (const i of a) {
          expect(Number.isInteger(i)).toBe(true);
          expect(i).toBeGreaterThanOrEqual(0);
          expect(i).toBeLessThan(SPLINTER_FILE_COUNT);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe("hotspotState", () => {
  const base = { conditionMet: true, ruleVersion: "v1" } as never;
  const outcome = (o: Record<string, unknown>) => ({ ...(base as object), ...o }) as never;

  it("maps fractured", () => {
    expect(hotspotState({ state: "fractured" })).toBe("fractured");
  });
  it("maps not-applicable", () => {
    expect(hotspotState({ state: "not-applicable" })).toBe("not-applicable");
  });
  it("maps a capping rule that changed nothing to applied-no-change", () => {
    expect(
      hotspotState({
        state: "passed",
        outcome: outcome({ effect: "capping", amountBeforeCents: 100, amountAfterCents: 100 }),
      }),
    ).toBe("applied-no-change");
  });
  it("maps other passed bones to passed", () => {
    expect(hotspotState({ state: "passed" })).toBe("passed");
    expect(
      hotspotState({ state: "passed", outcome: outcome({ conditionMet: false, effect: "blocking" }) }),
    ).toBe("passed");
  });
});
