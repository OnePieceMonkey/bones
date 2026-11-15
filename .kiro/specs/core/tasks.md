# Implementation Plan: packages/core

## Overview

Build `@bones/core` — the pure TypeScript decision kernel of the Bones platform — in strict dependency order. Each task produces a slice of working, tested code that integrates cleanly into the previous slice. No orphaned code is produced at any step. The kernel is complete when `pnpm test` passes for all 13 tasks and the public barrel exports every type and function.

**Language**: TypeScript 5.4.5, strict mode, pnpm workspace.
**Test runner**: Vitest 1.6.0 with fast-check 3.19.0 for property-based tests.
**Bug tracking**: If a property test finds a failing example, fix the implementation and record the bug in `.kiro/specs/core/bugs-found.md` (property number, counterexample, root cause, fix).

---

## Tasks

- [x] 1. Workspace and package setup
  - [x] 1.1 Create `packages/core/` directory with `package.json` for `@bones/core`
    - Set `"name": "@bones/core"`, `"version": "0.1.0"`, `"type": "module"`
    - Set `"exports": { ".": "./src/index.ts" }` (TypeScript source export for workspace consumers)
    - Add scripts: `"test": "vitest --run"`, `"test:watch": "vitest"`, `"coverage": "vitest --run --coverage"`
    - Pin exact versions in `dependencies`: `zod@3.23.8`
    - Pin exact versions in `devDependencies`: `typescript@5.4.5`, `vitest@1.6.0`, `@vitest/coverage-v8@1.6.0`, `fast-check@3.19.0`
    - _Requirements: none (infrastructure)_
  - [x] 1.2 Create `packages/core/tsconfig.json` with strict TypeScript settings
    - Set `"target": "ES2022"`, `"module": "ESNext"`, `"moduleResolution": "bundler"`
    - Enable `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`, `"isolatedModules": true`
    - Set `"outDir": "dist"`, `"rootDir": "src"`, `"include": ["src", "test-fixtures"]`, `"exclude": ["node_modules", "dist"]`
    - _Requirements: none (infrastructure)_
  - [x] 1.3 Create `packages/core/vitest.config.ts`
    - Configure `globals: false`, `environment: "node"`
    - Configure coverage provider `"v8"`, include `"src/**"`, exclude `"src/index.ts"`
    - _Requirements: none (infrastructure)_
  - [x] 1.4 Install dependencies and write a smoke test
    - Run `pnpm install` from the workspace root to install pinned deps
    - Create `src/__tests__/smoke.test.ts` with a single assertion: `expect(1 + 1).toBe(2)`
    - Create a minimal `src/index.ts` stub (empty export) so TypeScript does not error
    - Run `pnpm --filter @bones/core test` and confirm it passes
    - Commit: `git add packages/core && git commit -m "chore: scaffold @bones/core package"`
    - _Requirements: none (infrastructure)_

- [x] 2. Shared types
  - [x] 2.1 Create `src/types.ts` with all primitive and extraction types
    - Define `Confidence` as `number` with a JSDoc comment `[0, 1]`
    - Define `SourceLocation` as the discriminated union (`kind: "line"` | `kind: "bbox"`)
    - Define `ProposedFields = Record<string, unknown>` and `ValidatedFields = Record<string, unknown>`
    - Define `ExtractionResult` interface with `proposedFields`, `confidence`, `sources`, `rawModelOutput`
    - _Requirements: 1.1, 1.3_
  - [x] 2.2 Add rule-related types to `src/types.ts`
    - Define `RuleEffect`, `BlockingConfig`, `CappingConfig`, `DeductingConfig`
    - Define `Rule`, `RuleRef`, `RuleSet`, `RuleCatalog` (as `Map<string, Rule>`)
    - Define `LiteralOrPath`, `ComparisonOp`, and `ConditionNode` (all four node kinds)
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [x] 2.3 Add Decision, Trace, Override, port, and error types to `src/types.ts`
    - Define `DecisionResult`, `AmountScope`, `RuleOutcome`, `Decision`
    - Define `TRACE_SCHEMA_VERSION = "1" as const` and all 14 `Trace` fields as `readonly`
    - Define `Override` with all `readonly` fields
    - Define `KernelPorts` interface (`clock`, `id`, `hasher`)
    - Define `CoreError` discriminated union with all 15 variants and their variant-specific fields
    - Define `CORE_ERROR_KINDS` set and `isCoreError(v: unknown): v is CoreError` type guard
    - Update `src/index.ts` to re-export every type and constant from `types.ts`
    - Commit: `git add packages/core && git commit -m "feat: add all shared types"`
    - _Requirements: 4.6, 5.1, 5.4, 6.2, 7.1, 8.1, 8.3, 8.4_

