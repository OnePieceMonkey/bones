# Requirements Document

## Introduction

`apps/expense-auditor` is App 1 on the Bones skeleton. A receipt is read by an AI (extraction only), versioned company expense rules decide (approved, partially approved, rejected), and the decision is shown as an X-ray with `@bones/xray-ui`. The LLM never decides: it proposes typed fields, the Zod schema validates them, and the rules in `rules/expense-auditor/` produce every outcome. Every decision is stored as a Trace that can be replayed against rule set v1, v2 or v3, and a person can overrule it without editing the original Trace.

The app is a Vite + React + TypeScript (strict) single-page app with the workspace dependencies `@bones/core` and `@bones/xray-ui`, plus one Vercel serverless function for the optional live extraction. There is no login. Domain words (receipt, expense, alcohol, meal, trip) are allowed in the app. Reference look (reference only, never imported): `design/mockups/bones-7-retro-b.png`, `bones-3-hover-doctor-a.png`, `bones-4-fracture-a.png`.

The spec first lists prerequisites in `packages/core`, `packages/xray-ui` and `rules/` (Requirements 1 to 5). The app requirements follow in dependency order (Requirements 6 to 20).

Facts about the current code that the requirements respect:

- Core evaluates blocking rules first, then capping rules (by `rule.id`, each `min(running, cap)`), then deducting rules. Capping and deducting outcomes carry `amountBeforeCents` and `amountAfterCents`. A Bone is fractured only when its rule changed the decision.
- Signature walk-through, scope `total` starting at the claimed total: 48000, then `line-item-cap` gives 4800 (fractured), then `meal-limit` (cap 5000, 6000 or 7500) leaves 4800 ("applied, no change", passed), then `alcohol-deducting` removes 650 and gives 4150 (fractured). The result is `partially_approved` with 4150 cents at v1, v2 and v3.
- `getPath` splits on `.` only, so the computed evidence key `alcoholLineItems[*].amount_sum` cannot be resolved inside a message template. The app derives `alcoholLineCents` as a validated field and templates use that path.
- `effectiveResult(trace, overrides)` does not filter by `decisionId`. The app passes only overrides linked to the displayed Trace.
- `KernelPorts.hasher` is synchronous while SubtleCrypto SHA-256 is asynchronous.
- `RecordedAdapter` in `@bones/core/node` uses `node:fs` and cannot be bundled for the browser.

### Out of scope

- Any import from `apps/case-files` (a guard test enforces this).
- Login, user accounts, sessions or any server-side persistence of receipts, traces or overrides.
- Storing Traces or Overrides beyond the browser session (state is held in memory; the export file is the only persistence).
- Multi-currency support. The app uses the default currency symbol "$" and does not convert currencies.
- Multi-receipt or batch audits, and multi-scope amounts (the app uses a single scope named `total`).
- Authoring or editing rules in the UI. Rules change only by editing files in `rules/expense-auditor/`.
- Rule versions beyond v1, v2 and v3.
- Sound (off by default and not shipped).
- PDF receipts. Live extraction accepts JPEG and PNG photos only.
- Provider billing, usage dashboards and analytics.
- Server-side rendering and a database.

## Glossary

- **App**: The `apps/expense-auditor` Vite + React single-page application.
- **Core**: The `@bones/core` package in `packages/core`.
- **Core_Node**: The `@bones/core/node` entry point that holds Node-only adapters.
- **Xray_UI**: The `@bones/xray-ui` package in `packages/xray-ui`.
- **Rules_Dir**: The directory `rules/expense-auditor/` with the subdirectories `rules/` and `rule-sets/`. It is the single source of truth for the expense rule files.
- **Recorded_Scenario**: The file `packages/core/test-fixtures/expense/recorded/signature-scenario.json`, used as an integration input by Core tests only.
- **Money_Filter**: The generic `money` filter of the Core message renderer, written `{{path|money}}`.
- **Currency_Symbol**: The optional `currencySymbol` field of a RuleSet (non-empty string of at most 4 characters, default "$").
- **Extraction_Failed_Error**: The CoreError variant `extraction_failed` with the field `reason` of `"disabled"`, `"network"`, `"bad_response"` or `"upstream"`.
- **Sample**: One recorded receipt in `apps/expense-auditor/recorded/` with the shape `{ id, title, receiptText, trip: { start, end }, extraction }`.
- **Signature_Sample**: Sample (a) with id `signature`, the Harbor Grill receipt.
- **Clean_Sample**: Sample (b) with id `clean`, the Corner Bistro receipt.
- **Outside_Window_Sample**: Sample (c) with id `outside-window`, the Airport Cafe receipt.
- **Trip_Window**: The pair `{ start, end }` of ISO dates (YYYY-MM-DD) the receipt date must fall into.
- **Recorded_Sample_Adapter**: The App's browser-safe `ExtractionPort` implementation over statically imported Sample JSON.
- **Http_Extraction_Adapter**: The App's `ExtractionPort` implementation that calls the Extract_Function.
- **Extract_Function**: The Vercel Node serverless function in `apps/expense-auditor/api/extract.ts`.
- **Live_Mode**: The App mode in which receipts are read by the Extract_Function. It is available only when the status request returns `{ live: true }`.
- **Recorded_Mode**: The default App mode in which the Recorded_Sample_Adapter is used and no data leaves the browser.
- **Expense_Schema**: The App's Zod schema (with transform) that validates the proposed fields and derives the rule fields.
- **Rule_Fields**: The validated fields passed to `evaluate`: `merchant`, `receiptDate`, `claimedTotalCents`, `lineItems`, `lineItemSumCents`, `alcoholLineItems`, `alcoholLineCents`, `tripStart`, `tripEnd`.
- **Amount_Scopes_Function**: The pure function `amountScopesFor(validatedFields)` returning `[{ name: "total", claimedCents: validatedFields.claimedTotalCents }]`.
- **Pipeline**: The pure function `runPipeline` that performs extraction, validation, evaluation and Trace creation with injected ports.
- **App_Ports**: The real `KernelPorts` used by the App: `id` from `crypto.randomUUID`, a strictly increasing `clock`, and a `hasher` that returns a precomputed SHA-256 hex.
- **Input_Bytes**: The bytes hashed into `inputHash`: the UTF-8 bytes of the Sample receipt text, or the uploaded image bytes in Live_Mode.
- **Original_Trace**: The Trace produced by the first evaluation of a receipt (rule set v1).
- **Replayed_Trace**: A Trace produced by `replay()` for a rule set version.
- **Displayed_Trace**: The Trace currently shown (the Original_Trace or a Replayed_Trace for the selected version).
- **Replay_Store**: The in-session store that memoizes one Trace per rule set version label (v1, v2, v3).
- **Override_Store**: The in-session store that holds Overrides created by the user, each linked to a `decisionId`.
- **Effective_Result**: The result of the latest Override linked to the Displayed_Trace, or the Displayed_Trace's own result.
- **Intro_Sequence**: The automatic X-RAY switch flip about 600 ms after a decision view appears.
- **Export_File**: The JSON file produced by "Download trace".
- **Title_Plate**: The title string passed to the Xray_UI `XrayView`, for example "Expense Auditor - RECORDED".
- **Overrule_Dialog**: The accessible modal dialog used to create an Override.
- **Guard_Tests**: The Vitest tests that scan source files and the built `dist` for forbidden imports, keys and names.
- **E2E_Test**: The single Playwright test file run in chromium against the built App served by `vite preview`.
- **Labelled_Field**: A proposed field whose path has an own entry in `Anatomy.fieldLabels` with a non-empty string.
- **Value_Summary**: The short, non-JSON text that the `AnswerCard` shows for an array or object value (for example "1 line item · $48.00"), produced by `formatValue` or, as a fallback, by `summariseValue`.
- **Crack_Layer**: The decorative SVG crack overlay of the `AnswerCard` (`.xr-crack-overlay`).
- **Stamp_Area**: The reserved, in-flow region of the `AnswerCard` that holds the "OVERRULED BY RULE" stamp (`.xr-stamp-area`).

