import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { KNOB, knobLabelPositions, knobTicks } from "../../model/knobLabels";
import { knobAngle } from "../../model/gauge";

describe("knobLabelPositions", () => {
  it("Property 3: Knob labels lie on one circle, are distinct and ordered", () => {
    // Feature: visual-polish-2, Property 3: Knob labels lie on one circle, are distinct and ordered
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
          expect(labels.filter((l) => l.active)).toHaveLength(1);
          expect(labels[active]!.active).toBe(true);
        },
      ),
    );
  });

  it("places v1 v2 v3 as in the design and gives one tick per detent", () => {
    const l = knobLabelPositions(3, 1);
    expect(l.map((p) => [p.x, p.y])).toEqual([
      [10.2, 73],
      [50, 4],
      [89.8, 73],
    ]);
    expect(knobTicks(3)).toHaveLength(3);
  });
});
