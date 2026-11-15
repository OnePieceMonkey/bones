import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isCoreError } from "@bones/core";
import type { CoreError } from "@bones/core";
import { App } from "../../src/App";
import { createProductionSession } from "../../src/state/sessionStore";
import type { SessionStore } from "../../src/state/sessionStore";

let fetchSpy: ReturnType<typeof vi.fn<[], Promise<Response>>>;
let downloads: number;

beforeEach(() => {
  fetchSpy = vi.fn(async () => new Response("{}"));
  vi.stubGlobal("fetch", fetchSpy);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  downloads = 0;
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
    downloads += 1;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "matchMedia");
});

function productionStore(): SessionStore {
  const s = createProductionSession();
  if (isCoreError(s)) throw new Error(JSON.stringify(s));
  return s;
}

const fractured = () => document.querySelectorAll('button.xr-bone-btn[data-state="fractured"]');

describe("App", () => {
  it("shows the start screen first", () => {
    render(<App store={productionStore()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Expense Auditor" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Load sample receipt" })).toBeInTheDocument();
  });

  it("loads the signature sample: observed facts, no fetch, heading focus", async () => {
    render(<App store={productionStore()} />);
    await userEvent.click(screen.getByRole("button", { name: "Signature case" }));
    await screen.findByRole("switch");

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
    expect(card.querySelector('[data-path="lineItems"]')).toHaveTextContent(/\d+ line items? · \$/);
    expect(card.textContent).not.toMatch(/EUR|\{|\[/);
    expect(document.body.textContent).not.toContain("EUR");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true"); // reduced motion
    expect(screen.getByText("Expense Auditor - RECORDED")).toBeInTheDocument();

    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Expense Auditor" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("goes back with Load another receipt and drops replay and override state; no fetch during replay or export", async () => {
    render(<App store={productionStore()} />);
    await userEvent.click(screen.getByRole("button", { name: "Signature case" }));
    await screen.findByRole("switch");

    const slider = screen.getByRole("slider");
    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("Replayed with v2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Download trace" }));
    expect(downloads).toBe(1);

    await userEvent.click(screen.getByRole("button", { name: "Overrule" }));
    await userEvent.type(screen.getByLabelText("Reviewer name"), "Ada");
    await userEvent.type(screen.getByLabelText("Reason"), "Manager approved");
    await userEvent.click(screen.getByRole("button", { name: "Save override" }));
    expect(document.querySelector(".xr-result")).toHaveTextContent("overruled by Ada");

    await userEvent.click(screen.getByRole("button", { name: "Load another receipt" }));
    expect(screen.getByRole("group", { name: "Load sample receipt" })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Expense Auditor" }));

    await userEvent.click(screen.getByRole("button", { name: "Clean meal" }));
    await screen.findByRole("switch");
    expect(screen.queryByText(/Replayed with/)).toBeNull();
    expect(document.querySelector(".xr-result")).not.toHaveTextContent("overruled by");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "v1");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows an error panel when the rule bundle is broken", () => {
    const broken: CoreError = { kind: "rule_not_found", message: "Rule x was not found.", ruleId: "x", ruleVersion: "1.0.0" };
    const session = createProductionSession(() => broken);
    expect(isCoreError(session)).toBe(true);
    render(<App store={null} bundleError={broken} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Rule x was not found.");
    expect(screen.queryByRole("group", { name: "Load sample receipt" })).toBeNull();
  });

  it("shows the error boundary message when rendering throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exploding = {
      getState: () => {
        throw new Error("boom");
      },
      subscribe: () => () => {},
    } as unknown as SessionStore;
    render(<App store={exploding} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Reload the page.");
  });

  it("loads the outside-window sample as a decision without any fetch", async () => {
    const store = productionStore();
    render(<App store={store} />);
    await userEvent.click(screen.getByRole("button", { name: "Outside the trip window" }));
    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