## Requirements

### Requirement 1: Move rule files to rules/expense-auditor

**User Story:** As a Bones maintainer, I want one source of truth for the expense rule files, so that the App, the Core tests and the Xray_UI demo never drift apart.

#### Acceptance Criteria

1. THE Repository SHALL contain the rule files `alcohol-deducting.json`, `date-blocking-before.json`, `date-blocking-after.json`, `line-item-cap.json`, `meal-limit-v1.json`, `meal-limit-v2.json` and `meal-limit-v3.json` under `rules/expense-auditor/rules/`.
2. THE Repository SHALL contain the rule set files `expense-v1.json`, `expense-v2.json` and `expense-v3.json` under `rules/expense-auditor/rule-sets/`.
3. WHEN the files are relocated, THE Repository SHALL move them with `git mv` so that the file history is preserved, and SHALL leave no copy under `packages/core/test-fixtures/expense/rules/` or `packages/core/test-fixtures/expense/rule-sets/`.
4. THE Repository SHALL keep `packages/core/test-fixtures/expense/recorded/signature-scenario.json` in place.
5. THE Core test `packages/core/src/__tests__/fixtures/expense-scenarios.test.ts` SHALL load the rule and rule set files from `rules/expense-auditor/` by relative path.
6. THE Xray_UI demo `packages/xray-ui/demo/demoTrace.ts` SHALL load the rule and rule set files from `rules/expense-auditor/` by relative path.
7. THE Repository SHALL update every document that names the old paths, namely `.kiro/specs/core/requirements.md`, `.kiro/specs/core/design.md`, `.kiro/specs/core/tasks.md`, `.kiro/specs/xray-ui/requirements.md`, `.kiro/specs/xray-ui/design.md`, `.kiro/specs/xray-ui/tasks.md` and the READMEs.
8. WHEN a JSON file under `rules/` is saved, THE existing hook matcher in `.kiro/hooks/bones.json` SHALL match its path without a change to the hook file.
9. WHEN the full Core and Xray_UI test suites run after the move, THE test suites SHALL pass with the same rule outcomes as before the move.
10. THE Core source files under `packages/core/src/` SHALL import nothing from `rules/` (domain isolation stays intact).

### Requirement 2: Money filter and dollar messages

**User Story:** As a reviewer, I want rule messages to show dollars instead of raw cents, so that Dr. Bones and the evidence read naturally.

#### Acceptance Criteria

1. WHEN a message template contains `{{path|money}}` and the value at `path` is an integer number, THE Core renderer SHALL render the Currency_Symbol, the dollar part with comma thousands separators, a decimal point and exactly two decimal digits (48000 renders "$480.00", 4150 renders "$41.50", 123456789 renders "$1,234,567.89").
2. WHEN the integer value is negative, THE Core renderer SHALL render a leading minus sign before the Currency_Symbol (-5 renders "-$0.05").
3. THE Core renderer SHALL tolerate whitespace around the `|` character and around the path, so that `{{ claimedTotalCents | money }}` renders the same text as `{{claimedTotalCents|money}}`.
4. WHEN the value at `path` is not an integer number (string, float, boolean, object, array or undefined), THE Core renderer SHALL render the value exactly as it would render without a filter, and SHALL render an empty string for a missing path.
5. IF a template names a filter other than `money`, THEN THE Core renderer SHALL render the plain value and SHALL NOT throw.
6. THE Core `RuleSet` type and rule set schema SHALL accept an optional `currencySymbol` field, a non-empty string of at most 4 characters, and THE Core renderer SHALL use "$" WHEN the field is absent.
7. IF a rule set carries a `currencySymbol` that is empty or longer than 4 characters, THEN THE Core rule set validation SHALL return a CoreError with the variant `invalid_rule_set_schema`.
8. THE Core `src` files SHALL contain no domain words from the forbidden list in the Core domain-isolation requirement, so that the Money_Filter stays generic.
9. FOR ALL integer cent values in the range -10^12 to 10^12, parsing the rendered Money_Filter output with a test-owned parser that strips the symbol, the commas and the sign SHALL return the original cent value (round-trip property, at least 100 runs, own test file).
10. THE rule files in `rules/expense-auditor/rules/` SHALL use dollar messages with the Money_Filter: `meal-limit` v1, v2 and v3 name their literal limit ("$50.00", "$60.00", "$75.00") and the version, and show `{{claimedTotalCents|money}}`; `line-item-cap` reads "Receipt total {{claimedTotalCents|money}} does not match line items {{lineItemSumCents|money}}. Capped to the line-item sum."; `alcohol-deducting` reads "Alcohol is not reimbursable: {{alcoholLineCents|money}} deducted."; the two date rules keep their date slots.
11. THE `alcohol-deducting` rule SHALL read the deducted amount from the validated field path `alcoholLineCents`, because the computed evidence key `alcoholLineItems[*].amount_sum` is not resolvable by `getPath`.
12. WHEN the message templates change, THE Core tests, fixtures and Xray_UI tests that assert the old message text SHALL be updated to the new text and SHALL pass.
13. THE Core documents (`.kiro/specs/core/requirements.md` criteria 4.8 and 4.9, the `renderTemplate` section of `.kiro/specs/core/design.md`, and `packages/core/README.md`) SHALL describe the Money_Filter and the Currency_Symbol.

