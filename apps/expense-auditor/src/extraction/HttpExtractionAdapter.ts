import { guardInput } from "@bones/core";
import type { CoreError, ExtractionPort, ExtractionResult, RawInput } from "@bones/core";
import { ERROR_CODES, errorBodySchema, extractionResultWireSchema } from "../../shared/wire";

import { FORBIDDEN_ORIGIN_MESSAGE } from "./messages";

export interface HttpAdapterOptions {
  mediaType: "image/jpeg" | "image/png";
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const CHUNK = 0x8000;

type Reason = Extract<CoreError, { kind: "extraction_failed" }>["reason"];

const CODE_MESSAGES: Record<(typeof ERROR_CODES)[number], string> = {
  disabled: "Live reading is switched off.",
  forbidden_origin: FORBIDDEN_ORIGIN_MESSAGE,
  method_not_allowed: "The reading service rejected the request method.",
  bad_request: "The reading service could not use this photo.",
  too_large: "The photo is too large for live reading.",
  rate_limited: "Too many requests. Please wait a moment and try again.",
  upstream_failed: "The reading service could not read the photo. Please try again.",
  model_output_invalid: "The reading service returned an answer that did not pass the checks.",
};

function failed(reason: Reason, message: string): CoreError {
  return { kind: "extraction_failed", message, reason };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Sends image bytes to the server function. The browser never holds a provider key. */
export class HttpExtractionAdapter implements ExtractionPort {
  private readonly mediaType: HttpAdapterOptions["mediaType"];
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: HttpAdapterOptions) {
    this.mediaType = options.mediaType;
    this.endpoint = options.endpoint ?? "/api/extract";
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async extract(input: RawInput): Promise<ExtractionResult | CoreError> {
    const guard = guardInput(input);
    if (guard !== null) return guard;

    if (typeof input === "string") {
      return {
        kind: "validation_failed",
        message: "Validation failed with 1 error(s)",
        fieldErrors: [{ path: "input", issue: "expected image bytes" }],
      };
    }

    const body = JSON.stringify({ imageBase64: toBase64(input), mediaType: this.mediaType });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let res: Response;
      try {
        res = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          signal: controller.signal,
        });
      } catch {
        return failed("network", "The reading service could not be reached.");
      }

      if (!res.ok) {
        let errBody: unknown;
        try {
          errBody = await res.json();
        } catch {
          errBody = undefined;
        }
        const parsed = errorBodySchema.safeParse(errBody);
        if (parsed.success) {
          const { reason, code } = parsed.data.error;
          return failed(reason, CODE_MESSAGES[code]);
        }
        return res.status >= 500
          ? failed("upstream", "The reading service failed.")
          : failed("bad_response", "The reading service sent an unexpected answer.");
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        return failed("bad_response", "The reading service sent an unexpected answer.");
      }
      const result = extractionResultWireSchema.safeParse(json);
      if (!result.success) {
        return failed("bad_response", "The reading service sent an unexpected answer.");
      }
      return result.data as ExtractionResult;
    } finally {
      clearTimeout(timer);
    }
  }
}
