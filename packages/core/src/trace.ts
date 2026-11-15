import type {
  Decision,
  ExtractionResult,
  ValidatedFields,
  RuleSet,
  Trace,
  KernelPorts,
  CoreError,
} from "./types.js";
import { TRACE_SCHEMA_VERSION } from "./types.js";

/** Recursively freezes an object so mutations throw in strict mode or silently no-op. */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") return obj;
  for (const name of Object.getOwnPropertyNames(obj)) {
    const val = (obj as Record<string, unknown>)[name];
    if (val !== null && typeof val === "object") {
      deepFreeze(val);
    }
  }
  return Object.freeze(obj);
}

export interface CreateTraceOptions {
  /** When set, the hasher port is not called and rawInputBytes is not read. Used by replay. */
  inputHash?: string;
}

/**
 * Creates an immutable, self-describing Trace from a Decision and its inputs.
 * Clock, id, and hasher are injected — never called inside evaluate().
 */
export function createTrace(
  decision: Decision,
  extractionResult: ExtractionResult,
  ruleSet: RuleSet,
  validatedFields: ValidatedFields,
  rawInputBytes: Uint8Array,
  ports: KernelPorts,
  options: CreateTraceOptions = {}
): Trace | CoreError {
  let createdAt: string;
  let decisionId: string;
  let inputHash: string;

  try {
    createdAt = ports.clock().toISOString();
  } catch (e) {
    return {
      kind: "invalid_replay_arguments",
      message: `Clock port failed: ${String(e)}`,
      missingField: "clock",
    };
  }

  try {
    decisionId = ports.id();
    if (!decisionId) throw new Error("id port returned an empty string");
  } catch (e) {
    return {
      kind: "invalid_replay_arguments",
      message: `Id port failed: ${String(e)}`,
      missingField: "id",
    };
  }

  try {
    inputHash = options.inputHash ?? ports.hasher(rawInputBytes);
    if (!inputHash) throw new Error("hasher port returned an empty string");
  } catch (e) {
    return {
      kind: "invalid_replay_arguments",
      message: `Hasher port failed: ${String(e)}`,
      missingField: "hasher",
    };
  }

  const trace: Trace = {
    traceSchemaVersion: TRACE_SCHEMA_VERSION,
    decisionId,
    createdAt,
    inputHash,
    rawModelOutput: extractionResult.rawModelOutput,
    proposedFields: extractionResult.proposedFields,
    confidence: extractionResult.confidence,
    sources: extractionResult.sources,
    validatedFields,
    ruleSetId: ruleSet.id,
    ruleSetVersion: ruleSet.version,
    ruleOutcomes: decision.ruleOutcomes,
    result: decision.result,
    amountCents: decision.amountCents,
  };

  return deepFreeze(trace);
}
