import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isCoreError, override, replay } from "@bones/core";
import type { CoreError } from "@bones/core";
import { App } from "../../src/App";
import { SAMPLES, sampleSchema } from "../../src/extraction/samples";
import { makePortFactory } from "../../src/pipeline/ports";
import { createProductionSession, createSessionStore } from "../../src/state/sessionStore";
import type { SessionStore } from "../../src/state/sessionStore";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle } from "../helpers/fixtures";

let fetchSpy: ReturnType<typeof vi.fn<[RequestInfo | URL, (RequestInit | undefined)?], Promise<Response>>>;

const statusResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
/** Only the status GET is allowed; any other request (receipt data, POST) fails. */
const onlyStatusRequests = () => {
  expect(fetchSpy.mock.calls.length).toBeGreaterThan(0);
  for (const [url, init] of fetchSpy.mock.calls) {
    expect(url).toBe("/api/extract");
    expect(init?.method).toBe("GET");
  }
};
let downloads: number;

beforeEach(() => {
  fetchSpy = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit | undefined) => statusResponse({ live: false }));
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
    onlyStatusRequests();
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

    await userEvent.click(screen.getByRole("button", { name: "Human override" }));
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
    onlyStatusRequests();
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
    onlyStatusRequests();
  });

  describe("live status", () => {
    it("shows the upload control when the status says live: true", async () => {
      fetchSpy.mockImplementation(async () => statusResponse({ live: true }));
      render(<App store={productionStore()} />);
      expect(await screen.findByLabelText("Upload receipt photo")).toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      onlyStatusRequests();
    });

    it("hides the upload control for live: false", async () => {
      render(<App store={productionStore()} />);
      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
      await new Promise((r) => setTimeout(r, 0));
      expect(screen.queryByLabelText("Upload receipt photo")).toBeNull();
      onlyStatusRequests();
    });

    it("hides the upload control when the status request fails", async () => {
      fetchSpy.mockImplementation(async () => {
        throw new TypeError("offline");
      });
      render(<App store={productionStore()} />);
      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
      await new Promise((r) => setTimeout(r, 0));
      expect(screen.queryByLabelText("Upload receipt photo")).toBeNull();
      expect(screen.getByRole("group", { name: "Load sample receipt" })).toBeInTheDocument();
    });

    it("shows the LIVE plate for a live decision", async () => {
      const bundle = loadTestBundle();
      if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));
      const clean = sampleSchema.parse(SAMPLES.find((x) => (x as { id?: unknown }).id === "clean"));
      const store = createSessionStore({
        bundle,
        samples: SAMPLES,
        portFactory: makePortFactory(counterPorts()),
        sha256: async () => "cd".repeat(32),
        replayFn: replay,
        overrideFn: override,
        prefersReducedMotion: () => true,
        makeLiveAdapter: () => ({ extract: async () => clean.extraction }),
        revokeObjectUrl: () => undefined,
      });
      render(<App store={store} />);
      await act(async () => {
        await store.loadPhoto({
          image: { bytes: new Uint8Array([1, 2, 3]), mediaType: "image/jpeg", previewUrl: "blob:p" },
          fileName: "r.jpg",
          trip: { start: "2024-03-10", end: "2024-03-20" },
        });
      });
      await screen.findByRole("switch");
      expect(screen.getByRole("region", { name: "Expense Auditor - LIVE" })).toBeInTheDocument();
    });

    it("shows the RECORDED plate for a sample decision", async () => {
      render(<App store={productionStore()} />);
      await userEvent.click(screen.getByRole("button", { name: "Clean meal" }));
      await screen.findByRole("switch");
      expect(screen.getByRole("region", { name: "Expense Auditor - RECORDED" })).toBeInTheDocument();
    });
  });
});
