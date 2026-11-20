import { liveStatusSchema } from "../../shared/wire";

type Attempt = "live" | "off" | "failed";

async function attemptOnce(fetchImpl: typeof fetch, endpoint: string, timeoutMs: number): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(endpoint, { method: "GET", signal: controller.signal });
    if (!res.ok) return "failed";
    const parsed = liveStatusSchema.safeParse(await res.json());
    if (!parsed.success) return "failed";
    return parsed.data.live === true ? "live" : "off";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Asks the server whether live extraction is enabled (Requirement 16.2).
 * Sends a bare GET: no body, no receipt data. Each attempt has its own timeout
 * (a cold dev server can need several seconds). After a failure (network error,
 * timeout, non-2xx, HTML fallback page, bad JSON, unexpected shape) it retries
 * once. A clean { live: false } answer returns false at once, without a retry.
 */
export async function fetchLiveStatus(
  fetchImpl: typeof fetch = fetch,
  endpoint = "/api/extract",
  timeoutMs = 8000,
): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await attemptOnce(fetchImpl, endpoint, timeoutMs);
    if (result === "live") return true;
    if (result === "off") return false;
  }
  return false;
}
