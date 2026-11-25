import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { isCoreError, parseRule, parseRuleSet } from "@bones/core";
import type { Rule, RuleSet } from "@bones/core";
import { describe, expect, it } from "vitest";
import { RULE_SET_REFS, VERSION_LABELS } from "../../src/rules/catalog";
import { readRuleDir, rulesRoot } from "../helpers/fixtures";

const rules = readRuleDir("rules");
const ruleSets = readRuleDir("rule-sets");

function parsedRules(): Rule[] {
  return Object.values(rules).map((r) => {
    const p = parseRule(r);
    if (isCoreError(p)) throw new Error(JSON.stringify(p));
    return p;
  });
}
function parsedSets(): RuleSet[] {
  return Object.values(ruleSets).map((r) => {
    const p = parseRuleSet(r);
    if (isCoreError(p)) throw new Error(JSON.stringify(p));
    return p;
  });
}
function comparedField(rule: Rule): string {
  if (rule.condition.kind !== "comparison") throw new Error("not a comparison");
  const left = rule.condition.left;
  if (left.kind !== "path") throw new Error("left is not a path");
  return left.segments.join(".");
}

describe("case-files rule files", () => {
  it("has 11 rule files and 3 rule set files", () => {
    expect(readdirSync(resolve(rulesRoot, "rules")).filter((n) => n.endsWith(".json"))).toHaveLength(11);
    expect(readdirSync(resolve(rulesRoot, "rule-sets")).filter((n) => n.endsWith(".json"))).toHaveLength(3);
  });

  it("every rule passes core parseRule and every rule set passes parseRuleSet", () => {
    for (const [name, raw] of Object.entries(rules)) {
      expect(isCoreError(parseRule(raw)), name).toBe(false);
    }
    for (const [name, raw] of Object.entries(ruleSets)) {
      expect(isCoreError(parseRuleSet(raw)), name).toBe(false);
    }
  });

  it("every reference resolves and no rule file is unreferenced", () => {
    const keys = new Set(parsedRules().map((r) => `${r.id}@${r.version}`));
    expect(keys.size).toBe(11);
    const referenced = new Set<string>();
    for (const set of parsedSets()) {
      for (const ref of set.rules) {
        const k = `${ref.ruleId}@${ref.ruleVersion}`;
        expect(keys.has(k), k).toBe(true);
        referenced.add(k);
      }
    }
    expect([...keys].filter((k) => !referenced.has(k))).toEqual([]);
  });

  it("rule sets carry the ids and versions of RULE_SET_REFS", () => {
    const keys = parsedSets().map((s) => `${s.id}@${s.version}`).sort();
    expect(keys).toEqual(VERSION_LABELS.map((l) => `${RULE_SET_REFS[l].id}@${RULE_SET_REFS[l].version}`));
  });

  it("compares Any in 1.0.0 and Firm in 2.0.0, sighting always Firm", () => {
    for (const r of parsedRules()) {
      const field = comparedField(r);
      if (r.id === "statement-sighting-contradicted") {
        expect(field).toBe("subject.conflictsFirm");
      } else if (r.version === "1.0.0") {
        expect(field, `${r.id}@${r.version}`).toMatch(/Any$/);
      } else {
        expect(r.version).toBe("2.0.0");
        expect(field, `${r.id}@${r.version}`).toMatch(/Firm$/);
      }
    }
  });

  it("v1 binds no motive, possession or sighting rule", () => {
    const v1 = parsedSets().find((s) => s.version === "1.0.0");
    expect(v1?.rules.map((r) => r.ruleId)).toEqual([
      "proof-means",
      "proof-opportunity",
      "statement-location-contradicted",
    ]);
  });
});
