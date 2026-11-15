import { defaultFormat } from "@bones/xray-ui";
import { formatDate, isRealIsoDate } from "./dates";
import { formatCents, isCentsPath } from "./money";

const LINE_ITEM_PATHS = new Set(["lineItems", "alcoholLineItems"]);
const DATE_PATHS = new Set(["receiptDate", "tripStart", "tripEnd"]);

/** Value_Summary "<n> line item(s) · <sum as dollars>", or null when the value is not a line item list. */
function summariseLineItems(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  let sum = 0;
  for (const item of value as unknown[]) {
    if (typeof item !== "object" || item === null) return null;
    const amount = (item as { amount?: unknown }).amount;
    if (typeof amount !== "number" || !Number.isSafeInteger(amount)) return null;
    sum += amount;
    if (!Number.isSafeInteger(sum)) return null;
  }
  const n = value.length;
  if (n === 0) return `No line items · ${formatCents(0)}`;
  return `${n} line ${n === 1 ? "item" : "items"} · ${formatCents(sum)}`;
}

function applyRules(path: string, value: unknown): string {
  if (LINE_ITEM_PATHS.has(path)) {
    const summary = summariseLineItems(value);
    if (summary !== null) return summary;
  }
  if (isCentsPath(path) && typeof value === "number" && Number.isSafeInteger(value)) {
    return formatCents(value);
  }
  if (DATE_PATHS.has(path) && typeof value === "string" && isRealIsoDate(value)) {
    return formatDate(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return defaultFormat(path, value);
}

/** Total: never throws, always returns a string. */
export function formatValue(path: string, value: unknown): string {
  try {
    return applyRules(path, value);
  } catch {
    try {
      return defaultFormat(path, value);
    } catch {
      return "";
    }
  }
}
