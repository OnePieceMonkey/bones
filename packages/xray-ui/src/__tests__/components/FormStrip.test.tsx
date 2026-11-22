import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FormStrip, FormStripField, FormStripFile } from "../../components/FormStrip";
import { block } from "../styles/helpers";

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

describe("FormStripFile", () => {
  const css = readFileSync(join(__dirname, "..", "..", "styles", "form.css"), "utf8");

  it("keeps the native input in the DOM, named by the label, and shows the placeholder", () => {
    const { container } = render(<FormStripFile label="Pick a file" placeholder="Choose one" onFile={() => {}} />);
    const input = screen.getByLabelText("Pick a file") as HTMLInputElement;
    expect(input.type).toBe("file");
    expect(input.tabIndex).toBe(0);
    expect(container.querySelector(".xr-file-name")?.textContent).toBe("Choose one");
    // R8.2: visually hidden by the clip pattern, not display: none.
    const hidden = block(css, ".xr-file-input");
    expect(hidden).toContain("clip");
    expect(hidden).not.toMatch(/display\s*:\s*none/);
  });

  it("shows the chosen file name and reports the file after a change event", () => {
    const seen: (File | null)[] = [];
    const { container } = render(<FormStripFile label="Pick a file" placeholder="Choose one" onFile={(f) => seen.push(f)} />);
    const input = screen.getByLabelText("Pick a file");
    const file = new File(["x"], "scan.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(container.querySelector(".xr-file-name")?.textContent).toBe("scan.png");
    expect(seen).toEqual([file]);
  });

  it("styles controls with appearance none, the sans token and a 44 px minimum height (R8.4)", () => {
    const controls = block(css, ".xr-form-strip input:not(.xr-file-input),\n.xr-form-strip button,\n.xr-file-button");
    expect(controls).toMatch(/appearance:\s*none/);
    expect(controls).toContain("var(--xr-font-sans)");
    expect(controls).toContain("max(44px");
  });

  it("draws a 3 px focus ring on the button when the input has focus (R8.2)", () => {
    const ring = block(
      css,
      ".xr-file-input:focus-visible + .xr-file-button,\n.xr-form-strip input:focus-visible,\n.xr-form-strip button:focus-visible",
    );
    expect(ring).toContain("outline: 3px solid var(--xr-focus)");
    expect(ring).toContain("var(--xr-focus-contrast)");
  });
});
