// Feature: expense-auditor, Property 3: Money filter round trip (Core)
// **Validates: Requirements 2.1, 2.2, 2.9**
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { formatMoney, renderTemplate } from "../../rules/template.js";

const SHAPE = /^(-)?(\$|€|CHF|kr)(\d{1,3}(?:,\d{3})*)\.(\d{2})$/;

/** Test-owned parser: strip sign, symbol and commas, then integer arithmetic only. */
function parseMoney(text: string, symbol: string): number {
  let rest = text;
  let sign = 1;
  if (rest.startsWith("-")) {
    sign = -1;
    rest = rest.slice(1);
  }
  expect(rest.startsWith(symbol)).toBe(true);
  rest = rest.slice(symbol.length).replace(/,/g, "");
  const [whole, frac] = rest.split(".");
  return sign * (parseInt(whole!, 10) * 100 + parseInt(frac!, 10));
}

describe("money filter round trip", () => {
  it("renders and parses back to the original cents with the expected text shape", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 }),
        fc.constantFrom("$", "€", "CHF", "kr"),
        (cents, symbol) => {
          const rendered = renderTemplate("{{v|money}}", { v: cents }, symbol);
          const direct = formatMoney(cents, symbol);
          expect(rendered).toBe(direct);

          for (const text of [rendered, direct]) {
            const m = SHAPE.exec(text);
            expect(m).not.toBeNull();
            expect(m![2]).toBe(symbol);
            expect(Boolean(m![1])).toBe(cents < 0);
            expect(parseMoney(text, symbol)).toBe(cents);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
