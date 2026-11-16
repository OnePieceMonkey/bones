import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StartHeadline } from "../../components/StartHeadline";
describe("StartHeadline", () => {
  it("renders the given title and subtitle", () => {
    render(<StartHeadline title="A title." subtitle="A subtitle." />);
    expect(screen.getByRole("heading", { level: 2, name: "A title." })).toBeInTheDocument();
    expect(screen.getByText("A subtitle.")).toBeInTheDocument();
  });
});
