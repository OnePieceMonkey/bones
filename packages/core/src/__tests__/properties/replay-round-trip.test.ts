// Feature: core, Property 2: replay with same ruleSet/version returns equal Decision
// Validates: Requirements 6.1, 6.2, 11.2
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { evaluate } from "../../rules/evaluate.js";
import { createTrace } from "../../trace.js";
import { replay } from "../../replay.js";
import { isCoreError } from "../../types.js";
import type { ValidatedFields, RuleSet, RuleCatalog, AmountScope, Rule, KernelPorts } from "../../types.js";

const deterministicPorts: KernelPorts = {
  clock: () => new Date("2024-01-01T00:00:00.000Z"),
  id: () => "fixed-id-001",
  hasher: (_b: Uint8Array) => "a".repeat(64),
};

function makeCapRule(id: string, version: string, capCents: number): Rule {
  return {
    id,
    version,
    effect: "capping",
    condition: { kind: "comparison", left: { kind: "literal", value: true }, op: "==", right: { kind: "literal", value: true } },
    effectConfig: { cap: capCents, scope: "total" },
    messageTemplate: `capped at ${capCents}`,
  };
}

describe("Property 2: replay round-trip preserves Decision", () => {
  it("replay with same version returns equal result and amountCents (≥100 runs)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 50000 }),
        fc.integer({ min: 100, max: 100000 }),
        (capCents, claimedCents) => {
          const rule = makeCapRule("cap-rule", "1.0.0", capCents);
          const catalog: RuleCatalog = new Map<string, Rule>();
          catalog.set("cap-rule@1.0.0", rule);

          const ruleSet: RuleSet = { id: "test-set", version: "1.0.0", rules: [{ ruleId: "cap-rule", ruleVersion: "1.0.0" }] };
          const fields: ValidatedFields = {};
          const scopes: AmountScope[] = [{ name: "total", claimedCents }];

          const decision = evaluate(fields, ruleSet, catalog, scopes);
          if (isCoreError(decision)) return true;

          const extraction = {
            proposedFields: fields,
            confidence: {},
            sources: {},
            rawModelOutput: "{}",
          };
          const rawBytes = new TextEncoder().encode("{}");
          const trace = createTrace(decision, extraction, ruleSet, fields, rawBytes, deterministicPorts);
          if (isCoreError(trace)) return true;

          // Use a different port so the replayed trace gets a different decisionId
          let callCount = 0;
          const replayPorts: KernelPorts = {
            clock: () => new Date("2024-06-01T00:00:00.000Z"),
            id: () => `replay-id-${++callCount}`,
            hasher: (_b: Uint8Array) => "b".repeat(64),
          };

          const replayed = replay(trace, trace.ruleSetVersion, ruleSet, catalog, scopes, replayPorts);
          if (isCoreError(replayed)) return true;

          // Decision should be identical
          return replayed.result === trace.result && replayed.amountCents === trace.amountCents;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("replayed trace has fresh identity fields but same extraction fields", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 50000 }),
        (capCents) => {
          const rule = makeCapRule("cap-rule", "1.0.0", capCents);
          const catalog: RuleCatalog = new Map<string, Rule>();
          catalog.set("cap-rule@1.0.0", rule);
          const ruleSet: RuleSet = { id: "s", version: "1.0.0", rules: [{ ruleId: "cap-rule", ruleVersion: "1.0.0" }] };
          const fields: ValidatedFields = { x: 1 };
          const scopes: AmountScope[] = [{ name: "total", claimedCents: 1000 }];
          const decision = evaluate(fields, ruleSet, catalog, scopes);
          if (isCoreError(decision)) return true;
          const extraction = { proposedFields: fields, confidence: {}, sources: {}, rawModelOutput: "raw" };
          const rawBytes = new TextEncoder().encode("raw");
          const trace = createTrace(decision, extraction, ruleSet, fields, rawBytes, deterministicPorts);
          if (isCoreError(trace)) return true;

          let n = 0;
          const rp: KernelPorts = { clock: () => new Date("2025-01-01T00:00:00.000Z"), id: () => `r${++n}`, hasher: (_b) => "c".repeat(64) };
          const replayed = replay(trace, trace.ruleSetVersion, ruleSet, catalog, scopes, rp);
          if (isCoreError(replayed)) return true;

          // Fresh identity
          if (replayed.decisionId === trace.decisionId) return false;
          // Extraction fields preserved
          if (JSON.stringify(replayed.validatedFields) !== JSON.stringify(trace.validatedFields)) return false;
          if (replayed.rawModelOutput !== trace.rawModelOutput) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
