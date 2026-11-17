import fc from "fast-check";

/** Real ISO calendar dates from 2000-01-01 to 2035-12-31 (UTC). */
export const arbIsoDate: fc.Arbitrary<string> = fc
  .date({
    min: new Date("2000-01-01T00:00:00Z"),
    max: new Date("2035-12-31T00:00:00Z"),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString().slice(0, 10));

export const arbCents: fc.Arbitrary<number> = fc.integer({ min: 0, max: 500_000 });
export const arbPositiveCents: fc.Arbitrary<number> = fc.integer({ min: 1, max: 500_000 });

export interface ArbTrip {
  start: string;
  end: string;
}

const DAY_MS = 86_400_000;
const addDays = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** Trip window whose end is 0 to 30 days after the start. */
export const arbTrip: fc.Arbitrary<ArbTrip> = fc
  .tuple(arbIsoDate, fc.integer({ min: 0, max: 30 }))
  .map(([start, days]) => ({ start, end: addDays(start, days) }));

export const arbLabel: fc.Arbitrary<"v1" | "v2" | "v3"> = fc.constantFrom(
  "v1" as const,
  "v2" as const,
  "v3" as const,
);

export type ArbLineItem = {
  description: string;
  amount: number;
  isAlcohol: boolean;
};

export const arbLineItem: fc.Arbitrary<ArbLineItem> = fc.record({
  description: fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,19}$/),
  amount: arbCents,
  isAlcohol: fc.boolean(),
});
export const arbLineItems: fc.Arbitrary<ArbLineItem[]> = fc.array(arbLineItem, {
  minLength: 1,
  maxLength: 8,
});

export type ArbProposal = {
  merchant: string;
  receiptDate: string;
  claimedTotalCents: number;
  lineItems: ArbLineItem[];
};

export function arbProposal(trip: ArbTrip): fc.Arbitrary<ArbProposal> {
  const inside = fc
    .integer({ min: 0, max: Math.round((Date.parse(trip.end) - Date.parse(trip.start)) / DAY_MS) })
    .map((d) => addDays(trip.start, d));
  const before = fc.integer({ min: 1, max: 30 }).map((d) => addDays(trip.start, -d));
  const after = fc.integer({ min: 1, max: 30 }).map((d) => addDays(trip.end, d));
  const receiptDate = fc.oneof(
    { weight: 6, arbitrary: inside },
    { weight: 1, arbitrary: before },
    { weight: 1, arbitrary: after },
  );
  return arbLineItems.chain((lineItems) => {
    const total = lineItems.reduce((a, i) => a + i.amount, 0);
    const claimed =
      total > 0 ? fc.oneof(fc.constant(total), arbPositiveCents) : arbPositiveCents;
    return fc.record({
      merchant: fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,19}$/),
      receiptDate,
      claimedTotalCents: claimed,
      lineItems: fc.constant(lineItems),
    });
  });
}

export interface ArbExtractionResult {
  proposedFields: ArbProposal;
  confidence: Record<string, number>;
  sources: Record<string, never>;
  rawModelOutput: string;
}

export function arbExtraction(trip: ArbTrip): fc.Arbitrary<ArbExtractionResult> {
  const conf = fc.double({ min: 0, max: 1, noNaN: true });
  return arbProposal(trip).chain((proposedFields) =>
    fc
      .record({ merchant: conf, receiptDate: conf, claimedTotalCents: conf, lineItems: conf })
      .map((confidence) => ({
        proposedFields,
        confidence,
        sources: {},
        rawModelOutput: JSON.stringify(proposedFields),
      })),
  );
}

// ---- session operations (task 16.6) ----

export interface ArbOverrideForm {
  reviewerName: string;
  reason: string;
  replacementResult: "approved" | "partially_approved" | "rejected";
}

/** A valid Override form: non-blank reviewer name and reason, reason at most 500 characters. */
export const arbOverrideForm: fc.Arbitrary<ArbOverrideForm> = fc.record({
  reviewerName: fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,19}$/),
  reason: fc.stringMatching(/^[A-Za-z][A-Za-z ,.]{0,79}$/),
  replacementResult: fc.constantFrom(
    "approved" as const,
    "partially_approved" as const,
    "rejected" as const,
  ),
});

export type ArbOp =
  | { type: "select"; label: "v1" | "v2" | "v3" }
  | { type: "override"; form: ArbOverrideForm };

