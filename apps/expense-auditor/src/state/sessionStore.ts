import { useSyncExternalStore } from "react";
import { isCoreError, override as coreOverride, replay as coreReplay } from "@bones/core";
import type { CoreError, DecisionResult, override, replay } from "@bones/core";
import { RecordedSampleAdapter } from "../extraction/RecordedSampleAdapter";
import { SAMPLES, sampleSchema } from "../extraction/samples";
import type { SampleId } from "../extraction/samples";
import { sha256Hex } from "../pipeline/hash";
import { makePortFactory } from "../pipeline/ports";
import type { PortFactory } from "../pipeline/ports";
import { loadBundle } from "../rules/catalog";
import { replayTrace, runPipeline } from "../pipeline/runPipeline";
import type { RuleBundle, VersionLabel } from "../pipeline/runPipeline";
import type { IntroEvent } from "./intro";
import { initialState, reducer } from "./reducer";
import type { Action, AppState } from "./reducer";
import { displayedTrace } from "./selectors";

export interface SessionDeps {
  bundle: RuleBundle;
  samples: readonly unknown[];
  portFactory: PortFactory;
  sha256: (bytes: Uint8Array) => Promise<string>;
  replayFn: typeof replay;
  overrideFn: typeof override;
  prefersReducedMotion: () => boolean;
}

export interface OverrideForm {
  reviewerName: string;
  reason: string;
  replacementResult: DecisionResult;
}

export type OverrideOutcome =
  | { ok: true }
  | { ok: false; field: "reviewerName" | "reason"; message: string };

export interface SessionStore {
  getState(): AppState;
  subscribe(listener: () => void): () => void;
  loadSample(id: SampleId): Promise<void>;
  selectVersion(label: VersionLabel): void;
  submitOverride(form: OverrideForm): OverrideOutcome;
  dispatchIntro(event: IntroEvent): void;
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

  async function loadSample(id: SampleId): Promise<void> {
    dispatch({ type: "load_started" });
    try {
      const entry = deps.samples.find(
        (s) => typeof s === "object" && s !== null && (s as { id?: unknown }).id === id,
      );
      if (entry === undefined) {
        return fail({
          kind: "fixture_not_found",
          message: `Sample not found: ${id}`,
          fixturePath: `recorded/${id}.json`,
        });
      }
      const parsed = sampleSchema.safeParse(entry);
      if (!parsed.success) {
        return fail({
          kind: "fixture_invalid",
          message: `Sample is invalid: ${id}`,
          fixturePath: `recorded/${id}.json`,
          parseError: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        });
      }
      const sample = parsed.data;
      const bytes = new TextEncoder().encode(sample.receiptText);
      const result = await runPipeline({
        input: { raw: sample.receiptText, bytes },
        adapter: new RecordedSampleAdapter(id, deps.samples),
        trip: sample.trip,
        ruleSetLabel: "v1",
        bundle: deps.bundle,
        portFactory: deps.portFactory,
        sha256: deps.sha256,
      });
      if (isCoreError(result)) return fail(result);
      sessionCounter += 1;
      dispatch({
        type: "decision_ready",
        sessionId: `session-${sessionCounter}`,
        origin: { kind: "sample", sampleId: id },
        trip: sample.trip,
        source: { kind: "text", text: sample.receiptText },
        original: result,
        reducedMotion: deps.prefersReducedMotion(),
      });
    } catch (e) {
      fail(thrown(e));
    }
  }

  function selectVersion(label: VersionLabel): void {
    if (state.screen !== "decision") return;
    if (state.replays[label] !== undefined) {
      dispatch({ type: "version_selected", label });
      return;
    }
    let outcome;
    try {
      outcome = replayTrace({
        original: state.original,
        label,
        bundle: deps.bundle,
        ports: deps.portFactory.base,
        replayFn: deps.replayFn,
      });
    } catch (e) {
      outcome = thrown(e);
    }
    if (isCoreError(outcome)) dispatch({ type: "replay_failed", error: outcome });
    else dispatch({ type: "replay_stored", label, trace: outcome });
  }

  function submitOverride(form: OverrideForm): OverrideOutcome {
    if (state.screen !== "decision") {
      return { ok: false, field: "reviewerName", message: "No decision is open" };
    }
    let created;
    try {
      created = deps.overrideFn(displayedTrace(state), form, deps.portFactory.base, {
        app: "expense-auditor",
      });
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
    loadSample,
    selectVersion,
    submitOverride,
    dispatchIntro: (event) => dispatch({ type: "intro", event }),
    clearNotice: () => dispatch({ type: "notice_cleared" }),
    reset: () => dispatch({ type: "reset" }),
  };
}

/** Recorded-mode session with the real ports, the bundled rules and the bundled samples. */
export function createProductionSession(
  loader: () => RuleBundle | CoreError = loadBundle,
): SessionStore | CoreError {
  const bundle = loader();
  if (isCoreError(bundle)) return bundle;
  return createSessionStore({
    bundle,
    samples: SAMPLES,
    portFactory: makePortFactory(),
    sha256: sha256Hex,
    replayFn: coreReplay,
    overrideFn: coreOverride,
    prefersReducedMotion: () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
}

export function useSession(store: SessionStore): AppState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
