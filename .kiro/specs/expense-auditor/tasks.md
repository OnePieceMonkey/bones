# Implementation Plan: apps/expense-auditor

## Overview

Build the prerequisites first, in the order the user asked for: move the rule files (task 1), add the money filter and dollar messages in core (task 2), add the `extraction_failed` error (task 3), make replay keep the original `inputHash` (task 4) and add the `effective` prop to xray-ui (task 5). Stop at a green repo-root checkpoint (task 6). Only after that checkpoint is `apps/expense-auditor` built, in strict dependency order: package scaffold, pure helpers (formats, catalog, samples, schemas, ports), the recorded adapter, the pipeline, replay, session state, export, anatomy, UI components, the offline checkpoint, the live-mode server and client, guard tests, deploy files, README, the Playwright test and a final checkpoint. Each leaf task ends with a commit. No orphaned code: every module is used by a later task or by the App entry.

**Language**: TypeScript 5.4.5 strict, React 18.3.1, pnpm workspace.
**Test runner**: Vitest 1.6.0 (jsdom for `*.test.tsx`, node for `*.node.test.ts`), Testing Library, fast-check 3.19.0 (min 100 runs per property), Playwright 1.65.1 (chromium only, `pnpm e2e`).
**Pure-logic rule**: all logic is a pure function with injected ports; components only map state to JSX.
**Bug tracking**: If a property test fails, fix the implementation, not the property. Keep a short list of bugs found by property tests in `.kiro/specs/expense-auditor/bugs-found.md` (format `Property N | Counterexample | Root cause | Fix`). Core bugs go to `.kiro/specs/core/bugs-found.md`.
**Boundaries**: tasks 1 to 5 may touch `packages/core`, `packages/xray-ui`, `rules/` and `.kiro/specs/core|xray-ui`. Tasks 7 and later never touch `packages/core` or `packages/xray-ui`.
**Hygiene**: `apps/expense-auditor/src` has no Node built-in import, no `@bones/core/node` import, no import from `case-files`, no API key or provider variable name. All tests live in `apps/expense-auditor/tests/` (and `e2e/`), never in `src/`.

---

## Tasks

- [x] 1. Move the rule files to `rules/expense-auditor/`
  - [x] 1.1 Move the files with `git mv` and repair every path
    - Touches `packages/core` (test file only) and `packages/xray-ui` (demo only)
    - Run `mkdir -p rules/expense-auditor/rules rules/expense-auditor/rule-sets`, then `git mv` the seven rule files (`alcohol-deducting`, `date-blocking-before`, `date-blocking-after`, `line-item-cap`, `meal-limit-v1`, `meal-limit-v2`, `meal-limit-v3`) from `packages/core/test-fixtures/expense/rules/` to `rules/expense-auditor/rules/` and the three rule sets `expense-v1`, `expense-v2`, `expense-v3` from `.../rule-sets/` to `rules/expense-auditor/rule-sets/`; leave `packages/core/test-fixtures/expense/recorded/signature-scenario.json` where it is
    - In `packages/core/src/__tests__/fixtures/expense-scenarios.test.ts` add `const rulesRoot = join(__dirname, "../../../../../rules/expense-auditor")` and `loadRuleJSON<T>(rel)`; use it for the rule and rule set loads, keep `fixturesRoot` for the recorded scenario
    - In `packages/xray-ui/demo/demoTrace.ts` change the ten rule and rule set imports to `../../../rules/expense-auditor/...` (the `scenario` import stays); in `packages/xray-ui/demo/vite.config.ts` set `server.fs.allow` to `resolve(here, "../../..")` with the comment "repo root: rules/, packages/ and the demo"
    - Run `pnpm --filter @bones/core test`, `pnpm --filter @bones/xray-ui test`, `pnpm test` and `pnpm typecheck`; all green with unchanged rule outcomes; keep the core domain-isolation and browser-barrel tests green
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.9_
    - Commit: `git add rules packages/core packages/xray-ui && git commit -m "chore(rules): move expense rule files to rules/expense-auditor"`
  - [x] 1.2 Write the layout guard tests in core
    - Touches `packages/core` (tests only)
    - In `packages/core/src/__tests__/domain-isolation.test.ts` add one assertion that no file under `packages/core/src` (tests skipped, as the test already does) contains the string `rules/expense-auditor`
    - Create `packages/core/src/__tests__/repo-layout.test.ts`: the seven rule files and three rule set files exist under `rules/expense-auditor/`; none exists under the old `rules/` and `rule-sets/` fixture directories; `signature-scenario.json` still exists; the `matcher` of the `test-on-rule-change` hook in `.kiro/hooks/bones.json` (read the field that holds the regex) matches `rules/expense-auditor/rules/line-item-cap.json` and `packages/core/test-fixtures/expense/recorded/signature-scenario.json`
    - Run `pnpm --filter @bones/core test`; domain-isolation and browser-barrel tests stay green
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 1.10_
    - Commit: `git add packages/core && git commit -m "test(core): guard rule file layout and hook matcher"`
  - [x] 1.3 Update the documents that name the old paths
    - Find them with `grep -rln "test-fixtures/expense/rule" .kiro packages --include=*.md --include=*.json`; update `.kiro/specs/core/requirements.md`, `design.md`, `tasks.md`, `.kiro/specs/xray-ui/requirements.md`, `design.md`, `tasks.md`, `packages/core/README.md` and `packages/xray-ui/README.md` where they name the old rule paths (the "Test Fixture Layout" section of the core design now says `rules/expense-auditor/rules/` and `rules/expense-auditor/rule-sets/`)
    - Do not edit `tasks.meta.json` or stage any `tasks.md` bookkeeping other than these text edits (the runner commits spec bookkeeping)
    - Run `pnpm test` and `pnpm typecheck` at the repo root; both green
    - _Requirements: 1.7_
    - Commit: `git add .kiro/specs/core/requirements.md .kiro/specs/core/design.md .kiro/specs/xray-ui/requirements.md .kiro/specs/xray-ui/design.md packages/core/README.md packages/xray-ui/README.md && git commit -m "docs: point rule file paths to rules/expense-auditor"`
  - [x] 1.4 Create the expense-auditor bug log
    - Create `.kiro/specs/expense-auditor/bugs-found.md` with a short header, the line `Property N | Counterexample | Root cause | Fix` as the entry format, and the line `No bugs found yet.`
    - _Requirements: 19.3_
    - Commit: `git add .kiro/specs/expense-auditor/bugs-found.md && git commit -m "docs(expense-auditor): add bug log placeholder"`

- [x] 2. Core: money filter, currency symbol and dollar messages
  - [x] 2.1 Add `currencySymbol` to `RuleSet` and create the rule schemas
    - Touches `packages/core`
    - In `packages/core/src/types.ts` add `currencySymbol?: string` (1 to 4 characters, default "$") to `RuleSet`
    - Create `packages/core/src/rules/schema.ts` as in design.md (Part A2): `conditionNodeSchema`, `ruleSchema`, `ruleSetSchema` (strict, `currencySymbol` `z.string().min(1).max(4).optional()`), `parseRule` returning `Rule | CoreError` (`invalid_rule_schema`) and `parseRuleSet` returning `RuleSet | CoreError` (`invalid_rule_set_schema`); use `safeParse`, map `issue.path.join(".")` into `fieldErrors`, never throw
    - Export `ruleSchema`, `ruleSetSchema`, `parseRule`, `parseRuleSet` from `packages/core/src/index.ts`; add no domain word and no Node built-in
    - Run `pnpm --filter @bones/core test` and `pnpm typecheck`
    - _Requirements: 2.6, 2.7_
    - Commit: `git add packages/core && git commit -m "feat(core): add rule schemas and currencySymbol"`
  - [x]* 2.2 Write unit tests for the rule schemas
    - `packages/core/src/__tests__/schema.test.ts`: the seven rule files and three rule sets under `rules/expense-auditor/` pass `parseRule` and `parseRuleSet`; a rule set with `currencySymbol` of `""`, `"ABCDE"` and a number returns `invalid_rule_set_schema`; unknown keys are rejected; a bad effect returns `invalid_rule_schema`
    - _Requirements: 2.6, 2.7_
    - Commit: `git add packages/core && git commit -m "test(core): unit tests for rule schemas"`
  - [x] 2.3 Add the money filter to the template renderer
    - Touches `packages/core`
    - Create `packages/core/src/rules/template.ts` with `DEFAULT_CURRENCY_SYMBOL`, `formatMoney(cents, symbol)` (integer arithmetic, comma groups, two decimals, leading minus before the symbol) and `renderTemplate(template, fields, currencySymbol)` exactly as in design.md (slot split with `indexOf("|")`, trim of path and filter, `money` only for safe integers, unknown filter or non-integer renders the plain value, missing path renders empty, function replacer, never throws)
    - Delete the local `renderTemplate` from `evaluate.ts`; import from `./template.js`; compute `const symbol = ruleSet.currencySymbol ?? DEFAULT_CURRENCY_SYMBOL` once and pass it at the three call sites (blocking, capping, deducting)
    - Export `formatMoney`, `renderTemplate`, `DEFAULT_CURRENCY_SYMBOL` from `index.ts`; the new files contain none of the words expense, receipt, alcohol, meal, trip, suspect
    - Run `pnpm --filter @bones/core test`; domain-isolation and browser-barrel tests stay green
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_
    - Commit: `git add packages/core && git commit -m "feat(core): add money filter to message templates"`
  - [x]* 2.4 Write unit tests for the template renderer
    - `packages/core/src/__tests__/template.test.ts`: 48000 gives "$480.00", 4150 "$41.50", 123456789 "$1,234,567.89", -5 "-$0.05", 0 "$0.00"; `{{ claimedTotalCents | money }}` equals the compact form; string, float, boolean, object and array values render plainly; missing path renders ""; unknown filter and `a|money|x` render plainly; a custom symbol; `$&` inside a value is not interpreted
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
    - Commit: `git add packages/core && git commit -m "test(core): unit tests for money filter"`
  - [x] 2.5 Write property test for the money filter round trip
    - `packages/core/src/__tests__/properties/money-filter-roundtrip.test.ts`, tag `// Feature: expense-auditor, Property 3: Money filter round trip (Core)`; integers from -10^12 to 10^12, symbols `$`, `€`, `CHF`, `kr`; assert the text shape and that the test-owned `parseMoney` (strip sign, symbol, commas) returns the cents; `numRuns: 200`
    - **Property 3: Money filter round trip (Core)**
    - **Validates: Requirements 2.1, 2.2, 2.9**
    - Commit: `git add packages/core && git commit -m "test(core): property 3 money filter round trip"`
  - [x] 2.6 Write property test for filter tolerance and plain fallback
    - `packages/core/src/__tests__/properties/money-filter-tolerance.test.ts`, tag `// Feature: expense-auditor, Property 7: Money filter tolerates whitespace and falls back to plain text`; random whitespace around path and `|`, random non-`money` filter names, non-integer values (string, float, boolean, object, array), missing paths; rendering never throws
    - **Property 7: Money filter tolerates whitespace and falls back to plain text**
    - **Validates: Requirements 2.3, 2.4, 2.5**
    - Commit: `git add packages/core && git commit -m "test(core): property 7 money filter tolerance"`
  - [x] 2.7 Write property test for currency symbol validation
    - `packages/core/src/__tests__/properties/currency-symbol.test.ts`, tag `// Feature: expense-auditor, Property 8: Currency symbol validation`; random strings as `currencySymbol` in a minimal valid rule set: `parseRuleSet` accepts 1 to 4 characters and returns `invalid_rule_set_schema` otherwise; a rule set without the field renders with "$"
    - **Property 8: Currency symbol validation**
    - **Validates: Requirements 2.6, 2.7**
    - Commit: `git add packages/core && git commit -m "test(core): property 8 currency symbol validation"`
  - [x] 2.8 Document the money filter in the core documents
    - `.kiro/specs/core/requirements.md` criteria 4.8 and 4.9 (filter syntax, `currencySymbol`); the `renderTemplate` section of `.kiro/specs/core/design.md` (new code plus `formatMoney`, and the message-rendering property text "and `|money` slots"); the message section of `packages/core/README.md` (filter syntax, `currencySymbol`, examples)
    - _Requirements: 2.13_
    - Commit: `git add .kiro/specs/core/requirements.md .kiro/specs/core/design.md packages/core/README.md && git commit -m "docs(core): document money filter and currencySymbol"`
  - [x] 2.9 Switch the rule messages to dollars and fix tests that assert old text
    - Touches `packages/core` (tests) and `packages/xray-ui` (demo and tests) and `rules/`
    - Change only `messageTemplate` in `rules/expense-auditor/rules/`: `meal-limit-v1|v2|v3` read `Meal limit vN: expenses are capped at $50.00|$60.00|$75.00. Claimed total: {{claimedTotalCents|money}}.`; `line-item-cap` reads `Receipt total {{claimedTotalCents|money}} does not match line items {{lineItemSumCents|money}}. Capped to the line-item sum.`; `alcohol-deducting` reads `Alcohol is not reimbursable: {{alcoholLineCents|money}} deducted.`; the two date rules stay unchanged
    - Run `grep -rn "Meal limit\|Receipt total\|Alcohol is not" packages --include=*.ts --include=*.tsx` and update every assertion on old text; confirm the field schemas in `expense-scenarios.test.ts` and `packages/xray-ui/demo/demoTrace.ts` carry `alcoholLineCents`
    - In `expense-scenarios.test.ts` assert the three rendered messages for the signature scenario at v1 (for example "Meal limit v1: expenses are capped at $50.00. Claimed total: $480.00.")
    - Run `pnpm test` and `pnpm typecheck` at the repo root; all green
    - _Requirements: 2.10, 2.11, 2.12_
    - Commit: `git add rules packages/core packages/xray-ui && git commit -m "feat(rules): dollar messages with money filter"`

