import type { Anatomy } from "../src/types";

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
    receiptDate: "Receipt date",
    tripStart: "Trip start",
    tripEnd: "Trip end",
    amountCents: "Amount",
  },
  formatValue: (path, value) =>
    typeof value === "number" && /Cents$/.test(path)
      ? `EUR ${(value / 100).toFixed(2)}`
      : typeof value === "string"
        ? value
        : (JSON.stringify(value) ?? String(value)),
};
