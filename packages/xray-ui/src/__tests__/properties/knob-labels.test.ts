import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { KNOB, KNOB_LABEL_GAP_U, knobLabelPositions, knobTicks } from "../../model/knobLabels";
import { knobAngle } from "../../model/gauge";

describe("knobLabelPositions", () => {
  it("Property 3: Knob labels lie on one tight arc, are distinct, ordered, within 20 px of the dial edge and have ticks pointing at them", () => {
    // Feature: visual-polish-2, Property 3: Knob labels lie on one tight arc, are distinct, ordered, within 20 px of the dial edge and have ticks pointing at them
    // Validates: Requirements 5.3, 5.4
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }).chain((count) =>
          fc.tuple(fc.constant(count), fc.integer({ min: 0, max: count - 1 })),
        ),
        ([count, active]) => {
          const labels = knobLabelPositions(count, active);
          expect(labels).toHaveLength(count);
          for (const l of labels) {
            expect(
              Math.abs(Math.hypot(l.x - KNOB.center, l.y - KNOB.center) - KNOB.labelRadius),
            ).toBeLessThanOrEqual(0.1);
            expect(l.angleDeg).toBe(knobAngle(l.index, count));
          }
          expect(new Set(labels.map((l) => `${l.x},${l.y}`)).size).toBe(count);
          for (let i = 1; i < count; i++) {
            expect(labels[i]!.angleDeg).toBeGreaterThan(labels[i - 1]!.angleDeg);
          }
          // Within 20 css px of the dial edge at u = 1.25 (the 1600x900 review size).
          expect(KNOB_LABEL_GAP_U * 1.25).toBeLessThanOrEqual(20);
          expect(KNOB.labelRadius).toBeGreaterThan(KNOB.dialRadius);
          // Each tick lies on the ray from the knob centre to its label, between dial edge and label.
          const ticks = knobTicks(count);
          expect(ticks).toHaveLength(count);
          ticks.forEach((t, i) => {
            const l = labels[i]!;
            // Bearing of the tick equals the label angle (ticks are 0.1-percent rounded, so allow 6 degrees).
            const bearing = (Math.atan2(t.x2 - t.x1, -(t.y2 - t.y1)) * 180) / Math.PI;
            expect(Math.abs(bearing - l.angleDeg)).toBeLessThanOrEqual(6);
            const r1 = Math.hypot(t.x1 - KNOB.center, t.y1 - KNOB.center);
            const r2 = Math.hypot(t.x2 - KNOB.center, t.y2 - KNOB.center);
            expect(r1).toBeGreaterThanOrEqual(KNOB.dialRadius);
            expect(r2).toBeGreaterThan(r1);
            expect(r2).toBeLessThan(KNOB.labelRadius);
          });
          expect(labels.filter((l) => l.active)).toHaveLength(1);
          expect(labels[active]!.active).toBe(true);
        },
      ),
    );
  });

  it("places v1 v2 v3 as in the design and gives one tick per detent", () => {
    const l = knobLabelPositions(3, 1);
    expect(l.map((p) => [p.x, p.y])).toEqual([
      [12.3, 71.7],
      [50, 6.5],
      [87.7, 71.7],
    ]);
    expect(knobTicks(3)).toHaveLength(3);
  });
});
