import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { z } from "zod";
import { validate } from "../../validation.js";
import { evaluate } from "../../rules/evaluate.js";
import { createTrace } from "../../trace.js";
import { isCoreError } from "../../types.js";
import type { Rule, RuleSet, RuleCatalog, AmountScope } from "../../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, "../../../test-fixtures/expense");

function loadJSON<T>(relPath: string): T {
  return JSON.parse(readFileSync(join(fixturesRoot, relPath), "utf-8")) as T;
}

const rulesRoot = join(__dirname, "../../../../../rules/expense-auditor");

function loadRuleJSON<T>(rel: string): T {
  return JSON.parse(readFileSync(join(rulesRoot, rel), "utf-8")) as T;
}

// Deterministic ports for testing
const deterministicPorts = {
  clock: () => new Date("2024-01-01T00:00:00.000Z"),
  id: () => "test-decision-id-001",
  hasher: (_bytes: Uint8Array) => "a".repeat(64),
};

/** Load all 5 rules referenced by the given expense rule set into a RuleCatalog. */
function buildCatalog(mealLimitVersion = "1.0.0"): RuleCatalog {
  const catalog: RuleCatalog = new Map<string, Rule>();
  const ruleFiles: Record<string, string> = {
    "date-blocking-before@1.0.0": "rules/date-blocking-before.json",
    "date-blocking-after@1.0.0": "rules/date-blocking-after.json",
    "alcohol-deducting@1.0.0": "rules/alcohol-deducting.json",
    [`meal-limit@${mealLimitVersion}`]: `rules/meal-limit-v${mealLimitVersion[0]}.json`,
    "line-item-cap@1.0.0": "rules/line-item-cap.json",
  };
  for (const [key, file] of Object.entries(ruleFiles)) {
    catalog.set(key, loadRuleJSON<Rule>(file));
  }
  return catalog;
}

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

