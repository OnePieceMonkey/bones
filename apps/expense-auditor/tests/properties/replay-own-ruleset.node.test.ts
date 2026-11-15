import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isCoreError } from "@bones/core";
import type { ExtractionResult, Trace } from "@bones/core";
import { arbExtraction, arbLabel, arbTrip } from "../helpers/arbitraries";
import { counterPorts, fakeAdapter } from "../helpers/fakes";
import { loadSample, loadTestBundle } from "../helpers/fixtures";
import { RecordedSampleAdapter } from "../../src/extraction/RecordedSampleAdapter";
import { makePortFactory } from "../../src/pipeline/ports";
import { replayTrace, runPipeline } from "../../src/pipeline/runPipeline";
import type { RuleBundle } from "../../src/pipeline/runPipeline";

function expectSameDecision(replayed: Trace, original: Trace): void {
  expect(replayed.result).toBe(original.result);
  expect(replayed.amountCents).toBe(original.amountCents);
  expect(replayed.ruleOutcomes).toEqual(original.ruleOutcomes);
  expect(replayed.validatedFields).toEqual(original.validatedFields);
  expect(replayed.inputHash).toBe(original.inputHash);
  expect(replayed.decisionId).not.toBe(original.decisionId);
  expect(replayed.createdAt).not.toBe(original.createdAt);
  expect(Object.isFrozen(replayed)).toBe(true);
}

// Feature: expense-auditor, Property 1: Replay with the own rule set reproduces the decision
// **Validates: Requirements 13.2, 13.9**
describe("Property 1: Replay with the own rule set reproduces the decision", () => {
  const loaded = loadTestBundle();
  if (isCoreError(loaded)) throw new Error(JSON.stringify(loaded));
  const bundle: RuleBundle = loaded;

  it("replays generated decisions with their own rule set", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .tuple(arbTrip, arbLabel)
          .chain(([trip, label]) => arbExtraction(trip).map((e) => ({ trip, label, e }))),
        fc.string({ minLength: 1, maxLength: 40 }),
        async ({ trip, label, e }, text) => {
          const factory = makePortFactory(counterPorts());
          const original = await runPipeline({
            input: { raw: text, bytes: new TextEncoder().encode(text) },
            adapter: fakeAdapter(e as ExtractionResult),
            trip,
            ruleSetLabel: label,
            bundle,
            portFactory: factory,
          });
          if (isCoreError(original)) throw new Error(JSON.stringify(original));
          const replayed = replayTrace({ original, label, bundle, ports: factory.base });
          if (isCoreError(replayed)) throw new Error(JSON.stringify(replayed));
          expectSameDecision(replayed, original);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("replays the three samples with their own rule set", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("signature" as const, "clean" as const, "outside-window" as const),
        arbLabel,
        async (id, label) => {
          const sample = loadSample(id);
          const factory = makePortFactory(counterPorts());
          const original = await runPipeline({
            input: {
              raw: sample.receiptText,
              bytes: new TextEncoder().encode(sample.receiptText),
            },
            adapter: new RecordedSampleAdapter(id),
            trip: sample.trip,
            ruleSetLabel: label,
            bundle,
            portFactory: factory,
          });
          if (isCoreError(original)) throw new Error(JSON.stringify(original));
          const replayed = replayTrace({ original, label, bundle, ports: factory.base });
          if (isCoreError(replayed)) throw new Error(JSON.stringify(replayed));
          expectSameDecision(replayed, original);
        },
      ),
      { numRuns: 100 },
    );
  });
});