### Requirement 3: extraction_failed error variant

**User Story:** As an application developer, I want a typed error for a failed extraction call, so that network, disabled and upstream failures are not confused with validation or fixture errors.

#### Acceptance Criteria

1. THE Core `CoreError` union SHALL contain the variant `{ kind: "extraction_failed"; message: string; reason: "disabled" | "network" | "bad_response" | "upstream" }`.
2. THE Core `isCoreError` function SHALL return `true` for a value with `kind` equal to `"extraction_failed"`.
3. THE Core `kind` literal `"extraction_failed"` SHALL differ from the result literals `"approved"`, `"partially_approved"` and `"rejected"`.
4. THE Core document requirement 8.3 and the Core design error model SHALL list `"extraction_failed"` as the sixteenth variant of the closed union.
5. THE Core error-model tests SHALL cover the new variant and SHALL pass.

### Requirement 4: Replay keeps the original inputHash

**User Story:** As an auditor, I want a replayed Trace to carry the original `inputHash`, so that I can prove the replay used the same input.

#### Acceptance Criteria

1. WHEN `replay` returns a Trace, THE Core SHALL set `inputHash` of the returned Trace equal to `inputHash` of the original Trace.
2. WHEN `replay` returns a Trace, THE Core SHALL set a fresh `decisionId` and a fresh `createdAt` from the injected ports.
3. WHEN `replay` returns a Trace, THE Core SHALL copy `rawModelOutput`, `proposedFields`, `confidence`, `sources` and `validatedFields` from the original Trace without modification.
4. THE Core replay implementation SHALL NOT compute `inputHash` from `rawModelOutput`.
5. FOR ALL generated valid Traces and rule sets, the Core replay property test (Property 2) SHALL assert that `replayed.inputHash === trace.inputHash`, that `decisionId` and `createdAt` come from the ports, and that the five extraction fields are deeply equal to the originals.
6. THE file `.kiro/specs/core/bugs-found.md` SHALL contain a new entry in the existing format for this defect, with the property, the counterexample, the root cause (the replay hashed the encoded `rawModelOutput`) and the fix.

### Requirement 5: Xray_UI effective result on ResultPlate and XrayView

**User Story:** As a reviewer, I want the result plate to show an overruling result next to the result the rules produced, so that I can see both without altering the X-ray.

#### Acceptance Criteria

1. THE Xray_UI `ResultPlate` and `XrayView` SHALL accept the optional prop `effective?: { result: DecisionResult; reviewerName: string }`.
2. WHILE `effective` is absent, THE Xray_UI `ResultPlate` SHALL render exactly as before this change.
3. WHILE `effective` is present, THE Xray_UI `ResultPlate` SHALL show the label and icon of `effective.result` and the text "overruled by " followed by `effective.reviewerName`.
4. WHILE `effective` is present, THE Xray_UI `ResultPlate` SHALL show a second line with the text "Rules decided: " followed by the label of `trace.result` and the amount labelled "Amount by rules", formatted with `formatValue("amountCents", trace.amountCents)`.
5. WHILE `effective` is present, THE Xray_UI `ResultPlate` SHALL NOT display any amount other than `trace.amountCents`.
6. WHILE `effective` is present, THE Xray_UI `XrayView` SHALL render Skeleton, EcgLine, AnswerCard, DrBonesChat and FilmClip from the unchanged `trace`.
7. THE Xray_UI `XrayView` SHALL use its `title` prop as the text of the title plate.
8. THE Xray_UI tests SHALL cover criteria 5.2 to 5.6, and THE `packages/xray-ui/README.md` SHALL document the `effective` prop.
9. THE Xray_UI `src` files SHALL contain no domain words.

### Requirement 6: App package and workspace setup

**User Story:** As a developer, I want the App as a normal workspace package, so that install, test and typecheck at the repository root include it.

#### Acceptance Criteria

1. THE App SHALL live in `apps/expense-auditor` with a `package.json` named `@bones/expense-auditor`, TypeScript `strict` enabled, and the workspace dependencies `@bones/core` and `@bones/xray-ui`.
2. THE App `package.json` SHALL define the scripts `dev`, `build`, `preview`, `test`, `typecheck` and `test:e2e`.
3. THE root `package.json` SHALL define `pnpm e2e` as a separate script that runs the E2E_Test, and `pnpm test` at the root SHALL NOT run the E2E_Test.
4. WHEN `pnpm test` runs at the root, THE test run SHALL include the App unit and property tests.
5. WHEN `pnpm typecheck` runs at the root, THE typecheck SHALL include the App.
6. THE App `src` SHALL import only the browser barrel `@bones/core` and `@bones/xray-ui` from workspace packages, and SHALL NOT import `@bones/core/node`.
7. THE App SHALL add Playwright as a dev dependency and SHALL document `pnpm exec playwright install chromium` in the App README.
8. THE App SHALL contain no login, session or authentication code.

