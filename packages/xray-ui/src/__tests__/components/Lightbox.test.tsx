import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Lightbox } from "../../components/Lightbox";

describe("Lightbox", () => {
  it("renders the title as a heading plate and children inside the viewport", () => {
    render(
      <Lightbox title="Viewer" xray>
        <p>inside</p>
      </Lightbox>,
    );
    expect(screen.getByRole("heading", { name: "Viewer" })).toHaveClass("xr-title-plate");
    expect(screen.getByText("inside").parentElement).toHaveClass("xr-viewport");
  });

  it("omits the title plate without a title and uses the default aria-label", () => {
    const { container } = render(<Lightbox xray={false} />);
    expect(container.querySelector(".xr-title-plate")).toBeNull();
    expect(container.querySelector("section")).toHaveAttribute("aria-label", "X-ray viewer");
  });

  it("uses the title as aria-label when given", () => {
    const { container } = render(<Lightbox title="Receipt" xray />);
    expect(container.querySelector("section")).toHaveAttribute("aria-label", "Receipt");
  });

  it("joins className onto the root", () => {
    const { container } = render(<Lightbox className="extra" xray />);
    expect(container.querySelector("section")).toHaveClass("xr-lightbox", "extra");
  });

  it("shows the X-ray pill text and data-on for both states", () => {
    const { container, rerender } = render(<Lightbox xray />);
    const pill = container.querySelector(".xr-pill");
    expect(pill).toHaveTextContent("X-RAY ON");
    expect(pill).toHaveAttribute("data-on", "true");
    rerender(<Lightbox xray={false} />);
    expect(container.querySelector(".xr-pill")).toHaveTextContent("X-RAY OFF");
    expect(container.querySelector(".xr-pill")).toHaveAttribute("data-on", "false");
  });

  it("renders no img element", () => {
    const { container } = render(
      <Lightbox title="T" xray>
        <p>x</p>
      </Lightbox>,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps the stylesheet free of url( and @import", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/xray.css"), "utf8");
    expect(css).not.toContain("url(");
    expect(css).not.toContain("@import");
  });
});