- [x] 3. Core: `extraction_failed` error variant
  - [x] 3.1 Add the variant to the `CoreError` union
    - Touches `packages/core`
    - In `packages/core/src/types.ts` add `{ kind: "extraction_failed"; message: string; reason: "disabled" | "network" | "bad_response" | "upstream" }` to `CoreError` and `"extraction_failed"` to `CORE_ERROR_KINDS` (16 kinds); `isCoreError` stays generic
    - Run `pnpm --filter @bones/core test` and `pnpm typecheck`; fix any exhaustive switch the new variant breaks
    - _Requirements: 3.1, 3.2, 3.3_
    - Commit: `git add packages/core && git commit -m "feat(core): add extraction_failed error variant"`
  - [x] 3.2 Write the error-model test
    - `packages/core/src/__tests__/error-model.test.ts`: one sample value for each of the 16 kinds, `isCoreError` true for each; false for `"approved"`, `"partially_approved"`, `"rejected"`, `null`, `{}`, `{ kind: "other" }`; no kind equals a result literal; the four `extraction_failed` reasons
    - _Requirements: 3.2, 3.3, 3.5_
    - Commit: `git add packages/core && git commit -m "test(core): error model covers extraction_failed"`
  - [x] 3.3 Update the core error documents
    - `.kiro/specs/core/requirements.md` criterion 8.3 and the CoreError section of `.kiro/specs/core/design.md` list `"extraction_failed"` as the sixteenth variant; leave the history line in `.kiro/specs/core/tasks.md` unchanged
    - _Requirements: 3.4_
    - Commit: `git add .kiro/specs/core/requirements.md .kiro/specs/core/design.md && git commit -m "docs(core): list extraction_failed as sixteenth error variant"`

- [x] 4. Core: replay keeps the original `inputHash`
  - [x] 4.1 Fix replay and strengthen the replay property test
    - Touches `packages/core`
    - First extend `packages/core/src/__tests__/properties/replay-round-trip.test.ts` (core Property 2, expense-auditor Property 6): replay ports whose hasher returns a different hash and counts calls; assert `replayed.inputHash === trace.inputHash`, `hashCalls === 0`, `decisionId` and `createdAt` equal the replay port values, and deep equality of `rawModelOutput`, `proposedFields`, `confidence`, `sources`, `validatedFields`; run it against the unfixed code and copy the shrunk counterexample for task 4.2
    - Then in `packages/core/src/trace.ts` add `CreateTraceOptions { inputHash?: string }` and an optional trailing `options` argument to `createTrace` (`inputHash = options.inputHash ?? ports.hasher(rawInputBytes)`, hasher not called when set, existing empty-hash check kept); in `packages/core/src/replay.ts` add the guard `invalid_replay_arguments` with `missingField: "inputHash"` for an empty `trace.inputHash`, remove the `TextEncoder` hashing of `rawModelOutput` and call `createTrace(..., new Uint8Array(0), ports, { inputHash: trace.inputHash })`; export the options type
    - Run `pnpm --filter @bones/core test`; the strengthened property, domain-isolation and browser-barrel tests are green
    - **Property 6: Core replay keeps the original inputHash and the extraction fields**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
    - Commit: `git add packages/core && git commit -m "fix(core): replay keeps the original inputHash"`
  - [x] 4.2 Record the bug and update the core documents
    - Add `## Bug 2: replay hashed the encoded rawModelOutput instead of keeping the original inputHash` to `.kiro/specs/core/bugs-found.md` in the existing format (discovered by, failing counterexample from task 4.1, root cause, fix applied); update the replay section of `.kiro/specs/core/requirements.md` and `.kiro/specs/core/design.md` (inputHash kept, `createTrace` option) and `packages/core/README.md` if it describes replay
    - _Requirements: 4.6_
    - Commit: `git add .kiro/specs/core packages/core/README.md && git commit -m "docs(core): record replay inputHash bug and fix"`

- [x] 5. xray-ui: `effective` prop on ResultPlate and XrayView, AnswerCard visual fixes
  - [x] 5.1 Capture the baseline ResultPlate markup
    - Touches `packages/xray-ui` (tests only)
    - Add `packages/xray-ui/src/__tests__/components/ResultPlate.baseline.test.tsx`: render `ResultPlate` without `effective` for each of the three results with the signature fixture and assert `innerHTML` equals a stored string literal captured now, before any change
    - _Requirements: 5.2_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): baseline markup of ResultPlate"`
  - [x] 5.2 Add the `effective` prop to ResultPlate
    - Touches `packages/xray-ui`
    - In `src/types.ts` add `EffectiveResult { result: DecisionResult; reviewerName: string }`, `effective?: EffectiveResult` on `ResultPlateProps` and `XrayViewProps`
    - In `src/components/ResultPlate.tsx` implement as in design.md (Part A5): `data-result` always `trace.result`; `data-effective` only when set; label and icon of the effective result; "overruled by {reviewerName}"; "Rules decided: {label of trace.result}"; "Amount by rules" label; the only amount is `format("amountCents", trace.amountCents)`
    - In `src/styles/xray.css` add `.xr-result[data-effective=...]` rules and `.xr-result-overruled`, `.xr-result-rules`, `.xr-result-amount-label` using existing tokens only; add no domain word and no new animation
    - Run `pnpm --filter @bones/xray-ui test`; the baseline test stays green
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.9_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): show effective result on ResultPlate"`
  - [x] 5.3 Pass `effective` through XrayView
    - Touches `packages/xray-ui`
    - In `src/components/XrayView.tsx` destructure `effective` and pass `{...(effective === undefined ? {} : { effective })}` to `ResultPlate` only; Skeleton, EcgLine, AnswerCard, DrBonesChat and FilmClip receive the unchanged `trace`; `title` keeps feeding the Lightbox title plate
    - _Requirements: 5.1, 5.6, 5.7_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): pass effective result through XrayView"`
  - [x] 5.4 Write ResultPlate tests for the effective prop
    - In `src/__tests__/components/ResultPlate.test.tsx`: with `effective` the plate shows icon and label of `effective.result`, "overruled by Dana", "Rules decided: PARTIALLY APPROVED", "Amount by rules", and exactly one amount element equal to `format("amountCents", trace.amountCents)` for all nine combinations of effective and trace result; without `effective` the baseline test still passes
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.8_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): ResultPlate effective prop"`
  - [x] 5.5 Write XrayView tests for the effective prop and the title
    - In `src/__tests__/components/XrayView.test.tsx`: with and without `effective` the fractured bone count, ECG summary text and AnswerCard `data-overruled` are equal; the `h2.xr-title-plate` text equals `title`
    - _Requirements: 5.6, 5.7, 5.8_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): XrayView effective prop and title"`
  - [x] 5.6 Document the prop in the xray-ui README
    - Add `effective` to the XrayView and ResultPlate sections of `packages/xray-ui/README.md` (shape, plate text, amount rule, `trace` stays unchanged); run the xray-ui domain-isolation and source-hygiene tests
    - _Requirements: 5.8, 5.9_
    - Commit: `git add packages/xray-ui && git commit -m "docs(xray-ui): document effective prop"`

  - [x] 5.7 Add the label and summary helpers
    - Touches `packages/xray-ui`
    - In `src/model/selectors.ts` add `hasFieldLabel(anatomy, path)` (own-property check, non-empty string; additive, leave `fieldViews` and its output shape untouched); in `src/model/format.ts` add `summariseValue(value, formatted)`: arrays or plain objects whose `formatted` contains "{" or "[" give "<n> item(s)" or "<n> field(s)" (`1 item`, `3 items`), every other case returns `formatted`; both are total and never throw
    - Do not change `defaultFormat`, `fieldViews` or any existing export
    - _Requirements: 21.7, 21.10, 21.12_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add hasFieldLabel and summariseValue"`
  - [x] 5.8 Write unit tests for the helpers
    - `src/__tests__/model/answer-helpers.test.ts`: `hasFieldLabel` for a present label, an empty string, an absent key and prototype keys (`constructor`); `summariseValue` for an array with JSON output, an array with a custom summary text (returned unchanged), an object, a string, a number, `null`, `undefined`
    - _Requirements: 21.7, 21.10_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): AnswerCard helpers"`
  - [x] 5.9 Show only labelled rows and summarise values in AnswerCard
    - Touches `packages/xray-ui`
    - In `src/components/AnswerCard.tsx` render a row only for fields with `hasFieldLabel` (new optional prop `showUnlabelled?: boolean`, default false, added to `AnswerCardProps` and passed through `XrayView` only if `XrayViewProps` gets it; otherwise leave `XrayView` as it is); use `summariseValue(rawValue, f.value)` as the value text; compute `anyOverruled`, the overruled labels, the crack layer and the stamp from ALL fields, including hidden ones
    - Run `pnpm --filter @bones/xray-ui test`: where an existing AnswerCard or property test needs an unlabelled row, add a label to its fixture or pass `showUnlabelled`; never weaken an assertion and never touch the `overruled-fields` property
    - _Requirements: 21.7, 21.8, 21.9, 21.10, 21.12_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): AnswerCard shows labelled rows and value summaries"`
  - [x] 5.10 Restructure the AnswerCard DOM: crack layer behind, stamp in its own area
    - Touches `packages/xray-ui`
    - In `src/components/AnswerCard.tsx` render the crack overlay SVG as the first child of the article, wrap header, `dl.xr-answer-fields` and the new `div.xr-stamp-area` in `div.xr-answer-body`; put the stamp inside `.xr-stamp-area` after the rows (only when overruled); keep the class names `xr-answer`, `xr-field`, `xr-field-value`, `xr-crack-overlay`, `xr-stamp`, the `role="note"` and the `data-overruled` attributes
    - Run `pnpm --filter @bones/xray-ui test`; all existing tests stay green
    - _Requirements: 21.1, 21.5_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): AnswerCard crack layer behind rows, stamp area"`
  - [x] 5.11 Style the fixes: layering, solid rows, reserved stamp area
    - Touches `packages/xray-ui`
    - In `src/styles/tokens.css` add `--xr-bg-row` (opaque; `--xr-text` on it >= 4.5:1); in `src/styles/xray.css`: `.xr-crack-overlay` z-index 0, `.xr-answer-body` relative with z-index 1, `.xr-answer-fields` as a grid with `gap: var(--xr-space-1)`, `.xr-field` with `background: var(--xr-bg-row)`, padding and radius, `.xr-answer` padding, `.xr-stamp-area` with `min-height`, padding and `justify-content: flex-end`, `.xr-stamp` no longer absolutely positioned, with a rotation that fits the reserved room; keep `.xr--plain` paper mode readable (rows use the paper token there) and leave all `anim-*` rules and the reduced-motion rule untouched
    - Extend `src/__tests__/contrast.test.ts` `TOKEN_PAIRS` with `--xr-text` on `--xr-bg-row` and `--xr-text-dim` on `--xr-bg-row` (>= 4.5); no domain words, no `url(`
    - _Requirements: 21.2, 21.3, 21.4, 21.6_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): readable AnswerCard rows and reserved stamp area"`
  - [x] 5.12 Write the AnswerCard component and stylesheet tests
    - In `src/__tests__/components/AnswerCard.test.tsx` add: a trace with unlabelled camelCase fields (`alcoholLineItems`, `lineItems` as arrays of objects) renders no row for the unlabelled ones; with `showUnlabelled` they appear with their path; the REQUIRED unit test: for labelled and unlabelled fields, with arrays of objects and the default formatter, no rendered row text (label cell and value cell) contains "{" or "[" and no row label matches `/[a-z][A-Z]/`; hidden fields still count for `data-overruled`, the crack layer and the stamp; DOM order (the `.xr-crack-overlay` precedes `.xr-answer-body`); the stamp is inside `.xr-stamp-area` and not inside any `.xr-field`; with `reducedMotion` no `anim-` class
    - In `src/__tests__/components/AnswerCard.styles.test.ts` read `xray.css` with `node:fs` and assert: the z-index of `.xr-crack-overlay` is lower than that of `.xr-answer-body`; `.xr-field` has a `background` that is a `var(--xr-bg-` token; `.xr-stamp` has no `position: absolute`; `.xr-stamp-area` has a `min-height`
    - _Requirements: 21.1, 21.2, 21.4, 21.5, 21.7, 21.8, 21.9, 21.11_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): AnswerCard readability and layout"`
  - [x] 5.13 Dollars in the xray-ui demo and README
    - Touches `packages/xray-ui`
    - In `demo/anatomy.ts` format `*Cents` values as `$41.50` (comma thousands separators, two decimals, integer arithmetic) instead of `EUR 41.50`, give every shown AI-card field a label in `fieldLabels` and make `lineItems` and `alcoholLineItems` return a summary such as "1 line item · $6.50"; in `README.md` change the `formatValue` example from `EUR` to `$`; adjust `demo-smoke.test.tsx` to expect `$41.50` and to assert the text "EUR" appears nowhere in the rendered demo and in `demo/anatomy.ts`
    - Run `pnpm --filter @bones/xray-ui build:demo`; it succeeds
    - _Requirements: 21.13_
    - Commit: `git add packages/xray-ui && git commit -m "fix(xray-ui): show dollars in demo and README"`
  - [x] 5.14 Update the xray-ui spec documents
    - `.kiro/specs/xray-ui/requirements.md`: criterion 5.1 (labelled rows only, `showUnlabelled`, value summary) and new criteria for the crack layer, solid rows and the stamp area; `.kiro/specs/xray-ui/design.md`: the AnswerCard section (DOM, CSS, helpers) and the properties note; `.kiro/specs/xray-ui/tasks.md` is not edited
    - _Requirements: 21.14_
    - Commit: `git add .kiro/specs/xray-ui/requirements.md .kiro/specs/xray-ui/design.md && git commit -m "docs(xray-ui): spec the AnswerCard visual fixes"`
