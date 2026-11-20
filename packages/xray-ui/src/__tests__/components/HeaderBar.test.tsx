import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeaderBar } from "../../components/shell/HeaderBar";
import { HeaderAction } from "../../components/shell/HeaderAction";
import { IconDownload } from "../../components/HeaderIcons";

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

describe("HeaderBar status note", () => {
  it("renders the status note inside the header, in a polite live region", () => {
    const { container } = render(<HeaderBar xray statusNote={<span>Trip: Mar 10 - Mar 20, 2024</span>} />);
    const header = container.querySelector("header.xr-header");
    const note = screen.getByText("Trip: Mar 10 - Mar 20, 2024");
    expect(header?.contains(note)).toBe(true);
    expect(note.closest("[aria-live]")?.getAttribute("aria-live")).toBe("polite");
  });
});

describe("HeaderBar contextNote and action icon", () => {
  it("keeps the context note in the DOM, visually hidden", () => {
    const { container } = render(<HeaderBar xray contextNote="Window: A - B" />);
    const note = screen.getByText("Window: A - B");
    expect(container.querySelector(".xr-header-brand")?.contains(note)).toBe(true);
    expect(note.classList.contains("xr-visually-hidden")).toBe(true);
  });
  it("renders an aria-hidden icon span and keeps the button name", () => {
    const { container } = render(<HeaderAction icon={<IconDownload />}>Download trace</HeaderAction>);
    const icon = container.querySelector(".xr-header-action-icon");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("button", { name: "Download trace" })).toBeTruthy();
  });
});
