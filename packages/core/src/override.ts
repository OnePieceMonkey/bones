import type {
  Trace,
  Override,
  DecisionResult,
  CoreError,
  KernelPorts,
} from "./types.js";

/**
 * Creates an Override linked to a Trace by decisionId.
 * Never mutates the original Trace.
 * Returns a CoreError if input validation fails.
 */
export function override(
  trace: Trace,
  input: {
    reviewerName: string;
    reason: string;
    replacementResult: DecisionResult;
  },
  ports: KernelPorts,
  metadata?: Record<string, unknown>
): Override | CoreError {
  // Validate reviewerName: non-empty, not all-whitespace
  if (!input.reviewerName || input.reviewerName.trim().length === 0) {
    return {
      kind: "invalid_override_input",
      message: "reviewerName must be a non-empty, non-whitespace string",
      field: "reviewerName",
    };
  }

  // Validate reason: non-empty, not all-whitespace, ≤ 500 characters
  if (!input.reason || input.reason.trim().length === 0) {
    return {
      kind: "invalid_override_input",
      message: "reason must be a non-empty, non-whitespace string",
      field: "reason",
    };
  }
  if (input.reason.length > 500) {
    return {
      kind: "invalid_override_input",
      message: "reason must not exceed 500 characters",
      field: "reason",
    };
  }

  let createdAt: string;
  try {
    createdAt = ports.clock().toISOString();
  } catch (e) {
    return {
      kind: "invalid_override_input",
      message: `Clock port failed: ${String(e)}`,
      field: "reviewerName", // closest field — port failure
    };
  }

  const result: Override = {
    decisionId: trace.decisionId,
    reviewerName: input.reviewerName,
    reason: input.reason,
    replacementResult: input.replacementResult,
    createdAt,
    ...(metadata !== undefined ? { metadata } : {}),
  };

  return result;
}

/**
 * Returns the effective result for a Trace:
 * - If no overrides: the original trace.result
 * - If overrides: the replacementResult of the Override with the latest createdAt
 * - If two overrides share the same latest createdAt: CoreError("ambiguous_override")
 */
export function effectiveResult(
  trace: Trace,
  overrides: Override[]
): DecisionResult | CoreError {
  if (overrides.length === 0) {
    return trace.result;
  }

  // Find the maximum createdAt timestamp
  let maxTime = -Infinity;
  for (const ov of overrides) {
    const t = new Date(ov.createdAt).getTime();
    if (t > maxTime) maxTime = t;
  }

  const latest = overrides.filter(
    (ov) => new Date(ov.createdAt).getTime() === maxTime
  );

  if (latest.length > 1) {
    return {
      kind: "ambiguous_override",
      message: `Multiple overrides share the same createdAt timestamp: ${latest[0]!.createdAt}`,
      createdAt: latest[0]!.createdAt,
    };
  }

  return latest[0]!.replacementResult;
}
