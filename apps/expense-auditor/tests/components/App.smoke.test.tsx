import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../../src/App";

describe("App smoke", () => {
  it("renders the Expense Auditor heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Expense Auditor" })).toBeInTheDocument();
  });
});
