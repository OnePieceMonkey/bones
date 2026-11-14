import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultPlate } from "../../components/ResultPlate";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";
import type { DecisionResult } from "../../types";

const cases: Array<[DecisionResult, string, string]> = [
  ["approved", "✓", "APPROVED"],
  ["partially_approved", "◐", "PARTIALLY APPROVED"],
  ["rejected", "✕", "REJECTED"],
];

describe("ResultPlate", () => {
  it.each(cases)("renders icon, label and amount for %s", (result, icon, label) => {
    const trace = { ...signatureTrace(), result, amountCents: 1234 };
    const anatomy = { ...signatureAnatomy(), formatValue: (_p: string, v: unknown) => `#${String(v)}` };
    const { container } = render(<ResultPlate trace={trace} anatomy={anatomy} />);
    const plate = screen.getByRole("status");
    expect(plate).toHaveAttribute("data-result", result);
    expect(plate).toHaveTextContent(label);
    expect(plate).toHaveTextContent("#1234");
    const iconEl = container.querySelector(".xr-result-icon");
    expect(iconEl).toHaveAttribute("aria-hidden", "true");
    expect(iconEl).toHaveTextContent(icon);
  });

  it.each(cases)("renders the exact label text for %s", (result, _icon, label) => {
    const trace = { ...signatureTrace(), result };
    const { container } = render(<ResultPlate trace={trace} anatomy={signatureAnatomy()} />);
    expect(container.querySelector(".xr-result-label")?.textContent).toBe(label);
  });

  it("calls formatValue with path amountCents and the integer cents value", () => {
    const calls: Array<[string, unknown]> = [];
    const anatomy = {
      ...signatureAnatomy(),
      formatValue: (p: string, v: unknown) => {
        calls.push([p, v]);
        return "custom";
      },
    };
    const trace = { ...signatureTrace(), amountCents: 4200 };
    const { container } = render(<ResultPlate trace={trace} anatomy={anatomy} />);
    expect(calls).toContainEqual(["amountCents", 4200]);
    expect(container.querySelector(".xr-result-amount")?.textContent).toBe("custom");
  });

  it("falls back to the default formatter when formatValue throws", () => {
    const anatomy = {
      ...signatureAnatomy(),
      formatValue: () => {
        throw new Error("boom");
      },
    };
    const trace = { ...signatureTrace(), amountCents: 777 };
    const { container } = render(<ResultPlate trace={trace} anatomy={anatomy} />);
    expect(container.querySelector(".xr-result-amount")?.textContent).toBe("777");
  });

  it("renders a zero amount", () => {
    const { formatValue: _omit, ...anatomy } = signatureAnatomy();
    const trace = { ...signatureTrace(), result: "rejected" as const, amountCents: 0 };
    const { container } = render(<ResultPlate trace={trace} anatomy={anatomy} />);
    expect(container.querySelector(".xr-result-amount")?.textContent).toBe("0");
  });

  it("uses the default formatter when formatValue is absent", () => {
    const { formatValue: _omit, ...anatomy } = signatureAnatomy();
    const trace = { ...signatureTrace(), amountCents: 500 };
    render(<ResultPlate trace={trace} anatomy={anatomy} />);
    expect(screen.getByRole("status")).toHaveTextContent("500");
  });
});
