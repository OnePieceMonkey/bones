# Requirements Document

## Introduction

`packages/core` is the decision kernel of the Bones platform. It provides the pure, domain-agnostic machinery that all Bones applications share: typed extraction of LLM output, Zod-based field validation, rule evaluation over a restricted condition AST, structured trace creation, trace replay, and human override management. The kernel contains no UI, no domain-specific words, and no I/O beyond injected ports. Every decision it produces is deterministic and fully auditable.

## Glossary

- **Kernel**: The `packages/core` package as a whole.
- **Extraction_Port**: The interface through which raw input (text or image bytes) is converted into proposed fields by an adapter. The Kernel owns the interface; adapters are injected.
- **Live_Adapter**: An Extraction_Port adapter that calls a real LLM. For this spec it is a clearly-marked stub; production implementation is out of scope.
- **Recorded_Adapter**: An Extraction_Port adapter that reads stored JSON fixture files to replay pre-captured LLM outputs.
- **ProposedFields**: A record of field names to their proposed values, as returned by an Extraction_Port adapter.
- **Confidence**: A per-field numeric score in the closed interval [0, 1] representing the adapter's certainty about a proposed value.
- **SourceLocation**: An optional per-field location in the original input, expressed as a line index (integer ≥ 0) or a normalized bounding box `{ x, y, width, height }` where all values are in [0, 1].
- **ValidatedFields**: The subset of ProposedFields that passed Zod schema validation, ready for rule evaluation.
- **Rule**: A JSON-serializable object with an `id`, a `version`, an `effect`, a `condition` AST node, an `effectConfig`, and a `messageTemplate`.
- **RuleSet**: A versioned collection of `{ ruleId, ruleVersion }` references that pin exactly one version of each rule.
- **Rule_Catalog**: The complete set of Rule objects available to the Evaluator, keyed by `(id, version)`.
- **Condition_AST**: A restricted JSON AST whose nodes are: comparison (literal or field-path on either side), sum-over-collection, date-in-range, and membership. No `eval`, no arbitrary code, no I/O, no randomness, no access to the current time.
- **Evaluator**: The pure function `evaluate(fields, ruleSet, catalog, amountScopes)` that applies rules to ValidatedFields and returns a Decision.
- **Decision**: The business result of evaluation: `approved`, `partially_approved`, or `rejected`, together with the final amount in integer cents.
- **AmountScope**: A named scope (e.g. `"meal"`, `"total"`) over which capping and deducting rules operate independently.
- **Blocking_Rule**: A Rule with `effect: "blocking"`. A single failure causes the Decision to be `rejected`.
- **Capping_Rule**: A Rule with `effect: "capping"`. Sets an upper bound on the amount for a given scope; the lowest cap per scope wins.
- **Deducting_Rule**: A Rule with `effect: "deducting"`. Subtracts a fixed or computed amount from the scope total.
- **Evidence**: A record attached to every rule outcome listing the field paths and their concrete values that determined the outcome.
- **Trace**: The immutable JSON record of a single decision: schema version, decision ID, timestamps, input hash, raw model output, proposed fields, confidence, sources, validated fields, rule set reference, all rule outcomes with evidence, the Decision, and the final amount in cents.
- **TraceSchemaVersion**: A string constant identifying the Trace format version, used to detect schema drift during replay.
- **Replay**: Re-evaluating the ValidatedFields in a stored Trace against a (potentially different) RuleSet version, without calling extraction.
- **Override**: A linked record that replaces the effective Decision of a Trace with a reviewer-supplied result, without mutating the original Trace.
- **EffectiveResult**: The result callers should use: the latest linked Override if any exist, otherwise the original Decision from the Trace.
- **CoreError**: A discriminated-union type that carries all Kernel error variants. It is structurally distinct from the business result `rejected`.
- **Clock_Port**: An injected function `() => Date` used by the Kernel when recording `createdAt`. Never called inside the Evaluator.
- **Id_Port**: An injected function `() => string` used by the Kernel to generate decision IDs.
- **Hasher_Port**: An injected function `(bytes: Uint8Array) => string` used to compute the SHA-256 `inputHash`.

