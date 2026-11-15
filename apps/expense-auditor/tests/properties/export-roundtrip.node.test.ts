import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Override, Trace } from "@bones/core";
import {
  buildExport,
  exportFileName,
  serializeExport,
} from "../../src/export/exportTrace";
import type { DecisionState } from "../../src/state/reducer";

const arbId = fc.stringMatching(/^[a-f0-9]{8,36}$/);
const arbJson = fc.jsonValue().map((v) => JSON.parse(JSON.stringify(v ?? null)) as unknown);
const arbRecord = fc.dictionary(fc.stringMatching(/^[a-zA-Z]{1,8}$/), arbJson, { maxKeys: 4 });

const arbTrace: fc.Arbitrary<Trace> = fc
  .record({
    decisionId: arbId,
    ruleSetVersion: fc.constantFrom("1.0.0", "2.0.0", "3.0.0"),
    proposedFields: arbRecord,
    validatedFields: arbRecord,
    amountCents: fc.integer({ min: 0, max: 1_000_000 }),
    result: fc.constantFrom("approved", "partially_approved", "rejected"),
  })
  .map(
    (r) =>
      ({
        traceSchemaVersion: 1,
        createdAt: "2025-01-01T00:00:00.000Z",
        inputHash: "ab".repeat(32),
        rawModelOutput: "{}",
        confidence: {},
        sources: {},
        ruleSetId: "expense",
        ruleOutcomes: [],
        ...r,
      }) as unknown as Trace,
  );

const arbOverrideFor = (decisionId: string): fc.Arbitrary<Override> =>
  fc.record({
    decisionId: fc.constant(decisionId),
    reviewerName: fc.string({ minLength: 1, maxLength: 12 }),
    reason: fc.string({ minLength: 1, maxLength: 30 }),
    replacementResult: fc.constantFrom("approved", "rejected") as fc.Arbitrary<Override["replacementResult"]>,
    createdAt: fc.constant("2025-01-02T00:00:00.000Z"),
  });

const arbCase = fc
  .tuple(arbTrace, arbTrace, fc.boolean(), fc.nat(3), fc.nat(3), arbId)
  .chain(([original, replay0, useReplay, nLinked, nOther, otherId]) => {
    const replay: Trace = { ...replay0, decisionId: `r${replay0.decisionId}` };
    const displayed = useReplay ? replay : original;
    const stray = `z${otherId}`;
    return fc.tuple(
      fc.constant({ original, replay, useReplay, displayed }),
      fc.array(arbOverrideFor(displayed.decisionId), { minLength: nLinked, maxLength: nLinked }),
      fc.array(arbOverrideFor(stray), { minLength: nOther, maxLength: nOther }),
    );
  });

// Feature: expense-auditor, Property 15: Export serialization round trip
// **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.6**
describe("Property 15: Export serialization round trip", () => {
  it("parses back to the exported structure with the right name, replayedFrom and linked overrides", () => {
    fc.assert(
      fc.property(arbCase, ([c, linked, other]) => {
        const state = {
          screen: "decision",
          original: c.original,
          replays: { v1: c.original, ...(c.useReplay ? { v2: c.replay } : {}) },
          selected: c.useReplay ? "v2" : "v1",
          overrides: [...other, ...linked],
        } as unknown as DecisionState;

        const file = buildExport(state);
        const parsed = JSON.parse(serializeExport(file)) as typeof file;

        expect(parsed).toEqual(file);
        expect(file.trace).toBe(c.displayed);
        expect(file.overrides).toEqual(linked);
        expect(file.overrides.every((o) => o.decisionId === c.displayed.decisionId)).toBe(true);
        expect(exportFileName(file.trace)).toBe(`expense-trace-${c.displayed.decisionId.slice(0, 8)}.json`);
        expect(file.format).toBe("bones.expense-auditor.export");
        expect(file.formatVersion).toBe(1);
        expect("replayedFrom" in file).toBe(c.useReplay);
        expect("replayedFrom" in parsed).toBe(c.useReplay);
        if (c.useReplay) {
          expect(file.replayedFrom).toEqual({
            decisionId: c.original.decisionId,
            ruleSetVersion: c.original.ruleSetVersion,
          });
        }
      }),
      { numRuns: 100 },
    );
  });
});