- [x] 6. Prerequisite checkpoint
  - [x] 6.1 Checkpoint - prerequisites green at the repo root
    - Run `pnpm test` and `pnpm typecheck` from the repo root; both must be green (core and xray-ui suites, including domain-isolation and browser-barrel)
    - Confirm `git status` shows a clean tree for `rules`, `packages` and `.kiro/specs/core|xray-ui`
    - Confirm the xray-ui suite (including the existing AnswerCard and `overruled-fields` tests) and `pnpm --filter @bones/xray-ui build:demo` are green; do not start task 7 until this checkpoint is green; ensure all tests pass, ask the user if questions arise
    - _Requirements: 1.9, 2.12, 3.5, 4.5, 5.8, 21.12_
    - Commit: none (verification only; if a fix is needed, commit it with the matching `fix(...)` message)

- [x] 7. App package scaffold
  - [x] 7.1 Create the package files and install
    - Create `apps/expense-auditor/package.json` exactly as in design.md (name `@bones/expense-auditor`, scripts `dev`, `build`, `build:check`, `preview`, `test`, `typecheck`, `test:e2e`, dependencies `@bones/core` and `@bones/xray-ui` as `workspace:*`, exact pinned versions, no `@vercel/node`) and `tsconfig.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, includes `src`, `api`, `shared`, `tests`, `e2e` and the config files)
    - Check the root `.gitignore` covers `dist/`, `.env.*` (with `!.env.example`); add `test-results/` and `playwright-report/`
    - Run `pnpm install` at the repo root and commit the lockfile
    - _Requirements: 6.1, 6.2, 6.7, 6.8_
    - Commit: `git add apps/expense-auditor/package.json apps/expense-auditor/tsconfig.json .gitignore pnpm-lock.yaml && git commit -m "chore(expense-auditor): scaffold package"`
  - [x] 7.2 Add the Vite and Vitest configuration
    - `apps/expense-auditor/vite.config.ts` (react plugin, `server.fs.allow` = repo root, preview host `127.0.0.1` port 4173 strict, `build.sourcemap: false`; no dev API plugin yet) and `vitest.config.ts` (jsdom default, `environmentMatchGlobs: [["tests/**/*.node.test.ts", "node"]]`, setup file, include `tests/**/*.test.{ts,tsx}`, `css: false`)
    - `tests/setup.ts`: jest-dom matchers, `afterEach(cleanup)`, `HTMLDialogElement.showModal/close` stubs when missing, `globalThis.crypto = webcrypto` when `crypto.subtle` is missing
    - _Requirements: 6.1, 6.4, 19.1_
    - Commit: `git add apps/expense-auditor && git commit -m "chore(expense-auditor): add vite and vitest config"`
  - [x] 7.3 Add the empty App entry with a passing smoke test
    - `index.html` (lang `en`, title "Expense Auditor", `#root`), `src/main.tsx` (StrictMode root, imports `@bones/xray-ui` and `./styles/app.css`), `src/App.tsx` rendering `<main><h1>Expense Auditor</h1></main>`, `src/styles/app.css` (comment only for now)
    - `tests/components/App.smoke.test.tsx`: renders the heading with Testing Library
    - Run `pnpm --filter @bones/expense-auditor test` and `pnpm --filter @bones/expense-auditor typecheck`
    - _Requirements: 6.1, 6.4, 6.5, 6.6_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add empty App with smoke test"`
  - [x] 7.4 Add the root `e2e` script and verify root scripts
    - Add `"e2e": "pnpm --filter @bones/expense-auditor test:e2e"` to the root `package.json`; leave `test` and `typecheck` as `pnpm -r ...`
    - Run `pnpm test` and `pnpm typecheck` at the repo root; confirm the App smoke test runs, that `pnpm test` does not start Playwright, and that no file under `apps/expense-auditor/src` imports `@bones/core/node`
    - _Requirements: 6.3, 6.4, 6.5, 6.6_
    - Commit: `git add package.json && git commit -m "chore(expense-auditor): add root e2e script"`

- [x] 8. Pure format helpers
  - [x] 8.1 Implement date helpers
    - `apps/expense-auditor/shared/iso.ts`: `parseIsoDate` (regex, month 1 to 12, day up to `daysInMonth` with the Gregorian leap rule, no `Date` object), `isRealIsoDate`
    - `src/format/dates.ts`: re-export those, plus `MONTHS`, `formatDate` ("Mar 15, 2024", raw text for a non-date), `formatTripWindow` ("Trip: Mar 10 - Mar 20, 2024", year printed once when both dates share it); take the window as `{ start: string; end: string }` (the `TripWindow` type arrives in task 10.2)
    - _Requirements: 7.5, 11.4_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add date helpers"`
  - [x] 8.2 Implement money helpers
    - `src/format/money.ts`: `formatCents(cents)` = `formatMoney(cents, "$")` from `@bones/core`, `isCentsPath(path)` (`/Cents$/`, ends with `_sum`, or equals `amount`)
    - _Requirements: 11.3_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add money helpers"`
  - [x] 8.3 Implement `formatValue`
    - `src/format/formatValue.ts` with the five ordered rules from design.md (line item lists as a Value_Summary `<n> line item(s) · <sum as dollars>`, "No line items · $0.00" when empty, never raw JSON and no descriptions; cents paths; date paths; booleans "Yes"/"No"; else `defaultFormat` from `@bones/xray-ui`); never throws; no output contains "EUR"
    - _Requirements: 11.3, 11.4, 11.5, 11.6, 11.7, 11.11_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add formatValue"`
  - [x]* 8.4 Write unit tests for the format helpers
    - `tests/unit/format.node.test.ts`: `formatCents(4150)` "$41.50"; `formatDate("2024-03-15")` "Mar 15, 2024"; leap day 2024-02-29 real and 2023-02-29 not; `formatTripWindow` for the default window and across years; `formatValue` for line items ("4 line items · $48.00", "1 line item · $6.50", "No line items · $0.00" for an empty list, no `{` or `[` in any output), booleans, an unknown path; no output of `formatCents` or `formatValue` contains "EUR"
    - _Requirements: 7.5, 11.3, 11.4, 11.5, 11.6, 11.7, 11.11_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): unit tests for format helpers"`
  - [x] 8.5 Write property test for money formatting
    - Create `tests/helpers/money.ts` (`parseMoney(text, symbol)`) and `tests/properties/money-roundtrip.node.test.ts`, tag `// Feature: expense-auditor, Property 4: App money formatting round trip`; cents 0 to 10^12; `formatValue` for a `*Cents` path equals `formatCents`; `numRuns: 200`
    - **Property 4: App money formatting round trip**
    - **Validates: Requirements 11.3, 11.8**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 4 money round trip"`
  - [x] 8.6 Write property test for the date formatter
    - Create `tests/helpers/arbitraries.ts` with `arbIsoDate` (as in design.md) and `tests/properties/date-format.node.test.ts`, tag `// Feature: expense-auditor, Property 5: Date formatter is total and keeps the day number`; output matches `Mon D, YYYY`, same day number and year; `numRuns: 200`
    - **Property 5: Date formatter is total and keeps the day number**
    - **Validates: Requirements 11.4, 11.9**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 5 date formatter"`
  - [x] 8.7 Write property test for `formatValue` totality
    - `tests/properties/format-value-total.node.test.ts`, tag `// Feature: expense-auditor, Property 16: formatValue is total`; any path string and `fc.anything()` plus `undefined`, `NaN`, cyclic objects, functions and symbols: never throws, returns a string; for a path and value matching no rule the result equals `defaultFormat`
    - **Property 16: formatValue is total**
    - **Validates: Requirements 11.5, 11.6, 11.7**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 16 formatValue totality"`

- [x] 9. Rule catalog and version label mapping
  - [x] 9.1 Implement the catalog loader
    - `src/rules/catalog.ts`: `VersionLabel`, `VERSION_LABELS`, `RuleBundle` (defined here and re-exported from `runPipeline.ts` in task 14.1), `RULE_SET_REFS` (v1 to `expense@1.0.0`, v2 to `2.0.0`, v3 to `3.0.0`), `buildBundle(ruleModules, ruleSetModules)` (parse with `parseRule` and `parseRuleSet`, key the catalog `${id}@${version}` from file content, verify every rule ref exists, return a Core error on failure) and `loadBundle()` using `import.meta.glob` on `../../../../rules/expense-auditor/rules/*.json` and `.../rule-sets/*.json` with `{ eager: true, import: "default" }`
    - Imports only `@bones/core` (browser barrel)
    - _Requirements: 10.9, 13.1_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add rule catalog loader"`
  - [x] 9.2 Write the test fixture helper and catalog tests
    - `tests/helpers/fixtures.ts`: `loadTestBundle()` reads the real JSON files with `node:fs` and calls `buildBundle`
    - `tests/unit/catalog.node.test.ts`: the three labels map to the three rule sets; all refs resolve; v1, v2, v3 use `meal-limit` 1.0.0, 2.0.0, 3.0.0; a missing ref and an invalid rule file return Core errors; `loadBundle()` (Vite glob inside Vitest) equals `loadTestBundle()`
    - _Requirements: 10.9, 13.1_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): catalog loader and fixture helper"`

- [x] 10. Samples and recorded fixtures
  - [x] 10.1 Create the three sample JSON files
    - `apps/expense-auditor/recorded/signature.json`, `clean.json`, `outside-window.json` with the shape `{ id, title, receiptText, trip, extraction }`, trip 2024-03-10 to 2024-03-20, `rawModelOutput` equal to `JSON.stringify(proposedFields)`, `sources` as `{ kind: "line", lineIndex }`
    - Signature: titles "Signature case"; receipt lines 0 `HARBOR GRILL`, 1 `Harbor Street 12`, 2 `Date: 2024-03-15`, 3 `Table 7  Server: Jo`, 4 dashes, 5 `Grilled salmon          22.00`, 6 `Caesar salad            11.00`, 7 `Sparkling water          8.50`, 8 `Draft beer               6.50`, 9 dashes, 10 `TOTAL                   48.00`, 11 `Thank you`; fields merchant "Harbor Grill", `receiptDate` "2024-03-15", `claimedTotalCents` 48000, items 2200, 1100, 850, 650 with only "Draft beer" `isAlcohol` true (items sum to 4800); confidence merchant 0.99, receiptDate 0.98, claimedTotalCents 0.62, lineItems 0.93; sources merchant 0, receiptDate 2, claimedTotalCents 10, lineItems 5
    - Clean ("Clean meal"): "Corner Bistro", "2024-03-12", total 3240, items "Chicken bowl" 1890, "Iced tea" 350, "Side salad" 1000, none alcohol, confidence 0.95 to 0.99, sources merchant 0, receiptDate 2, claimedTotalCents 9, lineItems 5, receipt lines laid out as in design.md
    - Outside window ("Outside the trip window"): "Airport Cafe", "2024-03-25", total 2150, items "Club sandwich" 1450, "Coffee" 700, none alcohol, confidence 0.95 to 0.99, sources merchant 0, receiptDate 2, claimedTotalCents 8, lineItems 5
    - Field names are `merchant`, `receiptDate`, `claimedTotalCents`, `lineItems` (items `{ description, amount, isAlcohol }`)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
    - Commit: `git add apps/expense-auditor/recorded && git commit -m "feat(expense-auditor): add recorded sample receipts"`
  - [x] 10.2 Implement the sample registry
    - `src/extraction/samples.ts`: `SampleId`, `TripWindow`, `Sample`, `SAMPLE_IDS`, strict `sampleSchema` (as in Data Models), `SAMPLES` (the three statically imported JSON modules typed `readonly unknown[]`), `SAMPLE_BLURBS`, `DEFAULT_TRIP`; make `dates.ts` accept this `TripWindow` type
    - _Requirements: 7.1, 7.5, 8.1_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add sample registry"`
  - [x] 10.3 Write sample tests
    - `tests/unit/samples.node.test.ts`: every Sample passes `sampleSchema`; exact values from Requirements 7.2 to 7.4 (merchants, dates, totals, line items and sums, signature claimed total 48000 versus item sum 4800, confidence 0.62); each `sources` line index is below the number of receipt lines; `JSON.parse(rawModelOutput)` equals `proposedFields`; every confidence is between 0 and 1; `formatTripWindow(DEFAULT_TRIP)` is "Trip: Mar 10 - Mar 20, 2024"
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): sample fixtures"`

