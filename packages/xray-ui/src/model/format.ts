import type { Anatomy, DecisionResult } from "../types";

export type Formatter = (path: string, value: unknown) => string;

/** Total formatter: never throws for any input. */
export function defaultFormat(_path: string, value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  try {
    const json = JSON.stringify(value) as string | undefined;
    return json ?? String(value);
  } catch {
    try {
      return String(value);
    } catch {
      return "";
    }
  }
}

/** Wraps the host formatter; falls back to defaultFormat on throw or non-string output. */
export function safeFormat(anatomy: Anatomy): Formatter {
  return (path, value) => {
    try {
      const s: unknown = anatomy.formatValue
        ? anatomy.formatValue(path, value)
        : defaultFormat(path, value);
      return typeof s === "string" ? s : defaultFormat(path, value);
    } catch {
      return defaultFormat(path, value);
    }
  };
}

export function resultLabel(result: DecisionResult): string {
  switch (result) {
    case "approved":
      return "APPROVED";
    case "partially_approved":
      return "PARTIALLY APPROVED";
    case "rejected":
      return "REJECTED";
    default:
      return String(result).toUpperCase().replace(/_/g, " ");
  }
}
