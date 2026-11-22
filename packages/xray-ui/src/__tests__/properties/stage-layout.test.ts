import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { stageGeometry } from "../helpers/stageGeometry";

describe("Property 11: Layout model holds the stage criteria over the 16:9 family", () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 3.5, 5.11, 10.4**
   */
  it("keeps the skeleton large, the card above the ribs and the panel clear of the skeleton", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1280, max: 2560 }), (w) => {
        const g = stageGeometry(w, (w * 9) / 16);
        expect(g.photoH / g.stage.height).toBeGreaterThanOrEqual(0.9);
        expect(g.cardBottom).toBeLessThanOrEqual(g.ribTop + 1e-6);
        expect(g.cardBottom - g.photoTop).toBeLessThanOrEqual(0.45 * g.photoH);
        expect(g.cardBudgetPx / g.u).toBeGreaterThanOrEqual(150);
        expect(g.skeletonWorstLeft - g.panelRight).toBeGreaterThanOrEqual(10);
      }),
      { numRuns: 200 },
    );
  });
  it("matches the design table at 1600x900", () => {
    const g = stageGeometry(1600, 900);
    expect(g.photoW).toBeCloseTo(791.9, 0);
    expect(g.photoH / g.stage.height).toBeCloseTo(0.915, 2);
    expect(g.cardTop).toBeCloseTo(24.6, 0);
  });
});
