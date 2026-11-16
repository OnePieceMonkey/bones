// Feature: visual-polish, Property 11: The intro plays once per case
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useIntro } from "../../hooks/useIntro";
import { introSchedule } from "../../model/introSchedule";
import { evaluationOrder } from "../../model/introOrder";
import { selectBones } from "../../model/selectors";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

const schedule = introSchedule([false, true, false]);
const RANK = { idle: 0, running: 1, done: 2 } as const;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type Op = { t: "toggle" } | { t: "tick"; ms: number } | { t: "key" };
const arbOp: fc.Arbitrary<Op> = fc.oneof(
  fc.constant<Op>({ t: "toggle" }),
  fc.constant<Op>({ t: "key" }),
  fc.integer({ min: 0, max: 4000 }).map<Op>((ms) => ({ t: "tick", ms })),
);

describe("Property 11: The intro plays once per case", () => {
  it("never goes back to an earlier phase for the same key", () => {
    fc.assert(
      fc.property(fc.array(arbOp, { maxLength: 25 }), (ops) => {
        // Validates: Requirements 12.3, 12.4, 12.8
        let xray = true;
        let keyNo = 0;
        const { result, rerender, unmount } = renderHook(
          (p: { xray: boolean; key: string }) =>
            useIntro({ introKey: p.key, xray: p.xray, reduced: false, schedule }),
          { initialProps: { xray, key: "k0" } },
        );
        let lastKey = "k0";
        let rank = RANK[result.current];
        expect(result.current).toBe("running");
        for (const op of ops) {
          if (op.t === "toggle") xray = !xray;
          if (op.t === "key") keyNo += 1;
          if (op.t === "tick") act(() => void vi.advanceTimersByTime(op.ms));
          else rerender({ xray, key: `k${keyNo}` });
          const key = `k${keyNo}`;
          const now = RANK[result.current];
          if (key !== lastKey) {
            lastKey = key;
            // A new key restarts the intro when X-ray is on.
            if (xray) expect(result.current).toBe("running");
          } else {
            expect(now).toBeGreaterThanOrEqual(rank);
          }
          rank = now;
        }
        unmount();
      }),
      { numRuns: 100 },
    );
  });
});

describe("useIntro", () => {
  it("is idle while X-ray is off, then running, then done after endMs", () => {
    const { result, rerender } = renderHook((p: { xray: boolean }) =>
      useIntro({ introKey: "a", xray: p.xray, reduced: false, schedule }), { initialProps: { xray: false } });
    expect(result.current).toBe("idle");
    rerender({ xray: true });
    expect(result.current).toBe("running");
    act(() => void vi.advanceTimersByTime(schedule.endMs - 1));
    expect(result.current).toBe("running");
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe("done");
    rerender({ xray: false });
    rerender({ xray: true });
    expect(result.current).toBe("done");
  });

  it("is done on the first render with Reduced_Motion and sets no timer", () => {
    const { result } = renderHook(() => useIntro({ introKey: "a", xray: true, reduced: true, schedule }));
    expect(result.current).toBe("done");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restarts for a new key while running", () => {
    const { result, rerender } = renderHook((p: { key: string }) =>
      useIntro({ introKey: p.key, xray: true, reduced: false, schedule }), { initialProps: { key: "a" } });
    act(() => void vi.advanceTimersByTime(schedule.endMs - 10));
    rerender({ key: "b" });
    expect(result.current).toBe("running");
    act(() => void vi.advanceTimersByTime(20));
    expect(result.current).toBe("running");
    act(() => void vi.advanceTimersByTime(schedule.endMs));
    expect(result.current).toBe("done");
  });
});

describe("evaluation order and schedule", () => {
  it("orders bones by first outcome, not-applicable last, and ends by 3500 ms", () => {
    const trace = signatureTrace();
    const bones = selectBones(trace, signatureAnatomy());
    const order = evaluationOrder(bones, trace);
    expect(order).toHaveLength(bones.length);
    const firstIdx = (id: string) => trace.ruleOutcomes.findIndex((o) => o.ruleId === id);
    const idxs = order.map((b) => firstIdx(b.ruleId));
    const applicable = idxs.filter((i) => i >= 0);
    expect([...applicable].sort((a, b) => a - b)).toEqual(applicable);
    expect(idxs.slice(applicable.length).every((i) => i < 0)).toBe(true);
    expect(introSchedule(order.map((b) => b.state === "fractured")).endMs).toBeLessThanOrEqual(3500);
  });
});
