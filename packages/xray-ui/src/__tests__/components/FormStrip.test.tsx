import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormStrip, FormStripField } from "../../components/FormStrip";

describe("FormStrip", () => {
  it("renders a named group whose fields are named by their labels", () => {
    render(
      <FormStrip legend="Group name">
        <FormStripField label="Field one">
          <input type="text" />
        </FormStripField>
      </FormStrip>,
    );
    expect(screen.getByRole("group", { name: "Group name" })).toBeInTheDocument();
    expect(screen.getByLabelText("Field one")).toBeInTheDocument();
  });
});
