import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ControlStrip } from "../../components/ControlStrip";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

describe("ControlStrip", () => {
  it("groups the knob, gauge and switch", () => {
    render(
      <ControlStrip
        trace={signatureTrace()}
        anatomy={signatureAnatomy()}
        versions={["v1", "v2", "v3"]}
        value="v1"
        onVersionChange={() => {}}
        xray
        onXrayChange={() => {}}
        reducedMotion
      />,
    );
    const group = screen.getByRole("group", { name: "Controls" });
    expect(group).toContainElement(screen.getByRole("slider", { name: "RULE VERSION" }));
    expect(group).toContainElement(screen.getByRole("meter", { name: "AI READ CONFIDENCE" }));
    expect(group).toContainElement(screen.getByRole("switch"));
  });

  it("forwards version and x-ray changes without touching the trace", () => {
    const trace = signatureTrace();
    const before = JSON.stringify(trace);
    const onVersionChange = vi.fn();
    const onXrayChange = vi.fn();
    render(
      <ControlStrip
        trace={trace}
        anatomy={signatureAnatomy()}
        versions={["v1", "v2", "v3"]}
        value="v1"
        onVersionChange={onVersionChange}
        xray
        onXrayChange={onXrayChange}
        reducedMotion
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onXrayChange).toHaveBeenCalledWith(false);
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" });
    expect(onVersionChange).toHaveBeenCalledWith("v2");
    expect(JSON.stringify(trace)).toBe(before);
  });
});
