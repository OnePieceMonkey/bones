import { isCoreError } from "@bones/core";
import { describe, expect, it } from "vitest";
import { buildBundle } from "../../src/rules/catalog";
import { loadTestBundle, readRuleDir } from "../helpers/fixtures";

describe("case-files catalog", () => {
  it("builds a bundle with keys ${id}@${version}", () => {
    const b = loadTestBundle();
    if (isCoreError(b)) throw new Error(JSON.stringify(b));
    expect(b.templateCatalog.size).toBe(11);
    for (const [key, rule] of b.templateCatalog) expect(key).toBe(`${rule.id}@${rule.version}`);
    expect(b.templateRuleSets.v1.version).toBe("1.0.0");
    expect(b.templateRuleSets.v2.version).toBe("2.0.0");
    expect(b.templateRuleSets.v3.version).toBe("3.0.0");
  });

  it("returns rule_not_found for a missing rule", () => {
    const rules = { ...readRuleDir("rules") };
    delete rules["proof-motive-v2.json"];
    const b = buildBundle(rules, readRuleDir("rule-sets"));
    expect(isCoreError(b) && b.kind).toBe("rule_not_found");
  });

  it("returns rule_not_found for a missing rule set", () => {
    const sets = { ...readRuleDir("rule-sets") };
    delete sets["case-files-v2.json"];
    const b = buildBundle(readRuleDir("rules"), sets);
    expect(isCoreError(b) && b.kind).toBe("rule_not_found");
  });

  it("passes on a schema error of a rule", () => {
    const b = buildBundle({ bad: { id: "x" } }, readRuleDir("rule-sets"));
    expect(isCoreError(b) && b.kind).toBe("invalid_rule_schema");
  });
});
