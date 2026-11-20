import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ShellFrame } from "../../components/shell/ShellFrame";
import { installMatchMedia, restoreMatchMedia } from "../helpers/matchMedia";

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../styles/shell.css"), "utf8");

afterEach(() => {
  cleanup();
  restoreMatchMedia();
});

describe("ShellFrame", () => {
  it("renders exactly one h1, visually hidden but in the accessibility tree", () => {
    const { container } = render(<ShellFrame heading="Audit" xray />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    const h1 = screen.getByRole("heading", { level: 1, name: "Audit" });
    expect(h1.className).toContain("xr-visually-hidden");
    expect(h1.hasAttribute("hidden")).toBe(false);
    expect(h1.getAttribute("aria-hidden")).toBeNull();
  });

  it("renders header, steel frame, lightbox with children and controls", () => {
    const { container } = render(
      <ShellFrame heading="h" xray lightboxLabel="Viewer" controls={<div data-testid="ctl" />}>
        <p>content</p>
      </ShellFrame>,
    );
    expect(container.querySelector("header.xr-header")).toBeTruthy();
    expect(container.querySelector(".xr-steel .xr-lightbox .xr-viewport")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Viewer" })).toBeTruthy();
    expect(screen.getByText("content")).toBeTruthy();
    expect(screen.getByTestId("ctl")).toBeTruthy();
    expect(container.querySelector(".xr-pill")).toBeNull();
    expect(container.querySelector(".xr-title-plate")).toBeNull();
  });

  it("sets data-motion, xr-live and data-intro for each prop value", () => {
    const { container, rerender } = render(<ShellFrame heading="h" xray reducedMotion introPhase="running" />);
    const root = () => container.querySelector(".xr-shell") as HTMLElement;
    expect(root().dataset.motion).toBe("reduce");
    expect(root().classList.contains("xr-live")).toBe(false);
    expect(root().dataset.intro).toBe("done");
    rerender(<ShellFrame heading="h" xray reducedMotion={false} introPhase="running" />);
    expect(root().dataset.motion).toBe("full");
    expect(root().classList.contains("xr-live")).toBe(true);
    expect(root().dataset.intro).toBe("running");
  });

  it("follows the media query only when the prop is absent", () => {
    installMatchMedia(true);
    const { container, rerender } = render(<ShellFrame heading="h" xray />);
    const root = () => container.querySelector(".xr-shell") as HTMLElement;
    expect(root().dataset.motion).toBe("auto");
    expect(root().classList.contains("xr-live")).toBe(false);
    expect(root().dataset.intro).toBe("done");
    rerender(<ShellFrame heading="h" xray reducedMotion={false} />);
    expect(root().dataset.motion).toBe("full");
    expect(root().classList.contains("xr-live")).toBe(true);
  });

  it("declares the scaling unit, minimum size and grid in CSS", () => {
    expect(css).toMatch(/--xr-u:[^;]*100vw \/ 1280[^;]*100vh \/ 720/);
    expect(css).toMatch(/min-width:\s*1280px/);
    expect(css).toMatch(/min-height:\s*720px/);
    // visual-polish-2 R5.1 supersedes visual-polish R1: four columns and explicit grid-area placement replace the three-column named areas.
    expect(css).toMatch(/grid-template-columns:\s*28fr 8fr 38fr 26fr/);
    expect(css).toMatch(/grid-template-rows:\s*62fr 38fr/);
    expect(css).toContain(".xr-doc { grid-area: 1 / 1 / 2 / 2; }");
    expect(css).toContain(".xr-cpanel { grid-area: 2 / 1 / 3 / 3; }");
    expect(css).toContain(".xr-doctor { grid-area: 1 / 4 / 3 / 5; }");
    expect(css).toContain("grid-area: 1 / 2 / 3 / 4;");
    expect(css).toMatch(/\[data-motion="reduce"\][\s\S]*animation:\s*none/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.xr-shell\[data-motion="auto"\]/);
  });
});
