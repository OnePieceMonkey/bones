import type { ExtractionResult, CoreError } from "../types.js";

export type RawInput = string | Uint8Array;

const MAX_BYTES = 10_485_760; // 10 MB

/**
 * Guards raw input for size/emptiness constraints.
 * Returns a CoreError if the input is invalid, null otherwise.
 * Called before invoking any adapter.
 */
export function guardInput(input: RawInput): CoreError | null {
  if (typeof input === "string") {
    if (input.length === 0) {
      return { kind: "input_empty", message: "Input string must not be empty." };
    }
    return null;
  }
  // Uint8Array
  if (input.byteLength === 0) {
    return { kind: "input_empty", message: "Input bytes must not be empty." };
  }
  if (input.byteLength > MAX_BYTES) {
    return {
      kind: "input_too_large",
      message: `Input exceeds maximum size of ${MAX_BYTES} bytes (got ${input.byteLength}).`,
      byteLength: input.byteLength,
      maxBytes: MAX_BYTES,
    };
  }
  return null;
}

/**
 * The typed interface for all LLM extraction adapters.
 * The kernel owns this interface; adapters are injected by the application.
 */
export interface ExtractionPort {
  extract(input: RawInput): Promise<ExtractionResult | CoreError>;
}
