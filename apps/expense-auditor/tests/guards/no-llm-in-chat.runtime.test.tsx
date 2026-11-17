import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isCoreError, override, replay } from "@bones/core";
import { SAMPLES } from "../../src/extraction/samples";
import { makePortFactory } from "../../src/pipeline/ports";
import { createSessionStore, useSession } from "../../src/state/sessionStore";
import type { SessionStore } from "../../src/state/sessionStore";
import { DecisionView } from "../../src/ui/DecisionView";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle } from "../helpers/fixtures";

// (c) of the "Dr. Bones never calls an LLM" guard: rendering the decision view with its chat,
// and replaying with another rule version, makes zero network calls. Stubs only, no real network.
// Static counterparts: no-llm-in-chat.node.test.ts; xray-ui chat-source.test.tsx (net spy).
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
  const bundle = loadTestBundle();
  if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));
  return createSessionStore({
    bundle,
    samples: SAMPLES,
    portFactory: makePortFactory(counterPorts()),
    sha256: async () => "ab".repeat(32),
    replayFn: replay,
    overrideFn: override,
    prefersReducedMotion: () => true,
    makeLiveAdapter: () => ({
      extract: async () => ({ kind: "extraction_failed" as const, message: "not used", reason: "network" as const }),
    }),
    revokeObjectUrl: () => undefined,
  });
}

function Harness({ store }: { store: SessionStore }) {
  const state = useSession(store);
  if (state.screen !== "decision") return <p>no decision</p>;
  return <DecisionView state={state} store={store} reducedMotion />;
}

const bubbles = (): string[] =>
  [...document.querySelectorAll(".xr-bubble")].map((el) => el.textContent ?? "");

describe("Dr. Bones chat makes no network call", () => {
  it("shows chat messages with zero fetch/XHR/WebSocket/EventSource calls, also after a replay", async () => {
    const store = makeStore();
    await store.loadSample("signature");
    render(<Harness store={store} />);

    const first = bubbles();
    expect(first.length).toBeGreaterThan(1);
    expect(first.join("\n")).toMatch(/PARTIALLY APPROVED/i);

    await userEvent.setup().click(screen.getByRole("slider"));
    await userEvent.keyboard("{ArrowRight}");
    expect(bubbles().length).toBeGreaterThan(1);

    expect(calls).toEqual([]);
  });

  it("the stub is live: a direct fetch call is recorded and throws", () => {
    expect(() => fetch("/x")).toThrow("network access is forbidden");
    expect(calls).toEqual(["fetch:/x"]);
    calls = [];
  });
});