### Requirement 7: Samples and recorded fixtures

**User Story:** As a visitor without an API key, I want three recorded receipts, so that the demo works completely offline.

#### Acceptance Criteria

1. THE App SHALL store each Sample as a JSON file in `apps/expense-auditor/recorded/` with the shape `{ id, title, receiptText, trip: { start, end }, extraction }`, where `extraction` has the Core `ExtractionResult` shape.
2. THE Signature_Sample SHALL contain merchant "Harbor Grill", `receiptDate` "2024-03-15", `claimedTotalCents` 48000 (the AI misread $48.00 as $480.00) with confidence 0.62, and the line items "Grilled salmon" 2200, "Caesar salad" 1100, "Sparkling water" 850 and "Draft beer" 650 with `isAlcohol` true, which sum to 4800.
3. THE Clean_Sample SHALL contain merchant "Corner Bistro", `receiptDate` "2024-03-12", `claimedTotalCents` 3240, and line items without an alcohol flag that sum exactly to 3240 (for example "Chicken bowl" 1890, "Iced tea" 350 and "Side salad" 1000).
4. THE Outside_Window_Sample SHALL contain merchant "Airport Cafe", `receiptDate` "2024-03-25", `claimedTotalCents` 2150 equal to the line item sum, and no alcohol line (for example "Club sandwich" 1450 and "Coffee" 700).
5. THE Samples SHALL carry the Trip_Window 2024-03-10 to 2024-03-20, and THE App SHALL display it as "Trip: Mar 10 - Mar 20, 2024".
6. THE Samples SHALL use the field names `merchant`, `receiptDate`, `claimedTotalCents` and `lineItems` (each item `{ description, amount, isAlcohol }`) in `proposedFields`, so that evidence keys match proposed field names.
7. THE Samples SHALL provide a per-field confidence between 0 and 1 for each proposed field, and `sources` as line indices into `receiptText`.
8. THE Samples SHALL provide `rawModelOutput` as the JSON text of the proposed fields.
9. WHEN the Signature_Sample is evaluated at v1, v2 and v3, THE App SHALL produce `partially_approved` with 4150 cents (shown as "$41.50"), exactly two fractured bones (line-item match and alcohol), the meal-limit bone passed with the text "applied, no change", and a cracked AnswerCard with the stamp "OVERRULED BY RULE".
10. WHEN the Clean_Sample is evaluated at v1, v2 and v3, THE App SHALL produce `approved` with "$32.40", no fractured bone, all rule bones passed (meal limit "applied, no change"), a normal ECG line and no stamp.
11. WHEN the Outside_Window_Sample is evaluated at v1, v2 and v3, THE App SHALL produce `rejected` with "$0.00", exactly one fractured bone (the date window bone on the spine), a flatline ECG and the other rule bones not applicable.

### Requirement 8: Recorded sample adapter

**User Story:** As a developer, I want a browser-safe recorded adapter, so that the demo runs in the browser without Node built-ins.

#### Acceptance Criteria

1. THE Recorded_Sample_Adapter SHALL implement the Core `ExtractionPort` over statically imported Sample JSON and SHALL validate each Sample with Zod.
2. WHEN `extract` is called with an empty input, THE Recorded_Sample_Adapter SHALL return the CoreError produced by Core `guardInput` (`input_empty`) without reading a Sample.
3. IF the requested Sample id is unknown, THEN THE Recorded_Sample_Adapter SHALL return a CoreError with the variant `fixture_not_found`.
4. IF a Sample fails Zod validation, THEN THE Recorded_Sample_Adapter SHALL return a CoreError with the variant `fixture_invalid`.
5. WHEN a Sample is valid, THE Recorded_Sample_Adapter SHALL return its `extraction` unchanged.
6. FOR ALL three Samples, THE Recorded_Sample_Adapter SHALL return data deeply equal to the data returned by the Core_Node `RecordedAdapter` for the same Sample extraction file in a Node test (parity test).
7. THE App `src` SHALL NOT import `node:fs`, `@bones/core/node` or any other Node built-in.

### Requirement 9: Schema, derivation and validation

**User Story:** As an auditor, I want the rule fields derived from the AI proposal by a deterministic schema, so that rules never see unvalidated values.

#### Acceptance Criteria

1. THE Expense_Schema SHALL derive `lineItemSumCents` as the sum of the line item amounts, `alcoholLineItems` as the line items flagged `isAlcohol` in the form `[{ amount }]`, `alcoholLineCents` as the sum of their amounts, `lineItems` as `[{ amount, description }]`, and `tripStart` and `tripEnd` from the Trip_Window supplied by the caller.
2. WHEN the proposed fields are valid, THE App SHALL pass the output of the Expense_Schema as `validatedFields` to `evaluate` and to `createTrace`.
3. IF a cent value is negative or not an integer, THEN THE Expense_Schema SHALL reject it with the field path of the failing value.
4. IF `receiptDate`, `tripStart` or `tripEnd` is not a real calendar date in the form YYYY-MM-DD, THEN THE Expense_Schema SHALL reject it with the field path.
5. IF `lineItems` is empty, THEN THE Expense_Schema SHALL reject the input with the path `lineItems`.
6. IF `tripEnd` is earlier than `tripStart`, THEN THE Expense_Schema SHALL reject the input with the path `tripEnd`.
7. IF `claimedTotalCents` is 0, THEN THE Expense_Schema SHALL reject the input with the path `claimedTotalCents`, because an amount scope needs a positive claimed amount.
8. IF validation fails, THEN THE App SHALL show a readable error panel that lists each failing field path and issue, and THE App SHALL NOT call `evaluate`.
9. THE Expense_Schema SHALL be a pure function of its input (no clock, no randomness, no I/O).
10. THE Amount_Scopes_Function SHALL return `[{ name: "total", claimedCents: validatedFields.claimedTotalCents }]`, and THE App SHALL use it for the first evaluation and for every replay.

### Requirement 10: Real ports and pipeline

