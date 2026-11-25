import { isCoreError } from "@bones/core";
import type { ExtractionPort, Trace } from "@bones/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { makePortFactory } from "../../src/pipeline/ports";
import { runCasePipeline } from "../../src/pipeline/runCasePipeline";
import { verdictOf } from "../../src/pipeline/replayCase";
import { VERSION_LABELS } from "../../src/rules/catalog";
import type { RuleBundle, VersionLabel } from "../../src/rules/catalog";
import { computeAccusation } from "../../src/state/accusation";
import { validModelOutputArb } from "../helpers/arbitraries";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle } from "../helpers/fixtures";

const loaded = loadTestBundle();
if (isCoreError(loaded)) throw new Error(JSON.stringify(loaded));
const bundle: RuleBundle = loaded;

const fixedClock = () => new Date(1_700_000_000_000);

describe("Accusation correctness", () => {
  // Feature: case-files, Property 12: Accusation correctness
  // **Validates: Requirements 11.12**
  it("Property 12: verdict is correct iff convictable; rawModelOutput and confidence do not matter", async () => {
    await fc.assert(
      fc.asyncProperty(
        validModelOutputArb,
        fc.constantFrom(...VERSION_LABELS),
        fc.nat(1000),
        async (out, label: VersionLabel, pick) => {
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
          const v = verdictOf(trace, bundle);
          if (isCoreError(v)) throw new Error(JSON.stringify(v));
          const ids = out.suspects.map((s) => s.id);
          const accused = pick % (ids.length + 1) === ids.length ? "nobody-here" : ids[pick % ids.length]!;
          const record = computeAccusation(trace, accused, v.convictable, fixedClock);
          expect(record.verdict).toBe(v.convictable.includes(accused) ? "correct" : "incorrect");

          const altered = {
            ...trace,
            rawModelOutput: "{}",
            confidence: Object.fromEntries(Object.keys(trace.confidence).map((k) => [k, 0])),
          } as Trace;
          expect(computeAccusation(altered, accused, v.convictable, fixedClock)).toEqual(record);
        },
      ),
      { numRuns: 100 },
    );
  });
});
