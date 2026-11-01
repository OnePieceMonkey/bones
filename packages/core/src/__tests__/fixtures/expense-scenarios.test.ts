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

// Deterministic ports for testing
const deterministicPorts = {
  clock: () => new Date("2024-01-01T00:00:00.000Z"),
  id: () => "test-decision-id-001",
  hasher: (_bytes: Uint8Array) => "a".repeat(64),
};

/** Load all 5 rules referenced by expense-v1 into a RuleCatalog. */
function buildCatalog(): RuleCatalog {
  const catalog: RuleCatalog = new Map<string, Rule>();
  const ruleFiles: Record<string, string> = {
    "date-blocking-before@1.0.0": "rules/date-blocking-before.json",
    "date-blocking-after@1.0.0": "rules/date-blocking-after.json",
    "alcohol-deducting@1.0.0": "rules/alcohol-deducting.json",
    "meal-limit@1.0.0": "rules/meal-limit-v1.json",
    "line-item-cap@1.0.0": "rules/line-item-cap.json",
  };
  for (const [key, file] of Object.entries(ruleFiles)) {
    catalog.set(key, loadJSON<Rule>(file));
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
  it("produces partially_approved with amountCents 4150", () => {
    // Load rule set
    const ruleSet = loadJSON<RuleSet>("rule-sets/expense-v1.json");
    const catalog = buildCatalog();

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

    // The scope starts at lineItemSumCents (4800), not claimedTotalCents (48000).
    // Evaluation order: deducting first, then capping.
    //   1. alcohol-deducting fires (sum alcoholLineItems = 650 > 0) → 4800 - 650 = 4150
    //   2. line-item-cap fires (claimedTotalCents 48000 ≠ lineItemSumCents 4800) → cap = 4800, min(4150, 4800) = 4150
    //   3. meal-limit v1 fires (always-true) → cap = 5000, min(4150, 5000) = 4150
    // Final: 4150, partially_approved (4150 < 4800 claimed)
    const amountScopes: AmountScope[] = [
      {
        name: "total",
        claimedCents: scenarioFixture.proposedFields["lineItemSumCents"] as number,
      },
    ];

    // Evaluate
    const decision = evaluate(validated, ruleSet, catalog, amountScopes);
    expect(isCoreError(decision)).toBe(false);
    if (isCoreError(decision)) return;

    // Core assertions
    expect(decision.result).toBe("partially_approved");
    expect(decision.amountCents).toBe(4150);

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
    expect(trace.amountCents).toBe(4150);
    expect(trace.ruleSetVersion).toBe("1.0.0");
  });

  it("rejects when receipt date is before trip start", () => {
    const ruleSet = loadJSON<RuleSet>("rule-sets/expense-v1.json");
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
