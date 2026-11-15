import { describe, expect, it, vi } from "vitest";
import { isCoreError, override, replay } from "@bones/core";
import type { CoreError } from "@bones/core";
import { SAMPLES } from "../../src/extraction/samples";
import { makePortFactory } from "../../src/pipeline/ports";
import { createSessionStore } from "../../src/state/sessionStore";
import type { SessionDeps } from "../../src/state/sessionStore";
import type { DecisionState } from "../../src/state/reducer";
import { displayedTrace, effectiveView } from "../../src/state/selectors";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle } from "../helpers/fixtures";

function makeDeps(over: Partial<SessionDeps> = {}): SessionDeps & { replayFn: ReturnType<typeof vi.fn> } {
  const bundle = loadTestBundle();
  if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));
  const replayFn = vi.fn(replay);
  return {
    bundle,
    samples: SAMPLES,
    portFactory: makePortFactory(counterPorts()),
    sha256: async () => "ab".repeat(32),
    replayFn: replayFn as unknown as typeof replay,
    overrideFn: override,
    prefersReducedMotion: () => false,
    ...over,
  } as SessionDeps & { replayFn: ReturnType<typeof vi.fn> };
}

describe("session store", () => {
  it("loadSample opens the decision at v1 with a pending intro", async () => {
    const store = createSessionStore(makeDeps());
    const seen: string[] = [];
    store.subscribe(() => seen.push(store.getState().screen));
    await store.loadSample("signature");
    const s = store.getState() as DecisionState;
    expect(s.screen).toBe("decision");
    expect(s.selected).toBe("v1");
    expect(s.origin).toEqual({ kind: "sample", sampleId: "signature" });
    expect(s.source.kind).toBe("text");
    expect(s.original.inputHash).toBe("ab".repeat(32));
    expect(s.intro).toEqual({ xray: false, pending: true });
    expect(seen).toEqual(["start", "decision"]);
  });

  it("reduced motion turns X-ray on immediately", async () => {
    const store = createSessionStore(makeDeps({ prefersReducedMotion: () => true }));
    await store.loadSample("clean");
    expect((store.getState() as DecisionState).intro).toEqual({ xray: true, pending: false });
  });

  it("selectVersion('v2') twice calls replayFn once; v1 never calls it", async () => {
    const deps = makeDeps();
    const store = createSessionStore(deps);
    await store.loadSample("signature");
    store.selectVersion("v1");
    expect(deps.replayFn).not.toHaveBeenCalled();
    store.selectVersion("v2");
    const v2 = displayedTrace(store.getState() as DecisionState);
    store.selectVersion("v1");
    store.selectVersion("v2");
    expect(deps.replayFn).toHaveBeenCalledTimes(1);
    expect(displayedTrace(store.getState() as DecisionState)).toBe(v2);
    expect((store.getState() as DecisionState).selected).toBe("v2");
  });

  it("a failing replayFn keeps the displayed version and sets a notice", async () => {
    const failure: CoreError = { kind: "invalid_replay_arguments", message: "nope", missingField: "x" };
    const deps = makeDeps({ replayFn: (() => failure) as unknown as typeof replay });
    const store = createSessionStore(deps);
    await store.loadSample("signature");
    store.selectVersion("v2");
    const s = store.getState() as DecisionState;
    expect(s.selected).toBe("v1");
    expect(s.replays.v2).toBeUndefined();
    expect(s.notice).toEqual({ kind: "replay_failed", error: failure });
    store.clearNotice();
    expect((store.getState() as DecisionState).notice).toBeNull();
  });

  it("a throwing replayFn is also reported as a notice", async () => {
    const deps = makeDeps({
      replayFn: (() => {
        throw new Error("kaboom");
      }) as unknown as typeof replay,
    });
    const store = createSessionStore(deps);
    await store.loadSample("signature");
    store.selectVersion("v3");
    const s = store.getState() as DecisionState;
    expect(s.selected).toBe("v1");
    expect(s.notice?.kind).toBe("replay_failed");
  });

  it("a blank reviewer name is rejected and leaves the state unchanged", async () => {
    const store = createSessionStore(makeDeps());
    await store.loadSample("signature");
    const before = store.getState();
    const outcome = store.submitOverride({
      reviewerName: "   ",
      reason: "fine",
      replacementResult: "approved",
    });
    expect(outcome).toMatchObject({ ok: false, field: "reviewerName" });
    expect(store.getState()).toBe(before);
  });

  it("a blank reason is rejected with the reason field", async () => {
    const store = createSessionStore(makeDeps());
    await store.loadSample("signature");
    const outcome = store.submitOverride({
      reviewerName: "Ann",
      reason: " ",
      replacementResult: "approved",
    });
    expect(outcome).toMatchObject({ ok: false, field: "reason" });
  });

  it("a valid override is linked to the displayed decisionId and becomes effective", async () => {
    const store = createSessionStore(makeDeps());
    await store.loadSample("signature");
    store.selectVersion("v2");
    const shown = displayedTrace(store.getState() as DecisionState);
    expect(
      store.submitOverride({ reviewerName: "Ann", reason: "ok", replacementResult: "rejected" }),
    ).toEqual({ ok: true });
    const s = store.getState() as DecisionState;
    expect(s.overrides).toHaveLength(1);
    expect(s.overrides[0]!.decisionId).toBe(shown.decisionId);
    expect(s.overrides[0]!.decisionId).not.toBe(s.original.decisionId);
    expect(effectiveView(s)).toEqual({ result: "rejected", reviewerName: "Ann" });
    store.selectVersion("v1");
    expect(effectiveView(store.getState() as DecisionState)).toBeNull();
  });

  it("an invalid sample gives load_failed with fixture_invalid", async () => {
    const bad = { id: "clean", title: "x", receiptText: "t" };
    const store = createSessionStore(makeDeps({ samples: [bad] }));
    await store.loadSample("clean");
    const s = store.getState();
    expect(s.screen).toBe("start");
    if (s.screen !== "start") throw new Error("unreachable");
    expect(s.busy).toBe(false);
    expect(s.error?.kind).toBe("core");
    expect(s.error?.kind === "core" && s.error.error.kind).toBe("fixture_invalid");
  });

  it("an unknown sample gives fixture_not_found and a rejecting sha256 gives load_failed", async () => {
    const empty = createSessionStore(makeDeps({ samples: [] }));
    await empty.loadSample("clean");
    const e = empty.getState();
    expect(e.screen === "start" && e.error?.kind === "core" && e.error.error.kind).toBe("fixture_not_found");

    const rejecting = createSessionStore(
      makeDeps({ sha256: () => Promise.reject(new Error("no subtle")) }),
    );
    await rejecting.loadSample("clean");
    const r = rejecting.getState();
    expect(r.screen).toBe("start");
    expect(r.screen === "start" && r.error !== null).toBe(true);
  });

  it("reset returns the start screen and discards replays and overrides", async () => {
    const store = createSessionStore(makeDeps());
    await store.loadSample("signature");
    store.selectVersion("v2");
    store.submitOverride({ reviewerName: "Ann", reason: "ok", replacementResult: "approved" });
    store.reset();
    expect(store.getState()).toEqual({ screen: "start", busy: false, error: null });
    await store.loadSample("signature");
    const s = store.getState() as DecisionState;
    expect(s.overrides).toEqual([]);
    expect(Object.keys(s.replays)).toEqual(["v1"]);
  });

  it("subscribe returns an unsubscribe function; dispatchIntro updates the intro", async () => {
    const store = createSessionStore(makeDeps());
    const listener = vi.fn();
    const off = store.subscribe(listener);
    await store.loadSample("signature");
    const calls = listener.mock.calls.length;
    store.dispatchIntro({ type: "timer" });
    expect((store.getState() as DecisionState).intro).toEqual({ xray: true, pending: false });
    off();
    store.dispatchIntro({ type: "user", xray: false });
    expect(listener.mock.calls.length).toBe(calls + 1);
  });
});
