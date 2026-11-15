import type { CoreError, ExtractionPort, ExtractionResult, KernelPorts, RawInput } from "@bones/core";
import type { PortDeps } from "../../src/pipeline/ports";

/** Deterministic deps for makePortFactory: time counts up from 1 700 000 000 000, ids are `id-<n>`. */
export function counterPorts(): Required<PortDeps> {
  let t = 1_700_000_000_000;
  let n = 0;
  return {
    now: () => t++,
    uuid: () => `id-${++n}`,
  };
}

/** Kernel ports with a fixed-result hasher, for tests that call core directly. */
export function fixedKernelPorts(hex = "0".repeat(64)): KernelPorts {
  const deps = counterPorts();
  return { clock: () => new Date(deps.now()), id: deps.uuid, hasher: () => hex };
}

/** An extraction port that returns the given result (or CoreError) and records its inputs. */
export function fakeAdapter(
  extraction: ExtractionResult | CoreError,
): ExtractionPort & { calls: RawInput[] } {
  const calls: RawInput[] = [];
  return {
    calls,
    async extract(input: RawInput) {
      calls.push(input);
      return extraction;
    },
  };
}

export type FetchHandler = (url: string, init: RequestInit | undefined) => Response | Promise<Response>;

/** A fetch replacement that records calls. */
export function fakeFetch(handler: FetchHandler): typeof fetch & {
  calls: { url: string; init: RequestInit | undefined }[];
} {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return handler(url, init);
  };
  return Object.assign(fn, { calls }) as typeof fetch & {
    calls: { url: string; init: RequestInit | undefined }[];
  };
}

/** A fake LLM: returns the queued outcomes in order (the last one repeats) and records calls. */
export function fakeLlm<T>(outcomes: readonly (T | Error)[]): {
  call: (...args: unknown[]) => Promise<T>;
  calls: unknown[][];
} {
  const calls: unknown[][] = [];
  return {
    calls,
    async call(...args: unknown[]) {
      calls.push(args);
      const index = Math.min(calls.length - 1, outcomes.length - 1);
      const outcome = outcomes[index] as T | Error;
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  };
}

/** Builds a Request for handler tests. A body that is not a string is JSON-encoded. */
export function makeRequest(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Request {
  const init: RequestInit = { method, headers: { ...headers } };
  if (body !== undefined && method !== "GET" && method !== "HEAD") {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    (init.headers as Record<string, string>)["content-type"] ??= "application/json";
  }
  return new Request("http://localhost/api/extract", init);
}
