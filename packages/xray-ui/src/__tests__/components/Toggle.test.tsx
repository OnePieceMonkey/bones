import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Toggle } from "../../components/panel/Toggle";
afterEach(cleanup);
const css = readFileSync(resolve(__dirname, "../../styles/controls.css"), "utf8");
function rule(selector: string): string {
  const i = css.indexOf(`${selector} {`);
  expect(i).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf("}", i));
}
describe("Toggle and Lamp", () => {
  it("exposes aria-checked true and false with a non-empty name", () => {
    const { rerender } = render(<Toggle xray={true} onXrayChange={() => {}} />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(sw.getAttribute("aria-label")).toBeTruthy();
    rerender(<Toggle xray={false} onXrayChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });
  it("calls onXrayChange with the opposite value", () => {
    const fn = vi.fn();
    render(<Toggle xray={false} onXrayChange={fn} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(true);
  });
  it("marks the lever and lamp state and keeps the lamp decorative", () => {
    const { container, rerender } = render(<Toggle xray={true} onXrayChange={() => {}} />);
    expect(container.querySelector(".xr-ptoggle-lever")).toHaveAttribute("data-on", "true");
    expect(container.querySelector(".xr-plamp")).toHaveAttribute("data-lit", "true");
    expect(container.querySelector(".xr-plamp")).toHaveAttribute("aria-hidden", "true");
    rerender(<Toggle xray={false} onXrayChange={() => {}} />);
    expect(container.querySelector(".xr-ptoggle-lever")).toHaveAttribute("data-on", "false");
    expect(container.querySelector(".xr-plamp")).toHaveAttribute("data-lit", "false");
  });
  it("puts the lamp before the lever in the switch and keeps role and state", () => {
    render(<Toggle xray={true} onXrayChange={() => {}} />);
    const sw = screen.getByRole("switch");
    const kids = Array.from(sw.children);
    expect(kids[0]).toHaveClass("xr-plamp");
    expect(kids[1]).toHaveClass("xr-ptoggle-lever");
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(rule(".xr-ptoggle")).toContain("flex-direction: column");
    expect(rule(".xr-ptoggle-lever")).toContain("calc(52 *");
    expect(rule(".xr-shell .xr-plamp")).toContain("calc(26 *");
  });
  it("draws the lever as SVG with a chrome base and no image", () => {
    const { container } = render(<Toggle xray={false} onXrayChange={() => {}} />);
    const lever = container.querySelector(".xr-ptoggle-lever")!;
    expect(lever.querySelector("img")).toBeNull();
    expect(lever.querySelector(".xr-ptoggle-base")).not.toBeNull();
    expect(lever.querySelector("polygon.xr-ptoggle-arm-shape")).not.toBeNull();
    expect(lever.querySelector("circle.xr-ptoggle-ball")).not.toBeNull();
    expect(rule(".xr-ptoggle-base")).toContain("conic-gradient");
  });
  it("styles the lever tilt and lamp filters in CSS", () => {
    expect(rule(".xr-ptoggle-arm")).toContain("rotate(180deg)");
    expect(rule('.xr-ptoggle-lever[data-on="true"] .xr-ptoggle-arm')).toContain("rotate(0deg)");
    expect(css).not.toContain("scaleY(-1)");
    const on = rule('.xr-plamp[data-lit="true"]');
    expect(on).toContain("brightness(1.6)");
    expect(on).toMatch(/drop-shadow\(0 0 calc\(10 \* var\(--xr-u, 1px\)\) var\(--xr-amber-glow\)\)/);
    const off = rule(".xr-plamp");
    expect(off).toContain("brightness(0.8)");
    expect(off).not.toContain("drop-shadow");
  });
});
