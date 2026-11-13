import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { EcgLine } from "../../components/EcgLine";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

const ANIM = /(^|\s)anim-/;

function allClasses(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll("*")).map((el) => el.getAttribute("class") ?? "");
}

describe("EcgLine", () => {
  it("hides the SVG graphic from assistive tech", () => {
    const { container } = render(<EcgLine trace={signatureTrace()} anatomy={signatureAnatomy()} />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders a visually-hidden spike summary and a non-empty spike path for fractures", () => {
    const { container } = render(<EcgLine trace={signatureTrace()} anatomy={signatureAnatomy()} />);
    expect(container.querySelector(".xr-visually-hidden")?.textContent).toBe("2 spikes");
    const spike = container.querySelector(".xr-ecg-spike");
    expect(spike?.getAttribute("d")).toBeTruthy();
    expect(container.querySelector(".xr-ecg-label")).toBeNull();
  });

  it("shows FLATLINE label, flat class and no spikes for a rejected result", () => {
    const trace = { ...signatureTrace(), result: "rejected" as const };
    const { container } = render(<EcgLine trace={trace} anatomy={signatureAnatomy()} />);
    expect(container.querySelector(".xr-ecg--flat")).not.toBeNull();
    expect(container.querySelector(".xr-ecg-label")?.textContent).toBe("FLATLINE \u2715");
    expect(container.querySelector(".xr-visually-hidden")?.textContent).toBe("flatline");
    expect(container.querySelector(".xr-ecg-spike")).toBeNull();
  });

  it("emits no anim- classes when reducedMotion is true", () => {
    const { container } = render(
      <EcgLine trace={signatureTrace()} anatomy={signatureAnatomy()} reducedMotion />,
    );
    expect(allClasses(container).some((c) => ANIM.test(c))).toBe(false);
  });

  it("emits anim- classes when reducedMotion is false", () => {
    const { container } = render(
      <EcgLine trace={signatureTrace()} anatomy={signatureAnatomy()} reducedMotion={false} />,
    );
    expect(allClasses(container).some((c) => ANIM.test(c))).toBe(true);
  });
});
