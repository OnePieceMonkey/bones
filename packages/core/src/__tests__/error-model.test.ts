import { describe, it, expect } from "vitest";
import { isCoreError } from "../types.js";
import type { CoreError, DecisionResult } from "../types.js";

const fieldErrors = [{ path: "total", issue: "required" }];

const SAMPLES: Record<CoreError["kind"], CoreError> = {
  live_adapter_not_implemented: { kind: "live_adapter_not_implemented", message: "m" },
  fixture_not_found: { kind: "fixture_not_found", message: "m", fixturePath: "a.json" },
  fixture_invalid: { kind: "fixture_invalid", message: "m", fixturePath: "a.json", parseError: "bad" },
  validation_failed: { kind: "validation_failed", message: "m", fieldErrors },
  rule_not_found: { kind: "rule_not_found", message: "m", ruleId: "r", ruleVersion: "1.0.0" },
  invalid_condition_ast: { kind: "invalid_condition_ast", message: "m", nodeKind: "x" },
  trace_schema_mismatch: { kind: "trace_schema_mismatch", message: "m", found: "0", expected: "1" },
  ambiguous_override: { kind: "ambiguous_override", message: "m", createdAt: "2024-01-01T00:00:00.000Z" },
  invalid_rule_schema: { kind: "invalid_rule_schema", message: "m", fieldErrors },
  invalid_rule_set_schema: { kind: "invalid_rule_set_schema", message: "m", fieldErrors },
  invalid_effect_config: { kind: "invalid_effect_config", message: "m", ruleId: "r", ruleVersion: "1.0.0" },
  input_empty: { kind: "input_empty", message: "m" },
  input_too_large: { kind: "input_too_large", message: "m", byteLength: 10, maxBytes: 5 },
  invalid_replay_arguments: { kind: "invalid_replay_arguments", message: "m", missingField: "hasher" },
  invalid_override_input: { kind: "invalid_override_input", message: "m", field: "reason" },
  extraction_failed: { kind: "extraction_failed", message: "m", reason: "network" },
};

const DOCUMENTED_KINDS = [
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
];

const RESULT_LITERALS: DecisionResult[] = ["approved", "partially_approved", "rejected"];

describe("CoreError model", () => {
  it("covers exactly the 16 documented kinds", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...DOCUMENTED_KINDS].sort());
    expect(DOCUMENTED_KINDS).toHaveLength(16);
  });

  it("each sample carries its own kind and is accepted by isCoreError", () => {
    for (const [kind, sample] of Object.entries(SAMPLES)) {
      expect(sample.kind).toBe(kind);
      expect(isCoreError(sample)).toBe(true);
    }
  });

  it.each([
    ["approved", "approved"],
    ["partially_approved", "partially_approved"],
    ["rejected", "rejected"],
    ["null", null],
    ["undefined", undefined],
    ["empty object", {}],
    ["unknown kind", { kind: "other" }],
    ["plain string", "extraction_failed"],
  ])("isCoreError rejects %s", (_name, value) => {
    expect(isCoreError(value)).toBe(false);
  });

  it("no CoreError kind equals a decision result literal", () => {
    for (const kind of Object.keys(SAMPLES)) {
      expect(RESULT_LITERALS as string[]).not.toContain(kind);
    }
  });

  it("accepts all four extraction_failed reasons", () => {
    const reasons: Extract<CoreError, { kind: "extraction_failed" }>["reason"][] = [
      "disabled",
      "network",
      "bad_response",
      "upstream",
    ];
    for (const reason of reasons) {
      const err: CoreError = { kind: "extraction_failed", message: "m", reason };
      expect(isCoreError(err)).toBe(true);
    }
    expect(new Set(reasons).size).toBe(4);
  });
});
