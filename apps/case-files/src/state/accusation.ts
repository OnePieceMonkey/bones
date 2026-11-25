import type { Trace } from "@bones/core";

/**
 * Accusation record. A pure function of the Trace, the accused suspect id and the convictable
 * list. It reads no `rawModelOutput` and no `confidence`. No randomness, no I/O; the only time
 * source is the clock port that the caller passes in.
 */
export interface AccusationRecord {
  decisionId: string;
  ruleSetVersion: string;
  suspectId: string;
  verdict: "correct" | "incorrect";
  proofRuleIds: string[];
  createdAt: string;
}

interface SuspectLike {
  id?: unknown;
  statements?: unknown;
}

/** Maps every statement id of the stored DerivedCase to its owning suspect id. */
function statementOwners(trace: Trace): Map<string, string> {
  const owners = new Map<string, string>();
  const suspects = (trace.validatedFields as { suspects?: unknown }).suspects;
  if (!Array.isArray(suspects)) return owners;
  for (const s of suspects as SuspectLike[]) {
    if (typeof s.id !== "string" || !Array.isArray(s.statements)) continue;
    for (const st of s.statements as { id?: unknown }[]) {
      if (typeof st.id === "string") owners.set(st.id, s.id);
    }
  }
  return owners;
}

/**
 * Finds the suspect an instance rule id belongs to. Proof ids are `<template>:<suspectId>`.
 * Statement ids are `<template>:<statementId>`; the owner is the suspect that holds the statement
 * in the stored validated fields (the same mapping the Binder produces).
 */
function makeBoundTo(trace: Trace): (ruleId: string) => string | undefined {
  const owners = statementOwners(trace);
  return (ruleId) => {
    const cut = ruleId.indexOf(":");
    if (cut < 0) return undefined;
    const template = ruleId.slice(0, cut);
    const target = ruleId.slice(cut + 1);
    if (template.startsWith("proof-")) return target;
    if (template.startsWith("statement-")) return owners.get(target);
    return undefined;
  };
}

export function computeAccusation(
  trace: Trace,
  suspectId: string,
  convictable: readonly string[],
  clock: () => Date,
): AccusationRecord {
  const boundTo = makeBoundTo(trace);
  const proofRuleIds = trace.ruleOutcomes
    .filter((o) => o.conditionMet && boundTo(o.ruleId) === suspectId)
    .map((o) => o.ruleId);
  return {
    decisionId: trace.decisionId,
    ruleSetVersion: trace.ruleSetVersion,
    suspectId,
    verdict: convictable.includes(suspectId) ? "correct" : "incorrect",
    proofRuleIds,
    createdAt: clock().toISOString(),
  };
}
