import { z } from "zod";
import { isRealIsoDate } from "../../shared/iso";
import type { TripWindow } from "../extraction/samples";

/** Largest accepted amount in integer cents (10^12), far below Number.MAX_SAFE_INTEGER. */
export const MAX_CENTS = 1_000_000_000_000;

export interface ProposedReceipt {
  merchant: string;
  receiptDate: string;
  claimedTotalCents: number;
  lineItems: { description: string; amount: number; isAlcohol: boolean }[];
}

/** The validated fields the rule files read. */
export interface RuleFields {
  merchant: string;
  receiptDate: string;
  claimedTotalCents: number;
  lineItems: { amount: number; description: string }[];
  lineItemSumCents: number;
  alcoholLineItems: { amount: number }[];
  alcoholLineCents: number;
  tripStart: string;
  tripEnd: string;
}

const DATE_MESSAGE = "must be a real calendar date as YYYY-MM-DD";

const cents = z
  .number()
  .int("must be a whole number of cents")
  .min(0, "must not be negative")
  .max(MAX_CENTS, "is too large");
const isoDate = z.string().refine(isRealIsoDate, DATE_MESSAGE);

export const proposedReceiptSchema: z.ZodType<ProposedReceipt, z.ZodTypeDef, unknown> = z
  .object({
    merchant: z.string().min(1).max(120),
    receiptDate: isoDate,
    claimedTotalCents: cents.refine((n) => n > 0, "must be greater than 0"),
    lineItems: z
      .array(
        z
          .object({
            description: z.string().min(1).max(200),
            amount: cents,
            isAlcohol: z.boolean(),
          })
          .strict(),
      )
      .min(1, "must contain at least one line item")
      .max(200),
  })
  .strict();

function sum(items: { amount: number }[]): number {
  let total = 0;
  for (const item of items) total += item.amount;
  return total;
}

/** Validates a proposal and derives the rule fields. Key order of the result is fixed. */
export const ruleFieldsSchema = (trip: TripWindow): z.ZodType<RuleFields, z.ZodTypeDef, unknown> =>
  proposedReceiptSchema.transform((p): RuleFields => {
    const alcohol = p.lineItems.filter((i) => i.isAlcohol).map(({ amount }) => ({ amount }));
    return {
      merchant: p.merchant,
      receiptDate: p.receiptDate,
      claimedTotalCents: p.claimedTotalCents,
      lineItems: p.lineItems.map(({ amount, description }) => ({ amount, description })),
      lineItemSumCents: sum(p.lineItems),
      alcoholLineItems: alcohol,
      alcoholLineCents: sum(alcohol),
      tripStart: trip.start,
      tripEnd: trip.end,
    };
  });

/** Non-transforming schema of the derived shape, used to recognise stored rule fields. */
export const ruleFieldsOutputSchema: z.ZodType<RuleFields, z.ZodTypeDef, unknown> = z
  .object({
    merchant: z.string(),
    receiptDate: z.string(),
    claimedTotalCents: z.number().int(),
    lineItems: z.array(z.object({ amount: z.number().int(), description: z.string() }).strict()),
    lineItemSumCents: z.number().int(),
    alcoholLineItems: z.array(z.object({ amount: z.number().int() }).strict()),
    alcoholLineCents: z.number().int(),
    tripStart: z.string(),
    tripEnd: z.string(),
  })
  .strict();

/** Problems with the trip window itself, in a fixed order. */
export function tripIssues(trip: TripWindow): { path: string; issue: string }[] {
  const issues: { path: string; issue: string }[] = [];
  const startOk = isRealIsoDate(trip.start);
  const endOk = isRealIsoDate(trip.end);
  if (!startOk) issues.push({ path: "tripStart", issue: DATE_MESSAGE });
  if (!endOk) issues.push({ path: "tripEnd", issue: DATE_MESSAGE });
  if (startOk && endOk && trip.end < trip.start) {
    issues.push({ path: "tripEnd", issue: "must not be before the trip start" });
  }
  return issues;
}
