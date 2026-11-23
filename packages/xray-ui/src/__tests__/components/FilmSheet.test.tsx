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
  it("shows a decorative paper thumbnail with the caller's lines that does not change the name or description", () => {
    const lines = ["HARBOR GRILL", "Grilled salmon 22.00", "TOTAL 48.00"];
    const { container } = render(<FilmSheet id="s1" title="T" description="D" lines={lines} onSelect={() => {}} />);
    expect(container.querySelector("img")).toBeNull();
    const paper = container.querySelector(".xr-sheet-paper");
    expect(paper).toHaveAttribute("aria-hidden", "true");
    expect([...(paper?.querySelectorAll(".xr-sheet-line") ?? [])].map((e) => e.textContent)).toEqual(lines);
    const tilt = Number(/--xr-tilt: (-?[\d.]+)deg/.exec(paper?.getAttribute("style") ?? "")?.[1]);
    expect(tilt).toBeGreaterThanOrEqual(-3);
    expect(tilt).toBeLessThanOrEqual(3);
    const b = screen.getByRole("button", { name: "T" });
    expect(b).toHaveAccessibleDescription("D");
  });

  it("derives the tilt from the title without randomness, in [-3, 3]", () => {
    const tiltOf = (title: string) => {
      const { container } = render(<FilmSheet id="s1" title={title} description="D" onSelect={() => {}} />);
      const t = Number(/--xr-tilt: (-?[\d.]+)deg/.exec(container.querySelector(".xr-sheet-paper")?.getAttribute("style") ?? "")?.[1]);
      cleanup();
      return t;
    };
    const titles = ["Signature case", "Clean meal", "Outside the trip window"];
    const tilts = titles.map(tiltOf);
    expect(titles.map(tiltOf)).toEqual(tilts);
    expect(new Set(tilts).size).toBeGreaterThan(1);
    for (const t of tilts) expect(Math.abs(t)).toBeLessThanOrEqual(3);
  });

  it("has no border and lifts and glows on hover and keyboard focus", () => {
    expect(css).toMatch(/\.xr-sheet \{[^}]*border: 0;/);
    expect(css).toMatch(/\.xr-sheet:focus-visible:not\(:disabled\)[^{]*\{[^}]*translateY\(-4px\)/);
    expect(css).toMatch(/\.xr-sheet:focus-visible:not\(:disabled\)::after/);
  });

  it("keeps the clip decorative", () => {
    const { container } = render(<FilmSheet id="s1" title="T" description="D" onSelect={() => {}} />);
    expect(container.querySelector(".xr-sheet-clip")).toHaveAttribute("aria-hidden", "true");
  });
});