export const arbOp: fc.Arbitrary<ArbOp> = fc.oneof(
  arbLabel.map((label): ArbOp => ({ type: "select", label })),
  arbOverrideForm.map((form): ArbOp => ({ type: "override", form })),
);

/** A model output object that satisfies `modelOutputSchema`. */
export interface ArbModelOutput {
  merchant: string;
  receiptDate: string;
  claimedTotalCents: number;
  lineItems: { description: string; amount: number; isAlcohol: boolean }[];
  confidence: { merchant: number; receiptDate: number; claimedTotalCents: number; lineItems: number };
}

const arbUnit: fc.Arbitrary<number> = fc.double({ min: 0, max: 1, noNaN: true });
const arbText: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 40 });

const arbModelOutputObject: fc.Arbitrary<ArbModelOutput> = fc.record({
  merchant: arbText,
  receiptDate: arbIsoDate,
  claimedTotalCents: arbCents,
  lineItems: fc.array(
    fc.record({ description: arbText, amount: arbCents, isAlcohol: fc.boolean() }),
    { minLength: 1, maxLength: 6 },
  ),
  confidence: fc.record({
    merchant: arbUnit,
    receiptDate: arbUnit,
    claimedTotalCents: arbUnit,
    lineItems: arbUnit,
  }),
});

const arbIndent: fc.Arbitrary<number | undefined> = fc.constantFrom(undefined, 0, 2, 4);

/** Valid provider text: the exact JSON string the model returns, with its parsed form. */
export const arbValidModelOutput: fc.Arbitrary<{ output: ArbModelOutput; text: string }> = fc
  .tuple(arbModelOutputObject, arbIndent)
  .map(([output, indent]) => ({ output, text: JSON.stringify(output, null, indent) }));

export type ModelOutputDefect =
  | "extra-root-key"
  | "extra-item-key"
  | "extra-confidence-key"
  | "confidence-out-of-range"
  | "negative-cents"
  | "fractional-cents"
  | "bad-date";

/** Provider text with exactly one injected defect. */
export const arbBadModelOutput: fc.Arbitrary<{ defect: ModelOutputDefect; text: string }> = fc
  .tuple(
    arbModelOutputObject,
    fc.constantFrom<ModelOutputDefect>(
      "extra-root-key",
      "extra-item-key",
      "extra-confidence-key",
      "confidence-out-of-range",
      "negative-cents",
      "fractional-cents",
      "bad-date",
    ),
    fc.nat(),
    fc.constantFrom("decision", "approved", "note", "x"),
    fc.constantFrom("claimedTotalCents", "item"),
    fc.constantFrom("merchant", "receiptDate", "claimedTotalCents", "lineItems"),
    fc.oneof(fc.double({ min: 1.0001, max: 50, noNaN: true }), fc.double({ min: -50, max: -0.0001, noNaN: true })),
    fc.integer({ min: 1, max: 100_000 }),
    fc.integer({ min: 0, max: 99_999 }),
    fc.constantFrom("2025-02-30", "2025-13-01", "14/03/2025", "2025-3-4", "yesterday", "", "2025-03-14T10:00:00Z", "0000-00-00"),
    arbIndent,
  )
  .map(([base, defect, pick, extraKey, centsTarget, confKey, badUnit, negCents, fracBase, badDate, indent]) => {
    const o = structuredClone(base) as Record<string, any>;
    const i = pick % o.lineItems.length;
    switch (defect) {
      case "extra-root-key":
        o[extraKey] = true;
        break;
      case "extra-item-key":
        o.lineItems[i][extraKey] = "x";
        break;
      case "extra-confidence-key":
        o.confidence[extraKey] = 0.5;
        break;
      case "confidence-out-of-range":
        o.confidence[confKey] = badUnit;
        break;
      case "negative-cents":
        if (centsTarget === "item") o.lineItems[i].amount = -negCents;
        else o.claimedTotalCents = -negCents;
        break;
      case "fractional-cents":
        if (centsTarget === "item") o.lineItems[i].amount = fracBase + 0.5;
        else o.claimedTotalCents = fracBase + 0.5;
        break;
      case "bad-date":
        o.receiptDate = badDate;
        break;
    }
    return { defect, text: JSON.stringify(o, null, indent) };
  });
