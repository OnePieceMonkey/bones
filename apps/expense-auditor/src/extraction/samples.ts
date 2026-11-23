import { z } from "zod";
import type { ExtractionResult } from "@bones/core";
import { isRealIsoDate } from "../../shared/iso";
import signatureJson from "../../recorded/signature.json";
import cleanJson from "../../recorded/clean.json";
import outsideWindowJson from "../../recorded/outside-window.json";

export type SampleId = "signature" | "clean" | "outside-window";

/** Trip dates as ISO YYYY-MM-DD. */
export interface TripWindow {
  start: string;
  end: string;
}

export interface Sample {
  id: SampleId;
  title: string;
  receiptText: string;
  trip: TripWindow;
  extraction: ExtractionResult;
}

export const SAMPLE_IDS: readonly SampleId[] = ["signature", "clean", "outside-window"];

const isoDate = z.string().refine(isRealIsoDate, { message: "Not a real ISO date (YYYY-MM-DD)" });

const sourceLocation = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("line"), lineIndex: z.number().int().min(0) }).strict(),
  z
    .object({
      kind: z.literal("bbox"),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .strict(),
]);

export const sampleSchema = z
  .object({
    id: z.enum(["signature", "clean", "outside-window"]),
    title: z.string().min(1),
    receiptText: z.string().min(1),
    trip: z.object({ start: isoDate, end: isoDate }).strict(),
    extraction: z
      .object({
        proposedFields: z.record(z.unknown()),
        confidence: z.record(z.number().min(0).max(1)),
        sources: z.record(sourceLocation),
        rawModelOutput: z.string(),
      })
      .strict(),
  })
  .strict() as z.ZodType<Sample, z.ZodTypeDef, unknown>;

/** The three imported JSON modules, unvalidated. */
export const SAMPLES: readonly unknown[] = [signatureJson, cleanJson, outsideWindowJson];

export const SAMPLE_BLURBS: Record<SampleId, string> = {
  signature: "The AI misreads the total as $480.00. The rules cap it and deduct the beer.",
  clean: "A clean meal that every rule accepts.",
  "outside-window": "A receipt dated after the trip ended. The date rule rejects it.",
};

/** One neutral line per sample, written from visible facts only. No result is named. */
export const SAMPLE_FILM_LINES: Record<SampleId, string> = {
  signature: "Harbor Grill, 2024-03-15. Four items, printed total 48.00.",
  clean: "Corner Bistro, 2024-03-12. Three items, printed total 32.40.",
  "outside-window": "Airport Cafe, 2024-03-25. Two items, printed total 21.50.",
};

const PRICE_LINE = /^(.*?)\s{2,}(\d+\.\d{2})$/;

/** Fixed-width text row: label left, price right (20 characters). */
function priceRow(label: string, price: string): string {
  return `${label.padEnd(14)}${price.padStart(6)}`;
}

/**
 * Three to five lines for the paper thumbnail of a film sheet, taken from the recorded receipt text:
 * the merchant, the first two items with their prices and the printed total. These are inputs, not results.
 */
export function sampleThumbLines(id: SampleId): string[] {
  const sample = (SAMPLES as Array<{ id?: string; receiptText?: unknown }>).find((s) => s.id === id);
  if (sample === undefined || typeof sample.receiptText !== "string") return [];
  const rows = sample.receiptText.split("\n");
  const merchant = rows[0]?.trim() ?? "";
  const first = rows.findIndex((r) => r.startsWith("---"));
  const second = rows.findIndex((r, i) => i > first && r.startsWith("---"));
  const body = first >= 0 && second > first ? rows.slice(first + 1, second) : [];
  const priced = (row: string): string | null => {
    const m = PRICE_LINE.exec(row.trim());
    return m === null ? null : priceRow(m[1] as string, m[2] as string);
  };
  const items = body.map(priced).filter((r): r is string => r !== null).slice(0, 2);
  const total = rows.map((r) => (r.startsWith("TOTAL") ? priced(r) : null)).find((r) => r !== null) ?? null;
  return [merchant, ...items, ...(total === null ? [] : [total])].filter((r) => r.length > 0);
}

export const DEFAULT_TRIP: TripWindow = { start: "2024-03-10", end: "2024-03-20" };