---

## Requirements

### Requirement 1: Extraction Port Contract

**User Story:** As a Bones application developer, I want a typed Extraction Port interface, so that I can swap LLM adapters without changing any other part of the system.

#### Acceptance Criteria

1. THE Extraction_Port SHALL accept raw input as either a UTF-8 string or a `Uint8Array` of image bytes with a length between 1 and 10,485,760 bytes (10 MB), and return a result containing ProposedFields, per-field Confidence values, optional per-field SourceLocation values, and the raw model output string.
2. WHEN the Extraction_Port adapter encounters an error, THE Extraction_Port SHALL return a CoreError rather than throwing an unhandled exception.
3. WHERE a SourceLocation is provided for a field, THE Extraction_Port SHALL represent it as either a non-negative integer line index or a normalized bounding box `{ x, y, width, height }` with all four values in [0, 1].
4. THE Live_Adapter SHALL be clearly marked as non-production with a compile-time or runtime warning and SHALL return a CoreError with variant `"live_adapter_not_implemented"` when called.
5. IF the raw input supplied to the Extraction_Port is an empty UTF-8 string or a `Uint8Array` with length 0, THEN THE Extraction_Port SHALL return a CoreError with variant `"input_empty"` without invoking the adapter.
6. IF the raw input supplied to the Extraction_Port is a `Uint8Array` with length greater than 10,485,760 bytes, THEN THE Extraction_Port SHALL return a CoreError with variant `"input_too_large"` without invoking the adapter.
7. WHEN the Recorded_Adapter is given a fixture path that does not exist or contains malformed JSON, THE Recorded_Adapter SHALL return a CoreError with variant `"fixture_not_found"` or `"fixture_invalid"` respectively.
8. WHEN the Recorded_Adapter loads a valid fixture, THE Recorded_Adapter SHALL return the ProposedFields, Confidence values, SourceLocations, and raw model output exactly as stored in the fixture without modification.

---

### Requirement 2: Field Validation

**User Story:** As a Bones application developer, I want to validate proposed fields against an app-supplied Zod schema, so that only well-typed data reaches the rules engine.

#### Acceptance Criteria

1. WHEN `validate(proposedFields, schema)` is called and all fields in `proposedFields` pass the Zod schema, THE Kernel SHALL return a `ValidatedFields` record containing every field from `proposedFields`.
2. IF one or more fields in `proposedFields` fail Zod validation, THEN THE Kernel SHALL return a `CoreError` with variant `"validation_failed"` that includes the dot-separated field path and the Zod issue message for each failing field.
3. THE Kernel SHALL never pass un-validated `ProposedFields` to the Evaluator.
4. IF `validate` is called with an empty `ProposedFields` record and the schema defines one or more required fields, THEN THE Kernel SHALL return a `"validation_failed"` `CoreError` listing each required field defined in the schema; IF the schema defines no required fields, THEN THE Kernel SHALL return an empty `ValidatedFields` record.
5. IF `validate` is called with a `schema` argument that is not a valid Zod schema object, THEN THE Kernel SHALL return a `CoreError` with variant `"validation_failed"` and an error message indicating an invalid schema was provided.

---

### Requirement 3: Rule Shape and Rule Set Structure

**User Story:** As a Bones platform maintainer, I want rules and rule sets to be fully serializable JSON data structures, so that decisions can be versioned, stored, and replayed without any code changes.

#### Acceptance Criteria

