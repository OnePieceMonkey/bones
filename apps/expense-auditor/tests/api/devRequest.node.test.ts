import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createExtractHandler, type LlmClient } from "../../api/_lib/handler";
import { toWebRequest } from "../../dev/toWebRequest";

const ENV = { LIVE_EXTRACTION: "on", ANTHROPIC_API_KEY: "sk-test-key-not-real", EXTRACTION_MODEL: "test-model" };
const BODY = JSON.stringify({
  imageBase64: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60)]).toString("base64"),
  mediaType: "image/jpeg",
});

function nodeRequest(headers: Record<string, string>): IncomingMessage {
  const req = Readable.from([Buffer.from(BODY)]) as unknown as IncomingMessage;
  Object.assign(req, {
    method: "POST",
    url: "/api/extract",
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  });
  return req;
}

function setup() {
  let calls = 0;
  const llm: LlmClient = {
    readReceipt: async () => {
      calls += 1;
      return { ok: false, kind: "upstream" };
    },
  };
  const handler = createExtractHandler({ env: ENV, llm, now: () => 1_700_000_000_000, rateLimitStore: new Map() });
  return { handler, calls: () => calls };
}

describe("dev middleware request conversion", () => {
  it("accepts a same-origin POST that includes the port", async () => {
    const { handler, calls } = setup();
    const res = await handler(
      toWebRequest(nodeRequest({ host: "localhost:5200", origin: "http://localhost:5200", "content-type": "application/json" })),
    );
    expect(calls()).toBe(1);
    expect(res.status).not.toBe(403);
  });

  it("still rejects a foreign origin", async () => {
    const { handler, calls } = setup();
    const res = await handler(
      toWebRequest(nodeRequest({ host: "localhost:5200", origin: "http://evil.example", "content-type": "application/json" })),
    );
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("forbidden_origin");
    expect(calls()).toBe(0);
  });

  it("falls back to localhost without a host header", () => {
    const req = toWebRequest(nodeRequest({ "content-type": "application/json" }));
    expect(new URL(req.url).host).toBe("localhost");
  });
});
