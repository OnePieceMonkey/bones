// Feature: case-files, Property 15: Ensemble fracture count
// **Validates: Requirements 13.11**
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { cleanup, render } from "@testing-library/react";
import { SkeletonEnsemble } from "../../components/stage/SkeletonEnsemble";
import { selectBones } from "../../model/selectors";
import type { Anatomy, EnsembleMember } from "../../types";
import { arbTraceAndAnatomy } from "../helpers/arbitraries";

describe("Property 15: ensemble fracture count", () => {
  it("rendered fractured bones equal the sum of fractured bones per member", () => {
    fc.assert(
      fc.property(
        arbTraceAndAnatomy,
        fc.array(fc.array(fc.nat(), { maxLength: 8 }), { minLength: 1, maxLength: 4 }),
        ({ trace, anatomy }, picks) => {
          // Each member takes its own subset of the generated anatomy's bones.
          const members: EnsembleMember[] = picks.map((idx, i) => {
            const chosen = new Set(idx.map((n) => n % Math.max(1, anatomy.bones.length)));
            const sub: Anatomy = {
              ...anatomy,
              bones: anatomy.bones.filter((_, bi) => chosen.has(bi)),
            };
            return { id: `m${i}`, label: `Member ${i}`, anatomy: sub };
          });
          const expected = members.reduce(
            (sum, m) => sum + selectBones(trace, m.anatomy).filter((b) => b.state === "fractured").length,
            0,
          );
          const { container } = render(
            <SkeletonEnsemble
              trace={trace}
              members={members}
              xray
              selectedId="m0"
              onSelect={() => {}}
              selectLabel="Members"
              reducedMotion
            />,
          );
          const actual = container.querySelectorAll('.xr-hotspot[data-state="fractured"]').length;
          cleanup();
          expect(actual).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