**User Story:** As an auditor, I want every decision created by one pure pipeline with real ports, so that traces are reproducible when the ports are fixed.

#### Acceptance Criteria

1. THE Pipeline SHALL execute in this order: extraction, `toRuleFields` plus validation, `evaluate`, `createTrace`, and SHALL accept the extraction port, the rule set, the catalog and the ports as injected arguments.
2. WHEN extraction or validation returns a CoreError, THE Pipeline SHALL return that CoreError and SHALL NOT call `evaluate`.
3. THE App SHALL compute the SHA-256 hex of the Input_Bytes with `crypto.subtle.digest` before it calls `createTrace`, and SHALL pass a `hasher` port that returns that precomputed hex.
4. IF the `hasher` port receives bytes whose length differs from the length of the hashed Input_Bytes, THEN THE App SHALL throw an error with a message naming both lengths, so that `createTrace` returns a CoreError.
5. THE App_Ports `id` SHALL be `crypto.randomUUID`.
6. THE App_Ports `clock` SHALL return a `Date` whose millisecond value is strictly greater than every value it returned before in the session, so that two Overrides never share a `createdAt`.
7. THE Input_Bytes SHALL be the UTF-8 bytes of the Sample `receiptText`, or the uploaded image bytes in Live_Mode.
8. FOR ALL generated valid extractions and for the three Samples, THE Pipeline with fixed ports SHALL return Traces that are deeply equal across two runs.
9. THE App SHALL load the rule catalog and the rule sets v1, v2 and v3 from `rules/expense-auditor/` by static import, validated through the Core rule schemas.
10. THE Pipeline SHALL return the Trace deep-frozen as produced by `createTrace`.

### Requirement 11: Anatomy, formatting and labels

**User Story:** As a reviewer, I want plain-English labels and dollar formatting on the X-ray, so that non-developers understand each bone and value.

#### Acceptance Criteria

1. THE App Anatomy SHALL map `meal-limit` to `ribs`, `date-blocking-before` and `date-blocking-after` to `spine`, `alcohol-deducting` to `pelvis` and `line-item-cap` to `arm-right`, each with a plain-English label.
2. THE App Anatomy SHALL provide `fieldLabels` in plain English for every Rule_Field, `amountCents` and every computed evidence key (for example "Alcohol total" for `alcoholLineItems[*].amount_sum`).
3. WHEN `formatValue` receives a path ending in `Cents` with an integer value, THE App SHALL return dollars with the "$" symbol, comma thousands separators and two decimals (4150 returns "$41.50").
4. WHEN `formatValue` receives a date path (`receiptDate`, `tripStart` or `tripEnd`) with a valid YYYY-MM-DD string, THE App SHALL return the en-US form "Mar 15, 2024", built by manual formatting without `Date` time-zone conversion.
5. WHEN `formatValue` receives a line item list (`lineItems` or `alcoholLineItems`), THE App SHALL return a Value_Summary of the form "<n> line item(s) · <sum of all amounts as dollars>" ("4 line items · $48.00", "1 line item · $6.50", "No line items · $0.00" for an empty list), never raw JSON, and without item descriptions.
6. WHEN `formatValue` receives a boolean, THE App SHALL return "Yes" or "No".
7. WHEN `formatValue` receives any other value, THE App SHALL return the Xray_UI default style (`defaultFormat`).
8. FOR ALL integer cent values from 0 to 10^12, parsing the output of `formatMoney` SHALL return the original cents (round-trip property, at least 100 runs).
9. FOR ALL valid ISO calendar dates, THE date formatter SHALL return a non-empty string without throwing, and the output SHALL show the same day number as the input.
10. THE Dr. Bones chat text SHALL come from the Trace and the fixed Xray_UI templates only, and THE App SHALL generate no explanation text by any other route.
11. THE App SHALL show every money value in dollars with the "$" symbol, through `formatMoney`, `formatValue` and the Money_Filter, and the string "EUR" SHALL appear nowhere in the App `src`, the recorded samples, the App tests (except the guard that checks for it) or the built `dist`.
12. THE App `fieldLabels` SHALL contain a plain-English label for every proposed field that the `AnswerCard` should show (`merchant`, `receiptDate`, `claimedTotalCents`, `lineItems`), so that no AI card row depends on a raw key.

### Requirement 12: Start screen and intro sequence

**User Story:** As a first-time visitor, I want to see a decision within seconds, so that the principle "the AI reads, the rules decide" is clear immediately.

#### Acceptance Criteria

1. THE App start screen SHALL show a title, a short explanation that the AI reads and the rules decide, and a button group "Load sample receipt" with three buttons: "Signature case", "Clean meal" and "Outside the trip window".
2. WHILE Live_Mode is available, THE App start screen SHALL additionally show an "Upload receipt photo" control and two labelled date inputs for the Trip_Window (required, prefilled 2024-03-10 and 2024-03-20).
3. WHILE Live_Mode is unavailable, THE App start screen SHALL hide the upload control and the Trip_Window date inputs.
4. WHEN the user clicks "Signature case", THE App SHALL show the decision view within 2 seconds, with the X-RAY switch off (plain document view).
5. WHEN the decision view has been shown with the switch off and `prefers-reduced-motion` is not set, THE App SHALL switch X-RAY on after about 600 ms (between 500 ms and 700 ms) without user input.
6. WHILE `prefers-reduced-motion` is set, THE App SHALL switch X-RAY on immediately when the decision view appears.
7. WHEN X-RAY switches on for the Signature_Sample, THE Xray_UI SHALL fracture the line-item bone and the alcohol bone, crack the AnswerCard and show the stamp "OVERRULED BY RULE".
8. WHEN the user toggles the X-RAY switch before the Intro_Sequence ends, THE App SHALL cancel the pending automatic flip and keep the user's choice.
9. THE App SHALL show the Sample `receiptText` lines on the film clip as a `{ kind: "text" }` FilmSource.
10. THE App SHALL show a control to return to the start screen that discards the Displayed_Trace, the Replay_Store and the Override_Store.
11. IF the user selects an image larger than the Extract_Function limit or a file type other than JPEG and PNG, THEN THE App SHALL show a readable message and SHALL NOT call the Extract_Function.

