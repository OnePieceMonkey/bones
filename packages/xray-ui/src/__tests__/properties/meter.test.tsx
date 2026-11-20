// Feature: visual-polish-2, Property 4: Meter needle follows the confidence model and is monotone
import { afterEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import { cleanup, render, screen } from "@testing-library/react";
import { Meter } from "../../components/panel/Meter";
import { needleAngle } from "../../model/gauge";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

afterEach(cleanup);

const withConfidence = (c: number) => {
  const trace = signatureTrace();
  const confidence = Object.fromEntries(Object.keys(trace.confidence).map((k) => [k, c]));
  return { ...trace, confidence };
};

describe("Property 4: Meter needle follows the confidence model and is monotone", () => {
  it("is monotone, renders data-angle = needleAngle(confidence) and aria-valuenow = round(100 * confidence)", () => {
    // **Validates: Requirements 5.6, 5.7**
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (x, y) => {
          const [a, b] = x <= y ? [x, y] : [y, x];
          expect(needleAngle(a)).toBeLessThanOrEqual(needleAngle(b));
          const { container, unmount } = render(<Meter trace={withConfidence(b)} anatomy={signatureAnatomy()} />);
          try {
            const meter = screen.getByRole("meter", { name: "AI READ CONFIDENCE" });
            const needle = container.querySelector(".xr-pmeter-needle")!;
            // The model averages the per-field confidences, so allow float rounding.
            expect(Number(needle.getAttribute("data-angle"))).toBeCloseTo(needleAngle(b), 8);
            expect(meter).toHaveAttribute("aria-valuenow", String(Math.round(100 * b)));
          } finally {
            unmount();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rests at needleAngle(null) without a confidence and draws a rectangular face with a red zone", () => {
    const trace = { ...signatureTrace(), confidence: {} };
    const { container } = render(<Meter trace={trace} anatomy={signatureAnatomy()} />);
    expect(container.querySelector(".xr-pmeter-needle")!.getAttribute("data-angle")).toBe(String(needleAngle(null)));
    expect(screen.getByRole("meter")).not.toHaveAttribute("aria-valuenow");
    expect(container.querySelector("rect.xr-pmeter-face")).not.toBeNull();
    expect(container.querySelector(".xr-pmeter-zone")).not.toBeNull();
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });
});
