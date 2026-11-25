import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/App";
import { createProductionSession } from "../../src/state/sessionStore";
import type { SessionStore } from "../../src/state/sessionStore";
import { renderAccusationText } from "../../src/solver/solverMessages";
import { bannerText, verdictNote } from "../../src/ui/ResultBanner";
import type { RecordedCaseId } from "../../src/extraction/samples";

async function accuseIn(id: RecordedCaseId, plate: string, version?: "v2" | "v3"): Promise<SessionStore> {
  const store = createProductionSession();
  if ("kind" in store) throw new Error("bundle");
  await store.loadRecordedCase(id);
  if (version !== undefined) store.selectVersion(version);
  render(<App store={store} />);
  await userEvent.click(screen.getByRole("radio", { name: plate }));
  await userEvent.click(screen.getByRole("button", { name: "Accuse" }));
  return store;
}
const banner = () => document.querySelector(".case-banner") as HTMLElement;

describe("VerdictView", () => {
  it("shows CASE CLOSED for the widow and lists the convictable suspect", async () => {
    await accuseIn("greenhouse", "the widow");
    expect(banner()).toHaveTextContent("CASE CLOSED: the widow is guilty.");
    expect(banner()).toHaveTextContent("Convictable: the widow.");
    expect(banner()).toHaveAttribute("data-verdict", "correct");
  });

  it("shows WRONG SUSPECT for another suspect", async () => {
    await accuseIn("greenhouse", "the gardener");
    expect(banner()).toHaveTextContent("WRONG SUSPECT: the gardener cannot be convicted.");
    expect(banner()).toHaveTextContent("Convictable: the widow.");
    expect(banner()).toHaveAttribute("data-verdict", "incorrect");
  });

  it("marks the accused member, turns X-RAY on and announces the result in a status element", async () => {
    await accuseIn("greenhouse", "the widow");
    const accused = document.querySelectorAll('[data-accused="true"]');
    expect(accused.length).toBeGreaterThan(0);
    expect(screen.getByRole("radio", { name: "the widow" })).toHaveAttribute("data-accused", "true");
    expect(screen.getByRole("radio", { name: "the gardener" })).toHaveAttribute("data-accused", "false");
    expect(document.querySelector(".xr-ensemble-member")).not.toBeNull();
    expect(banner().getAttribute("role")).toBe("status");
  });

  it("keeps the accusation and shows a note after the knob turn (candlesticks: Ada under v2, back to v1)", async () => {
    const store = await accuseIn("candlesticks", "Ada", "v2");
    const record = (store.getState() as { accusation: unknown }).accusation;
    expect(banner()).toHaveTextContent("CASE CLOSED: Ada is guilty.");
    expect(banner()).not.toHaveTextContent("stays on record");
    act(() => screen.getByRole("slider", { name: "RULE VERSION" }).focus());
    await userEvent.keyboard("{ArrowLeft}");
    expect(banner()).toHaveTextContent("Under v1 this case is unfair, so Ada could not be accused. Your accusation under v2 stays on record.");
    expect(banner()).toHaveTextContent("CASE CLOSED: Ada is guilty.");
    expect((store.getState() as { accusation: unknown }).accusation).toBe(record);
  });

  it("New case returns to the start screen and discards the session", async () => {
    const store = await accuseIn("greenhouse", "the widow");
    await userEvent.click(screen.getByRole("button", { name: "New case" }));
    expect(store.getState().screen).toBe("start");
    expect(banner()).toBeNull();
    expect(screen.getByRole("heading", { name: "Bones Case Files" })).toBeInTheDocument();
  });

  it("offers Replay and New case instead of Accuse", async () => {
    await accuseIn("greenhouse", "the widow");
    expect(screen.getByRole("button", { name: "Replay" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Accuse" })).toBeNull();
  });

  it("shows a fracture with a shape and a text label, not colour only", async () => {
    await accuseIn("greenhouse", "the gardener");
    const fractured = Array.from(document.querySelectorAll('.xr-bone-btn[data-state="fractured"]')) as HTMLElement[];
    expect(fractured.length).toBeGreaterThan(0);
    expect(fractured[0]!.getAttribute("aria-label") ?? "").toMatch(/\S/);
    expect(fractured[0]!.querySelector(".xr-bone-cue")?.textContent ?? "").toMatch(/\S/);
    expect(fractured[0]!.querySelector(".xr-bone-state")?.textContent ?? "").toMatch(/\S/);
  });
});

describe("banner helpers", () => {
  const names = new Map([["a", "Ada"]]);
  it("keeps the chat template text unchanged", () => {
    expect(renderAccusationText({ suspectId: "a", verdict: "correct" }, names)).toBe("Case closed: Ada is guilty.");
  });
  it("upper-cases only the banner prefix", () => {
    expect(bannerText({ suspectId: "a", verdict: "correct" }, names)).toBe("CASE CLOSED: Ada is guilty.");
    expect(bannerText({ suspectId: "a", verdict: "incorrect" }, names)).toBe("WRONG SUSPECT: Ada cannot be convicted.");
  });
  const rec = { suspectId: "a", verdict: "correct" as const };
  it("notes a changed verdict and stays silent when nothing differs", () => {
    expect(verdictNote(rec, "v2", { version: "v3", unfair: false, convictable: false }, names)).toBe(
      "Under v3, Ada cannot be convicted. Your accusation under v2 stays on record.",
    );
    expect(verdictNote(rec, "v2", { version: "v3", unfair: false, convictable: true }, names)).toBeNull();
    expect(verdictNote(rec, "v2", { version: "v2", unfair: false, convictable: false }, names)).toBeNull();
    expect(verdictNote(rec, "v2", null, names)).toBeNull();
  });
});
