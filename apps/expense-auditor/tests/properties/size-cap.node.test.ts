import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createExtractHandler, type LlmClient } from "../../api/_lib/handler";
import { errorBodySchema, MAX_IMAGE_BYTES } from "../../shared/wire";
import { fakeLlm, makeRequest } from "../helpers/fakes";

type Outcome = Awaited<ReturnType<LlmClient["readReceipt"]>>;

const MAGIC = {
  "image/jpeg": [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00],
} as const;

const VALID_TEXT = JSON.stringify({});

function imageOfSize(size: number, mediaType: keyof typeof MAGIC): string {
  const bytes = Buffer.alloc(size, 0x41);
  Buffer.from(MAGIC[mediaType]).copy(bytes);
  return bytes.toString("base64");
}

async function run(size: number, mediaType: keyof typeof MAGIC) {
  const llm = fakeLlm<Outcome>([{ ok: true, text: VALID_TEXT }]);
  const client: LlmClient = { readReceipt: (args) => llm.call(args) };
  const handler = createExtractHandler({
    env: { LIVE_EXTRACTION: "on", ANTHROPIC_API_KEY: "sk-test-fake", EXTRACTION_MODEL: "model-test" },
    llm: client,
    now: () => 1_700_000_000_000,
    rateLimitStore: new Map(),
  });
  const res = await handler(makeRequest("POST", { imageBase64: imageOfSize(size, mediaType), mediaType }));
  return { res, calls: llm.calls.length };
}

const arbSize = fc.oneof(
  fc.integer({ min: MAX_IMAGE_BYTES - 40, max: MAX_IMAGE_BYTES + 40 }),
  fc.constantFrom(MAX_IMAGE_BYTES - 1, MAX_IMAGE_BYTES, MAX_IMAGE_BYTES + 1),
  fc.integer({ min: 10, max: 4096 }),
);
const arbMedia = fc.constantFrom<keyof typeof MAGIC>("image/jpeg", "image/png");

// Feature: expense-auditor, Property 20: Size cap
// **Validates: Requirements 16.12**
describe("Property 20: Size cap", () => {
  it("calls the provider if and only if the decoded size is at most 3 MiB; larger images give 413 without a call", async () => {
    await fc.assert(
      fc.asyncProperty(arbSize, arbMedia, async (size, mediaType) => {
        const { res, calls } = await run(size, mediaType);
        if (size <= MAX_IMAGE_BYTES) {
          expect(calls).toBe(1);
          expect(res.status).not.toBe(413);
        } else {
          expect(calls).toBe(0);
          expect(res.status).toBe(413);
          expect(errorBodySchema.parse(await res.json()).error.code).toBe("too_large");
        }
      }),
      { numRuns: 100 },
    );
  });
});
