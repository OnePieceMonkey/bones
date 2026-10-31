import type {
  ValidatedFields,
  RuleSet,
  RuleCatalog,
  AmountScope,
  Decision,
  DecisionResult,
  RuleOutcome,
  Rule,
  CoreError,
  CappingConfig,
  DeductingConfig,
} from "../types.js";
import { evaluateCondition, getPath } from "./ast.js";
import { isCoreError } from "../types.js";

/** Renders a messageTemplate by substituting {{fieldPath}} slots with field values. Missing paths → "". */
function renderTemplate(template: string, fields: ValidatedFields): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const val = getPath(fields, path.trim());
    return val === undefined ? "" : String(val);
  });
}

/**
 * Pure rule evaluation function. No I/O, no randomness, no current time.
 * Same inputs always produce the same Decision.
 *
 * Algorithm:
 * 1. Resolve all rule refs from catalog (fail fast on missing).
 * 2. Partition into blocking / deducting / capping; sort each bucket by rule.id.
 * 3. Blocking pass: first-fail-wins → "rejected".
 * 4. Deducting pass: subtract deductionAmount per scope, clamp ≥ 0.
 * 5. Capping pass: lowest cap per scope wins, then clamp ≥ 0.
 * 6. Build Decision: "partially_approved" if any scope reduced, else "approved".
 */
export function evaluate(
  fields: ValidatedFields,
  ruleSet: RuleSet,
  catalog: RuleCatalog,
  amountScopes: AmountScope[]
): Decision | CoreError {
  // ── Step 1: Resolve all rule refs ──────────────────────────────────────────
  const resolved: Rule[] = [];
  for (const ref of ruleSet.rules) {
    const key = `${ref.ruleId}@${ref.ruleVersion}`;
    const rule = catalog.get(key);
    if (!rule) {
      return {
        kind: "rule_not_found",
        message: `Rule not found in catalog: ${key}`,
        ruleId: ref.ruleId,
        ruleVersion: ref.ruleVersion,
      };
    }
    resolved.push(rule);
  }

  // ── Step 2: Partition and sort by id (deterministic regardless of RuleSet order) ──
  const blocking = resolved
    .filter((r) => r.effect === "blocking")
    .sort((a, b) => a.id.localeCompare(b.id));
  const deducting = resolved
    .filter((r) => r.effect === "deducting")
    .sort((a, b) => a.id.localeCompare(b.id));
  const capping = resolved
    .filter((r) => r.effect === "capping")
    .sort((a, b) => a.id.localeCompare(b.id));

  const outcomes: RuleOutcome[] = [];
  // Mutable scope amounts (integer cents), keyed by scope name
  const scopeAmounts = new Map<string, number>(
    amountScopes.map((s) => [s.name, s.claimedCents])
  );

  // ── Step 3: Blocking pass (first-fail-wins) ────────────────────────────────
  for (const rule of blocking) {
    const condResult = evaluateCondition(rule.condition, fields);
    if (isCoreError(condResult)) return condResult;
    const { result: conditionMet, evidence } = condResult;
    const renderedMessage = renderTemplate(rule.messageTemplate, fields);
    outcomes.push({
      ruleId: rule.id,
      ruleVersion: rule.version,
      effect: rule.effect,
      conditionMet,
      evidence,
      renderedMessage,
    });
    if (conditionMet) {
      return { result: "rejected", amountCents: 0, ruleOutcomes: outcomes };
    }
  }

  // ── Step 4: Deducting pass ─────────────────────────────────────────────────
  for (const rule of deducting) {
    const condResult = evaluateCondition(rule.condition, fields);
    if (isCoreError(condResult)) return condResult;
    const { result: conditionMet, evidence } = condResult;
    const renderedMessage = renderTemplate(rule.messageTemplate, fields);
    const config = rule.effectConfig as DeductingConfig;
    let deductedCents: number | undefined;

    if (conditionMet) {
      const scope = config.scope;
      const current = scopeAmounts.get(scope) ?? 0;
      const next = Math.max(0, current - config.deductionAmount);
      scopeAmounts.set(scope, next);
      deductedCents = config.deductionAmount;
    }

    outcomes.push({
      ruleId: rule.id,
      ruleVersion: rule.version,
      effect: rule.effect,
      conditionMet,
      evidence,
      renderedMessage,
      ...(deductedCents !== undefined ? { deductedCents } : {}),
    });
  }

  // ── Step 5: Capping pass (lowest cap per scope wins) ──────────────────────
  const minCapsPerScope = new Map<string, number>();

  for (const rule of capping) {
    const condResult = evaluateCondition(rule.condition, fields);
    if (isCoreError(condResult)) return condResult;
    const { result: conditionMet, evidence } = condResult;
    const renderedMessage = renderTemplate(rule.messageTemplate, fields);
    const config = rule.effectConfig as CappingConfig;
    let appliedCapCents: number | undefined;

    if (conditionMet) {
      let capCents: number;
      if (typeof config.cap === "number") {
        capCents = config.cap;
      } else {
        // Dynamic cap: evaluate the AST expression
        const capResult = evaluateCondition(config.cap, fields);
        if (isCoreError(capResult)) return capResult;
        // Find the computed sum in evidence (keyed with "_sum" suffix from ast.ts)
        const ev = capResult.evidence;
        const sumKey = Object.keys(ev).find((k) => k.includes("_sum"));
        if (sumKey !== undefined) {
          capCents = Number(ev[sumKey]);
        } else {
          // Fall back: first numeric value in evidence
          const numVal = Object.values(ev).find((v) => typeof v === "number");
          capCents = typeof numVal === "number" ? numVal : 0;
        }
      }

      const scope = config.scope;
      const existing = minCapsPerScope.get(scope);
      if (existing === undefined || capCents < existing) {
        minCapsPerScope.set(scope, capCents);
      }
      appliedCapCents = capCents;
    }

    outcomes.push({
      ruleId: rule.id,
      ruleVersion: rule.version,
      effect: rule.effect,
      conditionMet,
      evidence,
      renderedMessage,
      ...(appliedCapCents !== undefined ? { appliedCapCents } : {}),
    });
  }

  // Apply minimum caps
  for (const [scope, cap] of minCapsPerScope) {
    const current = scopeAmounts.get(scope) ?? 0;
    scopeAmounts.set(scope, Math.min(current, Math.max(0, cap)));
  }

  // ── Step 6: Build Decision ─────────────────────────────────────────────────
  let totalAmountCents = 0;
  let anyReduced = false;

  for (const scope of amountScopes) {
    const final = scopeAmounts.get(scope.name) ?? scope.claimedCents;
    const clamped = Math.max(0, Math.min(final, scope.claimedCents));
    totalAmountCents += clamped;
    if (clamped < scope.claimedCents) anyReduced = true;
  }

  const result: DecisionResult = anyReduced ? "partially_approved" : "approved";
  return { result, amountCents: totalAmountCents, ruleOutcomes: outcomes };
}
