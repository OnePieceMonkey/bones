import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Lightbox } from "../../components/Lightbox";

describe("Lightbox smoke", () => {
  it("renders the title and children", () => {
    render(
      <Lightbox title="Viewer">
        <p>inside</p>
      </Lightbox>,
    );
    expect(screen.getByRole("heading", { name: "Viewer" })).toHaveClass("xr-title-plate");
    expect(screen.getByText("inside").parentElement).toHaveClass("xr-viewport");
  });

  it("omits the title plate without a title and joins className", () => {
    const { container } = render(<Lightbox className="extra" />);
    expect(container.querySelector(".xr-title-plate")).toBeNull();
    expect(container.querySelector("section")).toHaveClass("xr-lightbox", "extra");
  });
});