- [x] 3. Condition AST and `evaluateCondition`
  - [x] 3.1 Implement `getPath` helper and `evaluateCondition` in `src/rules/ast.ts`
    - Implement `getPath(fields: ValidatedFields, path: string): unknown` — dot-split, segment-by-segment descent, returns `undefined` on missing segment, never throws
    - Implement `evaluateCondition(node: ConditionNode, fields: ValidatedFields)` returning `{ result: boolean; evidence: Record<string, unknown> } | CoreError`
    - Handle `comparison`: resolve `LiteralOrPath` sides, apply `ComparisonOp`, collect evidence, validate path segments ≤ 10; return `"invalid_condition_ast"` CoreError on > 10 segments
    - Handle `sum`: resolve collection path to array, sum numeric values of named field, ignore non-numeric, collect evidence
    - Handle `date_in_range`: resolve three ISO 8601 strings, compare dates, collect evidence; return `"invalid_condition_ast"` CoreError on invalid date strings
    - Handle `membership`: resolve valueField, deep-equal via `JSON.stringify`, collect evidence
    - Return `CoreError("invalid_condition_ast")` for any other `node.kind`
    - _Requirements: 3.4, 3.5, 4.7_
  - [ ]* 3.2 Write unit tests for `evaluateCondition` in `src/__tests__/rules/ast.test.ts`
    - Test each of the four node kinds with passing and failing conditions
    - Test `comparison` with literal on both sides, path on both sides, and mixed
    - Test `sum` with empty array, all-numeric array, mixed-type array
    - Test `date_in_range` with boundary dates (equal start, equal end, one day outside)
    - Test `membership` with object elements (deep equality via JSON)
    - Test unknown `kind` returns `CoreError("invalid_condition_ast")`
    - Test path with > 10 segments returns `CoreError("invalid_condition_ast")`
    - _Requirements: 3.4, 3.5, 4.7_
  - Commit: `git add packages/core && git commit -m "feat: implement Condition AST evaluator"`

- [x] 4. `validate()`
  - [x] 4.1 Implement `validate` in `src/validation.ts`
    - Duck-type check: if `typeof schema?.parse !== "function"`, return `CoreError("validation_failed", "Invalid schema object provided", fieldErrors: [])`
    - Call `schema.safeParse(proposedFields)`
    - On success: return `result.data as ValidatedFields`
    - On failure: map `result.error.issues` to `{ path: issue.path.join("."), issue: issue.message }[]`, return `CoreError("validation_failed", …, fieldErrors)`
    - Export `validate` from `src/index.ts`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 4.2 Write unit tests for `validate` in `src/__tests__/validation.test.ts`
    - Test all-pass: schema accepts input → returns `ValidatedFields`
    - Test partial-fail: one field fails → `CoreError("validation_failed")` with correct `fieldErrors`
    - Test empty `proposedFields` + required schema fields → `CoreError` listing each missing field
    - Test empty `proposedFields` + no-required schema → returns empty `ValidatedFields`
    - Test invalid schema argument (plain object, string, undefined) → `CoreError("validation_failed")`
    - Test nested field failure: `fieldErrors[].path` uses dot notation
    - _Requirements: 2.1, 2.2, 2.4, 2.5_
  - Commit: `git add packages/core && git commit -m "feat: implement validate()"`

