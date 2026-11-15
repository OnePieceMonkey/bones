import { isCoreError, parseRule, parseRuleSet } from "@bones/core";
import type { CoreError, Rule, RuleCatalog, RuleSet } from "@bones/core";

export type VersionLabel = "v1" | "v2" | "v3";
export const VERSION_LABELS: readonly VersionLabel[] = ["v1", "v2", "v3"];

export interface RuleBundle {
  catalog: RuleCatalog;
  ruleSets: Record<VersionLabel, RuleSet>;
}

export const RULE_SET_REFS: Record<VersionLabel, { id: "expense"; version: "1.0.0" | "2.0.0" | "3.0.0" }> = {
  v1: { id: "expense", version: "1.0.0" },
  v2: { id: "expense", version: "2.0.0" },
  v3: { id: "expense", version: "3.0.0" },
};

/**
 * Pure. Parses every module, keys the catalog by `${id}@${version}` from the file content,
 * picks the rule set of each label and verifies that every rule reference exists.
 */
export function buildBundle(
  ruleModules: Record<string, unknown>,
  ruleSetModules: Record<string, unknown>,
): RuleBundle | CoreError {
  const catalog: RuleCatalog = new Map<string, Rule>();
  for (const key of Object.keys(ruleModules).sort()) {
    const rule = parseRule(ruleModules[key]);
    if (isCoreError(rule)) return rule;
    catalog.set(`${rule.id}@${rule.version}`, rule);
  }

  const parsedSets = new Map<string, RuleSet>();
  for (const key of Object.keys(ruleSetModules).sort()) {
    const ruleSet = parseRuleSet(ruleSetModules[key]);
    if (isCoreError(ruleSet)) return ruleSet;
    parsedSets.set(`${ruleSet.id}@${ruleSet.version}`, ruleSet);
  }

  const picked: Partial<Record<VersionLabel, RuleSet>> = {};
  for (const label of VERSION_LABELS) {
    const ref = RULE_SET_REFS[label];
    const ruleSet = parsedSets.get(`${ref.id}@${ref.version}`);
    if (ruleSet === undefined) {
      return {
        kind: "rule_not_found",
        message: `Rule set ${ref.id}@${ref.version} for ${label} was not found.`,
        ruleId: ref.id,
        ruleVersion: ref.version,
      };
    }
    for (const r of ruleSet.rules) {
      if (!catalog.has(`${r.ruleId}@${r.ruleVersion}`)) {
        return {
          kind: "rule_not_found",
          message: `Rule ${r.ruleId}@${r.ruleVersion} referenced by ${ref.id}@${ref.version} was not found.`,
          ruleId: r.ruleId,
          ruleVersion: r.ruleVersion,
        };
      }
    }
    picked[label] = ruleSet;
  }

  return { catalog, ruleSets: picked as Record<VersionLabel, RuleSet> };
}

const ruleModules = import.meta.glob("../../../../rules/expense-auditor/rules/*.json", {
  eager: true,
  import: "default",
});
const ruleSetModules = import.meta.glob("../../../../rules/expense-auditor/rule-sets/*.json", {
  eager: true,
  import: "default",
});

/** Wires the two Vite globs into buildBundle. The JSON is inlined at build time. */
export function loadBundle(): RuleBundle | CoreError {
  return buildBundle(ruleModules, ruleSetModules);
}
