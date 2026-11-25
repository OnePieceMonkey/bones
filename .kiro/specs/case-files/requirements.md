# Requirements Document

## Introduction

Case Files is App 2 on the Bones skeleton (`.kiro/steering/product.md`): a ghost detective game in `apps/case-files`. An LLM writes a case. A deterministic solver proves that exactly one suspect can be convicted. A case where the solver finds zero or two or more convictable suspects is rejected as unfair. The LLM never decides: it only proposes a case as structured JSON, and versioned declarative rules decide everything else. Each suspect is drawn as a skeleton, each statement is a bone, and a statement that the clues contradict is a fractured bone.

Current state (checked before writing):

- `apps/case-files/` does not exist. There is no stub. `rules/` contains only `expense-auditor/` (`rules/*.json` and `rule-sets/*.json`).
- `packages/core` exports the extraction port, `validate`, `evaluate`, `createTrace`, `replay`, `override`, `effectiveResult`, `parseRule`, `parseRuleSet`, `renderTemplate` and the condition AST (four node kinds: comparison, sum, date_in_range, membership). Core holds no domain logic. Its domain-isolation test forbids the words expense, receipt, alcohol, meal, trip and suspect in `packages/core/src`.
- `packages/xray-ui` renders exactly one skeleton per Trace (`Shell`, `Stage`, `SkeletonPhoto`, `Hotspot`, `EcgBand`, `GlassCard`, `DoctorPanel`, `ControlPanel`, `ResultFooter`). A view with several skeletons does not exist, so a generic component is added. Its domain-isolation test forbids the same words, including suspect.
- `apps/expense-auditor` is the reference for pipeline, replay store, override, export, recorded adapter, live function (`api/extract.ts`, `api/_lib/*`), guards and Playwright setup. It already contains the guard `tests/guards/no-case-files.node.test.ts`, which forbids the expense app from referencing this app.
- The concept image `design/mockups/bones-6-casefiles-b.png` shows three skeletons side by side, a cracked glass case folder at the top centre, Dr. Bones at the top right, and two pill buttons (Accuse, Replay proof) at the bottom. It is reference only.

Hard boundaries:

- `packages/core` does not change. Anything that would need a core change is listed under "Open questions" and is not planned as a task.
- `apps/case-files` and `apps/expense-auditor` never import from each other.
- No new raster image, no new font file, no API key in the client, sound off.
- The whole app is finished by 28.11.2026. Nothing beyond this scope is built.

## Decisions

Doubts were resolved while writing this document. Each decision is binding for design and tasks.

1. **D1 Game or audit.** The app is a game. The player reads the case, picks one suspect and accuses. The verdict (correct or incorrect) is computed by rules from the Trace, never by the LLM. Before play, the case itself is audited by the solver, and an unfair case is rejected and cannot be played.
2. **D2 The LLM never names a culprit.** The Case_Schema has no field for a culprit, a verdict, a solution or a score, and rejects unknown keys. The culprit exists only as the output of the Solver.
3. **D3 Closed vocabulary.** Times are integer minutes since midnight (0 to 1439). Statements have exactly three kinds (`location`, `possession`, `sighting`). Clues have exactly three kinds (`presence`, `holding`, `motive`), each with a reliability `firm` or `weak`. The crime has one place, one time window and one weapon item. No other relation exists, so every rule is a plain comparison.
4. **D4 Rules cannot combine conditions.** The AST has no AND or OR and no loop over a collection. Two things follow: (a) the Fact_Deriver joins statements and clues and writes counts into the validated fields (it joins and counts, it never compares against a threshold or decides); (b) the Rule_Binder instantiates one Rule per target (per suspect or per statement) from a Rule_Template. Thresholds and policy live only in the rule files.
5. **D5 All case rules use effect `deducting`.** A `blocking` rule stops `evaluate` at the first fired rule, so later statements would never be checked and their bones would not show. `deducting` rules are all evaluated. Each rule fires when something is established against the subject (a contradicted statement, an established motive, means or opportunity) and deducts 1 point from a scope. The unit is a dimensionless point, never shown as money. A fired rule is a fractured bone ("evidence against this suspect"). A rule that is not part of the Rule_Set gives a not-applicable bone.
6. **D6 Convictable.** A suspect is convictable under a Rule_Set when every `proof-*` rule that the Rule_Set binds to that suspect fired AND at least one `statement-*-contradicted` rule bound to that suspect fired. The solver therefore needs no rule names beyond the two prefixes, and the Rule_Set decides which elements (motive, means, opportunity) are required.
7. **D7 Versions.** v1 uses means, opportunity and location lies on any clue. v2 adds motive and possession lies. v3 ignores weak clues everywhere and adds sighting lies. The three recorded cases are chosen so that the verdict differs between versions (see Requirement 7).
8. **D8 Original Trace uses v1.** As in the expense app, v1 is the original Trace of a session, and the other versions are replays. The default view is v1.
9. **D9 Trace mapping.** `Trace.result` is `approved` for an accepted case and `rejected` for an unfair case. `partially_approved` is never produced, and the override dialog offers only the two used values. `amountCents` carries the number of convictable suspects (a count, not money). The app formats it through `Anatomy.formatValue`, so the result line reads like "APPROVED 1 convictable" and the progress bar share is convictable suspects divided by suspects.
10. **D10 App-level replay.** Core `replay` derives the result from `evaluate` alone, and the case result needs the solver. The app therefore replays by calling core `evaluate` and `createTrace` itself on the stored `validatedFields`, keeping `inputHash`, `rawModelOutput`, `proposedFields`, `confidence` and `sources` of the original. This is recorded as Open question Q2. The app does not change core.
11. **D11 Accusation is a record, not a second Trace.** Accusing writes an Accusation_Record `{decisionId, ruleSetVersion, suspectId, verdict, proofRuleIds, createdAt}` linked to the Trace by `decisionId`. The Trace is never edited. The record is part of the session log and of the exported file.
12. **D12 Override.** A human may overrule the case result (`approved` or `rejected`) with core `override`. The override is stored beside the Trace. An overruled-to-approved case becomes playable, and an accusation is then `correct` when the accused suspect is in the Solver's convictable list (zero or several convictable suspects are possible after an override).
13. **D13 Confidence meaning.** AI READ CONFIDENCE shows how sure the model was when it read its own case: the mean of the confidence values the model reported for the case fields, statements and clues. Confidence is display only. No rule reads it and no verdict depends on it. Evidence keys of case rules are derived paths and never equal a confidence key, so the xray-ui gauge uses its mean fallback.
14. **D14 Glass card.** The glass card is the case folder: title, setting, victim and crime line, with the model's confidence per field. WHEN the effective result is `rejected`, the card cracks and the stamp "OVERRULED BY RULE" appears with the rule set version. This needs additive props in xray-ui (D19). Accepted cases show no stamp.
15. **D15 X-RAY switch.** The case screen starts with X-RAY off: suspect name plates, statements and clues are readable, and skeletons are hidden. The player may switch X-RAY on at any time (peeking is allowed, the game has no score). Pressing Accuse switches X-RAY on and shows the verdict.
16. **D16 Three views, one screen shell.** "Start", "Case" and "Verdict" are three states of one page with no router. Verdict is the case layout with X-RAY on, the accused suspect highlighted, and a result banner.
17. **D17 Ports.** Dev server 5201 (`strictPort`). Playwright preview server 5202 (`strictPort`). The expense app keeps 5173 and 4173.
18. **D18 Bones per suspect.** At most 8 bones per suspect, one per xray-ui region: 5 statement slots (regions `ribs`, `spine`, `arm-left`, `pelvis`, `leg-left`) and 3 proof bones (`skull` = motive, `arm-right` = means, `leg-right` = opportunity). Statement bone N maps to the Nth statement of that suspect.
19. **D19 xray-ui additions are additive and optional.** Allowed additions, all domain-free and default-neutral: the `SkeletonEnsemble` component; an optional `stage` slot on `Shell`; an optional `speedMs` pass-through to `DoctorPanel`; optional `extraMessages` on `DoctorPanel`; optional `overruled` and `stampDetail` on `GlassCard`. Default rendering stays pixel-identical, and the expense-auditor tests and references stay green and unchanged. Words `suspect`, `clue`, `culprit` never appear in `packages/xray-ui/src`.
20. **D20 Duplication over sharing.** Apps never import each other. Server helpers (rate limit, provider clients, origin check) and the override dialog are copied into `apps/case-files`, not shared. Sharing would need a new package, which is out of scope.
21. **D21 Sources are empty.** The case text has no photo or page, so `sources` is `{}`. The document panel shows the case file as text lines without field marks.
22. **D22 Input hash.** `inputHash` is the SHA-256 hex of the UTF-8 bytes of `rawModelOutput`. `decisionId` comes from the id port (UUID). Same input and same rule set version give the same `validatedFields` and `ruleOutcomes`, and `decisionId`, `createdAt` differ by design.
23. **D23 Live mode input.** The live function accepts only `{theme}` from a closed list of 4 themes. No free text reaches the prompt, so there is no prompt-injection surface from the client.
24. **D24 Rejected before a Trace.** A model output that is not valid JSON or fails the Case_Schema has no validated fields, so it produces a CoreError and no Trace. The app shows it as "CASE REJECTED" with the reasons. An output that validates but is unfair produces a normal Trace with result `rejected`.
25. **D25 Chat speed.** Dr. Bones types at a speed such that the sum of message lengths times the per-character delay is at most 8000 ms for the largest case, with a per-character delay between 4 ms and 24 ms. Reduced motion shows all text at once.
26. **D26 Design adjustments applied.** The "Requirement adjustments" table of `design.md` was applied to this document. CF-A1 amended Requirement 9.2 (the pipeline reads only `ruleOutcomes` from core `evaluate`; `result` and `amountCents` come from the Solver). CF-A3 amended Requirement 10.1 (the Replay does not call core `replay`). Requirement 4.6 needed no wording change: its AmountScope counts already cover the whole bound Rule_Set (CF-A2, note only; the Solver ignores `claimedCents` and the `amountCents` of `evaluate`). CF-A4 is a note only: Requirements 4.10 and 20.6 keep the unused `date_in_range` node out of reach.

