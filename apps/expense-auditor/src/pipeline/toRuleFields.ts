import { validate } from "@bones/core";
import type { CoreError, ProposedFields } from "@bones/core";
import type { TripWindow } from "../extraction/samples";
import { ruleFieldsOutputSchema, ruleFieldsSchema, tripIssues } from "./schema";
import type { RuleFields } from "./schema";

type FieldErrors = { path: string; issue: string }[];

function failed(fieldErrors: FieldErrors): CoreError {
  return {
    kind: "validation_failed",
    message: `Validation failed with ${fieldErrors.length} error(s)`,
    fieldErrors,
  };
}

function isCoreFailure(r: unknown): r is CoreError & { kind: "validation_failed"; fieldErrors: FieldErrors } {
  return (
    typeof r === "object" &&
    r !== null &&
    (r as { kind?: unknown }).kind === "validation_failed" &&
    Array.isArray((r as { fieldErrors?: unknown }).fieldErrors)
  );
}

/** Validates proposed fields through Core `validate` and derives the rule fields. */
export function toRuleFields(proposed: ProposedFields, trip: TripWindow): RuleFields | CoreError {
  const r = validate(proposed, ruleFieldsSchema(trip));
  const extra = tripIssues(trip);
  if (isCoreFailure(r)) return failed([...r.fieldErrors, ...extra]);
  if (extra.length > 0) return failed(extra);
  return r as unknown as RuleFields;
}

/** True when `v` already has the derived rule-fields shape. */
export function isRuleFields(v: unknown): v is RuleFields {
  return ruleFieldsOutputSchema.safeParse(v).success;
}
