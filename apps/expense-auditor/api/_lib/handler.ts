// Web-standard extract handler. It holds no secret: the key lives inside the
// injected LlmClient. All configuration comes from deps.env, never process.env.
// Check order: method, live flag, origin, rate limit, body size, parse, magic
// bytes, decoded size, provider, strict validation of the model output.
import {
  extractRequestSchema,
  MAX_BODY_CHARS,
  MAX_IMAGE_BYTES,
  modelOutputSchema,
  toExtractionResult,
} from "../../shared/wire.js";
import { checkRateLimit, clientKey } from "./rateLimit.js";

export interface LlmClient {
  readReceipt(args: { imageBase64: string; mediaType: "image/jpeg" | "image/png" }): Promise<
    { ok: true; text: string } | { ok: false; kind: "upstream" }
  >;
}

export interface RateLimitStore {
  get(key: string): { count: number; resetAt: number } | undefined;
  set(key: string, v: { count: number; resetAt: number }): void;
  delete(key: string): void;
  readonly size: number;
}

export interface HandlerDeps {
  env: Readonly<Record<string, string | undefined>>;
  llm: LlmClient;
  now: () => number;
  rateLimitStore: RateLimitStore;
  log?: (event: { status: number; code: string; ms: number }) => void;
}

type Reason = "disabled" | "network" | "bad_response" | "upstream";
type Code =
  | "disabled"
  | "forbidden_origin"
  | "method_not_allowed"
  | "bad_request"
  | "too_large"
  | "rate_limited"
  | "upstream_failed"
  | "model_output_invalid";

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

const MESSAGES: Record<Code, string> = {
  disabled: "Live reading is switched off on this server.",
  forbidden_origin: "This request came from an origin that is not allowed.",
  method_not_allowed: "Only GET and POST are supported.",
  bad_request: "The request could not be understood.",
  too_large: "The image is too large.",
  rate_limited: "Too many requests. Please try again later.",
  upstream_failed: "The reading service did not answer.",
  model_output_invalid: "The reading service returned an unusable answer.",
};

function respond(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });
}

function fail(status: number, reason: Reason, code: Code, extra: Record<string, string> = {}): Response {
  return respond(status, { error: { reason, code, message: MESSAGES[code] } }, extra);
}

function nonEmpty(v: string | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function isForeignOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin === null) return false;
  try {
    return new URL(origin).host !== new URL(req.url).host;
  } catch {
    return true;
  }
}

function decodedLength(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return (b64.length / 4) * 3 - pad;
}

// Decodes only the first 12 characters (9 bytes), enough for both signatures.
function matchesMagic(b64: string, mediaType: "image/jpeg" | "image/png"): boolean {
  let head: string;
  try {
    head = atob(b64.slice(0, 12));
  } catch {
    return false;
  }
  const bytes = Array.from(head, (c) => c.charCodeAt(0));
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  return mediaType === "image/jpeg"
    ? starts([0xff, 0xd8, 0xff])
    : starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

export function createExtractHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  // LLM_PROVIDER picks which key counts. Unset means "anthropic"; any other value is a misconfiguration.
  const providerKey = (): string | undefined => {
    const provider = deps.env.LLM_PROVIDER ?? "anthropic";
    if (provider === "anthropic") return deps.env.ANTHROPIC_API_KEY;
    if (provider === "openrouter") return deps.env.OPENROUTER_API_KEY;
    return undefined;
  };
  const isLive = (): boolean =>
    deps.env.LIVE_EXTRACTION === "on" && nonEmpty(providerKey()) && nonEmpty(deps.env.EXTRACTION_MODEL);

  async function handle(req: Request): Promise<{ res: Response; code: string }> {
    const done = (res: Response, code: string) => ({ res, code });

    if (req.method === "GET") return done(respond(200, { live: isLive() }), "ok");
    if (req.method !== "POST") {
      return done(fail(405, "bad_response", "method_not_allowed", { allow: "GET, POST" }), "method_not_allowed");
    }
    if (!isLive()) return done(fail(403, "disabled", "disabled"), "disabled");
    if (isForeignOrigin(req)) return done(fail(403, "disabled", "forbidden_origin"), "forbidden_origin");

    const limit = checkRateLimit(deps.rateLimitStore, clientKey(req.headers), deps.now());
    if (!limit.allowed) {
      return done(
        fail(429, "upstream", "rate_limited", { "retry-after": String(limit.retryAfterSec) }),
        "rate_limited",
      );
    }

    const tooLarge = () => done(fail(413, "upstream", "too_large"), "too_large");
    const badRequest = () => done(fail(400, "bad_response", "bad_request"), "bad_request");

    const declared = Number(req.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BODY_CHARS) return tooLarge();
    let text: string;
    try {
      text = await req.text();
    } catch {
      return badRequest();
    }
    if (text.length > MAX_BODY_CHARS) return tooLarge();

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return badRequest();
    }
    const request = extractRequestSchema.safeParse(json);
    if (!request.success) return badRequest();
    const { imageBase64, mediaType } = request.data;
    if (imageBase64.length % 4 !== 0 || !BASE64_PATTERN.test(imageBase64)) return badRequest();
    if (!matchesMagic(imageBase64, mediaType)) return badRequest();
    if (decodedLength(imageBase64) > MAX_IMAGE_BYTES) return tooLarge();

    const read = await deps.llm.readReceipt({ imageBase64, mediaType }).catch(() => ({ ok: false, kind: "upstream" }) as const);
    if (!read.ok) return done(fail(502, "upstream", "upstream_failed"), "upstream_failed");

    let model: unknown;
    try {
      model = JSON.parse(read.text);
    } catch {
      return done(fail(502, "bad_response", "model_output_invalid"), "model_output_invalid");
    }
    const parsed = modelOutputSchema.safeParse(model);
    if (!parsed.success) return done(fail(502, "bad_response", "model_output_invalid"), "model_output_invalid");

    return done(respond(200, toExtractionResult(parsed.data, read.text)), "ok");
  }

  return async (req) => {
    const start = deps.now();
    let out: { res: Response; code: string };
    try {
      out = await handle(req);
    } catch {
      out = { res: fail(502, "upstream", "upstream_failed"), code: "upstream_failed" };
    }
    try {
      deps.log?.({ status: out.res.status, code: out.code, ms: Math.max(0, deps.now() - start) });
    } catch {
      // logging must never change the response
    }
    return out.res;
  };
}