- [x] 11. Schema, validation and amount scopes
  - [x] 11.1 Implement the Expense_Schema
    - `src/pipeline/schema.ts`: `MAX_CENTS`, `ProposedReceipt`, `RuleFields`, `proposedReceiptSchema` (strict; integer, non-negative, max 10^12 cents; real ISO dates; `claimedTotalCents` greater than 0; 1 to 200 line items), `ruleFieldsSchema(trip)` with the fixed key order of design.md (`lineItemSumCents`, `alcoholLineItems`, `alcoholLineCents`, `tripStart`, `tripEnd`), the non-transforming `ruleFieldsOutputSchema`, and `tripIssues(trip)`
    - Pure: no clock, no randomness, no I/O
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add expense schema"`
  - [x] 11.2 Implement `toRuleFields` and `isRuleFields`
    - `src/pipeline/toRuleFields.ts`: validate through Core `validate` with `ruleFieldsSchema(trip)`, merge `tripIssues` explicitly into the `fieldErrors` of a `validation_failed` error (message "Validation failed with N error(s)"), return `RuleFields` on success; `isRuleFields` runs `ruleFieldsOutputSchema`
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add toRuleFields validation"`
  - [x] 11.3 Implement the amount scopes function
    - `src/pipeline/amountScopes.ts`: `amountScopesFor(fields)` returns `[{ name: "total", claimedCents: fields.claimedTotalCents }]`; `amountScopesForTrace(trace)` returns the same from `trace.validatedFields` or a `validation_failed` CoreError when `isRuleFields` is false
    - _Requirements: 9.10_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add amount scopes function"`
  - [x] 11.4 Write schema and validation tests
    - `tests/unit/schema.node.test.ts`: all three Samples pass `toRuleFields` and derive the expected sums (signature 4800 and 650, clean 3240, outside-window 2150); each rejection path from Requirements 9.3 to 9.7 names the field path (negative cents `lineItems.0.amount`, fractional cents, bad date `receiptDate`, empty `lineItems`, zero `claimedTotalCents`, `tripEnd` before `tripStart`, bad trip date); two defects give two entries; `amountScopesFor` and `amountScopesForTrace`
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 9.10_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): schema and validation"`
  - [x] 11.5 Write property test for schema derivation
    - Extend `tests/helpers/arbitraries.ts` with `arbCents`, `arbPositiveCents`, `arbTrip`, `arbLineItem(s)`, `arbProposal(trip)`, `arbExtraction(trip)` as in design.md; `tests/properties/schema-derivation.node.test.ts`, tag `// Feature: expense-auditor, Property 9: Expense_Schema derivation`
    - **Property 9: Expense_Schema derivation**
    - **Validates: Requirements 9.1, 9.2, 9.9**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 9 schema derivation"`
  - [x] 11.6 Write property test for schema rejection
    - `tests/properties/schema-rejection.node.test.ts`, tag `// Feature: expense-auditor, Property 10: Expense_Schema rejection names the failing field`; inject one defect (negative or fractional cent at a random position, non-real date, empty line items, zero total, trip end before start) and assert the `fieldErrors` contain a path starting with the defective field
    - **Property 10: Expense_Schema rejection names the failing field**
    - **Validates: Requirements 9.3, 9.4, 9.5, 9.6, 9.7**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 10 schema rejection"`

- [x] 12. Ports
  - [x] 12.1 Implement the SHA-256 helper
    - `src/pipeline/hash.ts`: `sha256Hex(bytes)` with `globalThis.crypto.subtle.digest("SHA-256", bytes)` and lower-case hex; when `crypto.subtle` is missing it throws an error whose message says an HTTPS or localhost context is required
    - _Requirements: 10.3_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add sha256 helper"`
  - [x] 12.2 Implement the port factory
    - `src/pipeline/ports.ts`: `makeClock(now)` (strictly increasing, at least 1 ms apart), `makePortFactory(deps)` with `base` (hasher throws) and `forInput(hex, byteLength)` (hasher returns the precomputed hex, throws with both lengths in the message when `bytes.byteLength` differs), `id` from `crypto.randomUUID`
    - _Requirements: 10.3, 10.4, 10.5, 10.6_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add port factory"`
  - [x] 12.3 Write port tests and the fakes helper
    - `tests/helpers/fakes.ts`: `counterPorts()` (`now` counting up from 1 700 000 000 000, `uuid` returning `id-<n>`), `fakeAdapter(extraction)`, `fakeFetch(handler)`, `fakeLlm(outcomes)` (recording calls), `makeRequest(method, body?, headers?)`
    - `tests/unit/ports.node.test.ts`: `sha256Hex("abc")` equals the known vector `ba7816bf...15ad`; `forInput` hasher returns the hex for matching length and throws a message naming both lengths otherwise; `base.hasher` throws; real `randomUUID` shape; clock equal timestamps advance by 1 ms
    - _Requirements: 10.3, 10.4, 10.5, 10.6_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): ports and fake helpers"`
  - [x] 12.4 Write property test for the clock
    - `tests/properties/clock.node.test.ts`, tag `// Feature: expense-auditor, Property 12: Clock strictly increases`; arbitrary integer sequences including repeats and decreases as the time source
    - **Property 12: Clock strictly increases**
    - **Validates: Requirements 10.6**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 12 clock"`

- [x] 13. Recorded sample adapter
  - [x] 13.1 Implement `RecordedSampleAdapter`
    - `src/extraction/RecordedSampleAdapter.ts` as in design.md: `guardInput` first (`input_empty`), `fixture_not_found` with `fixturePath` for an unknown id, `fixture_invalid` with `parseError` for a schema failure, return `structuredClone(sample.extraction)` (the original data, not Zod's output); no Node import
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add recorded sample adapter"`
  - [x] 13.2 Write adapter tests
    - `tests/unit/recordedAdapter.node.test.ts`: `extract("")` gives `input_empty` and reads no Sample; unknown id gives `fixture_not_found`; a Sample with `claimedTotalCents` as a string gives `fixture_invalid`; a valid Sample returns data deeply equal to its `extraction` and not the same object reference
    - _Requirements: 8.2, 8.3, 8.4, 8.5_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): recorded sample adapter"`
  - [x] 13.3 Write the parity test with the Core Node adapter
    - `tests/parity/recorded-parity.node.test.ts`: for each Sample write `sample.extraction` to a file in `os.tmpdir()`, call `new RecordedAdapter(path).extract("x")` from `@bones/core/node` and `new RecordedSampleAdapter(id).extract("x")`, and assert `toEqual`; this test is the only place that imports `@bones/core/node` or `node:fs` for adapters
    - _Requirements: 8.6_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): recorded adapter parity with core"`

- [x] 14. Pipeline
  - [x] 14.1 Implement `runPipeline` and `replayTrace`
    - `src/pipeline/runPipeline.ts`: re-export `VersionLabel`, `VERSION_LABELS`, `RuleBundle` from `../rules/catalog`; `PipelineInput`, `PipelineArgs`; `runPipeline` in the order extract, `toRuleFields`, `evaluate` with `amountScopesFor`, await `sha256`, `createTrace` with `portFactory.forInput(hex, bytes.byteLength)`, early return of any CoreError (a rejected `sha256` becomes the `invalid_replay_arguments` error with `missingField: "hasher"`); `replayTrace` as in design.md (rule set semver as `ruleSetVersion`)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.7, 10.10, 13.2_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add decision pipeline"`
  - [x] 14.2 Write the expected-decision tests for the three samples
    - Extend `tests/helpers/fixtures.ts` with `sampleTrace(id, label)` (fixed ports, real SHA-256 over the receipt text bytes) and `tests/unit/pipeline.node.test.ts`: for each Sample and each label v1, v2, v3 assert the table in design.md: signature `partially_approved` 4150 with outcomes `line-item-cap` 48000 to 4800, `meal-limit` 4800 to 4800, `alcohol-deducting` 4800 to 4150, the dollar messages, exactly two fractured and meal-limit passed ("applied, no change"); clean `approved` 3240 with no fracture; outside-window `rejected` 0 with only `date-blocking-after` fractured; use `selectBones` and `stateText` from `@bones/xray-ui` (if a helper is not exported, assert on the rendered DOM instead and do not change xray-ui)
    - _Requirements: 7.9, 7.10, 7.11, 10.1, 13.8_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): expected decisions for the three samples"`
  - [x] 14.3 Write pipeline order and error tests
    - `tests/unit/pipelineErrors.node.test.ts`: an adapter returning `input_empty` and one returning an invalid proposal return the CoreError and never read the catalog (spy proxy on the bundle); `forInput(hex, 5)` with 6 bytes gives `invalid_replay_arguments`; a rejecting `sha256` gives the hasher error; the returned Trace is deep-frozen; `inputHash` equals SHA-256 of the receipt text bytes
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.7, 10.10_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): pipeline order and error paths"`
  - [x] 14.4 Write property test for pipeline determinism
    - `tests/properties/pipeline-determinism.node.test.ts`, tag `// Feature: expense-auditor, Property 11: Pipeline determinism`; two runs with identical fixed ports, adapter and bytes give deeply equal Traces; an invalid proposal returns a CoreError
    - **Property 11: Pipeline determinism**
    - **Validates: Requirements 10.2, 10.8**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 11 pipeline determinism"`

- [x] 15. Replay store
  - [x] 15.1 Implement the replay store
    - `src/pipeline/replayStore.ts`: `ReplayStore`, `initialReplayStore(original)` (v1 holds the original), `getReplay`, `putReplay` (never replaces v1)
    - _Requirements: 13.4, 13.5_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add replay store"`
  - [x] 15.2 Write property test for replay with the own rule set
    - `tests/properties/replay-own-ruleset.node.test.ts`, tag `// Feature: expense-auditor, Property 1: Replay with the own rule set reproduces the decision`; generator `fc.tuple(arbTrip, arbLabel).chain(...)` so the extraction matches the trip; replay ports are `factory.base` (its hasher throws); assert equal `result`, `amountCents`, `ruleOutcomes`, `validatedFields`, `inputHash`, different `decisionId` and `createdAt`, frozen; add `arbLabel` to the arbitraries helper
    - **Property 1: Replay with the own rule set reproduces the decision**
    - **Validates: Requirements 13.2, 13.9**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 1 replay with own rule set"`
  - [x]* 15.3 Write unit tests for the replay store
    - `tests/unit/replayStore.node.test.ts`: v1 is the original; `putReplay` for v2 and v3 adds entries; `putReplay` for v1 returns the same store; the store is not mutated
    - _Requirements: 13.4, 13.5_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): replay store"`

