import { describe, expect, it } from "vitest";
import { ANTHROPIC_URL, ANTHROPIC_VERSION, createAnthropicClient } from "../../api/_lib/provider";
import { MODEL_JSON_SCHEMA } from "../../api/_lib/schema";
import { fakeFetch } from "../helpers/fakes";

const KEY = "sk-test-key-not-real";
const ARGS = { imageBase64: "AAAA", mediaType: "image/png" } as const;
const UPSTREAM = { ok: false, kind: "upstream" };

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const okBody = (text: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });

function client(fetchImpl: typeof fetch, timeoutMs?: number) {
  const base = { apiKey: KEY, model: "test-model", fetchImpl };
  return createAnthropicClient(timeoutMs === undefined ? base : { ...base, timeoutMs });
}

describe("createAnthropicClient request", () => {
  async function sent() {
    const f = fakeFetch(() => json(okBody("{}")));
    await client(f).readReceipt(ARGS);
    expect(f.calls).toHaveLength(1);
    const call = f.calls[0]!;
    return { call, body: JSON.parse(call.init?.body as string) as Record<string, any> };
  }

  it("posts to the Anthropic URL with the expected headers", async () => {
    const { call } = await sent();
    expect(call.url).toBe(ANTHROPIC_URL);
    expect(call.init?.method).toBe("POST");
    expect(call.init?.headers).toEqual({
      "content-type": "application/json",
      "x-api-key": KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    });
    expect(ANTHROPIC_VERSION).toBe("2026-10-21");
  });

  it("sends exactly the expected body keys", async () => {
    const { body } = await sent();
    expect(Object.keys(body).sort()).toEqual(
      ["max_tokens", "messages", "model", "output_config", "system"].sort(),
    );
    expect(body.model).toBe("test-model");
  });

  it("puts the image block before the text block", async () => {
    const { body } = await sent();
    const content = body.messages[0].content as { type: string }[];
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");
    expect(content.map((b) => b.type)).toEqual(["image", "text"]);
    expect(content[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "AAAA" },
    });
  });

  it("pins output_config, effort and max_tokens", async () => {
    const { body } = await sent();
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.output_config.format.schema).toEqual(MODEL_JSON_SCHEMA);
    expect(body.output_config.effort).toBe("low");
    expect(Object.keys(body.output_config).sort()).toEqual(["effort", "format"]);
    expect(body.max_tokens).toBe(16000);
  });

  it.each(["thinking", "tool_choice", "temperature", "top_p", "top_k"])(
    "does not send %s",
    async (key) => {
      const { body } = await sent();
      expect(key in body).toBe(false);
    },
  );

  it("keeps the key out of the body and passes an abort signal", async () => {
    const { call } = await sent();
    expect(call.init?.body as string).not.toContain(KEY);
    expect(call.init?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("createAnthropicClient results", () => {
  it("returns the first text block on success", async () => {
    const f = fakeFetch(() =>
      json({
        stop_reason: "end_turn",
        content: [
          { type: "thinking", thinking: "x" },
          { type: "text", text: '{"a":1}' },
          { type: "text", text: "second" },
        ],
      }),
    );
    expect(await client(f).readReceipt(ARGS)).toEqual({ ok: true, text: '{"a":1}' });
  });

  const failures: [string, () => Response | Promise<Response>][] = [
    ["thrown fetch", () => Promise.reject(new Error(`boom ${KEY}`))],
    ["HTTP 500", () => json({ error: { message: "secret detail" } }, 500)],
    ["HTTP 401", () => json({ error: { message: "bad key" } }, 401)],
    ["HTTP 429", () => json({ error: {} }, 429)],
    ["non-JSON body", () => new Response("<html>nope</html>", { status: 200 })],
    ["JSON null body", () => json(null)],
    ["stop_reason max_tokens", () => json({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] })],
    ["stop_reason refusal without message field", () => json({ stop_reason: "refusal", content: [] })],
    ["stop_reason refusal with a text block", () => json({ stop_reason: "refusal", content: [{ type: "text", text: "no" }] })],
    ["no text block", () => json({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "x" }] })],
    ["empty content", () => json({ stop_reason: "end_turn", content: [] })],
    ["missing content", () => json({ stop_reason: "end_turn" })],
  ];

  it.each(failures)("maps %s to upstream without a message", async (_name, handler) => {
    const f = fakeFetch(handler);
    const result = await client(f).readReceipt(ARGS);
    expect(result).toEqual(UPSTREAM);
    expect(Object.keys(result)).toEqual(["ok", "kind"]);
    expect(JSON.stringify(result)).not.toContain(KEY);
    expect(f.calls).toHaveLength(1); // no retries
  });

  it("aborts after timeoutMs and maps it to upstream", async () => {
    const f = fakeFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    expect(await client(f, 20).readReceipt(ARGS)).toEqual(UPSTREAM);
    expect(f.calls).toHaveLength(1);
  });
});
