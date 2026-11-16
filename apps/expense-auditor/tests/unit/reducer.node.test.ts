import { describe, expect, it } from "vitest";
import { isCoreError } from "@bones/core";
import type { CoreError, Override } from "@bones/core";
import { initialState, reducer } from "../../src/state/reducer";
import type { Action, AppState, DecisionState } from "../../src/state/reducer";
import { claimedCentsOf, displayedTrace, effectiveView, linkedOverrides, replayNote, titlePlate } from "../../src/state/selectors";
import { sampleTrace, signatureDecisionState } from "../helpers/fixtures";

const err: CoreError = { kind: "invalid_replay_arguments", message: "boom", missingField: "x" };

function ov(decisionId: string, createdAt: string, name = "Ann"): Override {
  return {
    decisionId,
    reviewerName: name,
    reason: "because",
    replacementResult: "approved",
    createdAt,
  };
}

async function ready(reducedMotion = false): Promise<{ state: DecisionState; action: Action }> {
  const full = await signatureDecisionState();
  const action: Action = {
    type: "decision_ready",
    sessionId: "s1",
    origin: full.origin,
    trip: full.trip,
    source: full.source,
    original: full.original,
    reducedMotion,
  };
  const state = reducer(initialState, action) as DecisionState;
  return { state, action };
}

describe("reducer", () => {
  it("load_started and load_failed move the start screen", () => {
    const busy = reducer(initialState, { type: "load_started" });
    expect(busy).toEqual({ screen: "start", busy: true, error: null });
    const failed = reducer(busy, { type: "load_failed", error: { kind: "core", error: err } });
    expect(failed).toEqual({ screen: "start", busy: false, error: { kind: "core", error: err } });
  });

  it("decision_ready builds the replay store, selects v1 and starts the intro", async () => {
    const { state, action } = await ready();
    expect(state.screen).toBe("decision");
    expect(state.selected).toBe("v1");
    expect(state.overrides).toEqual([]);
    expect(state.replays).toEqual({ v1: state.original });
    expect(state.intro).toEqual({ xray: false, pending: true });
    expect(state.notice).toBeNull();
    expect(action.type).toBe("decision_ready");
    const rm = (await ready(true)).state;
    expect(rm.intro).toEqual({ xray: true, pending: false });
  });

  it("replay_stored stores and selects, version_selected clears the notice", async () => {
    const { state } = await ready();
    const full = await signatureDecisionState();
    const v2 = full.replays.v2!;
    const failed = reducer(state, { type: "replay_failed", error: err }) as DecisionState;
    expect(failed.notice).toEqual({ kind: "replay_failed", error: err });
    const stored = reducer(failed, { type: "replay_stored", label: "v2", trace: v2 }) as DecisionState;
    expect(stored.selected).toBe("v2");
    expect(stored.replays.v2).toBe(v2);
    expect(stored.replays.v1).toBe(state.original);
    const back = reducer(failed, { type: "version_selected", label: "v1" }) as DecisionState;
    expect(back.notice).toBeNull();
    expect(back.selected).toBe("v1");
  });

  it("a failing replay keeps the selected version and the displayed Trace", async () => {
    const { state } = await ready();
    const failed = reducer(state, { type: "replay_failed", error: err }) as DecisionState;
    expect(failed.selected).toBe("v1");
    expect(displayedTrace(failed)).toBe(state.original);
    expect(failed.notice?.error).toBe(err);
  });

  it("override_added appends and never touches original or replays", async () => {
    const state = await signatureDecisionState();
    const o = ov(state.original.decisionId, "2024-01-01T00:00:00.000Z");
    const next = reducer(state, { type: "override_added", override: o }) as DecisionState;
    expect(next.overrides).toEqual([o]);
    expect(next.original).toBe(state.original);
    expect(next.replays).toBe(state.replays);
  });

  it("intro events update the intro state; notice_cleared clears the notice", async () => {
    const { state } = await ready();
    const timer = reducer(state, { type: "intro", event: { type: "timer" } }) as DecisionState;
    expect(timer.intro).toEqual({ xray: true, pending: false });
    const user = reducer(state, { type: "intro", event: { type: "user", xray: false } }) as DecisionState;
    expect(user.intro).toEqual({ xray: false, pending: false });
    const withNotice = reducer(state, { type: "replay_failed", error: err });
    const cleared = reducer(withNotice, { type: "notice_cleared" }) as DecisionState;
    expect(cleared.notice).toBeNull();
    expect(reducer(state, { type: "notice_cleared" })).toBe(state);
  });

  it("reset discards replays and overrides", async () => {
    const state = await signatureDecisionState();
    const withOv = reducer(state, {
      type: "override_added",
      override: ov(state.original.decisionId, "2024-01-01T00:00:00.000Z"),
    });
    expect(reducer(withOv, { type: "reset" })).toBe(initialState);
    expect(reducer(initialState, { type: "reset" })).toBe(initialState);
  });

  it("wrong screen or unknown action returns the same object", async () => {
    const full = await signatureDecisionState();
    for (const a of [
      { type: "version_selected", label: "v2" },
      { type: "replay_failed", error: err },
      { type: "override_added", override: ov("x", "2024-01-01T00:00:00.000Z") },
      { type: "intro", event: { type: "timer" } },
      { type: "notice_cleared" },
      { type: "replay_stored", label: "v2", trace: full.original },
    ] as Action[]) {
      expect(reducer(initialState, a)).toBe(initialState);
    }
    expect(reducer(full, { type: "load_started" })).toBe(full);
    expect(reducer(full, { type: "load_failed", error: { kind: "core", error: err } })).toBe(full);
    const unknown = { type: "nope" } as unknown as Action;
    expect(reducer(full, unknown)).toBe(full);
    expect(reducer(initialState, unknown)).toBe(initialState);
  });
});