## Open questions

These need a decision by the owner. Each has a workaround inside the app, so none is planned as a task.

- **Q1 Evaluate-all effect.** `evaluate` has no effect that fires without touching an amount. Case rules use `deducting` on dimensionless scopes (D5). A core effect such as `flagging` (evaluated, no amounts, no early stop) would remove the scope workaround.
- **Q2 Result from outside the rules.** `replay` cannot take a function that turns outcomes into a result, so the app replays itself (D10). A `resultMapper` option on `evaluate` and `replay` would let the app use core `replay` unchanged.
- **Q3 Result vocabulary.** `DecisionResult` (`approved`, `partially_approved`, `rejected`) and the field `amountCents` are money-flavoured. Case Files maps accepted to `approved`, unfair to `rejected` and stores a count in `amountCents` (D9).
- **Q4 No iteration or boolean operators in the AST.** The Rule_Binder and the Fact_Deriver exist because the AST has no for-each and no AND/OR (D4). A `forEach` or `all`/`any` node in core would remove both.
- **Q5 Evidence keys and confidence.** The xray-ui gauge matches evidence keys to confidence keys. Case rules use derived paths, so the per-fracture minimum never applies (D13). A way to name a confidence key per rule would make the gauge show the confidence of the contradicted statement.
- **Q6 Browser recorded adapter.** Core `RecordedAdapter` is Node-only, so each app needs a browser twin (`RecordedCaseAdapter`). A browser-safe adapter in core would remove the duplicate.
- **Q7 Derived values in `validatedFields`.** The Trace keeps enriched validated fields (case plus joined counts). Core has no place for a separate "derived facts" record, so replay trusts the stored counts, which are version independent by construction (Requirement 3).

## Out of scope

- Any change to `packages/core` or to the behaviour, tests or reference screenshots of `apps/expense-auditor`.
- Accounts, multiplayer, scores, difficulty levels, hints, persistence beyond the browser session, server-side storage.
- Free-text rules, rule editing in the UI, a fourth rule version, hand-written cases in the UI.
- An LLM that judges, hints, ranks, explains or chats. Sound, canvas effects, new fonts, new raster images.
- A router, deep links, mobile layouts below 1280x720, localisation (English only).
- Photos or PDFs as input (the input is text generated by the model).

## Glossary

- **Case_Files_App**: The application in `apps/case-files` (package `@bones/case-files`).
- **Core**: The `@bones/core` package in `packages/core`.
- **Xray_UI**: The `@bones/xray-ui` package in `packages/xray-ui`.
- **Case**: One validated case: title, setting, victim, crime, places, items, suspects with statements, and clues.
- **Case_Schema**: The zod schema that a Case must match (Requirement 2).
- **Suspect**: A person in the Case with an id, a name and 1 to 5 statements.
- **Statement**: A claim by a Suspect. Kinds: `location`, `possession`, `sighting`.
- **Clue**: A fact about the world that the rules trust. Kinds: `presence`, `holding`, `motive`. Reliability: `firm` or `weak`.
- **Crime**: The place, the time window in minutes and the weapon item of the crime.
- **Minute**: An integer from 0 to 1439, minutes since midnight. An interval is closed: `[start, end]` with `start <= end`.
- **Overlap**: Two intervals overlap when `a.start <= b.end` and `b.start <= a.end`.
- **Fact_Deriver**: The pure function that joins Statements and Clues and writes integer counts into the validated fields (Requirement 3).
- **Rule_Template**: A rule file in `rules/case-files/rules/` whose paths start with the segment `subject`.
- **Rule_Binder**: The pure function that turns a Rule_Set of templates into a Rule_Set of instances, one per target (Requirement 4).
- **Rule_Set**: A versioned list of rule references. Labels: v1 = `case-files@1.0.0`, v2 = `case-files@2.0.0`, v3 = `case-files@3.0.0`.
- **Bundle**: The parsed catalog and the three Rule_Sets of Case_Files_App, built like `buildBundle` in the expense app.
- **Solver**: The pure function `solve` in Case_Files_App that returns the convictable Suspects with proof (Requirement 5).
- **Convictable**: The state of a Suspect defined in Decision D6.
- **Case_Verdict**: One of `accepted`, `unfair_none`, `unfair_many`.
- **Proof**: The Rule outcomes (`RuleOutcome`) of one Suspect that the Solver used.
- **Trace**: The core `Trace` of one Case evaluated under one Rule_Set.
- **Original_Trace**: The Trace made with v1 when a case is loaded.
- **Replay**: A new Trace made from the stored `validatedFields` of the Original_Trace under another Rule_Set, without extraction.
- **Override**: A core `Override` that overrules the Case result.
- **Accusation_Record**: The record of Decision D11.
- **Recorded_Case**: A hand-written fixture in the model output format, stored in `apps/case-files/recorded/`. It is not real LLM output (Requirement 24).
- **Live_Function**: The serverless function `api/case.ts` that asks the LLM for a case.
- **Live_Mode**: The mode in which the start screen can call the Live_Function.
- **Anatomy_Builder**: The pure function that builds an Xray_UI `Anatomy` for a Case (combined) and per Suspect.
- **Skeleton_Ensemble**: The new Xray_UI component that shows several skeletons side by side (Requirement 13).
- **Member**: One entry of the Skeleton_Ensemble (one Suspect in this app).
- **Dr_Bones**: The chat panel (`DoctorPanel`).
- **Glass_Card**: The case folder card (`GlassCard`).
- **Control_Panel**: The steel panel with the RULE VERSION knob, the AI READ CONFIDENCE meter and the X-RAY switch (`ControlPanel`).
- **Result_Banner**: The line that states the verdict of the accusation.
- **Viewports**: 1600x900, 1440x900 and 1280x720.
- **Asset_Dir**: `packages/xray-ui/src/assets/`.
- **Time_Box**: The deadline 28.11.2026.
- **Review_Checkpoint**: A task end at which the user reviews evidence before work continues.

## Requirements

### Requirement 1: Workspace, structure and boundaries

**User Story:** As a maintainer, I want App 2 in its own folder with its own rules, so that the two apps share the skeleton and nothing else.

#### Acceptance Criteria

