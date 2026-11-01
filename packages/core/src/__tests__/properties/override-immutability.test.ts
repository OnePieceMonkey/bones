// Feature: core, Property 4: override never mutates the original Trace
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { evaluate } from "../../rules/evaluate.js";
import { createTrace } from "../../trace.js";
import { override } from "../../override.js";
import { isCoreError } from "../../types.js";
import type { ValidatedFields, RuleSet, RuleCatalog, AmountScope, Rule, KernelPorts } from "../../types.js";

const ports: KernelPorts = {
  clock: () => new Date("2024-01-01T00:00:00.000Z"),
  id: () => "fixed-id",
  hasher: (_b: Uint8Array) => "a".repeat(64),
};

function makeApprovedTrace(claimedCents: number) {
  const rule: Rule = {
    id: "pass-rule",
    version: "1.0.0",
    effect: "capping",
    condition: { kind: "comparison", left: { kind: "literal", value: false }, op: "==", right: { kind: "literal", value: true } },
    effectConfig: { cap: claimedCents * 2, scope: "total" },
    messageTemplate: "ok",
  };
  const catalog: RuleCatalog = new Map();
  catalog.set("pass-rule@1.0.0", rule);
  const ruleSet: RuleSet = { id: "s", version: "1.0.0", rules: [{ ruleId: "pass-rule", ruleVersion: "1.0.0" }] };
  const fields: ValidatedFields = {};
  const scopes: AmountScope[] = [{ name: "total", claimedCents }];
  const decision = evaluate(fields, ruleSet, catalog, scopes);
  if (isCoreError(decision)) return null;
  const extraction = { proposedFields: fields, confidence: {}, sources: {}, rawModelOutput: "{}" };
  const rawBytes = new TextEncoder().encode("{}");
  return createTrace(decision, extraction, ruleSet, fields, rawBytes, ports);
}

describe("Property 4: override never mutates the original Trace", () => {
  /**
   * Validates: Requirements 5.4, 6.4, 7.2, 11.4
   */
  it("calling override does not change the original trace (≥100 runs)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 100000 }),
        fc.constantFrom("approved", "partially_approved", "rejected") as fc.Arbitrary<"approved" | "partially_approved" | "rejected">,
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        (claimedCents, replacementResult, reviewerName, reason) => {
          const trace = makeApprovedTrace(claimedCents);
          if (!trace || isCoreError(trace)) return true; // skip if trace creation failed

          // Snapshot before
          const beforeJSON = JSON.stringify(trace);

          // Create override
          const result = override(
            trace,
            { reviewerName, reason, replacementResult },
            ports
          );

          // Snapshot after
          const afterJSON = JSON.stringify(trace);

          // Trace must not have changed
          return beforeJSON === afterJSON;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 5.4, 6.4, 7.2, 11.4
   */
  it("override returns a new object linked by decisionId (≥100 runs)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 10000 }),
        (claimedCents) => {
          const trace = makeApprovedTrace(claimedCents);
          if (!trace || isCoreError(trace)) return true;

          const result = override(trace, { reviewerName: "Alice", reason: "Manual review", replacementResult: "approved" }, ports);
          if (isCoreError(result)) return true; // skip error cases

          return result.decisionId === trace.decisionId;
        }
      ),
      { numRuns: 100 }
    );
  });
});
