import { z } from "zod";
import { validate, evaluate, createTrace, isCoreError } from "@bones/core";
import type {
  AmountScope,
  ExtractionResult,
  Rule,
  RuleCatalog,
  RuleSet,
  Trace,
} from "@bones/core";
import dateBlockingBefore from "../../core/test-fixtures/expense/rules/date-blocking-before.json";
import dateBlockingAfter from "../../core/test-fixtures/expense/rules/date-blocking-after.json";
import alcoholDeducting from "../../core/test-fixtures/expense/rules/alcohol-deducting.json";
import mealLimitV1 from "../../core/test-fixtures/expense/rules/meal-limit-v1.json";
import mealLimitV2 from "../../core/test-fixtures/expense/rules/meal-limit-v2.json";
import mealLimitV3 from "../../core/test-fixtures/expense/rules/meal-limit-v3.json";
import lineItemCap from "../../core/test-fixtures/expense/rules/line-item-cap.json";
import expenseV1 from "../../core/test-fixtures/expense/rule-sets/expense-v1.json";
import expenseV2 from "../../core/test-fixtures/expense/rule-sets/expense-v2.json";
import expenseV3 from "../../core/test-fixtures/expense/rule-sets/expense-v3.json";
import scenario from "../../core/test-fixtures/expense/recorded/signature-scenario.json";

export const VERSIONS = ["v1", "v2", "v3"] as const;
export type DemoVersion = (typeof VERSIONS)[number];

const expenseFieldSchema = z.object({
  claimedTotalCents: z.number(),
  lineItemSumCents: z.number(),
  alcoholLineCents: z.number(),
  alcoholLineItems: z.array(z.object({ amount: z.number() })),
  lineItems: z.array(z.object({ amount: z.number() })),
  receiptDate: z.string(),
  tripStart: z.string(),
  tripEnd: z.string(),
});

const ruleSets: Record<DemoVersion, RuleSet> = {
  v1: expenseV1 as unknown as RuleSet,
  v2: expenseV2 as unknown as RuleSet,
  v3: expenseV3 as unknown as RuleSet,
};

const ports = {
  clock: () => new Date("2024-01-01T00:00:00.000Z"),
  id: () => "demo-decision-001",
  hasher: (_bytes: Uint8Array) => "a".repeat(64),
};

export function buildCatalog(): RuleCatalog {
  const catalog: RuleCatalog = new Map<string, Rule>();
  const entries: Array<[string, unknown]> = [
    ["date-blocking-before@1.0.0", dateBlockingBefore],
    ["date-blocking-after@1.0.0", dateBlockingAfter],
    ["alcohol-deducting@1.0.0", alcoholDeducting],
    ["meal-limit@1.0.0", mealLimitV1],
    ["meal-limit@2.0.0", mealLimitV2],
    ["meal-limit@3.0.0", mealLimitV3],
    ["line-item-cap@1.0.0", lineItemCap],
  ];
  for (const [key, rule] of entries) catalog.set(key, rule as unknown as Rule);
  return catalog;
}

export function buildTrace(version: DemoVersion): Trace {
  const validated = validate(scenario.proposedFields, expenseFieldSchema);
  if (isCoreError(validated)) {
    throw new Error(`demo validation failed: ${JSON.stringify(validated)}`);
  }

  const amountScopes: AmountScope[] = [
    { name: "total", claimedCents: scenario.proposedFields.claimedTotalCents },
  ];
  const ruleSet = ruleSets[version];
  const decision = evaluate(validated, ruleSet, buildCatalog(), amountScopes);
  if (isCoreError(decision)) {
    throw new Error(`demo evaluation failed: ${JSON.stringify(decision)}`);
  }

  const extraction = {
    proposedFields: scenario.proposedFields,
    confidence: scenario.confidence,
    sources: scenario.sources,
    rawModelOutput: scenario.rawModelOutput,
  } as unknown as ExtractionResult;

  const trace = createTrace(
    decision,
    extraction,
    ruleSet,
    validated,
    new TextEncoder().encode(scenario.rawModelOutput),
    ports,
  );
  if (isCoreError(trace)) {
    throw new Error(`demo trace failed: ${JSON.stringify(trace)}`);
  }
  return trace;
}
