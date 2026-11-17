import { describe, expect, it } from "vitest";
import { createExtractHandler, type HandlerDeps, type LlmClient } from "../../api/_lib/handler";
import {
  errorBodySchema,
  extractionResultWireSchema,
  MAX_BODY_CHARS,
  MAX_IMAGE_BYTES,
  modelOutputSchema,
  toExtractionResult,
} from "../../shared/wire";
import { fakeLlm, makeRequest } from "../helpers/fakes";

const KEY = "sk-test-key-not-real";
const LIVE_ENV = { LIVE_EXTRACTION: "on", ANTHROPIC_API_KEY: KEY, EXTRACTION_MODEL: "test-model" };

type Outcome = Awaited<ReturnType<LlmClient["readReceipt"]>>;

const VALID_OUTPUT = {
  merchant: "Cafe Test",
  receiptDate: "2024-03-05",
  claimedTotalCents: 1250,
  lineItems: [{ description: "Coffee", amount: 1250, isAlcohol: false }],
  confidence: { merchant: 0.9, receiptDate: 0.8, claimedTotalCents: 0.95, lineItems: 0.7 },
};
const VALID_TEXT = JSON.stringify(VALID_OUTPUT);

const b64 = (bytes: number[], total = bytes.length): string => {
  const buf = Buffer.alloc(total);
  Buffer.from(bytes).copy(buf);
  return buf.toString("base64");
};
const JPEG = b64([0xff, 0xd8, 0xff, 0xe0], 64);
const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 64);
const GIF = b64([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 64);
const jpegBody = { imageBase64: JPEG, mediaType: "image/jpeg" };

function setup(outcome: Outcome | Error = { ok: true, text: VALID_TEXT }, env: HandlerDeps["env"] = LIVE_ENV) {
  const llm = fakeLlm<Outcome>([outcome]);
  const client: LlmClient = { readReceipt: (args) => llm.call(args) };
  const logs: { status: number; code: string; ms: number }[] = [];
  const handler = createExtractHandler({
    env,
    llm: client,
    now: () => 1_700_000_000_000,
    rateLimitStore: new Map(),
    log: (e) => logs.push(e),
  });
  return { handler, llm, logs };
}

async function errorOf(res: Response) {
  return errorBodySchema.parse(await res.json()).error;
}

describe("GET status", () => {
  it("reports live: true only with all three variables", async () => {
    const { handler } = setup();
    const res = await handler(makeRequest("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ live: true });
    expect(Object.keys(body)).toHaveLength(1);
  });

  it.each([
    ["flag missing", { ANTHROPIC_API_KEY: KEY, EXTRACTION_MODEL: "m" }],
    ["flag not exactly on", { ...LIVE_ENV, LIVE_EXTRACTION: "ON" }],
    ["key missing", { LIVE_EXTRACTION: "on", EXTRACTION_MODEL: "m" }],
    ["key blank", { ...LIVE_ENV, ANTHROPIC_API_KEY: "  " }],
    ["model missing", { LIVE_EXTRACTION: "on", ANTHROPIC_API_KEY: KEY }],
    ["model empty", { ...LIVE_ENV, EXTRACTION_MODEL: "" }],
  ])("reports live: false when %s", async (_name, env) => {
    const { handler, llm } = setup(undefined, env);
    const res = await handler(makeRequest("GET"));
    expect(await res.json()).toEqual({ live: false });
    expect(llm.calls).toHaveLength(0);
  });
});

describe("POST success", () => {
  it("returns toExtractionResult(parsed, text) with the exact provider text", async () => {
    const { handler, llm } = setup();
    const res = await handler(makeRequest("POST", jpegBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    const expected = toExtractionResult(modelOutputSchema.parse(VALID_OUTPUT), VALID_TEXT);
    expect(body).toEqual(expected);
    expect(extractionResultWireSchema.safeParse(body).success).toBe(true);
    expect(body.rawModelOutput).toBe(VALID_TEXT);
    expect(llm.calls).toEqual([[{ imageBase64: JPEG, mediaType: "image/jpeg" }]]);
  });

  it("accepts a PNG declared as image/png", async () => {
    const { handler, llm } = setup();
    const res = await handler(makeRequest("POST", { imageBase64: PNG, mediaType: "image/png" }));
    expect(res.status).toBe(200);
    expect(llm.calls).toHaveLength(1);
  });

  it("sets the security headers and logs only status, code and duration", async () => {
    const { handler, logs } = setup();
    const res = await handler(makeRequest("POST", jpegBody));
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(logs).toEqual([{ status: 200, code: "ok", ms: 0 }]);
  });

  it("accepts a request whose Origin host matches the request URL", async () => {
    const { handler } = setup();
    const res = await handler(makeRequest("POST", jpegBody, { origin: "http://localhost" }));
    expect(res.status).toBe(200);
  });
});

describe("rejections without a provider call", () => {
  async function expectRejected(
    req: Request,
    status: number,
    code: string,
    env?: HandlerDeps["env"],
  ) {
    const { handler, llm } = setup(undefined, env);
    const res = await handler(req);
    expect(res.status).toBe(status);
    expect((await errorOf(res)).code).toBe(code);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(llm.calls).toHaveLength(0);
    return res;
  }

  it("answers 405 with an Allow header for other methods", async () => {
    for (const method of ["PUT", "DELETE", "PATCH"]) {
      const res = await expectRejected(makeRequest(method, jpegBody), 405, "method_not_allowed");
      expect(res.headers.get("allow")).toBe("GET, POST");
    }
  });

  it("answers 403 disabled when the kill switch is off", async () => {
    await expectRejected(makeRequest("POST", jpegBody), 403, "disabled", {});
  });

  it("answers 403 for a foreign Origin", async () => {
    await expectRejected(
      makeRequest("POST", jpegBody, { origin: "https://evil.example" }),
      403,
      "forbidden_origin",
    );
  });

  it("answers 403 for an unparseable Origin", async () => {
    await expectRejected(makeRequest("POST", jpegBody, { origin: "not a url" }), 403, "forbidden_origin");
  });

  it("answers 400 for malformed JSON", async () => {
    await expectRejected(makeRequest("POST", "{not json"), 400, "bad_request");
  });

  it("answers 400 for an unknown key", async () => {
    await expectRejected(makeRequest("POST", { ...jpegBody, extra: 1 }), 400, "bad_request");
  });

  it("answers 400 for a missing field or unsupported media type", async () => {
    await expectRejected(makeRequest("POST", { mediaType: "image/jpeg" }), 400, "bad_request");
    await expectRejected(
      makeRequest("POST", { imageBase64: JPEG, mediaType: "image/gif" }),
      400,
      "bad_request",
    );
  });

  it.each([
    ["characters outside the alphabet", "@@@@"],
    ["length not a multiple of 4", "/9j/A"],
    ["padding in the middle", "AA==AAAA"],
  ])("answers 400 for bad base64 (%s)", async (_name, imageBase64) => {
    await expectRejected(makeRequest("POST", { imageBase64, mediaType: "image/jpeg" }), 400, "bad_request");
  });

  it("answers 400 for GIF bytes declared as JPEG or PNG", async () => {
    await expectRejected(makeRequest("POST", { imageBase64: GIF, mediaType: "image/jpeg" }), 400, "bad_request");
    await expectRejected(makeRequest("POST", { imageBase64: GIF, mediaType: "image/png" }), 400, "bad_request");
  });

  it("answers 400 when the bytes match the other supported type", async () => {
    await expectRejected(makeRequest("POST", { imageBase64: PNG, mediaType: "image/jpeg" }), 400, "bad_request");
    await expectRejected(makeRequest("POST", { imageBase64: JPEG, mediaType: "image/png" }), 400, "bad_request");
  });

  it("answers 413 for a body over MAX_BODY_CHARS", async () => {
    await expectRejected(makeRequest("POST", "x".repeat(MAX_BODY_CHARS + 1)), 413, "too_large");
  });

  it("answers 413 for a declared content-length over MAX_BODY_CHARS", async () => {
    await expectRejected(
      makeRequest("POST", jpegBody, { "content-length": String(MAX_BODY_CHARS + 1) }),
      413,
      "too_large",
    );
  });

  it("answers 413 for a decoded image over 3 MiB", async () => {
    const big = b64([0xff, 0xd8, 0xff], MAX_IMAGE_BYTES + 3);
    await expectRejected(makeRequest("POST", { imageBase64: big, mediaType: "image/jpeg" }), 413, "too_large");
  });
});

describe("provider outcomes", () => {
  it("answers 502 upstream_failed when the provider reports a failure", async () => {
    const { handler, llm } = setup({ ok: false, kind: "upstream" });
    const res = await handler(makeRequest("POST", jpegBody));
    expect(res.status).toBe(502);
    const error = await errorOf(res);
    expect(error.code).toBe("upstream_failed");
    expect(error.reason).toBe("upstream");
    expect(llm.calls).toHaveLength(1);
  });

  it("answers 502 upstream_failed when the client throws", async () => {
    const { handler } = setup(new Error(`boom ${KEY}`));
    const res = await handler(makeRequest("POST", jpegBody));
    expect(res.status).toBe(502);
    expect((await errorOf(res)).code).toBe("upstream_failed");
    expect(JSON.stringify([...res.headers])).not.toContain(KEY);
  });

  it.each([
    ["not JSON", "this is not json"],
    ["extra key", JSON.stringify({ ...VALID_OUTPUT, decision: "approved" })],
    ["confidence out of range", JSON.stringify({ ...VALID_OUTPUT, confidence: { ...VALID_OUTPUT.confidence, merchant: 1.5 } })],
    ["fractional cents", JSON.stringify({ ...VALID_OUTPUT, claimedTotalCents: 12.5 })],
    ["bad date", JSON.stringify({ ...VALID_OUTPUT, receiptDate: "2024-02-30" })],
  ])("answers 502 model_output_invalid for %s", async (_name, text) => {
    const { handler } = setup({ ok: true, text });
    const res = await handler(makeRequest("POST", jpegBody));
    expect(res.status).toBe(502);
    const error = await errorOf(res);
    expect(error.code).toBe("model_output_invalid");
    expect(error.reason).toBe("bad_response");
  });
});

describe("rate limit", () => {
  it("answers 429 with Retry-After after ten requests from one client", async () => {
    const { handler, llm } = setup();
    const headers = { "x-forwarded-for": "203.0.113.7" };
    for (let i = 0; i < 10; i++) {
      expect((await handler(makeRequest("POST", jpegBody, headers))).status).toBe(200);
    }
    const res = await handler(makeRequest("POST", jpegBody, headers));
    expect(res.status).toBe(429);
    expect((await errorOf(res)).code).toBe("rate_limited");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(llm.calls).toHaveLength(10);

    const other = await handler(makeRequest("POST", jpegBody, { "x-forwarded-for": "203.0.113.8" }));
    expect(other.status).toBe(200);
  });
});

describe("logging", () => {
  it("never lets a throwing logger change the response", async () => {
    const handler = createExtractHandler({
      env: LIVE_ENV,
      llm: { readReceipt: async () => ({ ok: true, text: VALID_TEXT }) },
      now: () => 0,
      rateLimitStore: new Map(),
      log: () => {
        throw new Error("log failed");
      },
    });
    expect((await handler(makeRequest("POST", jpegBody))).status).toBe(200);
  });

  it("logs rejections with status and code only", async () => {
    const { handler, logs } = setup(undefined, {});
    await handler(makeRequest("POST", jpegBody));
    expect(logs).toEqual([{ status: 403, code: "disabled", ms: 0 }]);
    expect(JSON.stringify(logs)).not.toContain(KEY);
  });
});
