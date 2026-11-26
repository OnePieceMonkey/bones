// Per-IP fixed-window rate limiter. Best effort: the store lives in one warm
// function instance. The IP is a map key in memory only and is never logged.
import type { RateLimitStore } from "./handler.js";

export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const SWEEP_THRESHOLD = 1000;

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}


export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded !== null) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip")?.trim();
  return real ? real : "unknown";
}

function sweep(store: RateLimitStore, now: number): void {
  // Collect first: deleting while iterating a Map-like store is not guaranteed safe.
  const expired: string[] = [];
  const iterable = store as unknown as Iterable<[string, RateLimitEntry]>;
  if (typeof (iterable as { [Symbol.iterator]?: unknown })[Symbol.iterator] !== "function") return;
  for (const [k, v] of iterable) if (v.resetAt <= now) expired.push(k);
  for (const k of expired) store.delete(k);
}

export function checkRateLimit(
  store: RateLimitStore,
  key: string,
  now: number,
): { allowed: boolean; retryAfterSec: number } {
  if (store.size > SWEEP_THRESHOLD) sweep(store, now);

  let entry = store.get(key);
  if (entry !== undefined && entry.resetAt <= now) {
    store.delete(key);
    entry = undefined;
  }
  if (entry === undefined) {
    store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  store.set(key, { count: entry.count + 1, resetAt: entry.resetAt });
  return { allowed: true, retryAfterSec: 0 };
}