1. THE Kernel SHALL represent each Rule as a JSON object containing exactly the fields: `id` (non-empty string ≤ 128 characters), `version` (non-empty string matching the pattern `MAJOR.MINOR.PATCH` where each component is a non-negative integer ≤ 999), `effect` (one of `"blocking"`, `"capping"`, or `"deducting"`), `condition` (a Condition_AST node), `effectConfig` (an object whose required fields depend on `effect`), and `messageTemplate` (a string ≤ 1024 characters containing zero or more `{{fieldName}}` interpolation slots); IF any required field is absent or has a value outside its specified type or bounds, THEN THE Kernel SHALL return a CoreError with variant `"invalid_rule_schema"`.
2. THE Kernel SHALL represent each RuleSet as a JSON object containing exactly the fields: `id` (non-empty string ≤ 128 characters), `version` (non-empty string matching the pattern `MAJOR.MINOR.PATCH` where each component is a non-negative integer ≤ 999), and `rules` (an array of zero to 200 `{ ruleId: string, ruleVersion: string }` objects); IF any required field is absent or has a value outside its specified type or bounds, THEN THE Kernel SHALL return a CoreError with variant `"invalid_rule_set_schema"`.
3. THE Kernel SHALL require that every `{ ruleId, ruleVersion }` reference in a RuleSet resolves to an entry in the Rule_Catalog; IF a reference cannot be resolved, THEN THE Kernel SHALL return a CoreError with variant `"rule_not_found"`.
4. THE Kernel SHALL accept Condition_AST nodes of exactly four kinds: `comparison`, `sum`, `date_in_range`, and `membership`; IF an AST node has any other kind value, THEN THE Kernel SHALL return a CoreError with variant `"invalid_condition_ast"`.
5. WHERE a `comparison` node is defined, THE Kernel SHALL allow either side to be a literal value or a dot-separated field path of at most 10 segments and at most 256 characters in total into ValidatedFields.
6. WHERE a `capping` Rule is defined, THE Kernel SHALL allow `effectConfig.cap` to be either a constant integer between 1 and 999,999,999 cents inclusive, or a Condition_AST expression that evaluates to an integer over ValidatedFields.
7. WHERE a `blocking` Rule is defined, THE Kernel SHALL require `effectConfig` to be an empty object `{}`; IF `effectConfig` contains any fields, THEN THE Kernel SHALL return a CoreError with variant `"invalid_effect_config"`.
8. WHERE a `deducting` Rule is defined, THE Kernel SHALL require `effectConfig` to contain a `deductionAmount` field holding a constant integer between 1 and 999,999,999 cents inclusive; IF `effectConfig.deductionAmount` is absent or outside this range, THEN THE Kernel SHALL return a CoreError with variant `"invalid_effect_config"`.

---

### Requirement 4: Rule Evaluation

**User Story:** As a Bones application developer, I want the Evaluator to apply a versioned rule set to validated fields and return a deterministic Decision, so that I can audit exactly why a request was approved, partially approved, or rejected.

#### Acceptance Criteria

