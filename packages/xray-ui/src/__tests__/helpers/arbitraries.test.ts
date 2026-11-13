import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { arbTraceAndAnatomy, arbOutcome } from "./arbitraries";
import { signatureTrace } from "./fixtures";

describe("test helpers", () => {
  it("generates pairs with unique rule ids and mapped bones from outcomes or extras", () => {
    fc.assert(
      fc.property(arbTraceAndAnatomy, ({ trace, anatomy }) => {
        const outcomeIds = trace.ruleOutcomes.map((o) => o.ruleId);
        const boneIds = anatomy.bones.map((b) => b.ruleId);
        expect(new Set(outcomeIds).size).toBe(outcomeIds.length);
        expect(new Set(boneIds).size).toBe(boneIds.length);
      }),
    );
  });

  it("blocking outcomes carry no amount fields; others keep after <= before", () => {
    fc.assert(
      fc.property(arbOutcome(), (o) => {
        if (o.effect === "blocking") {
          expect(o.amountBeforeCents).toBeUndefined();
          expect(o.amountAfterCents).toBeUndefined();
        } else if (o.amountBeforeCents !== undefined) {
          expect(o.amountAfterCents).toBeLessThanOrEqual(o.amountBeforeCents);
        }
      }),
    );
  });

  it("signatureTrace has two fractured bones and 4150 cents", () => {
    const t = signatureTrace();
    expect(t.amountCents).toBe(4150);
    expect(t.ruleOutcomes.filter((o) => o.conditionMet && o.effect !== "blocking" && (o.amountAfterCents ?? 0) < (o.amountBeforeCents ?? 0))).toHaveLength(2);
  });
});
