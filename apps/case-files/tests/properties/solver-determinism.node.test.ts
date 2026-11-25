import { isCoreError } from "@bones/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deriveFacts } from "../../src/derive/factDeriver";
import { solve } from "../../src/solver/solve";
import { VERSION_LABELS } from "../../src/rules/catalog";
import { validCaseArb } from "../helpers/arbitraries";
import { loadTestBundle } from "../helpers/fixtures";

const bundle = loadTestBundle();
if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));

describe("Solver determinism", () => {
  // Feature: case-files, Property 6: Solver is deterministic
  // **Validates: Requirements 5.11**
  it("Property 6: two calls with the same input and version return deeply equal results", () => {
    fc.assert(
      fc.property(validCaseArb, fc.constantFrom(...VERSION_LABELS), (c, label) => {
        const derived = deriveFacts(c);
        const a = solve(derived, label, bundle);
        const b = solve(derived, label, bundle);
        expect(isCoreError(a)).toBe(false);
        expect(b).toEqual(a);
        expect(solve(deriveFacts(c), label, bundle)).toEqual(a);
      }),
      { numRuns: 100 },
    );
  });
});
