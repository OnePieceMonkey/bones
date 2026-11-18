import { describe, expect, it } from "vitest";
import { createOpenRouterClient, OPENROUTER_URL } from "../../api/_lib/openrouter";
import { MODEL_JSON_SCHEMA, SYSTEM_PROMPT, USER_TEXT } from "../../api/_lib/schema";
import { createAnthropicClient } from "../../api/_lib/provider";
import { fakeFetch } from "../helpers/fakes";

const KEY = "sk-or-test-key-not-real";
const ARGS = { imageBase64: "AAAA", mediaType: "image/png" } as const;
const UPSTREAM = { ok: false, kind: "upstream" };
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const choice = (finish_reason: unknown, content: unknown) => ({
  choices: [{ finish_reason, message: { role: "assistant", content } }],
});

function client(fetchImpl: typeof fetch, timeoutMs?: number) {
  const base = { apiKey: KEY, model: "anthropic/claude-haiku-5.5", fetchImpl };
  return createOpenRouterClient(timeoutMs === undefined ? base : { ...base, timeoutMs });
}

describe("createOpenRouterClient request", () => {
  async function sent() {
    const f = fakeFetch(() => json(choice("stop", "{}")));
    await client(f).readReceipt(ARGS);
    expect(f.calls).toHaveLength(1);
    const call = f.calls[0]!;
    return { call, body: JSON.parse(call.init?.body as string) as Record<string, any> };
  }

  it("posts to the OpenRouter URL with exactly the expected headers", async () => {
    const { call } = await sent();
    expect(call.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(OPENROUTER_URL).toBe(call.url);
    expect(call.init?.method).toBe("POST");
    expect(call.init?.headers).toEqual({
      "content-type": "application/json",
      Authorization: `Bearer ${KEY}`,
      "X-OpenRouter-Title": "Bones Expense Auditor",
    });
  });

  it("sends exactly the expected body keys and fields", async () => {
    const { body } = await sent();
    expect(Object.keys(body).sort()).toEqual(
      ["max_tokens", "messages", "model", "provider", "reasoning", "response_format"].sort(),
    );
    expect(body.model).toBe("anthropic/claude-haiku-5.5");
    expect(body.max_tokens).toBe(16000);
    expect(body.reasoning).toEqual({ effort: "low", exclude: true });
    expect(body.provider).toEqual({ require_parameters: true });
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "receipt", strict: true, schema: MODEL_JSON_SCHEMA },
    });
  });

  it("sends the system prompt, then the image before the text", async () => {
    const { body } = await sent();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({ role: "system", content: SYSTEM_PROMPT });
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toEqual([
      { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
      { type: "text", text: USER_TEXT },
    ]);
  });

  it.each(["temperature", "top_p", "top_k", "tools"])("does not send %s", async (key) => {
    const { body } = await sent();
    expect(key in body).toBe(false);
  });

  it("keeps the key out of the body and passes an abort signal", async () => {
    const { call } = await sent();
    expect(call.init?.body as string).not.toContain(KEY);
    expect(call.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("shares the user text with the Anthropic client", async () => {
    const f = fakeFetch(() => json({ stop_reason: "end_turn", content: [] }));
    await createAnthropicClient({ apiKey: "k", model: "m", fetchImpl: f }).readReceipt(ARGS);
    expect(JSON.parse(f.calls[0]!.init?.body as string).messages[0].content[1].text).toBe(USER_TEXT);
  });
});

describe("createOpenRouterClient results", () => {
  it("returns the message content on success", async () => {
    const f = fakeFetch(() => json(choice("stop", '{"a":1}')));
    expect(await client(f).readReceipt(ARGS)).toEqual({ ok: true, text: '{"a":1}' });
  });

  const failures: [string, () => Response | Promise<Response>][] = [
    ["thrown fetch with the key in the message", () => Promise.reject(new Error(`boom Bearer ${KEY}`))],
    ["HTTP 401", () => json({ error: { message: `bad key ${KEY}` } }, 401)],
    ["HTTP 402", () => json({ error: { message: "credits" } }, 402)],
    ["HTTP 429", () => json({ error: {} }, 429)],
    ["HTTP 500", () => json({ error: { message: "secret detail" } }, 500)],
    ["200 with an error object", () => json({ error: { code: 502, message: "upstream" } })],
    ["200 with error and a valid choice", () => json({ ...choice("stop", "{}"), error: { message: "x" } })],
    ["finish_reason length", () => json(choice("length", "{"))],
    ["finish_reason content_filter", () => json(choice("content_filter", "{}"))],
    ["finish_reason error", () => json(choice("error", "{}"))],
    ["finish_reason tool_calls", () => json(choice("tool_calls", "{}"))],
    ["finish_reason null", () => json(choice(null, "{}"))],
    ["finish_reason missing", () => json({ choices: [{ message: { content: "{}" } }] })],
    ["missing choices", () => json({})],
    ["empty choices", () => json({ choices: [] })],
    ["choices not an array", () => json({ choices: "x" })],
    ["choice not an object", () => json({ choices: [null] })],
    ["missing message", () => json({ choices: [{ finish_reason: "stop" }] })],
    ["missing content", () => json({ choices: [{ finish_reason: "stop", message: {} }] })],
    ["empty content", () => json(choice("stop", ""))],
    ["null content", () => json(choice("stop", null))],
    ["non-string content", () => json(choice("stop", [{ type: "text", text: "{}" }]))],
    ["non-JSON body", () => new Response("<html>nope</html>", { status: 200 })],
    ["JSON null body", () => json(null)],
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
