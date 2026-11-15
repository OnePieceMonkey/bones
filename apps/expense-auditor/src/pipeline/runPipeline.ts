import { createTrace, evaluate, isCoreError, replay } from "@bones/core";
import type { CoreError, ExtractionPort, KernelPorts, RawInput, Trace, ValidatedFields } from "@bones/core";
import type { TripWindow } from "../extraction/samples";
import { VERSION_LABELS } from "../rules/catalog";
import type { RuleBundle, VersionLabel } from "../rules/catalog";
import { amountScopesFor, amountScopesForTrace } from "./amountScopes";
import { sha256Hex } from "./hash";
import type { PortFactory } from "./ports";
import { toRuleFields } from "./toRuleFields";

export { VERSION_LABELS };
export type { RuleBundle, VersionLabel };

/** `raw` goes to the extraction port, `bytes` are hashed. */
export interface PipelineInput {
  raw: RawInput;
  bytes: Uint8Array;
}

export interface PipelineArgs {
  input: PipelineInput;
  adapter: ExtractionPort;
  trip: TripWindow;
  ruleSetLabel: VersionLabel;
  bundle: RuleBundle;
  portFactory: PortFactory;
  sha256?: (bytes: Uint8Array) => Promise<string>;
}

/**
 * extract, toRuleFields, evaluate, sha256, createTrace. Every step returns its CoreError
 * early and nothing after it runs. Never throws.
 */
export async function runPipeline(args: PipelineArgs): Promise<Trace | CoreError> {
  const { input, adapter, trip, ruleSetLabel, bundle, portFactory } = args;
  const sha256 = args.sha256 ?? sha256Hex;

  const extraction = await adapter.extract(input.raw);
  if (isCoreError(extraction)) return extraction;

  const fields = toRuleFields(extraction.proposedFields, trip);
  if (isCoreError(fields)) return fields;
  // RuleFields is an interface; core wants an index signature. The spread keeps key order.
  const validated: ValidatedFields = { ...fields };

  const ruleSet = bundle.ruleSets[ruleSetLabel];
  const decision = evaluate(validated, ruleSet, bundle.catalog, amountScopesFor(fields));
  if (isCoreError(decision)) return decision;

  let hex: string;
  try {
    hex = await sha256(input.bytes);
  } catch (e) {
    return {
      kind: "invalid_replay_arguments",
      message: `Hasher port failed: ${String(e)}`,
      missingField: "hasher",
    };
  }

  return createTrace(
    decision,
    extraction,
    ruleSet,
    validated,
    input.bytes,
    portFactory.forInput(hex, input.bytes.byteLength),
  );
}

/** Re-evaluates a stored Trace with the rule set of `label`. Never extracts, never hashes. */
export function replayTrace(args: {
  original: Trace;
  label: VersionLabel;
  bundle: RuleBundle;
  ports: KernelPorts;
  replayFn?: typeof replay;
}): Trace | CoreError {
  const scopes = amountScopesForTrace(args.original);
  if (isCoreError(scopes)) return scopes;
  const ruleSet = args.bundle.ruleSets[args.label];
  return (args.replayFn ?? replay)(
    args.original,
    ruleSet.version,
    ruleSet,
    args.bundle.catalog,
    scopes,
    args.ports,
  );
}
