import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRule, parseRuleSet } from "../rules/schema.js";
import { isCoreError } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..", "..");
const load = (sub: string, name: string): any =>
  JSON.parse(readFileSync(join(repoRoot, "rules/expense-auditor", sub, `${name}.json`), "utf8"));

const RULE_FILES = [
  "alcohol-deducting",
  "date-blocking-after",
  "date-blocking-before",
  "line-item-cap",
  "meal-limit-v1",
  "meal-limit-v2",
  "meal-limit-v3",
];
const RULE_SET_FILES = ["expense-v1", "expense-v2", "expense-v3"];

describe("rule schemas: real rule files", () => {
  for (const name of RULE_FILES) {
    it(`parseRule accepts ${name}`, () => {
      const r = parseRule(load("rules", name));
      expect(isCoreError(r)).toBe(false);
    });
  }
  for (const name of RULE_SET_FILES) {
    it(`parseRuleSet accepts ${name}`, () => {
      const r = parseRuleSet(load("rule-sets", name));
      expect(isCoreError(r)).toBe(false);
    });
  }
});

describe("rule set currencySymbol", () => {
  const base = () => load("rule-sets", "expense-v1");
  for (const bad of ["", "ABCDE", 5]) {
    it(`rejects ${JSON.stringify(bad)}`, () => {
      const r = parseRuleSet({ ...base(), currencySymbol: bad });
      expect(isCoreError(r)).toBe(true);
      expect((r as any).kind).toBe("invalid_rule_set_schema");
    });
  }
  for (const ok of ["$", "EUR", "CHF.", "ABCD"]) {
    it(`accepts ${JSON.stringify(ok)}`, () => {
      expect(isCoreError(parseRuleSet({ ...base(), currencySymbol: ok }))).toBe(false);
    });
  }
  it("accepts a rule set without currencySymbol", () => {
    expect(isCoreError(parseRuleSet(base()))).toBe(false);
  });
});

describe("rule schemas: failures", () => {
  it("rejects unknown keys on rules and rule sets", () => {
    const rule = parseRule({ ...load("rules", "meal-limit-v1"), extra: 1 });
    expect((rule as any).kind).toBe("invalid_rule_schema");
    const set = parseRuleSet({ ...load("rule-sets", "expense-v1"), extra: 1 });
    expect((set as any).kind).toBe("invalid_rule_set_schema");
  });

  it("rejects a bad effect with invalid_rule_schema", () => {
    const r = parseRule({ ...load("rules", "meal-limit-v1"), effect: "exploding" });
    expect(isCoreError(r)).toBe(true);
    expect((r as any).kind).toBe("invalid_rule_schema");
  });

  it("reports fieldErrors with dotted paths", () => {
    const rule = load("rules", "line-item-cap");
    rule.condition.left.segments = [];
    const r = parseRule(rule) as any;
    expect(r.kind).toBe("invalid_rule_schema");
    expect(r.fieldErrors.map((e: any) => e.path)).toContain("condition.left.segments");
    expect(r.fieldErrors[0].issue).toEqual(expect.any(String));

    const set = load("rule-sets", "expense-v1");
    set.rules[1].ruleVersion = "x";
    const s = parseRuleSet(set) as any;
    expect(s.fieldErrors.map((e: any) => e.path)).toContain("rules.1.ruleVersion");
  });

  it("never throws on undefined, null or a string", () => {
    for (const input of [undefined, null, "text"]) {
      expect(() => parseRule(input)).not.toThrow();
      expect(() => parseRuleSet(input)).not.toThrow();
      const a = parseRule(input);
      const b = parseRuleSet(input);
      expect(isCoreError(a)).toBe(true);
      expect(isCoreError(b)).toBe(true);
      expect((a as any).kind).toBe("invalid_rule_schema");
      expect((b as any).kind).toBe("invalid_rule_set_schema");
    }
  });
});
