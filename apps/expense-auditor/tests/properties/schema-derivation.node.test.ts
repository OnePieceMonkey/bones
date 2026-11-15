// Feature: expense-auditor, Property 9: Expense_Schema derivation
// **Validates: Requirements 9.1, 9.2, 9.9**
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isRuleFields, toRuleFields } from "../../src/pipeline/toRuleFields";
import type { RuleFields } from "../../src/pipeline/schema";
import { arbProposal, arbTrip } from "../helpers/arbitraries";

const arbCase = arbTrip.chain((trip) => arbProposal(trip).map((proposal) => ({ trip, proposal })));

describe("Property 9: Expense_Schema derivation", () => {
  it("derives sums, alcohol items and trip fields from every valid proposal", () => {
    fc.assert(
      fc.property(arbCase, ({ trip, proposal }) => {
        const before = JSON.stringify(proposal);
        const r = toRuleFields(proposal, trip) as RuleFields;
        expect("kind" in r).toBe(false);
        const amounts = proposal.lineItems.map((i) => i.amount);
        const alcohol = proposal.lineItems.filter((i) => i.isAlcohol).map((i) => i.amount);
        expect(r.lineItemSumCents).toBe(amounts.reduce((a, b) => a + b, 0));
        expect(r.alcoholLineCents).toBe(alcohol.reduce((a, b) => a + b, 0));
        expect(r.alcoholLineItems.map((i) => i.amount)).toEqual(alcohol);
        expect(r.lineItems.map((i) => i.amount)).toEqual(amounts);
        expect(r.tripStart).toBe(trip.start);
        expect(r.tripEnd).toBe(trip.end);
        expect(r.claimedTotalCents).toBe(proposal.claimedTotalCents);
        expect(r.receiptDate).toBe(proposal.receiptDate);
        expect(isRuleFields(r)).toBe(true);
        // pure: same input, same output; input untouched
        expect(JSON.stringify(toRuleFields(proposal, trip))).toBe(JSON.stringify(r));
        expect(JSON.stringify(proposal)).toBe(before);
      }),
      { numRuns: 200 },
    );
  });
});
