import { z } from "zod";
import type { ProposedFields, ValidatedFields, CoreError } from "./types.js";

/**
 * Validates proposed fields against an app-supplied Zod schema.
 * Returns ValidatedFields on success, or a CoreError on any validation failure.
 * This is the SOLE entry gate to evaluate() — never pass un-validated fields to the evaluator.
 */
export function validate(
  proposedFields: ProposedFields,
  schema: z.ZodTypeAny
): ValidatedFields | CoreError {
  // Guard: schema must be a Zod schema object
  if (typeof (schema as { parse?: unknown })?.parse !== "function") {
    return {
      kind: "validation_failed",
      message: "Invalid schema object provided: expected a Zod schema",
      fieldErrors: [],
    };
  }

  const result = schema.safeParse(proposedFields);

  if (result.success) {
    return result.data as ValidatedFields;
  }

  const fieldErrors = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    issue: issue.message,
  }));

  return {
    kind: "validation_failed",
    message: `Validation failed with ${fieldErrors.length} error(s)`,
    fieldErrors,
  };
}
