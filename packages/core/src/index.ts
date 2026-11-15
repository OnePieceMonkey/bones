// Types
export type {
  Confidence,
  SourceLocation,
  ProposedFields,
  ValidatedFields,
  ExtractionResult,
  LiteralOrPath,
  ComparisonOp,
  ConditionNode,
  RuleEffect,
  BlockingConfig,
  CappingConfig,
  DeductingConfig,
  Rule,
  RuleRef,
  RuleSet,
  RuleCatalog,
  DecisionResult,
  AmountScope,
  RuleOutcome,
  Decision,
  Trace,
  Override,
  KernelPorts,
  CoreError,
} from "./types.js";

// Constants and helpers
export { TRACE_SCHEMA_VERSION, isCoreError } from "./types.js";

// Condition AST
export { getPath, evaluateCondition } from "./rules/ast.js";

// Rule schemas
export { conditionNodeSchema, ruleSchema, ruleSetSchema, parseRule, parseRuleSet } from "./rules/schema.js";

// Extraction
export type { ExtractionPort, RawInput } from "./extraction/port.js";
export { guardInput } from "./extraction/port.js";
export { LiveAdapter } from "./extraction/live.js";

// Core pipeline
export { validate } from "./validation.js";
export { evaluate } from "./rules/evaluate.js";
export { formatMoney, renderTemplate, DEFAULT_CURRENCY_SYMBOL } from "./rules/template.js";
export { createTrace, deepFreeze } from "./trace.js";
export { replay } from "./replay.js";
export { override, effectiveResult } from "./override.js";
