import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Lightbox } from "../../components/Lightbox";

describe("Lightbox smoke", () => {
  it("renders the title and children", () => {
    render(
      <Lightbox title="Viewer" xray>
        <p>inside</p>
      </Lightbox>,
    );
    expect(screen.getByRole("heading", { name: "Viewer" })).toHaveClass("xr-title-plate");
    expect(screen.getByText("inside").parentElement).toHaveClass("xr-viewport");
  });

  it("omits the title plate without a title and joins className", () => {
    const { container } = render(<Lightbox className="extra" xray={false} />);
    expect(container.querySelector(".xr-title-plate")).toBeNull();
    expect(container.querySelector("section")).toHaveClass("xr-lightbox", "extra");
    expect(container.querySelector("section")).toHaveAttribute("aria-label", "X-ray viewer");
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the X-ray pill text for both states", () => {
    const { container, rerender } = render(<Lightbox xray />);
    const pill = container.querySelector(".xr-pill");
    expect(pill).toHaveTextContent("X-RAY ON");
    expect(pill).toHaveAttribute("data-on", "true");
    rerender(<Lightbox xray={false} />);
    expect(container.querySelector(".xr-pill")).toHaveTextContent("X-RAY OFF");
    expect(container.querySelector(".xr-pill")).toHaveAttribute("data-on", "false");
  });
});