### Requirement 13: Replay and version knob

**User Story:** As an auditor, I want to replay the stored decision against v1, v2 and v3, so that I can see how a rule change affects the same receipt.

#### Acceptance Criteria

1. THE App SHALL map the RULE VERSION labels v1, v2 and v3 to the rule sets `expense-v1`, `expense-v2` and `expense-v3`, and SHALL select v1 by default.
2. WHEN the user selects a version that is not yet in the Replay_Store, THE App SHALL call Core `replay()` on the Original_Trace with the rule set of that version, the catalog, the Amount_Scopes_Function result and the App_Ports.
3. WHEN the user selects a version, THE App SHALL NOT call any extraction port.
4. THE Replay_Store SHALL memoize one Trace per version label for the session, and WHEN the user selects a version that is already in the store, THE App SHALL display the stored Trace without calling `replay()`.
5. THE Replay_Store SHALL hold the Original_Trace as the entry for v1, and the `decisionId` of the Original_Trace SHALL never be replaced.
6. WHILE the Displayed_Trace is a Replayed_Trace, THE App SHALL show the note "Replayed with " followed by the version label (for example "Replayed with v2"), and WHILE the Displayed_Trace is the Original_Trace, THE App SHALL hide the note.
7. IF `replay()` returns a CoreError, THEN THE App SHALL show the error message and SHALL keep the previously displayed Trace and version.
8. WHEN `replay()` succeeds for the Signature_Sample, THE Replayed_Trace SHALL have `result` `partially_approved` and `amountCents` 4150 at v1, v2 and v3.
9. FOR ALL generated valid extractions and for the three Samples, replaying the Original_Trace with its own rule set SHALL return a Trace with equal `result`, `amountCents`, `ruleOutcomes` and `validatedFields`, an equal `inputHash`, and a different `decisionId` and `createdAt` (round-trip property, at least 100 runs).

### Requirement 14: Human override

**User Story:** As a reviewer, I want to overrule a decision with a reason, so that the human decision is itself recorded and the original Trace stays untouched.

#### Acceptance Criteria

1. WHEN the user activates "Overrule", THE App SHALL open the Overrule_Dialog as an accessible modal dialog with the labelled fields "Reviewer name", "Reason" (at most 500 characters) and "New result" (a select with approved, partially approved and rejected).
2. WHILE the Overrule_Dialog is open, THE App SHALL keep keyboard focus inside the dialog, and WHEN the user presses Escape, THE App SHALL close the dialog and return focus to the "Overrule" button.
3. WHEN the user submits the dialog, THE App SHALL call Core `override()` with the Displayed_Trace and the App_Ports and SHALL store the returned Override in the Override_Store.
4. IF `override()` returns the CoreError `invalid_override_input`, THEN THE App SHALL show an inline error next to the field named in `field` and SHALL keep the dialog open.
5. WHEN an Override exists for the Displayed_Trace, THE App SHALL compute the Effective_Result with Core `effectiveResult()` over only those Overrides whose `decisionId` equals the Displayed_Trace `decisionId`, and SHALL pass `{ result, reviewerName }` of the latest Override as the `effective` prop to the `XrayView`.
6. WHEN several Overrides exist for the Displayed_Trace, THE App SHALL show the latest Override as effective.
7. WHEN an Override is created, THE Displayed_Trace SHALL stay deep-equal and frozen, and THE Skeleton, ECG and AnswerCard SHALL render the original Trace unchanged.
8. THE App SHALL link every Override to the `decisionId` of the Displayed_Trace at the time of creation, so that an Override made while viewing v3 belongs to the v3 Trace.
9. WHEN the user switches the version, THE App SHALL show the Effective_Result of the Trace of that version only.
10. IF `effectiveResult()` returns a CoreError, THEN THE App SHALL show the error message and SHALL show the Trace result without an `effective` prop.
11. FOR ALL generated sequences of Overrides, creating Overrides through the Override_Store SHALL leave the stored Trace deep-equal and frozen, and the Effective_Result SHALL equal the replacement result of the latest linked Override (property test, at least 100 runs).

### Requirement 15: Export

**User Story:** As an auditor, I want to download the trace as a file, so that I can archive and re-check a decision outside the App.

#### Acceptance Criteria

1. WHEN the user activates "Download trace", THE App SHALL save a JSON file named `expense-trace-` followed by the first 8 characters of the Displayed_Trace `decisionId` and `.json`.
2. THE Export_File SHALL contain `{ format: "bones.expense-auditor.export", formatVersion: 1, trace, overrides }`, where `overrides` holds only the Overrides linked to the Displayed_Trace.
3. WHILE the Displayed_Trace is a Replayed_Trace, THE Export_File SHALL additionally contain `replayedFrom: { decisionId, ruleSetVersion }` of the Original_Trace.
4. WHILE the Displayed_Trace is the Original_Trace, THE Export_File SHALL contain no `replayedFrom` key.
5. THE App SHALL create the file in the browser with a Blob download and SHALL send no network request for the export.
6. FOR ALL generated Traces and Override lists, parsing the serialized Export_File SHALL yield an object deeply equal to the exported structure (serialization round-trip).

### Requirement 16: Live extraction (adapter, function, security)

**User Story:** As a developer with an API key, I want an optional live mode that reads receipt photos, so that I can try the pipeline on real receipts without letting the AI decide.

#### Acceptance Criteria

