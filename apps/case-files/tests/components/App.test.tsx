import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/App";
import { createProductionSession } from "../../src/state/sessionStore";
import type { SessionStore } from "../../src/state/sessionStore";

function makeStore(): SessionStore {
  const store = createProductionSession();
  if ("kind" in store) throw new Error("bundle");
  return store;
}

afterEach(() => {
  vi.restoreAllMocks();
});

/** The accessible name of an element, as far as the order test needs it. */
function nameOf(el: Element): string {
  return (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ");
}

describe("App flow", () => {
  it("runs start, case, knob, X-RAY, accuse, override and new case without a network request", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("no network")));
    vi.stubGlobal("fetch", fetchSpy);
    const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, "open");
    const store = makeStore();
    const user = userEvent.setup();
    render(<App store={store} />);

    await user.click(screen.getByRole("button", { name: /Two Candlesticks/i }));
    await screen.findByRole("radiogroup");
    expect(store.getState().screen).toBe("case");

    // Rejected under v1: Accuse is disabled. Turn the knob to v2.
    await user.click(screen.getByRole("radio", { name: "Ada" }));
    expect(screen.getByRole("button", { name: "Accuse" })).toBeDisabled();
    act(() => screen.getByRole("slider", { name: "RULE VERSION" }).focus());
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Accuse" })).toBeEnabled();

    // X-RAY on, then accuse.
    await user.click(screen.getByRole("switch", { name: /X-RAY/i }));
    expect(store.getState()).toMatchObject({ xray: true });
    await user.click(screen.getByRole("button", { name: "Accuse" }));
    expect(document.querySelector(".case-banner")).toHaveTextContent("CASE CLOSED: Ada is guilty.");

    // Override from the verdict view opens the dialog.
    await user.click(screen.getByRole("button", { name: "Human override" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/reviewer name/i), "Rita");
    await user.type(screen.getByLabelText(/reason/i), "Second look");
    await user.click(screen.getByRole("button", { name: /^(save|submit|apply|overrule)/i }));
    await waitFor(() => expect(store.getState()).toMatchObject({ overrides: [expect.anything()] }));

    // New case returns to the start screen.
    await user.click(screen.getByRole("button", { name: "New case" }));
    expect(store.getState().screen).toBe("start");

    expect(fetchSpy).toHaveBeenCalledTimes(0);
    expect(xhrOpen).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("shows the ErrorPanel and no Trace when the pipeline fails", async () => {
    const store = makeStore();
    vi.spyOn(console, "error").mockImplementation(() => {});
    // An unknown id makes the recorded adapter return fixture_not_found.
    await store.loadRecordedCase("nope" as never);
    render(<App store={store} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/cannot be opened/i);
    expect(store.getState().screen).toBe("start");
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("shows the bundle error when the rules could not be loaded", () => {
    render(
      <App
        store={null}
        bundleError={{ kind: "rule_not_found", message: "missing", ruleId: "x" } as never}
      />,
    );
    expect(screen.getByText("The rules could not be loaded")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("downloads the trace through a Blob without a network request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const create = vi.fn(() => "blob:test");
    const revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: create, configurable: true, writable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revoke, configurable: true, writable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const store = makeStore();
    await store.loadRecordedCase("greenhouse");
    render(<App store={store} />);
    await userEvent.click(screen.getByRole("button", { name: "Download trace" }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("is reachable by keyboard in the stated order", async () => {
    const store = makeStore();
    await store.loadRecordedCase("greenhouse");
    // A selected suspect makes Accuse enabled, so that it is a tab stop.
    store.selectSuspect("widow");
    const user = userEvent.setup();
    render(<App store={store} />);
    const seen: string[] = [];
    // Start from the document body and press Tab until the focus returns to it.
    for (let i = 0; i < 40; i += 1) {
      await user.tab();
      const el = document.activeElement;
      if (el === null || el === document.body) break;
      const label = nameOf(el);
      if (seen[seen.length - 1] !== label) seen.push(label);
    }
    const idx = (re: RegExp) => seen.findIndex((s) => re.test(s));
    const order = [
      idx(/Download trace/),
      idx(/Load another case/),
      idx(/^the widow$/),
      idx(/RULE VERSION/),
      idx(/X-RAY/),
      idx(/^Accuse/),
      idx(/^Replay$/),
      idx(/Human override/),
    ];
    expect(order.every((n) => n >= 0), JSON.stringify(seen)).toBe(true);
    expect([...order].sort((a, b) => a - b), JSON.stringify(seen)).toEqual(order);
  });

  it("keeps a focus ring of at least 3 CSS pixels in the stylesheet", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const css = readFileSync(resolve(process.cwd(), "src/styles/app.css"), "utf8");
    const dir = resolve(process.cwd(), "../../packages/xray-ui/src/styles");
    const xr = readdirSync(dir)
      .filter((f) => f.endsWith(".css"))
      .map((f) => readFileSync(resolve(dir, f), "utf8"))
      .join("\n");
    expect(`${css}\n${xr}`).toMatch(/:focus-visible[^}]*(outline(-width)?|box-shadow)[^}]*\b[3-9]px/);
  });
});

describe("App verdict view override", () => {
  it("opens the OverrideDialog from the verdict view and returns focus on close", async () => {
    const store = makeStore();
    await store.loadRecordedCase("greenhouse");
    store.selectSuspect("widow");
    const user = userEvent.setup();
    render(<App store={store} />);
    const widow = screen.queryByRole("radio", { name: "the widow" });
    if (widow !== null) await user.click(widow);
    await user.click(screen.getByRole("button", { name: "Accuse" }));
    const btn = screen.getByRole("button", { name: "Human override" });
    await user.click(btn);
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /cancel|close/i }));
    expect(btn).toHaveFocus();
  });
});
