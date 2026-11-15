import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverrideDialog } from "../../src/ui/OverrideDialog";
import type { OverrideForm, OverrideOutcome } from "../../src/state/sessionStore";

function Harness({ onSubmit }: { onSubmit: (form: OverrideForm) => OverrideOutcome }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={ref} onClick={() => setOpen(true)}>
        Overrule
      </button>
      <OverrideDialog open={open} onClose={() => setOpen(false)} onSubmit={onSubmit} returnFocusTo={ref} />
    </>
  );
}

async function openDialog(onSubmit: (form: OverrideForm) => OverrideOutcome = () => ({ ok: true })) {
  const user = userEvent.setup();
  render(<Harness onSubmit={onSubmit} />);
  await user.click(screen.getByRole("button", { name: "Overrule" }));
  return user;
}

describe("OverrideDialog", () => {
  it("has labelled fields and opens focused on Reviewer name", async () => {
    await openDialog();
    expect(screen.getByRole("dialog", { name: "Overrule decision" })).toBeInTheDocument();
    expect(screen.getByLabelText("Reason")).toHaveAttribute("maxlength", "500");
    expect(screen.getByLabelText("New result")).toBeInTheDocument();
    expect(screen.getByText("0 / 500")).toBeInTheDocument();
    expect(screen.getByLabelText("Reviewer name")).toHaveFocus();
  });

  it("closes on Escape (cancel event) and returns focus to Overrule", async () => {
    await openDialog();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Overrule" })).toHaveFocus();
  });

  it("shows an inline alert next to the failing field and stays open", async () => {
    const onSubmit = vi.fn<[OverrideForm], OverrideOutcome>(() => ({
      ok: false,
      field: "reviewerName",
      message: "Reviewer name must not be blank",
    }));
    const user = await openDialog(onSubmit);
    await user.click(screen.getByRole("button", { name: "Save override" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Reviewer name must not be blank");
    const input = screen.getByLabelText("Reviewer name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", alert.id);
    expect(input).toHaveFocus();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("submits the form once and closes", async () => {
    const onSubmit = vi.fn<[OverrideForm], OverrideOutcome>(() => ({ ok: true }));
    const user = await openDialog(onSubmit);
    await user.type(screen.getByLabelText("Reviewer name"), "Ada");
    await user.type(screen.getByLabelText("Reason"), "Manager approved");
    await user.selectOptions(screen.getByLabelText("New result"), "rejected");
    await user.click(screen.getByRole("button", { name: "Save override" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      reviewerName: "Ada",
      reason: "Manager approved",
      replacementResult: "rejected",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Overrule" })).toHaveFocus();
  });

  it("prevents a reason longer than 500 characters", async () => {
    const user = await openDialog();
    const reason = screen.getByLabelText("Reason");
    await user.click(reason);
    await user.paste("x".repeat(600));
    expect((reason as HTMLTextAreaElement).value).toHaveLength(500);
    expect(screen.getByText("500 / 500")).toBeInTheDocument();
  });

  it("closes on Cancel", async () => {
    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
