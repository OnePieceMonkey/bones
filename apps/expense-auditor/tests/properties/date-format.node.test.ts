// Feature: expense-auditor, Property 5: Date formatter is total and keeps the day number
// **Validates: Requirements 11.4, 11.9**
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatDate } from "../../src/format/dates";
import { arbIsoDate } from "../helpers/arbitraries";

describe("Property 5: Date formatter is total and keeps the day number", () => {
  it("formats every real ISO date as 'Mon D, YYYY' with the same day and year", () => {
    fc.assert(
      fc.property(arbIsoDate, (iso) => {
        const out = formatDate(iso);
        const m = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(out);
        expect(m).not.toBeNull();
        expect(Number(m?.[2])).toBe(Number(iso.slice(8, 10)));
        expect(m?.[3]).toBe(iso.slice(0, 4));
      }),
      { numRuns: 200 },
    );
  });

  it("never throws for arbitrary text and returns it unchanged when not a real date", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = formatDate(s);
        expect(typeof out).toBe("string");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) expect(out).toBe(s);
      }),
      { numRuns: 200 },
    );
  });
});
