import { effectiveResult, isCoreError } from "@bones/core";
import type { CoreError, DecisionResult, Override, Trace } from "@bones/core";
import { isRuleFields } from "../pipeline/toRuleFields";
import type { DecisionState, Origin } from "./reducer";

export type EffectiveView = { result: DecisionResult; reviewerName: string };

export function displayedTrace(s: DecisionState): Trace {
  return s.replays[s.selected] ?? s.original;
}

/** `null` for v1 (the Original_Trace), otherwise "Replayed with vN". */
export function replayNote(s: DecisionState): string | null {
  return s.selected === "v1" ? null : `Replayed with ${s.selected}`;
}

/** Only overrides of the displayed Trace; core `effectiveResult` does not filter by decisionId. */
export function linkedOverrides(s: DecisionState): Override[] {
  const id = displayedTrace(s).decisionId;
  return s.overrides.filter((o) => o.decisionId === id);
}

export function effectiveView(s: DecisionState): EffectiveView | CoreError | null {
  const linked = linkedOverrides(s);
  if (linked.length === 0) return null;
  const trace = displayedTrace(s);
  const result = effectiveResult(trace, linked);
  if (isCoreError(result)) return result;
  let latest = linked[0] as Override;
  for (const o of linked) {
    if (Date.parse(o.createdAt) > Date.parse(latest.createdAt)) latest = o;
  }
  return { result, reviewerName: latest.reviewerName };
}

/** Claimed total in cents of the trace's validated fields; 0 when the shape is invalid. */
export function claimedCentsOf(trace: Trace): number {
  const fields: unknown = trace.validatedFields;
  return isRuleFields(fields) ? fields.claimedTotalCents : 0;
}

export function titlePlate(origin: Origin | null, mode?: "recorded" | "live"): string {
  const m = mode ?? (origin !== null && origin.kind === "live" ? "live" : "recorded");
  return `Expense Auditor - ${m === "live" ? "LIVE" : "RECORDED"}`;
}