1. THE Http_Extraction_Adapter SHALL implement the Core `ExtractionPort` and SHALL call the Extract_Function with the image bytes and nothing else from the browser's state.
2. WHEN the App starts, THE App SHALL send one status request to the Extract_Function, and THE Extract_Function SHALL answer with a body that contains only `{ live: boolean }`.
3. THE Extract_Function SHALL report `live: true` and accept extraction requests only WHILE the server environment variable `LIVE_EXTRACTION` equals `on`; the default SHALL be off.
4. IF `LIVE_EXTRACTION` is not `on`, THEN THE Extract_Function SHALL answer an extraction request with an error that maps to the Extraction_Failed_Error with the reason `disabled`, and SHALL NOT call the LLM provider.
5. THE Extract_Function SHALL read the provider API key and the model name from server environment variables only, SHALL NOT use any `VITE_*` variable for them, and SHALL NOT return or log the key.
6. THE Extract_Function SHALL call a vision LLM with a strict JSON output schema containing `merchant`, `receiptDate` (YYYY-MM-DD), `claimedTotalCents` (integer), `lineItems` (each `{ description, amount (integer cents), isAlcohol (boolean) }`) and a per-field confidence between 0 and 1, and the schema SHALL contain no decision or approval field.
7. THE Extract_Function SHALL validate the model response with Zod, rejecting unknown keys, before it answers, and THE Http_Extraction_Adapter SHALL validate the response again with Zod in the browser.
8. THE Extract_Function SHALL return the model's raw JSON text as `rawModelOutput`.
9. IF the model response fails validation, THEN THE Http_Extraction_Adapter SHALL return the Extraction_Failed_Error with the reason `bad_response`.
10. IF the network request fails, THEN THE Http_Extraction_Adapter SHALL return the Extraction_Failed_Error with the reason `network`.
11. IF the provider call fails or returns a non-success status, THEN THE Extract_Function SHALL answer with an error that maps to the Extraction_Failed_Error with the reason `upstream`.
12. IF the decoded image is larger than 3 MB, THEN THE Extract_Function SHALL reject the request without calling the provider.
13. THE App SHALL downsize an uploaded photo to a JPEG with a long edge of at most 1600 px before upload.
14. THE Extract_Function SHALL apply a per-IP rate limit and SHALL answer requests over the limit with an error that does not call the provider.
15. THE Extract_Function SHALL be created through a factory that accepts an injected LLM client, so that tests run with a fake client.
16. THE design document SHALL choose the provider after verification of the current vision and structured-output API documentation.
17. WHILE Recorded_Mode is active, THE App SHALL send no network request that contains receipt data.

### Requirement 17: Title plate LIVE or RECORDED

**User Story:** As a viewer, I want to see at a glance whether the AI read was live or recorded, so that I know what I am looking at.

#### Acceptance Criteria

1. WHILE the Displayed_Trace came from a Sample, THE App SHALL pass the Title_Plate "Expense Auditor - RECORDED" to the `XrayView`.
2. WHILE the Displayed_Trace came from the Http_Extraction_Adapter, THE App SHALL pass the Title_Plate "Expense Auditor - LIVE" to the `XrayView`.
3. WHILE no decision is shown, THE App SHALL show the Title_Plate "Expense Auditor" followed by the current mode in the form " - RECORDED" or " - LIVE" according to Live_Mode availability and selection.

### Requirement 18: Accessibility and reduced motion

**User Story:** As a keyboard or low-vision user, I want the App to be operable and readable, so that the decision is accessible to me.

#### Acceptance Criteria

1. THE App SHALL make the start screen, the version knob, the X-RAY switch, the "Overrule" button, the Overrule_Dialog and the "Download trace" button operable by keyboard with a visible focus indicator.
2. THE App SHALL meet contrast ratio 4.5:1 for normal text and 3:1 for large text and focus indicators (WCAG 2.1 AA) on App-owned elements.
3. THE App SHALL give every form control in the Overrule_Dialog and on the start screen an accessible name through a label.
4. WHILE `prefers-reduced-motion` is set, THE App SHALL run no App-owned animation and THE Xray_UI SHALL use its reduced-motion behaviour.
5. WHEN the Displayed_Trace changes through a version change, THE App SHALL announce the new result through the Xray_UI `ResultPlate` status role without moving keyboard focus.
6. THE App SHALL ship sound off by default and SHALL expose no sound control.

### Requirement 19: Tests (unit, property, e2e, guards)

**User Story:** As a maintainer, I want automated tests for every App behaviour, so that regressions in decisions or security are caught before release.

#### Acceptance Criteria

1. THE App unit tests SHALL run with Vitest, using jsdom for components and node for pure logic, and SHALL cover: money and date format helpers, the Expense_Schema derivation and rejection paths, the Pipeline with injected ports, the Replay_Store memoization, the Override_Store, the Recorded_Sample_Adapter (including parity with the Core_Node `RecordedAdapter`), the Http_Extraction_Adapter with a mocked `fetch` (success, `disabled`, `network`, `bad_response`), and the intro-sequence logic with fake timers.
2. THE App unit tests SHALL cover the Extract_Function with an injected fake LLM client for: strict schema acceptance and rejection, the kill switch, the size cap, the rate limit, and the guarantee that the key never appears in any response or log output.
3. THE App property tests SHALL use fast-check with at least 100 runs per property, each in its own file, for: (P1) replay with the own rule set equals the original except `decisionId` and `createdAt` (Requirement 13.9); (P2) the Override_Store never changes the stored Trace and the Effective_Result equals the latest linked Override (Requirement 14.11); (P4) `formatMoney` round-trip and the date formatter totality (Requirements 11.8 and 11.9).
4. THE Core property tests SHALL include (P3) the Money_Filter round-trip (Requirement 2.9).
5. THE E2E_Test SHALL run in chromium with `reducedMotion: "reduce"` against the built App served by `vite preview`, with live extraction disabled.
6. THE E2E_Test SHALL load the Signature_Sample and assert that the result plate shows "$41.50" and "PARTIALLY APPROVED", that exactly two bones have `data-state="fractured"` (line-item match and alcohol), that the meal-limit bone has `data-state="passed"` and the text "applied, no change", and that the stamp "OVERRULED BY RULE" is visible.
7. THE E2E_Test SHALL focus the version slider, press ArrowRight twice, and assert that v3 is selected, that the note "Replayed with v3" is visible, and that the plate still shows "PARTIALLY APPROVED" and "$41.50".
8. THE E2E_Test SHALL activate "Overrule", fill the reviewer "Dana Reviewer", a reason and the new result "approved", and assert that the plate shows "APPROVED" and "overruled by Dana Reviewer" and "Rules decided: PARTIALLY APPROVED", and that the two fractured bones are unchanged.
9. THE E2E_Test SHALL activate "Download trace" and assert that the downloaded JSON contains the Trace and the Override.
10. THE Guard_Tests SHALL assert that no file under the App `src`, `api` and test directories imports from `apps/case-files`.
11. THE Guard_Tests SHALL assert that, after a build, no file in the App `dist` and no file in the App `src` contains an API key pattern or a provider environment variable name.
12. THE Guard_Tests SHALL assert that the App `src` imports workspace code only from `@bones/core` and `@bones/xray-ui` and never from `@bones/core/node`.
13. THE E2E_Test SHALL assert, for the Signature_Sample at the viewport sizes 1280x800 and 390x844, that the bounding box of the stamp "OVERRULED BY RULE" intersects no `.xr-field-value` element of the AI card.
14. THE E2E_Test SHALL assert in the real browser that the computed `z-index` of the Crack_Layer is lower than the computed `z-index` of the field rows container, that every `.xr-field` row has a computed background colour with alpha 1, and that no AI card row text contains "{" or "[" and no row label matches a camelCase key.
15. THE Guard_Tests SHALL assert that the string "EUR" does not appear in the App `src`, the recorded samples, the e2e spec and the built `dist`, and that `packages/xray-ui/demo` formats money with "$" (Requirement 21.8).

