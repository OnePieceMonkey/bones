import { isCoreError, override as coreOverride } from "@bones/core";
import type { CoreError } from "@bones/core";
import { describe, expect, it } from "vitest";
import type { RecordedCaseId } from "../../src/extraction/samples";
import { makePortFactory } from "../../src/pipeline/ports";
import { replayCase } from "../../src/pipeline/replayCase";
import { createSessionStore } from "../../src/state/sessionStore";
import type { SessionDeps, SessionStore } from "../../src/state/sessionStore";
import type { CaseState } from "../../src/state/reducer";
import { displayedTrace, effectiveView } from "../../src/state/selectors";
import { counterPorts } from "../helpers/fakes";
import type { RuleBundle } from "../../src/rules/catalog";
import { loadTestBundle, readRecorded } from "../helpers/fixtures";

const loaded = loadTestBundle();
if (isCoreError(loaded)) throw new Error(JSON.stringify(loaded));
const bundle: RuleBundle = loaded;
const cases = readRecorded().map((r) => r.json);

function make(over: Partial<SessionDeps> = {}): SessionStore {
  return createSessionStore({
    bundle,
    cases,
    portFactory: makePortFactory(counterPorts()),
    sha256: async () => "b".repeat(64),
    replayFn: replayCase,
    overrideFn: coreOverride,
    ...over,
  });
}

async function open(id: RecordedCaseId, over: Partial<SessionDeps> = {}): Promise<SessionStore> {
  const store = make(over);
  await store.loadRecordedCase(id);
  return store;
}

function caseState(store: SessionStore): CaseState {
  const s = store.getState();
  if (s.screen !== "case") throw new Error("no case open");
  return s;
}

const form = (replacementResult: "approved" | "rejected") => ({
  reviewerName: "Ann",
  reason: "because",
  replacementResult,
});

