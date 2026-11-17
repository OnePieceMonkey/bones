import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { isCoreError, override, replay } from "@bones/core";
import type { DecisionState } from "../../src/state/reducer";
import { SAMPLES } from "../../src/extraction/samples";
import { makePortFactory } from "../../src/pipeline/ports";
import { createSessionStore, useSession } from "../../src/state/sessionStore";
import type { SessionStore } from "../../src/state/sessionStore";
import { DecisionView } from "../../src/ui/DecisionView";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle } from "../helpers/fixtures";

function mockMatchMedia(reduced: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

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
    prefersReducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    makeLiveAdapter: () => ({ extract: async () => ({ kind: "extraction_failed" as const, message: "not used", reason: "network" as const }) }),
    revokeObjectUrl: () => undefined,
  });
}

function Harness({ store }: { store: SessionStore }) {
  const state = useSession(store);
  if (state.screen !== "decision") return <p>no decision</p>;
  return <DecisionView state={state} store={store} />;
}

async function loadAndRender(reduced: boolean) {
  mockMatchMedia(reduced);
  const store = makeStore();
  const view = render(<Harness store={store} />);
  await act(async () => {
    await store.loadSample("signature");
  });
  return { store, view };
}

const introOf = (store: SessionStore) => (store.getState() as DecisionState).intro;
const xraySwitch = () => screen.getByRole("switch");

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("intro sequence", () => {
  it("starts with X-RAY off and flips on after 600 ms, not at 499 ms", async () => {
    const { store } = await loadAndRender(false);
    expect(introOf(store).pending).toBe(true);
    expect(xraySwitch()).toHaveAttribute("aria-checked", "false");
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(xraySwitch()).toHaveAttribute("aria-checked", "false");
    act(() => {
      vi.advanceTimersByTime(101);
    });
    expect(xraySwitch()).toHaveAttribute("aria-checked", "true");
    expect(introOf(store).pending).toBe(false);
  });

  it("is on immediately under prefers-reduced-motion with no pending timer", async () => {
    await loadAndRender(true);
    expect(xraySwitch()).toHaveAttribute("aria-checked", "true");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a user toggle before 600 ms keeps the user's choice and leaves no timer", async () => {
    const { store } = await loadAndRender(false);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.click(xraySwitch()); // off -> on
    fireEvent.click(xraySwitch()); // on -> off
    expect(xraySwitch()).toHaveAttribute("aria-checked", "false");
    expect(introOf(store).pending).toBe(false);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(xraySwitch()).toHaveAttribute("aria-checked", "false");
  });

  it("unmounting clears the pending timer", async () => {
    const set = vi.spyOn(globalThis, "setTimeout");
    const clear = vi.spyOn(globalThis, "clearTimeout");
    const { view } = await loadAndRender(false);
    const flipIndex = set.mock.calls.findIndex((c) => c[1] === 600);
    expect(flipIndex).toBeGreaterThanOrEqual(0);
    const flipId = set.mock.results[flipIndex]?.value;
    view.unmount();
    expect(clear.mock.calls.some((c) => c[0] === flipId)).toBe(true);
  });

  it("completes within the first 10 seconds of fake time", async () => {
    await loadAndRender(false);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(xraySwitch()).toHaveAttribute("aria-checked", "true");
    expect(document.querySelector(".xr-result")).toHaveTextContent("PARTIALLY APPROVED");
  });
});
