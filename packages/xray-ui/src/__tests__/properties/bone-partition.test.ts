// Feature: xray-ui, Property 9: One bone per anatomy entry, partitioned into three states
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { isFracture, selectBones, stateText } from "../../model/selectors";
import { arbOutcome, arbRuleId, arbTraceAndAnatomy } from "../helpers/arbitraries";

const arbCase = arbTraceAndAnatomy.chain((c) =>
  fc
    .uniqueArray(arbRuleId, { maxLength: 3 })
    .map((ids) => ids.filter((id) => !c.anatomy.bones.some((b) => b.ruleId === id)))
    .chain((strangers) =>
      fc.tuple(...strangers.map((id) => arbOutcome(id))).map((extra) => ({ ...c, extra })),
    ),
);

describe("Property 9: bone partition", () => {
  it("one bone per anatomy entry in order, partitioned by outcome presence and isFracture", () => {
    fc.assert(
      fc.property(arbCase, ({ trace, anatomy, extra }) => {
        // Validates: Requirements 2.2, 2.4, 2.5, 2.6, 2.7, 2.17, 2.18
        const bones = selectBones(trace, anatomy);
        expect(bones.map((b) => b.ruleId)).toEqual(anatomy.bones.map((b) => b.ruleId));
        expect(bones.map((b) => b.index)).toEqual(anatomy.bones.map((_, i) => i));

        for (const bone of bones) {
          const outcome = trace.ruleOutcomes.find((o) => o.ruleId === bone.ruleId);
          if (outcome === undefined) {
            expect(bone.state).toBe("not-applicable");
            expect(bone.outcome).toBeUndefined();
          } else if (isFracture(outcome)) {
            expect(bone.state).toBe("fractured");
          } else {
            expect(bone.state).toBe("passed");
            const noChange =
              outcome.conditionMet === true &&
              (outcome.effect === "capping" || outcome.effect === "deducting");
            expect(stateText(bone)).toBe(noChange ? "applied, no change" : "passed");
          }
        }

        // Outcomes without an anatomy entry produce no bone and change nothing.
        const withExtra = selectBones(
          { ...trace, ruleOutcomes: [...trace.ruleOutcomes, ...extra] },
          anatomy,
        );
        expect(withExtra).toEqual(bones);
      }),
      { numRuns: 200 },
    );
  });
});
