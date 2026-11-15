import type { Anatomy } from "@bones/xray-ui";
import { formatValue } from "./format/formatValue";

/** One bone per expense rule; labels are plain English. */
export const anatomy: Anatomy = {
  bones: [
    { ruleId: "date-blocking-before", label: "Date before trip", region: "spine" },
    { ruleId: "date-blocking-after", label: "Date after trip", region: "spine" },
    { ruleId: "alcohol-deducting", label: "Alcohol", region: "pelvis" },
    { ruleId: "meal-limit", label: "Meal limit", region: "ribs" },
    { ruleId: "line-item-cap", label: "Line-item match", region: "arm-right" },
  ],
  fieldLabels: {
    merchant: "Merchant",
    receiptDate: "Receipt date",
    claimedTotalCents: "Claimed total",
    lineItems: "Line items",
    lineItemSumCents: "Line-item total",
    alcoholLineCents: "Alcohol amount",
    alcoholLineItems: "Alcohol line items",
    tripStart: "Trip start",
    tripEnd: "Trip end",
    amountCents: "Amount",
    "lineItems[*].amount_sum": "Line-item total",
    "alcoholLineItems[*].amount_sum": "Alcohol total",
  },
  formatValue,
};
