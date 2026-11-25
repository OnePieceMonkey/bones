import { isCoreError } from "@bones/core";
import type { ExtractionPort } from "@bones/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { makePortFactory } from "../../src/pipeline/ports";
import { runCasePipeline } from "../../src/pipeline/runCasePipeline";
import { VERSION_LABELS } from "../../src/rules/catalog";
import { validModelOutputArb } from "../helpers/arbitraries";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle } from "../helpers/fixtures";

const bundle = loadTestBundle();
if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));

describe("Pipeline determinism", () => {
  // Feature: case-files, Property 10: Pipeline determinism
  // **Validates: Requirements 9.7**
  it("Property 10: two runs give equal validatedFields, ruleOutcomes, result and amountCents", async () => {
    await fc.assert(
      fc.asyncProperty(validModelOutputArb, fc.constantFrom(...VERSION_LABELS), async (out, label) => {
        const adapter: ExtractionPort = {
          extract: async () => ({
            proposedFields: out,
            confidence: out.confidence,
            sources: {},
            rawModelOutput: JSON.stringify(out),
          }),
        };
        const run = () =>
          runCasePipeline({
            input: { raw: "case" },
            adapter,
            versionLabel: label,
            bundle,
            portFactory: makePortFactory(counterPorts()),
          });
        const a = await run();
        const b = await run();
        if (isCoreError(a) || isCoreError(b)) throw new Error(JSON.stringify({ a, b }));
        expect(b.validatedFields).toEqual(a.validatedFields);
        expect(b.ruleOutcomes).toEqual(a.ruleOutcomes);
        expect(b.result).toBe(a.result);
        expect(b.amountCents).toBe(a.amountCents);
      }),
      { numRuns: 100 },
    );
  });
});
