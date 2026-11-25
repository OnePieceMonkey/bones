import { isCoreError } from "@bones/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deriveFacts } from "../../src/derive/factDeriver";
import type { CaseFields } from "../../src/pipeline/schema";
import { solve } from "../../src/solver/solve";
import { VERSION_LABELS } from "../../src/rules/catalog";
import { validCaseArb } from "../helpers/arbitraries";
import { loadTestBundle } from "../helpers/fixtures";

const bundle = loadTestBundle();
if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));

const shuffle = <T>(list: readonly T[]): fc.Arbitrary<T[]> =>
  fc.shuffledSubarray([...list], { minLength: list.length, maxLength: list.length });

const permutedArb: fc.Arbitrary<{ original: CaseFields; permuted: CaseFields }> = validCaseArb.chain((c) =>
  fc
    .tuple(shuffle(c.suspects), shuffle(c.clues))
    .chain(([suspects, clues]) =>
      fc.tuple(...suspects.map((s) => shuffle(s.statements))).map((statementLists) => ({
        original: c,
        permuted: {
          ...c,
          clues,
          suspects: suspects.map((s, i) => ({ ...s, statements: statementLists[i] ?? s.statements })),
        } as CaseFields,
      })),
    ),
);

describe("Solver order independence", () => {
  // Feature: case-files, Property 8: Solver is order-independent
  // **Validates: Requirements 5.13**
  it("Property 8: permuting suspects, statements and clues keeps the set of convictable ids", () => {
    fc.assert(
      fc.property(permutedArb, fc.constantFrom(...VERSION_LABELS), ({ original, permuted }, label) => {
        const a = solve(deriveFacts(original), label, bundle);
        const b = solve(deriveFacts(permuted), label, bundle);
        if (isCoreError(a) || isCoreError(b)) throw new Error("solver error");
        expect([...b.convictable].sort()).toEqual([...a.convictable].sort());
        expect(b.verdict).toBe(a.verdict);
      }),
      { numRuns: 100 },
    );
  });
});
