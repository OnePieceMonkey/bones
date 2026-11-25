import { isCoreError, parseRule, parseRuleSet } from "@bones/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deriveFacts } from "../../src/derive/factDeriver";
import { bindRuleSet } from "../../src/rules/binder";
import { VERSION_LABELS } from "../../src/rules/catalog";
import { validCaseArb } from "../helpers/arbitraries";
import { loadTestBundle } from "../helpers/fixtures";

const bundle = loadTestBundle();
if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));

describe("Rule_Binder uniqueness and counts", () => {
  // Feature: case-files, Property 5: Rule_Binder produces unique instances with the right count
  // **Validates: Requirements 4.11**
  it("Property 5: unique instance ids and the right instance counts for v1, v2, v3", () => {
    fc.assert(
      fc.property(validCaseArb, (c) => {
        const derived = deriveFacts(c);
        for (const label of VERSION_LABELS) {
          const tpl = bundle.templateRuleSets[label];
          const bound = bindRuleSet(tpl, bundle.templateCatalog, derived);
          if (isCoreError(bound)) throw new Error(JSON.stringify(bound));
          const ids = bound.ruleSet.rules.map((r) => r.ruleId);
          expect(new Set(ids).size).toBe(ids.length);
          const proofTemplates = tpl.rules.filter((r) => r.ruleId.startsWith("proof-")).length;
          const stmtKinds = new Set(
            tpl.rules.filter((r) => r.ruleId.startsWith("statement-")).map((r) => r.ruleId.split("-")[1]),
          );
          const stmtCount = derived.suspects
            .flatMap((s) => s.statements)
            .filter((s) => stmtKinds.has(s.kind)).length;
          expect(ids.filter((i) => i.startsWith("proof-")).length).toBe(proofTemplates * derived.suspects.length);
          expect(ids.filter((i) => i.startsWith("statement-")).length).toBe(stmtCount);
          expect(bound.catalog.size).toBe(ids.length);
          // Bound rules and rule set validate against core's real schema.
          expect(isCoreError(parseRuleSet(bound.ruleSet))).toBe(false);
          for (const rule of bound.catalog.values()) expect(isCoreError(parseRule(rule))).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
