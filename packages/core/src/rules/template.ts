import type { ValidatedFields } from "../types.js";
import { getPath } from "./ast.js";

export const DEFAULT_CURRENCY_SYMBOL = "$";
/** Slot syntax: everything between {{ and }}. */
const SLOT = /\{\{([^}]+)\}\}/g;

/** Pure. Precondition: Number.isSafeInteger(cents). Integer arithmetic only, never floats. */
export function formatMoney(cents: number, symbol: string): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const frac = abs % 100;
  const whole = (abs - frac) / 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${symbol}${grouped}.${frac < 10 ? "0" : ""}${frac}`;
}

/**
 * Renders a messageTemplate by substituting {{path}} and {{path | money}} slots.
 * Missing paths render "". Unknown filters and non-integer values render the plain value.
 */
export function renderTemplate(
  template: string,
  fields: ValidatedFields,
  currencySymbol: string = DEFAULT_CURRENCY_SYMBOL,
): string {
  return template.replace(SLOT, (_m, inner: string) => {
    const bar = inner.indexOf("|");
    const path = (bar < 0 ? inner : inner.slice(0, bar)).trim();
    const filter = bar < 0 ? undefined : inner.slice(bar + 1).trim();
    const val = getPath(fields, path);
    if (val === undefined) return "";
    if (filter === "money" && typeof val === "number" && Number.isSafeInteger(val)) {
      return formatMoney(val, currencySymbol);
    }
    return String(val);
  });
}