describe("selectors", () => {
  it("replayNote is null for v1 and names the version otherwise", async () => {
    const state = await signatureDecisionState();
    expect(replayNote(state)).toBeNull();
    expect(replayNote({ ...state, selected: "v2" })).toBe("Replayed with v2");
    expect(displayedTrace({ ...state, selected: "v3" })).toBe(state.replays.v3);
  });

  it("claimedCentsOf reads claimedTotalCents and gives 0 for an invalid shape", async () => {
    const state = await signatureDecisionState();
    const fields = state.original.validatedFields as { claimedTotalCents: number };
    expect(claimedCentsOf(state.original)).toBe(fields.claimedTotalCents);
    expect(claimedCentsOf({ ...state.original, validatedFields: { nope: 1 } })).toBe(0);
  });

  it("titlePlate shows the mode", async () => {
    const state = await signatureDecisionState();
    expect(titlePlate(state.origin, "recorded")).toBe("Expense Auditor - RECORDED");
    expect(titlePlate({ kind: "live", fileName: "a.png" }, "live")).toBe("Expense Auditor - LIVE");
    expect(titlePlate(null, "live")).toBe("Expense Auditor - LIVE");
  });

  it("effectiveView is null without linked overrides, even when another Trace has one", async () => {
    const state = await signatureDecisionState();
    expect(effectiveView(state)).toBeNull();
    const v2Id = state.replays.v2!.decisionId;
    const other: DecisionState = { ...state, overrides: [ov(v2Id, "2024-01-01T00:00:00.000Z")] };
    expect(linkedOverrides(other)).toEqual([]);
    expect(effectiveView(other)).toBeNull();
    const onV2 = { ...other, selected: "v2" as const };
    expect(effectiveView(onV2)).toEqual({ result: "approved", reviewerName: "Ann" });
  });

  it("effectiveView picks the latest linked override and its reviewer", async () => {
    const state = await signatureDecisionState();
    const id = state.original.decisionId;
    const a = { ...ov(id, "2024-01-01T00:00:00.000Z", "Ann"), replacementResult: "rejected" as const };
    const b = ov(id, "2024-01-02T00:00:00.000Z", "Bob");
    const view = effectiveView({ ...state, overrides: [b, a] });
    expect(view).toEqual({ result: "approved", reviewerName: "Bob" });
  });

  it("effectiveView passes a CoreError through", async () => {
    const state = await signatureDecisionState();
    const id = state.original.decisionId;
    const t = "2024-01-01T00:00:00.000Z";
    const view = effectiveView({ ...state, overrides: [ov(id, t, "A"), ov(id, t, "B")] });
    expect(isCoreError(view)).toBe(true);
    expect((view as CoreError).kind).toBe("ambiguous_override");
  });
});

describe("fixtures", () => {
  it("signatureDecisionState holds three distinct Traces", async () => {
    const s = await signatureDecisionState();
    const ids = new Set([s.replays.v1!.decisionId, s.replays.v2!.decisionId, s.replays.v3!.decisionId]);
    expect(ids.size).toBe(3);
    expect(s.original).toBe(s.replays.v1);
    const plain = await sampleTrace("signature", "v1");
    expect(plain.inputHash).toBe(s.original.inputHash);
    const _check: AppState = s;
    expect(_check.screen).toBe("decision");
  });
});