1. WHEN `evaluate(fields, ruleSet, catalog, amountScopes)` is called, THE Evaluator SHALL apply every rule referenced by the RuleSet in the order: blocking rules first, then capping rules, then deducting rules, and return a Decision with a final amount in integer cents.
2. WHEN any Blocking_Rule's condition evaluates to `true`, THE Evaluator SHALL immediately return a Decision with result `"rejected"`, attach Evidence for that rule, and skip all remaining rules regardless of type.
3. IF no Blocking_Rule's condition evaluates to `true`, THEN THE Evaluator SHALL first apply Capping_Rules one rule at a time in ascending `rule.id` order, each as the lower of the running amount of its AmountScope and the cap (`max(0, min(running, cap))`), and only then apply Deducting_Rules one rule at a time in ascending `rule.id` order.
4. IF the final amount for any AmountScope after applying Deducting_Rules and Capping_Rules is less than the claimed total supplied for that scope in `amountScopes`, THEN THE Evaluator SHALL return a Decision with result `"partially_approved"`.
5. IF no Deducting_Rule or Capping_Rule reduces the amount below the claimed total for any AmountScope, THEN THE Evaluator SHALL return a Decision with result `"approved"`.
6. THE Evaluator SHALL ensure the final amount per AmountScope is always an integer number of cents that is greater than or equal to zero and less than or equal to the claimed total for that scope.
7. WHEN a rule outcome is determined, THE Evaluator SHALL attach Evidence containing every field path and its concrete value that was read during condition evaluation.
8. WHEN a rule outcome is determined, THE Evaluator SHALL render the `messageTemplate` of the Rule by substituting each `{{fieldPath}}` slot with the concrete value of that path from ValidatedFields, and attach the rendered string to the outcome.
9. IF a `{{fieldPath}}` slot in a `messageTemplate` references a path not present in ValidatedFields, THEN THE Evaluator SHALL substitute that slot with an empty string and continue rendering the remaining slots.
10. THE Evaluator SHALL contain no I/O, no randomness, and no access to the current time; all such concerns are handled by injected ports outside the Evaluator.
11. THE Evaluator SHALL return an identical Decision — including result classification, final amounts, and Evidence field-path order — for identical ValidatedFields, RuleSet, and Rule_Catalog inputs, regardless of the order in which rules appear in the RuleSet.

---

### Requirement 5: Trace Creation

**User Story:** As a Bones platform maintainer, I want every Decision to produce an immutable, self-describing Trace, so that any decision can be independently audited or replayed at any time.

#### Acceptance Criteria

1. WHEN a Decision is produced, THE Kernel SHALL create a Trace as a JSON-serializable object containing all of the following fields: `traceSchemaVersion`, `decisionId`, `createdAt`, `inputHash`, `rawModelOutput`, `proposedFields`, `confidence`, `sources`, `validatedFields`, `ruleSetId`, `ruleSetVersion`, `ruleOutcomes`, `result`, and `amountCents`.
2. THE Kernel SHALL compute `inputHash` as the SHA-256 hex digest of the raw input bytes, using the injected Hasher_Port.
3. THE Kernel SHALL obtain `createdAt` as an ISO 8601 UTC timestamp from the injected Clock_Port and `decisionId` as a non-empty string from the injected Id_Port.
4. THE Kernel SHALL never mutate a Trace object after it has been returned to the caller, such that any attempt to modify a field on the returned Trace raises an error or has no effect.
5. WHEN the injected Clock_Port, Id_Port, and Hasher_Port return identical values across two calls with identical inputs, THE Kernel SHALL produce byte-for-byte identical Trace JSON.
6. IF any of Clock_Port, Id_Port, or Hasher_Port raises an error or returns an invalid value during Trace creation, THEN THE Kernel SHALL abort Trace creation and return a CoreError to the caller without returning a partial Trace.

---

### Requirement 6: Replay

**User Story:** As a Bones platform maintainer, I want to replay a stored Trace against a different rule set version, so that I can compare decision outcomes across rule set upgrades without re-running extraction.

#### Acceptance Criteria

1. WHEN `replay(trace, ruleSetVersion, ruleSet, catalog)` is called, THE Kernel SHALL re-evaluate the `validatedFields` stored in the Trace using the supplied RuleSet and Rule_Catalog without calling any Extraction_Port adapter.
2. WHEN `replay(trace, ruleSetVersion, ruleSet, catalog)` is called successfully, THE Kernel SHALL return a new Trace containing: a fresh `decisionId` and `createdAt` sourced from injected ports; the supplied `ruleSetVersion`; all extraction fields from the original Trace (`rawModelOutput`, `proposedFields`, `confidence`, `sources`, `validatedFields`, `inputHash`) copied without modification; and rule-outcome fields (`ruleOutcomes`, `result`, `amountCents`) recomputed from the supplied RuleSet and Rule_Catalog.
3. IF the `traceSchemaVersion` of the input Trace does not match the current Kernel schema version, THEN THE Kernel SHALL return a CoreError with variant `"trace_schema_mismatch"` without performing any rule evaluation.
4. THE Kernel SHALL never modify or overwrite the original Trace object during replay.
5. IF any of `ruleSet`, `catalog`, or `ruleSetVersion` supplied to `replay` is absent or null, THEN THE Kernel SHALL return a CoreError with variant `"invalid_replay_arguments"` without performing any rule evaluation.

