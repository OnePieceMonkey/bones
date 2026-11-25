import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deriveFacts } from "../../src/derive/factDeriver";
import type { DerivedCase } from "../../src/derive/factDeriver";
import { validCaseArb } from "../helpers/arbitraries";

function counts(d: DerivedCase) {
  return d.suspects.map((s) => ({
    id: s.id,
    c: [s.meansAny, s.meansFirm, s.opportunityAny, s.opportunityFirm, s.motiveAny, s.motiveFirm],
    st: s.statements.map((t) => [t.id, t.conflictsAny, t.conflictsFirm, t.authorName]),
  }));
}

describe("Fact_Deriver order and determinism", () => {
  // Feature: case-files, Property 4: Fact_Deriver is order-independent and Rule_Set-independent
  // **Validates: Requirements 3.9, 3.10**
  it("Property 4: same counts for any clue permutation, and the same output on a second run", () => {
    fc.assert(
      fc.property(
        validCaseArb.chain((c) =>
          fc
            .shuffledSubarray(c.clues, { minLength: c.clues.length, maxLength: c.clues.length })
            .map((clues) => ({ c, clues })),
        ),
        ({ c, clues }) => {
          const base = deriveFacts(c);
          expect(deriveFacts(c)).toEqual(base);
          const permuted = deriveFacts({ ...c, clues });
          expect(counts(permuted)).toEqual(counts(base));
        },
      ),
      { numRuns: 200 },
    );
  });
});
