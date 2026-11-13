import type { RuleOutcome, Trace } from "@bones/core";
import type { Anatomy } from "../../types";

/** Hand-built trace mirroring the demo at rule set v1 (two fractured bones). */
export function signatureTrace(): Trace {
  const ruleOutcomes: RuleOutcome[] = [
    {
      ruleId: "date-blocking-after",
      ruleVersion: "1.0.0",
      effect: "blocking",
      conditionMet: false,
      evidence: { "receipt.date": "2024-05-14" },
      renderedMessage: "Receipt date is not after the claim window.",
    },
    {
      ruleId: "date-blocking-before",
      ruleVersion: "1.0.0",
      effect: "blocking",
      conditionMet: false,
      evidence: { "receipt.date": "2024-05-14" },
      renderedMessage: "Receipt date is not before the claim window.",
    },
    {
      ruleId: "line-item-cap",
      ruleVersion: "1.0.0",
      effect: "capping",
      conditionMet: true,
      evidence: { "receipt.lineItems.0.amountCents": 48000 },
      renderedMessage: "A line item may not exceed 4800 cents.",
      appliedCapCents: 4800,
      amountBeforeCents: 48000,
      amountAfterCents: 4800,
    },
    {
      ruleId: "meal-limit",
      ruleVersion: "1.0.0",
      effect: "capping",
      conditionMet: true,
      evidence: { "receipt.totalCents": 4800 },
      renderedMessage: "Meals are limited to 4800 cents.",
      appliedCapCents: 4800,
      amountBeforeCents: 4800,
      amountAfterCents: 4800,
    },
    {
      ruleId: "alcohol-deducting",
      ruleVersion: "1.0.0",
      effect: "deducting",
      conditionMet: true,
      evidence: { "receipt.alcoholCents": 650 },
      renderedMessage: "Alcohol of 650 cents is not reimbursable.",
      deductedCents: 650,
      amountBeforeCents: 4800,
      amountAfterCents: 4150,
    },
  ];
  return {
    traceSchemaVersion: "1",
    decisionId: "decision-0001",
    createdAt: "2024-05-15T10:00:00.000Z",
    inputHash: "0".repeat(64),
    rawModelOutput: '{"merchant":"Trattoria Roma","totalCents":48000}',
    proposedFields: {
      "receipt.merchant": "Trattoria Roma",
      "receipt.date": "2024-05-14",
      "receipt.totalCents": 48000,
    },
    confidence: {
      "receipt.merchant": 0.97,
      "receipt.date": 0.91,
      "receipt.totalCents": 0.88,
    },
    sources: {
      "receipt.merchant": { kind: "line", lineIndex: 0 },
      "receipt.date": { kind: "line", lineIndex: 1 },
      "receipt.totalCents": { kind: "bbox", x: 10, y: 20, width: 100, height: 16 },
    },
    validatedFields: {
      "receipt.merchant": "Trattoria Roma",
      "receipt.date": "2024-05-14",
      "receipt.totalCents": 48000,
    },
    ruleSetId: "expense",
    ruleSetVersion: "1.0.0",
    ruleOutcomes,
    result: "partially_approved",
    amountCents: 4150,
  };
}

export function signatureAnatomy(): Anatomy {
  return {
    bones: [
      { ruleId: "date-blocking-after", label: "Date not too late", region: "skull" },
      { ruleId: "date-blocking-before", label: "Date not too early", region: "spine" },
      { ruleId: "line-item-cap", label: "Line item cap", region: "ribs" },
      { ruleId: "meal-limit", label: "Meal limit", region: "pelvis" },
      { ruleId: "alcohol-deducting", label: "Alcohol deduction", region: "arm-left" },
    ],
    fieldLabels: {
      "receipt.merchant": "Merchant",
      "receipt.date": "Date",
      "receipt.totalCents": "Total",
    },
  };
}
