import type { CoreError, Override, Trace } from "@bones/core";
import type { FilmSource } from "@bones/xray-ui";
import type { SampleId, TripWindow } from "../extraction/samples";
import { initialReplayStore, putReplay } from "../pipeline/replayStore";
import type { ReplayStore } from "../pipeline/replayStore";
import type { VersionLabel } from "../rules/catalog";
import { introReducer } from "./intro";
import type { IntroEvent, IntroState } from "./intro";

export type Origin =
  | { kind: "sample"; sampleId: SampleId }
  | { kind: "live"; fileName: string };

export type UploadProblem = { reason: "type" | "too_large" | "unreadable"; message: string };

export type StartError =
  | { kind: "core"; error: CoreError }
  | { kind: "upload"; problem: UploadProblem };

export type DecisionNotice = { kind: "replay_failed" | "effective_failed"; error: CoreError };

export interface StartState {
  screen: "start";
  busy: boolean;
  error: StartError | null;
}

export interface DecisionState {
  screen: "decision";
  /** Remount key for DecisionView. */
  sessionId: string;
  origin: Origin;
  trip: TripWindow;
  source: FilmSource;
  /** Always the v1 Trace. */
  original: Trace;
  replays: ReplayStore;
  selected: VersionLabel;
  overrides: readonly Override[];
  intro: IntroState;
  notice: DecisionNotice | null;
}

export type AppState = StartState | DecisionState;

export type Action =
  | { type: "load_started" }
  | { type: "load_failed"; error: StartError }
  | {
      type: "decision_ready";
      sessionId: string;
      origin: Origin;
      trip: TripWindow;
      source: FilmSource;
      original: Trace;
      reducedMotion: boolean;
    }
  | { type: "replay_stored"; label: VersionLabel; trace: Trace }
  | { type: "version_selected"; label: VersionLabel }
  | { type: "replay_failed"; error: CoreError }
  | { type: "override_added"; override: Override }
  | { type: "intro"; event: IntroEvent }
  | { type: "notice_cleared" }
  | { type: "reset" };

export const initialState: StartState = { screen: "start", busy: false, error: null };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "load_started":
      return state.screen === "start" ? { screen: "start", busy: true, error: null } : state;
    case "load_failed":
      return state.screen === "start"
        ? { screen: "start", busy: false, error: action.error }
        : state;
    case "decision_ready":
      return {
        screen: "decision",
        sessionId: action.sessionId,
        origin: action.origin,
        trip: action.trip,
        source: action.source,
        original: action.original,
        replays: initialReplayStore(action.original),
        selected: "v1",
        overrides: [],
        intro: introReducer(
          { xray: false, pending: false },
          { type: "shown", reducedMotion: action.reducedMotion },
        ),
        notice: null,
      };
    case "reset":
      return initialState;
    default:
      break;
  }
  if (state.screen !== "decision") return state;
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
    case "replay_failed":
      return { ...state, notice: { kind: "replay_failed", error: action.error } };
    case "override_added":
      return { ...state, overrides: [...state.overrides, action.override] };
    case "intro":
      return { ...state, intro: introReducer(state.intro, action.event) };
    case "notice_cleared":
      return state.notice === null ? state : { ...state, notice: null };
    default:
      return state;
  }
}
