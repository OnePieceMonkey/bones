import { isCoreError } from "@bones/core";
import type { DecisionResult, ExtractionPort, Override } from "@bones/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildCaseExport, serializeExport } from "../../src/export/exportTrace";
import { makePortFactory } from "../../src/pipeline/ports";
import { runCasePipeline } from "../../src/pipeline/runCasePipeline";
import { VERSION_LABELS } from "../../src/rules/catalog";
import type { RuleBundle } from "../../src/rules/catalog";
import type { AccusationRecord } from "../../src/state/accusation";
import { validModelOutputArb } from "../helpers/arbitraries";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle } from "../helpers/fixtures";

const loaded = loadTestBundle();
if (isCoreError(loaded)) throw new Error(JSON.stringify(loaded));
const bundle: RuleBundle = loaded;

const text = fc.string({ minLength: 1, maxLength: 40 });
const iso = fc.date({ min: new Date(0), max: new Date(4_000_000_000_000), noInvalidDate: true }).map((d) => d.toISOString());
const resultArb = fc.constantFrom<DecisionResult>("approved", "partially_approved", "rejected");

const overrideArb = fc.record({
  decisionId: text,
  reviewerName: text,
  reason: text,
  replacementResult: resultArb,
  createdAt: iso,
}) as fc.Arbitrary<Override>;

const accusationArb: fc.Arbitrary<AccusationRecord | null> = fc.option(
  fc.record({
    decisionId: text,
    ruleSetVersion: fc.constantFrom("1.0.0", "2.0.0", "3.0.0"),
    suspectId: text,
    verdict: fc.constantFrom("correct" as const, "incorrect" as const),
    proofRuleIds: fc.array(text, { maxLength: 6 }),
    createdAt: iso,
  }),
  { nil: null },
);

describe("Export round trip", () => {
  // Feature: case-files, Property 14: Export round trip
  // **Validates: Requirements 9.8**
  it("Property 14: serialise, parse, serialise is byte-identical and the parsed value equals the payload", async () => {
    await fc.assert(
      fc.asyncProperty(
        validModelOutputArb,
        fc.constantFrom(...VERSION_LABELS),
        fc.array(overrideArb, { maxLength: 5 }),
        accusationArb,
        async (out, label, overrides, accusation) => {
          const adapter: ExtractionPort = {
            extract: async () => ({
              proposedFields: out,
              confidence: out.confidence,
              sources: {},
              rawModelOutput: JSON.stringify(out),
            }),
          };
          const trace = await runCasePipeline({
            input: { raw: "case" },
            adapter,
            versionLabel: label,
            bundle,
            portFactory: makePortFactory(counterPorts()),
          });
          if (isCoreError(trace)) throw new Error(JSON.stringify(trace));
          const payload = buildCaseExport(trace, overrides, accusation);
          const first = serializeExport(payload);
          const parsed = JSON.parse(first) as unknown;
          expect(parsed).toEqual(payload);
          expect(serializeExport(parsed as typeof payload)).toBe(first);
        },
      ),
      { numRuns: 100 },
    );
  });
});
