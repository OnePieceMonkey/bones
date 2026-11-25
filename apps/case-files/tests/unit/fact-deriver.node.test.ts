import { describe, expect, it } from "vitest";
import { deriveFacts } from "../../src/derive/factDeriver";
import { caseFieldsSchema, extractCaseFields } from "../../src/pipeline/schema";
import type { CaseFields } from "../../src/pipeline/schema";
import { readRecorded } from "../helpers/fixtures";

function recordedCase(id: string): CaseFields {
  const file = readRecorded().find((f) => f.json.id === id);
  if (!file) throw new Error(`missing recorded case ${id}`);
  return caseFieldsSchema.parse(extractCaseFields(file.json.extraction.proposedFields));
}

function table(c: CaseFields) {
  return deriveFacts(c).suspects.map((s) => ({
    id: s.id,
    means: [s.meansAny, s.meansFirm],
    opportunity: [s.opportunityAny, s.opportunityFirm],
    motive: [s.motiveAny, s.motiveFirm],
    conflicts: s.statements.map((st) => [st.conflictsAny, st.conflictsFirm]),
  }));
}

describe("Fact_Deriver on the recorded cases (hand-checked tables)", () => {
  it("greenhouse", () => {
    expect(table(recordedCase("greenhouse"))).toEqual([
      { id: "widow", means: [1, 1], opportunity: [1, 1], motive: [1, 1], conflicts: [[1, 1]] },
      { id: "gardener", means: [1, 0], opportunity: [0, 0], motive: [1, 1], conflicts: [[0, 0]] },
      { id: "nephew", means: [0, 0], opportunity: [0, 0], motive: [0, 0], conflicts: [[1, 1]] },
    ]);
  });

  it("candlesticks", () => {
    expect(table(recordedCase("candlesticks"))).toEqual([
      { id: "ada", means: [1, 1], opportunity: [1, 1], motive: [1, 1], conflicts: [[1, 1]] },
      { id: "bram", means: [1, 1], opportunity: [1, 1], motive: [0, 0], conflicts: [[1, 1]] },
      { id: "clara", means: [0, 0], opportunity: [0, 0], motive: [0, 0], conflicts: [[0, 0]] },
    ]);
  });

  it("empty-room", () => {
    expect(table(recordedCase("empty-room"))).toEqual([
      { id: "dana", means: [1, 0], opportunity: [1, 1], motive: [1, 1], conflicts: [[1, 0]] },
      { id: "felix", means: [0, 0], opportunity: [0, 0], motive: [0, 0], conflicts: [[0, 0]] },
      { id: "greta", means: [0, 0], opportunity: [0, 0], motive: [0, 0], conflicts: [[0, 0]] },
    ]);
  });
});

describe("Fact_Deriver details", () => {
  const base = (): CaseFields => structuredClone(recordedCase("empty-room"));

  it("held: true gives zero conflicts", () => {
    const c = base();
    const st = c.suspects[0]!.statements[0]!;
    if (st.kind !== "possession") throw new Error("fixture changed");
    st.held = true;
    expect(deriveFacts(c).suspects[0]!.statements[0]).toMatchObject({ conflictsAny: 0, conflictsFirm: 0 });
  });

  it("touching intervals overlap", () => {
    const c = base();
    const dana = c.suspects[0]!;
    dana.statements = [
      { id: "st-t", kind: "location", text: "t", placeId: "office", startMin: 1250, endMin: 1300 },
    ];
    c.clues = [
      { id: "cl-t", kind: "presence", text: "t", reliability: "weak", suspectId: "dana", placeId: "back-room", startMin: 1300, endMin: 1310 },
    ];
    expect(deriveFacts(c).suspects[0]!.statements[0]).toMatchObject({ conflictsAny: 1, conflictsFirm: 0 });
  });

  it("a sighting reads the presence clues of the seen suspect", () => {
    const c = recordedCase("greenhouse");
    const nephew = deriveFacts(c).suspects[2]!;
    expect(nephew.statements[0]).toMatchObject({ kind: "sighting", conflictsAny: 1, conflictsFirm: 1 });
  });

  it("authorName equals the suspect name, order is kept, input is not mutated", () => {
    const c = recordedCase("greenhouse");
    const copy = structuredClone(c);
    const d = deriveFacts(c);
    expect(c).toEqual(copy);
    expect(d.suspects.map((s) => s.id)).toEqual(c.suspects.map((s) => s.id));
    d.suspects.forEach((s) => s.statements.forEach((st) => expect(st.authorName).toBe(s.name)));
    expect(d.clues).toEqual(c.clues);
  });
});
