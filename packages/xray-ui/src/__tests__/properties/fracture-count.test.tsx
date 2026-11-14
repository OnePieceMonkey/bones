// Feature: xray-ui, Property 1: Fractured bone count equals mapped fractured outcomes
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { cleanup, render } from "@testing-library/react";
import { Skeleton } from "../../components/Skeleton";
import { isFracture } from "../../model/selectors";
import { arbTraceAndAnatomy } from "../helpers/arbitraries";

describe("Property 1: fractured bone count", () => {
  it("fractured bone buttons equal mapped outcomes satisfying isFracture", () => {
    fc.assert(
      fc.property(arbTraceAndAnatomy, ({ trace, anatomy }) => {
        // Validates: Requirements 2.5, 2.7, 18.2, 18.11, 18.12
        const mappedIds = new Set(anatomy.bones.map((b) => b.ruleId));
        const expected = trace.ruleOutcomes.filter(
          (o) => mappedIds.has(o.ruleId) && isFracture(o),
        ).length;
        const { container } = render(<Skeleton trace={trace} anatomy={anatomy} reducedMotion />);
        const actual = container.querySelectorAll('button.xr-bone-btn[data-state="fractured"]').length;
        cleanup();
        expect(actual).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });
});
