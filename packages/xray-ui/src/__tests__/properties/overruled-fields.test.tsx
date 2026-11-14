// Feature: xray-ui, Property 13: Overruled fields are exactly the evidence keys of fractured bones
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { cleanup, render } from "@testing-library/react";
import type { Trace } from "@bones/core";
import { AnswerCard } from "../../components/AnswerCard";
import { fieldViews, overruledFields, selectBones } from "../../model/selectors";
import { arbTraceAndAnatomy } from "../helpers/arbitraries";

const POOL = ["a", "b", "c", "d", "e.f", "g"];
const arbKeys = fc.subarray(POOL);

/** Re-keys evidence and proposed fields from one small pool so they overlap often. */
const arbCase = fc
  .tuple(
    arbTraceAndAnatomy,
    arbKeys,
    fc.array(arbKeys, { minLength: 8, maxLength: 8 }),
    fc.array(fc.boolean(), { minLength: POOL.length, maxLength: POOL.length }),
  )
  .map(([{ trace, anatomy }, proposedKeys, evidenceKeys, hasConf]) => {
    const proposedFields: Record<string, unknown> = {};
    const confidence: Record<string, number> = {};
    proposedKeys.forEach((k) => {
      proposedFields[k] = `v-${k}`;
      const i = POOL.indexOf(k);
      if (hasConf[i]) confidence[k] = (i + 1) / 10;
    });
    const t: Trace = {
      ...trace,
      proposedFields,
      confidence,
      validatedFields: { ...proposedFields },
      sources: {},
      ruleOutcomes: trace.ruleOutcomes.map((o, i) => ({
        ...o,
        evidence: Object.fromEntries((evidenceKeys[i] ?? []).map((k) => [k, 1])),
      })),
    };
    return { trace: t, anatomy };
  });

describe("Property 13: overruled fields", () => {
  it("overruled set, field flags, n/a confidence, and card overlay agree", () => {
    fc.assert(
      fc.property(arbCase, ({ trace, anatomy }) => {
        // Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
        const bones = selectBones(trace, anatomy);
        const expected = new Set<string>();
        for (const b of bones) {
          if (b.state !== "fractured" || !b.outcome) continue;
          for (const k of Object.keys(b.outcome.evidence)) {
            if (Object.prototype.hasOwnProperty.call(trace.proposedFields, k)) expected.add(k);
          }
        }
        const actual = overruledFields(trace, bones);
        expect(new Set(actual.keys())).toEqual(expected);

        const views = fieldViews(trace, anatomy, bones);
        expect(views.map((v) => v.path)).toEqual(Object.keys(trace.proposedFields));
        for (const v of views) {
          expect(v.overruled).toBe(expected.has(v.path));
          if (!(v.path in trace.confidence)) expect(v.confidenceText).toBe("n/a");
        }

        const { container } = render(<AnswerCard trace={trace} anatomy={anatomy} reducedMotion />);
        const hasCrack = container.querySelector(".xr-crack-overlay") !== null;
        const hasStamp = container.textContent?.includes("OVERRULED BY RULE") ?? false;
        cleanup();
        expect(hasCrack).toBe(expected.size > 0);
        expect(hasStamp).toBe(expected.size > 0);
      }),
      { numRuns: 200 },
    );
  });

  it("generator produces overlapping and non-overlapping cases", () => {
    let overlap = 0;
    let none = 0;
    fc.assert(
      fc.property(arbCase, ({ trace, anatomy }) => {
        const bones = selectBones(trace, anatomy);
        if (overruledFields(trace, bones).size > 0) overlap++;
        else none++;
      }),
      { numRuns: 200 },
    );
    expect(overlap).toBeGreaterThan(10);
    expect(none).toBeGreaterThan(10);
  });
});
