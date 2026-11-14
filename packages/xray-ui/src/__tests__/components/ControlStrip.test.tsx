import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ControlStrip } from "../../components/ControlStrip";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj as Record<string, unknown>)) deepFreeze(v);
  }
  return obj;
}

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

  it("ArrowRight via user-event reaches onVersionChange with the next version", async () => {
    const user = userEvent.setup();
    const onVersionChange = vi.fn();
    render(
      <ControlStrip
        trace={signatureTrace()}
        anatomy={signatureAnatomy()}
        versions={["v1", "v2", "v3"]}
        value="v2"
        onVersionChange={onVersionChange}
        xray
        onXrayChange={() => {}}
        reducedMotion
      />,
    );
    screen.getByRole("slider", { name: "RULE VERSION" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onVersionChange).toHaveBeenCalledTimes(1);
    expect(onVersionChange).toHaveBeenCalledWith("v3");
  });

  it("toggle click calls onXrayChange with the negated value", async () => {
    const user = userEvent.setup();
    const onXrayChange = vi.fn();
    render(
      <ControlStrip
        trace={signatureTrace()}
        anatomy={signatureAnatomy()}
        versions={["v1", "v2", "v3"]}
        value="v1"
        onVersionChange={() => {}}
        xray={false}
        onXrayChange={onXrayChange}
        reducedMotion
      />,
    );
    await user.click(screen.getByRole("switch"));
    expect(onXrayChange).toHaveBeenCalledTimes(1);
    expect(onXrayChange).toHaveBeenCalledWith(true);
  });

  it("does not mutate a deep-frozen trace while interacting", async () => {
    const user = userEvent.setup();
    const trace = deepFreeze(signatureTrace());
    const before = JSON.stringify(trace);
    render(
      <ControlStrip
        trace={trace}
        anatomy={signatureAnatomy()}
        versions={["v1", "v2", "v3"]}
        value="v1"
        onVersionChange={() => {}}
        xray
        onXrayChange={() => {}}
        reducedMotion
      />,
    );
    await user.click(screen.getByRole("switch"));
    await user.keyboard("{Tab}{ArrowRight}");
    expect(JSON.stringify(trace)).toBe(before);
  });

  it("gauge in the strip reflects the trace via its value text", () => {
    const trace = signatureTrace();
    const { container } = render(
      <ControlStrip
        trace={trace}
        anatomy={signatureAnatomy()}
        versions={["v1", "v2", "v3"]}
        value="v1"
        onVersionChange={() => {}}
        xray
        onXrayChange={() => {}}
        reducedMotion
      />,
    );
    const meter = screen.getByRole("meter", { name: "AI READ CONFIDENCE" });
    const text = meter.getAttribute("aria-valuetext");
    expect(text).toBeTruthy();
    expect(container.querySelector(".xr-gauge-value")?.textContent).toBe(text);
  });

  it("renders no anim- class when reducedMotion is true", () => {
    const { container } = render(
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
    expect(container.innerHTML).not.toMatch(/anim-/);
  });

  it("renders anim- classes when reducedMotion is false (forwarding is effective)", () => {
    const { container } = render(
      <ControlStrip
        trace={signatureTrace()}
        anatomy={signatureAnatomy()}
        versions={["v1", "v2", "v3"]}
        value="v1"
        onVersionChange={() => {}}
        xray
        onXrayChange={() => {}}
        reducedMotion={false}
      />,
    );
    expect(container.innerHTML).toMatch(/anim-/);
  });
});
