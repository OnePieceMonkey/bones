import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Stage } from "../../components/stage/Stage";
import { EcgBand } from "../../components/stage/EcgBand";
import { selectBones } from "../../model/selectors";
import { placeBones, toCropPercent } from "../../model/anchors";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";
afterEach(cleanup);
function spikeXs(d: string): number[] {
  return [...d.matchAll(/L(-?[\d.]+),2(?=\s|$)/g)].map((m) => Number(m[1]));
}
describe("EcgBand", () => {
  it("aligns spike x positions with fractured hotspot x percent", () => {
    const trace = signatureTrace();
    const anatomy = signatureAnatomy();
    const { container } = render(<Stage trace={trace} anatomy={anatomy} reducedMotion />);
    const spikes = spikeXs(container.querySelector(".xr-ecg-band .xr-ecg-spike")!.getAttribute("d")!);
    const bones = selectBones(trace, anatomy);
    const placed = placeBones(bones).map(toCropPercent);
    const expected = bones
      .map((b, i) => ({ b, x: placed[i]!.x }))
      .filter((e) => e.b.state === "fractured")
      .map((e) => Math.min(548, Math.max(12, (e.x / 100) * 560)));
    expect(spikes).toHaveLength(expected.length);
    expect(spikes.length).toBeGreaterThan(0);
    spikes.forEach((x, i) => expect(x).toBeCloseTo(expected[i]!, 5));
    const hotspots = [...container.querySelectorAll<HTMLElement>(".xr-hotspot")];
    const fracturedLefts = hotspots
      .filter((h) => h.getAttribute("data-state") === "fractured")
      .map((h) => parseFloat(h.style.left));
    fracturedLefts.forEach((pct, i) => expect(spikes[i]! / 560 * 100).toBeCloseTo(pct, 1));
  });
  it("renders a flat line without spikes or head movement for rejected results", () => {
    const trace = { ...signatureTrace(), result: "rejected" as const };
    const { container } = render(<EcgBand trace={trace} anatomy={signatureAnatomy()} anchors={[]} />);
    expect(container.querySelector(".xr-ecg-band--flat")).not.toBeNull();
    expect(container.querySelector(".xr-ecg-spike")).toBeNull();
    const head = container.querySelector(".xr-ecg-head")!;
    expect(head.className).not.toMatch(/anim-/);
  });
  it("renders the hidden summary and an animated head for fractures", () => {
    const { container } = render(<EcgBand trace={signatureTrace()} anatomy={signatureAnatomy()} anchors={[]} />);
    expect(container.querySelector(".xr-visually-hidden")?.textContent).toBe("2 spikes");
    expect(container.querySelector(".xr-ecg-head")?.className).toMatch(/anim-ecg-head/);
  });
  it("emits no animation classes when reducedMotion is true", () => {
    const { container } = render(
      <EcgBand trace={signatureTrace()} anatomy={signatureAnatomy()} anchors={[]} reducedMotion />,
    );
    expect(container.innerHTML).not.toMatch(/anim-/);
  });
});
