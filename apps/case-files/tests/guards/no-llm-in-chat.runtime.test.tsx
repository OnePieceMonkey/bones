import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/App";
import { createProductionSession } from "../../src/state/sessionStore";
import type { SessionStore } from "../../src/state/sessionStore";

// (c) of the "Dr. Bones never calls an LLM" guard: the case screen and the verdict screen, with
// their chat, make zero network calls. Stubs only, no real network.
// Static counterpart: no-llm-in-chat.node.test.ts.
const NET_KEYS = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"] as const;
let calls: string[] = [];
let saved: Record<string, unknown> = {};

beforeEach(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  calls = [];
  saved = {};
  for (const key of NET_KEYS) {
    saved[key] = g[key];
    g[key] = function throwingStub(...args: unknown[]): never {
      calls.push(`${key}:${String(args[0])}`);
      throw new Error(`network access is forbidden: ${key}`);
    };
  }
});

afterEach(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  for (const key of NET_KEYS) {
    if (saved[key] === undefined) delete g[key];
    else g[key] = saved[key];
  }
});

function makeStore(): SessionStore {
  const store = createProductionSession();
  if ("kind" in store) throw new Error("bundle");
  return store;
}

const bubbles = (): string[] =>
  [...document.querySelectorAll(".xr-bubble")].map((el) => el.textContent ?? "");

describe("Dr. Bones chat makes no network call", () => {
  it("shows chat messages on the case and verdict screens with zero fetch/XHR/WebSocket/EventSource calls", async () => {
    const store = makeStore();
    await store.loadRecordedCase("greenhouse");
    render(<App store={store} />);

    // Case screen: the chat shows messages built from the trace.
    await waitFor(() => expect(bubbles().length).toBeGreaterThan(0));
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "the widow" }));
    await waitFor(() => expect(bubbles().length).toBeGreaterThan(0));
    expect(store.getState().screen).toBe("case");

    // Rule version knob replays the decision, still without network.
    screen.getByRole("slider", { name: "RULE VERSION" }).focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(bubbles().length).toBeGreaterThan(0));

    // Verdict screen.
    await user.click(screen.getByRole("button", { name: "Accuse" }));
    expect(document.querySelector(".case-banner")).not.toBeNull();
    await waitFor(() => expect(bubbles().length).toBeGreaterThan(0));

    expect(calls).toEqual([]);
  });

  it("the stubs are live: a direct fetch call is recorded and throws", () => {
    expect(() => fetch("/x")).toThrow("network access is forbidden");
    expect(calls).toEqual(["fetch:/x"]);
    calls = [];
  });
});
