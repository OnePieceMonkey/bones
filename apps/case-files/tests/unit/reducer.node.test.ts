import { isCoreError } from "@bones/core";
import type { CoreError, ExtractionPort, ExtractionResult, Override, Trace } from "@bones/core";
import { describe, expect, it } from "vitest";
import { makePortFactory } from "../../src/pipeline/ports";
import { runCasePipeline } from "../../src/pipeline/runCasePipeline";
import { initialState, reducer } from "../../src/state/reducer";
import type { Action, CaseState } from "../../src/state/reducer";
import { introPhaseFor } from "../../src/state/intro";
import { displayedTrace, effectiveView, linkedOverrides, replayNote } from "../../src/state/selectors";
import { counterPorts } from "../helpers/fakes";
import type { RuleBundle } from "../../src/rules/catalog";
import { loadTestBundle, readRecorded } from "../helpers/fixtures";

const loaded = loadTestBundle();
if (isCoreError(loaded)) throw new Error(JSON.stringify(loaded));
const bundle: RuleBundle = loaded;
const recorded = readRecorded().find((r) => r.json.id === "greenhouse")!;

async function trace(): Promise<Trace> {
  const adapter: ExtractionPort = {
    extract: async () => structuredClone(recorded.json.extraction) as ExtractionResult,
  };
  const t = await runCasePipeline({
    input: { raw: "x" },
    adapter,
    versionLabel: "v1",
    bundle,
    portFactory: makePortFactory(counterPorts()),
  });
  if (isCoreError(t)) throw new Error(JSON.stringify(t));
  return t;
}

const err: CoreError = { kind: "invalid_replay_arguments", message: "boom", missingField: "x" };

function ov(decisionId: string, createdAt: string): Override {
  return { decisionId, reviewerName: "Ann", reason: "because", replacementResult: "approved", createdAt };
}

async function ready(): Promise<{ state: CaseState; original: Trace }> {
  const original = await trace();
  const action: Action = {
    type: "case_ready",
    sessionId: "s1",
    origin: { kind: "recorded", caseId: "greenhouse" },
    original,
  };
  return { state: reducer(initialState, action) as CaseState, original };
}

describe("reducer", () => {
  it("load_started and load_failed move the start screen", () => {
    const busy = reducer(initialState, { type: "load_started" });
    expect(busy).toEqual({ screen: "start", busy: true, error: null });
    const failed = reducer(busy, { type: "load_failed", error: { kind: "core", error: err } });
    expect(failed).toEqual({ screen: "start", busy: false, error: { kind: "core", error: err } });
  });

  it("case_ready selects v1 and starts with X-RAY off and no accusation", async () => {
    const { state, original } = await ready();
    expect(state.screen).toBe("case");
    expect(state.selected).toBe("v1");
    expect(state.xray).toBe(false);
    expect(state.accusation).toBeNull();
    expect(state.selectedSuspectId).toBeNull();
    expect(state.overrides).toEqual([]);
    expect(state.replays).toEqual({ v1: original });
    expect(state.notice).toBeNull();
    expect(introPhaseFor(state.xray)).toBe("idle");
    expect(introPhaseFor(true)).toBe("running");
  });

  it("suspect_selected and xray_toggled change only their field", async () => {
    const { state } = await ready();
    const sel = reducer(state, { type: "suspect_selected", suspectId: "widow" }) as CaseState;
    expect(sel.selectedSuspectId).toBe("widow");
    const tog = reducer(sel, { type: "xray_toggled" }) as CaseState;
    expect(tog.xray).toBe(true);
    expect((reducer(tog, { type: "xray_toggled" }) as CaseState).xray).toBe(false);
  });

  it("accused stores the record and turns X-RAY on in the same transition", async () => {
    const { state } = await ready();
    const record = {
      decisionId: "d",
      ruleSetVersion: "1.0.0",
      suspectId: "widow",
      verdict: "correct" as const,
      proofRuleIds: [],
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    const next = reducer(state, { type: "accused", record }) as CaseState;
    expect(next.accusation).toBe(record);
    expect(next.xray).toBe(true);
    const turned = reducer(next, { type: "version_selected", label: "v2" }) as CaseState;
    expect(turned.accusation).toBe(record);
  });

  it("replay_stored never replaces v1; replay_failed keeps the Trace and sets a notice", async () => {
    const { state, original } = await ready();
    const other = await trace();
    const kept = reducer(state, { type: "replay_stored", label: "v1", trace: other }) as CaseState;
    expect(kept.replays.v1).toBe(original);
    const v2 = reducer(state, { type: "replay_stored", label: "v2", trace: other }) as CaseState;
    expect(v2.selected).toBe("v2");
    expect(displayedTrace(v2)).toBe(other);
    expect(replayNote(v2)).toBe("Replayed with v2");
    const failed = reducer(v2, { type: "notice", notice: { kind: "replay_failed", error: err } }) as CaseState;
    expect(failed.selected).toBe("v2");
    expect(failed.notice).toEqual({ kind: "replay_failed", error: err });
    expect((reducer(failed, { type: "version_selected", label: "v1" }) as CaseState).notice).toBeNull();
  });

  it("override_added appends; effectiveView follows the latest linked override", async () => {
    const { state, original } = await ready();
    expect(effectiveView(state)).toBeNull();
    const a = reducer(state, { type: "override_added", override: ov(original.decisionId, "2024-01-01T00:00:00.000Z") }) as CaseState;
    const b = reducer(a, { type: "override_added", override: ov("other", "2025-01-01T00:00:00.000Z") }) as CaseState;
    expect(b.overrides).toHaveLength(2);
    expect(linkedOverrides(b)).toHaveLength(1);
    expect(effectiveView(b)).toEqual({ result: "approved", reviewerName: "Ann" });
  });

  it("two overrides with the same createdAt give ambiguous_override", async () => {
    const { state, original } = await ready();
    const t = "2024-01-01T00:00:00.000Z";
    const a = reducer(state, { type: "override_added", override: ov(original.decisionId, t) }) as CaseState;
    const b = reducer(a, { type: "override_added", override: ov(original.decisionId, t) }) as CaseState;
    const view = effectiveView(b);
    expect(view !== null && isCoreError(view) && view.kind).toBe("ambiguous_override");
  });

  it("reset returns to start; case actions on the start screen are ignored", async () => {
    const { state } = await ready();
    expect(reducer(state, { type: "reset" })).toBe(initialState);
    expect(reducer(initialState, { type: "xray_toggled" })).toBe(initialState);
    expect(reducer(initialState, { type: "accused", record: {} as never })).toBe(initialState);
  });
});
