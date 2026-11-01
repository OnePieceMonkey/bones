// Feature: core, Property 9: deterministic ports produce byte-for-byte identical Trace JSON
// Validates: Requirements 5.5, 11.9
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { evaluate } from "../../rules/evaluate.js";
import { createTrace } from "../../trace.js";
import { isCoreError } from "../../types.js";
import type { ValidatedFields, RuleSet, RuleCatalog, AmountScope, Rule, KernelPorts } from "../../types.js";

const fixedPorts: KernelPorts = {
  clock: () => new Date("2024-01-01T00:00:00.000Z"),
  id: () => "fixed-id-001",
  hasher: (_b: Uint8Array) => "a".repeat(64),
};

function makeCapRule(capCents: number): Rule {
  return {
    id: "cap", version: "1.0.0", effect: "capping",
    condition: { kind: "comparison", left: { kind: "literal", value: true }, op: "==", right: { kind: "literal", value: true } },
    effectConfig: { cap: capCents, scope: "total" },
    messageTemplate: "",
  };
}

describe("Property 9: deterministic ports produce byte-for-byte identical Trace JSON", () => {
  it("two calls with identical inputs and fixed ports produce the same Trace JSON (≥100 runs)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 100000 }),
        fc.integer({ min: 100, max: 100000 }),
        (capCents, claimedCents) => {
          const rule = makeCapRule(capCents);
          const catalog: RuleCatalog = new Map<string, Rule>();
          catalog.set("cap@1.0.0", rule);
          const ruleSet: RuleSet = { id: "s", version: "1.0.0", rules: [{ ruleId: "cap", ruleVersion: "1.0.0" }] };
          const fields: ValidatedFields = { claimed: claimedCents };
          const scopes: AmountScope[] = [{ name: "total", claimedCents }];
          const extraction = { proposedFields: fields, confidence: {}, sources: {}, rawModelOutput: `{"claimed":${claimedCents}}` };
          const rawBytes = new TextEncoder().encode(extraction.rawModelOutput);

          const d1 = evaluate(fields, ruleSet, catalog, scopes);
          const d2 = evaluate(fields, ruleSet, catalog, scopes);
          if (isCoreError(d1) || isCoreError(d2)) return true;

          const t1 = createTrace(d1, extraction, ruleSet, fields, rawBytes, fixedPorts);
          const t2 = createTrace(d2, extraction, ruleSet, fields, rawBytes, fixedPorts);
          if (isCoreError(t1) || isCoreError(t2)) return true;

          return JSON.stringify(t1) === JSON.stringify(t2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
