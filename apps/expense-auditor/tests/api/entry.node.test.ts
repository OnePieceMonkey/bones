import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import entry from "../../api/extract";

const KEYS = ["LIVE_EXTRACTION", "ANTHROPIC_API_KEY", "EXTRACTION_MODEL", "LLM_PROVIDER", "OPENROUTER_API_KEY"] as const;

describe("api/extract.ts entry (no env, no network)", () => {
  const saved: Record<string, string | undefined> = {};
  const fetchSpy = vi.fn(() => {
    throw new Error("network access is not allowed in this test");
  });

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchSpy.mockClear();
  });

  it("GET returns {live:false}", async () => {
    const res = await entry.fetch(new Request("http://localhost/api/extract"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ live: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POST returns 403 disabled", async () => {
    const res = await entry.fetch(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: "disabled" } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it.each([
    ["openrouter", { LLM_PROVIDER: "openrouter", OPENROUTER_API_KEY: "k-or" }, "https://openrouter.ai/api/v1/chat/completions"],
    ["anthropic (default)", { ANTHROPIC_API_KEY: "k-an" }, "https://api.anthropic.com/v1/messages"],
  ])("builds the %s client from env", async (_name, vars, url) => {
    Object.assign(process.env, { LIVE_EXTRACTION: "on", EXTRACTION_MODEL: "m", ...vars });
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (u: string) => {
      seen.push(u);
      return new Response("{}", { status: 500 });
    });
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60)]).toString("base64");
    const res = await entry.fetch(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `9.9.9.${seen.length}${url.length}` },
        body: JSON.stringify({ imageBase64: jpeg, mediaType: "image/jpeg" }),
      }),
    );
    expect(res.status).toBe(502);
    expect(seen).toEqual([url]);
  });
});
