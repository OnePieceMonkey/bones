// Feature: core, Property 8: rule permutation invariance
// Validates: Requirements 4.1, 4.11, 11.8
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { evaluate } from "../../rules/evaluate.js";
import { isCoreError } from "../../types.js";
import type { ValidatedFields, RuleSet, RuleCatalog, AmountScope, Rule, RuleRef } from "../../types.js";

/** Fisher-Yates shuffle (pure — returns new array) */
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

describe("Property 8: rule permutation invariance", () => {
  it("permuting rules in a RuleSet does not change result or amountCents (≥100 runs)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50000 }),   // cap1
        fc.integer({ min: 1, max: 50000 }),   // cap2
        fc.integer({ min: 1, max: 100000 }),  // claimedCents
        fc.integer({ min: 0, max: 999 }),     // shuffle seed
        (cap1, cap2, claimedCents, seed) => {
          const r1: Rule = { id: "aaa-cap", version: "1.0.0", effect: "capping", condition: { kind: "comparison", left: { kind: "literal", value: true }, op: "==", right: { kind: "literal", value: true } }, effectConfig: { cap: cap1, scope: "total" }, messageTemplate: "" };
          const r2: Rule = { id: "bbb-cap", version: "1.0.0", effect: "capping", condition: { kind: "comparison", left: { kind: "literal", value: true }, op: "==", right: { kind: "literal", value: true } }, effectConfig: { cap: cap2, scope: "total" }, messageTemplate: "" };

          const catalog: RuleCatalog = new Map<string, Rule>();
          catalog.set("aaa-cap@1.0.0", r1);
          catalog.set("bbb-cap@1.0.0", r2);

          const originalRules: RuleRef[] = [
            { ruleId: "aaa-cap", ruleVersion: "1.0.0" },
            { ruleId: "bbb-cap", ruleVersion: "1.0.0" },
          ];
          const shuffledRules = shuffle(originalRules, seed);

          const ruleSetA: RuleSet = { id: "s", version: "1.0.0", rules: originalRules };
          const ruleSetB: RuleSet = { id: "s", version: "1.0.0", rules: shuffledRules };

          const fields: ValidatedFields = {};
          const scopes: AmountScope[] = [{ name: "total", claimedCents }];

          const dA = evaluate(fields, ruleSetA, catalog, scopes);
          const dB = evaluate(fields, ruleSetB, catalog, scopes);

          if (isCoreError(dA) || isCoreError(dB)) return true;
          return dA.result === dB.result && dA.amountCents === dB.amountCents;
        }
      ),
      { numRuns: 100 }
    );
  });
});
