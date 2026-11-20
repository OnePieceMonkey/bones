import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { METER, RED_ZONE, meterPoint, meterTicks, redZoneArc } from "../../model/meterGeometry";
import { needleAngle, SWEEP } from "../../model/gauge";

describe("meter geometry", () => {
  it("Property 5: Meter scale geometry", () => {
    // Feature: visual-polish-2, Property 5: Meter scale geometry
    // **Validates: Requirements 5.5**
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 12 }), (count) => {
        const ticks = meterTicks(count);
        expect(ticks).toHaveLength(count);
        expect(ticks[0]!.value).toBe(0);
        expect(ticks[count - 1]!.value).toBe(1);
        for (let i = 0; i < count; i++) {
          const t = ticks[i]!;
          if (i > 0) expect(t.value).toBeGreaterThan(ticks[i - 1]!.value);
          expect(t.angle).toBe(needleAngle(t.value));
          const dist = Math.hypot(t.x - METER.pivot.x, t.y - METER.pivot.y);
          expect(Math.abs(dist - METER.scaleRadius)).toBeLessThanOrEqual(0.01);
        }
        const arc = redZoneArc();
        expect(arc.startAngle).toBe(needleAngle(0.75));
        expect(arc.endAngle).toBe(SWEEP.max);
      }),
    );
  });

  it("red zone starts at 0.75", () => {
    expect(RED_ZONE.from).toBe(0.75);
    expect(RED_ZONE.to).toBe(1);
    expect(redZoneArc().startAngle).toBe(30);
    expect(redZoneArc().d).toMatch(/^M [\d.]+ [\d.]+ A 76 76 0 0 1 [\d.]+ [\d.]+$/);
  });

  it("meterPoint(0, r) is straight up from the pivot", () => {
    const p = meterPoint(0, 70);
    expect(p.x).toBe(METER.pivot.x);
    expect(p.y).toBe(METER.pivot.y - 70);
  });
});
