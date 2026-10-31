import type { ConditionNode, ValidatedFields, CoreError } from "../types.js";

/** Safely resolves a dot-separated path in ValidatedFields. Never throws. Returns undefined if any segment is missing. */
export function getPath(fields: ValidatedFields, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = fields;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

type ConditionResult = { result: boolean; evidence: Record<string, unknown> };

/** Evaluates a ConditionNode against ValidatedFields. Returns a result+evidence pair or a CoreError. */
export function evaluateCondition(
  node: ConditionNode,
  fields: ValidatedFields
): ConditionResult | CoreError {
  switch (node.kind) {
    case "comparison": {
      // Validate path segments
      for (const side of [node.left, node.right]) {
        if (side.kind === "path" && side.segments.length > 10) {
          return {
            kind: "invalid_condition_ast",
            message: `Path has more than 10 segments: ${side.segments.join(".")}`,
            nodeKind: node.kind,
          };
        }
        if (side.kind === "path" && side.segments.join(".").length > 256) {
          return {
            kind: "invalid_condition_ast",
            message: `Path exceeds 256 characters: ${side.segments.join(".")}`,
            nodeKind: node.kind,
          };
        }
      }
      const leftVal = node.left.kind === "literal"
        ? node.left.value
        : getPath(fields, node.left.segments.join("."));
      const rightVal = node.right.kind === "literal"
        ? node.right.value
        : getPath(fields, node.right.segments.join("."));
      const evidence: Record<string, unknown> = {};
      if (node.left.kind === "path") evidence[node.left.segments.join(".")] = leftVal;
      if (node.right.kind === "path") evidence[node.right.segments.join(".")] = rightVal;
      let result: boolean;
      switch (node.op) {
        case "==": result = leftVal === rightVal; break;
        case "!=": result = leftVal !== rightVal; break;
        case "<":  result = Number(leftVal) < Number(rightVal); break;
        case "<=": result = Number(leftVal) <= Number(rightVal); break;
        case ">":  result = Number(leftVal) > Number(rightVal); break;
        case ">=": result = Number(leftVal) >= Number(rightVal); break;
        default:   result = false;
      }
      return { result, evidence };
    }

    case "sum": {
      const arr = getPath(fields, node.collection);
      const items = Array.isArray(arr) ? arr : [];
      let total = 0;
      for (const item of items) {
        if (item !== null && typeof item === "object") {
          const val = (item as Record<string, unknown>)[node.field];
          if (typeof val === "number" && !isNaN(val)) total += val;
        }
      }
      const evidence: Record<string, unknown> = {
        [node.collection]: arr,
        [`${node.collection}[*].${node.field}_sum`]: total,
      };
      return { result: total > 0, evidence };
    }

    case "date_in_range": {
      const dateVal = getPath(fields, node.dateField);
      const startVal = getPath(fields, node.startField);
      const endVal = getPath(fields, node.endField);
      if (
        typeof dateVal !== "string" ||
        typeof startVal !== "string" ||
        typeof endVal !== "string"
      ) {
        return {
          kind: "invalid_condition_ast",
          message: `date_in_range fields must be ISO 8601 strings; got dateField=${String(dateVal)}, startField=${String(startVal)}, endField=${String(endVal)}`,
          nodeKind: node.kind,
        };
      }
      const date = new Date(dateVal);
      const start = new Date(startVal);
      const end = new Date(endVal);
      if (isNaN(date.getTime()) || isNaN(start.getTime()) || isNaN(end.getTime())) {
        return {
          kind: "invalid_condition_ast",
          message: `date_in_range received an invalid date string`,
          nodeKind: node.kind,
        };
      }
      const evidence: Record<string, unknown> = {
        [node.dateField]: dateVal,
        [node.startField]: startVal,
        [node.endField]: endVal,
      };
      return { result: date >= start && date <= end, evidence };
    }

    case "membership": {
      const val = getPath(fields, node.valueField);
      const valJson = JSON.stringify(val);
      const result = node.set.some((item) => JSON.stringify(item) === valJson);
      const evidence: Record<string, unknown> = {
        [node.valueField]: val,
        set: node.set,
      };
      return { result, evidence };
    }

    default: {
      const exhaustive = node as { kind: string };
      return {
        kind: "invalid_condition_ast",
        message: `Unknown condition node kind: "${exhaustive.kind}"`,
        nodeKind: exhaustive.kind,
      };
    }
  }
}
