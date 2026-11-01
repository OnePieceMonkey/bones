// Feature: core, Property 7: increasing a cap never decreases amountCents
// Validates: Requirements 4.3, 11.7
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { evaluate } from "../../rules/evaluate.js";
import { isCoreError } from "../../types.js";
import type { ValidatedFields, RuleSet, RuleCatalog, AmountScope, Rule } from "../../types.js";

describe("Property 7: cap increase never decreases amountCents", () => {
  it("raising cap by a positive integer never lowers amountCents (≥100 runs)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),   // claimedCents
        fc.integer({ min: 1, max: 100000 }),   // baseCap
        fc.integer({ min: 1, max: 100000 }),   // increase
        (claimedCents, baseCap, increase) => {
          const buildEval = (capCents: number) => {
            const rule: Rule = {
              id: "cap", version: "1.0.0", effect: "capping",
              condition: { kind: "comparison", left: { kind: "literal", value: true }, op: "==", right: { kind: "literal", value: true } },
              effectConfig: { cap: capCents, scope: "total" },
              messageTemplate: "",
            };
            const catalog: RuleCatalog = new Map<string, Rule>();
            catalog.set("cap@1.0.0", rule);
            const ruleSet: RuleSet = { id: "s", version: "1.0.0", rules: [{ ruleId: "cap", ruleVersion: "1.0.0" }] };
            const fields: ValidatedFields = {};
            const scopes: AmountScope[] = [{ name: "total", claimedCents }];
            return evaluate(fields, ruleSet, catalog, scopes);
          };

          const r1 = buildEval(baseCap);
          const r2 = buildEval(baseCap + increase);
          if (isCoreError(r1) || isCoreError(r2)) return true;
          // Raising cap should not decrease amount
          return r2.amountCents >= r1.amountCents;
        }
      ),
      { numRuns: 100 }
    );
  });
});
