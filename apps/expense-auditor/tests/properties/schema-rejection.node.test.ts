// Feature: expense-auditor, Property 10: Expense_Schema rejection names the failing field
// **Validates: Requirements 9.3, 9.4, 9.5, 9.6, 9.7**
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { CoreError } from "@bones/core";
import { toRuleFields } from "../../src/pipeline/toRuleFields";
import { arbProposal, arbTrip } from "../helpers/arbitraries";
import type { ArbProposal, ArbTrip } from "../helpers/arbitraries";

type Defect =
  | { kind: "negative"; index: number; value: number }
  | { kind: "fractional"; index: number; value: number }
  | { kind: "badDate"; value: string }
  | { kind: "emptyItems" }
  | { kind: "zeroTotal" }
  | { kind: "tripReversed"; days: number };

const arbDefect: fc.Arbitrary<Defect> = fc.oneof(
  fc.record({ kind: fc.constant("negative" as const), index: fc.nat(1000), value: fc.integer({ min: -500_000, max: -1 }) }),
  fc.record({
    kind: fc.constant("fractional" as const),
    index: fc.nat(1000),
    value: fc.integer({ min: 0, max: 50_000 }).map((n) => n + 0.5),
  }),
  fc.record({
    kind: fc.constant("badDate" as const),
    value: fc.constantFrom("2024-02-30", "2023-02-29", "2024-13-01", "2024-00-10", "2024-1-5", "yesterday", "", "2024-03-15T10:00:00Z"),
  }),
  fc.constant({ kind: "emptyItems" as const }),
  fc.constant({ kind: "zeroTotal" as const }),
  fc.record({ kind: fc.constant("tripReversed" as const), days: fc.integer({ min: 1, max: 30 }) }),
);

const addDays = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

function inject(p: ArbProposal, trip: ArbTrip, d: Defect): { input: Record<string, unknown>; trip: ArbTrip; prefix: string } {
  const items = p.lineItems.map((i) => ({ ...i }));
  switch (d.kind) {
    case "negative":
    case "fractional": {
      const idx = d.index % items.length;
      items[idx]!.amount = d.value;
      return { input: { ...p, lineItems: items }, trip, prefix: `lineItems.${idx}.amount` };
    }
    case "badDate":
      return { input: { ...p, receiptDate: d.value }, trip, prefix: "receiptDate" };
    case "emptyItems":
      return { input: { ...p, lineItems: [] }, trip, prefix: "lineItems" };
    case "zeroTotal":
      return { input: { ...p }, trip, prefix: "claimedTotalCents" };
    case "tripReversed":
      return { input: { ...p }, trip: { start: addDays(trip.start, d.days), end: trip.start }, prefix: "tripEnd" };
  }
}

describe("Property 10: Expense_Schema rejection names the failing field", () => {
  it("rejects each injected defect and names its field path", () => {
    fc.assert(
      fc.property(
        arbTrip.chain((trip) => fc.tuple(fc.constant(trip), arbProposal(trip), arbDefect)),
        ([trip, proposal, defect]) => {
          const target = defect.kind === "zeroTotal" ? { ...proposal, claimedTotalCents: 0 } : proposal;
          const { input, trip: t, prefix } = inject(target, trip, defect);
          const r = toRuleFields(input, t);
          expect("kind" in r && r.kind === "validation_failed").toBe(true);
          const errors = (r as Extract<CoreError, { kind: "validation_failed" }>).fieldErrors;
          expect(errors.some((e) => e.path.startsWith(prefix))).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});
