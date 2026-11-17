import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createExtractHandler, type LlmClient } from "../../api/_lib/handler";
import { errorBodySchema, extractionResultWireSchema, toExtractionResult, modelOutputSchema } from "../../shared/wire";
import { arbBadModelOutput, arbValidModelOutput } from "../helpers/arbitraries";
import { fakeLlm, makeRequest } from "../helpers/fakes";

type Outcome = Awaited<ReturnType<LlmClient["readReceipt"]>>;

const JPEG_B64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/";
const body = { imageBase64: JPEG_B64, mediaType: "image/jpeg" };

function run(text: string) {
  const llm = fakeLlm<Outcome>([{ ok: true, text }]);
  const client: LlmClient = { readReceipt: (args) => llm.call(args) };
  const handler = createExtractHandler({
    env: { LIVE_EXTRACTION: "on", ANTHROPIC_API_KEY: "sk-test-fake", EXTRACTION_MODEL: "model-test" },
    llm: client,
    now: () => 1_700_000_000_000,
    rateLimitStore: new Map(),
  });
  return handler(makeRequest("POST", body));
}

// Feature: expense-auditor, Property 19: Model output validation is strict and lossless
// **Validates: Requirements 16.6, 16.7, 16.8**
describe("Property 19: Model output validation is strict and lossless", () => {
  it("answers 200 with rawModelOutput equal to the exact provider text for valid output", async () => {
    await fc.assert(
      fc.asyncProperty(arbValidModelOutput, async ({ output, text }) => {
        const res = await run(text);
        expect(res.status).toBe(200);
        const json = extractionResultWireSchema.parse(await res.json());
        expect(json.rawModelOutput).toBe(text);
        expect(json).toEqual(toExtractionResult(modelOutputSchema.parse(output), text));
      }),
      { numRuns: 100 },
    );
  });

  it("answers 502 model_output_invalid for output with one injected defect", async () => {
    await fc.assert(
      fc.asyncProperty(arbBadModelOutput, async ({ text }) => {
        const res = await run(text);
        expect(res.status).toBe(502);
        const json = errorBodySchema.parse(await res.json());
        expect(json.error.code).toBe("model_output_invalid");
      }),
      { numRuns: 100 },
    );
  });
});
