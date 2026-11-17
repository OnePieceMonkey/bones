import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLiveStatus } from "../../src/extraction/liveStatus";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchLiveStatus", () => {
  it("returns true for { live: true } and sends a bare GET", async () => {
    const fake = vi.fn(async () => json({ live: true }));
    expect(await fetchLiveStatus(fake as unknown as typeof fetch, "/api/extract")).toBe(true);
    const [url, init] = fake.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/extract");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("returns false for { live: false }", async () => {
    expect(await fetchLiveStatus((async () => json({ live: false })) as typeof fetch)).toBe(false);
  });

  it("returns false for an HTML fallback page", async () => {
    const html = (async () =>
      new Response("<!doctype html><html></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as typeof fetch;
    expect(await fetchLiveStatus(html)).toBe(false);
  });

  it("returns false for a rejected fetch", async () => {
    const failing = (async () => {
      throw new TypeError("network down");
    }) as typeof fetch;
    expect(await fetchLiveStatus(failing)).toBe(false);
  });

  it("returns false when the request is aborted after the timeout", async () => {
    vi.useFakeTimers();
    const hanging = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })) as unknown as typeof fetch;
    const pending = fetchLiveStatus(hanging, "/api/extract", 3000);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toBe(false);
  });

  it("returns false for a body with an extra key", async () => {
    expect(await fetchLiveStatus((async () => json({ live: true, extra: 1 })) as typeof fetch)).toBe(false);
  });
});
