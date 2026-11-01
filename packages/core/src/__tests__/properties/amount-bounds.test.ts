// Feature: core, Property 6: amountCents is always within [0, claimedTotalCents]
// Validates: Requirements 4.6, 11.6
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { evaluate } from "../../rules/evaluate.js";
import { isCoreError } from "../../types.js";
import type { ValidatedFields, RuleSet, RuleCatalog, AmountScope, Rule } from "../../types.js";

function makeCapRule(capCents: number): Rule {
  return {
    id: "cap", version: "1.0.0", effect: "capping",
    condition: { kind: "comparison", left: { kind: "literal", value: true }, op: "==", right: { kind: "literal", value: true } },
    effectConfig: { cap: capCents, scope: "total" },
    messageTemplate: "",
  };
}

function makeDeductRule(deductCents: number): Rule {
  return {
    id: "deduct", version: "1.0.0", effect: "deducting",
    condition: { kind: "comparison", left: { kind: "literal", value: true }, op: "==", right: { kind: "literal", value: true } },
    effectConfig: { deductionAmount: deductCents, scope: "total" },
    messageTemplate: "",
  };
}

describe("Property 6: 0 <= amountCents <= claimedTotalCents", () => {
  it("amount is always within bounds for arbitrary cap/deduct/claimed combinations (≥100 runs)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),   // claimedCents
        fc.integer({ min: 1, max: 200000 }),   // capCents (may be larger or smaller)
        fc.integer({ min: 0, max: 200000 }),   // deductCents
        (claimedCents, capCents, deductCents) => {
          const capRule = makeCapRule(capCents);
          const deductRule = makeDeductRule(deductCents);
          const catalog: RuleCatalog = new Map<string, Rule>();
          catalog.set("cap@1.0.0", capRule);
          catalog.set("deduct@1.0.0", deductRule);
          const ruleSet: RuleSet = {
            id: "s", version: "1.0.0",
            rules: [{ ruleId: "cap", ruleVersion: "1.0.0" }, { ruleId: "deduct", ruleVersion: "1.0.0" }],
          };
          const fields: ValidatedFields = {};
          const scopes: AmountScope[] = [{ name: "total", claimedCents }];
          const result = evaluate(fields, ruleSet, catalog, scopes);
          if (isCoreError(result)) return true;
          return result.amountCents >= 0 && result.amountCents <= claimedCents;
        }
      ),
      { numRuns: 100 }
    );
  });
});
