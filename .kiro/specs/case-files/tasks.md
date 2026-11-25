# Implementation Plan: case-files

## Overview

This plan builds `apps/case-files` (App 2 on the Bones skeleton) in small steps: schema and recorded cases, rules with Fact_Deriver and Rule_Binder, Solver, pipeline with Trace, replay, override and accusation, additive xray-ui components, the screens, end-to-end tests with reference screenshots, guards, optional live mode, README and a final checkpoint. `packages/core` and `apps/expense-auditor` never change.

**Time box and scope.** The whole app is finished by **28.11.2026** (Time_Box). If the date is at risk, cut in this order (requirements 23.7), starting with the first item: (1) live mode and its README part (group 9); (2) trace export and its round-trip property (task 4.7); (3) `extraMessages` (task 5.2), the reason is then shown on the Glass_Card only; (4) `overruled` and `stampDetail` on the Glass_Card (task 5.3), the card then never cracks; (5) typed animation of the Result_Banner (shown at once); (6) the `sighting` kind and its rule. Never cut (requirements 23.8): recorded mode, the three Recorded_Cases, the Solver and its property tests, pipeline with Trace, replay and override, the guards, the no-scroll checks at the three Viewports, keyboard access and reduced motion.

**No real API call, no `.env.local`, no deploy, no push** happens in any task. Tests use fakes and recorded data. No task reads, creates or edits `apps/*/.env.local`. Nothing is pushed or deployed.

**Hard stops.** Tasks 3.4 ("checkpoint solver done"), 6.7 ("checkpoint ui done") and 11.1 ("final checkpoint done") are hard stops. At each one the agent runs the checks of that task, then STOPS and replies with exactly the phrase named in the task. It starts no other task until the user says "weiter". After "weiter", the first action is to record the user's verdict (accepted, or the list of changes) in this file under "Review verdicts" at the end of the Notes. That edit is its own commit with the message `docs(case-files): record <checkpoint> verdict` (`<checkpoint>` = `solver done`, `ui done` or `final`) and touches only `tasks.md`. If the verdict lists changes, the next task starts with those changes. The agent never marks a checkpoint task as done before the verdict is recorded.

**Working rules for every task:**

- **One commit per task.** Each leaf task states its commit message. Commit only when the task checklist below is green.
- **Task checklist (stated again in each task).** (1) `pnpm -r typecheck` green. (2) `pnpm -r test` green. (3) `git diff --exit-code <START> -- packages/core apps/expense-auditor` prints nothing (requirement 20.9). (4) `git status` clean after the commit. (5) E2E where it applies: any task that changes `packages/xray-ui` runs `pnpm e2e` (expense references must stay unchanged); from task 7.1 on, any task that changes `apps/case-files/src`, `rules/case-files`, `packages/xray-ui` or `apps/case-files/e2e` also runs `pnpm e2e:case-files`.
- `<START>` is the commit that was `HEAD` before task 1.1 changed anything. It is recorded in the Notes by task 1.1.
- **Tests are required, not optional.** Unit, property and component tests belong to the task that builds the code they cover. Only group 9 (live mode) is optional, and every task in it is marked `*`.
- **Tests that assert the old xray-ui look or guards change in the same commit as the code** that forces the change (requirement 20.8). Each such edit carries a one-line comment that names `case-files R<n>`. No other existing test is edited.
- **Property tests.** One test per property, at least 100 runs (`numRuns: 100` or more), tagged `// Feature: case-files, Property N: <title>` and `// **Validates: Requirements X.Y**`. Numbers 1 to 14 are the numbers of the design's "Correctness Properties". The design describes four more properties without a number; they are numbered here: **Property 15** ensemble fracture count (requirement 13.11), **Property 16** rejected case disables Accuse (requirement 19.7), **Property 17** key never leaks (requirement 17.11), **Property 18** kill switch (requirement 17.11). Property files are named `*.node.test.ts`.
- **Language and stack.** TypeScript 5.4.5 strict, React 18.3.1, zod, Vitest, fast-check, Playwright, pnpm workspace. Versions are copied from `apps/expense-auditor/package.json`.
- **Domain words** (suspect, clue, culprit, statement kind names, receipt, expense, alcohol, meal, trip) never appear in `packages/core/src` or `packages/xray-ui/src`. Use `member`, `plate`, `label`, `accused`.
- **Reference screenshots** are created on purpose, only in tasks 7.5 (new `apps/case-files/e2e/__screenshots__` PNGs). Review images go to `.kiro/specs/case-files/review/` at the checkpoints. Reference PNGs of the expense app never change.
- **Hash and text.** Case text is always rendered as escaped React text, never as HTML.
- **Spec files.** Before task 1.1, if `git status` shows `.kiro/specs/case-files/` as untracked, commit the three spec files first with `docs(case-files): add spec`. This is not a task. `<START>` is `HEAD` after that commit.

Decisions recorded here:

- **Requirement adjustments applied.** `requirements.md` already contains the design's CF-A1 (Requirement 9.2) and CF-A3 (Requirement 10.1) (Decision D26). Tasks 4.3 and 4.4 depend on them: the pipeline reads only `ruleOutcomes` from core `evaluate`, and the Replay never calls core `replay`.
- **Mockups.** The user asked for `design/mockups/bones-7-retro-b.png` and the expense Signature screen as the comparison at "checkpoint ui done". Requirements 21.7 and 23.3 name `design/mockups/bones-6-casefiles-b.png`. Task 6.7 and task 11.1 produce both comparisons, so both statements are met.
- **Design deviations, on purpose.** (a) The design's `Shell` `stage` slot is not built (the design itself drops it). `CaseScreen` composes `ShellFrame` and the existing parts. (b) The design lists one `reference-1600.spec.ts` for both sizes. A spec runs in one Playwright project only, so there are two files: `reference.spec.ts` (project `chromium`, 1440x900) and `reference-1600.spec.ts` (project `chromium-1600`, 1600x900). (c) The 4-suspect test case (requirement 21.3) is injected by an e2e-only build flag, see task 7.1.
- **Checkpoints are leaf sub-tasks** (3.4, 6.7, 11.1), as in `expense-auditor/tasks.md`, so they appear in the dependency graph and keep their order.
- **Platform note.** References are made on the developer machine. System sans glyph widths differ between macOS and Linux, so e2e runs only on the platform that made the references.

## Tasks