1. THE Case_Files_App SHALL live in `apps/case-files` with the package name `@bones/case-files`, and the workspace file `pnpm-workspace.yaml` SHALL need no change because it already lists `apps/*`.
2. THE Case_Files_App SHALL keep versioned rule files in `rules/case-files/rules/*.json` and `rules/case-files/rule-sets/*.json`, with the same JSON format that `parseRule` and `parseRuleSet` accept for `rules/expense-auditor`.
3. THE Case_Files_App SHALL load the rule files with `import.meta.glob` and build the Bundle with `parseRule`, `parseRuleSet` and a `buildBundle` function that follows `apps/expense-auditor/src/rules/catalog.ts` (catalog key `${id}@${version}`, a `rule_not_found` CoreError for a missing reference).
4. THE Case_Files_App SHALL import only `@bones/core`, `@bones/xray-ui`, `react`, `react-dom`, `zod` and its own files in `src`, and SHALL import no Node built-in module in `src`.
5. THE Case_Files_App SHALL contain no import, path or CSS `@import` that names `expense-auditor`, and the expense app SHALL keep the existing guard that names `case-files`.
6. THE dev server of the Case_Files_App SHALL listen on `127.0.0.1:5201` with `strictPort: true`, and the Playwright preview server SHALL listen on `127.0.0.1:5202` with `strictPort: true`.
7. THE root `package.json` SHALL gain the scripts `dev:case-files` (runs the app dev server) and `e2e:case-files` (runs the app e2e), SHALL keep the existing scripts, and `pnpm -r typecheck` and `pnpm -r test` SHALL include the new app.
8. THE Case_Files_App SHALL provide the scripts `dev`, `build`, `build:check`, `preview`, `test`, `typecheck` and `test:e2e` with the same meaning as in the expense app.
9. THE Case_Files_App SHALL keep domain logic (schema, deriver, binder, solver, messages, anatomy) in `apps/case-files/src` and SHALL add no domain word (suspect, clue, culprit, statement kind names) to `packages/core/src` or `packages/xray-ui/src`.
10. THE change set of the whole feature SHALL contain no modified file under `packages/core` and no modified file under `apps/expense-auditor`.

### Requirement 2: Case schema

**User Story:** As a developer, I want the model output to match a strict typed schema, so that a malformed case is rejected before any rule runs.

#### Acceptance Criteria

1. THE Case_Schema SHALL be a zod schema in `apps/case-files/src/pipeline/schema.ts` whose objects are all `.strict()`, so that an unknown key fails validation.
2. THE Case_Schema SHALL require `title` (1 to 60 characters), `setting` (1 to 240 characters), `victim` (`{name}` with 1 to 40 characters), `crime` (`{placeId, startMin, endMin, weaponItemId}`), `places` (2 to 6 entries `{id, name}`), `items` (1 to 6 entries `{id, name}`), `suspects` (2 to 4 entries) and `clues` (1 to 16 entries).
3. THE Case_Schema SHALL require each Suspect to have `id`, `name` (1 to 40 characters) and `statements` with 1 to 5 entries.
4. THE Case_Schema SHALL define a Statement as a discriminated union on `kind`: `location` with `{placeId, startMin, endMin}`, `possession` with `{itemId, held}` where `held` is a boolean, and `sighting` with `{seenSuspectId, placeId, startMin, endMin}`, and every Statement SHALL carry `id` and `text` (1 to 160 characters).
5. THE Case_Schema SHALL define a Clue as a discriminated union on `kind`: `presence` with `{suspectId, placeId, startMin, endMin}`, `holding` with `{suspectId, itemId}` and `motive` with `{suspectId}`, and every Clue SHALL carry `id`, `text` (1 to 120 characters) and `reliability` (`firm` or `weak`).
6. THE Case_Schema SHALL require every id to match `^[a-z][a-z0-9-]{0,31}$`, and SHALL require ids to be unique within places, items, suspects, statements (across all suspects) and clues.
7. THE Case_Schema SHALL require every Minute to be an integer from 0 to 1439 and SHALL require `startMin <= endMin` in the Crime, in every `location` and `sighting` Statement and in every `presence` Clue.
8. IF a `placeId`, `itemId`, `suspectId`, `seenSuspectId` or `weaponItemId` names an id that does not exist, THEN THE Case_Schema SHALL fail with an issue at the path of that field.
9. IF a `sighting` Statement names its own author as `seenSuspectId`, THEN THE Case_Schema SHALL fail with an issue at the path of that field.
10. THE Case_Schema SHALL contain no key whose name matches `/culprit|guilty|verdict|convict|solution|score/i` at any depth, and a test SHALL assert this on the schema shape.
11. THE Case_Schema SHALL require every text field to be non-empty after trimming and free of control characters, and THE Case_Files_App SHALL render every text field as escaped React text and never as HTML.
12. THE model output SHALL be `{case fields..., confidence}` where `confidence` maps field paths to numbers in `[0, 1]`: the keys `title`, `setting`, `victim`, `crime`, `suspects.<i>.statements.<j>` for each Statement and `clues.<k>` for each Clue.
13. IF the raw model output is larger than 32,768 bytes, THEN THE Case_Files_App SHALL return the CoreError `input_too_large` before parsing.
14. WHEN a Case passes the Case_Schema, THE Case_Files_App SHALL accept it through core `validate`, so that `validate` is the only entry gate to the Fact_Deriver and the Solver.
15. FOR ALL valid Cases, serialising to JSON, parsing and validating again SHALL produce an equal Case (round-trip property).

### Requirement 3: Fact derivation

**User Story:** As a rule author, I want clue facts joined to statements in one place, so that rules stay simple comparisons.

#### Acceptance Criteria

1. THE Fact_Deriver SHALL be a pure function from a valid Case to the validated fields, with no clock, no randomness and no I/O, and SHALL keep the order of suspects, statements and clues unchanged.
2. THE Fact_Deriver SHALL add to each Suspect the integer counts `meansAny` and `meansFirm` (`holding` Clues of that Suspect whose `itemId` equals `crime.weaponItemId`), `opportunityAny` and `opportunityFirm` (`presence` Clues of that Suspect with `placeId` equal to `crime.placeId` whose interval overlaps the Crime window), and `motiveAny` and `motiveFirm` (`motive` Clues of that Suspect). `Firm` counts only Clues with reliability `firm`.
3. THE Fact_Deriver SHALL add to each `location` Statement the counts `conflictsAny` and `conflictsFirm`: the `presence` Clues of the author with a `placeId` different from the Statement place and an interval that overlaps the Statement interval.
4. THE Fact_Deriver SHALL add to each `possession` Statement the counts `conflictsAny` and `conflictsFirm`: the `holding` Clues of the author for the same item when `held` is `false`, and 0 when `held` is `true`.
5. THE Fact_Deriver SHALL add to each `sighting` Statement the counts `conflictsAny` and `conflictsFirm`: the `presence` Clues of the seen Suspect with a `placeId` different from the Statement place and an interval that overlaps the Statement interval.
6. THE Fact_Deriver SHALL add to each Statement the string `authorName`, so that message templates can name the author.
7. THE Fact_Deriver SHALL compare no count against a threshold and SHALL not read the model confidence.
8. FOR ALL valid Cases, the counts of the Fact_Deriver SHALL equal the counts of a naive reference implementation written in the test (model-based property).
9. FOR ALL valid Cases, THE Fact_Deriver SHALL return the same output for the same input, and SHALL not depend on the Rule_Set (the Replay relies on this).
10. FOR ALL valid Cases and all permutations of the Clue list, THE Fact_Deriver SHALL return the same counts for each Suspect and Statement id.

### Requirement 4: Rules, versions and binding

**User Story:** As a rule author, I want three versioned rule sets in the same JSON AST as the expense rules, so that the RULE VERSION knob shows different verdicts for the same case.

#### Acceptance Criteria

