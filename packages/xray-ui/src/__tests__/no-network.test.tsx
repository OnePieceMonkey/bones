import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { DrBonesChat } from "../components/DrBonesChat";
import { XrayView } from "../components/XrayView";
import type { FilmSource } from "../types";
import { signatureAnatomy, signatureTrace } from "./helpers/fixtures";
import { installNetSpy, type NetSpy } from "./helpers/netSpy";

// Validates: Requirements 6.12, 14.1, 18.5

const source: FilmSource = { kind: "text", text: "Trattoria Roma\n2024-05-14\nWine 6.50\nTotal 480.00" };

/** Advance in small steps so React flushes effects between chained timers. */
function advance(totalMs: number, stepMs: number): void {
  for (let t = 0; t < totalMs; t += stepMs) {
    act(() => {
      vi.advanceTimersByTime(stepMs);
    });
  }
}

describe("no network calls", () => {
  let spy: NetSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    spy = installNetSpy();
  });

  afterEach(() => {
    spy.restore();
    vi.useRealTimers();
  });

  it("DrBonesChat types all messages without touching the network", () => {
    const onMessagesComplete = vi.fn();
    render(
      <DrBonesChat
        trace={signatureTrace()}
        anatomy={signatureAnatomy()}
        speedMs={5}
        onMessagesComplete={onMessagesComplete}
      />,
    );
    advance(30_000, 2);
    expect(onMessagesComplete).toHaveBeenCalled();
    expect(spy.calls).toEqual([]);
  });

  it("XrayView renders and finishes its chat without touching the network", () => {
    const onMessagesComplete = vi.fn();
    render(
      <XrayView
        trace={signatureTrace()}
        anatomy={signatureAnatomy()}
        source={source}
        versions={["v1", "v2", "v3"]}
        version="v1"
        onVersionChange={() => {}}
        reducedMotion={false}
        onMessagesComplete={onMessagesComplete}
      />,
    );
    advance(60_000, 8);
    expect(onMessagesComplete).toHaveBeenCalled();
    expect(spy.calls).toEqual([]);
  });
});
