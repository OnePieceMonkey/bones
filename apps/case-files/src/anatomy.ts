import type { Anatomy, AnatomyBone, Region } from "@bones/xray-ui";
import type { DerivedCase, DerivedSuspect } from "./derive/factDeriver";
import { makeFormatValue } from "./format/formatValue";

/**
 * Anatomy_Builder. Pure. Bone regions follow D18: skull = motive, arm-right = means,
 * leg-right = opportunity, statement N on ribs, spine, arm-left, pelvis, leg-left.
 * Rule ids are the instance ids of the Rule_Binder. Labels come from fixed templates.
 */

export const MAX_LABEL = 40;

const STATEMENT_REGIONS: readonly Region[] = ["ribs", "spine", "arm-left", "pelvis", "leg-left"];

/** Shortens `name` so that `name + suffix` has at most MAX_LABEL characters. */
export function truncateName(name: string, suffix: string): string {
  const room = Math.max(0, MAX_LABEL - suffix.length);
  return name.length <= room ? name : name.slice(0, room).trimEnd();
}

/**
 * Suspect names in the case data carry their own article ("the widow"). The labels are wrapped in
 * sentences by Dr. Bones ("a fracture in the <label> bone"), so the article is dropped here and the
 * name is capitalised. The article then appears once.
 */
export function labelName(name: string): string {
  const bare = name.replace(/^(the|a|an)\s+/i, "").trim();
  if (bare === "") return name;
  return `${bare.charAt(0).toUpperCase()}${bare.slice(1)}`;
}
const label = (name: string, suffix: string): string => `${truncateName(name, suffix)}${suffix}`;

/** Labels for the generic derived paths and the case fields. */
const BASE_LABELS: Record<string, string> = {
  title: "Title",
  setting: "Setting",
  victim: "Victim",
  crime: "Crime",
  meansAny: "Means clues",
  meansFirm: "Firm means clues",
  opportunityAny: "Opportunity clues",
  opportunityFirm: "Firm opportunity clues",
  motiveAny: "Motive clues",
  motiveFirm: "Firm motive clues",
  conflictsAny: "Conflicting clues",
  conflictsFirm: "Firm conflicting clues",
  authorName: "Author",
};

const SUSPECT_PATHS = [
  "meansAny",
  "meansFirm",
  "opportunityAny",
  "opportunityFirm",
  "motiveAny",
  "motiveFirm",
] as const;
const STATEMENT_PATHS = ["conflictsAny", "conflictsFirm", "authorName"] as const;

function buildFieldLabels(derivedCase: DerivedCase): Record<string, string> {
  const labels: Record<string, string> = { ...BASE_LABELS };
  derivedCase.suspects.forEach((s, i) => {
    for (const p of SUSPECT_PATHS) labels[`suspects.${i}.${p}`] = `${truncateName(labelName(s.name), ` ${BASE_LABELS[p]}`)} ${BASE_LABELS[p]}`;
    s.statements.forEach((_st, j) => {
      for (const p of STATEMENT_PATHS) {
        const text = `Statement ${j + 1}: ${BASE_LABELS[p]}`;
        labels[`suspects.${i}.statements.${j}.${p}`] = `${truncateName(labelName(s.name), ` ${text}`)} ${text}`;
      }
    });
  });
  return labels;
}

export function buildCombinedAnatomy(derivedCase: DerivedCase): Anatomy {
  const bones: AnatomyBone[] = [];
  for (const s of derivedCase.suspects) {
    bones.push({ ruleId: `proof-motive:${s.id}`, label: label(labelName(s.name), ": Motive"), region: "skull" });
    bones.push({ ruleId: `proof-means:${s.id}`, label: label(labelName(s.name), ": Means"), region: "arm-right" });
    bones.push({ ruleId: `proof-opportunity:${s.id}`, label: label(labelName(s.name), ": Opportunity"), region: "leg-right" });
    s.statements.forEach((st, j) => {
      bones.push({
        ruleId: `statement-${st.kind}-contradicted:${st.id}`,
        label: label(labelName(s.name), `: Statement ${j + 1}`),
        region: STATEMENT_REGIONS[j] ?? "ribs",
      });
    });
  }
  return {
    bones,
    fieldLabels: buildFieldLabels(derivedCase),
    formatValue: makeFormatValue({ places: derivedCase.places, items: derivedCase.items }),
  };
}

/** The bones of one suspect: three proof bones and one bone per statement, matched by exact rule id. */
export function buildSuspectAnatomy(combined: Anatomy, suspect: DerivedSuspect): Anatomy {
  const own = new Set<string>([
    `proof-motive:${suspect.id}`,
    `proof-means:${suspect.id}`,
    `proof-opportunity:${suspect.id}`,
    ...suspect.statements.map((st) => `statement-${st.kind}-contradicted:${st.id}`),
  ]);
  return { ...combined, bones: combined.bones.filter((b) => own.has(b.ruleId)) };
}
