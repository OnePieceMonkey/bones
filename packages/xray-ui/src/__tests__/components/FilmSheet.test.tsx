import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FilmSheet } from "../../components/FilmSheet";
afterEach(cleanup);
const css = readFileSync(resolve(__dirname, "../../styles/sheet.css"), "utf8");

describe("FilmSheet", () => {
  it("is a button named by its title and described by its description", () => {
    render(<FilmSheet id="s1" title="First sheet" description="One line." onSelect={() => {}} />);
    const b = screen.getByRole("button", { name: "First sheet" });
    expect(b).toHaveAttribute("type", "button");
    expect(b).toHaveAccessibleDescription("One line.");
    expect(b).toHaveAttribute("data-selected", "false");
  });
  it("calls onSelect once per click", () => {
    const fn = vi.fn();
    render(<FilmSheet id="s1" title="T" description="D" onSelect={fn} />);
    fireEvent.click(screen.getByRole("button"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("does not call onSelect while disabled", () => {
    const fn = vi.fn();
    render(<FilmSheet id="s1" title="T" description="D" disabled onSelect={fn} />);
    const b = screen.getByRole("button");
    expect(b).toBeDisabled();
    fireEvent.click(b);
    expect(fn).not.toHaveBeenCalled();
  });
  it("marks the selected sheet and slides with a 500 ms transform transition", () => {
    render(<FilmSheet id="s1" title="T" description="D" selected onSelect={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute("data-selected", "true");
    expect(css).toMatch(/\.xr-sheet \{[^}]*transition: transform 500ms/);
    expect(css).toMatch(/\.xr-sheet\[data-selected="true"\] \{[^}]*transform:/);
  });
  it("removes the transition in Reduced_Motion", () => {
    render(<FilmSheet id="s1" title="T" description="D" reducedMotion onSelect={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute("data-reduced", "true");
    expect(css).toMatch(/\.xr-sheet\[data-reduced="true"\], \.xr-sheet\[data-reduced="true"\]::after \{ transition: none; \}/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.xr-sheet, \.xr-sheet::after \{ transition: none; \}/);
  });
  it("shows a decorative paper thumbnail that does not change the name or description", () => {
    const { container } = render(<FilmSheet id="s1" title="T" description="D" onSelect={() => {}} />);
    const img = container.querySelector("img.xr-sheet-thumb");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(img).toHaveAttribute("width");
    expect(img).toHaveAttribute("height");
    const b = screen.getByRole("button", { name: "T" });
    expect(b).toHaveAccessibleDescription("D");
  });
  it("lifts 4 px on hover with a pseudo-element glow that fades in", () => {
    expect(css).toMatch(/\.xr-sheet:hover:not\(:disabled\)[^{]*\{[^}]*translateY\(calc\(-4 \*/);
    expect(css).toMatch(/\.xr-sheet::after \{[^}]*opacity: 0;[^}]*transition: opacity/);
  });
  it("keeps the clip decorative", () => {
    const { container } = render(<FilmSheet id="s1" title="T" description="D" onSelect={() => {}} />);
    expect(container.querySelector(".xr-sheet-clip")).toHaveAttribute("aria-hidden", "true");
  });
});
