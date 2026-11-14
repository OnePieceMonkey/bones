// Feature: xray-ui, Property 5: Bone states are invariant under reordering of outcomes
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { selectBones } from "../../model/selectors";
import { arbTraceAndAnatomy } from "../helpers/arbitraries";

const arbCase = arbTraceAndAnatomy.chain((c) =>
  fc
    .shuffledSubarray([...c.trace.ruleOutcomes], {
      minLength: c.trace.ruleOutcomes.length,
      maxLength: c.trace.ruleOutcomes.length,
    })
    .map((shuffled) => ({ ...c, shuffled })),
);

describe("Property 5: reorder invariance", () => {
  it("selectBones is unchanged by permuting trace.ruleOutcomes", () => {
    fc.assert(
      fc.property(arbCase, ({ trace, anatomy, shuffled }) => {
        // Validates: Requirements 2.5, 2.6, 2.7, 10.4
        const ids = trace.ruleOutcomes.map((o) => o.ruleId);
        expect(new Set(ids).size).toBe(ids.length);
        const original = selectBones(trace, anatomy);
        const reordered = selectBones({ ...trace, ruleOutcomes: shuffled }, anatomy);
        const pick = (bs: typeof original) =>
          bs.map((b) => ({ ruleId: b.ruleId, state: b.state, position: b.position, version: b.version }));
        expect(pick(reordered)).toEqual(pick(original));
      }),
      { numRuns: 200 },
    );
  });
});