- [x] 5. `evaluate()`
  - [x] 5.1 Implement `evaluate` in `src/rules/evaluate.ts`
    - Implement `renderTemplate(template, fields)`: replace `{{fieldPath}}` slots via `getPath`; missing path → `""`
    - Step 1 — Resolve refs: look up every `{ ruleId, ruleVersion }` in `ruleSet.rules` using key `${ruleId}@${ruleVersion}`; return `CoreError("rule_not_found")` on first miss
    - Step 2 — Partition and sort: split into `blocking[]`, `deducting[]`, `capping[]`; sort each bucket by `rule.id` lexicographically
    - Step 3 — Blocking pass: iterate sorted blocking rules; on first `conditionMet === true`, return `{ result: "rejected", amountCents: 0, ruleOutcomes: [outcome] }` immediately; remaining blocking rules record `conditionMet: false` in the full outcome list
    - Step 4 — Deducting pass: for each deducting rule (sorted), if `conditionMet === true` subtract `effectConfig.deductionAmount` from the matching `AmountScope`, clamped to `≥ 0`
    - Step 5 — Capping pass: for each capping rule (sorted), if `conditionMet === true` evaluate `effectConfig.cap` (constant or AST expression) to get `capCents`; track minimum cap per scope; apply `Math.min(scopeAmount, minCap)`, clamped to `≥ 0`
    - Step 6 — Build Decision: sum scope amounts for `amountCents`; result is `"partially_approved"` if any scope final < `claimedCents`, else `"approved"`; return `Decision` with full `ruleOutcomes`
    - Export `evaluate` from `src/index.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_
  - [ ]* 5.2 Write unit tests for `evaluate` in `src/__tests__/rules/evaluate.test.ts`
    - Test blocking rule triggers `"rejected"`, skips remaining rules
    - Test deducting rule subtracts amount and clamps to 0
    - Test capping rule applies lowest cap per scope
    - Test `"approved"` path (no reductions)
    - Test `"partially_approved"` path (deduction only, cap only, both)
    - Test missing rule ref returns `CoreError("rule_not_found")`
    - Test `messageTemplate` rendering: present field substituted, absent field → `""`
    - Test RuleSet with 0 rules returns `"approved"` at claimed total
    - _Requirements: 4.1–4.9, 4.11_
  - Commit: `git add packages/core && git commit -m "feat: implement evaluate()"`

- [x] 6. Checkpoint — first pipeline slice
  - Ensure all tests pass: `pnpm --filter @bones/core test`
  - Confirm no TypeScript errors: `pnpm --filter @bones/core exec tsc --noEmit`
  - Ask the user if any questions arise before continuing.

- [x] 7. Trace creation
  - [x] 7.1 Implement `createTrace` in `src/trace.ts`
    - Implement `deepFreeze<T>(obj: T): Readonly<T>` using `Object.getOwnPropertyNames` recursive freeze
    - Implement `createTrace(decision, extractionResult, ruleSet, validatedFields, ports: KernelPorts): Trace | CoreError`
    - Wrap all port calls (`ports.clock()`, `ports.id()`, `ports.hasher(bytes)`) in try/catch; return appropriate `CoreError` on any exception without returning a partial Trace
    - Compute `inputHash` by encoding `extractionResult.rawModelOutput` to `Uint8Array` and passing to `ports.hasher`
    - Set all 14 Trace fields; set `traceSchemaVersion` to `TRACE_SCHEMA_VERSION`
    - Call `deepFreeze` on the Trace before returning
    - Export `createTrace` and `TRACE_SCHEMA_VERSION` from `src/index.ts`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 7.2 Write unit tests for `createTrace` in `src/__tests__/trace.test.ts`
    - Test all 14 Trace fields are present and have correct values
    - Test returned Trace is frozen (`Object.isFrozen`)
    - Test nested objects (`ruleOutcomes`, `proposedFields`) are also frozen
    - Test `clock` port throwing → `CoreError` returned, no partial Trace
    - Test `id` port throwing → `CoreError` returned
    - Test `hasher` port throwing → `CoreError` returned
    - Test deterministic ports + identical inputs → identical `JSON.stringify` output
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - Commit: `git add packages/core && git commit -m "feat: implement createTrace()"`

- [x] 8. Replay
  - [x] 8.1 Implement `replay` in `src/replay.ts`
    - Guard: if `ruleSet`, `catalog`, or `ruleSetVersion` is absent/null, return `CoreError("invalid_replay_arguments", …, missingField: "<which field>")`
    - Guard: if `trace.traceSchemaVersion !== TRACE_SCHEMA_VERSION`, return `CoreError("trace_schema_mismatch", …, found, expected)`
    - Call `evaluate(trace.validatedFields, ruleSet, catalog, amountScopes)` — derive `amountScopes` from the trace's stored `amountCents` or pass through from the caller; document the chosen approach
    - Build a new Trace using `createTrace` with fresh ports, copying all extraction fields from the original Trace unchanged
    - Never modify the original Trace
    - Export `replay` from `src/index.ts`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ]* 8.2 Write unit tests for `replay` in `src/__tests__/replay.test.ts`
    - Test round-trip: replay with same ruleSet/catalog → new Trace with equal `result` and `amountCents`, identical extraction fields
    - Test `trace_schema_mismatch` when trace has wrong `traceSchemaVersion`
    - Test `invalid_replay_arguments` for null `ruleSet`, null `catalog`, null `ruleSetVersion`
    - Test original Trace is not mutated after `replay`
    - Test replayed Trace has fresh `decisionId` and `createdAt` from ports
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - Commit: `git add packages/core && git commit -m "feat: implement replay()"`

- [x] 9. Override and `effectiveResult`
  - [x] 9.1 Implement `override` and `effectiveResult` in `src/override.ts`
    - `override(trace, { reviewerName, reason, replacementResult }, metadata?, ports)`:
      - Validate `reviewerName`: non-empty, not all-whitespace → `CoreError("invalid_override_input", …, field: "reviewerName")` on failure
      - Validate `reason`: non-empty, not all-whitespace, ≤ 500 characters → `CoreError("invalid_override_input", …, field: "reason")` on failure
      - Create and return `Override` object linked via `trace.decisionId`; never modify `trace`
    - `effectiveResult(trace, overrides: Override[]): DecisionResult | CoreError`:
      - Empty array → return `trace.result`
      - Non-empty → find Override with latest `createdAt` (parse ISO 8601 string to `Date` for comparison)
      - Tie (two or more identical `createdAt`) → return `CoreError("ambiguous_override", …, createdAt: <tied value>)`
      - Otherwise return `replacementResult` of the latest Override
    - Export `override` and `effectiveResult` from `src/index.ts`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [ ]* 9.2 Write unit tests for `override` and `effectiveResult` in `src/__tests__/override.test.ts`
    - Test `override` creates Override linked by `decisionId`
    - Test original Trace is not mutated after `override`
    - Test `invalid_override_input` for empty `reviewerName`, whitespace-only `reviewerName`
    - Test `invalid_override_input` for empty `reason`, whitespace-only `reason`, reason > 500 chars
    - Test `effectiveResult` with empty overrides → returns `trace.result`
    - Test `effectiveResult` with one override → returns `replacementResult`
    - Test `effectiveResult` with multiple overrides → returns latest by `createdAt`
    - Test `effectiveResult` with tied `createdAt` → `CoreError("ambiguous_override")`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - Commit: `git add packages/core && git commit -m "feat: implement override() and effectiveResult()"`

- [x] 10. Extraction port and adapters
  - [x] 10.1 Implement `ExtractionPort` interface and `guardInput` in `src/extraction/port.ts`
    - Define `RawInput = string | Uint8Array`
    - Define `ExtractionPort` interface: `extract(input: RawInput): Promise<ExtractionResult | CoreError>`
    - Implement `guardInput(input: RawInput): CoreError | null`:
      - String length 0 → `CoreError("input_empty")`
      - `Uint8Array` length 0 → `CoreError("input_empty")`
      - `Uint8Array` length > 10,485,760 → `CoreError("input_too_large", …, byteLength, maxBytes: 10_485_760)`
    - _Requirements: 1.1, 1.2, 1.5, 1.6_
  - [x] 10.2 Implement `LiveAdapter` in `src/extraction/live.ts`
    - Mark class with `@deprecated` JSDoc tag and a `// NOT FOR PRODUCTION USE` comment
    - `extract`: emit `console.warn("[LiveAdapter] …")` and return `Promise.resolve(CoreError("live_adapter_not_implemented", …))`
    - _Requirements: 1.4_
  - [x] 10.3 Implement `RecordedAdapter` in `src/extraction/recorded.ts`
    - Constructor accepts `fixturePath: string`
    - `extract`: call `guardInput`; if guard returns CoreError, return it
    - Read file via `fs.readFile(fixturePath, "utf-8")`; catch `ENOENT` → `CoreError("fixture_not_found")`; catch other errors → `CoreError("fixture_invalid", …, parseError: String(e))`
    - Parse JSON; return parsed object cast to `ExtractionResult` (no re-serialization or transformation)
    - Export `LiveAdapter` and the `ExtractionPort` type from `src/index.ts`; export `RecordedAdapter` only from `src/node.ts` (`@bones/core/node`), because it imports `node:fs/promises` and must stay out of the browser barrel
    - _Requirements: 1.2, 1.7, 1.8_
  - [ ]* 10.4 Write unit tests for extraction in `src/__tests__/extraction.test.ts`
    - Test `guardInput`: empty string → `"input_empty"`, empty `Uint8Array` → `"input_empty"`, 10 MB + 1 byte → `"input_too_large"`, valid input → `null`
    - Test `LiveAdapter.extract`: returns `CoreError("live_adapter_not_implemented")` for any input
    - Test `RecordedAdapter.extract`: valid fixture path → returns stored `ExtractionResult` unchanged
    - Test `RecordedAdapter.extract`: non-existent path → `CoreError("fixture_not_found")`
    - Test `RecordedAdapter.extract`: path pointing to invalid JSON → `CoreError("fixture_invalid")`
    - Test `RecordedAdapter.extract`: empty string input → `CoreError("input_empty")` before file read
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7, 1.8_
  - Commit: `git add packages/core && git commit -m "feat: implement extraction port and adapters"`

