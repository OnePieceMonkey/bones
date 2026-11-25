import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deriveFacts } from "../../src/derive/factDeriver";
import type { CaseFields, Clue } from "../../src/pipeline/schema";
import { validCaseArb } from "../helpers/arbitraries";

/** Naive reference written from the acceptance criteria text of requirement 3. */
function overlap(a: { startMin: number; endMin: number }, b: { startMin: number; endMin: number }): boolean {
  return a.startMin <= b.endMin && b.startMin <= a.endMin;
}
function tally(clues: Clue[]): [number, number] {
  return [clues.length, clues.filter((c) => c.reliability === "firm").length];
}

function reference(c: CaseFields) {
  return c.suspects.map((s) => {
    const mine = c.clues.filter((k) => k.suspectId === s.id);
    const means = tally(mine.filter((k) => k.kind === "holding" && k.itemId === c.crime.weaponItemId));
    const opp = tally(
      mine.filter((k) => k.kind === "presence" && k.placeId === c.crime.placeId && overlap(k, c.crime)),
    );
    const motive = tally(mine.filter((k) => k.kind === "motive"));
    const statements = s.statements.map((st) => {
      let hits: Clue[] = [];
      if (st.kind === "location") {
        hits = mine.filter((k) => k.kind === "presence" && k.placeId !== st.placeId && overlap(k, st));
      } else if (st.kind === "possession") {
        hits = st.held ? [] : mine.filter((k) => k.kind === "holding" && k.itemId === st.itemId);
      } else {
        hits = c.clues.filter(
          (k) =>
            k.suspectId === st.seenSuspectId && k.kind === "presence" && k.placeId !== st.placeId && overlap(k, st),
        );
      }
      return { id: st.id, conflicts: tally(hits), authorName: s.name };
    });
    return { id: s.id, means, opp, motive, statements };
  });
}

describe("Fact_Deriver model", () => {
  // Feature: case-files, Property 3: Fact_Deriver matches a naive reference model
  // **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.8**
  it("Property 3: every count equals the naive reference count", () => {
    fc.assert(
      fc.property(validCaseArb, (c) => {
        const derived = deriveFacts(c);
        const ref = reference(c);
        expect(derived.suspects.length).toBe(ref.length);
        derived.suspects.forEach((s, i) => {
          const r = ref[i]!;
          expect(s.id).toBe(r.id);
          expect([s.meansAny, s.meansFirm]).toEqual(r.means);
          expect([s.opportunityAny, s.opportunityFirm]).toEqual(r.opp);
          expect([s.motiveAny, s.motiveFirm]).toEqual(r.motive);
          s.statements.forEach((st, j) => {
            const rs = r.statements[j]!;
            expect(st.id).toBe(rs.id);
            expect([st.conflictsAny, st.conflictsFirm]).toEqual(rs.conflicts);
            expect(st.authorName).toBe(rs.authorName);
          });
        });
      }),
      { numRuns: 200 },
    );
  });
});
