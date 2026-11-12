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
 * 4. Capping pass (by rule.id): running amount = max(0, min(running, cap)).
 * 5. Deducting pass (by rule.id): running amount = max(0, running - deduction).
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

  // ── Step 4: Capping pass (before deducting; running amount per scope) ─────
  for (const rule of capping) {
    const condResult = evaluateCondition(rule.condition, fields);
    if (isCoreError(condResult)) return condResult;
    const { result: conditionMet, evidence } = condResult;
    const renderedMessage = renderTemplate(rule.messageTemplate, fields);
    const config = rule.effectConfig as CappingConfig;
    const scope = config.scope;
    const before = scopeAmounts.get(scope) ?? 0;
    let after = before;
    let appliedCapCents: number | undefined;

    if (conditionMet) {
      let capCents: number;
      if (typeof config.cap === "number") {
        capCents = config.cap;
      } else {
        // Dynamic cap: evaluate the AST expression
        const capResult = evaluateCondition(config.cap, fields);
        if (isCoreError(capResult)) return capResult;
        const ev = capResult.evidence;
        const sumKey = Object.keys(ev).find((k) => k.includes("_sum"));
        if (sumKey !== undefined) {
          capCents = Number(ev[sumKey]);
        } else {
          const numVal = Object.values(ev).find((v) => typeof v === "number");
          capCents = typeof numVal === "number" ? numVal : 0;
        }
      }
      after = Math.max(0, Math.min(before, capCents));
      scopeAmounts.set(scope, after);
      appliedCapCents = capCents;
    }

    outcomes.push({
      ruleId: rule.id,
      ruleVersion: rule.version,
      effect: rule.effect,
      conditionMet,
      evidence,
      renderedMessage,
      amountBeforeCents: before,
      amountAfterCents: after,
      ...(appliedCapCents !== undefined ? { appliedCapCents } : {}),
    });
  }

  // ── Step 5: Deducting pass ─────────────────────────────────────────────────
  for (const rule of deducting) {
    const condResult = evaluateCondition(rule.condition, fields);
    if (isCoreError(condResult)) return condResult;
    const { result: conditionMet, evidence } = condResult;
    const renderedMessage = renderTemplate(rule.messageTemplate, fields);
    const config = rule.effectConfig as DeductingConfig;
    const scope = config.scope;
    const before = scopeAmounts.get(scope) ?? 0;
    let after = before;
    let deductedCents: number | undefined;

    if (conditionMet) {
      let deductAmount: number;
      if (typeof config.deductionAmount === "number") {
        deductAmount = config.deductionAmount;
      } else {
        // Dynamic deductionAmount: evaluate the AST expression
        const deductResult = evaluateCondition(config.deductionAmount, fields);
        if (isCoreError(deductResult)) return deductResult;
        const ev = deductResult.evidence;
        const sumKey = Object.keys(ev).find((k) => k.includes("_sum"));
        if (sumKey !== undefined) {
          deductAmount = Number(ev[sumKey]);
        } else {
          const numVal = Object.values(ev).find((v) => typeof v === "number");
          deductAmount = typeof numVal === "number" ? numVal : 0;
        }
      }
      after = Math.max(0, before - deductAmount);
      scopeAmounts.set(scope, after);
      deductedCents = deductAmount;
    }

    outcomes.push({
      ruleId: rule.id,
      ruleVersion: rule.version,
      effect: rule.effect,
      conditionMet,
      evidence,
      renderedMessage,
      amountBeforeCents: before,
      amountAfterCents: after,
      ...(deductedCents !== undefined ? { deductedCents } : {}),
    });
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
