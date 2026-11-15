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
