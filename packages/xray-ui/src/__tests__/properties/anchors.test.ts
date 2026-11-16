import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { ANCHORS, CROP, SPINE_LOWER, placeBones, toCropPercent } from "../../model/anchors";
import { REGIONS } from "../../types";
import type { Region } from "../../types";
import { arbRegion } from "../helpers/arbitraries";

const arbBones = fc.array(
  fc.record({ ruleId: fc.string({ maxLength: 8 }), label: fc.string({ maxLength: 8 }), region: arbRegion }),
  { minLength: 1, maxLength: 40 },
);

describe("anchors", () => {
  it("Property 1: anchor mapping is deterministic and depends only on region order", () => {
    // Feature: visual-polish, Property 1: Anchor mapping is deterministic and depends only on region order
    // Validates: Requirements 10.3, 10.6, 10.7, 10.15
    fc.assert(
      fc.property(arbBones, (bones) => {
        const a = placeBones(bones);
        expect(placeBones(bones)).toEqual(a);
        expect(a).toHaveLength(bones.length);
        const renamed = bones.map((b, i) => ({ ...b, ruleId: `r${i}`, label: `L${i * 3}` }));
        expect(placeBones(renamed)).toEqual(a);
      }),
      { numRuns: 100 },
    );
  });

  it("Property 2: hotspot positions are distinct, anchored and inside the crop", () => {
    // Feature: visual-polish, Property 2: Hotspot positions are distinct, anchored and inside the crop
    // Validates: Requirements 10.1, 10.2, 10.4, 10.5
    for (const r of REGIONS) {
      expect(ANCHORS[r]).toBeDefined();
      expect(ANCHORS[r].x).toBeGreaterThanOrEqual(0);
      expect(ANCHORS[r].x).toBeLessThanOrEqual(100);
      expect(ANCHORS[r].y).toBeGreaterThanOrEqual(CROP.top);
      expect(ANCHORS[r].y).toBeLessThanOrEqual(CROP.bottom);
    }
    fc.assert(
      fc.property(arbBones, (bones) => {
        const pts = placeBones(bones);
        for (let i = 0; i < pts.length; i += 1) {
          const p = pts[i]!;
          expect(p.x).toBeGreaterThanOrEqual(6);
          expect(p.x).toBeLessThanOrEqual(94);
          expect(p.y).toBeGreaterThanOrEqual(6);
          expect(p.y).toBeLessThanOrEqual(62);
          for (let j = i + 1; j < pts.length; j += 1) {
            const q = pts[j]!;
            expect(Math.abs(p.x - q.x) >= 3 || Math.abs(p.y - q.y) >= 3).toBe(true);
          }
        }
        const count = new Map<Region, number>();
        bones.forEach((b, i) => {
          const n = count.get(b.region) ?? 0;
          count.set(b.region, n + 1);
          if (n === 0) expect(pts[i]).toEqual(ANCHORS[b.region]);
          if (n === 1 && b.region === "spine") expect(pts[i]).toEqual(SPINE_LOWER);
        });
      }),
      { numRuns: 100 },
    );
  });

  it("holds the README anchor values", () => {
    expect(ANCHORS.skull).toEqual({ x: 50, y: 9 });
    expect(ANCHORS.ribs).toEqual({ x: 57, y: 29 });
    expect(ANCHORS.spine).toEqual({ x: 50, y: 33 });
    expect(ANCHORS.pelvis).toEqual({ x: 56, y: 47 });
    expect(ANCHORS["arm-right"]).toEqual({ x: 69, y: 45 });
    expect(ANCHORS["arm-left"]).toEqual({ x: 31, y: 45 });
    expect(SPINE_LOWER).toEqual({ x: 50, y: 42 });
  });

  it("places two spine bones at (50, 33) and (50, 42)", () => {
    const pts = placeBones([
      { ruleId: "a", label: "A", region: "spine" },
      { ruleId: "b", label: "B", region: "spine" },
    ]);
    expect(pts).toEqual([
      { x: 50, y: 33 },
      { x: 50, y: 42 },
    ]);
  });

  it("converts full-image percent to crop percent", () => {
    expect(toCropPercent({ x: 50, y: 3 })).toEqual({ x: 50, y: 0 });
    expect(toCropPercent({ x: 50, y: 65 })).toEqual({ x: 50, y: 100 });
  });
});