- [x] 16. Session state, override and store
  - [x] 16.1 Implement the intro state machine
    - `src/state/intro.ts`: `INTRO_DELAY_MS = 600`, `IntroEvent`, `introReducer` as in design.md (`shown`, `timer`, `user`)
    - _Requirements: 12.5, 12.6, 12.8_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add intro state machine"`
  - [x] 16.2 Write property test for the intro machine
    - `tests/properties/intro.node.test.ts`, tag `// Feature: expense-auditor, Property 14: Intro sequence honours the user`; random event sequences starting with `shown`
    - **Property 14: Intro sequence honours the user**
    - **Validates: Requirements 12.5, 12.6, 12.8**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 14 intro sequence"`
  - [x] 16.3 Implement the reducer
    - `src/state/reducer.ts`: `Origin`, `UploadProblem`, `StartError`, `DecisionNotice`, `StartState`, `DecisionState`, `AppState`, `Action`, `initialState`, `reducer` with the rules of design.md (`decision_ready` builds the replay store and the intro state, `version_selected` clears the notice, `replay_failed` keeps the selected version, `override_added` never touches `original` or `replays`, `reset` returns `initialState`, wrong screen or unknown action returns the same object)
    - _Requirements: 12.10, 13.4, 13.5, 13.7, 14.7_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add session reducer"`
  - [x] 16.4 Implement the selectors
    - `src/state/selectors.ts`: `displayedTrace`, `replayNote` ("Replayed with v2", `null` for v1), `linkedOverrides` (only overrides whose `decisionId` equals the displayed Trace), `effectiveView` (uses Core `effectiveResult` over linked overrides, returns the CoreError or `null`, reviewer name of the latest), `titlePlate` ("Expense Auditor - RECORDED" or "- LIVE")
    - _Requirements: 13.6, 14.5, 14.6, 14.8, 14.9, 14.10, 17.1, 17.2, 17.3_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add session selectors"`
  - [x] 16.5 Write reducer and selector tests
    - `tests/unit/reducer.node.test.ts`: every action path including a failing replay that keeps the version, `reset` discarding replays and overrides, `replayNote` for v1 and v2, `titlePlate` for both modes, `effectiveView` returning `null` without linked overrides and a CoreError passthrough; add `signatureDecisionState()` to `tests/helpers/fixtures.ts` (signature Trace with v2 and v3 stored)
    - _Requirements: 12.10, 13.6, 13.7, 14.5, 14.6, 14.9, 14.10, 17.1, 17.2, 17.3_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): reducer and selectors"`
  - [x] 16.6 Write property test for overrides
    - `tests/properties/override-store.node.test.ts`, tag `// Feature: expense-auditor, Property 2: Overrides never change a stored Trace and the latest linked Override is effective`; add `arbOverrideForm` and `arbOp` to the arbitraries helper; operations select a version or create an Override with Core `override` and `factory.base`; compare JSON snapshots of the three stored Traces, frozen state, linked `decisionId`, and `effectiveView` per label
    - **Property 2: Overrides never change a stored Trace and the latest linked Override is effective**
    - **Validates: Requirements 14.3, 14.5, 14.6, 14.7, 14.8, 14.9, 14.11**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 2 overrides"`
  - [x] 16.7 Implement the session store
    - `src/state/sessionStore.ts`: `SessionDeps` (without live fields for now), `OverrideForm`, `OverrideOutcome`, `SessionStore` with `getState`, `subscribe`, `loadSample`, `selectVersion`, `submitOverride`, `dispatchIntro`, `clearNotice`, `reset`, `createSessionStore(deps)` and `useSession(store)` (`useSyncExternalStore`)
    - `loadSample` validates the Sample with `sampleSchema`, hashes the UTF-8 bytes of `receiptText`, runs `runPipeline` at v1 and dispatches `decision_ready` (source `{ kind: "text", text }`, `reducedMotion` from `deps.prefersReducedMotion()`) or `load_failed`; `selectVersion` calls `replayTrace` once per unseen label and never an extraction port; `submitOverride` calls Core `override` with the displayed Trace and `portFactory.base`, returns `{ ok: false, field, message }` for `invalid_override_input`; every rejected promise becomes `load_failed`
    - _Requirements: 10.1, 12.4, 12.10, 13.2, 13.3, 13.4, 13.7, 14.3, 14.4, 14.8_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add session store"`
  - [x] 16.8 Write session store tests
    - `tests/unit/sessionStore.node.test.ts` with a fake `sha256`, spy `replayFn` and fake ports: `loadSample` then `selectVersion("v2")` twice calls `replayFn` once; `selectVersion("v1")` never calls it; a failing `replayFn` keeps the displayed version and sets a notice; a blank reviewer name returns `{ ok: false, field: "reviewerName" }` and leaves the state unchanged; a valid override is linked to the displayed `decisionId`; an invalid sample gives `load_failed` with `fixture_invalid`; `reset` returns the start screen
    - _Requirements: 12.10, 13.3, 13.4, 13.7, 14.3, 14.4, 14.8_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): session store"`
  - [x] 16.9 Write property test for replay memoization
    - `tests/properties/replay-memo.node.test.ts`, tag `// Feature: expense-auditor, Property 13: Replay memoization`; random label selection sequences on a store with a counting `replayFn` and a throwing extraction adapter factory; at most one call per label other than v1, none for v1, v1 entry and original `decisionId` unchanged
    - **Property 13: Replay memoization**
    - **Validates: Requirements 13.3, 13.4, 13.5**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 13 replay memoization"`

- [x] 17. Export
  - [x] 17.1 Implement the export builder
    - `src/export/exportTrace.ts`: `ExportFile`, `buildExport(state)` (displayed Trace, linked overrides only, `replayedFrom` only when the displayed Trace is not the original, key absent otherwise), `serializeExport` (`JSON.stringify(f, null, 2)`), `exportFileName` (`expense-trace-` plus first 8 characters of `decisionId` plus `.json`), `downloadText(name, text, env?)` with an injectable `DownloadEnv` (Blob, object URL, temporary anchor, revoke; no network call, never throws)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add trace export"`
  - [x] 17.2 Write property test for the export round trip
    - `tests/properties/export-roundtrip.node.test.ts`, tag `// Feature: expense-auditor, Property 15: Export serialization round trip`; JSON-safe Traces and Override lists; parse equals the exported structure, file name shape, `replayedFrom` presence rule, only linked overrides
    - **Property 15: Export serialization round trip**
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.6**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 15 export round trip"`
  - [x] 17.3 Write download tests
    - `tests/unit/exportTrace.node.test.ts`: `downloadText` with fake `DownloadEnv` creates one Blob and one anchor with the file name, clicks it and revokes the URL; a `fetch` spy records zero calls; a throwing env does not throw out of `downloadText`
    - _Requirements: 15.1, 15.5_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): download helper"`

- [x] 18. Anatomy and field labels
  - [x] 18.1 Implement the anatomy
    - `src/anatomy.ts`: `anatomy` with the five bones (`date-blocking-before` "Date before trip" and `date-blocking-after` "Date after trip" on `spine`, `alcohol-deducting` "Alcohol" on `pelvis`, `meal-limit` "Meal limit" on `ribs`, `line-item-cap` "Line-item match" on `arm-right`), `fieldLabels` for every Rule_Field, `amountCents` and the computed keys `lineItems[*].amount_sum` and `alcoholLineItems[*].amount_sum` ("Alcohol total"), and `formatValue`
    - _Requirements: 11.1, 11.2, 11.12_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add anatomy and field labels"`
  - [x] 18.2 Write anatomy tests
    - `tests/unit/anatomy.node.test.ts`: region mapping per rule id; a label exists for each key of the Rule_Fields, `amountCents` and both computed keys; every rule id used by the three rule sets has a bone; `anatomy.formatValue` equals `formatValue`; every key of the proposed fields of the three recorded samples (`merchant`, `receiptDate`, `claimedTotalCents`, `lineItems`) has a label, so no AI card row is hidden or falls back to a raw key; no label matches `/[a-z][A-Z]/`
    - _Requirements: 11.1, 11.2, 11.12_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): anatomy"`

- [x] 19. UI components
  - [x] 19.1 Write the App stylesheet
    - `src/styles/app.css`: `.app-plate` metal plate from xray-ui tokens (`--xr-*`), layout for the start screen and decision view, `:focus-visible { outline: 3px solid var(--xr-focus); outline-offset: 2px }`, button, form and dialog styles with the token pairs verified in xray-ui; no `transition`, `animation` or `@keyframes`; no `url(`
    - _Requirements: 18.1, 18.2, 18.4_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add app stylesheet"`
  - [x] 19.2 Implement `ErrorPanel` and `describeError`
    - `src/ui/ErrorPanel.tsx`: `role="alert"`, `h2` "This receipt cannot be decided", `describeError(e)` returning `{ summary, details }` with the plain-English mapping of design.md (one `li` per `validation_failed` field error as `Label (path): issue`, the four `extraction_failed` reasons, `fixture_*`, `input_*`, upload problems show their own message); never stack traces or raw model output
    - Built before the other components because StartScreen and DecisionView render it
    - _Requirements: 9.8, 11.2, 16.9, 16.10, 16.11_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add ErrorPanel"`
  - [x] 19.3 Write ErrorPanel tests
    - `tests/components/ErrorPanel.test.tsx` and `tests/unit/describeError.node.test.ts`: each failing field path and issue is listed with its plain label and the raw path in `code`; the four `extraction_failed` texts; upload problem text; `null` renders nothing; the panel has `role="alert"`
    - _Requirements: 9.8, 16.9, 16.10, 16.11_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): ErrorPanel"`
  - [x] 19.4 Implement `VersionNote`
    - `src/ui/VersionNote.tsx`: `null` renders nothing, otherwise `<p role="status" className="app-note">` with the note text, e.g. "Replayed with v2"; test in `tests/components/VersionNote.test.tsx` (hidden for `null`, text for a note)
    - _Requirements: 13.6, 18.5_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add VersionNote"`
  - [x] 19.5 Implement `OverrideDialog`
    - `src/ui/OverrideDialog.tsx` with native `<dialog>` (`aria-labelledby` to the `h2` "Overrule decision"), `showModal`/`close` driven by `open`, fields "Reviewer name", "Reason" (`maxLength` 500, counter "N / 500") and "New result" (options `approved`, `partially_approved`, `rejected`, visible "Approved", "Partially approved", "Rejected"), buttons "Save override" and "Cancel", inline `role="alert"` error with `aria-invalid` and `aria-describedby` next to the failing field and focus moved to it, Escape (`cancel` event) calls `preventDefault` then `onClose`, focus returns to `returnFocusTo`, form state resets on open, initial focus on "Reviewer name"
    - _Requirements: 14.1, 14.2, 14.4, 18.1, 18.3_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add OverrideDialog"`
  - [x] 19.6 Write OverrideDialog tests
    - `tests/components/OverrideDialog.test.tsx` with user-event: labelled fields; opens focused on "Reviewer name"; Escape closes and returns focus to the "Overrule" button; a blank reviewer shows the inline alert next to the field and keeps the dialog open; a valid submit calls `onSubmit` once with the form and closes; reason longer than 500 is prevented; "Cancel" closes
    - _Requirements: 14.1, 14.2, 14.4, 18.1, 18.3_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): OverrideDialog"`
  - [x] 19.7 Implement `Toolbar`
    - `src/ui/Toolbar.tsx`: `role="toolbar"` "Decision actions" with "Overrule" (ref for focus return), "Download trace" (calls `downloadText(exportFileName(trace), serializeExport(buildExport(state)))`) and "Load another receipt" (`store.reset()`); all `type="button"`; test in `tests/components/Toolbar.test.tsx` with an injected download function and a fetch spy (zero calls)
    - _Requirements: 12.10, 14.1, 15.1, 15.5, 18.1_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add Toolbar"`
  - [x] 19.8 Implement the sample part of `StartScreen`
    - `src/ui/StartScreen.tsx`: `h1` "Expense Auditor", the plate "Expense Auditor - RECORDED", the text "The AI reads the receipt. The rules decide.", `role="group"` "Load sample receipt" with the buttons "Signature case", "Clean meal", "Outside the trip window" (blurbs via `aria-describedby`), `formatTripWindow(DEFAULT_TRIP)` text, busy state with `role="status"` "Reading receipt" and disabled buttons, `ErrorPanel` for an error; props `busy`, `error`, `onLoadSample` (live props arrive in task 22.9)
    - _Requirements: 12.1, 12.3, 17.3, 18.1, 18.3_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add StartScreen"`
  - [x] 19.9 Write StartScreen tests
    - `tests/components/StartScreen.test.tsx`: the three buttons with the exact names; clicking calls `onLoadSample` with the id; the explanation text and trip window are shown; no file input and no date input exist; `busy` disables buttons and shows the status; an error shows the panel
    - _Requirements: 12.1, 12.3_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): StartScreen"`
  - [x] 19.10 Implement `DecisionView` with the intro sequence
    - `src/ui/DecisionView.tsx`: `XrayView` with `trace`, `anatomy`, `source` (receipt text on the film clip), `title` from `titlePlate`, `versions` `["v1","v2","v3"]`, `version`, `onVersionChange` (guarded by `isVersionLabel`), `xray={intro.xray}`, `onXrayChange` dispatching `{ type: "user" }`, `effective` only when `effectiveView` is not a CoreError and not `null`; no `onReplay` or `onOverride`; around it `Toolbar`, `OverrideDialog` (open state and `returnFocusTo` ref), `VersionNote`, the trip text, an `ErrorPanel` for `state.notice` and for an `effectiveView` CoreError; one effect: when `intro.pending` start `setTimeout(..., INTRO_DELAY_MS)` dispatching `{ type: "timer" }`, cleanup clears it; replay and override never move focus
    - _Requirements: 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 13.6, 13.7, 14.5, 14.7, 14.10, 17.1, 18.5_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add DecisionView"`
  - [x] 19.11 Write DecisionView tests
    - `tests/components/DecisionView.test.tsx` with a store built from fakes (real bundle, fake `sha256` and ports): the signature case shows the plate "PARTIALLY APPROVED" and "$41.50", two `button.xr-bone-btn[data-state="fractured"]`, meal-limit passed with "applied, no change", the stamp "OVERRULED BY RULE"; pressing ArrowRight on the version slider shows "Replayed with v2" and leaves `document.activeElement` unchanged; an override shows "overruled by" and "Rules decided: PARTIALLY APPROVED" while the fractured bone count stays 2; a failing replay shows the error panel and keeps v1; the film clip shows the receipt lines
    - _Requirements: 12.7, 12.9, 13.6, 13.7, 14.5, 14.7, 14.10, 18.5_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): DecisionView"`
  - [x] 19.12 Write the first-10-seconds intro test
    - `tests/components/intro.test.tsx` with `vi.useFakeTimers()` and a `matchMedia` mock: after loading the signature case the X-RAY switch (`role="switch"`) has `aria-checked="false"`; it is `"true"` after 600 ms (not yet at 499 ms); with `prefers-reduced-motion` it is `"true"` immediately; a user click before 600 ms keeps the user's choice after 600 ms and leaves no pending timer; unmount clears the timer
    - _Requirements: 12.4, 12.5, 12.6, 12.7, 12.8_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): intro sequence timing"`
  - [x] 19.13 Wire the App and the production session
    - Add `createProductionSession()` to `src/state/sessionStore.ts` (real `loadBundle()`, `sha256Hex`, `makePortFactory()`, Core `replay` and `override`, `matchMedia` for reduced motion); `src/App.tsx` renders `StartScreen` or `<DecisionView key={sessionId}>` inside `<main>`, shows `ErrorPanel` when `loadBundle()` fails, moves focus to the screen heading after a screen change, wraps the tree in an error boundary ("Something went wrong. Reload the page."); `src/main.tsx` builds the session and renders `<App store={store} />`; replace the smoke test with the real App test in the next task
    - _Requirements: 10.9, 12.1, 12.4, 12.10, 17.3, 18.5_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): wire App and production session"`
  - [x] 19.14 Write App tests
    - `tests/components/App.test.tsx` (replace `App.smoke.test.tsx`): start screen to decision and back with "Load another receipt" (the replay and override state are gone); a `fetch` spy records zero requests while loading a sample, replaying and exporting; a broken bundle shows the panel; the error boundary shows its message; the heading receives focus after a screen change
    - _Requirements: 12.1, 12.10, 16.17, 18.5_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): App flow and recorded mode"`

