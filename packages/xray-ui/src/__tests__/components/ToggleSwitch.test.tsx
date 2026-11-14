import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToggleSwitch } from "../../components/ToggleSwitch";

function setup(xray: boolean) {
  const onXrayChange = vi.fn();
  const utils = render(<ToggleSwitch xray={xray} onXrayChange={onXrayChange} />);
  const toggle = screen.getByRole("switch");
  return { onXrayChange, toggle, ...utils };
}

describe("ToggleSwitch", () => {
  it.each([true, false])("exposes role switch with aria-checked=%s", (xray) => {
    const { toggle } = setup(xray);
    expect(toggle).toHaveAttribute("aria-checked", String(xray));
  });

  it.each([true, false])("click calls onXrayChange(!xray) once (xray=%s)", async (xray) => {
    const user = userEvent.setup();
    const { toggle, onXrayChange } = setup(xray);
    await user.click(toggle);
    expect(onXrayChange).toHaveBeenCalledTimes(1);
    expect(onXrayChange).toHaveBeenCalledWith(!xray);
  });

  it.each([" ", "{Enter}"])("key %j calls onXrayChange(!xray) once", async (key) => {
    const user = userEvent.setup();
    const { toggle, onXrayChange } = setup(false);
    toggle.focus();
    await user.keyboard(key);
    expect(onXrayChange).toHaveBeenCalledTimes(1);
    expect(onXrayChange).toHaveBeenCalledWith(true);
  });

  it("lamp is lit while on and unlit while off", () => {
    const on = setup(true);
    expect(on.container.querySelector(".xr-toggle-lamp")).toHaveAttribute("data-lit", "true");
    on.unmount();
    const off = setup(false);
    expect(off.container.querySelector(".xr-toggle-lamp")).toHaveAttribute("data-lit", "false");
  });

  it("shows X-RAY with ON or OFF state text", () => {
    const on = setup(true);
    expect(on.toggle).toHaveTextContent("X-RAY");
    expect(on.toggle).toHaveTextContent("ON");
    on.unmount();
    const off = setup(false);
    expect(off.toggle).toHaveTextContent("X-RAY");
    expect(off.toggle).toHaveTextContent("OFF");
  });
});
