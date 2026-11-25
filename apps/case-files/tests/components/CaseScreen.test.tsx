import { describe, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CaseScreen, caseDocumentText, chatSpeedMs } from "../../src/ui/CaseScreen";
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

const accuse = () => screen.getByRole("button", { name: "Accuse" });

describe("CaseScreen", () => {
  it("starts with X-RAY off: plates and clues readable, no skeleton image", async () => {
    await open("greenhouse");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["the widow", "the gardener", "the nephew"]);
    expect(screen.getByText(/Crime: the greenhouse, 22:00-23:00/)).toBeInTheDocument();
    expect(screen.getByText(/pick a suspect to read what they said/)).toBeInTheDocument();
    expect(document.querySelector(".xr-ensemble-stage")).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "the widow" }));
    expect(screen.getByText(/Statements of the widow:/)).toBeInTheDocument();
    expect(screen.getByText(/reading in the library/)).toBeInTheDocument();
  });

  it("shows bones when X-RAY is switched on", async () => {
    await open("greenhouse");
    await userEvent.click(screen.getByRole("switch"));
    expect(document.querySelectorAll(".xr-ensemble-member")).toHaveLength(3);
    expect(document.querySelectorAll(".xr-hotspot").length).toBeGreaterThan(0);
  });

  it("moves the selection with arrow keys and has one tab stop", async () => {
    await open("greenhouse");
    const radios = screen.getAllByRole("radio");
    expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);
    await userEvent.click(radios[0]!);
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "the gardener" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(screen.getAllByRole("radio").filter((r) => r.tabIndex === 0)).toHaveLength(1);
  });

  it("disables Accuse without a selection and explains why", async () => {
    await open("greenhouse");
    expect(accuse()).toBeDisabled();
    const reason = document.getElementById(accuse().getAttribute("aria-describedby") ?? "");
    expect(reason).toHaveTextContent("Pick a suspect to accuse.");
    await userEvent.click(screen.getAllByRole("radio")[0]!);
    expect(accuse()).toBeEnabled();
    expect(accuse()).not.toHaveAttribute("aria-describedby");
  });

  it("disables Accuse for the rejected candlesticks v1 and enables it for v2", async () => {
    await open("candlesticks");
    await userEvent.click(screen.getAllByRole("radio")[0]!);
    expect(accuse()).toBeDisabled();
    expect(screen.getByText(/found this case unfair/)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("OVERRULED BY RULE");
    expect(screen.getByRole("note")).toHaveTextContent("v1");
    act(() => screen.getByRole("slider", { name: "RULE VERSION" }).focus());
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("slider", { name: "RULE VERSION" })).toHaveAttribute("aria-valuetext", "v2");
    expect(accuse()).toBeEnabled();
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.getByText("Replayed with v2. Original: v1.")).toBeInTheDocument();
  });

  it("shows the stamp for a rejected Trace and not for an approved one", async () => {
    await open("greenhouse");
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.getByLabelText("AI answer")).toHaveAttribute("data-overruled", "false");
  });

  it("shows no version note for v1 and the convictable count in the result line", async () => {
    await open("greenhouse");
    expect(screen.queryByText(/Replayed with/)).toBeNull();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 convictable");
  });

  it("renders case text as escaped text", async () => {
    await open("greenhouse", (s) => {
      const t = s.original;
      const vf = JSON.parse(JSON.stringify(t.validatedFields)) as { clues: { text: string }[] };
      vf.clues[0]!.text = "<b>bold</b>";
      const patched = { ...t, validatedFields: vf } as typeof t;
      return { ...s, replays: { ...s.replays, v1: patched } };
    });
    expect(screen.getByText(/<b>bold<\/b>/)).toBeInTheDocument();
    expect(document.querySelector(".xr-doc b")).toBeNull();
  });

  it("shows the mean confidence on the meter and n/a without confidence", async () => {
    await open("greenhouse");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", expect.stringMatching(/^confidence \d/));
    document.body.innerHTML = "";
    await open("greenhouse", (s) => ({ ...s, replays: { ...s.replays, v1: { ...s.original, confidence: {} } } }));
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "no confidence available");
  });

  it("Dr. Bones gives the Solver reason from the closed templates for an unfair case", async () => {
    await open("candlesticks");
    expect(await screen.findByText(/convicts 2 suspects: Ada and Bram\. This case is unfair\./)).toBeInTheDocument();
  });

  it("Replay re-types the chat without changing the Trace", async () => {
    const store = await open("greenhouse");
    const before = store.getState();
    await userEvent.click(screen.getByRole("button", { name: "Replay" }));
    expect(store.getState()).toBe(before);
    expect(within(screen.getByRole("log")).getAllByText(/fracture|decision/).length).toBeGreaterThan(0);
  });
});

describe("helpers", () => {
  it("chatSpeedMs stays within 4 to 24 ms and fits the 8000 ms budget when possible", () => {
    expect(chatSpeedMs([])).toBe(24);
    expect(chatSpeedMs([{ text: "x".repeat(100) }])).toBe(24);
    expect(chatSpeedMs([{ text: "x".repeat(1000) }])).toBe(8);
    expect(chatSpeedMs([{ text: "x".repeat(5000) }])).toBe(4);
  });
  it("caseDocumentText lists the statements of the selected suspect only", () => {
    const d = {
      crime: {},
      clues: [{ text: "c1", reliability: "firm" }],
      suspects: [
        { id: "a", name: "A", statements: [{ text: "sa" }] },
        { id: "b", name: "B", statements: [{ text: "sb" }] },
      ],
    } as never;
    const t = caseDocumentText(d, () => "X", "b");
    expect(t).toContain("Statements of B:");
    expect(t).toContain("1. sb");
    expect(t).not.toContain("sa");
  });
});