- [x] 20. Checkpoint - offline App
  - [x] 20.1 Checkpoint - offline App green
    - Run `pnpm test`, `pnpm typecheck` and `pnpm --filter @bones/expense-auditor build` from the repo root; all green
    - Confirm `git status` is clean; no task so far changed `packages/core` or `packages/xray-ui` after the prerequisite checkpoint (`git log --stat` since checkpoint 6.1)
    - Ensure all tests pass, ask the user if questions arise
    - _Requirements: 6.4, 6.5, 6.6, 8.7_
    - Commit: none (verification only)

- [x] 21. Live mode: server
  - [x] 21.1 Implement the wire contract
    - `shared/wire.ts` as in design.md: `MAX_IMAGE_BYTES` (3 MiB), `MAX_BODY_CHARS`, `MEDIA_TYPES`, `extractRequestSchema`, `modelOutputSchema` (strict, `centsSchema`, `unit` 0 to 1, no decision field), `extractionResultWireSchema`, `ERROR_CODES`, `errorBodySchema`, `liveStatusSchema`, `toExtractionResult`; imports only `zod` and `./iso`
    - _Requirements: 16.2, 16.6, 16.7, 16.8_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add extract wire contract"`
  - [x] 21.2 Implement the model schema and prompts with tests
    - `api/_lib/schema.ts`: `MODEL_JSON_SCHEMA` (every object `additionalProperties: false`, all keys required, no `minimum`/`maximum`) and `SYSTEM_PROMPT` as in design.md
    - `tests/api/schema.node.test.ts`: `additionalProperties: false` on every object, only the `date` format, no key matching `/decision|approv|verdict|reject|allow/i`, the prompt contains "never judge"; `MODEL_JSON_SCHEMA` accepts what `modelOutputSchema` accepts for a valid example
    - _Requirements: 16.6_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add model schema and prompt"`
  - [x] 21.3 Implement the rate limiter
    - `api/_lib/rateLimit.ts`: `RATE_LIMIT_MAX = 10`, `RATE_LIMIT_WINDOW_MS = 10 * 60_000`, `clientKey(headers)` (first `x-forwarded-for` entry, else `x-real-ip`, else "unknown"), `checkRateLimit(store, key, now)` with expiry on access and a sweep when `store.size > 1000`; unit tests in `tests/api/rateLimit.node.test.ts` (first 10 allowed, 11th rejected with `retryAfterSec`, window expiry, independent keys, sweep)
    - _Requirements: 16.14_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add per-IP rate limiter"`
  - [x] 21.4 Write property test for the rate limit
    - `tests/properties/rate-limit.node.test.ts`, tag `// Feature: expense-auditor, Property 21: Per-IP rate limit`
    - **Property 21: Per-IP rate limit**
    - **Validates: Requirements 16.14**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 21 rate limit"`
  - [x] 21.5 Implement the provider client
    - `api/_lib/provider.ts`: `ANTHROPIC_URL`, `ANTHROPIC_VERSION = "2026-10-21"`, `createAnthropicClient({ apiKey, model, fetchImpl, timeoutMs })` returning an `LlmClient`; request with the image block before the text block, `output_config.format` JSON schema plus `output_config.effort` `"low"`, `max_tokens` 16000, no `thinking`, `tool_choice`, `temperature`, `top_p` or `top_k`, 25 s abort timeout, the key only in the `x-api-key` header; every failure (thrown fetch, abort, non-2xx, non-JSON body, `stop_reason` `refusal` or `max_tokens`, no text block) returns `{ ok: false, kind: "upstream" }` without any message text; no retries
    - _Requirements: 16.5, 16.6, 16.11, 16.16_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add provider client"`
  - [x] 21.6 Write provider client tests
    - `tests/api/provider.node.test.ts` with `fakeFetch`: URL, headers (`x-api-key`, `anthropic-version` equal to the constant, `content-type`), body keys, image before text, `output_config.format.type` `json_schema`, `output_config.effort` `"low"`, `max_tokens` 16000, none of `thinking`, `tool_choice`, `temperature`, `top_p`, `top_k`; success returns `{ ok: true, text }`; all failure mappings return `{ ok: false, kind: "upstream" }` with no message field
    - _Requirements: 16.5, 16.6, 16.11_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): provider client"`
  - [x] 21.7 Implement the extract handler
    - `api/_lib/handler.ts`: `LlmClient`, `RateLimitStore`, `HandlerDeps`, `createExtractHandler(deps)` returning `(req: Request) => Promise<Response>`; check order method, live flag (`LIVE_EXTRACTION === "on"` and non-empty key and model, read from `deps.env` only), origin, rate limit, body size, parse (`extractRequestSchema`, base64 decode, magic bytes of JPEG or PNG matching `mediaType`), 3 MiB decoded cap, provider call, strict `modelOutputSchema` validation; status and body table of design.md; headers `content-type`, `cache-control: no-store`, `x-content-type-options: nosniff`; `GET` answers only `{ live }`; `log` receives status, code and duration only; imports only `zod`, `../../shared/*` and `./*`
    - _Requirements: 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.11, 16.12, 16.14, 16.15_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add extract handler"`
  - [x] 21.8 Write handler tests
    - `tests/api/handler.node.test.ts` with `createExtractHandler({ env, llm: fakeLlm, now, rateLimitStore: new Map() })`: GET `{ live: true }` only with all three variables, body has exactly one key; POST success equals `toExtractionResult(parsed, text)`; rejections without a provider call (405 with `Allow`, foreign `Origin`, malformed JSON, unknown key, bad base64, GIF bytes declared as JPEG, body over `MAX_BODY_CHARS`); provider failure gives 502 `upstream_failed`; strict validation failure gives 502 `model_output_invalid`; 429 with `Retry-After`; response headers
    - _Requirements: 16.2, 16.3, 16.4, 16.7, 16.8, 16.11, 16.12, 16.14, 16.15, 19.2_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): extract handler"`
  - [x] 21.9 Write property test for the kill switch
    - `tests/properties/kill-switch.node.test.ts`, tag `// Feature: expense-auditor, Property 17: The kill switch blocks the provider`; `arbEnvNotOn` defined inside the test file (unset, empty, "ON", "true", "1", any non-"on" text) and any POST body: 403 `disabled`, the fake LLM is never called, GET is exactly `{"live":false}`
    - **Property 17: The kill switch blocks the provider**
    - **Validates: Requirements 16.2, 16.3, 16.4**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 17 kill switch"`
  - [x] 21.10 Write property test that the key never leaves the server
    - `tests/properties/key-never-leaks.node.test.ts`, tag `// Feature: expense-auditor, Property 18: The key never leaves the server`; random bodies, provider outcomes and thrown fetch messages containing the key; the key is absent from response bodies, headers and logged events, and appears in outgoing provider requests only as the `x-api-key` header value
    - **Property 18: The key never leaves the server**
    - **Validates: Requirements 16.5, 19.2**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 18 key never leaks"`
  - [x] 21.11 Write property test for model output validation
    - Add `arbValidModelOutput` and `arbBadModelOutput` to the arbitraries helper; `tests/properties/model-output.node.test.ts`, tag `// Feature: expense-auditor, Property 19: Model output validation is strict and lossless`; valid output gives 200 with `rawModelOutput` equal to the exact provider text; one injected defect (extra key at any level, confidence outside 0 to 1, negative or fractional cents, non-date `receiptDate`) gives 502 `model_output_invalid`
    - **Property 19: Model output validation is strict and lossless**
    - **Validates: Requirements 16.6, 16.7, 16.8**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 19 model output validation"`
  - [x] 21.12 Write property test for the size cap
    - `tests/properties/size-cap.node.test.ts`, tag `// Feature: expense-auditor, Property 20: Size cap`; decoded sizes around 3 MiB: the provider is called if and only if the size is at most 3 MiB, larger images give 413 with no provider call
    - **Property 20: Size cap**
    - **Validates: Requirements 16.12**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 20 size cap"`
  - [x] 21.13 Add the function entry
    - `api/extract.ts`: one default export `{ fetch(request) }` that builds the handler from `process.env`, `createAnthropicClient({ apiKey: env.ANTHROPIC_API_KEY ?? "", model: env.EXTRACTION_MODEL ?? "", fetchImpl: fetch })`, `Date.now`, a module-level `Map` store and a `console.log(JSON.stringify(event))` logger; it imports only `./_lib/*` (and `zod` through them), nothing from `src/`
    - Add `tests/api/entry.node.test.ts`: with no environment variables `GET` returns `{"live":false}` and `POST` returns 403 `disabled`, with no network access
    - _Requirements: 16.2, 16.3, 16.4, 16.5, 20.1_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add extract function entry"`
  - [x] 21.14 Add the dev middleware for `pnpm dev`
    - In `apps/expense-auditor/vite.config.ts` add the `devExtractApi` plugin from design.md (serve only, never in `vite build`): loads `.env.local` into the server process only, mounts `/api/extract` through `server.ssrLoadModule("/api/extract.ts")`, converts the Node request to a Web `Request` and forwards `x-forwarded-for`; run `pnpm --filter @bones/expense-auditor build` and `pnpm typecheck`
    - _Requirements: 16.2, 16.5, 20.6_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add dev middleware for the extract function"`

