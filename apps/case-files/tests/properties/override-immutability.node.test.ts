import { isCoreError } from "@bones/core";
import type { Trace } from "@bones/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { RecordedCaseId } from "../../src/extraction/samples";
import { makePortFactory } from "../../src/pipeline/ports";
import { replayCase, verdictOf } from "../../src/pipeline/replayCase";
import { VERSION_LABELS } from "../../src/rules/catalog";
import { createSessionStore } from "../../src/state/sessionStore";
import { override as coreOverride } from "@bones/core";
import { counterPorts } from "../helpers/fakes";
import type { RuleBundle } from "../../src/rules/catalog";
import { loadTestBundle, readRecorded } from "../helpers/fixtures";

const loaded = loadTestBundle();
if (isCoreError(loaded)) throw new Error(JSON.stringify(loaded));
const bundle: RuleBundle = loaded;
const cases = readRecorded().map((r) => r.json);

const formArb = fc.record({
  reviewerName: fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,30}$/),
  reason: fc.stringMatching(/^[A-Za-z][A-Za-z ,.]{0,200}$/),
  replacementResult: fc.constantFrom("approved" as const, "partially_approved" as const, "rejected" as const),
});
const stepArb = fc.record({ label: fc.constantFrom(...VERSION_LABELS), form: formArb });

describe("Override immutability", () => {
  // Feature: case-files, Property 13: Override immutability
  // **Validates: Requirements 12.9**
  it("Property 13: overrides never change the Trace or its rule result", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<RecordedCaseId>("greenhouse", "candlesticks", "empty-room"),
        fc.array(stepArb, { minLength: 1, maxLength: 8 }),
        async (caseId, steps) => {
          const store = createSessionStore({
            bundle,
            cases,
            portFactory: makePortFactory(counterPorts()),
            sha256: async () => "a".repeat(64),
            replayFn: replayCase,
            overrideFn: coreOverride,
          });
          await store.loadRecordedCase(caseId);
          const first = store.getState();
          if (first.screen !== "case") throw new Error("case did not load");
          const original: Trace = first.original;
          const before = structuredClone(original);
          const verdictBefore = verdictOf(original, bundle);

          const seen = new Map<Trace, Trace>([[original, before]]);
          for (const { label, form } of steps) {
            store.selectVersion(label);
            const s = store.getState();
            if (s.screen !== "case") throw new Error("case lost");
            const shown = s.replays[label] ?? s.original;
            if (!seen.has(shown)) seen.set(shown, structuredClone(shown));
            const out = store.submitOverride(form);
            expect(out).toEqual({ ok: true });
          }

          const last = store.getState();
          if (last.screen !== "case") throw new Error("case lost");
          expect(last.overrides).toHaveLength(steps.length);
          expect(last.original).toBe(original);
          expect(Object.isFrozen(original)).toBe(true);
          expect(original.validatedFields).toEqual(before.validatedFields);
          expect(original.ruleOutcomes).toEqual(before.ruleOutcomes);
          expect(original.result).toBe(before.result);
          expect(verdictOf(original, bundle)).toEqual(verdictBefore);
          for (const [trace, snapshot] of seen) expect(trace).toEqual(snapshot);
        },
      ),
      { numRuns: 100 },
    );
  });
});
