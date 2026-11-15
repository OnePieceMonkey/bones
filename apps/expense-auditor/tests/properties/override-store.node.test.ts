import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isCoreError, override } from "@bones/core";
import type { Override } from "@bones/core";
import { makePortFactory } from "../../src/pipeline/ports";
import { reducer } from "../../src/state/reducer";
import type { DecisionState } from "../../src/state/reducer";
import { displayedTrace, effectiveView, linkedOverrides } from "../../src/state/selectors";
import { arbOp } from "../helpers/arbitraries";
import { counterPorts } from "../helpers/fakes";
import { signatureDecisionState } from "../helpers/fixtures";

const LABELS = ["v1", "v2", "v3"] as const;

// Feature: expense-auditor, Property 2: Overrides never change a stored Trace and the latest linked Override is effective
// **Validates: Requirements 14.3, 14.5, 14.6, 14.7, 14.8, 14.9, 14.11**
describe("Property 2: Overrides never change a stored Trace and the latest linked Override is effective", () => {
  it("holds for random sequences of version selections and overrides", async () => {
    const initial = await signatureDecisionState();
    const snapshots = LABELS.map((l) => JSON.stringify(initial.replays[l]));

    await fc.assert(
      fc.asyncProperty(fc.array(arbOp, { maxLength: 15 }), async (ops) => {
        // fresh clock per run, its own counter, strictly increasing
        const factory = makePortFactory(counterPorts());
        let state: DecisionState = initial;
        const created: Override[] = [];

        for (const op of ops) {
          if (op.type === "select") {
            state = reducer(state, { type: "version_selected", label: op.label }) as DecisionState;
          } else {
            const shown = displayedTrace(state);
            const o = override(shown, op.form, factory.base, { app: "expense-auditor" });
            if (isCoreError(o)) throw new Error(JSON.stringify(o));
            // 14.8: linked to the displayed Trace
            expect(o.decisionId).toBe(shown.decisionId);
            created.push(o);
            state = reducer(state, { type: "override_added", override: o }) as DecisionState;
          }
        }

        // 14.7, 14.11: the three stored Traces are unchanged and frozen
        LABELS.forEach((l, i) => {
          const t = state.replays[l]!;
          expect(JSON.stringify(t)).toBe(snapshots[i]);
          expect(Object.isFrozen(t)).toBe(true);
        });
        expect(state.original).toBe(initial.original);
        expect(state.replays).toBe(initial.replays);
        expect(state.overrides).toEqual(created);

        // 14.5, 14.6, 14.9: effective result per label
        for (const label of LABELS) {
          const view = effectiveView({ ...state, selected: label });
          const trace = state.replays[label]!;
          const linked = created.filter((o) => o.decisionId === trace.decisionId);
          expect(linkedOverrides({ ...state, selected: label })).toEqual(linked);
          if (linked.length === 0) {
            expect(view).toBeNull();
          } else {
            const latest = linked[linked.length - 1]!; // clock is strictly increasing
            expect(isCoreError(view)).toBe(false);
            expect(view).toEqual({
              result: latest.replacementResult,
              reviewerName: latest.reviewerName,
            });
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("an Override on one version never affects the effective view of another", async () => {
    const initial = await signatureDecisionState();
    const factory = makePortFactory(counterPorts());
    const o = override(
      initial.replays.v2!,
      { reviewerName: "Ann", reason: "ok", replacementResult: "rejected" },
      factory.base,
    );
    if (isCoreError(o)) throw new Error(JSON.stringify(o));
    const state = reducer(initial, { type: "override_added", override: o }) as DecisionState;
    expect(effectiveView({ ...state, selected: "v1" })).toBeNull();
    expect(effectiveView({ ...state, selected: "v3" })).toBeNull();
    expect(effectiveView({ ...state, selected: "v2" })).toEqual({
      result: "rejected",
      reviewerName: "Ann",
    });
  });
});
