import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { Trace } from "@bones/core";
import { AnswerCard } from "../../components/AnswerCard";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

const ANIM = /(^|\s)anim-/;

function allClasses(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll("*")).map((el) => el.getAttribute("class") ?? "");
}

/** Trace where the line-item-cap bone is fractured on a proposed field (receipt.totalCents). */
function overruledTrace(): Trace {
  const t = signatureTrace();
  return {
    ...t,
    ruleOutcomes: t.ruleOutcomes.map((o) =>
      o.ruleId === "line-item-cap" ? { ...o, evidence: { "receipt.totalCents": 48000 } } : o,
    ),
  };
}

/** Trace with no fractured bone touching a proposed field. */
function cleanTrace(): Trace {
  const t = signatureTrace();
  return {
    ...t,
    ruleOutcomes: t.ruleOutcomes.map((o) => ({
      ...o,
      conditionMet: false,
    })),
  };
}

describe("AnswerCard", () => {
  it("renders label, value and confidence for each proposed field", () => {
    const { container } = render(<AnswerCard trace={cleanTrace()} anatomy={signatureAnatomy()} />);
    const merchant = container.querySelector('[data-path="receipt.merchant"]') as HTMLElement;
    expect(merchant.querySelector("dt")?.textContent).toBe("Merchant");
    expect(merchant.querySelector(".xr-field-value")?.textContent).toBe("Trattoria Roma");
    expect(merchant.querySelector(".xr-conf")?.textContent).toBe("confidence 0.97");
    expect(container.querySelectorAll(".xr-field")).toHaveLength(3);
  });

  it("shows n/a when confidence is missing", () => {
    const trace = cleanTrace();
    const confidence = { ...trace.confidence };
    delete confidence["receipt.date"];
    const { container } = render(
      <AnswerCard trace={{ ...trace, confidence }} anatomy={signatureAnatomy()} />,
    );
    const date = container.querySelector('[data-path="receipt.date"] .xr-conf');
    expect(date?.textContent).toBe("confidence n/a");
  });

  it("shows no badge, crack or stamp when nothing is overruled", () => {
    const { container } = render(<AnswerCard trace={cleanTrace()} anatomy={signatureAnatomy()} />);
    expect(container.querySelector(".xr-badge")).toBeNull();
    expect(container.querySelector(".xr-crack-overlay")).toBeNull();
    expect(container.querySelector(".xr-stamp")).toBeNull();
    expect(container.querySelector("article")?.getAttribute("data-overruled")).toBe("false");
  });

  it("shows no stamp when fractured bones touch no proposed field", () => {
    const { container } = render(<AnswerCard trace={signatureTrace()} anatomy={signatureAnatomy()} />);
    expect(container.querySelector(".xr-stamp")).toBeNull();
  });

  it("badges only the overruled field and shows crack overlay and stamp", () => {
    const { container } = render(<AnswerCard trace={overruledTrace()} anatomy={signatureAnatomy()} />);
    const badges = container.querySelectorAll(".xr-badge");
    expect(badges).toHaveLength(1);
    expect(badges[0]?.textContent).toContain("OVERRULED");
    expect(
      container.querySelector('[data-path="receipt.totalCents"] .xr-badge'),
    ).not.toBeNull();
    expect(container.querySelector('[data-path="receipt.merchant"] .xr-badge')).toBeNull();
    expect(container.querySelector(".xr-crack-overlay")).not.toBeNull();
    expect(container.querySelector("article")?.getAttribute("data-overruled")).toBe("true");
  });

  it("stamp reads OVERRULED BY RULE and names the fractured bone", () => {
    const { container } = render(<AnswerCard trace={overruledTrace()} anatomy={signatureAnatomy()} />);
    const stamp = container.querySelector(".xr-stamp") as HTMLElement;
    expect(stamp.querySelector(".xr-stamp-title")?.textContent).toBe("OVERRULED BY RULE");
    expect(stamp.textContent).toContain("Line item cap");
  });

  it("uses anim- classes when overruled without reducedMotion", () => {
    const { container } = render(
      <AnswerCard trace={overruledTrace()} anatomy={signatureAnatomy()} reducedMotion={false} />,
    );
    expect(allClasses(container).some((c) => ANIM.test(c))).toBe(true);
  });

  it("emits no anim- class anywhere with reducedMotion", () => {
    const { container } = render(
      <AnswerCard trace={overruledTrace()} anatomy={signatureAnatomy()} reducedMotion />,
    );
    expect(allClasses(container).some((c) => ANIM.test(c))).toBe(false);
    expect(container.querySelector(".xr-stamp")).not.toBeNull();
  });
});
