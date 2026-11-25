import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validate } from "@bones/core";
import { modelOutputSchema } from "../../src/pipeline/schema";
import { validModelOutputArb } from "../helpers/arbitraries";

describe("Case_Schema round trip", () => {
  // Feature: case-files, Property 1: Case_Schema round trip
  // **Validates: Requirements 2.15**
  it("serialising, parsing and validating again gives an equal Case", () => {
    fc.assert(
      fc.property(validModelOutputArb, (output) => {
        const first = validate(output, modelOutputSchema);
        expect("kind" in first).toBe(false);
        const again = validate(JSON.parse(JSON.stringify(first)) as Record<string, unknown>, modelOutputSchema);
        expect(again).toEqual(first);
        expect(first).toEqual(output);
      }),
      { numRuns: 200 },
    );
  });
});
