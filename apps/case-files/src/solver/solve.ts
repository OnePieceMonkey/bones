import { evaluate, isCoreError } from "@bones/core";
import type { CoreError, RuleOutcome, ValidatedFields } from "@bones/core";
import type { DerivedCase } from "../derive/factDeriver";
import { bindRuleSet } from "../rules/binder";
import type { Binding } from "../rules/binder";
import type { RuleBundle, VersionLabel } from "../rules/catalog";

/**
 * Solver. Pure: binds the template Rule_Set, runs core `evaluate` once and classifies
 * every suspect from `decision.ruleOutcomes` only. The input is a DerivedCase, so no
 * confidence value can reach it. No clock, no randomness, no I/O.
 */
export type { VersionLabel };

export const NO_CONTRADICTED_STATEMENT = "no-contradicted-statement";

export interface SolverProof {
  suspectId: string;
  convictable: boolean;
  proof: RuleOutcome[];
  missing: string[];
}

export type SolverReason =
  | { code: "one"; suspectId: string }
  | { code: "none"; closestSuspectId: string; missing: string[] }
  | { code: "many"; suspectIds: string[] };

export interface SolveResult {
  ruleSetVersion: string;
  outcomes: RuleOutcome[];
  suspects: SolverProof[];
  convictable: string[];
  verdict: "accepted" | "unfair_none" | "unfair_many";
  reasons: SolverReason[];
}

export function solve(
  derivedCase: DerivedCase,
  versionLabel: VersionLabel,
  bundle: RuleBundle,
): SolveResult | CoreError {
  const template = bundle.templateRuleSets[versionLabel];
  const bound = bindRuleSet(template, bundle.templateCatalog, derivedCase);
  if (isCoreError(bound)) return bound;

  const decision = evaluate(derivedCase as unknown as ValidatedFields, bound.ruleSet, bound.catalog, bound.amountScopes);
  if (isCoreError(decision)) return decision;
  const outcomes = decision.ruleOutcomes;

  // Required proof instances per suspect, in the order the binder produced them.
  const requiredBySuspect = new Map<string, string[]>();
  for (const ref of bound.ruleSet.rules) {
    const b: Binding | undefined = bound.bindings.get(ref.ruleId);
    if (b === undefined || b.kind !== "suspect") continue;
    const list = requiredBySuspect.get(b.suspectId) ?? [];
    list.push(ref.ruleId);
    requiredBySuspect.set(b.suspectId, list);
  }

  const suspects: SolverProof[] = derivedCase.suspects.map((s) => {
    const required = requiredBySuspect.get(s.id) ?? [];
    const proof: RuleOutcome[] = [];
    const firedProof = new Set<string>();
    let firedStatement = 0;
    for (const o of outcomes) {
      const b = bound.bindings.get(o.ruleId);
      if (b === undefined || b.suspectId !== s.id) continue;
      proof.push(o);
      if (!o.conditionMet) continue;
      if (b.kind === "suspect") firedProof.add(o.ruleId);
      else firedStatement += 1;
    }
    const missing = required.filter((id) => !firedProof.has(id));
    if (firedStatement === 0) missing.push(NO_CONTRADICTED_STATEMENT);
    return { suspectId: s.id, convictable: missing.length === 0, proof, missing };
  });

  const convictable = suspects.filter((p) => p.convictable).map((p) => p.suspectId);
  const verdict = convictable.length === 1 ? "accepted" : convictable.length === 0 ? "unfair_none" : "unfair_many";

  let reasons: SolverReason[];
  if (verdict === "accepted") {
    reasons = [{ code: "one", suspectId: convictable[0]! }];
  } else if (verdict === "unfair_many") {
    reasons = [{ code: "many", suspectIds: [...convictable] }];
  } else {
    let best: SolverProof | undefined;
    for (const p of suspects) {
      if (best === undefined || p.missing.length < best.missing.length) best = p;
    }
    reasons = best === undefined ? [] : [{ code: "none", closestSuspectId: best.suspectId, missing: [...best.missing] }];
  }

  return { ruleSetVersion: template.version, outcomes, suspects, convictable, verdict, reasons };
}
