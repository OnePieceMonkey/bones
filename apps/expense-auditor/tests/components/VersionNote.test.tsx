import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VersionNote } from "../../src/ui/VersionNote";

describe("VersionNote", () => {
  it("renders nothing for null", () => {
    const { container } = render(<VersionNote note={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the note in a status region", () => {
    render(<VersionNote note="Replayed with v2" />);
    expect(screen.getByRole("status")).toHaveTextContent("Replayed with v2");
  });
});
