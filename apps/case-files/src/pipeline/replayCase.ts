import { createTrace, isCoreError } from "@bones/core";
import type { CoreError, ExtractionResult, KernelPorts, Trace } from "@bones/core";
import type { DerivedCase } from "../derive/factDeriver";
import { RULE_SET_REFS, VERSION_LABELS } from "../rules/catalog";
import type { RuleBundle, VersionLabel } from "../rules/catalog";
import { solve } from "../solver/solve";
import type { SolveResult } from "../solver/solve";
import { decisionFromSolve } from "./runCasePipeline";

export interface ReplayCaseArgs {
  original: Trace;
  label: VersionLabel;
  bundle: RuleBundle;
  ports: KernelPorts;
}

/**
 * App-level replay (CF-A3). It does not call core `replay`. It runs the Solver on the stored
 * `validatedFields`, builds the Decision as the pipeline does and calls `createTrace` with the
 * `inputHash` of the original. No adapter, no hasher call, no network. Never throws on bad rules.
 */
export function replayCase(args: ReplayCaseArgs): Trace | CoreError {
  const { original, label, bundle, ports } = args;
  const solved = solve(original.validatedFields as unknown as DerivedCase, label, bundle);
  if (isCoreError(solved)) return solved;
  const extraction: ExtractionResult = {
    rawModelOutput: original.rawModelOutput,
    proposedFields: original.proposedFields,
    confidence: original.confidence,
    sources: original.sources,
  };
  return createTrace(
    decisionFromSolve(solved),
    extraction,
    bundle.templateRuleSets[label],
    original.validatedFields,
    new Uint8Array(0),
    ports,
    { inputHash: original.inputHash },
  );
}

export interface VerdictOf {
  verdict: SolveResult["verdict"];
  convictable: string[];
}

/** Recomputes the verdict and the convictable suspects from a stored Trace and its rule set version. */
export function verdictOf(trace: Trace, bundle: RuleBundle): VerdictOf | CoreError {
  const label = VERSION_LABELS.find(
    (l) => RULE_SET_REFS[l].id === trace.ruleSetId && RULE_SET_REFS[l].version === trace.ruleSetVersion,
  );
  if (label === undefined) {
    return {
      kind: "rule_not_found",
      message: `Rule set ${trace.ruleSetId}@${trace.ruleSetVersion} is not a known version.`,
      ruleId: trace.ruleSetId,
      ruleVersion: trace.ruleSetVersion,
    };
  }
  const solved = solve(trace.validatedFields as unknown as DerivedCase, label, bundle);
  if (isCoreError(solved)) return solved;
  return { verdict: solved.verdict, convictable: [...solved.convictable] };
}
