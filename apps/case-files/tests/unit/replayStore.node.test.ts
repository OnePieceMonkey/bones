import type { Trace } from "@bones/core";
import { describe, expect, it } from "vitest";
import { getReplay, initialReplayStore, putReplay } from "../../src/pipeline/replayStore";

const t = (id: string) => ({ decisionId: id }) as unknown as Trace;

describe("ReplayStore", () => {
  it("starts with the original under v1", () => {
    const o = t("o");
    expect(getReplay(initialReplayStore(o), "v1")).toBe(o);
    expect(getReplay(initialReplayStore(o), "v2")).toBeUndefined();
  });
  it("memoizes v2 and v3 and returns a new store", () => {
    const s0 = initialReplayStore(t("o"));
    const s1 = putReplay(s0, "v2", t("a"));
    expect(getReplay(s1, "v2")?.decisionId).toBe("a");
    expect(getReplay(s0, "v2")).toBeUndefined();
  });
  it("never overwrites v1", () => {
    const o = t("o");
    const s = putReplay(initialReplayStore(o), "v1", t("other"));
    expect(getReplay(s, "v1")).toBe(o);
  });
});
