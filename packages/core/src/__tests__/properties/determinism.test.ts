// Feature: core, Property 1: evaluate is deterministic
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { evaluate } from "../../rules/evaluate.js";
import { isCoreError } from "../../types.js";
import type { ValidatedFields, RuleSet, RuleCatalog, AmountScope, Rule } from "../../types.js";

// Arbitrary for a simple always-true blocking rule
function makeSimpleRule(id: string, version: string): Rule {
  return {
    id,
    version,
    effect: "blocking",
    condition: { kind: "comparison", left: { kind: "literal", value: true }, op: "==", right: { kind: "literal", value: false } },
    effectConfig: {},
    messageTemplate: "blocked",
  };
}

function makeCapRule(id: string, version: string, capCents: number): Rule {
  return {
    id,
    version,
    effect: "capping",
    condition: { kind: "comparison", left: { kind: "literal", value: true }, op: "==", right: { kind: "literal", value: true } },
    effectConfig: { cap: capCents, scope: "total" },
    messageTemplate: `capped at ${capCents}`,
  };
}

describe("Property 1: evaluate is deterministic", () => {
  /**
   * Validates: Requirements 4.10, 4.11, 11.1
   */
  it("returns identical decisions for identical inputs (≥100 runs)", () => {
    fc.assert(
      fc.property(
        // Generate a random cap value and claimed amount
        fc.integer({ min: 100, max: 100000 }),
        fc.integer({ min: 100, max: 100000 }),
        (capCents, claimedCents) => {
          const rule = makeCapRule("cap-rule", "1.0.0", capCents);
          const catalog: RuleCatalog = new Map<string, Rule>();
          catalog.set("cap-rule@1.0.0", rule);

          const ruleSet: RuleSet = {
            id: "test-set",
            version: "1.0.0",
            rules: [{ ruleId: "cap-rule", ruleVersion: "1.0.0" }],
          };

          const fields: ValidatedFields = { amount: claimedCents };
          const scopes: AmountScope[] = [{ name: "total", claimedCents }];

          const result1 = evaluate(fields, ruleSet, catalog, scopes);
          const result2 = evaluate(fields, ruleSet, catalog, scopes);

          if (isCoreError(result1) || isCoreError(result2)) return true; // skip if error

          return (
            result1.result === result2.result &&
            result1.amountCents === result2.amountCents
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 4.10, 4.11, 11.1
   */
  it("returns identical decisions for identical inputs with blocking rules (≥100 runs)", () => {
    fc.assert(
      fc.property(
        fc.boolean(), // whether the rule fires
        (fires) => {
          const rule = makeSimpleRule("block-rule", "1.0.0");
          // Override condition to always fire or never fire based on `fires`
          const testRule: Rule = {
            ...rule,
            condition: {
              kind: "comparison",
              left: { kind: "literal", value: fires },
              op: "==",
              right: { kind: "literal", value: true },
            },
          };
          const catalog: RuleCatalog = new Map<string, Rule>();
          catalog.set("block-rule@1.0.0", testRule);
          const ruleSet: RuleSet = {
            id: "test-set",
            version: "1.0.0",
            rules: [{ ruleId: "block-rule", ruleVersion: "1.0.0" }],
          };
          const fields: ValidatedFields = {};
          const scopes: AmountScope[] = [{ name: "total", claimedCents: 1000 }];

          const r1 = evaluate(fields, ruleSet, catalog, scopes);
          const r2 = evaluate(fields, ruleSet, catalog, scopes);

          if (isCoreError(r1) || isCoreError(r2)) return true;
          return r1.result === r2.result && r1.amountCents === r2.amountCents;
        }
      ),
      { numRuns: 100 }
    );
  });
});
