// Feature: expense-auditor, Property 8: Currency symbol validation
// **Validates: Requirements 2.6, 2.7**
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { evaluate, isCoreError, parseRuleSet } from "../../index.js";
import type { Rule, RuleSet } from "../../index.js";

// "Characters" are counted the way zod counts them: UTF-16 code units (String.length).
const symbolArb = fc.oneof(
  fc.constant(""),
  fc.string({ maxLength: 8 }),
  fc.unicodeString({ maxLength: 8 }),
  fc.fullUnicodeString({ maxLength: 8 }),
  fc.string16bits({ maxLength: 8 }),
  fc.string({ minLength: 1, maxLength: 4 }),
  fc.string({ minLength: 5, maxLength: 200 }),
);

const rule: Rule = {
  id: "limit",
  version: "1.0.0",
  effect: "blocking",
  condition: {
    kind: "comparison",
    left: { kind: "path", segments: ["claimedTotalCents"] },
    op: ">",
    right: { kind: "literal", value: 10000 },
  },
  effectConfig: {},
  messageTemplate: "Claimed {{ claimedTotalCents | money }}.",
};
const catalog = new Map([["limit@1.0.0", rule]]);
const base = {
  id: "s",
  version: "1.0.0",
  rules: [{ ruleId: "limit", ruleVersion: "1.0.0" }],
};

describe("currency symbol validation", () => {
  it("accepts 1 to 4 characters, rejects others, and defaults to $", () => {
    fc.assert(
      fc.property(symbolArb, (symbol) => {
        const result = parseRuleSet({ ...base, currencySymbol: symbol });
        if (symbol.length >= 1 && symbol.length <= 4) {
          expect(isCoreError(result)).toBe(false);
          expect((result as RuleSet).currencySymbol).toBe(symbol);
        } else {
          expect(isCoreError(result)).toBe(true);
          expect((result as { kind: string }).kind).toBe("invalid_rule_set_schema");
        }

        // a rule set without the field renders with "$"
        const parsed = parseRuleSet(base);
        expect(isCoreError(parsed)).toBe(false);
        const d = evaluate({ claimedTotalCents: 48000 }, parsed as RuleSet, catalog, [
          { name: "total", claimedCents: 48000 },
        ]);
        expect(isCoreError(d)).toBe(false);
        if (!isCoreError(d)) expect(d.ruleOutcomes[0]?.renderedMessage).toBe("Claimed $480.00.");
      }),
      { numRuns: 200 },
    );
  });
});
