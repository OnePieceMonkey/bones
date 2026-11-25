import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SkeletonEnsemble } from "../../components/stage/SkeletonEnsemble";
import { selectBones } from "../../model/selectors";
import type { Anatomy, EnsembleMember } from "../../types";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

afterEach(cleanup);

const trace = signatureTrace();
const full = signatureAnatomy();
const pick = (...ids: string[]): Anatomy => ({
  ...full,
  bones: full.bones.filter((b) => ids.includes(b.ruleId)),
});

const members: EnsembleMember[] = [
  { id: "a", label: "Alpha", anatomy: pick("line-item-cap", "meal-limit") },
  { id: "b", label: "Beta", anatomy: pick("date-blocking-after") },
  { id: "c", label: "Gamma", anatomy: pick("meal-limit"), accused: true },
];

function Harness({ onSelectSpy }: { onSelectSpy?: (id: string) => void }) {
  const [id, setId] = useState<string | null>("a");
  return (
    <SkeletonEnsemble
      trace={trace}
      members={members}
      xray
      selectedId={id}
      onSelect={(next) => {
        setId(next);
        onSelectSpy?.(next);
      }}
      selectLabel="Pick one"
      reducedMotion
    />
  );
}

describe("SkeletonEnsemble", () => {
  it("renders a radiogroup with radio plates and aria-checked", () => {
    render(<Harness />);
    expect(screen.getByRole("radiogroup", { name: "Pick one" })).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
  });

  it("uses a roving tabindex", () => {
    render(<Harness />);
    expect(screen.getAllByRole("radio").map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it("moves with arrow keys, Home and End and wraps around", () => {
    render(<Harness />);
    const group = screen.getByRole("radiogroup");
    const checked = () => screen.getAllByRole("radio").map((r) => r.getAttribute("aria-checked"));
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(checked()).toEqual(["false", "true", "false"]);
    fireEvent.keyDown(group, { key: "End" });
    expect(checked()).toEqual(["false", "false", "true"]);
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(checked()).toEqual(["true", "false", "false"]);
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(checked()).toEqual(["false", "false", "true"]);
    fireEvent.keyDown(group, { key: "Home" });
    expect(checked()).toEqual(["true", "false", "false"]);
    expect(screen.getAllByRole("radio").map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it("calls onSelect on click, Enter and Space", () => {
    const spy = vi.fn();
    render(<Harness onSelectSpy={spy} />);
    fireEvent.click(screen.getByRole("radio", { name: "Beta" }));
    expect(spy).toHaveBeenLastCalledWith("b");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Gamma" }), { key: "Enter" });
    expect(spy).toHaveBeenLastCalledWith("c");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Alpha" }), { key: " " });
    expect(spy).toHaveBeenLastCalledWith("a");
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("renders plates only when xray is false", () => {
    const { container } = render(
      <SkeletonEnsemble trace={trace} members={members} xray={false} selectedId="a" onSelect={() => {}} selectLabel="Pick" />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(container.querySelector("img, .xr-hotspot, .xr-ecg, .xr-stage, .xr-ensemble-stage")).toBeNull();
  });

  it("shows different bone states per member on one trace", () => {
    const { container } = render(<Harness />);
    const cells = [...container.querySelectorAll(".xr-ensemble-member")];
    expect(cells).toHaveLength(3);
    const counts = cells.map((c) => c.querySelectorAll(".xr-hotspot").length);
    expect(counts).toEqual([2, 1, 1]);
    const fractured = cells.map((c) => c.querySelectorAll('.xr-hotspot[data-state="fractured"]').length);
    expect(fractured).toEqual(
      members.map((m) => selectBones(trace, m.anatomy).filter((b) => b.state === "fractured").length),
    );
    expect(new Set(fractured).size).toBeGreaterThan(1);
  });

  it("marks the accused member on plate and cell", () => {
    const { container } = render(<Harness />);
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("data-accused"))).toEqual(["false", "false", "true"]);
    expect([...container.querySelectorAll(".xr-ensemble-member")].map((c) => c.getAttribute("data-accused"))).toEqual([
      "false",
      "false",
      "true",
    ]);
  });
});
