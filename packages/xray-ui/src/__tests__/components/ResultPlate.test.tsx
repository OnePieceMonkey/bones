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

describe("ResultPlate effective prop", () => {
  const results: DecisionResult[] = ["approved", "partially_approved", "rejected"];
  const combos = results.flatMap((eff) => results.map((tr) => [eff, tr] as const));
  const info: Record<DecisionResult, [string, string]> = {
    approved: ["✓", "APPROVED"],
    partially_approved: ["◐", "PARTIALLY APPROVED"],
    rejected: ["✕", "REJECTED"],
  };

  it.each(combos)("effective %s over trace %s shows one rules amount", (eff, tr) => {
    const trace = { ...signatureTrace(), result: tr, amountCents: 4150 };
    const anatomy = { ...signatureAnatomy(), formatValue: (_p: string, v: unknown) => `$${String(v)}!` };
    const { container } = render(
      <ResultPlate trace={trace} anatomy={anatomy} effective={{ result: eff, reviewerName: "Dana" }} />,
    );
    const plate = screen.getByRole("status");
    expect(plate).toHaveAttribute("data-result", tr);
    expect(plate).toHaveAttribute("data-effective", eff);
    expect(container.querySelector(".xr-result-icon")?.textContent).toBe(info[eff][0]);
    expect(container.querySelector(".xr-result-label")?.textContent).toBe(info[eff][1]);
    expect(container.querySelector(".xr-result-overruled")?.textContent).toBe("overruled by Dana");
    expect(container.querySelector(".xr-result-rules")?.textContent).toBe(`Rules decided: ${info[tr][1]}`);
    expect(container.querySelector(".xr-result-amount-label")?.textContent).toBe("Amount by rules");
    const amounts = container.querySelectorAll(".xr-result-amount");
    expect(amounts).toHaveLength(1);
    expect(amounts[0]?.textContent).toBe("$4150!");
    expect((plate.textContent ?? "").split("$4150!")).toHaveLength(2);
    expect((plate.textContent ?? "").match(/\$/g)).toHaveLength(1);
  });

  it("shows PARTIALLY APPROVED as the rules decision text", () => {
    const trace = { ...signatureTrace(), result: "partially_approved" as const };
    render(<ResultPlate trace={trace} anatomy={signatureAnatomy()} effective={{ result: "rejected", reviewerName: "Dana" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Rules decided: PARTIALLY APPROVED");
  });

  it("has no data-effective and no overruled text without effective", () => {
    const { container } = render(<ResultPlate trace={signatureTrace()} anatomy={signatureAnatomy()} />);
    expect(screen.getByRole("status")).not.toHaveAttribute("data-effective");
    expect(container.textContent).not.toContain("overruled by");
    expect(container.querySelector(".xr-result-rules")).toBeNull();
    expect(container.querySelector(".xr-result-amount-label")).toBeNull();
  });
});
