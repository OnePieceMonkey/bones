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

  describe("value source", () => {
    const outcomeOf = (id: string) => {
      const o = signatureTrace().ruleOutcomes.find((r) => r.ruleId === id);
      if (!o) throw new Error(id);
      return o;
    };
    const build = (
      ids: string[],
      confidence: Record<string, number>,
      patch?: (o: ReturnType<typeof outcomeOf>) => ReturnType<typeof outcomeOf>,
    ): Trace => ({
      ...signatureTrace(),
      confidence,
      ruleOutcomes: ids.map((id) => (patch ? patch(outcomeOf(id)) : outcomeOf(id))),
    });

    it("prints the minimum confidence among evidence keys of fractured bones", () => {
      // line-item-cap fractures (48000 -> 4800); alcohol fractures (4800 -> 4150).
      const trace = build(["line-item-cap", "alcohol-deducting"], {
        "receipt.merchant": 0.99,
        "receipt.totalCents": 0.62,
        "receipt.alcoholCents": 0.41,
        "receipt.date": 0.95,
      }, (o) =>
        o.ruleId === "line-item-cap"
          ? { ...o, evidence: { "receipt.totalCents": 48000 } }
          : o,
      );
      render(<GaugeControl trace={trace} anatomy={signatureAnatomy()} reducedMotion />);
      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuenow", "0.41");
      expect(meter).toHaveTextContent("0.41");
    });

    it("prints the confidence of a fired blocking rule's evidence key", () => {
      const trace = build(["date-blocking-after"], {
        "receipt.merchant": 0.99,
        "receipt.date": 0.3,
      }, (o) => ({ ...o, conditionMet: true }));
      render(<GaugeControl trace={trace} anatomy={signatureAnatomy()} reducedMotion />);
      expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0.3");
    });

    it("falls back to the average when no fractured bone has a confidence key", () => {
      // Fractured bones' evidence keys are absent from confidence.
      const trace = build(["line-item-cap", "alcohol-deducting"], {
        "receipt.merchant": 0.9,
        "receipt.date": 0.7,
      });
      render(<GaugeControl trace={trace} anatomy={signatureAnatomy()} reducedMotion />);
      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuenow", "0.8");
      expect(meter).toHaveTextContent("0.80");
    });

    it("does not lower the gauge for a capping rule that applied without lowering the amount", () => {
      // meal-limit: conditionMet, amountBefore === amountAfter -> not a fracture.
      const trace = build(["meal-limit"], {
        "receipt.merchant": 0.9,
        "receipt.totalCents": 0.1,
        "receipt.date": 0.8,
      });
      render(<GaugeControl trace={trace} anatomy={signatureAnatomy()} reducedMotion />);
      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuenow", "0.6");
      expect(meter).toHaveTextContent("0.60");
    });
  });
});
