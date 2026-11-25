import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CaseScreen } from "../../src/ui/CaseScreen";
import { createProductionSession, useSession } from "../../src/state/sessionStore";
import type { SessionStore } from "../../src/state/sessionStore";
import type { CaseState } from "../../src/state/reducer";
import type { RecordedCaseId } from "../../src/extraction/samples";

function Harness({ store, patch }: { store: SessionStore; patch?: (s: CaseState) => CaseState }) {
  const s = useSession(store);
  if (s.screen !== "case") return null;
  return <CaseScreen state={patch ? patch(s) : s} store={store} reducedMotion />;
}

async function open(id: RecordedCaseId, patch?: (s: CaseState) => CaseState): Promise<SessionStore> {
  const store = createProductionSession();
  if ("kind" in store) throw new Error("bundle");
  await store.loadRecordedCase(id);
  render(<Harness store={store} {...(patch ? { patch } : {})} />);
  return store;
}

function caseState(store: SessionStore): CaseState {
  const s = store.getState();
  if (s.screen !== "case") throw new Error("no case open");
  return s;
}

const accuse = () => screen.getByRole("button", { name: "Accuse" });
const overrideButton = () => screen.getByRole("button", { name: /Human override/ });

async function openDialog() {
  await userEvent.click(overrideButton());
  return within(screen.getByRole("dialog"));
}

async function submit(name: string, reason: string, result?: "approved" | "rejected") {
  const d = await openDialog();
  if (name) await userEvent.type(d.getByLabelText("Reviewer name"), name);
  if (reason) fireEvent.change(d.getByLabelText("Reason"), { target: { value: reason } });
  if (result) await userEvent.selectOptions(d.getByLabelText("New result"), result);
  await userEvent.click(d.getByRole("button", { name: "Save override" }));
}

describe("OverrideDialog", () => {
  it("opens from the Human override button as a dialog with the three fields", async () => {
    await open("greenhouse");
    const d = await openDialog();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-labelledby", "override-title");
    expect(d.getByLabelText("Reviewer name")).toBeInTheDocument();
    expect(d.getByLabelText("Reason")).toBeInTheDocument();
    expect(d.getByLabelText("New result")).toBeInTheDocument();
    expect(d.getAllByRole("option").map((o) => o.getAttribute("value"))).toEqual(["approved", "rejected"]);
  });

  it("shows field errors for empty name, empty reason and 501 characters and stays open", async () => {
    await open("greenhouse");
    await submit("", "");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.getElementById("override-error-reviewerName")).not.toBeNull();

    const d = within(screen.getByRole("dialog"));
    await userEvent.type(d.getByLabelText("Reviewer name"), "Mara");
    await userEvent.click(d.getByRole("button", { name: "Save override" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.getElementById("override-error-reason")).not.toBeNull();
    expect(d.getByLabelText("Reason")).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(d.getByLabelText("Reason"), { target: { value: "x".repeat(501) } });
    await userEvent.click(d.getByRole("button", { name: "Save override" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.getElementById("override-error-reason")).not.toBeNull();
    expect(d.getByText("501 / 500")).toBeInTheDocument();
  });

  it("returns focus to the Human override button on close", async () => {
    await open("greenhouse");
    const d = await openDialog();
    await userEvent.click(d.getByRole("button", { name: "Cancel" }));
    expect(overrideButton()).toHaveFocus();
    expect(document.querySelector("dialog[open]")).toBeNull();
    await submit("Mara", "I checked the file.");
    expect(overrideButton()).toHaveFocus();
  });

  it("override to approved enables Accuse and shows overruled by and the rule result", async () => {
    await open("candlesticks");
    await userEvent.click(screen.getAllByRole("radio")[0]!);
    expect(accuse()).toBeDisabled();
    await submit("Mara", "The clue was misread.", "approved");
    expect(accuse()).toBeEnabled();
    expect(screen.getByText("overruled by Mara")).toBeInTheDocument();
    expect(screen.getByText("Rules decided: REJECTED")).toBeInTheDocument();
  });

  it("override to rejected of an accepted case disables Accuse", async () => {
    await open("greenhouse");
    await userEvent.click(screen.getAllByRole("radio")[0]!);
    expect(accuse()).toBeEnabled();
    await submit("Mara", "Evidence is tainted.", "rejected");
    expect(accuse()).toBeDisabled();
    expect(screen.getByText("overruled by Mara")).toBeInTheDocument();
  });

  it("does not change the Trace, the rule outcomes or the fractures after an override", async () => {
    const store = await open("candlesticks");
    await userEvent.click(screen.getByRole("switch"));
    const before = caseState(store);
    const traceBefore = JSON.stringify(before.original);
    const fracturesBefore = document.querySelectorAll(".xr-fx").length;
    await submit("Mara", "Second look.", "approved");
    await submit("Ines", "Third look.", "rejected");
    const after = caseState(store);
    expect(JSON.stringify(after.original)).toBe(traceBefore);
    expect(after.original).toBe(before.original);
    expect(after.overrides).toHaveLength(2);
    expect(after.original.ruleOutcomes).toBe(before.original.ruleOutcomes);
    expect(fracturesBefore).toBeGreaterThan(0);
    expect(document.querySelectorAll(".xr-fx").length).toBe(fracturesBefore);
  });

  it("shows ambiguous_override in a role=alert panel and keeps the rule result", async () => {
    await open("candlesticks", (s) => {
      if (s.overrides.length === 0) return s;
      const first = s.overrides[0]!;
      return { ...s, overrides: [first, { ...first, reviewerName: "Twin" }] };
    });
    await submit("Mara", "Same instant.", "approved");
    const alert = screen.getByText("Override could not be applied").closest('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(accuse()).toBeDisabled();
    expect(screen.queryByText(/overruled by/)).toBeNull();
  });
});

describe("tab order (requirement 16.5)", () => {
  it("after the plates visits knob, X-RAY switch, Accuse, Replay and Human override in that order", async () => {
    await open("greenhouse");
    await userEvent.click(screen.getAllByRole("radio")[0]!);
    const expected = [
      (e: Element) => e.getAttribute("role") === "slider",
      (e: Element) => e.getAttribute("role") === "switch",
      (e: Element) => e.textContent === "Accuse",
      (e: Element) => e.textContent === "Replay",
      (e: Element) => (e.textContent ?? "").includes("Human override"),
    ];
    const seen: Element[] = [];
    for (let i = 0; i < 12; i += 1) {
      await act(async () => {
        await userEvent.tab();
      });
      seen.push(document.activeElement as Element);
    }
    let from = 0;
    for (const match of expected) {
      const at = seen.findIndex((e, i) => i >= from && match(e));
      expect(at).toBeGreaterThanOrEqual(from);
      from = at + 1;
    }
  });
});
