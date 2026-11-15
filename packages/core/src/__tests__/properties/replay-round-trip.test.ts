// Feature: core, Property 2 (expense-auditor Property 6): replay keeps the original inputHash and the extraction fields
// Validates: Requirements 6.1, 6.2, 11.2; expense-auditor Requirements 4.1, 4.2, 4.3, 4.4, 4.5
import { describe, it, expect } from "vitest";
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

  it("replay keeps the original inputHash, does not hash, and keeps the extraction fields (≥100 runs)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 50000 }),
        fc.string(),
        fc.dictionary(fc.string({ minLength: 1, maxLength: 5 }), fc.integer({ min: 0, max: 1000 })),
        (capCents, raw, fields) => {
          const rule = makeCapRule("cap-rule", "1.0.0", capCents);
          const catalog: RuleCatalog = new Map<string, Rule>();
          catalog.set("cap-rule@1.0.0", rule);
          const ruleSet: RuleSet = { id: "s", version: "1.0.0", rules: [{ ruleId: "cap-rule", ruleVersion: "1.0.0" }] };
          const scopes: AmountScope[] = [{ name: "total", claimedCents: 1000 }];
          const decision = evaluate(fields, ruleSet, catalog, scopes);
          expect(isCoreError(decision)).toBe(false);
          if (isCoreError(decision)) return;
          const extraction = {
            proposedFields: fields,
            confidence: Object.fromEntries(Object.keys(fields).map((k) => [k, 0.5])),
            sources: {},
            rawModelOutput: raw,
          };
          // Original hash is fixed and is NOT the hash of the encoded rawModelOutput.
          const originalPorts: KernelPorts = { ...deterministicPorts, hasher: () => "a".repeat(64) };
          const trace = createTrace(decision, extraction, ruleSet, fields, new TextEncoder().encode("input"), originalPorts);
          expect(isCoreError(trace)).toBe(false);
          if (isCoreError(trace)) return;
          let hashCalls = 0;
          const replayPorts: KernelPorts = {
            clock: () => new Date("2025-01-01T00:00:00.000Z"),
            id: () => "replay-id",
            hasher: () => {
              hashCalls++;
              return "c".repeat(64);
            },
          };
          const replayed = replay(trace, trace.ruleSetVersion, ruleSet, catalog, scopes, replayPorts);
          expect(isCoreError(replayed)).toBe(false);
          if (isCoreError(replayed)) return;
          expect(replayed.inputHash).toBe(trace.inputHash);
          expect(hashCalls).toBe(0);
          expect(replayed.decisionId).toBe("replay-id");
          expect(replayed.createdAt).toBe("2025-01-01T00:00:00.000Z");
          expect(replayed.rawModelOutput).toEqual(trace.rawModelOutput);
          expect(replayed.proposedFields).toEqual(trace.proposedFields);
          expect(replayed.confidence).toEqual(trace.confidence);
          expect(replayed.sources).toEqual(trace.sources);
          expect(replayed.validatedFields).toEqual(trace.validatedFields);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("replay guards", () => {
  it("returns invalid_replay_arguments for an empty inputHash", () => {
    const ruleSet: RuleSet = { id: "s", version: "1.0.0", rules: [] };
    const catalog: RuleCatalog = new Map<string, Rule>();
    const scopes: AmountScope[] = [{ name: "total", claimedCents: 1000 }];
    const decision = evaluate({}, ruleSet, catalog, scopes);
    if (isCoreError(decision)) throw new Error("evaluate failed");
    const extraction = { proposedFields: {}, confidence: {}, sources: {}, rawModelOutput: "{}" };
    const trace = createTrace(decision, extraction, ruleSet, {}, new Uint8Array(0), deterministicPorts);
    if (isCoreError(trace)) throw new Error("createTrace failed");
    const result = replay({ ...trace, inputHash: "" }, "1.0.0", ruleSet, catalog, scopes, deterministicPorts);
    expect(result).toMatchObject({ kind: "invalid_replay_arguments", missingField: "inputHash" });
  });
});
