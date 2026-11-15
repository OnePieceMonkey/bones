// ─── Primitive types ──────────────────────────────────────────────────────────

/** Per-field numeric extraction confidence. Closed interval [0, 1]. */
export type Confidence = number;

/** Per-field location in the original input. */
export type SourceLocation =
  | { kind: "line"; lineIndex: number }
  | { kind: "bbox"; x: number; y: number; width: number; height: number };

/** Raw proposed values keyed by field name, as returned by an extraction adapter. */
export type ProposedFields = Record<string, unknown>;

/** Validated field values, produced by validate() and safe to pass to evaluate(). */
export type ValidatedFields = Record<string, unknown>;

// ─── Extraction types ─────────────────────────────────────────────────────────

/** The result returned by an ExtractionPort adapter on success. */
export interface ExtractionResult {
  proposedFields: ProposedFields;
  confidence: Record<string, Confidence>;
  sources: Record<string, SourceLocation | undefined>;
  rawModelOutput: string;
}

// ─── Condition AST ────────────────────────────────────────────────────────────

/** Either a literal value or a dot-separated path into ValidatedFields. */
export type LiteralOrPath =
  | { kind: "literal"; value: unknown }
  | { kind: "path"; segments: string[] }; // 1–10 segments, total ≤ 256 chars

export type ComparisonOp = "==" | "!=" | "<" | "<=" | ">" | ">=";

/**
 * A restricted condition AST. Exactly four node kinds are valid.
 * No eval, no I/O, no randomness, no access to the current time.
 */
export type ConditionNode =
  | { kind: "comparison"; left: LiteralOrPath; op: ComparisonOp; right: LiteralOrPath }
  | { kind: "sum"; collection: string; field: string }
  | { kind: "date_in_range"; dateField: string; startField: string; endField: string }
  | { kind: "membership"; valueField: string; set: unknown[] };

// ─── Rule types ───────────────────────────────────────────────────────────────

export type RuleEffect = "blocking" | "capping" | "deducting";

/** effectConfig for blocking rules — no configuration fields. */
export type BlockingConfig = Record<string, never>;

/** effectConfig for capping rules — cap may be a constant or a dynamic AST expression. */
export interface CappingConfig {
  cap: number | ConditionNode;
  scope: string;
}

/** effectConfig for deducting rules — deduction amount in integer cents (constant or dynamic AST expression). */
export interface DeductingConfig {
  deductionAmount: number | ConditionNode; // positive integer cents, or a ConditionNode whose _sum evidence is used
  scope: string;
}

export interface Rule {
  id: string;         // non-empty, ≤ 128 chars
  version: string;    // MAJOR.MINOR.PATCH
  effect: RuleEffect;
  condition: ConditionNode;
  effectConfig: BlockingConfig | CappingConfig | DeductingConfig;
  messageTemplate: string; // ≤ 1024 chars, may contain {{fieldPath}} slots
}

export interface RuleRef {
  ruleId: string;
  ruleVersion: string;
}

export interface RuleSet {
  id: string;      // non-empty, ≤ 128 chars
  version: string; // MAJOR.MINOR.PATCH
  rules: RuleRef[]; // 0–200 entries
  currencySymbol?: string; // 1 to 4 characters, default "$"
}

/** Rule catalog — keyed by `${id}@${version}`. */
export type RuleCatalog = Map<string, Rule>;

// ─── Decision types ───────────────────────────────────────────────────────────

export type DecisionResult = "approved" | "partially_approved" | "rejected";

export interface AmountScope {
  name: string;
  claimedCents: number; // positive integer
}

export interface RuleOutcome {
  ruleId: string;
  ruleVersion: string;
  effect: RuleEffect;
  conditionMet: boolean;
  evidence: Record<string, unknown>;
  renderedMessage: string;
  deductedCents?: number;   // deducting rules only
  appliedCapCents?: number; // capping rules only
  /**
   * Running amount in the rule's scope immediately before this rule is applied.
   * Integer cents. Absent on blocking outcomes.
   */
  amountBeforeCents?: number;
  /**
   * Running amount in the rule's scope immediately after this rule is applied.
   * Integer cents. Absent on blocking outcomes.
   */
  amountAfterCents?: number;
}