---

### Requirement 7: Human Override

**User Story:** As a reviewer, I want to override a Decision without altering the original Trace, so that every change in outcome is itself audited and traceable.

#### Acceptance Criteria

1. WHEN `override(trace, { reviewerName, reason, replacementResult }, metadata)` is called with a non-empty `reviewerName`, a non-empty `reason` of 1–500 characters, and a valid `replacementResult`, THE Kernel SHALL create and return a new Override object linked to the original Trace by `decisionId`, containing `reviewerName`, `reason`, `replacementResult`, `createdAt` (ISO 8601 UTC from the injected Clock_Port), and any supplied metadata.
2. THE Kernel SHALL never modify the original Trace object when creating an Override.
3. WHEN `effectiveResult(trace, overrides)` is called with an empty overrides array, THE Kernel SHALL return the original Decision from the Trace.
4. WHEN `effectiveResult(trace, overrides)` is called with one or more Override objects, THE Kernel SHALL return the `replacementResult` of the Override with the latest `createdAt` value.
5. WHEN two Override objects have identical `createdAt` values, THE Kernel SHALL return a CoreError with variant `"ambiguous_override"` rather than making an arbitrary choice.
6. IF `override` is called with a `reviewerName` that is empty or contains only whitespace, or with a `reason` that is empty, contains only whitespace, or exceeds 500 characters, THEN THE Kernel SHALL return a CoreError with variant `"invalid_override_input"` and SHALL NOT create an Override object.

---

### Requirement 8: Error Model

**User Story:** As a Bones application developer, I want all Kernel errors expressed as a typed discriminated union, so that I can handle each error case exhaustively at compile time without conflating errors with business rejections.

#### Acceptance Criteria

1. THE Kernel SHALL define `CoreError` as a TypeScript discriminated union where every variant carries a `kind` field typed as a unique string literal, a `message` field typed as a non-empty string describing the error condition, and any variant-specific fields required for programmatic handling.
2. THE Kernel SHALL never use `throw` for error conditions originating within Kernel code; all such errors SHALL be returned as `CoreError` values. Exceptions propagated from third-party dependencies are outside this contract.
3. THE Kernel SHALL define `CoreError` as a closed union containing exactly the following variants and no others: `"live_adapter_not_implemented"`, `"fixture_not_found"`, `"fixture_invalid"`, `"validation_failed"`, `"rule_not_found"`, `"invalid_condition_ast"`, `"trace_schema_mismatch"`, `"ambiguous_override"`, `"invalid_rule_schema"`, `"invalid_rule_set_schema"`, `"invalid_effect_config"`, `"input_empty"`, `"input_too_large"`, `"invalid_replay_arguments"`, `"invalid_override_input"`.
4. THE Kernel SHALL ensure that no `kind` literal value defined on any `CoreError` variant is identical to any result literal (`"approved"`, `"partially_approved"`, `"rejected"`), so that a TypeScript type guard narrowing on `kind` unambiguously resolves to either a `CoreError` variant or a Decision result without overlap.

---

### Requirement 9: Domain Isolation

**User Story:** As a Bones platform maintainer, I want `packages/core` to contain no domain-specific words or logic, so that the same kernel can power any Bones application without modification.

#### Acceptance Criteria

