import type {
  Trace,
  RuleSet,
  RuleCatalog,
  AmountScope,
  KernelPorts,
  CoreError,
  ExtractionResult,
} from "./types.js";
import { TRACE_SCHEMA_VERSION } from "./types.js";
import { evaluate } from "./rules/evaluate.js";
import { createTrace } from "./trace.js";

/**
 * Replays a stored Trace against a (potentially different) rule set version.
 * Never calls extraction — uses validatedFields from the original Trace.
 * Never mutates the original Trace.
 *
 * The caller must supply `amountScopes` because the original Trace only stores
 * the final `amountCents` (after rules ran), not the per-scope claimed amounts
 * needed to re-run evaluation. Pass the same scopes used to produce the original
 * Trace to get a comparable replay.
 */
export function replay(
  trace: Trace,
  ruleSetVersion: string,
  ruleSet: RuleSet,
  catalog: RuleCatalog,
  amountScopes: AmountScope[],
  ports: KernelPorts
): Trace | CoreError {
  // Guard: required arguments must be present
  if (!ruleSetVersion) {
    return {
      kind: "invalid_replay_arguments",
      message: "ruleSetVersion must be a non-empty string",
      missingField: "ruleSetVersion",
    };
  }
  if (!ruleSet) {
    return {
      kind: "invalid_replay_arguments",
      message: "ruleSet must not be null or undefined",
      missingField: "ruleSet",
    };
  }
  if (!catalog) {
    return {
      kind: "invalid_replay_arguments",
      message: "catalog must not be null or undefined",
      missingField: "catalog",
    };
  }

  // Guard: schema version must match
  if (trace.traceSchemaVersion !== TRACE_SCHEMA_VERSION) {
    return {
      kind: "trace_schema_mismatch",
      message: `Trace schema version mismatch: found "${trace.traceSchemaVersion}", expected "${TRACE_SCHEMA_VERSION}"`,
      found: trace.traceSchemaVersion,
      expected: TRACE_SCHEMA_VERSION,
    };
  }

  // Re-evaluate using the stored validatedFields — never calls extraction
  const decision = evaluate(trace.validatedFields, ruleSet, catalog, amountScopes);
  if ("kind" in decision) return decision; // propagate CoreError

  // Reconstruct an ExtractionResult from the original trace's extraction fields
  const extractionResult: ExtractionResult = {
    rawModelOutput: trace.rawModelOutput,
    proposedFields: trace.proposedFields,
    confidence: trace.confidence,
    sources: trace.sources,
  };

  // Use the rawModelOutput bytes as the input bytes for hashing (same as createTrace does)
  const rawInputBytes = new TextEncoder().encode(trace.rawModelOutput);

  // Override the ruleSet's version with the supplied ruleSetVersion so the new
  // Trace records the version that was actually used for this replay.
  const replayRuleSet: RuleSet = { ...ruleSet, version: ruleSetVersion };

  return createTrace(decision, extractionResult, replayRuleSet, trace.validatedFields, rawInputBytes, ports);
}
