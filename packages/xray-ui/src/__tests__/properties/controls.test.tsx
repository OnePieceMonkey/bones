// Feature: visual-polish, Property 13: Knob keyboard and aria
import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Knob } from "../../components/panel/Knob";
import { Meter } from "../../components/panel/Meter";
import { buildGaugeModel } from "../../model/confidence";
import { selectBones } from "../../model/selectors";
import { arbTraceAndAnatomy } from "../helpers/arbitraries";
import { knobAngle, needleAngle, stepVersion } from "../../model/gauge";

afterEach(cleanup);

const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"] as const;

const arbCase = fc
  .uniqueArray(fc.stringMatching(/^v[0-9]{1,3}$/), { minLength: 1, maxLength: 6 })
  .chain((versions) =>
    fc.record({
      versions: fc.constant(versions),
      index: fc.integer({ min: 0, max: versions.length - 1 }),
      key: fc.constantFrom(...KEYS),
    }),
  );

describe("Property 13: Knob keyboard and aria", () => {
  it("calls onVersionChange once with stepVersion's result, never when null, and exposes the aria values", () => {
    fc.assert(
      fc.property(arbCase, ({ versions, index, key }) => {
        // Validates: Requirements 9.3, 9.4, 9.5
        const value = versions[index] as string;
        const onChange = vi.fn();
        const { unmount } = render(<Knob versions={versions} value={value} onVersionChange={onChange} />);
        const knob = screen.getByRole("slider", { name: "RULE VERSION" });
        expect(knob).toHaveAttribute("aria-valuemin", "0");
        expect(knob).toHaveAttribute("aria-valuemax", String(versions.length - 1));
        expect(knob).toHaveAttribute("aria-valuenow", String(index));
        expect(knob).toHaveAttribute("aria-valuetext", value);
        const notPrevented = fireEvent.keyDown(knob, { key });
        const expected = stepVersion(versions, value, key);
        if (expected === null) {
          expect(onChange).not.toHaveBeenCalled();
          expect(notPrevented).toBe(true);
        } else {
          expect(onChange).toHaveBeenCalledTimes(1);
          expect(onChange).toHaveBeenCalledWith(expected);
          expect(notPrevented).toBe(false);
        }
        unmount();
      }),
      { numRuns: 100 },
    );
  });
});

describe("Knob", () => {
  it("shows labels as text, rotates to the detent angle and handles label clicks", () => {
    const onChange = vi.fn();
    const { container } = render(<Knob versions={["v1", "v2", "v3"]} value="v2" onVersionChange={onChange} />);
    for (const v of ["v1", "v2", "v3"]) expect(container.textContent).toContain(v);
    const dial = container.querySelector<HTMLElement>(".xr-pknob-dial")!;
    expect(dial.getAttribute("data-angle")).toBe(String(knobAngle(1, 3)));
    expect(dial.style.transform).toBe(`rotate(${knobAngle(1, 3)}deg)`);
    expect(container.querySelector("img.xr-pknob-img")).not.toBeNull();
    fireEvent.click(screen.getByText("v3"));
    expect(onChange).toHaveBeenCalledWith("v3");
  });

  it("falls back to index 0 for an unknown value", () => {
    render(<Knob versions={["v1", "v2"]} value="zz" onVersionChange={() => {}} />);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "0");
  });
});

describe("Property 14: Meter value and needle angle", () => {
  it("has a 0..100 scale, rounds the value, and uses needleAngle (null rests at needleAngle(null))", () => {
    fc.assert(
      fc.property(arbTraceAndAnatomy, fc.boolean(), ({ trace, anatomy }, withValue) => {
        // Validates: Requirements 9.6, 9.7, 9.8
        const t = withValue ? trace : { ...trace, confidence: {} };
        const { container, unmount } = render(<Meter trace={t} anatomy={anatomy} />);
        const meter = screen.getByRole("meter", { name: "AI READ CONFIDENCE" });
        expect(meter).toHaveAttribute("aria-valuemin", "0");
        expect(meter).toHaveAttribute("aria-valuemax", "100");
        const { value } = buildGaugeModel(t, selectBones(t, anatomy));
        const needle = container.querySelector(".xr-pmeter-needle")!;
        expect(needle.getAttribute("data-angle")).toBe(String(needleAngle(value)));
        expect(container.querySelector("svg circle")).not.toBeNull();
        if (value === null) {
          expect(meter).not.toHaveAttribute("aria-valuenow");
          expect(meter).toHaveAttribute("aria-valuetext", "no confidence available");
          expect(needle.getAttribute("data-angle")).toBe(String(needleAngle(null)));
        } else {
          expect(meter).toHaveAttribute("aria-valuenow", String(Math.round(100 * value)));
          expect(meter.getAttribute("aria-valuetext")).toBe(`confidence ${value.toFixed(2)}`);
        }
        unmount();
      }),
      { numRuns: 100 },
    );
  });
});
