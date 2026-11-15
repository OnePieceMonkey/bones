/** Intro sequence: the film is shown with X-ray off, then flips on after a short delay. */
export const INTRO_DELAY_MS = 600;

export interface IntroState {
  xray: boolean;
  pending: boolean;
}

export type IntroEvent =
  | { type: "shown"; reducedMotion: boolean }
  | { type: "timer" }
  | { type: "user"; xray: boolean };

export function introReducer(s: IntroState, e: IntroEvent): IntroState {
  switch (e.type) {
    case "shown":
      return e.reducedMotion ? { xray: true, pending: false } : { xray: false, pending: true };
    case "timer":
      return s.pending ? { xray: true, pending: false } : s;
    case "user":
      return { xray: e.xray, pending: false };
  }
}
