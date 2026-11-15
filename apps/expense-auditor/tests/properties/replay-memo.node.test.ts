import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isCoreError, override, replay } from "@bones/core";
import { SAMPLES } from "../../src/extraction/samples";
import { makePortFactory } from "../../src/pipeline/ports";
import type { VersionLabel } from "../../src/pipeline/runPipeline";
import type { DecisionState } from "../../src/state/reducer";
import { createSessionStore } from "../../src/state/sessionStore";
import type { SessionDeps } from "../../src/state/sessionStore";
import { displayedTrace } from "../../src/state/selectors";
import { arbLabel } from "../helpers/arbitraries";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle } from "../helpers/fixtures";

const bundle = loadTestBundle();
if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));

// Feature: expense-auditor, Property 13: Replay memoization
// **Validates: Requirements 13.3, 13.4, 13.5**
describe("Property 13: Replay memoization", () => {
  it("replays each version at most once, never v1, never extracts, never replaces the original", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("signature" as const, "clean" as const, "outside-window" as const),
        fc.array(arbLabel, { maxLength: 20 }),
        async (sampleId, labels) => {
          const replayCalls: string[] = [];
          let extractionFactoryCalls = 0;
          const deps: SessionDeps = {
            bundle,
            samples: SAMPLES,
            portFactory: makePortFactory(counterPorts()),
            sha256: async () => "cd".repeat(32),
            replayFn: ((original, version, ruleSet, catalog, scopes, ports) => {
              replayCalls.push(version);
              return replay(original, version, ruleSet, catalog, scopes, ports);
            }) as typeof replay,
            overrideFn: override,
            prefersReducedMotion: () => false,
          };
          // A live adapter factory that must never be reached during selection.
          Object.assign(deps, {
            makeLiveAdapter: () => {
              extractionFactoryCalls += 1;
              throw new Error("extraction adapter must not be used for replay");
            },
          });

          const store = createSessionStore(deps);
          await store.loadSample(sampleId);
          const loaded = store.getState() as DecisionState;
          const originalId = loaded.original.decisionId;
          const seen = new Map<VersionLabel, unknown>();

          for (const label of labels) {
            store.selectVersion(label);
            const s = store.getState() as DecisionState;
            expect(s.selected).toBe(label);
            const shown = displayedTrace(s);
            if (seen.has(label)) expect(shown).toBe(seen.get(label)); // identical object
            seen.set(label, shown);
            expect(s.replays.v1).toBe(loaded.original);
            expect(s.original.decisionId).toBe(originalId);
          }

          const distinct = new Set(labels.filter((l) => l !== "v1"));
          expect(replayCalls.length).toBe(distinct.size);
          expect(new Set(replayCalls).size).toBe(replayCalls.length);
          expect(replayCalls).not.toContain("1.0.0");
          expect(extractionFactoryCalls).toBe(0);
          expect((store.getState() as DecisionState).original).toBe(loaded.original);
        },
      ),
      { numRuns: 100 },
    );
  });
});
