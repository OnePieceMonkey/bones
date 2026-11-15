import type { AmountScope, CoreError, Trace } from "@bones/core";
import { isRuleFields } from "./toRuleFields";

/** One scope, "total": the claimed total of the receipt. */
export function amountScopesFor(fields: { claimedTotalCents: number }): AmountScope[] {
  return [{ name: "total", claimedCents: fields.claimedTotalCents }];
}

/** Same scopes from a stored trace, or `validation_failed` when its fields lack the derived shape. */
export function amountScopesForTrace(trace: Trace): AmountScope[] | CoreError {
  const fields: unknown = trace.validatedFields;
  if (isRuleFields(fields)) return amountScopesFor(fields);
  return {
    kind: "validation_failed",
    message: "Validation failed with 1 error(s)",
    fieldErrors: [{ path: "validatedFields", issue: "trace does not hold valid rule fields" }],
  };
}
