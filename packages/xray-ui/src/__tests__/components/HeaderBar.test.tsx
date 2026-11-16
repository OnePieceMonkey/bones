import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeaderBar } from "../../components/shell/HeaderBar";
import { HeaderAction } from "../../components/shell/HeaderAction";

describe("HeaderBar", () => {
  it("shows wordmark and tagline", () => {
    render(<HeaderBar xray />);
    expect(screen.getByText("BONES")).toBeTruthy();
    expect(screen.getByText("the skeleton under every AI decision")).toBeTruthy();
  });
  it("shows the pill for on and off", () => {
    const { rerender } = render(<HeaderBar xray />);
    expect(screen.getByText("X-RAY ON")).toBeTruthy();
    rerender(<HeaderBar xray={false} />);
    expect(screen.getByText("X-RAY OFF")).toBeTruthy();
    expect(screen.queryByText("X-RAY ON")).toBeNull();
  });
  it("renders actions on the right and calls handlers on click, Enter and Space", async () => {
    const onA = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <HeaderBar xray headerActions={<HeaderAction onClick={onA}>Download trace</HeaderAction>} />,
    );
    expect(container.querySelector(".xr-header-actions")?.textContent).toBe("Download trace");
    const btn = screen.getByRole("button", { name: "Download trace" });
    fireEvent.click(btn);
    expect(onA).toHaveBeenCalledTimes(1);
    btn.focus();
    await user.keyboard("{Enter}");
    expect(onA).toHaveBeenCalledTimes(2);
    await user.keyboard(" ");
    expect(onA).toHaveBeenCalledTimes(3);
  });
});
