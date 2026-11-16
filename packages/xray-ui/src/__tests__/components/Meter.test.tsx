import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Meter } from "../../components/panel/Meter";
import { needleAngle } from "../../model/gauge";
import { needleSwing } from "../../model/needleSwing";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

afterEach(cleanup);

const withConfidence = (c: number) => {
  const trace = signatureTrace();
  const confidence = Object.fromEntries(Object.keys(trace.confidence).map((k) => [k, c]));
  return { ...trace, confidence };
};

describe("Meter needle motion", () => {
  it("passes --from, --over and --to from needleSwing, starting at the resting angle", () => {
    const anatomy = signatureAnatomy();
    const { container } = render(<Meter trace={withConfidence(0.9)} anatomy={anatomy} />);
    const needle = container.querySelector<SVGGElement>(".xr-pmeter-needle")!;
    const to = needleAngle(0.9);
    const swing = needleSwing(needleAngle(null), to);
    expect(needle.style.getPropertyValue("--from")).toBe(`${swing.from}deg`);
    expect(needle.style.getPropertyValue("--over")).toBe(`${swing.over}deg`);
    expect(needle.style.getPropertyValue("--to")).toBe(`${to}deg`);
  });

  it("uses the previous angle as --from and remounts the needle when the value changes", () => {
    const anatomy = signatureAnatomy();
    const { container, rerender } = render(<Meter trace={withConfidence(0.9)} anatomy={anatomy} />);
    const first = container.querySelector<SVGGElement>(".xr-pmeter-needle")!;
    rerender(<Meter trace={withConfidence(0.3)} anatomy={anatomy} />);
    const second = container.querySelector<SVGGElement>(".xr-pmeter-needle")!;
    expect(second).not.toBe(first);
    const swing = needleSwing(needleAngle(0.9), needleAngle(0.3));
    expect(second.style.getPropertyValue("--from")).toBe(`${swing.from}deg`);
    expect(second.style.getPropertyValue("--over")).toBe(`${swing.over}deg`);
    expect(second.style.getPropertyValue("--to")).toBe(`${swing.to}deg`);
  });

  it("keeps the same needle element when the value does not change", () => {
    const anatomy = signatureAnatomy();
    const { container, rerender } = render(<Meter trace={withConfidence(0.5)} anatomy={anatomy} />);
    const first = container.querySelector(".xr-pmeter-needle");
    rerender(<Meter trace={withConfidence(0.5)} anatomy={anatomy} />);
    expect(container.querySelector(".xr-pmeter-needle")).toBe(first);
  });
});
