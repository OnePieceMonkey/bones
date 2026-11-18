// OpenRouter chat completions client behind the LlmClient port. Plain fetch, no SDK.
// The key is only placed in the Authorization header. Every failure collapses to
// { ok: false, kind: "upstream" } with no provider text; there are no retries.
import { MODEL_JSON_SCHEMA, SYSTEM_PROMPT, USER_TEXT } from "./schema";

import type { LlmClient } from "./handler";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_TITLE = "Bones Expense Auditor";

// Reasoning tokens count against max_tokens, so the cap is generous, effort is low and
// the reasoning text is excluded from the response.
const MAX_TOKENS = 16000;
const DEFAULT_TIMEOUT_MS = 25_000;

const FAILED = { ok: false, kind: "upstream" } as const;

export function createOpenRouterClient(opts: {
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
        const response = await fetchImpl(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "X-OpenRouter-Title": OPENROUTER_TITLE,
          },
          body: JSON.stringify({
            model,
            max_tokens: MAX_TOKENS,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
                  { type: "text", text: USER_TEXT },
                ],
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: { name: "receipt", strict: true, schema: MODEL_JSON_SCHEMA },
            },
            reasoning: { effort: "low", exclude: true },
            provider: { require_parameters: true },
          }),
          signal: controller.signal,
        });
        if (!response.ok) return FAILED;
        const body: unknown = await response.json();
        if (typeof body !== "object" || body === null) return FAILED;
        const { error, choices } = body as { error?: unknown; choices?: unknown };
        if (error !== undefined && error !== null) return FAILED;
        if (!Array.isArray(choices)) return FAILED;
        const first: unknown = choices[0];
        if (typeof first !== "object" || first === null) return FAILED;
        const { finish_reason, message } = first as { finish_reason?: unknown; message?: unknown };
        if (finish_reason !== "stop") return FAILED;
        if (typeof message !== "object" || message === null) return FAILED;
        const content = (message as { content?: unknown }).content;
        if (typeof content !== "string" || content.length === 0) return FAILED;
        return { ok: true, text: content };
      } catch {
        return FAILED;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