- [x] 22. Live mode: client
  - [x] 22.1 Implement `HttpExtractionAdapter`
    - `src/extraction/HttpExtractionAdapter.ts` as in design.md: `guardInput`, string input gives `validation_failed` (`input`: "expected image bytes"), base64 in 0x8000-byte chunks, `POST` with a body of exactly `imageBase64` and `mediaType`, abort timeout 30 s, thrown fetch or abort gives `extraction_failed` `network`, non-2xx parsed with `errorBodySchema` gives the wire `reason` (unparseable gives `upstream` for 500 or more, else `bad_response`), 2xx validated with `extractionResultWireSchema` (any failure gives `bad_response`); no retry on 4xx
    - _Requirements: 16.1, 16.7, 16.9, 16.10_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add http extraction adapter"`
  - [x] 22.2 Write adapter tests with a mocked fetch
    - `tests/unit/httpAdapter.node.test.ts`: request body keys are exactly `imageBase64` and `mediaType`; 200 valid returns the extraction; 403 `disabled`; rejected promise gives `network`; 200 with a wrong shape gives `bad_response`; 502 with an unparseable body gives `upstream`; no second call after a 4xx; string input gives `validation_failed`
    - _Requirements: 16.1, 16.7, 16.9, 16.10, 19.1_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): http extraction adapter"`
  - [x] 22.3 Implement the live status check
    - `src/extraction/liveStatus.ts`: `fetchLiveStatus(fetchImpl, endpoint, timeoutMs = 3000)` using `GET`, true only when `res.ok`, the body parses and `liveStatusSchema` accepts `{ live: true }`; HTML bodies, network errors, timeouts and bad JSON give `false`; sends no receipt data
    - _Requirements: 16.2, 16.17_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add live status check"`
  - [x] 22.4 Write live status tests
    - `tests/unit/liveStatus.node.test.ts`: `{ live: true }` gives true; `{ live: false }`, an HTML fallback page, a rejected fetch, an abort after the timeout (fake timers) and a body with an extra key give false
    - _Requirements: 16.2_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): live status check"`
  - [x] 22.5 Implement image preparation
    - `src/extraction/imageResize.ts`: `MAX_EDGE = 1600`, `JPEG_QUALITY = 0.85`, `MAX_RAW_FILE_BYTES` (20 MiB), `PreparedImage`, pure `fitWithin`, injectable `ImageEnv`, `browserImageEnv` (`createImageBitmap`, `OffscreenCanvas` with a `canvas` fallback, white fill for PNG), `prepareImage(file, env)` returning `PreparedImage | UploadProblem`: type check (JPEG and PNG only), raw-size cap, downsized JPEG, fallback to the original bytes when canvas fails and the file is within 3 MiB, `too_large` after encoding above 3 MiB
    - _Requirements: 12.11, 16.12, 16.13_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add image preparation"`
  - [x] 22.6 Write property test for image geometry
    - `tests/properties/image-geometry.node.test.ts`, tag `// Feature: expense-auditor, Property 22: Image geometry`; `fitWithin` returns integers of at least 1, long edge at most 1600, no enlargement, aspect ratio within one pixel of rounding
    - **Property 22: Image geometry**
    - **Validates: Requirements 16.13**
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): property 22 image geometry"`
  - [x] 22.7 Write image preparation unit tests
    - `tests/unit/imageResize.node.test.ts` with a fake `ImageEnv`: a GIF gives `{ reason: "type" }`; a file above the raw cap gives `too_large`; an encode result above 3 MiB gives `too_large`; the decoder failing falls back to the original bytes within 3 MiB and gives `unreadable` above it; a PNG is converted to JPEG
    - _Requirements: 12.11, 16.13_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): image preparation"`
  - [x] 22.8 Add photo loading to the session store
    - Extend `SessionDeps` with `makeLiveAdapter` and `revokeObjectUrl`; add `loadPhoto({ image, fileName, trip })` to `SessionStore` (adapter from `makeLiveAdapter(image.mediaType)`, input bytes are the prepared bytes, source `{ kind: "image", src: previewUrl, alt: "Uploaded receipt photo" }`, origin `{ kind: "live", fileName }`); `reset` revokes the preview URL once; `createProductionSession` passes `new HttpExtractionAdapter(...)` and `URL.revokeObjectURL`
    - Add tests to `tests/unit/sessionStore.node.test.ts`: a fake live adapter returning a valid extraction gives a decision with origin `live`; an `extraction_failed` error gives `load_failed`; `reset` calls `revokeObjectUrl`; the hashed bytes equal the prepared bytes
    - _Requirements: 10.3, 10.7, 12.10, 16.1_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add photo loading to the session store"`
  - [x] 22.9 Add the live controls to `StartScreen`
    - Extend `StartScreen` with `liveAvailable` and `onLoadPhoto`: when true render a `<fieldset>` "Live receipt photo" with the labelled controls "Upload receipt photo" (`accept="image/jpeg,image/png"`), "Trip start" and "Trip end" (`type="date"`, required, prefilled 2024-03-10 and 2024-03-20) and the button "Read receipt"; when false none of these nodes exist; a wrong type or an oversized prepared image shows the upload message and does not call `onLoadPhoto`; plate shows "- LIVE" while a file is selected, otherwise "- RECORDED"
    - Wire `prepareImage` in `App.tsx` so `onLoadPhoto` receives a `PreparedImage` and the trip window
    - _Requirements: 12.2, 12.3, 12.11, 17.3, 18.3_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): add live controls to StartScreen"`
  - [x] 22.10 Write live control tests
    - Extend `tests/components/StartScreen.test.tsx`: with `liveAvailable` true the labelled upload control and two date inputs prefilled "2024-03-10" and "2024-03-20" exist; with false they do not; a `.gif` file and an oversized prepared image show a readable message and a `fetch` spy stays at zero; selecting a valid file changes the plate to "Expense Auditor - LIVE"
    - _Requirements: 12.2, 12.3, 12.11, 17.3_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): live controls"`
  - [x] 22.11 Wire the live status and the LIVE title plate
    - In `App.tsx` call `fetchLiveStatus` once in an effect with an empty dependency list and pass `liveAvailable` to `StartScreen`; confirm `DecisionView` passes "Expense Auditor - LIVE" for `origin.kind === "live"`
    - Extend `tests/components/App.test.tsx`: a status response `{ live: true }` shows the upload control, `{ live: false }` and a failed status request hide it; a live decision shows the plate "Expense Auditor - LIVE" and a sample decision shows "Expense Auditor - RECORDED"; only the status request is made while on the start screen
    - _Requirements: 16.2, 16.17, 17.1, 17.2, 17.3_
    - Commit: `git add apps/expense-auditor && git commit -m "feat(expense-auditor): wire live status and LIVE title plate"`

- [x] 23. Guard tests
  - [x] 23.1 Write the no-case-files guard
    - `tests/guards/no-case-files.node.test.ts`: walk `src`, `api`, `shared`, `tests` and `e2e`; fail on any import specifier or path containing `case-files` (build the pattern from two parts so the guard does not match its own source)
    - _Requirements: 19.10_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): guard against case-files imports"`
  - [x] 23.2 Write the workspace-import guard
    - `tests/guards/workspace-imports.node.test.ts`: in `src` every `@bones/` specifier is `@bones/core` or `@bones/xray-ui`; no `@bones/core/node`; no `node:` specifier or Node built-in (reuse the specifier regex style of Core's `browser-barrel.test.ts`); `shared/` and `api/_lib/` import nothing from `src/`
    - _Requirements: 6.6, 8.7, 19.12_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): guard workspace imports"`
  - [x] 23.3 Write the secret scan guard
    - `tests/guards/no-secrets.node.test.ts`: run `build` from `vite` programmatically with a temporary `outDir` and `logLevel: "silent"` (timeout 120 s), scan every output file and every file in `src` for `ANTHROPIC_API_KEY`, `LIVE_EXTRACTION`, `EXTRACTION_MODEL`, `x-api-key`, `/sk-[A-Za-z0-9_-]{20,}/`, `/sk-ant-/`; scan `src` for `/api[_-]?key/i` and `VITE_` names containing KEY or SECRET; assert no `.map` file; a match reports file and text
    - Canary build: the build runs with `ANTHROPIC_API_KEY="sk-canary-…"` (fixed random-looking string), `LIVE_EXTRACTION=on` and `EXTRACTION_MODEL=canary-model` set in `process.env` (no `VITE_` variable, no file on disk; env restored afterwards). Every output file (html, css, js, json) must not contain the canary value, `x-api-key`, `anthropic-version` (both case-insensitive) or `api.anthropic.com`; no `.map` file
    - Self-test: the scanner detects the canary, the headers, the host and a `.map` file in a fake dist written to an os temp dir
    - Shared helper `tests/helpers/build.ts` exports `buildOnce()` (cached per process, os temp `outDir`, `logLevel: "silent"`), `cleanupBuild()`, `listFiles()` and `CANARY_KEY`; task 23.6 reuses `buildOnce()`
    - _Requirements: 16.5, 19.11_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): guard against secrets in src and dist"`
  - [x] 23.4 Write the hygiene guard
    - `tests/guards/app-hygiene.node.test.ts`: `app.css` has no `transition`, `animation`, `@keyframes`; `src` has no `AudioContext`, `new Audio`, `<audio`; `src` has none of the words `login`, `logout`, `password`, `oauth`, `jwt`, `bearer`, `authenticate`, `cookie` as whole words
    - Extension, Dr. Bones never calls an LLM. Already guarded and only referenced: xray-ui `source-hygiene.test.ts` (no fetch/XMLHttpRequest/WebSocket/api key/openai/anthropic import in xray-ui src) and `properties/chat-source.test.tsx` (chat text equals builder output, net spy sees zero calls); app `no-visual-in-app.node.test.ts` (auth words, audio, motion in src)
    - `tests/guards/no-llm-in-chat.node.test.ts`: (a) xray-ui chat files `DrBonesChat.tsx`, `chat/ChatLog.tsx`, `panels/DoctorPanel.tsx`, `model/chat.ts` contain no fetch/XMLHttpRequest/WebSocket/EventSource/sendBeacon, no anthropic/openai/llm, no extraction adapter or port reference, and import only relative modules, `react` and `@bones/core`; (b) in app `src` only `extraction/HttpExtractionAdapter.ts` and `extraction/liveStatus.ts` use a network API (allow-list by file), and `ui/` files do not import them
    - `tests/guards/no-llm-in-chat.runtime.test.tsx`: (c) with throwing stubs for fetch, XMLHttpRequest, WebSocket and EventSource (no real network), render `DecisionView` for the signature sample, check chat bubbles show, replay with the next rule version, and assert zero stub calls
    - _Requirements: 6.8, 18.4, 18.6, 20.5_
    - Commit: `git add apps/expense-auditor .kiro/specs/expense-auditor/tasks.md && git commit -m "test(expense-auditor): hygiene and no-LLM-in-chat guards"`
  - [x] 23.5 Write the contrast guard
    - `tests/helpers/contrast.ts` (`relativeLuminance`, `contrastRatio`) and `tests/guards/contrast.node.test.ts`: read `packages/xray-ui/src/styles/tokens.css`, resolve the token pairs `app.css` uses (text on panel, dim text on panel, plate text on plate, focus on panel) and require at least 4.5 for text and 3 for the focus ring; every token named in `app.css` exists
    - _Requirements: 18.2_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): contrast guard"`

  - [x] 23.6 Write the no-EUR guard
    - `tests/guards/no-eur.node.test.ts`: whole-word `EUR` (case-sensitive) does not appear in `src`, `recorded`, `e2e` and in the `dist` of the programmatic build used by the secret scan; `packages/xray-ui/demo/anatomy.ts` and `packages/xray-ui/README.md` do not contain it either; the guard file itself builds the pattern from two string parts so it does not match itself
    - _Requirements: 11.11, 19.15, 21.13_
    - Commit: `git add apps/expense-auditor && git commit -m "test(expense-auditor): no EUR guard"`
- [x] 24. Deploy files and README
  - [x] 24.1 Add `vercel.json`, `.env.example` and the config smoke test
    - `apps/expense-auditor/vercel.json` exactly as in design.md (framework `vite`, `installCommand` `pnpm install --frozen-lockfile`, `buildCommand` `pnpm build`, `outputDirectory` `dist`, `functions` `api/extract.ts` with `maxDuration` 30, the security headers and CSP); `.env.example` with `LIVE_EXTRACTION=off`, `ANTHROPIC_API_KEY=` (empty) and `EXTRACTION_MODEL=claude-haiku-5-5`
    - `tests/guards/config-smoke.node.test.ts`: parse `vercel.json` (framework, output directory, function path, `maxDuration`), `.env.example` (`LIVE_EXTRACTION=off`, nothing after `ANTHROPIC_API_KEY=`) and `package.json` (name, scripts, exact pins without `^` or `~`)
    - _Requirements: 6.1, 6.2, 20.1, 20.2, 20.4_
    - Commit: `git add apps/expense-auditor && git commit -m "chore(expense-auditor): add vercel config and env example"`
  - [x] 24.2 Write the App README
    - `apps/expense-auditor/README.md`: why the LLM never decides, in plain language, with the table of the five Bones parts (extraction: `RecordedSampleAdapter`, `HttpExtractionAdapter` and the Zod schema; rules: `rules/expense-auditor/`; trace: the frozen Trace and the "Download trace" file; override: the Overrule dialog; X-ray: `XrayView`); "Try it" steps (install, `pnpm dev`, load "Signature case" and what to see: "$41.50", two fractured bones, cracked card, stamp "OVERRULED BY RULE"; unit tests; `pnpm exec playwright install chromium` then `pnpm e2e`; live mode locally with `.env.local`; live mode on Vercel with root directory `apps/expense-auditor`, "Include source files outside of the Root Directory in the Build Step", install and build commands, the `GET /api/extract` post-deploy check); security notes (key only in server environment, `LIVE_EXTRACTION` kill switch, 3 MiB size cap, best-effort per-IP rate limit, provider spend limit and platform rate-limit rule recommended); the known limitations list from design.md that matter to users
    - _Requirements: 6.7, 20.3, 20.5, 20.6, 20.7, 20.8_
    - Commit: `git add apps/expense-auditor/README.md && git commit -m "docs(expense-auditor): add README"`

- [x] 25. End-to-end test
  - [x] 25.1 Add the Playwright configuration
    - `apps/expense-auditor/playwright.config.ts`: merged into the existing config from the visual-polish spec (its screenshot settings, 1440x900 viewport and 60 s server timeout are kept) with the design.md settings (testDir `./e2e`, chromium only, `reducedMotion: "reduce"`, `acceptDownloads`, `baseURL` `http://127.0.0.1:4173`, `webServer` command `pnpm build && pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort` with `LIVE_EXTRACTION: "off"`, `reuseExistingServer: !process.env.CI`); the root alias `pnpm e2e` (task 7.4, `pnpm --filter @bones/expense-auditor test:e2e`) already exists and runs this config
    - Run `pnpm exec playwright install chromium` in `apps/expense-auditor` (environment step, not committed); run `pnpm --filter @bones/expense-auditor typecheck`
    - _Requirements: 6.3, 6.7, 19.5_
    - Commit: `git add apps/expense-auditor/playwright.config.ts && git commit -m "test(expense-auditor): add playwright config"`
  - [x] 25.2 Write the signature-flow e2e spec
    - `apps/expense-auditor/e2e/signature.spec.ts`, the single test of design.md: load "Signature case"; the X-RAY switch (`role="switch"`) is on right after the decision appears (reduced motion); `.xr-result-label` "PARTIALLY APPROVED" and `.xr-result-amount` "$41.50"; exactly two `button.xr-bone-btn[data-state='fractured']` inside the group "Decision skeleton" named "Line-item match, rule line-item-cap version 1.0.0, fractured" and "Alcohol, rule alcohol-deducting version 1.0.0, fractured"; the meal-limit bone `data-state="passed"` with the text "applied, no change"; the stamp "OVERRULED BY RULE" visible; focus the `slider` named "RULE VERSION", press ArrowRight twice, `aria-valuetext` "v3", "Replayed with v3" visible, plate unchanged; "Overrule" with "Dana Reviewer", a reason and "approved"; plate "APPROVED", "overruled by Dana Reviewer", "Rules decided: PARTIALLY APPROVED", still two fractured bones; "Download trace" file name `expense-trace-<8 hex>.json` whose JSON has `format`, `trace.result` `partially_approved`, `trace.amountCents` 4150, one override with `reviewerName`, `replacementResult` and matching `decisionId`, and `replayedFrom.ruleSetVersion` "1.0.0"
    - Layout and readability checks in the same test, after the stamp is visible: at viewport 1280x800 and again at 390x844, the bounding box of the stamp (`getByRole("note").filter({ hasText: "OVERRULED BY RULE" })`) intersects no `.xr-field-value` bounding box of the AI card; `getComputedStyle` gives a lower numeric `z-index` for `.xr-crack-overlay` than for `.xr-answer-body`, and every `.xr-field` has a background colour with alpha 1; the text of every AI card row contains neither "{" nor "[", and no row label matches `/[a-z][A-Z]/`; the page text contains "$480.00" and "$41.50" and never "EUR"
    - Run `pnpm e2e` from the repo root; it passes
    - _Requirements: 12.4, 12.6, 12.7, 13.6, 14.5, 15.1, 15.2, 15.3, 19.5, 19.6, 19.7, 19.8, 19.9, 19.13, 19.14, 21.1, 21.2, 21.5, 21.6, 21.7, 21.10_
    - Commit: `git add apps/expense-auditor/e2e && git commit -m "test(expense-auditor): signature flow e2e"`

