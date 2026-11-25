import { isCoreError } from "@bones/core";
import type { ExtractionPort } from "@bones/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { makePortFactory } from "../../src/pipeline/ports";
import { replayCase } from "../../src/pipeline/replayCase";
import { runCasePipeline } from "../../src/pipeline/runCasePipeline";
import { VERSION_LABELS } from "../../src/rules/catalog";
import type { VersionLabel } from "../../src/rules/catalog";
import { validModelOutputArb } from "../helpers/arbitraries";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle } from "../helpers/fixtures";

const bundle = loadTestBundle();
if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));

describe("Replay equivalence", () => {
  // Feature: case-files, Property 11: Replay equivalence
  // **Validates: Requirements 10.4**
  it("Property 11: replayCase equals a fresh pipeline run with that label", async () => {
    await fc.assert(
      fc.asyncProperty(
        validModelOutputArb,
        fc.constantFrom(...VERSION_LABELS),
        fc.constantFrom(...VERSION_LABELS),
        async (out, firstLabel: VersionLabel, label: VersionLabel) => {
          const adapter: ExtractionPort = {
            extract: async () => ({
              proposedFields: out,
              confidence: out.confidence,
              sources: {},
              rawModelOutput: JSON.stringify(out),
            }),
          };
          const run = (versionLabel: VersionLabel) =>
            runCasePipeline({
              input: { raw: "case" },
              adapter,
              versionLabel,
              bundle,
              portFactory: makePortFactory(counterPorts()),
            });
          const original = await run(firstLabel);
          const fresh = await run(label);
          if (isCoreError(original) || isCoreError(fresh)) throw new Error(JSON.stringify({ original, fresh }));
          const replayed = replayCase({
            original,
            label,
            bundle,
            ports: makePortFactory(counterPorts()).base,
          });
          if (isCoreError(replayed)) throw new Error(JSON.stringify(replayed));
          expect(replayed.validatedFields).toEqual(fresh.validatedFields);
          expect(replayed.ruleOutcomes).toEqual(fresh.ruleOutcomes);
          expect(replayed.result).toBe(fresh.result);
          expect(replayed.amountCents).toBe(fresh.amountCents);
        },
      ),
      { numRuns: 100 },
    );
  });
});
