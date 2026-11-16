import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SteelFrame } from "../../components/shell/SteelFrame";

describe("SteelFrame", () => {
  it("renders four aria-hidden screws with four distinct fixed rotations", () => {
    const { container } = render(<SteelFrame>x</SteelFrame>);
    const screws = container.querySelectorAll<HTMLElement>(".xr-screw");
    expect(screws).toHaveLength(4);
    const rots = Array.from(screws).map((s) => s.style.getPropertyValue("--xr-screw-rot"));
    expect(rots).toEqual(["12deg", "97deg", "188deg", "271deg"]);
    expect(new Set(rots).size).toBe(4);
    screws.forEach((s) => expect(s.getAttribute("aria-hidden")).toBe("true"));
  });

  it("renders its children", () => {
    const { getByText } = render(
      <SteelFrame>
        <p>inside</p>
      </SteelFrame>,
    );
    expect(getByText("inside")).toBeTruthy();
  });
});
