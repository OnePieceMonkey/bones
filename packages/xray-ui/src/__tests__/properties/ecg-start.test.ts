import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { DecisionResult, Trace } from "@bones/core";
import { buildEcgModel, ecgStartX, ECG_CENTER } from "../../model/ecg";
import type { BoneState, BoneView } from "../../types";

const arbState = fc.constantFrom<BoneState>("passed", "fractured", "not-applicable");
const arbResult = fc.constantFrom<DecisionResult>("approved", "partially_approved", "rejected");

// Bone x is the percent of the crop (0..100) mapped onto the 560 wide model, as EcgBand does.
const arbBones = fc.array(
  fc.record({ state: arbState, pct: fc.double({ min: 0, max: 100, noNaN: true }) }),
  { maxLength: 12 },
);

function toBones(items: { state: BoneState; pct: number }[]): BoneView[] {
  return items.map(
    (b, index) =>
      ({
        ruleId: `r${index}`,
        label: `r${index}`,
        region: "spine",
        index,
        state: b.state,
        version: null,
        position: { x: (b.pct / 100) * 560, y: 0 },
      }) as unknown as BoneView,
  );
}

const clamp = (v: number) => Math.min(548, Math.max(12, v));
const numbers = (d: string) => [...d.matchAll(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0].split(",")[0]));
const apexes = (d: string) => [...d.matchAll(/L(-?[\d.]+),2(?=\s|$)/g)].map((m) => Number(m[1]));

describe("ECG start and spikes", () => {
  // Feature: visual-polish-2, Property 1: ECG starts at the left-most fractured hotspot
  // **Validates: Requirements 3.6, 3.7**
  it("starts at the left-most fractured bone and nothing is drawn left of it", () => {
    fc.assert(
      fc.property(arbBones, arbResult, (items, result) => {
        const bones = toBones(items);
        const fractured = bones.filter((b) => b.state === "fractured").map((b) => clamp(b.position.x));
        const model = buildEcgModel({ result } as Trace, bones);
        const expected = fractured.length === 0 ? ECG_CENTER : Math.min(...fractured);
        expect(ecgStartX(bones)).toBe(expected);
        expect(model.startX).toBe(expected);
        for (const x of [...numbers(model.linePath), ...numbers(model.spikePath)]) {
          expect(x).toBeGreaterThanOrEqual(model.startX);
        }
        for (const f of fractured) expect(model.startX).toBeLessThanOrEqual(f);
        if (fractured.length > 0 && !model.flatline) {
          expect(Math.min(...numbers(model.spikePath))).toBe(model.startX);
        }
      }),
      { numRuns: 200 },
    );
  });

  // Feature: visual-polish-2, Property 2: ECG spikes remain at the fractured positions and are red
  // **Validates: Requirements 3.6, 3.8**
  it("keeps spike apexes at the clamped fractured positions", () => {
    fc.assert(
      fc.property(arbBones, arbResult, (items, result) => {
        const bones = toBones(items);
        const fractured = bones.filter((b) => b.state === "fractured").map((b) => clamp(b.position.x));
        const model = buildEcgModel({ result } as Trace, bones);
        if (model.flatline) {
          expect(model.spikePath).toBe("");
          expect(model.summary).toBe("flatline");
          return;
        }
        expect(apexes(model.spikePath)).toEqual(fractured);
        expect(model.spikeXs).toEqual(fractured);
        expect(model.spikeXs).toHaveLength(fractured.length);
        expect(model.summary).toBe(`${fractured.length} spike${fractured.length === 1 ? "" : "s"}`);
      }),
      { numRuns: 200 },
    );
  });
});