- [x] 11. Checkpoint — full pipeline integration
  - Ensure all tests pass: `pnpm --filter @bones/core test`
  - Confirm no TypeScript errors: `pnpm --filter @bones/core exec tsc --noEmit`
  - Ask the user if any questions arise before continuing.

- [x] 12. Expense test fixtures and integration test
  - [x] 12.1 Create rule JSON files under `test-fixtures/expense/rules/`
    - `meal-limit-v1.json`: `effect: "capping"`, `cap: 5000`, condition always-true or a suitable trivially-passing comparison
    - `meal-limit-v2.json`: same structure, `cap: 6000`
    - `meal-limit-v3.json`: same structure, `cap: 7500`
    - `date-blocking.json`: `effect: "blocking"`, `condition: { kind: "date_in_range", dateField: "receiptDate", startField: "tripStart", endField: "tripEnd" }` (blocks if date is outside range — use `membership` or comparison node negation as appropriate for the outside-range case, or define blocking as when date is NOT in range)
    - `alcohol-deducting.json`: `effect: "deducting"`, `condition` always-true (or check field presence), `effectConfig: { deductionAmount: <from field>, scope: "total" }` — since deduction is dynamic, use a `sum` or `comparison` condition that fires when `alcoholLineCents > 0`; `deductionAmount` reads from the field path via the AST
    - `line-item-cap.json`: `effect: "capping"`, `condition: { kind: "comparison", left: {kind:"path", segments:["claimedTotalCents"]}, op: "!=", right: {kind:"path", segments:["lineItemSumCents"]} }`, `cap: { kind: "path", ... }` pointing to `lineItemSumCents`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [x] 12.2 Create rule-set JSON files under `test-fixtures/expense/rule-sets/`
    - `expense-v1.json`: includes `date-blocking`, `alcohol-deducting`, `meal-limit-v1`, `line-item-cap`
    - `expense-v2.json`: same but with `meal-limit-v2`
    - `expense-v3.json`: same but with `meal-limit-v3`
    - Each file follows the `RuleSet` schema with `id`, `version`, and `rules[]` of `{ ruleId, ruleVersion }`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [x] 12.3 Create `test-fixtures/expense/recorded/signature-scenario.json`
    - Include `proposedFields` with `claimedTotalCents: 48000`, `lineItemSumCents: 4800`, `alcoholLineCents: 650`, `receiptDate: "2024-03-15"`, `tripStart: "2024-03-10"`, `tripEnd: "2024-03-20"`
    - Include `confidence`, `sources`, `rawModelOutput` as shown in the design
    - _Requirements: 10.5_
  - [x] 12.4 Write integration test in `src/__tests__/fixtures/expense-scenarios.test.ts`
    - Load `expense-v1` rule set and all referenced rules into a `RuleCatalog`
    - Load `signature-scenario.json` as the extraction result via `RecordedAdapter`
    - Run through full pipeline: `validate` → `evaluate` → `createTrace` using deterministic ports
    - Assert `decision.result === "partially_approved"`
    - Assert `decision.amountCents === 4150`
    - Assert the capping rule outcome's `evidence` contains `claimedTotalCents: 48000` and `lineItemSumCents: 4800`
    - Assert the deducting rule outcome's `evidence` contains both values
    - _Requirements: 10.5_
  - Commit: `git add packages/core && git commit -m "feat: add expense fixtures and signature-scenario integration test"`

