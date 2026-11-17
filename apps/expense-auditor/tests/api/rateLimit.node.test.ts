import { describe, expect, it } from "vitest";
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  checkRateLimit,
  clientKey,
  type RateLimitEntry,
} from "../../api/_lib/rateLimit";

const T0 = 1_000_000;

describe("clientKey", () => {
  it("uses the first x-forwarded-for entry", () => {
    const h = new Headers({ "x-forwarded-for": " 1.2.3.4 , 5.6.7.8", "x-real-ip": "9.9.9.9" });
    expect(clientKey(h)).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip, then unknown", () => {
    expect(clientKey(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientKey(new Headers())).toBe("unknown");
    expect(clientKey(new Headers({ "x-forwarded-for": " " }))).toBe("unknown");
  });
});

describe("checkRateLimit", () => {
  it("allows the first 10 and rejects the 11th with retryAfterSec", () => {
    const store = new Map<string, RateLimitEntry>();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(checkRateLimit(store, "a", T0 + i).allowed).toBe(true);
    }
    const r = checkRateLimit(store, "a", T0 + 1000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBe(Math.ceil((RATE_LIMIT_WINDOW_MS - 1000) / 1000));
  });

  it("allows again once the window has expired", () => {
    const store = new Map<string, RateLimitEntry>();
    for (let i = 0; i < RATE_LIMIT_MAX + 1; i++) checkRateLimit(store, "a", T0);
    expect(checkRateLimit(store, "a", T0 + RATE_LIMIT_WINDOW_MS - 1).allowed).toBe(false);
    expect(checkRateLimit(store, "a", T0 + RATE_LIMIT_WINDOW_MS).allowed).toBe(true);
    expect(store.get("a")?.count).toBe(1);
  });

  it("counts keys independently", () => {
    const store = new Map<string, RateLimitEntry>();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) checkRateLimit(store, "a", T0);
    expect(checkRateLimit(store, "a", T0).allowed).toBe(false);
    expect(checkRateLimit(store, "b", T0).allowed).toBe(true);
  });

  it("sweeps expired entries when the store grows past 1000", () => {
    const store = new Map<string, RateLimitEntry>();
    for (let i = 0; i < 1001; i++) store.set(`old${i}`, { count: 1, resetAt: T0 });
    store.set("live", { count: 1, resetAt: T0 + 10 * RATE_LIMIT_WINDOW_MS });
    checkRateLimit(store, "new", T0 + 1);
    expect(store.has("old0")).toBe(false);
    expect(store.has("live")).toBe(true);
    expect(store.has("new")).toBe(true);
    expect(store.size).toBe(2);
  });

  it("does not sweep at or below 1000 entries", () => {
    const store = new Map<string, RateLimitEntry>();
    for (let i = 0; i < 1000; i++) store.set(`old${i}`, { count: 1, resetAt: T0 });
    checkRateLimit(store, "new", T0 + 1);
    expect(store.size).toBe(1001);
  });
});
