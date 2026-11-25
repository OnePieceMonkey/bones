import { createTrace, isCoreError, validate } from "@bones/core";
import type { CoreError, Decision, ExtractionPort, RawInput, Trace, ValidatedFields } from "@bones/core";
import { deriveFacts } from "../derive/factDeriver";
import type { RuleBundle, VersionLabel } from "../rules/catalog";
import { solve } from "../solver/solve";
import type { SolveResult } from "../solver/solve";
import { sha256Hex } from "./hash";
import type { PortFactory } from "./ports";
import { extractCaseFields, modelOutputSchema } from "./schema";

export const MAX_RAW_MODEL_OUTPUT_BYTES = 32_768;

export interface CasePipelineArgs {
  /** `raw` goes to the extraction port. */
  input: { raw: RawInput };
  adapter: ExtractionPort;
  versionLabel: VersionLabel;
  bundle: RuleBundle;
  portFactory: PortFactory;
  sha256?: (bytes: Uint8Array) => Promise<string>;
}

/** Builds the Decision from the Solver result. Only `ruleOutcomes` comes from core `evaluate` (CF-A1). */
export function decisionFromSolve(solved: SolveResult): Decision {
  return {
    result: solved.verdict === "accepted" ? "approved" : "rejected",
    amountCents: solved.convictable.length,
    ruleOutcomes: solved.outcomes,
  };
}

/**
 * extract, size guard, validate, deriveFacts, solve, sha256, createTrace. Every step returns
 * its CoreError early and nothing after it runs. Never throws.
 */
export async function runCasePipeline(args: CasePipelineArgs): Promise<Trace | CoreError> {
  const extraction = await args.adapter.extract(args.input.raw);
  if (isCoreError(extraction)) return extraction;

  const bytes = new TextEncoder().encode(extraction.rawModelOutput);
  if (bytes.byteLength > MAX_RAW_MODEL_OUTPUT_BYTES) {
    return {
      kind: "input_too_large",
      message: `Model output is ${bytes.byteLength} bytes, above the limit of ${MAX_RAW_MODEL_OUTPUT_BYTES}.`,
      byteLength: bytes.byteLength,
      maxBytes: MAX_RAW_MODEL_OUTPUT_BYTES,
    };
  }
  try {
    JSON.parse(extraction.rawModelOutput);
  } catch {
    return {
      kind: "validation_failed",
      message: "Model output is not valid JSON.",
      fieldErrors: [{ path: "", issue: "rawModelOutput is not valid JSON" }],
    };
  }

  const validated = validate(extraction.proposedFields, modelOutputSchema);
  if (isCoreError(validated)) return validated;

  const derived = deriveFacts(extractCaseFields(validated));
  const solved = solve(derived, args.versionLabel, args.bundle);
  if (isCoreError(solved)) return solved;

  let hex: string;
  try {
    hex = await (args.sha256 ?? sha256Hex)(bytes);
  } catch (e) {
    return {
      kind: "invalid_replay_arguments",
      message: `Hasher port failed: ${String(e)}`,
      missingField: "hasher",
    };
  }
  return createTrace(
    decisionFromSolve(solved),
    extraction,
    args.bundle.templateRuleSets[args.versionLabel],
    derived as unknown as ValidatedFields,
    bytes,
    args.portFactory.forInput(hex, bytes.byteLength),
  );
}
