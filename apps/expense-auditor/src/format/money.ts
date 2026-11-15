import { formatMoney } from "@bones/core";

/** Dollars with thousands separators, integer arithmetic only: 4150 gives "$41.50". */
export const formatCents = (cents: number): string => formatMoney(cents, "$");

/** True for paths that carry cents: `*Cents`, `*_sum` and `amount`. */
export function isCentsPath(path: string): boolean {
  return /Cents$/.test(path) || path.endsWith("_sum") || path === "amount";
}
