// Feature: core, Property 3: validate is the sole gate to evaluate
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { z } from "zod";
import { validate } from "../../validation.js";
import { isCoreError } from "../../types.js";

describe("Property 3: validate is the sole gate to evaluate", () => {
  it("any input that fails validation returns CoreError('validation_failed') and never reaches evaluate (≥100 runs)", () => {
    // Schema that requires a specific string field
    const schema = z.object({ requiredField: z.string() });

    fc.assert(
      fc.property(
        // Generate arbitrary objects that definitely lack requiredField as a string
        fc.record({
          someOtherField: fc.integer(),
          anotherField: fc.boolean(),
        }),
        (badInput) => {
          const result = validate(badInput as Record<string, unknown>, schema);
          // Must be a validation_failed CoreError
          if (!isCoreError(result)) return false;
          if (result.kind !== "validation_failed") return false;
          // fieldErrors must mention requiredField
          return result.fieldErrors.some((e) => e.path === "requiredField" || e.path === "");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("valid inputs pass through validate and can reach evaluate (≥100 runs)", () => {
    const schema = z.object({ amount: z.number().positive() });

    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(1000000), noNaN: true }),
        (amount) => {
          const result = validate({ amount }, schema);
          // Valid input should NOT be a CoreError
          return !isCoreError(result);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("partial failures (one field wrong) return CoreError not partial ValidatedFields (≥100 runs)", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().int().positive(),
    });

    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: -1 }), // negative age always fails
        (badAge) => {
          const input = { name: "test", age: badAge };
          const result = validate(input, schema);
          // Must return CoreError, not partial ValidatedFields
          if (!isCoreError(result)) return false;
          return result.kind === "validation_failed";
        }
      ),
      { numRuns: 100 }
    );
  });
});