describe("sessionStore", () => {
  it("loads a recorded case with v1, X-RAY off and no accusation", async () => {
    const store = await open("greenhouse");
    const s = caseState(store);
    expect(s.origin).toEqual({ kind: "recorded", caseId: "greenhouse" });
    expect(s.selected).toBe("v1");
    expect(s.xray).toBe(false);
    expect(s.accusation).toBeNull();
  });

  it("stays on the start screen with an error for an unknown case", async () => {
    const store = await open("greenhouse", { cases: [] });
    const s = store.getState();
    expect(s.screen).toBe("start");
    expect(s.screen === "start" && s.error?.error.kind).toBe("fixture_not_found");
  });

  it("toggleXray and selectSuspect update the state", async () => {
    const store = await open("greenhouse");
    store.toggleXray();
    expect(caseState(store).xray).toBe(true);
    store.selectSuspect("widow");
    expect(caseState(store).selectedSuspectId).toBe("widow");
  });

  it("accuse turns X-RAY on in the same transition and records the verdict", async () => {
    const store = await open("greenhouse");
    expect(store.accuse("widow")).toEqual({ ok: true });
    const s = caseState(store);
    expect(s.xray).toBe(true);
    expect(s.accusation?.verdict).toBe("correct");
    expect(s.accusation?.suspectId).toBe("widow");
  });

  it("accuse records an incorrect verdict for a suspect who cannot be convicted", async () => {
    const store = await open("greenhouse");
    const suspects = (displayedTrace(caseState(store)).validatedFields as { suspects: { id: string }[] }).suspects;
    const other = suspects.find((x) => x.id !== "widow")!.id;
    expect(store.accuse(other)).toEqual({ ok: true });
    expect(caseState(store).accusation?.verdict).toBe("incorrect");
  });

  it("accuse refuses an unknown suspect and keeps X-RAY off", async () => {
    const store = await open("greenhouse");
    const out = store.accuse("nobody");
    expect(out.ok).toBe(false);
    expect(caseState(store).xray).toBe(false);
    expect(caseState(store).accusation).toBeNull();
  });

  it("accuse is refused while the effective result is rejected", async () => {
    const store = await open("candlesticks");
    expect(displayedTrace(caseState(store)).result).toBe("rejected");
    const out = store.accuse("ada");
    expect(out).toMatchObject({ ok: false, reason: "rejected" });
    expect(caseState(store).accusation).toBeNull();
    expect(caseState(store).xray).toBe(false);
  });

  it("an override to approved of a rejected Trace allows accuse", async () => {
    const store = await open("candlesticks");
    expect(store.submitOverride(form("approved"))).toEqual({ ok: true });
    expect(store.accuse("ada")).toEqual({ ok: true });
    expect(caseState(store).accusation?.suspectId).toBe("ada");
  });

  it("an override to rejected of an approved Trace blocks accuse", async () => {
    const store = await open("greenhouse");
    expect(store.submitOverride(form("rejected"))).toEqual({ ok: true });
    expect(store.accuse("widow")).toMatchObject({ ok: false, reason: "rejected" });
    expect(caseState(store).accusation).toBeNull();
  });

  it("turning the knob after an accusation keeps the record", async () => {
    const store = await open("candlesticks");
    store.selectVersion("v2");
    expect(store.accuse("ada")).toEqual({ ok: true });
    const record = caseState(store).accusation;
    store.selectVersion("v3");
    store.selectVersion("v1");
    expect(caseState(store).accusation).toBe(record);
  });

  it("selectVersion replays once and then reuses the cached Trace", async () => {
    let calls = 0;
    const store = await open("greenhouse", {
      replayFn: (a) => {
        calls += 1;
        return replayCase(a);
      },
    });
    store.selectVersion("v2");
    const first = displayedTrace(caseState(store));
    store.selectVersion("v1");
    store.selectVersion("v2");
    expect(displayedTrace(caseState(store))).toBe(first);
    expect(calls).toBe(1);
    expect(first.ruleSetVersion).toBe("2.0.0");
  });

  it("a replay failure keeps the previous Trace and sets a notice", async () => {
    const failure: CoreError = { kind: "rule_not_found", message: "gone", ruleId: "r", ruleVersion: "1" };
    const store = await open("greenhouse", { replayFn: () => failure });
    const before = displayedTrace(caseState(store));
    store.selectVersion("v2");
    const s = caseState(store);
    expect(s.selected).toBe("v1");
    expect(displayedTrace(s)).toBe(before);
    expect(s.notice).toEqual({ kind: "replay_failed", error: failure });
    store.clearNotice();
    expect(caseState(store).notice).toBeNull();
  });

  it("reset discards everything and returns to start", async () => {
    const store = await open("greenhouse");
    store.accuse("widow");
    store.submitOverride(form("approved"));
    store.reset();
    expect(store.getState()).toEqual({ screen: "start", busy: false, error: null });
  });

  it("override form errors name the field", async () => {
    const store = await open("greenhouse");
    expect(store.submitOverride({ ...form("approved"), reviewerName: "   " })).toMatchObject({
      ok: false,
      field: "reviewerName",
    });
    expect(store.submitOverride({ ...form("approved"), reason: "" })).toMatchObject({ ok: false, field: "reason" });
    expect(store.submitOverride({ ...form("approved"), reason: "x".repeat(501) })).toMatchObject({
      ok: false,
      field: "reason",
    });
    expect(store.submitOverride({ ...form("approved"), reason: "x".repeat(500) })).toEqual({ ok: true });
    expect(caseState(store).overrides).toHaveLength(1);
  });

  it("submitOverride without an open case fails without throwing", () => {
    expect(make().submitOverride(form("approved"))).toMatchObject({ ok: false });
  });

  it("two overrides never share createdAt, even with a frozen wall clock", async () => {
    const store = await open("greenhouse", { portFactory: makePortFactory({ now: () => 5_000, uuid: () => "id" }) });
    store.submitOverride(form("rejected"));
    store.submitOverride(form("approved"));
    const s = caseState(store);
    expect(new Set(s.overrides.map((o) => o.createdAt)).size).toBe(2);
    const view = effectiveView(s);
    expect(view !== null && !isCoreError(view) && view.result).toBe("approved");
  });

  it("the original Trace is the same frozen object after overrides", async () => {
    const store = await open("greenhouse");
    const original = caseState(store).original;
    const copy = structuredClone(original);
    store.submitOverride(form("rejected"));
    expect(caseState(store).original).toBe(original);
    expect(original).toEqual(copy);
  });

  it("notifies subscribers and stops after unsubscribe", async () => {
    const store = await open("greenhouse");
    let n = 0;
    const off = store.subscribe(() => (n += 1));
    store.toggleXray();
    off();
    store.toggleXray();
    expect(n).toBe(1);
  });
});
