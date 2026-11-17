import { liveStatusSchema } from "../../shared/wire";

/**
 * Asks the server whether live extraction is enabled (Requirement 16.2).
 * Sends a bare GET: no body, no receipt data. Any failure (network error,
 * timeout, non-2xx, HTML fallback page, bad JSON, unexpected shape) gives false.
 */
export async function fetchLiveStatus(
  fetchImpl: typeof fetch = fetch,
  endpoint = "/api/extract",
  timeoutMs = 3000,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(endpoint, { method: "GET", signal: controller.signal });
    if (!res.ok) return false;
    const parsed = liveStatusSchema.safeParse(await res.json());
    return parsed.success && parsed.data.live === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
