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

describe("Solver verdict partition", () => {
  // Feature: case-files, Property 7: Solver verdict is exactly the convictable-count partition
  // **Validates: Requirements 5.12**
  it("Property 7: accepted iff exactly one convictable; otherwise unfair_none (0) or unfair_many (2+)", () => {
    fc.assert(
      fc.property(validCaseArb, fc.constantFrom(...VERSION_LABELS), (c, label) => {
        const r = solve(deriveFacts(c), label, bundle);
        if (isCoreError(r)) throw new Error(JSON.stringify(r));
        const n = r.convictable.length;
        expect(r.verdict === "accepted").toBe(n === 1);
        expect(r.verdict === "unfair_none").toBe(n === 0);
        expect(r.verdict === "unfair_many").toBe(n >= 2);
        // convictable ids follow case suspect order and match the per-suspect flags
        const expected = r.suspects.filter((s) => s.convictable).map((s) => s.suspectId);
        expect(r.convictable).toEqual(expected);
        const order = c.suspects.map((s) => s.id).filter((id) => expected.includes(id));
        expect(r.convictable).toEqual(order);
        expect(r.reasons).toHaveLength(1);
      }),
      { numRuns: 200 },
    );
  });
});
