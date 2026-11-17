import { createExtractHandler } from "./_lib/handler";
import { createAnthropicClient } from "./_lib/provider";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>(); // per warm instance

export default {
  async fetch(request: Request): Promise<Response> {
    const env = process.env;
    const handler = createExtractHandler({
      env,
      llm: createAnthropicClient({
        apiKey: env.ANTHROPIC_API_KEY ?? "",
        model: env.EXTRACTION_MODEL ?? "",
        fetchImpl: fetch,
      }),
      now: Date.now,
      rateLimitStore,
      log: (e) => console.log(JSON.stringify(e)),
    });
    return handler(request);
  },
};
