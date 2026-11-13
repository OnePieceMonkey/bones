import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Trace } from "@bones/core";
import { Skeleton } from "../../components/Skeleton";
import { REGIONS } from "../../types";
import type { Anatomy } from "../../types";
import { signatureAnatomy, signatureTrace } from "./../helpers/fixtures";

function withOutcome(trace: Trace, ruleId: string, patch: Record<string, unknown>): Trace {
  return {
    ...trace,
    ruleOutcomes: trace.ruleOutcomes.map((o) => {
      if (o.ruleId !== ruleId) return o;
      const next: Record<string, unknown> = { ...o, ...patch };
      for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
      return next as unknown as typeof o;
    }),
  };
}

const boneButton = (ruleId: string): HTMLElement => {
  const el = document.querySelector<HTMLElement>(`button.xr-bone-btn[data-rule-id="${ruleId}"]`);
  if (!el) throw new Error(`no bone button for ${ruleId}`);
  return el;
};

describe("Skeleton", () => {
  it("draws one silhouette for each of the 8 regions", () => {
    const { container } = render(<Skeleton trace={signatureTrace()} anatomy={signatureAnatomy()} />);
    const regions = container.querySelectorAll("g.xr-region");
    expect(regions).toHaveLength(8);
    expect([...regions].map((r) => r.getAttribute("data-region"))).toEqual([...REGIONS]);
    const svg = container.querySelector("svg.xr-skeleton-svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders one button per Anatomy entry in Anatomy order", () => {
    const anatomy = signatureAnatomy();
    render(<Skeleton trace={signatureTrace()} anatomy={anatomy} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(anatomy.bones.length);
    expect(buttons.map((b) => b.getAttribute("data-rule-id"))).toEqual(
      anatomy.bones.map((b) => b.ruleId),
    );
  });

  it("names each button 'label, rule id version v, state'", () => {
    render(<Skeleton trace={signatureTrace()} anatomy={signatureAnatomy()} />);
    expect(boneButton("line-item-cap")).toHaveAccessibleName(
      "Line item cap, rule line-item-cap version 1.0.0, fractured",
    );
    expect(boneButton("date-blocking-after")).toHaveAccessibleName(
      "Date not too late, rule date-blocking-after version 1.0.0, passed",
    );
    expect(boneButton("meal-limit")).toHaveAccessibleName(
      "Meal limit, rule meal-limit version 1.0.0, applied, no change",
    );
  });

  it("shows state cues and text for every state", () => {
    const anatomy: Anatomy = {
      ...signatureAnatomy(),
      bones: [
        ...signatureAnatomy().bones,
        { ruleId: "unmapped-rule", label: "Never ran", region: "leg-left" },
      ],
    };
    render(<Skeleton trace={signatureTrace()} anatomy={anatomy} />);
    const fractured = boneButton("alcohol-deducting");
    expect(fractured).toHaveAttribute("data-state", "fractured");
    expect(within(fractured).getByText("fractured")).toBeInTheDocument();
    expect(fractured.querySelector(".xr-bone-cue")).toHaveTextContent("\u2715");

    const passed = boneButton("date-blocking-before");
    expect(passed).toHaveAttribute("data-state", "passed");
    expect(within(passed).getByText("passed")).toBeInTheDocument();
    expect(passed.querySelector(".xr-bone-cue")).toHaveTextContent("\u2713");

    const na = boneButton("unmapped-rule");
    expect(na).toHaveAttribute("data-state", "not-applicable");
    expect(within(na).getByText("not applicable")).toBeInTheDocument();
    expect(na.querySelector(".xr-bone-cue")).toHaveTextContent("\u2013");
  });

  it("marks a capping outcome that did not lower the amount as 'applied, no change' (18.11)", () => {
    render(<Skeleton trace={signatureTrace()} anatomy={signatureAnatomy()} />);
    const bone = boneButton("meal-limit");
    expect(bone).toHaveAttribute("data-state", "passed");
    expect(within(bone).getByText("applied, no change")).toBeInTheDocument();
  });

  it("renders the same capping outcome with a lower amountAfterCents as a fractured bone (18.11)", () => {
    const trace = withOutcome(signatureTrace(), "meal-limit", { amountAfterCents: 4000 });
    render(<Skeleton trace={trace} anatomy={signatureAnatomy()} />);
    const bone = boneButton("meal-limit");
    expect(bone).toHaveAttribute("data-state", "fractured");
    expect(within(bone).getByText("fractured")).toBeInTheDocument();
  });

  it("renders capping and deducting outcomes without amount fields as passed (18.12)", () => {
    let trace = signatureTrace();
    for (const id of ["line-item-cap", "meal-limit", "alcohol-deducting"]) {
      trace = withOutcome(trace, id, { amountBeforeCents: undefined, amountAfterCents: undefined });
    }
    render(<Skeleton trace={trace} anatomy={signatureAnatomy()} />);
    for (const id of ["line-item-cap", "meal-limit", "alcohol-deducting"]) {
      expect(boneButton(id)).toHaveAttribute("data-state", "passed");
    }
    expect(document.querySelectorAll('[data-state="fractured"]')).toHaveLength(0);
  });

  it("draws a glyph, a dotted leader line and a label chip per bone", () => {
    const anatomy = signatureAnatomy();
    const { container } = render(<Skeleton trace={signatureTrace()} anatomy={anatomy} />);
    expect(container.querySelectorAll("line.xr-leader")).toHaveLength(anatomy.bones.length);
    expect(container.querySelectorAll("rect.xr-chip")).toHaveLength(anatomy.bones.length);
    expect(container.querySelectorAll("g.xr-bone")).toHaveLength(anatomy.bones.length);
    for (const line of container.querySelectorAll("line.xr-leader")) {
      expect(line).toHaveAttribute("stroke-dasharray");
    }
    expect(container.querySelector(".xr-chip-text")).toHaveTextContent("Date not too late");
  });

  it("draws no bone for an outcome that has no Anatomy entry", () => {
    const base = signatureTrace();
    const trace: Trace = {
      ...base,
      ruleOutcomes: [
        ...base.ruleOutcomes,
        {
          ruleId: "mystery-rule",
          ruleVersion: "9.9.9",
          effect: "blocking",
          conditionMet: true,
          evidence: {},
          renderedMessage: "Unmapped.",
        },
      ],
    };
    const anatomy = signatureAnatomy();
    const { container } = render(<Skeleton trace={trace} anatomy={anatomy} />);
    expect(screen.getAllByRole("button")).toHaveLength(anatomy.bones.length);
    expect(container.querySelector('[data-rule-id="mystery-rule"]')).toBeNull();
  });

  it("shows the tooltip on hover and hides it on leave, linked by aria-describedby", async () => {
    const user = userEvent.setup();
    render(<Skeleton trace={signatureTrace()} anatomy={signatureAnatomy()} />);
    const bone = boneButton("line-item-cap");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(bone).not.toHaveAttribute("aria-describedby");

    await user.hover(bone);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("line-item-cap v1.0.0");
    expect(tip).toHaveTextContent("fractured");
    expect(tip).toHaveTextContent("A line item may not exceed 4800 cents.");
    expect(bone).toHaveAttribute("aria-describedby", tip.id);
    expect(bone).toHaveAccessibleDescription(/line-item-cap v1\.0\.0/);

    await user.unhover(bone);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(bone).not.toHaveAttribute("aria-describedby");
  });

  it("shows the tooltip on keyboard focus and hides it on blur", async () => {
    const user = userEvent.setup();
    render(<Skeleton trace={signatureTrace()} anatomy={signatureAnatomy()} />);
    await user.tab();
    const first = screen.getAllByRole("button")[0] as HTMLElement;
    expect(first).toHaveFocus();
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("date-blocking-after v1.0.0");
    expect(first).toHaveAttribute("aria-describedby", tip.id);

    await user.tab();
    expect(screen.getByRole("tooltip")).toHaveTextContent("date-blocking-before");
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  });

  it("closes the tooltip on Escape while the bone keeps focus", async () => {
    const user = userEvent.setup();
    render(<Skeleton trace={signatureTrace()} anatomy={signatureAnatomy()} />);
    await user.tab();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getAllByRole("button")[0]).toHaveFocus();
  });
});
