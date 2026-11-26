import { z } from "zod";
import { isRealIsoDate } from "./iso.js";

/** Wire contract of GET/POST /api/extract, shared by `src` and `api`. */

/** Largest accepted decoded image size (Requirement 16.12). */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
/** Base64 of 3 MiB is 4 194 304 characters, plus the JSON wrapper. */
export const MAX_BODY_CHARS = 4_300_000;
export const MEDIA_TYPES = ["image/jpeg", "image/png"] as const;

export const extractRequestSchema = z
  .object({ imageBase64: z.string().min(1), mediaType: z.enum(MEDIA_TYPES) })
  .strict();

const MAX_CENTS = 1_000_000_000_000;
const centsSchema = z
  .number()
  .int("must be a whole number of cents")
  .min(0, "must not be negative")
  .max(MAX_CENTS, "is too large");
const unit = z.number().min(0).max(1);

/** What the model may return. It has no decision, approval or verdict field (Requirement 16.6). */
export const modelOutputSchema = z
  .object({
    merchant: z.string().min(1).max(120),
    receiptDate: z.string().refine(isRealIsoDate, "must be a real calendar date as YYYY-MM-DD"),
    claimedTotalCents: centsSchema,
    lineItems: z
      .array(
        z
          .object({
            description: z.string().min(1).max(200),
            amount: centsSchema,
            isAlcohol: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    confidence: z
      .object({
        merchant: unit,
        receiptDate: unit,
        claimedTotalCents: unit,
        lineItems: unit,
      })
      .strict(),
  })
  .strict();

const sourceLocationSchema = z.union([
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

export const extractionResultWireSchema = z
  .object({
    proposedFields: z
      .object({
        merchant: z.string(),
        receiptDate: z.string(),
        claimedTotalCents: z.number(),
        lineItems: z.array(
          z.object({ description: z.string(), amount: z.number(), isAlcohol: z.boolean() }).strict(),
        ),
      })
      .strict(),
    confidence: z.record(z.number().min(0).max(1)),
    sources: z.record(sourceLocationSchema),
    rawModelOutput: z.string(),
  })
  .strict();

export const ERROR_CODES = [
  "disabled",
  "forbidden_origin",
  "method_not_allowed",
  "bad_request",
  "too_large",
  "rate_limited",
  "upstream_failed",
  "model_output_invalid",
] as const;

export const errorBodySchema = z
  .object({
    error: z
      .object({
        reason: z.enum(["disabled", "network", "bad_response", "upstream"]),
        code: z.enum(ERROR_CODES),
        message: z.string(),
      })
      .strict(),
  })
  .strict();

export const liveStatusSchema = z.object({ live: z.boolean() }).strict();

export type ModelOutput = z.infer<typeof modelOutputSchema>;
export type ExtractionResultWire = z.infer<typeof extractionResultWireSchema>;

/** Maps validated model output to the extraction result. Sources stay empty for photos. */
export function toExtractionResult(model: ModelOutput, rawText: string): ExtractionResultWire {
  return {
    proposedFields: {
      merchant: model.merchant,
      receiptDate: model.receiptDate,
      claimedTotalCents: model.claimedTotalCents,
      lineItems: model.lineItems.map((i) => ({
        description: i.description,
        amount: i.amount,
        isAlcohol: i.isAlcohol,
      })),
    },
    confidence: { ...model.confidence },
    sources: {},
    rawModelOutput: rawText,
  };
}
