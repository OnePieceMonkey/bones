import { describe, expect, it } from "vitest";
import { getReplay, initialReplayStore, putReplay } from "../../src/pipeline/replayStore";
import { sampleTrace } from "../helpers/fixtures";

describe("replay store", () => {
  it("holds the original under v1 and nothing else", async () => {
    const original = await sampleTrace("signature", "v1");
    const store = initialReplayStore(original);
    expect(getReplay(store, "v1")).toBe(original);
    expect(getReplay(store, "v2")).toBeUndefined();
    expect(getReplay(store, "v3")).toBeUndefined();
  });

  it("adds entries for v2 and v3 without mutating the previous store", async () => {
    const original = await sampleTrace("signature", "v1");
    const t2 = await sampleTrace("signature", "v2");
    const t3 = await sampleTrace("signature", "v3");
    const s1 = initialReplayStore(original);
    const s2 = putReplay(s1, "v2", t2);
    const s3 = putReplay(s2, "v3", t3);
    expect(getReplay(s2, "v2")).toBe(t2);
    expect(getReplay(s3, "v2")).toBe(t2);
    expect(getReplay(s3, "v3")).toBe(t3);
    expect(getReplay(s3, "v1")).toBe(original);
    expect(s2).not.toBe(s1);
    expect(Object.keys(s1)).toEqual(["v1"]);
    expect(Object.keys(s2).sort()).toEqual(["v1", "v2"]);
  });

  it("returns the same store for v1 and keeps the original", async () => {
    const original = await sampleTrace("signature", "v1");
    const other = await sampleTrace("clean", "v1");
    const store = initialReplayStore(original);
    const same = putReplay(store, "v1", other);
    expect(same).toBe(store);
    expect(getReplay(same, "v1")).toBe(original);
  });
});
