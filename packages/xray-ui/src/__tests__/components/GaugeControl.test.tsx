import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GaugeControl } from "../../components/GaugeControl";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";
import type { Trace } from "../../types";

const withConfidence = (confidence: Record<string, number>): Trace => ({
  ...signatureTrace(),
  confidence,
});

describe("GaugeControl", () => {
  it("exposes a meter with range, value and text", () => {
    render(<GaugeControl trace={withConfidence({ a: 0.5 })} reducedMotion />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAccessibleName("AI READ CONFIDENCE");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "1");
    expect(meter).toHaveAttribute("aria-valuenow", "0.5");
    expect(meter).toHaveAttribute("aria-valuetext", "0.50");
    expect(meter).toHaveTextContent("0.50");
    expect(meter).toHaveTextContent("AI READ CONFIDENCE");
  });

  it("omits aria-valuenow and shows n/a when there is no confidence", () => {
    const { container } = render(<GaugeControl trace={withConfidence({})} reducedMotion />);
    const meter = screen.getByRole("meter");
    expect(meter).not.toHaveAttribute("aria-valuenow");
    expect(meter).toHaveAttribute("aria-valuetext", "n/a");
    expect(meter).toHaveTextContent("n/a");
    expect(container.querySelector(".xr-gauge-needle")).toHaveAttribute("data-angle", "-60");
  });

  it("rotates the needle by needleAngle", () => {
    const { container } = render(
      <GaugeControl trace={withConfidence({ a: 1 })} anatomy={signatureAnatomy()} reducedMotion />,
    );
    const needle = container.querySelector(".xr-gauge-needle");
    expect(needle).toHaveAttribute("data-angle", "60");
    expect(needle).toHaveAttribute("transform", "rotate(60 50 55)");
  });

  it("applies anim-needle only when motion is allowed", () => {
    const trace = withConfidence({ a: 0.5 });
    const on = render(<GaugeControl trace={trace} reducedMotion={false} />);
    expect(on.container.querySelector(".anim-needle")).not.toBeNull();
    on.unmount();
    const off = render(<GaugeControl trace={trace} reducedMotion />);
    expect(off.container.querySelector(".anim-needle")).toBeNull();
  });
});
