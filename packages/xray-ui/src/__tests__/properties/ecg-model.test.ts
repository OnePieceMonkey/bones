// Feature: xray-ui, Property 11: ECG model matches fractures and rejection
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { DecisionResult } from "@bones/core";
import { buildEcgModel } from "../../model/ecg";
import { selectBones } from "../../model/selectors";
import { arbTraceAndAnatomy } from "../helpers/arbitraries";

const arbResult = fc.constantFrom<DecisionResult>("approved", "partially_approved", "rejected");

const arbCase = fc
  .tuple(arbTraceAndAnatomy, fc.option(arbResult, { nil: undefined }))
  .map(([c, result]) => ({
    anatomy: c.anatomy,
    trace: result === undefined ? c.trace : { ...c.trace, result },
  }));

describe("Property 11: ECG model", () => {
  it("spikes match fractured bones, flatline iff rejected, summary and clamped x", () => {
    fc.assert(
      fc.property(arbCase, ({ trace, anatomy }) => {
        // Validates: Requirements 3.1, 3.2, 3.3, 3.5
        const bones = selectBones(trace, anatomy);
        const fractured = bones.filter((b) => b.state === "fractured");
        const model = buildEcgModel(trace, bones);

        expect(model.flatline).toBe(trace.result === "rejected");
        if (trace.result === "rejected") {
          expect(model.spikeXs).toEqual([]);
          expect(model.summary).toBe("flatline");
        } else {
          expect(model.spikeXs).toHaveLength(fractured.length);
          const n = fractured.length;
          expect(model.summary).toBe(`${n} spike${n === 1 ? "" : "s"}`);
          fractured.forEach((b, i) => {
            expect(model.spikeXs[i]).toBe(Math.min(548, Math.max(12, b.position.x)));
          });
        }
      }),
      { numRuns: 200 },
    );
  });
});