- [ ] 26. Manual verification checklist
  - [ ] 26.1 Write the manual check section in the README
    - Add a "Manual check before a release" section to `apps/expense-auditor/README.md` listing what a person looks at with `pnpm --filter @bones/expense-auditor dev` and then `pnpm --filter @bones/expense-auditor build` plus `pnpm --filter @bones/expense-auditor preview`: the first 10 seconds (plain receipt first, X-RAY switches on after about 0.6 s, fractures glow, ECG spikes red, answer card cracks, stamp lands), no console errors, the three samples and the three versions, keyboard-only use of the knob, switch, dialog and download, OS reduced-motion setting, the brushed-metal look against `design/mockups/bones-7-retro-b.png`, the CSP in the Vercel preview deploy (not applied by `vite preview`), live mode with a real key; mark it clearly as a manual step that no test replaces
    - _Requirements: 12.4, 12.5, 12.7, 18.1, 18.4, 20.6_
    - Commit: `git add apps/expense-auditor/README.md && git commit -m "docs(expense-auditor): add manual release check"`

- [x] 27. Final checkpoint
  - [x] 27.1 Final checkpoint - everything green and committed
    - Run from the repo root: `pnpm test`, `pnpm typecheck`, `pnpm --filter @bones/expense-auditor build` and `pnpm e2e`; all must pass; the core domain-isolation test and the browser-barrel test are green
    - Run `git status` and confirm a clean working tree (everything committed, `.kiro/` tracked)
    - Manual step (not automated, see task 26.1): a person runs `pnpm --filter @bones/expense-auditor dev` and `preview` and works through the manual check list; report it as pending if it was not done
    - Ensure all tests pass, ask the user if questions arise
    - _Requirements: 6.3, 6.4, 6.5, 19.1, 19.5, 19.12_
    - Commit: none (verification only)

- [x] 28. OpenRouter as a second LLM provider (live extraction server)
  - [x] 28.1 Add the OpenRouter provider, selection, tests and docs
    - Keep the Anthropic provider and its tests unchanged. Server-side env only, never `VITE_`: `LLM_PROVIDER` ("anthropic" | "openrouter", default "anthropic"), `OPENROUTER_API_KEY` (used when `LLM_PROVIDER=openrouter`); `EXTRACTION_MODEL` stays (for OpenRouter "anthropic/claude-haiku-5.5"). The handler and `GET /api/extract` report `live: true` only when `LIVE_EXTRACTION=on`, the model is set and the key of the SELECTED provider is set
    - New `api/_lib/openrouter.ts` with the same `LlmClient` port: `POST https://openrouter.ai/api/v1/chat/completions`; headers `content-type: application/json`, `Authorization: Bearer <key>`, `X-OpenRouter-Title: Bones Expense Auditor` (key only in the Authorization header); body `{ model, max_tokens: 16000, messages: [system SYSTEM_PROMPT, user [image_url data URL, text USER_TEXT]], response_format: { type: "json_schema", json_schema: { name: "receipt", strict: true, schema: MODEL_JSON_SCHEMA } }, reasoning: { effort: "low", exclude: true }, provider: { require_parameters: true } }`; success only when HTTP ok, `choices[0].finish_reason === "stop"` and `choices[0].message.content` is a non-empty string; everything else (non-2xx, an `error` object in the body, finish_reason `length`, `content_filter` or `error`, missing content, 25 s timeout, network error) gives `{ ok: false, kind: "upstream" }` with no provider text; no retries; reuse `SYSTEM_PROMPT`, `USER_TEXT` and `MODEL_JSON_SCHEMA` (do not fork them)
    - Tests with fakeFetch only: `tests/api/openrouter.node.test.ts` pins URL, headers, body fields and every failure path; extend the key-never-leaks property (also an `OPENROUTER_API_KEY` canary) and the canary build guard (also an OpenRouter canary; `openrouter.ai` and `Bearer` must not appear in dist/); handler tests for provider selection and the live true/false rules; entry still works with no env
    - Docs: design.md provider section, `.env.example` (`LLM_PROVIDER=anthropic`, `OPENROUTER_API_KEY=` empty), README live-mode section
    - Rules: no real API call, no `.env.local`, no deploy, no push
    - Commit: `git add apps/expense-auditor .kiro/specs/expense-auditor/design.md && git commit -m "feat(expense-auditor): add OpenRouter provider"`

- [ ] 29. Live-mode fixes
  - [ ] 29.1 Dev middleware keeps the port in the request base URL
    - In `vite.config.ts` `devExtractApi` build the Web `Request` with base `http://${req.headers.host ?? "localhost"}`; test that a same-origin POST with an `Origin` header that includes the port is accepted
    - Commit: `git add apps/expense-auditor && git commit -m "fix(expense-auditor): keep the port in the dev middleware request URL"`
  - [ ] 29.2 Honest message for forbidden_origin
    - `forbidden_origin` shows "This request was blocked because it came from another site." instead of the kill-switch text; component or unit test
    - Commit: `git add apps/expense-auditor && git commit -m "fix(expense-auditor): own message for forbidden_origin"`
  - [ ] 29.3 Live status waits longer and retries once
    - `fetchLiveStatus` timeout 8 s (was 3 s) and one retry after a failure; extend `tests/unit/liveStatus.node.test.ts` (fake timers: first attempt fails, second succeeds gives true; both fail gives false; a slow first answer under 8 s still works)
    - Commit: `git add apps/expense-auditor && git commit -m "fix(expense-auditor): live status timeout 8 s with one retry"`

## Notes

- Tasks marked with `*` are optional unit tests. All property tests, the money filter, error-model, replay, guard, component, intro-timing and e2e tests are required.
- Every property test is its own file and a single `it(...)`, uses `numRuns >= 100` and carries the tag comment `// Feature: expense-auditor, Property N: <title>` (core tests may use the `// Feature: core, ...` style as well). Property numbers are those of design.md.
- If a property test fails, fix the implementation, not the property. Keep a short list of bugs found by property tests in .kiro/specs/expense-auditor/bugs-found.md (format `Property N | Counterexample | Root cause | Fix`; core bugs go to `.kiro/specs/core/bugs-found.md`).
- Group 5 also holds the three AnswerCard visual fixes found in the running demo (5.7 to 5.14, Requirement 21). They come right after the money filter (group 2) and before the start screen (19.8) on purpose, so sample (a) looks clean in the first ten seconds. Existing xray-ui tests stay green: adapt only fixtures (add a label or pass `showUnlabelled`), never weaken an assertion.
- Tasks 1 to 5 are the only tasks that may touch `packages/core`, `packages/xray-ui` and `rules/`. Each of them keeps `pnpm --filter @bones/core test`, the core domain-isolation test and the core browser-barrel test green. Task 6.1 is the repo-root checkpoint; no task from 7 on starts before it is green, and no task from 7 on changes `packages/core` or `packages/xray-ui`.
- Checkpoints are written as leaf sub-tasks (6.1, 20.1, 27.1) so that they appear in the dependency graph.
- The spec bookkeeping files `tasks.md` and `tasks.meta.json` are committed separately by the user's runner. No task stages them.
- ErrorPanel (19.2) is built before StartScreen because StartScreen renders it; the order of the other UI components follows their dependencies.
- The manual verification (26.1, and the manual step in 27.1) cannot be automated. The e2e test and the intro-timing test (19.12) cover the first-10-seconds behaviour as far as it can be asserted.
- Not verified until the first deploy (see design.md, Known Limitations 16): the working directory of the Vercel install step, the pnpm major version Vercel selects, plan availability of Vercel Firewall rate limits and whether the CSP blocks any asset.
- Waves are ordered so that tasks in one wave touch different files.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["2.4", "2.5", "2.6", "2.7", "2.8"] },
    { "id": 5, "tasks": ["2.9"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["3.2", "3.3"] },
    { "id": 8, "tasks": ["4.1"] },
    { "id": 9, "tasks": ["4.2"] },
    { "id": 10, "tasks": ["5.1"] },
    { "id": 11, "tasks": ["5.2"] },
    { "id": 12, "tasks": ["5.3"] },
    { "id": 13, "tasks": ["5.4", "5.5", "5.6"] },
    { "id": 14, "tasks": ["5.7"] },
    { "id": 15, "tasks": ["5.8"] },
    { "id": 16, "tasks": ["5.9"] },
    { "id": 17, "tasks": ["5.10"] },
    { "id": 18, "tasks": ["5.11"] },
    { "id": 19, "tasks": ["5.12", "5.13"] },
    { "id": 20, "tasks": ["5.14"] },
    { "id": 21, "tasks": ["6.1"] },
    { "id": 22, "tasks": ["7.1"] },
    { "id": 23, "tasks": ["7.2"] },
    { "id": 24, "tasks": ["7.3"] },
    { "id": 25, "tasks": ["7.4"] },
    { "id": 26, "tasks": ["8.1", "8.2"] },
    { "id": 27, "tasks": ["8.3"] },
    { "id": 28, "tasks": ["8.4", "8.5", "8.6", "8.7"] },
    { "id": 29, "tasks": ["9.1", "10.1"] },
    { "id": 30, "tasks": ["9.2", "10.2"] },
    { "id": 31, "tasks": ["10.3", "11.1"] },
    { "id": 32, "tasks": ["11.2"] },
    { "id": 33, "tasks": ["11.3"] },
    { "id": 34, "tasks": ["11.4", "11.5"] },
    { "id": 35, "tasks": ["11.6"] },
    { "id": 36, "tasks": ["12.1", "12.2"] },
    { "id": 37, "tasks": ["12.3", "12.4"] },
    { "id": 38, "tasks": ["13.1"] },
    { "id": 39, "tasks": ["13.2", "13.3"] },
    { "id": 40, "tasks": ["14.1"] },
    { "id": 41, "tasks": ["14.2", "14.3", "14.4"] },
    { "id": 42, "tasks": ["15.1"] },
    { "id": 43, "tasks": ["15.2", "15.3"] },
    { "id": 44, "tasks": ["16.1"] },
    { "id": 45, "tasks": ["16.2", "16.3"] },
    { "id": 46, "tasks": ["16.4"] },
    { "id": 47, "tasks": ["16.5", "16.7"] },
    { "id": 48, "tasks": ["16.6", "16.8"] },
    { "id": 49, "tasks": ["16.9"] },
    { "id": 50, "tasks": ["17.1", "18.1"] },
    { "id": 51, "tasks": ["17.2", "17.3", "18.2"] },
    { "id": 52, "tasks": ["19.1"] },
    { "id": 53, "tasks": ["19.2"] },
    { "id": 54, "tasks": ["19.3", "19.4", "19.5"] },
    { "id": 55, "tasks": ["19.6", "19.7", "19.8"] },
    { "id": 56, "tasks": ["19.9", "19.10"] },
    { "id": 57, "tasks": ["19.11", "19.12"] },
    { "id": 58, "tasks": ["19.13"] },
    { "id": 59, "tasks": ["19.14"] },
    { "id": 60, "tasks": ["20.1"] },
    { "id": 61, "tasks": ["21.1"] },
    { "id": 62, "tasks": ["21.2", "21.3", "21.5"] },
    { "id": 63, "tasks": ["21.4", "21.6", "21.7"] },
    { "id": 64, "tasks": ["21.8"] },
    { "id": 65, "tasks": ["21.9", "21.10", "21.11", "21.12", "21.13"] },
    { "id": 66, "tasks": ["21.14"] },
    { "id": 67, "tasks": ["22.1"] },
    { "id": 68, "tasks": ["22.2", "22.3", "22.5"] },
    { "id": 69, "tasks": ["22.4", "22.6", "22.7", "22.8"] },
    { "id": 70, "tasks": ["22.9"] },
    { "id": 71, "tasks": ["22.10", "22.11"] },
    { "id": 72, "tasks": ["23.1", "23.2", "23.3", "23.4", "23.5", "23.6"] },
    { "id": 73, "tasks": ["24.1", "24.2"] },
    { "id": 74, "tasks": ["25.1"] },
    { "id": 75, "tasks": ["25.2", "26.1"] },
    { "id": 76, "tasks": ["27.1"] }
  ]
}
```
