// Anthropic Messages API client behind the LlmClient port. Plain fetch, no SDK.
// The key is only placed in the x-api-key header. Every failure collapses to
// { ok: false, kind: "upstream" } with no provider text; there are no retries.
import { MODEL_JSON_SCHEMA, SYSTEM_PROMPT } from "./schema";

// Structurally identical to LlmClient in ./handler (design.md); declared here so
// this module does not depend on the handler.
interface LlmClient {
  readReceipt(args: { imageBase64: string; mediaType: "image/jpeg" | "image/png" }): Promise<
    { ok: true; text: string } | { ok: false; kind: "upstream" }
  >;
}

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// From the API versions page. In this version temperature, top_p and top_k are removed.
export const ANTHROPIC_VERSION = "2026-10-21";

// Haiku 5.5 always thinks adaptively and thinking tokens count against max_tokens,
// so the cap is generous and effort is low. No `thinking` field (400), no tool_choice,
// temperature, top_p or top_k.
const MAX_TOKENS = 16000;
const EFFORT = "low";
const DEFAULT_TIMEOUT_MS = 25_000;
const USER_TEXT = "Read this receipt and fill the JSON schema.";

const FAILED = { ok: false, kind: "upstream" } as const;

export function createAnthropicClient(opts: {
  apiKey: string;
  model: string;
  fetchImpl: typeof fetch;
  timeoutMs?: number;
}): LlmClient {
  const { apiKey, model, fetchImpl } = opts;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    async readReceipt({ imageBase64, mediaType }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(ANTHROPIC_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model,
            max_tokens: MAX_TOKENS,
            system: SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: [
                  { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
                  { type: "text", text: USER_TEXT },
                ],
              },
            ],
            output_config: {
              effort: EFFORT,
              format: { type: "json_schema", schema: MODEL_JSON_SCHEMA },
            },
          }),
          signal: controller.signal,
        });
        if (!response.ok) return FAILED;
        const body: unknown = await response.json();
        if (typeof body !== "object" || body === null) return FAILED;
        const { stop_reason, content } = body as { stop_reason?: unknown; content?: unknown };
        if (stop_reason === "refusal" || stop_reason === "max_tokens") return FAILED;
        if (!Array.isArray(content)) return FAILED;
        for (const block of content) {
          if (
            typeof block === "object" &&
            block !== null &&
            (block as { type?: unknown }).type === "text" &&
            typeof (block as { text?: unknown }).text === "string"
          ) {
            return { ok: true, text: (block as { text: string }).text };
          }
        }
        return FAILED;
      } catch {
        return FAILED;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
