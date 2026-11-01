// Feature: core, Property 5: effectiveResult returns the Override with the latest createdAt
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { effectiveResult } from "../../override.js";
import { isCoreError } from "../../types.js";
import type { Trace, Override, DecisionResult } from "../../types.js";
import { TRACE_SCHEMA_VERSION } from "../../types.js";

function makeStubTrace(result: DecisionResult): Trace {
  return {
    traceSchemaVersion: TRACE_SCHEMA_VERSION,
    decisionId: "trace-001",
    createdAt: "2024-01-01T00:00:00.000Z",
    inputHash: "a".repeat(64),
    rawModelOutput: "{}",
    proposedFields: {},
    confidence: {},
    sources: {},
    validatedFields: {},
    ruleSetId: "s",
    ruleSetVersion: "1.0.0",
    ruleOutcomes: [],
    result,
    amountCents: 1000,
  };
}

function makeOverride(result: DecisionResult, isoDate: string): Override {
  return {
    decisionId: "trace-001",
    reviewerName: "Reviewer",
    reason: "Manual review",
    replacementResult: result,
    createdAt: isoDate,
  };
}

describe("Property 5: effectiveResult returns the latest Override", () => {
  it("empty overrides returns original trace result (≥100 runs)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("approved", "partially_approved", "rejected") as fc.Arbitrary<DecisionResult>,
        (result) => {
          const trace = makeStubTrace(result);
          const effective = effectiveResult(trace, []);
          return effective === result;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("single override always returns that override's result (≥100 runs)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("approved", "partially_approved", "rejected") as fc.Arbitrary<DecisionResult>,
        fc.constantFrom("approved", "partially_approved", "rejected") as fc.Arbitrary<DecisionResult>,
        (traceResult, overrideResult) => {
          const trace = makeStubTrace(traceResult);
          const ov = makeOverride(overrideResult, "2024-06-01T00:00:00.000Z");
          const effective = effectiveResult(trace, [ov]);
          if (isCoreError(effective)) return false;
          return effective === overrideResult;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns the latest Override when timestamps are strictly ordered (≥100 runs)", () => {
    fc.assert(
      fc.property(
        // Generate N distinct timestamps (N between 2 and 5)
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 2, maxLength: 5 }),
        fc.constantFrom("approved", "partially_approved", "rejected") as fc.Arbitrary<DecisionResult>,
        (offsets, traceResult) => {
          // Make offsets strictly increasing to ensure uniqueness
          const sortedOffsets = [...new Set(offsets)].sort((a, b) => a - b);
          if (sortedOffsets.length < 2) return true; // skip degenerate case

          const trace = makeStubTrace(traceResult);
          const results: DecisionResult[] = ["approved", "partially_approved", "rejected"];
          const overrides: Override[] = sortedOffsets.map((offset, i) => {
            const dt = new Date(2024, 0, 1, 0, offset);
            return makeOverride(results[i % results.length]!, dt.toISOString());
          });

          const effective = effectiveResult(trace, overrides);

          // Find the latest timestamp
          const maxTime = Math.max(...overrides.map((o) => new Date(o.createdAt).getTime()));
          const expected = overrides.find((o) => new Date(o.createdAt).getTime() === maxTime);

          if (isCoreError(effective)) return false;
          return effective === expected!.replacementResult;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns ambiguous_override when two overrides share the same createdAt (≥100 runs)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("approved", "partially_approved", "rejected") as fc.Arbitrary<DecisionResult>,
        fc.constantFrom("approved", "rejected") as fc.Arbitrary<DecisionResult>,
        (r1, r2) => {
          const trace = makeStubTrace("approved");
          const sameTime = "2024-06-15T12:00:00.000Z";
          const ov1 = makeOverride(r1, sameTime);
          const ov2 = makeOverride(r2, sameTime);
          const effective = effectiveResult(trace, [ov1, ov2]);
          if (!isCoreError(effective)) return false;
          return effective.kind === "ambiguous_override";
        }
      ),
      { numRuns: 100 }
    );
  });
});