- [x] 13. Property-based tests
  - [x] 13.1 Write Property 1 (evaluate determinism) in `src/__tests__/properties/determinism.test.ts`
    - Generate arbitrary `ValidatedFields` + consistent `RuleSet` + `RuleCatalog`; call `evaluate` twice; assert deep equality
    - Tag: `// Feature: core, Property 1: evaluate is deterministic`
    - Run ≥ 100 iterations; if test fails, fix the implementation and record in `bugs-found.md`
    - _Requirements: 4.10, 4.11, 11.1_
  - [x] 13.2 Write Property 2 (replay round-trip) in `src/__tests__/properties/replay-round-trip.test.ts`
    - Generate a Trace via `createTrace`; call `replay` with same ruleSet/catalog; assert `result` and `amountCents` equal original, extraction fields identical
    - Tag: `// Feature: core, Property 2: replay round-trip preserves Decision`
    - _Requirements: 6.1, 6.2, 11.2_
  - [x] 13.3 Write Property 3 (validate gate) in `src/__tests__/properties/validate-gate.test.ts`
    - Generate `ProposedFields` that fail a schema; assert `validate` returns `CoreError("validation_failed")`; assert `evaluate` is not called (use a mock or spy)
    - Tag: `// Feature: core, Property 3: validate is the sole gate to evaluate`
    - _Requirements: 2.3, 11.3_
  - [x] 13.4 Write Property 4 (override immutability) in `src/__tests__/properties/override-immutability.test.ts`
    - Generate a Trace; deep-clone it; call `override`; assert original Trace deep-equals the clone
    - Tag: `// Feature: core, Property 4: override never mutates the original Trace`
    - _Requirements: 5.4, 6.4, 7.2, 11.4_
  - [x] 13.5 Write Property 5 (effectiveResult latest override) in `src/__tests__/properties/effective-result-latest.test.ts`
    - Generate an array of Overrides with strictly distinct ISO 8601 `createdAt` timestamps; assert `effectiveResult` returns the `replacementResult` of the one with the greatest `createdAt`; also test empty array → original `trace.result`
    - Tag: `// Feature: core, Property 5: effectiveResult returns the latest Override`
    - _Requirements: 7.3, 7.4, 11.5_
  - [x] 13.6 Write Property 6 (amount bounds) in `src/__tests__/properties/amount-bounds.test.ts`
    - Generate `ValidatedFields` and `AmountScope[]`; for every Decision produced, assert `0 <= amountCents <= sum(scope.claimedCents)`
    - Tag: `// Feature: core, Property 6: amountCents is always within [0, claimedTotalCents]`
    - _Requirements: 4.6, 11.6_
  - [x] 13.7 Write Property 7 (cap monotonicity) in `src/__tests__/properties/cap-monotonicity.test.ts`
    - Generate a rule set with at least one capping rule; evaluate; then increase the cap by a positive integer; evaluate again; assert `amountCents` does not decrease
    - Tag: `// Feature: core, Property 7: cap increase never decreases amountCents`
    - _Requirements: 4.3, 11.7_
  - [x] 13.8 Write Property 8 (rule order invariance) in `src/__tests__/properties/rule-order-invariance.test.ts`
    - Generate a RuleSet and permute `rules[]`; assert identical `result`, `amountCents`, and unordered set of `ruleOutcomes`
    - Tag: `// Feature: core, Property 8: rule permutation invariance`
    - _Requirements: 4.1, 4.11, 11.8_
  - [x] 13.9 Write Property 9 (trace determinism with fixed ports) in `src/__tests__/properties/trace-determinism.test.ts`
    - Generate `ValidatedFields`; run `evaluate` + `createTrace` twice with deterministic port stubs; assert `JSON.stringify` outputs are byte-for-byte identical
    - Tag: `// Feature: core, Property 9: deterministic ports produce byte-for-byte identical Trace JSON`
    - _Requirements: 5.5, 11.9_
  - Commit: `git add packages/core && git commit -m "test: add all 9 property-based tests"`