describe("expense signature scenario (integration)", () => {
  it.each([
    ["expense-v1", "1.0.0", 5000],
    ["expense-v2", "2.0.0", 6000],
    ["expense-v3", "3.0.0", 7500],
  ])("%s produces partially_approved with amountCents 4150", (ruleSetName, mealVersion, mealCap) => {
    const ruleSet = loadRuleJSON<RuleSet>(`rule-sets/${ruleSetName}.json`);
    const catalog = buildCatalog(mealVersion);

    // Load signature scenario fixture (what RecordedAdapter would return)
    const scenarioFixture = loadJSON<{
      proposedFields: Record<string, unknown>;
      confidence: Record<string, number>;
      sources: Record<string, unknown>;
      rawModelOutput: string;
    }>("recorded/signature-scenario.json");

    // Validate fields
    const validated = validate(scenarioFixture.proposedFields, expenseFieldSchema);
    expect(isCoreError(validated)).toBe(false);
    if (isCoreError(validated)) return;

    // The scope starts at claimedTotalCents (48000). Order: blocking, capping, deducting.
    //   1. line-item-cap: 48000 -> min(48000, 4800) = 4800
    //   2. meal-limit: 4800 -> min(4800, cap) = 4800 (cap 5000 / 6000 / 7500 all above 4800)
    //   3. alcohol-deducting: 4800 -> 4800 - 650 = 4150
    const amountScopes: AmountScope[] = [
      {
        name: "total",
        claimedCents: scenarioFixture.proposedFields["claimedTotalCents"] as number,
      },
    ];

    // Evaluate
    const decision = evaluate(validated, ruleSet, catalog, amountScopes);
    expect(isCoreError(decision)).toBe(false);
    if (isCoreError(decision)) return;

    // Core assertions
    expect(decision.result).toBe("partially_approved");
    // cap first: 48000 -> min(48000, 4800) = 4800; meal-limit no-op; then deduct 650: 4800 -> 4150
    expect(decision.amountCents).toBe(4150);
    expect(mealCap).toBeGreaterThan(4800);

    // Evaluation order: blocking, capping, deducting
    expect(decision.ruleOutcomes.map((o) => o.ruleId)).toEqual([
      "date-blocking-after",
      "date-blocking-before",
      "line-item-cap",
      "meal-limit",
      "alcohol-deducting",
    ]);

    // Per-rule amount flow
    const byId = (id: string) => decision.ruleOutcomes.find((o) => o.ruleId === id)!;
    // cap first: 48000 -> min(48000, 4800) = 4800
    expect(byId("line-item-cap").amountBeforeCents).toBe(48000);
    expect(byId("line-item-cap").amountAfterCents).toBe(4800);
    // meal-limit: 4800 -> min(4800, cap) = 4800
    expect(byId("meal-limit").amountBeforeCents).toBe(4800);
    expect(byId("meal-limit").amountAfterCents).toBe(4800);
    // then deduct 650: 4800 -> 4150
    expect(byId("alcohol-deducting").amountBeforeCents).toBe(4800);
    expect(byId("alcohol-deducting").amountAfterCents).toBe(4150);

    // Assert evidence on the line-item-cap outcome contains both totals
    const capOutcome = decision.ruleOutcomes.find((o) => o.ruleId === "line-item-cap");
    expect(capOutcome).toBeDefined();
    expect(capOutcome!.conditionMet).toBe(true);
    expect(capOutcome!.evidence).toMatchObject({
      claimedTotalCents: 48000,
      lineItemSumCents: 4800,
    });

    // Assert evidence on the alcohol-deducting outcome
    const deductOutcome = decision.ruleOutcomes.find((o) => o.ruleId === "alcohol-deducting");
    expect(deductOutcome).toBeDefined();
    expect(deductOutcome!.conditionMet).toBe(true);
    expect(deductOutcome!.deductedCents).toBe(650);

    // Rendered messages use the money filter (dollars, not raw cents)
    expect(byId("meal-limit").renderedMessage).toBe(
      `Meal limit v${mealVersion[0]}: expenses are capped at $${(mealCap / 100).toFixed(2)}. Claimed total: $480.00.`,
    );
    expect(byId("line-item-cap").renderedMessage).toBe(
      "Receipt total $480.00 does not match line items $48.00. Capped to the line-item sum.",
    );
    expect(byId("alcohol-deducting").renderedMessage).toBe(
      "Alcohol is not reimbursable: $6.50 deducted.",
    );
    if (mealVersion === "1.0.0") {
      expect(byId("meal-limit").renderedMessage).toBe(
        "Meal limit v1: expenses are capped at $50.00. Claimed total: $480.00.",
      );
    }

    // Also create a trace to exercise the full pipeline
    const rawBytes = new TextEncoder().encode(scenarioFixture.rawModelOutput);
    const extractionResult = {
      proposedFields: scenarioFixture.proposedFields,
      confidence: scenarioFixture.confidence,
      sources: scenarioFixture.sources as Record<string, undefined>,
      rawModelOutput: scenarioFixture.rawModelOutput,
    };
    const trace = createTrace(
      decision,
      extractionResult,
      ruleSet,
      validated,
      rawBytes,
      deterministicPorts
    );
    expect(isCoreError(trace)).toBe(false);
    if (isCoreError(trace)) return;

    expect(trace.result).toBe("partially_approved");
    // 48000 -> cap 4800 -> meal-limit 4800 -> deduct 650 -> 4150
    expect(trace.amountCents).toBe(4150);
    expect(trace.ruleSetVersion).toBe(ruleSet.version);
  });

  it("rejects when receipt date is before trip start", () => {
    const ruleSet = loadRuleJSON<RuleSet>("rule-sets/expense-v1.json");
    const catalog = buildCatalog();

    // Date BEFORE trip start → date-blocking-before fires
    const fields = {
      claimedTotalCents: 4800,
      lineItemSumCents: 4800,
      alcoholLineCents: 0,
      alcoholLineItems: [],
      lineItems: [{ amount: 4800 }],
      receiptDate: "2024-03-05", // before tripStart 2024-03-10
      tripStart: "2024-03-10",
      tripEnd: "2024-03-20",
    };

    const validated = validate(fields, expenseFieldSchema);
    expect(isCoreError(validated)).toBe(false);
    if (isCoreError(validated)) return;

    const amountScopes: AmountScope[] = [{ name: "total", claimedCents: 4800 }];
    const decision = evaluate(validated, ruleSet, catalog, amountScopes);
    expect(isCoreError(decision)).toBe(false);
    if (isCoreError(decision)) return;

    expect(decision.result).toBe("rejected");
    expect(decision.amountCents).toBe(0);
  });
});
