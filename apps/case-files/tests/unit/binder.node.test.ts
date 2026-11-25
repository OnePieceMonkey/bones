import { isCoreError, parseRule, parseRuleSet } from "@bones/core";
import type { Rule, RuleCatalog } from "@bones/core";
import { describe, expect, it } from "vitest";
import { deriveFacts } from "../../src/derive/factDeriver";
import type { DerivedCase } from "../../src/derive/factDeriver";
import { caseFieldsSchema, extractCaseFields } from "../../src/pipeline/schema";
import { bindRuleSet } from "../../src/rules/binder";
import type { BoundRuleSet } from "../../src/rules/binder";
import type { RuleBundle } from "../../src/rules/catalog";
import { loadTestBundle, readRecorded } from "../helpers/fixtures";

const loaded = loadTestBundle();
if (isCoreError(loaded)) throw new Error(JSON.stringify(loaded));
const bundle: RuleBundle = loaded;

function derived(id: string): DerivedCase {
  const file = readRecorded().find((f) => f.json.id === id);
  if (!file) throw new Error(`missing ${id}`);
  return deriveFacts(caseFieldsSchema.parse(extractCaseFields(file.json.extraction.proposedFields)));
}

function bind(label: "v1" | "v2" | "v3", d: DerivedCase): BoundRuleSet {
  const r = bindRuleSet(bundle.templateRuleSets[label], bundle.templateCatalog, d);
  if (isCoreError(r)) throw new Error(JSON.stringify(r));
  return r;
}

function rule(b: BoundRuleSet, id: string): Rule {
  const r = b.catalog.get(`${id}@${b.ruleSet.rules.find((x) => x.ruleId === id)!.ruleVersion}`);
  if (!r) throw new Error(`no rule ${id}`);
  return r;
}

describe("Rule_Binder", () => {
  it("rewrites paths and slots for suspect index 2 and statement index 1", () => {
    const d = derived("greenhouse");
    // Build a case with a second statement on the third suspect.
    const third = d.suspects[2]!;
    const extra = { ...third.statements[0]!, id: "extra-stmt" };
    const custom: DerivedCase = {
      ...d,
      suspects: d.suspects.map((s, i) => (i === 2 ? { ...s, statements: [...s.statements, extra] } : s)),
    };
    const b = bind("v3", custom);
    const proof = rule(b, `proof-means:${third.id}`);
    expect(proof.condition).toMatchObject({ left: { segments: ["suspects", "2", "meansFirm"] } });
    expect(proof.messageTemplate).toContain("{{suspects.2.name}}");
    expect(proof.messageTemplate).not.toContain("subject");
    const st = rule(b, `statement-${extra.kind}-contradicted:extra-stmt`);
    expect(st.condition).toMatchObject({
      left: { segments: ["suspects", "2", "statements", "1", "conflictsFirm"] },
    });
    expect(st.messageTemplate).toContain("{{suspects.2.statements.1.authorName}}");
    expect(b.bindings.get(`proof-means:${third.id}`)).toEqual({ kind: "suspect", suspectId: third.id });
    expect(b.bindings.get(st.id)).toEqual({ kind: "statement", suspectId: third.id, statementId: "extra-stmt" });
  });

  it("sets scopes and amount scopes", () => {
    const b = bind("v1", derived("greenhouse"));
    for (const ref of b.ruleSet.rules) {
      const r = rule(b, ref.ruleId);
      const scope = (r.effectConfig as { scope: string }).scope;
      expect(scope).toBe(ref.ruleId.startsWith("proof-") ? "proof" : "credibility");
    }
    const proofN = b.ruleSet.rules.filter((r) => r.ruleId.startsWith("proof-")).length;
    expect(b.amountScopes.find((s) => s.name === "proof")?.claimedCents).toBe(proofN);
    expect(b.ruleSet.id).toBe("case-files");
    expect(b.ruleSet.version).toBe("1.0.0");
  });

  it("omits a scope without instances", () => {
    const d = derived("greenhouse");
    const noSightings = bundle.templateRuleSets.v1;
    const onlyProof = { ...noSightings, rules: noSightings.rules.filter((r) => r.ruleId.startsWith("proof-")) };
    const r = bindRuleSet(onlyProof, bundle.templateCatalog, d);
    if (isCoreError(r)) throw new Error(JSON.stringify(r));
    expect(r.amountScopes.map((s) => s.name)).toEqual(["proof"]);
  });

  it("returns invalid_rule_schema for a path root other than subject", () => {
    const tpl = bundle.templateCatalog.get("proof-means@1.0.0")!;
    const bad: Rule = JSON.parse(JSON.stringify(tpl));
    (bad.condition as { left: { segments: string[] } }).left.segments[0] = "other";
    const cat: RuleCatalog = new Map(bundle.templateCatalog).set("proof-means@1.0.0", bad);
    const r = bindRuleSet(bundle.templateRuleSets.v1, cat, derived("greenhouse"));
    expect(isCoreError(r) && r.kind).toBe("invalid_rule_schema");
  });

  it("returns invalid_rule_schema for an id outside the two patterns", () => {
    const tpl = bundle.templateCatalog.get("proof-means@1.0.0")!;
    const cat: RuleCatalog = new Map(bundle.templateCatalog).set("proof-means@1.0.0", { ...tpl, id: "proof-means" });
    cat.set("proof-means@1.0.0", { ...tpl, id: "weird-rule" });
    const set = {
      ...bundle.templateRuleSets.v1,
      rules: [{ ruleId: "proof-means", ruleVersion: "1.0.0" }],
    };
    const r = bindRuleSet(set, cat, derived("greenhouse"));
    expect(isCoreError(r) && r.kind).toBe("invalid_rule_schema");
  });

  it("passes core parseRuleSet and parseRule on the instances", () => {
    const b = bind("v3", derived("candlesticks"));
    expect(isCoreError(parseRuleSet(b.ruleSet))).toBe(false);
    for (const r of b.catalog.values()) expect(isCoreError(parseRule(r))).toBe(false);
  });
});