- [x] 14. Public barrel and domain isolation check
  - [x] 14.1 Finalize `src/index.ts` with complete barrel exports
    - Export all public types, constants, and functions as specified in the design: `ProposedFields`, `ValidatedFields`, `ExtractionResult`, `Rule`, `RuleSet`, `RuleCatalog`, `RuleRef`, `RuleEffect`, `ConditionNode`, `LiteralOrPath`, `ComparisonOp`, `Decision`, `DecisionResult`, `AmountScope`, `RuleOutcome`, `Trace`, `Override`, `CoreError`, `KernelPorts`, `SourceLocation`, `Confidence`, `TRACE_SCHEMA_VERSION`, `ExtractionPort`, `LiveAdapter`, `RecordedAdapter`, `validate`, `evaluate`, `evaluateCondition`, `createTrace`, `replay`, `override`, `effectiveResult`, `isCoreError`
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 14.2 Write an automated domain isolation check in `src/__tests__/domain-isolation.test.ts`
    - Read all `.ts` files under `src/` (excluding `src/__tests__/` and `src/index.ts`) using Node `fs`
    - Assert that none of the source text contains any of the forbidden terms as a whole word (case-insensitive): `expense`, `receipt`, `alcohol`, `meal`, `trip`, `suspect`, `case`
    - Use word-boundary regex (`\bterm\b`) to avoid false positives on partial matches
    - Assert that no file under `src/` imports from a path containing `test-fixtures`
    - _Requirements: 9.1, 9.3_
  - [x] 14.3 Final test run and type check
    - Run `pnpm --filter @bones/core test` — all test files must pass
    - Run `pnpm --filter @bones/core exec tsc --noEmit` — zero TypeScript errors
    - Commit: `git add packages/core && git commit -m "feat: finalize barrel exports and domain isolation check"`
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 15. README
  - [x] 15.1 Write `packages/core/README.md`
    - Section: **Install** — pnpm workspace setup, `pnpm add @bones/core`
    - Section: **Concepts** — three paragraphs covering: port injection (why `KernelPorts`), rules as data (JSON rule files, versioning, determinism), trace immutability (`deepFreeze`, no mutation after creation)
    - Section: **Usage** — a TypeScript code example showing the full pipeline: load rules → `validate` → `evaluate` → `createTrace`, with deterministic port stubs for the example
    - Section: **Bug tracking** — one sentence noting that property-test failures are recorded in `.kiro/specs/core/bugs-found.md` with root cause and fix
    - Commit: `git add packages/core && git commit -m "docs: add packages/core README"`
    - _Requirements: none (documentation)_

