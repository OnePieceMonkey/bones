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
