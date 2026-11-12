// Feature: core, amount chain: amountAfterCents is at most amountBeforeCents
// Validates: Requirements 19.9
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { evaluate } from "../../rules/evaluate.js";
import { isCoreError } from "../../types.js";
import type { RuleSet, RuleCatalog, AmountScope, Rule, RuleEffect } from "../../types.js";

const SCOPE_NAMES = ["a", "b"] as const;

function cond(truth: boolean): Rule["condition"] {
  return { kind: "comparison", left: { kind: "literal", value: true }, op: "==", right: { kind: "literal", value: truth } };
}

interface RuleSpec {
  effect: RuleEffect;
  truth: boolean;
  amount: number;
  scope: string;
}

function buildRule(spec: RuleSpec, index: number): Rule {
  const id = `r${String(index).padStart(2, "0")}`;
  const base = { id, version: "1.0.0", effect: spec.effect, condition: cond(spec.truth), messageTemplate: "" };
  if (spec.effect === "blocking") return { ...base, effectConfig: {} };
  if (spec.effect === "capping") return { ...base, effectConfig: { cap: spec.amount, scope: spec.scope } };
  return { ...base, effectConfig: { deductionAmount: spec.amount, scope: spec.scope } };
}

const ruleSpecArb = fc.record({
  effect: fc.constantFrom<RuleEffect>("blocking", "capping", "deducting"),
  truth: fc.boolean(),
  amount: fc.integer({ min: 0, max: 200000 }),
  scope: fc.constantFrom(...SCOPE_NAMES),
});

describe("amount chain: 0 <= amountAfterCents <= amountBeforeCents", () => {
  it("holds for every outcome carrying both fields (≥100 runs)", () => {
    fc.assert(
      fc.property(
        fc.array(ruleSpecArb, { minLength: 1, maxLength: 8 }),
        fc.array(fc.integer({ min: 0, max: 100000 }), { minLength: 1, maxLength: 2 }),
        (specs, claimed) => {
          const rules = specs.map(buildRule);
          const catalog: RuleCatalog = new Map(rules.map((r) => [`${r.id}@${r.version}`, r]));
          const ruleSet: RuleSet = {
            id: "s",
            version: "1.0.0",
            rules: rules.map((r) => ({ ruleId: r.id, ruleVersion: r.version })),
          };
          const scopes: AmountScope[] = claimed.map((c, i) => ({ name: SCOPE_NAMES[i]!, claimedCents: c }));
          const result = evaluate({}, ruleSet, catalog, scopes);
          expect(isCoreError(result)).toBe(false);
          if (isCoreError(result)) return;
          for (const o of result.ruleOutcomes) {
            if (o.amountBeforeCents === undefined || o.amountAfterCents === undefined) continue;
            expect(Number.isInteger(o.amountBeforeCents)).toBe(true);
            expect(Number.isInteger(o.amountAfterCents)).toBe(true);
            expect(o.amountBeforeCents).toBeGreaterThanOrEqual(0);
            expect(o.amountAfterCents).toBeGreaterThanOrEqual(0);
            expect(o.amountAfterCents).toBeLessThanOrEqual(o.amountBeforeCents);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