export interface Decision {
  result: DecisionResult;
  amountCents: number; // integer >= 0
  ruleOutcomes: RuleOutcome[];
}

// ─── Trace ────────────────────────────────────────────────────────────────────

export const TRACE_SCHEMA_VERSION = "1" as const;

export interface Trace {
  readonly traceSchemaVersion: typeof TRACE_SCHEMA_VERSION;
  readonly decisionId: string;
  readonly createdAt: string;           // ISO 8601 UTC
  readonly inputHash: string;           // SHA-256 hex
  readonly rawModelOutput: string;
  readonly proposedFields: ProposedFields;
  readonly confidence: Record<string, Confidence>;
  readonly sources: Record<string, SourceLocation | undefined>;
  readonly validatedFields: ValidatedFields;
  readonly ruleSetId: string;
  readonly ruleSetVersion: string;
  readonly ruleOutcomes: readonly RuleOutcome[];
  readonly result: DecisionResult;
  readonly amountCents: number;
}

// ─── Override ─────────────────────────────────────────────────────────────────

export interface Override {
  readonly decisionId: string;           // links to Trace.decisionId
  readonly reviewerName: string;
  readonly reason: string;
  readonly replacementResult: DecisionResult;
  readonly createdAt: string;            // ISO 8601 UTC
  readonly metadata?: Record<string, unknown>;
}

// ─── Port interfaces ──────────────────────────────────────────────────────────

export interface KernelPorts {
  clock:  () => Date;
  id:     () => string;
  hasher: (bytes: Uint8Array) => string;
}

// ─── CoreError ────────────────────────────────────────────────────────────────

export type CoreError =
  | { kind: "live_adapter_not_implemented"; message: string }
  | { kind: "fixture_not_found";            message: string; fixturePath: string }
  | { kind: "fixture_invalid";              message: string; fixturePath: string; parseError: string }
  | { kind: "validation_failed";            message: string; fieldErrors: { path: string; issue: string }[] }
  | { kind: "rule_not_found";               message: string; ruleId: string; ruleVersion: string }
  | { kind: "invalid_condition_ast";        message: string; nodeKind: string }
  | { kind: "trace_schema_mismatch";        message: string; found: string; expected: string }
  | { kind: "ambiguous_override";           message: string; createdAt: string }
  | { kind: "invalid_rule_schema";          message: string; fieldErrors: { path: string; issue: string }[] }
  | { kind: "invalid_rule_set_schema";      message: string; fieldErrors: { path: string; issue: string }[] }
  | { kind: "invalid_effect_config";        message: string; ruleId: string; ruleVersion: string }
  | { kind: "input_empty";                  message: string }
  | { kind: "input_too_large";              message: string; byteLength: number; maxBytes: number }
  | { kind: "invalid_replay_arguments";     message: string; missingField: string }
  | { kind: "invalid_override_input";       message: string; field: "reviewerName" | "reason" }
  | { kind: "extraction_failed";            message: string; reason: "disabled" | "network" | "bad_response" | "upstream" };

const CORE_ERROR_KINDS = new Set<string>([
  "live_adapter_not_implemented",
  "fixture_not_found",
  "fixture_invalid",
  "validation_failed",
  "rule_not_found",
  "invalid_condition_ast",
  "trace_schema_mismatch",
  "ambiguous_override",
  "invalid_rule_schema",
  "invalid_rule_set_schema",
  "invalid_effect_config",
  "input_empty",
  "input_too_large",
  "invalid_replay_arguments",
  "invalid_override_input",
  "extraction_failed",
]);

export function isCoreError(v: unknown): v is CoreError {
  return (
    typeof v === "object" &&
    v !== null &&
    "kind" in v &&
    CORE_ERROR_KINDS.has((v as { kind: string }).kind)
  );
}