1. THE Case_Files_App SHALL provide these Rule_Templates in `rules/case-files/rules/`: `proof-means` (1.0.0 and 2.0.0), `proof-opportunity` (1.0.0 and 2.0.0), `proof-motive` (1.0.0 and 2.0.0), `statement-location-contradicted` (1.0.0 and 2.0.0), `statement-possession-contradicted` (1.0.0 and 2.0.0) and `statement-sighting-contradicted` (1.0.0), as 11 files named `<id>.json` for 1.0.0 and `<id>-v2.json` for 2.0.0.
2. THE Rule_Templates SHALL use effect `deducting`, a condition of node kind `comparison` with a `path` on the left starting with the segment `subject` and a `literal` on the right, `deductionAmount` 1, and a `messageTemplate` of at most 240 characters in English with `{{subject.…}}` slots only.
3. THE Rule_Templates of version 1.0.0 SHALL compare the `…Any` counts (`>= 1`), and the Rule_Templates of version 2.0.0 SHALL compare the `…Firm` counts (`>= 1`). The rule `statement-sighting-contradicted` 1.0.0 SHALL compare `conflictsFirm`.
4. THE Case_Files_App SHALL provide three Rule_Sets in `rules/case-files/rule-sets/` with `id` `case-files`: `case-files-v1.json` (version 1.0.0: means 1.0.0, opportunity 1.0.0, location 1.0.0), `case-files-v2.json` (version 2.0.0: means 1.0.0, opportunity 1.0.0, motive 1.0.0, location 1.0.0, possession 1.0.0) and `case-files-v3.json` (version 3.0.0: means 2.0.0, opportunity 2.0.0, motive 2.0.0, location 2.0.0, possession 2.0.0, sighting 1.0.0).
5. THE Rule_Binder SHALL bind each `proof-*` template once per Suspect and each `statement-<kind>-contradicted` template once per Statement of that kind, with the instance id `<templateId>:<targetId>` (at most 128 characters), and SHALL rewrite the leading segment `subject` of every path in the condition to `suspects.<i>` or `suspects.<i>.statements.<j>` and every `{{subject.` slot in the message template in the same way.
6. THE Rule_Binder SHALL set `effectConfig.scope` to `proof` for `proof-*` instances and to `credibility` for `statement-*` instances, and SHALL emit an AmountScope with `claimedCents` equal to the number of instances in that scope, omitting a scope that has no instance.
7. THE Rule_Binder SHALL return the instance Rule_Set with the same `id` and `version` as the template Rule_Set, at most 200 references, and an instance catalog keyed `${instanceId}@${version}`.
8. IF a template path root is not `subject`, or a template id does not match `proof-*` or `statement-(location|possession|sighting)-contradicted`, THEN THE Rule_Binder SHALL return a CoreError of kind `invalid_rule_schema`.
9. THE Case_Files_App SHALL evaluate bound rules with core `evaluate` only, and SHALL contain no other rule evaluator, no `eval`, no `Function` constructor, no I/O, no randomness and no current time in the evaluation path.
10. THE Case_Files_App SHALL use only the node kind `comparison` in its rule files, so that a test can assert that every rule file passes `parseRule` and every referenced rule exists (and no rule file is unreferenced).
11. FOR ALL valid Cases and each Rule_Set label, THE Rule_Binder SHALL produce unique instance ids, and the number of instances SHALL equal the number of matching targets.
12. THE Case_Files_App SHALL keep a table in `rules/case-files/README.md` that lists what each version adds (D7) and the expected verdict of each Recorded_Case under each version.

### Requirement 5: Solver

**User Story:** As a developer, I want a pure solver that proves who can be convicted, so that fairness is a computed fact and not an opinion.

#### Acceptance Criteria

1. THE Solver SHALL be the pure function `solve(case, versionLabel, bundle)` in `apps/case-files/src/solver/`, and SHALL return `{ruleSetVersion, outcomes, suspects, convictable, verdict, reasons}` or a CoreError.
2. THE Solver SHALL derive the validated fields with the Fact_Deriver, bind the Rule_Set of `versionLabel` with the Rule_Binder, run core `evaluate` once, and classify each Suspect from the resulting outcomes.
3. THE Solver SHALL mark a Suspect Convictable when every `proof-*` instance bound to that Suspect has `conditionMet === true` and at least one `statement-*` instance bound to that Suspect has `conditionMet === true` (D6).
4. THE Solver SHALL return for each Suspect `{suspectId, convictable, proof, missing}` where `proof` lists the `RuleOutcome` objects of that Suspect in evaluation order and `missing` lists the instance ids of required `proof-*` rules that did not fire, plus the marker `no-contradicted-statement` when no statement rule fired.
5. THE Solver SHALL return `convictable` as the ids of Convictable Suspects in the order of the suspects in the Case.
6. WHEN `convictable.length` is 1, THE Solver SHALL return the verdict `accepted`.
7. WHEN `convictable.length` is 0, THE Solver SHALL return the verdict `unfair_none`.
8. WHEN `convictable.length` is 2 or more, THE Solver SHALL return the verdict `unfair_many`.
9. THE Solver SHALL return `reasons` as structured items (`{code: "one", suspectId}`, `{code: "none", closestSuspectId, missing}`, `{code: "many", suspectIds}`), and the text of each reason SHALL come from a closed set of English templates in `solverMessages.ts` that take only ids, names and version labels.
10. THE Solver SHALL choose `closestSuspectId` as the Suspect with the fewest entries in `missing`, with ties resolved by the order of suspects in the Case.
11. FOR ALL valid Cases and version labels, calling `solve` twice SHALL return deeply equal results (determinism).
12. FOR ALL valid Cases and version labels, `verdict` SHALL be `accepted` if and only if `convictable.length === 1`, `unfair_none` if and only if `convictable.length === 0`, and `unfair_many` if and only if `convictable.length >= 2` (rejection property).
13. FOR ALL valid Cases, version labels and permutations of suspects, of statements within a suspect, and of clues, the set of Convictable Suspect ids SHALL stay the same (order independence).
14. FOR ALL valid Cases, changing any confidence value SHALL leave `convictable`, `verdict` and `outcomes` unchanged.
15. THE Solver SHALL read no model output text and no confidence, and SHALL import nothing that touches the network or the clock.

### Requirement 6: Fairness verdict and Trace result

**User Story:** As a player, I want unfair cases to be rejected with a visible reason, so that I only play cases with exactly one provable culprit.

#### Acceptance Criteria

1. WHEN the Solver verdict is `accepted`, THE Case_Files_App SHALL set `Trace.result` to `approved` and `Trace.amountCents` to 1.
2. WHEN the Solver verdict is `unfair_none` or `unfair_many`, THE Case_Files_App SHALL set `Trace.result` to `rejected` and `Trace.amountCents` to the number of Convictable Suspects.
3. THE Case_Files_App SHALL recompute the verdict and the convictable list from a stored Trace and its Rule_Set (`verdictOf(trace)`) without extraction, and the recomputed verdict SHALL agree with `Trace.result` for every Trace that the pipeline produces.
4. WHEN the effective result is `rejected`, THE Case_Files_App SHALL show the reason of the Solver as text in Dr_Bones (a template message) and in the Glass_Card, and SHALL show each fired rule as a fractured bone.
5. WHEN the effective result is `rejected`, THE Case_Files_App SHALL disable the Accuse button and SHALL show the reason in an element with `aria-describedby` on that button.
6. WHILE the displayed Trace is rejected for one Rule_Set, THE Case_Files_App SHALL keep the knob usable so that the player can replay the case under another version.

### Requirement 7: Recorded cases

**User Story:** As a viewer without an API key, I want three stored cases (hand-written fixtures in the model output format, see Requirement 24), so that the whole demo works offline.

#### Acceptance Criteria

1. THE Case_Files_App SHALL provide exactly three Recorded_Cases in `apps/case-files/recorded/`: `greenhouse.json`, `candlesticks.json` and `empty-room.json`, each with `{id, title, extraction}` where `extraction` is a core `ExtractionResult` (`proposedFields` = the case, `confidence`, `sources` = `{}`, `rawModelOutput` = the case JSON text).
2. THE Recorded_Case `greenhouse` ("The Midnight Greenhouse", 3 suspects) SHALL be a fair case: one Suspect (the widow) has a firm holding Clue for the weapon, a firm presence Clue in the greenhouse during the Crime window, a firm motive Clue and a location Statement that a firm presence Clue contradicts. A second Suspect has means and a motive but a firm presence Clue elsewhere. A third Suspect has a contradicted `sighting` Statement and no means. Its verdict SHALL be `accepted` with the widow as the only Convictable Suspect under v1, v2 and v3.
3. THE Recorded_Case `candlesticks` ("Two Candlesticks", 3 suspects) SHALL give two Suspects (Ada and Bram) a firm holding Clue, a firm presence Clue at the crime place and a contradicted `location` Statement, and only Ada a motive Clue. Its verdict SHALL be `unfair_many` with `[ada, bram]` under v1, and `accepted` with `[ada]` under v2 and under v3.
4. THE Recorded_Case `empty-room` ("The Empty Room", 3 suspects) SHALL give one Suspect (Dana) a firm presence Clue at the crime place, a firm motive Clue, a weak holding Clue for the weapon, and a `possession` Statement "I never held the weapon" that exactly that weak Clue contradicts, with no contradicted `location` Statement. Its verdict SHALL be `unfair_none` under v1, `accepted` with `[dana]` under v2, and `unfair_none` under v3.
5. THE expected verdict and convictable list of each Recorded_Case and version SHALL be stored once in `tests/fixtures/expected-matrix.ts` and SHALL be asserted by a test that runs the real pipeline for the nine combinations.
6. THE Recorded_Cases SHALL have at most 4 Suspects, at most 5 Statements per Suspect, at least one Statement per kind across the three cases, and at least one confidence value below 0.80 per case.
7. THE `rawModelOutput` of each Recorded_Case SHALL be valid JSON that matches the Case_Schema, and a parity test SHALL assert that `proposedFields` equals the parsed `rawModelOutput`.
8. THE recorded mode SHALL make no network request when the player loads a Recorded_Case, and the browser twin `RecordedCaseAdapter` SHALL return a structured clone of the stored `extraction` (as the expense adapter does).
9. IF a Recorded_Case id is unknown or its stored entry does not match the stored-entry schema, THEN THE `RecordedCaseAdapter` SHALL return the CoreError `fixture_not_found` or `fixture_invalid`.

