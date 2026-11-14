// Feature: xray-ui, Property 8: Gauge value is a valid confidence or null
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Trace } from "@bones/core";
import { gaugeValue } from "../../model/confidence";
import { selectBones } from "../../model/selectors";
import { arbTraceAndAnatomy } from "../helpers/arbitraries";

const CONF_KEYS = ["receipt.merchant", "receipt.date", "receipt.total", "claim.reason"];

/** Trace with evidence keys that really hit confidence keys, and optional non-finite confidences. */
const arbScenario = fc
  .record({
    base: arbTraceAndAnatomy,
    confValues: fc.array(
      fc.oneof(
        { weight: 6, arbitrary: fc.double({ min: 0, max: 1, noNaN: true }) },
        { weight: 1, arbitrary: fc.constantFrom(NaN, Infinity, -Infinity) },
      ),
      { minLength: 4, maxLength: 4 },
    ),
    present: fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
    evidenceKeys: fc.array(fc.subarray(CONF_KEYS), { minLength: 8, maxLength: 8 }),
  })
  .map(({ base, confValues, present, evidenceKeys }) => {
    const confidence: Record<string, number> = {};
    CONF_KEYS.forEach((k, i) => {
      if (present[i]) confidence[k] = confValues[i] as number;
    });
    const trace: Trace = {
      ...base.trace,
      confidence,
      ruleOutcomes: base.trace.ruleOutcomes.map((o, i) => ({
        ...o,
        evidence: {
          ...o.evidence,
          ...Object.fromEntries((evidenceKeys[i] ?? []).map((k) => [k, "x"])),
        },
      })),
    };
    return { trace, anatomy: base.anatomy };
  });

describe("Property 8: gauge value", () => {
  it("is null or in [0,1]; min of fractured evidence confidences, else average, else null", () => {
    // **Validates: Requirements 7.8, 7.9, 7.10**
    fc.assert(
      fc.property(arbScenario, ({ trace, anatomy }) => {
        const bones = selectBones(trace, anatomy);
        const value = gaugeValue(trace, bones);

        const conf = trace.confidence as Record<string, number>;
        const finiteAll = Object.values(conf).filter((v) => Number.isFinite(v));
        const fracturedVals: number[] = [];
        for (const b of bones) {
          if (b.state !== "fractured" || b.outcome === undefined) continue;
          for (const k of Object.keys(b.outcome.evidence)) {
            if (Object.prototype.hasOwnProperty.call(conf, k) && Number.isFinite(conf[k])) {
              fracturedVals.push(conf[k] as number);
            }
          }
        }

        if (value !== null) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
        if (finiteAll.length === 0) {
          expect(value).toBeNull();
        } else if (fracturedVals.length > 0) {
          expect(value).toBe(Math.min(...fracturedVals));
        } else {
          const avg = finiteAll.reduce((s, v) => s + v, 0) / finiteAll.length;
          expect(value).not.toBeNull();
          expect(value as number).toBeCloseTo(avg, 12);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("returns null for empty confidence", () => {
    // **Validates: Requirements 7.10**
    fc.assert(
      fc.property(arbTraceAndAnatomy, ({ trace, anatomy }) => {
        const empty: Trace = { ...trace, confidence: {} };
        expect(gaugeValue(empty, selectBones(empty, anatomy))).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
