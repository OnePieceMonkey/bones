// Feature: expense-auditor, Property 7: Money filter tolerates whitespace and falls back to plain text
// **Validates: Requirements 2.3, 2.4, 2.5, 2.6**
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { renderTemplate } from "../../rules/template.js";

const ws = fc.stringOf(fc.constantFrom(" ", "\t"), { maxLength: 4 });
const pathArb = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,8}$/).filter((p) => p !== "__proto__");
const filterNameArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9_]{0,8}$/)
  .filter((f) => f !== "money");
const symbolArb = fc.constantFrom("$", "€", "CHF", "kr");

const nonIntegerArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.string(),
  fc.double({ noNaN: false }).filter((n) => !Number.isSafeInteger(n)),
  fc.integer({ min: 2 ** 53, max: Number.MAX_SAFE_INTEGER * 4 }).filter((n) => !Number.isSafeInteger(n)),
  fc.boolean(),
  fc.constant(null),
  fc.array(fc.oneof(fc.integer(), fc.string())),
  fc.dictionary(fc.stringMatching(/^[a-z]{1,5}$/), fc.integer()),
);

describe("money filter tolerance and plain fallback", () => {
  it("tolerates whitespace, falls back to plain text, never throws", () => {
    fc.assert(
      fc.property(
        pathArb,
        ws,
        ws,
        ws,
        ws,
        filterNameArb,
        fc.integer({ min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }),
        nonIntegerArb,
        symbolArb,
        (path, w1, w2, w3, w4, other, int, nonInt, symbol) => {
          const spaced = (f: string) => `{{${w1}${path}${w2}|${w3}${f}${w4}}}`;
          const plainSlot = `{{${path}}}`;

          // money + safe integer: whitespace variants equal the compact form
          const compact = renderTemplate(`{{${path}|money}}`, { [path]: int }, symbol);
          expect(renderTemplate(spaced("money"), { [path]: int }, symbol)).toBe(compact);

          // other filter name with a safe integer: same as unfiltered slot
          expect(renderTemplate(spaced(other), { [path]: int }, symbol)).toBe(String(int));

          // non-integer values: money and other filters render like the plain slot
          const fields = { [path]: nonInt } as never;
          const plain = renderTemplate(plainSlot, fields, symbol);
          expect(plain).toBe(String(nonInt));
          expect(renderTemplate(spaced("money"), fields, symbol)).toBe(plain);
          expect(renderTemplate(spaced(other), fields, symbol)).toBe(plain);

          // missing path renders ""
          expect(renderTemplate(spaced("money"), {}, symbol)).toBe("");
          expect(renderTemplate(spaced(other), {}, symbol)).toBe("");
          expect(renderTemplate(plainSlot, {}, symbol)).toBe("");
        },
      ),
      { numRuns: 200 },
    );
  });
});
