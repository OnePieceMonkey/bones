import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createExtractHandler, type LlmClient } from "../../api/_lib/handler";
import { errorBodySchema } from "../../shared/wire";
import { fakeLlm, makeRequest } from "../helpers/fakes";

type Outcome = Awaited<ReturnType<LlmClient["readReceipt"]>>;

// LIVE_EXTRACTION values that are anything but the exact string "on".
const arbFlag = fc.oneof(
  fc.constant(undefined),
  fc.constantFrom("", "ON", "On", "true", "1", "yes", " on", "on ", "off"),
  fc.string().filter((s) => s !== "on"),
);
const arbOptional = fc.oneof(fc.constant(undefined), fc.string());
const arbEnvNotOn = fc
  .record({ LIVE_EXTRACTION: arbFlag, ANTHROPIC_API_KEY: arbOptional, EXTRACTION_MODEL: arbOptional })
  .map((e) => ({ ...e }) as Record<string, string | undefined>);

const arbBody = fc.oneof(
  fc.string(),
  fc.json(),
  fc.record({ imageBase64: fc.string(), mediaType: fc.constantFrom("image/jpeg", "image/png", "image/gif") }),
  fc.constant({ imageBase64: "/9j/4AAQSkZJRgABAQAAAQABAAD/", mediaType: "image/jpeg" }),
);

function build(env: Record<string, string | undefined>) {
  const llm = fakeLlm<Outcome>([{ ok: true, text: "{}" }]);
  const client: LlmClient = { readReceipt: (args) => llm.call(args) };
  const handler = createExtractHandler({ env, llm: client, now: () => 1_700_000_000_000, rateLimitStore: new Map() });
  return { handler, llm };
}

// Feature: expense-auditor, Property 17: The kill switch blocks the provider
// **Validates: Requirements 16.2, 16.3, 16.4**
describe("Property 17: The kill switch blocks the provider", () => {
  it("answers 403 disabled to any POST and never calls the LLM", async () => {
    await fc.assert(
      fc.asyncProperty(arbEnvNotOn, arbBody, fc.option(fc.webUrl(), { nil: undefined }), async (env, body, origin) => {
        const { handler, llm } = build(env);
        const res = await handler(makeRequest("POST", body, origin ? { origin } : {}));
        expect(res.status).toBe(403);
        expect(errorBodySchema.parse(await res.json()).error.reason).toBe("disabled");
        expect(llm.calls).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  it("answers GET with exactly {\"live\":false}", async () => {
    await fc.assert(
      fc.asyncProperty(arbEnvNotOn, async (env) => {
        const { handler, llm } = build(env);
        const res = await handler(makeRequest("GET"));
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('{"live":false}');
        expect(llm.calls).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });
});
