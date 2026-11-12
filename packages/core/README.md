# @bones/core

The Bones decision kernel. Extracts structured fields from raw input, validates them, evaluates versioned declarative rules, and records every decision as an immutable trace.

## Install

From within the monorepo, add the package to a workspace app or package:

```
pnpm add @bones/core
```

`@bones/core` exports TypeScript source directly (the `exports` field points at `./src/index.ts`). Consumers build it through `tsx`, Vite, or any bundler that handles `.ts` imports — no separate compilation step is needed.

## Concepts

**Port injection** — `createTrace`, `replay`, and `override` receive a `KernelPorts` object (`{ clock, id, hasher }`). This keeps `evaluate()` a pure function — no I/O, no randomness, no `Date.now()`. Tests inject deterministic stubs so every trace is reproducible.

**Rules as data** — Rules are plain JSON objects versioned with `MAJOR.MINOR.PATCH`. A `RuleSet` pins exact rule versions by `{ ruleId, ruleVersion }` references. The same `ValidatedFields` + same `RuleSet` version always produces the same `Decision`. Rules are evaluated in the order blocking, capping, deducting (ascending `rule.id` within each group). Capping and deducting outcomes carry `amountBeforeCents` and `amountAfterCents`, the running amount in the rule's scope before and after that rule (integer cents; absent on blocking outcomes).

**Trace immutability** — `createTrace` returns a deep-frozen `Trace` object. Any mutation attempt throws in strict mode (or silently no-ops). Overrides never touch the original trace — they are separate linked records.

## Usage

```typescript
import { z } from "zod";
import {
  validate, evaluate, createTrace,
  isCoreError,
} from "@bones/core";
import type { Rule, RuleSet, RuleCatalog, AmountScope, KernelPorts } from "@bones/core";

// 1. Define a rule
const capRule: Rule = {
  id: "budget-cap",
  version: "1.0.0",
  effect: "capping",
  condition: { kind: "comparison", left: { kind: "literal", value: true }, op: "==", right: { kind: "literal", value: true } },
  effectConfig: { cap: 5000, scope: "total" },
  messageTemplate: "Budget capped at 5000 cents.",
};

// 2. Build a catalog and rule set
const catalog: RuleCatalog = new Map();
catalog.set("budget-cap@1.0.0", capRule);

const ruleSet: RuleSet = {
  id: "demo",
  version: "1.0.0",
  rules: [{ ruleId: "budget-cap", ruleVersion: "1.0.0" }],
};

// 3. Validate proposed fields with a Zod schema
const schema = z.object({ totalCents: z.number().int().positive() });
const proposed = { totalCents: 8000 };
const validated = validate(proposed, schema);
if (isCoreError(validated)) throw new Error(validated.message);

// 4. Evaluate
const scopes: AmountScope[] = [{ name: "total", claimedCents: proposed.totalCents }];
const decision = evaluate(validated, ruleSet, catalog, scopes);
if (isCoreError(decision)) throw new Error(decision.message);

console.log(decision.result);      // "partially_approved"
console.log(decision.amountCents); // 5000

// 5. Create a Trace with injected ports
const ports: KernelPorts = {
  clock: () => new Date(),
  id: () => crypto.randomUUID(),
  hasher: (b) => Array.from(b).map(x => x.toString(16).padStart(2,"0")).join("").slice(0,64),
};
const extraction = { proposedFields: proposed, confidence: { totalCents: 0.98 }, sources: {}, rawModelOutput: JSON.stringify(proposed) };
const rawBytes = new TextEncoder().encode(extraction.rawModelOutput);
const trace = createTrace(decision, extraction, ruleSet, validated, rawBytes, ports);
if (isCoreError(trace)) throw new Error(trace.message);

console.log(trace.traceSchemaVersion); // "1"
console.log(trace.result);             // "partially_approved"
```

## Bug tracking

Property-test failures are recorded in `.kiro/specs/core/bugs-found.md` with the failing counterexample, root cause, and fix — never weaken a property to hide a bug.
