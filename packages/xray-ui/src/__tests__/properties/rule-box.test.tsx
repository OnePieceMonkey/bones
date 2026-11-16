// Feature: visual-polish, Property 9: Rule box content is complete
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Lightbox } from "../../components/Lightbox";
import { Stage } from "../../components/stage/Stage";
import { HoveredRuleProvider } from "../../hooks/useHoveredRule";
import { evidenceRows, selectBones, stateText } from "../../model/selectors";
import { arbTraceAndAnatomy } from "../helpers/arbitraries";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Property 9: Rule box content is complete", () => {
  it("shows label, version, state text and one row per evidence row, or the empty indication", () => {
    fc.assert(
      fc.property(arbTraceAndAnatomy, ({ trace, anatomy }) => {
        // Validates: Requirements 11.1, 11.9
        const bones = selectBones(trace, anatomy);
        const { container, unmount } = render(<Stage trace={trace} anatomy={anatomy} />);
        const buttons = [...container.querySelectorAll<HTMLButtonElement>("button.xr-bone-btn")];
        buttons.forEach((btn, i) => {
          const bone = bones[i]!;
          fireEvent.focus(btn);
          const tip = screen.getByRole("tooltip");
          expect(tip.textContent).toContain(`${bone.ruleId} v${bone.version ?? "n/a"}`);
          expect(tip.textContent).toContain(stateText(bone));
          const rows = bone.outcome ? evidenceRows(bone.outcome, anatomy) : [];
          expect(tip.querySelectorAll("dl > div")).toHaveLength(rows.length);
          expect(tip.querySelectorAll(".xr-rb-empty")).toHaveLength(rows.length === 0 ? 1 : 0);
          fireEvent.blur(btn);
        });
        unmount();
      }),
      { numRuns: 100 },
    );
  });
});

function firstButton(container: HTMLElement): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>("button.xr-bone-btn")!;
}

describe("Rule box", () => {
  const ui = () => (
    <HoveredRuleProvider>
      <Stage trace={signatureTrace()} anatomy={signatureAnatomy()} />
    </HoveredRuleProvider>
  );

  it("opens on hover and focus, closes on leave, blur and Escape, and sets aria-describedby", () => {
    const { container } = render(ui());
    const btn = firstButton(container);
    const spot = btn.closest(".xr-hotspot-wrap")!;
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.pointerEnter(spot);
    const tip = screen.getByRole("tooltip");
    expect(btn.getAttribute("aria-describedby")).toBe(tip.id);
    fireEvent.pointerLeave(spot);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(btn.getAttribute("aria-describedby")).toBeNull();

    btn.focus();
    fireEvent.focus(btn);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    expect(document.activeElement).toBe(btn);
    fireEvent.keyDown(btn, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(btn.getAttribute("aria-describedby")).toBeNull();
    expect(document.activeElement).toBe(btn);

    fireEvent.blur(btn);
    fireEvent.focus(btn);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.blur(btn);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("renders without position and without a line when rects are all zero", () => {
    const { container } = render(ui());
    fireEvent.focus(firstButton(container));
    expect(screen.getByRole("tooltip").getAttribute("style")).toBeNull();
    expect(document.querySelector(".xr-rb-line")).toBeNull();
  });

  it("draws a decorative cyan line of width 2 with an end dot inside the lightbox when rects are measured", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const make = (left: number, top: number, width: number, height: number) =>
        ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;
      if (this.classList.contains("xr-viewport")) return make(0, 0, 1000, 600);
      if (this.classList.contains("xr-hotspot")) return make(200, 300, 44, 44);
      if (this.classList.contains("xr-rulebox")) return make(0, 0, 200, 100);
      return make(0, 0, 0, 0);
    });
    const { container } = render(
      <HoveredRuleProvider>
        <Lightbox xray>
          <Stage trace={signatureTrace()} anatomy={signatureAnatomy()} />
        </Lightbox>
      </HoveredRuleProvider>,
    );
    fireEvent.focus(firstButton(container));
    const viewport = container.querySelector(".xr-viewport")!;
    const tip = screen.getByRole("tooltip");
    expect(viewport.contains(tip)).toBe(true);
    const svg = viewport.querySelector(".xr-rb-line")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    const line = svg.querySelector("line")!;
    const width = Number(line.getAttribute("stroke-width"));
    expect(width).toBeGreaterThanOrEqual(2);
    expect(width).toBeLessThanOrEqual(3);
    const dot = svg.querySelector("circle")!;
    expect(dot.getAttribute("cx")).toBe(line.getAttribute("x2"));
    expect(dot.getAttribute("cy")).toBe(line.getAttribute("y2"));
    expect(Number(dot.getAttribute("r"))).toBeGreaterThan(0);
    expect(Number(line.getAttribute("x2"))).toBe(222);
    expect(Number(line.getAttribute("y2"))).toBe(322);
    // Hotspot centre is left of the middle, so the box sits on the right with a 24 px gap.
    expect(tip.style.left).toBe("246px");
  });

  it("styles the line with the cyan token, at least 2 px, and a cyan end dot", () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../styles/stage.css"), "utf8");
    const lineRule = /\.xr-rb-line line\s*{([^}]*)}/.exec(css)![1]!;
    expect(lineRule).toMatch(/stroke:\s*var\(--xr-cyan\)/);
    expect(Number(/stroke-width:\s*([\d.]+)/.exec(lineRule)![1])).toBeGreaterThanOrEqual(2);
    expect(/\.xr-rb-line circle\s*{([^}]*)}/.exec(css)![1]).toMatch(/fill:\s*var\(--xr-cyan\)/);
  });

  it("shows the empty-evidence text for a rule without evidence rows", () => {
    const trace = signatureTrace();
    const anatomy = signatureAnatomy();
    const never = { ...anatomy, bones: [{ ruleId: "never-ran", label: "Never ran", region: "skull" as const }] };
    const { container } = render(<Stage trace={trace} anatomy={never as typeof anatomy} />);
    fireEvent.focus(firstButton(container));
    const tip = screen.getByRole("tooltip");
    expect(tip.querySelector(".xr-rb-empty")?.textContent).toBe("No evidence recorded");
    expect(tip.textContent).toContain("never-ran vn/a");
  });
});
