import { describe, expect, it } from "vitest";
import {
  MAX_BODY_CHARS,
  MAX_IMAGE_BYTES,
  errorBodySchema,
  extractionResultWireSchema,
  liveStatusSchema,
  modelOutputSchema,
  toExtractionResult,
} from "../../shared/wire";

const valid = {
  merchant: "Cafe",
  receiptDate: "2024-03-05",
  claimedTotalCents: 1250,
  lineItems: [{ description: "Lunch", amount: 1250, isAlcohol: false }],
  confidence: { merchant: 0.9, receiptDate: 1, claimedTotalCents: 0, lineItems: 0.5 },
};

describe("wire contract", () => {
  it("has the size constants of the design", () => {
    expect(MAX_IMAGE_BYTES).toBe(3145728);
    expect(MAX_BODY_CHARS).toBeGreaterThan(Math.ceil((MAX_IMAGE_BYTES * 4) / 3));
  });

  it("accepts valid model output and maps it losslessly", () => {
    const parsed = modelOutputSchema.parse(valid);
    const raw = JSON.stringify(valid);
    const result = toExtractionResult(parsed, raw);
    expect(extractionResultWireSchema.safeParse(result).success).toBe(true);
    expect(result.rawModelOutput).toBe(raw);
    expect(result.sources).toEqual({});
    expect(result.proposedFields.lineItems).toEqual(valid.lineItems);
    expect(result.confidence).toEqual(valid.confidence);
  });

  it.each([
    ["extra key", { ...valid, verdict: "approved" }],
    ["confidence above 1", { ...valid, confidence: { ...valid.confidence, merchant: 1.5 } }],
    ["negative cents", { ...valid, claimedTotalCents: -1 }],
    ["fractional cents", { ...valid, lineItems: [{ description: "x", amount: 1.5, isAlcohol: false }] }],
    ["impossible date", { ...valid, receiptDate: "2024-02-30" }],
  ])("rejects %s", (_name, value) => {
    expect(modelOutputSchema.safeParse(value).success).toBe(false);
  });

  it("keeps error and status bodies strict", () => {
    expect(
      errorBodySchema.safeParse({ error: { reason: "disabled", code: "disabled", message: "off" } }).success,
    ).toBe(true);
    expect(liveStatusSchema.safeParse({ live: true, extra: 1 }).success).toBe(false);
  });
});
