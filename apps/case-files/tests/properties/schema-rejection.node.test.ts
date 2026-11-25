import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validate } from "@bones/core";
import { modelOutputSchema } from "../../src/pipeline/schema";
import { MUTATION_KINDS, mutate, validModelOutputArb } from "../helpers/arbitraries";

describe("Case_Schema rejects limit violations", () => {
  // Feature: case-files, Property 2: Case_Schema rejects every limit violation
  // **Validates: Requirements 2.6, 2.7, 2.8, 2.9, 2.10, 2.11**
  for (const kind of MUTATION_KINDS) {
    it(`rejects ${kind} with an issue at the violated field`, () => {
      fc.assert(
        fc.property(validModelOutputArb, fc.nat(1000), fc.nat(1000), (valid, a, b) => {
          expect("kind" in validate(valid, modelOutputSchema)).toBe(false);
          const m = mutate(valid, kind, a, b);
          const result = validate(m.output, modelOutputSchema);
          expect("kind" in result && result.kind === "validation_failed").toBe(true);
          if ("kind" in result && result.kind === "validation_failed") {
            expect(result.fieldErrors.map((e) => e.path)).toContain(m.path);
          }
        }),
        { numRuns: 100 },
      );
    });
  }
});
