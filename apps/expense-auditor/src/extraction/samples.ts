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

export const DEFAULT_TRIP: TripWindow = { start: "2024-03-10", end: "2024-03-20" };
