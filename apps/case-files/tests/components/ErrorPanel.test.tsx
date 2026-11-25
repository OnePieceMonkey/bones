import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorPanel } from "../../src/ui/ErrorPanel";
describe("ErrorPanel", () => {
  it("renders nothing for null", () => {
    const { container } = render(<ErrorPanel error={null} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("is an alert with the message for fixture_not_found", () => {
    render(
      <ErrorPanel
        error={{ kind: "core", error: { kind: "fixture_not_found", message: "raw", fixturePath: "recorded/x.json" } }}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("This case cannot be opened");
    expect(alert).toHaveTextContent("The recorded case could not be loaded.");
    expect(alert).not.toHaveTextContent("recorded/x.json");
  });
  it("lists failing field paths of a validation error and accepts a custom title", () => {
    render(
      <ErrorPanel
        title="The rules could not be loaded"
        error={{ kind: "validation_failed", message: "x", fieldErrors: [{ path: "suspects", issue: "too few" }] }}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "The rules could not be loaded" })).toBeVisible();
    expect(screen.getByRole("listitem")).toHaveTextContent("suspects: too few");
  });
});
