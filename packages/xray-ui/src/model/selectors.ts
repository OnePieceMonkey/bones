import type { RuleOutcome } from "@bones/core";
import type {
  Anatomy,
  BoneView,
  EvidenceRow,
  FieldView,
  Region,
  SourceMark,
  Trace,
} from "../types";
import { REGIONS } from "../types";
import { safeFormat } from "./format";
import { splinters } from "./hash";
import { layoutBone } from "./skeletonLayout";

type FractureFields = Pick<
  RuleOutcome,
  "conditionMet" | "effect" | "amountBeforeCents" | "amountAfterCents"
>;

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

/**
 * A bone is fractured only when its rule changed the decision:
 * a blocking rule that fired, or a capping/deducting rule that lowered the amount.
 */
export function isFracture(o: FractureFields): boolean {
  if (o.conditionMet !== true) return false;
  if (o.effect === "blocking") return true;
  if (o.effect === "capping" || o.effect === "deducting") {
    return (
      o.amountBeforeCents !== undefined &&
      o.amountAfterCents !== undefined &&
      o.amountAfterCents < o.amountBeforeCents
    );
  }
  return false;
}

/** Capping/deducting rule that fired but did not lower the amount. */
export function isAppliedNoChange(o: FractureFields): boolean {
  return (
    o.conditionMet === true &&
    (o.effect === "capping" || o.effect === "deducting") &&
    !isFracture(o)
  );
}

export function stateText(bone: Pick<BoneView, "state" | "outcome">): string {
  if (bone.state === "fractured") return "fractured";
  if (bone.state === "not-applicable") return "not applicable";
  return bone.outcome !== undefined && isAppliedNoChange(bone.outcome)
    ? "applied, no change"
    : "passed";
}

/** Anatomy label for a field path; own-property check so "constructor" etc. do not resolve. */
export function fieldLabel(anatomy: Anatomy, path: string): string {
  return hasOwn(anatomy.fieldLabels, path)
    ? (anatomy.fieldLabels[path] as string)
    : path;
}

function normaliseRegion(region: string): Region {
  return (REGIONS as readonly string[]).includes(region) ? (region as Region) : "spine";
}

export function selectBones(trace: Trace, anatomy: Anatomy): BoneView[] {
  const outcomeById = new Map<string, RuleOutcome>();
  for (const o of trace.ruleOutcomes) {
    if (!outcomeById.has(o.ruleId)) outcomeById.set(o.ruleId, o);
  }

  const regions = anatomy.bones.map((b) => normaliseRegion(b.region));
  const totals = new Map<Region, number>();
  for (const r of regions) totals.set(r, (totals.get(r) ?? 0) + 1);
  const seen = new Map<Region, number>();

  return anatomy.bones.map((entry, index) => {
    const region = regions[index] as Region;
    const indexInRegion = seen.get(region) ?? 0;
    seen.set(region, indexInRegion + 1);
    const outcome = outcomeById.get(entry.ruleId);
    const state: BoneView["state"] =
      outcome === undefined ? "not-applicable" : isFracture(outcome) ? "fractured" : "passed";
    const view: BoneView = {
      ruleId: entry.ruleId,
      label: entry.label,
      region,
      index,
      state,
      version: outcome === undefined ? null : outcome.ruleVersion,
      position: layoutBone(region, indexInRegion, totals.get(region) ?? 1),
      splinters: state === "fractured" ? splinters(entry.ruleId) : [],
    };
    if (outcome !== undefined) view.outcome = outcome;
    return view;
  });
}

export function evidenceRows(outcome: RuleOutcome, anatomy: Anatomy): EvidenceRow[] {
  const format = safeFormat(anatomy);
  return Object.entries(outcome.evidence).map(([path, value]) => ({
    path,
    label: fieldLabel(anatomy, path),
    value: format(path, value),
  }));
}

export function relatedFields(bone: BoneView): string[] {
  return bone.outcome ? Object.keys(bone.outcome.evidence) : [];
}

export function relatedBones(fieldPath: string, bones: readonly BoneView[]): BoneView[] {
  return bones.filter((b) => b.outcome !== undefined && hasOwn(b.outcome.evidence, fieldPath));
}

export function overruledFields(
  trace: Trace,
  bones: readonly BoneView[],
): Map<string, BoneView[]> {
  const map = new Map<string, BoneView[]>();
  for (const bone of bones) {
    if (bone.state !== "fractured") continue;
    for (const key of relatedFields(bone)) {
      if (!hasOwn(trace.proposedFields, key)) continue;
      const list = map.get(key);
      if (list) list.push(bone);
      else map.set(key, [bone]);
    }
  }
  return map;
}

export function fieldViews(
  trace: Trace,
  anatomy: Anatomy,
  bones: readonly BoneView[],
): FieldView[] {
  const format = safeFormat(anatomy);
  const overruled = overruledFields(trace, bones);
  return Object.entries(trace.proposedFields).map(([path, value]) => {
    const c: unknown = hasOwn(trace.confidence, path) ? trace.confidence[path] : undefined;
    const by = overruled.get(path);
    return {
      path,
      label: fieldLabel(anatomy, path),
      value: format(path, value),
      confidenceText: typeof c === "number" && Number.isFinite(c) ? c.toFixed(2) : "n/a",
      overruled: by !== undefined,
      overruledBy: by ? by.map((b) => b.label) : [],
    };
  });
}

export function sourceMarks(
  trace: Trace,
  anatomy: Anatomy,
  active: BoneView | undefined,
): SourceMark[] {
  const related = active ? relatedFields(active) : [];
  const marks: SourceMark[] = [];
  for (const [path, location] of Object.entries(trace.sources)) {
    if (location === undefined) continue;
    marks.push({
      path,
      label: fieldLabel(anatomy, path),
      tag: String(marks.length + 1),
      location,
      highlighted: active !== undefined && related.includes(path),
    });
  }
  return marks;
}

export function countPassed(bones: readonly BoneView[]): number {
  return bones.filter((b) => b.state === "passed").length;
}
