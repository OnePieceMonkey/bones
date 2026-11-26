import type { ChatMessage } from "@bones/xray-ui";
import { RULE_SET_REFS, VERSION_LABELS } from "../rules/catalog";
import type { SolveResult, SolverReason } from "./solve";

/**
 * Closed English templates for the Solver reason, the accusation and the banner list.
 * Inputs are ids, names and version labels only. No model text, no LLM, no clock.
 */
export type NameMap = ReadonlyMap<string, string>;

/** The part of the Accusation_Record these templates read. */
export interface AccusationText {
  suspectId: string;
  verdict: "correct" | "incorrect";
}

const nameOf = (names: NameMap, id: string): string => names.get(id) ?? id;

/** "nobody", "A", "A and B", "A, B and C". */
export function joinNames(names: readonly string[]): string {
  if (names.length === 0) return "nobody";
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]!}`;
}

const MISSING_LABELS: Readonly<Record<string, string>> = {
  "proof-means": "means",
  "proof-opportunity": "opportunity",
  "proof-motive": "motive",
  "no-contradicted-statement": "a contradicted statement",
};

function missingLabel(id: string): string {
  const base = id.split(":")[0]!;
  return MISSING_LABELS[base] ?? base;
}

type Templates = {
  [C in SolverReason["code"]]: (reason: Extract<SolverReason, { code: C }>, names: NameMap, version: string) => string;
};

const REASON_TEMPLATES: Templates = {
  one: (r, names, v) => `Rule set ${v} convicts exactly one suspect: ${nameOf(names, r.suspectId)}.`,
  none: (r, names, v) => {
    const missing = r.missing.map(missingLabel);
    const tail = missing.length === 0 ? "" : ` ${nameOf(names, r.closestSuspectId)} still lacks ${joinNames(missing)}.`;
    return `Rule set ${v} cannot convict anyone, so this case is unfair.${tail}`;
  },
  many: (r, names, v) =>
    `Rule set ${v} convicts ${r.suspectIds.length} suspects: ${joinNames(r.suspectIds.map((id) => nameOf(names, id)))}. This case is unfair.`,
};

export function renderReasonTemplate(reason: SolverReason, names: NameMap, versionLabel: string): string {
  switch (reason.code) {
    case "one":
      return REASON_TEMPLATES.one(reason, names, versionLabel);
    case "none":
      return REASON_TEMPLATES.none(reason, names, versionLabel);
    case "many":
      return REASON_TEMPLATES.many(reason, names, versionLabel);
  }
}

export function renderAccusationText(accusation: AccusationText, names: NameMap): string {
  const name = nameOf(names, accusation.suspectId);
  return accusation.verdict === "correct"
    ? `Case closed: ${name} is guilty.`
    : `Wrong suspect: ${name} cannot be convicted.`;
}

/** Banner list of the suspects the Solver found convictable. */
export function renderBannerList(convictableIds: readonly string[], names: NameMap): string {
  const list = joinNames(convictableIds.map((id) => nameOf(names, id)));
  return convictableIds.length === 0 ? "Convictable: nobody." : `Convictable: ${list}.`;
}

/** The Solver result carries the rule set semver ("1.0.0"); the texts name the knob label ("v1"). */
function labelOf(semver: string): string {
  return VERSION_LABELS.find((l) => RULE_SET_REFS[l].version === semver) ?? semver;
}

export function buildSolverMessages(
  result: SolveResult,
  accusation: AccusationText | null,
  names: NameMap,
): ChatMessage[] {
  const out: ChatMessage[] = [];
  if (result.verdict !== "accepted") {
    const reason = result.reasons[0];
    if (reason !== undefined) {
      out.push({ id: "solver-reason", kind: "summary", text: renderReasonTemplate(reason, names, labelOf(result.ruleSetVersion)) });
    }
  }
  if (accusation !== null) {
    out.push({ id: "accusation", kind: "result", text: renderAccusationText(accusation, names) });
  }
  return out;
}
