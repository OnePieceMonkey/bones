import type { AmountScope, ConditionNode, CoreError, Rule, RuleCatalog, RuleRef, RuleSet } from "@bones/core";
import type { DerivedCase } from "../derive/factDeriver";

/**
 * Rule_Binder. Pure: turns a template Rule_Set into an instance Rule_Set, one rule per
 * suspect (`proof-*`) or per statement (`statement-<kind>-contradicted`).
 * No clock, no randomness, no I/O.
 */

export interface Binding {
  kind: "suspect" | "statement";
  suspectId: string;
  statementId?: string;
}

export interface BoundRuleSet {
  ruleSet: RuleSet;
  catalog: RuleCatalog;
  /** Keyed by instance rule id. */
  bindings: Map<string, Binding>;
  amountScopes: AmountScope[];
}

const MAX_REFS = 200;
const MAX_ID = 128;
const PROOF_RE = /^proof-(means|opportunity|motive)$/;
const STATEMENT_RE = /^statement-(location|possession|sighting)-contradicted$/;

function invalid(message: string, path: string, issue: string): CoreError {
  return { kind: "invalid_rule_schema", message, fieldErrors: [{ path, issue }] };
}

type Prefix = readonly string[];

function rewriteSide<T extends { kind: string }>(side: T, prefix: Prefix, ruleId: string): T | CoreError {
  if (side.kind !== "path") return side;
  const segments = (side as unknown as { segments: string[] }).segments;
  if (segments[0] !== "subject") {
    return invalid(`Template ${ruleId} has a path root other than "subject".`, `${ruleId}.condition`, "path root must be subject");
  }
  return { ...side, segments: [...prefix, ...segments.slice(1)] } as T;
}

function isErr(v: unknown): v is CoreError {
  return typeof v === "object" && v !== null && "fieldErrors" in v;
}

function rewriteCondition(node: ConditionNode, prefix: Prefix, ruleId: string): ConditionNode | CoreError {
  if (node.kind !== "comparison") {
    return invalid(`Template ${ruleId} uses a condition other than comparison.`, `${ruleId}.condition`, "only comparison is allowed");
  }
  const left = rewriteSide(node.left, prefix, ruleId);
  if (isErr(left)) return left;
  const right = rewriteSide(node.right, prefix, ruleId);
  if (isErr(right)) return right;
  return { ...node, left, right };
}

function rewriteMessage(template: string, prefix: Prefix, ruleId: string): string | CoreError {
  let bad = false;
  const out = template.replace(/\{\{\s*([^}]*?)\s*\}\}/g, (_m, inner: string) => {
    const [pathPart, ...filter] = inner.split("|");
    const path = (pathPart ?? "").trim();
    if (path !== "subject" && !path.startsWith("subject.")) {
      bad = true;
      return _m;
    }
    const rewritten = [...prefix, ...path.split(".").slice(1)].join(".");
    return filter.length > 0 ? `{{${rewritten} | ${filter.join("|").trim()}}}` : `{{${rewritten}}}`;
  });
  if (bad) {
    return invalid(`Template ${ruleId} has a slot that does not start with subject.`, `${ruleId}.messageTemplate`, "slot root must be subject");
  }
  return out;
}

function instantiate(
  template: Rule,
  targetId: string,
  prefix: Prefix,
  scope: "proof" | "credibility",
): Rule | CoreError {
  const id = `${template.id}:${targetId}`;
  if (id.length > MAX_ID) return invalid(`Instance id ${id} is longer than ${MAX_ID} characters.`, id, "instance id too long");
  if (template.effect !== "deducting") {
    return invalid(`Template ${template.id} must be deducting.`, `${template.id}.effect`, "effect must be deducting");
  }
  const condition = rewriteCondition(template.condition, prefix, template.id);
  if (isErr(condition)) return condition;
  const messageTemplate = rewriteMessage(template.messageTemplate, prefix, template.id);
  if (typeof messageTemplate !== "string") return messageTemplate;
  const cfg = template.effectConfig as { deductionAmount?: unknown };
  return {
    ...template,
    id,
    condition,
    effectConfig: { deductionAmount: (cfg.deductionAmount as number) ?? 1, scope },
    messageTemplate,
  };
}

export function bindRuleSet(
  templateRuleSet: RuleSet,
  templateCatalog: RuleCatalog,
  derivedCase: DerivedCase,
): BoundRuleSet | CoreError {
  const refs: RuleRef[] = [];
  const catalog: RuleCatalog = new Map<string, Rule>();
  const bindings = new Map<string, Binding>();
  let proofCount = 0;
  let credibilityCount = 0;

  const add = (rule: Rule, binding: Binding): void => {
    refs.push({ ruleId: rule.id, ruleVersion: rule.version });
    catalog.set(`${rule.id}@${rule.version}`, rule);
    bindings.set(rule.id, binding);
  };

  for (const ref of templateRuleSet.rules) {
    const template = templateCatalog.get(`${ref.ruleId}@${ref.ruleVersion}`);
    if (template === undefined) {
      return {
        kind: "rule_not_found",
        message: `Rule ${ref.ruleId}@${ref.ruleVersion} was not found.`,
        ruleId: ref.ruleId,
        ruleVersion: ref.ruleVersion,
      };
    }
    const proof = PROOF_RE.test(template.id);
    const statement = STATEMENT_RE.exec(template.id);
    if (proof) {
      for (let i = 0; i < derivedCase.suspects.length; i++) {
        const suspect = derivedCase.suspects[i]!;
        const inst = instantiate(template, suspect.id, ["suspects", String(i)], "proof");
        if (isErr(inst)) return inst;
        add(inst, { kind: "suspect", suspectId: suspect.id });
        proofCount += 1;
      }
    } else if (statement !== null) {
      const kind = statement[1];
      for (let i = 0; i < derivedCase.suspects.length; i++) {
        const suspect = derivedCase.suspects[i]!;
        for (let j = 0; j < suspect.statements.length; j++) {
          const st = suspect.statements[j]!;
          if (st.kind !== kind) continue;
          const inst = instantiate(template, st.id, ["suspects", String(i), "statements", String(j)], "credibility");
          if (isErr(inst)) return inst;
          add(inst, { kind: "statement", suspectId: suspect.id, statementId: st.id });
          credibilityCount += 1;
        }
      }
    } else {
      return invalid(`Template id ${template.id} is not a known case rule.`, template.id, "id does not match a known pattern");
    }
  }

  if (refs.length > MAX_REFS) {
    return {
      kind: "invalid_rule_set_schema",
      message: `The bound rule set has ${refs.length} references, the limit is ${MAX_REFS}.`,
      fieldErrors: [{ path: "rules", issue: "too many rule references" }],
    };
  }

  const amountScopes: AmountScope[] = [];
  if (proofCount > 0) amountScopes.push({ name: "proof", claimedCents: proofCount });
  if (credibilityCount > 0) amountScopes.push({ name: "credibility", claimedCents: credibilityCount });

  return {
    ruleSet: { id: templateRuleSet.id, version: templateRuleSet.version, rules: refs },
    catalog,
    bindings,
    amountScopes,
  };
}
