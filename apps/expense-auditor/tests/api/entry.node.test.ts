import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import entry from "../../api/extract";

const KEYS = ["LIVE_EXTRACTION", "ANTHROPIC_API_KEY", "EXTRACTION_MODEL"] as const;

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
});
