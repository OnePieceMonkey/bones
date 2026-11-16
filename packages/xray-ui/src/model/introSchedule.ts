/**
 * Pure intro timeline. No clock, no randomness.
 * All values are milliseconds from the intro start.
 */
export const INTRO = {
  FLICKER_MS: 350,
  CONE_FROM: 250,
  CONE_TO: 800,
  SWEEP_FROM: 800,
  SWEEP_TO: 1500,
  LIGHT_FROM: 1500,
  LIGHT_WINDOW: 800,
  MAX_STEP: 250,
  LIGHT_MS: 400,
  FRACTURE_MS: 1200,
  MAX_END: 3500,
} as const;

export interface IntroSchedule {
  /** Start time of each hotspot, in the order given. */
  readonly starts: readonly number[];
  /** Time at which every step, including fracture moments, is complete. */
  readonly endMs: number;
}

/**
 * @param fractured one flag per hotspot, in Trace evaluation order.
 */
export function introSchedule(fractured: readonly boolean[]): IntroSchedule {
  const n = fractured.length;
  if (n === 0) return { starts: [], endMs: 0 };
  const step = n <= 1 ? 0 : Math.min(INTRO.MAX_STEP, Math.floor(INTRO.LIGHT_WINDOW / (n - 1)));
  const starts: number[] = [];
  let endMs = 0;
  for (let i = 0; i < n; i++) {
    const start = INTRO.LIGHT_FROM + i * step;
    starts.push(start);
    const end = start + (fractured[i] ? INTRO.FRACTURE_MS : INTRO.LIGHT_MS);
    if (end > endMs) endMs = end;
  }
  return { starts, endMs };
}
