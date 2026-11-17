import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  checkRateLimit,
  type RateLimitEntry,
} from "../../api/_lib/rateLimit";

// Feature: expense-auditor, Property 21: Per-IP rate limit
// **Validates: Requirements 16.14**
describe("Property 21: Per-IP rate limit", () => {
  const keys = fc.constantFrom("a", "b", "c", "unknown");
  const t0 = fc.integer({ min: 0, max: 4_000_000_000_000 });

  it("allows exactly the first RATE_LIMIT_MAX per key within a window, with independent keys", () => {
    fc.assert(
      fc.property(
        t0,
        fc.array(fc.tuple(keys, fc.integer({ min: 0, max: RATE_LIMIT_WINDOW_MS - 1 })), {
          minLength: 1,
          maxLength: 80,
        }),
        (start, raw) => {
          // Non-decreasing times, all inside the window opened by the first request of each key.
          const reqs = [...raw].sort((x, y) => x[1] - y[1]);
          const store = new Map<string, RateLimitEntry>();
          const seen = new Map<string, number>();
          for (const [key, offset] of reqs) {
            const n = (seen.get(key) ?? 0) + 1;
            seen.set(key, n);
            const r = checkRateLimit(store, key, start + offset);
            expect(r.allowed).toBe(n <= RATE_LIMIT_MAX);
            if (!r.allowed) expect(r.retryAfterSec).toBeGreaterThanOrEqual(1);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("allows a request again once the window has expired", () => {
    fc.assert(
      fc.property(
        t0,
        keys,
        fc.integer({ min: 0, max: 3 * RATE_LIMIT_WINDOW_MS }),
        (start, key, extra) => {
          const store = new Map<string, RateLimitEntry>();
          for (let i = 0; i < RATE_LIMIT_MAX + 3; i++) checkRateLimit(store, key, start);
          expect(checkRateLimit(store, key, start).allowed).toBe(false);
          const later = checkRateLimit(store, key, start + RATE_LIMIT_WINDOW_MS + extra);
          expect(later.allowed).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
