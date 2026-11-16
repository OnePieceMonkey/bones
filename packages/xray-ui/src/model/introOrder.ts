import type { BoneView, Trace } from "../types";
import { introSchedule } from "./introSchedule";
import type { IntroSchedule } from "./introSchedule";

/**
 * Bones in the evaluation order of the Trace: sorted by the index of the first
 * `ruleOutcomes` entry with the same rule id. Bones without an outcome
 * (not applicable) come last, in anatomy order. The sort is stable.
 */
export function evaluationOrder(bones: readonly BoneView[], trace: Trace): BoneView[] {
  const firstIndex = new Map<string, number>();
  trace.ruleOutcomes.forEach((o, i) => {
    if (!firstIndex.has(o.ruleId)) firstIndex.set(o.ruleId, i);
  });
  const rank = (b: BoneView): number => firstIndex.get(b.ruleId) ?? Number.POSITIVE_INFINITY;
  return bones
    .map((bone, pos) => ({ bone, pos }))
    .sort((a, b) => {
      const ra = rank(a.bone);
      const rb = rank(b.bone);
      if (ra !== rb) return ra < rb ? -1 : 1;
      return a.pos - b.pos;
    })
    .map((e) => e.bone);
}

export interface IntroPlan {
  schedule: IntroSchedule;
  /** Light-up start per bone, keyed by the bone object. */
  startOf: ReadonlyMap<BoneView, number>;
}

/** Intro schedule for the bones of one trace, in evaluation order. */
export function introPlan(bones: readonly BoneView[], trace: Trace): IntroPlan {
  const order = evaluationOrder(bones, trace);
  const schedule = introSchedule(order.map((b) => b.state === "fractured"));
  const startOf = new Map<BoneView, number>();
  order.forEach((b, i) => startOf.set(b, schedule.starts[i] ?? 0));
  return { schedule, startOf };
}
