import { useSyncExternalStore } from "react";
import { isCoreError, override as coreOverride } from "@bones/core";
import type { CoreError, DecisionResult, override } from "@bones/core";
import { RecordedCaseAdapter } from "../extraction/RecordedCaseAdapter";
import { RECORDED_CASES } from "../extraction/samples";
import type { RecordedCaseId } from "../extraction/samples";
import { sha256Hex } from "../pipeline/hash";
import { makePortFactory } from "../pipeline/ports";
import type { PortFactory } from "../pipeline/ports";
import { replayCase, verdictOf } from "../pipeline/replayCase";
import { runCasePipeline } from "../pipeline/runCasePipeline";
import { loadBundle } from "../rules/catalog";
import type { RuleBundle, VersionLabel } from "../rules/catalog";
import { computeAccusation } from "./accusation";
import { initialState, reducer } from "./reducer";
import type { Action, AppState } from "./reducer";
import { displayedTrace, effectiveView } from "./selectors";

export interface SessionDeps {
  bundle: RuleBundle;
  cases: readonly unknown[];
  portFactory: PortFactory;
  sha256: (bytes: Uint8Array) => Promise<string>;
  replayFn: typeof replayCase;
  overrideFn: typeof override;
}

export interface OverrideForm {
  reviewerName: string;
  reason: string;
  replacementResult: DecisionResult;
}

export type OverrideOutcome =
  | { ok: true }
  | { ok: false; field: "reviewerName" | "reason"; message: string };

export type AccuseOutcome =
  | { ok: true }
  | { ok: false; reason: "no_case" | "rejected" | "unknown_suspect" | "verdict_failed"; message: string };

export interface SessionStore {
  getState(): AppState;
  subscribe(listener: () => void): () => void;
  loadRecordedCase(id: RecordedCaseId): Promise<void>;
  selectVersion(label: VersionLabel): void;
  selectSuspect(suspectId: string | null): void;
  toggleXray(): void;
  accuse(suspectId: string): AccuseOutcome;
  submitOverride(form: OverrideForm): OverrideOutcome;
  clearNotice(): void;
  reset(): void;
}

function thrown(e: unknown): CoreError {
  return {
    kind: "extraction_failed",
    message: `Unexpected failure: ${e instanceof Error ? e.message : String(e)}`,
    reason: "upstream",
  };
}

export function createSessionStore(deps: SessionDeps): SessionStore {
  let state: AppState = initialState;
  let sessionCounter = 0;
  const listeners = new Set<() => void>();

  const dispatch = (action: Action): void => {
    const next = reducer(state, action);
    if (next === state) return;
    state = next;
    for (const l of [...listeners]) l();
  };

  const fail = (error: CoreError): void => dispatch({ type: "load_failed", error: { kind: "core", error } });

  async function loadRecordedCase(id: RecordedCaseId): Promise<void> {
    dispatch({ type: "load_started" });
    try {
      const result = await runCasePipeline({
        input: { raw: id },
        adapter: new RecordedCaseAdapter(id, deps.cases),
        versionLabel: "v1",
        bundle: deps.bundle,
        portFactory: deps.portFactory,
        sha256: deps.sha256,
      });
      if (isCoreError(result)) return fail(result);
      sessionCounter += 1;
      dispatch({
        type: "case_ready",
        sessionId: `session-${sessionCounter}`,
        origin: { kind: "recorded", caseId: id },
        original: result,
      });
    } catch (e) {
      fail(thrown(e));
    }
  }

  function selectVersion(label: VersionLabel): void {
    if (state.screen !== "case") return;
    if (state.replays[label] !== undefined) {
      dispatch({ type: "version_selected", label });
      return;
    }
    let outcome;
    try {
      outcome = deps.replayFn({
        original: state.original,
        label,
        bundle: deps.bundle,
        ports: deps.portFactory.base,
      });
    } catch (e) {
      outcome = thrown(e);
    }
    // On a CoreError the previous Trace stays displayed and a notice is set.
    if (isCoreError(outcome)) dispatch({ type: "notice", notice: { kind: "replay_failed", error: outcome } });
    else dispatch({ type: "replay_stored", label, trace: outcome });
  }

  function accuse(suspectId: string): AccuseOutcome {
    if (state.screen !== "case") return { ok: false, reason: "no_case", message: "No case is open" };
    const trace = displayedTrace(state);
    const view = effectiveView(state);
    let effective: DecisionResult = trace.result;
    if (view !== null) {
      if (isCoreError(view)) {
        // Ambiguous overrides: keep the rule result.
        dispatch({ type: "notice", notice: { kind: "effective_failed", error: view } });
      } else {
        effective = view.result;
      }
    }
    if (effective === "rejected") {
      return { ok: false, reason: "rejected", message: "A rejected case cannot be accused" };
    }
    const verdict = verdictOf(trace, deps.bundle);
    if (isCoreError(verdict)) return { ok: false, reason: "verdict_failed", message: verdict.message };
    const suspects = (trace.validatedFields as { suspects?: { id?: unknown }[] }).suspects ?? [];
    if (!suspects.some((s) => s.id === suspectId)) {
      return { ok: false, reason: "unknown_suspect", message: `Unknown suspect: ${suspectId}` };
    }
    const record = computeAccusation(trace, suspectId, verdict.convictable, deps.portFactory.base.clock);
    dispatch({ type: "accused", record });
    return { ok: true };
  }

  function submitOverride(form: OverrideForm): OverrideOutcome {
    if (state.screen !== "case") {
      return { ok: false, field: "reviewerName", message: "No case is open" };
    }
    let created;
    try {
      created = deps.overrideFn(displayedTrace(state), form, deps.portFactory.base, { app: "case-files" });
    } catch (e) {
      return { ok: false, field: "reviewerName", message: thrown(e).message };
    }
    if (isCoreError(created)) {
      if (created.kind === "invalid_override_input") {
        return { ok: false, field: created.field, message: created.message };
      }
      return { ok: false, field: "reviewerName", message: created.message };
    }
    dispatch({ type: "override_added", override: created });
    return { ok: true };
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    loadRecordedCase,
    selectVersion,
    selectSuspect: (suspectId) => dispatch({ type: "suspect_selected", suspectId }),
    toggleXray: () => dispatch({ type: "xray_toggled" }),
    accuse,
    submitOverride,
    clearNotice: () => dispatch({ type: "notice", notice: null }),
    reset: () => dispatch({ type: "reset" }),
  };
}

/** Recorded-mode session with the real ports, the bundled rules and the bundled cases. */
export function createProductionSession(
  loader: () => RuleBundle | CoreError = loadBundle,
): SessionStore | CoreError {
  const bundle = loader();
  if (isCoreError(bundle)) return bundle;
  return createSessionStore({
    bundle,
    cases: RECORDED_CASES,
    portFactory: makePortFactory(),
    sha256: sha256Hex,
    replayFn: replayCase,
    overrideFn: coreOverride,
  });
}

export function useSession(store: SessionStore): AppState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
