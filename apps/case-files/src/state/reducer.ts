import type { CoreError, Override, Trace } from "@bones/core";
import type { RecordedCaseId } from "../extraction/samples";
import { initialReplayStore, putReplay } from "../pipeline/replayStore";
import type { ReplayStore } from "../pipeline/replayStore";
import type { VersionLabel } from "../rules/catalog";
import type { AccusationRecord } from "./accusation";

export type Theme = "manor" | "train" | "university" | "lighthouse";

export type Origin = { kind: "recorded"; caseId: RecordedCaseId } | { kind: "live"; theme: Theme };

export type StartError = { kind: "core"; error: CoreError };

export type DecisionNotice = { kind: "replay_failed" | "effective_failed"; error: CoreError };

export interface StartState {
  screen: "start";
  busy: boolean;
  error: StartError | null;
}

export interface CaseState {
  screen: "case";
  /** Remount key for the case view. */
  sessionId: string;
  origin: Origin;
  /** Always the Trace of the first rule set version (v1). Never edited. */
  original: Trace;
  replays: ReplayStore;
  selected: VersionLabel;
  overrides: readonly Override[];
  accusation: AccusationRecord | null;
  selectedSuspectId: string | null;
  /** D15: starts off. Only the toggle and an accusation turn it on. */
  xray: boolean;
  notice: DecisionNotice | null;
}

export type AppState = StartState | CaseState;

export type Action =
  | { type: "load_started" }
  | { type: "load_failed"; error: StartError }
  | { type: "case_ready"; sessionId: string; origin: Origin; original: Trace }
  | { type: "replay_stored"; label: VersionLabel; trace: Trace }
  | { type: "version_selected"; label: VersionLabel }
  | { type: "suspect_selected"; suspectId: string | null }
  | { type: "xray_toggled" }
  | { type: "accused"; record: AccusationRecord }
  | { type: "override_added"; override: Override }
  | { type: "notice"; notice: DecisionNotice | null }
  | { type: "reset" };

export const initialState: StartState = { screen: "start", busy: false, error: null };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "load_started":
      return state.screen === "start" ? { screen: "start", busy: true, error: null } : state;
    case "load_failed":
      return state.screen === "start" ? { screen: "start", busy: false, error: action.error } : state;
    case "case_ready":
      return {
        screen: "case",
        sessionId: action.sessionId,
        origin: action.origin,
        original: action.original,
        replays: initialReplayStore(action.original),
        selected: "v1",
        overrides: [],
        accusation: null,
        selectedSuspectId: null,
        xray: false,
        notice: null,
      };
    case "reset":
      return initialState;
    default:
      break;
  }
  if (state.screen !== "case") return state;
  switch (action.type) {
    case "replay_stored":
      return {
        ...state,
        replays: putReplay(state.replays, action.label, action.trace),
        selected: action.label,
        notice: null,
      };
    case "version_selected":
      return { ...state, selected: action.label, notice: null };
    case "suspect_selected":
      return state.selectedSuspectId === action.suspectId
        ? state
        : { ...state, selectedSuspectId: action.suspectId };
    case "xray_toggled":
      return { ...state, xray: !state.xray };
    case "accused":
      return { ...state, accusation: action.record, xray: true };
    case "override_added":
      return { ...state, overrides: [...state.overrides, action.override] };
    case "notice":
      return state.notice === action.notice ? state : { ...state, notice: action.notice };
    default:
      return state;
  }
}
