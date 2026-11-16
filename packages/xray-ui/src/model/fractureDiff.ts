/**
 * Bone key for the fracture diff: `${ruleId}:${index}`.
 * Pure: no I/O, no time, no randomness.
 */
export function boneKey(ruleId: string, index: number): string {
  return `${ruleId}:${index}`;
}

/**
 * Keys that are fractured in `next` and were not fractured in `prev`,
 * in the iteration order of `next`. Only these play the Fracture_Moment.
 */
export function newlyFractured(
  prev: ReadonlySet<string>,
  next: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  for (const key of next) {
    if (!prev.has(key)) out.push(key);
  }
  return out;
}