### Requirement 8: Extraction port

**User Story:** As a developer, I want the LLM behind one interface, so that recorded and live mode use the same pipeline.

#### Acceptance Criteria

1. THE Case_Files_App SHALL expose the case source only through the core `ExtractionPort` (`RecordedCaseAdapter` and `HttpCaseAdapter`), and SHALL contain no LLM call outside `api/`.
2. THE `HttpCaseAdapter` SHALL send `POST /api/case` with `{theme}`, SHALL validate the answer against a wire schema shared with the Live_Function in `shared/wire.ts`, and SHALL return `extraction_failed` with the reason `network`, `bad_response`, `upstream` or `disabled` for each failure kind.
3. THE `HttpCaseAdapter` SHALL send no key, no header with a secret and no model name.
4. WHEN an adapter returns a CoreError, THE pipeline SHALL stop and return that CoreError without evaluating rules.

### Requirement 9: Pipeline and Trace

**User Story:** As an auditor, I want every case decision stored as a Trace, so that I can replay and inspect it.

#### Acceptance Criteria

1. THE pipeline `runCasePipeline` SHALL run in this order: extraction, size guard, `validate` against the Case_Schema, Fact_Deriver, Solver, `createTrace`, and SHALL return the first CoreError without running later steps.
2. THE pipeline SHALL build the Decision for `createTrace` from the Solver output: `result` and `amountCents` as in Requirement 6, `ruleOutcomes` equal to the outcomes of `evaluate` in evaluation order. THE pipeline SHALL read only `ruleOutcomes` from the return value of core `evaluate`, and SHALL discard its `result` and `amountCents` fields (because `evaluate` sums `amountCents` across all `amountScopes`), replacing them with the Solver-derived values of Requirement 6.
3. THE Trace SHALL store `proposedFields` and `confidence` and `sources` of the extraction, `validatedFields` (the Case plus the derived counts), `ruleSetId` `case-files`, `ruleSetVersion`, every rule outcome with `evidence` and `renderedMessage`, `result` and `amountCents`.
4. THE Trace SHALL have `inputHash` equal to the SHA-256 hex of the UTF-8 bytes of `rawModelOutput`, a `decisionId` from the id port, and `createdAt` from the clock port (D22).
5. THE pipeline SHALL pass clock, id and hasher only through `KernelPorts`, and SHALL call `Date.now`, `Math.random` or `crypto` nowhere inside the Fact_Deriver, the Binder, the Solver or `evaluate`.
6. THE Trace SHALL be deeply frozen by `createTrace`, and a test SHALL assert that mutating it throws or has no effect.
7. FOR ALL valid Cases and version labels, running the pipeline twice with the same raw output SHALL produce equal `validatedFields`, equal `ruleOutcomes`, equal `result` and equal `amountCents`.
8. THE Case_Files_App SHALL provide `exportTrace` that serialises the Trace, the overrides and the Accusation_Records to JSON, and FOR ALL such exports, parsing then exporting then parsing SHALL produce an equal value (round-trip property). This requirement is first in the scope cut order (see Requirement 23).

### Requirement 10: Replay and the RULE VERSION knob

**User Story:** As a viewer, I want to turn the knob and see the same case judged by another rule version, so that versioned rules are visible.

#### Acceptance Criteria

1. WHEN the player turns the knob to a version label other than the displayed one, THE Case_Files_App SHALL produce a Replay Trace from the `validatedFields` of the Original_Trace, binding and evaluating the Rule_Set of that label with core `evaluate`, and SHALL create the Trace with core `createTrace` and the `inputHash` of the Original_Trace. THE Replay SHALL NOT call core `replay`: the app re-derives the Decision through the Solver (Requirement 5, which binds and evaluates) and calls `createTrace` directly, because core `replay` takes `result` and `amountCents` from `evaluate` and has no `resultMapper` hook (see Q2).
2. THE Replay SHALL call no extraction adapter, no hasher and no network, and SHALL not modify the Original_Trace.
3. THE Case_Files_App SHALL keep one Replay per label per session in a replay store (v1 is the Original_Trace and is never replaced), as the expense app does.
4. THE Replay Trace SHALL carry the `ruleSetVersion` of the label used, and SHALL equal a fresh pipeline run with that label in `validatedFields`, `ruleOutcomes`, `result` and `amountCents` (replay equivalence property).
5. WHEN the displayed version changes, THE Case_Files_App SHALL show the verdict, the fractures, the Glass_Card state and the Accuse button state of the displayed Trace, and SHALL show a status note "Replayed with v<N>. Original: v1." in the header.
6. WHEN a Replay fails with a CoreError, THE Case_Files_App SHALL keep the previous Trace on screen and SHALL show the error in a panel with `role="alert"`.
7. THE knob SHALL offer exactly the labels `v1`, `v2` and `v3`.

### Requirement 11: Player flow and accusation

**User Story:** As a player, I want to read a case, accuse one suspect and get a verdict from the rules, so that I can play on the skeleton.

#### Acceptance Criteria

