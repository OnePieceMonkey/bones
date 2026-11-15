// Feature: expense-auditor, Property 4: App money formatting round trip
// **Validates: Requirements 11.3, 11.8**
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatValue } from "../../src/format/formatValue";
import { formatCents } from "../../src/format/money";
import { parseMoney } from "../helpers/money";

describe("Property 4: App money formatting round trip", () => {
  it("parseMoney(formatCents(c)) = c and formatValue on a *Cents path equals formatCents", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000_000 }),
        fc.constantFrom("claimedTotalCents", "alcoholLineCents", "totalCents"),
        (cents, path) => {
          expect(parseMoney(formatCents(cents), "$")).toBe(cents);
          expect(formatValue(path, cents)).toBe(formatCents(cents));
        },
      ),
      { numRuns: 200 },
    );
  });
});
