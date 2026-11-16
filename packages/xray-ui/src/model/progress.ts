import type { DecisionResult } from "../types";
import { resultLabel } from "./format";
import type { Formatter } from "./format";

/**
 * Filled share of the progress bar, in [0, 1].
 * Returns 0 for a claimed amount that is not a positive integer, and never NaN.
 */
export function progressShare(approvedCents: number, claimedCents: number): number {
  if (!Number.isInteger(claimedCents) || claimedCents <= 0) return 0;
  if (!Number.isFinite(approvedCents) || approvedCents <= 0) return 0;
  if (approvedCents >= claimedCents) return 1;
  return approvedCents / claimedCents;
}

/** Result label, one space, then the formatted amount (e.g. "PARTIALLY APPROVED $41.50"). */
export function resultLine(result: DecisionResult, cents: number, format: Formatter): string {
  return `${resultLabel(result)} ${format("amountCents", cents)}`;
}
