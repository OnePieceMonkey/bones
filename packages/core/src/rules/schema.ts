import { z } from "zod";
import type { Rule, RuleSet, CoreError } from "../types.js";

const SEMVER = /^\d+\.\d+\.\d+$/;
const id = z.string().min(1).max(128);
const pathSegments = z.array(z.string().min(1)).min(1).max(10);
const literalOrPath = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("literal"), value: z.unknown() }).strict(),
  z.object({ kind: z.literal("path"), segments: pathSegments }).strict(),
]);

export const conditionNodeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("comparison"),
      left: literalOrPath,
      op: z.enum(["==", "!=", "<", "<=", ">", ">="]),
      right: literalOrPath,
    })
    .strict(),
  z.object({ kind: z.literal("sum"), collection: z.string().min(1), field: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal("date_in_range"),
      dateField: z.string().min(1),
      startField: z.string().min(1),
      endField: z.string().min(1),
    })
    .strict(),
  z.object({ kind: z.literal("membership"), valueField: z.string().min(1), set: z.array(z.unknown()) }).strict(),
]);

const amountOrNode = z.union([z.number().int().nonnegative(), conditionNodeSchema]);

export const ruleSchema = z
  .object({
    id,
    version: z.string().regex(SEMVER),
    effect: z.enum(["blocking", "capping", "deducting"]),
    condition: conditionNodeSchema,
    effectConfig: z.union([
      z.object({}).strict(),
      z.object({ cap: amountOrNode, scope: z.string().min(1) }).strict(),
      z.object({ deductionAmount: amountOrNode, scope: z.string().min(1) }).strict(),
    ]),
    messageTemplate: z.string().max(1024),
  })
  .strict();

export const ruleSetSchema = z
  .object({
    id,
    version: z.string().regex(SEMVER),
    rules: z.array(z.object({ ruleId: id, ruleVersion: z.string().regex(SEMVER) }).strict()).max(200),
    currencySymbol: z.string().min(1).max(4).optional(),
  })
  .strict();

function fieldErrorsOf(error: z.ZodError): { path: string; issue: string }[] {
  return error.issues.map((i) => ({ path: i.path.join("."), issue: i.message }));
}

/** Pure. Never throws. */
export function parseRule(input: unknown): Rule | CoreError {
  try {
    const r = ruleSchema.safeParse(input);
    if (r.success) return r.data as Rule;
    return {
      kind: "invalid_rule_schema",
      message: "Rule does not match the rule schema.",
      fieldErrors: fieldErrorsOf(r.error),
    };
  } catch (e) {
    return {
      kind: "invalid_rule_schema",
      message: "Rule could not be parsed.",
      fieldErrors: [{ path: "", issue: e instanceof Error ? e.message : String(e) }],
    };
  }
}

/** Pure. Never throws. */
export function parseRuleSet(input: unknown): RuleSet | CoreError {
  try {
    const r = ruleSetSchema.safeParse(input);
    if (r.success) return r.data as RuleSet;
    return {
      kind: "invalid_rule_set_schema",
      message: "Rule set does not match the rule set schema.",
      fieldErrors: fieldErrorsOf(r.error),
    };
  } catch (e) {
    return {
      kind: "invalid_rule_set_schema",
      message: "Rule set could not be parsed.",
      fieldErrors: [{ path: "", issue: e instanceof Error ? e.message : String(e) }],
    };
  }
}
