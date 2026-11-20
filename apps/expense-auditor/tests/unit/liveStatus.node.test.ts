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
    await vi.advanceTimersByTimeAsync(3000); // first attempt aborts
    await vi.advanceTimersByTimeAsync(3000); // retry aborts
    expect(await pending).toBe(false);
  });

  it("retries once: first attempt rejects, second answers { live: true }", async () => {
    let n = 0;
    const fake = vi.fn(async () => {
      if (n++ === 0) throw new TypeError("cold server");
      return json({ live: true });
    });
    expect(await fetchLiveStatus(fake as unknown as typeof fetch)).toBe(true);
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it("returns false after two failures (2 calls)", async () => {
    const fake = vi.fn(async () => {
      throw new TypeError("down");
    });
    expect(await fetchLiveStatus(fake as unknown as typeof fetch)).toBe(false);
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it("accepts a slow first answer arriving at 7 s with one call", async () => {
    vi.useFakeTimers();
    const fake = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const t = setTimeout(() => resolve(json({ live: true })), 7000);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(t);
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const pending = fetchLiveStatus(fake as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(7000);
    expect(await pending).toBe(true);
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it("aborts a first attempt that hangs past 8 s and the retry succeeds", async () => {
    vi.useFakeTimers();
    let n = 0;
    const fake = vi.fn((_url: string, init?: RequestInit) => {
      if (n++ > 0) return Promise.resolve(json({ live: true }));
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    const pending = fetchLiveStatus(fake as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toBe(true);
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it("returns false at once for a clean { live: false } (1 call)", async () => {
    const fake = vi.fn(async () => json({ live: false }));
    expect(await fetchLiveStatus(fake as unknown as typeof fetch)).toBe(false);
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it("returns false for a body with an extra key", async () => {
    expect(await fetchLiveStatus((async () => json({ live: true, extra: 1 })) as typeof fetch)).toBe(false);
  });
});
