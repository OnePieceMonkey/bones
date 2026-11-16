import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ControlPanel } from "../../components/panel/ControlPanel";
import { buildGaugeModel } from "../../model/confidence";
import { selectBones } from "../../model/selectors";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

afterEach(cleanup);

function setup(overrides: { xray?: boolean } = {}) {
  const trace = signatureTrace();
  const anatomy = signatureAnatomy();
  const onVersionChange = vi.fn();
  const onXrayChange = vi.fn();
  const view = render(
    <ControlPanel
      trace={trace}
      anatomy={anatomy}
      versions={["v1", "v2", "v3"]}
      value="v2"
      onVersionChange={onVersionChange}
      xray={overrides.xray ?? true}
      onXrayChange={onXrayChange}
    />,
  );
  return { ...view, trace, anatomy, onVersionChange, onXrayChange };
}

describe("ControlPanel", () => {
  it("shows four aria-hidden screws with distinct rotations", () => {
    const { container } = setup();
    const screws = container.querySelectorAll<HTMLElement>(".xr-screw");
    expect(screws).toHaveLength(4);
    screws.forEach((s) => expect(s.getAttribute("aria-hidden")).toBe("true"));
    const rots = Array.from(screws).map((s) => s.style.getPropertyValue("--xr-screw-rot"));
    expect(new Set(rots).size).toBe(4);
  });

  it("shows the three labels as text", () => {
    const { container } = setup();
    const plaques = Array.from(container.querySelectorAll(".xr-cpanel-plaque")).map((p) => p.textContent);
    expect(plaques).toEqual(["RULE VERSION", "AI READ CONFIDENCE", "X-RAY"]);
  });

  it("wires the knob and the toggle to the callbacks", () => {
    const { onVersionChange, onXrayChange } = setup();
    fireEvent.keyDown(screen.getByRole("slider", { name: "RULE VERSION" }), { key: "ArrowRight" });
    expect(onVersionChange).toHaveBeenCalledWith("v3");
    fireEvent.click(screen.getByRole("switch", { name: "X-RAY" }));
    expect(onXrayChange).toHaveBeenCalledWith(false);
  });

  it("puts the knob before the toggle in tab order and keeps the meter out of it", () => {
    const { container } = setup();
    const tabbable = Array.from(
      container.querySelectorAll<HTMLElement>("[tabindex], button"),
    ).filter((el) => el.tabIndex >= 0);
    expect(tabbable.map((el) => el.getAttribute("role"))).toEqual(["slider", "switch"]);
  });

  it("feeds the meter from the trace confidence", () => {
    const { trace, anatomy } = setup();
    const { value } = buildGaugeModel(trace, selectBones(trace, anatomy));
    const meter = screen.getByRole("meter", { name: "AI READ CONFIDENCE" });
    if (value === null) expect(meter).not.toHaveAttribute("aria-valuenow");
    else expect(meter).toHaveAttribute("aria-valuenow", String(Math.round(100 * value)));
  });
});
