import { SPLINTER_COUNT, hashString, nextRandom } from "./hash";

export const SPLINTER_FILE_COUNT = 8;

/** SPLINTER_COUNT distinct file indexes in 0..7, deterministic per rule id (partial Fisher-Yates). */
export function splinterAssets(ruleId: string): number[] {
  const pool = Array.from({ length: SPLINTER_FILE_COUNT }, (_, i) => i);
  let state = hashString(ruleId) || 1;
  for (let i = 0; i < SPLINTER_COUNT; i++) {
    state = nextRandom(state) || 1;
    const j = i + (state % (SPLINTER_FILE_COUNT - i));
    const tmp = pool[i] as number;
    pool[i] = pool[j] as number;
    pool[j] = tmp;
  }
  return pool.slice(0, SPLINTER_COUNT);
}
