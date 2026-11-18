import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createExtractHandler } from "../../api/_lib/handler";
import { createOpenRouterClient } from "../../api/_lib/openrouter";
import { createAnthropicClient } from "../../api/_lib/provider";
import { fakeFetch, makeRequest } from "../helpers/fakes";

const JPEG_B64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/";
const VALID_OUTPUT = JSON.stringify({
  merchant: "Cafe Test",
  receiptDate: "2025-03-14",
  claimedTotalCents: 1250,
  lineItems: [{ description: "Coffee", amount: 1250, isAlcohol: false }],
  confidence: { merchant: 0.9, receiptDate: 0.9, claimedTotalCents: 0.9, lineItems: 0.9 },
});

// Fake keys only; never a real credential.
const arbKey = fc.stringMatching(/^[A-Za-z0-9_-]{20,40}$/).map((s) => `sk-test-${s}`);

type Provider =
  | { kind: "throw" }
  | { kind: "status"; status: number }
  | { kind: "text"; text: "valid" | "garbage" | "echo" }
  | { kind: "stop"; reason: "refusal" | "max_tokens" };
const arbProvider: fc.Arbitrary<Provider> = fc.oneof(
  fc.constant<Provider>({ kind: "throw" }),
  fc.constantFrom(400, 401, 403, 429, 500, 529).map((status): Provider => ({ kind: "status", status })),
  fc.constantFrom<"valid" | "garbage" | "echo">("valid", "garbage", "echo").map((text): Provider => ({ kind: "text", text })),
  fc.constantFrom<"refusal" | "max_tokens">("refusal", "max_tokens").map((reason): Provider => ({ kind: "stop", reason })),
);

const arbBody = (key: string): fc.Arbitrary<string> =>
  fc.oneof(
    fc.string(),
    fc.json(),
    fc.constant(JSON.stringify({ imageBase64: JPEG_B64, mediaType: "image/jpeg" })),
    fc.constant(JSON.stringify({ imageBase64: key, mediaType: "image/png" })),
    fc.constant(JSON.stringify({ imageBase64: JPEG_B64, mediaType: "image/jpeg", [key]: 1 })),
    fc.string().map((s) => JSON.stringify({ imageBase64: `${JPEG_B64}${s}`, mediaType: "image/jpeg" })),
  );

const arbHeaders = (key: string): fc.Arbitrary<Record<string, string>> =>
  fc.record(
    {
      origin: fc.constantFrom("http://localhost", "http://evil.example"),
      "x-forwarded-for": fc.constantFrom("1.2.3.4", key),
    },
    { requiredKeys: [] },
  );

function providerFetch(p: Provider, key: string, which: Which) {
  return fakeFetch((_url, _init) => {
    if (which === "openrouter") return openRouterResponse(p, key);
    switch (p.kind) {
      case "throw":
        throw new Error(`connect failed using x-api-key ${key}`);
      case "status":
        return new Response(JSON.stringify({ error: { message: `invalid key ${key}` } }), { status: p.status });
      case "stop":
        return Response.json({ stop_reason: p.reason, content: [{ type: "text", text: key }] });
      case "text": {
        const text = p.text === "valid" ? VALID_OUTPUT : p.text === "garbage" ? `not json ${key}` : `{"merchant":"${key}"}`;
        return Response.json({ stop_reason: "end_turn", content: [{ type: "text", text }] });
      }
    }
  });
}

type Which = "anthropic" | "openrouter";
const arbWhich = fc.constantFrom<Which>("anthropic", "openrouter");
// OpenRouter-style answers, including error objects and a thrown fetch that carries the key.
function openRouterResponse(p: Provider, key: string): Response {
  const choice = (finish_reason: string | null, content: unknown) =>
    Response.json({ choices: [{ finish_reason, message: { role: "assistant", content } }] });
  switch (p.kind) {
    case "throw":
      throw new Error(`connect failed using Authorization: Bearer ${key}`);
    case "status":
      return new Response(JSON.stringify({ error: { code: p.status, message: `invalid key ${key}` } }), { status: p.status });
    case "stop":
      return p.reason === "refusal"
        ? Response.json({ error: { code: 400, message: `moderation ${key}` } })
        : choice("length", key);
    case "text": {
      const text = p.text === "valid" ? VALID_OUTPUT : p.text === "garbage" ? `not json ${key}` : `{"merchant":"${key}"}`;
      return choice("stop", text);
    }
  }
}
// Feature: expense-auditor, Property 18: The key never leaves the server
// **Validates: Requirements 16.5, 19.2**
describe("Property 18: The key never leaves the server", () => {
  it("keeps the key out of responses and logs and sends it only as the provider auth header (x-api-key or Authorization)", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbKey.chain((key) => fc.tuple(fc.constant(key), arbProvider, arbBody(key), arbHeaders(key), arbWhich)),
        async ([key, provider, body, headers, which]) => {
          const fetchImpl = providerFetch(provider, key, which);
          const logged: unknown[] = [];
          const handler = createExtractHandler({
            env:
              which === "openrouter"
                ? { LIVE_EXTRACTION: "on", LLM_PROVIDER: "openrouter", OPENROUTER_API_KEY: key, EXTRACTION_MODEL: "model-test" }
                : { LIVE_EXTRACTION: "on", ANTHROPIC_API_KEY: key, EXTRACTION_MODEL: "model-test" },
            llm:
              which === "openrouter"
                ? createOpenRouterClient({ apiKey: key, model: "model-test", fetchImpl })
                : createAnthropicClient({ apiKey: key, model: "model-test", fetchImpl }),
            now: () => 1_700_000_000_000,
            rateLimitStore: new Map(),
            log: (e) => logged.push(e),
          });

          const responses = [
            await handler(makeRequest("GET", undefined, headers)),
            await handler(makeRequest("POST", body, headers)),
          ];
          for (const res of responses) {
            expect(await res.clone().text()).not.toContain(key);
            for (const [name, value] of res.headers) {
              expect(name).not.toContain(key);
              expect(value).not.toContain(key);
            }
          }
          expect(JSON.stringify(logged)).not.toContain(key);

          for (const { url, init } of fetchImpl.calls) {
            expect(url).not.toContain(key);
            expect(String(init?.body ?? "")).not.toContain(key);
            for (const [name, value] of Object.entries(init?.headers as Record<string, string>)) {
              if (name === "x-api-key") expect(value).toBe(key);
              else if (name === "Authorization") expect(value).toBe(`Bearer ${key}`);
              else expect(`${name}:${value}`).not.toContain(key);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
