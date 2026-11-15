import { describe, expect, it } from "vitest";
import { isCoreError } from "@bones/core";
import type { CoreError } from "@bones/core";
import { RULE_SET_REFS, VERSION_LABELS, buildBundle, loadBundle } from "../../src/rules/catalog";
import type { RuleBundle } from "../../src/rules/catalog";
import { loadTestBundle, readRuleDir } from "../helpers/fixtures";

function bundleOrThrow(b: RuleBundle | CoreError): RuleBundle {
  if (isCoreError(b)) throw new Error(`${b.kind}: ${b.message}`);
  return b;
}

describe("rule catalog", () => {
  it("maps the three labels to the three rule sets", () => {
    const b = bundleOrThrow(loadTestBundle());
    expect(VERSION_LABELS).toEqual(["v1", "v2", "v3"]);
    for (const label of VERSION_LABELS) {
      expect(b.ruleSets[label].id).toBe(RULE_SET_REFS[label].id);
      expect(b.ruleSets[label].version).toBe(RULE_SET_REFS[label].version);
    }
    expect(RULE_SET_REFS.v1.version).toBe("1.0.0");
    expect(RULE_SET_REFS.v2.version).toBe("2.0.0");
    expect(RULE_SET_REFS.v3.version).toBe("3.0.0");
  });

  it("resolves every rule reference in the catalog", () => {
    const b = bundleOrThrow(loadTestBundle());
    for (const label of VERSION_LABELS) {
      for (const r of b.ruleSets[label].rules) {
        expect(b.catalog.has(`${r.ruleId}@${r.ruleVersion}`)).toBe(true);
      }
    }
  });

  it("uses meal-limit 1.0.0, 2.0.0 and 3.0.0 in v1, v2 and v3", () => {
    const b = bundleOrThrow(loadTestBundle());
    const mealVersion = (l: "v1" | "v2" | "v3") =>
      b.ruleSets[l].rules.find((r) => r.ruleId === "meal-limit")?.ruleVersion;
    expect(mealVersion("v1")).toBe("1.0.0");
    expect(mealVersion("v2")).toBe("2.0.0");
    expect(mealVersion("v3")).toBe("3.0.0");
  });

  it("returns a Core error for a missing rule reference", () => {
    const rules = { ...readRuleDir("rules") };
    delete rules["meal-limit-v2.json"];
    const r = buildBundle(rules, readRuleDir("rule-sets"));
    expect(isCoreError(r)).toBe(true);
    if (isCoreError(r)) expect(r.kind).toBe("rule_not_found");
  });

  it("returns a Core error for an invalid rule file", () => {
    const rules = { ...readRuleDir("rules"), "broken.json": { id: 42 } };
    const r = buildBundle(rules, readRuleDir("rule-sets"));
    expect(isCoreError(r)).toBe(true);
    if (isCoreError(r)) expect(r.kind).toBe("invalid_rule_schema");
  });

  it("loadBundle (Vite glob) equals loadTestBundle (node:fs)", () => {
    const a = bundleOrThrow(loadBundle());
    const b = bundleOrThrow(loadTestBundle());
    expect(a).toEqual(b);
  });
});
