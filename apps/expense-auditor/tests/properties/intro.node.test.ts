import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { introReducer } from "../../src/state/intro";
import type { IntroEvent, IntroState } from "../../src/state/intro";

const arbEvent: fc.Arbitrary<IntroEvent> = fc.oneof(
  fc.constant<IntroEvent>({ type: "timer" }),
  fc.boolean().map((xray): IntroEvent => ({ type: "user", xray })),
);

// Feature: expense-auditor, Property 14: Intro sequence honours the user
// **Validates: Requirements 12.5, 12.6, 12.8**
describe("Property 14: Intro sequence honours the user", () => {
  it("starts off or on by motion preference, and a user toggle always wins over the timer", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.array(arbEvent, { maxLength: 12 }), (reducedMotion, events) => {
        let s: IntroState = introReducer(
          { xray: false, pending: false },
          { type: "shown", reducedMotion },
        );
        // 12.5, 12.6: initial state
        expect(s).toEqual(reducedMotion ? { xray: true, pending: false } : { xray: false, pending: true });

        let lastUser: boolean | null = null;
        let timerFired = false;
        for (const e of events) {
          const before = s;
          s = introReducer(s, e);
          if (e.type === "user") {
            lastUser = e.xray;
            // 12.8: a user toggle sets the value and cancels the pending flip
            expect(s).toEqual({ xray: e.xray, pending: false });
          } else {
            // timer: only flips while pending, otherwise no-op (same object)
            if (!before.pending) expect(s).toBe(before);
            else {
              expect(s).toEqual({ xray: true, pending: false });
              timerFired = true;
            }
          }
          // never pending once the user acted or the timer fired or reduced motion
          if (lastUser !== null || timerFired || reducedMotion) expect(s.pending).toBe(false);
        }
        // a user choice is never overridden by later timer events
        if (lastUser !== null) {
          const afterUser = events.map((e, i) => ({ e, i })).filter((x) => x.e.type === "user").pop()!.i;
          const tail = events.slice(afterUser + 1);
          if (tail.every((e) => e.type === "timer")) expect(s.xray).toBe(lastUser);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("a timer after a user toggle never changes the state", () => {
    fc.assert(
      fc.property(fc.boolean(), (xray) => {
        const afterUser = introReducer({ xray: false, pending: true }, { type: "user", xray });
        expect(introReducer(afterUser, { type: "timer" })).toBe(afterUser);
      }),
      { numRuns: 100 },
    );
  });
});