### Requirement 20: Deploy and README

**User Story:** As a developer, I want a documented static build plus one function that deploys to Vercel, so that I can publish the demo with a kill switch.

#### Acceptance Criteria

1. THE App SHALL build to a static Vite output and one Vercel Node serverless function in `apps/expense-auditor/api/`.
2. THE App SHALL include a `vercel.json` with the framework, build command, output directory and function settings that match the current Vercel documentation (verified in the design).
3. THE App README SHALL document the Vercel monorepo setup: root directory `apps/expense-auditor`, the option "Include source files outside of the Root Directory", install at the repository root, build command and output directory.
4. THE App SHALL include a `.env.example` with `LIVE_EXTRACTION=off` and the provider variables, with no real secret values.
5. THE App SHALL require no login for any feature.
6. THE App README SHALL contain "Try it" steps: install, `pnpm dev`, load the Signature case and describe what to see (result "$41.50", two fractured bones, cracked card, stamp), run unit tests, run `pnpm e2e` (with the Playwright install command), enable live mode locally, and enable live mode on Vercel.
7. THE App README SHALL contain security notes: the key lives only in the server environment, the `LIVE_EXTRACTION` kill switch, the request size cap and the per-IP rate limit.
8. THE App README SHALL explain in plain language why the LLM never decides and where each of the five Bones parts (extraction, rules, trace, override, X-ray) appears in the App.

### Requirement 21: Xray_UI AnswerCard visual fixes

**User Story:** As a viewer of the first ten seconds of the demo, I want the AI answer card to stay readable when it cracks, so that the crack, the stamp and every value are all legible at the same time.

#### Acceptance Criteria

1. THE Xray_UI `AnswerCard` SHALL render the Crack_Layer as the first child of the card and behind the content: the Crack_Layer SHALL have a lower `z-index` than the container of the field rows, and the field rows SHALL not be covered by it.
2. THE Xray_UI stylesheet SHALL give every `.xr-field` row a solid (opaque) background colour taken from a Design_Tokens variable, SHALL separate the rows by a gap of at least `--xr-space-1`, and SHALL give the card inner padding, so that the cracks are visible only in the gaps and the margins.
3. THE Xray_UI text and background colour pair of a field row SHALL meet the contrast ratio of at least 4.5:1, and THE contrast test SHALL include that pair.
4. WHILE Reduced_Motion_Mode is active, THE `AnswerCard` SHALL keep its current behaviour: no Animated_Class, a static Crack_Layer and a static stamp, with the state still shown by text and icon.
5. WHEN at least one Overruled_Field exists, THE Xray_UI `AnswerCard` SHALL render the stamp inside the Stamp_Area, an in-flow block placed after the field rows (or in the card header corner), and the stamp SHALL NOT be positioned over the field rows.
6. THE Stamp_Area SHALL reserve enough height and padding for the rotated stamp, so that the stamp never overlaps a `.xr-field-value` element, including at a viewport width of 390 px.
7. THE Xray_UI `AnswerCard` SHALL render a row only for a Labelled_Field, using `fieldLabels[path]` as the row label, and SHALL hide a field without a label by default.
8. THE Xray_UI `AnswerCard` SHALL accept an optional prop `showUnlabelled?: boolean` (default false); WHEN it is true, a field without a label SHALL be shown with its path as label (the previous behaviour).
9. THE Xray_UI SHALL compute the Overruled_Field set, the crack overlay and the stamp from all proposed fields, including hidden ones, so that hiding a row never changes whether the card cracks or the stamp appears.
10. WHEN the value of a row is an array or a plain object, THE `AnswerCard` SHALL show the output of `formatValue`; IF that output contains "{" or "[", THEN THE `AnswerCard` SHALL show the fixed summary "<n> item(s)" for arrays or "<n> field(s)" for objects (pure function `summariseValue`), so that no row shows raw JSON.
11. THE Xray_UI unit tests SHALL assert, for a trace that has unlabelled camelCase fields and array fields of objects, that no rendered row text (label and value) contains "{" or "[" and that no row shows a camelCase key.
12. THE Xray_UI `selectors` function `fieldViews` and its output shape SHALL stay unchanged, and THE existing Xray_UI tests SHALL stay green: a test that needs an unlabelled row SHALL be adapted only by adding a label to its fixture or by passing `showUnlabelled`, and no assertion SHALL be weakened.
13. THE Xray_UI demo (`packages/xray-ui/demo`) and the Xray_UI README example SHALL format money with the "$" symbol and SHALL not contain the string "EUR".
14. THE Xray_UI spec documents (`requirements.md` criterion 5.1 and the AnswerCard section of `design.md`) SHALL be updated to describe these changes.
