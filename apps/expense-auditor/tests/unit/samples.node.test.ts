import { describe, expect, it } from "vitest";
import { DEFAULT_TRIP, SAMPLES, SAMPLE_IDS, sampleSchema } from "../../src/extraction/samples";
import type { Sample, SampleId } from "../../src/extraction/samples";
import { formatTripWindow } from "../../src/format/dates";

const parsed: Sample[] = SAMPLES.map((s) => sampleSchema.parse(s));
const byId = (id: SampleId): Sample => {
  const s = parsed.find((p) => p.id === id);
  if (s === undefined) throw new Error(`missing sample ${id}`);
  return s;
};

interface Item {
  description: string;
  amount: number;
  isAlcohol: boolean;
}
const items = (s: Sample): Item[] => s.extraction.proposedFields["lineItems"] as Item[];
const sum = (xs: Item[]): number => xs.reduce((a, i) => a + i.amount, 0);

describe("samples", () => {
  it("has exactly the three sample ids and every Sample passes sampleSchema", () => {
    expect(SAMPLES).toHaveLength(3);
    expect(parsed.map((p) => p.id).sort()).toEqual([...SAMPLE_IDS].sort());
    for (const s of SAMPLES) expect(sampleSchema.safeParse(s).success).toBe(true);
  });

  it("signature: Harbor Grill, claimed 48000 versus item sum 4800, confidence 0.62", () => {
    const s = byId("signature");
    const f = s.extraction.proposedFields;
    expect(s.title).toBe("Signature case");
    expect(f["merchant"]).toBe("Harbor Grill");
    expect(f["receiptDate"]).toBe("2024-03-15");
    expect(f["claimedTotalCents"]).toBe(48000);
    expect(items(s).map((i) => i.amount)).toEqual([2200, 1100, 850, 650]);
    expect(items(s).filter((i) => i.isAlcohol).map((i) => i.description)).toEqual(["Draft beer"]);
    expect(sum(items(s))).toBe(4800);
    expect(s.extraction.confidence["claimedTotalCents"]).toBe(0.62);
  });

  it("clean: Corner Bistro, items sum to the claimed 3240, no alcohol", () => {
    const s = byId("clean");
    const f = s.extraction.proposedFields;
    expect(s.title).toBe("Clean meal");
    expect(f["merchant"]).toBe("Corner Bistro");
    expect(f["receiptDate"]).toBe("2024-03-12");
    expect(f["claimedTotalCents"]).toBe(3240);
    expect(sum(items(s))).toBe(3240);
    expect(items(s).some((i) => i.isAlcohol)).toBe(false);
  });

  it("outside-window: Airport Cafe dated after the trip, items sum to 2150", () => {
    const s = byId("outside-window");
    const f = s.extraction.proposedFields;
    expect(s.title).toBe("Outside the trip window");
    expect(f["merchant"]).toBe("Airport Cafe");
    expect(f["receiptDate"]).toBe("2024-03-25");
    expect((f["receiptDate"] as string) > s.trip.end).toBe(true);
    expect(f["claimedTotalCents"]).toBe(2150);
    expect(sum(items(s))).toBe(2150);
    expect(items(s).some((i) => i.isAlcohol)).toBe(false);
  });

  it("uses the default trip window in every sample", () => {
    for (const s of parsed) expect(s.trip).toEqual(DEFAULT_TRIP);
  });

  it("keeps every source line index inside the receipt text", () => {
    for (const s of parsed) {
      const lines = s.receiptText.split("\n").length;
      for (const src of Object.values(s.extraction.sources)) {
        if (src !== undefined && src.kind === "line") expect(src.lineIndex).toBeLessThan(lines);
      }
    }
  });

  it("rawModelOutput parses back to proposedFields", () => {
    for (const s of parsed) {
      expect(JSON.parse(s.extraction.rawModelOutput)).toEqual(s.extraction.proposedFields);
    }
  });

  it("keeps every confidence between 0 and 1", () => {
    for (const s of parsed) {
      for (const c of Object.values(s.extraction.confidence)) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });

  it("contains no EUR text", () => {
    expect(JSON.stringify(SAMPLES)).not.toContain("EUR");
  });

  it("formats the default trip window", () => {
    expect(formatTripWindow(DEFAULT_TRIP)).toBe("Trip: Mar 10 - Mar 20, 2024");
  });
});
