import type { Anatomy } from "../src/types";

/** Integer-only dollar formatting: 4150 -> "$41.50", -5 -> "-$0.05". */
function formatDollars(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${grouped}.${frac < 10 ? "0" : ""}${frac}`;
}

/** Short summary of a list of `{ amount }` line items, e.g. "1 line item · $6.50". */
function summarizeItems(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  let sum = 0;
  for (const item of value) {
    const amount =
      typeof item === "object" && item !== null ? (item as { amount?: unknown }).amount : undefined;
    if (typeof amount === "number") sum += amount;
  }
  const n = value.length;
  return `${n} line ${n === 1 ? "item" : "items"} · ${formatDollars(sum)}`;
}

export const demoAnatomy: Anatomy = {
  bones: [
    { ruleId: "date-blocking-before", label: "Date before trip", region: "arm-left" },
    { ruleId: "date-blocking-after", label: "Date after trip", region: "arm-right" },
    { ruleId: "alcohol-deducting", label: "Alcohol", region: "ribs" },
    { ruleId: "meal-limit", label: "Meal limit", region: "pelvis" },
    { ruleId: "line-item-cap", label: "Line-item cap", region: "spine" },
  ],
  fieldLabels: {
    claimedTotalCents: "Claimed total",
    lineItemSumCents: "Line-item sum",
    alcoholLineCents: "Alcohol lines",
    alcoholLineItems: "Alcohol items",
    lineItems: "Line items",
    receiptDate: "Receipt date",
    tripStart: "Trip start",
    tripEnd: "Trip end",
    amountCents: "Amount",
  },
  formatValue: (path, value) => {
    if (typeof value === "number" && /Cents$/.test(path)) return formatDollars(value);
    if (path === "lineItems" || path === "alcoholLineItems") {
      const summary = summarizeItems(value);
      if (summary !== undefined) return summary;
    }
    return typeof value === "string" ? value : (JSON.stringify(value) ?? String(value));
  },
};