- [x] 1. Scaffold, Case_Schema and Recorded_Cases
  - [x] 1.1 Scaffold `apps/case-files`
    - Record `<START>`: run `git rev-parse HEAD` before any change and write the result in the Notes under "Start commit" (the Notes edit goes into this task's commit).
    - Files (new): `apps/case-files/package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `index.html`, `.env.example` (empty keys, `LIVE_EXTRACTION=off`, no `VITE_` prefix), `src/main.tsx` (renders a placeholder `<h1>Bones Case Files</h1>`), `src/styles/app.css` (empty layout-only file), `tests/setup.ts`, `tests/unit/scaffold.node.test.ts`. Edit: root `package.json` (scripts `dev:case-files` = `pnpm --filter @bones/case-files dev`, `e2e:case-files` = `pnpm --filter @bones/case-files test:e2e`; keep `test`, `typecheck`, `e2e`), `pnpm-lock.yaml` (from `pnpm install`).
    - `package.json`, `tsconfig.json`, `vitest.config.ts` exactly as in the design (name `@bones/case-files`, pinned versions of the expense app, scripts `dev`, `build`, `build:check`, `preview`, `test`, `typecheck`, `test:e2e`). `vite.config.ts`: dev server `127.0.0.1:5201` and preview `127.0.0.1:5202`, both `strictPort: true`, `sourcemap: false`, `fs.allow` repo root, no dev API middleware yet. `playwright.config.ts`: as in the design (projects `chromium` 1440x900 and `chromium-1600` 1600x900, `updateSnapshots: "none"`, `reducedMotion: "reduce"`, `colorScheme: "dark"`, web server `pnpm build && pnpm exec vite preview --host 127.0.0.1 --port 5202 --strictPort`, env `LIVE_EXTRACTION=off`). No spec files exist yet, so `pnpm e2e:case-files` is not run in this task.
    - `workspace` file `pnpm-workspace.yaml` needs no change (it lists `apps/*`).
    - `scaffold.node.test.ts`: reads `vite.config.ts`, `playwright.config.ts` and `package.json` as text and asserts ports 5201 and 5202, `strictPort: true` twice, the eight script names, the dependency names (only `@bones/core`, `@bones/xray-ui`, `react`, `react-dom`, `zod` in `dependencies`), and that root `package.json` has `dev:case-files` and `e2e:case-files`.
    - No import of the other app, no Node built-in in `src`.
    - Checklist: `pnpm install`, `pnpm -r typecheck`, `pnpm -r test`, `pnpm --filter @bones/case-files build`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): scaffold app package, ports 5201 and 5202, root scripts`
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7, 1.8, 1.10, 20.9, 23.6_

  - [x] 1.2 Case_Schema, valid-case arbitrary, schema properties
    - Files (new): `apps/case-files/src/pipeline/schema.ts`, `tests/helpers/arbitraries.ts`, `tests/properties/schema-roundtrip.node.test.ts`, `tests/properties/schema-rejection.node.test.ts`, `tests/unit/schema-keys.node.test.ts`.
    - `schema.ts` as in the design: `caseFieldsSchema` (all objects `.strict()`, limits of requirement 2.2 to 2.7, discriminated unions for statements and clues, `.superRefine` for unique ids, cross-references and the self-sighting check), `confidenceSchema`, `modelOutputSchema` (case fields plus `confidence`), `extractCaseFields(validated)`, the inferred types `CaseFields`, `Suspect`, `Statement`, `Clue`. The 32,768-byte cap is not in the schema; the pipeline does it (task 4.3). Text fields: non-empty after trim, no control characters.
    - `arbitraries.ts` (requirement 19.2): `validCaseArb` covers 2 to 4 suspects, 1 to 5 statements, all statement and clue kinds, both reliabilities, intervals inside, before, after and exactly touching the crime window, ids unique by construction (`fc.uniqueArray`), plus `confidenceArb` for the confidence map of requirement 2.12. Also a `mutationArb` that applies exactly one limit violation.
    - **Property 1: Case_Schema round trip**
      - *For all* valid Cases, serialising to JSON, parsing and validating again produces an equal Case.
      - **Validates: Requirements 2.15**
    - **Property 2: Case_Schema rejects every limit violation**
      - *For all* valid Cases and each single violation (field length, minute range, id pattern, duplicate id, unknown id reference, `startMin > endMin`, self-sighting, unknown key, forbidden key), validation fails with an issue at a path consistent with the violated field.
      - **Validates: Requirements 2.6, 2.7, 2.8, 2.9, 2.10, 2.11**
    - `schema-keys.node.test.ts`: walks the zod shape and asserts no key matches `/culprit|guilty|verdict|convict|solution|score/i` (requirement 2.10), and that the schema has no field for a culprit. Unit tests: every length limit at its boundary, control characters rejected, whitespace-only text rejected.
    - Core `validate` is the only gate: tests call `validate(raw, modelOutputSchema)` from `@bones/core`.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add strict Case_Schema with schema properties`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.14, 2.15, 19.1, 19.2, 19.3_

  - [x] 1.3 Three Recorded_Cases and parity test
    - Files (new): `apps/case-files/recorded/greenhouse.json`, `candlesticks.json`, `empty-room.json`, `tests/parity/recorded-parity.node.test.ts`, `tests/helpers/fixtures.ts` (the `readRecorded()` helper only; the rule helpers follow in task 2.1).
    - Each file is `{id, title, extraction}` with `extraction` = `{proposedFields, confidence, sources: {}, rawModelOutput}`. The case content is the JSON of the design's "Recorded cases" section (greenhouse, candlesticks, empty-room, ids and texts as written there). `rawModelOutput` is the JSON text of `proposedFields` (the case fields plus `confidence`). Each case has at least one confidence value below 0.80 and the confidence keys of requirement 2.12.
    - `recorded-parity.node.test.ts`: for each file: `JSON.parse(rawModelOutput)` equals `proposedFields` (requirement 7.7); the proposed fields validate with `modelOutputSchema`; at most 4 suspects and 5 statements per suspect; across the three cases every statement kind occurs at least once (location, possession, sighting); one confidence value below 0.80 per case; `sources` is `{}`; the three ids are exactly `greenhouse`, `candlesticks`, `empty-room`; no key named like a culprit (requirement 2.10) at any depth.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add three recorded cases with parity test`
    - Fixture labelling (requirement 24.4): the three files and `fixtures.ts` are hand-written fixtures, not LLM output. Any header comment or origin field (for example `source` or `origin`) says `fixture`; no file comment, README line or field name claims LLM authorship. The parity test asserts that no recorded file contains the words `LLM`, `gpt` or `model-generated` and that an origin field, if present, equals `fixture`.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7, 2.12, 19.4, 24.4_

- [x] 2. Rules v1, v2, v3 with Fact_Deriver and Rule_Binder
  - [x] 2.1 Rule files, Rule_Sets, catalog and rules README
    - Files (new): the 11 files in `rules/case-files/rules/` and the 3 files in `rules/case-files/rule-sets/` with the exact JSON of the design, `rules/case-files/README.md`, `apps/case-files/src/rules/catalog.ts`, `tests/unit/rule-files.node.test.ts`, `tests/unit/catalog.node.test.ts`, `tests/guards/rules-purity.node.test.ts`. Edit: `tests/helpers/fixtures.ts` (add `readRuleDir`, `loadTestBundle`).
    - `catalog.ts`: `import.meta.glob` over `rules/case-files/rules/*.json` and `rule-sets/*.json`, `RULE_SET_REFS` (`v1` → `case-files@1.0.0`, `v2` → `2.0.0`, `v3` → `3.0.0`), `buildBundle` (copied in algorithm from `apps/expense-auditor/src/rules/catalog.ts`, catalog key `${id}@${version}`, `rule_not_found` for a missing reference), `loadBundle()`, type `RuleBundle` = `{templateCatalog, templateRuleSets}`.
    - `rules/case-files/README.md`: the version table of the design and the nine-cell verdict matrix (requirement 4.12).
    - `rule-files.node.test.ts`: all 11 rules and 3 rule sets pass `parseRule` and `parseRuleSet`; every reference resolves; no rule file is unreferenced; file counts 11 and 3; each version compares the field named in requirement 4.3 (`…Any` in 1.0.0, `…Firm` in 2.0.0, `statement-sighting-contradicted` compares `conflictsFirm`). `catalog.node.test.ts`: bundle builds; missing rule and missing rule set give the CoreError kinds; keys are `${id}@${version}`.
    - `rules-purity.node.test.ts` (requirement 20.6): every rule parses with `parseRule`, effect `deducting`, condition kind `comparison` only, `deductionAmount` 1, left path starts with `subject`, no key outside the core rule schema, every `{{…}}` slot starts with `subject.`, `messageTemplate` at most 240 characters, and the rule id matches `/^proof-(means|opportunity|motive)$/` or `/^statement-(location|possession|sighting)-contradicted$/` (design risk table). Self-tests with one bad and one clean sample.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add rule files v1 to v3, rule sets and bundle catalog`
    - _Requirements: 1.2, 1.3, 4.1, 4.2, 4.3, 4.4, 4.9, 4.10, 4.12, 20.6_

  - [x] 2.2 Fact_Deriver
    - Files (new): `apps/case-files/src/derive/factDeriver.ts`, `tests/properties/fact-deriver-model.node.test.ts`, `tests/properties/fact-deriver-order.node.test.ts`, `tests/unit/fact-deriver.node.test.ts`.
    - `deriveFacts(case: CaseFields): DerivedCase` as in the design: per suspect `meansAny/Firm`, `opportunityAny/Firm`, `motiveAny/Firm`; per statement `conflictsAny/Firm` by kind; `authorName`. Closed-interval overlap. Types `DerivedCase`, `DerivedSuspect`, `DerivedStatement` exported. No clock, no randomness, no I/O, no threshold, no confidence. Order of suspects, statements and clues is kept.
    - **Property 3: Fact_Deriver matches a naive reference model**
      - *For all* valid Cases, every count equals the count of a naive nested-loop reference written in the test from the acceptance criteria text.
      - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.8**
    - **Property 4: Fact_Deriver is order-independent and Rule_Set-independent**
      - *For all* valid Cases and clue permutations, the counts per suspect id and statement id are equal; running twice gives equal output; no Rule_Set label is an input.
      - **Validates: Requirements 3.9, 3.10**
    - Unit tests: the hand-checked count tables of the three Recorded_Cases from the design; `held: true` gives 0 conflicts; a sighting reads the seen suspect's presence clues; touching intervals overlap; `authorName` equals the suspect name.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add pure Fact_Deriver with model and order properties`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [x] 2.3 Rule_Binder
    - Files (new): `apps/case-files/src/rules/binder.ts`, `tests/properties/binder-uniqueness.node.test.ts`, `tests/unit/binder.node.test.ts`.
    - `bindRuleSet(templateRuleSet, templateCatalog, derivedCase)` returns `{ruleSet, catalog, bindings, amountScopes}` or a CoreError. One instance per suspect for `proof-*`, one per statement of the matching kind for `statement-<kind>-contradicted`, instance id `<templateId>:<targetId>` (at most 128 characters), path prefix `subject` rewritten to `suspects.<i>` or `suspects.<i>.statements.<j>` (also in the `{{subject.…}}` slots), `effectConfig.scope` `proof` or `credibility`, `AmountScope`s with `claimedCents` = instance count (a scope with no instance is omitted), same `id` and `version` as the template Rule_Set, at most 200 references, catalog key `${instanceId}@${version}`. A path root other than `subject` or an id outside the two patterns gives `invalid_rule_schema`.
    - **Property 5: Rule_Binder produces unique instances with the right count**
      - *For all* valid Cases and each of v1, v2, v3, instance ids are pairwise unique, the `proof-*` count equals (proof templates in that version) times (suspects), and the `statement-*` count equals the number of statements whose kind has a template in that version.
      - **Validates: Requirements 4.11**
    - Unit tests: path and slot rewriting for suspect index 2 and statement index 1; scope names; omission of an empty scope; both error cases; the instance Rule_Set passes core `parseRuleSet`, and instance rules pass `parseRule`.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add Rule_Binder with uniqueness property`
    - _Requirements: 4.5, 4.6, 4.7, 4.8, 4.9, 4.11_

- [x] 3. Solver
  - [x] 3.1 Solver with property tests and the expected matrix
    - Files (new): `apps/case-files/src/pipeline/amountScopes.ts` (only if the binder does not already return the scopes; otherwise skip), `apps/case-files/src/solver/solve.ts`, `tests/fixtures/expected-matrix.ts`, `tests/unit/expected-matrix.node.test.ts`, `tests/properties/solver-determinism.node.test.ts`, `tests/properties/solver-rejection-rule.node.test.ts`, `tests/properties/solver-order-independence.node.test.ts`, `tests/properties/solver-confidence-independence.node.test.ts`.
    - `solve(derivedCase, versionLabel, bundle)`: bind, run core `evaluate` once, use only `decision.ruleOutcomes` (Requirement 9.2 as amended: `evaluate`'s own `result` and `amountCents` are never read), classify per suspect (D6: every bound `proof-*` instance fired and at least one `statement-*` instance fired), return `{ruleSetVersion, outcomes, suspects, convictable, verdict, reasons}`. `convictable` is in case suspect order. `missing` holds the unfired proof instance ids plus `no-contradicted-statement`. `closestSuspectId` = fewest `missing`, ties by suspect order. Exports `SolveResult`, `SolverProof`, `SolverReason`, `VersionLabel`. Input type is `DerivedCase`, so a confidence value cannot reach the Solver.
    - `expected-matrix.ts`: the nine cells of the design (greenhouse accepted `[widow]` in v1, v2, v3; candlesticks `unfair_many [ada, bram]`, `accepted [ada]`, `accepted [ada]`; empty-room `unfair_none []`, `accepted [dana]`, `unfair_none []`) stored once. `expected-matrix.node.test.ts` runs `deriveFacts` and `solve` for all nine combinations (the real pipeline is added in task 4.3).
    - **Property 6: Solver is deterministic**
      - *For all* valid Cases and labels, two calls return deeply equal results.
      - **Validates: Requirements 5.11**
    - **Property 7: Solver verdict is exactly the convictable-count partition**
      - *For all* valid Cases and labels, `accepted` iff 1 convictable, `unfair_none` iff 0, `unfair_many` iff 2 or more.
      - **Validates: Requirements 5.12**
    - **Property 8: Solver is order-independent**
      - *For all* valid Cases, labels and permutations of suspects, of statements within a suspect and of clues, the set of convictable ids is unchanged.
      - **Validates: Requirements 5.13**
    - **Property 9: Solver is confidence-independent**
      - *For all* valid Cases and labels, changing any confidence value leaves `convictable`, `verdict` and `outcomes` unchanged.
      - **Validates: Requirements 5.14**
    - Unit tests: the `missing` lists and `closestSuspectId` tie break; reasons shape per verdict; a CoreError from the binder is returned unchanged.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add pure Solver with determinism, rejection and independence properties`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.10, 5.11, 5.12, 5.13, 5.14, 5.15, 6.1, 6.2, 7.2, 7.3, 7.4, 7.5, 9.2_

  - [x] 3.2 Solver messages
    - Files (new): `apps/case-files/src/solver/solverMessages.ts`, `tests/unit/solverMessages.node.test.ts`.
    - Closed English templates `renderReasonTemplate(reason, names, versionLabel)` for the codes `one`, `none`, `many`, and the accusation texts ("Case closed: <name> is guilty." and "Wrong suspect: <name> cannot be convicted."), plus the banner list text for the convictable suspects. Inputs are ids, names and version labels only. `buildSolverMessages(result, accusation)` returns the `ChatMessage[]` shape of the design (`id`, `kind`, `text`).
    - Unit tests: every template renders with no empty slot and no `{{` left, for 0, 1 and 3 suspect ids; names with the maximum length render whole; no template reads model text.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add closed solver message templates`
    - _Requirements: 5.9, 11.9, 15.4, 15.5_

  - [x] 3.3 Solver and deriver purity guard
    - Files (new): `apps/case-files/tests/guards/solver-purity.node.test.ts`.
    - Source-scan `src/derive/factDeriver.ts`, `src/rules/binder.ts`, `src/solver/solve.ts` and `src/solver/solverMessages.ts`: none contains `Date.now`, `new Date(`, `Math.random`, `crypto`, `fetch`, `eval`, `new Function`; imports are only `@bones/core` and local relative files (requirement 20.7). Self-tests with one bad and one clean sample. No rule evaluator other than core `evaluate` exists in `src` (scan for `evaluateCondition`, requirement 4.9).
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `test(case-files): guard solver, deriver and binder purity`
    - _Requirements: 4.9, 5.15, 9.5, 20.7_

  - [x] 3.4 Checkpoint: checkpoint solver done (HARD STOP)
    - Run `pnpm -r typecheck`, `pnpm -r test`, `git diff --exit-code <START> -- packages/core apps/expense-auditor` and `git status`. All clean.
    - Report the expected matrix result of the nine combinations (case x v1, v2, v3: verdict and convictable ids as run by `tests/unit/expected-matrix.node.test.ts`), the number of property runs per solver property, and any counterexample found and fixed (if one was found, add a line `Property N | Counterexample | Root cause | Fix` to `.kiro/specs/case-files/bugs-found.md` in the commit of the fix).
    - Commit: none (verification only).
    - Ensure all tests pass, ask the user if questions arise.
    - **HARD STOP:** After finishing this task, STOP and reply with exactly "checkpoint solver done". Do not start any further task until the user says "weiter". After "weiter", record the verdict under "Review verdicts" with the commit `docs(case-files): record solver done verdict`.
    - _Requirements: 23.2, 23.5, 23.6_

- [ ] 4. Pipeline, Trace, replay, override, accusation
  - [x] 4.1 Ports, clock and hash
    - Files (new): `apps/case-files/src/pipeline/ports.ts`, `src/pipeline/hash.ts`, `tests/helpers/fakes.ts`, `tests/unit/ports.node.test.ts`.
    - Copy in shape from `apps/expense-auditor/src/pipeline/ports.ts` and `hash.ts` (D20, copy, no import): `makeClock` returns strictly increasing times at least 1 ms apart, id port (UUID), `KernelPorts` factory `forInput(hex, byteLength)` with a hasher that returns the precomputed hex and checks the byte length, `sha256Hex(bytes)` through Web Crypto in `hash.ts` only. `fakes.ts`: `counterPorts()` with fixed clock and ids for tests.
    - Unit tests: clock strictly increases even when `now()` repeats or goes back; hasher byte-length mismatch is an error; `sha256Hex` of a known string; the pure files contain no `Date.now` (only `ports.ts` default wiring).
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add kernel ports, strictly increasing clock and sha256`
    - _Requirements: 9.4, 9.5, 12.8, 19.4, 19.6, 22.1_

  - [~] 4.2 RecordedCaseAdapter
    - Files (new): `apps/case-files/src/extraction/RecordedCaseAdapter.ts`, `src/extraction/samples.ts` (list of the three recorded entries through `import.meta.glob("../../recorded/*.json")`, `RecordedCaseId`, sheet list helper), `tests/unit/recordedAdapter.node.test.ts`.
    - Browser twin of the core `RecordedAdapter`, in the pattern of `apps/expense-auditor/src/extraction/RecordedSampleAdapter.ts`: constructor `(caseId, cases = RECORDED_CASES)`, guards input, finds the entry by id, parses it with a stored-entry zod schema, returns `structuredClone(entry.extraction)`, or the CoreError `fixture_not_found` or `fixture_invalid`. No network call.
    - Unit tests: returns a clone (mutating the result does not change the entry); unknown id; malformed entry; each of the three ids returns an extraction whose `rawModelOutput` parses.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add browser RecordedCaseAdapter for the three recorded cases`
    - _Requirements: 7.8, 7.9, 8.1, 8.4_

  - [~] 4.3 runCasePipeline
    - Files (new): `apps/case-files/src/pipeline/runCasePipeline.ts`, `tests/properties/pipeline-determinism.node.test.ts`, `tests/unit/pipeline.node.test.ts`. Edit: `tests/unit/expected-matrix.node.test.ts` (run the real pipeline for the nine combinations instead of `solve` alone).
    - Order: extraction, size guard (UTF-8 bytes of `rawModelOutput` above 32,768 gives `input_too_large` before parsing), core `validate` with `modelOutputSchema`, `deriveFacts`, `solve`, build the Decision (`result` `approved` when `accepted`, else `rejected`; `amountCents` = number of convictable suspects, 1 when accepted; `ruleOutcomes` = Solver outcomes), `createTrace` with the template Rule_Set (id and version of the label), `validatedFields` = the DerivedCase, `inputHash` = SHA-256 of the UTF-8 bytes of `rawModelOutput`. Per Requirement 9.2 as amended, only `ruleOutcomes` of `evaluate` is used. The first CoreError is returned and later steps do not run (spy test).
    - **Property 10: Pipeline determinism**
      - *For all* valid raw model outputs and labels, two runs give equal `validatedFields`, `ruleOutcomes`, `result` and `amountCents`.
      - **Validates: Requirements 9.7**
    - Unit tests: invalid JSON and schema failure give `validation_failed` and no Trace; oversize gives `input_too_large`; adapter error passes through and no rule runs; Trace fields of requirement 9.3; `inputHash` of the raw output; deep freeze (mutation throws or has no effect); `Trace.result` and `amountCents` for the three verdict kinds; the nine-cell matrix through the real pipeline.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add case pipeline with Solver-derived result and Trace`
    - _Requirements: 2.13, 2.14, 6.1, 6.2, 7.5, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 19.4_

  - [~] 4.4 Replay, replay store and verdictOf
    - Files (new): `apps/case-files/src/pipeline/replayCase.ts`, `src/pipeline/replayStore.ts`, `tests/properties/replay-equivalence.node.test.ts`, `tests/unit/replayStore.node.test.ts`, `tests/unit/replay.node.test.ts`.
    - `replayCase({original, label, bundle, ports})`: no call to core `replay` (Requirement 10.1 as amended). It runs `solve` on the stored `validatedFields`, builds the Decision as in task 4.3, and calls `createTrace` with the extraction fields of the original and `options.inputHash` of the original. No adapter, no hasher, no network. `verdictOf(trace, bundle)` recomputes `{verdict, convictable}` from the stored Trace and its `ruleSetVersion` (requirement 6.3). `ReplayStore` and `putReplay` as in `apps/expense-auditor/src/pipeline/replayStore.ts` (v1 is never replaced).
    - **Property 11: Replay equivalence**
      - *For all* valid Cases and labels, `replayCase` gives a Trace whose `validatedFields`, `ruleOutcomes`, `result` and `amountCents` equal those of a fresh `runCasePipeline` with that label.
      - **Validates: Requirements 10.4**
    - Unit tests: the original Trace is unchanged (deep equal before and after); the replay carries the `ruleSetVersion` of the label; hasher and adapter spies record 0 calls; `verdictOf(trace)` agrees with `Trace.result` for every Trace of the nine combinations; `putReplay` cannot overwrite `v1`; a binder CoreError is returned.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add app-level replay, replay store and verdictOf`
    - _Requirements: 6.3, 10.1, 10.2, 10.3, 10.4_

  - [~] 4.5 Accusation
    - Files (new): `apps/case-files/src/state/accusation.ts`, `tests/properties/accusation-correctness.node.test.ts`, `tests/unit/accusation.node.test.ts`.
    - `computeAccusation(trace, suspectId, convictable, clock)` returns the `AccusationRecord` `{decisionId, ruleSetVersion, suspectId, verdict, proofRuleIds, createdAt}`; `boundTo(ruleId)` finds the suspect for proof ids (`<template>:<suspectId>`) and, for statement ids, through the Binder's bindings. A pure function of the Trace, suspect id and convictable list. It reads no `rawModelOutput`, no `confidence`.
    - **Property 12: Accusation correctness**
      - *For all* Cases, labels and accused ids, `verdict` is `correct` iff the id is in `convictable`; changing `rawModelOutput` and `confidence` of the Trace does not change the record.
      - **Validates: Requirements 11.12**
    - Unit tests: `proofRuleIds` holds exactly the fired instances of the accused suspect (hand-checked for the widow of greenhouse); `createdAt` comes from the clock port.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add pure accusation record`
    - _Requirements: 11.7, 11.8, 11.12_

  - [~] 4.6 Reducer, session store and human override
    - Files (new): `apps/case-files/src/state/reducer.ts`, `src/state/sessionStore.ts`, `src/state/selectors.ts` (`effectiveView` copied from the expense app, domain-free), `src/state/intro.ts` (only what `ShellFrame` needs), `tests/unit/reducer.node.test.ts`, `tests/unit/sessionStore.node.test.ts`, `tests/properties/override-immutability.node.test.ts`.
    - Reducer as in the design: `StartState | CaseState`, `CaseState` with `origin`, `original`, `replays`, `selected`, `overrides`, `accusation`, `selectedSuspectId`, `xray` (starts `false`, D15), `notice`; actions `case_ready`, `version_selected`, `suspect_selected`, `xray_toggled`, `accused` (also sets `xray: true`), `override_added`, `notice`, `reset`. Store: `loadRecordedCase(id)` (pipeline with v1), `selectVersion(label)` (cached replay or `replayCase`; on CoreError keep the previous Trace and set a notice), `selectSuspect`, `toggleXray`, `accuse(suspectId)` (rejected effective result refuses), `submitOverride(form)` (core `override`, `{ok:false, field, message}` on `invalid_override_input`), `reset()` (discard everything, requirement 11.11). `effectiveResult` from core; two overrides with the same `createdAt` give the `ambiguous_override` error and keep the rule result.
    - **Property 13: Override immutability**
      - *For all* sequences of valid Overrides, `validatedFields`, `ruleOutcomes` and the rule result of the Trace (`verdictOf`) equal those before the first Override; the Trace is the same frozen object.
      - **Validates: Requirements 12.9**
    - Unit tests: X-RAY starts off; accuse flips X-RAY on in the same transition; accuse with a rejected effective result is refused; an override to `approved` of a rejected Trace allows accuse and an override to `rejected` of an approved Trace blocks it; knob turn after an accusation keeps the record; replay failure keeps the previous Trace; reset returns to start; validation errors of the override form (empty name, empty reason, 501 characters); two overrides never share `createdAt` through the clock.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add session reducer, store, accusation and override flow`
    - _Requirements: 10.3, 10.5, 10.6, 10.7, 11.2, 11.4, 11.5, 11.6, 11.7, 11.10, 11.11, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 19.4_

  - [~] 4.7 Trace export
    - Files (new): `apps/case-files/src/export/exportTrace.ts`, `tests/properties/export-roundtrip.node.test.ts`, `tests/unit/export.node.test.ts`.
    - `buildCaseExport(trace, overrides, accusation)` and `exportTrace` serialise the Trace, the overrides and the Accusation_Records to JSON, in the pattern of `apps/expense-auditor/src/export/exportTrace.ts`. First item of the scope cut order (requirement 9.8).
    - **Property 14: Export round trip**
      - *For all* export payloads, serialise, parse and serialise again gives byte-identical JSON text, and the parsed value equals the payload.
      - **Validates: Requirements 9.8**
    - Unit tests: export contains the accusation record when present and `null` otherwise; overrides keep their order.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add trace export with round-trip property`
    - _Requirements: 9.8, 11.8_

- [ ] 5. Xray-ui additions (additive, optional props, default pixels unchanged)
  - [~] 5.1 SkeletonEnsemble
    - Files: `packages/xray-ui/src/components/stage/SkeletonEnsemble.tsx` (new), `packages/xray-ui/src/types.ts`, `packages/xray-ui/src/index.ts`, `packages/xray-ui/src/styles/stage.css`, `packages/xray-ui/src/__tests__/components/SkeletonEnsemble.test.tsx` (new), `packages/xray-ui/src/__tests__/properties/ensemble-fracture-count.test.tsx` (new), `packages/xray-ui/src/__tests__/domain-isolation.test.ts`.
    - Component as in the design: props `trace`, `members` (`{id, label, anatomy, accused?}`), `xray`, `selectedId`, `onSelect`, `selectLabel`, `reducedMotion`, `className`. Name plates form a `role="radiogroup"` with `aria-label`, each plate is `role="radio"` with `aria-checked`, roving tabindex, arrow keys, Home and End, activation by click, Enter and Space calls `onSelect(id)`. `xray` false renders plates only. Each member renders one existing `Stage` with `selectBones(trace, member.anatomy)` only. `data-accused` on plates and members. 1 to 4 members, grid `grid-auto-columns: minmax(160px, 1fr)`, sizes with `--xr-u` or percentages, no raster file, no new `@keyframes`, no transition without the reduced-motion entry (motion guard). Existing components, props and DOM do not change.
    - Domain isolation: in the same commit, extend the forbidden words of `domain-isolation.test.ts` with `clue` and `culprit` (comment: `case-files R20.8`). Run the existing xray-ui guards (`size-limit`, typography, label-box, motion, source-hygiene, assets, contrast); if one needs an allow-list entry for the new selectors, add it with a comment in this commit, never loosen a rule.
    - **Property 15: Ensemble fracture count**
      - *For any* list of 1 to 4 members with random anatomies and outcomes, the number of rendered fractured bones equals the sum over members of the fractured bones of `selectBones(trace, member.anatomy)`.
      - **Validates: Requirements 13.11**
    - Component tests: roles and `aria-checked`, roving tabindex, arrow keys, Home and End, Enter and Space, `xray` false has no image, hotspot or ECG, bone states per member differ for different anatomies on one Trace, `data-accused`.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e` (expense references unchanged: `git status` shows no PNG change), core/expense diff empty, `git status` clean.
    - Commit message: `feat(xray-ui): add SkeletonEnsemble for several skeletons on one Trace`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.11, 16.2, 16.3, 20.8_

  - [~] 5.2 DoctorPanel `extraMessages`
    - Files: `packages/xray-ui/src/components/panels/DoctorPanel.tsx`, `packages/xray-ui/src/types.ts`, `packages/xray-ui/src/__tests__/components/DoctorPanel.test.tsx` (add one test).
    - Optional `extraMessages?: ChatMessage[]`, appended after the output of `buildChatMessages(trace, anatomy)` before `ChatLog`. Omitted or `undefined` gives exactly the old messages. `speedMs` already exists and is not changed.
    - New test: with `extraMessages` the messages appear after the built-in ones, in order, and typed with the same typing logic; without the prop the DOM equals the old DOM. Existing assertions stay unchanged. Second cut-order item: if the Time_Box forces this cut, skip this task and show the Solver reason on the Glass_Card only.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e` (expense references unchanged), core/expense diff empty, `git status` clean.
    - Commit message: `feat(xray-ui): add optional extraMessages to DoctorPanel`
    - _Requirements: 13.10, 15.4, 15.5, 15.7_

  - [~] 5.3 GlassCard `overruled` and `stampDetail`
    - Files: `packages/xray-ui/src/components/panels/GlassCard.tsx`, `packages/xray-ui/src/types.ts`, `packages/xray-ui/src/__tests__/components/GlassCard.layout.test.tsx` (add two tests).
    - Optional `overruled?: boolean` (true forces the cracked glass and the stamp "OVERRULED BY RULE", independent of the field-based computation) and `stampDetail?: string` (text after the stamp title, for example the version label). Both omitted: the old computation, the same DOM and the same pixels.
    - New tests: `overruled` forces the stamp and cracks without any overruled field; `stampDetail` appears in the stamp; `overruled` false with fractured fields keeps the old behaviour (the prop only forces on). Existing assertions unchanged. Fourth cut-order item.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e` (expense references unchanged), core/expense diff empty, `git status` clean.
    - Commit message: `feat(xray-ui): add optional overruled and stampDetail to GlassCard`
    - _Requirements: 13.10, 15.8, 20.8_

- [ ] 6. UI: Anatomy_Builder and screens
  - [~] 6.1 Anatomy_Builder and formatValue
    - Files (new): `apps/case-files/src/anatomy.ts`, `src/format/formatValue.ts`, `tests/unit/anatomy.node.test.ts`.
    - `buildCombinedAnatomy(derivedCase)` and `buildSuspectAnatomy(combined, suspect)` as in the design: bone regions by D18 (`skull` motive, `arm-right` means, `leg-right` opportunity, statements N=1..5 on `ribs`, `spine`, `arm-left`, `pelvis`, `leg-left`), unique `ruleId` per bone (instance ids), labels at most 40 characters starting with the suspect name (name truncated by a `truncateName(name, suffix)` helper, built from templates and ids, never from model text), `fieldLabels` for every derived evidence path and the case fields, `formatValue` that formats `crime` as "<place>, <hh:mm>-<hh:mm>, <item>" and `amountCents` as "<n> convictable" (never a currency symbol).
    - Unit tests: 4 suspects with 5 statements give at most 8 bones each and unique rule ids; label length at most 40 for names of 40 characters; every bone `ruleId` is an instance id that the Binder produces for some version (or is absent from the displayed rule set and then shows as not applicable); `formatValue("crime", …)` for the three recorded cases; `formatValue("amountCents", 0|1|2)`.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add anatomy builder and value formatting`
    - _Requirements: 15.1, 15.2, 15.3, 15.10, 15.12_

  - [~] 6.2 App shell, ErrorPanel and StartScreen
    - Files (new): `apps/case-files/src/App.tsx`, `src/ui/StartScreen.tsx`, `src/ui/ErrorPanel.tsx`, `src/ui/Toolbar.tsx` (header actions: "Download trace" and "Load another case" style actions with the xray-ui header icons, handlers from the store), `tests/components/StartScreen.test.tsx`, `tests/components/ErrorPanel.test.tsx`. Edit: `src/main.tsx` (mounts `App`), `src/styles/app.css`, `index.html`.
    - Start screen: visually hidden `h1` "Bones Case Files", header bar with wordmark and tagline, `StartLayout` with one `FilmSheet` per Recorded_Case (title, number of suspects, one-line setting from the stored case) and a fourth "Write a new case" `FormStrip` card with a theme select (4 themes) and a button. While Live_Mode is off (no live code exists yet, so `liveAvailable` is `false`) the card is disabled with the note "Live mode is off on this server. Pick a recorded case." and the recorded sheets stay usable. Choosing a sheet calls `store.loadRecordedCase`. `ErrorPanel` shows a CoreError with `role="alert"`. `App.tsx` builds the bundle once (a bundle error shows "The rules could not be loaded") and switches `start` and `case`.
    - `app.css` holds layout only: position, display, flex, grid, gap, padding, margin, sizes with percentages or `--xr-u`; colour, border, background, shadow and font only in the `body` rule. No `@keyframes`, no `transition`, no `animation`, no image, no `url(`. Everything visual comes from xray-ui components and tokens.
    - Component tests: three sheets with the title texts, a click starts the recorded case, the live card is disabled with the note, keyboard activation of a sheet, `ErrorPanel` role and message for `fixture_not_found`.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add app shell, start screen and error panel`
    - Honest label (requirement 24.2): each of the three recorded sheets shows the small visible note "Recorded demo case", passed to the generic `FilmSheet` through an existing or optional domain-free prop. Contrast at least 4.5:1, no new raster. The component test asserts the note on each of the three sheets, and the start-screen e2e spec asserts the same text three times.
    - _Requirements: 8.1, 11.1, 11.2, 14.1, 14.2, 14.3, 14.10, 14.11, 16.1, 16.2, 16.6, 24.2_

  - [~] 6.3 CaseScreen
    - Files (new): `apps/case-files/src/ui/CaseScreen.tsx`, `src/ui/VersionNote.tsx`, `tests/components/CaseScreen.test.tsx`. Edit: `src/App.tsx`, `src/styles/app.css` (layout only).
    - Composition as in the design: `ShellFrame` with `ControlPanel` (knob `v1`, `v2`, `v3`; AI READ CONFIDENCE meter on the combined Trace; X-RAY switch, starting off), `DocumentPanel` with the case text as lines (Crime line, Clues, Statements of the selected suspect; escaped React text, no marks, `sources` is `{}`), the `.xr-shell-stagecell` with `SkeletonEnsemble` (suspect members from `buildSuspectAnatomy`, mounted so name plates are always visible and skeletons only when X-RAY is on) and the `GlassCard` (`overruled` when the effective result is `rejected`, `stampDetail` = version label) above it, `DoctorPanel` with `extraMessages` from `buildSolverMessages`, `claimedCents` = number of suspects (D9 progress share), `speedMs` from D25. Buttons "Accuse" and "Replay" below the ensemble: Accuse is disabled while no suspect is selected or the effective result is `rejected`, with the reason in an element referenced by `aria-describedby`. "Replay" re-runs intro and typing without re-evaluation. `VersionNote` shows "Replayed with v<N>. Original: v1." in the header. Replay errors show in `ErrorPanel` and keep the previous Trace.
    - Component tests: X-RAY off at start (plates and statements readable, no skeleton image); X-RAY on shows bones; radiogroup keyboard (arrows move selection, one tab stop); Accuse disabled with no selection and for a rejected Trace (`candlesticks` v1), enabled for v2; the knob shows the verdict, fractures and card state of the displayed Trace; the stamp appears for a rejected Trace and not for an approved one; the version note text; text is escaped (a statement text with `<b>` renders as text); the meter shows the mean confidence and "n/a" for empty confidence.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add case screen with ensemble, glass card, knob and accuse gating`
    - _Requirements: 6.4, 6.5, 6.6, 10.5, 10.6, 10.7, 11.3, 11.4, 11.5, 11.6, 14.4, 14.5, 14.9, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 15.11, 15.12, 16.5, 16.6, 16.8_

  - [~] 6.4 OverrideDialog
    - Files (new): `apps/case-files/src/ui/OverrideDialog.tsx`, `tests/components/OverrideDialog.test.tsx`. Edit: `src/ui/CaseScreen.tsx` (the "Human override" button, effective result display, ambiguous override panel), `src/styles/app.css` (layout only).
    - The dialog is copied in structure from the expense app (D20, no import): fields reviewer name (required), reason (required, at most 500 characters), replacement result (`approved` or `rejected`), `role="dialog"` with focus trap and focus return to the button, field errors next to the field without closing. The result display passes the effective result and the reviewer name so that it reads "overruled by <name>" and "Rules decided: <result>". An `ambiguous_override` error shows in a `role="alert"` panel and keeps the rule result.
    - Component tests: validation errors for empty name, empty reason and 501 characters; the dialog stays open; focus returns on close; override to `approved` enables Accuse and shows "overruled by"; override to `rejected` of an accepted case disables Accuse; the rule outcomes and fractures do not change after an override.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add human override dialog and effective result display`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 16.5, 16.6, 19.5_

  - [~] 6.5 VerdictView and Result_Banner
    - Files (new): `apps/case-files/src/ui/VerdictView.tsx`, `src/ui/ResultBanner.tsx`, `tests/components/VerdictView.test.tsx`. Edit: `src/App.tsx`, `src/styles/app.css` (layout only).
    - The verdict view is the case layout with X-RAY on, `data-accused="true"` on the accused member, the banner in the centre area below the Glass_Card ("CASE CLOSED: <name> is guilty." or "WRONG SUSPECT: <name> cannot be convicted.", then the convictable suspects, texts from `solverMessages.ts`), `role="status"` announcing the result, and the buttons "Replay" and "New case". The banner text appears at once (fifth cut-order item is the default; typed animation only if time allows). Turning the knob keeps the Accusation_Record and shows a note when the displayed version gives another verdict for the accused suspect. "New case" returns to the start screen and discards the session.
    - Component tests: correct and incorrect banners for the greenhouse widow and another suspect; convictable list text; `data-accused`; the note after the knob turn (`candlesticks`: accuse Ada under v2, turn to v1); "New case" resets; the result is announced in a `role="status"` element; a fracture has a shape and a label, not colour only.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add verdict view and result banner`
    - _Requirements: 11.7, 11.9, 11.10, 11.11, 14.6, 16.8, 16.10_

  - [~] 6.6 App flow wiring and rejection at UI level
    - Files (new): `apps/case-files/tests/components/App.test.tsx`, `tests/properties/ui-rejection.node.test.tsx` (jsdom, name ends with `.test.tsx` because it renders; the file uses `fast-check` with at least 100 runs). Edit: `src/App.tsx` (final switch `start`, `case`, `verdict`, error and bundle-error paths), `src/ui/*` only where wiring needs it.
    - Wire the full flow: start, recorded case, case screen, knob, X-RAY, accuse, verdict, override, new case. Export action from the toolbar uses `exportTrace` and a download helper (Blob, no network). The tab order is header actions, name plates (one tab stop), knob, X-RAY switch, Accuse, Replay, Human override, and the focus ring has at least 3 CSS pixels.
    - **Property 16: Rejected case disables Accuse**
      - *For any* generated Case that the Solver rejects (`unfair_none` or `unfair_many`) and 3 fixed examples (`empty-room` v1, `empty-room` v3, `candlesticks` v1), the pipeline Trace has `result` `rejected` and the rendered Accuse button is disabled.
      - **Validates: Requirements 19.7**
    - App flow tests: recorded mode makes no network request (`fetch` spy 0 calls); a pipeline CoreError shows `ErrorPanel` and no Trace; every interactive element is reachable by keyboard in the stated order.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm --filter @bones/case-files build`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): wire the full play flow with keyboard order and rejection property`
    - _Requirements: 6.5, 7.8, 11.1, 11.2, 11.7, 11.11, 14.5, 16.5, 19.5, 19.7_

  - [~] 6.7 Checkpoint: checkpoint ui done (HARD STOP)
    - Build and serve the app: `pnpm --filter @bones/case-files build`, then start `pnpm --filter @bones/case-files exec vite preview --host 127.0.0.1 --port 5202 --strictPort` as a background process and stop it at the end. Use a temporary Playwright script kept outside the repository (for example `/tmp/cf-shots.mjs`, run with working directory `apps/case-files` so `@playwright/test` resolves, viewport 1600x900, `reducedMotion: "reduce"`) to take: the start screen, the case screen with X-RAY on and a selected suspect (`greenhouse`), the rejected case (`candlesticks` v1) and the verdict view.
    - Copy them to `.kiro/specs/case-files/review/ui-start-1600.png`, `ui-case-1600.png`, `ui-rejected-1600.png`, `ui-verdict-1600.png`.
    - Build the side-by-side images with a temporary `sharp` script outside the repository (run with working directory `packages/xray-ui` so `sharp` resolves), each panel scaled to the same height: `review/ui-side-by-side-retro.png` = `design/mockups/bones-7-retro-b.png` | `ui-case-1600.png` | `apps/expense-auditor/e2e/__screenshots__/reference-1600.spec.ts/signature-case-1600.png` (the expense Signature screen, read only), and `review/ui-side-by-side-casefiles.png` = `design/mockups/bones-6-casefiles-b.png` | `ui-verdict-1600.png`.
    - Run `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e`, the core/expense diff check and `git status` (only the review PNGs are new).
    - Commit the review PNGs: `docs(case-files): add checkpoint ui review images`.
    - Report: what matches the mockups and what differs (header, steel frame, control strip, three or four skeletons, glass card, Dr. Bones, buttons), and the page size at 1600x900 (no scroll).
    - Ensure all tests pass, ask the user if questions arise.
    - **HARD STOP:** After finishing this task, STOP and reply with exactly "checkpoint ui done". Do not start any further task until the user says "weiter". The user compares `review/ui-side-by-side-retro.png` and `review/ui-side-by-side-casefiles.png`. After "weiter", record the verdict with the commit `docs(case-files): record ui done verdict`. If the verdict lists changes, the next task starts with them and refreshes the review images at its end.
    - _Requirements: 23.3, 23.5, 23.6_

- [ ] 7. End-to-end tests and reference screenshots
  - [~] 7.1 Playwright finalisation, e2e fixture flag, fair-case and incorrect-accusation specs
    - Files: `apps/case-files/playwright.config.ts`, `vite.config.ts`, `src/extraction/samples.ts`, `src/main.tsx` (or a small `src/e2eHook.ts`), `e2e/fixtures/four-suspects.ts` (new, 4 suspects with 5 statements each, valid under the Case_Schema), `e2e/fair-case.spec.ts`, `e2e/incorrect-accusation.spec.ts`, `tests/unit/e2e-fixture-flag.node.test.ts` (new).
    - Config: `testIgnore: /(reference-1600|no-scroll)\.spec\.ts/` for project `chromium`, `testMatch: /(reference-1600|no-scroll)\.spec\.ts/` for `chromium-1600` (the 1280x720 checks use `page.setViewportSize` inside `no-scroll.spec.ts`), `snapshotPathTemplate: "{testDir}/__screenshots__/{testFileName}/{arg}{ext}"`, `maxDiffPixelRatio: 0.001`, `threshold: 0.2`, `animations: "disabled"`, `updateSnapshots: "none"`, web server env `LIVE_EXTRACTION=off` and `CASE_FILES_E2E=1`.
    - Fixture flag: `vite.config.ts` defines `__CASE_FILES_E2E__` as `true` only when `process.env.CASE_FILES_E2E === "1"`. Only then `samples.ts` adds the 4-suspect case to the adapter's entries (not to the start screen sheets) and `main.tsx` exposes `window.__caseFilesE2E.loadRecordedCase(id)`. In a normal build the code is dead and removed. `e2e-fixture-flag.node.test.ts` builds without the variable into a temp dir and asserts the output has neither the id `four-suspects` nor `__caseFilesE2E`.
    - `fair-case.spec.ts` (flow a): open `greenhouse`, X-RAY off at start, select the widow, Accuse, verdict banner "CASE CLOSED", `data-accused`, X-RAY on. `incorrect-accusation.spec.ts` (flow b): accuse another suspect, banner "WRONG SUSPECT", the convictable list names the widow.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e`, `pnpm e2e:case-files` (both projects), core/expense diff empty, `git status` clean (no PNG written; `updateSnapshots` is `none`).
    - Commit message: `test(case-files): add e2e config, e2e fixture flag and the two accusation flows`
    - _Requirements: 21.1, 21.2, 21.3, 11.7, 19.6_

  - [~] 7.2 Knob-rejection, empty-room and override specs
    - Files (new): `apps/case-files/e2e/knob-rejection.spec.ts`, `e2e/empty-room.spec.ts`, `e2e/override.spec.ts`.
    - `knob-rejection.spec.ts` (flow c): `candlesticks` under v1 is rejected, the stamp is inside the Glass_Card, Accuse is disabled with a reason; turn the knob to v2: accepted, Accuse enabled, the status note "Replayed with v2. Original: v1." is shown. `empty-room.spec.ts` (flow d): v1 `unfair_none`, v2 accepted with Dana convictable, v3 `unfair_none`. `override.spec.ts` (flow e): rejected case, Human override to `approved` with reviewer and reason, Accuse enabled, "overruled by <name>" and "Rules decided: rejected" visible; the fractures are unchanged.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e`, `pnpm e2e:case-files`, core/expense diff empty, `git status` clean.
    - Commit message: `test(case-files): add e2e for knob rejection, empty-room versions and override`
    - _Requirements: 6.4, 6.5, 10.5, 12.4, 12.5, 21.2_

  - [~] 7.3 Keyboard and network specs
    - Files (new): `apps/case-files/e2e/keyboard.spec.ts`, `e2e/network.spec.ts`.
    - `keyboard.spec.ts` (flow f): from the start screen to the verdict with keys only: Tab and Enter to pick a sheet, arrow keys on the plates, Tab to knob (arrow keys change the version), X-RAY switch (Space), Accuse (Enter), then Replay and Human override reachable; the focus ring has an outline of at least 3 px on every stop; no mouse event is used. `network.spec.ts` (flow g): record every request; none leaves `127.0.0.1:5202`, no font host, no request to `/api/case` (live is off and the status request gets no server answer; the app handles it, and the note shows), the only allowed requests are the app's own files.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e`, `pnpm e2e:case-files`, core/expense diff empty, `git status` clean.
    - Commit message: `test(case-files): add keyboard-only and network e2e`
    - _Requirements: 16.5, 21.2, 18.5_

  - [~] 7.4 No-scroll, no-overlap and computed-style spec
    - Files (new): `apps/case-files/e2e/no-scroll.spec.ts`.
    - For each Viewport (1600x900 in project `chromium-1600`; the spec sets 1440x900 and 1280x720 with `page.setViewportSize`): the start screen, the case screen (with the `four-suspects` case through `window.__caseFilesE2E`, X-RAY on) and the verdict view have `scrollHeight <= innerHeight` and `scrollWidth <= innerWidth`; `.xr-doc`, `.xr-glass`, `.xr-ensemble-stage`, `.xr-doctor` and `.xr-cpanel` lie fully inside the viewport and do not overlap (exceptions: `.xr-cpanel` on the steel frame, the stamp on the Glass_Card, transparent margins of skeleton images); each of the 4 members is at least 160 CSS pixels wide at 1280x720 and members do not overlap. Computed-style checks: no `dashed` or `dotted` border or outline anywhere; label elements (`.xr-cpanel-plaque`, `.xr-doctor-title`) have no border box, background or shadow; the stamp lies inside the Glass_Card when the card is cracked (`candlesticks` v1).
    - If an assertion fails, fix the layout in `src/styles/app.css` (layout only) in this commit; xray-ui changes need their own commit in task 5.x style first.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e`, `pnpm e2e:case-files`, core/expense diff empty, `git status` clean.
    - Commit message: `test(case-files): assert no scroll, no overlap and computed styles at three viewports`
    - _Requirements: 13.7, 14.7, 14.8, 14.9, 21.3, 21.5_

  - [~] 7.5 Reference screenshots at 1440x900 and 1600x900
    - Files (new): `apps/case-files/e2e/reference.spec.ts` (project `chromium`), `e2e/reference-1600.spec.ts` (project `chromium-1600`), six PNGs under `apps/case-files/e2e/__screenshots__/reference.spec.ts/` and `reference-1600.spec.ts/`: start screen, fair-case verdict view (`greenhouse`, widow accused), `candlesticks` rejected under v1. Names: `start-screen.png`, `verdict-fair.png`, `rejected-candlesticks.png` and the same with `-1600` suffix. Each test waits for fonts (`document.fonts.ready`) and for the intro state before `toHaveScreenshot` with `animations: "disabled"`.
    - Create the PNGs on purpose: `pnpm --filter @bones/case-files exec vite build`, then `pnpm --filter @bones/case-files exec playwright test reference.spec.ts reference-1600.spec.ts --update-snapshots` (with `CASE_FILES_E2E=1` as in the config). Look at the six images before committing. Then run `pnpm e2e:case-files` without the update flag: all pass. Only these six PNGs are new; no PNG of the expense app changes (`git status` shows nothing under `apps/expense-auditor`).
    - Commit message: `test(case-files): add six reference screenshots (start, fair verdict, rejected) at 1440 and 1600`
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e`, `pnpm e2e:case-files`, core/expense diff empty, `git status` clean.
    - _Requirements: 21.4, 21.6_

- [ ] 8. Guards
  - [~] 8.1 Cross-app and workspace-import guards
    - Files (new): `apps/case-files/tests/guards/no-expense-auditor.node.test.ts`, `tests/guards/workspace-imports.node.test.ts`.
    - `no-expense-auditor`: scans `src`, `api`, `shared`, `tests`, `e2e` for imports, paths and CSS `@import` that name the expense app; the forbidden name is built from two parts so the file does not match itself; positive and negative self-tests (requirement 20.1). Other direction: confirm that `apps/expense-auditor/tests/guards/no-case-files.node.test.ts` exists and is green and unchanged (the task does not edit it; the check is that `pnpm -r test` runs it and `git diff <START> -- apps/expense-auditor` is empty). `workspace-imports`: in `src` only `@bones/core`, `@bones/xray-ui`, `react`, `react-dom`, `zod` and relative files, no Node built-in, and `shared/` and `api/_lib/` never import `src/` (requirement 20.2; `api` and `shared` may not exist yet, the guard then passes on the empty set and the self-tests cover it).
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e:case-files`, core/expense diff empty, `git status` clean.
    - Commit message: `test(case-files): guard against cross-app imports and stray workspace imports`
    - _Requirements: 1.4, 1.5, 20.1, 20.2_

  - [~] 8.2 No API key in the client, canary build
    - Files (new): `apps/case-files/tests/guards/no-secrets.node.test.ts`, `tests/helpers/build.ts`.
    - Source scan of `src` for key names, `sk-` tokens, `api key`, `x-api-key`, `VITE_` names with KEY or SECRET. `build.ts` (copied in algorithm from the expense app, new random-looking canary strings): production build into a temp directory with canary values in `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `EXTRACTION_MODEL` and without `CASE_FILES_E2E`; scan every output file for the canary values, provider hosts, `Bearer`, `x-api-key`, `anthropic-version`, `sourceMappingURL` and `.map` files. The test builds once (`beforeAll`, with a generous timeout). Positive and negative self-tests of the scanner.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e:case-files`, core/expense diff empty, `git status` clean (the temp directory is outside the repo).
    - Commit message: `test(case-files): guard against keys in the client with a canary build scan`
    - _Requirements: 8.3, 18.6, 20.3_

  - [~] 8.3 No LLM in chat
    - Files (new): `apps/case-files/tests/guards/no-llm-in-chat.node.test.ts`, `tests/guards/no-llm-in-chat.runtime.test.tsx`.
    - Static: `src/ui` and `src/state` import no LLM client (`anthropic`, `openai`, `@anthropic-ai`), call no network function (`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`) in code that produces chat text. Runtime: render the case screen with a `fetch` spy and let the chat type through a fixture Trace (fake timers); the spy records 0 calls. Self-tests for the scanner.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e:case-files`, core/expense diff empty, `git status` clean.
    - Commit message: `test(case-files): guard that Dr. Bones text never comes from an LLM`
    - _Requirements: 15.4, 15.6, 20.4_

  - [~] 8.4 `app.css` layout-only and no-raster guards
    - Files (new): `apps/case-files/tests/guards/no-visual-in-app.node.test.ts`, `tests/guards/no-raster.node.test.ts`.
    - `no-visual-in-app` (copy of the expense guard, requirement 14.10): in `src/styles/app.css` only layout declarations; colour, border, background, shadow and font declarations only in the `body` rule; no `url(`, `@import`, `@keyframes`, `transition`, `animation`, `style=` on shell-like elements, no image import in `src`; plus no `@keyframes` or animation anywhere in `apps/case-files` (requirement 16.9). `no-raster`: no `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.avif` file in `apps/case-files` outside `e2e/__screenshots__` and `node_modules`/`dist` (requirement 16.4). Self-tests for both.
    - Fix any real violation found in `app.css` in this commit (move it to xray-ui in a separate earlier commit if it needs a component change).
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e:case-files`, core/expense diff empty, `git status` clean.
    - Commit message: `test(case-files): guard app.css to layout only and forbid raster files`
    - _Requirements: 14.10, 16.2, 16.4, 16.9, 20.5_

  - [~] 8.5 Contrast guard
    - Files (new): `apps/case-files/tests/guards/contrast.node.test.ts`.
    - Copy the token-resolution and ratio check of `apps/expense-auditor/tests/guards/contrast.node.test.ts`, pointed at the Xray_UI token values and this app's pairs. List every text and background pair that the app adds (for example the banner text on its background, the live note text, the version note, disabled button text) with at least 4.5:1, and the focus ring pairs with at least 3:1. If the app adds no new pair beyond the xray-ui ones, the list says so in a comment and still checks the pairs of the elements the app places (plates, banner, notes). Self-test: a failing pair is detected.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e:case-files`, core/expense diff empty, `git status` clean.
    - Commit message: `test(case-files): add contrast guard for app text pairs`
    - _Requirements: 16.5, 16.7, 20.5_

- [ ]* 9. Live mode (optional; first item of the scope cut order)
  - [ ]* 9.1 Wire schema, system prompt and rate limit
    - Files (new): `apps/case-files/shared/iso.ts`, `shared/wire.ts`, `api/_lib/schema.ts`, `api/_lib/rateLimit.ts`, `tests/api/rateLimit.node.test.ts`, `tests/api/schema.node.test.ts`.
    - `wire.ts`: request `{theme}` with the closed list `manor`, `train`, `university`, `lighthouse`, strict; the success envelope (`ExtractionResult` shape with the case fields), the error body `{error: {reason, code, message}}` and the codes `disabled`, `forbidden_origin`, `method_not_allowed`, `bad_request`, `too_large`, `rate_limited`, `upstream_failed`, `model_output_invalid`. `schema.ts`: fixed `SYSTEM_PROMPT` with the closed vocabulary, limits, and the instruction never to name a culprit, verdict or solution; `MODEL_JSON_SCHEMA` mirroring the Case_Schema with `additionalProperties: false`; only the theme from the closed list reaches the prompt. `rateLimit.ts` copied from the expense app (10 requests per 10 minutes). `shared/` and `api/_lib/` never import `src/`.
    - Tests with fakes: the prompt contains no text other than the fixed prompt and the theme; every theme maps to a fixed sentence; rate limit window and `retry-after`; the wire schemas reject unknown keys.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add live wire schema, fixed prompt and rate limit`
    - _Requirements: 17.1, 17.5, 17.7, 17.9, 23.7_

  - [ ]* 9.2 LLM providers
    - Files (new): `apps/case-files/api/_lib/provider.ts`, `api/_lib/openrouter.ts`, `tests/api/provider.node.test.ts`.
    - Copy with `readReceipt` renamed to `writeCase({theme})`: Anthropic provider with a text-only content block, OpenRouter provider; 25-second timeout with `AbortController`; every failure collapses to `{ok:false, kind:"upstream"}`; the key goes only in a server request header; no provider error text is returned. Tests with a fake `fetch`: request shape, header holds the key, timeout, upstream error text never returned.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add anthropic and openrouter providers for live cases`
    - _Requirements: 17.3, 17.5, 17.8, 17.11_

  - [ ]* 9.3 Handler, `api/case.ts`, `vercel.json` and live properties
    - Files (new): `apps/case-files/api/_lib/handler.ts`, `api/case.ts`, `vercel.json`, `tests/api/handler.node.test.ts`, `tests/properties/key-never-leaks.node.test.ts`, `tests/properties/kill-switch.node.test.ts`. Edit: `.env.example` (`LIVE_EXTRACTION=off`, `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=`, `OPENROUTER_API_KEY=`, `EXTRACTION_MODEL=`, all keys empty, no `VITE_` prefix).
    - `createCaseHandler` in the pattern of the expense handler. `GET` answers `{live}`, true only when `LIVE_EXTRACTION === "on"`, the key of the chosen provider is non-empty and `EXTRACTION_MODEL` is non-empty. Check order: method, live flag, origin, rate limit, body size (1,024 characters, 413), JSON parse, strict body `{theme}`, provider call, strict validation of the model output with the Case_Schema, the 32,768-byte cap and the confidence rule (502 `model_output_invalid` with a fixed message). `LLM_PROVIDER` other than `anthropic` or `openrouter` gives 403 `disabled`. `vercel.json` has `functions: {"api/case.ts": {"maxDuration": 30}}` and the security headers of the expense app.
    - **Property 17: Key never leaks**
      - *For any* provider outcome (success, bad JSON, upstream error with the key in its text, timeout) and any provider choice, the key value appears in no response body, response header or log line.
      - **Validates: Requirements 17.11**
    - **Property 18: Kill switch**
      - *For any* combination of `LIVE_EXTRACTION`, key and model values, live is on only when the flag is exactly `on` and the key and model are non-empty; otherwise `GET` says `{live:false}` and `POST` answers 403 `disabled` without a provider call.
      - **Validates: Requirements 17.2, 17.11**
    - Handler tests: every error code with its status; order of checks (a bad method does not reach the rate limiter); the 11th request in a window gives 429 with `retry-after`; no real network (fake provider).
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean. No `.env.local` is read or created; tests pass env objects directly.
    - Commit message: `feat(case-files): add live case function with kill switch and key-never-leaks properties`
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.8, 17.9, 17.10, 17.11_

  - [ ]* 9.4 Dev-only API middleware
    - Files: `apps/case-files/vite.config.ts`, `dev/toWebRequest.ts` (new, copied), `tests/unit/devApi.node.test.ts`.
    - `devCaseApi(mode)` (serve only): loads env into the server process only, `server.ssrLoadModule("./api/case.ts")`, pipes the Web `Response` into the Node response. Not part of the production build. Test: the plugin is registered only for `command === "serve"`; the production bundle (canary build of task 8.2) stays free of the handler.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add dev-only middleware for the live case function`
    - _Requirements: 17.10_

  - [ ]* 9.5 HttpCaseAdapter and live status
    - Files (new): `apps/case-files/src/extraction/HttpCaseAdapter.ts`, `src/extraction/liveStatus.ts`, `tests/unit/httpAdapter.node.test.ts`, `tests/unit/liveStatus.node.test.ts`.
    - `HttpCaseAdapter` sends `POST /api/case` with `{theme}` only (no key, no secret header, no model name), validates the answer with `shared/wire.ts`, returns `extraction_failed` with `reason` `network`, `bad_response`, `upstream` or `disabled`. `fetchLiveStatus` asks `GET /api/case` once with one retry after a failure (timeout 8 s as in the expense app). Tests with a fake `fetch`: request body and headers, every reason mapping, retry once.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): add http case adapter and live status check`
    - _Requirements: 8.2, 8.3, 18.1_

  - [ ]* 9.6 Client wiring and rejection view
    - Files: `apps/case-files/src/state/sessionStore.ts` (`loadLiveCase(theme)`), `src/App.tsx`, `src/ui/StartScreen.tsx`, `src/ui/RejectionView.tsx` (new), `tests/components/StartScreen.test.tsx`, `tests/components/RejectionView.test.tsx` (new).
    - The start screen asks the live status once and enables the "Write a new case" card only on `{live: true}`. Pressing the button shows a `role="status"` progress state and runs the pipeline with `HttpCaseAdapter` and v1. A CoreError or a schema failure shows the rejection view with the stamp text "CASE REJECTED", the error kind and at most 8 field errors (path and issue), and creates no Trace. A valid but unfair case shows the normal case screen with the rejected Trace. While a Recorded_Case is used no request goes to `/api/case` except the one status `GET`. Domain files stay LLM-free (`no-llm-in-chat` guard stays green).
    - Component tests with a fake store and fake `fetch`: card disabled with the live note when off; enabled when on; progress state; rejection view lists at most 8 errors; unfair live case opens the case screen; no key or model in any request.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e:case-files` (live off: references unchanged), core/expense diff empty, `git status` clean.
    - Commit message: `feat(case-files): wire live mode into the start screen with rejection view`
    - _Requirements: 8.2, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [ ] 10. README
  - [~] 10.1 App README
    - Files (new): `apps/case-files/README.md`, `apps/case-files/tests/unit/readme.node.test.ts`.
    - Sections: what it is, why the LLM never decides, the five Bones parts in this app, how to play, how to run (port 5201, `pnpm dev:case-files`), the scripts table, tests, rule versions and the verdict matrix of the three cases (from `tests/fixtures/expected-matrix.ts`), live mode (if group 9 was built: how to enable it with the env names and the kill switch; if it was skipped: one line "Live mode is not built in this version"), security notes (no key in the client, closed theme list, canary build guard), known limitations (the Open questions Q1 to Q7, listed in one short list or linked to `requirements.md`). Every command named in the README is described.
    - `readme.node.test.ts`: every `pnpm …` script named in the README exists in `apps/case-files/package.json` or the root `package.json`; the README names ports 5201 and 5202 and Q1 to Q7.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `docs(case-files): add app README with matrix, scripts and limitations`
    - Honest sentence (requirement 24.1): the README states in one sentence that the three recorded cases are hand-written fixtures in the model output format, not real LLM output. `readme.node.test.ts` also asserts that this sentence is present.
    - _Requirements: 22.1, 22.3, 22.4, 24.1_

  - [~] 10.2 Root README entry
    - Files: `README.md` (root).
    - Add a short "Apps" section (or an entry in an existing one) for Case Files with the run command `pnpm dev:case-files`. Change no other statement. Show the diff with `git diff README.md` and confirm only added lines.
    - Checklist: `pnpm -r typecheck`, `pnpm -r test`, core/expense diff empty, `git status` clean.
    - Commit message: `docs: add Case Files to the root README apps list`
    - _Requirements: 22.2_

- [ ] 11. Final checkpoint
  - [~] 11.1 Checkpoint: final checkpoint done (HARD STOP)
    - Run from the repo root: `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e` (expense, no skips, no update flag) and `pnpm e2e:case-files` (both projects, no update flag).
    - Core and expense guard: `git diff --exit-code <START> -- packages/core apps/expense-auditor` prints nothing. Also run `git diff --stat <START> -- packages/core` and confirm it is empty (no change under `packages/core`; `<START>` is the parent of the first case-files commit). `git diff --stat <START>` on test files shows only tests named in this plan.
    - Confirm the xray-ui changes are additive: `git diff <START> -- packages/xray-ui/src/assets` is empty; `git diff <START> --stat -- apps/expense-auditor/e2e/__screenshots__` is empty.
    - Review images: take the final case screen (`greenhouse`, X-RAY on, a suspect selected) at 1600x900 and build `review/final-side-by-side.png` = `design/mockups/bones-6-casefiles-b.png` | final case screen, and `review/final-side-by-side-retro.png` = `design/mockups/bones-7-retro-b.png` | final case screen | expense Signature reference (same method as task 6.7).
    - Commit the review PNGs: `docs(case-files): add final review images`. `git status` is clean after the commit.
    - Report: totals of tests and e2e specs, the nine-cell matrix result, which optional tasks were built or skipped, and known limitations.
    - Ensure all tests pass, ask the user if questions arise.
    - **HARD STOP:** After finishing this task, STOP and reply with exactly "final checkpoint done". Do not start any further task until the user says "weiter". After "weiter", record the final verdict with the commit `docs(case-files): record final verdict`; `git status` is clean again afterwards.
    - _Requirements: 20.9, 21.7, 23.4, 23.5, 23.6_

## Notes

- Only group 9 (live mode, tasks 9.1 to 9.6, all marked `*`) is optional. Every other task, including all tests and property tests, is required.
- One commit per leaf task with the message given in the task. A task is done only when its checklist is green: `pnpm -r typecheck`, `pnpm -r test`, the core and expense diff check, `git status` clean, and the e2e runs that apply.
- Hard stops: 3.4 ("checkpoint solver done"), 6.7 ("checkpoint ui done") and 11.1 ("final checkpoint done"). After the reply, wait for "weiter". The verdict is recorded in this file under "Review verdicts" in its own commit `docs(case-files): record <checkpoint> verdict`.
- Review images live in `.kiro/specs/case-files/review/` and are tracked in git.
- No task reads or writes `.env.local`, calls a real LLM API, deploys or pushes.
- Existing tests are edited only where a task says so, in the same commit as the code that forces the change (tasks 4.3 for the matrix test, 5.1 for the domain-isolation words).
- If a property test fails, fix the implementation, not the property. Keep found bugs in `.kiro/specs/case-files/bugs-found.md` in the format `Property N | Counterexample | Root cause | Fix`.
- Design risks to watch: the rule expressiveness ceiling (D4, D6), the Solver's reliance on the rule id naming convention (guarded by `rules-purity`), 4 suspects of 5 statements at 1280x720 (task 7.4), screenshot flakes (the `maxDiffPixelRatio` of 0.001 may be raised to 0.002 with a comment).

### Start commit

- `<START>`: `c282a3a02e26df8803dac26fcff12fc8a2f8e536` (HEAD before task 1.1, `docs(case-files): label recorded cases honestly`).

### Review verdicts

- Checkpoint solver done: accepted, no changes.
- Checkpoint ui done: _pending_
- Final checkpoint: _pending_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["2.2"] },
    { "id": 5, "tasks": ["2.3"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["3.2"] },
    { "id": 8, "tasks": ["3.3"] },
    { "id": 9, "tasks": ["3.4"] },
    { "id": 10, "tasks": ["4.1"] },
    { "id": 11, "tasks": ["4.2"] },
    { "id": 12, "tasks": ["4.3"] },
    { "id": 13, "tasks": ["4.4"] },
    { "id": 14, "tasks": ["4.5"] },
    { "id": 15, "tasks": ["4.6"] },
    { "id": 16, "tasks": ["4.7"] },
    { "id": 17, "tasks": ["5.1"] },
    { "id": 18, "tasks": ["5.2"] },
    { "id": 19, "tasks": ["5.3"] },
    { "id": 20, "tasks": ["6.1"] },
    { "id": 21, "tasks": ["6.2"] },
    { "id": 22, "tasks": ["6.3"] },
    { "id": 23, "tasks": ["6.4"] },
    { "id": 24, "tasks": ["6.5"] },
    { "id": 25, "tasks": ["6.6"] },
    { "id": 26, "tasks": ["6.7"] },
    { "id": 27, "tasks": ["7.1"] },
    { "id": 28, "tasks": ["7.2"] },
    { "id": 29, "tasks": ["7.3"] },
    { "id": 30, "tasks": ["7.4"] },
    { "id": 31, "tasks": ["7.5"] },
    { "id": 32, "tasks": ["8.1"] },
    { "id": 33, "tasks": ["8.2"] },
    { "id": 34, "tasks": ["8.3"] },
    { "id": 35, "tasks": ["8.4"] },
    { "id": 36, "tasks": ["8.5"] },
    { "id": 37, "tasks": ["9.1"] },
    { "id": 38, "tasks": ["9.2"] },
    { "id": 39, "tasks": ["9.3"] },
    { "id": 40, "tasks": ["9.4"] },
    { "id": 41, "tasks": ["9.5"] },
    { "id": 42, "tasks": ["9.6"] },
    { "id": 43, "tasks": ["10.1"] },
    { "id": 44, "tasks": ["10.2"] },
    { "id": 45, "tasks": ["11.1"] }
  ]
}
```