1. THE Case_Files_App SHALL show the start screen first, with one film sheet per Recorded_Case and a "Write a new case" card, as the only way to begin.
2. WHEN the player picks a Recorded_Case, THE Case_Files_App SHALL run the pipeline with v1, SHALL show the case screen, and SHALL start with X-RAY off (D15).
3. WHILE X-RAY is off on the case screen, THE Case_Files_App SHALL show for each Suspect a name plate and the Statements of the selected Suspect, and SHALL list the Clues and the Crime line in the document panel, in English plain text.
4. WHEN the player selects a Suspect (click or keyboard), THE Case_Files_App SHALL mark exactly one Suspect as selected with `aria-checked="true"` in a `role="radiogroup"`, with arrow keys moving the selection.
5. WHILE no Suspect is selected, THE Case_Files_App SHALL disable the Accuse button.
6. WHILE the effective result of the displayed Trace is `rejected`, THE Case_Files_App SHALL disable the Accuse button (Requirement 6.5).
7. WHEN the player presses Accuse with a Suspect selected and an effective result of `approved`, THE Case_Files_App SHALL compute the Accusation_Record with `verdict` `correct` when the accused Suspect is in `convictable` of the displayed Trace and `incorrect` otherwise, SHALL switch X-RAY on, and SHALL show the verdict view.
8. THE Accusation_Record SHALL contain `decisionId`, `ruleSetVersion`, `suspectId`, `verdict`, `proofRuleIds` (the instance ids of the accused Suspect's fired rules) and `createdAt` from the clock port, and SHALL be computed by a pure function of the Trace and the suspect id.
9. THE Result_Banner SHALL read "CASE CLOSED: <name> is guilty." for `correct` and "WRONG SUSPECT: <name> cannot be convicted." for `incorrect`, followed by the list of the Suspects that the Solver found Convictable, with texts from templates only.
10. WHEN the player turns the knob after an accusation, THE Case_Files_App SHALL keep the Accusation_Record unchanged and SHALL show a note when the displayed version gives another verdict for that Suspect.
11. WHEN the player presses "New case", THE Case_Files_App SHALL return to the start screen and SHALL discard the session state, and the Original_Trace SHALL stay unchanged until then.
12. FOR ALL Cases, versions and accused Suspects, THE accusation function SHALL return `correct` if and only if the accused id is in `convictable`, and SHALL not read the model output text or the confidence.

### Requirement 12: Human override

**User Story:** As a reviewer, I want to overrule a case verdict and leave a trace of it, so that a human can have the last word without editing history.

#### Acceptance Criteria

1. WHEN the player presses "Human override", THE Case_Files_App SHALL open a dialog with fields reviewer name (required), reason (required, at most 500 characters) and replacement result (`approved` or `rejected`), with the focus returning to the button on close.
2. THE Case_Files_App SHALL create the Override with core `override`, SHALL store it beside the Trace, and SHALL never edit the Trace.
3. WHEN a validation error occurs (empty name, empty reason, reason over 500 characters), THE dialog SHALL show the message next to the field and SHALL not close.
4. THE Case_Files_App SHALL compute the effective result with core `effectiveResult` over the Overrides of the displayed Trace, and SHALL pass the effective result and reviewer name to the result display so that it shows "overruled by <name>" and "Rules decided: <result>".
5. WHEN the effective result is `approved` after an Override of a `rejected` Trace, THE Case_Files_App SHALL enable the Accuse button.
6. WHEN the effective result is `rejected` after an Override of an `approved` Trace, THE Case_Files_App SHALL disable the Accuse button.
7. IF two Overrides of one Trace have the same `createdAt`, THEN THE Case_Files_App SHALL show the `ambiguous_override` error in a panel with `role="alert"` and SHALL keep the rule result as the effective result.
8. THE clock port of the Case_Files_App SHALL return strictly increasing times, at least 1 ms apart, so that two Overrides never share a timestamp.
9. FOR ALL sequences of Overrides, THE displayed rule result and `validatedFields` and `ruleOutcomes` of the Trace SHALL stay equal to those before the first Override.

### Requirement 13: Skeleton ensemble in Xray_UI

**User Story:** As a developer of other apps, I want a generic component that shows several skeletons, so that any domain with several subjects can reuse it.

#### Acceptance Criteria

1. THE Xray_UI SHALL export the component `SkeletonEnsemble` with props `trace`, `members` (array of `{id, label, anatomy}`), `xray`, `selectedId`, `onSelect`, `selectLabel` and the common props `reducedMotion` and `className`.
2. THE `SkeletonEnsemble` SHALL render one Member per entry in the order given, each with a name plate (`label`), the skeleton image `skeleton.webp`, hotspots for that member's anatomy bones, and an ECG band that spikes at the member's fractured bones, all built from existing xray-ui parts and the one shared Trace.
3. THE `SkeletonEnsemble` SHALL render the bones of a Member from `selectBones(trace, member.anatomy)` only, so that the same Trace serves all Members.
4. WHILE `xray` is false, THE `SkeletonEnsemble` SHALL render the name plates only, without skeleton images, hotspots or ECG.
5. THE name plates SHALL form a `role="radiogroup"` with `aria-label` from `selectLabel`, each plate a `role="radio"` with `aria-checked`, a roving tabindex and arrow-key movement.
6. WHEN a plate is activated by click, Enter or Space, THE `SkeletonEnsemble` SHALL call `onSelect(id)`.
7. THE `SkeletonEnsemble` SHALL support 1 to 4 Members, SHALL give each Member at least 160 CSS pixels of width in the case screen at 1280x720, and SHALL keep the skeletons inside the stage area without overlap.
8. THE `SkeletonEnsemble` SHALL contain no domain word (receipt, expense, alcohol, meal, trip, suspect, clue, culprit) in `.ts`, `.tsx` or `.css`, SHALL use `--xr-u` or percentages for sizes, and SHALL add no raster file.
9. THE `SkeletonEnsemble` SHALL not change the rendering of `Shell`, `Stage` or any existing component, and the existing xray-ui and expense-auditor tests and references SHALL pass unchanged.
10. WHERE the Case_Files_App needs the additions of Decision D19, THE Xray_UI SHALL add them as optional props whose absence gives the same DOM and the same pixels as today (verified by the existing Shell, DoctorPanel and GlassCard tests and the expense e2e references).
11. THE Xray_UI SHALL add component tests for the `SkeletonEnsemble` (roles, keyboard, bone states per member, `xray` false) and a property test that, for any list of 1 to 4 members, the number of rendered fractured bones equals the sum of fractured bones of `selectBones` per member.

### Requirement 14: Screens and layout

**User Story:** As a viewer, I want one finished instrument that fits the screen, so that the demo looks like a product.

#### Acceptance Criteria

1. THE Case_Files_App SHALL show the heading "Bones Case Files" in a visually hidden `h1` and the Xray_UI header bar with wordmark and tagline, as the expense app does.
2. THE start screen SHALL show three film sheets (title, number of suspects, one-line setting from the stored case) and the card "Write a new case" with a theme select (4 themes) and a button, and SHALL use the Xray_UI start layout and form strip.
3. WHILE Live_Mode is off, THE start screen SHALL show the card "Write a new case" disabled, with the visible note "Live mode is off on this server. Pick a recorded case.", and SHALL keep the recorded sheets usable.
4. THE case screen SHALL arrange, inside the steel frame, the document panel on the left (Crime line, Clues, and the Statements of the selected Suspect), the Skeleton_Ensemble in the centre, the Glass_Card above the ensemble, Dr_Bones on the right, and the Control_Panel at the bottom left.
5. THE case screen SHALL show the buttons "Accuse" and "Replay" below the ensemble, with the Replay button re-running the intro and typing animation without re-evaluation, as the Replay button of the expense app does.
6. THE verdict view SHALL use the case screen layout with X-RAY on, SHALL highlight the accused Suspect with `data-accused="true"`, SHALL show the Result_Banner in the centre area below the Glass_Card, and SHALL offer "New case".
7. WHEN the viewport is each of the Viewports, THE start screen, the case screen and the verdict view SHALL have `document.documentElement.scrollHeight <= innerHeight` and `scrollWidth <= innerWidth`, with 4 Suspects of 5 Statements each.
8. WHEN the viewport is each of the Viewports, THE Glass_Card, the document panel, the Skeleton_Ensemble, Dr_Bones and the Control_Panel SHALL lie fully inside the viewport and SHALL not overlap, except the Control_Panel on the steel frame, the stamp on the Glass_Card and transparent margins of skeleton images.
9. THE document panel and the Dr_Bones log MAY scroll inside their own box, and the page SHALL not scroll.
10. THE Case_Files_App SHALL keep all app CSS in `src/styles/app.css` limited to layout (position, display, flex, grid, gap, padding, margin, sizes with percentages or `--xr-u`), with colour, border, background, shadow and font declarations only in the `body` rule (the visual guard of the expense app, copied).
11. THE Case_Files_App SHALL write all visible text in English.

### Requirement 15: Dr. Bones, Glass_Card, stamp and confidence meter

**User Story:** As a viewer, I want Dr. Bones to explain the verdict from the trace, so that the explanation is auditable.

#### Acceptance Criteria

1. THE Anatomy_Builder SHALL build a combined `Anatomy` (all bones of all Suspects, unique `ruleId` per bone) for chat, glass card, intro and control panel, and a per-Suspect `Anatomy` for each Member, from the validated fields only.
2. THE Anatomy_Builder SHALL give each bone a label of at most 40 characters that starts with the Suspect name, such as "Widow: Statement 2" or "Widow: Motive", assembled from templates and ids, never from model text.
3. THE Anatomy_Builder SHALL give `fieldLabels` an English label for every evidence path of the bound rules and for the case fields `title`, `setting`, `victim`, `crime`, and SHALL provide a `formatValue` that formats a Crime object as "<place>, <hh:mm>-<hh:mm>, <item>" with names resolved from the Case.
4. THE Dr_Bones messages SHALL come only from the Xray_UI chat templates (`buildChatMessages`), the `renderedMessage` of rule outcomes (rule message templates) and the closed templates in `solverMessages.ts`, and no message SHALL come from an LLM.
5. THE Case_Files_App SHALL pass the Solver reason and the Accusation text to Dr_Bones as `extraMessages` built from `solverMessages.ts`, WHERE the optional prop of D19 exists.
6. THE Case_Files_App SHALL import no LLM client and call no network function in `src/ui` and `src/state` code that produces chat text, and a guard SHALL assert this by source scan and by a runtime test with a `fetch` spy that records 0 calls while the chat types.
7. THE DoctorPanel typing speed SHALL follow Decision D25.
8. WHEN the effective result is `rejected`, THE Glass_Card SHALL show the cracks and the stamp "OVERRULED BY RULE" with the rule set version label, and WHEN the effective result is `approved`, THE Glass_Card SHALL show neither (D14).
9. THE AI READ CONFIDENCE meter SHALL show the mean of the model confidence values of the Trace (D13), and SHALL show "n/a" when `confidence` is empty.
10. THE result line of the Dr_Bones footer SHALL show the result label and the convictable count formatted by `formatValue("amountCents", n)` as "<n> convictable", and SHALL never show a currency symbol.
11. WHEN a bone is hovered or focused, THE Case_Files_App SHALL show the Xray_UI rule box with the rendered rule message and the evidence rows with the labels of Requirement 15.3.
12. WHEN a bone is not part of the displayed Rule_Set, THE Skeleton_Ensemble SHALL show it as not applicable and the tooltip SHALL read "not applicable" (existing Xray_UI behaviour).

### Requirement 16: Look, accessibility and motion

**User Story:** As a user with assistive technology or motion sensitivity, I want the 1950s radiology look to stay usable, so that style does not cost access.

#### Acceptance Criteria

1. THE Case_Files_App SHALL use the visual-polish-2 look through Xray_UI components and tokens only: dark lightbox with cyan glow, brushed-steel frame, control strip at the bottom left, film clips, red fracture glow, ECG line and stamp.
2. THE Case_Files_App SHALL add no new raster file, no new font file and no sound, and SHALL reuse `dr-bones.webp` for the Dr. Bones avatar and `skeleton.webp` for each Member.
3. THE Xray_UI Asset_Dir total size SHALL not grow, and the asset-budget test SHALL pass with the unchanged total.
4. THE Case_Files_App SHALL contain no raster file (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.avif`) outside `e2e/__screenshots__`, and a guard SHALL assert this.
5. THE Case_Files_App SHALL make every interactive element reachable by keyboard in this tab order: header actions, name plates (one tab stop, arrow keys inside), knob, X-RAY switch, Accuse, Replay, Human override, and SHALL show a focus ring of at least 3:1 contrast and 3 CSS pixels.
6. THE Case_Files_App SHALL keep the roles `slider` (knob), `meter` (confidence), `switch` (X-RAY), `radiogroup` and `radio` (plates), `dialog` (override) and `status` (result), and SHALL mark purely decorative images with `alt=""` or `aria-hidden="true"`.
7. THE Case_Files_App SHALL reach a text contrast of at least 4.5:1 for every text and background pair that it adds, and SHALL list each pair in its contrast test (a copy of the expense guard that uses the Xray_UI token values).
8. WHILE `prefers-reduced-motion: reduce` matches or the `reducedMotion` prop is true, THE Case_Files_App SHALL show the final state without animation and the same layout as without reduced motion.
9. THE Case_Files_App SHALL define no `@keyframes` and no animation outside `packages/xray-ui/src/styles/`.
10. THE Case_Files_App SHALL announce the verdict and the Accuse result through an element with `role="status"` and SHALL show a fracture by shape and label too, so that colour is never the only signal.

### Requirement 17: Live function (optional)

**User Story:** As a developer, I want an optional serverless function that asks the LLM for a case, so that I can see a fresh case without exposing a key.

#### Acceptance Criteria

1. WHERE live mode is built, THE Live_Function SHALL be `apps/case-files/api/case.ts` with helpers in `api/_lib/` (handler, anthropic provider, openrouter provider, rate limit), written in the pattern of `apps/expense-auditor/api/extract.ts` and `api/_lib/*`, and SHALL read all configuration from `env`.
2. WHERE live mode is built, THE Live_Function SHALL answer `GET` with `{live: boolean}` and SHALL treat live as on only when `LIVE_EXTRACTION === "on"` (the kill switch), the key of the chosen provider is non-empty and `EXTRACTION_MODEL` is non-empty.
3. WHERE live mode is built, THE Live_Function SHALL select the provider by `LLM_PROVIDER` (`anthropic` by default, `openrouter`), and SHALL answer 403 `disabled` for any other value.
4. WHERE live mode is built, THE Live_Function SHALL check in this order: method, live flag, origin, rate limit, body size, JSON parse, strict body schema `{theme}` with the 4 allowed themes, provider call, strict validation of the model output.
5. WHERE live mode is built, THE Live_Function SHALL reject a request body larger than 1,024 characters with 413, SHALL limit each client to 10 requests per 10 minutes (429 with `retry-after`), and SHALL time out the provider call after 25 seconds (`maxDuration` 30 in `vercel.json`).
6. WHERE live mode is built, THE Live_Function SHALL validate the model output with the Case_Schema, the 32,768-byte cap and the confidence rule of Requirement 2.12, and SHALL answer 502 `model_output_invalid` for invalid JSON or a schema failure, with a fixed message and no model text.
7. WHERE live mode is built, THE Live_Function SHALL send the model a fixed system prompt that lists the closed vocabulary and the limits, and the only client-controlled value in the prompt SHALL be the theme from the closed list.
8. WHERE live mode is built, THE Live_Function SHALL put the API key only in a server request header, and SHALL return the key, a provider header or a provider error text in no response and no log line.
9. WHERE live mode is built, THE Live_Function SHALL return the same error body shape as the expense function (`{error: {reason, code, message}}`) with the codes `disabled`, `forbidden_origin`, `method_not_allowed`, `bad_request`, `too_large`, `rate_limited`, `upstream_failed`, `model_output_invalid`.
10. WHERE live mode is built, THE Vite dev server SHALL serve `/api/case` through a dev-only middleware that loads env on the server process only, and `.env.example` SHALL list `LIVE_EXTRACTION=off`, `LLM_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` and `EXTRACTION_MODEL` with empty keys and no `VITE_` prefix.
11. WHERE live mode is built, THE Live_Function tests SHALL use fakes (no real network) and SHALL include a property test that no key value appears in any response or log line for any provider outcome (key-never-leaks), and a kill-switch property test.

### Requirement 18: Live mode in the client (optional)

**User Story:** As a player, I want a generated case to be checked like any other, so that a bad case is rejected visibly.

#### Acceptance Criteria

1. WHERE live mode is built, THE start screen SHALL ask `GET /api/case` once (with one retry after a failure) to learn whether live is on, and SHALL enable the card "Write a new case" only when the answer is `{live: true}`.
2. WHERE live mode is built, WHEN the player presses "Write a new case", THE Case_Files_App SHALL show a progress state with `role="status"` and SHALL run the pipeline with the `HttpCaseAdapter` and v1.
3. WHERE live mode is built, IF the extraction fails or the output does not match the Case_Schema, THEN THE Case_Files_App SHALL show a rejection view with the stamp text "CASE REJECTED", the error kind and at most 8 field errors (path and issue), and SHALL create no Trace (D24).
4. WHERE live mode is built, IF the case validates and the Solver verdict is not `accepted`, THEN THE Case_Files_App SHALL show the normal case screen with the rejected Trace, the fractures and the reasons (Requirement 6).
5. WHERE live mode is built, THE Case_Files_App SHALL send no request to `/api/case` while the player uses a Recorded_Case, except the one status `GET`.
6. WHERE live mode is built, THE production bundle SHALL contain no provider host, no key name, no key value and no source map (Requirement 20).

### Requirement 19: Unit, property and component tests

**User Story:** As a maintainer, I want tests that pin the contract, so that rules, solver and replay cannot drift unnoticed.

#### Acceptance Criteria

1. THE Case_Files_App SHALL use Vitest and fast-check, with at least 100 runs per property, and SHALL name property files `*.node.test.ts` so that they run in the Node environment, as the expense app does.
2. THE Case_Files_App SHALL provide a fast-check arbitrary for valid Cases that respects every limit of Requirement 2 and covers 2 to 4 Suspects, 1 to 5 Statements, all kinds, both reliabilities, and overlapping and disjoint intervals.
3. THE Case_Files_App SHALL provide property tests for: Case_Schema round trip (2.15), schema rejection of every limit violation and of every unknown key (one violation generated per run), Fact_Deriver model equivalence and order independence (3.8, 3.10), Binder uniqueness and counts (4.11), Solver determinism, rejection rule, order independence and confidence independence (5.11 to 5.14), pipeline determinism (9.7), replay equivalence (10.4), accusation correctness (11.12), override immutability (12.9), and export round trip (9.8).
4. THE Case_Files_App SHALL provide unit tests for: the expected matrix of the nine Recorded_Case and version combinations (7.5), every rule file parse, the Bundle build errors, the solver messages (every template renders without an empty slot), the Anatomy_Builder labels (at most 40 characters, unique rule ids), the clock port, the replay store and the session reducer.
5. THE Case_Files_App SHALL provide component tests (jsdom) for the start screen, the case screen, the verdict view, the override dialog and the error panel, including keyboard use of the radiogroup and the disabled state of Accuse.
6. THE tests SHALL use no real network, no real clock and no real randomness in assertions, and SHALL inject ports.
7. FOR ALL generated Cases that the Solver rejects as `unfair_none` or `unfair_many`, THE pipeline SHALL produce a Trace with `result` `rejected` and the Accuse button SHALL be disabled in the component test (rejection property at UI level, with at least 3 fixed examples).

### Requirement 20: Guards

**User Story:** As a maintainer, I want guard tests for the hard rules, so that a regression fails the build.

#### Acceptance Criteria

1. THE Case_Files_App SHALL contain a guard test that scans `src`, `api`, `shared`, `tests` and `e2e` for imports, paths and CSS imports that name the expense app, with the forbidden name built from two parts so that the file does not match itself, and the scanner SHALL have positive and negative self-tests.
2. THE Case_Files_App SHALL contain a workspace-import guard that allows only `@bones/core` and `@bones/xray-ui` in `src`, forbids Node built-ins in `src`, and forbids `shared/` and `api/_lib/` from importing `src/`.
3. THE Case_Files_App SHALL contain a no-secrets guard that scans `src` for key names, `sk-` tokens, `api key`, `x-api-key` and `VITE_` names with KEY or SECRET, and SHALL build the app with canary keys in the environment and scan every output file for the canary values, provider hosts, `Bearer`, `x-api-key`, `anthropic-version` and source maps.
4. THE Case_Files_App SHALL contain a no-LLM-in-chat guard with a source scan and a runtime test (Requirement 15.6).
5. THE Case_Files_App SHALL contain a no-visual-in-app guard (Requirement 14.10), a no-raster guard (Requirement 16.4) and a contrast test (Requirement 16.7).
6. THE Case_Files_App SHALL contain a rules-purity guard: rule files parse with `parseRule`, use only `comparison` nodes and `deducting` effects, contain no key outside the core rule schema, and every `messageTemplate` slot starts with `subject.`.
7. THE Case_Files_App SHALL contain a guard that the Solver and the Fact_Deriver files import only `@bones/core` types and functions and local files, and contain none of `Date.now`, `new Date(`, `Math.random`, `crypto`, `fetch`, `eval`, `new Function`.
8. THE Core domain-isolation test, the Core repo-layout test, the Xray_UI domain-isolation test (with `clue` and `culprit` added to its forbidden words), the Xray_UI asset and contrast tests and all expense-auditor tests SHALL stay green and unchanged except for the added forbidden words.
9. THE tasks SHALL include the check `git diff --exit-code <start-commit> -- packages/core apps/expense-auditor` in every task, where `<start-commit>` is recorded in `tasks.md` at the first task.

### Requirement 21: End-to-end tests and reference screenshots

**User Story:** As the product owner, I want automated browser checks and stored screenshots, so that layout and flow are verified, not assumed.

#### Acceptance Criteria

1. THE Case_Files_App SHALL provide a Playwright config with `updateSnapshots: "none"`, `reducedMotion: "reduce"`, `colorScheme: "dark"`, the web server `pnpm build && pnpm exec vite preview --host 127.0.0.1 --port 5202 --strictPort`, a project `chromium` at 1440x900 and a project `chromium-1600` at 1600x900, following `apps/expense-auditor/playwright.config.ts`.
2. THE e2e specs SHALL cover these flows without network: (a) fair case, accuse the widow, verdict `correct`; (b) fair case, accuse another Suspect, verdict `incorrect`; (c) `candlesticks` rejected under v1 with Accuse disabled, then knob v2 shows `accepted` and enables Accuse; (d) `empty-room` shows v1 `unfair_none`, v2 `accepted`, v3 `unfair_none`; (e) Human override of a rejected case enables Accuse and shows "overruled by"; (f) keyboard-only path from start to verdict; (g) no request other than the app's own files and the status `GET`.
3. THE e2e specs SHALL assert at 1600x900, 1440x900 and 1280x720 that the start screen, the case screen and the verdict view have no page scroll (Requirement 14.7) and no overlap (Requirement 14.8), using a Case with 4 Suspects of 5 Statements for the case screen (a test-only recorded entry in `e2e/` or `tests/fixtures`, not in `recorded/`).
4. THE e2e specs SHALL store Reference_Screenshots under `apps/case-files/e2e/__screenshots__/` for: start screen, fair case verdict view, and `candlesticks` rejected under v1, each at 1600x900 and 1440x900 (6 files).
5. THE e2e specs SHALL assert computed styles: no dashed border anywhere, no box around label elements, and the stamp inside the Glass_Card when the Glass_Card is cracked.
6. THE Case_Files_App SHALL regenerate its own references only on purpose with `--update-snapshots` for the spec concerned, and SHALL leave references of other specs and of the expense app unchanged in that commit.
7. THE final task SHALL produce a side-by-side image of `design/mockups/bones-6-casefiles-b.png` and the final case screen at 1600x900 for the user's last review.

### Requirement 22: README

**User Story:** As a new developer, I want a README section for the app, so that I can run and understand it in minutes.

#### Acceptance Criteria

1. THE Case_Files_App SHALL provide `apps/case-files/README.md` with the sections: what it is, why the LLM never decides, the five Bones parts in this app, how to play, how to run (port 5201), the scripts table, tests, rule versions and the verdict matrix of the three cases, live mode (if built), security notes and known limitations.
2. THE root `README.md` SHALL gain a short "Apps" entry for Case Files with the run command `pnpm dev:case-files`, and SHALL change no other statement.
3. THE README SHALL state the Open questions Q1 to Q7 in one short list or link to this document.
4. THE README SHALL describe every command that it names, and a test SHALL assert that each script named in the README exists in `package.json`.

### Requirement 23: Time box, task order and checkpoints

**User Story:** As the product owner, I want a fixed order, hard stops and a cut list, so that the app is finished by 28.11.2026.

#### Acceptance Criteria

1. THE tasks SHALL follow this order: (1) schema, Fact_Deriver and the three Recorded_Cases; (2) rules v1, v2 and v3, Rule_Binder and Bundle; (3) Solver with property tests; (4) pipeline, Trace, replay, override and accusation; (5) Xray_UI additions and UI; (6) e2e at 1600x900 and 1440x900; (7) live mode, marked optional with `*`; (8) README.
2. THE tasks SHALL contain a hard stop named "checkpoint solver done" directly after task (3), at which the agent SHALL report the expected matrix result of the nine combinations and wait for the user.
3. THE tasks SHALL contain a hard stop named "checkpoint ui done" directly after task (5), at which the agent SHALL store a side-by-side image of `design/mockups/bones-6-casefiles-b.png` and the case screen at 1600x900 under `.kiro/specs/case-files/review/`, and wait for the user.
4. THE tasks SHALL contain a final checkpoint after task (8) with the full test, typecheck and e2e result.
5. THE agent SHALL NOT mark a checkpoint done before the user has reviewed it, and SHALL record the verdict (accepted or list of changes) in `tasks.md`.
6. THE end of every task SHALL require `pnpm -r typecheck` green, `pnpm -r test` green, the core and expense diff check of Requirement 20.9 empty, and `git status` clean (all work committed).
7. THE scope cut order, to apply from the first item when the Time_Box is at risk, SHALL be: (1) live mode and its README part (Requirements 17, 18); (2) trace export and the export round-trip property (9.8); (3) `extraMessages` (15.5), with the reason then shown on the Glass_Card only; (4) `overruled` and `stampDetail` on the Glass_Card (the card then never cracks); (5) typed animation of the Result_Banner (shown at once); (6) the `sighting` kind and its rule (the knob keeps v3 through the `Firm` rules).
8. THE following SHALL NOT be cut: recorded mode, the three Recorded_Cases, the Solver and its property tests, the pipeline with Trace, replay and override, the guards, the no-scroll checks at the three Viewports, keyboard access and reduced motion.
9. THE Case_Files_App SHALL add no feature that is not named in this document, and each task SHALL list the requirement numbers that it satisfies.

### Requirement 24: Honest labelling of recorded cases

**User Story:** As a viewer, I want to know that the three demo cases are hand-written fixtures and not real LLM output, so that the demo makes no false claim about the model.

#### Acceptance Criteria

1. THE README SHALL state in one sentence that the three Recorded_Cases are hand-written fixtures in the model output format and not real LLM output, and a test SHALL assert that the README contains that sentence.
2. THE StartScreen SHALL show the visible text "Recorded demo case" on each of the three Recorded_Case sheets, with a text contrast ratio of at least 4.5:1 and no new raster image, and THE Case_Files_App SHALL pass that text to the generic Xray_UI `FilmSheet` through an existing or optional domain-free prop.
3. WHERE Live_Mode (Requirement 17) is built, THE README MAY add one real recorded LLM case, labelled "Recorded LLM case", and THE Case_Files_App SHALL NOT label that case "Recorded demo case" and SHALL NOT label any of the three fixtures "Recorded LLM case".
4. THE source code, the code comments and the recorded JSON files of the three Recorded_Cases SHALL NOT claim LLM authorship, and any field or comment that names their origin (such as `source` or `origin`) SHALL say `fixture`.
