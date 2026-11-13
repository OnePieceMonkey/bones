import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tooltip, TOOLTIP_FLIP_X, slug, tooltipId } from "../../components/Tooltip";
import { selectBones } from "../../model/selectors";
import type { Anatomy, BoneView } from "../../types";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

function boneFor(ruleId: string, anatomy: Anatomy = signatureAnatomy()): BoneView {
  const bone = selectBones(signatureTrace(), anatomy).find((b) => b.ruleId === ruleId);
  if (!bone) throw new Error(`no bone ${ruleId}`);
  return bone;
}

describe("Tooltip", () => {
  it("shows id, version, state, message and one dt/dd per evidence key", () => {
    const bone = boneFor("line-item-cap");
    const evidence = bone.outcome?.evidence ?? {};
    render(<Tooltip id={tooltipId(bone.ruleId)} bone={bone} anatomy={signatureAnatomy()} />);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveAttribute("id", "xr-tip-line-item-cap");
    expect(tip).toHaveTextContent("line-item-cap v1.0.0");
    expect(tip).toHaveTextContent("fractured");
    expect(tip).toHaveTextContent("A line item may not exceed 4800 cents.");
    expect(tip.querySelectorAll("dt")).toHaveLength(Object.keys(evidence).length);
    expect(tip.querySelectorAll("dd")).toHaveLength(Object.keys(evidence).length);
  });

  it("uses one dt/dd pair per evidence key in key order, with labels from the Anatomy", () => {
    const trace = signatureTrace();
    const outcome = trace.ruleOutcomes[2]!;
    outcome.evidence = { "receipt.merchant": "Trattoria", "receipt.totalCents": 48000, other: true };
    const anatomy = signatureAnatomy();
    const bone = selectBones(trace, anatomy)[2]!;
    render(<Tooltip id="t" bone={bone} anatomy={anatomy} />);
    const dts = [...document.querySelectorAll("dt")].map((n) => n.textContent);
    const dds = [...document.querySelectorAll("dd")].map((n) => n.textContent);
    expect(dts).toEqual(["Merchant", "Total", "other"]);
    expect(dds).toEqual(["Trattoria", "48000", "true"]);
  });

  it("uses the default formatter when formatValue is absent and the host one when present", () => {
    const trace = signatureTrace();
    trace.ruleOutcomes[4]!.evidence = { "receipt.alcoholCents": 650, nested: { a: 1 } };
    const plain = signatureAnatomy();
    const bone = selectBones(trace, plain)[4]!;
    const { unmount } = render(<Tooltip id="t" bone={bone} anatomy={plain} />);
    expect([...document.querySelectorAll("dd")].map((n) => n.textContent)).toEqual([
      "650",
      '{"a":1}',
    ]);
    unmount();

    const custom: Anatomy = { ...plain, formatValue: (_p, v) => `<${String(v)}>` };
    const bone2 = selectBones(trace, custom)[4]!;
    render(<Tooltip id="t" bone={bone2} anatomy={custom} />);
    expect(document.querySelectorAll("dd")[0]).toHaveTextContent("<650>");
  });

  it("shows 'applied, no change' for a capping outcome that did not lower the amount", () => {
    const bone = boneFor("meal-limit");
    render(<Tooltip id="t" bone={bone} anatomy={signatureAnatomy()} />);
    expect(screen.getByRole("tooltip")).toHaveTextContent("applied, no change");
  });

  it("shows 'not applicable' without message or evidence for an unmapped bone", () => {
    const anatomy: Anatomy = {
      ...signatureAnatomy(),
      bones: [{ ruleId: "never-ran", label: "Never ran", region: "skull" }],
    };
    const bone = boneFor("never-ran", anatomy);
    render(<Tooltip id="t" bone={bone} anatomy={anatomy} />);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("never-ran vn/a");
    expect(tip).toHaveTextContent("not applicable");
    expect(tip.querySelector("dl")).toBeNull();
    expect(tip.querySelector(".xr-tip-msg")).toBeNull();
  });

  it("flips to the left side beyond the flip x", () => {
    const bone = boneFor("line-item-cap");
    const right = { ...bone, position: { x: TOOLTIP_FLIP_X, y: 10 } };
    const left = { ...bone, position: { x: TOOLTIP_FLIP_X + 1, y: 10 } };
    const { rerender } = render(<Tooltip id="t" bone={right} anatomy={signatureAnatomy()} />);
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-side", "right");
    rerender(<Tooltip id="t" bone={left} anatomy={signatureAnatomy()} />);
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-side", "left");
  });

  it("builds DOM-safe ids", () => {
    expect(slug("a b.c/d")).toBe("a_b_c_d");
    expect(tooltipId("x y")).toBe("xr-tip-x_y");
  });
});
