import { isCoreError } from "@bones/core";
import { describe, expect, it } from "vitest";
import { RecordedCaseAdapter } from "../../src/extraction/RecordedCaseAdapter";
import { RECORDED_CASES, RECORDED_CASE_IDS, recordedSheetList } from "../../src/extraction/samples";

describe("RecordedCaseAdapter", () => {
  it("returns an extraction for each of the three ids, with parseable raw output", async () => {
    expect(RECORDED_CASES).toHaveLength(3);
    for (const id of RECORDED_CASE_IDS) {
      const r = await new RecordedCaseAdapter(id).extract("x");
      if (isCoreError(r)) throw new Error(JSON.stringify(r));
      expect(JSON.parse(r.rawModelOutput)).toEqual(r.proposedFields);
    }
  });

  it("returns a clone, so mutating the result leaves the entry intact", async () => {
    const a = new RecordedCaseAdapter("greenhouse");
    const first = await a.extract("x");
    if (isCoreError(first)) throw new Error("unexpected");
    (first.proposedFields as Record<string, unknown>)["title"] = "changed";
    first.rawModelOutput = "changed";
    const second = await a.extract("x");
    if (isCoreError(second)) throw new Error("unexpected");
    expect(second.proposedFields["title"]).not.toBe("changed");
    expect(second.rawModelOutput).not.toBe("changed");
  });

  it("returns input_empty without reading any entry", async () => {
    const r = await new RecordedCaseAdapter("greenhouse", []).extract("");
    expect(r).toMatchObject({ kind: "input_empty" });
  });

  it("returns fixture_not_found for an unknown id", async () => {
    const r = await new RecordedCaseAdapter("greenhouse", []).extract("x");
    expect(r).toMatchObject({ kind: "fixture_not_found", fixturePath: "recorded/greenhouse.json" });
  });

  it("returns fixture_invalid for a malformed entry", async () => {
    const bad = { id: "greenhouse", title: "T", extraction: { proposedFields: {}, confidence: { a: 7 }, sources: {}, rawModelOutput: "{}" } };
    const r = await new RecordedCaseAdapter("greenhouse", [bad]).extract("x");
    expect(r).toMatchObject({ kind: "fixture_invalid" });
  });

  it("accepts origin fixture and rejects other origins or unknown keys", async () => {
    const base = structuredClone(RECORDED_CASES[0]) as Record<string, unknown>;
    const id = base["id"] as "greenhouse";
    expect(await new RecordedCaseAdapter(id, [{ ...base, origin: "fixture" }]).extract("x")).not.toHaveProperty("kind");
    expect(await new RecordedCaseAdapter(id, [{ ...base, origin: "llm" }]).extract("x")).toMatchObject({ kind: "fixture_invalid" });
    expect(await new RecordedCaseAdapter(id, [{ ...base, extra: 1 }]).extract("x")).toMatchObject({ kind: "fixture_invalid" });
  });

  it("lists the three sheets", () => {
    expect(recordedSheetList().map((s) => s.id)).toEqual(["greenhouse", "candlesticks", "empty-room"]);
  });
});
