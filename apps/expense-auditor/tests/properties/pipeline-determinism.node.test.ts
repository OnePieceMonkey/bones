import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isCoreError } from "@bones/core";
import type { ExtractionResult } from "@bones/core";
import { arbExtraction, arbTrip } from "../helpers/arbitraries";
import { counterPorts, fakeAdapter } from "../helpers/fakes";
import { loadTestBundle } from "../helpers/fixtures";
import { makePortFactory } from "../../src/pipeline/ports";
import { runPipeline } from "../../src/pipeline/runPipeline";
import type { RuleBundle } from "../../src/pipeline/runPipeline";

// Feature: expense-auditor, Property 11: Pipeline determinism
// **Validates: Requirements 10.2, 10.8**
describe("Property 11: Pipeline determinism", () => {
  const loaded = loadTestBundle();
  if (isCoreError(loaded)) throw new Error(JSON.stringify(loaded));
  const bundle: RuleBundle = loaded;
  const arbLabel = fc.constantFrom("v1" as const, "v2" as const, "v3" as const);

  it("two runs with identical ports, adapter and bytes give deeply equal Traces", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbTrip.chain((trip) => fc.tuple(fc.constant(trip), arbExtraction(trip))),
        arbLabel,
        fc.string({ minLength: 1, maxLength: 40 }),
        async ([trip, extraction], label, text) => {
          const bytes = new TextEncoder().encode(text);
          const run = () =>
            runPipeline({
              input: { raw: text, bytes },
              adapter: fakeAdapter(extraction as ExtractionResult),
              trip,
              ruleSetLabel: label,
              bundle,
              portFactory: makePortFactory(counterPorts()),
            });
          const a = await run();
          const b = await run();
          expect(isCoreError(a)).toBe(false);
          expect(a).toEqual(b);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("an invalid proposal returns a CoreError and evaluates no rule", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbTrip.chain((trip) => fc.tuple(fc.constant(trip), arbExtraction(trip))),
        arbLabel,
        async ([trip, extraction], label) => {
          const invalid: ExtractionResult = {
            ...(extraction as ExtractionResult),
            proposedFields: { ...extraction.proposedFields, claimedTotalCents: 0 },
          };
          let reads = 0;
          const spy = new Proxy(bundle, {
            get(target, prop, receiver) {
              reads++;
              return Reflect.get(target, prop, receiver);
            },
          });
          const r = await runPipeline({
            input: { raw: "x", bytes: new TextEncoder().encode("x") },
            adapter: fakeAdapter(invalid),
            trip,
            ruleSetLabel: label,
            bundle: spy,
            portFactory: makePortFactory(counterPorts()),
          });
          expect(isCoreError(r)).toBe(true);
          expect(reads).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
