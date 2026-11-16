import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isCoreError, override, replay } from "@bones/core";
import type { CoreError } from "@bones/core";
import { SAMPLES } from "../../src/extraction/samples";
import { makePortFactory } from "../../src/pipeline/ports";
import type { DecisionState } from "../../src/state/reducer";
import { createSessionStore, useSession } from "../../src/state/sessionStore";
import type { SessionStore } from "../../src/state/sessionStore";
import { DecisionView } from "../../src/ui/DecisionView";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle, loadSample } from "../helpers/fixtures";

function makeStore(replayFn: typeof replay = replay): SessionStore {
  const bundle = loadTestBundle();
  if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));
  return createSessionStore({
    bundle,
    samples: SAMPLES,
    portFactory: makePortFactory(counterPorts()),
    sha256: async () => "ab".repeat(32),
    replayFn,
    overrideFn: override,
    prefersReducedMotion: () => true,
  });
}

function Harness({ store }: { store: SessionStore }) {
  const state = useSession(store);
  if (state.screen !== "decision") return <p>no decision</p>;
  return <DecisionView state={state} store={store} reducedMotion />;
}

async function setup(replayFn?: typeof replay) {
  const store = makeStore(replayFn);
  await store.loadSample("signature");
  render(<Harness store={store} />);
  return store;
}

const fractured = () => document.querySelectorAll('button.xr-bone-btn[data-state="fractured"]');

describe("DecisionView (signature case)", () => {
  it("shows the v1 decision: plate, amount, two fractures, passed meal limit, stamp, AI card rows", async () => {
    await setup();
    const plate = document.querySelector(".xr-result") as HTMLElement;
    expect(plate).toHaveTextContent("PARTIALLY APPROVED");
    expect(plate).toHaveTextContent("$41.50");
    expect(fractured()).toHaveLength(2);
    const labels = [...fractured()].map((b) => b.getAttribute("aria-label") ?? "");
    expect(labels.some((l) => l.includes("Line-item match"))).toBe(true);
    expect(labels.some((l) => l.includes("Alcohol"))).toBe(true);
    const meal = document.querySelector('button.xr-bone-btn[aria-label*="Meal limit"]') as HTMLElement;
    expect(meal).toHaveAttribute("data-state", "passed");
    expect(meal.getAttribute("aria-label")).toContain("applied, no change");
    const card = screen.getByRole("article", { name: "AI answer" });
    expect(within(card).getByRole("note")).toHaveTextContent("OVERRULED BY RULE");
    expect(card).toHaveTextContent("Claimed total");
    expect(card).toHaveTextContent("$480.00");
    expect(card).toHaveTextContent("Line items");
    expect(card.querySelector('[data-path="lineItems"]')).toHaveTextContent(/\d+ line items? · \$/);
    expect(card.textContent).not.toMatch(/EUR|\{|\[/);
    expect(card).toHaveTextContent("Merchant");
    expect(card).toHaveTextContent("Receipt date");
    expect(screen.getByText("Expense Auditor - RECORDED")).toBeInTheDocument();
  });

  it("shows the receipt lines on the film clip", async () => {
    await setup();
    const text = loadSample("signature").receiptText;
    const firstLine = text.split("\n").find((l) => l.trim() !== "") as string;
    expect(document.querySelector(".xr-film-text")).toHaveTextContent(firstLine.trim());
  });

  it("replays with v2 on ArrowRight without moving focus", async () => {
    await setup();
    const slider = screen.getByRole("slider");
    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("Replayed with v2")).toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuetext", "v2");
    expect(document.activeElement).toBe(slider);
  });

  it("an override shows the reviewer and the rules result; fractured bones stay at 2", async () => {
    const store = await setup();
    await userEvent.click(screen.getByRole("button", { name: "Human override" }));
    await userEvent.type(screen.getByLabelText("Reviewer name"), "Ada");
    await userEvent.type(screen.getByLabelText("Reason"), "Manager approved the beer");
    await userEvent.click(screen.getByRole("button", { name: "Save override" }));
    const plate = document.querySelector(".xr-result") as HTMLElement;
    expect(plate).toHaveTextContent("overruled by Ada");
    expect(plate).toHaveTextContent("Rules decided: PARTIALLY APPROVED");
    expect(fractured()).toHaveLength(2);
    expect((store.getState() as DecisionState).overrides).toHaveLength(1);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Human override" }));
  });

  it("a failing replay shows the error panel and keeps v1", async () => {
    const failing: CoreError = { kind: "rule_not_found", message: "gone", ruleId: "x", ruleVersion: "1.0.0" };
    await setup((() => failing) as unknown as typeof replay);
    const slider = screen.getByRole("slider");
    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuetext", "v1");
    expect(screen.queryByText("Replayed with v2")).toBeNull();
    expect(document.activeElement).toBe(slider);
  });
});
