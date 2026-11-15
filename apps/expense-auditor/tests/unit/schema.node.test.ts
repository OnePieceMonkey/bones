import { describe, expect, it } from "vitest";
import type { CoreError, Trace } from "@bones/core";
import { DEFAULT_TRIP, SAMPLES, sampleSchema } from "../../src/extraction/samples";
import type { Sample, SampleId } from "../../src/extraction/samples";
import { amountScopesFor, amountScopesForTrace } from "../../src/pipeline/amountScopes";
import { isRuleFields, toRuleFields } from "../../src/pipeline/toRuleFields";
import type { RuleFields } from "../../src/pipeline/schema";

const samples: Sample[] = SAMPLES.map((s) => sampleSchema.parse(s));
const sample = (id: SampleId): Sample => {
  const s = samples.find((p) => p.id === id);
  if (s === undefined) throw new Error(`missing sample ${id}`);
  return s;
};

const base = (): Record<string, unknown> => ({
  merchant: "Corner Bistro",
  receiptDate: "2024-03-12",
  claimedTotalCents: 3000,
  lineItems: [
    { description: "Soup", amount: 1000, isAlcohol: false },
    { description: "Wine", amount: 2000, isAlcohol: true },
  ],
});

function paths(r: RuleFields | CoreError): string[] {
  if (!("kind" in r) || r.kind !== "validation_failed") throw new Error("expected validation_failed");
  return r.fieldErrors.map((e) => e.path);
}

describe("toRuleFields", () => {
  it("derives the expected sums for the three samples", () => {
    const sig = toRuleFields(sample("signature").extraction.proposedFields, DEFAULT_TRIP) as RuleFields;
    expect(sig.lineItemSumCents).toBe(4800);
    expect(sig.alcoholLineCents).toBe(650);
    expect(sig.alcoholLineItems).toEqual([{ amount: 650 }]);
    expect(sig.claimedTotalCents).toBe(48000);
    expect(sig.tripStart).toBe("2024-03-10");
    expect(sig.tripEnd).toBe("2024-03-20");
    const clean = toRuleFields(sample("clean").extraction.proposedFields, DEFAULT_TRIP) as RuleFields;
    expect(clean.lineItemSumCents).toBe(3240);
    expect(clean.alcoholLineCents).toBe(0);
    expect(clean.alcoholLineItems).toEqual([]);
    const out = toRuleFields(sample("outside-window").extraction.proposedFields, DEFAULT_TRIP) as RuleFields;
    expect(out.lineItemSumCents).toBe(2150);
  });

  it("keeps the fixed key order", () => {
    const r = toRuleFields(base(), DEFAULT_TRIP) as RuleFields;
    expect(Object.keys(r)).toEqual([
      "merchant",
      "receiptDate",
      "claimedTotalCents",
      "lineItems",
      "lineItemSumCents",
      "alcoholLineItems",
      "alcoholLineCents",
      "tripStart",
      "tripEnd",
    ]);
    expect(isRuleFields(r)).toBe(true);
  });

  it("rejects negative cents with the item path", () => {
    const p = base();
    (p["lineItems"] as { amount: number }[])[0]!.amount = -1;
    expect(paths(toRuleFields(p, DEFAULT_TRIP))).toContain("lineItems.0.amount");
  });

  it("rejects fractional cents", () => {
    const p = base();
    (p["lineItems"] as { amount: number }[])[1]!.amount = 10.5;
    expect(paths(toRuleFields(p, DEFAULT_TRIP))).toContain("lineItems.1.amount");
    expect(paths(toRuleFields({ ...base(), claimedTotalCents: 1.5 }, DEFAULT_TRIP))).toContain("claimedTotalCents");
  });

  it("rejects a bad receipt date", () => {
    expect(paths(toRuleFields({ ...base(), receiptDate: "2024-02-30" }, DEFAULT_TRIP))).toContain("receiptDate");
  });

  it("rejects empty line items", () => {
    expect(paths(toRuleFields({ ...base(), lineItems: [] }, DEFAULT_TRIP))).toContain("lineItems");
  });

  it("rejects a zero claimed total", () => {
    expect(paths(toRuleFields({ ...base(), claimedTotalCents: 0 }, DEFAULT_TRIP))).toContain("claimedTotalCents");
  });

  it("rejects a trip end before the trip start", () => {
    const r = toRuleFields(base(), { start: "2024-03-20", end: "2024-03-10" });
    expect(paths(r)).toEqual(["tripEnd"]);
  });

  it("rejects bad trip dates", () => {
    expect(paths(toRuleFields(base(), { start: "nope", end: "2024-03-10" }))).toEqual(["tripStart"]);
    expect(paths(toRuleFields(base(), { start: "2024-03-10", end: "2024-13-01" }))).toEqual(["tripEnd"]);
  });

  it("reports two defects as two entries with a matching message", () => {
    const r = toRuleFields({ ...base(), receiptDate: "x", claimedTotalCents: 0 }, DEFAULT_TRIP);
    expect(paths(r)).toEqual(["receiptDate", "claimedTotalCents"]);
    expect((r as CoreError).message).toBe("Validation failed with 2 error(s)");
  });

  it("merges proposal and trip errors", () => {
    const r = toRuleFields({ ...base(), claimedTotalCents: 0 }, { start: "2024-03-20", end: "2024-03-10" });
    expect(paths(r)).toEqual(["claimedTotalCents", "tripEnd"]);
  });
});

describe("amount scopes", () => {
  it("returns the single total scope", () => {
    expect(amountScopesFor({ claimedTotalCents: 48000 })).toEqual([{ name: "total", claimedCents: 48000 }]);
  });

  it("reads the scope from a trace and fails on foreign fields", () => {
    const fields = toRuleFields(base(), DEFAULT_TRIP) as RuleFields;
    const ok = amountScopesForTrace({ validatedFields: fields } as unknown as Trace);
    expect(ok).toEqual([{ name: "total", claimedCents: 3000 }]);
    const bad = amountScopesForTrace({ validatedFields: { claimedTotalCents: 5 } } as unknown as Trace);
    expect(bad).toMatchObject({ kind: "validation_failed" });
  });
});
