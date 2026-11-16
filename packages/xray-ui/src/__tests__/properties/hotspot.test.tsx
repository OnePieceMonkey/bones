// Feature: visual-polish, Property 3: Hotspot visual state follows the bone state
// Feature: visual-polish, Property 5: Every hotspot has a complete accessible name
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Stage } from "../../components/stage/Stage";
import { HoveredRuleProvider } from "../../hooks/useHoveredRule";
import { hotspotState } from "../../model/hotspotState";
import { selectBones, stateText } from "../../model/selectors";
import { arbTraceAndAnatomy } from "../helpers/arbitraries";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

afterEach(cleanup);

describe("Property 3: Hotspot visual state follows the bone state", () => {
  it("sets data-state from hotspotState and renders check, burst and splinters only as allowed", () => {
    fc.assert(
      fc.property(arbTraceAndAnatomy, ({ trace, anatomy }) => {
        // Validates: Requirements 10.8, 10.9, 10.10, 10.11
        const bones = selectBones(trace, anatomy);
        const { container, unmount } = render(<Stage trace={trace} anatomy={anatomy} />);
        const spots = [...container.querySelectorAll<HTMLElement>(".xr-hotspot")];
        expect(spots).toHaveLength(bones.length);
        spots.forEach((el, i) => {
          const state = hotspotState(bones[i]!);
          expect(el.getAttribute("data-state")).toBe(state);
          expect(el.querySelector(`.xr-hs-ring--${state}`)).not.toBeNull();
          expect(el.querySelectorAll(".xr-hs-check")).toHaveLength(state === "applied-no-change" ? 1 : 0);
          if (state === "passed" || state === "not-applicable") {
            expect(el.querySelector(".xr-burst, .xr-splinter")).toBeNull();
          }
        });
        unmount();
      }),
      { numRuns: 100 },
    );
  });
});

describe("Property 5: Every hotspot has a complete accessible name", () => {
  it("names each focusable hotspot with label, rule version and state text", () => {
    fc.assert(
      fc.property(arbTraceAndAnatomy, ({ trace, anatomy }) => {
        // Validates: Requirements 10.13, 17.5
        const bones = selectBones(trace, anatomy);
        const { container, unmount } = render(<Stage trace={trace} anatomy={anatomy} />);
        const buttons = [...container.querySelectorAll<HTMLButtonElement>(".xr-hotspot button.xr-bone-btn")];
        expect(buttons).toHaveLength(bones.length);
        buttons.forEach((btn, i) => {
          const bone = bones[i]!;
          const name = btn.getAttribute("aria-label") ?? "";
          expect(name).toContain(bone.label);
          expect(name).toContain(`version ${bone.version ?? "n/a"}`);
          expect(name).toContain(stateText(bone));
          expect(btn.tabIndex).toBeGreaterThanOrEqual(0);
        });
        unmount();
      }),
      { numRuns: 100 },
    );
  });
});

describe("Stage", () => {
  it("renders one hotspot per bone, with a tooltip on focus that Escape dismisses", () => {
    const anatomy = signatureAnatomy();
    const { container } = render(
      <HoveredRuleProvider>
        <Stage trace={signatureTrace()} anatomy={anatomy} />
      </HoveredRuleProvider>,
    );
    expect(container.querySelectorAll(".xr-hotspot")).toHaveLength(anatomy.bones.length);
    const first = container.querySelector<HTMLButtonElement>("button.xr-bone-btn[data-state]")!;
    fireEvent.focus(first);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    expect(first.getAttribute("aria-describedby")).toBe(screen.getByRole("tooltip").id);
    fireEvent.keyDown(first, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.blur(first);
    expect(first.getAttribute("aria-describedby")).toBeNull();
  });

  it("defines a visible two-tone focus ring in CSS", () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../styles/stage.css"), "utf8");
    expect(css).toMatch(/\.xr-hotspot \.xr-bone-btn:focus-visible[^}]*outline:\s*calc\(3 \* var\(--xr-u/);
    expect(css).toMatch(/box-shadow:\s*0 0 0 calc\(5 \* var\(--xr-u[^}]*var\(--xr-focus-contrast\)/);
  });
});