- [ ] 16. Final checkpoint
  - Run `pnpm --filter @bones/core test` — all tests pass
  - Confirm `bugs-found.md` exists (even if empty, as a placeholder)
  - Ensure no uncommitted changes remain in `packages/core`
  - Ask the user if any questions arise before marking the spec complete.

---

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster implementation pass; all non-starred tasks must be implemented.
- Every task references specific requirement numbers for traceability.
- Property tests (Tasks 13.1–13.9) run ≥ 100 iterations each via fast-check. If any property test finds a counterexample, fix the implementation and record the bug in `.kiro/specs/core/bugs-found.md` (property number, counterexample, root cause, fix). Never weaken the property to hide a bug.
- The design document's module dependency order must be respected: `types.ts` → `rules/ast.ts` → `rules/evaluate.ts` → `trace.ts` → `replay.ts` / `override.ts`; extraction modules are independent.
- No file under `src/` may import from `test-fixtures/`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["2.3"] },
    { "id": 5, "tasks": ["3.1", "4.1", "10.1"] },
    { "id": 6, "tasks": ["3.2", "4.2", "10.2", "10.3"] },
    { "id": 7, "tasks": ["5.1", "10.4"] },
    { "id": 8, "tasks": ["5.2"] },
    { "id": 9, "tasks": ["7.1"] },
    { "id": 10, "tasks": ["7.2", "8.1"] },
    { "id": 11, "tasks": ["8.2", "9.1"] },
    { "id": 12, "tasks": ["9.2", "12.1"] },
    { "id": 13, "tasks": ["12.2"] },
    { "id": 14, "tasks": ["12.3"] },
    { "id": 15, "tasks": ["12.4"] },
    { "id": 16, "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5", "13.6", "13.7", "13.8", "13.9"] },
    { "id": 17, "tasks": ["14.1"] },
    { "id": 18, "tasks": ["14.2", "15.1"] },
    { "id": 19, "tasks": ["14.3"] }
  ]
}
```
