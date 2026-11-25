import { isCoreError, validate } from "@bones/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deriveFacts } from "../../src/derive/factDeriver";
import { extractCaseFields, modelOutputSchema } from "../../src/pipeline/schema";
import { solve } from "../../src/solver/solve";
import { VERSION_LABELS } from "../../src/rules/catalog";
import { validModelOutputArb } from "../helpers/arbitraries";
import { loadTestBundle } from "../helpers/fixtures";

const bundle = loadTestBundle();
if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));

function run(raw: Record<string, unknown>, label: "v1" | "v2" | "v3") {
  const validated = validate(raw, modelOutputSchema);
  if (isCoreError(validated)) throw new Error(JSON.stringify(validated));
  const r = solve(deriveFacts(extractCaseFields(validated as Record<string, unknown>)), label, bundle as Exclude<typeof bundle, { kind: string }>);
  if (isCoreError(r)) throw new Error(JSON.stringify(r));
  return r;
}

describe("Solver confidence independence", () => {
  // Feature: case-files, Property 9: Solver is confidence-independent
  // **Validates: Requirements 5.14**
  it("Property 9: changing any confidence value leaves convictable, verdict and outcomes unchanged", () => {
    fc.assert(
      fc.property(
        validModelOutputArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.constantFrom(...VERSION_LABELS),
        (out, replacement, label) => {
          const changed = {
            ...out,
            confidence: Object.fromEntries(Object.keys(out.confidence).map((k) => [k, replacement])),
          };
          const a = run(out, label);
          const b = run(changed, label);
          expect(b.convictable).toEqual(a.convictable);
          expect(b.verdict).toBe(a.verdict);
          expect(b.outcomes).toEqual(a.outcomes);
        },
      ),
      { numRuns: 100 },
    );
  });
});
