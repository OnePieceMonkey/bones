import { createExtractHandler } from "./_lib/handler";
import { createOpenRouterClient } from "./_lib/openrouter";
import { createAnthropicClient } from "./_lib/provider";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>(); // per warm instance

export default {
  async fetch(request: Request): Promise<Response> {
    const env = process.env;
    const model = env.EXTRACTION_MODEL ?? "";
    // Unknown LLM_PROVIDER values are never live (the handler answers 403), so the client choice does not matter there.
    const llm =
      env.LLM_PROVIDER === "openrouter"
        ? createOpenRouterClient({ apiKey: env.OPENROUTER_API_KEY ?? "", model, fetchImpl: fetch })
        : createAnthropicClient({ apiKey: env.ANTHROPIC_API_KEY ?? "", model, fetchImpl: fetch });
    const handler = createExtractHandler({
      env,
      llm,
      now: Date.now,
      rateLimitStore,
      log: (e) => console.log(JSON.stringify(e)),
    });
    return handler(request);
  },
};
