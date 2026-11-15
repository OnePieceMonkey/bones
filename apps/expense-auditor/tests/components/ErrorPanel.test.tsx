import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ErrorPanel } from "../../src/ui/ErrorPanel";

describe("ErrorPanel", () => {
  it("renders nothing for null", () => {
    const { container } = render(<ErrorPanel error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is an alert with the heading and lists each failing field with its raw path in code", () => {
    render(
      <ErrorPanel
        error={{
          kind: "core",
          error: {
            kind: "validation_failed",
            message: "x",
            fieldErrors: [
              { path: "lineItems", issue: "must contain at least one line item" },
              { path: "merchant", issue: "is required" },
            ],
          },
        }}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(within(alert).getByRole("heading", { level: 2, name: "This receipt cannot be decided" })).toBeVisible();
    const items = within(alert).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Line items (lineItems): must contain at least one line item");
    expect(items[0]?.querySelector("code")).toHaveTextContent("lineItems");
    expect(items[1]).toHaveTextContent("Merchant (merchant): is required");
  });

  it("shows the extraction_failed text", () => {
    render(
      <ErrorPanel error={{ kind: "extraction_failed", message: "raw", reason: "network" }} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The reading service could not be reached. Check your connection and try again.",
    );
    expect(screen.queryByText("raw")).toBeNull();
  });

  it("shows an upload problem's own message", () => {
    render(
      <ErrorPanel
        error={{ kind: "upload", problem: { reason: "type", message: "Only JPEG or PNG photos work." } }}
        title="Upload problem"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Only JPEG or PNG photos work.");
    expect(screen.getByRole("heading", { name: "Upload problem" })).toBeVisible();
  });
});