1. THE Kernel's source files under `src/` SHALL contain no domain-specific identifiers — defined as any variable name, function name, type name, or string literal — drawn from the following exhaustive list of forbidden terms: `expense`, `receipt`, `alcohol`, `meal`, `trip`, `suspect`, `case`; any term not on this list is not considered domain-specific for the purposes of this requirement.
2. THE Kernel SHALL expose all domain customization points (schemas, rules, fixtures) as values supplied at runtime through injected parameters or external data files loaded outside `src/`, and SHALL NOT embed those values as literals or constants inside any source file under `src/`.
3. WHEN domain-specific test fixtures are required for any domain, THE Kernel SHALL place them under `packages/core/test-fixtures/<domain>/` and no source file under `src/` SHALL import from any path under `packages/core/test-fixtures/`.

---

### Requirement 10: Expense Domain Test Fixtures

**User Story:** As a Bones contributor, I want a canonical set of expense domain fixtures, so that Kernel correctness properties can be exercised against realistic, traceable examples.

#### Acceptance Criteria

1. THE Kernel's test fixtures SHALL define a meal-limit Capping_Rule in three versions: v1 with a cap of 5000 cents, v2 with a cap of 6000 cents, and v3 with a cap of 7500 cents.
2. IF the receipt date falls outside the declared trip window, THEN the Blocking_Rule defined in the test fixtures SHALL cause `evaluate` to return a `"rejected"` Decision.
3. THE Kernel's test fixtures SHALL define a Deducting_Rule that subtracts the alcohol line-item amount from the line-item sum for the relevant AmountScope.
4. IF the receipt total does not equal the line-item sum, THEN the Capping_Rule defined in the test fixtures SHALL apply a dynamic cap equal to the line-item sum.
5. THE Kernel's test fixtures SHALL include a signature scenario where the Recorded_Adapter fixture returns a claimed total of 48000 cents and line items summing to 4800 cents with an alcohol line item of 650 cents; the expected Decision is `"partially_approved"` with a final `amountCents` of 4150, and the Evidence attached to the capping and deducting rule outcomes SHALL contain both the claimed total (48000) and the line-item sum (4800) as distinct named fields.

---

### Requirement 11: Correctness Properties

**User Story:** As a Bones contributor, I want each core correctness invariant covered by a dedicated fast-check property-based test, so that regressions are caught automatically across a wide range of inputs.

#### Acceptance Criteria

1. THE Test_Suite SHALL include a property test verifying that `evaluate` is deterministic: for all inputs accepted without error by `validate`, calling `evaluate` twice with the same arguments returns deeply structurally equal Decisions.
2. THE Test_Suite SHALL include a property test verifying that `replay(trace, trace.ruleSetVersion, ruleSet, catalog)` returns a Decision deeply structurally equal to the Decision in the original Trace.
3. THE Test_Suite SHALL include a property test verifying that `validate` acts as the sole gate to `evaluate`: for any `proposedFields` that causes `validate` to return a `"validation_failed"` CoreError, the return value is that CoreError and `evaluate` is not invoked.
4. THE Test_Suite SHALL include a property test verifying that `override` never mutates the original Trace: the Trace before and after calling `override` is deeply structurally equal.
5. THE Test_Suite SHALL include a property test verifying that `effectiveResult` returns the Override with the strictly greatest `createdAt` timestamp among all supplied overrides; if the overrides array is empty, the result is the original Decision from the Trace.
6. THE Test_Suite SHALL include a property test verifying that for all inputs accepted without error by `validate`, `0 <= amountCents <= claimedTotalCents` holds on every Decision produced by `evaluate`.
7. THE Test_Suite SHALL include a property test verifying that increasing any Capping_Rule's cap value by any positive integer amount never causes `amountCents` to decrease (weakly monotone with respect to cap increases).
8. THE Test_Suite SHALL include a property test verifying that permuting the order of rules within a RuleSet does not change the Decision or the unordered set of rule outcomes produced by `evaluate`.
9. IF the injected Clock_Port, Id_Port, and Hasher_Port are deterministic stubs returning fixed values, THEN for all inputs accepted without error by `validate`, `evaluate` followed by Trace creation produces byte-for-byte identical Trace JSON for identical inputs.
