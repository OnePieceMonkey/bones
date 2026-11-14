// Feature: xray-ui, Property 10: Layout depends only on region order and stays inside the region
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { REGION_BOXES, layoutBone } from "../../model/skeletonLayout";
import { selectBones } from "../../model/selectors";
import { arbRegion, arbTraceAndAnatomy } from "../helpers/arbitraries";

describe("Property 10: layout", () => {
  it("layoutBone is deterministic, strictly inside the box, evenly spread and ordered", () => {
    fc.assert(
      fc.property(arbRegion, fc.integer({ min: 1, max: 40 }), (region, n) => {
        // Validates: Requirements 2.3
        const box = REGION_BOXES[region];
        const pts = Array.from({ length: n }, (_, i) => layoutBone(region, i, n));
        pts.forEach((p, i) => {
          expect(layoutBone(region, i, n)).toEqual(p);
          expect(p.x).toBeGreaterThan(box.x);
          expect(p.x).toBeLessThan(box.x + box.width);
          expect(p.y).toBeGreaterThan(box.y);
          expect(p.y).toBeLessThan(box.y + box.height);
        });
        const along = pts.map((p) => (box.axis === "x" ? p.x : p.y));
        const gaps = along.slice(1).map((v, i) => v - (along[i] as number));
        for (const g of gaps) {
          expect(g).toBeGreaterThan(0);
          expect(Math.abs(g - (gaps[0] as number))).toBeLessThanOrEqual(0.011);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("selectBones positions depend only on the order of same-region entries", () => {
    fc.assert(
      fc.property(arbTraceAndAnatomy, ({ trace, anatomy }) => {
        // Validates: Requirements 2.3
        const variant = {
          ...anatomy,
          bones: anatomy.bones.map((b, i) => ({
            ...b,
            ruleId: `other-${i}`,
            label: `Label ${i * 7}`,
          })),
        };
        const a = selectBones(trace, anatomy).map((b) => b.position);
        const b = selectBones({ ...trace, ruleOutcomes: [] }, variant).map((x) => x.position);
        expect(b).toEqual(a);
      }),
      { numRuns: 100 },
    );
  });
});
